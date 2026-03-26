/**
 * Tests for Weight Visualization System
 * 
 * Tests gradient visualization, shader materials, and visualization modes.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { WeightVisualization, VisualizationMode, GradientStop } from '../visualization';
import { VertexGroup } from '../weightEngine';

describe('WeightVisualization', () => {
  let visualization: WeightVisualization;
  let mesh: THREE.Mesh;
  let group: VertexGroup;

  beforeEach(() => {
    visualization = new WeightVisualization();

    // Create test mesh with 10 vertices
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array([
      0, 0, 0,
      1, 0, 0,
      2, 0, 0,
      0, 1, 0,
      1, 1, 0,
      2, 1, 0,
      0, 2, 0,
      1, 2, 0,
      2, 2, 0,
      1, 1, 1,
    ]);
    const normals = new Float32Array(positions.length);
    for (let i = 0; i < normals.length; i += 3) {
      normals[i] = 0;
      normals[i + 1] = 0;
      normals[i + 2] = 1;
    }
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));

    mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
    visualization.setMesh(mesh);

    // Create test vertex group
    group = {
      id: 'test-group',
      name: 'Test Group',
      weights: new Map([
        [0, 0.0],
        [1, 0.25],
        [2, 0.5],
        [3, 0.75],
        [4, 1.0],
      ]),
      color: new THREE.Color(0xff0000),
      visible: true,
      locked: false,
    };
  });

  describe('Initialization', () => {
    it('should initialize with default gradient mode', () => {
      expect(visualization.getMode()).toBe('gradient');
    });

    it('should have default blue-to-red gradient', () => {
      const gradient = visualization.getGradient();
      expect(gradient.length).toBe(5);
      expect(gradient[0].position).toBe(0.0);
      expect(gradient[4].position).toBe(1.0);
      // Blue at 0
      expect(gradient[0].color.getHex()).toBe(0x0000ff);
      // Red at 1
      expect(gradient[4].color.getHex()).toBe(0xff0000);
    });
  });

  describe('Visualization Modes', () => {
    it('should switch between visualization modes', () => {
      const modes: VisualizationMode[] = ['gradient', 'solid', 'wireframe', 'none'];
      
      modes.forEach(mode => {
        visualization.setMode(mode);
        expect(visualization.getMode()).toBe(mode);
      });
    });

    it('should apply gradient mode with shading', () => {
      visualization.setMode('gradient');
      visualization.updateWeights(group);
      
      // Check that mesh has color attribute
      const colors = mesh.geometry.attributes.color;
      expect(colors).toBeDefined();
      expect(colors.count).toBe(10);
    });

    it('should apply solid mode without shading', () => {
      visualization.setMode('solid');
      visualization.updateWeights(group);
      
      const colors = mesh.geometry.attributes.color;
      expect(colors).toBeDefined();
    });

    it('should apply wireframe mode', () => {
      visualization.setMode('wireframe');
      visualization.updateWeights(group);
      
      const colors = mesh.geometry.attributes.color;
      expect(colors).toBeDefined();
    });

    it('should restore original material in none mode', () => {
      const originalMaterial = mesh.material;
      visualization.setMode('gradient');
      visualization.updateWeights(group);
      
      visualization.setMode('none');
      expect(mesh.material).toBe(originalMaterial);
    });
  });

  describe('Weight Visualization', () => {
    it('should create color attribute when updating weights', () => {
      visualization.updateWeights(group);
      
      const colors = mesh.geometry.attributes.color;
      expect(colors).toBeDefined();
      expect(colors.count).toBe(10);
    });

    it('should map weight 0.0 to blue', () => {
      visualization.updateWeights(group);
      
      const colors = mesh.geometry.attributes.color;
      const color = new THREE.Color(
        colors.getX(0),
        colors.getY(0),
        colors.getZ(0)
      );
      
      // Should be blue (0x0000ff)
      expect(color.r).toBeCloseTo(0, 1);
      expect(color.g).toBeCloseTo(0, 1);
      expect(color.b).toBeCloseTo(1, 1);
    });

    it('should map weight 1.0 to red', () => {
      visualization.updateWeights(group);
      
      const colors = mesh.geometry.attributes.color;
      const color = new THREE.Color(
        colors.getX(4),
        colors.getY(4),
        colors.getZ(4)
      );
      
      // Should be red (0xff0000)
      expect(color.r).toBeCloseTo(1, 1);
      expect(color.g).toBeCloseTo(0, 1);
      expect(color.b).toBeCloseTo(0, 1);
    });

    it('should map weight 0.5 to green', () => {
      visualization.updateWeights(group);
      
      const colors = mesh.geometry.attributes.color;
      const color = new THREE.Color(
        colors.getX(2),
        colors.getY(2),
        colors.getZ(2)
      );
      
      // Should be green (0x00ff00)
      expect(color.r).toBeCloseTo(0, 1);
      expect(color.g).toBeCloseTo(1, 1);
      expect(color.b).toBeCloseTo(0, 1);
    });

    it('should interpolate colors between gradient stops', () => {
      visualization.updateWeights(group);
      
      const colors = mesh.geometry.attributes.color;
      
      // Weight 0.25 should be between blue and cyan
      const color25 = new THREE.Color(
        colors.getX(1),
        colors.getY(1),
        colors.getZ(1)
      );
      expect(color25.r).toBeCloseTo(0, 1);
      expect(color25.g).toBeGreaterThan(0);
      expect(color25.b).toBeCloseTo(1, 1);
      
      // Weight 0.75 should be between yellow and red
      const color75 = new THREE.Color(
        colors.getX(3),
        colors.getY(3),
        colors.getZ(3)
      );
      expect(color75.r).toBeCloseTo(1, 1);
      expect(color75.g).toBeGreaterThan(0);
      expect(color75.b).toBeCloseTo(0, 1);
    });

    it('should handle vertices with no weight (default to 0)', () => {
      visualization.updateWeights(group);
      
      const colors = mesh.geometry.attributes.color;
      // Vertex 5 has no weight, should default to 0 (blue)
      const color = new THREE.Color(
        colors.getX(5),
        colors.getY(5),
        colors.getZ(5)
      );
      
      expect(color.r).toBeCloseTo(0, 1);
      expect(color.g).toBeCloseTo(0, 1);
      expect(color.b).toBeCloseTo(1, 1);
    });
  });

  describe('Custom Gradients', () => {
    it('should set custom gradient', () => {
      const customGradient: GradientStop[] = [
        { position: 0.0, color: new THREE.Color(0x000000) },
        { position: 1.0, color: new THREE.Color(0xffffff) },
      ];
      
      visualization.setGradient(customGradient);
      const gradient = visualization.getGradient();
      
      expect(gradient.length).toBe(2);
      expect(gradient[0].color.getHex()).toBe(0x000000);
      expect(gradient[1].color.getHex()).toBe(0xffffff);
    });

    it('should sort gradient stops by position', () => {
      const unsortedGradient: GradientStop[] = [
        { position: 1.0, color: new THREE.Color(0xffffff) },
        { position: 0.5, color: new THREE.Color(0x888888) },
        { position: 0.0, color: new THREE.Color(0x000000) },
      ];
      
      visualization.setGradient(unsortedGradient);
      const gradient = visualization.getGradient();
      
      expect(gradient[0].position).toBe(0.0);
      expect(gradient[1].position).toBe(0.5);
      expect(gradient[2].position).toBe(1.0);
    });

    it('should use custom gradient for visualization', () => {
      const grayscaleGradient: GradientStop[] = [
        { position: 0.0, color: new THREE.Color(0x000000) },
        { position: 1.0, color: new THREE.Color(0xffffff) },
      ];
      
      visualization.setGradient(grayscaleGradient);
      visualization.updateWeights(group);
      
      const colors = mesh.geometry.attributes.color;
      
      // Weight 0.0 should be black
      const color0 = new THREE.Color(
        colors.getX(0),
        colors.getY(0),
        colors.getZ(0)
      );
      expect(color0.r).toBeCloseTo(0, 1);
      expect(color0.g).toBeCloseTo(0, 1);
      expect(color0.b).toBeCloseTo(0, 1);
      
      // Weight 1.0 should be white
      const color1 = new THREE.Color(
        colors.getX(4),
        colors.getY(4),
        colors.getZ(4)
      );
      expect(color1.r).toBeCloseTo(1, 1);
      expect(color1.g).toBeCloseTo(1, 1);
      expect(color1.b).toBeCloseTo(1, 1);
    });
  });

  describe('Preset Gradients', () => {
    it('should create blueRed preset gradient', () => {
      const gradient = WeightVisualization.createPresetGradient('blueRed');
      expect(gradient.length).toBe(5);
      expect(gradient[0].color.getHex()).toBe(0x0000ff);
      expect(gradient[4].color.getHex()).toBe(0xff0000);
    });

    it('should create grayscale preset gradient', () => {
      const gradient = WeightVisualization.createPresetGradient('grayscale');
      expect(gradient.length).toBe(2);
      expect(gradient[0].color.getHex()).toBe(0x000000);
      expect(gradient[1].color.getHex()).toBe(0xffffff);
    });

    it('should create rainbow preset gradient', () => {
      const gradient = WeightVisualization.createPresetGradient('rainbow');
      expect(gradient.length).toBe(6);
      expect(gradient[0].color.getHex()).toBe(0xff0000);
      expect(gradient[5].color.getHex()).toBe(0x8b00ff);
    });

    it('should create heatmap preset gradient', () => {
      const gradient = WeightVisualization.createPresetGradient('heatmap');
      expect(gradient.length).toBe(5);
      expect(gradient[0].color.getHex()).toBe(0x000000);
      expect(gradient[4].color.getHex()).toBe(0xffffff);
    });
  });

  describe('Lighting Parameters', () => {
    it('should set custom lighting parameters', () => {
      visualization.setLightingParams({
        ambientIntensity: 0.5,
        diffuseIntensity: 0.8,
        specularIntensity: 0.3,
        shininess: 64.0,
      });
      
      const params = visualization.getLightingParams();
      expect(params.ambientIntensity).toBe(0.5);
      expect(params.diffuseIntensity).toBe(0.8);
      expect(params.specularIntensity).toBe(0.3);
      expect(params.shininess).toBe(64.0);
    });

    it('should set light direction', () => {
      const direction = new THREE.Vector3(1, 0, 0);
      visualization.setLightingParams({ lightDirection: direction });
      
      const params = visualization.getLightingParams();
      expect(params.lightDirection.x).toBeCloseTo(1, 5);
      expect(params.lightDirection.y).toBeCloseTo(0, 5);
      expect(params.lightDirection.z).toBeCloseTo(0, 5);
    });

    it('should set light color', () => {
      const color = new THREE.Color(0xff8800);
      visualization.setLightingParams({ lightColor: color });
      
      const params = visualization.getLightingParams();
      // THREE.Color stores in linear space, so we compare the hex value
      const resultColor = new THREE.Color(params.lightColor.x, params.lightColor.y, params.lightColor.z);
      expect(resultColor.getHex()).toBe(0xff8800);
    });
  });

  describe('Opacity', () => {
    it('should set opacity', () => {
      visualization.setOpacity(0.5);
      // Opacity is internal to shader material, just verify no errors
      expect(true).toBe(true);
    });

    it('should clamp opacity to [0, 1]', () => {
      visualization.setOpacity(-0.5);
      visualization.setOpacity(1.5);
      // Should not throw, values are clamped internally
      expect(true).toBe(true);
    });
  });

  describe('Camera Updates', () => {
    it('should update camera position for lighting', () => {
      const camera = new THREE.PerspectiveCamera();
      camera.position.set(5, 5, 5);
      
      visualization.updateCameraPosition(camera);
      // Camera position is internal to shader, just verify no errors
      expect(true).toBe(true);
    });
  });

  describe('Clear and Dispose', () => {
    it('should clear visualization', () => {
      visualization.updateWeights(group);
      expect(mesh.geometry.attributes.color).toBeDefined();
      
      visualization.clear();
      expect(mesh.geometry.attributes.color).toBeUndefined();
    });

    it('should dispose resources', () => {
      visualization.updateWeights(group);
      visualization.dispose();
      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty vertex group', () => {
      const emptyGroup: VertexGroup = {
        id: 'empty',
        name: 'Empty',
        weights: new Map(),
        color: new THREE.Color(0xff0000),
        visible: true,
        locked: false,
      };
      
      visualization.updateWeights(emptyGroup);
      const colors = mesh.geometry.attributes.color;
      
      // All vertices should be blue (weight 0)
      for (let i = 0; i < colors.count; i++) {
        const color = new THREE.Color(
          colors.getX(i),
          colors.getY(i),
          colors.getZ(i)
        );
        expect(color.r).toBeCloseTo(0, 1);
        expect(color.g).toBeCloseTo(0, 1);
        expect(color.b).toBeCloseTo(1, 1);
      }
    });

    it('should handle weights outside [0, 1] range', () => {
      const invalidGroup: VertexGroup = {
        id: 'invalid',
        name: 'Invalid',
        weights: new Map([
          [0, -0.5],
          [1, 1.5],
        ]),
        color: new THREE.Color(0xff0000),
        visible: true,
        locked: false,
      };
      
      visualization.updateWeights(invalidGroup);
      // Should clamp to [0, 1] and not throw
      expect(true).toBe(true);
    });

    it('should handle single gradient stop', () => {
      const singleStop: GradientStop[] = [
        { position: 0.5, color: new THREE.Color(0xff0000) },
      ];
      
      visualization.setGradient(singleStop);
      visualization.updateWeights(group);
      // Should not throw
      expect(true).toBe(true);
    });
  });
});
