import React from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useFBO } from '@react-three/drei/core/Fbo';
import {
  advectionFragmentShader,
  baseVertexShader,
  copyFragmentShader,
  curlFragmentShader,
  displayFragmentShader,
  divergenceFragmentShader,
  gradientSubtractFragmentShader,
  pressureFragmentShader,
  splatFragmentShader,
  vorticityFragmentShader,
} from './fluidShaders';
import { getFluidQuality, readFluidEnvironment } from './fluidQuality';
import './FluidSimulation.css';

const FLUID_PROFILES = {
  hero: {
    curl: 19,
    dyeDissipation: 0.993,
    velocityDissipation: 0.985,
    radius: 0.0018,
    exposure: 1.15,
  },
  refill: {
    curl: 13,
    dyeDissipation: 0.996,
    velocityDissipation: 0.989,
    radius: 0.0032,
    exposure: 1.08,
  },
  retail: {
    curl: 24,
    dyeDissipation: 0.989,
    velocityDissipation: 0.979,
    radius: 0.0012,
    exposure: 1.2,
  },
};

const DYE_COLORS = {
  hero: [
    [0.29, 0.83, 0.94],
    [0.1, 0.46, 0.86],
    [0.36, 0.9, 0.74],
  ],
  refill: [
    [0.04, 0.43, 0.47],
    [0.18, 0.65, 0.69],
  ],
  retail: [
    [0.4, 0.8, 0.83],
    [0.16, 0.58, 0.64],
  ],
};

const TAU = Math.PI * 2;

// Virtual currents that stand in for the pointer. Each traces a two-term
// Lissajous path whose frequencies share no simple ratio, so the motion never
// visibly repeats, and the solver is handed the path's own derivative as the
// stroke velocity — the same signal a moving cursor used to produce. Driving
// the existing splat path (rather than bolting on a separate animation) is what
// keeps the fluid's character identical to the interactive version.
const AUTONOMOUS_CURRENTS = [
  {
    center: [0.34, 0.54],
    amplitude: [0.27, 0.21],
    primary: [0.047, 0.071],
    secondary: [0.019, 0.031],
    phase: [0, 1.7],
    phaseSecondary: [2.4, 0.7],
    colorIndex: 0,
    strength: 1,
  },
  {
    center: [0.68, 0.46],
    amplitude: [0.24, 0.24],
    primary: [0.037, 0.053],
    secondary: [0.023, 0.013],
    phase: [2.1, 4.3],
    phaseSecondary: [0.9, 3.6],
    colorIndex: 1,
    strength: 0.86,
  },
  {
    center: [0.54, 0.68],
    amplitude: [0.31, 0.15],
    primary: [0.029, 0.061],
    secondary: [0.011, 0.025],
    phase: [4.8, 2.2],
    phaseSecondary: [1.5, 5.1],
    colorIndex: 2,
    strength: 0.72,
  },
];

// Path speed is ~0.1 screen-widths per second, so it needs a sizeable scale to
// read as a stroke; the dye rate is per-second and gets multiplied by the frame
// delta, which keeps density identical across the 24-60fps tiers.
const CURRENT_VELOCITY_SCALE = 180;
const CURRENT_DYE_RATE = 6.4;
const DROP_INTERVAL_SECONDS = 2.9;

// 0.72/0.28 keeps the primary sweep readable while the slower second term stops
// the path from ever closing on itself.
function sampleCurrent(current, time) {
  const [centerX, centerY] = current.center;
  const [amplitudeX, amplitudeY] = current.amplitude;
  const [primaryX, primaryY] = current.primary;
  const [secondaryX, secondaryY] = current.secondary;
  const [phaseX, phaseY] = current.phase;
  const [phaseSecondaryX, phaseSecondaryY] = current.phaseSecondary;

  const anglePrimaryX = TAU * primaryX * time + phaseX;
  const angleSecondaryX = TAU * secondaryX * time + phaseSecondaryX;
  const anglePrimaryY = TAU * primaryY * time + phaseY;
  const angleSecondaryY = TAU * secondaryY * time + phaseSecondaryY;

  return {
    point: [
      centerX + amplitudeX * (0.72 * Math.sin(anglePrimaryX) + 0.28 * Math.sin(angleSecondaryX)),
      centerY + amplitudeY * (0.72 * Math.sin(anglePrimaryY) + 0.28 * Math.sin(angleSecondaryY)),
    ],
    delta: [
      amplitudeX * TAU
        * (0.72 * primaryX * Math.cos(anglePrimaryX) + 0.28 * secondaryX * Math.cos(angleSecondaryX)),
      amplitudeY * TAU
        * (0.72 * primaryY * Math.cos(anglePrimaryY) + 0.28 * secondaryY * Math.cos(angleSecondaryY)),
    ],
  };
}

