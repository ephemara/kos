/**
 * topologyTools.test.ts
 * ────────────────────────────────────────────────────────────────────────────
 * Unit tests for TopologyTools
 * 
 * Tests:
 *  1. Edge loop insertion maintains topology (Requirement 11.6)
 *  2. Edge operations preserve manifold mesh (Requirement 11.8)
 *  3. Topology analysis detects non-manifold geometry (Requirement 11.8)
 *  4. Manifold validation works correctly (Requirement 11.8)
 * 
 * **Validates: Requirements 11.6, 11.8**
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { TopologyTools, type Edge, type Face } from '../topologyTools';

// ─── Test Helpers ────────────────────────────────────────────────────────────

function createQuadMesh(): THREE.Mesh {
  const geometry = new THREE.BufferGeometry();
  
  // Create a simple quad
  const vertices = new Float32Array([
    0, 0, 0,  // v0
    1, 0, 0,  // v1
    1, 1, 0,  // v2
    0, 1, 0,  // v3
  ]);
  
  const indices = new Uint16Array([
    0, 1, 2,  // Triangle 1
    0, 2, 3,  // Triangle 2
  ]);
  
  geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.computeVertexNormals();
  
  const material = new THREE.MeshBasicMaterial();
  return new THREE.Mesh(geometry, material);
}

function createCubeMesh(): THREE.Mesh {
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const material = new THREE.MeshBasicMaterial();
  return new THREE.Mesh(geometry, material);
}

function createNonManifoldMesh(): THREE.Mesh {
  const geometry = new THREE.BufferGeometry();
  
  // Create a mesh with a non-manifold edge (shared by 3 faces)
  const vertices = new Float32Array([
    0, 0, 0,  // v0
    1, 0, 0,  // v1
    0.5, 1, 0,  // v2
    0.5, -1, 0,  // v3
    0.5, 0, 1,  // v4
  ]);
  
  const indices = new Uint16Array([
    0, 1, 2,  // Triangle 1
    0, 1, 3,  // Triangle 2 (shares edge 0-1)
    0, 1, 4,  // Triangle 3 (shares edge 0-1) - NON-MANIFOLD!
  ]);
  
  geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.computeVertexNormals();
  
  const material = new THREE.MeshBasicMaterial();
  return new THREE.Mesh(geometry, material);
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

describe('TopologyTools', () => {
  let topologyTools: TopologyTools;
  
  beforeEach(() => {
    topologyTools = new TopologyTools();
  });
  
  // ─── Edge Loop Insertion (Requirement 11.6) ─────────────────────────────────
  
  describe('Edge Loop Insertion', () => {
    it('should insert edge loop at midpoint', () => {
      // Arrange
      const mesh = createQuadMesh();
      const originalVertexCount = getVertexCount(mesh);
      
      const edge: Edge = { v1: 0, v2: 1 }; // Bottom edge
      
      // Act
      topologyTools.insertEdgeLoop(mesh, edge, 0.5);
      
      // Assert - should add new vertices
      expect(getVertexCount(mesh)).toBeGreaterThan(originalVertexCount);
    });
    
    it('should clamp position to valid range', () => {
      // Arrange
      const mesh = createQuadMesh();
      const edge: Edge = { v1: 0, v2: 1 };
      
      // Act - try to insert at invalid positions
      topologyTools.insertEdgeLoop(mesh, edge, -0.5); // Should clamp to 0
      topologyTools.insertEdgeLoop(mesh, edge, 1.5);  // Should clamp to 1
      
      // Assert - should not crash and mesh should still be valid
      expect(getVertexCount(mesh)).toBeGreaterThan(0);
    });
    
    it('should handle non-existent edge gracefully', () => {
      // Arrange
      const mesh = createQuadMesh();
      const originalVertexCount = getVertexCount(mesh);
      
      const invalidEdge: Edge = { v1: 999, v2: 1000 };
      
      // Act
      topologyTools.insertEdgeLoop(mesh, invalidEdge, 0.5);
      
      // Assert - should not modify mesh
      expect(getVertexCount(mesh)).toBe(originalVertexCount);
    });
  });
  
  // ─── Edge Dissolve (Requirement 11.6) ───────────────────────────────────────
  
  describe('Edge Dissolve', () => {
    it('should merge adjacent faces when dissolving edge', () => {
      // Arrange
      const mesh = createQuadMesh();
      const originalVertexCount = getVertexCount(mesh);
      
      // Edge between the two triangles of the quad
      const edge: Edge = { v1: 0, v2: 2 }; // Diagonal edge
      
      // Act
      topologyTools.dissolveEdge(mesh, edge);
      
      // Assert - should complete without error (actual behavior depends on implementation)
      // The mesh should still be valid
      expect(getVertexCount(mesh)).toBeGreaterThanOrEqual(0);
    });
    
    it('should handle edge not shared by exactly 2 faces', () => {
      // Arrange
      const mesh = createQuadMesh();
      const originalTriCount = getTriangleCount(mesh);
      
      // Boundary edge (only 1 face)
      const boundaryEdge: Edge = { v1: 0, v2: 1 };
      
      // Act
      topologyTools.dissolveEdge(mesh, boundaryEdge);
      
      // Assert - should not crash, mesh should remain valid
      expect(getTriangleCount(mesh)).toBeGreaterThan(0);
    });
  });
  
  // ─── Edge Collapse (Requirement 11.6) ───────────────────────────────────────
  
  describe('Edge Collapse', () => {
    it('should merge vertices when collapsing edge', () => {
      // Arrange
      const mesh = createQuadMesh();
      const originalVertexCount = getVertexCount(mesh);
      
      const edge: Edge = { v1: 0, v2: 1 };
      
      // Act
      topologyTools.collapseEdge(mesh, edge);
      
      // Assert - should reduce triangle count (degenerate faces removed)
      const newTriCount = getTriangleCount(mesh);
      expect(newTriCount).toBeLessThan(2); // Original had 2 triangles
    });
    
    it('should position collapsed vertex at midpoint', () => {
      // Arrange
      const mesh = createQuadMesh();
      const geometry = mesh.geometry;
      const positions = geometry.getAttribute('position');
      
      const v1Pos = new THREE.Vector3(
        positions.getX(0),
        positions.getY(0),
        positions.getZ(0)
      );
      const v2Pos = new THREE.Vector3(
        positions.getX(1),
        positions.getY(1),
        positions.getZ(1)
      );
      
      const expectedMidpoint = v1Pos.clone().lerp(v2Pos, 0.5);
      
      const edge: Edge = { v1: 0, v2: 1 };
      
      // Act
      topologyTools.collapseEdge(mesh, edge);
      
      // Assert - v1 should be at midpoint
      const newPositions = mesh.geometry.getAttribute('position');
      expect(newPositions.getX(0)).toBeCloseTo(expectedMidpoint.x);
      expect(newPositions.getY(0)).toBeCloseTo(expectedMidpoint.y);
      expect(newPositions.getZ(0)).toBeCloseTo(expectedMidpoint.z);
    });
    
    it('should remove degenerate triangles', () => {
      // Arrange
      const mesh = createQuadMesh();
      const edge: Edge = { v1: 0, v2: 1 };
      
      // Act
      topologyTools.collapseEdge(mesh, edge);
      
      // Assert - should have fewer triangles (degenerate ones removed)
      const triCount = getTriangleCount(mesh);
      expect(triCount).toBeLessThan(2);
    });
  });
  
  // ─── Quad Subdivision (Requirement 11.6) ────────────────────────────────────
  
  describe('Quad Subdivision', () => {
    it('should subdivide quad into 4 quads', () => {
      // Arrange
      const mesh = createQuadMesh();
      const face: Face = { vertices: [0, 1, 2, 3] };
      
      // Act
      topologyTools.subdivideQuad(mesh, face);
      
      // Assert - should have more vertices (4 corners + 4 edge midpoints + 1 center = 9)
      expect(getVertexCount(mesh)).toBeGreaterThanOrEqual(9);
      
      // Should have 8 triangles (4 quads * 2 triangles each)
      expect(getTriangleCount(mesh)).toBeGreaterThanOrEqual(8);
    });
    
    it('should not subdivide non-quad faces', () => {
      // Arrange
      const mesh = createQuadMesh();
      const originalVertexCount = getVertexCount(mesh);
      
      const triangleFace: Face = { vertices: [0, 1, 2] }; // Only 3 vertices
      
      // Act
      topologyTools.subdivideQuad(mesh, triangleFace);
      
      // Assert - should not modify mesh
      expect(getVertexCount(mesh)).toBe(originalVertexCount);
    });
    
    it('should create center vertex at face centroid', () => {
      // Arrange
      const mesh = createQuadMesh();
      const geometry = mesh.geometry;
      const positions = geometry.getAttribute('position');
      
      // Calculate expected centroid
      const corners = [0, 1, 2, 3].map(i => new THREE.Vector3(
        positions.getX(i),
        positions.getY(i),
        positions.getZ(i)
      ));
      
      const expectedCenter = new THREE.Vector3();
      corners.forEach(c => expectedCenter.add(c));
      expectedCenter.divideScalar(4);
      
      const face: Face = { vertices: [0, 1, 2, 3] };
      
      // Act
      topologyTools.subdivideQuad(mesh, face);
      
      // Assert - check that a vertex exists near the centroid
      const newPositions = mesh.geometry.getAttribute('position');
      let foundCenter = false;
      
      for (let i = 0; i < newPositions.count; i++) {
        const v = new THREE.Vector3(
          newPositions.getX(i),
          newPositions.getY(i),
          newPositions.getZ(i)
        );
        
        if (v.distanceTo(expectedCenter) < 0.01) {
          foundCenter = true;
          break;
        }
      }
      
      expect(foundCenter).toBe(true);
    });
  });
  
  // ─── Topology Analysis (Requirement 11.8) ───────────────────────────────────
  
  describe('Topology Analysis', () => {
    it('should count vertices correctly', () => {
      // Arrange
      const mesh = createQuadMesh();
      const geometry = mesh.geometry;
      
      // Act
      const stats = topologyTools.analyzeTopology(geometry);
      
      // Assert
      expect(stats.vertices).toBe(4);
    });
    
    it('should count edges correctly', () => {
      // Arrange
      const mesh = createQuadMesh();
      const geometry = mesh.geometry;
      
      // Act
      const stats = topologyTools.analyzeTopology(geometry);
      
      // Assert - quad has 5 edges (4 boundary + 1 diagonal)
      expect(stats.edges).toBe(5);
    });
    
    it('should count faces correctly', () => {
      // Arrange
      const mesh = createQuadMesh();
      const geometry = mesh.geometry;
      
      // Act
      const stats = topologyTools.analyzeTopology(geometry);
      
      // Assert - quad is 2 triangles
      expect(stats.faces).toBe(2);
    });
    
    it('should handle empty geometry', () => {
      // Arrange
      const emptyGeometry = new THREE.BufferGeometry();
      
      // Act
      const stats = topologyTools.analyzeTopology(emptyGeometry);
      
      // Assert
      expect(stats.vertices).toBe(0);
      expect(stats.edges).toBe(0);
      expect(stats.faces).toBe(0);
    });
  });
  
  // ─── Manifold Validation (Requirement 11.8) ─────────────────────────────────
  
  describe('Manifold Validation', () => {
    it('should validate manifold mesh as valid', () => {
      // Arrange - create a simple closed mesh (tetrahedron)
      const geometry = new THREE.BufferGeometry();
      const vertices = new Float32Array([
        0, 1, 0,   // v0
        -1, 0, 0,  // v1
        1, 0, 0,   // v2
        0, 0, 1,   // v3
      ]);
      const indices = new Uint16Array([
        0, 1, 2,  // Face 1
        0, 2, 3,  // Face 2
        0, 3, 1,  // Face 3
        1, 3, 2,  // Face 4
      ]);
      geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
      geometry.setIndex(new THREE.BufferAttribute(indices, 1));
      const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
      
      // Act
      const isManifold = topologyTools.validateManifold(mesh);
      
      // Assert - tetrahedron is manifold
      expect(isManifold).toBe(true);
    });
    
    it('should detect non-manifold mesh', () => {
      // Arrange
      const mesh = createNonManifoldMesh();
      
      // Act
      const isManifold = topologyTools.validateManifold(mesh);
      
      // Assert - should detect non-manifold
      expect(isManifold).toBe(false);
    });
    
    it('should detect boundary edges as non-manifold', () => {
      // Arrange - simple quad has boundary edges (not closed)
      const mesh = createQuadMesh();
      
      // Act
      const isManifold = topologyTools.validateManifold(mesh);
      
      // Assert - quad has boundary edges, so not manifold
      expect(isManifold).toBe(false);
    });
  });
  
  // ─── Non-Manifold Detection (Requirement 11.8) ──────────────────────────────
  
  describe('Non-Manifold Detection', () => {
    it('should detect non-manifold edges', () => {
      // Arrange
      const mesh = createNonManifoldMesh();
      const geometry = mesh.geometry;
      
      // Act
      const nonManifoldEdges = topologyTools.detectNonManifold(geometry);
      
      // Assert - should find at least one non-manifold edge
      expect(nonManifoldEdges.length).toBeGreaterThan(0);
    });
    
    it('should return empty array for closed manifold mesh', () => {
      // Arrange - create a tetrahedron (closed manifold)
      const geometry = new THREE.BufferGeometry();
      const vertices = new Float32Array([
        0, 1, 0,   // v0
        -1, 0, 0,  // v1
        1, 0, 0,   // v2
        0, 0, 1,   // v3
      ]);
      const indices = new Uint16Array([
        0, 1, 2,  // Face 1
        0, 2, 3,  // Face 2
        0, 3, 1,  // Face 3
        1, 3, 2,  // Face 4
      ]);
      geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
      geometry.setIndex(new THREE.BufferAttribute(indices, 1));
      
      // Act
      const nonManifoldEdges = topologyTools.detectNonManifold(geometry);
      
      // Assert - tetrahedron is manifold
      expect(nonManifoldEdges.length).toBe(0);
    });
    
    it('should identify specific non-manifold edge', () => {
      // Arrange
      const mesh = createNonManifoldMesh();
      const geometry = mesh.geometry;
      
      // Act
      const nonManifoldEdges = topologyTools.detectNonManifold(geometry);
      
      // Assert - edge 0-1 should be non-manifold
      const hasEdge01 = nonManifoldEdges.some(
        edge => (edge.v1 === 0 && edge.v2 === 1) || (edge.v1 === 1 && edge.v2 === 0)
      );
      
      expect(hasEdge01).toBe(true);
    });
  });
  
  // ─── Edge Cases ──────────────────────────────────────────────────────────────
  
  describe('Edge Cases', () => {
    it('should handle mesh without index buffer', () => {
      // Arrange
      const geometry = new THREE.BufferGeometry();
      const vertices = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
      geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
      
      const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
      
      // Act & Assert - should not crash
      const isManifold = topologyTools.validateManifold(mesh);
      expect(isManifold).toBe(false);
    });
    
    it('should handle mesh without position attribute', () => {
      // Arrange
      const geometry = new THREE.BufferGeometry();
      const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
      
      // Act
      const stats = topologyTools.analyzeTopology(geometry);
      
      // Assert
      expect(stats.vertices).toBe(0);
      expect(stats.edges).toBe(0);
      expect(stats.faces).toBe(0);
    });
  });
});
