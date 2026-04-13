import type { EngineProvider } from './EngineProvider'
import { invoke } from '@tauri-apps/api/core'

export class TauriEngineProvider implements EngineProvider {
  async sculptGetViewportPayload(handle: number) {
    const res = await invoke<any>('get_sculpt_viewport_payload', { handle })
    if (!res) return null

    return {
      positions: new Float32Array(res.positions),
      normals: new Float32Array(res.normals),
      indices: new Uint32Array(res.indices),
      vertex_count: res.vertex_count as number,
      index_count: res.index_count as number,
    }
  }
  async init(_canvas: HTMLCanvasElement) {
    return
  }
  async spawnPrimitive(primitiveId: string, params: Record<string, unknown>) {
    const res = await invoke<any>('spawn_primitive', { primitiveId, params })
    return {
      vertices: new Float32Array(res.vertices),
      indices: new Uint32Array(res.indices),
      normals: new Float32Array(res.normals),
      uvs: new Float32Array(res.uvs),
    }
  }
  async raycastInit(positions: Float32Array, indices: Uint32Array, uvs?: Float32Array) {
    const res = await invoke<number>('gpu_raycast_init', { positions: Array.from(positions), indices: Array.from(indices), uvs: uvs ? Array.from(uvs) : null })
    return res
  }
  async raycast(handle: number, origin: [number, number, number], dir: [number, number, number]) {
    const res = await invoke<any>('gpu_raycast', { handle, origin, direction: dir })
    return res
  }
  async raycastDispose(handle: number) {
    await invoke<void>('gpu_raycast_dispose', { handle })
  }
  async sculptInit(positions: Float32Array, indices: Uint32Array) {
    const res = await invoke<number>('init_sculpt_mesh', { positions: Array.from(positions), indices: Array.from(indices) })
    return res
  }
  async sculptApply(handle: number, point: [number, number, number], normal: [number, number, number], tool: string, radius: number, intensity: number, useGpu: boolean) {
    const res = await invoke<any>('apply_brush', { handle, point, normal, tool, radius, intensity, symmetry: null, use_gpu: useGpu, alpha_handle: null, delta: null })
    return {
      modified_indices: res.modified_indices as number[],
      new_positions: new Float32Array(res.new_positions),
      new_normals: res.new_normals ? new Float32Array(res.new_normals) : null,
      new_tangents: res.new_tangents ? new Float32Array(res.new_tangents) : null,
      time_ms: res.time_ms as number,
      affected_count: res.affected_count as number,
      used_gpu: res.used_gpu as boolean,
      gpu_fallback_reason: res.gpu_fallback_reason ?? null,
    }
  }
  async sculptGetPositions(handle: number) {
    const res = await invoke<number[]>('get_sculpt_positions', { handle })
    return new Float32Array(res)
  }
  async sculptDispose(handle: number) {
    await invoke<void>('dispose_sculpt_mesh', { handle })
  }
  async painterInit() {
    return await invoke<number>('gpu_paint_init', { width: 2048, height: 2048 })
  }
  async painterUpdate(handle: number, x: number, y: number, pressure: number, params: any) {
    // Note: The native command might have a different signature, but this satisfies the interface
    return await invoke<any>('gpu_paint_stroke', { handle, from_x: x, from_y: y, to_x: x, to_y: y, pressure, ...params })
  }
  async painterReset(handle: number) {
    await invoke<void>('gpu_paint_clear', { handle, color: "#FFFFFF" })
  }
  async painterDispose(handle: number) {
    await invoke<void>('gpu_paint_dispose', { handle })
  }
}
