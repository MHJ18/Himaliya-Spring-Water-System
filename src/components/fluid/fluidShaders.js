export const baseVertexShader = `
  varying vec2 vUv;

  void main () {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const manualBilerp = `
  vec4 bilerp (sampler2D sam, vec2 uv, vec2 texelSize) {
    vec2 st = uv / texelSize - 0.5;
    vec2 iuv = floor(st);
    vec2 fuv = fract(st);
    vec2 a = (iuv + vec2(0.5, 0.5)) * texelSize;
    vec2 b = (iuv + vec2(1.5, 0.5)) * texelSize;
    vec2 c = (iuv + vec2(0.5, 1.5)) * texelSize;
    vec2 d = (iuv + vec2(1.5, 1.5)) * texelSize;
    return mix(
      mix(texture2D(sam, a), texture2D(sam, b), fuv.x),
      mix(texture2D(sam, c), texture2D(sam, d), fuv.x),
      fuv.y
    );
  }
`;

export const copyFragmentShader = `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uTexture;
  uniform float uValue;

  void main () {
    gl_FragColor = texture2D(uTexture, vUv) * uValue;
  }
`;

export const splatFragmentShader = `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uTarget;
  uniform float uAspectRatio;
  uniform vec3 uColor;
  uniform vec2 uPoint;
  uniform float uRadius;

  void main () {
    vec2 p = vUv - uPoint;
    p.x *= uAspectRatio;
    vec3 splat = exp(-dot(p, p) / max(uRadius, 0.00001)) * uColor;
    vec3 base = texture2D(uTarget, vUv).xyz;
    gl_FragColor = vec4(base + splat, 1.0);
  }
`;

export const advectionFragmentShader = `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uVelocity;
  uniform sampler2D uSource;
  uniform vec2 uVelocityTexelSize;
  uniform vec2 uSourceTexelSize;
  uniform float uDt;
  uniform float uDissipation;

  ${manualBilerp}

  void main () {
    vec2 velocity = bilerp(uVelocity, vUv, uVelocityTexelSize).xy;
    vec2 coord = vUv - uDt * velocity * uVelocityTexelSize;
    gl_FragColor = uDissipation * bilerp(uSource, coord, uSourceTexelSize);
  }
`;

export const curlFragmentShader = `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uVelocity;
  uniform vec2 uTexelSize;

  void main () {
    float left = texture2D(uVelocity, vUv - vec2(uTexelSize.x, 0.0)).y;
    float right = texture2D(uVelocity, vUv + vec2(uTexelSize.x, 0.0)).y;
    float bottom = texture2D(uVelocity, vUv - vec2(0.0, uTexelSize.y)).x;
    float top = texture2D(uVelocity, vUv + vec2(0.0, uTexelSize.y)).x;
    float value = 0.5 * (right - left - top + bottom);
    gl_FragColor = vec4(value, 0.0, 0.0, 1.0);
  }
`;

export const vorticityFragmentShader = `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uVelocity;
  uniform sampler2D uCurl;
  uniform vec2 uTexelSize;
  uniform float uCurlStrength;
  uniform float uDt;

  void main () {
    float left = abs(texture2D(uCurl, vUv - vec2(uTexelSize.x, 0.0)).x);
    float right = abs(texture2D(uCurl, vUv + vec2(uTexelSize.x, 0.0)).x);
    float bottom = abs(texture2D(uCurl, vUv - vec2(0.0, uTexelSize.y)).x);
    float top = abs(texture2D(uCurl, vUv + vec2(0.0, uTexelSize.y)).x);
    float center = texture2D(uCurl, vUv).x;

    vec2 force = 0.5 * vec2(top - bottom, right - left);
    force /= length(force) + 0.0001;
    force *= uCurlStrength * center;
    force.y *= -1.0;

    vec2 velocity = texture2D(uVelocity, vUv).xy;
    velocity += force * uDt;
    velocity = clamp(velocity, vec2(-1000.0), vec2(1000.0));
    gl_FragColor = vec4(velocity, 0.0, 1.0);
  }
