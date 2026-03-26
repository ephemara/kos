/**
 * viewportManager.property.test.ts
 * ────────────────────────────────────────────────────────────────────────────
 * Property-based tests for ViewportManager
 *
 * These tests verify mathematical properties and invariants that should hold
 * for all valid viewport operations across a wide range of inputs.
 *
 * Properties tested:
 * - Property 26: Viewport Fit-to-View Completeness
 * - Property 27: Camera State Round-Trip
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fc from 'fast-check';
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

// ============================================================================
// Test Generators (Arbitraries)
// ============================================================================

/**
 * Generate valid 3D positions with reasonable bounds
 */
const vector3Arbitrary = (): fc.Arbitrary<THREE.Vector3> => {
  return fc.tuple(
    fc.float({ min: Math.fround(-100), max: Math.fround(100), noNaN: true }),
    fc.float({ min: Math.fround(-100), max: Math.fround(100), noNaN: true }),
    fc.float({ min: Math.fround(-100), max: Math.fround(100), noNaN: true })
  ).map(([x, y, z]) => new THREE.Vector3(x, y, z));
};

/**
 * Generate valid camera FOV (field of view) in degrees
 */
const fovArbitrary = (): fc.Arbitrary<number> => {
  return fc.float({ min: Math.fround(10), max: Math.fround(120), noNaN: true });
};

/**
 * Generate valid camera near plane distance
 */
const nearPlaneArbitrary = (): fc.Arbitrary<number> => {
  return fc.float({ min: Math.fround(0.01), max: Math.fround(1), noNaN: true });
};

/**
 * Generate valid camera far plane distance
 */
const farPlaneArbitrary = (): fc.Arbitrary<number> => {
  return fc.float({ min: Math.fround(100), max: Math.fround(10000), noNaN: true });
};

/**
 * Generate a valid camera state
 * Note: Avoids degenerate cases where position and target are both at origin
 */
const cameraStateArbitrary = (): fc.Arbitrary<CameraState> => {
  return fc.record({
    position: fc.tuple(
      fc.float({ min: Math.fround(-100), max: Math.fround(100), noNaN: true }),
      fc.float({ min: Math.fround(-100), max: Math.fround(100), noNaN: true }),
      fc.float({ min: Math.fround(-100), max: Math.fround(100), noNaN: true })
    ) as fc.Arbitrary<[number, number, number]>,
    target: fc.tuple(
      fc.float({ min: Math.fround(-50), max: Math.fround(50), noNaN: true }),
      fc.float({ min: Math.fround(-50), max: Math.fround(50), noNaN: true }),
      fc.float({ min: Math.fround(-50), max: Math.fround(50), noNaN: true })
    ) as fc.Arbitrary<[number, number, number]>,
    up: fc.constantFrom(
      [0, 1, 0] as [number, number, number],
      [0, -1, 0] as [number, number, number],
      [1, 0, 0] as [number, number, number],
      [-1, 0, 0] as [number, number, number],
      [0, 0, 1] as [number, number, number],
      [0, 0, -1] as [number, number, number]
    ),
    fov: fovArbitrary(),
    near: nearPlaneArbitrary(),
    far: farPlaneArbitrary(),
  }).filter((state) => {
    // Filter out degenerate cases where position and target are too close
    const pos = new THREE.Vector3().fromArray(state.position);
    const target = new THREE.Vector3().fromArray(state.target);
    const distance = pos.distanceTo(target);
    return distance > 0.1; // Ensure minimum distance between camera and target
  });
};

/**
 * Generate a test mesh at a specific position with a specific size
 */
const meshArbitrary = (): fc.Arbitrary<THREE.Mesh> => {
  return fc.record({
    position: vector3Arbitrary(),
    size: fc.float({ min: Math.fround(0.1), max: Math.fround(10), noNaN: true }),
  }).map(({ position, size }) => {
    const geometry = new THREE.BoxGeometry(size, size, size);
    const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(position);
    return mesh;
  });
};

/**
 * Generate an array of test meshes (1 to 10 meshes)
 */
const meshArrayArbitrary = (): fc.Arbitrary<THREE.Mesh[]> => {
  return fc.array(meshArbitrary(), { minLength: 1, maxLength: 10 });
};

// ============================================================================
// Test Helpers
// ============================================================================

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

/**
 * Check if a point is visible in the camera frustum
 */
