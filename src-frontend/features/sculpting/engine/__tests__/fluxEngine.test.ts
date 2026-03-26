import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { FluxEngine } from '../fluxEngine';

function makeTestMesh(): THREE.Mesh {
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array([
    0, 0, 0,
    1, 0, 0,
    0, 1, 0,
  ]);
  const normals = new Float32Array([
    0, 0, 1,
    0, 0, 1,
    0, 0, 1,
  ]);
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  return new THREE.Mesh(geo, new THREE.MeshBasicMaterial());
}

describe('FluxEngine (JS fallback)', () => {
  let initGpuSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    initGpuSpy = vi.spyOn(FluxEngine.prototype as any, '_initGPU').mockResolvedValue(false);
  });

  afterEach(() => {
    initGpuSpy.mockRestore();
  });

  it('accumulates repeated external force injections before integration', async () => {
    const engine = new FluxEngine();
    const mesh = makeTestMesh();
    await engine.initFromMesh(mesh, { dt: 1, damping: 1, surfaceTension: 0, gravity: 0 });

    let latest = new Float32Array(0);
    engine.onFrame = (positions) => {
      latest = positions;
    };

    const forces = new Float32Array([
      1, 0, 0, 0,
      0, 0, 0, 0,
      0, 0, 0, 0,
    ]);

    engine.injectExternalForces(forces, 3);
    engine.injectExternalForces(forces, 3);
    await engine.step();

    expect(latest[0]).toBeCloseTo(2, 6);
    engine.dispose();
  });

  it('resetVelocity drains velocity/forces so mesh stops moving without new input', async () => {
    const engine = new FluxEngine();
    const mesh = makeTestMesh();
    await engine.initFromMesh(mesh, { dt: 1, damping: 1, surfaceTension: 0, gravity: 0 });

    let latest = new Float32Array(0);
    engine.onFrame = (positions) => {
      latest = positions;
    };

    const forces = new Float32Array([
      1, 0, 0, 0,
      0, 0, 0, 0,
      0, 0, 0, 0,
    ]);

    engine.injectExternalForces(forces, 3);
    await engine.step();
    const afterImpulse = latest[0];

    engine.resetVelocity();
    await engine.step();
    const afterResetStep = latest[0];

    expect(afterImpulse).toBeCloseTo(1, 6);
    expect(afterResetStep).toBeCloseTo(afterImpulse, 6);
    engine.dispose();
  });
});

describe('FluxEngine (GPU mocked path)', () => {
  it('accumulates external injections into externalForceBuf (not brush forceBuf)', () => {
    const engine = new FluxEngine() as any;
    const writeBuffer = vi.fn();

    engine.isReady = true;
    engine.usingGPU = true;
    engine.vertCount = 2;
    engine.forceBuf = { id: 'brush_force_buf' };
    engine.externalForceBuf = { id: 'external_force_buf' };
    engine.queue = { writeBuffer };
    engine.gpuExternalAccum = new Float32Array(engine.vertCount * 4);

    const a = new Float32Array([
      1, 2, 3, 0,
      4, 5, 6, 0,
    ]);
    const b = new Float32Array([
      0.5, 1, 1.5, 0,
      2, 2.5, 3, 0,
    ]);

    engine.injectExternalForces(a, 2);
    engine.injectExternalForces(b, 2);

    expect(writeBuffer).toHaveBeenCalledTimes(2);
    expect(writeBuffer.mock.calls[0][0]).toBe(engine.externalForceBuf);
    expect(writeBuffer.mock.calls[1][0]).toBe(engine.externalForceBuf);

    const secondPayload = new Float32Array(writeBuffer.mock.calls[1][2] as ArrayBuffer);
    expect(secondPayload[0]).toBeCloseTo(1.5, 6);
    expect(secondPayload[1]).toBeCloseTo(3, 6);
    expect(secondPayload[2]).toBeCloseTo(4.5, 6);
    expect(secondPayload[4]).toBeCloseTo(6, 6);
    expect(secondPayload[5]).toBeCloseTo(7.5, 6);
    expect(secondPayload[6]).toBeCloseTo(9, 6);
  });

  it('resetVelocity clears velocity, brush force, and external force GPU buffers', () => {
    const engine = new FluxEngine() as any;
    const writeBuffer = vi.fn();

    engine.isReady = true;
    engine.usingGPU = true;
    engine.vertCount = 3;
    engine.velocityBuf = { id: 'velocity' };
    engine.forceBuf = { id: 'force' };
    engine.externalForceBuf = { id: 'external' };
    engine.queue = { writeBuffer };
    engine.gpuExternalAccum = new Float32Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);

    engine.resetVelocity();

    expect(writeBuffer).toHaveBeenCalledTimes(3);
    expect(writeBuffer.mock.calls[0][0]).toBe(engine.velocityBuf);
    expect(writeBuffer.mock.calls[1][0]).toBe(engine.forceBuf);
    expect(writeBuffer.mock.calls[2][0]).toBe(engine.externalForceBuf);

    for (const call of writeBuffer.mock.calls) {
      const payload = call[2] as Float32Array;
      expect(payload).toHaveLength(12);
      expect(Array.from(payload).every(v => v === 0)).toBe(true);
    }
    expect(Array.from(engine.gpuExternalAccum).every((v: number) => v === 0)).toBe(true);
  });
});
