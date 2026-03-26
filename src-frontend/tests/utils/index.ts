/**
 * Property-Based Testing Utilities for TypeScript
 * 
 * This module provides reusable arbitrary generators and helper functions
 * for property-based testing across the K_OS frontend.
 * 
 * Configuration:
 * - All property tests run with numRuns=100
 * - Use fast-check library for property-based testing
 * 
 * Usage:
 * ```typescript
 * import fc from 'fast-check';
 * import { arbitraryMesh, arbitraryMaterial } from '@/tests/utils';
 * 
 * describe('My Feature', () => {
 *   it('property test', () => {
 *     fc.assert(
 *       fc.property(arbitraryMesh(), (mesh) => {
 *         // Test implementation
 *       }),
 *       { numRuns: 100 }
 *     );
 *   });
 * });
 * ```
 */

import fc from 'fast-check';

function finiteFloat(min: number, max: number) {
  return fc.float({
    min: Math.fround(min),
    max: Math.fround(max),
    noNaN: true,
    noDefaultInfinity: true,
  });
}

// ============================================================================
// MESH GENERATORS
// ============================================================================

/**
 * Generate arbitrary mesh with positions and triangle indices
 */
export function arbitraryMesh() {
  return fc.record({
    positions: fc.array(finiteFloat(-10, 10), { minLength: 9, maxLength: 300 })
      .map(arr => {
        // Ensure multiple of 3 (x, y, z)
        const len = Math.floor(arr.length / 3) * 3;
        return arr.slice(0, len);
      }),
    indices: fc.array(fc.nat(), { minLength: 3, maxLength: 150 })
      .map(arr => {
        // Ensure multiple of 3 (triangles)
        const len = Math.floor(arr.length / 3) * 3;
        return arr.slice(0, len);
      })
      .chain(indices => {
        // Ensure indices are in valid range
        return fc.constant(indices.map(idx => idx % 100));
      }),
    name: fc.string({ minLength: 3, maxLength: 20 }),
  });
}

/**
 * Generate small mesh for fast tests
 */
export function arbitrarySmallMesh() {
  return fc.record({
    positions: fc.array(finiteFloat(-10, 10), { minLength: 9, maxLength: 60 })
      .map(arr => {
        const len = Math.floor(arr.length / 3) * 3;
        return arr.slice(0, len);
      }),
    indices: fc.array(fc.nat(), { minLength: 3, maxLength: 30 })
      .map(arr => {
        const len = Math.floor(arr.length / 3) * 3;
        return arr.slice(0, len);
      })
      .chain(indices => {
        return fc.constant(indices.map(idx => idx % 20));
      }),
    name: fc.string({ minLength: 3, maxLength: 20 }),
  });
}

/**
 * Generate simple test meshes (triangle, quad, cube)
 */
export function simpleTestMesh() {
  return fc.oneof(
    // Triangle
    fc.constant({
      positions: [0, 0, 0, 1, 0, 0, 0, 1, 0],
      indices: [0, 1, 2],
      name: 'triangle',
    }),
    // Quad
    fc.constant({
      positions: [0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0],
      indices: [0, 1, 2, 0, 2, 3],
      name: 'quad',
    }),
    // Cube
    fc.constant({
      positions: [
        -0.5, -0.5, 0.5,
        0.5, -0.5, 0.5,
        0.5, 0.5, 0.5,
        -0.5, 0.5, 0.5,
        -0.5, -0.5, -0.5,
        0.5, -0.5, -0.5,
        0.5, 0.5, -0.5,
        -0.5, 0.5, -0.5,
      ],
      indices: [
        0, 1, 2, 0, 2, 3,
        5, 4, 7, 5, 7, 6,
        4, 0, 3, 4, 3, 7,
        1, 5, 6, 1, 6, 2,
        3, 2, 6, 3, 6, 7,
        4, 5, 1, 4, 1, 0,
      ],
      name: 'cube',
    })
  );
}

// ============================================================================
// MATERIAL GENERATORS
// ============================================================================

