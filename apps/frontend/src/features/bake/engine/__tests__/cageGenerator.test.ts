/**
 * cageGenerator.test.ts
 * ────────────────────────────────────────────────────────────────────────────
 * Unit tests for CageGenerator
 * 
 * Tests:
 *  1. Uniform cage generation (Requirement 12.2)
 *  2. Adaptive cage generation (Requirement 12.2)
 *  3. Cage validation (Requirement 12.2)
 *  4. Recommended extrusion calculation (Requirement 12.2)
 * 
 * **Validates: Requirement 12.2**
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { cageGenerator, type CageGenerationSettings } from '../cageGenerator';
import type { BakeMesh } from '../bakeEngine';

// ─── Mock Tauri Invoke ───────────────────────────────────────────────────────

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn((command: string, args: any) => {
    switch (command) {
      case 'generate_cage':
        return Promise.resolve({
          positions: [0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0],
          normals: [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1],
          tangents: [1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1],
          uvs: [0, 0, 1, 0, 1, 1, 0, 1],
          indices: [0, 1, 2, 0, 2, 3],
        });
      
      case 'generate_cage_adaptive':
        return Promise.resolve({
          positions: [0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0],
          normals: [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1],
          tangents: [1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1],
          uvs: [0, 0, 1, 0, 1, 1, 0, 1],
          indices: [0, 1, 2, 0, 2, 3],
        });
      
      case 'validate_cage':
        return Promise.resolve({
          valid: true,
          issues: [],
        });
      
      case 'calculate_recommended_extrusion':
        return Promise.resolve(0.1);
      
      default:
        return Promise.reject(new Error(`Unknown command: ${command}`));
    }
  }),
}));

// ─── Test Helpers ────────────────────────────────────────────────────────────

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

describe('CageGenerator', () => {
  // ─── Uniform Cage Generation (Requirement 12.2) ─────────────────────────────
  
  describe('Uniform Cage Generation', () => {
    it('should generate uniform cage with fixed extrusion', async () => {
      // Arrange
      const mesh = createTestMesh();
      const extrusion = 0.1;
      
      // Act
      const cage = await cageGenerator.generateUniform(mesh, extrusion);
      
      // Assert
      expect(cage).toBeDefined();
      expect(cage.positions).toBeInstanceOf(Float32Array);
      expect(cage.normals).toBeInstanceOf(Float32Array);
      expect(cage.tangents).toBeInstanceOf(Float32Array);
      expect(cage.uvs).toBeInstanceOf(Float32Array);
      expect(cage.indices).toBeInstanceOf(Uint32Array);
    });
    
    it('should generate cage with different extrusion values', async () => {
      // Arrange
      const mesh = createTestMesh();
      
      // Act & Assert - should not throw
      await cageGenerator.generateUniform(mesh, 0.05);
      await cageGenerator.generateUniform(mesh, 0.1);
      await cageGenerator.generateUniform(mesh, 0.2);
      await cageGenerator.generateUniform(mesh, 0.5);
    });
    
    it('should generate cage with zero extrusion', async () => {
      // Arrange
      const mesh = createTestMesh();
      
      // Act
      const cage = await cageGenerator.generateUniform(mesh, 0);
      
      // Assert
      expect(cage).toBeDefined();
    });
    
    it('should generate cage with negative extrusion', async () => {
      // Arrange
      const mesh = createTestMesh();
      
      // Act
      const cage = await cageGenerator.generateUniform(mesh, -0.1);
      
      // Assert
      expect(cage).toBeDefined();
    });
    
    it('should preserve mesh topology in cage', async () => {
      // Arrange
      const mesh = createTestMesh();
      
      // Act
      const cage = await cageGenerator.generateUniform(mesh, 0.1);
      
      // Assert - cage should have same number of vertices and indices
      expect(cage.positions.length).toBe(mesh.positions.length);
      expect(cage.indices.length).toBe(mesh.indices.length);
    });
  });
  
  // ─── Adaptive Cage Generation (Requirement 12.2) ────────────────────────────
  
  describe('Adaptive Cage Generation', () => {
    it('should generate adaptive cage with min/max extrusion', async () => {
      // Arrange
      const mesh = createTestMesh();
      const minExtrusion = 0.05;
      const maxExtrusion = 0.2;
      
      // Act
      const cage = await cageGenerator.generateAdaptive(mesh, minExtrusion, maxExtrusion);
      
      // Assert
      expect(cage).toBeDefined();
      expect(cage.positions).toBeInstanceOf(Float32Array);
      expect(cage.normals).toBeInstanceOf(Float32Array);
      expect(cage.tangents).toBeInstanceOf(Float32Array);
      expect(cage.uvs).toBeInstanceOf(Float32Array);
      expect(cage.indices).toBeInstanceOf(Uint32Array);
    });
    
    it('should handle equal min and max extrusion', async () => {
      // Arrange
      const mesh = createTestMesh();
      
      // Act
      const cage = await cageGenerator.generateAdaptive(mesh, 0.1, 0.1);
      
      // Assert
      expect(cage).toBeDefined();
    });
    
    it('should handle different extrusion ranges', async () => {
      // Arrange
      const mesh = createTestMesh();
      
      // Act & Assert - should not throw
      await cageGenerator.generateAdaptive(mesh, 0.01, 0.05);
      await cageGenerator.generateAdaptive(mesh, 0.1, 0.3);
      await cageGenerator.generateAdaptive(mesh, 0.2, 0.5);
    });
  });
  
  // ─── Cage Generation with Settings (Requirement 12.2) ───────────────────────
  
  describe('Cage Generation with Settings', () => {
    it('should generate uniform cage when adaptive is false', async () => {
      // Arrange
      const mesh = createTestMesh();
      const settings: CageGenerationSettings = {
        extrusion: 0.1,
        adaptive: false,
      };
      
      // Act
      const cage = await cageGenerator.generate(mesh, settings);
      
      // Assert
      expect(cage).toBeDefined();
    });
    
    it('should generate adaptive cage when adaptive is true', async () => {
      // Arrange
      const mesh = createTestMesh();
      const settings: CageGenerationSettings = {
        extrusion: 0.1,
        adaptive: true,
        minExtrusion: 0.05,
        maxExtrusion: 0.2,
      };
      
      // Act
      const cage = await cageGenerator.generate(mesh, settings);
      
      // Assert
      expect(cage).toBeDefined();
    });
    
    it('should use default min/max when not provided', async () => {
      // Arrange
      const mesh = createTestMesh();
      const settings: CageGenerationSettings = {
        extrusion: 0.1,
        adaptive: true,
      };
      
      // Act
      const cage = await cageGenerator.generate(mesh, settings);
      
      // Assert
      expect(cage).toBeDefined();
    });
  });
  
  // ─── Cage Validation (Requirement 12.2) ─────────────────────────────────────
  
  describe('Cage Validation', () => {
    it('should validate cage mesh', async () => {
      // Arrange
      const mesh = createTestMesh();
      const cage = await cageGenerator.generateUniform(mesh, 0.1);
      
      // Act
      const result = await cageGenerator.validate(mesh, cage);
      
      // Assert
      expect(result).toBeDefined();
      expect(result.valid).toBe(true);
      expect(result.issues).toBeInstanceOf(Array);
    });
    
    it('should return validation issues when cage is invalid', async () => {
      // Arrange
      const mesh = createTestMesh();
      const cage = createTestMesh(); // Use mesh as cage (invalid)
      
      // Mock validation to return issues
      const { invoke } = await import('@tauri-apps/api/core');
      vi.mocked(invoke).mockResolvedValueOnce({
        valid: false,
        issues: ['Cage does not enclose mesh', 'Self-intersections detected'],
      });
      
      // Act
      const result = await cageGenerator.validate(mesh, cage);
      
      // Assert
      expect(result.valid).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
    });
    
    it('should handle validation errors gracefully', async () => {
      // Arrange
      const mesh = createTestMesh();
      const cage = createTestMesh();
      
      // Mock validation to throw error
      const { invoke } = await import('@tauri-apps/api/core');
      vi.mocked(invoke).mockRejectedValueOnce(new Error('Validation failed'));
      
      // Act
      const result = await cageGenerator.validate(mesh, cage);
      
      // Assert
      expect(result.valid).toBe(false);
      expect(result.issues[0]).toContain('Validation failed');
    });
  });
  
  // ─── Recommended Extrusion Calculation (Requirement 12.2) ───────────────────
  
  describe('Recommended Extrusion Calculation', () => {
    it('should calculate recommended extrusion', async () => {
      // Arrange
      const mesh = createTestMesh();
      
      // Act
      const extrusion = await cageGenerator.calculateRecommendedExtrusion(mesh);
      
      // Assert
      expect(extrusion).toBeGreaterThan(0);
      expect(typeof extrusion).toBe('number');
    });
    
    it('should return positive extrusion value', async () => {
      // Arrange
      const mesh = createTestMesh();
      
      // Act
      const extrusion = await cageGenerator.calculateRecommendedExtrusion(mesh);
      
      // Assert
      expect(extrusion).toBeGreaterThan(0);
    });
    
    it('should use fallback calculation on error', async () => {
      // Arrange
      const mesh = createTestMesh();
      
      // Mock invoke to throw error
      const { invoke } = await import('@tauri-apps/api/core');
      vi.mocked(invoke).mockRejectedValueOnce(new Error('Calculation failed'));
      
      // Act
      const extrusion = await cageGenerator.calculateRecommendedExtrusion(mesh);
      
      // Assert - should still return a valid extrusion
      expect(extrusion).toBeGreaterThan(0);
      expect(typeof extrusion).toBe('number');
    });
    
    it('should calculate fallback extrusion based on bounding box', async () => {
      // Arrange
      const mesh: BakeMesh = {
        positions: new Float32Array([
          0, 0, 0,
          10, 0, 0,
          10, 10, 0,
          0, 10, 0,
        ]),
        normals: new Float32Array(12),
        tangents: new Float32Array(16),
        uvs: new Float32Array(8),
        indices: new Uint32Array([0, 1, 2, 0, 2, 3]),
      };
      
      // Mock invoke to throw error to trigger fallback
      const { invoke } = await import('@tauri-apps/api/core');
      vi.mocked(invoke).mockRejectedValueOnce(new Error('Calculation failed'));
      
      // Act
      const extrusion = await cageGenerator.calculateRecommendedExtrusion(mesh);
      
      // Assert - should be approximately 10% of diagonal
      // Diagonal = sqrt(10^2 + 10^2) = ~14.14
      // 10% = ~1.414
      expect(extrusion).toBeGreaterThan(1.0);
      expect(extrusion).toBeLessThan(2.0);
    });
  });
  
  // ─── Error Handling ──────────────────────────────────────────────────────────
  
  describe('Error Handling', () => {
    it('should handle uniform cage generation errors', async () => {
      // Arrange
      const mesh = createTestMesh();
      
      // Mock invoke to throw error
      const { invoke } = await import('@tauri-apps/api/core');
      vi.mocked(invoke).mockRejectedValueOnce(new Error('Generation failed'));
      
      // Act & Assert
      await expect(cageGenerator.generateUniform(mesh, 0.1)).rejects.toThrow('Generation failed');
    });
    
    it('should handle adaptive cage generation errors', async () => {
      // Arrange
      const mesh = createTestMesh();
      
      // Mock invoke to throw error
      const { invoke } = await import('@tauri-apps/api/core');
      vi.mocked(invoke).mockRejectedValueOnce(new Error('Adaptive generation failed'));
      
      // Act & Assert
      await expect(
        cageGenerator.generateAdaptive(mesh, 0.05, 0.2)
      ).rejects.toThrow('Adaptive generation failed');
    });
  });
  
  // ─── Edge Cases ──────────────────────────────────────────────────────────────
  
  describe('Edge Cases', () => {
    it('should handle mesh with no UVs', async () => {
      // Arrange
      const mesh: BakeMesh = {
        positions: new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0]),
        normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
        tangents: new Float32Array([1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1]),
        uvs: new Float32Array(0), // Empty UVs
        indices: new Uint32Array([0, 1, 2]),
      };
      
      // Act
      const cage = await cageGenerator.generateUniform(mesh, 0.1);
      
      // Assert
      expect(cage).toBeDefined();
    });
    
    it('should handle mesh with single triangle', async () => {
      // Arrange
      const mesh: BakeMesh = {
        positions: new Float32Array([0, 0, 0, 1, 0, 0, 0.5, 1, 0]),
        normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
        tangents: new Float32Array([1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1]),
        uvs: new Float32Array([0, 0, 1, 0, 0.5, 1]),
        indices: new Uint32Array([0, 1, 2]),
      };
      
      // Act
      const cage = await cageGenerator.generateUniform(mesh, 0.1);
      
      // Assert
      expect(cage).toBeDefined();
    });
    
    it('should handle very small extrusion values', async () => {
      // Arrange
      const mesh = createTestMesh();
      
      // Act
      const cage = await cageGenerator.generateUniform(mesh, 0.001);
      
      // Assert
      expect(cage).toBeDefined();
    });
    
    it('should handle very large extrusion values', async () => {
      // Arrange
      const mesh = createTestMesh();
      
      // Act
      const cage = await cageGenerator.generateUniform(mesh, 10.0);
      
      // Assert
      expect(cage).toBeDefined();
    });
  });
});
