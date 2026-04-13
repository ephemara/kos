export interface NativeGizmoTransform {
  translation: [number, number, number];
  rotation: [number, number, number, number];
  scale: [number, number, number];
}

export interface NativeGizmoInteraction {
  cursorPos: [number, number];
  hovered: boolean;
  dragStarted: boolean;
  dragging: boolean;
}

export interface NativeGizmoViewport {
  min: [number, number];
  max: [number, number];
  pixelsPerPoint: number;
}

export type NativeGizmoMode = 'translate' | 'rotate' | 'scale';
export type NativeGizmoOrientation = 'world' | 'local';

export interface NativeGizmoUpdateRequest {
  mode: 'Translate' | 'Rotate' | 'Scale';
  orientation: 'World' | 'Local';
  snapping: boolean;
  snapAngle?: number;
  snapDistance?: number;
  snapScale?: number;
  viewMatrix: number[];
  projectionMatrix: number[];
  viewport: NativeGizmoViewport;
  interaction: NativeGizmoInteraction;
  targets: NativeGizmoTransform[];
}

export interface NativeGizmoDrawData {
  vertices: [number, number][];
  colors: [number, number, number, number][];
  indices: number[];
}

export interface NativeGizmoResult {
  kind: string;
  axis?: [number, number, number] | null;
  deltaTranslation?: [number, number, number] | null;
  totalTranslation?: [number, number, number] | null;
  deltaRotation?: [number, number, number, number] | null;
  totalRotation?: [number, number, number, number] | null;
  totalScale?: [number, number, number] | null;
  isViewAxis?: boolean | null;
}

export interface NativeGizmoUpdateResponse {
  drawData: NativeGizmoDrawData;
  result: NativeGizmoResult | null;
  targets: NativeGizmoTransform[];
  focused: boolean;
}

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

const toModeDto = (mode: NativeGizmoMode): NativeGizmoUpdateRequest['mode'] => {
  switch (mode) {
    case 'translate':
      return 'Translate';
    case 'rotate':
      return 'Rotate';
    case 'scale':
      return 'Scale';
  }
};

const toOrientationDto = (
  orientation: NativeGizmoOrientation,
): NativeGizmoUpdateRequest['orientation'] => {
  switch (orientation) {
    case 'world':
      return 'World';
    case 'local':
      return 'Local';
  }
};

export const gizmoClient = {
  async createSession(): Promise<number | null> {
    const invoke = await getInvoke();
    if (!invoke) return null;
    return invoke('gizmo_session_create');
  },

  async disposeSession(session: number): Promise<void> {
    const invoke = await getInvoke();
    if (!invoke) return;
    await invoke('gizmo_session_dispose', { session });
  },

  async updateSession(
    session: number,
    input: {
      mode: NativeGizmoMode;
      orientation: NativeGizmoOrientation;
      snapping: boolean;
      snapAngle?: number;
      snapDistance?: number;
      snapScale?: number;
      viewMatrix: number[];
      projectionMatrix: number[];
      viewport: NativeGizmoViewport;
      interaction: NativeGizmoInteraction;
      targets: NativeGizmoTransform[];
    },
  ): Promise<NativeGizmoUpdateResponse | null> {
    const invoke = await getInvoke();
    if (!invoke) return null;

    const request: NativeGizmoUpdateRequest = {
      mode: toModeDto(input.mode),
      orientation: toOrientationDto(input.orientation),
      snapping: input.snapping,
      snapAngle: input.snapAngle,
      snapDistance: input.snapDistance,
      snapScale: input.snapScale,
      viewMatrix: input.viewMatrix,
      projectionMatrix: input.projectionMatrix,
      viewport: input.viewport,
      interaction: input.interaction,
      targets: input.targets,
    };

    return invoke('gizmo_session_update', { session, request });
  },
};
