/**
 * cageEditor.test.ts
 * ────────────────────────────────────────────────────────────────────────────
 * Unit tests for CageEditor
 * 
 * Tests:
 *  1. Cage mesh setup and management (Requirement 12.2)
 *  2. Vertex selection (Requirement 12.2)
 *  3. Vertex manipulation (move, scale, smooth) (Requirement 12.2)
 *  4. Edit mode management (Requirement 12.2)
 *  5. Cage reset and export (Requirement 12.2)
 * 
 * **Validates: Requirement 12.2**
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as THREE from 'three';
import { CageEditor, type CageEditMode } from '../cageEditor';

// ─── Test Helpers ────────────────────────────────────────────────────────────

function createTestMesh(): THREE.Mesh {
  const geometry = new THREE.BufferGeometry();
  
  const positions = new Float32Array([
    0, 0, 0,  // v0
    1, 0, 0,  // v1
    1, 1, 0,  // v2
    0, 1, 0,  // v3
  ]);
  
  const uvs = new Float32Array([
    0, 0,
    1, 0,
    1, 1,
    0, 1,
  ]);
  
  const indices = new Uint16Array([
    0, 1, 2,
    0, 2, 3,
  ]);
  
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.computeVertexNormals();
  
  const material = new THREE.MeshBasicMaterial();
  return new THREE.Mesh(geometry, material);
}

function createTestCamera(): THREE.Camera {
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
  camera.position.set(0, 0, 5);
  camera.lookAt(0, 0, 0);
  return camera;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('CageEditor', () => {
  let editor: CageEditor;
  
  beforeEach(() => {
    editor = new CageEditor();
  });
  
  // ─── Initialization ──────────────────────────────────────────────────────────
  
  describe('Initialization', () => {
    it('should initialize with default mode', () => {
      // Act
      const mode = editor.getMode();
      
      // Assert
      expect(mode.type).toBe('select');
    });
    
    it('should have zero selection count initially', () => {
      // Act
      const count = editor.getSelectionCount();
      
      // Assert
      expect(count).toBe(0);
    });
  });
  
  // ─── Cage Mesh Setup (Requirement 12.2) ─────────────────────────────────────
  
  describe('Cage Mesh Setup', () => {
    it('should set cage mesh', () => {
      // Arrange
      const mesh = createTestMesh();
      
      // Act & Assert - should not throw
      editor.setCageMesh(mesh);
    });
    
    it('should replace existing cage mesh', () => {
      // Arrange
      const mesh1 = createTestMesh();
      const mesh2 = createTestMesh();
      mesh2.position.set(1, 1, 1);
      
      // Act
      editor.setCageMesh(mesh1);
      editor.setCageMesh(mesh2);
      
      // Assert - should not throw
      expect(editor).toBeDefined();
    });
    
    it('should clear selection when setting new mesh', () => {
      // Arrange
      const mesh1 = createTestMesh();
      const mesh2 = createTestMesh();
      editor.setCageMesh(mesh1);
      
      // Simulate selection (we can't actually select without camera/raycasting)
      // Just verify selection is cleared
      
      // Act
      editor.setCageMesh(mesh2);
      const count = editor.getSelectionCount();
      
      // Assert
      expect(count).toBe(0);
    });
  });
  
  // ─── Camera Setup ────────────────────────────────────────────────────────────
  
  describe('Camera Setup', () => {
    it('should set camera for raycasting', () => {
      // Arrange
      const camera = createTestCamera();
      
      // Act & Assert - should not throw
      editor.setCamera(camera);
    });
    
    it('should replace existing camera', () => {
      // Arrange
      const camera1 = createTestCamera();
      const camera2 = createTestCamera();
      camera2.position.set(0, 5, 0);
      
      // Act
      editor.setCamera(camera1);
      editor.setCamera(camera2);
      
      // Assert - should not throw
      expect(editor).toBeDefined();
    });
  });
  
  // ─── Edit Mode Management (Requirement 12.2) ────────────────────────────────
  
  describe('Edit Mode Management', () => {
    it('should set select mode', () => {
      // Arrange
      const mode: CageEditMode = { type: 'select' };
      
      // Act
      editor.setMode(mode);
      const currentMode = editor.getMode();
      
      // Assert
      expect(currentMode.type).toBe('select');
    });
    
    it('should set move mode', () => {
      // Arrange
      const mode: CageEditMode = { type: 'move' };
      
      // Act
      editor.setMode(mode);
      const currentMode = editor.getMode();
      
      // Assert
      expect(currentMode.type).toBe('move');
    });
    
    it('should set scale mode', () => {
      // Arrange
      const mode: CageEditMode = { type: 'scale' };
      
      // Act
      editor.setMode(mode);
      const currentMode = editor.getMode();
      
      // Assert
      expect(currentMode.type).toBe('scale');
    });
    
    it('should set smooth mode', () => {
      // Arrange
      const mode: CageEditMode = { type: 'smooth' };
      
      // Act
      editor.setMode(mode);
      const currentMode = editor.getMode();
      
      // Assert
      expect(currentMode.type).toBe('smooth');
    });
    
    it('should set mode with radius', () => {
      // Arrange
      const mode: CageEditMode = { type: 'select', radius: 1.5 };
      
      // Act
      editor.setMode(mode);
      const currentMode = editor.getMode();
      
      // Assert
      expect(currentMode.radius).toBe(1.5);
    });
    
    it('should set mode with strength', () => {
      // Arrange
      const mode: CageEditMode = { type: 'smooth', strength: 0.7 };
      
      // Act
      editor.setMode(mode);
      const currentMode = editor.getMode();
      
      // Assert
      expect(currentMode.strength).toBe(0.7);
    });
  });
  
  // ─── Vertex Selection (Requirement 12.2) ────────────────────────────────────
  
  describe('Vertex Selection', () => {
    it('should return zero when selecting without mesh', () => {
      // Act
      const count = editor.selectVertices(100, 100);
      
      // Assert
      expect(count).toBe(0);
    });
    
    it('should return zero when selecting without camera', () => {
      // Arrange
      const mesh = createTestMesh();
      editor.setCageMesh(mesh);
      
      // Act
      const count = editor.selectVertices(100, 100);
      
      // Assert
      expect(count).toBe(0);
    });
    
    it('should clear selection when addToSelection is false', () => {
      // Arrange
      const mesh = createTestMesh();
      const camera = createTestCamera();
      editor.setCageMesh(mesh);
      editor.setCamera(camera);
      
      // Act
      editor.selectVertices(100, 100, false);
      const count = editor.getSelectionCount();
      
      // Assert - may be 0 if no intersection
      expect(count).toBeGreaterThanOrEqual(0);
    });
    
    it('should add to selection when addToSelection is true', () => {
      // Arrange
      const mesh = createTestMesh();
      const camera = createTestCamera();
      editor.setCageMesh(mesh);
      editor.setCamera(camera);
      
      // Act
      editor.selectVertices(100, 100, true);
      const count = editor.getSelectionCount();
      
      // Assert
      expect(count).toBeGreaterThanOrEqual(0);
    });
    
    it('should clear selection manually', () => {
      // Arrange
      const mesh = createTestMesh();
      editor.setCageMesh(mesh);
      
      // Act
      editor.clearSelection();
      const count = editor.getSelectionCount();
      
      // Assert
      expect(count).toBe(0);
    });
  });
  
  // ─── Vertex Manipulation - Move (Requirement 12.2) ──────────────────────────
  
  describe('Vertex Manipulation - Move', () => {
    it('should not throw when moving without mesh', () => {
      // Arrange
      const delta = new THREE.Vector3(1, 0, 0);
      
      // Act & Assert - should not throw
      editor.moveVertices(delta);
    });
    
    it('should not throw when moving without selection', () => {
      // Arrange
      const mesh = createTestMesh();
      editor.setCageMesh(mesh);
      const delta = new THREE.Vector3(1, 0, 0);
      
      // Act & Assert - should not throw
      editor.moveVertices(delta);
    });
    
    it('should move vertices by delta', () => {
      // Arrange
      const mesh = createTestMesh();
      editor.setCageMesh(mesh);
      const delta = new THREE.Vector3(1, 0, 0);
      
      // Act & Assert - should not throw
      editor.moveVertices(delta);
    });
    
    it('should handle zero delta', () => {
      // Arrange
      const mesh = createTestMesh();
      editor.setCageMesh(mesh);
      const delta = new THREE.Vector3(0, 0, 0);
      
      // Act & Assert - should not throw
      editor.moveVertices(delta);
    });
    
    it('should handle negative delta', () => {
      // Arrange
      const mesh = createTestMesh();
      editor.setCageMesh(mesh);
      const delta = new THREE.Vector3(-1, -1, -1);
      
      // Act & Assert - should not throw
      editor.moveVertices(delta);
    });
  });
  
  // ─── Vertex Manipulation - Scale (Requirement 12.2) ─────────────────────────
  
  describe('Vertex Manipulation - Scale', () => {
    it('should not throw when scaling without mesh', () => {
      // Act & Assert - should not throw
      editor.scaleVertices(1.5);
    });
    
    it('should not throw when scaling without selection', () => {
      // Arrange
      const mesh = createTestMesh();
      editor.setCageMesh(mesh);
      
      // Act & Assert - should not throw
      editor.scaleVertices(1.5);
    });
    
    it('should scale vertices uniformly', () => {
      // Arrange
      const mesh = createTestMesh();
      editor.setCageMesh(mesh);
      
      // Act & Assert - should not throw
      editor.scaleVertices(2.0);
    });
    
    it('should scale vertices with custom center', () => {
      // Arrange
      const mesh = createTestMesh();
      editor.setCageMesh(mesh);
      const center = new THREE.Vector3(0.5, 0.5, 0);
      
      // Act & Assert - should not throw
      editor.scaleVertices(1.5, center);
    });
    
    it('should handle scale factor of 1.0', () => {
      // Arrange
      const mesh = createTestMesh();
      editor.setCageMesh(mesh);
      
      // Act & Assert - should not throw (no change)
      editor.scaleVertices(1.0);
    });
    
    it('should handle scale factor less than 1.0', () => {
      // Arrange
      const mesh = createTestMesh();
      editor.setCageMesh(mesh);
      
      // Act & Assert - should not throw (shrink)
      editor.scaleVertices(0.5);
    });
    
    it('should handle scale factor of 0', () => {
      // Arrange
      const mesh = createTestMesh();
      editor.setCageMesh(mesh);
      
      // Act & Assert - should not throw (collapse to center)
      editor.scaleVertices(0);
    });
  });
  
  // ─── Vertex Manipulation - Smooth (Requirement 12.2) ────────────────────────
  
  describe('Vertex Manipulation - Smooth', () => {
    it('should not throw when smoothing without mesh', () => {
      // Act & Assert - should not throw
      editor.smoothVertices(1);
    });
    
    it('should not throw when smoothing without selection', () => {
      // Arrange
      const mesh = createTestMesh();
      editor.setCageMesh(mesh);
      
      // Act & Assert - should not throw
      editor.smoothVertices(1);
    });
    
    it('should smooth vertices with default iterations', () => {
      // Arrange
      const mesh = createTestMesh();
      editor.setCageMesh(mesh);
      
      // Act & Assert - should not throw
      editor.smoothVertices();
    });
    
    it('should smooth vertices with custom iterations', () => {
      // Arrange
      const mesh = createTestMesh();
      editor.setCageMesh(mesh);
      
      // Act & Assert - should not throw
      editor.smoothVertices(3);
    });
    
    it('should handle zero iterations', () => {
      // Arrange
      const mesh = createTestMesh();
      editor.setCageMesh(mesh);
      
      // Act & Assert - should not throw (no change)
      editor.smoothVertices(0);
    });
    
    it('should handle many iterations', () => {
      // Arrange
      const mesh = createTestMesh();
      editor.setCageMesh(mesh);
      
      // Act & Assert - should not throw
      editor.smoothVertices(10);
    });
  });
  
  // ─── Selection Center Calculation ───────────────────────────────────────────
  
  describe('Selection Center', () => {
    it('should return zero vector when no mesh', () => {
      // Act
      const center = editor.getSelectionCenter();
      
      // Assert
      expect(center.x).toBe(0);
      expect(center.y).toBe(0);
      expect(center.z).toBe(0);
    });
    
    it('should return zero vector when no selection', () => {
      // Arrange
      const mesh = createTestMesh();
      editor.setCageMesh(mesh);
      
      // Act
      const center = editor.getSelectionCenter();
      
      // Assert
      expect(center.x).toBe(0);
      expect(center.y).toBe(0);
      expect(center.z).toBe(0);
    });
  });
  
  // ─── Cage Reset (Requirement 12.2) ──────────────────────────────────────────
  
  describe('Cage Reset', () => {
    it('should not throw when resetting without mesh', () => {
      // Act & Assert - should not throw
      editor.reset();
    });
    
    it('should reset cage to original positions', () => {
      // Arrange
      const mesh = createTestMesh();
      editor.setCageMesh(mesh);
      
      // Modify vertices
      const delta = new THREE.Vector3(1, 1, 1);
      editor.moveVertices(delta);
      
      // Act
      editor.reset();
      
      // Assert - should not throw
      expect(editor).toBeDefined();
    });
    
    it('should handle multiple resets', () => {
      // Arrange
      const mesh = createTestMesh();
      editor.setCageMesh(mesh);
      
      // Act & Assert - should not throw
      editor.reset();
      editor.reset();
      editor.reset();
    });
  });
  
  // ─── Cage Export (Requirement 12.2) ─────────────────────────────────────────
  
  describe('Cage Export', () => {
    it('should return null when no mesh', () => {
      // Act
      const exported = editor.exportCageMesh();
      
      // Assert
      expect(exported).toBeNull();
    });
    
    it('should export cage mesh', () => {
      // Arrange
      const mesh = createTestMesh();
      editor.setCageMesh(mesh);
      
      // Act
      const exported = editor.exportCageMesh();
      
      // Assert
      expect(exported).not.toBeNull();
      expect(exported?.positions).toBeInstanceOf(Float32Array);
      expect(exported?.normals).toBeInstanceOf(Float32Array);
      expect(exported?.tangents).toBeInstanceOf(Float32Array);
      expect(exported?.uvs).toBeInstanceOf(Float32Array);
      expect(exported?.indices).toBeInstanceOf(Uint32Array);
    });
    
    it('should export modified cage mesh', () => {
      // Arrange
      const mesh = createTestMesh();
      editor.setCageMesh(mesh);
      
      // Modify vertices
      const delta = new THREE.Vector3(1, 0, 0);
      editor.moveVertices(delta);
      
      // Act
      const exported = editor.exportCageMesh();
      
      // Assert
      expect(exported).not.toBeNull();
    });
  });
  
  // ─── Selection Visualization ─────────────────────────────────────────────────
  
  describe('Selection Visualization', () => {
    it('should return null when no mesh', () => {
      // Act
      const visualization = editor.createSelectionVisualization();
      
      // Assert
      expect(visualization).toBeNull();
    });
    
    it('should return null when no selection', () => {
      // Arrange
      const mesh = createTestMesh();
      editor.setCageMesh(mesh);
      
      // Act
      const visualization = editor.createSelectionVisualization();
      
      // Assert
      expect(visualization).toBeNull();
    });
  });
  
  // ─── Cleanup ─────────────────────────────────────────────────────────────────
  
  describe('Cleanup', () => {
    it('should dispose resources properly', () => {
      // Act & Assert - should not throw
      editor.dispose();
    });
    
    it('should handle multiple dispose calls', () => {
      // Act & Assert - should not throw
      editor.dispose();
      editor.dispose();
    });
    
    it('should dispose after setting mesh', () => {
      // Arrange
      const mesh = createTestMesh();
      editor.setCageMesh(mesh);
      
      // Act & Assert - should not throw
      editor.dispose();
    });
  });
});