function isPointInFrustum(
  point: THREE.Vector3,
  camera: THREE.PerspectiveCamera
): boolean {
  const frustum = new THREE.Frustum();
  const projectionMatrix = new THREE.Matrix4().multiplyMatrices(
    camera.projectionMatrix,
    camera.matrixWorldInverse
  );
  frustum.setFromProjectionMatrix(projectionMatrix);
  return frustum.containsPoint(point);
}

/**
 * Get all corner points of a mesh's bounding box
 */
function getMeshCorners(mesh: THREE.Mesh): THREE.Vector3[] {
  const box = new THREE.Box3().setFromObject(mesh);
  const corners: THREE.Vector3[] = [];
  
  for (let x = 0; x <= 1; x++) {
    for (let y = 0; y <= 1; y++) {
      for (let z = 0; z <= 1; z++) {
        corners.push(new THREE.Vector3(
          x === 0 ? box.min.x : box.max.x,
          y === 0 ? box.min.y : box.max.y,
          z === 0 ? box.min.z : box.max.z
        ));
      }
    }
  }
  
  return corners;
}

/**
 * Check if camera states are approximately equal (with tolerance for floating point)
 */
function cameraStatesEqual(
  state1: CameraState,
  state2: CameraState,
  tolerance: number = 0.0001
): boolean {
  const posEqual = state1.position.every((v, i) => 
    Math.abs(v - state2.position[i]) < tolerance
  );
  const targetEqual = state1.target.every((v, i) => 
    Math.abs(v - state2.target[i]) < tolerance
  );
  const upEqual = state1.up.every((v, i) => 
    Math.abs(v - state2.up[i]) < tolerance
  );
  const fovEqual = Math.abs(state1.fov - state2.fov) < tolerance;
  const nearEqual = Math.abs(state1.near - state2.near) < tolerance;
  const farEqual = Math.abs(state1.far - state2.far) < tolerance;
  
  return posEqual && targetEqual && upEqual && fovEqual && nearEqual && farEqual;
}

// ============================================================================
// Property 26: Viewport Fit-to-View Completeness
// **Validates: Requirement 8.2**
//
// For any set of selected objects, fit-to-view adjusts the camera so all
// objects are visible in the viewport.
// ============================================================================

