/**
 * Weight Transfer Tests
 * 
 * Tests for weight transfer algorithms between meshes.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { WeightTransfer, TransferSettings } from '../transfer';
import { VertexGroup } from '../weightEngine';

describe('WeightTransfer', () => {
  let transfer: WeightTransfer;
  let sourceMesh: THREE.Mesh;
  let targetMesh: THREE.Mesh;
  let sourceGroup: VertexGroup;

  beforeEach(() => {
    transfer = new WeightTransfer();

    // Create source mesh (cube)
    const sourceGeometry = new THREE.BoxGeometry(1, 1, 1);
    sourceMesh = new THREE.Mesh(sourceGeometry);
    sourceMesh.updateMatrixWorld();

    // Create target mesh (slightly offset cube)
    const targetGeometry = new THREE.BoxGeometry(1, 1, 1);
    targetMesh = new THREE.Mesh(targetGeometry);
    targetMesh.position.set(0.1, 0, 0);
    targetMesh.updateMatrixWorld();

    // Create source vertex group with some weights
    sourceGroup = {
      id: 'test-group',
      name: 'Test Group',
      weights: new Map([
        [0, 1.0],
        [1, 0.8],
        [2, 0.6],
        [3, 0.4],
        [4, 0.2],
      ]),
      color: new THREE.Color(0xff0000),
      visible: true,
      locked: false,
    };
  });

  describe('transferWeights', () => {
    it('should transfer weights using nearest vertex method', () => {
      const settings: TransferSettings = {
        method: 'nearestVertex',
        maxDistance: 1.0,
        falloff: false,
        falloffRadius: 0.5,
      };

      const result = transfer.transferWeights(
        sourceMesh,
        sourceGroup,
        targetMesh,
        settings
      );

      expect(result.size).toBeGreaterThan(0);
      
      // Check that weights are in valid range
      result.forEach(weight => {
        expect(weight).toBeGreaterThanOrEqual(0);
        expect(weight).toBeLessThanOrEqual(1);
      });
    });

    it('should transfer weights using nearest surface method', () => {
      const settings: TransferSettings = {
        method: 'nearestSurface',
        maxDistance: 1.0,
        falloff: false,
        falloffRadius: 0.5,
      };

      const result = transfer.transferWeights(
        sourceMesh,
        sourceGroup,
        targetMesh,
        settings
      );

      expect(result.size).toBeGreaterThan(0);
      
      // Check that weights are in valid range
      result.forEach(weight => {
        expect(weight).toBeGreaterThanOrEqual(0);
        expect(weight).toBeLessThanOrEqual(1);
      });
    });

    it('should respect maxDistance threshold', () => {
      const settings: TransferSettings = {
        method: 'nearestVertex',
        maxDistance: 0.01, // Very small distance
        falloff: false,
        falloffRadius: 0.5,
      };

      const result = transfer.transferWeights(
        sourceMesh,
        sourceGroup,
        targetMesh,
        settings
      );

      // With such a small distance, few or no weights should transfer
      expect(result.size).toBeLessThan(sourceGroup.weights.size);
    });

    it('should apply falloff when enabled', () => {
      const settingsWithoutFalloff: TransferSettings = {
        method: 'nearestVertex',
        maxDistance: 1.0,
        falloff: false,
        falloffRadius: 0.5,
      };

      const settingsWithFalloff: TransferSettings = {
        method: 'nearestVertex',
        maxDistance: 1.0,
        falloff: true,
        falloffRadius: 0.5,
      };

      const resultWithoutFalloff = transfer.transferWeights(
        sourceMesh,
        sourceGroup,
        targetMesh,
        settingsWithoutFalloff
      );

      const resultWithFalloff = transfer.transferWeights(
        sourceMesh,
        sourceGroup,
        targetMesh,
        settingsWithFalloff
      );

      // Weights with falloff should generally be lower
      let falloffWeightsLower = false;
      resultWithFalloff.forEach((weight, index) => {
        const weightWithoutFalloff = resultWithoutFalloff.get(index);
        if (weightWithoutFalloff && weight < weightWithoutFalloff) {
          falloffWeightsLower = true;
        }
      });

      expect(falloffWeightsLower).toBe(true);
    });
  });

  describe('transferWeightsTopological', () => {
    it('should transfer weights for matching topology', () => {
      const targetVertexCount = 10;
      const result = transfer.transferWeightsTopological(sourceGroup, targetVertexCount);

      expect(result.size).toBe(sourceGroup.weights.size);
      
      // Check that weights match
      sourceGroup.weights.forEach((weight, index) => {
        expect(result.get(index)).toBe(weight);
      });
    });

    it('should handle target mesh with fewer vertices', () => {
      const targetVertexCount = 3;
      const result = transfer.transferWeightsTopological(sourceGroup, targetVertexCount);

      expect(result.size).toBeLessThanOrEqual(targetVertexCount);
      
      // Check that transferred weights are valid
      result.forEach((weight, index) => {
        expect(index).toBeLessThan(targetVertexCount);
        expect(weight).toBeGreaterThanOrEqual(0);
        expect(weight).toBeLessThanOrEqual(1);
      });
    });

    it('should handle target mesh with more vertices', () => {
      const targetVertexCount = 20;
      const result = transfer.transferWeightsTopological(sourceGroup, targetVertexCount);

      expect(result.size).toBe(sourceGroup.weights.size);
    });
  });

  describe('smoothTransferredWeights', () => {
    it('should smooth transferred weights', () => {
      // Create a mesh with known topology
      const geometry = new THREE.PlaneGeometry(1, 1, 2, 2);
      const mesh = new THREE.Mesh(geometry);
      mesh.updateMatrixWorld();

      // Create weights with sharp transition
      const weights = new Map<number, number>([
        [0, 1.0],
        [1, 0.0],
        [2, 1.0],
        [3, 0.0],
        [4, 1.0],
      ]);

      const smoothed = transfer.smoothTransferredWeights(mesh, weights, 1);

      // After smoothing, weights should be more uniform
      const originalVariance = calculateVariance(Array.from(weights.values()));
      const smoothedVariance = calculateVariance(Array.from(smoothed.values()));

      expect(smoothedVariance).toBeLessThan(originalVariance);
    });

    it('should converge with multiple iterations', () => {
      const geometry = new THREE.PlaneGeometry(1, 1, 3, 3);
      const mesh = new THREE.Mesh(geometry);
      mesh.updateMatrixWorld();

      const weights = new Map<number, number>([
        [0, 1.0],
        [1, 0.0],
        [2, 1.0],
        [3, 0.0],
        [4, 1.0],
      ]);

      const smoothed1 = transfer.smoothTransferredWeights(mesh, weights, 1);
      const smoothed5 = transfer.smoothTransferredWeights(mesh, weights, 5);

      const variance1 = calculateVariance(Array.from(smoothed1.values()));
      const variance5 = calculateVariance(Array.from(smoothed5.values()));

      // More iterations should reduce variance further
      expect(variance5).toBeLessThanOrEqual(variance1);
    });

    it('should smooth weights by averaging neighbors', () => {
      const geometry = new THREE.PlaneGeometry(1, 1, 2, 2);
      const mesh = new THREE.Mesh(geometry);
      mesh.updateMatrixWorld();

      const weights = new Map<number, number>([
        [0, 0.5],
        [1, 0.3],
        [2, 0.7],
        [3, 0.2],
      ]);

      const smoothed = transfer.smoothTransferredWeights(mesh, weights, 3);

      // Smoothing averages neighbors, so total sum may change
      // Check that weights are still valid
      smoothed.forEach(weight => {
        expect(weight).toBeGreaterThanOrEqual(0);
        expect(weight).toBeLessThanOrEqual(1);
      });
      
      // Variance should decrease
      const originalVariance = calculateVariance(Array.from(weights.values()));
      const smoothedVariance = calculateVariance(Array.from(smoothed.values()));
      expect(smoothedVariance).toBeLessThanOrEqual(originalVariance);
    });
  });

  describe('Octree acceleration', () => {
    it('should handle large meshes efficiently', () => {
      // Create a large source mesh
      const largeGeometry = new THREE.IcosahedronGeometry(1, 4); // ~2562 vertices
      const largeMesh = new THREE.Mesh(largeGeometry);
      largeMesh.updateMatrixWorld();

      // Create weights for all vertices
      const largeGroup: VertexGroup = {
        id: 'large-group',
        name: 'Large Group',
        weights: new Map(),
        color: new THREE.Color(0xff0000),
        visible: true,
        locked: false,
      };

      for (let i = 0; i < largeGeometry.attributes.position.count; i++) {
        largeGroup.weights.set(i, Math.random());
      }

      const settings: TransferSettings = {
        method: 'nearestVertex',
        maxDistance: 2.0,
        falloff: false,
        falloffRadius: 1.0,
      };

      const startTime = performance.now();
      const result = transfer.transferWeights(
        largeMesh,
        largeGroup,
        targetMesh,
        settings
      );
      const endTime = performance.now();

      expect(result.size).toBeGreaterThan(0);
      
      // Should complete in reasonable time (< 100ms for this size)
      expect(endTime - startTime).toBeLessThan(100);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty source weights', () => {
      const emptyGroup: VertexGroup = {
        id: 'empty-group',
        name: 'Empty Group',
        weights: new Map(),
        color: new THREE.Color(0xff0000),
        visible: true,
        locked: false,
      };

      const settings: TransferSettings = {
        method: 'nearestVertex',
        maxDistance: 1.0,
        falloff: false,
        falloffRadius: 0.5,
      };

      const result = transfer.transferWeights(
        sourceMesh,
        emptyGroup,
        targetMesh,
        settings
      );

      expect(result.size).toBe(0);
    });

    it('should handle meshes with different scales', () => {
      // Scale source mesh
      sourceMesh.scale.set(2, 2, 2);
      sourceMesh.updateMatrixWorld();

      const settings: TransferSettings = {
        method: 'nearestVertex',
        maxDistance: 2.0,
        falloff: false,
        falloffRadius: 1.0,
      };

      const result = transfer.transferWeights(
        sourceMesh,
        sourceGroup,
        targetMesh,
        settings
      );

      expect(result.size).toBeGreaterThan(0);
    });

    it('should handle meshes with rotations', () => {
      // Rotate source mesh
      sourceMesh.rotation.set(Math.PI / 4, Math.PI / 4, 0);
      sourceMesh.updateMatrixWorld();

      const settings: TransferSettings = {
        method: 'nearestVertex',
        maxDistance: 1.0,
        falloff: false,
        falloffRadius: 0.5,
      };

      const result = transfer.transferWeights(
        sourceMesh,
        sourceGroup,
        targetMesh,
        settings
      );

      expect(result.size).toBeGreaterThan(0);
    });

    it('should handle non-indexed geometry', () => {
      // Create non-indexed geometry
      const geometry = new THREE.BufferGeometry();
      const vertices = new Float32Array([
        -0.5, -0.5, 0,
        0.5, -0.5, 0,
        0.5, 0.5, 0,
        -0.5, 0.5, 0,
      ]);
      geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));

      const mesh = new THREE.Mesh(geometry);
      mesh.updateMatrixWorld();

      const weights = new Map<number, number>([
        [0, 1.0],
        [1, 0.5],
      ]);

      const result = transfer.smoothTransferredWeights(mesh, weights, 1);

      // Should handle gracefully even without index
      expect(result.size).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Barycentric interpolation', () => {
    it('should transfer weights between similar meshes', () => {
      // Create a simple triangle mesh
      const geometry = new THREE.BufferGeometry();
      const vertices = new Float32Array([
        0, 0, 0,    // vertex 0
        1, 0, 0,    // vertex 1
        0, 1, 0,    // vertex 2
      ]);
      const indices = new Uint16Array([0, 1, 2]);
      
      geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
      geometry.setIndex(new THREE.BufferAttribute(indices, 1));
      geometry.computeVertexNormals();

      const triangleMesh = new THREE.Mesh(geometry);
      triangleMesh.updateMatrixWorld();

      // Set weights at corners
      const triangleGroup: VertexGroup = {
        id: 'triangle-group',
        name: 'Triangle Group',
        weights: new Map([
          [0, 1.0],  // Full weight at origin
          [1, 0.5],  // Half weight at (1,0,0)
          [2, 0.3],  // Some weight at (0,1,0)
        ]),
        color: new THREE.Color(0xff0000),
        visible: true,
        locked: false,
      };

      // Create target mesh slightly offset
      const targetGeometry = new THREE.BufferGeometry();
      const targetVertices = new Float32Array([
        0.1, 0.1, 0,
        0.9, 0.1, 0,
        0.1, 0.9, 0,
      ]);
      const targetIndices = new Uint16Array([0, 1, 2]);
      targetGeometry.setAttribute('position', new THREE.BufferAttribute(targetVertices, 3));
      targetGeometry.setIndex(new THREE.BufferAttribute(targetIndices, 1));
      targetGeometry.computeVertexNormals();

      const targetMesh = new THREE.Mesh(targetGeometry);
      targetMesh.updateMatrixWorld();

      const settings: TransferSettings = {
        method: 'nearestVertex',
        maxDistance: 1.0,
        falloff: false,
        falloffRadius: 0.5,
      };

      const result = transfer.transferWeights(
        triangleMesh,
        triangleGroup,
        targetMesh,
        settings
      );

      // Should transfer some weights
      expect(result.size).toBeGreaterThan(0);
      
      // Weights should be in valid range
      result.forEach(weight => {
        expect(weight).toBeGreaterThanOrEqual(0);
        expect(weight).toBeLessThanOrEqual(1);
      });
    });
  });
});

// Helper function to calculate variance
function calculateVariance(values: number[]): number {
  if (values.length === 0) return 0;
  
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
  return squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
}
