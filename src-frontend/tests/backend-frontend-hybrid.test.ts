import { beforeEach, describe, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { kos } from '@/lib/kos-proto/api';
import { binaryInvoke } from '@/systems/ipc/binaryIpc';
import {
  listBrushesByCategory,
  getShadingMode,
} from '@/services/configClient';
import {
  validateParticleExport,
  exportParticlesGLTF,
} from '@/services/quantumClient';
import { rustSubdivide } from '@/services/subdivideClient';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

describe('Frontend-Backend Hybrid Contracts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (window as any).__TAURI__ = {};
  });

  it('sends raw protocol messages unchanged via kos.send', async () => {
    const msg = { SetActiveTool: 'Sculpt' } as any;
    vi.mocked(invoke).mockResolvedValue(undefined);

    await kos.send(msg);

    expect(invoke).toHaveBeenCalledWith('kos_send', { msg });
  });

  it('maps optional brush settings to backend-nullable payload correctly', async () => {
    vi.mocked(invoke).mockResolvedValue(undefined);

    await kos.updateBrushSettings({ radius: 44, isAdd: true });

    expect(invoke).toHaveBeenCalledWith('kos_update_brush_settings', {
      radius: 44,
      intensity: null,
      is_add: true,
    });
  });

  it('executes sculpt workflow commands in stable order', async () => {
    vi.mocked(invoke).mockResolvedValue(undefined);

    await kos.setActiveTool('sculpt');
    await kos.switchBrush('CLAY');
    await kos.subdivide();
    await kos.remesh(128);

    expect(vi.mocked(invoke).mock.calls.map((c) => c[0])).toEqual([
      'kos_set_active_tool',
      'kos_switch_brush',
      'kos_subdivide',
      'kos_remesh',
    ]);

    expect(vi.mocked(invoke).mock.calls[3]).toEqual(['kos_remesh', { resolution: 128 }]);
  });

  it('filters backend brush registry by category on frontend', async () => {
    vi.mocked(invoke).mockResolvedValue([
      { id: 'clay', category: 'sculpt' },
      { id: 'mask', category: 'mask' },
      { id: 'draw', category: 'paint' },
    ]);

    const sculpt = await listBrushesByCategory('sculpt');

    expect(invoke).toHaveBeenCalledWith('list_config_brushes');
    expect(sculpt).toEqual([{ id: 'clay', category: 'sculpt' }]);
  });

  it('passes IDs through read commands without shape drift', async () => {
    vi.mocked(invoke).mockResolvedValue({ id: 'matcap', app: 'sculpt' });

    const mode = await getShadingMode('matcap');

    expect(invoke).toHaveBeenCalledWith('get_config_shading_mode', { id: 'matcap' });
    expect(mode).toEqual({ id: 'matcap', app: 'sculpt' });
  });

  it('binaryInvoke converts typed arrays to byte payloads for backend', async () => {
    vi.mocked(invoke).mockResolvedValue({ ok: true });

    const f32 = new Float32Array([1, 2, 3]);
    const u32 = new Uint32Array([4, 5, 6]);

    await binaryInvoke('apply_brush_binary', {
      positions: f32,
      indices: u32,
      strength: 0.8,
    });

    const [, args] = vi.mocked(invoke).mock.calls.at(-1)!;
    expect(args.positions).toHaveLength(f32.byteLength);
    expect(args.indices).toHaveLength(u32.byteLength);
    expect(args.strength).toBe(0.8);
  });

  it('binaryInvoke surfaces backend failures to frontend caller', async () => {
    vi.mocked(invoke).mockRejectedValue(new Error('backend panic'));

    await expect(binaryInvoke('apply_brush_binary', { radius: 12 })).rejects.toThrow('backend panic');
  });

  it('validates and exports quantum particle data through backend commands', async () => {
    vi.mocked(invoke)
      .mockResolvedValueOnce(1200)
      .mockResolvedValueOnce([1, 2, 3, 4]);

    const validation = await validateParticleExport(11);
    const bytes = await exportParticlesGLTF(11, 0.25, 2);

    expect(validation.isValid).toBe(true);
    expect(validation.particleCount).toBe(1200);

    expect(vi.mocked(invoke).mock.calls[0]).toEqual([
      'quantum_particle_count',
      { simId: 11 },
    ]);

    expect(vi.mocked(invoke).mock.calls[1]).toEqual([
      'quantum_export_gltf',
      { simId: 11, particleRadius: 0.25, subdivisions: 2 },
    ]);

    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(Array.from(bytes)).toEqual([1, 2, 3, 4]);
  });

  it('enforces frontend guardrails before invoking invalid export params', async () => {
    await expect(exportParticlesGLTF(7, -1, 1)).rejects.toThrow('Invalid particle radius');
    expect(invoke).not.toHaveBeenCalled();
  });

  it('uses gpu_subdivide_v2_and_register backend contract for sculpt subdivision', async () => {
    vi.mocked(invoke).mockResolvedValue([
      {
        positions: [0, 0, 0, 1, 0, 0, 0, 1, 0],
        indices: [0, 1, 2],
        vertex_count: 3,
        face_count: 1,
        time_ms: 1.2,
        attributes: [],
      },
      123,
    ]);

    const result = await rustSubdivide.gpuSubdivideV2AndRegister(
      [0, 0, 0, 1, 0, 0, 0, 1, 0],
      [0, 1, 2],
      1
    );

    expect(invoke).toHaveBeenCalledWith('gpu_subdivide_v2_and_register', {
      positions: [0, 0, 0, 1, 0, 0, 0, 1, 0],
      indices: [0, 1, 2],
      levels: 1,
    });

    expect(result?.sculptHandle).toBe(123);
    expect(result?.subdivision.vertex_count).toBe(3);
  });
});
