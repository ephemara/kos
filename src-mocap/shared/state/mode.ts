/**
 * Mode Detection Utilities
 * 
 * Detect if running in Tauri (desktop) or Web mode
 */

/**
 * Check if the app is running in Tauri mode
 */
export function isRunningInTauri(): boolean {
    // @ts-ignore - __TAURI_INTERNALS__ is injected by Tauri
    return typeof window !== 'undefined' && window.__TAURI_INTERNALS__ !== undefined;
}

/**
 * Check if the app is running in web mode
 */
export function isRunningInWeb(): boolean {
    return !isRunningInTauri();
}

/**
 * Get the current mode
 */
export function getMode(): 'tauri' | 'web' {
    return isRunningInTauri() ? 'tauri' : 'web';
}

/**
 * Conditional execution based on mode
 */
export function ifTauri<T>(tauriCallback: () => T, webCallback?: () => T): T | undefined {
    if (isRunningInTauri()) {
        return tauriCallback();
    } else if (webCallback) {
        return webCallback();
    }
    return undefined;
}

/**
 * Example usage in components:
 * 
 * import { isRunningInTauri, ifTauri } from '@mocap/lib/mode';
 * 
 * // Simple check
 * if (isRunningInTauri()) {
 *     await invoke('some_rust_command');
 * } else {
 *     await fetch('/api/endpoint');
 * }
 * 
 * // Conditional execution
 * const data = ifTauri(
 *     () => invoke('get_data'),
 *     () => fetch('/api/data').then(r => r.json())
 * );
 */
