/**
 * useKInspectExport.ts
 *
 * Tauri-native export hook for KInspect.
 *
 * Flow:
 *   1. ExchangeSystem.export() → applies preset transforms → returns a Blob
 *   2. save() from @tauri-apps/plugin-dialog → native OS save dialog → returns path
 *   3. invoke('write_file') → Tauri Rust command writes bytes to disk
 *
 * This hook is format-agnostic and preset-agnostic — it reads everything
 * from exportConfig.ts so no format-specific logic lives here.
 */

import { useState, useCallback } from 'react';
import { save } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import * as THREE from 'three';
import { ExchangeSystem } from '@/lib/utils/ExchangeSystem';
import { getExportFormat } from '@/lib/utils/exportConfig';

// ─── Types ───────────────────────────────────────────────────────────────────

export type ExportStatus =
    | 'IDLE'
    | 'PACKING'
    | 'SAVING'
    | 'WRITING'
    | 'DONE'
    | 'CANCELLED'
    | 'ERROR';

export interface KInspectExportState {
    isExporting: boolean;
    exportStatus: ExportStatus;
    exportError: string | null;
    lastExportPath: string | null;
}

export interface KInspectExportActions {
    runExport: (
        object: THREE.Object3D,
        presetKey: string,
        formatId: string,
        baseName?: string
    ) => Promise<void>;
    clearExportError: () => void;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useKInspectExport(): KInspectExportState & KInspectExportActions {
    const [isExporting, setIsExporting] = useState(false);
    const [exportStatus, setExportStatus] = useState<ExportStatus>('IDLE');
    const [exportError, setExportError] = useState<string | null>(null);
    const [lastExportPath, setLastExportPath] = useState<string | null>(null);

    const runExport = useCallback(async (
        object: THREE.Object3D,
        presetKey: string,
        formatId: string,
        baseName = 'Asset'
    ) => {
        const format = getExportFormat(formatId);
        if (!format) {
            setExportError(`Unknown format: ${formatId}`);
            setExportStatus('ERROR');
            return;
        }

        setIsExporting(true);
        setExportError(null);
        setExportStatus('PACKING');

        try {
            // Step 1 — pack the blob via ExchangeSystem (applies preset scale / axis)
            let blob: Blob;
            try {
                blob = await ExchangeSystem.export(object, presetKey, formatId);
            } catch (err: any) {
                throw new Error(`Pack failed: ${err?.message ?? String(err)}`);
            }

            // Step 2 — ask the OS where to save (native Tauri dialog)
            setExportStatus('SAVING');
            const savePath = await save({
                title: 'Export Asset',
                defaultPath: `${baseName}_[${presetKey}].${format.extensions[0]}`,
                filters: [{
                    name: format.label,
                    extensions: format.extensions,
                }],
            });

            if (!savePath) {
                // User cancelled — not an error
                setExportStatus('CANCELLED');
                setIsExporting(false);
                return;
            }

            // Step 3 — read bytes from the blob and write via Tauri
            setExportStatus('WRITING');
            const arrayBuffer = await blob.arrayBuffer();
            const bytes = Array.from(new Uint8Array(arrayBuffer));

            await invoke('write_file', {
                path: savePath,
                contents: bytes,
            });

            setLastExportPath(savePath);
            setExportStatus('DONE');
        } catch (err: any) {
            const msg = err?.message ?? String(err);
            console.error('[useKInspectExport]', msg);
            setExportError(msg);
            setExportStatus('ERROR');
        } finally {
            setIsExporting(false);
        }
    }, []);

    const clearExportError = useCallback(() => {
        setExportError(null);
        setExportStatus('IDLE');
    }, []);

    return {
        isExporting,
        exportStatus,
        exportError,
        lastExportPath,
        runExport,
        clearExportError,
    };
}
