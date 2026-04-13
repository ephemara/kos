/**
 * Data-driven KainScript runtime defaults used by kainscript_builder_registry.json.
 */
export const KAINSCRIPT_RUNTIME_PROFILE_DEFAULTS = {
  ui_runtime_bundle: {
    moduleFormat: "esm",
    sourcemap: true,
    minify: false,
  },
  automation_runtime_bundle: {
    moduleFormat: "esm",
    sourcemap: false,
    minify: true,
  },
};

export function resolveKainScriptProfile(profileId) {
  return KAINSCRIPT_RUNTIME_PROFILE_DEFAULTS[profileId] ?? KAINSCRIPT_RUNTIME_PROFILE_DEFAULTS.ui_runtime_bundle;
}
