/**
 * LayerSystem - Layer-based compositing workflow
 * 
 * Provides a layer stack management system that sits on top of the node graph,
 * offering a more traditional layer-based compositing workflow with blend modes
 * and opacity control.
 */

import * as THREE from 'three';
import { BlendMode, BlendModeShader } from './blendModes';

export type LayerId = string;

export interface Layer {
  id: LayerId;
  name: string;
  blendMode: BlendMode;
  opacity: number;
  visible: boolean;
  texture: THREE.Texture | null;
  locked: boolean;
  order: number; // Stack order (0 = bottom, higher = top)
}

export interface LayerStackOptions {
  width?: number;
  height?: number;
  backgroundColor?: THREE.Color;
}

export class LayerSystem {
  private layers: Map<LayerId, Layer>;
  private layerOrder: LayerId[]; // Ordered list of layer IDs (bottom to top)
  private blendModeShader: BlendModeShader;
  private renderer: THREE.WebGLRenderer | null;
  private width: number;
  private height: number;
  private backgroundColor: THREE.Color;
  private compositeTexture: THREE.Texture | null = null;

  constructor(renderer?: THREE.WebGLRenderer, options: LayerStackOptions = {}) {
    this.layers = new Map();
    this.layerOrder = [];
    this.blendModeShader = new BlendModeShader();
    this.renderer = renderer || null;
    this.width = options.width || 1920;
    this.height = options.height || 1080;
    this.backgroundColor = options.backgroundColor || new THREE.Color(0x000000);
  }

  /**
   * Set the WebGL renderer for GPU-accelerated blending
   */
  setRenderer(renderer: THREE.WebGLRenderer): void {
    this.renderer = renderer;
  }

  /**
   * Set the canvas dimensions
   */
  setDimensions(width: number, height: number): void {
    this.width = width;
    this.height = height;
  }

  /**
   * Set the background color
   */
  setBackgroundColor(color: THREE.Color): void {
    this.backgroundColor = color;
  }