function useSystemReducedMotion(forcedValue) {
  const [systemPreference, setSystemPreference] = React.useState(() => (
    typeof window !== 'undefined'
    && window.matchMedia
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ));

  React.useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updatePreference = (event) => setSystemPreference(event.matches);
    if (mediaQuery.addEventListener) mediaQuery.addEventListener('change', updatePreference);
    else mediaQuery.addListener(updatePreference);
    return () => {
      if (mediaQuery.removeEventListener) mediaQuery.removeEventListener('change', updatePreference);
      else mediaQuery.removeListener(updatePreference);
    };
  }, []);

  return Boolean(forcedValue || systemPreference);
}

function resolveResolution(baseResolution, width, height) {
  const aspectRatio = width / Math.max(height, 1);
  if (aspectRatio >= 1) {
    return {
      width: Math.round(baseResolution * aspectRatio),
      height: baseResolution,
    };
  }
  return {
    width: baseResolution,
    height: Math.round(baseResolution / aspectRatio),
  };
}

function createMaterial(fragmentShader, uniforms) {
  return new THREE.ShaderMaterial({
    vertexShader: baseVertexShader,
    fragmentShader,
    uniforms,
    depthTest: false,
    depthWrite: false,
    transparent: false,
    blending: THREE.NoBlending,
    toneMapped: false,
  });
}

function makeDoubleTarget(read, write) {
  return {
    read,
    write,
    swap() {
      const temporary = this.read;
      this.read = this.write;
      this.write = temporary;
    },
  };
}

function FrameTicker({ fps, running }) {
  const invalidate = useThree((state) => state.invalidate);

  React.useEffect(() => {
    if (!running || !fps) return undefined;
    let frameId = 0;
    let previousTime = 0;
    const minimumInterval = 1000 / fps;

    const tick = (time) => {
      if (time - previousTime >= minimumInterval) {
        previousTime = time;
        invalidate();
      }
      frameId = window.requestAnimationFrame(tick);
    };

    frameId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frameId);
  }, [fps, invalidate, running]);

  return null;
}

