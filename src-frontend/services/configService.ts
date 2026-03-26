/**
 * Configuration Service
 * Loads data-driven configuration from JSON files
 */

import { invoke } from '@tauri-apps/api/core';

export interface BrushParameter {
  type: 'float' | 'int' | 'bool' | 'color';
  default: number | boolean | number[];
  min?: number;
  max?: number;
}

export interface BrushConfig {
  id: string;
  name: string;
  category: 'sculpt' | 'paint' | 'mask' | 'smooth';
  defaultSize: number;
  defaultStrength: number;
  supportsPressure: boolean;
  gpuShader?: string;
  icon: string;
  parameters?: Record<string, BrushParameter>;
}

export interface ExportFormatConfig {
  id: string;
  name: string;
  extensions: string[];
  supportsMeshes: boolean;
  supportsTextures: boolean;
  supportsMaterials: boolean;
  options?: any[];
}

export interface ViewportPresetConfig {
  id: string;
  name: string;
  gridSize: number;
  gridDivisions: number;
  cameraDistance: number;
  cameraFov: number;
  lighting?: any;
}

export interface GreeblePatternConfig {
  id: string;
  name: string;
  category: string;
  primitives: any[];
}

class ConfigService {
  private brushCache: BrushConfig[] | null = null;
  private exportFormatCache: ExportFormatConfig[] | null = null;
  private viewportPresetCache: ViewportPresetConfig[] | null = null;
  private greeblePatternCache: GreeblePatternConfig[] | null = null;

  /**
   * Load brush configurations
   */
  async loadBrushes(): Promise<BrushConfig[]> {
    if (this.brushCache) {
      return this.brushCache;
    }

    try {
      // Try to load from Rust backend (which handles config inheritance)
      const brushes = await invoke<BrushConfig[]>('load_brush_config');
      this.brushCache = brushes;
      return brushes;
    } catch (error) {
      console.warn('Failed to load brushes from backend, using embedded defaults:', error);
      
      // Fallback: load from embedded JSON
      const response = await fetch('/config/brushes.json');
      const brushes = await response.json();
      this.brushCache = brushes;
      return brushes;
    }
  }

  /**
   * Get brushes by category
   */
  async getBrushesByCategory(category: BrushConfig['category']): Promise<BrushConfig[]> {
    const brushes = await this.loadBrushes();
    return brushes.filter(b => b.category === category);
  }

  /**
   * Get a specific brush by ID
   */
  async getBrushById(id: string): Promise<BrushConfig | undefined> {
    const brushes = await this.loadBrushes();
    return brushes.find(b => b.id === id);
  }

  /**
   * Load export format configurations
   */
  async loadExportFormats(): Promise<ExportFormatConfig[]> {
    if (this.exportFormatCache) {
      return this.exportFormatCache;
    }

    try {
      const formats = await invoke<ExportFormatConfig[]>('load_export_format_config');
      this.exportFormatCache = formats;
      return formats;
    } catch (error) {
      console.warn('Failed to load export formats from backend:', error);
      const response = await fetch('/config/export_formats.json');
      const formats = await response.json();
      this.exportFormatCache = formats;
      return formats;
    }
  }

  /**
   * Load viewport preset configurations
   */
  async loadViewportPresets(): Promise<ViewportPresetConfig[]> {
    if (this.viewportPresetCache) {
      return this.viewportPresetCache;
    }

    try {
      const presets = await invoke<ViewportPresetConfig[]>('load_viewport_preset_config');
      this.viewportPresetCache = presets;
      return presets;
    } catch (error) {
      console.warn('Failed to load viewport presets from backend:', error);
      const response = await fetch('/config/viewport_presets.json');
      const presets = await response.json();
      this.viewportPresetCache = presets;
      return presets;
    }
  }

  /**
   * Load greeble pattern configurations
   */
  async loadGreeblePatterns(): Promise<GreeblePatternConfig[]> {
    if (this.greeblePatternCache) {
      return this.greeblePatternCache;
    }

    try {
      const patterns = await invoke<GreeblePatternConfig[]>('load_greeble_pattern_config');
      this.greeblePatternCache = patterns;
      return patterns;
    } catch (error) {
      console.warn('Failed to load greeble patterns from backend:', error);
      const response = await fetch('/config/greeble_patterns.json');
      const patterns = await response.json();
      this.greeblePatternCache = patterns;
      return patterns;
    }
  }

  /**
   * Clear all caches (useful for hot-reload)
   */
  clearCache() {
    this.brushCache = null;
    this.exportFormatCache = null;
    this.viewportPresetCache = null;
    this.greeblePatternCache = null;
  }

  /**
   * Subscribe to configuration changes (hot-reload)
   */
  onConfigChange(callback: () => void) {
    // TODO: Wire up Tauri event listener for config file changes
    // For now, just clear cache when called
    this.clearCache();
    callback();
  }
}

export const configService = new ConfigService();
