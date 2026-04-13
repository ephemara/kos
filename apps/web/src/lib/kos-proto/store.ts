/**
 * K-OS State Store - The "Egui Feel" for React
 * 
 * This Zustand store provides:
 * 1. INSTANT local updates (no network latency)
 * 2. Background sync with Bevy
 * 3. Type-safe state management
 * 
 * ## Usage
 * 
 * ```tsx
 * // In any component - feels like native state!
 * const { sculpt, setSculpt } = useKosStore();
 * 
 * <Slider
 *   value={sculpt.radius}
 *   onChange={r => setSculpt({ radius: r })}  // Instant update + network sync
 * />
 * ```
 * 
 * ## Architecture
 * 
 * ```
 * User Input → Zustand Store (instant) → React UI updates
 *                    ↓
 *              kos.updateBrushSettings() → Bevy
 *                    ↓
 *              Bevy processes → State comes back via polling
 *                    ↓
 *              Store syncs (validates optimistic update was correct)
 * ```
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { kos } from './api';
import type { SculptState, BrushLibrary, KosState, LayerHierarchy } from './api';

// ============================================================================
// STORE TYPES
// ============================================================================

interface SculptSettings {
    activeBrushId: string;
    radius: number;
    intensity: number;
    isAddMode: boolean;
    symmetryX: boolean;
    symmetryY: boolean;
    symmetryZ: boolean;
}

interface MeshStats {
    vertCount: number;
    triCount: number;
    undoCount: number;
}

interface ViewportSettings {
    activeTool: 'viewport' | 'sculpt' | 'paint' | 'retopo';
    fps: number;
}

interface KosStoreState {
    // === SCULPT STATE ===
    sculpt: SculptSettings;
    meshStats: MeshStats;
    brushLibrary: BrushLibrary | null;

    // === VIEWPORT STATE ===
    viewport: ViewportSettings;

    // === LAYERS ===
    layers: LayerHierarchy | null;

    // === CONNECTION ===
    isConnected: boolean;
    lastSyncTime: number;

    // === ACTIONS ===
    // Sculpt actions
    setSculpt: (partial: Partial<SculptSettings>) => void;
    switchBrush: (brushId: string) => void;

    // Tools
    setActiveTool: (tool: ViewportSettings['activeTool']) => void;

    // Geometry
    subdivide: () => void;
    remesh: (resolution?: number) => void;
    undo: () => void;
    redo: () => void;

    // Symmetry (convenience)
    toggleSymmetry: (axis: 'x' | 'y' | 'z') => void;

    // Internal sync
    _syncFromBevy: (state: KosState) => void;
    _setBrushLibrary: (library: BrushLibrary) => void;
}

// ============================================================================
// DEFAULT STATE
// ============================================================================

const defaultSculpt: SculptSettings = {
    activeBrushId: 'clay',
    radius: 50.0,
    intensity: 0.5,
    isAddMode: true,
    symmetryX: true,
    symmetryY: false,
    symmetryZ: false,
};

const defaultMeshStats: MeshStats = {
    vertCount: 0,
    triCount: 0,
    undoCount: 0,
};

const defaultViewport: ViewportSettings = {
    activeTool: 'viewport',
    fps: 60,
};

// ============================================================================
// STORE IMPLEMENTATION
// ============================================================================

export const useKosStore = create<KosStoreState>()(
    subscribeWithSelector((set, get) => ({
        // Initial state
        sculpt: defaultSculpt,
        meshStats: defaultMeshStats,
        brushLibrary: null,
        viewport: defaultViewport,
        layers: null,
        isConnected: false,
        lastSyncTime: 0,

        // ====================================================================
        // SCULPT ACTIONS
        // ====================================================================

        setSculpt: (partial) => {
            // 1. INSTANT local update (Egui feel!)
            set((state) => ({
                sculpt: { ...state.sculpt, ...partial },
            }));

            // 2. Background network sync
            const updates: Parameters<typeof kos.updateBrushSettings>[0] = {};
            if (partial.radius !== undefined) updates.radius = partial.radius;
            if (partial.intensity !== undefined) updates.intensity = partial.intensity;
            if (partial.isAddMode !== undefined) updates.isAdd = partial.isAddMode;

            if (Object.keys(updates).length > 0) {
                kos.updateBrushSettings(updates).catch(console.error);
            }

            // Handle symmetry separately
            if (partial.symmetryX !== undefined || partial.symmetryY !== undefined || partial.symmetryZ !== undefined) {
                const current = get().sculpt;
                kos.setSymmetry(
                    partial.symmetryX ?? current.symmetryX,
                    partial.symmetryY ?? current.symmetryY,
                    partial.symmetryZ ?? current.symmetryZ
                ).catch(console.error);
            }
        },

        switchBrush: (brushId) => {
            // Instant update
            set((state) => ({
                sculpt: { ...state.sculpt, activeBrushId: brushId },
            }));
            // Network sync
            kos.switchBrush(brushId).catch(console.error);
        },

        // ====================================================================
        // TOOL ACTIONS
        // ====================================================================

        setActiveTool: (tool) => {
            set((state) => ({
                viewport: { ...state.viewport, activeTool: tool },
            }));
            kos.setActiveTool(tool).catch(console.error);
        },

        // ====================================================================
        // GEOMETRY ACTIONS
        // ====================================================================

        subdivide: () => {
            kos.subdivide().catch(console.error);
        },

        remesh: (resolution = 128) => {
            kos.remesh(resolution).catch(console.error);
        },

        undo: () => {
            kos.undo().catch(console.error);
        },

        redo: () => {
            kos.redo().catch(console.error);
        },

        // ====================================================================
        // SYMMETRY CONVENIENCE
        // ====================================================================

        toggleSymmetry: (axis) => {
            const current = get().sculpt;
            const newValue = axis === 'x' ? !current.symmetryX
                : axis === 'y' ? !current.symmetryY
                    : !current.symmetryZ;

            get().setSculpt({
                [`symmetry${axis.toUpperCase()}`]: newValue,
            } as Partial<SculptSettings>);
        },

        // ====================================================================
        // INTERNAL SYNC (Called by polling system)
        // ====================================================================

        _syncFromBevy: (kosState) => {
            const sculpt = kosState.sculpt;
            const viewport = kosState.viewport;

            set({
                sculpt: {
                    activeBrushId: sculpt.active_brush,
                    radius: sculpt.radius,
                    intensity: sculpt.intensity,
                    isAddMode: sculpt.is_add,
                    symmetryX: sculpt.symmetry.x,
                    symmetryY: sculpt.symmetry.y,
                    symmetryZ: sculpt.symmetry.z,
                },
                meshStats: {
                    vertCount: sculpt.mesh_stats.vertex_count,
                    triCount: sculpt.mesh_stats.face_count,
                    undoCount: sculpt.mesh_stats.undo_stack_size,
                },
                viewport: {
                    activeTool: (typeof viewport.active_tool === 'string'
                        ? viewport.active_tool.toLowerCase()
                        : 'viewport') as ViewportSettings['activeTool'],
                    fps: sculpt.fps,
                },
                layers: kosState.layers,
                isConnected: true,
                lastSyncTime: Date.now(),
            });
        },

        _setBrushLibrary: (library) => {
            set({ brushLibrary: library });
        },
    }))
);

// ============================================================================
// CONVENIENCE HOOKS
// ============================================================================

/**
 * Hook for sculpt settings - the main "Egui feel" interface
 * 
 * @example
 * const [sculpt, setSculpt] = useSculptSettings();
 * <Slider value={sculpt.radius} onChange={r => setSculpt({ radius: r })} />
 */
