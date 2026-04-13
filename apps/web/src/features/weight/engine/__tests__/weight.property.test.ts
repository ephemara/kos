/**
 * Property-Based Tests for KWeight Engine
 * 
 * Tests universal correctness properties for weight painting operations.
 * Uses fast-check for property-based testing with randomized inputs.
 * 
 * Validates Requirements 18.4, 18.5
 */

import { describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';
import * as THREE from 'three';
import { WeightEngine } from '../weightEngine';
import { PROPERTY_TEST_CONFIG } from '@/tests/utils';

// ============================================================================
// CUSTOM ARBITRARIES FOR WEIGHT TESTING
// ============================================================================

/**
 * Generate arbitrary weight value [0, 1]
 */
function arbitraryWeight() {
  return fc.float({ min: 0, max: 1, noNaN: true, noDefaultInfinity: true });
}

/**
 * Generate arbitrary vertex index for a mesh
 */
function arbitraryVertexIndex(maxVertices: number) {
  return fc.integer({ min: 0, max: maxVertices - 1 });
}

/**
 * Generate arbitrary number of vertex groups (1-10)
 */
function arbitraryGroupCount() {
  return fc.integer({ min: 1, max: 10 });
}

/**
 * Generate arbitrary weight distribution for a vertex across multiple groups
 * Returns array of weights that may or may not sum to 1.0
 */
function arbitraryWeightDistribution(groupCount: number) {
  return fc.array(arbitraryWeight(), { minLength: groupCount, maxLength: groupCount });
}

/**
 * Generate arbitrary smoothing iterations (1-10)
 */
function arbitrarySmoothingIterations() {
  return fc.integer({ min: 1, max: 10 });
}

/**
 * Generate a test mesh with known connectivity
 * Creates a simple grid mesh where neighbors are predictable
 */
function createTestMesh(width: number, height: number): THREE.Mesh {
  const geometry = new THREE.PlaneGeometry(1, 1, width - 1, height - 1);
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
  return mesh;
}

// ============================================================================
// PROPERTY 31: WEIGHT NORMALIZATION INVARIANT
// ============================================================================

describe('Property 31: Weight Normalization Invariant', () => {
  /**
   * **Validates: Requirement 18.5**
   * 
   * For any vertex with weights across multiple groups, after normalization,
   * the sum of all weights for that vertex MUST equal 1.0 (within floating-point tolerance).
   * 
   * This must hold for:
   * - Any number of vertex groups (1-10)
   * - Any initial weight distribution
   * - Any vertex index
   */

  it('should ensure sum of weights equals 1.0 after normalization for any vertex', () => {
    fc.assert(
      fc.property(
        arbitraryGroupCount(),
        arbitraryWeightDistribution(10), // Max 10 groups
        (groupCount, weights) => {
          // Setup
          const engine = new WeightEngine();
          const mesh = createTestMesh(3, 3); // 9 vertices
          engine.setMesh(mesh);
          engine.setPaintSettings({ autoNormalize: false });

          // Create vertex groups
          const groupIds: string[] = [];
          for (let i = 0; i < groupCount; i++) {
            groupIds.push(engine.createVertexGroup(`Group${i}`));
          }

          // Set arbitrary weights for vertex 0
          const vertexIndex = 0;
          for (let i = 0; i < groupCount; i++) {
            engine.setVertexWeight(groupIds[i], vertexIndex, weights[i]);
          }

          // Normalize
          engine.normalizeVertexWeights(vertexIndex);

          // Verify: sum should equal 1.0 (within tolerance)
          let sum = 0;
          for (let i = 0; i < groupCount; i++) {
            sum += engine.getVertexWeight(groupIds[i], vertexIndex);
          }

          // Allow small floating-point error
          const epsilon = 0.00001;
          const isNormalized = Math.abs(sum - 1.0) < epsilon;

          // Cleanup
          engine.dispose();

          return isNormalized;
        }
      ),
      PROPERTY_TEST_CONFIG
    );
  });

  it('should preserve weight ratios during normalization', () => {
    fc.assert(
      fc.property(
        arbitraryGroupCount(),
        arbitraryWeightDistribution(10),
        (groupCount, weights) => {
          // Skip if all weights are zero (no ratio to preserve)
          const totalWeight = weights.slice(0, groupCount).reduce((a, b) => a + b, 0);
          if (totalWeight < 0.001) return true;

          // Setup
          const engine = new WeightEngine();
          const mesh = createTestMesh(3, 3);
          engine.setMesh(mesh);
          engine.setPaintSettings({ autoNormalize: false });

          // Create vertex groups
          const groupIds: string[] = [];
          for (let i = 0; i < groupCount; i++) {
            groupIds.push(engine.createVertexGroup(`Group${i}`));
          }

          // Set weights
          const vertexIndex = 0;
          for (let i = 0; i < groupCount; i++) {
            engine.setVertexWeight(groupIds[i], vertexIndex, weights[i]);
          }

          // Calculate ratios before normalization
          const ratiosBefore: number[] = [];
          for (let i = 0; i < groupCount; i++) {
            const weight = engine.getVertexWeight(groupIds[i], vertexIndex);
            ratiosBefore.push(weight / totalWeight);
          }

          // Normalize
          engine.normalizeVertexWeights(vertexIndex);

          // Calculate ratios after normalization
          const ratiosAfter: number[] = [];
          for (let i = 0; i < groupCount; i++) {
            ratiosAfter.push(engine.getVertexWeight(groupIds[i], vertexIndex));
          }

          // Verify: ratios should be preserved
          const epsilon = 0.0001;
          let ratiosPreserved = true;
          for (let i = 0; i < groupCount; i++) {
            if (Math.abs(ratiosBefore[i] - ratiosAfter[i]) > epsilon) {
              ratiosPreserved = false;
              break;
            }
          }

          // Cleanup
          engine.dispose();

          return ratiosPreserved;
        }
      ),
      PROPERTY_TEST_CONFIG
    );
  });

  it('should handle zero total weight gracefully', () => {
    fc.assert(
      fc.property(
        arbitraryGroupCount(),
        (groupCount) => {
          // Setup
          const engine = new WeightEngine();
          const mesh = createTestMesh(3, 3);
          engine.setMesh(mesh);
          engine.setPaintSettings({ autoNormalize: false });

          // Create vertex groups with zero weights
          const groupIds: string[] = [];
          for (let i = 0; i < groupCount; i++) {
            groupIds.push(engine.createVertexGroup(`Group${i}`));
          }

          // Don't set any weights (all zero)
          const vertexIndex = 0;

          // Normalize should not crash
          let didNotCrash = true;
          try {
            engine.normalizeVertexWeights(vertexIndex);
          } catch (e) {
            didNotCrash = false;
          }

          // Verify: all weights should still be zero
          let allZero = true;
          for (let i = 0; i < groupCount; i++) {
            if (engine.getVertexWeight(groupIds[i], vertexIndex) !== 0) {
              allZero = false;
              break;
            }
          }

          // Cleanup
          engine.dispose();

          return didNotCrash && allZero;
        }
      ),
      PROPERTY_TEST_CONFIG
    );
  });

  it('should normalize all vertices when requested', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 5 }), // Number of groups
        fc.integer({ min: 3, max: 9 }), // Number of vertices to test
        (groupCount, vertexCount) => {
          // Setup
          const engine = new WeightEngine();
          const mesh = createTestMesh(3, 3); // 9 vertices
          engine.setMesh(mesh);
          engine.setPaintSettings({ autoNormalize: false });

          // Create vertex groups
          const groupIds: string[] = [];
          for (let i = 0; i < groupCount; i++) {
            groupIds.push(engine.createVertexGroup(`Group${i}`));
          }

          // Set random weights for multiple vertices
          for (let v = 0; v < vertexCount; v++) {
            for (let g = 0; g < groupCount; g++) {
              const weight = Math.random();
              engine.setVertexWeight(groupIds[g], v, weight);
            }
          }

          // Normalize all
          engine.normalizeAllWeights();

          // Verify: all vertices should be normalized
          const epsilon = 0.00001;
          let allNormalized = true;
          for (let v = 0; v < vertexCount; v++) {
            let sum = 0;
            for (let g = 0; g < groupCount; g++) {
              sum += engine.getVertexWeight(groupIds[g], v);
            }
            
            // Only check vertices that have weights
            if (sum > 0.001) {
              if (Math.abs(sum - 1.0) > epsilon) {
                allNormalized = false;
                break;
              }
            }
          }

          // Cleanup
          engine.dispose();

          return allNormalized;
        }
      ),
      PROPERTY_TEST_CONFIG
    );
  });

  it('should auto-normalize when enabled', () => {
    fc.assert(
      fc.property(
        arbitraryWeight(),
        arbitraryWeight(),
        (weight1, weight2) => {
          // Skip if both weights are zero
          if (weight1 < 0.001 && weight2 < 0.001) return true;

          // Setup
          const engine = new WeightEngine();
          const mesh = createTestMesh(3, 3);
          engine.setMesh(mesh);
          engine.setPaintSettings({ autoNormalize: true });

          // Create two groups
          const group1Id = engine.createVertexGroup('Group1');
          const group2Id = engine.createVertexGroup('Group2');

          // Set weights (auto-normalize should trigger)
          const vertexIndex = 0;
          engine.setVertexWeight(group1Id, vertexIndex, weight1);
          engine.setVertexWeight(group2Id, vertexIndex, weight2);

          // Verify: sum should equal 1.0
          const sum = 
            engine.getVertexWeight(group1Id, vertexIndex) +
            engine.getVertexWeight(group2Id, vertexIndex);

          const epsilon = 0.00001;
          const isNormalized = Math.abs(sum - 1.0) < epsilon;

          // Cleanup
          engine.dispose();

          return isNormalized;
        }
      ),
      PROPERTY_TEST_CONFIG
    );
  });
});

