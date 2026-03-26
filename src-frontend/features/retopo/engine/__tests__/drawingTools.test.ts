/**
 * drawingTools.test.ts
 * ────────────────────────────────────────────────────────────────────────────
 * Unit tests for DrawingTools
 * 
 * Tests:
 *  1. Quad drawing creates valid 4-vertex quads (Requirement 11.2)
 *  2. Quad strip mode creates connected quads (Requirement 11.3)
 *  3. Hole filling creates valid geometry (Requirement 11.2)
 *  4. Symmetry mirroring works correctly (Requirement 11.5)
 * 
 * **Validates: Requirements 11.2, 11.3, 11.5**
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as THREE from 'three';
import { DrawingTools } from '../drawingTools';

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

// ─── Test Helpers ────────────────────────────────────────────────────────────

function createTestScene(): {
  scene: THREE.Scene;
  camera: THREE.Camera;
} {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, 800 / 600, 0.1, 1000);
  camera.position.set(0, 0, 5);
  
  return { scene, camera };
}

function countQuads(meshes: THREE.Mesh[]): number {
  let quadCount = 0;
  
  meshes.forEach(mesh => {
    const index = mesh.geometry.getIndex();
    if (index) {
      // Each quad is 2 triangles = 6 indices
      quadCount += index.count / 6;
    }
  });
  
  return quadCount;
}

function getVertexCount(mesh: THREE.Mesh): number {
  const position = mesh.geometry.getAttribute('position');
  return position ? position.count : 0;
}

function getTriangleCount(mesh: THREE.Mesh): number {
  const index = mesh.geometry.getIndex();
  return index ? index.count / 3 : 0;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('DrawingTools', () => {
  let drawingTools: DrawingTools;
  let testSetup: ReturnType<typeof createTestScene>;
  
  beforeEach(() => {
    testSetup = createTestScene();
    drawingTools = new DrawingTools(testSetup.scene, testSetup.camera);
  });
  
  afterEach(() => {
    if (drawingTools) {
      drawingTools.dispose();
    }
  });
  
  // ─── Quad Drawing (Requirement 11.2) ────────────────────────────────────────
  
  describe('Quad Drawing Mode', () => {
    it('should create a valid quad from 4 points', () => {
      // Arrange
      drawingTools.setDrawMode('quad');
      
      const points = [
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(1, 0, 0),
        new THREE.Vector3(1, 1, 0),
        new THREE.Vector3(0, 1, 0),
      ];
      
      // Act
      points.forEach(point => drawingTools.addPoint(point));
      
      // Assert
      const createdMeshes = drawingTools.getCreatedMeshes();
      expect(createdMeshes.length).toBe(1);
      
      const mesh = createdMeshes[0];
      expect(getVertexCount(mesh)).toBe(4);
      expect(getTriangleCount(mesh)).toBe(2); // Quad = 2 triangles
    });
    
    it('should create quads with correct vertex positions', () => {
      // Arrange
      drawingTools.setDrawMode('quad');
      
      const points = [
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(2, 0, 0),
        new THREE.Vector3(2, 2, 0),
        new THREE.Vector3(0, 2, 0),
      ];
      
      // Act
      points.forEach(point => drawingTools.addPoint(point));
      
      // Assert
      const mesh = drawingTools.getCreatedMeshes()[0];
      const position = mesh.geometry.getAttribute('position');
      
      // Check first vertex
      expect(position.getX(0)).toBeCloseTo(0);
      expect(position.getY(0)).toBeCloseTo(0);
      expect(position.getZ(0)).toBeCloseTo(0);
      
      // Check second vertex
      expect(position.getX(1)).toBeCloseTo(2);
      expect(position.getY(1)).toBeCloseTo(0);
      expect(position.getZ(1)).toBeCloseTo(0);
    });
    
    it('should not create quad with less than 4 points', () => {
      // Arrange
      drawingTools.setDrawMode('quad');
      
      // Act
      drawingTools.addPoint(new THREE.Vector3(0, 0, 0));
      drawingTools.addPoint(new THREE.Vector3(1, 0, 0));
      drawingTools.addPoint(new THREE.Vector3(1, 1, 0));
      
      // Assert - should not create mesh yet
      expect(drawingTools.getCreatedMeshes().length).toBe(0);
    });
    
    it('should clear drawing state after creating quad', () => {
      // Arrange
      drawingTools.setDrawMode('quad');
      
      const points = [
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(1, 0, 0),
        new THREE.Vector3(1, 1, 0),
        new THREE.Vector3(0, 1, 0),
      ];
      
      // Act
      points.forEach(point => drawingTools.addPoint(point));
      
      // Add one more point - should start new quad
      drawingTools.addPoint(new THREE.Vector3(2, 0, 0));
      
      // Assert - still only 1 quad created
      expect(drawingTools.getCreatedMeshes().length).toBe(1);
    });
  });
  
  // ─── Quad Strip Mode (Requirement 11.3) ─────────────────────────────────────
  
  describe('Quad Strip Mode', () => {
    it('should create connected quads from point pairs', () => {
      // Arrange
      drawingTools.setDrawMode('strip');
      
      // Create 3 pairs = 2 quads
      const pairs = [
        [new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 0, 0)],
        [new THREE.Vector3(0, 1, 0), new THREE.Vector3(1, 1, 0)],
        [new THREE.Vector3(0, 2, 0), new THREE.Vector3(1, 2, 0)],
      ];
      
      // Act
      pairs.forEach(pair => {
        pair.forEach(point => drawingTools.addPoint(point));
      });
      
      // Assert - should create 2 quads (between 3 pairs)
      const createdMeshes = drawingTools.getCreatedMeshes();
      expect(countQuads(createdMeshes)).toBe(2);
    });
    
    it('should not create quad with only one pair', () => {
      // Arrange
      drawingTools.setDrawMode('strip');
      
      // Act - add only one pair
      drawingTools.addPoint(new THREE.Vector3(0, 0, 0));
      drawingTools.addPoint(new THREE.Vector3(1, 0, 0));
      
      // Assert - no quads created yet
      expect(drawingTools.getCreatedMeshes().length).toBe(0);
    });
    
    it('should create continuous strip of quads', () => {
      // Arrange
      drawingTools.setDrawMode('strip');
      
      // Create 4 pairs = 3 quads
      const pairs = [
        [new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 0, 0)],
        [new THREE.Vector3(0, 1, 0), new THREE.Vector3(1, 1, 0)],
        [new THREE.Vector3(0, 2, 0), new THREE.Vector3(1, 2, 0)],
        [new THREE.Vector3(0, 3, 0), new THREE.Vector3(1, 3, 0)],
      ];
      
      // Act
      pairs.forEach(pair => {
        pair.forEach(point => drawingTools.addPoint(point));
      });
      
      // Assert
      expect(countQuads(drawingTools.getCreatedMeshes())).toBe(3);
    });
  });
  
  // ─── Hole Filling (Requirement 11.2) ────────────────────────────────────────
  
  describe('Hole Filling Mode', () => {
    it('should fill hole with triangular fan from boundary points', () => {
      // Arrange
      drawingTools.setDrawMode('fill');
      
      // Create a pentagonal hole
      const boundaryPoints = [
        new THREE.Vector3(1, 0, 0),
        new THREE.Vector3(0.31, 0.95, 0),
        new THREE.Vector3(-0.81, 0.59, 0),
        new THREE.Vector3(-0.81, -0.59, 0),
        new THREE.Vector3(0.31, -0.95, 0),
      ];
      
      // Act
      boundaryPoints.forEach(point => drawingTools.addPoint(point));
      drawingTools.completeFill();
      
      // Assert
      const createdMeshes = drawingTools.getCreatedMeshes();
      expect(createdMeshes.length).toBe(1);
      
      const mesh = createdMeshes[0];
      // Should create 5 triangles for pentagon (fan from centroid)
      expect(getTriangleCount(mesh)).toBe(5);
    });
    
    it('should not fill hole with less than 3 points', () => {
      // Arrange
      drawingTools.setDrawMode('fill');
      
      // Act
      drawingTools.addPoint(new THREE.Vector3(0, 0, 0));
      drawingTools.addPoint(new THREE.Vector3(1, 0, 0));
      drawingTools.completeFill();
      
      // Assert - should not create mesh
      expect(drawingTools.getCreatedMeshes().length).toBe(0);
    });
    
    it('should create valid geometry for triangular hole', () => {
      // Arrange
      drawingTools.setDrawMode('fill');
      
      const triangle = [
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(1, 0, 0),
        new THREE.Vector3(0.5, 1, 0),
      ];
      
      // Act
      triangle.forEach(point => drawingTools.addPoint(point));
      drawingTools.completeFill();
      
      // Assert
      const mesh = drawingTools.getCreatedMeshes()[0];
      expect(getTriangleCount(mesh)).toBe(3); // 3 triangles from centroid
    });
  });
  
  // ─── Symmetry Mirroring (Requirement 11.5) ──────────────────────────────────
  
  describe('Symmetry Mirroring', () => {
    it('should create mirrored quad when X symmetry is enabled', () => {
      // Arrange
      drawingTools.setDrawMode('quad');
      drawingTools.enableSymmetry('x');
      
      const points = [
        new THREE.Vector3(1, 0, 0),
        new THREE.Vector3(2, 0, 0),
        new THREE.Vector3(2, 1, 0),
        new THREE.Vector3(1, 1, 0),
      ];
      
      // Act
      points.forEach(point => drawingTools.addPoint(point));
      
      // Assert - should create 2 quads (original + mirrored)
      const createdMeshes = drawingTools.getCreatedMeshes();
      expect(createdMeshes.length).toBe(2);
    });
    
    it('should mirror across Y axis correctly', () => {
      // Arrange
      drawingTools.setDrawMode('quad');
      drawingTools.enableSymmetry('y');
      
      const points = [
        new THREE.Vector3(0, 1, 0),
        new THREE.Vector3(1, 1, 0),
        new THREE.Vector3(1, 2, 0),
        new THREE.Vector3(0, 2, 0),
      ];
      
      // Act
      points.forEach(point => drawingTools.addPoint(point));
      
      // Assert
      expect(drawingTools.getCreatedMeshes().length).toBe(2);
    });
    
    it('should mirror across Z axis correctly', () => {
      // Arrange
      drawingTools.setDrawMode('quad');
      drawingTools.enableSymmetry('z');
      
      const points = [
        new THREE.Vector3(0, 0, 1),
        new THREE.Vector3(1, 0, 1),
        new THREE.Vector3(1, 1, 1),
        new THREE.Vector3(0, 1, 1),
      ];
      
      // Act
      points.forEach(point => drawingTools.addPoint(point));
      
      // Assert
      expect(drawingTools.getCreatedMeshes().length).toBe(2);
    });
    
    it('should not create mirrored geometry when symmetry is disabled', () => {
      // Arrange
      drawingTools.setDrawMode('quad');
      drawingTools.enableSymmetry('x');
      drawingTools.disableSymmetry();
      
      const points = [
        new THREE.Vector3(1, 0, 0),
        new THREE.Vector3(2, 0, 0),
        new THREE.Vector3(2, 1, 0),
        new THREE.Vector3(1, 1, 0),
      ];
      
      // Act
      points.forEach(point => drawingTools.addPoint(point));
      
      // Assert - only 1 quad (no mirror)
      expect(drawingTools.getCreatedMeshes().length).toBe(1);
    });
  });
  
  // ─── Mode Switching ──────────────────────────────────────────────────────────
  
  describe('Mode Switching', () => {
    it('should clear drawing state when switching modes', () => {
      // Arrange
      drawingTools.setDrawMode('quad');
      drawingTools.addPoint(new THREE.Vector3(0, 0, 0));
      drawingTools.addPoint(new THREE.Vector3(1, 0, 0));
      
      // Act
      drawingTools.setDrawMode('strip');
      drawingTools.addPoint(new THREE.Vector3(0, 0, 0));
      drawingTools.addPoint(new THREE.Vector3(1, 0, 0));
      
      // Assert - should not have created any quads
      expect(drawingTools.getCreatedMeshes().length).toBe(0);
    });
  });
  
  // ─── Cleanup ─────────────────────────────────────────────────────────────────
  
  describe('Cleanup', () => {
    it('should clear all created meshes', () => {
      // Arrange
      drawingTools.setDrawMode('quad');
      
      // Create multiple quads
      for (let i = 0; i < 3; i++) {
        const points = [
          new THREE.Vector3(i, 0, 0),
          new THREE.Vector3(i + 1, 0, 0),
          new THREE.Vector3(i + 1, 1, 0),
          new THREE.Vector3(i, 1, 0),
        ];
        points.forEach(point => drawingTools.addPoint(point));
      }
      
      expect(drawingTools.getCreatedMeshes().length).toBe(3);
      
      // Act
      drawingTools.clearAll();
      
      // Assert
      expect(drawingTools.getCreatedMeshes().length).toBe(0);
    });
  });
});