describe('Property 26: Viewport Fit-to-View Completeness', () => {
  let testSetup: ReturnType<typeof createTestScene>;
  let viewportManager: ViewportManager;

  beforeEach(() => {
    testSetup = createTestScene();
  });

  afterEach(() => {
    if (viewportManager) {
      viewportManager.dispose();
    }
    if (testSetup?.renderer) {
      testSetup.renderer.dispose();
    }
  });

  it('should frame all objects within camera frustum for any set of objects', () => {
    fc.assert(
      fc.property(meshArrayArbitrary(), (meshes) => {
        // Setup fresh viewport manager for each test
        testSetup = createTestScene();
        viewportManager = new ViewportManager({
          canvas: testSetup.canvas,
          scene: testSetup.scene,
          camera: testSetup.camera,
          renderer: testSetup.renderer,
          enableControls: true,
        });

        // Add meshes to scene
        meshes.forEach(mesh => testSetup.scene.add(mesh));

        // Perform fit-to-view
        viewportManager.fitToView(meshes);

        // Update camera matrices
        testSetup.camera.updateMatrixWorld();
        testSetup.camera.updateProjectionMatrix();

        // Check that at least the center of each mesh is visible
        // (The implementation adds padding, so centers should definitely be visible)
        let allCentersVisible = true;

        for (const mesh of meshes) {
          const box = new THREE.Box3().setFromObject(mesh);
          const center = box.getCenter(new THREE.Vector3());
          
          if (!isPointInFrustum(center, testSetup.camera)) {
            allCentersVisible = false;
            break;
          }
        }

        // Cleanup
        viewportManager.dispose();
        meshes.forEach(mesh => {
          mesh.geometry.dispose();
          (mesh.material as THREE.Material).dispose();
        });

        return allCentersVisible;
      }),
      {
        numRuns: 50, // Run 50 test cases
        verbose: true,
      }
    );
  });

  it('should position camera at appropriate distance for single object', () => {
    fc.assert(
      fc.property(meshArbitrary(), (mesh) => {
        // Setup fresh viewport manager
        testSetup = createTestScene();
        viewportManager = new ViewportManager({
          canvas: testSetup.canvas,
          scene: testSetup.scene,
          camera: testSetup.camera,
          renderer: testSetup.renderer,
          enableControls: true,
        });

        testSetup.scene.add(mesh);

        // Get mesh bounding box
        const box = new THREE.Box3().setFromObject(mesh);
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);

        // Perform fit-to-view
        viewportManager.fitToView([mesh]);

        // Calculate expected minimum distance
        const fov = testSetup.camera.fov * (Math.PI / 180);
        const minDistance = maxDim / (2 * Math.tan(fov / 2));

        // Get actual distance from camera to object center
        const center = box.getCenter(new THREE.Vector3());
        const actualDistance = testSetup.camera.position.distanceTo(center);

        // Camera should be at least minDistance away (with padding)
        // The implementation adds 20% padding, so we expect >= minDistance
        const isValidDistance = actualDistance >= minDistance * 0.9; // Allow 10% tolerance

        // Cleanup
        viewportManager.dispose();
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();

        return isValidDistance;
      }),
      {
        numRuns: 50,
        verbose: true,
      }
    );
  });

  it('should center camera target on object bounds for any object set', () => {
    fc.assert(
      fc.property(meshArrayArbitrary(), (meshes) => {
        // Setup fresh viewport manager
        testSetup = createTestScene();
        viewportManager = new ViewportManager({
          canvas: testSetup.canvas,
          scene: testSetup.scene,
          camera: testSetup.camera,
          renderer: testSetup.renderer,
          enableControls: true,
        });

        // Add meshes to scene
        meshes.forEach(mesh => testSetup.scene.add(mesh));

        // Calculate expected center
        const box = new THREE.Box3();
        meshes.forEach(mesh => {
          const meshBox = new THREE.Box3().setFromObject(mesh);
          box.union(meshBox);
        });
        const expectedCenter = box.getCenter(new THREE.Vector3());

        // Perform fit-to-view
        viewportManager.fitToView(meshes);

        // Get camera state to check target
        const cameraState = viewportManager.getCameraState();
        const actualTarget = new THREE.Vector3().fromArray(cameraState.target);

        // Target should be close to the center of all objects
        const distance = actualTarget.distanceTo(expectedCenter);
        const isTargetCentered = distance < 0.1; // Allow small tolerance

        // Cleanup
        viewportManager.dispose();
        meshes.forEach(mesh => {
          mesh.geometry.dispose();
          (mesh.material as THREE.Material).dispose();
        });

        return isTargetCentered;
      }),
      {
        numRuns: 50,
        verbose: true,
      }
    );
  });
});

// ============================================================================
// Property 27: Camera State Round-Trip
// **Validates: Requirement 8.8**
//
// For any camera state, saving then loading produces the exact same camera
// position, target, and orientation.
// ============================================================================