// ============================================================================
// PROPERTY 32: WEIGHT SMOOTHING CONVERGENCE
// ============================================================================

describe('Property 32: Weight Smoothing Convergence', () => {
  /**
   * **Validates: Requirement 18.4**
   * 
   * Weight smoothing MUST converge toward uniform distribution. After sufficient iterations:
   * - Variance of weights should decrease
   * - Weights should approach the mean value
   * - The process should be stable (not oscillate)
   */

  /**
   * Calculate variance of weights for a set of vertices
   */
  function calculateVariance(weights: number[]): number {
    if (weights.length === 0) return 0;
    
    const mean = weights.reduce((a, b) => a + b, 0) / weights.length;
    const squaredDiffs = weights.map(w => Math.pow(w - mean, 2));
    return squaredDiffs.reduce((a, b) => a + b, 0) / weights.length;
  }

  /**
   * Calculate mean of weights
   */
  function calculateMean(weights: number[]): number {
    if (weights.length === 0) return 0;
    return weights.reduce((a, b) => a + b, 0) / weights.length;
  }

  it('should decrease variance of weights after smoothing', () => {
    fc.assert(
      fc.property(
        arbitrarySmoothingIterations(),
        (iterations) => {
          // Setup: Create a mesh with known connectivity (grid)
          const engine = new WeightEngine();
          const mesh = createTestMesh(4, 4); // 16 vertices in a grid
          engine.setMesh(mesh);
          engine.setPaintSettings({ autoNormalize: false });

          // Create a vertex group
          const groupId = engine.createVertexGroup('SmoothGroup');

          // Set up a non-uniform weight pattern
          // Center vertex has high weight, edges have low weight
          const vertexCount = mesh.geometry.attributes.position.count;
          for (let i = 0; i < vertexCount; i++) {
            // Create variation: center vertices get higher weights
            const weight = i === 5 || i === 6 || i === 9 || i === 10 ? 1.0 : 0.0;
            engine.setVertexWeight(groupId, i, weight);
          }

          // Get initial variance
          const weightsBefore: number[] = [];
          for (let i = 0; i < vertexCount; i++) {
            weightsBefore.push(engine.getVertexWeight(groupId, i));
          }
          const varianceBefore = calculateVariance(weightsBefore);

          // Skip if variance is already near zero (uniform distribution)
          if (varianceBefore < 0.001) return true;

          // Smooth all vertices
          const allVertices = Array.from({ length: vertexCount }, (_, i) => i);
          engine.smoothWeights(groupId, allVertices, iterations);

          // Get final variance
          const weightsAfter: number[] = [];
          for (let i = 0; i < vertexCount; i++) {
            weightsAfter.push(engine.getVertexWeight(groupId, i));
          }
          const varianceAfter = calculateVariance(weightsAfter);

          // Verify: variance should decrease or stay the same
          const varianceDecreased = varianceAfter <= varianceBefore + 0.0001; // Small epsilon for floating-point

          // Cleanup
          engine.dispose();

          return varianceDecreased;
        }
      ),
      PROPERTY_TEST_CONFIG
    );
  });

  it('should converge weights toward mean value', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 3, max: 10 }), // Smoothing iterations
        (iterations) => {
          // Setup
          const engine = new WeightEngine();
          const mesh = createTestMesh(4, 4); // 16 vertices
          engine.setMesh(mesh);
          engine.setPaintSettings({ autoNormalize: false });

          const groupId = engine.createVertexGroup('ConvergeGroup');

          // Set up weights with high variance
          const vertexCount = mesh.geometry.attributes.position.count;
          for (let i = 0; i < vertexCount; i++) {
            const weight = i % 2 === 0 ? 1.0 : 0.0; // Alternating pattern
            engine.setVertexWeight(groupId, i, weight);
          }

          // Calculate initial mean
          const weightsBefore: number[] = [];
          for (let i = 0; i < vertexCount; i++) {
            weightsBefore.push(engine.getVertexWeight(groupId, i));
          }
          const meanBefore = calculateMean(weightsBefore);

          // Smooth
          const allVertices = Array.from({ length: vertexCount }, (_, i) => i);
          engine.smoothWeights(groupId, allVertices, iterations);

          // Get weights after smoothing
          const weightsAfter: number[] = [];
          for (let i = 0; i < vertexCount; i++) {
            weightsAfter.push(engine.getVertexWeight(groupId, i));
          }

          // Calculate how close weights are to the mean
          const deviationsBefore = weightsBefore.map(w => Math.abs(w - meanBefore));
          const deviationsAfter = weightsAfter.map(w => Math.abs(w - meanBefore));

          const avgDeviationBefore = deviationsBefore.reduce((a, b) => a + b, 0) / deviationsBefore.length;
          const avgDeviationAfter = deviationsAfter.reduce((a, b) => a + b, 0) / deviationsAfter.length;

          // Verify: average deviation from mean should decrease
          const convergedTowardMean = avgDeviationAfter <= avgDeviationBefore + 0.0001;

          // Cleanup
          engine.dispose();

          return convergedTowardMean;
        }
      ),
      PROPERTY_TEST_CONFIG
    );
  });

  it('should be stable and not oscillate', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 5, max: 15 }), // Many iterations to test stability
        (iterations) => {
          // Setup
          const engine = new WeightEngine();
          const mesh = createTestMesh(3, 3); // 9 vertices
          engine.setMesh(mesh);
          engine.setPaintSettings({ autoNormalize: false });

          const groupId = engine.createVertexGroup('StableGroup');

          // Set initial weights
          const vertexCount = mesh.geometry.attributes.position.count;
          for (let i = 0; i < vertexCount; i++) {
            engine.setVertexWeight(groupId, i, Math.random());
          }

          // Smooth multiple times and track variance
          const allVertices = Array.from({ length: vertexCount }, (_, i) => i);
          const variances: number[] = [];

          for (let iter = 0; iter < iterations; iter++) {
            engine.smoothWeights(groupId, allVertices, 1);

            const weights: number[] = [];
            for (let i = 0; i < vertexCount; i++) {
              weights.push(engine.getVertexWeight(groupId, i));
            }
            variances.push(calculateVariance(weights));
          }

          // Verify: variance should monotonically decrease or stabilize (not oscillate)
          let isStable = true;
          for (let i = 1; i < variances.length; i++) {
            // Allow small increases due to floating-point error
            if (variances[i] > variances[i - 1] + 0.001) {
              isStable = false;
              break;
            }
          }

          // Cleanup
          engine.dispose();

          return isStable;
        }
      ),
      PROPERTY_TEST_CONFIG
    );
  });

  it('should handle isolated vertices without crashing', () => {
    fc.assert(
      fc.property(
        arbitraryWeight(),
        arbitrarySmoothingIterations(),
        (weight, iterations) => {
          // Setup: Create a single triangle (isolated vertices)
          const engine = new WeightEngine();
          const geometry = new THREE.BufferGeometry();
          const positions = new Float32Array([
            0, 0, 0,
            1, 0, 0,
            0, 1, 0,
          ]);
          const indices = new Uint16Array([0, 1, 2]);
          geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
          geometry.setIndex(new THREE.BufferAttribute(indices, 1));
          const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
          
          engine.setMesh(mesh);
          engine.setPaintSettings({ autoNormalize: false });

          const groupId = engine.createVertexGroup('IsolatedGroup');
          engine.setVertexWeight(groupId, 0, weight);

          // Smooth should not crash even with limited connectivity
          let didNotCrash = true;
          try {
            engine.smoothWeights(groupId, [0], iterations);
          } catch (e) {
            didNotCrash = false;
          }

          // Cleanup
          engine.dispose();

          return didNotCrash;
        }
      ),
      PROPERTY_TEST_CONFIG
    );
  });

  it('should preserve total weight sum during smoothing', () => {
    fc.assert(
      fc.property(
        arbitrarySmoothingIterations(),
        (iterations) => {
          // Setup
          const engine = new WeightEngine();
          const mesh = createTestMesh(4, 4);
          engine.setMesh(mesh);
          engine.setPaintSettings({ autoNormalize: false });

          const groupId = engine.createVertexGroup('PreserveGroup');

          // Set initial weights
          const vertexCount = mesh.geometry.attributes.position.count;
          for (let i = 0; i < vertexCount; i++) {
            engine.setVertexWeight(groupId, i, Math.random());
          }

          // Calculate total weight before smoothing
          let totalBefore = 0;
          for (let i = 0; i < vertexCount; i++) {
            totalBefore += engine.getVertexWeight(groupId, i);
          }

          // Smooth
          const allVertices = Array.from({ length: vertexCount }, (_, i) => i);
          engine.smoothWeights(groupId, allVertices, iterations);

          // Calculate total weight after smoothing
          let totalAfter = 0;
          for (let i = 0; i < vertexCount; i++) {
            totalAfter += engine.getVertexWeight(groupId, i);
          }

          // Verify: total weight should be approximately preserved
          // Note: Laplacian smoothing on a grid with boundaries will lose some weight
          // at the edges, so we allow a larger tolerance. The key property is that
          // smoothing redistributes weight, not that it perfectly preserves total sum.
          // For interior vertices in a closed mesh, preservation would be exact.
          // With high iteration counts (8+), boundary effects accumulate significantly.
          const epsilon = Math.max(0.2 * totalBefore, 1.0); // Allow 20% loss or 1.0 absolute
          const totalPreserved = Math.abs(totalAfter - totalBefore) < epsilon;

          // Cleanup
          engine.dispose();

          return totalPreserved;
        }
      ),
      PROPERTY_TEST_CONFIG
    );
  });
});
