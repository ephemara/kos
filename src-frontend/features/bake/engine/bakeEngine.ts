// @ts-nocheck
/**
 * BakeEngine - Core logic for texture baking
 * 
 * Manages the baking workflow including mesh loading, settings configuration,
 * GPU ray tracing coordination, and result preview.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { rayTracer, type BakeResult } from './rayTracer';
import { cageGenerator } from './cageGenerator';
import { CageEditor, type CageEditMode } from './cageEditor';

export interface BakeSettings {
  resolution: number;
  samples: number;
  maxDistance: number;
  cageExtrusion: number | null;
  normalSpace: 'tangent' | 'object' | 'world';
  dilationIterations: number;
  enableAntialiasing: boolean;
}

export interface BakeMesh {
  positions: Float32Array;
  normals: Float32Array;
  tangents: Float32Array;
  uvs: Float32Array;
  indices: Uint32Array;
}

export interface BakedMap {
  type: MapType;
  texture: THREE.Texture;
  data: Uint8Array;
}

export type MapType = 
  | 'normal'
  | 'ao'
  | 'curvature'
  | 'thickness'
  | 'position'
  | 'id';

export class BakeEngine {
  private canvas: HTMLCanvasElement;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;
  private animationId: number | null = null;

  // Meshes
  private highPolyMesh: THREE.Mesh | null = null;
  private lowPolyMesh: THREE.Mesh | null = null;
  private cageMesh: THREE.Mesh | null = null;

  // Baking state
  private settings: BakeSettings;
  private bakedMaps: Map<MapType, BakedMap> = new Map();
  private isBaking: boolean = false;

  // Cage editing
  private cageEditor: CageEditor;
  private cageEditMode: boolean = false;
  private selectionVisualization: THREE.Points | null = null;

  private createRenderer(canvas: HTMLCanvasElement): THREE.WebGLRenderer {
    try {
      return new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: false
      });
    } catch {
      return {
        dispose() {},
        render() {},
        setSize() {},
        setPixelRatio() {},
      } as unknown as THREE.WebGLRenderer;
    }
  }

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;

    // Initialize Three.js scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x2a2a2a);

    // Setup camera
    const width = canvas.clientWidth || canvas.width || 1;
    const height = canvas.clientHeight || canvas.height || 1;
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    this.camera.position.set(5, 5, 5);
    this.camera.lookAt(0, 0, 0);

    // Setup renderer
    this.renderer = this.createRenderer(canvas);
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(window.devicePixelRatio || 1);

    // Setup controls
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;

    // Initialize cage editor
    this.cageEditor = new CageEditor();
    this.cageEditor.setCamera(this.camera);

    // Add lights
    this.setupLights();

    // Add grid
    const grid = new THREE.GridHelper(10, 10);
    this.scene.add(grid);

    // Default settings
    this.settings = {
      resolution: 2048,
      samples: 16,
      maxDistance: 1.0,
      cageExtrusion: null,
      normalSpace: 'tangent',
      dilationIterations: 8,
      enableAntialiasing: true
    };

    // Handle resize
    window.addEventListener('resize', this.handleResize);
  }

  private setupLights(): void {
    // Ambient light
    const ambient = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(ambient);

    // Directional lights
    const light1 = new THREE.DirectionalLight(0xffffff, 0.6);
    light1.position.set(5, 10, 5);
    this.scene.add(light1);

    const light2 = new THREE.DirectionalLight(0xffffff, 0.3);
    light2.position.set(-5, 5, -5);
    this.scene.add(light2);
  }

  private handleResize = (): void => {
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(width, height);
  };

  /**
   * Load high-poly mesh for baking source
   */
  async loadHighPolyMesh(mesh: BakeMesh): Promise<void> {
    // Remove existing high-poly mesh
    if (this.highPolyMesh) {
      this.scene.remove(this.highPolyMesh);
      this.highPolyMesh.geometry.dispose();
    }

    // Create Three.js geometry
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(mesh.positions, 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(mesh.normals, 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(mesh.uvs, 2));
    geometry.setIndex(new THREE.BufferAttribute(mesh.indices, 1));

    // Create material
    const material = new THREE.MeshStandardMaterial({
      color: 0x4488ff,
      wireframe: false,
      transparent: true,
      opacity: 0.5
    });

    this.highPolyMesh = new THREE.Mesh(geometry, material);
    this.scene.add(this.highPolyMesh);

    this.fitToView();
  }

  /**
   * Load low-poly mesh for baking target
   */
  async loadLowPolyMesh(mesh: BakeMesh): Promise<void> {
    // Remove existing low-poly mesh
    if (this.lowPolyMesh) {
      this.scene.remove(this.lowPolyMesh);
      this.lowPolyMesh.geometry.dispose();
    }

    // Create Three.js geometry
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(mesh.positions, 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(mesh.normals, 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(mesh.uvs, 2));
    geometry.setIndex(new THREE.BufferAttribute(mesh.indices, 1));

    // Create material
    const material = new THREE.MeshStandardMaterial({
      color: 0x88ff44,
      wireframe: true
    });

    this.lowPolyMesh = new THREE.Mesh(geometry, material);
    this.scene.add(this.lowPolyMesh);

    this.fitToView();
  }

  /**
   * Set cage mesh for controlled baking
   */
  setCageMesh(mesh: BakeMesh | null): void {
    // Remove existing cage mesh
    if (this.cageMesh) {
      this.scene.remove(this.cageMesh);
      this.cageMesh.geometry.dispose();
    }

    if (!mesh) {
      this.cageMesh = null;
      return;
    }

    // Create Three.js geometry
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(mesh.positions, 3));
    geometry.setIndex(new THREE.BufferAttribute(mesh.indices, 1));

    // Create material
    const material = new THREE.MeshBasicMaterial({
      color: 0xff8844,
      wireframe: true,
      transparent: true,
      opacity: 0.3
    });

    this.cageMesh = new THREE.Mesh(geometry, material);
    this.scene.add(this.cageMesh);
  }

  /**
   * Update bake settings
   */
  setSettings(settings: Partial<BakeSettings>): void {
    this.settings = { ...this.settings, ...settings };
  }

  /**
   * Get current settings
   */
  getSettings(): BakeSettings {
    return { ...this.settings };
  }

  /**
   * Check if baking is in progress
   */
  isBakingInProgress(): boolean {
    return this.isBaking;
  }

  /**
   * Get baked map by type
   */
  getBakedMap(type: MapType): BakedMap | null {
    return this.bakedMaps.get(type) || null;
  }

  /**
   * Clear all baked maps
   */
  clearBakedMaps(): void {
    this.bakedMaps.forEach(map => {
      map.texture.dispose();
    });
    this.bakedMaps.clear();
  }

  /**
   * Fit camera to view all meshes
   */
  fitToView(): void {
    const box = new THREE.Box3();
    
    if (this.highPolyMesh) box.expandByObject(this.highPolyMesh);
    if (this.lowPolyMesh) box.expandByObject(this.lowPolyMesh);

    if (box.isEmpty()) return;

    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const distance = maxDim / Math.tan((this.camera.fov * Math.PI) / 360);

    this.camera.position.copy(center);
    this.camera.position.z += distance * 1.5;
    this.controls.target.copy(center);
    this.controls.update();
  }

  /**
   * Start render loop
   */
  start(): void {
    if (this.animationId !== null) return;

    const animate = () => {
      this.animationId = requestAnimationFrame(animate);
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    };

    animate();
  }

  /**
   * Stop render loop
   */
  stop(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  /**
   * Bake normal map from high-poly to low-poly mesh
   */
  async bakeNormalMap(): Promise<BakedMap> {
    if (!this.highPolyMesh || !this.lowPolyMesh) {
      throw new Error('Both high-poly and low-poly meshes must be loaded');
    }

    this.isBaking = true;

    try {
      const highMesh = this.extractMeshData(this.highPolyMesh);
      const lowMesh = this.extractMeshData(this.lowPolyMesh);

      const result = await rayTracer.bakeNormalMap(highMesh, lowMesh, this.settings);

      const texture = this.createTextureFromResult(result);
      const bakedMap: BakedMap = {
        type: 'normal',
        texture,
        data: result.data
      };

      this.bakedMaps.set('normal', bakedMap);
      console.log(`[BakeEngine] Normal map baked in ${result.timeMs.toFixed(2)}ms`);

      return bakedMap;
    } finally {
      this.isBaking = false;
    }
  }

  /**
   * Bake ambient occlusion map
   */
  async bakeAOMap(): Promise<BakedMap> {
    if (!this.lowPolyMesh) {
      throw new Error('Low-poly mesh must be loaded');
    }

    this.isBaking = true;

    try {
      const lowMesh = this.extractMeshData(this.lowPolyMesh);
      const result = await rayTracer.bakeAOMap(lowMesh, this.settings);

      const texture = this.createTextureFromResult(result);
      const bakedMap: BakedMap = {
        type: 'ao',
        texture,
        data: result.data
      };

      this.bakedMaps.set('ao', bakedMap);
      console.log(`[BakeEngine] AO map baked in ${result.timeMs.toFixed(2)}ms`);

      return bakedMap;
    } finally {
      this.isBaking = false;
    }
  }

  /**
   * Bake curvature map
   */
  async bakeCurvatureMap(): Promise<BakedMap> {
    if (!this.lowPolyMesh) {
      throw new Error('Low-poly mesh must be loaded');
    }

    this.isBaking = true;

    try {
      const lowMesh = this.extractMeshData(this.lowPolyMesh);
      const result = await rayTracer.bakeCurvatureMap(lowMesh, this.settings);

      const texture = this.createTextureFromResult(result);
      const bakedMap: BakedMap = {
        type: 'curvature',
        texture,
        data: result.data
      };

      this.bakedMaps.set('curvature', bakedMap);
      console.log(`[BakeEngine] Curvature map baked in ${result.timeMs.toFixed(2)}ms`);

      return bakedMap;
    } finally {
      this.isBaking = false;
    }
  }

  /**
   * Bake thickness map
   */
  async bakeThicknessMap(): Promise<BakedMap> {
    if (!this.lowPolyMesh) {
      throw new Error('Low-poly mesh must be loaded');
    }

    this.isBaking = true;

    try {
      const lowMesh = this.extractMeshData(this.lowPolyMesh);
      const result = await rayTracer.bakeThicknessMap(lowMesh, this.settings);

      const texture = this.createTextureFromResult(result);
      const bakedMap: BakedMap = {
        type: 'thickness',
        texture,
        data: result.data
      };

      this.bakedMaps.set('thickness', bakedMap);
      console.log(`[BakeEngine] Thickness map baked in ${result.timeMs.toFixed(2)}ms`);

      return bakedMap;
    } finally {
      this.isBaking = false;
    }
  }

  /**
   * Bake position map
   */
  async bakePositionMap(): Promise<BakedMap> {
    if (!this.lowPolyMesh) {
      throw new Error('Low-poly mesh must be loaded');
    }

    this.isBaking = true;

    try {
      const lowMesh = this.extractMeshData(this.lowPolyMesh);
      const result = await rayTracer.bakePositionMap(lowMesh, this.settings);

      const texture = this.createTextureFromResult(result);
      const bakedMap: BakedMap = {
        type: 'position',
        texture,
        data: result.data
      };

      this.bakedMaps.set('position', bakedMap);
      console.log(`[BakeEngine] Position map baked in ${result.timeMs.toFixed(2)}ms`);

      return bakedMap;
    } finally {
      this.isBaking = false;
    }
  }

  /**
   * Bake material ID map
   */
  async bakeIDMap(materialIds?: Uint32Array): Promise<BakedMap> {
    if (!this.lowPolyMesh) {
      throw new Error('Low-poly mesh must be loaded');
    }

    this.isBaking = true;

    try {
      const lowMesh = this.extractMeshData(this.lowPolyMesh);
      
      // Default to all zeros if no material IDs provided
      const ids = materialIds || new Uint32Array(lowMesh.indices.length / 3);
      
      const result = await rayTracer.bakeIDMap(lowMesh, ids, this.settings);

      const texture = this.createTextureFromResult(result);
      const bakedMap: BakedMap = {
        type: 'id',
        texture,
        data: result.data
      };

      this.bakedMaps.set('id', bakedMap);
      console.log(`[BakeEngine] ID map baked in ${result.timeMs.toFixed(2)}ms`);

      return bakedMap;
    } finally {
      this.isBaking = false;
    }
  }

  /**
   * Batch bake multiple map types
   */
  async bakeBatch(
    mapTypes: MapType[],
    onProgress?: (mapType: MapType, index: number, total: number) => void
  ): Promise<Map<MapType, BakedMap>> {
    if (!this.lowPolyMesh) {
      throw new Error('Low-poly mesh must be loaded');
    }

    this.isBaking = true;

    try {
      const highMesh = this.highPolyMesh ? this.extractMeshData(this.highPolyMesh) : null;
      const lowMesh = this.extractMeshData(this.lowPolyMesh);

      console.log(`[BakeEngine] Starting batch bake of ${mapTypes.length} maps...`);

      const results = await rayTracer.bakeBatch(highMesh, lowMesh, mapTypes, this.settings);

      const bakedMaps = new Map<MapType, BakedMap>();

      let index = 0;
      for (const [mapType, result] of results.entries()) {
        const texture = this.createTextureFromResult(result);
        const bakedMap: BakedMap = {
          type: mapType,
          texture,
          data: result.data
        };

        bakedMaps.set(mapType, bakedMap);
        this.bakedMaps.set(mapType, bakedMap);

        console.log(`[BakeEngine] ${mapType} map baked in ${result.timeMs.toFixed(2)}ms`);

        if (onProgress) {
          onProgress(mapType, index + 1, mapTypes.length);
        }

        index++;
      }

      console.log(`[BakeEngine] Batch bake complete!`);

      return bakedMaps;
    } finally {
      this.isBaking = false;
    }
  }

  /**
   * Preview a baked map on the low-poly mesh
   */
  previewBakedMap(mapType: MapType): void {
    const bakedMap = this.bakedMaps.get(mapType);
    if (!bakedMap || !this.lowPolyMesh) {
      console.warn(`[BakeEngine] Cannot preview ${mapType} map - not available`);
      return;
    }

    // Update low-poly mesh material to show the baked texture
    const material = this.lowPolyMesh.material as THREE.MeshStandardMaterial;
    
    switch (mapType) {
      case 'normal':
        material.normalMap = bakedMap.texture;
        material.normalScale = new THREE.Vector2(1, 1);
        break;
      
      case 'ao':
        material.aoMap = bakedMap.texture;
        material.aoMapIntensity = 1.0;
        break;
      
      case 'curvature':
      case 'thickness':
      case 'position':
      case 'id':
        // For these maps, replace the base color with the map
        material.map = bakedMap.texture;
        break;
    }

    material.needsUpdate = true;
    console.log(`[BakeEngine] Previewing ${mapType} map`);
  }

  /**
   * Clear preview and restore default material
   */
  clearPreview(): void {
    if (!this.lowPolyMesh) return;

    const material = this.lowPolyMesh.material as THREE.MeshStandardMaterial;
    material.map = null;
    material.normalMap = null;
    material.aoMap = null;
    material.needsUpdate = true;

    console.log('[BakeEngine] Preview cleared');
  }

  /**
   * Generate cage mesh from low-poly mesh
   */
  async generateCage(extrusion?: number): Promise<void> {
    if (!this.lowPolyMesh) {
      throw new Error('Low-poly mesh must be loaded');
    }

    const lowMesh = this.extractMeshData(this.lowPolyMesh);
    
    // Use provided extrusion or calculate recommended
    const extrusionDistance = extrusion ?? await cageGenerator.calculateRecommendedExtrusion(lowMesh);
    
    console.log(`[BakeEngine] Generating cage with extrusion: ${extrusionDistance.toFixed(3)}`);

    const cageMesh = await cageGenerator.generateUniform(lowMesh, extrusionDistance);
    this.setCageMesh(cageMesh);

    // Update settings with cage extrusion
    this.settings.cageExtrusion = extrusionDistance;
  }

  /**
   * Validate current cage mesh
   */
  async validateCage(): Promise<{ valid: boolean; issues: string[] }> {
    if (!this.lowPolyMesh) {
      return { valid: false, issues: ['Low-poly mesh not loaded'] };
    }

    if (!this.cageMesh) {
      return { valid: false, issues: ['Cage mesh not generated'] };
    }

    const lowMesh = this.extractMeshData(this.lowPolyMesh);
    const cageMeshData = this.extractMeshData(this.cageMesh);

    return await cageGenerator.validate(lowMesh, cageMeshData);
  }

  /**
   * Calculate recommended extrusion distance for cage generation
   */
  async calculateRecommendedExtrusion(): Promise<number> {
    if (!this.lowPolyMesh) {
      throw new Error('Low-poly mesh must be loaded');
    }

    const lowMesh = this.extractMeshData(this.lowPolyMesh);
    return await cageGenerator.calculateRecommendedExtrusion(lowMesh);
  }

  /**
   * Get current cage mesh
   */
  getCageMesh(): THREE.Mesh | null {
    return this.cageMesh;
  }

  /**
   * Toggle cage visibility
   */
  setCageVisible(visible: boolean): void {
    if (this.cageMesh) {
      this.cageMesh.visible = visible;
    }
  }

  /**
   * Toggle high-poly mesh visibility
   */
  setHighPolyVisible(visible: boolean): void {
    if (this.highPolyMesh) {
      this.highPolyMesh.visible = visible;
    }
  }

  /**
   * Toggle low-poly mesh visibility
   */
  setLowPolyVisible(visible: boolean): void {
    if (this.lowPolyMesh) {
      this.lowPolyMesh.visible = visible;
    }
  }

  /**
   * Enable cage edit mode
   */
  enableCageEditMode(enabled: boolean): void {
    this.cageEditMode = enabled;
    
    if (enabled && this.cageMesh) {
      this.cageEditor.setCageMesh(this.cageMesh);
      this.controls.enabled = false; // Disable orbit controls during editing
    } else {
      this.controls.enabled = true;
      this.clearCageSelection();
    }
  }

  /**
   * Check if cage edit mode is enabled
   */
  isCageEditMode(): boolean {
    return this.cageEditMode;
  }

  /**
   * Set cage edit mode type
   */
  setCageEditMode(mode: CageEditMode): void {
    this.cageEditor.setMode(mode);
  }

  /**
   * Get current cage edit mode
   */
  getCageEditMode(): CageEditMode {
    return this.cageEditor.getMode();
  }

  /**
   * Select cage vertices at screen position
   */
  selectCageVertices(screenX: number, screenY: number, addToSelection: boolean = false): number {
    if (!this.cageEditMode) return 0;

    const count = this.cageEditor.selectVertices(screenX, screenY, addToSelection);
    this.updateSelectionVisualization();
    return count;
  }

  /**
   * Move selected cage vertices
   */
  moveCageVertices(delta: THREE.Vector3): void {
    if (!this.cageEditMode) return;
    this.cageEditor.moveVertices(delta);
  }

  /**
   * Scale selected cage vertices
   */
  scaleCageVertices(scale: number, center?: THREE.Vector3): void {
    if (!this.cageEditMode) return;
    this.cageEditor.scaleVertices(scale, center);
  }

  /**
   * Smooth selected cage vertices
   */
  smoothCageVertices(iterations: number = 1): void {
    if (!this.cageEditMode) return;
    this.cageEditor.smoothVertices(iterations);
  }

  /**
   * Reset cage to original state
   */
  resetCage(): void {
    this.cageEditor.reset();
    this.clearCageSelection();
  }

  /**
   * Clear cage vertex selection
   */
  clearCageSelection(): void {
    this.cageEditor.clearSelection();
    this.updateSelectionVisualization();
  }

  /**
   * Get cage selection count
   */
  getCageSelectionCount(): number {
    return this.cageEditor.getSelectionCount();
  }

  /**
   * Update selection visualization
   */
  private updateSelectionVisualization(): void {
    // Remove old visualization
    if (this.selectionVisualization) {
      this.scene.remove(this.selectionVisualization);
      this.selectionVisualization.geometry.dispose();
      (this.selectionVisualization.material as THREE.Material).dispose();
      this.selectionVisualization = null;
    }

    // Create new visualization
    if (this.cageEditMode && this.cageEditor.getSelectionCount() > 0) {
      this.selectionVisualization = this.cageEditor.createSelectionVisualization();
      if (this.selectionVisualization) {
        this.scene.add(this.selectionVisualization);
      }
    }
  }

  /**
   * Apply cage edits (update cage mesh data)
   */
  applyCageEdits(): void {
    const editedCage = this.cageEditor.exportCageMesh();
    if (editedCage) {
      this.setCageMesh(editedCage);
      console.log('[BakeEngine] Cage edits applied');
    }
  }

  /**
   * Extract mesh data from Three.js mesh
   */
  private extractMeshData(mesh: THREE.Mesh): BakeMesh {
    const geometry = mesh.geometry;
    
    const positions = geometry.attributes.position.array as Float32Array;
    const normals = geometry.attributes.normal.array as Float32Array;
    const uvs = geometry.attributes.uv?.array as Float32Array || new Float32Array(0);
    
    // Generate tangents if not present
    if (!geometry.attributes.tangent) {
      geometry.computeTangents();
    }
    const tangents = geometry.attributes.tangent.array as Float32Array;
    
    const indices = geometry.index?.array as Uint32Array || new Uint32Array(0);

    return {
      positions,
      normals,
      tangents,
      uvs,
      indices
    };
  }

  /**
   * Create Three.js texture from bake result
   */
  private createTextureFromResult(result: BakeResult): THREE.Texture {
    const { width, height, data } = result;

    const texture = new THREE.DataTexture(
      data,
      width,
      height,
      THREE.RGBAFormat,
      THREE.UnsignedByteType
    );

    texture.needsUpdate = true;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = true;

    return texture;
  }
  /**
   * Cleanup resources
   */
  dispose(): void {
    this.stop();
    window.removeEventListener('resize', this.handleResize);

    if (this.highPolyMesh) {
      this.highPolyMesh.geometry.dispose();
      (this.highPolyMesh.material as THREE.Material).dispose();
    }

    if (this.lowPolyMesh) {
      this.lowPolyMesh.geometry.dispose();
      (this.lowPolyMesh.material as THREE.Material).dispose();
    }

    if (this.cageMesh) {
      this.cageMesh.geometry.dispose();
      (this.cageMesh.material as THREE.Material).dispose();
    }

    if (this.selectionVisualization) {
      this.selectionVisualization.geometry.dispose();
      (this.selectionVisualization.material as THREE.Material).dispose();
    }

    this.clearBakedMaps();
    this.renderer.dispose();
    this.controls.dispose();
    this.cageEditor.dispose();
  }
}
// @ts-nocheck
