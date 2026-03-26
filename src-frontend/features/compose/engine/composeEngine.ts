/**
 * ComposeEngine - Core compositing engine
 * 
 * Manages the compositing workflow including node graph evaluation,
 * layer management, and real-time preview rendering.
 */

import * as THREE from 'three';
import { NodeGraph, type CompositeNode, type NodeConnection } from './nodeGraph';
import { EffectProcessor } from './effects';
import { BlendModeShader, type BlendMode } from './blendModes';
import { LayerSystem, type Layer, type LayerId } from './layerSystem';
import { ExportUtility } from './exportUtility';
import type { ExportSettings } from '../ui/ExportDialog';

// Re-export types for convenience
export type { CompositeNode, NodeConnection, Layer, LayerId, BlendMode, ExportSettings };

export class ComposeEngine {
  private canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;
  private nodeGraph: NodeGraph;
  private effectProcessor: EffectProcessor;
  private blendModeShader: BlendModeShader;
  private layerSystem: LayerSystem;
  private exportUtility: ExportUtility;
  private animationFrameId: number | null = null;
  private outputTexture: THREE.Texture | null = null;
  private hdrEnabled: boolean = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    
    // Initialize Three.js renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
    });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    
    // Enable HDR rendering
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;

    // Setup scene and camera
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    // Initialize subsystems
    this.nodeGraph = new NodeGraph(this.renderer);
    this.effectProcessor = new EffectProcessor(this.renderer);
    this.blendModeShader = new BlendModeShader();
    this.exportUtility = new ExportUtility(this.renderer);
    this.layerSystem = new LayerSystem(this.renderer, {
      width: canvas.clientWidth,
      height: canvas.clientHeight,
    });

    // Initialize with default input and output nodes
    this.initializeDefaultGraph();

    // Handle window resize
    window.addEventListener('resize', this.handleResize);
  }

  private initializeDefaultGraph(): void {
    // Create input node
    const inputNode = this.nodeGraph.addNode('input');
    
    // Create output node
    const outputNode = this.nodeGraph.addNode('output');

    console.log('[ComposeEngine] Default graph initialized with input and output nodes');
  }

  private handleResize = (): void => {
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    this.renderer.setSize(width, height);
    this.layerSystem.setDimensions(width, height);
  };

  /**
   * Start the render loop
   */
  start(): void {
    if (this.animationFrameId !== null) return;

    const animate = () => {
      this.render();
      this.animationFrameId = requestAnimationFrame(animate);
    };

    animate();
  }

  /**
   * Stop the render loop
   */
  stop(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * Render the current composite
   */
  private render(): void {
    if (this.outputTexture) {
      // Render the output texture to the canvas
      this.renderer.render(this.scene, this.camera);
    }
  }

  /**
   * Add a node to the graph
   */
  addNode(type: string): string {
    return this.nodeGraph.addNode(type);
  }

  /**
   * Remove a node from the graph
   */
  removeNode(id: string): void {
    this.nodeGraph.removeNode(id);
  }

  /**
   * Connect two nodes
   */
  connectNodes(fromId: string, toId: string, fromSocket: string, toSocket: string): void {
    this.nodeGraph.connectNodes(fromId, toId, fromSocket, toSocket);
  }

  /**
   * Disconnect nodes
   */
  disconnectNodes(connectionId: string): void {
    this.nodeGraph.disconnectNodes(connectionId);
  }

  /**
   * Get all nodes in the graph
   */
  getNodes(): CompositeNode[] {
    return this.nodeGraph.getNodes();
  }

  /**
   * Get all connections in the graph
   */
  getConnections(): NodeConnection[] {
    return this.nodeGraph.getConnections();
  }

  /**
   * Get a specific node by ID
   */
  getNode(id: string): CompositeNode | undefined {
    return this.nodeGraph.getNode(id);
  }

  /**
   * Update node parameters
   */
  updateNodeParameters(id: string, parameters: Record<string, any>): void {
    this.nodeGraph.updateNodeParameters(id, parameters);
  }

  /**
   * Evaluate the entire graph
   */
  async evaluateGraph(): Promise<THREE.Texture | null> {
    try {
      const result = await this.nodeGraph.evaluate();
      this.outputTexture = result;
      return result;
    } catch (error) {
      console.error('[ComposeEngine] Graph evaluation failed:', error);
      throw error;
    }
  }

  /**
   * Evaluate a specific node
   */
  async evaluateNode(id: string): Promise<THREE.Texture | null> {
    return this.nodeGraph.evaluateNode(id);
  }

  /**
   * Add a layer
   */
  addLayer(name: string, texture?: THREE.Texture): LayerId {
    return this.layerSystem.addLayer(name, texture);
  }

  /**
   * Remove a layer
   */
  removeLayer(id: LayerId): boolean {
    return this.layerSystem.removeLayer(id);
  }

  /**
   * Set layer blend mode
   */
  setLayerBlendMode(id: LayerId, mode: BlendMode): boolean {
    return this.layerSystem.setLayerBlendMode(id, mode);
  }

  /**
   * Set layer opacity
   */
  setLayerOpacity(id: LayerId, opacity: number): boolean {
    return this.layerSystem.setLayerOpacity(id, opacity);
  }

  /**
   * Set layer visibility
   */
  setLayerVisibility(id: LayerId, visible: boolean): boolean {
    return this.layerSystem.setLayerVisibility(id, visible);
  }

  /**
   * Toggle layer visibility
   */
  toggleLayerVisibility(id: LayerId): boolean {
    return this.layerSystem.toggleLayerVisibility(id);
  }

  /**
   * Get all layers
   */
  getLayers(): Layer[] {
    return this.layerSystem.getLayers();
  }

  /**
   * Get a specific layer
   */
  getLayer(id: LayerId): Layer | undefined {
    return this.layerSystem.getLayer(id);
  }

  /**
   * Move layer up in stack
   */
  moveLayerUp(id: LayerId): boolean {
    return this.layerSystem.moveLayerUp(id);
  }

  /**
   * Move layer down in stack
   */
  moveLayerDown(id: LayerId): boolean {
    return this.layerSystem.moveLayerDown(id);
  }

  /**
   * Duplicate a layer
   */
  duplicateLayer(id: LayerId): LayerId | null {
    return this.layerSystem.duplicateLayer(id);
  }

  /**
   * Composite all layers
   */
  compositeLayers(): THREE.Texture | null {
    return this.layerSystem.composite();
  }

  /**
   * Enable or disable HDR workflow
   */
  setHDREnabled(enabled: boolean): void {
    this.hdrEnabled = enabled;
    
    // Update renderer settings for HDR
    if (enabled) {
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.0;
      this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    } else {
      this.renderer.toneMapping = THREE.NoToneMapping;
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    }
    
    console.log(`[ComposeEngine] HDR workflow ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Get HDR enabled state
   */
  isHDREnabled(): boolean {
    return this.hdrEnabled;
  }

  /**
   * Set tone mapping exposure (for HDR)
   */
  setExposure(exposure: number): void {
    this.renderer.toneMappingExposure = exposure;
  }

  /**
   * Get current exposure
   */
  getExposure(): number {
    return this.renderer.toneMappingExposure;
  }

  /**
   * Export the composite with advanced settings
   */
  async exportCompositeAdvanced(settings: ExportSettings): Promise<void> {
    if (!this.outputTexture) {
      throw new Error('No output texture to export');
    }

    await this.exportUtility.exportTexture(this.outputTexture, settings);
    console.log(`[ComposeEngine] Exported composite with settings:`, settings);
  }

  /**
   * Export the composite (legacy method)
   */
  async exportComposite(format: 'png' | 'exr' | 'tiff'): Promise<void> {
    if (!this.outputTexture) {
      throw new Error('No output texture to export');
    }

    // Render to canvas
    this.renderer.render(this.scene, this.camera);

    // Get canvas data
    const dataUrl = this.canvas.toDataURL(`image/${format === 'exr' ? 'png' : format}`);

    // Trigger download
    const link = document.createElement('a');
    link.download = `composite.${format}`;
    link.href = dataUrl;
    link.click();

    console.log(`[ComposeEngine] Exported composite as ${format}`);
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.stop();
    window.removeEventListener('resize', this.handleResize);
    this.renderer.dispose();
    this.effectProcessor.dispose();
    this.blendModeShader.dispose();
    this.exportUtility.dispose();
    this.nodeGraph.dispose();
    this.layerSystem.dispose();
  }
}
