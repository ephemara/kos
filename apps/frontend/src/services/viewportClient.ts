/**
 * viewportClient.ts
 *
 * Typed client for the native viewport session commands.
 * Backend-facing DTOs come from the generated Specta contract.
 */

import {
  viewportAttachMesh,
  viewportCreate,
  viewportDetachMesh,
  viewportDispose,
  viewportGetStats,
  viewportMarkMeshDirty,
  viewportRequestRedraw,
  viewportRequestSelection,
  viewportSetCamera,
  viewportSyncPrimitive,
  viewportSyncSceneMesh,
  viewportSyncSculptMesh,
} from '@/generated/tauriRegistry.gen';
import type {
  CameraState,
  FrameStats,
  RendererMode,
  SelectionResult,
  ShadingMode,
  ViewportConfig,
} from '@/generated/tauriRegistry.gen';

export type { CameraState, FrameStats, RendererMode, SelectionResult, ShadingMode, ViewportConfig };
export type ViewportHandle = number;
export type RenderMeshHandle = number;

const isTauri = (): boolean =>
  typeof window !== 'undefined' && '__TAURI__' in window;

export const viewportClient = {
  async isAvailable(): Promise<boolean> {
    return isTauri();
  },

  async create(config: ViewportConfig): Promise<ViewportHandle | null> {
    if (!isTauri()) return null;
    return viewportCreate(config);
  },

  async dispose(viewport: ViewportHandle): Promise<void> {
    if (!isTauri()) return;
    await viewportDispose(viewport);
  },

  async attachMesh(
    viewport: ViewportHandle,
    mesh: number,
  ): Promise<RenderMeshHandle | null> {
    if (!isTauri()) return null;
    return viewportAttachMesh(viewport, mesh);
  },

  async syncSculptMesh(
    viewport: ViewportHandle,
    sculptHandle: number,
  ): Promise<RenderMeshHandle | null> {
    if (!isTauri()) return null;
    return viewportSyncSculptMesh(viewport, sculptHandle);
  },

  async syncSceneMesh(
    viewport: ViewportHandle,
    mesh: number,
  ): Promise<RenderMeshHandle | null> {
    if (!isTauri()) return null;
    return viewportSyncSceneMesh(viewport, mesh);
  },

  async markMeshDirty(mesh: number): Promise<number> {
    if (!isTauri()) return 0;
    return viewportMarkMeshDirty(mesh);
  },

  async syncPrimitive(
    viewport: ViewportHandle,
    primitiveId: string,
  ): Promise<void> {
    if (!isTauri()) return;
    await viewportSyncPrimitive(viewport, primitiveId);
  },

  async detachMesh(
    viewport: ViewportHandle,
    renderMesh: RenderMeshHandle,
  ): Promise<void> {
    if (!isTauri()) return;
    await viewportDetachMesh(viewport, renderMesh);
  },

  async setCamera(viewport: ViewportHandle, camera: CameraState): Promise<void> {
    if (!isTauri()) return;
    await viewportSetCamera(viewport, camera);
  },

  async requestRedraw(viewport: ViewportHandle): Promise<void> {
    if (!isTauri()) return;
    await viewportRequestRedraw(viewport);
  },

  async requestSelection(
    viewport: ViewportHandle,
    ndcX: number,
    ndcY: number,
  ): Promise<SelectionResult | null> {
    if (!isTauri()) return null;
    return viewportRequestSelection(viewport, ndcX, ndcY);
  },

  async getStats(viewport: ViewportHandle): Promise<FrameStats | null> {
    if (!isTauri()) return null;
    return viewportGetStats(viewport);
  },
};