/**
 * Generate arbitrary PBR material parameters
 */
export function arbitraryMaterial() {
  return fc.record({
    baseColor: fc.array(finiteFloat(0, 1), { minLength: 4, maxLength: 4 }),
    roughness: finiteFloat(0, 1),
    metallic: finiteFloat(0, 1),
    ao: finiteFloat(0, 1),
    name: fc.string({ minLength: 3, maxLength: 20 }),
  });
}

/**
 * Generate arbitrary RGBA color
 */
export function arbitraryColor() {
  return fc.array(finiteFloat(0, 1), { minLength: 4, maxLength: 4 });
}

// ============================================================================
// BRUSH STROKE GENERATORS
// ============================================================================

/**
 * Generate arbitrary brush stroke parameters
 */
export function arbitraryBrushStroke() {
  return fc.record({
    center: fc.array(finiteFloat(-10, 10), { minLength: 3, maxLength: 3 }),
    radius: finiteFloat(0.01, 2.0),
    strength: finiteFloat(0, 1),
    falloff: finiteFloat(0, 1),
    pressure: finiteFloat(0, 1),
  });
}

/**
 * Generate arbitrary 3D position
 */
export function arbitraryPosition3D() {
  return fc.array(finiteFloat(-10, 10), { minLength: 3, maxLength: 3 });
}

// ============================================================================
// UV COORDINATE GENERATORS
// ============================================================================

/**
 * Generate arbitrary UV coordinates (normalized to [0, 1] range)
 */
export function arbitraryUVCoords() {
  return fc.array(finiteFloat(0, 1), { minLength: 6, maxLength: 200 })
    .map(arr => {
      // Ensure even number (pairs of U,V)
      const len = Math.floor(arr.length / 2) * 2;
      return arr.slice(0, len);
    });
}

/**
 * Generate arbitrary UV coordinates for a specific vertex count
 */
export function arbitraryUVCoordsForVertices(vertexCount: number) {
  return fc.array(finiteFloat(0, 1), { 
    minLength: vertexCount * 2, 
    maxLength: vertexCount * 2 
  });
}

// ============================================================================
// SCENE GENERATORS
// ============================================================================

/**
 * Generate arbitrary scene with multiple meshes and materials
 */
export function arbitraryScene() {
  return fc.record({
    meshes: fc.array(arbitraryMesh(), { minLength: 1, maxLength: 10 }),
    materials: fc.array(arbitraryMaterial(), { minLength: 1, maxLength: 5 }),
    name: fc.string({ minLength: 3, maxLength: 20 }),
  });
}

// ============================================================================
// APP STATE GENERATORS
// ============================================================================

/**
 * Generate arbitrary app name
 */
export function arbitraryAppName() {
  return fc.constantFrom(
    'ksculpt',
    'kpainter',
    'katlas',
    'kgraphos',
    'kautopbr',
    'kgreeble',
    'ktecton',
    'kquantum',
    'kcloner',
    'kinspect'
  );
}

/**
 * Generate arbitrary app state
 */
export function arbitraryAppState() {
  return fc.record({
    appName: arbitraryAppName(),
    state: fc.anything(),
  });
}

/**
 * Generate arbitrary sequence of app switches
 */
export function arbitraryAppSwitchSequence() {
  return fc.array(arbitraryAppName(), { minLength: 1, maxLength: 10 });
}

// ============================================================================
// CONFIGURATION GENERATORS
// ============================================================================

/**
 * Generate arbitrary configuration JSON (for testing config validation)
 */
export function arbitraryConfigJSON() {
  return fc.oneof(
    // Valid JSON
    fc.constant('{"id": "test", "name": "Test Config", "value": 42}'),
    // Invalid JSON (malformed)
    fc.constant('{ invalid json'),
    // Valid JSON but wrong schema (missing required fields)
    fc.constant('{"id": 123}'),
    // Valid JSON but wrong types
    fc.constant('{"id": "test", "name": 123, "value": "not a number"}'),
  );
}

