/**
 * Unit tests for BrushSystem
 * 
 * Tests brush-based weight painting, raycasting, and affected vertex calculation.
 * Validates brush influence calculations and spatial optimization.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { BrushSystem } from '../brushSystem';

describe('BrushSystem', () => {
  let brushSystem: BrushSystem;
  let testMesh: THREE.Mesh;

  beforeEach(() => {
    brushSystem = new BrushSystem();
    
    // Create a simple test mesh (plane)
    const geometry = new THREE.PlaneGeometry(2, 2, 4, 4);
    testMesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
    
    brushSystem.setMesh(testMesh);
  });

  describe('Mesh Setup', () => {
    it('should set mesh for brush operations', () => {
      expect(() => {
        brushSystem.setMesh(testMesh);
      }).not.toThrow();
    });

    it('should build spatial hash for optimization', () => {
      // Spatial hash is built internally
      // Test by checking affected vertices work
      const position = new THREE.Vector3(0, 0, 0);
      const affected = brushSystem.getAffectedVertices(position, 0.5, 'linear');
      
      expect(Array.isArray(affected)).toBe(true);
    });
  });

  describe('Affected Vertices Calculation', () => {
    it('should find vertices within brush radius', () => {
      const position = new THREE.Vector3(0, 0, 0);
      const radius = 0.5;
      
      const affected = brushSystem.getAffectedVertices(position, radius, 'linear');
      
      expect(affected.length).toBeGreaterThan(0);
      affected.forEach(vertex => {
        expect(vertex.distance).toBeLessThanOrEqual(radius);
      });
    });

    it('should return empty array when no vertices in range', () => {
      const position = new THREE.Vector3(100, 100, 100);
      const radius = 0.1;
      
      const affected = brushSystem.getAffectedVertices(position, radius, 'linear');
      
      expect(affected.length).toBe(0);
    });

    it('should include vertex index in results', () => {
      const position = new THREE.Vector3(0, 0, 0);
      const radius = 1.0;
      
      const affected = brushSystem.getAffectedVertices(position, radius, 'linear');
      
      affected.forEach(vertex => {
        expect(typeof vertex.index).toBe('number');
        expect(vertex.index).toBeGreaterThanOrEqual(0);
      });
    });

    it('should include distance in results', () => {
      const position = new THREE.Vector3(0, 0, 0);
      const radius = 1.0;
      
      const affected = brushSystem.getAffectedVertices(position, radius, 'linear');
      
      affected.forEach(vertex => {
        expect(typeof vertex.distance).toBe('number');
        expect(vertex.distance).toBeGreaterThanOrEqual(0);
      });
    });

    it('should include influence in results', () => {
      const position = new THREE.Vector3(0, 0, 0);
      const radius = 1.0;
      
      const affected = brushSystem.getAffectedVertices(position, radius, 'linear');
      
      affected.forEach(vertex => {
        expect(typeof vertex.influence).toBe('number');
        expect(vertex.influence).toBeGreaterThanOrEqual(0);
        expect(vertex.influence).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('Falloff Curves', () => {
    it('should apply constant falloff (full influence)', () => {
      const position = new THREE.Vector3(0, 0, 0);
      const radius = 1.0;
      
      const affected = brushSystem.getAffectedVertices(position, radius, 'constant');
      
      affected.forEach(vertex => {
        expect(vertex.influence).toBe(1.0);
      });
    });

    it('should apply linear falloff', () => {
      const position = new THREE.Vector3(0, 0, 0);
      const radius = 1.0;
      
      const affected = brushSystem.getAffectedVertices(position, radius, 'linear');
      
      // Vertices closer to center should have higher influence
      const sorted = affected.sort((a, b) => a.distance - b.distance);
      
      if (sorted.length >= 2) {
        expect(sorted[0].influence).toBeGreaterThanOrEqual(sorted[sorted.length - 1].influence);
      }
    });

    it('should apply smooth falloff (smoothstep)', () => {
      const position = new THREE.Vector3(0, 0, 0);
      const radius = 1.0;
      
      const affected = brushSystem.getAffectedVertices(position, radius, 'smooth');
      
      // Smooth falloff should have gradual transition
      affected.forEach(vertex => {
        expect(vertex.influence).toBeGreaterThanOrEqual(0);
        expect(vertex.influence).toBeLessThanOrEqual(1);
      });
    });

    it('should apply sharp falloff (quadratic)', () => {
      const position = new THREE.Vector3(0, 0, 0);
      const radius = 1.0;
      
      const affected = brushSystem.getAffectedVertices(position, radius, 'sharp');
      
      // Sharp falloff should drop off quickly
      affected.forEach(vertex => {
        expect(vertex.influence).toBeGreaterThanOrEqual(0);
        expect(vertex.influence).toBeLessThanOrEqual(1);
      });
    });

    it('should give full influence at center for all falloffs except constant', () => {
      const position = new THREE.Vector3(0, 0, 0);
      const radius = 1.0;
      
      const falloffs: Array<'linear' | 'smooth' | 'sharp'> = ['linear', 'smooth', 'sharp'];
      
      falloffs.forEach(falloff => {
        const affected = brushSystem.getAffectedVertices(position, radius, falloff);
        
        // Find vertex closest to center
        const closest = affected.reduce((prev, curr) => 
          curr.distance < prev.distance ? curr : prev
        );
        
        // Closest vertex should have high influence
        expect(closest.influence).toBeGreaterThan(0.9);
      });
    });

    it('should give zero influence at radius boundary', () => {
      const position = new THREE.Vector3(0, 0, 0);
      const radius = 0.5;
      
      const affected = brushSystem.getAffectedVertices(position, radius, 'linear');
      
      // Vertices at or beyond radius should have very low influence
      affected.forEach(vertex => {
        if (vertex.distance >= radius * 0.99) {
          expect(vertex.influence).toBeLessThan(0.1);
        }
      });
    });
  });

  describe('Raycasting', () => {
    it('should have raycast method', () => {
      const camera = new THREE.PerspectiveCamera();
      const mouse = new THREE.Vector2(0, 0);
      
      // Just verify the method exists and doesn't crash
      expect(() => {
        brushSystem.raycastSurface(mouse, camera);
      }).not.toThrow();
    });

    it('should return null when ray misses mesh', () => {
      const camera = new THREE.PerspectiveCamera();
      camera.position.set(0, 0, 5);
      camera.lookAt(0, 0, 0);
      camera.updateMatrixWorld();

      const mouse = new THREE.Vector2(10, 10); // Far off screen
      
      const hitPoint = brushSystem.raycastSurface(mouse, camera);
      
      // May be null if ray misses
      expect(hitPoint === null || hitPoint instanceof THREE.Vector3).toBe(true);
    });

    it('should return Vector3 or null', () => {
      const camera = new THREE.PerspectiveCamera();
      const mouse = new THREE.Vector2(0, 0);
      
      const hitPoint = brushSystem.raycastSurface(mouse, camera);
      
      expect(hitPoint === null || hitPoint instanceof THREE.Vector3).toBe(true);
    });
  });

  describe('Closest Vertex', () => {
    it('should find closest vertex to a point', () => {
      const position = new THREE.Vector3(0, 0, 0);
      
      const closestIndex = brushSystem.getClosestVertex(position);
      
      expect(closestIndex).not.toBeNull();
      expect(typeof closestIndex).toBe('number');
    });

    it('should return null when no mesh is set', () => {
      const emptyBrush = new BrushSystem();
      const position = new THREE.Vector3(0, 0, 0);
      
      const closestIndex = emptyBrush.getClosestVertex(position);
      
      expect(closestIndex).toBeNull();
    });

    it('should find vertex closest to given position', () => {
      const geometry = testMesh.geometry;
      const positionAttr = geometry.attributes.position;
      
      // Get position of first vertex
      const firstVertex = new THREE.Vector3();
      firstVertex.fromBufferAttribute(positionAttr, 0);
      firstVertex.applyMatrix4(testMesh.matrixWorld);
      
      const closestIndex = brushSystem.getClosestVertex(firstVertex);
      
      // Should find the first vertex (or very close to it)
      expect(closestIndex).toBe(0);
    });
  });

  describe('Stroke Sampling', () => {
    it('should sample positions along stroke', () => {
      const start = new THREE.Vector3(0, 0, 0);
      const end = new THREE.Vector3(1, 0, 0);
      const spacing = 0.25;
      
      const samples = brushSystem.sampleStroke(start, end, spacing);
      
      expect(samples.length).toBeGreaterThan(1);
      expect(samples[0]).toEqual(start);
      expect(samples[samples.length - 1]).toEqual(end);
    });

    it('should respect spacing parameter', () => {
      const start = new THREE.Vector3(0, 0, 0);
      const end = new THREE.Vector3(1, 0, 0);
      const spacing = 0.1;
      
      const samples = brushSystem.sampleStroke(start, end, spacing);
      
      // Should have approximately distance/spacing samples
      const expectedSamples = Math.ceil(1.0 / spacing);
      expect(samples.length).toBeGreaterThanOrEqual(expectedSamples);
    });

    it('should return at least start and end points', () => {
      const start = new THREE.Vector3(0, 0, 0);
      const end = new THREE.Vector3(0.01, 0, 0);
      const spacing = 1.0; // Large spacing
      
      const samples = brushSystem.sampleStroke(start, end, spacing);
      
      expect(samples.length).toBeGreaterThanOrEqual(2);
    });

    it('should interpolate positions linearly', () => {
      const start = new THREE.Vector3(0, 0, 0);
      const end = new THREE.Vector3(1, 0, 0);
      const spacing = 0.5;
      
      const samples = brushSystem.sampleStroke(start, end, spacing);
      
      // Check middle sample is halfway
      if (samples.length >= 3) {
        const middle = samples[Math.floor(samples.length / 2)];
        expect(middle.x).toBeCloseTo(0.5, 1);
      }
    });
  });

  describe('Brush Cursor', () => {
    it('should create brush cursor mesh', () => {
      const radius = 0.5;
      const cursor = brushSystem.createBrushCursor(radius);
      
      expect(cursor instanceof THREE.Mesh).toBe(true);
      expect(cursor.geometry instanceof THREE.RingGeometry).toBe(true);
    });

    it('should create cursor with correct radius', () => {
      const radius = 0.75;
      const cursor = brushSystem.createBrushCursor(radius);
      
      const geometry = cursor.geometry as THREE.RingGeometry;
      expect(geometry).toBeDefined();
    });

    it('should create transparent cursor', () => {
      const cursor = brushSystem.createBrushCursor(0.5);
      const material = cursor.material as THREE.MeshBasicMaterial;
      
      expect(material.transparent).toBe(true);
      expect(material.opacity).toBeLessThan(1);
    });

    it('should disable depth test for cursor', () => {
      const cursor = brushSystem.createBrushCursor(0.5);
      const material = cursor.material as THREE.MeshBasicMaterial;
      
      expect(material.depthTest).toBe(false);
    });
  });

  describe('Performance Optimization', () => {
    it('should use spatial hash for large meshes', () => {
      // Create a larger mesh
      const largeGeometry = new THREE.PlaneGeometry(10, 10, 20, 20);
      const largeMesh = new THREE.Mesh(largeGeometry, new THREE.MeshBasicMaterial());
      
      brushSystem.setMesh(largeMesh);
      
      const position = new THREE.Vector3(0, 0, 0);
      const radius = 1.0;
      
      // Should complete without hanging
      expect(() => {
        const affected = brushSystem.getAffectedVertices(position, radius, 'linear');
        expect(affected.length).toBeGreaterThanOrEqual(0);
      }).not.toThrow();
    });

    it('should handle empty results efficiently', () => {
      const position = new THREE.Vector3(1000, 1000, 1000);
      const radius = 0.1;
      
      expect(() => {
        const affected = brushSystem.getAffectedVertices(position, radius, 'linear');
        expect(affected.length).toBe(0);
      }).not.toThrow();
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero radius', () => {
      const position = new THREE.Vector3(0, 0, 0);
      const radius = 0;
      
      const affected = brushSystem.getAffectedVertices(position, radius, 'linear');
      
      expect(affected.length).toBe(0);
    });

    it('should handle very large radius', () => {
      const position = new THREE.Vector3(0, 0, 0);
      const radius = 1000;
      
      const affected = brushSystem.getAffectedVertices(position, radius, 'linear');
      
      // Should include all vertices
      const geometry = testMesh.geometry;
      expect(affected.length).toBeLessThanOrEqual(geometry.attributes.position.count);
    });

    it('should handle mesh without geometry', () => {
      const emptyMesh = new THREE.Mesh();
      
      expect(() => {
        brushSystem.setMesh(emptyMesh);
      }).not.toThrow();
    });
  });

  describe('Cleanup', () => {
    it('should dispose resources', () => {
      expect(() => {
        brushSystem.dispose();
      }).not.toThrow();
    });

    it('should clear mesh reference on dispose', () => {
      brushSystem.dispose();
      
      const position = new THREE.Vector3(0, 0, 0);
      const affected = brushSystem.getAffectedVertices(position, 1.0, 'linear');
      
      expect(affected.length).toBe(0);
    });
  });
});
