import { beforeEach, describe, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

type BrushClientModule = typeof import('../brushClient');

async function loadBrushClientModule(): Promise<BrushClientModule> {
  vi.resetModules();
  return import('../brushClient');
}

describe('brushClient minimal WGSL contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete (window as any).__TAURI__;
  });

  it('loads minimal fallback brushes in browser mode', async () => {
    const { brushClient } = await loadBrushClientModule();
    await brushClient.init();

    const brushes = brushClient.getAllBrushes();
    const ids = brushes.map((b) => b.id).sort();
    const shaders = new Set(brushes.map((b) => b.kernel.shader));

    expect(ids).toEqual(['attractor', 'clay', 'grab', 'pinch', 'smooth']);
    expect(shaders).toEqual(
      new Set(['sculpt_stamp', 'sculpt_smooth', 'sculpt_pinch', 'sculpt_grab', 'sculpt_physics'])
    );
    expect(invoke).not.toHaveBeenCalled();
  });

  it('uses tauri brush-library commands and preserves wgsl kernel payload', async () => {
    (window as any).__TAURI__ = {};
    vi.mocked(invoke)
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce([
        {
          id: 'preset_clay',
          name: 'Clay',
          category: 'Sculpt/Clay',
          tags: ['sculpt'],
          kernel: { family: 'stamp', shader: 'sculpt_stamp' },
          params: {
            radius: 0.15,
            strength: 0.6,
            hardness: 0.3,
            spacing: 0.08,
            accumulate: true,
            subtract: false,
            front_faces_only: true,
            alpha_enabled: false,
            alpha_scale: 1,
            jitter_position: 0,
            jitter_rotation: 0,
            jitter_strength: 0,
            random_seed: 0,
            pressure_curve_idx: 0,
            speed_curve_idx: 0,
            tilt_curve_idx: 0,
          },
          textures: {},
        },
      ]);

    const { brushClient } = await loadBrushClientModule();
    await brushClient.init();

    expect(invoke).toHaveBeenNthCalledWith(1, 'init_brush_library');
    expect(invoke).toHaveBeenNthCalledWith(2, 'list_brushes');

    const brush = brushClient.getBrush('preset_clay');
    expect(brush?.kernel.family).toBe('stamp');
    expect(brush?.kernel.shader).toBe('sculpt_stamp');
  });

  it('normalizes Kain custom kernels into spirv family for UI routing', async () => {
    (window as any).__TAURI__ = {};
    vi.mocked(invoke)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce([
        {
          id: 'kain_stamp_clay',
          name: 'Kain Clay',
          category: 'KAIN/Stamp',
          tags: ['kain', 'spirv'],
          kernel: { custom: 'kain:stamp_clay' },
          params: {
            radius: 0.15,
            strength: 0.6,
            hardness: 0.3,
            spacing: 0.08,
            accumulate: true,
            subtract: false,
            front_faces_only: true,
            alpha_enabled: false,
            alpha_scale: 1,
            jitter_position: 0,
            jitter_rotation: 0,
            jitter_strength: 0,
            random_seed: 0,
            pressure_curve_idx: 0,
            speed_curve_idx: 0,
            tilt_curve_idx: 0,
          },
          textures: {},
        },
      ]);

    const { brushClient } = await loadBrushClientModule();
    await brushClient.init();

    const brush = brushClient.getBrush('kain_stamp_clay');
    expect(brush?.kernel.family).toBe('spirv');
    expect(brush?.kernel.shader).toBe('stamp_clay');
  });

  it('normalizes metaphysical Kain metadata for multi-target compile routing', async () => {
    (window as any).__TAURI__ = {};
    vi.mocked(invoke)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce([
        {
          id: 'meta_chain_stamp',
          name: 'Meta Chain Stamp',
          category: 'KAIN/Meta',
          tags: ['meta', 'kain_meta'],
          kernel: { family: 'spirv', shader: 'stamp_meta' },
          meta: {
            language: 'kain_meta',
            entry: 'stamp_meta',
            targets: ['spirv', 'wasm', 'typescript'],
          },
          params: {
            radius: 0.15,
            strength: 0.6,
            hardness: 0.3,
            spacing: 0.08,
            accumulate: true,
            subtract: false,
            front_faces_only: true,
            alpha_enabled: false,
            alpha_scale: 1,
            jitter_position: 0,
            jitter_rotation: 0,
            jitter_strength: 0,
            random_seed: 0,
            pressure_curve_idx: 0,
            speed_curve_idx: 0,
            tilt_curve_idx: 0,
          },
          textures: {},
        },
      ]);

    const { brushClient } = await loadBrushClientModule();
    await brushClient.init();

    const brush = brushClient.getBrush('meta_chain_stamp');
    expect(brush?.meta?.language).toBe('kain_meta');
    expect(brush?.meta?.entry).toBe('stamp_meta');
    expect(brush?.meta?.targets).toEqual(['spirv', 'wasm', 'typescript']);
  });

  it('falls back to minimal browser set when backend init fails', async () => {
    (window as any).__TAURI__ = {};
    vi.mocked(invoke).mockRejectedValue(new Error('init failed'));

    const { brushClient } = await loadBrushClientModule();
    await brushClient.init();

    const ids = brushClient.getAllBrushes().map((b) => b.id).sort();
    expect(ids).toEqual(['attractor', 'clay', 'grab', 'pinch', 'smooth']);
  });
});
