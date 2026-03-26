/**
 * Data-driven runtime defaults consumed by brush_builder_registry.json.
 */
export const BRUSH_PRESET_DEFAULTS = {
  ink_liner: {
    spacing: 0.08,
    jitter: 0.01,
    flow: 0.95,
  },
  soft_airbrush: {
    spacing: 0.24,
    jitter: 0.09,
    flow: 0.42,
  },
};

export function resolveBrushPreset(presetId) {
  return BRUSH_PRESET_DEFAULTS[presetId] ?? BRUSH_PRESET_DEFAULTS.ink_liner;
}
