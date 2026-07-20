import { FLUID_TIERS, getFluidQuality } from '../fluidQuality';

describe('getFluidQuality', () => {
  it('always returns a static experience for reduced motion', () => {
    expect(getFluidQuality({ reducedMotion: true, webgl: true })).toBe(FLUID_TIERS.STATIC);
  });

  it('returns a static experience when WebGL is unavailable', () => {
    expect(getFluidQuality({ reducedMotion: false, webgl: false })).toBe(FLUID_TIERS.STATIC);
  });

  it('downscales constrained touch devices', () => {
    expect(getFluidQuality({
      webgl: true,
      hardwareConcurrency: 6,
      deviceMemory: 6,
      viewportWidth: 390,
      viewportHeight: 844,
      coarsePointer: true,
    })).toBe(FLUID_TIERS.LOW);
  });

  it('uses the medium tier for typical laptops', () => {
    expect(getFluidQuality({
      webgl: true,
      hardwareConcurrency: 8,
      deviceMemory: 8,
      devicePixelRatio: 1.5,
      viewportWidth: 1440,
      viewportHeight: 900,
    })).toBe(FLUID_TIERS.MEDIUM);
  });

  it('reserves the high tier for capable hardware', () => {
    expect(getFluidQuality({
      webgl: true,
      hardwareConcurrency: 12,
      deviceMemory: 16,
      devicePixelRatio: 1.5,
      viewportWidth: 1600,
      viewportHeight: 1000,
    })).toBe(FLUID_TIERS.HIGH);
  });
});
