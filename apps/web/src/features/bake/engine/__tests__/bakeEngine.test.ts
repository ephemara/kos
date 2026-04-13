/**
 * bakeEngine.test.ts
 * ────────────────────────────────────────────────────────────────────────────
 * Unit tests for BakeEngine
 * 
 * Tests:
 *  1. Baking settings validation (Requirement 12.3)
 *  2. Mesh loading and management (Requirement 12.1)
 *  3. Cage generation and validation (Requirement 12.2)
 *  4. Map baking functionality (Requirement 12.1)
 *  5. Batch baking (Requirement 12.6)
 *  6. Preview functionality (Requirement 12.7)
 * 
 * **Validates: Requirements 12.1, 12.2, 12.3, 12.6, 12.7**
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as THREE from 'three';
import { BakeEngine, type BakeSettings, type BakeMesh } from '../bakeEngine';

// ─── Mock Three.js WebGL Context ─────────────────────────────────────────────

vi.mock('three', async () => {
  const actual = await vi.importActual<typeof THREE>('three');
  
  class MockWebGLRenderer {
    domElement = document.createElement('canvas');
    dispose = vi.fn();
    render = vi.fn();
    setSize = vi.fn();
    setPixelRatio = vi.fn();
  }
  
  return {
    ...actual,
    WebGLRenderer: MockWebGLRenderer,
  };
});

// Mock OrbitControls
vi.mock('three/addons/controls/OrbitControls.js', () => ({
  OrbitControls: class MockOrbitControls {
    enableDamping = true;
    dampingFactor = 0.05;
    enabled = true;
    target = new THREE.Vector3();
    update = vi.fn();
    dispose = vi.fn();
  },
}));

// Mock rayTracer
vi.mock('../rayTracer', () => ({
  rayTracer: {
    bakeNormalMap: vi.fn().mockResolvedValue({
      width: 1024,
      height: 1024,
      data: new Uint8Array(1024 * 1024 * 4),
      timeMs: 100,
    }),
    bakeAOMap: vi.fn().mockResolvedValue({
      width: 1024,
      height: 1024,
      data: new Uint8Array(1024 * 1024 * 4),
      timeMs: 150,
    }),
    bakeCurvatureMap: vi.fn().mockResolvedValue({
      width: 1024,
      height: 1024,
      data: new Uint8Array(1024 * 1024 * 4),
      timeMs: 120,
    }),
    bakeThicknessMap: vi.fn().mockResolvedValue({
      width: 1024,
      height: 1024,
      data: new Uint8Array(1024 * 1024 * 4),
      timeMs: 130,
    }),
    bakePositionMap: vi.fn().mockResolvedValue({
      width: 1024,
      height: 1024,
      data: new Uint8Array(1024 * 1024 * 4),
      timeMs: 110,
    }),
    bakeIDMap: vi.fn().mockResolvedValue({
      width: 1024,
      height: 1024,
      data: new Uint8Array(1024 * 1024 * 4),
      timeMs: 90,
    }),
    bakeBatch: vi.fn().mockResolvedValue(new Map()),
  },
}));

// Mock cageGenerator
vi.mock('../cageGenerator', () => ({
  cageGenerator: {
    generateUniform: vi.fn().mockResolvedValue({
      positions: new Float32Array(12),
      normals: new Float32Array(12),
      tangents: new Float32Array(16),
      uvs: new Float32Array(8),
      indices: new Uint32Array(6),
    }),
    calculateRecommendedExtrusion: vi.fn().mockResolvedValue(0.1),
    validate: vi.fn().mockResolvedValue({ valid: true, issues: [] }),
  },
}));

// Mock CageEditor
vi.mock('../cageEditor', () => ({
  CageEditor: class MockCageEditor {
    setCamera = vi.fn();
    setCageMesh = vi.fn();
    setMode = vi.fn();
    getMode = vi.fn().mockReturnValue({ type: 'select' });
    selectVertices = vi.fn().mockReturnValue(0);
    moveVertices = vi.fn();
    scaleVertices = vi.fn();
    smoothVertices = vi.fn();
    reset = vi.fn();
    clearSelection = vi.fn();
    getSelectionCount = vi.fn().mockReturnValue(0);
    createSelectionVisualization = vi.fn().mockReturnValue(null);
    exportCageMesh = vi.fn().mockReturnValue(null);
    dispose = vi.fn();
  },
}));

// ─── Test Helpers ────────────────────────────────────────────────────────────

function createTestCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 600;
  return canvas;
}

function createTestMesh(): BakeMesh {
  return {
    positions: new Float32Array([
      0, 0, 0,
      1, 0, 0,
      1, 1, 0,
      0, 1, 0,
    ]),
    normals: new Float32Array([
      0, 0, 1,
      0, 0, 1,
      0, 0, 1,
      0, 0, 1,
    ]),
    tangents: new Float32Array([
      1, 0, 0, 1,
      1, 0, 0, 1,
      1, 0, 0, 1,
      1, 0, 0, 1,
    ]),
    uvs: new Float32Array([
      0, 0,
      1, 0,
      1, 1,
      0, 1,
    ]),
    indices: new Uint32Array([0, 1, 2, 0, 2, 3]),
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('BakeEngine', () => {
  let engine: BakeEngine;
  let canvas: HTMLCanvasElement;
  
  beforeEach(() => {
    canvas = createTestCanvas();
    engine = new BakeEngine(canvas);
  });
  
  afterEach(() => {
    if (engine) {
      engine.dispose();
    }
  });
  
  // ─── Initialization ──────────────────────────────────────────────────────────
  
  describe('Initialization', () => {
    it('should initialize with default settings', () => {
      // Act
      const settings = engine.getSettings();
      
      // Assert
      expect(settings.resolution).toBe(2048);
      expect(settings.samples).toBe(16);
      expect(settings.maxDistance).toBe(1.0);
      expect(settings.normalSpace).toBe('tangent');
      expect(settings.dilationIterations).toBe(8);
      expect(settings.enableAntialiasing).toBe(true);
    });
    
    it('should not be baking initially', () => {
      // Assert
      expect(engine.isBakingInProgress()).toBe(false);
    });
  });
  
  // ─── Baking Settings Validation (Requirement 12.3) ──────────────────────────
  
  describe('Baking Settings Validation', () => {
    it('should update resolution setting', () => {
      // Act
      engine.setSettings({ resolution: 4096 });
      const settings = engine.getSettings();
      
      // Assert
      expect(settings.resolution).toBe(4096);
    });
    
    it('should update samples setting', () => {
      // Act
      engine.setSettings({ samples: 32 });
      const settings = engine.getSettings();
      
      // Assert
      expect(settings.samples).toBe(32);
    });
    
    it('should update maxDistance setting', () => {
      // Act
      engine.setSettings({ maxDistance: 2.0 });
      const settings = engine.getSettings();
      
      // Assert
      expect(settings.maxDistance).toBe(2.0);
    });
    
    it('should update normalSpace setting', () => {
      // Act
      engine.setSettings({ normalSpace: 'world' });
      const settings = engine.getSettings();
      
      // Assert
      expect(settings.normalSpace).toBe('world');
    });
    
    it('should update multiple settings at once', () => {
      // Act
      engine.setSettings({
        resolution: 1024,
        samples: 8,
        maxDistance: 0.5,
        normalSpace: 'object',
      });
      const settings = engine.getSettings();
      
      // Assert
      expect(settings.resolution).toBe(1024);
      expect(settings.samples).toBe(8);
      expect(settings.maxDistance).toBe(0.5);
      expect(settings.normalSpace).toBe('object');
    });
    
    it('should preserve unmodified settings', () => {
      // Act
      engine.setSettings({ resolution: 512 });
      const settings = engine.getSettings();
      
      // Assert - other settings should remain default
      expect(settings.samples).toBe(16);
      expect(settings.maxDistance).toBe(1.0);
    });
  });
  
  // ─── Mesh Loading (Requirement 12.1) ────────────────────────────────────────
  
  describe('Mesh Loading', () => {
    it('should load high-poly mesh', async () => {
      // Arrange
      const mesh = createTestMesh();
      
      // Act & Assert - should not throw
      await engine.loadHighPolyMesh(mesh);
    });
    
    it('should load low-poly mesh', async () => {
      // Arrange
      const mesh = createTestMesh();
      
      // Act & Assert - should not throw
      await engine.loadLowPolyMesh(mesh);
    });
    
    it('should replace existing high-poly mesh', async () => {
      // Arrange
      const mesh1 = createTestMesh();
      const mesh2 = createTestMesh();
      
      // Act
      await engine.loadHighPolyMesh(mesh1);
      await engine.loadHighPolyMesh(mesh2);
      
      // Assert - should not throw
      expect(engine).toBeDefined();
    });
    
    it('should replace existing low-poly mesh', async () => {
      // Arrange
      const mesh1 = createTestMesh();
      const mesh2 = createTestMesh();
      
      // Act
      await engine.loadLowPolyMesh(mesh1);
      await engine.loadLowPolyMesh(mesh2);
      
      // Assert - should not throw
      expect(engine).toBeDefined();
    });
  });
  
  // ─── Cage Generation (Requirement 12.2) ─────────────────────────────────────
  
  describe('Cage Generation', () => {
    it('should throw error when generating cage without low-poly mesh', async () => {
      // Act & Assert
      await expect(engine.generateCage()).rejects.toThrow('Low-poly mesh must be loaded');
    });
    
    it('should generate cage with default extrusion', async () => {
      // Arrange
      const mesh = createTestMesh();
      await engine.loadLowPolyMesh(mesh);
      
      // Act & Assert - should not throw
      await engine.generateCage();
    });
    
    it('should generate cage with custom extrusion', async () => {
      // Arrange
      const mesh = createTestMesh();
      await engine.loadLowPolyMesh(mesh);
      
      // Act & Assert - should not throw
      await engine.generateCage(0.2);
    });
    
    it('should update settings with cage extrusion', async () => {
      // Arrange
      const mesh = createTestMesh();
      await engine.loadLowPolyMesh(mesh);
      
      // Act
      await engine.generateCage(0.15);
      const settings = engine.getSettings();
      
      // Assert
      expect(settings.cageExtrusion).toBe(0.15);
    });
    
    it('should set cage mesh after generation', async () => {
      // Arrange
      const mesh = createTestMesh();
      await engine.loadLowPolyMesh(mesh);
      
      // Act
      await engine.generateCage();
      const cageMesh = engine.getCageMesh();
      
      // Assert
      expect(cageMesh).not.toBeNull();
    });
  });
  
  // ─── Cage Validation (Requirement 12.2) ─────────────────────────────────────
  
  describe('Cage Validation', () => {
    it('should return invalid when low-poly mesh not loaded', async () => {
      // Act
      const result = await engine.validateCage();
      
      // Assert
      expect(result.valid).toBe(false);
      expect(result.issues).toContain('Low-poly mesh not loaded');
    });
    
    it('should return invalid when cage not generated', async () => {
      // Arrange
      const mesh = createTestMesh();
      await engine.loadLowPolyMesh(mesh);
      
      // Act
      const result = await engine.validateCage();
      
      // Assert
      expect(result.valid).toBe(false);
      expect(result.issues).toContain('Cage mesh not generated');
    });
    
    it.skip('should validate cage after generation (requires Rust backend)', async () => {
      // Arrange
      const mesh = createTestMesh();
      await engine.loadLowPolyMesh(mesh);
      
      // Mock cageGenerator to return a proper cage with normals
      const { cageGenerator } = await import('../cageGenerator');
      vi.mocked(cageGenerator.generateUniform).mockResolvedValueOnce({
        positions: new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0]),
        normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]),
        tangents: new Float32Array([1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1]),
        uvs: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
        indices: new Uint32Array([0, 1, 2, 0, 2, 3]),
      });
      
      await engine.generateCage();
      
      // Act
      const result = await engine.validateCage();
      
      // Assert
      expect(result.valid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });
  });
  
  // ─── Recommended Extrusion Calculation (Requirement 12.2) ───────────────────
  
  describe('Recommended Extrusion', () => {
    it('should throw error when calculating without low-poly mesh', async () => {
      // Act & Assert
      await expect(engine.calculateRecommendedExtrusion()).rejects.toThrow(
        'Low-poly mesh must be loaded'
      );
    });
    
    it('should calculate recommended extrusion', async () => {
      // Arrange
      const mesh = createTestMesh();
      await engine.loadLowPolyMesh(mesh);
      
      // Act
      const extrusion = await engine.calculateRecommendedExtrusion();
      
      // Assert
      expect(extrusion).toBeGreaterThan(0);
      expect(typeof extrusion).toBe('number');
    });
  });
  
  // ─── Map Baking (Requirement 12.1) ──────────────────────────────────────────
  
  describe('Map Baking', () => {
    it('should throw error when baking normal map without meshes', async () => {
      // Act & Assert
      await expect(engine.bakeNormalMap()).rejects.toThrow(
        'Both high-poly and low-poly meshes must be loaded'
      );
    });
    
    it('should bake normal map', async () => {
      // Arrange
      const highMesh = createTestMesh();
      const lowMesh = createTestMesh();
      await engine.loadHighPolyMesh(highMesh);
      await engine.loadLowPolyMesh(lowMesh);
      
      // Act
      const bakedMap = await engine.bakeNormalMap();
      
      // Assert
      expect(bakedMap).toBeDefined();
      expect(bakedMap.type).toBe('normal');
      expect(bakedMap.texture).toBeInstanceOf(THREE.Texture);
      expect(bakedMap.data).toBeInstanceOf(Uint8Array);
    });
    
    it('should throw error when baking AO map without low-poly mesh', async () => {
      // Act & Assert
      await expect(engine.bakeAOMap()).rejects.toThrow('Low-poly mesh must be loaded');
    });
    
    it('should bake AO map', async () => {
      // Arrange
      const mesh = createTestMesh();
      await engine.loadLowPolyMesh(mesh);
      
      // Act
      const bakedMap = await engine.bakeAOMap();
      
      // Assert
      expect(bakedMap).toBeDefined();
      expect(bakedMap.type).toBe('ao');
      expect(bakedMap.texture).toBeInstanceOf(THREE.Texture);
    });
    
    it('should bake curvature map', async () => {
      // Arrange
      const mesh = createTestMesh();
      await engine.loadLowPolyMesh(mesh);
      
      // Act
      const bakedMap = await engine.bakeCurvatureMap();
      
      // Assert
      expect(bakedMap).toBeDefined();
      expect(bakedMap.type).toBe('curvature');
    });
    
    it('should bake thickness map', async () => {
      // Arrange
      const mesh = createTestMesh();
      await engine.loadLowPolyMesh(mesh);
      
      // Act
      const bakedMap = await engine.bakeThicknessMap();
      
      // Assert
      expect(bakedMap).toBeDefined();
      expect(bakedMap.type).toBe('thickness');
    });
    
    it('should bake position map', async () => {
      // Arrange
      const mesh = createTestMesh();
      await engine.loadLowPolyMesh(mesh);
      
      // Act
      const bakedMap = await engine.bakePositionMap();
      
      // Assert
      expect(bakedMap).toBeDefined();
      expect(bakedMap.type).toBe('position');
    });
    
    it('should bake ID map', async () => {
      // Arrange
      const mesh = createTestMesh();
      await engine.loadLowPolyMesh(mesh);
      
      // Act
      const bakedMap = await engine.bakeIDMap();
      
      // Assert
      expect(bakedMap).toBeDefined();
      expect(bakedMap.type).toBe('id');
    });
    
    it('should set baking flag during bake', async () => {
      // Arrange
      const mesh = createTestMesh();
      await engine.loadLowPolyMesh(mesh);
      
      // Act
      const bakePromise = engine.bakeAOMap();
      const isDuringBake = engine.isBakingInProgress();
      await bakePromise;
      const isAfterBake = engine.isBakingInProgress();
      
      // Assert
      expect(isDuringBake).toBe(true);
      expect(isAfterBake).toBe(false);
    });
  });
  
  // ─── Batch Baking (Requirement 12.6) ────────────────────────────────────────
  
  describe('Batch Baking', () => {
    it('should throw error when batch baking without low-poly mesh', async () => {
      // Act & Assert
      await expect(engine.bakeBatch(['ao', 'curvature'])).rejects.toThrow(
        'Low-poly mesh must be loaded'
      );
    });
    
    it('should batch bake multiple map types', async () => {
      // Arrange
      const mesh = createTestMesh();
      await engine.loadLowPolyMesh(mesh);
      
      // Mock bakeBatch to return proper results
      const { rayTracer } = await import('../rayTracer');
      vi.mocked(rayTracer.bakeBatch).mockResolvedValue(
        new Map([
          ['ao', { width: 1024, height: 1024, data: new Uint8Array(1024 * 1024 * 4), timeMs: 100 }],
          ['curvature', { width: 1024, height: 1024, data: new Uint8Array(1024 * 1024 * 4), timeMs: 120 }],
        ])
      );
      
      // Act
      const bakedMaps = await engine.bakeBatch(['ao', 'curvature']);
      
      // Assert
      expect(bakedMaps.size).toBe(2);
      expect(bakedMaps.has('ao')).toBe(true);
      expect(bakedMaps.has('curvature')).toBe(true);
    });
    
    it('should call progress callback during batch bake', async () => {
      // Arrange
      const mesh = createTestMesh();
      await engine.loadLowPolyMesh(mesh);
      const progressCallback = vi.fn();
      
      // Mock bakeBatch
      const { rayTracer } = await import('../rayTracer');
      vi.mocked(rayTracer.bakeBatch).mockResolvedValue(
        new Map([
          ['ao', { width: 1024, height: 1024, data: new Uint8Array(1024 * 1024 * 4), timeMs: 100 }],
        ])
      );
      
      // Act
      await engine.bakeBatch(['ao'], progressCallback);
      
      // Assert
      expect(progressCallback).toHaveBeenCalled();
    });
  });
  
  // ─── Baked Map Management ───────────────────────────────────────────────────
  
  describe('Baked Map Management', () => {
    it('should retrieve baked map by type', async () => {
      // Arrange
      const mesh = createTestMesh();
      await engine.loadLowPolyMesh(mesh);
      await engine.bakeAOMap();
      
      // Act
      const bakedMap = engine.getBakedMap('ao');
      
      // Assert
      expect(bakedMap).not.toBeNull();
      expect(bakedMap?.type).toBe('ao');
    });
    
    it('should return null for non-existent map type', () => {
      // Act
      const bakedMap = engine.getBakedMap('normal');
      
      // Assert
      expect(bakedMap).toBeNull();
    });
    
    it('should clear all baked maps', async () => {
      // Arrange
      const mesh = createTestMesh();
      await engine.loadLowPolyMesh(mesh);
      await engine.bakeAOMap();
      await engine.bakeCurvatureMap();
      
      // Act
      engine.clearBakedMaps();
      
      // Assert
      expect(engine.getBakedMap('ao')).toBeNull();
      expect(engine.getBakedMap('curvature')).toBeNull();
    });
  });
  
  // ─── Preview Functionality (Requirement 12.7) ───────────────────────────────
  
  describe('Preview Functionality', () => {
    it('should preview baked map', async () => {
      // Arrange
      const mesh = createTestMesh();
      await engine.loadLowPolyMesh(mesh);
      await engine.bakeAOMap();
      
      // Act & Assert - should not throw
      engine.previewBakedMap('ao');
    });
    
    it('should handle preview of non-existent map', () => {
      // Act & Assert - should not throw
      engine.previewBakedMap('normal');
    });
    
    it('should clear preview', async () => {
      // Arrange
      const mesh = createTestMesh();
      await engine.loadLowPolyMesh(mesh);
      await engine.bakeAOMap();
      engine.previewBakedMap('ao');
      
      // Act & Assert - should not throw
      engine.clearPreview();
    });
  });
  
  // ─── Visibility Controls ─────────────────────────────────────────────────────
  
  describe('Visibility Controls', () => {
    it('should toggle cage visibility', async () => {
      // Arrange
      const mesh = createTestMesh();
      await engine.loadLowPolyMesh(mesh);
      await engine.generateCage();
      
      // Act & Assert - should not throw
      engine.setCageVisible(false);
      engine.setCageVisible(true);
    });
    
    it('should toggle high-poly visibility', async () => {
      // Arrange
      const mesh = createTestMesh();
      await engine.loadHighPolyMesh(mesh);
      
      // Act & Assert - should not throw
      engine.setHighPolyVisible(false);
      engine.setHighPolyVisible(true);
    });
    
    it('should toggle low-poly visibility', async () => {
      // Arrange
      const mesh = createTestMesh();
      await engine.loadLowPolyMesh(mesh);
      
      // Act & Assert - should not throw
      engine.setLowPolyVisible(false);
      engine.setLowPolyVisible(true);
    });
  });
  
  // ─── Cage Editing ────────────────────────────────────────────────────────────
  
  describe('Cage Editing', () => {
    it('should enable cage edit mode', async () => {
      // Arrange
      const mesh = createTestMesh();
      await engine.loadLowPolyMesh(mesh);
      await engine.generateCage();
      
      // Act
      engine.enableCageEditMode(true);
      
      // Assert
      expect(engine.isCageEditMode()).toBe(true);
    });
    
    it('should disable cage edit mode', () => {
      // Act
      engine.enableCageEditMode(false);
      
      // Assert
      expect(engine.isCageEditMode()).toBe(false);
    });
    
    it('should set cage edit mode type', () => {
      // Act & Assert - should not throw
      engine.setCageEditMode({ type: 'move' });
      engine.setCageEditMode({ type: 'scale' });
      engine.setCageEditMode({ type: 'smooth' });
    });
  });
  
  // ─── Cleanup ─────────────────────────────────────────────────────────────────
  
  describe('Cleanup', () => {
    it('should dispose resources properly', () => {
      // Act & Assert - should not throw
      engine.dispose();
    });
    
    it('should handle multiple dispose calls', () => {
      // Act & Assert - should not throw
      engine.dispose();
      engine.dispose();
    });
  });
});
