// @ts-nocheck
/**
 * Unified Export Service
 * 
 * Centralized export system using the ConfigRegistry.
 * Replaces hardcoded export logic across all DCC apps.
 */

import { invoke } from '@tauri-apps/api/core';
import { save } from '@tauri-apps/plugin-dialog';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import * as THREE from 'three';
import { configClient, ExportFormatConfig } from './configClient';

// ============================================================================
// TYPES
// ============================================================================

export interface ExportOptions {
  /** Selected export format ID */
  formatId: string;
  
  /** Format-specific options */
  options?: Record<string, any>;
  
  /** Optional filename (if not provided, will prompt user) */
  filename?: string;
  
  /** Progress callback */
  onProgress?: (progress: number, status: string) => void;
}

export interface ExportResult {
  success: boolean;
  path?: string;
  error?: string;
}

// ============================================================================
// EXPORT SERVICE
// ============================================================================

class ExportService {
  private formats: Map<string, ExportFormatConfig> = new Map();
  private initialized = false;

  /**
   * Initialize the export service by loading available formats
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    const formats = await configClient.listExportFormats();
    formats.forEach(format => {
      this.formats.set(format.id, format);
    });
    
    this.initialized = true;
    console.log(`[ExportService] Initialized with ${formats.length} formats`);
  }

  /**
   * Get all available export formats
   */
  async getAvailableFormats(): Promise<ExportFormatConfig[]> {
    await this.initialize();
    return Array.from(this.formats.values());
  }

  /**
   * Get formats that support meshes
   */
  async getMeshFormats(): Promise<ExportFormatConfig[]> {
    await this.initialize();
    return Array.from(this.formats.values()).filter(f => f.supportsMeshes);
  }

  /**
   * Get formats that support textures
   */
  async getTextureFormats(): Promise<ExportFormatConfig[]> {
    await this.initialize();
    return Array.from(this.formats.values()).filter(f => f.supportsTextures);
  }

  /**
   * Get a specific format by ID
   */
  async getFormat(id: string): Promise<ExportFormatConfig | null> {
    await this.initialize();
    return this.formats.get(id) || null;
  }