/**
 * Generate arbitrary brush config
 */
export function arbitraryBrushConfig() {
  return fc.record({
    id: fc.string({ minLength: 3, maxLength: 20 }),
    name: fc.string({ minLength: 3, maxLength: 30 }),
    category: fc.constantFrom('sculpt', 'paint', 'mask', 'smooth'),
    defaultSize: finiteFloat(1, 512),
    defaultStrength: finiteFloat(0, 1),
    supportsPressure: fc.boolean(),
    icon: fc.string({ minLength: 3, maxLength: 20 }),
  });
}

/**
 * Generate arbitrary viewport preset
 */
export function arbitraryViewportPreset() {
  return fc.record({
    id: fc.string({ minLength: 3, maxLength: 20 }),
    name: fc.string({ minLength: 3, maxLength: 30 }),
    gridSize: finiteFloat(0.1, 10),
    gridDivisions: fc.integer({ min: 1, max: 100 }),
    cameraDistance: finiteFloat(1, 100),
    cameraFov: finiteFloat(10, 120),
  });
}

// ============================================================================
// COMPARISON HELPERS
// ============================================================================

/**
 * Compare two float arrays with epsilon tolerance
 */
export function floatsEqual(a: number[], b: number[], epsilon: number = 0.001): boolean {
  if (a.length !== b.length) {
    return false;
  }

  for (let i = 0; i < a.length; i++) {
    if (Math.abs(a[i] - b[i]) > epsilon) {
      return false;
    }
  }

  return true;
}

/**
 * Compare two position arrays (3D coordinates) with epsilon tolerance
 */
export function positionsEqual(a: number[], b: number[], epsilon: number = 0.001): boolean {
  return floatsEqual(a, b, epsilon);
}

/**
 * Compare two UV coordinate arrays with epsilon tolerance
 */
export function uvsEqual(a: number[], b: number[], epsilon: number = 0.001): boolean {
  return floatsEqual(a, b, epsilon);
}

/**
 * Check if two index arrays represent the same topology
 */
export function topologyEquivalent(indicesA: number[], indicesB: number[]): boolean {
  // Same number of triangles
  if (indicesA.length !== indicesB.length) {
    return false;
  }

  // For now, just check length
  // More sophisticated topology checks could be added
  return true;
}

/**
 * Check if a mesh is valid (basic validation)
 */
export function isValidMesh(positions: number[], indices: number[]): boolean {
  // Must have at least 3 vertices (1 triangle)
  if (positions.length < 9) {
    return false;
  }

  // Must have at least 3 indices (1 triangle)
  if (indices.length < 3) {
    return false;
  }

  // Positions must be multiple of 3 (x, y, z)
  if (positions.length % 3 !== 0) {
    return false;
  }

  // Indices must be multiple of 3 (triangles)
  if (indices.length % 3 !== 0) {
    return false;
  }

  // All indices must be in valid range
  const vertexCount = positions.length / 3;
  for (const idx of indices) {
    if (idx >= vertexCount) {
      return false;
    }
  }

  return true;
}

/**
 * Check if UV coordinates are valid for a mesh
 */
export function isValidUV(uvs: number[], vertexCount: number): boolean {
  // Must have 2 floats per vertex
  if (uvs.length !== vertexCount * 2) {
    return false;
  }

  // All UV coordinates should be reasonable (allow some range outside [0,1])
  for (const uv of uvs) {
    if (uv < -10.0 || uv > 10.0) {
      return false;
    }
  }

  return true;
}

// ============================================================================
// TEST CONFIGURATION
// ============================================================================

/**
 * Standard property test configuration
 */
export const PROPERTY_TEST_CONFIG = {
  numRuns: 100,
};

/**
 * Fast property test configuration (for quick feedback)
 */
export const FAST_PROPERTY_TEST_CONFIG = {
  numRuns: 10,
};

/**
 * Thorough property test configuration (for CI)
 */
export const THOROUGH_PROPERTY_TEST_CONFIG = {
  numRuns: 1000,
};
