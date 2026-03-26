/**
 * Data-driven shader profile defaults used by shader_builder_registry.json.
 */
export const SHADER_PROFILE_DEFAULTS = {
  surface_pbr: {
    entryPoint: "main",
    optimization: "balanced",
    validation: true,
  },
  post_tonemap: {
    entryPoint: "main",
    optimization: "throughput",
    validation: true,
  },
};

export function resolveShaderProfile(profileId) {
  return SHADER_PROFILE_DEFAULTS[profileId] ?? SHADER_PROFILE_DEFAULTS.surface_pbr;
}