`;

export const divergenceFragmentShader = `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uVelocity;
  uniform vec2 uTexelSize;

  void main () {
    vec2 center = texture2D(uVelocity, vUv).xy;
    float left = texture2D(uVelocity, vUv - vec2(uTexelSize.x, 0.0)).x;
    float right = texture2D(uVelocity, vUv + vec2(uTexelSize.x, 0.0)).x;
    float bottom = texture2D(uVelocity, vUv - vec2(0.0, uTexelSize.y)).y;
    float top = texture2D(uVelocity, vUv + vec2(0.0, uTexelSize.y)).y;

    if (vUv.x < uTexelSize.x) left = -center.x;
    if (vUv.x > 1.0 - uTexelSize.x) right = -center.x;
    if (vUv.y < uTexelSize.y) bottom = -center.y;
    if (vUv.y > 1.0 - uTexelSize.y) top = -center.y;

    float divergence = 0.5 * (right - left + top - bottom);
    gl_FragColor = vec4(divergence, 0.0, 0.0, 1.0);
  }
`;

export const pressureFragmentShader = `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uPressure;
  uniform sampler2D uDivergence;
  uniform vec2 uTexelSize;

  void main () {
    float left = texture2D(uPressure, vUv - vec2(uTexelSize.x, 0.0)).x;
    float right = texture2D(uPressure, vUv + vec2(uTexelSize.x, 0.0)).x;
    float bottom = texture2D(uPressure, vUv - vec2(0.0, uTexelSize.y)).x;
    float top = texture2D(uPressure, vUv + vec2(0.0, uTexelSize.y)).x;
    float divergence = texture2D(uDivergence, vUv).x;
    float pressure = (left + right + bottom + top - divergence) * 0.25;
    gl_FragColor = vec4(pressure, 0.0, 0.0, 1.0);
  }
`;

export const gradientSubtractFragmentShader = `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uPressure;
  uniform sampler2D uVelocity;
  uniform vec2 uTexelSize;

  void main () {
    float left = texture2D(uPressure, vUv - vec2(uTexelSize.x, 0.0)).x;
    float right = texture2D(uPressure, vUv + vec2(uTexelSize.x, 0.0)).x;
    float bottom = texture2D(uPressure, vUv - vec2(0.0, uTexelSize.y)).x;
    float top = texture2D(uPressure, vUv + vec2(0.0, uTexelSize.y)).x;
    vec2 velocity = texture2D(uVelocity, vUv).xy;
    velocity -= vec2(right - left, top - bottom);
    gl_FragColor = vec4(velocity, 0.0, 1.0);
  }
`;

export const displayFragmentShader = `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uDye;
  uniform vec2 uTexelSize;
  uniform vec3 uBackground;
  uniform vec3 uMist;
  uniform float uExposure;

  float fluidLuma (vec3 color) {
    return dot(color, vec3(0.2126, 0.7152, 0.0722));
  }

  void main () {
    vec3 dye = max(texture2D(uDye, vUv).rgb, vec3(0.0));
    vec3 left = texture2D(uDye, vUv - vec2(uTexelSize.x, 0.0)).rgb;
    vec3 right = texture2D(uDye, vUv + vec2(uTexelSize.x, 0.0)).rgb;
    vec3 bottom = texture2D(uDye, vUv - vec2(0.0, uTexelSize.y)).rgb;
    vec3 top = texture2D(uDye, vUv + vec2(0.0, uTexelSize.y)).rgb;

    vec2 normal = vec2(
      fluidLuma(right) - fluidLuma(left),
      fluidLuma(top) - fluidLuma(bottom)
    );
    float diffuse = clamp(0.65 + dot(normalize(vec3(normal, 0.7)), normalize(vec3(-0.4, 0.6, 0.8))) * 0.35, 0.25, 1.15);
    vec3 mapped = vec3(1.0) - exp(-dye * uExposure);
    float density = clamp(max(max(mapped.r, mapped.g), mapped.b), 0.0, 1.0);
    float depthLight = mix(0.76, 1.24, smoothstep(0.02, 0.98, vUv.y));
    vec3 color = uBackground * depthLight + mapped * diffuse * 1.12;
    color = mix(color, uMist, density * density * 0.13);

    float vignette = smoothstep(1.25, 0.28, distance(vUv, vec2(0.5)));
    color *= mix(0.84, 1.0, vignette);
    gl_FragColor = vec4(color, 1.0);
  }
`;
