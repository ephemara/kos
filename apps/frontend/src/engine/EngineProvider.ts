export interface EngineProvider {
  sculptGetViewportPayload(handle: number): Promise<{
    positions: Float32Array
    normals: Float32Array
    indices: Uint32Array
    vertex_count: number
    index_count: number
  } | null>
  init(canvas: HTMLCanvasElement): Promise<void>
  spawnPrimitive(primitiveId: string, params: Record<string, unknown>): Promise<{
    vertices: Float32Array
    indices: Uint32Array
    normals: Float32Array
    uvs: Float32Array
  }>
  raycastInit(positions: Float32Array, indices: Uint32Array, uvs?: Float32Array): Promise<number>
  raycast(handle: number, origin: [number, number, number], dir: [number, number, number]): Promise<{
    hit: boolean
    point: [number, number, number]
    normal: [number, number, number]
    uv: [number, number]
    distance: number
    triangle_id: number
    mesh_id: number
    time_ms: number
  }>
  raycastDispose(handle: number): Promise<void>
  sculptInit(positions: Float32Array, indices: Uint32Array): Promise<number>
  sculptApply(handle: number, point: [number, number, number], normal: [number, number, number], tool: string, radius: number, intensity: number, useGpu: boolean): Promise<{
    modified_indices: number[]
    new_positions: Float32Array
    new_normals: Float32Array | null
    new_tangents?: Float32Array | null
    time_ms: number
    affected_count: number
    used_gpu: boolean
    gpu_fallback_reason: string | null
  }>
  sculptGetPositions(handle: number): Promise<Float32Array>
  sculptDispose(handle: number): Promise<void>
  painterInit(): Promise<number>
  painterUpdate(handle: number, x: number, y: number, pressure: number, params: any): Promise<any>
  painterReset(handle: number): Promise<void>
  painterDispose(handle: number): Promise<void>
}
