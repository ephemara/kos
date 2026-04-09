import { describe, expect, it, vi, beforeEach } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import {
  buildKainCompileRequest,
  compileKainMetaChainForBrush,
  isMetaphysicalBrush,
  resolveKainTargets,
} from '../kainMetaCompiler';
import type { KBrushAsset } from '../brushClient';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

const makeBrush = (overrides: Partial<KBrushAsset> = {}): KBrushAsset =>
  ({
    id: 'meta_stamp',
    name: 'Meta Stamp',
    category: 'KAIN/Meta',
    tags: ['kain_meta'],
    kernel: { family: 'spirv', shader: 'stamp_meta' },
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
    meta: {
      language: 'kain_meta',
      entry: 'stamp_meta',
      targets: ['spirv', 'wasm', 'typescript'],
    },
    ...overrides,
  } as KBrushAsset);

describe('kainMetaCompiler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete (window as any).__TAURI__;
  });

  it('detects metaphysical Kain brushes', () => {
    expect(isMetaphysicalBrush(makeBrush())).toBe(true);
    expect(isMetaphysicalBrush(makeBrush({ meta: { language: 'classic' } as any }))).toBe(false);
  });

  it('normalizes requested targets and drops unsupported ones', () => {
    expect(resolveKainTargets(['spirv', 'wasm', 'invalid'])).toEqual(['spirv', 'wasm']);
  });

  it('builds compile request from brush metadata', () => {
    const request = buildKainCompileRequest(makeBrush());
    expect(request.entry).toBe('stamp_meta');
    expect(request.targets).toEqual(['spirv', 'wasm', 'typescript']);
    expect(request.toolchain.kainRoot).toBe('.');
    expect(request.toolchain.asmCrateDir).toBe('crates/k-os-kain');
    expect(request.toolchain.webCrateDir).toBe('crates/k-os-kain');
  });

  it('returns fallback when tauri backend is unavailable', async () => {
    const result = await compileKainMetaChainForBrush(makeBrush());
    expect(result.status).toBe('fallback');
    expect(result.targets).toEqual(['spirv', 'wasm', 'typescript']);
  });

  it('invokes tauri compile command when available', async () => {
    (window as any).__TAURI__ = {};
    vi.mocked(invoke).mockResolvedValueOnce({ ok: true });

    const result = await compileKainMetaChainForBrush(makeBrush(), {
      requestedTargets: ['spirv', 'hlsl'],
    });

    expect(invoke).toHaveBeenCalledWith(
      'kain_compile_multi_target',
      expect.objectContaining({
        request: expect.objectContaining({
          entry: 'stamp_meta',
          targets: ['spirv', 'hlsl'],
        }),
      })
    );
    expect(result.status).toBe('compiled');
  });

  it('reuses cached compile result for identical request', async () => {
    (window as any).__TAURI__ = {};
    vi.mocked(invoke).mockResolvedValueOnce({ ok: true });

    const brush = makeBrush({ id: 'cached_meta' });
    await compileKainMetaChainForBrush(brush, { requestedTargets: ['spirv'] });
    await compileKainMetaChainForBrush(brush, { requestedTargets: ['spirv'] });

    expect(invoke).toHaveBeenCalledTimes(1);
  });
});
