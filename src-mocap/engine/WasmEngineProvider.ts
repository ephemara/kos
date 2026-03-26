import type { EngineProvider } from './EngineProvider'

type WasmModule = {
  init_gpu: (canvas: HTMLCanvasElement) => Promise<void>
  spawn_primitive: (primitiveId: string, params: any) => any
  raycast_init: (positions: Float32Array | number[], indices: Uint32Array | number[], uvs?: Float32Array | number[]) => number
  raycast: (handle: number, origin: Float32Array | number[], direction: Float32Array | number[]) => any
  raycast_dispose: (handle: number) => void
  sculpt_init: (positions: Float32Array | number[], indices: Uint32Array | number[]) => number
  sculpt_apply: (handle: number, point: Float32Array | number[], normal: Float32Array | number[], tool: string, radius: number, intensity: number, useGpu: boolean) => any
  sculpt_get_positions: (handle: number) => Float32Array | number[]
  sculpt_dispose: (handle: number) => void
  painter_init: () => number
  painter_update: (handle: number, x: number, y: number, pressure: number, params: any) => any
  painter_reset: (handle: number) => void
  painter_dispose: (handle: number) => void
}

export class WasmEngineProvider implements EngineProvider {
  private mod: WasmModule | null = null

  async init(canvas: HTMLCanvasElement) {
    const base = (import.meta as any).env?.BASE_URL || '/'
    const jsUrl = `${base}pkg/k_os_wasm.js`
    const wasmUrl = `${base}pkg/k_os_wasm_bg.wasm`
    const mod = await import(/* @vite-ignore */ jsUrl)
    await mod.default(wasmUrl)
    this.mod = mod as unknown as WasmModule
    this.mod.init_gpu(canvas)
  }

  async spawnPrimitive(primitiveId: string, params: Record<string, unknown>) {
    if (!this.mod) throw new Error('WASM not initialized')
    const res = this.mod.spawn_primitive(primitiveId, params)
    return {
      vertices: new Float32Array(res.positions),
      indices: new Uint32Array(res.indices),
      normals: new Float32Array(res.normals),
      uvs: new Float32Array(res.uvs),
    }
  }

  async raycastInit(positions: Float32Array, indices: Uint32Array, uvs?: Float32Array) {
    if (!this.mod) throw new Error('WASM not initialized')
    return this.mod.raycast_init(positions, indices, uvs)
  }

  async raycast(handle: number, origin: [number, number, number], dir: [number, number, number]) {
    if (!this.mod) throw new Error('WASM not initialized')
    const res = this.mod.raycast(handle, origin, dir)
    return res as {
      hit: boolean
      point: [number, number, number]
      normal: [number, number, number]
      uv: [number, number]
      distance: number
      triangle_id: number
      mesh_id: number
      time_ms: number
    }
  }

  async raycastDispose(handle: number) {
    if (!this.mod) throw new Error('WASM not initialized')
    this.mod.raycast_dispose(handle)
  }

  async sculptInit(positions: Float32Array, indices: Uint32Array) {
    if (!this.mod) throw new Error('WASM not initialized')
    return this.mod.sculpt_init(positions, indices)
  }

  async sculptApply(handle: number, point: [number, number, number], normal: [number, number, number], tool: string, radius: number, intensity: number, useGpu: boolean) {
    if (!this.mod) throw new Error('WASM not initialized')
    const res = this.mod.sculpt_apply(handle, point, normal, tool, radius, intensity, useGpu)
    return {
      modified_indices: res.modified_indices as number[],
      new_positions: new Float32Array(res.new_positions),
      new_normals: res.new_normals ? new Float32Array(res.new_normals) : null,
      time_ms: res.time_ms as number,
      affected_count: res.affected_count as number,
      used_gpu: res.used_gpu as boolean,
      gpu_fallback_reason: res.gpu_fallback_reason ?? null,
    }
  }

  async sculptGetPositions(handle: number) {
    if (!this.mod) throw new Error('WASM not initialized')
    const arr = this.mod.sculpt_get_positions(handle)
    return arr instanceof Float32Array ? arr : new Float32Array(arr as number[])
  }

  async sculptDispose(handle: number) {
    if (!this.mod) throw new Error('WASM not initialized')
    this.mod.sculpt_dispose(handle)
  }

  async painterInit() {
    if (!this.mod) throw new Error('WASM not initialized')
    return this.mod.painter_init()
  }

  async painterUpdate(handle: number, x: number, y: number, pressure: number, params: any) {
    if (!this.mod) throw new Error('WASM not initialized')
    return this.mod.painter_update(handle, x, y, pressure, params)
  }

  async painterReset(handle: number) {
    if (!this.mod) throw new Error('WASM not initialized')
    this.mod.painter_reset(handle)
  }

  async painterDispose(handle: number) {
    if (!this.mod) throw new Error('WASM not initialized')
    this.mod.painter_dispose(handle)
  }
}
