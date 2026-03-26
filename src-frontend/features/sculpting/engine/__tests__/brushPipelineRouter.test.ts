import { describe, expect, it, vi } from 'vitest';
import {
  dispatchBrushPipeline,
  isSpirvBrush,
  resolveBrushPipeline,
  resolveBrushShaderName,
} from '../brushPipelineRouter';
import type { KBrushAsset } from '@/services/brushClient';

const makeBrush = (overrides: Partial<KBrushAsset>): KBrushAsset =>
  ({
    id: 'test_brush',
    name: 'Test Brush',
    category: 'Sculpt/Test',
    tags: [],
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
    ...overrides,
  } as KBrushAsset);

describe('JARVIS Kain Brush Pipeline Router', () => {
  it('detects SPIR-V family brushes', () => {
    const kain = makeBrush({ kernel: { family: 'spirv', shader: 'stamp_clay' } as any });
    const wgsl = makeBrush({ kernel: { family: 'stamp', shader: 'sculpt_stamp' } as any });

    expect(isSpirvBrush(kain)).toBe(true);
    expect(isSpirvBrush(wgsl)).toBe(false);
  });

  it('routes Kain brushes to SPIR-V pipeline only when Kain toggle is enabled', () => {
    const kain = makeBrush({ kernel: { family: 'spirv', shader: 'stamp_clay' } as any });

    expect(resolveBrushPipeline(kain, true)).toBe('kain_spirv');
    expect(resolveBrushPipeline(kain, false)).toBe('wgsl');
  });

  it('dispatches SPIR-V handler for Kain brush selection', async () => {
    const kain = makeBrush({ kernel: { family: 'spirv', shader: 'stamp_clay' } as any });
    const onKainMeta = vi.fn();
    const onKainSpirv = vi.fn();
    const onWgsl = vi.fn();

    const pipeline = await dispatchBrushPipeline(kain, true, { onKainMeta, onKainSpirv, onWgsl });

    expect(pipeline).toBe('kain_spirv');
    expect(onKainSpirv).toHaveBeenCalledTimes(1);
    expect(onKainMeta).not.toHaveBeenCalled();
    expect(onWgsl).not.toHaveBeenCalled();
  });

  it('dispatches WGSL handler for non-Kain brushes', async () => {
    const wgslBrush = makeBrush({ kernel: { family: 'smooth', shader: 'sculpt_smooth' } as any });
    const onKainMeta = vi.fn();
    const onKainSpirv = vi.fn();
    const onWgsl = vi.fn();

    const pipeline = await dispatchBrushPipeline(wgslBrush, true, { onKainMeta, onKainSpirv, onWgsl });

    expect(pipeline).toBe('wgsl');
    expect(onWgsl).toHaveBeenCalledTimes(1);
    expect(onKainMeta).not.toHaveBeenCalled();
    expect(onKainSpirv).not.toHaveBeenCalled();
  });

  it('routes metaphysical Kain brushes to kain_meta pipeline', async () => {
    const metaBrush = makeBrush({
      kernel: { family: 'spirv', shader: 'stamp_meta' } as any,
      meta: { language: 'kain_meta', entry: 'stamp_meta' } as any,
    });
    const onKainMeta = vi.fn();
    const onKainSpirv = vi.fn();
    const onWgsl = vi.fn();

    const pipeline = await dispatchBrushPipeline(metaBrush, true, { onKainMeta, onKainSpirv, onWgsl });

    expect(pipeline).toBe('kain_meta');
    expect(onKainMeta).toHaveBeenCalledTimes(1);
    expect(onKainSpirv).not.toHaveBeenCalled();
    expect(onWgsl).not.toHaveBeenCalled();
  });

  it('resolves shader names consistently for both kernel shapes', () => {
    const strKernel = makeBrush({ kernel: 'sculpt_stamp' as any });
    const objKernel = makeBrush({ kernel: { family: 'spirv', shader: 'stamp_flatten' } as any });

    expect(resolveBrushShaderName(strKernel)).toBe('sculpt_stamp');
    expect(resolveBrushShaderName(objKernel)).toBe('stamp_flatten');
  });
});
