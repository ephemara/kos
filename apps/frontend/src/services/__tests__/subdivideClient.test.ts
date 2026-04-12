import { beforeEach, describe, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { rustSubdivide } from '@/services/subdivideClient';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

describe('subdivideClient GPU V2', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (window as any).__TAURI__ = {};
  });

  it('calls gpu_subdivide_v2_and_register and maps response shape', async () => {
    vi.mocked(invoke).mockResolvedValue([
      {
        positions: [0, 0, 0, 1, 0, 0, 0, 1, 0],
        indices: [0, 1, 2],
        attributes: [],
        vertex_count: 3,
        face_count: 1,
        time_ms: 2.5,
      },
      77,
    ]);

    const result = await rustSubdivide.gpuSubdivideV2AndRegister(
      new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
      new Uint32Array([0, 1, 2]),
      1
    );

    expect(invoke).toHaveBeenCalledWith('gpu_subdivide_v2_and_register', {
      positions: [0, 0, 0, 1, 0, 0, 0, 1, 0],
      indices: [0, 1, 2],
      levels: 1,
    });

    expect(result).toEqual({
      subdivision: {
        positions: [0, 0, 0, 1, 0, 0, 0, 1, 0],
        indices: [0, 1, 2],
        attributes: [],
        vertex_count: 3,
        face_count: 1,
        time_ms: 2.5,
      },
      sculptHandle: 77,
    });
  });

  it('returns null when gpu_subdivide_v2_and_register fails', async () => {
    vi.mocked(invoke).mockRejectedValue(new Error('gpu failed'));

    const result = await rustSubdivide.gpuSubdivideV2AndRegister(
      [0, 0, 0, 1, 0, 0, 0, 1, 0],
      [0, 1, 2],
      1
    );

    expect(result).toBeNull();
  });
});
