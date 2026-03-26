import { createStore } from '../createStore';

/**
 * Viewport state for 3D rendering
 */
export interface ViewportState {
  /** Camera position */
  cameraPosition: [number, number, number];
  /** Camera target */
  cameraTarget: [number, number, number];
  /** Camera FOV */
  fov: number;
  /** Grid visibility */
  showGrid: boolean;
  /** Wireframe mode */
  wireframe: boolean;
  /** Background color */
  backgroundColor: string;
  /** Actions */
  setCameraPosition: (position: [number, number, number]) => void;
  setCameraTarget: (target: [number, number, number]) => void;
  setFov: (fov: number) => void;
  toggleGrid: () => void;
  toggleWireframe: () => void;
  setBackgroundColor: (color: string) => void;
  reset: () => void;
}

const defaultState = {
  cameraPosition: [5, 5, 5] as [number, number, number],
  cameraTarget: [0, 0, 0] as [number, number, number],
  fov: 50,
  showGrid: true,
  wireframe: false,
  backgroundColor: '#1a1a1a',
};

export const useViewportStore = createStore<ViewportState>(
  {
    name: 'viewport',
    persist: true,
    devtools: true,
  },
  (set, get) => ({
    ...defaultState,

    setCameraPosition: (position) => set({ cameraPosition: position }),
    setCameraTarget: (target) => set({ cameraTarget: target }),
    setFov: (fov) => set({ fov }),
    toggleGrid: () => set({ showGrid: !get().showGrid }),
    toggleWireframe: () => set({ wireframe: !get().wireframe }),
    setBackgroundColor: (color) => set({ backgroundColor: color }),
    reset: () => set(defaultState),
  })
);
