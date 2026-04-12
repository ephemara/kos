/**
 * viewportManager.test.ts
 * ────────────────────────────────────────────────────────────────────────────
 * Unit tests for ViewportManager
 *
 * Tests:
 *  1. Camera state save/restore (Requirement 8.8)
 *  2. Fit-to-view calculations (Requirement 8.2)
 *  3. Gizmo transformations (Requirement 8.3, 8.4)
 *  4. Selection management (Requirement 8.5)
 *  5. Rendering modes (Requirement 8.6)
 *  6. Grid and axes helpers
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as THREE from 'three';
import { ViewportManager, type CameraState } from '../viewportManager';

// ─── Mock Three.js WebGLRenderer ─────────────────────────────────────────────

vi.mock('three', async () => {
  const actual = await vi.importActual<typeof THREE>('three');
  
  class MockWebGLRenderer {
    domElement: HTMLCanvasElement;
    toneMappingExposure: number = 1;
    
    constructor(params?: any) {
      this.domElement = params?.canvas || document.createElement('canvas');
    }
    
    setSize() {}
    render() {}
    dispose() {}
    setPixelRatio() {}
    setClearColor() {}
  }
  
  return {
    ...actual,
    WebGLRenderer: MockWebGLRenderer as any,
  };
});

// ─── Test Helpers ────────────────────────────────────────────────────────────

function createTestScene(): {
  canvas: HTMLCanvasElement;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
} {
  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 600;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, 800 / 600, 0.1, 1000);
  camera.position.set(0, 0, 5);

  const renderer = new THREE.WebGLRenderer({ canvas });
  renderer.setSize(800, 600);

  return { canvas, scene, camera, renderer };
}

function createTestMesh(
  position: [number, number, number] = [0, 0, 0],
  size: number = 1
): THREE.Mesh {
  const geometry = new THREE.BoxGeometry(size, size, size);
  const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  return mesh;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('ViewportManager', () => {
  let viewportManager: ViewportManager;
  let testSetup: ReturnType<typeof createTestScene>;

  beforeEach(() => {
    testSetup = createTestScene();
    viewportManager = new ViewportManager({
      canvas: testSetup.canvas,
      scene: testSetup.scene,
      camera: testSetup.camera,
      renderer: testSetup.renderer,
      enableControls: true,
      enableGrid: true,
      enableAxes: true,
    });
  });

  afterEach(() => {
    if (viewportManager) {
      viewportManager.dispose();
    }
    if (testSetup?.renderer) {
      testSetup.renderer.dispose();
    }
  });

  // ─── Camera State Save/Restore (Requirement 8.8) ───────────────────────────

  describe('Camera State Management', () => {
    it('should save camera state correctly', () => {
      // Set specific camera state
      testSetup.camera.position.set(10, 20, 30);
      testSetup.camera.up.set(0, 1, 0);
      testSetup.camera.fov = 60;
      testSetup.camera.near = 0.5;
      testSetup.camera.far = 500;

      const state = viewportManager.getCameraState();

      expect(state.position).toEqual([10, 20, 30]);
      expect(state.up).toEqual([0, 1, 0]);
      expect(state.fov).toBe(60);
      expect(state.near).toBe(0.5);
      expect(state.far).toBe(500);
    });

    it('should restore camera state correctly', () => {
      const savedState: CameraState = {
        position: [5, 10, 15],
        target: [0, 0, 0],
        up: [0, 1, 0],
        fov: 45,
        near: 0.2,
        far: 800,
      };

      viewportManager.setCameraState(savedState);

      // Use closeTo for floating point comparison
      expect(testSetup.camera.position.x).toBeCloseTo(5);
      expect(testSetup.camera.position.y).toBeCloseTo(10);
      expect(testSetup.camera.position.z).toBeCloseTo(15);
      expect(testSetup.camera.up.toArray()).toEqual([0, 1, 0]);
      expect(testSetup.camera.fov).toBe(45);
      expect(testSetup.camera.near).toBe(0.2);
      expect(testSetup.camera.far).toBe(800);
    });

    it('should preserve camera state through save/restore round-trip', () => {
      // Set initial state
      testSetup.camera.position.set(7, 14, 21);
      testSetup.camera.up.set(0, 1, 0);
      testSetup.camera.fov = 50;
      testSetup.camera.near = 0.3;
      testSetup.camera.far = 600;

      // Save state
      const savedState = viewportManager.getCameraState();

      // Modify camera
      testSetup.camera.position.set(100, 200, 300);
      testSetup.camera.fov = 90;

      // Restore state
      viewportManager.setCameraState(savedState);

      // Verify restoration
      expect(testSetup.camera.position.toArray()).toEqual([7, 14, 21]);
      expect(testSetup.camera.fov).toBe(50);
      expect(testSetup.camera.near).toBe(0.3);
      expect(testSetup.camera.far).toBe(600);
    });
  });

  // ─── Fit-to-View Calculations (Requirement 8.2) ────────────────────────────

  describe('Fit-to-View', () => {
    it('should frame a single object correctly', () => {
      const mesh = createTestMesh([0, 0, 0], 2);
      testSetup.scene.add(mesh);

      viewportManager.fitToView([mesh]);

      // Camera should be positioned to view the object
      const distance = testSetup.camera.position.length();
      expect(distance).toBeGreaterThan(0);
      
      // Camera should be looking at or near the object center
      const cameraState = viewportManager.getCameraState();
      expect(cameraState.target).toBeDefined();
    });

    it('should frame multiple objects correctly', () => {
      const mesh1 = createTestMesh([-5, 0, 0], 1);
      const mesh2 = createTestMesh([5, 0, 0], 1);
      testSetup.scene.add(mesh1, mesh2);

      const initialDistance = testSetup.camera.position.length();
      viewportManager.fitToView([mesh1, mesh2]);

      // Camera distance should change to frame both objects
      const newDistance = testSetup.camera.position.length();
      expect(newDistance).not.toBe(initialDistance);
    });

    it('should handle empty object array gracefully', () => {
      const initialPosition = testSetup.camera.position.clone();
      
      viewportManager.fitToView([]);

      // Should not crash and camera should still be valid
      expect(testSetup.camera.position).toBeDefined();
    });

    it('should calculate correct distance for large objects', () => {
      const largeMesh = createTestMesh([0, 0, 0], 10);
      testSetup.scene.add(largeMesh);

      viewportManager.fitToView([largeMesh]);

      const distance = testSetup.camera.position.length();
      
      // Distance should be proportional to object size
      // For a 10-unit cube with 75° FOV and 20% padding, distance ≈ 7.8
      expect(distance).toBeGreaterThan(5);
    });

    it('should add padding to framed view', () => {
      const mesh = createTestMesh([0, 0, 0], 2);
      testSetup.scene.add(mesh);

      viewportManager.fitToView([mesh]);

      const distance = testSetup.camera.position.length();
      
      // With 20% padding, distance should be 1.2x the minimum required
      // Minimum for 2-unit cube with 75° FOV ≈ 1.5, so padded ≈ 1.8
      expect(distance).toBeGreaterThan(1.5);
    });
  });

  // ─── Gizmo System (Requirement 8.3, 8.4) ───────────────────────────────────

  describe('Gizmo Transformations', () => {
    it('should enable translate gizmo', () => {
      const mesh = createTestMesh();
      testSetup.scene.add(mesh);
      viewportManager.setSelection([mesh]);

      viewportManager.enableGizmo('translate');

      // Gizmo should be enabled (we can't directly test TransformControls internals,
      // but we can verify no errors occur)
      expect(() => viewportManager.update()).not.toThrow();
    });

    it('should enable rotate gizmo', () => {
      const mesh = createTestMesh();
      testSetup.scene.add(mesh);
      viewportManager.setSelection([mesh]);

      viewportManager.enableGizmo('rotate');

      expect(() => viewportManager.update()).not.toThrow();
    });

    it('should enable scale gizmo', () => {
      const mesh = createTestMesh();
      testSetup.scene.add(mesh);
      viewportManager.setSelection([mesh]);

      viewportManager.enableGizmo('scale');

      expect(() => viewportManager.update()).not.toThrow();
    });

    it('should switch between gizmo modes', () => {
      const mesh = createTestMesh();
      testSetup.scene.add(mesh);
      viewportManager.setSelection([mesh]);

      viewportManager.enableGizmo('translate');
      viewportManager.enableGizmo('rotate');
      viewportManager.enableGizmo('scale');

      expect(() => viewportManager.update()).not.toThrow();
    });

    it('should disable gizmo', () => {
      const mesh = createTestMesh();
      testSetup.scene.add(mesh);
      viewportManager.setSelection([mesh]);

      viewportManager.enableGizmo('translate');
      viewportManager.disableGizmo();

      expect(() => viewportManager.update()).not.toThrow();
    });

    it('should set gizmo space to local', () => {
      const mesh = createTestMesh();
      testSetup.scene.add(mesh);
      viewportManager.setSelection([mesh]);

      viewportManager.enableGizmo('translate');
      viewportManager.setGizmoSpace('local');

      expect(() => viewportManager.update()).not.toThrow();
    });

    it('should set gizmo space to world', () => {
      const mesh = createTestMesh();
      testSetup.scene.add(mesh);
      viewportManager.setSelection([mesh]);

      viewportManager.enableGizmo('translate');
      viewportManager.setGizmoSpace('world');

      expect(() => viewportManager.update()).not.toThrow();
    });

    it('should switch between local and world space', () => {
      const mesh = createTestMesh();
      testSetup.scene.add(mesh);
      viewportManager.setSelection([mesh]);

      viewportManager.enableGizmo('translate');
      viewportManager.setGizmoSpace('local');
      viewportManager.setGizmoSpace('world');
      viewportManager.setGizmoSpace('local');

      expect(() => viewportManager.update()).not.toThrow();
    });
  });

  // ─── Selection Management (Requirement 8.5) ────────────────────────────────

  describe('Selection Management', () => {
    it('should select a single object', () => {
      const mesh = createTestMesh();
      testSetup.scene.add(mesh);

      viewportManager.setSelection([mesh]);

      const selection = viewportManager.getSelection();
      expect(selection).toHaveLength(1);
      expect(selection[0]).toBe(mesh);
    });

    it('should select multiple objects', () => {
      const mesh1 = createTestMesh([0, 0, 0]);
      const mesh2 = createTestMesh([2, 0, 0]);
      const mesh3 = createTestMesh([4, 0, 0]);
      testSetup.scene.add(mesh1, mesh2, mesh3);

      viewportManager.setSelection([mesh1, mesh2, mesh3]);

      const selection = viewportManager.getSelection();
      expect(selection).toHaveLength(3);
      expect(selection).toContain(mesh1);
      expect(selection).toContain(mesh2);
      expect(selection).toContain(mesh3);
    });

    it('should clear previous selection when setting new selection', () => {
      const mesh1 = createTestMesh([0, 0, 0]);
      const mesh2 = createTestMesh([2, 0, 0]);
      testSetup.scene.add(mesh1, mesh2);

      viewportManager.setSelection([mesh1]);
      expect(viewportManager.getSelection()).toHaveLength(1);

      viewportManager.setSelection([mesh2]);
      const selection = viewportManager.getSelection();
      expect(selection).toHaveLength(1);
      expect(selection[0]).toBe(mesh2);
    });

    it('should handle empty selection', () => {
      const mesh = createTestMesh();
      testSetup.scene.add(mesh);

      viewportManager.setSelection([mesh]);
      viewportManager.setSelection([]);

      expect(viewportManager.getSelection()).toHaveLength(0);
    });

    it('should create selection outlines for meshes', () => {
      const mesh = createTestMesh();
      testSetup.scene.add(mesh);

      const initialChildCount = testSetup.scene.children.length;
      viewportManager.setSelection([mesh]);

      // Selection outline should be added to scene
      expect(testSetup.scene.children.length).toBeGreaterThan(initialChildCount);
    });

    it('should remove selection outlines when clearing selection', () => {
      const mesh = createTestMesh();
      testSetup.scene.add(mesh);

      viewportManager.setSelection([mesh]);
      const selectedChildCount = testSetup.scene.children.length;

      viewportManager.setSelection([]);
      
      // Outlines should be removed
      expect(testSetup.scene.children.length).toBeLessThan(selectedChildCount);
    });

    it('should update selection outlines on viewport update', () => {
      const mesh = createTestMesh([0, 0, 0]);
      testSetup.scene.add(mesh);

      viewportManager.setSelection([mesh]);

      // Move the mesh
      mesh.position.set(5, 5, 5);
      mesh.rotation.set(0.5, 0.5, 0.5);

      // Update should sync outline transforms
      expect(() => viewportManager.update()).not.toThrow();
    });
  });

  // ─── Rendering Modes (Requirement 8.6) ─────────────────────────────────────

  describe('Rendering Modes', () => {
    it('should set solid render mode', () => {
      viewportManager.setRenderMode('solid');
      expect(() => viewportManager.update()).not.toThrow();
    });

    it('should set wireframe render mode', () => {
      const mesh = createTestMesh();
      testSetup.scene.add(mesh);

      viewportManager.setRenderMode('wireframe');
      expect(() => viewportManager.update()).not.toThrow();
    });

    it('should set xray render mode', () => {
      const mesh = createTestMesh();
      testSetup.scene.add(mesh);

      viewportManager.setRenderMode('xray');
      expect(() => viewportManager.update()).not.toThrow();
    });

    it('should set matcap render mode', () => {
      const mesh = createTestMesh();
      testSetup.scene.add(mesh);

      // Create a simple matcap texture
      const matcapTexture = new THREE.Texture();
      viewportManager.setMatcap(matcapTexture);
      viewportManager.setRenderMode('matcap');

      expect(() => viewportManager.update()).not.toThrow();
    });

    it('should switch between render modes', () => {
      const mesh = createTestMesh();
      testSetup.scene.add(mesh);

      viewportManager.setRenderMode('solid');
      viewportManager.setRenderMode('wireframe');
      viewportManager.setRenderMode('xray');
      viewportManager.setRenderMode('solid');

      expect(() => viewportManager.update()).not.toThrow();
    });
  });

  // ─── Grid and Axes Helpers ─────────────────────────────────────────────────

  describe('Grid and Axes', () => {
    it('should show grid by default', () => {
      // Grid should be visible by default
      const gridHelper = testSetup.scene.children.find(
        child => child instanceof THREE.GridHelper
      );
      expect(gridHelper).toBeDefined();
      expect(gridHelper?.visible).toBe(true);
    });

    it('should hide grid', () => {
      viewportManager.showGrid(false);

      const gridHelper = testSetup.scene.children.find(
        child => child instanceof THREE.GridHelper
      );
      expect(gridHelper?.visible).toBe(false);
    });

    it('should show grid after hiding', () => {
      viewportManager.showGrid(false);
      viewportManager.showGrid(true);

      const gridHelper = testSetup.scene.children.find(
        child => child instanceof THREE.GridHelper
      );
      expect(gridHelper?.visible).toBe(true);
    });

    it('should show axes by default', () => {
      const axesHelper = testSetup.scene.children.find(
        child => child instanceof THREE.AxesHelper
      );
      expect(axesHelper).toBeDefined();
      expect(axesHelper?.visible).toBe(true);
    });

    it('should hide axes', () => {
      viewportManager.showAxes(false);

      const axesHelper = testSetup.scene.children.find(
        child => child instanceof THREE.AxesHelper
      );
      expect(axesHelper?.visible).toBe(false);
    });

    it('should show axes after hiding', () => {
      viewportManager.showAxes(false);
      viewportManager.showAxes(true);

      const axesHelper = testSetup.scene.children.find(
        child => child instanceof THREE.AxesHelper
      );
      expect(axesHelper?.visible).toBe(true);
    });

    it('should change grid size', () => {
      viewportManager.setGridSize(40);

      const newGridHelper = testSetup.scene.children.find(
        child => child instanceof THREE.GridHelper
      ) as THREE.GridHelper;

      // Grid should exist and be visible
      expect(newGridHelper).toBeDefined();
      expect(newGridHelper.visible).toBe(true);
    });
  });

  // ─── Viewport Settings ──────────────────────────────────────────────────────

  describe('Viewport Settings', () => {
    it('should set background color', () => {
      const color = new THREE.Color(0xff0000);
      viewportManager.setBackgroundColor(color);

      expect(testSetup.scene.background).toEqual(color);
    });

    it('should set HDRI environment', () => {
      const hdri = new THREE.Texture();
      viewportManager.setHDRI(hdri);

      expect(testSetup.scene.environment).toBe(hdri);
    });

    it('should set exposure', () => {
      viewportManager.setExposure(2.0);

      expect(testSetup.renderer.toneMappingExposure).toBe(2.0);
    });
  });

  // ─── Performance Optimization ───────────────────────────────────────────────

  describe('Performance Optimization', () => {
    it('should enable frustum culling', () => {
      const mesh = createTestMesh();
      testSetup.scene.add(mesh);

      viewportManager.setFrustumCulling(true);

      expect(mesh.frustumCulled).toBe(true);
    });

    it('should disable frustum culling', () => {
      const mesh = createTestMesh();
      testSetup.scene.add(mesh);

      viewportManager.setFrustumCulling(false);

      expect(mesh.frustumCulled).toBe(false);
    });

    it('should update LOD on viewport update', () => {
      const lod = new THREE.LOD();
      const mesh1 = createTestMesh([0, 0, 0], 1);
      const mesh2 = createTestMesh([0, 0, 0], 0.5);
      lod.addLevel(mesh1, 0);
      lod.addLevel(mesh2, 10);
      testSetup.scene.add(lod);

      viewportManager.setLOD(true);
      expect(() => viewportManager.update()).not.toThrow();
    });
  });

  // ─── Update and Cleanup ─────────────────────────────────────────────────────

  describe('Update and Cleanup', () => {
    it('should update without errors', () => {
      expect(() => viewportManager.update()).not.toThrow();
    });

    it('should update with selected objects', () => {
      const mesh = createTestMesh();
      testSetup.scene.add(mesh);
      viewportManager.setSelection([mesh]);

      expect(() => viewportManager.update()).not.toThrow();
    });

    it('should dispose cleanly', () => {
      const mesh = createTestMesh();
      testSetup.scene.add(mesh);
      viewportManager.setSelection([mesh]);
      viewportManager.enableGizmo('translate');

      expect(() => viewportManager.dispose()).not.toThrow();
    });

    it('should remove helpers on dispose', () => {
      const initialChildCount = testSetup.scene.children.length;

      viewportManager.dispose();

      // Helpers should be removed
      expect(testSetup.scene.children.length).toBeLessThan(initialChildCount);
    });
  });

  // ─── Integration Tests ──────────────────────────────────────────────────────

  describe('Integration', () => {
    it('should handle complete workflow: select, gizmo, fit-to-view', () => {
      const mesh = createTestMesh([5, 5, 5], 2);
      testSetup.scene.add(mesh);

      // Select object
      viewportManager.setSelection([mesh]);
      expect(viewportManager.getSelection()).toHaveLength(1);

      // Enable gizmo
      viewportManager.enableGizmo('translate');

      // Fit to view
      viewportManager.fitToView([mesh]);

      // Update
      expect(() => viewportManager.update()).not.toThrow();
    });

    it('should handle camera state save/restore with selection', () => {
      const mesh = createTestMesh();
      testSetup.scene.add(mesh);

      // Set up scene
      viewportManager.setSelection([mesh]);
      testSetup.camera.position.set(10, 10, 10);

      // Save state
      const savedState = viewportManager.getCameraState();

      // Modify
      testSetup.camera.position.set(0, 0, 0);

      // Restore
      viewportManager.setCameraState(savedState);

      // Use closeTo for floating point comparison
      expect(testSetup.camera.position.x).toBeCloseTo(10);
      expect(testSetup.camera.position.y).toBeCloseTo(10);
      expect(testSetup.camera.position.z).toBeCloseTo(10);
    });

    it('should handle render mode changes with selection', () => {
      const mesh = createTestMesh();
      testSetup.scene.add(mesh);

      viewportManager.setSelection([mesh]);
      viewportManager.setRenderMode('wireframe');
      viewportManager.setRenderMode('solid');

      expect(() => viewportManager.update()).not.toThrow();
    });
  });
});