function FluidSolver({
  autonomous,
  mode,
  onReady,
  quality,
  running,
  splatsRef,
}) {
  const { gl, size } = useThree();
  const profile = FLUID_PROFILES[mode] || FLUID_PROFILES.hero;
  const simSize = resolveResolution(quality.simResolution, size.width, size.height);
  const dyeSize = resolveResolution(quality.dyeResolution, size.width, size.height);
  const targetOptions = React.useMemo(() => ({
    type: THREE.HalfFloatType,
    format: THREE.RGBAFormat,
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    wrapS: THREE.ClampToEdgeWrapping,
    wrapT: THREE.ClampToEdgeWrapping,
    depthBuffer: false,
    stencilBuffer: false,
    generateMipmaps: false,
  }), []);

  const velocityA = useFBO(simSize.width, simSize.height, targetOptions);
  const velocityB = useFBO(simSize.width, simSize.height, targetOptions);
  const dyeA = useFBO(dyeSize.width, dyeSize.height, targetOptions);
  const dyeB = useFBO(dyeSize.width, dyeSize.height, targetOptions);
  const pressureA = useFBO(simSize.width, simSize.height, targetOptions);
  const pressureB = useFBO(simSize.width, simSize.height, targetOptions);
  const divergence = useFBO(simSize.width, simSize.height, targetOptions);
  const curl = useFBO(simSize.width, simSize.height, targetOptions);

  const velocity = React.useMemo(
    () => makeDoubleTarget(velocityA, velocityB),
    [velocityA, velocityB],
  );
  const dye = React.useMemo(
    () => makeDoubleTarget(dyeA, dyeB),
    [dyeA, dyeB],
  );
  const pressure = React.useMemo(
    () => makeDoubleTarget(pressureA, pressureB),
    [pressureA, pressureB],
  );

  const pass = React.useMemo(() => {
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const geometry = new THREE.PlaneGeometry(2, 2);
    const mesh = new THREE.Mesh(geometry);
    mesh.frustumCulled = false;
    scene.add(mesh);
    return { scene, camera, geometry, mesh };
  }, []);

  const materials = React.useMemo(() => ({
    advection: createMaterial(advectionFragmentShader, {
      uVelocity: { value: null },
      uSource: { value: null },
      uVelocityTexelSize: { value: new THREE.Vector2() },
      uSourceTexelSize: { value: new THREE.Vector2() },
      uDt: { value: 0.016 },
      uDissipation: { value: 0.99 },
    }),
    copy: createMaterial(copyFragmentShader, {
      uTexture: { value: null },
      uValue: { value: 0.8 },
    }),
    curl: createMaterial(curlFragmentShader, {
      uVelocity: { value: null },
      uTexelSize: { value: new THREE.Vector2() },
    }),
    display: createMaterial(displayFragmentShader, {
      uDye: { value: null },
      uTexelSize: { value: new THREE.Vector2() },
      // Vector uniforms bypass THREE.Color's automatic working-space conversion;
      // this custom material already owns its output mapping.
      uBackground: { value: new THREE.Vector3(7 / 255, 59 / 255, 76 / 255) },
      uMist: { value: new THREE.Vector3(243 / 255, 250 / 255, 249 / 255) },
      uExposure: { value: FLUID_PROFILES.hero.exposure },
    }),
    divergence: createMaterial(divergenceFragmentShader, {
      uVelocity: { value: null },
      uTexelSize: { value: new THREE.Vector2() },
    }),
    gradient: createMaterial(gradientSubtractFragmentShader, {
      uPressure: { value: null },
      uVelocity: { value: null },
      uTexelSize: { value: new THREE.Vector2() },
    }),
    pressure: createMaterial(pressureFragmentShader, {
      uPressure: { value: null },
      uDivergence: { value: null },
      uTexelSize: { value: new THREE.Vector2() },
    }),
    splat: createMaterial(splatFragmentShader, {
      uTarget: { value: null },
      uAspectRatio: { value: 1 },
      uColor: { value: new THREE.Vector3() },
      uPoint: { value: new THREE.Vector2() },
      uRadius: { value: FLUID_PROFILES.hero.radius },
    }),
    vorticity: createMaterial(vorticityFragmentShader, {
      uVelocity: { value: null },
      uCurl: { value: null },
      uTexelSize: { value: new THREE.Vector2() },
      uCurlStrength: { value: FLUID_PROFILES.hero.curl },
      uDt: { value: 0.016 },
    }),
  }), []);

  const initializedRef = React.useRef(false);
  const ambientTimeRef = React.useRef(0);
  const readyRef = React.useRef(false);
  const previousModeRef = React.useRef(mode);
  const simTexelSize = React.useMemo(
    () => new THREE.Vector2(1 / simSize.width, 1 / simSize.height),
    [simSize.height, simSize.width],
  );
  const dyeTexelSize = React.useMemo(
    () => new THREE.Vector2(1 / dyeSize.width, 1 / dyeSize.height),
    [dyeSize.height, dyeSize.width],
  );

  React.useEffect(() => () => {
    Object.keys(materials).forEach((key) => materials[key].dispose());
    pass.geometry.dispose();
  }, [materials, pass.geometry]);

  React.useEffect(() => {
    materials.display.uniforms.uExposure.value = profile.exposure;
    materials.splat.uniforms.uRadius.value = profile.radius;
    materials.vorticity.uniforms.uCurlStrength.value = profile.curl;
  }, [materials, profile]);

  const renderPass = React.useCallback((material, target) => {
    pass.mesh.material = material;
    gl.setRenderTarget(target);
    gl.render(pass.scene, pass.camera);
  }, [gl, pass]);

  const clearTargets = React.useCallback(() => {
    const previousColor = gl.getClearColor(new THREE.Color());
    const previousAlpha = gl.getClearAlpha();
    gl.setClearColor(0x000000, 0);
    [
      velocity.read,
      velocity.write,
      dye.read,
      dye.write,
      pressure.read,
      pressure.write,
      divergence,
      curl,
    ].forEach((target) => {
      gl.setRenderTarget(target);
      gl.clear(true, false, false);
    });
    gl.setRenderTarget(null);
    gl.setClearColor(previousColor, previousAlpha);
  }, [curl, divergence, dye, gl, pressure, velocity]);

  const applySplat = React.useCallback((splat) => {
    const splatMaterial = materials.splat;
    const point = splat.point || [0.5, 0.5];
    const velocityColor = splat.velocity || [0, 0];
    const dyeColor = splat.color || [0.3, 0.72, 0.76];
    splatMaterial.uniforms.uAspectRatio.value = size.width / Math.max(size.height, 1);
    splatMaterial.uniforms.uPoint.value.set(point[0], point[1]);
    splatMaterial.uniforms.uRadius.value = splat.radius || profile.radius;

    splatMaterial.uniforms.uTarget.value = velocity.read.texture;
    splatMaterial.uniforms.uColor.value.set(velocityColor[0], velocityColor[1], 0);
    renderPass(splatMaterial, velocity.write);
    velocity.swap();

    splatMaterial.uniforms.uTarget.value = dye.read.texture;
    splatMaterial.uniforms.uColor.value.set(dyeColor[0], dyeColor[1], dyeColor[2]);
    renderPass(splatMaterial, dye.write);
    dye.swap();
  }, [dye, materials.splat, profile.radius, renderPass, size.height, size.width, velocity]);

  const seedFluid = React.useCallback(() => {
    const colors = DYE_COLORS[mode] || DYE_COLORS.hero;
    [
      { point: [0.18, 0.72], velocity: [58, -16], color: colors[0].map((value) => value * 1.7) },
      { point: [0.76, 0.58], velocity: [-46, 22], color: colors[1].map((value) => value * 1.9) },
      { point: [0.54, 0.24], velocity: [12, 54], color: colors[0].map((value) => value * 1.25) },
    ].forEach(applySplat);
  }, [applySplat, mode]);

  useFrame((state, frameDelta) => {
    if (!running) return;

    if (!initializedRef.current) {
      clearTargets();
      seedFluid();
      initializedRef.current = true;
    } else if (previousModeRef.current !== mode) {
      seedFluid();
      previousModeRef.current = mode;
    }

    const queuedSplats = splatsRef.current.splice(0, 12);
    queuedSplats.forEach(applySplat);

    const delta = Math.min(Math.max(frameDelta, 0.001), 0.033);
    const colors = DYE_COLORS[mode] || DYE_COLORS.hero;
    const elapsed = state.clock.elapsedTime;

    // The currents run every frame so the dye is continuously renewed instead
    // of decaying to a flat field between ambient pulses.
    if (autonomous) {
      AUTONOMOUS_CURRENTS.forEach((current) => {
        const { point, delta: pathDelta } = sampleCurrent(current, elapsed);
        const gain = CURRENT_DYE_RATE * delta * current.strength;
        applySplat({
          point,
          velocity: [
            pathDelta[0] * CURRENT_VELOCITY_SCALE * current.strength,
            pathDelta[1] * CURRENT_VELOCITY_SCALE * current.strength,
          ],
          color: colors[current.colorIndex % colors.length].map((value) => value * gain),
          radius: profile.radius * 1.5,
        });
      });
    }

    ambientTimeRef.current += delta;
    const dropInterval = autonomous ? DROP_INTERVAL_SECONDS : 3.4;
    if (ambientTimeRef.current > dropInterval) {
      ambientTimeRef.current = 0;
      const phase = elapsed * 0.21;
      // A slow bloom with almost no directional push, so it reads as a drop
      // landing rather than another stroke.
      applySplat({
        point: [0.56 + Math.sin(phase) * 0.28, 0.48 + Math.cos(phase * 0.74) * 0.18],
        velocity: autonomous
          ? [Math.cos(phase * 1.7) * 6, Math.sin(phase * 1.3) * 6]
          : [Math.cos(phase) * 14, Math.sin(phase * 0.8) * 11],
        color: colors[Math.floor(elapsed / dropInterval) % colors.length]
          .map((value) => value * (autonomous ? 0.5 : 0.78)),
        radius: profile.radius * (autonomous ? 3.2 : 1.18),
      });
    }

    materials.curl.uniforms.uVelocity.value = velocity.read.texture;
    materials.curl.uniforms.uTexelSize.value.copy(simTexelSize);
    renderPass(materials.curl, curl);

    materials.vorticity.uniforms.uVelocity.value = velocity.read.texture;
    materials.vorticity.uniforms.uCurl.value = curl.texture;
    materials.vorticity.uniforms.uTexelSize.value.copy(simTexelSize);
    materials.vorticity.uniforms.uCurlStrength.value = profile.curl;
    materials.vorticity.uniforms.uDt.value = delta;
    renderPass(materials.vorticity, velocity.write);
    velocity.swap();

    materials.divergence.uniforms.uVelocity.value = velocity.read.texture;
    materials.divergence.uniforms.uTexelSize.value.copy(simTexelSize);
    renderPass(materials.divergence, divergence);

    materials.copy.uniforms.uTexture.value = pressure.read.texture;
    materials.copy.uniforms.uValue.value = 0.8;
    renderPass(materials.copy, pressure.write);
    pressure.swap();

    materials.pressure.uniforms.uDivergence.value = divergence.texture;
    materials.pressure.uniforms.uTexelSize.value.copy(simTexelSize);
    for (let index = 0; index < quality.pressureIterations; index += 1) {
      materials.pressure.uniforms.uPressure.value = pressure.read.texture;
      renderPass(materials.pressure, pressure.write);
      pressure.swap();
    }

    materials.gradient.uniforms.uPressure.value = pressure.read.texture;
    materials.gradient.uniforms.uVelocity.value = velocity.read.texture;
    materials.gradient.uniforms.uTexelSize.value.copy(simTexelSize);
    renderPass(materials.gradient, velocity.write);
    velocity.swap();

    materials.advection.uniforms.uVelocity.value = velocity.read.texture;
    materials.advection.uniforms.uSource.value = velocity.read.texture;
    materials.advection.uniforms.uVelocityTexelSize.value.copy(simTexelSize);
    materials.advection.uniforms.uSourceTexelSize.value.copy(simTexelSize);
    materials.advection.uniforms.uDt.value = delta;
    materials.advection.uniforms.uDissipation.value = Math.pow(
      profile.velocityDissipation,
      delta * 60,
    );
    renderPass(materials.advection, velocity.write);
    velocity.swap();

    materials.advection.uniforms.uVelocity.value = velocity.read.texture;
    materials.advection.uniforms.uSource.value = dye.read.texture;
    materials.advection.uniforms.uVelocityTexelSize.value.copy(simTexelSize);
    materials.advection.uniforms.uSourceTexelSize.value.copy(dyeTexelSize);
    materials.advection.uniforms.uDt.value = delta;
    materials.advection.uniforms.uDissipation.value = Math.pow(
      profile.dyeDissipation,
      delta * 60,
    );
    renderPass(materials.advection, dye.write);
    dye.swap();

    materials.display.uniforms.uDye.value = dye.read.texture;
    materials.display.uniforms.uTexelSize.value.copy(dyeTexelSize);
    materials.display.uniforms.uExposure.value = profile.exposure;
    renderPass(materials.display, null);
    gl.setRenderTarget(null);

    if (!readyRef.current) {
      readyRef.current = true;
      onReady();
    }
  }, 1);

  return null;
}

