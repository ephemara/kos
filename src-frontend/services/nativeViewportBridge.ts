import { viewportClient, type ViewportHandle } from '@/services/viewportClient';

export type NativeViewportSyncSource =
  | { kind: 'none' }
  | { kind: 'sculpt-handle'; sculptHandle: number }
  | { kind: 'scene-mesh'; mesh: number }
  | { kind: 'primitive'; primitiveId: string }
  | { kind: 'artifact-path'; path: string }
  | { kind: 'artifact-blob'; blob: Blob };

const isTauri = (): boolean =>
  typeof window !== 'undefined' && '__TAURI__' in window;

let tauriInvoke: ((cmd: string, args?: any) => Promise<any>) | null = null;

const getInvoke = async () => {
  if (tauriInvoke) return tauriInvoke;
  if (!isTauri()) return null;
  const tauri = await import('@tauri-apps/api/core');
  tauriInvoke = tauri.invoke;
  return tauriInvoke;
};

export async function syncNativeViewportSource(
  viewport: ViewportHandle,
  source: NativeViewportSyncSource | null | undefined,
): Promise<number | null> {
  if (!source || source.kind === 'none') return null;

  if (source.kind === 'sculpt-handle') {
    return viewportClient.syncSculptMesh(viewport, source.sculptHandle);
  }

  if (source.kind === 'scene-mesh') {
    return viewportClient.syncSceneMesh(viewport, source.mesh);
  }

  if (source.kind === 'primitive') {
    await viewportClient.syncPrimitive(viewport, source.primitiveId);
    return null;
  }

  const invoke = await getInvoke();
  if (!invoke) return null;

  if (source.kind === 'artifact-path') {
    await invoke('leash_load_model', { path: source.path });
    return null;
  }

  if (source.kind === 'artifact-blob') {
    const buffer = await source.blob.arrayBuffer();
    const bytes = Array.from(new Uint8Array(buffer));
    const path = await invoke('save_temp_glb', { data: bytes }) as string;
    await invoke('leash_load_model', { path });
    return null;
  }

  return null;
}
