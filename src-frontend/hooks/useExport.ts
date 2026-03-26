/**
 * useExport Hook
 * 
 * React hook for easy export integration using the centralized export system.
 */

import { useState, useCallback } from 'react';
import { exportService, ExportOptions, ExportResult } from '@/services/exportService';
import * as THREE from 'three';

interface UseExportOptions {
  /** Default export type */
  defaultType?: 'mesh' | 'texture';
  
  /** Callback when export starts */
  onExportStart?: () => void;
  
  /** Callback when export completes */
  onExportComplete?: (result: ExportResult) => void;
  
  /** Callback when export fails */
  onExportError?: (error: string) => void;
}

export function useExport(options: UseExportOptions = {}) {
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [showDialog, setShowDialog] = useState(false);

  /**
   * Export a mesh/scene
   */
  const exportMesh = useCallback(async (
    sceneOrMesh: THREE.Scene | THREE.Mesh | THREE.Group,
    exportOptions: Partial<ExportOptions> = {}
  ) => {
    setIsExporting(true);
    setProgress(0);
    setStatus('Preparing export...');
    options.onExportStart?.();

    try {
      const result = await exportService.exportMesh(sceneOrMesh, {
        formatId: exportOptions.formatId || 'gltf',
        options: exportOptions.options,
        filename: exportOptions.filename,
        onProgress: (prog, stat) => {
          setProgress(prog);
          setStatus(stat);
        }
      });

      if (result.success) {
        setStatus('Export complete!');
        setProgress(100);
        options.onExportComplete?.(result);
      } else {
        throw new Error(result.error || 'Export failed');
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      setStatus(`Export failed: ${errorMsg}`);
      options.onExportError?.(errorMsg);
      console.error('[useExport] Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  }, [options]);

  /**
   * Export a texture/canvas
   */
  const exportTexture = useCallback(async (
    canvas: HTMLCanvasElement | THREE.Texture,
    exportOptions: Partial<ExportOptions> = {}
  ) => {
    setIsExporting(true);
    setProgress(0);
    setStatus('Preparing export...');
    options.onExportStart?.();

    try {
      const result = await exportService.exportTexture(canvas, {
        formatId: exportOptions.formatId || 'png',
        options: exportOptions.options,
        filename: exportOptions.filename,
        onProgress: (prog, stat) => {
          setProgress(prog);
          setStatus(stat);
        }
      });

      if (result.success) {
        setStatus('Export complete!');
        setProgress(100);
        options.onExportComplete?.(result);
      } else {
        throw new Error(result.error || 'Export failed');
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      setStatus(`Export failed: ${errorMsg}`);
      options.onExportError?.(errorMsg);
      console.error('[useExport] Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  }, [options]);

  /**
   * Open export dialog
   */
  const openExportDialog = useCallback(() => {
    setShowDialog(true);
  }, []);

  /**
   * Close export dialog
   */
  const closeExportDialog = useCallback(() => {
    setShowDialog(false);
  }, []);

  return {
    // State
    isExporting,
    progress,
    status,
    showDialog,
    
    // Actions
    exportMesh,
    exportTexture,
    openExportDialog,
    closeExportDialog,
  };
}

export default useExport;
