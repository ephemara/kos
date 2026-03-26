/**
 * LayerSystem Tests
 * 
 * Tests for the layer-based compositing workflow system.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as THREE from 'three';
import { LayerSystem } from '../layerSystem';
import type { BlendMode } from '../blendModes';

describe('LayerSystem', () => {
  let layerSystem: LayerSystem;

  beforeEach(() => {
    // Create layer system without renderer (renderer is optional)
    layerSystem = new LayerSystem(undefined, {
      width: 1920,
      height: 1080,
      backgroundColor: new THREE.Color(0x000000),
    });
  });

  describe('Layer Creation and Management', () => {
    it('should add a layer to the stack', () => {
      const layerId = layerSystem.addLayer('Test Layer');
      
      expect(layerId).toBeDefined();
      expect(layerSystem.hasLayer(layerId)).toBe(true);
      expect(layerSystem.getLayerCount()).toBe(1);
      
      const layer = layerSystem.getLayer(layerId);
      expect(layer).toBeDefined();
      expect(layer?.name).toBe('Test Layer');
      expect(layer?.blendMode).toBe('normal');
      expect(layer?.opacity).toBe(1.0);
      expect(layer?.visible).toBe(true);
      expect(layer?.locked).toBe(false);
      expect(layer?.order).toBe(0);
    });

    it('should add multiple layers in correct order', () => {
      const layer1 = layerSystem.addLayer('Layer 1');
      const layer2 = layerSystem.addLayer('Layer 2');
      const layer3 = layerSystem.addLayer('Layer 3');

      const layers = layerSystem.getLayers();
      expect(layers).toHaveLength(3);
      expect(layers[0].id).toBe(layer1);
      expect(layers[1].id).toBe(layer2);
      expect(layers[2].id).toBe(layer3);
      expect(layers[0].order).toBe(0);
      expect(layers[1].order).toBe(1);
      expect(layers[2].order).toBe(2);
    });

    it('should remove a layer from the stack', () => {
      const layer1 = layerSystem.addLayer('Layer 1');
      const layer2 = layerSystem.addLayer('Layer 2');
      const layer3 = layerSystem.addLayer('Layer 3');

      const removed = layerSystem.removeLayer(layer2);
      
      expect(removed).toBe(true);
      expect(layerSystem.hasLayer(layer2)).toBe(false);
      expect(layerSystem.getLayerCount()).toBe(2);
      
      const layers = layerSystem.getLayers();
      expect(layers).toHaveLength(2);
      expect(layers[0].id).toBe(layer1);
      expect(layers[1].id).toBe(layer3);
      
      // Check that orders are updated
      expect(layers[0].order).toBe(0);
      expect(layers[1].order).toBe(1);
    });

    it('should return false when removing non-existent layer', () => {
      const removed = layerSystem.removeLayer('non-existent-id');
      expect(removed).toBe(false);
    });

    it('should get layers in reverse order', () => {
      const layer1 = layerSystem.addLayer('Layer 1');
      const layer2 = layerSystem.addLayer('Layer 2');
      const layer3 = layerSystem.addLayer('Layer 3');

      const reversed = layerSystem.getLayersReversed();
      expect(reversed).toHaveLength(3);
      expect(reversed[0].id).toBe(layer3);
      expect(reversed[1].id).toBe(layer2);
      expect(reversed[2].id).toBe(layer1);
    });
  });

  describe('Layer Properties', () => {
    it('should set layer blend mode', () => {
      const layerId = layerSystem.addLayer('Test Layer');
      const blendModes: BlendMode[] = ['multiply', 'screen', 'overlay', 'add'];

      blendModes.forEach(mode => {
        const success = layerSystem.setLayerBlendMode(layerId, mode);
        expect(success).toBe(true);
        
        const layer = layerSystem.getLayer(layerId);
        expect(layer?.blendMode).toBe(mode);
      });
    });

    it('should set layer opacity with clamping', () => {
      const layerId = layerSystem.addLayer('Test Layer');

      // Valid opacity
      layerSystem.setLayerOpacity(layerId, 0.5);
      expect(layerSystem.getLayer(layerId)?.opacity).toBe(0.5);

      // Clamp to 0
      layerSystem.setLayerOpacity(layerId, -0.5);
      expect(layerSystem.getLayer(layerId)?.opacity).toBe(0);

      // Clamp to 1
      layerSystem.setLayerOpacity(layerId, 1.5);
      expect(layerSystem.getLayer(layerId)?.opacity).toBe(1);
    });

    it('should set layer visibility', () => {
      const layerId = layerSystem.addLayer('Test Layer');

      layerSystem.setLayerVisibility(layerId, false);
      expect(layerSystem.getLayer(layerId)?.visible).toBe(false);

      layerSystem.setLayerVisibility(layerId, true);
      expect(layerSystem.getLayer(layerId)?.visible).toBe(true);
    });

    it('should toggle layer visibility', () => {
      const layerId = layerSystem.addLayer('Test Layer');
      const initialVisibility = layerSystem.getLayer(layerId)?.visible;

      layerSystem.toggleLayerVisibility(layerId);
      expect(layerSystem.getLayer(layerId)?.visible).toBe(!initialVisibility);

      layerSystem.toggleLayerVisibility(layerId);
      expect(layerSystem.getLayer(layerId)?.visible).toBe(initialVisibility);
    });

    it('should set layer locked state', () => {
      const layerId = layerSystem.addLayer('Test Layer');

      layerSystem.setLayerLocked(layerId, true);
      expect(layerSystem.getLayer(layerId)?.locked).toBe(true);

      layerSystem.setLayerLocked(layerId, false);
      expect(layerSystem.getLayer(layerId)?.locked).toBe(false);
    });

    it('should rename a layer', () => {
      const layerId = layerSystem.addLayer('Original Name');

      layerSystem.renameLayer(layerId, 'New Name');
      expect(layerSystem.getLayer(layerId)?.name).toBe('New Name');
    });

    it('should set layer texture', () => {
      const layerId = layerSystem.addLayer('Test Layer');
      const texture = new THREE.Texture();

      layerSystem.setLayerTexture(layerId, texture);
      expect(layerSystem.getLayer(layerId)?.texture).toBe(texture);

      layerSystem.setLayerTexture(layerId, null);
      expect(layerSystem.getLayer(layerId)?.texture).toBeNull();
    });
  });

  describe('Layer Reordering', () => {
    it('should move a layer to a new position', () => {
      const layer1 = layerSystem.addLayer('Layer 1');
      const layer2 = layerSystem.addLayer('Layer 2');
      const layer3 = layerSystem.addLayer('Layer 3');

      // Move layer 1 to position 2 (top)
      layerSystem.moveLayer(layer1, 2);

      const layers = layerSystem.getLayers();
      expect(layers[0].id).toBe(layer2);
      expect(layers[1].id).toBe(layer3);
      expect(layers[2].id).toBe(layer1);
      expect(layers[0].order).toBe(0);
      expect(layers[1].order).toBe(1);
      expect(layers[2].order).toBe(2);
    });

    it('should move a layer up in the stack', () => {
      const layer1 = layerSystem.addLayer('Layer 1');
      const layer2 = layerSystem.addLayer('Layer 2');
      const layer3 = layerSystem.addLayer('Layer 3');

      layerSystem.moveLayerUp(layer1);

      const layers = layerSystem.getLayers();
      expect(layers[0].id).toBe(layer2);
      expect(layers[1].id).toBe(layer1);
      expect(layers[2].id).toBe(layer3);
    });

    it('should not move top layer up', () => {
      const layer1 = layerSystem.addLayer('Layer 1');
      const layer2 = layerSystem.addLayer('Layer 2');

      const success = layerSystem.moveLayerUp(layer2);
      expect(success).toBe(false);

      const layers = layerSystem.getLayers();
      expect(layers[0].id).toBe(layer1);
      expect(layers[1].id).toBe(layer2);
    });

    it('should move a layer down in the stack', () => {
      const layer1 = layerSystem.addLayer('Layer 1');
      const layer2 = layerSystem.addLayer('Layer 2');
      const layer3 = layerSystem.addLayer('Layer 3');

      layerSystem.moveLayerDown(layer3);

      const layers = layerSystem.getLayers();
      expect(layers[0].id).toBe(layer1);
      expect(layers[1].id).toBe(layer3);
      expect(layers[2].id).toBe(layer2);
    });

    it('should not move bottom layer down', () => {
      const layer1 = layerSystem.addLayer('Layer 1');
      const layer2 = layerSystem.addLayer('Layer 2');

      const success = layerSystem.moveLayerDown(layer1);
      expect(success).toBe(false);

      const layers = layerSystem.getLayers();
      expect(layers[0].id).toBe(layer1);
      expect(layers[1].id).toBe(layer2);
    });
  });

  describe('Layer Operations', () => {
    it('should duplicate a layer', () => {
      const originalId = layerSystem.addLayer('Original Layer');
      layerSystem.setLayerBlendMode(originalId, 'multiply');
      layerSystem.setLayerOpacity(originalId, 0.7);
      layerSystem.setLayerVisibility(originalId, false);

      const duplicateId = layerSystem.duplicateLayer(originalId);
      
      expect(duplicateId).not.toBeNull();
      expect(duplicateId).not.toBe(originalId);
      expect(layerSystem.getLayerCount()).toBe(2);

      const duplicate = layerSystem.getLayer(duplicateId!);
      expect(duplicate?.name).toBe('Original Layer Copy');
      expect(duplicate?.blendMode).toBe('multiply');
      expect(duplicate?.opacity).toBe(0.7);
      expect(duplicate?.visible).toBe(false);

      // Duplicate should be above original
      const layers = layerSystem.getLayers();
      expect(layers[0].id).toBe(originalId);
      expect(layers[1].id).toBe(duplicateId);
    });

    it('should return null when duplicating non-existent layer', () => {
      const duplicateId = layerSystem.duplicateLayer('non-existent-id');
      expect(duplicateId).toBeNull();
    });

    it('should clear all layers', () => {
      layerSystem.addLayer('Layer 1');
      layerSystem.addLayer('Layer 2');
      layerSystem.addLayer('Layer 3');

      expect(layerSystem.getLayerCount()).toBe(3);

      layerSystem.clear();

      expect(layerSystem.getLayerCount()).toBe(0);
      expect(layerSystem.getLayers()).toHaveLength(0);
    });
  });

  describe('Configuration Export/Import', () => {
    it('should export layer configuration', () => {
      const layer1 = layerSystem.addLayer('Layer 1');
      const layer2 = layerSystem.addLayer('Layer 2');
      
      layerSystem.setLayerBlendMode(layer1, 'multiply');
      layerSystem.setLayerOpacity(layer1, 0.8);
      layerSystem.setLayerVisibility(layer2, false);
      layerSystem.setLayerLocked(layer2, true);

      const config = layerSystem.exportConfig();

      expect(config.width).toBe(1920);
      expect(config.height).toBe(1080);
      expect(config.backgroundColor).toBe(0x000000);
      expect(config.layers).toHaveLength(2);
      
      expect(config.layers[0].name).toBe('Layer 1');
      expect(config.layers[0].blendMode).toBe('multiply');
      expect(config.layers[0].opacity).toBe(0.8);
      expect(config.layers[0].visible).toBe(true);
      expect(config.layers[0].locked).toBe(false);
      
      expect(config.layers[1].name).toBe('Layer 2');
      expect(config.layers[1].visible).toBe(false);
      expect(config.layers[1].locked).toBe(true);
    });

    it('should import layer configuration', () => {
      const config = {
        width: 2560,
        height: 1440,
        backgroundColor: 0xff0000,
        layers: [
          {
            id: 'old-id-1',
            name: 'Imported Layer 1',
            blendMode: 'screen',
            opacity: 0.6,
            visible: true,
            locked: false,
            order: 0,
          },
          {
            id: 'old-id-2',
            name: 'Imported Layer 2',
            blendMode: 'overlay',
            opacity: 0.9,
            visible: false,
            locked: true,
            order: 1,
          },
        ],
      };

      layerSystem.importConfig(config);

      expect(layerSystem.getLayerCount()).toBe(2);
      
      const layers = layerSystem.getLayers();
      expect(layers[0].name).toBe('Imported Layer 1');
      expect(layers[0].blendMode).toBe('screen');
      expect(layers[0].opacity).toBe(0.6);
      expect(layers[0].visible).toBe(true);
      expect(layers[0].locked).toBe(false);
      
      expect(layers[1].name).toBe('Imported Layer 2');
      expect(layers[1].blendMode).toBe('overlay');
      expect(layers[1].opacity).toBe(0.9);
      expect(layers[1].visible).toBe(false);
      expect(layers[1].locked).toBe(true);
    });

    it('should clear existing layers when importing', () => {
      layerSystem.addLayer('Existing Layer 1');
      layerSystem.addLayer('Existing Layer 2');

      const config = {
        layers: [
          {
            id: 'new-id',
            name: 'New Layer',
            blendMode: 'normal',
            opacity: 1.0,
            visible: true,
            locked: false,
            order: 0,
          },
        ],
      };

      layerSystem.importConfig(config);

      expect(layerSystem.getLayerCount()).toBe(1);
      expect(layerSystem.getLayers()[0].name).toBe('New Layer');
    });
  });

  describe('Requirement 13.5 Validation', () => {
    it('should support all blend modes from blendModes.ts', () => {
      const layerId = layerSystem.addLayer('Test Layer');
      
      const blendModes: BlendMode[] = [
        'normal', 'multiply', 'screen', 'overlay', 'add', 'subtract',
        'divide', 'difference', 'darken', 'lighten', 'colorDodge',
        'colorBurn', 'hardLight', 'softLight', 'exclusion'
      ];

      blendModes.forEach(mode => {
        const success = layerSystem.setLayerBlendMode(layerId, mode);
        expect(success).toBe(true);
        expect(layerSystem.getLayer(layerId)?.blendMode).toBe(mode);
      });
    });

    it('should manage layer stack (add, remove, reorder)', () => {
      // Add layers
      const layer1 = layerSystem.addLayer('Layer 1');
      const layer2 = layerSystem.addLayer('Layer 2');
      const layer3 = layerSystem.addLayer('Layer 3');
      expect(layerSystem.getLayerCount()).toBe(3);

      // Reorder
      layerSystem.moveLayer(layer1, 2);
      const layers = layerSystem.getLayers();
      expect(layers[2].id).toBe(layer1);

      // Remove
      layerSystem.removeLayer(layer2);
      expect(layerSystem.getLayerCount()).toBe(2);
      expect(layerSystem.hasLayer(layer2)).toBe(false);
    });

    it('should toggle layer visibility', () => {
      const layerId = layerSystem.addLayer('Test Layer');
      
      expect(layerSystem.getLayer(layerId)?.visible).toBe(true);
      
      layerSystem.setLayerVisibility(layerId, false);
      expect(layerSystem.getLayer(layerId)?.visible).toBe(false);
      
      layerSystem.toggleLayerVisibility(layerId);
      expect(layerSystem.getLayer(layerId)?.visible).toBe(true);
    });

    it('should control layer opacity in 0-1 range', () => {
      const layerId = layerSystem.addLayer('Test Layer');

      // Test valid range
      [0, 0.25, 0.5, 0.75, 1.0].forEach(opacity => {
        layerSystem.setLayerOpacity(layerId, opacity);
        expect(layerSystem.getLayer(layerId)?.opacity).toBe(opacity);
      });

      // Test clamping
      layerSystem.setLayerOpacity(layerId, -1);
      expect(layerSystem.getLayer(layerId)?.opacity).toBe(0);

      layerSystem.setLayerOpacity(layerId, 2);
      expect(layerSystem.getLayer(layerId)?.opacity).toBe(1);
    });
  });
});
