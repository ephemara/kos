/**
 * K_OS Window Service
 *
 * Thin wrapper around Tauri's window API. Provides typed, safe calls
 * with graceful fallback when running outside of Tauri (e.g. browser dev).
 */

import { getCurrentWindow } from '@tauri-apps/api/window';
import { invoke } from '@tauri-apps/api/core';

const isTauri = (): boolean =>
    typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

// ─── Basic window controls ─────────────────────────────────────────────────

export async function windowMinimize(): Promise<void> {
    if (!isTauri()) return;
    try { await getCurrentWindow().minimize(); } catch { /* no-op */ }
}

export async function windowMaximize(): Promise<void> {
    if (!isTauri()) return;
    try {
        const win = getCurrentWindow();
        if (await win.isMaximized()) await win.unmaximize();
        else await win.maximize();
    } catch { /* no-op */ }
}

export async function windowClose(): Promise<void> {
    if (!isTauri()) return;
    try { await getCurrentWindow().close(); } catch { /* no-op */ }
}

/**
 * Start window drag — call this from onMouseDown on the titlebar.
 * Automatically ignores clicks on buttons, links, and [data-no-drag] elements.
 */
export async function windowStartDrag(e: { target: EventTarget | null }): Promise<void> {
    if (!isTauri()) return;
    const target = e.target as HTMLElement | null;
    if (!target) return;
    if (target.closest('button') || target.closest('a') || target.closest('[data-no-drag]')) return;
    try { await getCurrentWindow().startDragging(); } catch { /* no-op */ }
}

export async function windowCenter(): Promise<void> {
    if (!isTauri()) return;
    try { await invoke('center_window'); } catch (e) { console.warn('[window] center failed', e); }
}

export async function windowSetResizable(resizable: boolean): Promise<void> {
    if (!isTauri()) return;
    try { await invoke('set_window_resizable', { resizable }); } catch (e) { console.warn('[window] set_resizable failed', e); }
}

export async function windowSetAlwaysOnTop(alwaysOnTop: boolean): Promise<void> {
    if (!isTauri()) return;
    try { await invoke('set_window_always_on_top', { alwaysOnTop }); } catch (e) { console.warn('[window] always_on_top failed', e); }
}

export interface WindowBounds {
    x: number;
    y: number;
    width: number;
    height: number;
    isMaximized: boolean;
    isMinimized: boolean;
}

export async function windowGetBounds(): Promise<WindowBounds | null> {
    if (!isTauri()) return null;
    try { return await invoke<WindowBounds>('get_window_bounds'); } catch { return null; }
}

export async function windowSetPosition(x: number, y: number): Promise<void> {
    if (!isTauri()) return;
    try { await invoke('set_window_position', { x, y }); } catch (e) { console.warn('[window] set_position failed', e); }
}

export async function windowSetSize(width: number, height: number): Promise<void> {
    if (!isTauri()) return;
    try { await invoke('set_window_size', { width, height }); } catch (e) { console.warn('[window] set_size failed', e); }
}

// ─── Floating windows ──────────────────────────────────────────────────────

export async function spawnMocapWindow(): Promise<void> {
    if (!isTauri()) { console.warn('[window] Cannot spawn mocap window outside Tauri'); return; }
    try { await invoke('spawn_mocap_window'); } catch (e) { console.error('[window] spawn_mocap_window failed', e); }
}

export async function closeMocapWindow(): Promise<void> {
    if (!isTauri()) return;
    try { await invoke('close_mocap_window'); } catch (e) { console.warn('[window] close_mocap_window failed', e); }
}

export async function spawnZenWindow(): Promise<void> {
    if (!isTauri()) { console.warn('[window] Cannot spawn Zen window outside Tauri'); return; }
    try { await invoke('spawn_zen_window'); } catch (e) { console.error('[window] spawn_zen_window failed', e); }
}

export async function spawnLegacyWindow(): Promise<void> {
    if (!isTauri()) {
        window.open('/legacy/index.html', '_blank', 'noopener');
        return;
    }
    try { await invoke('spawn_legacy_window'); } catch (e) { console.error('[window] spawn_legacy_window failed', e); }
}

export async function closeLegacyWindow(): Promise<void> {
    if (!isTauri()) return;
    try { await invoke('close_legacy_window'); } catch (e) { console.warn('[window] close_legacy_window failed', e); }
}

export async function spawnWebcamWindow(): Promise<void> {
    if (!isTauri()) return;
    try { await invoke('spawn_webcam_window'); } catch (e) { console.error('[window] spawn_webcam_window failed', e); }
}

export async function closeWebcamWindow(): Promise<void> {
    if (!isTauri()) return;
    try { await invoke('close_webcam_window'); } catch (e) { console.warn('[window] close_webcam_window failed', e); }
}
