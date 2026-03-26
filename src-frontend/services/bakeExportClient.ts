/**
 * Bake Export Client - Service for exporting baked texture maps
 * 
 * Provides typed interface for exporting maps in various formats (PNG, EXR, TGA)
 * with configurable settings for bit depth and compression.
 */

import { invoke } from '@tauri-apps/api/core';
import { save } from '@tauri-apps/plugin-dialog';

export interface ExportSettings {
  format: 'png' | 'exr' | 'tga';
  bitDepth?: 8 | 16;  // For PNG only
  compression?: 'none' | 'fast' | 'best';  // For PNG only
}

export interface MapExportData {
  mapType: string;
  width: number;
  height: number;
  data: Uint8Array;
}

class BakeExportClient {
  private serializeBytes(data: Uint8Array): Uint8Array | number[] {
    return data.length > 1024 * 1024 ? data : Array.from(data);
  }

  /**
   * Export a single map to a file
   */
  async exportMap(
    path: string,
    width: number,
    height: number,
    data: Uint8Array,
    settings: ExportSettings
  ): Promise<void> {
    await invoke('export_map', {
      path,
      width,
      height,
      data: this.serializeBytes(data),
      settings,
    });
  }

  /**
   * Export multiple maps in batch
   */
  async exportMapsBatch(
    basePath: string,
    maps: MapExportData[],
    settings: ExportSettings
  ): Promise<string[]> {
    const mapsData = maps.map(m => [
      m.mapType,
      m.width,
      m.height,
      this.serializeBytes(m.data),
    ]);

    return await invoke<string[]>('export_maps_batch', {
      basePath,
      maps: mapsData,
      settings,
    });
  }

  /**
   * Show save dialog and export a single map
   */
  async exportMapWithDialog(
    defaultName: string,
    width: number,
    height: number,
    data: Uint8Array,
    settings: ExportSettings
  ): Promise<string | null> {
    const ext = settings.format;
    const filters = [
      {
        name: `${ext.toUpperCase()} Image`,
        extensions: [ext],
      },
    ];

    const path = await save({
      defaultPath: defaultName,
      filters,
    });

    if (!path) return null;

    await this.exportMap(path, width, height, data, settings);
    return path;
  }

  /**
   * Show save dialog and export multiple maps in batch
   */
  async exportMapsBatchWithDialog(
    defaultName: string,
    maps: MapExportData[],
    settings: ExportSettings
  ): Promise<string[] | null> {
    const ext = settings.format;
    const filters = [
      {
        name: `${ext.toUpperCase()} Image`,
        extensions: [ext],
      },
    ];

    const basePath = await save({
      defaultPath: defaultName,
      filters,
    });

    if (!basePath) return null;

    return await this.exportMapsBatch(basePath, maps, settings);
  }

  /**
   * Get recommended export settings for a map type
   */
  getRecommendedSettings(mapType: string): ExportSettings {
    switch (mapType) {
      case 'normal':
      case 'position':
        // Normal and position maps benefit from higher precision
        return {
          format: 'png',
          bitDepth: 16,
          compression: 'best',
        };

      case 'ao':
      case 'curvature':
      case 'thickness':
        // Single-channel maps can use 8-bit
        return {
          format: 'png',
          bitDepth: 8,
          compression: 'best',
        };

      case 'id':
        // ID maps should use lossless format
        return {
          format: 'png',
          bitDepth: 8,
          compression: 'none',
        };

      default:
        return {
          format: 'png',
          bitDepth: 8,
          compression: 'best',
        };
    }
  }

  /**
   * Get file extension for format
   */
  getExtension(format: 'png' | 'exr' | 'tga'): string {
    return format;
  }

  /**
   * Get format display name
   */
  getFormatName(format: 'png' | 'exr' | 'tga'): string {
    switch (format) {
      case 'png':
        return 'PNG (Portable Network Graphics)';
      case 'exr':
        return 'EXR (OpenEXR HDR)';
      case 'tga':
        return 'TGA (Targa)';
    }
  }
}

export const bakeExportClient = new BakeExportClient();
