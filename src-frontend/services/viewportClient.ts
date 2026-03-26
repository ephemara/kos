/**
 * viewportClient.ts
 *
 * Typed client for the native viewport session commands.
 * This is the stable frontend surface for the early renderer migration.
 */

export type ViewportHandle = number;
export type RenderMeshHandle = number;
export type ShadingMode = 'solid' | 'wireframe';
export type RendererMode = 'native' | 'threeFallback';

export interface ViewportConfig {
  width: number;
  height: number;
  shadingMode: ShadingMode;
  backgroundColor: [number, number, number, number];
  enableSelection: boolean;
  enableShadows: boolean;
  msaaSamples: number;
  rendererMode: RendererMode;
}

export interface CameraState {
  position: [number, number, number];
  target: [number, number, number];
  up: [number, number, number];
  fovDegrees: number;
  near: number;
  far: number;
}

export interface SelectionResult {
  hit: boolean;
  meshHandle: number | null;
  faceIndex: number | null;
  position: [number, number, number] | null;
  normal: [number, number, number] | null;
  distance: number | null;
}

export interface FrameStats {
  frameTimeMs: number;
  fps: number;
  vertexCount: number;
  faceCount: number;
  drawCalls: number;
  meshSyncTimeMs: number;
  selectionLatencyMs: number;
  gpuUploadBytes: number;
  gpuMemoryBytes: number;
}

const isTauri = (): boolean =>
  typeof window !== 'undefined' && '__TAURI__' in window;

let tauriInvoke: ((cmd: string, args?: any) => Promise<any>) | null = null;

const getInvoke = async () => {
  if (tauriInvoke) return tauriInvoke;

  if (isTauri()) {
    const tauri = await import('@tauri-apps/api/core');
    tauriInvoke = tauri.invoke;
    return tauriInvoke;
  }

  return null;
};

export const viewportClient = {
  async isAvailable(): Promise<boolean> {
    return (await getInvoke()) !== null;
  },

  async create(config: ViewportConfig): Promise<ViewportHandle | null> {
    const invoke = await getInvoke();
    if (!invoke) return null;
    return invoke('viewport_create', { config });
  },

  async dispose(viewport: ViewportHandle): Promise<void> {
    const invoke = await getInvoke();
    if (!invoke) return;
    await invoke('viewport_dispose', { viewport });
  },

  async attachMesh(
    viewport: ViewportHandle,
    mesh: number,
  ): Promise<RenderMeshHandle | null> {
    const invoke = await getInvoke();
    if (!invoke) return null;
    return invoke('viewport_attach_mesh', { viewport, mesh });
  },

  async syncSculptMesh(
    viewport: ViewportHandle,
    sculptHandle: number,
  ): Promise<RenderMeshHandle | null> {
    const invoke = await getInvoke();
    if (!invoke) return null;
    return invoke('viewport_sync_sculpt_mesh', { viewport, sculptHandle });
  },

  async syncSceneMesh(
    viewport: ViewportHandle,
    mesh: number,
  ): Promise<RenderMeshHandle | null> {
    const invoke = await getInvoke();
    if (!invoke) return null;
    return invoke('viewport_sync_scene_mesh', { viewport, mesh });
  },

  async markMeshDirty(mesh: number): Promise<number> {
    const invoke = await getInvoke();
    if (!invoke) return 0;
    return invoke('viewport_mark_mesh_dirty', { mesh });
  },

  async syncPrimitive(
    viewport: ViewportHandle,
    primitiveId: string,
  ): Promise<void> {
    const invoke = await getInvoke();
    if (!invoke) return;
    await invoke('viewport_sync_primitive', { viewport, primitiveId });
  },

  async detachMesh(
    viewport: ViewportHandle,
    renderMesh: RenderMeshHandle,
  ): Promise<void> {
    const invoke = await getInvoke();
    if (!invoke) return;
    await invoke('viewport_detach_mesh', { viewport, renderMesh });
  },

  async setCamera(viewport: ViewportHandle, camera: CameraState): Promise<void> {
    const invoke = await getInvoke();
    if (!invoke) return;
    await invoke('viewport_set_camera', { viewport, camera });
  },

  async requestRedraw(viewport: ViewportHandle): Promise<void> {
    const invoke = await getInvoke();
    if (!invoke) return;
    await invoke('viewport_request_redraw', { viewport });
  },

  async requestSelection(
    viewport: ViewportHandle,
    ndcX: number,
    ndcY: number,
  ): Promise<SelectionResult | null> {
    const invoke = await getInvoke();
    if (!invoke) return null;
    return invoke('viewport_request_selection', { viewport, ndcX, ndcY });
  },

  async getStats(viewport: ViewportHandle): Promise<FrameStats | null> {
    const invoke = await getInvoke();
    if (!invoke) return null;
    return invoke('viewport_get_stats', { viewport });
  },
};