  /**
   * Add a new layer to the stack
   */
  addLayer(name: string, texture?: THREE.Texture): LayerId {
    const id = `layer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const order = this.layerOrder.length;
    
    const layer: Layer = {
      id,
      name,
      blendMode: 'normal',
      opacity: 1.0,
      visible: true,
      texture: texture || null,
      locked: false,
      order,
    };

    this.layers.set(id, layer);
    this.layerOrder.push(id);

    console.log(`[LayerSystem] Added layer: ${name} (${id}) at order ${order}`);
    return id;
  }

  /**
   * Remove a layer from the stack
   */
  removeLayer(id: LayerId): boolean {
    const layer = this.layers.get(id);
    if (!layer) {
      console.warn(`[LayerSystem] Layer not found: ${id}`);
      return false;
    }

    // Remove from order array
    const index = this.layerOrder.indexOf(id);
    if (index !== -1) {
      this.layerOrder.splice(index, 1);
    }

    // Update order values for remaining layers
    this.updateLayerOrders();

    // Remove from map
    this.layers.delete(id);

    console.log(`[LayerSystem] Removed layer: ${id}`);
    return true;
  }

  /**
   * Get a layer by ID
   */
  getLayer(id: LayerId): Layer | undefined {
    return this.layers.get(id);
  }

  /**
   * Get all layers in stack order (bottom to top)
   */
  getLayers(): Layer[] {
    return this.layerOrder
      .map(id => this.layers.get(id))
      .filter((layer): layer is Layer => layer !== undefined);
  }

  /**
   * Get all layers in reverse order (top to bottom)
   */
  getLayersReversed(): Layer[] {
    return this.getLayers().reverse();
  }

  /**
   * Set layer blend mode
   */
  setLayerBlendMode(id: LayerId, mode: BlendMode): boolean {
    const layer = this.layers.get(id);
    if (!layer) {
      console.warn(`[LayerSystem] Layer not found: ${id}`);
      return false;
    }

    layer.blendMode = mode;
    console.log(`[LayerSystem] Set blend mode for ${id}: ${mode}`);
    return true;
  }

  /**
   * Set layer opacity (0-1 range)
   */
  setLayerOpacity(id: LayerId, opacity: number): boolean {
    const layer = this.layers.get(id);
    if (!layer) {
      console.warn(`[LayerSystem] Layer not found: ${id}`);
      return false;
    }

    // Clamp opacity to valid range
    layer.opacity = Math.max(0, Math.min(1, opacity));
    console.log(`[LayerSystem] Set opacity for ${id}: ${layer.opacity}`);
    return true;
  }

  /**
   * Set layer visibility
   */
  setLayerVisibility(id: LayerId, visible: boolean): boolean {
    const layer = this.layers.get(id);
    if (!layer) {
      console.warn(`[LayerSystem] Layer not found: ${id}`);
      return false;
    }

    layer.visible = visible;
    console.log(`[LayerSystem] Set visibility for ${id}: ${visible}`);
    return true;
  }

  /**
   * Toggle layer visibility
   */
  toggleLayerVisibility(id: LayerId): boolean {
    const layer = this.layers.get(id);
    if (!layer) {
      console.warn(`[LayerSystem] Layer not found: ${id}`);
      return false;
    }

    layer.visible = !layer.visible;
    console.log(`[LayerSystem] Toggled visibility for ${id}: ${layer.visible}`);
    return true;
  }

  /**
   * Set layer locked state
   */
  setLayerLocked(id: LayerId, locked: boolean): boolean {
    const layer = this.layers.get(id);
    if (!layer) {
      console.warn(`[LayerSystem] Layer not found: ${id}`);
      return false;
    }

    layer.locked = locked;
    console.log(`[LayerSystem] Set locked for ${id}: ${locked}`);
    return true;
  }

  /**
   * Rename a layer
   */
  renameLayer(id: LayerId, name: string): boolean {
    const layer = this.layers.get(id);
    if (!layer) {
      console.warn(`[LayerSystem] Layer not found: ${id}`);
      return false;
    }

    layer.name = name;
    console.log(`[LayerSystem] Renamed layer ${id}: ${name}`);
    return true;
  }

  /**
   * Set layer texture
   */
  setLayerTexture(id: LayerId, texture: THREE.Texture | null): boolean {
    const layer = this.layers.get(id);
    if (!layer) {
      console.warn(`[LayerSystem] Layer not found: ${id}`);
      return false;
    }

    layer.texture = texture;
    console.log(`[LayerSystem] Set texture for ${id}`);
    return true;
  }

  /**
   * Move a layer to a new position in the stack
   */
  moveLayer(id: LayerId, newOrder: number): boolean {
    const layer = this.layers.get(id);
    if (!layer) {
      console.warn(`[LayerSystem] Layer not found: ${id}`);
      return false;
    }

    // Remove from current position
    const currentIndex = this.layerOrder.indexOf(id);
    if (currentIndex === -1) {
      console.warn(`[LayerSystem] Layer not in order array: ${id}`);
      return false;
    }

    this.layerOrder.splice(currentIndex, 1);

    // Clamp new order to valid range
    const clampedOrder = Math.max(0, Math.min(this.layerOrder.length, newOrder));

    // Insert at new position
    this.layerOrder.splice(clampedOrder, 0, id);

    // Update order values
    this.updateLayerOrders();

    console.log(`[LayerSystem] Moved layer ${id} to order ${clampedOrder}`);
    return true;
  }

  /**
   * Move a layer up in the stack (towards top)
   */
  moveLayerUp(id: LayerId): boolean {
    const layer = this.layers.get(id);
    if (!layer) return false;

    const currentIndex = this.layerOrder.indexOf(id);
    if (currentIndex === -1 || currentIndex === this.layerOrder.length - 1) {
      return false; // Already at top
    }

    return this.moveLayer(id, layer.order + 1);
  }

  /**
   * Move a layer down in the stack (towards bottom)
   */
  moveLayerDown(id: LayerId): boolean {
    const layer = this.layers.get(id);
    if (!layer) return false;

    const currentIndex = this.layerOrder.indexOf(id);
    if (currentIndex === -1 || currentIndex === 0) {
      return false; // Already at bottom
    }

    return this.moveLayer(id, layer.order - 1);
  }

  /**
   * Duplicate a layer
   */
  duplicateLayer(id: LayerId): LayerId | null {
    const layer = this.layers.get(id);
    if (!layer) {
      console.warn(`[LayerSystem] Layer not found: ${id}`);
      return null;
    }

    const newId = this.addLayer(`${layer.name} Copy`, layer.texture);
    const newLayer = this.layers.get(newId);
    
    if (newLayer) {
      newLayer.blendMode = layer.blendMode;
      newLayer.opacity = layer.opacity;
      newLayer.visible = layer.visible;
      
      // Move to position right above the original
      this.moveLayer(newId, layer.order + 1);
    }

    console.log(`[LayerSystem] Duplicated layer ${id} -> ${newId}`);
    return newId;
  }

  /**
   * Merge a layer down with the layer below it
   */
  mergeLayerDown(id: LayerId): boolean {
    const layer = this.layers.get(id);
    if (!layer) {
      console.warn(`[LayerSystem] Layer not found: ${id}`);
      return false;
    }

    const currentIndex = this.layerOrder.indexOf(id);
    if (currentIndex === -1 || currentIndex === 0) {
      console.warn(`[LayerSystem] Cannot merge bottom layer`);
      return false;
    }

    const belowLayerId = this.layerOrder[currentIndex - 1];
    const belowLayer = this.layers.get(belowLayerId);
    
    if (!belowLayer) {
      console.warn(`[LayerSystem] Layer below not found`);
      return false;
    }

    // Composite the two layers
    if (this.renderer && layer.texture && belowLayer.texture) {
      const merged = this.blendModeShader.blend(
        this.renderer,
        belowLayer.texture,
        layer.texture,
        layer.blendMode,
        layer.opacity
      );
      
      belowLayer.texture = merged;
    }

    // Remove the top layer
    this.removeLayer(id);

    console.log(`[LayerSystem] Merged layer ${id} down into ${belowLayerId}`);
    return true;
  }

  /**
   * Flatten all layers into a single layer
   */
  flattenLayers(): LayerId | null {
    if (this.layerOrder.length === 0) {
      console.warn(`[LayerSystem] No layers to flatten`);
      return null;
    }

    // Composite all layers
    const composite = this.composite();
    if (!composite) {
      console.warn(`[LayerSystem] Failed to composite layers`);
      return null;
    }

    // Clear all layers
    this.layerOrder.forEach(id => this.layers.delete(id));
    this.layerOrder = [];

    // Create a single flattened layer
    const flattenedId = this.addLayer('Flattened', composite);

    console.log(`[LayerSystem] Flattened all layers into ${flattenedId}`);
    return flattenedId;
  }

  /**
   * Composite all visible layers into a single texture
   */
  composite(): THREE.Texture | null {
    if (!this.renderer) {
      console.error('[LayerSystem] No renderer available for compositing');
      return null;
    }

    // Create background texture
    let result = this.createBackgroundTexture();

    // Composite layers from bottom to top
    for (const id of this.layerOrder) {
      const layer = this.layers.get(id);
      if (!layer || !layer.visible || !layer.texture) {
        continue;
      }

      // Blend this layer with the result
      result = this.blendModeShader.blend(
        this.renderer,
        result,
        layer.texture,
        layer.blendMode,
        layer.opacity
      );
    }

    this.compositeTexture = result;
    return result;
  }

  /**
   * Get the current composite texture (cached)
   */
  getComposite(): THREE.Texture | null {
    return this.compositeTexture;
  }

  /**
   * Clear all layers
   */
  clear(): void {
    this.layers.clear();
    this.layerOrder = [];
    this.compositeTexture = null;
    console.log('[LayerSystem] Cleared all layers');
  }

  /**
   * Get layer count
   */
  getLayerCount(): number {
    return this.layers.size;
  }

  /**
   * Check if a layer exists
   */
  hasLayer(id: LayerId): boolean {
    return this.layers.has(id);
  }

  /**
   * Update order values for all layers based on their position in layerOrder array
   */
  private updateLayerOrders(): void {
    this.layerOrder.forEach((id, index) => {
      const layer = this.layers.get(id);
      if (layer) {
        layer.order = index;
      }
    });
  }

  /**
   * Create a background texture with the background color
   */
  private createBackgroundTexture(): THREE.Texture {
    if (!this.renderer) {
      // Fallback: create a canvas texture
      const canvas = document.createElement('canvas');
      canvas.width = this.width;
      canvas.height = this.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = `#${this.backgroundColor.getHexString()}`;
        ctx.fillRect(0, 0, this.width, this.height);
      }
      return new THREE.CanvasTexture(canvas);
    }

    // Create a solid color texture using a shader
    const renderTarget = new THREE.WebGLRenderTarget(this.width, this.height, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.FloatType,
    });

    const material = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: this.backgroundColor },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        varying vec2 vUv;
        void main() {
          gl_FragColor = vec4(uColor, 1.0);
        }
      `,
    });

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const geometry = new THREE.PlaneGeometry(2, 2);
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    const currentRenderTarget = this.renderer.getRenderTarget();
    this.renderer.setRenderTarget(renderTarget);
    this.renderer.render(scene, camera);
    this.renderer.setRenderTarget(currentRenderTarget);

    geometry.dispose();
    material.dispose();

    return renderTarget.texture;
  }

  /**
   * Export layer stack configuration
   */
  exportConfig(): any {
    return {
      width: this.width,
      height: this.height,
      backgroundColor: this.backgroundColor.getHex(),
      layers: this.getLayers().map(layer => ({
        id: layer.id,
        name: layer.name,
        blendMode: layer.blendMode,
        opacity: layer.opacity,
        visible: layer.visible,
        locked: layer.locked,
        order: layer.order,
      })),
    };
  }

  /**
   * Import layer stack configuration
   */
  importConfig(config: any): void {
    this.clear();
    
    if (config.width) this.width = config.width;
    if (config.height) this.height = config.height;
    if (config.backgroundColor !== undefined) {
      this.backgroundColor = new THREE.Color(config.backgroundColor);
    }

    if (config.layers && Array.isArray(config.layers)) {
      // Sort by order
      const sortedLayers = [...config.layers].sort((a, b) => a.order - b.order);
      
      for (const layerConfig of sortedLayers) {
        const id = this.addLayer(layerConfig.name);
        const layer = this.layers.get(id);
        
        if (layer) {
          layer.blendMode = layerConfig.blendMode || 'normal';
          layer.opacity = layerConfig.opacity ?? 1.0;
          layer.visible = layerConfig.visible ?? true;
          layer.locked = layerConfig.locked ?? false;
        }
      }
    }

    console.log('[LayerSystem] Imported layer configuration');
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.blendModeShader.dispose();
    
    if (this.compositeTexture) {
      this.compositeTexture.dispose();
      this.compositeTexture = null;
    }

    this.layers.clear();
    this.layerOrder = [];
    
    console.log('[LayerSystem] Disposed');
  }
}