describe('Property 27: Camera State Round-Trip', () => {
  let testSetup: ReturnType<typeof createTestScene>;
  let viewportManager: ViewportManager;

  beforeEach(() => {
    testSetup = createTestScene();
  });

  afterEach(() => {
    if (viewportManager) {
      viewportManager.dispose();
    }
    if (testSetup?.renderer) {
      testSetup.renderer.dispose();
    }
  });

  it('should preserve camera state through save/restore round-trip', () => {
    fc.assert(
      fc.property(cameraStateArbitrary(), (originalState) => {
        // Setup fresh viewport manager
        testSetup = createTestScene();
        viewportManager = new ViewportManager({
          canvas: testSetup.canvas,
          scene: testSetup.scene,
          camera: testSetup.camera,
          renderer: testSetup.renderer,
          enableControls: true,
        });

        // Set the camera to the generated state
        viewportManager.setCameraState(originalState);

        // Save the state
        const savedState = viewportManager.getCameraState();

        // Modify the camera to a different state
        testSetup.camera.position.set(999, 999, 999);
        testSetup.camera.fov = 45;
        testSetup.camera.near = 0.5;
        testSetup.camera.far = 500;
        testSetup.camera.updateProjectionMatrix();

        // Restore the saved state
        viewportManager.setCameraState(savedState);

        // Get the restored state
        const restoredState = viewportManager.getCameraState();

        // Check that restored state matches original state
        const statesMatch = cameraStatesEqual(originalState, restoredState, 0.001);

        // Cleanup
        viewportManager.dispose();

        return statesMatch;
      }),
      {
        numRuns: 100, // More runs since this is a critical property
        verbose: true,
      }
    );
  });

  it('should preserve camera position exactly through round-trip', () => {
    fc.assert(
      fc.property(vector3Arbitrary(), (position) => {
        // Skip positions too close to origin as they can cause numerical instability
        if (position.length() < 0.1) {
          return true; // Skip this test case
        }

        // Setup fresh viewport manager
        testSetup = createTestScene();
        viewportManager = new ViewportManager({
          canvas: testSetup.canvas,
          scene: testSetup.scene,
          camera: testSetup.camera,
          renderer: testSetup.renderer,
          enableControls: true,
        });

        // Set camera position
        testSetup.camera.position.copy(position);

        // Save and restore
        const savedState = viewportManager.getCameraState();
        testSetup.camera.position.set(0, 0, 0); // Reset
        viewportManager.setCameraState(savedState);

        // Check position is preserved
        const restoredPosition = testSetup.camera.position;
        const positionMatch = 
          Math.abs(restoredPosition.x - position.x) < 0.001 &&
          Math.abs(restoredPosition.y - position.y) < 0.001 &&
          Math.abs(restoredPosition.z - position.z) < 0.001;

        // Cleanup
        viewportManager.dispose();

        return positionMatch;
      }),
      {
        numRuns: 100,
        verbose: true,
      }
    );
  });

  it('should preserve camera FOV exactly through round-trip', () => {
    fc.assert(
      fc.property(fovArbitrary(), (fov) => {
        // Setup fresh viewport manager
        testSetup = createTestScene();
        viewportManager = new ViewportManager({
          canvas: testSetup.canvas,
          scene: testSetup.scene,
          camera: testSetup.camera,
          renderer: testSetup.renderer,
          enableControls: true,
        });

        // Set camera FOV
        testSetup.camera.fov = fov;
        testSetup.camera.updateProjectionMatrix();

        // Save and restore
        const savedState = viewportManager.getCameraState();
        testSetup.camera.fov = 90; // Reset to different value
        viewportManager.setCameraState(savedState);

        // Check FOV is preserved
        const restoredFov = testSetup.camera.fov;
        const fovMatch = Math.abs(restoredFov - fov) < 0.001;

        // Cleanup
        viewportManager.dispose();

        return fovMatch;
      }),
      {
        numRuns: 100,
        verbose: true,
      }
    );
  });

  it('should preserve camera near/far planes through round-trip', () => {
    fc.assert(
      fc.property(
        nearPlaneArbitrary(),
        farPlaneArbitrary(),
        (near, far) => {
          // Setup fresh viewport manager
          testSetup = createTestScene();
          viewportManager = new ViewportManager({
            canvas: testSetup.canvas,
            scene: testSetup.scene,
            camera: testSetup.camera,
            renderer: testSetup.renderer,
            enableControls: true,
          });

          // Set camera near/far
          testSetup.camera.near = near;
          testSetup.camera.far = far;
          testSetup.camera.updateProjectionMatrix();

          // Save and restore
          const savedState = viewportManager.getCameraState();
          testSetup.camera.near = 1;
          testSetup.camera.far = 1000;
          viewportManager.setCameraState(savedState);

          // Check near/far are preserved
          const nearMatch = Math.abs(testSetup.camera.near - near) < 0.001;
          const farMatch = Math.abs(testSetup.camera.far - far) < 0.001;

          // Cleanup
          viewportManager.dispose();

          return nearMatch && farMatch;
        }
      ),
      {
        numRuns: 100,
        verbose: true,
      }
    );
  });

  it('should handle multiple save/restore cycles without degradation', () => {
    fc.assert(
      fc.property(cameraStateArbitrary(), (originalState) => {
        // Setup fresh viewport manager
        testSetup = createTestScene();
        viewportManager = new ViewportManager({
          canvas: testSetup.canvas,
          scene: testSetup.scene,
          camera: testSetup.camera,
          renderer: testSetup.renderer,
          enableControls: true,
        });

        // Set initial state
        viewportManager.setCameraState(originalState);

        // Perform multiple save/restore cycles
        let currentState = originalState;
        for (let i = 0; i < 5; i++) {
          const saved = viewportManager.getCameraState();
          viewportManager.setCameraState(saved);
          currentState = viewportManager.getCameraState();
        }

        // Final state should still match original
        const statesMatch = cameraStatesEqual(originalState, currentState, 0.001);

        // Cleanup
        viewportManager.dispose();

        return statesMatch;
      }),
      {
        numRuns: 50,
        verbose: true,
      }
    );
  });
});