function CapabilityGate({ children, onUnsupported }) {
  const { gl } = useThree();
  const [supported, setSupported] = React.useState(false);
  const [checked, setChecked] = React.useState(false);

  React.useEffect(() => {
    const canvas = gl.domElement;
    const hasFloatTargets = gl.capabilities.isWebGL2
      && gl.extensions.has('EXT_color_buffer_float');
    setSupported(hasFloatTargets);
    setChecked(true);
    if (!hasFloatTargets) onUnsupported();

    const handleContextLost = (event) => {
      event.preventDefault();
      setSupported(false);
      onUnsupported();
    };
    canvas.addEventListener('webglcontextlost', handleContextLost, false);
    return () => canvas.removeEventListener('webglcontextlost', handleContextLost, false);
  }, [gl, onUnsupported]);

  if (!checked || !supported) return null;
  return children;
}

class CanvasErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    this.props.onError();
  }

  render() {
    if (this.state.failed) return null;
    return this.props.children;
  }
}

function FluidCanvas({
  autonomous,
  mode,
  onError,
  onReady,
  quality,
  running,
  splatsRef,
}) {
  return (
    <CanvasErrorBoundary onError={onError}>
      <Canvas
        aria-hidden="true"
        className="fluid-simulation__canvas"
        dpr={quality.maxDpr}
        frameloop="demand"
        gl={{
          alpha: false,
          antialias: false,
          depth: false,
          powerPreference: quality.name === 'high' ? 'high-performance' : 'default',
          preserveDrawingBuffer: false,
          stencil: false,
        }}
      >
        <CapabilityGate onUnsupported={onError}>
          <FrameTicker fps={quality.fps} running={running} />
          <FluidSolver
            autonomous={autonomous}
            mode={mode}
            onReady={onReady}
            quality={quality}
            running={running}
            splatsRef={splatsRef}
          />
        </CapabilityGate>
      </Canvas>
    </CanvasErrorBoundary>
  );
}

