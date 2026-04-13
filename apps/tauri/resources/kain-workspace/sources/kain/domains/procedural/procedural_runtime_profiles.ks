/**
 * KainScript runtime preset mapper for procedural_builder.
 * Presets are referenced by procedural_builder_registry.json.
 */
export const PROCEDURAL_RUNTIME_PROFILE_DEFAULTS = {
  terrain_macro_noise: {
    octaveCount: 6,
    roughness: 0.58,
    warpStrength: 0.14,
  },
  surface_cell_pattern: {
    cellScale: 12.0,
    edgeSharpness: 0.82,
    blendAmount: 0.35,
  },
};

export function resolveProceduralProfile(profileId) {
  return PROCEDURAL_RUNTIME_PROFILE_DEFAULTS[profileId] ?? PROCEDURAL_RUNTIME_PROFILE_DEFAULTS.terrain_macro_noise;
}
