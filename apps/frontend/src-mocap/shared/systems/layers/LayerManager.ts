/**
 * Universal Layer Manager
 * 
 * Generic layer management class that works for both 2D and 3D applications.
 * Provides methods for adding, removing, updating, and reordering layers,
 * with event emission for reactive UI updates.
 * 
 * @example
 * ```typescript
 * const manager = new LayerManager();
 * 
 * // Subscribe to layer changes
 * manager.on('layer-added', (event) => {
 *   console.log('Layer added:', event.layerId);
 * });
 * 
 * // Add a layer
 * manager.addLayer({ name: 'Background' });
 * 
 * // Update a layer
 * manager.updateLayer('layer-1', { opacity: 0.5 });
 * 
 * // Reorder layers
 * manager.reorderLayers(0, 2);
 * ```
 */

import type {
  Layer,
  LayerManager as ILayerManager,
  LayerEvent,
  LayerEventListener,
  LayerEventType,
  BlendMode
} from './LayerTypes';

/**
 * Default values for new layers.
 */
const DEFAULT_LAYER: Omit<Layer, 'id' | 'name'> = {
  visible: true,
  locked: false,
  solo: false,
  opacity: 1.0,
  blendMode: 'normal' as BlendMode
};

/**
 * LayerManager class implementation.
 * 
 * Manages a collection of layers with event emission for reactive updates.
 * Implements the LayerManager interface with additional event handling capabilities.
 */
export class LayerManager implements ILayerManager {
  /** Array of all layers in the stack (bottom to top) */
  public layers: Layer[] = [];

  /** ID of the currently active/selected layer, or null if none */
  public activeLayerId: string | null = null;

  /** Event listeners for layer changes */
  private listeners: Map<LayerEventType, Set<LayerEventListener>> = new Map();

  /** Counter for generating unique layer IDs */
  private layerIdCounter = 0;

  /**
   * Create a new LayerManager instance.
   * 
   * @param initialLayers - Optional array of initial layers
   */
  constructor(initialLayers?: Layer[]) {
    if (initialLayers && initialLayers.length > 0) {
      this.layers = [...initialLayers];
      // Set the highest ID counter to avoid conflicts
      const maxId = Math.max(
        ...initialLayers
          .map(l => parseInt(l.id.replace(/\D/g, ''), 10))
          .filter(n => !isNaN(n))
      );
      this.layerIdCounter = maxId + 1;
    }
  }

  /**
   * Generate a unique layer ID.
   * 
   * @returns A unique layer ID string
   */
  private generateLayerId(): string {
    return `layer-${this.layerIdCounter++}`;
  }

  /**
   * Emit a layer event to all registered listeners.
   * 
   * @param event - The layer event to emit
   */
  private emit(event: LayerEvent): void {
    const listeners = this.listeners.get(event.type);
    if (listeners) {
      listeners.forEach(listener => listener(event));
    }
  }

  /**
   * Subscribe to layer events.
   * 
   * @param eventType - Type of event to listen for
   * @param listener - Callback function to invoke when event occurs
   * @returns Unsubscribe function
   * 
   * @example
   * ```typescript
   * const unsubscribe = manager.on('layer-added', (event) => {
   *   console.log('Layer added:', event.layerId);
   * });
   * 
   * // Later, unsubscribe
   * unsubscribe();
   * ```
   */
  public on(eventType: LayerEventType, listener: LayerEventListener): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(listener);

