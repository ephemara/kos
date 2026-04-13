/**
 * exportConfig.ts — Single source of truth for all KOS export formats.
 *
 * Each format entry drives:
 *  - The ExportPanel format picker (label, extensions)
 *  - The Tauri save-dialog filter (name + extensions)
 *  - The ExchangeSystem.export() format key
 *  - MIME type for Blob creation
 *
 * To add a new export format: add one entry here. Nothing else changes.
 */

export interface KExportFormat {
    /** ID passed to ExchangeSystem.export() — matches the `format` switch */
    id: string;
    /** Short label shown in the format picker */
    label: string;
    /** File extensions (without dot) — used in Tauri save dialog */
    extensions: string[];
    /** MIME type of the exported blob */
    mimeType: string;
    /** Whether this format supports mesh export */
    supportsMeshes: boolean;
    /** Human-readable description */
    desc: string;
}

export const EXPORT_FORMATS: KExportFormat[] = [
    {
        id: 'GLB',
        label: 'GLB',
        extensions: ['glb'],
        mimeType: 'model/gltf-binary',
        supportsMeshes: true,
        desc: 'Binary glTF 2.0 — best for web & game engines',
    },
    {
        id: 'OBJ',
        label: 'OBJ',
        extensions: ['obj'],
        mimeType: 'text/plain',
        supportsMeshes: true,
        desc: 'Wavefront OBJ — universal compatibility',
    },
    {
        id: 'USDZ',
        label: 'USDZ',
        extensions: ['usdz'],
        mimeType: 'application/octet-stream',
        supportsMeshes: true,
        desc: 'Apple AR Quick Look format',
    },
    {
        id: 'STL',
        label: 'STL',
        extensions: ['stl'],
        mimeType: 'application/octet-stream',
        supportsMeshes: true,
        desc: '3D printing — no materials',
    },
    {
        id: 'PLY',
        label: 'PLY',
        extensions: ['ply'],
        mimeType: 'text/plain',
        supportsMeshes: true,
        desc: 'Polygon File Format — point cloud / scan data',
    },
] as const;

/** Get a format entry by ID — safe lookup with fallback */
export function getExportFormat(id: string): KExportFormat | undefined {
    return EXPORT_FORMATS.find(f => f.id === id);
}

/** Default format used on first load */
export const DEFAULT_EXPORT_FORMAT = 'GLB';