export function useSculptSettings() {
    const sculpt = useKosStore((s) => s.sculpt);
    const setSculpt = useKosStore((s) => s.setSculpt);
    return [sculpt, setSculpt] as const;
}

/**
 * Hook for brush library
 */
export function useBrushLibrary() {
    const library = useKosStore((s) => s.brushLibrary);
    const switchBrush = useKosStore((s) => s.switchBrush);
    return { library, switchBrush };
}

/**
 * Hook for viewport/tool state
 */
export function useViewport() {
    const viewport = useKosStore((s) => s.viewport);
    const setActiveTool = useKosStore((s) => s.setActiveTool);
    return { ...viewport, setActiveTool };
}

/**
 * Hook for mesh stats (read-only)
 */
export function useMeshStats() {
    return useKosStore((s) => s.meshStats);
}

/**
 * Hook for geometry operations
 */
export function useGeometryOps() {
    return {
        subdivide: useKosStore((s) => s.subdivide),
        remesh: useKosStore((s) => s.remesh),
        undo: useKosStore((s) => s.undo),
        redo: useKosStore((s) => s.redo),
    };
}

/**
 * Hook for symmetry with toggle convenience
 */
export function useSymmetry() {
    const sculpt = useKosStore((s) => s.sculpt);
    const toggleSymmetry = useKosStore((s) => s.toggleSymmetry);
    return {
        x: sculpt.symmetryX,
        y: sculpt.symmetryY,
        z: sculpt.symmetryZ,
        toggle: toggleSymmetry,
    };
}

// ============================================================================
// POLLING SYSTEM
// ============================================================================

let pollInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Start polling Bevy for state updates
 * Call this once at app startup
 */
export function startKosPolling(intervalMs = 100) {
    const isTauri = typeof (window as any).__TAURI__ !== 'undefined';
    if (!isTauri) return;
    if (pollInterval) return;

    const poll = async () => {
        try {
            const state = await kos.getState();
            useKosStore.getState()._syncFromBevy(state);
        } catch (e) {
            // Bevy not ready yet
            useKosStore.setState({ isConnected: false });
        }
    };

    // Initial poll
    poll();

    // Load brush library once
    kos.getBrushLibrary()
        .then((lib) => useKosStore.getState()._setBrushLibrary(lib))
        .catch(console.error);

    // Start interval
    pollInterval = setInterval(poll, intervalMs);
}

/**
 * Stop polling (for cleanup)
 */
export function stopKosPolling() {
    if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
    }
}

// Export store for direct access if needed
export default useKosStore;
