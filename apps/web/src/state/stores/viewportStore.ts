import type { NativeViewportSyncSource } from '@/services/nativeViewportBridge';
import type {
  FrameStats,
  RenderMeshHandle,
  SelectionResult,
  ViewportHandle,
} from '@/services/viewportClient';
import { createStore } from '../createStore';

export type ViewportHostInputMode = 'none' | 'camera' | 'cursor' | 'camera+cursor';
export type ViewportRuntimePhase = 'idle' | 'probing' | 'ready' | 'unavailable' | 'failed';

export interface ViewportRequestState {
  ownerId: string | null;
  meshHandle: number | null;
  syncSourceKind: NativeViewportSyncSource['kind'] | null;
  captureInput: boolean;
  hostInputMode: ViewportHostInputMode;
  useSculptHandle: boolean;
  showDiagnostics: boolean;
}

export interface ViewportState {
  cameraPosition: [number, number, number];
  cameraTarget: [number, number, number];
  fov: number;
  showGrid: boolean;
  wireframe: boolean;
  backgroundColor: string;
  nativeAvailabilityChecked: boolean;
  nativeAvailable: boolean;
  runtimePhase: ViewportRuntimePhase;
  runtimeStatus: string;
  viewportHandle: ViewportHandle | null;
  renderMeshHandle: RenderMeshHandle | null;
  frameStats: FrameStats | null;
  selection: SelectionResult | null;
  activeRequest: ViewportRequestState | null;
  setCameraPosition: (position: [number, number, number]) => void;
  setCameraTarget: (target: [number, number, number]) => void;
  setFov: (fov: number) => void;
  toggleGrid: () => void;
  toggleWireframe: () => void;
  setBackgroundColor: (color: string) => void;
  setNativeAvailability: (available: boolean, checked?: boolean) => void;
  setRuntimeStatus: (status: string) => void;
  setViewportHandle: (handle: ViewportHandle | null) => void;
  setRenderMeshHandle: (handle: RenderMeshHandle | null) => void;
  setFrameStats: (stats: FrameStats | null) => void;
  setSelection: (selection: SelectionResult | null) => void;
  setActiveRequest: (request: ViewportRequestState | null) => void;
  resetSessionState: () => void;
  reset: () => void;
}

const defaultViewportPreferences = {
  cameraPosition: [5, 5, 5] as [number, number, number],
  cameraTarget: [0, 0, 0] as [number, number, number],
  fov: 50,
  showGrid: true,
  wireframe: false,
  backgroundColor: '#1a1a1a',
};

const defaultSessionState = {
  nativeAvailabilityChecked: false,
  nativeAvailable: false,
  runtimePhase: 'idle' as ViewportRuntimePhase,
  runtimeStatus: 'IDLE',
  viewportHandle: null as ViewportHandle | null,
  renderMeshHandle: null as RenderMeshHandle | null,
  frameStats: null as FrameStats | null,
  selection: null as SelectionResult | null,
  activeRequest: null as ViewportRequestState | null,
};

const runtimeStatusRules: Array<{ match: string; phase: ViewportRuntimePhase }> = [
  { match: 'FAILED', phase: 'failed' },
  { match: 'UNAVAILABLE', phase: 'unavailable' },
  { match: 'ATTACH FAILED', phase: 'failed' },
  { match: 'READY', phase: 'ready' },
  { match: 'ATTACHED', phase: 'ready' },
  { match: 'SYNCED', phase: 'ready' },
  { match: 'INITIALIZING', phase: 'probing' },
  { match: 'STAGED', phase: 'probing' },
];

function deriveRuntimePhase(
  status: string,
  nativeAvailable: boolean,
  nativeAvailabilityChecked: boolean,
): ViewportRuntimePhase {
  const normalizedStatus = status.trim().toUpperCase();
  for (const rule of runtimeStatusRules) {
    if (normalizedStatus.includes(rule.match)) {
      return rule.phase;
    }
  }

  if (nativeAvailabilityChecked && !nativeAvailable) {
    return 'unavailable';
  }

  if (nativeAvailabilityChecked && nativeAvailable) {
    return 'probing';
  }

  return 'idle';
}

export const useViewportStore = createStore<ViewportState>(
  {
    name: 'viewport',
    persist: true,
    persistOptions: {
      partialize: (state) =>
        ({
          cameraPosition: state.cameraPosition,
          cameraTarget: state.cameraTarget,
          fov: state.fov,
          showGrid: state.showGrid,
          wireframe: state.wireframe,
          backgroundColor: state.backgroundColor,
        }) as unknown as ViewportState,
    },
    devtools: true,
  },
  (set, get) => ({
    ...defaultViewportPreferences,
    ...defaultSessionState,

    setCameraPosition: (position) => set({ cameraPosition: position }),
    setCameraTarget: (target) => set({ cameraTarget: target }),
    setFov: (fov) => set({ fov }),
    toggleGrid: () => set({ showGrid: !get().showGrid }),
    toggleWireframe: () => set({ wireframe: !get().wireframe }),
    setBackgroundColor: (color) => set({ backgroundColor: color }),
    setNativeAvailability: (available, checked = true) =>
      set((state) => ({
        nativeAvailable: available,
        nativeAvailabilityChecked: checked,
        runtimePhase: checked
          ? deriveRuntimePhase(state.runtimeStatus, available, checked)
          : 'probing',
      })),
    setRuntimeStatus: (status) =>
      set((state) => ({
        runtimeStatus: status,
        runtimePhase: deriveRuntimePhase(
          status,
          state.nativeAvailable,
          state.nativeAvailabilityChecked,
        ),
      })),
    setViewportHandle: (handle) => set({ viewportHandle: handle }),
    setRenderMeshHandle: (handle) => set({ renderMeshHandle: handle }),
    setFrameStats: (stats) => set({ frameStats: stats }),
    setSelection: (selection) => set({ selection }),
    setActiveRequest: (request) => set({ activeRequest: request }),
    resetSessionState: () => set(defaultSessionState),
    reset: () => set({ ...defaultViewportPreferences, ...defaultSessionState }),
  }),
);
