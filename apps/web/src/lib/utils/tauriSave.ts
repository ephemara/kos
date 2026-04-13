/**
 * tauriSave.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Single source-of-truth for all file-save operations in the Tauri app.
 *
 * NEVER use document.createElement('a').click() in this codebase.
 * That is a browser API and silently does nothing in Tauri.
 *
 * Use these helpers instead:
 *   • saveBlobToFile()      — GLB, OBJ, USDZ, ZIP, HDR, any binary/text blob
 *   • saveDataUrlToFile()   — PNG / JPG / PNG data-urls from canvas
 *
 * Both open the native OS save dialog, then write atomically via the Tauri
 * `write_file` command (registered in main.rs).
 *
 * Config is data-driven — SAVE_FILTERS controls the dialog file-type filters.
 */

import { save } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';

// ─── Data-driven file-type filters ───────────────────────────────────────────
interface SaveFilter {
    name: string;
    extensions: string[];
}

const SAVE_FILTERS: Record<string, SaveFilter> = {
    glb: { name: '3D Model (Binary GLTF)', extensions: ['glb'] },
    gltf: { name: '3D Model (GLTF JSON)', extensions: ['gltf'] },
    obj: { name: 'Wavefront OBJ', extensions: ['obj'] },
    usdz: { name: 'USDZ Scene', extensions: ['usdz'] },
    json: { name: 'JSON Data', extensions: ['json'] },
    png: { name: 'PNG Image', extensions: ['png'] },
    jpg: { name: 'JPEG Image', extensions: ['jpg', 'jpeg'] },
    hdr: { name: 'HDR Environment', extensions: ['hdr'] },
    kipp: { name: 'KIPP Project', extensions: ['kipp'] },
    zip: { name: 'ZIP Archive', extensions: ['zip'] },
};

/** Infer the filter key from a filename's extension. Falls back to first entry. */
function filterForFilename(filename: string): SaveFilter {
    const ext = filename.split('.').pop()?.toLowerCase() ?? '';
    return SAVE_FILTERS[ext] ?? SAVE_FILTERS['glb'];
}

// ─── Core save primitive ──────────────────────────────────────────────────────

/**
 * Convert any Blob to a number[] so it can be sent over Tauri IPC as JSON.
 * Tauri's write_file command expects Vec<u8> on the Rust side.
 */
async function blobToBytes(blob: Blob): Promise<number[]> {
    const ab = await blob.arrayBuffer();
    return Array.from(new Uint8Array(ab));
}

/**
 * Open the native OS Save dialog, then write `bytes` to the chosen path.
 * Returns the saved path, or null if the user cancelled.
 */
async function writeBytesToDisk(
    defaultFilename: string,
    bytes: number[]
): Promise<string | null> {
    const filter = filterForFilename(defaultFilename);
    const path = await save({
        defaultPath: defaultFilename,
        filters: [filter],
    });

    if (!path) return null; // user cancelled

    await invoke('write_file', { path, contents: bytes });
    return path;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Save a Blob as a native file.
 * Opens the OS save dialog pre-populated with `defaultFilename`.
 *
 * @example
 *   const blob = new Blob([glbBuffer], { type: 'application/octet-stream' });
 *   await saveBlobToFile(blob, 'MyModel.glb');
 */
export async function saveBlobToFile(
    blob: Blob,
    defaultFilename: string
): Promise<string | null> {
    const bytes = await blobToBytes(blob);
    return writeBytesToDisk(defaultFilename, bytes);
}

/**
 * Save a data-URL (e.g. from canvas.toDataURL()) as a native file.
 * Strips the base64 header and writes raw bytes.
 *
 * @example
 *   const dataUrl = canvas.toDataURL('image/png');
 *   await saveDataUrlToFile(dataUrl, 'K_roughness.png');
 */
export async function saveDataUrlToFile(
    dataUrl: string,
    defaultFilename: string
): Promise<string | null> {
    // Convert data-url → Blob via fetch (works for any mime-type)
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    return saveBlobToFile(blob, defaultFilename);
}