    // Return unsubscribe function
    return () => {
      const listeners = this.listeners.get(eventType);
      if (listeners) {
        listeners.delete(listener);
      }
    };
  }

  /**
   * Unsubscribe from layer events.
   * 
   * @param eventType - Type of event to stop listening for
   * @param listener - Callback function to remove
   */
  public off(eventType: LayerEventType, listener: LayerEventListener): void {
    const listeners = this.listeners.get(eventType);
    if (listeners) {
      listeners.delete(listener);
    }
  }

  /**
   * Add a new layer to the stack.
   * 
   * Generates a unique ID and applies default values for any missing properties.
   * The new layer is added to the top of the stack and becomes the active layer.
   * 
   * @param layer - Partial layer object (id and defaults will be generated if not provided)
   * 
   * @example
   * ```typescript
   * manager.addLayer({ name: 'Background', opacity: 0.8 });
   * ```
   */
  public addLayer(layer: Partial<Layer>): void {
    const newLayer: Layer = {
      ...DEFAULT_LAYER,
      ...layer,
      id: layer.id || this.generateLayerId(),
      name: layer.name || `Layer ${this.layers.length + 1}`
    };

    this.layers.push(newLayer);
    this.activeLayerId = newLayer.id;

    this.emit({
      type: 'layer-added',
      layerId: newLayer.id,
      data: newLayer
    });
  }

  /**
   * Remove a layer from the stack.
   * 
   * If the removed layer was active, the active layer is set to the layer below it,
   * or null if no layers remain.
   * 
   * @param id - ID of the layer to remove
   * 
   * @example
   * ```typescript
   * manager.removeLayer('layer-1');
   * ```
   */
  public removeLayer(id: string): void {
    const index = this.layers.findIndex(l => l.id === id);
    if (index === -1) {
      console.warn(`Layer with id "${id}" not found`);
      return;
    }

    const removedLayer = this.layers[index];
    this.layers.splice(index, 1);

    // Update active layer if necessary
    if (this.activeLayerId === id) {
      if (this.layers.length > 0) {
        // Set active to the layer below, or the top layer if we removed the bottom
        const newActiveIndex = Math.max(0, index - 1);
        this.activeLayerId = this.layers[newActiveIndex]?.id || null;
      } else {
        this.activeLayerId = null;
      }
    }

    this.emit({
      type: 'layer-removed',
      layerId: id,
      data: removedLayer
    });
  }

  /**
   * Update properties of an existing layer.
   * 
   * Only the provided properties are updated; others remain unchanged.
   * 
   * @param id - ID of the layer to update
   * @param updates - Partial layer object with properties to update
   * 
   * @example
   * ```typescript
   * manager.updateLayer('layer-1', { opacity: 0.5, visible: false });
   * ```
   */
  public updateLayer(id: string, updates: Partial<Layer>): void {
    const layer = this.layers.find(l => l.id === id);
    if (!layer) {
      console.warn(`Layer with id "${id}" not found`);
      return;
    }

    // Apply updates (but don't allow changing the ID)
    const { id: _, ...safeUpdates } = updates;
    Object.assign(layer, safeUpdates);

    this.emit({
      type: 'layer-updated',
      layerId: id,
      data: { ...layer }
    });
  }

  /**
   * Reorder layers in the stack.
   * 
   * Moves a layer from one index to another, shifting other layers as needed.
   * 
   * @param fromIndex - Current index of the layer (0 = bottom)
   * @param toIndex - Target index for the layer (0 = bottom)
   * 
   * @example
   * ```typescript
   * // Move layer from index 0 to index 2
   * manager.reorderLayers(0, 2);
   * ```
   */
  public reorderLayers(fromIndex: number, toIndex: number): void {
    if (fromIndex < 0 || fromIndex >= this.layers.length) {
      console.warn(`Invalid fromIndex: ${fromIndex}`);
      return;
    }
    if (toIndex < 0 || toIndex >= this.layers.length) {
      console.warn(`Invalid toIndex: ${toIndex}`);
      return;
    }
    if (fromIndex === toIndex) {
      return;
    }

    const [movedLayer] = this.layers.splice(fromIndex, 1);
    this.layers.splice(toIndex, 0, movedLayer);

    this.emit({
      type: 'layer-reordered',
      layerId: movedLayer.id,
      data: { fromIndex, toIndex }
    });
  }

  /**
   * Set the active/selected layer.
   * 
   * @param id - ID of the layer to make active
   * 
   * @example
   * ```typescript
   * manager.setActiveLayer('layer-1');
   * ```
   */
  public setActiveLayer(id: string): void {
    const layer = this.layers.find(l => l.id === id);
    if (!layer) {
      console.warn(`Layer with id "${id}" not found`);
      return;
    }

    const previousActiveId = this.activeLayerId;
    this.activeLayerId = id;

    this.emit({
      type: 'active-layer-changed',
      layerId: id,
      data: { previousActiveId }
    });
  }

  /**
   * Get the currently active layer.
   * 
   * @returns The active layer, or null if none
   * 
   * @example
   * ```typescript
   * const activeLayer = manager.getActiveLayer();
   * if (activeLayer) {
   *   console.log('Active layer:', activeLayer.name);
   * }
   * ```
   */
  public getActiveLayer(): Layer | null {
    if (!this.activeLayerId) return null;
    return this.layers.find(l => l.id === this.activeLayerId) || null;
  }

  /**
   * Get a layer by ID.
   * 
   * @param id - ID of the layer to retrieve
   * @returns The layer, or undefined if not found
   * 
   * @example
   * ```typescript
   * const layer = manager.getLayerById('layer-1');
   * ```
   */
  public getLayerById(id: string): Layer | undefined {
    return this.layers.find(l => l.id === id);
  }

  /**
   * Get the index of a layer in the stack.
   * 
   * @param id - ID of the layer
   * @returns The index (0 = bottom), or -1 if not found
   * 
   * @example
   * ```typescript
   * const index = manager.getLayerIndex('layer-1');
   * ```
   */
  public getLayerIndex(id: string): number {
    return this.layers.findIndex(l => l.id === id);
  }

  /**
   * Move a layer up in the stack (towards the top).
   * 
   * @param id - ID of the layer to move up
   * 
   * @example
   * ```typescript
   * manager.moveLayerUp('layer-1');
   * ```
   */
  public moveLayerUp(id: string): void {
    const index = this.getLayerIndex(id);
    if (index === -1 || index === this.layers.length - 1) {
      return; // Layer not found or already at top
    }
    this.reorderLayers(index, index + 1);
  }

  /**
   * Move a layer down in the stack (towards the bottom).
   * 
   * @param id - ID of the layer to move down
   * 
   * @example
   * ```typescript
   * manager.moveLayerDown('layer-1');
   * ```
   */
  public moveLayerDown(id: string): void {
    const index = this.getLayerIndex(id);
    if (index <= 0) {
      return; // Layer not found or already at bottom
    }
    this.reorderLayers(index, index - 1);
  }

  /**
   * Duplicate a layer.
   * 
   * Creates a copy of the specified layer with a new ID and adds it above the original.
   * 
   * @param id - ID of the layer to duplicate
   * 
   * @example
   * ```typescript
   * manager.duplicateLayer('layer-1');
   * ```
   */
  public duplicateLayer(id: string): void {
    const layer = this.getLayerById(id);
    if (!layer) {
      console.warn(`Layer with id "${id}" not found`);
      return;
    }

    const duplicatedLayer: Layer = {
      ...layer,
      id: this.generateLayerId(),
      name: `${layer.name} Copy`
    };

    const index = this.getLayerIndex(id);
    this.layers.splice(index + 1, 0, duplicatedLayer);
    this.activeLayerId = duplicatedLayer.id;

    this.emit({
      type: 'layer-added',
      layerId: duplicatedLayer.id,
      data: duplicatedLayer
    });
  }

  /**
   * Clear all layers.
   * 
   * Removes all layers from the stack and resets the active layer.
   * 
   * @example
   * ```typescript
   * manager.clearLayers();
   * ```
   */
  public clearLayers(): void {
    const removedLayers = [...this.layers];
    this.layers = [];
    this.activeLayerId = null;

    removedLayers.forEach(layer => {
      this.emit({
        type: 'layer-removed',
        layerId: layer.id,
        data: layer
      });
    });
  }

  /**
   * Get all visible layers.
   * 
   * @returns Array of visible layers
   * 
   * @example
   * ```typescript
   * const visibleLayers = manager.getVisibleLayers();
   * ```
   */
  public getVisibleLayers(): Layer[] {
    return this.layers.filter(l => l.visible);
  }

  /**
   * Toggle layer visibility.
   * 
   * @param id - ID of the layer to toggle
   * 
   * @example
   * ```typescript
   * manager.toggleLayerVisibility('layer-1');
   * ```
   */
  public toggleLayerVisibility(id: string): void {
    const layer = this.getLayerById(id);
    if (layer) {
      this.updateLayer(id, { visible: !layer.visible });
    }
  }

  /**
   * Toggle layer lock state.
   * 
   * @param id - ID of the layer to toggle
   * 
   * @example
   * ```typescript
   * manager.toggleLayerLock('layer-1');
   * ```
   */
  public toggleLayerLock(id: string): void {
    const layer = this.getLayerById(id);
    if (layer) {
      this.updateLayer(id, { locked: !layer.locked });
    }
  }

  /**
   * Export layers as JSON.
   * 
   * @returns JSON string representation of all layers
   * 
   * @example
   * ```typescript
   * const json = manager.exportToJSON();
   * localStorage.setItem('layers', json);
   * ```
   */
  public exportToJSON(): string {
    return JSON.stringify({
      layers: this.layers,
      activeLayerId: this.activeLayerId
    }, null, 2);
  }

  /**
   * Import layers from JSON.
   * 
   * @param json - JSON string representation of layers
   * 
   * @example
   * ```typescript
   * const json = localStorage.getItem('layers');
   * if (json) {
   *   manager.importFromJSON(json);
   * }
   * ```
   */
  public importFromJSON(json: string): void {
    try {
      const data = JSON.parse(json);
      if (data.layers && Array.isArray(data.layers)) {
        this.layers = data.layers;
        this.activeLayerId = data.activeLayerId || null;
        
        // Update counter to avoid ID conflicts
        const maxId = Math.max(
          ...this.layers
            .map(l => parseInt(l.id.replace(/\D/g, ''), 10))
            .filter(n => !isNaN(n)),
          0
        );
        this.layerIdCounter = maxId + 1;
      }
    } catch (error) {
      console.error('Failed to import layers from JSON:', error);
    }
  }
}
