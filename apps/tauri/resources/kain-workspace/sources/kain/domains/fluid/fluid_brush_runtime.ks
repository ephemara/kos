/**
 * KainScript runtime preset mapper for fluid_builder.
 * This is intentionally data-driven and consumed via fluid_builder_registry.json.
 */
export const FLUID_BRUSH_PRESET_DEFAULTS = {
  water_smooth: {
    pressureGain: 0.75,
    viscosity: 0.15,
    advectionSteps: 8,
  },
  lava_viscous: {
    pressureGain: 0.62,
    viscosity: 0.48,
    advectionSteps: 5,
  },
};

export function resolveFluidPreset(presetId) {
  return FLUID_BRUSH_PRESET_DEFAULTS[presetId] ?? FLUID_BRUSH_PRESET_DEFAULTS.water_smooth;
}