  /**
   * Export a Three.js scene/mesh to the specified format
   */
  async exportMesh(
    sceneOrMesh: THREE.Scene | THREE.Mesh | THREE.Group,
    options: ExportOptions
  ): Promise<ExportResult> {
    await this.initialize();
    
    const format = this.formats.get(options.formatId);
    if (!format) {
      return {
        success: false,
        error: `Unknown export format: ${options.formatId}`
      };
    }

    if (!format.supportsMeshes) {
      return {
        success: false,
        error: `Format ${format.name} does not support mesh export`
      };
    }

    try {
      options.onProgress?.(0, `Preparing ${format.name} export...`);

      // Get file path from user if not provided
      let filePath = options.filename;
      if (!filePath) {
        const defaultExt = format.extensions[0];
        const result = await save({
          filters: [{
            name: format.name,
            extensions: format.extensions
          }],
          defaultPath: `export.${defaultExt}`
        });
        
        if (!result) {
          return { success: false, error: 'Export cancelled by user' };
        }
        filePath = result;
      }

      // Route to appropriate exporter based on format
      switch (options.formatId) {
        case 'gltf':
        case 'glb':
          return await this.exportGLTF(sceneOrMesh, filePath, options);
        
        case 'obj':
          return await this.exportOBJ(sceneOrMesh, filePath, options);
        
        default:
          return {
            success: false,
            error: `Export not implemented for format: ${format.name}`
          };
      }
    } catch (error) {
      console.error('[ExportService] Export failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Export texture/image data
   */
  async exportTexture(
    canvas: HTMLCanvasElement | THREE.Texture,
    options: ExportOptions
  ): Promise<ExportResult> {
    await this.initialize();
    
    const format = this.formats.get(options.formatId);
    if (!format) {
      return {
        success: false,
        error: `Unknown export format: ${options.formatId}`
      };
    }

    if (!format.supportsTextures) {
      return {
        success: false,
        error: `Format ${format.name} does not support texture export`
      };
    }

    try {
      options.onProgress?.(0, `Preparing ${format.name} export...`);

      // Get file path from user if not provided
      let filePath = options.filename;
      if (!filePath) {
        const defaultExt = format.extensions[0];
        const result = await save({
          filters: [{
            name: format.name,
            extensions: format.extensions
          }],
          defaultPath: `texture.${defaultExt}`
        });
        
        if (!result) {
          return { success: false, error: 'Export cancelled by user' };
        }
        filePath = result;
      }

      // Convert Three.js texture to canvas if needed
      let exportCanvas: HTMLCanvasElement;
      if (canvas instanceof THREE.Texture) {
        exportCanvas = this.textureToCanvas(canvas, options.options?.resolution);
      } else {
        exportCanvas = canvas;
      }

      // Route to appropriate exporter
      switch (options.formatId) {
        case 'png':
          return await this.exportPNG(exportCanvas, filePath, options);
        
        case 'jpg':
          return await this.exportJPG(exportCanvas, filePath, options);
        
        case 'exr':
          return await this.exportEXR(exportCanvas, filePath, options);
        
        case 'heightmap_png':
          return await this.exportHeightmapPNG(exportCanvas, filePath, options);
        
        case 'heightmap_exr':
          return await this.exportHeightmapEXR(exportCanvas, filePath, options);
        
        default:
          return {
            success: false,
            error: `Texture export not implemented for format: ${format.name}`
          };
      }
    } catch (error) {
      console.error('[ExportService] Texture export failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // ========================================================================
  // PRIVATE EXPORTERS
  // ========================================================================

  private async exportGLTF(
    sceneOrMesh: THREE.Scene | THREE.Mesh | THREE.Group,
    filePath: string,
    options: ExportOptions
  ): Promise<ExportResult> {
    return new Promise((resolve) => {
      const exporter = new GLTFExporter();
      const binary = options.formatId === 'glb';
      
      const exportOptions = {
        binary,
        embedImages: options.options?.embed_textures ?? true,
        maxTextureSize: 4096,
        ...options.options
      };

      options.onProgress?.(50, 'Generating export data...');

      exporter.parse(
        sceneOrMesh,
        async (result) => {
          try {
            options.onProgress?.(75, 'Writing file...');
            
            let data: Uint8Array;
            if (binary) {
              data = new Uint8Array(result as ArrayBuffer);
            } else {
              const json = JSON.stringify(result, null, exportOptions.pretty_print ? 2 : 0);
              data = new TextEncoder().encode(json);
            }

            // Write file using Tauri
            await invoke('write_file', {
              path: filePath,
              contents: Array.from(data)
            });

            options.onProgress?.(100, 'Export complete!');
            resolve({
              success: true,
              path: filePath
            });
          } catch (error) {
            resolve({
              success: false,
              error: error instanceof Error ? error.message : 'Failed to write file'
            });
          }
        },
        (error) => {
          resolve({
            success: false,
            error: error instanceof Error ? error.message : 'Export failed'
          });
        },
        exportOptions
      );
    });
  }

  private async exportOBJ(
    sceneOrMesh: THREE.Scene | THREE.Mesh | THREE.Group,
    filePath: string,
    options: ExportOptions
  ): Promise<ExportResult> {
    try {
      // Dynamic import of OBJExporter
      const { OBJExporter } = await import('three/examples/jsm/exporters/OBJExporter.js');
      const exporter = new OBJExporter();
      
      options.onProgress?.(50, 'Generating OBJ data...');
      const objData = exporter.parse(sceneOrMesh);
      
      options.onProgress?.(75, 'Writing file...');
      await invoke('write_file', {
        path: filePath,
        contents: Array.from(new TextEncoder().encode(objData))
      });

      options.onProgress?.(100, 'Export complete!');
      return {
        success: true,
        path: filePath
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'OBJ export failed'
      };
    }
  }

  private async exportPNG(
    canvas: HTMLCanvasElement,
    filePath: string,
    options: ExportOptions
  ): Promise<ExportResult> {
    try {
      options.onProgress?.(50, 'Encoding PNG...');
      
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (blob) => blob ? resolve(blob) : reject(new Error('Failed to create blob')),
          'image/png',
          options.options?.compression ?? 6
        );
      });

      options.onProgress?.(75, 'Writing file...');
      const arrayBuffer = await blob.arrayBuffer();
      await invoke('write_file', {
        path: filePath,
        contents: Array.from(new Uint8Array(arrayBuffer))
      });

      options.onProgress?.(100, 'Export complete!');
      return {
        success: true,
        path: filePath
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'PNG export failed'
      };
    }
  }

  private async exportJPG(
    canvas: HTMLCanvasElement,
    filePath: string,
    options: ExportOptions
  ): Promise<ExportResult> {
    try {
      options.onProgress?.(50, 'Encoding JPEG...');
      
      const quality = (options.options?.quality ?? 90) / 100;
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (blob) => blob ? resolve(blob) : reject(new Error('Failed to create blob')),
          'image/jpeg',
          quality
        );
      });

      options.onProgress?.(75, 'Writing file...');
      const arrayBuffer = await blob.arrayBuffer();
      await invoke('write_file', {
        path: filePath,
        contents: Array.from(new Uint8Array(arrayBuffer))
      });

      options.onProgress?.(100, 'Export complete!');
      return {
        success: true,
        path: filePath
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'JPEG export failed'
      };
    }
  }

  private async exportEXR(
    canvas: HTMLCanvasElement,
    filePath: string,
    options: ExportOptions
  ): Promise<ExportResult> {
    // EXR export requires specialized library - delegate to Rust backend
    try {
      options.onProgress?.(50, 'Encoding EXR...');
      
      // Get image data from canvas
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Failed to get canvas context');
      }
      
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      
      // Send to Rust for EXR encoding
      await invoke('export_texture_exr', {
        path: filePath,
        width: canvas.width,
        height: canvas.height,
        data: Array.from(imageData.data),
        compression: options.options?.compression ?? 'zip',
        bitDepth: options.options?.bit_depth ?? 'half'
      });

      options.onProgress?.(100, 'Export complete!');
      return {
        success: true,
        path: filePath
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'EXR export failed'
      };
    }
  }

  private async exportHeightmapPNG(
    canvas: HTMLCanvasElement,
    filePath: string,
    options: ExportOptions
  ): Promise<ExportResult> {
    // Heightmap PNG uses grayscale encoding
    return this.exportPNG(canvas, filePath, options);
  }

  private async exportHeightmapEXR(
    canvas: HTMLCanvasElement,
    filePath: string,
    options: ExportOptions
  ): Promise<ExportResult> {
    // Heightmap EXR uses single-channel float encoding
    return this.exportEXR(canvas, filePath, options);
  }

  /**
   * Convert Three.js texture to canvas
   */
  private textureToCanvas(texture: THREE.Texture, resolution?: number): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    const size = resolution || 2048;
    canvas.width = size;
    canvas.height = size;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to create canvas context');
    }

    // Draw texture to canvas
    if (texture.image) {
      ctx.drawImage(texture.image, 0, 0, size, size);
    }

    return canvas;
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const exportService = new ExportService();
export default exportService;
// @ts-nocheck
