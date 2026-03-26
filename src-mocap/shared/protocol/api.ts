/**
 * K-OS Protocol API
 * 
 * # THE GOD WORKFLOW
 * 
 * The `kos.send()` method accepts ANY AppMessage variant - one method to rule them all!
 * 
 * ## Adding a new React → Bevy feature:
 * 1. Add variant to `crates/app-proto/src/messages.rs`
 * 2. Run `npm run kos:gen` (regenerates TypeScript types)
 * 3. Add handler in Bevy
 * 4. Use `kos.send({ YourNewThing: {...} })` in React
 * 
 * That's it. Zero boilerplate needed.
 * 
 * ## Usage Examples:
 * ```typescript
 * import { kos } from '@mocap/shared/protocol/api';
 * 
 * // God mode - works for ANY message
 * kos.send({ Subdivide: null });
 * kos.send({ Remesh: { resolution: 128 } });
 * kos.send({ SetActiveTool: "Sculpt" });
 * kos.send({ UpdateBrushSettings: { radius: 50, intensity: null, is_add: true } });
 * 
 * // Convenience wrappers (optional, same effect)
 * kos.subdivide();
 * kos.remesh(128);
 * kos.setActiveTool('sculpt');
 * ```
 */

import { invoke } from '@tauri-apps/api/core';
import type { AppMessage } from './AppMessage';
import type { AppState } from './AppState';
import type { SculptState } from './SculptState';
import type { BrushLibrary } from './BrushLibrary';

// Re-export types for convenience
export type { AppMessage, AppState, SculptState, BrushLibrary };
export type { ActiveTool } from './ActiveTool';
export type { BrushAsset } from './BrushAsset';
export type { LayerHierarchy } from './LayerHierarchy';
export type { LayerInfo } from './LayerInfo';
export type { SymmetryState } from './SymmetryState';
export type { MeshStats } from './MeshStats';

/**
 * K-OS API - Clean interface to Bevy
 */
export const kos = {
    // =========================================================================
    // 🔥 GOD MODE: Generic Send
    // =========================================================================

    /**
     * **THE GOD METHOD** - Send ANY AppMessage variant to Bevy
     * 
     * This single method works for all message types.
     * TypeScript discriminated unions provide full type safety and autocomplete.
     * 
     * @example
     * kos.send({ Subdivide: null });
     * kos.send({ Remesh: { resolution: 128 } });
     * kos.send({ SetActiveTool: "Sculpt" });
     */
    send: (msg: AppMessage): Promise<void> => invoke('app_send', { msg }),

    // =========================================================================
    // STATE QUERIES (these return data, can't use generic send)
    // =========================================================================

    /** Get the complete application state */
    getState: (): Promise<AppState> => invoke('app_get_state'),

    /** Get just the sculpt state */
    getSculptState: (): Promise<SculptState> => invoke('app_get_sculpt_state'),

    /** Get the brush library */
    getBrushLibrary: (): Promise<BrushLibrary> => invoke('app_get_brush_library'),

    /** Check if Bevy is ready */
    isReady: (): Promise<boolean> => invoke('app_is_ready'),

    // =========================================================================
    // CONVENIENCE WRAPPERS (optional sugar, all just call kos.send internally)
    // =========================================================================

    // --- Tool Commands ---

    /** Set the active tool ('viewport', 'sculpt', 'paint', 'retopo') */
    setActiveTool: (tool: string): Promise<void> => invoke('app_set_active_tool', { tool }),

    /** Switch to a different brush */
    switchBrush: (brushId: string): Promise<void> => invoke('app_switch_brush', { brushId }),

    /** Update brush settings (partial update) */
    updateBrushSettings: (settings: {
        radius?: number;
        intensity?: number;
        isAdd?: boolean;
    }): Promise<void> => invoke('app_update_brush_settings', {
        radius: settings.radius ?? null,
        intensity: settings.intensity ?? null,
        is_add: settings.isAdd ?? null,
    }),

    /** Set symmetry state */
    setSymmetry: (x: boolean, y: boolean, z: boolean): Promise<void> =>
        invoke('app_set_symmetry', { x, y, z }),

    // --- Geometry Commands ---

    /** Subdivide the current mesh */
    subdivide: (): Promise<void> => invoke('app_subdivide'),

    /** Remesh the current mesh */
    remesh: (resolution: number): Promise<void> => invoke('app_remesh', { resolution }),

    /** Undo last action */
    undo: (): Promise<void> => invoke('app_undo'),

    /** Redo last undone action */
    redo: (): Promise<void> => invoke('app_redo'),

    // --- Layer Commands ---

    /** Select a layer */
    selectLayer: (entityId: number, addToSelection = false): Promise<void> =>
        invoke('app_select_layer', { entityId, addToSelection }),

    /** Toggle layer visibility */
    toggleLayerVisibility: (entityId: number): Promise<void> =>
        invoke('app_toggle_layer_visibility', { entityId }),

    /** Toggle layer lock */
    toggleLayerLock: (entityId: number): Promise<void> =>
        invoke('app_toggle_layer_lock', { entityId }),

    /** Delete a layer */
    deleteLayer: (entityId: number): Promise<void> =>
        invoke('app_delete_layer', { entityId }),

    /** Rename a layer */
    renameLayer: (entityId: number, name: string): Promise<void> =>
        invoke('app_rename_layer', { entityId, name }),

    // --- Viewport Commands ---

    /** Request a full state snapshot from Bevy */
    requestState: (): Promise<void> => invoke('app_request_state'),

    /** Notify Bevy of window movement */
    windowMove: (x: number, y: number, width: number, height: number): Promise<void> =>
        invoke('app_window_move', { x, y, width, height }),

    /** Send cursor position */
    cursorMove: (x: number, y: number): Promise<void> =>
        invoke('app_cursor_move', { x, y }),

    /** Send mouse button event */
    mouseButton: (button: number, pressed: boolean): Promise<void> =>
        invoke('app_mouse_button', { button, pressed }),

    /** Send scroll event */
    scroll: (deltaX: number, deltaY: number): Promise<void> =>
        invoke('app_scroll', { deltaX, deltaY }),

    /** Show/hide the transform gizmo (Q key in Bevy, or call this from React) */
    setGizmoVisibility: (visible: boolean): Promise<void> =>
        invoke('app_send', { msg: { SetGizmoVisibility: { visible } } }),

    // --- Spawn/Import Commands ---

    /** Spawn a primitive */
    spawnPrimitive: (primitiveType: string): Promise<void> =>
        invoke('app_spawn_primitive', { primitiveType }),

    /** Import a GLTF file */
    importGltf: (path: string): Promise<void> =>
        invoke('app_import_gltf', { path }),

    // --- System Commands ---

    /** Ping Bevy */
    ping: (): Promise<void> => invoke('app_ping'),

    /** Shutdown Bevy */
    shutdown: (): Promise<void> => invoke('app_shutdown'),
};

// Default export for convenience
export default kos;

