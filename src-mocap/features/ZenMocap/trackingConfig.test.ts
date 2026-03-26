import { describe, expect, it, vi } from 'vitest';

async function loadTrackingModule() {
  vi.resetModules();
  return import('./trackingConfig');
}

describe('trackingConfig', () => {
  it('applies named preset values', async () => {
    const mod = await loadTrackingModule();
    mod.setTrackingProjectScope('project-a');
    mod.applyTrackingPreset('fast');

    expect(mod.getTrackingPresetId()).toBe('fast');
    expect(mod.getTrackingSettings().overlaySmoothingAlpha).toBe(mod.TRACKING_PRESETS.fast.settings.overlaySmoothingAlpha);
    expect(mod.getTrackingSettings().historyHoldMs).toBe(mod.TRACKING_PRESETS.fast.settings.historyHoldMs);
  });

  it('isolates settings per project scope', async () => {
    const mod = await loadTrackingModule();

    mod.setTrackingProjectScope('project-alpha');
    mod.applyTrackingPreset('aggressive');
    mod.updateTrackingSettings({ minRenderConfidence: 0.42 });

    mod.setTrackingProjectScope('project-beta');
    expect(mod.getTrackingPresetId()).toBe('studio');
    expect(mod.getTrackingSettings().minRenderConfidence).toBe(mod.TRACKING_PRESETS.studio.settings.minRenderConfidence);

    mod.setTrackingProjectScope('project-alpha');
    expect(mod.getTrackingPresetId()).toBe('custom');
    expect(mod.getTrackingSettings().minRenderConfidence).toBeCloseTo(0.42, 5);
  });

  it('keeps active scope unchanged on no-op scope set', async () => {
    const mod = await loadTrackingModule();

    mod.setTrackingProjectScope('project-gamma');
    mod.applyTrackingPreset('aggressive');
    const before = mod.getTrackingSettings();
    const beforePreset = mod.getTrackingPresetId();

    mod.setTrackingProjectScope('project-gamma');
    expect(mod.getTrackingPresetId()).toBe(beforePreset);
    expect(mod.getTrackingSettings()).toEqual(before);
  });
});

