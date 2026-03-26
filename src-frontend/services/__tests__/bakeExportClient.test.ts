/**
 * bakeExportClient.test.ts
 * ────────────────────────────────────────────────────────────────────────────
 * Unit tests for BakeExportClient
 * 
 * Tests:
 *  1. Map export in different formats (Requirement 12.8)
 *  2. Batch export functionality (Requirement 12.8)
 *  3. Export settings validation (Requirement 12.8)
 *  4. Recommended settings for different map types (Requirement 12.8)
 * 
 * **Validates: Requirement 12.8**
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { bakeExportClient, type ExportSettings, type MapExportData } from '../bakeExportClient';

// ─── Mock Tauri APIs ─────────────────────────────────────────────────────────

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn((command: string, args: any) => {
    switch (command) {
      case 'export_map':
        return Promise.resolve();
      
      case 'export_maps_batch':
        return Promise.resolve([
          '/path/to/normal.png',
          '/path/to/ao.png',
          '/path/to/curvature.png',
        ]);
      
      default:
        return Promise.reject(new Error(`Unknown command: ${command}`));
    }
  }),
}));

vi.mock('@tauri-apps/plugin-dialog', () => ({
  save: vi.fn(() => Promise.resolve('/path/to/output.png')),
}));

// ─── Test Helpers ────────────────────────────────────────────────────────────

function createTestImageData(width: number, height: number): Uint8Array {
  return new Uint8Array(width * height * 4);
}

function createTestMapData(mapType: string, width: number, height: number): MapExportData {
  return {
    mapType,
    width,
    height,
    data: createTestImageData(width, height),
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('BakeExportClient', () => {
  // ─── Single Map Export (Requirement 12.8) ───────────────────────────────────
  
  describe('Single Map Export', () => {
    it('should export map in PNG format', async () => {
      // Arrange
      const path = '/path/to/normal.png';
      const width = 1024;
      const height = 1024;
      const data = createTestImageData(width, height);
      const settings: ExportSettings = { format: 'png' };
      
      // Act & Assert - should not throw
      await bakeExportClient.exportMap(path, width, height, data, settings);
    });
    
    it('should export map in EXR format', async () => {
      // Arrange
      const path = '/path/to/normal.exr';
      const width = 2048;
      const height = 2048;
      const data = createTestImageData(width, height);
      const settings: ExportSettings = { format: 'exr' };
      
      // Act & Assert - should not throw
      await bakeExportClient.exportMap(path, width, height, data, settings);
    });
    
    it('should export map in TGA format', async () => {
      // Arrange
      const path = '/path/to/normal.tga';
      const width = 512;
      const height = 512;
      const data = createTestImageData(width, height);
      const settings: ExportSettings = { format: 'tga' };
      
      // Act & Assert - should not throw
      await bakeExportClient.exportMap(path, width, height, data, settings);
    });
    
    it('should export with 8-bit depth', async () => {
      // Arrange
      const path = '/path/to/ao.png';
      const width = 1024;
      const height = 1024;
      const data = createTestImageData(width, height);
      const settings: ExportSettings = {
        format: 'png',
        bitDepth: 8,
      };
      
      // Act & Assert - should not throw
      await bakeExportClient.exportMap(path, width, height, data, settings);
    });
    
    it('should export with 16-bit depth', async () => {
      // Arrange
      const path = '/path/to/normal.png';
      const width = 2048;
      const height = 2048;
      const data = createTestImageData(width, height);
      const settings: ExportSettings = {
        format: 'png',
        bitDepth: 16,
      };
      
      // Act & Assert - should not throw
      await bakeExportClient.exportMap(path, width, height, data, settings);
    });
    
    it('should export with no compression', async () => {
      // Arrange
      const path = '/path/to/id.png';
      const width = 1024;
      const height = 1024;
      const data = createTestImageData(width, height);
      const settings: ExportSettings = {
        format: 'png',
        compression: 'none',
      };
      
      // Act & Assert - should not throw
      await bakeExportClient.exportMap(path, width, height, data, settings);
    });
    
    it('should export with fast compression', async () => {
      // Arrange
      const path = '/path/to/ao.png';
      const width = 1024;
      const height = 1024;
      const data = createTestImageData(width, height);
      const settings: ExportSettings = {
        format: 'png',
        compression: 'fast',
      };
      
      // Act & Assert - should not throw
      await bakeExportClient.exportMap(path, width, height, data, settings);
    });
    
    it('should export with best compression', async () => {
      // Arrange
      const path = '/path/to/curvature.png';
      const width = 1024;
      const height = 1024;
      const data = createTestImageData(width, height);
      const settings: ExportSettings = {
        format: 'png',
        compression: 'best',
      };
      
      // Act & Assert - should not throw
      await bakeExportClient.exportMap(path, width, height, data, settings);
    });
  });
  
  // ─── Batch Map Export (Requirement 12.8) ────────────────────────────────────
  
  describe('Batch Map Export', () => {
    it('should export multiple maps in batch', async () => {
      // Arrange
      const basePath = '/path/to/output';
      const maps: MapExportData[] = [
        createTestMapData('normal', 1024, 1024),
        createTestMapData('ao', 1024, 1024),
        createTestMapData('curvature', 1024, 1024),
      ];
      const settings: ExportSettings = { format: 'png' };
      
      // Act
      const paths = await bakeExportClient.exportMapsBatch(basePath, maps, settings);
      
      // Assert
      expect(paths).toBeInstanceOf(Array);
      expect(paths.length).toBe(3);
    });
    
    it('should export single map in batch', async () => {
      // Arrange
      const basePath = '/path/to/output';
      const maps: MapExportData[] = [
        createTestMapData('normal', 2048, 2048),
      ];
      const settings: ExportSettings = { format: 'exr' };
      
      // Act
      const paths = await bakeExportClient.exportMapsBatch(basePath, maps, settings);
      
      // Assert
      expect(paths).toBeInstanceOf(Array);
    });
    
    it('should handle empty map array', async () => {
      // Arrange
      const basePath = '/path/to/output';
      const maps: MapExportData[] = [];
      const settings: ExportSettings = { format: 'png' };
      
      // Act
      const paths = await bakeExportClient.exportMapsBatch(basePath, maps, settings);
      
      // Assert
      expect(paths).toBeInstanceOf(Array);
    });
    
    it('should export maps with different resolutions', async () => {
      // Arrange
      const basePath = '/path/to/output';
      const maps: MapExportData[] = [
        createTestMapData('normal', 2048, 2048),
        createTestMapData('ao', 1024, 1024),
        createTestMapData('curvature', 512, 512),
      ];
      const settings: ExportSettings = { format: 'png' };
      
      // Act
      const paths = await bakeExportClient.exportMapsBatch(basePath, maps, settings);
      
      // Assert
      expect(paths).toBeInstanceOf(Array);
    });
  });
  
  // ─── Export with Dialog (Requirement 12.8) ──────────────────────────────────
  
  describe('Export with Dialog', () => {
    it('should export map with save dialog', async () => {
      // Arrange
      const defaultName = 'normal_map';
      const width = 1024;
      const height = 1024;
      const data = createTestImageData(width, height);
      const settings: ExportSettings = { format: 'png' };
      
      // Act
      const path = await bakeExportClient.exportMapWithDialog(
        defaultName,
        width,
        height,
        data,
        settings
      );
      
      // Assert
      expect(path).toBe('/path/to/output.png');
    });
    
    it('should return null when dialog is cancelled', async () => {
      // Arrange
      const { save } = await import('@tauri-apps/plugin-dialog');
      vi.mocked(save).mockResolvedValueOnce(null);
      
      const defaultName = 'normal_map';
      const width = 1024;
      const height = 1024;
      const data = createTestImageData(width, height);
      const settings: ExportSettings = { format: 'png' };
      
      // Act
      const path = await bakeExportClient.exportMapWithDialog(
        defaultName,
        width,
        height,
        data,
        settings
      );
      
      // Assert
      expect(path).toBeNull();
    });
    
    it('should export batch with save dialog', async () => {
      // Arrange
      const defaultName = 'baked_maps';
      const maps: MapExportData[] = [
        createTestMapData('normal', 1024, 1024),
        createTestMapData('ao', 1024, 1024),
      ];
      const settings: ExportSettings = { format: 'png' };
      
      // Act
      const paths = await bakeExportClient.exportMapsBatchWithDialog(
        defaultName,
        maps,
        settings
      );
      
      // Assert
      expect(paths).toBeInstanceOf(Array);
    });
    
    it('should return null when batch dialog is cancelled', async () => {
      // Arrange
      const { save } = await import('@tauri-apps/plugin-dialog');
      vi.mocked(save).mockResolvedValueOnce(null);
      
      const defaultName = 'baked_maps';
      const maps: MapExportData[] = [
        createTestMapData('normal', 1024, 1024),
      ];
      const settings: ExportSettings = { format: 'png' };
      
      // Act
      const paths = await bakeExportClient.exportMapsBatchWithDialog(
        defaultName,
        maps,
        settings
      );
      
      // Assert
      expect(paths).toBeNull();
    });
  });
  
  // ─── Recommended Settings (Requirement 12.8) ────────────────────────────────
  
  describe('Recommended Settings', () => {
    it('should recommend 16-bit PNG for normal maps', () => {
      // Act
      const settings = bakeExportClient.getRecommendedSettings('normal');
      
      // Assert
      expect(settings.format).toBe('png');
      expect(settings.bitDepth).toBe(16);
      expect(settings.compression).toBe('best');
    });
    
    it('should recommend 16-bit PNG for position maps', () => {
      // Act
      const settings = bakeExportClient.getRecommendedSettings('position');
      
      // Assert
      expect(settings.format).toBe('png');
      expect(settings.bitDepth).toBe(16);
      expect(settings.compression).toBe('best');
    });
    
    it('should recommend 8-bit PNG for AO maps', () => {
      // Act
      const settings = bakeExportClient.getRecommendedSettings('ao');
      
      // Assert
      expect(settings.format).toBe('png');
      expect(settings.bitDepth).toBe(8);
      expect(settings.compression).toBe('best');
    });
    
    it('should recommend 8-bit PNG for curvature maps', () => {
      // Act
      const settings = bakeExportClient.getRecommendedSettings('curvature');
      
      // Assert
      expect(settings.format).toBe('png');
      expect(settings.bitDepth).toBe(8);
      expect(settings.compression).toBe('best');
    });
    
    it('should recommend 8-bit PNG for thickness maps', () => {
      // Act
      const settings = bakeExportClient.getRecommendedSettings('thickness');
      
      // Assert
      expect(settings.format).toBe('png');
      expect(settings.bitDepth).toBe(8);
      expect(settings.compression).toBe('best');
    });
    
    it('should recommend no compression for ID maps', () => {
      // Act
      const settings = bakeExportClient.getRecommendedSettings('id');
      
      // Assert
      expect(settings.format).toBe('png');
      expect(settings.bitDepth).toBe(8);
      expect(settings.compression).toBe('none');
    });
    
    it('should provide default settings for unknown map types', () => {
      // Act
      const settings = bakeExportClient.getRecommendedSettings('unknown');
      
      // Assert
      expect(settings.format).toBe('png');
      expect(settings.bitDepth).toBe(8);
      expect(settings.compression).toBe('best');
    });
  });
  
  // ─── Format Utilities ────────────────────────────────────────────────────────
  
  describe('Format Utilities', () => {
    it('should get extension for PNG format', () => {
      // Act
      const ext = bakeExportClient.getExtension('png');
      
      // Assert
      expect(ext).toBe('png');
    });
    
    it('should get extension for EXR format', () => {
      // Act
      const ext = bakeExportClient.getExtension('exr');
      
      // Assert
      expect(ext).toBe('exr');
    });
    
    it('should get extension for TGA format', () => {
      // Act
      const ext = bakeExportClient.getExtension('tga');
      
      // Assert
      expect(ext).toBe('tga');
    });
    
    it('should get display name for PNG format', () => {
      // Act
      const name = bakeExportClient.getFormatName('png');
      
      // Assert
      expect(name).toBe('PNG (Portable Network Graphics)');
    });
    
    it('should get display name for EXR format', () => {
      // Act
      const name = bakeExportClient.getFormatName('exr');
      
      // Assert
      expect(name).toBe('EXR (OpenEXR HDR)');
    });
    
    it('should get display name for TGA format', () => {
      // Act
      const name = bakeExportClient.getFormatName('tga');
      
      // Assert
      expect(name).toBe('TGA (Targa)');
    });
  });
  
  // ─── Error Handling ──────────────────────────────────────────────────────────
  
  describe('Error Handling', () => {
    it('should handle export errors', async () => {
      // Arrange
      const { invoke } = await import('@tauri-apps/api/core');
      vi.mocked(invoke).mockRejectedValueOnce(new Error('Export failed'));
      
      const path = '/path/to/normal.png';
      const width = 1024;
      const height = 1024;
      const data = createTestImageData(width, height);
      const settings: ExportSettings = { format: 'png' };
      
      // Act & Assert
      await expect(
        bakeExportClient.exportMap(path, width, height, data, settings)
      ).rejects.toThrow('Export failed');
    });
    
    it('should handle batch export errors', async () => {
      // Arrange
      const { invoke } = await import('@tauri-apps/api/core');
      vi.mocked(invoke).mockRejectedValueOnce(new Error('Batch export failed'));
      
      const basePath = '/path/to/output';
      const maps: MapExportData[] = [
        createTestMapData('normal', 1024, 1024),
      ];
      const settings: ExportSettings = { format: 'png' };
      
      // Act & Assert
      await expect(
        bakeExportClient.exportMapsBatch(basePath, maps, settings)
      ).rejects.toThrow('Batch export failed');
    });
  });
  
  // ─── Edge Cases ──────────────────────────────────────────────────────────────
  
  describe('Edge Cases', () => {
    it('should handle very small images', async () => {
      // Arrange
      const path = '/path/to/tiny.png';
      const width = 16;
      const height = 16;
      const data = createTestImageData(width, height);
      const settings: ExportSettings = { format: 'png' };
      
      // Act & Assert - should not throw
      await bakeExportClient.exportMap(path, width, height, data, settings);
    });
    
    it('should handle very large images', async () => {
      // Arrange
      const path = '/path/to/huge.png';
      const width = 4096;
      const height = 4096;
      const data = createTestImageData(width, height);
      const settings: ExportSettings = { format: 'png' };
      
      // Act & Assert - should not throw
      await bakeExportClient.exportMap(path, width, height, data, settings);
    });
    
    it('should handle non-square images', async () => {
      // Arrange
      const path = '/path/to/rect.png';
      const width = 2048;
      const height = 1024;
      const data = createTestImageData(width, height);
      const settings: ExportSettings = { format: 'png' };
      
      // Act & Assert - should not throw
      await bakeExportClient.exportMap(path, width, height, data, settings);
    });
    
    it('should handle empty data array', async () => {
      // Arrange
      const path = '/path/to/empty.png';
      const width = 0;
      const height = 0;
      const data = new Uint8Array(0);
      const settings: ExportSettings = { format: 'png' };
      
      // Act & Assert - should not throw
      await bakeExportClient.exportMap(path, width, height, data, settings);
    });
  });
});
