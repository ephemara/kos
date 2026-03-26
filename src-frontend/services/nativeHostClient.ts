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

export const nativeHostClient = {
  async cursor(x: number, y: number): Promise<void> {
    const invoke = await getInvoke();
    if (!invoke) return;
    await invoke('native_host_cursor', { x, y });
  },

  async cameraRotate(dx: number, dy: number): Promise<void> {
    const invoke = await getInvoke();
    if (!invoke) return;
    await invoke('native_host_camera_rotate', { dx, dy });
  },

  async cameraZoom(delta: number): Promise<void> {
    const invoke = await getInvoke();
    if (!invoke) return;
    await invoke('native_host_camera_zoom', { delta });
  },

  async brush(tool: number, radius: number, intensity: number, x: number, y: number, dx: number, dy: number): Promise<void> {
    const invoke = await getInvoke();
    if (!invoke) return;
    await invoke('native_host_brush', { tool, radius, intensity, x, y, dx, dy });
  },

  async snapshot(): Promise<void> {
    const invoke = await getInvoke();
    if (!invoke) return;
    await invoke('native_host_snapshot');
  },
};
