/**
 * Universal Layer System Types
 * 
 * Generic layer interfaces that work for both 2D and 3D applications.
 * These types provide a common foundation for layer management across
 * different rendering contexts (canvas, Three.js, etc.).
 */

/**
 * Blend modes for layer compositing.
 * 
 * Defines how a layer's pixels are combined with layers below it.
 * These modes are standard across 2D and 3D rendering contexts.
 */
export type BlendMode =
  | 'normal'      // Standard alpha blending
  | 'multiply'    // Multiply colors (darkens)
  | 'screen'      // Screen colors (lightens)
  | 'overlay'     // Combination of multiply and screen
  | 'add'         // Additive blending (brightens)
  | 'subtract'    // Subtractive blending (darkens)
  | 'difference'; // Absolute difference between colors

/**
 * Core layer interface.
 * 
 * Represents a single layer in a 2D or 3D application. Layers can contain
 * different types of content (raster images, vector graphics, 3D meshes, etc.)
 * depending on the application context.
 * 
 * @example
 * ```typescript
 * const layer: Layer = {
 *   id: 'layer-1',
 *   name: 'Background',
 *   visible: true,
 *   locked: false,
 *   solo: false,
 *   opacity: 1.0,
 *   blendMode: 'normal',
 *   thumbnail: 'data:image/png;base64,...',
 *   metadata: { createdAt: Date.now() }
 * };
 * ```
 */
export interface Layer {
  /** Unique identifier for the layer */
  id: string;

  /** Human-readable name displayed in UI */
  name: string;

  /** Whether the layer is visible in the viewport */
  visible: boolean;

  /** Whether the layer is locked (prevents editing) */
  locked: boolean;

  /** Whether the layer is in solo mode (only this layer visible) */
  solo: boolean;

  /** Layer opacity (0.0 = fully transparent, 1.0 = fully opaque) */
  opacity: number;

  /** How this layer blends with layers below it */
  blendMode: BlendMode;

  /** Optional thumbnail image (data URL or path) for layer preview */
  thumbnail?: string;

  /** Optional metadata for application-specific data */
  metadata?: Record<string, unknown>;
}

/**
 * Layer manager interface.
 * 
 * Provides methods for managing a collection of layers. Implementations
 * can be adapted for different rendering contexts (2D canvas, Three.js, etc.)
 * while maintaining a consistent API.
 * 
 * @example
 * ```typescript
 * const manager: LayerManager = {
 *   layers: [],
 *   activeLayerId: null,
 *   addLayer: (layer) => { ... },
 *   removeLayer: (id) => { ... },
 *   updateLayer: (id, updates) => { ... },
 *   reorderLayers: (from, to) => { ... },
 *   setActiveLayer: (id) => { ... }
 * };
 * ```
 */
export interface LayerManager {
  /** Array of all layers in the stack (bottom to top) */
  layers: Layer[];

  /** ID of the currently active/selected layer, or null if none */
  activeLayerId: string | null;

  /**
   * Add a new layer to the stack.
   * 
   * @param layer - Partial layer object (id and defaults will be generated if not provided)
   */
  addLayer: (layer: Partial<Layer>) => void;

  /**
   * Remove a layer from the stack.
   * 
   * @param id - ID of the layer to remove
   */
  removeLayer: (id: string) => void;

  /**
   * Update properties of an existing layer.
   * 
   * @param id - ID of the layer to update
   * @param updates - Partial layer object with properties to update
   */
  updateLayer: (id: string, updates: Partial<Layer>) => void;

  /**
   * Reorder layers in the stack.
   * 
   * @param fromIndex - Current index of the layer
   * @param toIndex - Target index for the layer
   */
  reorderLayers: (fromIndex: number, toIndex: number) => void;

  /**
   * Set the active/selected layer.
   * 
   * @param id - ID of the layer to make active
   */
  setActiveLayer: (id: string) => void;
}

/**
 * Layer event types for subscribing to layer changes.
 * 
 * Applications can listen to these events to react to layer modifications.
 */
export type LayerEventType =
  | 'layer-added'
  | 'layer-removed'
  | 'layer-updated'
  | 'layer-reordered'
  | 'active-layer-changed';

/**
 * Layer event payload.
 * 
 * Contains information about a layer event that occurred.
 */
export interface LayerEvent {
  /** Type of event that occurred */
  type: LayerEventType;

  /** ID of the affected layer (if applicable) */
  layerId?: string;

  /** Additional event data */
  data?: unknown;
}

/**
 * Layer event listener callback.
 */
export type LayerEventListener = (event: LayerEvent) => void;
