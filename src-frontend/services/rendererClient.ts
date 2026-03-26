import { viewportClient } from '@/services/viewportClient';
import type {
  CameraState,
  FrameStats,
  RenderMeshHandle,
  SelectionResult,
  ViewportConfig,
  ViewportHandle,
} from '@/services/viewportClient';

export type RendererEventName =
  | 'renderer_state_change'
  | 'renderer_viewport_stats'
  | 'renderer_selection_change'
  | 'renderer_status';

export interface RendererStateChangeEvent {
  viewport?: ViewportHandle;
  entityHandle?: number | null;
  meshHandle?: number | null;
  renderMeshHandle?: RenderMeshHandle | null;
  status?: string | null;
}

export interface RendererViewportStatsEvent {
  viewport: ViewportHandle;
  stats: FrameStats;
}

export interface RendererSelectionChangeEvent {
  viewport: ViewportHandle;
  selection: SelectionResult | null;
}

export interface RendererStatusEvent {
  viewport?: ViewportHandle;
  status: string;
}

export interface RendererEventPayloadMap {
  renderer_state_change: RendererStateChangeEvent;
  renderer_viewport_stats: RendererViewportStatsEvent;
  renderer_selection_change: RendererSelectionChangeEvent;
  renderer_status: RendererStatusEvent;
}

export const rendererEvents = {
  stateChange: 'renderer_state_change',
  viewportStats: 'renderer_viewport_stats',
  selectionChange: 'renderer_selection_change',
  status: 'renderer_status',
} as const satisfies Record<string, RendererEventName>;

const isTauri = (): boolean =>
  typeof window !== 'undefined' && '__TAURI__' in window;

let tauriListen:
  | (<T>(
      event: string,
      handler: (event: { payload: T }) => void,
    ) => Promise<() => void>)
  | null = null;

const getListen = async () => {
  if (tauriListen) return tauriListen;
  if (!isTauri()) return null;
  const tauri = await import('@tauri-apps/api/event');
  tauriListen = tauri.listen;
  return tauriListen;
};

export const rendererClient = {
  isAvailable(): Promise<boolean> {
    return viewportClient.isAvailable();
  },

  createViewport(config: ViewportConfig): Promise<ViewportHandle | null> {
    return viewportClient.create(config);
  },

  disposeViewport(viewport: ViewportHandle): Promise<void> {
    return viewportClient.dispose(viewport);
  },

  syncSculptMesh(
    viewport: ViewportHandle,
    sculptHandle: number,
  ): Promise<RenderMeshHandle | null> {
    return viewportClient.syncSculptMesh(viewport, sculptHandle);
  },

  syncPrimitive(viewport: ViewportHandle, primitiveId: string): Promise<void> {
    return viewportClient.syncPrimitive(viewport, primitiveId);
  },

  attachMesh(
    viewport: ViewportHandle,
    meshHandle: number,
  ): Promise<RenderMeshHandle | null> {
    return viewportClient.attachMesh(viewport, meshHandle);
  },

  detachMesh(viewport: ViewportHandle, renderMesh: RenderMeshHandle): Promise<void> {
    return viewportClient.detachMesh(viewport, renderMesh);
  },

  setCamera(viewport: ViewportHandle, camera: CameraState): Promise<void> {
    return viewportClient.setCamera(viewport, camera);
  },

  requestRedraw(viewport: ViewportHandle): Promise<void> {
    return viewportClient.requestRedraw(viewport);
  },

  requestSelection(
    viewport: ViewportHandle,
    ndcX: number,
    ndcY: number,
  ): Promise<SelectionResult | null> {
    return viewportClient.requestSelection(viewport, ndcX, ndcY);
  },

  getStats(viewport: ViewportHandle): Promise<FrameStats | null> {
    return viewportClient.getStats(viewport);
  },

  async listen<TEventName extends RendererEventName>(
    eventName: TEventName,
    handler: (payload: RendererEventPayloadMap[TEventName]) => void,
  ): Promise<() => void> {
    const listen = await getListen();
    if (!listen) {
      return () => {};
    }
    return listen<RendererEventPayloadMap[TEventName]>(eventName, (event) => {
      handler(event.payload);
    });
  },

  listenToViewportStats(
    viewport: ViewportHandle,
    handler: (stats: FrameStats) => void,
  ): Promise<() => void> {
    return this.listen(rendererEvents.viewportStats, (payload) => {
      if (payload.viewport === viewport) {
        handler(payload.stats);
      }
    });
  },

  listenToSelection(
    viewport: ViewportHandle,
    handler: (selection: SelectionResult | null) => void,
  ): Promise<() => void> {
    return this.listen(rendererEvents.selectionChange, (payload) => {
      if (payload.viewport === viewport) {
        handler(payload.selection);
      }
    });
  },

  listenToStatus(
    handler: (payload: RendererStatusEvent) => void,
  ): Promise<() => void> {
    return this.listen(rendererEvents.status, handler);
  },
};
