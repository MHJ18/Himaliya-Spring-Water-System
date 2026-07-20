export const FLUID_TIERS = {
  STATIC: {
    name: 'static',
    fps: 0,
    simResolution: 0,
    dyeResolution: 0,
    pressureIterations: 0,
    maxDpr: 1,
  },
  LOW: {
    name: 'low',
    fps: 24,
    simResolution: 64,
    dyeResolution: 192,
    pressureIterations: 10,
    maxDpr: 1,
  },
  MEDIUM: {
    name: 'medium',
    fps: 30,
    simResolution: 96,
    dyeResolution: 320,
    pressureIterations: 14,
    maxDpr: 1.25,
  },
  HIGH: {
    name: 'high',
    fps: 45,
    simResolution: 128,
    dyeResolution: 512,
    pressureIterations: 18,
    maxDpr: 1.5,
  },
};

export function getFluidQuality(environment = {}) {
  const {
    reducedMotion = false,
    webgl = true,
    hardwareConcurrency = 8,
    deviceMemory = 8,
    devicePixelRatio = 1,
    viewportWidth = 1280,
    viewportHeight = 800,
    coarsePointer = false,
  } = environment;

  if (reducedMotion || !webgl) return FLUID_TIERS.STATIC;

  const shortEdge = Math.min(viewportWidth, viewportHeight);
  const lowPower = hardwareConcurrency <= 4 || deviceMemory <= 4;
  const constrainedScreen = shortEdge <= 480 || (coarsePointer && shortEdge <= 768);

  if (lowPower || constrainedScreen) return FLUID_TIERS.LOW;

  const mediumPower = hardwareConcurrency <= 8
    || deviceMemory <= 8
    || devicePixelRatio >= 2.5
    || shortEdge <= 900;

  if (mediumPower) return FLUID_TIERS.MEDIUM;
  return FLUID_TIERS.HIGH;
}

export function readFluidEnvironment(reducedMotion = false) {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return { reducedMotion, webgl: false };
  }

  let webgl = false;
  try {
    const canvas = document.createElement('canvas');
    webgl = Boolean(
      canvas.getContext('webgl2', { failIfMajorPerformanceCaveat: true })
      || canvas.getContext('webgl', { failIfMajorPerformanceCaveat: true }),
    );
  } catch (error) {
    webgl = false;
  }

  return {
    reducedMotion,
    webgl,
    hardwareConcurrency: navigator.hardwareConcurrency || 4,
    deviceMemory: navigator.deviceMemory || 4,
    devicePixelRatio: window.devicePixelRatio || 1,
    viewportWidth: window.innerWidth || 1280,
    viewportHeight: window.innerHeight || 800,
    coarsePointer: Boolean(
      window.matchMedia && window.matchMedia('(pointer: coarse)').matches,
    ),
  };
}
