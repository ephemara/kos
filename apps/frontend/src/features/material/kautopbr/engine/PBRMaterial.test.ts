import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PBRMaterial } from './PBRMaterial';
import * as THREE from 'three';
import type { PBRMaps } from '../types';

describe('PBRMaterial', () => {
  let material: PBRMaterial;

  beforeEach(() => {
    // Mock texture loader to avoid actual file loading in tests
    vi.spyOn(THREE.TextureLoader.prototype, 'loadAsync').mockResolvedValue(
      new THREE.Texture()
    );
  });

  afterEach(() => {
    if (material) {
      material.dispose();
    }
    vi.restoreAllMocks();
  });

  describe('Initialization', () => {
    it('should create material with default parameters', () => {
      const maps: PBRMaps = {};
      material = new PBRMaterial({ maps });

      expect(material.material).toBeInstanceOf(THREE.MeshStandardMaterial);
      expect(material.material.roughness).toBe(0.5);
      expect(material.material.metalness).toBe(0.0);
    });

    it('should create material with custom parameters', () => {
      const maps: PBRMaps = {};
      material = new PBRMaterial({
        maps,
        parameters: {
          roughness: 0.8,
          metallic: 1.0,
          normalStrength: 1.5,
          emissiveIntensity: 2.0,
        },
      });

      expect(material.material.roughness).toBe(0.8);
      expect(material.material.metalness).toBe(1.0);
      expect(material.material.normalScale.x).toBe(1.5);
      expect(material.material.emissiveIntensity).toBe(2.0);
    });

    it('should set emissive color when provided', () => {
      const maps: PBRMaps = {};
      material = new PBRMaterial({
        maps,
        parameters: {
          emissiveColor: [1, 0.5, 0],
        },
      });

      expect(material.material.emissive.r).toBe(1);
      expect(material.material.emissive.g).toBe(0.5);
      expect(material.material.emissive.b).toBe(0);
    });
  });

  describe('Parameter Updates', () => {
    beforeEach(() => {
      const maps: PBRMaps = {};
      material = new PBRMaterial({ maps });
    });

    it('should update roughness parameter', () => {
      material.updateParameters({ roughness: 0.7 });
      expect(material.material.roughness).toBe(0.7);
    });

    it('should update metallic parameter', () => {
      material.updateParameters({ metallic: 0.9 });
      expect(material.material.metalness).toBe(0.9);
    });

    it('should update normal strength parameter', () => {
      material.updateParameters({ normalStrength: 1.8 });
      expect(material.material.normalScale.x).toBe(1.8);
      expect(material.material.normalScale.y).toBe(1.8);
    });

    it('should update height scale parameter', () => {
      material.updateParameters({ heightScale: 0.5 });
      expect(material.material.displacementScale).toBe(0.5);
    });

    it('should update emissive intensity parameter', () => {
      material.updateParameters({ emissiveIntensity: 5.0 });
      expect(material.material.emissiveIntensity).toBe(5.0);
    });

    it('should update emissive color parameter', () => {
      material.updateParameters({ emissiveColor: [0, 1, 0] });
      expect(material.material.emissive.r).toBe(0);
      expect(material.material.emissive.g).toBe(1);
      expect(material.material.emissive.b).toBe(0);
    });

    it('should update multiple parameters at once', () => {
      material.updateParameters({
        roughness: 0.3,
        metallic: 0.6,
        normalStrength: 1.2,
      });

      expect(material.material.roughness).toBe(0.3);
      expect(material.material.metalness).toBe(0.6);
      expect(material.material.normalScale.x).toBe(1.2);
    });

    it('should update material properties correctly', () => {
      // Verify that parameter updates actually modify the material
      const initialRoughness = material.material.roughness;
      material.updateParameters({ roughness: 0.4 });
      expect(material.material.roughness).not.toBe(initialRoughness);
      expect(material.material.roughness).toBe(0.4);
    });

    it('should complete parameter update within 33ms (Requirement 15.1)', () => {
      const startTime = performance.now();
      
      // Update all parameters
      material.updateParameters({
        roughness: 0.7,
        metallic: 0.8,
        normalStrength: 1.5,
        heightScale: 0.2,
        emissiveIntensity: 3.0,
        emissiveColor: [1, 0, 0],
      });

      const updateTime = performance.now() - startTime;
      
      // Requirement 15.1: Updates must complete within 33ms (30 fps)
      expect(updateTime).toBeLessThan(33);
    });
  });

  describe('Statistics', () => {
    it('should return correct statistics for material without maps', () => {
      const maps: PBRMaps = {};
      material = new PBRMaterial({ maps });

      const stats = material.getStatistics();

      expect(stats.textureCount).toBe(0);
      expect(stats.hasAlbedo).toBe(false);
      expect(stats.hasNormal).toBe(false);
      expect(stats.hasRoughness).toBe(false);
      expect(stats.hasMetallic).toBe(false);
      expect(stats.hasAO).toBe(false);
      expect(stats.hasHeight).toBe(false);
      expect(stats.hasEmissive).toBe(false);
    });

    it('should track memory estimate', () => {
      const maps: PBRMaps = {};
      material = new PBRMaterial({ maps });

      const stats = material.getStatistics();

      expect(stats.memoryEstimate).toBeGreaterThanOrEqual(0);
      expect(typeof stats.memoryEstimate).toBe('number');
    });
  });

  describe('Disposal', () => {
    it('should dispose material and textures', () => {
      const maps: PBRMaps = {};
      material = new PBRMaterial({ maps });

      const disposeSpy = vi.spyOn(material.material, 'dispose');
      
      material.dispose();

      expect(disposeSpy).toHaveBeenCalled();
    });

    it('should clear texture cache on disposal', () => {
      const maps: PBRMaps = {};
      material = new PBRMaterial({ maps });

      material.dispose();

      const stats = material.getStatistics();
      expect(stats.textureCount).toBe(0);
    });
  });

  describe('PBR Map Support', () => {
    it('should support all PBR map types', async () => {
      const maps: PBRMaps = {
        albedo: { path: '/test/albedo.png', width: 1024, height: 1024 },
        normal: { path: '/test/normal.png', width: 1024, height: 1024 },
        roughness: { path: '/test/roughness.png', width: 1024, height: 1024 },
        metallic: { path: '/test/metallic.png', width: 1024, height: 1024 },
        ao: { path: '/test/ao.png', width: 1024, height: 1024 },
        height: { path: '/test/height.png', width: 1024, height: 1024 },
        emissive: { path: '/test/emissive.png', width: 1024, height: 1024 },
      };

      material = new PBRMaterial({ maps });

      // Wait for textures to load
      await new Promise(resolve => setTimeout(resolve, 100));

      const stats = material.getStatistics();

      // All map types should be loaded
      expect(stats.hasAlbedo).toBe(true);
      expect(stats.hasNormal).toBe(true);
      expect(stats.hasRoughness).toBe(true);
      expect(stats.hasMetallic).toBe(true);
      expect(stats.hasAO).toBe(true);
      expect(stats.hasHeight).toBe(true);
      expect(stats.hasEmissive).toBe(true);
    });
  });
});