/**
 * @param {boolean} autonomous  Drive the fluid from its own currents and ignore
 *   pointer and scroll input entirely. The hero uses this; the lab does not.
 */
export default function FluidSimulation({
  active = true,
  autonomous = false,
  className = '',
  eager = false,
  interactionRef,
  mode = 'hero',
  reduceMotion = false,
}) {
  const hostRef = React.useRef(null);
  const splatsRef = React.useRef([]);
  const reducedMotion = useSystemReducedMotion(reduceMotion);
  const quality = React.useMemo(
    () => getFluidQuality(readFluidEnvironment(reducedMotion)),
    [reducedMotion],
  );
  const [idleReady, setIdleReady] = React.useState(eager);
  const [canvasReady, setCanvasReady] = React.useState(false);
  const [contextFailed, setContextFailed] = React.useState(false);
  const [inView, setInView] = React.useState(true);
  const [pageVisible, setPageVisible] = React.useState(() => (
    typeof document === 'undefined' || document.visibilityState !== 'hidden'
  ));

  const isStatic = quality.name === 'static' || contextFailed;
  const running = active && idleReady && inView && pageVisible && !isStatic;

  React.useEffect(() => {
    if (isStatic) return undefined;
    if (eager) {
      setIdleReady(true);
      return undefined;
    }
    let timerId = 0;
    let idleId = 0;
    const markReady = () => setIdleReady(true);
    if ('requestIdleCallback' in window) {
      idleId = window.requestIdleCallback(markReady, { timeout: 900 });
    } else {
      timerId = window.setTimeout(markReady, 140);
    }
    return () => {
      if (idleId && 'cancelIdleCallback' in window) window.cancelIdleCallback(idleId);
      if (timerId) window.clearTimeout(timerId);
    };
  }, [eager, isStatic]);

  React.useEffect(() => {
    const element = hostRef.current;
    if (!element || !('IntersectionObserver' in window)) return undefined;
    const observer = new window.IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { rootMargin: '160px 0px', threshold: 0.01 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  React.useEffect(() => {
    const updateVisibility = () => setPageVisible(document.visibilityState !== 'hidden');
    document.addEventListener('visibilitychange', updateVisibility);
    return () => document.removeEventListener('visibilitychange', updateVisibility);
  }, []);

  React.useEffect(() => {
    if (isStatic || !active || autonomous) return undefined;
    const target = (interactionRef && interactionRef.current) || hostRef.current;
    if (!target) return undefined;
    const pointers = new Map();
    let frameId = 0;
    let pendingEvent = null;

    const pushSplat = (event) => {
      const rect = target.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const previous = pointers.get(event.pointerId);
      const point = [
        (event.clientX - rect.left) / rect.width,
        1 - ((event.clientY - rect.top) / rect.height),
      ];
      const nextPointer = { x: event.clientX, y: event.clientY };
      pointers.set(event.pointerId, nextPointer);
      if (!previous) return;

      const dx = (event.clientX - previous.x) / rect.width;
      const dy = -(event.clientY - previous.y) / rect.height;
      if (Math.abs(dx) + Math.abs(dy) < 0.0005) return;
      const colors = DYE_COLORS[mode] || DYE_COLORS.hero;
      const baseColor = colors[point[0] > 0.52 ? 1 : 0];
      const velocityScale = event.pointerType === 'touch' ? 1150 : 820;

      splatsRef.current.push({
        point,
        velocity: [dx * velocityScale, dy * velocityScale],
        color: baseColor.map((value) => value * 1.75),
        radius: (FLUID_PROFILES[mode] || FLUID_PROFILES.hero).radius,
      });
      if (splatsRef.current.length > 24) splatsRef.current.splice(0, splatsRef.current.length - 24);
    };

    const processPointer = () => {
      frameId = 0;
      if (pendingEvent) pushSplat(pendingEvent);
      pendingEvent = null;
    };
    const handlePointerMove = (event) => {
      if (event.pointerType === 'touch' && event.buttons === 0) return;
      pendingEvent = event;
      if (!frameId) frameId = window.requestAnimationFrame(processPointer);
    };
    const handlePointerDown = (event) => {
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    };
    const handlePointerEnd = (event) => pointers.delete(event.pointerId);

    target.addEventListener('pointerdown', handlePointerDown, { passive: true });
    target.addEventListener('pointermove', handlePointerMove, { passive: true });
    target.addEventListener('pointerup', handlePointerEnd, { passive: true });
    target.addEventListener('pointercancel', handlePointerEnd, { passive: true });
    target.addEventListener('pointerleave', handlePointerEnd, { passive: true });

    return () => {
      if (frameId) window.cancelAnimationFrame(frameId);
      target.removeEventListener('pointerdown', handlePointerDown);
      target.removeEventListener('pointermove', handlePointerMove);
      target.removeEventListener('pointerup', handlePointerEnd);
      target.removeEventListener('pointercancel', handlePointerEnd);
      target.removeEventListener('pointerleave', handlePointerEnd);
    };
  }, [active, autonomous, interactionRef, isStatic, mode]);

  React.useEffect(() => {
    if (isStatic || !active || autonomous) return undefined;
    let previousScroll = window.scrollY;
    let frameId = 0;
    const handleScroll = () => {
      if (frameId) return;
      frameId = window.requestAnimationFrame(() => {
        frameId = 0;
        const nextScroll = window.scrollY;
        const delta = nextScroll - previousScroll;
        previousScroll = nextScroll;
        if (!inView || Math.abs(delta) < 2) return;
        const colors = DYE_COLORS[mode] || DYE_COLORS.hero;
        const color = colors[Math.abs(Math.round(nextScroll / 240)) % colors.length];
        splatsRef.current.push({
          point: [0.5 + Math.sin(nextScroll * 0.004) * 0.22, 0.52],
          velocity: [Math.sin(nextScroll * 0.003) * 12, Math.max(-42, Math.min(42, -delta * 0.65))],
          color: color.map((value) => value * 0.7),
          radius: (FLUID_PROFILES[mode] || FLUID_PROFILES.hero).radius * 1.35,
        });
      });
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      if (frameId) window.cancelAnimationFrame(frameId);
      window.removeEventListener('scroll', handleScroll);
    };
  }, [active, autonomous, inView, isStatic, mode]);

  const handleError = React.useCallback(() => {
    setContextFailed(true);
    setCanvasReady(false);
  }, []);

  return (
    <div
      ref={hostRef}
      className={[
        'fluid-simulation',
        `fluid-simulation--${mode}`,
        canvasReady ? 'is-canvas-ready' : '',
        isStatic ? 'is-static' : '',
        className,
      ].filter(Boolean).join(' ')}
      data-fluid-quality={quality.name}
      aria-hidden="true"
    >
      <div className="fluid-simulation__fallback" />
      {idleReady && !isStatic && (
        <FluidCanvas
          autonomous={autonomous}
          mode={mode}
          onError={handleError}
          onReady={() => setCanvasReady(true)}
          quality={quality}
          running={running}
          splatsRef={splatsRef}
        />
      )}
    </div>
  );
}
