/**
 * Universal Viewport Manager
 * 
 * Centralized viewport management system providing consistent camera controls,
 * gizmos, rendering modes, and selection highlighting across all DCC applications.
 * 
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface CameraState {
  position: [number, number, number];
  target: [number, number, number];
  up: [number, number, number];
  fov: number;
  near: number;
  far: number;
}

export type GizmoMode = 'translate' | 'rotate' | 'scale';
export type GizmoSpace = 'local' | 'world';
export type RenderMode = 'solid' | 'wireframe' | 'xray' | 'matcap';

export interface ViewportSettings {
  backgroundColor?: THREE.Color;
  hdri?: THREE.Texture;
  exposure?: number;
  gridSize?: number;
  gridVisible?: boolean;
  axesVisible?: boolean;
}

export interface ViewportManagerOptions {
  canvas: HTMLCanvasElement;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  enableControls?: boolean;
  enableGizmo?: boolean;
  enableGrid?: boolean;
  enableAxes?: boolean;
}

// ============================================================================
// Universal Viewport Manager
// ============================================================================

export class ViewportManager {
  // Core Three.js components
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private canvas: HTMLCanvasElement;

  // Controls
  private orbitControls: OrbitControls | null = null;
  private transformControls: TransformControls | null = null;

  // Visual helpers
  private gridHelper: THREE.GridHelper | null = null;
  private axesHelper: THREE.AxesHelper | null = null;

  // Selection management
  private selectedObjects: Set<THREE.Object3D> = new Set();
  private selectionOutlines: Map<THREE.Object3D, THREE.LineSegments> = new Map();

  // Rendering state
  private currentRenderMode: RenderMode = 'solid';
  private matcapTexture: THREE.Texture | null = null;
  private originalMaterials: Map<THREE.Object3D, THREE.Material | THREE.Material[]> = new Map();

  // Performance optimization
  private frustumCullingEnabled: boolean = true;
  private lodEnabled: boolean = true;

  // Settings
  private settings: ViewportSettings = {
    backgroundColor: new THREE.Color(0x1a1a1a),
    exposure: 1.0,
    gridSize: 20,
    gridVisible: true,
    axesVisible: true,
  };

  constructor(options: ViewportManagerOptions) {
    this.scene = options.scene;
    this.camera = options.camera;
    this.renderer = options.renderer;
    this.canvas = options.canvas;

    // Initialize controls
    if (options.enableControls !== false) {
      this.initializeOrbitControls();
    }

    // Initialize visual helpers
    if (options.enableGrid !== false) {
      this.initializeGrid();
    }

    if (options.enableAxes !== false) {
      this.initializeAxes();
    }

    // Initialize gizmo if requested
    if (options.enableGizmo) {
      this.initializeTransformControls();
    }

    // Apply initial settings
    this.applySettings();
  }

  // ============================================================================
  // Camera Management (Requirement 8.1, 8.2, 8.8)
  // ============================================================================

  /**
   * Set the camera for the viewport
   */
  setCamera(camera: THREE.PerspectiveCamera): void {
    this.camera = camera;
    if (this.orbitControls) {
      this.orbitControls.object = camera;
    }
    if (this.transformControls) {
      this.transformControls.camera = camera;
    }
  }

  /**
   * Get current camera state (Requirement 8.8)
   */
  getCameraState(): CameraState {
    const target = this.orbitControls?.target || new THREE.Vector3(0, 0, 0);
    return {
      position: this.camera.position.toArray(),
      target: target.toArray(),
      up: this.camera.up.toArray(),
      fov: this.camera.fov,
      near: this.camera.near,
      far: this.camera.far,
    };
  }

  /**
   * Restore camera state (Requirement 8.8)
   */
  setCameraState(state: CameraState): void {
    this.camera.position.fromArray(state.position);
    this.camera.up.fromArray(state.up);
    this.camera.fov = state.fov;
    this.camera.near = state.near;
    this.camera.far = state.far;
    this.camera.updateProjectionMatrix();

    if (this.orbitControls) {
      this.orbitControls.target.fromArray(state.target);
      this.orbitControls.update();
    }
  }

  /**
   * Fit camera to view selected objects (Requirement 8.2)
   */
  fitToView(objects?: THREE.Object3D[]): void {
    const targets = objects || Array.from(this.selectedObjects);
    
    if (targets.length === 0) {
      // If no objects specified, fit to entire scene
      targets.push(this.scene);
    }

    // Calculate bounding box of all target objects
    const box = new THREE.Box3();
    targets.forEach(obj => {
      const objBox = new THREE.Box3().setFromObject(obj);
      box.union(objBox);
    });

    if (box.isEmpty()) {
      return;
    }

    // Calculate center and size
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);

    // Calculate camera distance to fit object
    const fov = this.camera.fov * (Math.PI / 180);
    const distance = maxDim / (2 * Math.tan(fov / 2));
    
    // Add padding (20% extra distance)
    const paddedDistance = distance * 1.2;

    // Position camera
    const direction = new THREE.Vector3()
      .subVectors(this.camera.position, center)
      .normalize();
    
    if (direction.length() === 0) {
      direction.set(0, 0, 1);
    }

    this.camera.position.copy(center).add(direction.multiplyScalar(paddedDistance));

    // Update orbit controls target
    if (this.orbitControls) {
      this.orbitControls.target.copy(center);
      this.orbitControls.update();
    }

    this.camera.updateProjectionMatrix();
  }

  // ============================================================================
  // Gizmo System (Requirement 8.3, 8.4)
  // ============================================================================

  /**
   * Enable transform gizmo (Requirement 8.3)
   */
  enableGizmo(mode: GizmoMode): void {
    if (!this.transformControls) {
      this.initializeTransformControls();
    }

    if (this.transformControls) {
      this.transformControls.setMode(mode);
      this.transformControls.enabled = true;
      
      // Attach to selected objects
      const selected = Array.from(this.selectedObjects);
      if (selected.length > 0) {
        this.transformControls.attach(selected[0]);
      }
    }
  }

  /**
   * Disable transform gizmo
   */
  disableGizmo(): void {
    if (this.transformControls) {
      this.transformControls.detach();
      this.transformControls.enabled = false;
    }
  }

  /**
   * Set gizmo space (Requirement 8.4)
   */
  setGizmoSpace(space: GizmoSpace): void {
    if (this.transformControls) {
      this.transformControls.setSpace(space);
    }
  }

  // ============================================================================
  // Grid and Visual Helpers
  // ============================================================================

  /**
   * Show/hide grid
   */
  showGrid(visible: boolean): void {
    if (this.gridHelper) {
      this.gridHelper.visible = visible;
    }
    this.settings.gridVisible = visible;
  }

  /**
   * Show/hide axes
   */
  showAxes(visible: boolean): void {
    if (this.axesHelper) {
      this.axesHelper.visible = visible;
    }
    this.settings.axesVisible = visible;
  }

  /**
   * Set grid size
   */
  setGridSize(size: number): void {
    if (this.gridHelper) {
      this.scene.remove(this.gridHelper);
      this.gridHelper.dispose();
    }
    
    this.settings.gridSize = size;
    this.initializeGrid();
  }

  // ============================================================================
  // Rendering Modes (Requirement 8.6)
  // ============================================================================

  /**
   * Set rendering mode (Requirement 8.6)
   */
  setRenderMode(mode: RenderMode): void {
    this.currentRenderMode = mode;
    this.applyRenderMode();
  }

  /**
   * Set matcap texture for matcap rendering mode
   */
  setMatcap(texture: THREE.Texture): void {
    this.matcapTexture = texture;
    if (this.currentRenderMode === 'matcap') {
      this.applyRenderMode();
    }
  }

  /**
   * Apply current render mode to all objects in scene
   */
  private applyRenderMode(): void {
    this.scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        this.applyRenderModeToMesh(obj);
      }
    });
  }

  /**
   * Apply render mode to a specific mesh
   */
  private applyRenderModeToMesh(mesh: THREE.Mesh): void {
    // Store original material if not already stored
    if (!this.originalMaterials.has(mesh)) {
      this.originalMaterials.set(mesh, mesh.material);
    }

    const originalMaterial = this.originalMaterials.get(mesh);

    switch (this.currentRenderMode) {
      case 'solid':
        mesh.material = originalMaterial!;
        break;

      case 'wireframe':
        if (Array.isArray(originalMaterial)) {
          mesh.material = originalMaterial.map(mat => {
            const wireframeMat = mat.clone() as THREE.Material & { wireframe?: boolean };
            wireframeMat.wireframe = true;
            return wireframeMat;
          });
        } else {
          const wireframeMat = (originalMaterial as THREE.Material).clone();
          (wireframeMat as any).wireframe = true;
          mesh.material = wireframeMat;
        }
        break;

      case 'xray':
        const xrayMat = new THREE.MeshBasicMaterial({
          color: 0x00ffff,
          transparent: true,
          opacity: 0.3,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        mesh.material = xrayMat;
        break;

      case 'matcap':
        if (this.matcapTexture) {
          const matcapMat = new THREE.MeshMatcapMaterial({
            matcap: this.matcapTexture,
          });
          mesh.material = matcapMat;
        }
        break;
    }
  }

  // ============================================================================
  // Selection Management (Requirement 8.5)
  // ============================================================================

  /**
   * Set selected objects (Requirement 8.5)
   */
  setSelection(objects: THREE.Object3D[]): void {
    // Clear previous selection
    this.clearSelection();

    // Add new selection
    objects.forEach(obj => {
      this.selectedObjects.add(obj);
      this.addSelectionOutline(obj);
    });

    // Update gizmo if enabled
    if (this.transformControls && this.transformControls.enabled && objects.length > 0) {
      this.transformControls.attach(objects[0]);
    }
  }

  /**
   * Get currently selected objects
   */
  getSelection(): THREE.Object3D[] {
    return Array.from(this.selectedObjects);
  }

  /**
   * Clear selection
   */
  private clearSelection(): void {
    // Remove outlines
    this.selectionOutlines.forEach((outline, obj) => {
      this.scene.remove(outline);
      outline.geometry.dispose();
      (outline.material as THREE.Material).dispose();
    });
    this.selectionOutlines.clear();
    this.selectedObjects.clear();

    // Detach gizmo
    if (this.transformControls) {
      this.transformControls.detach();
    }
  }

  /**
   * Add selection outline to object
   */
  private addSelectionOutline(obj: THREE.Object3D): void {
    if (!(obj instanceof THREE.Mesh)) {
      return;
    }

    // Create edge geometry for outline
    const edges = new THREE.EdgesGeometry(obj.geometry, 15);
    const lineMaterial = new THREE.LineBasicMaterial({
      color: 0xff9900,
      linewidth: 2,
      depthTest: false,
      transparent: true,
      opacity: 0.8,
    });
    const outline = new THREE.LineSegments(edges, lineMaterial);
    
    // Match transform of original object
    outline.position.copy(obj.position);
    outline.rotation.copy(obj.rotation);
    outline.scale.copy(obj.scale);
    outline.renderOrder = 999;

    this.scene.add(outline);
    this.selectionOutlines.set(obj, outline);
  }

  // ============================================================================
  // Viewport Settings
  // ============================================================================

  /**
   * Set background color
   */
  setBackgroundColor(color: THREE.Color): void {
    this.settings.backgroundColor = color;
    this.scene.background = color;
  }

  /**
   * Set HDRI environment
   */
  setHDRI(hdri: THREE.Texture): void {
    this.settings.hdri = hdri;
    this.scene.environment = hdri;
  }

  /**
   * Set exposure
   */
  setExposure(exposure: number): void {
    this.settings.exposure = exposure;
    this.renderer.toneMappingExposure = exposure;
  }

  // ============================================================================
  // Performance Optimization (Requirement 8.7)
  // ============================================================================

  /**
   * Enable/disable frustum culling
   */
  setFrustumCulling(enabled: boolean): void {
    this.frustumCullingEnabled = enabled;
    this.scene.traverse((obj) => {
      obj.frustumCulled = enabled;
    });
  }

  /**
   * Enable/disable LOD
   */
  setLOD(enabled: boolean): void {
    this.lodEnabled = enabled;
  }

  /**
   * Update LOD levels based on camera distance
   */
  updateLOD(): void {
    if (!this.lodEnabled) return;

    this.scene.traverse((obj) => {
      if (obj instanceof THREE.LOD) {
        obj.update(this.camera);
      }
    });
  }

  // ============================================================================
  // Initialization Methods
  // ============================================================================

  private initializeOrbitControls(): void {
    this.orbitControls = new OrbitControls(this.camera, this.canvas);
    this.orbitControls.enableDamping = true;
    this.orbitControls.dampingFactor = 0.05;
    this.orbitControls.screenSpacePanning = false;
    this.orbitControls.minDistance = 0.1;
    this.orbitControls.maxDistance = 1000;
  }

  private initializeTransformControls(): void {
    this.transformControls = new TransformControls(this.camera, this.canvas);
    this.scene.add(this.transformControls);

    // Disable orbit controls when using transform controls
    this.transformControls.addEventListener('dragging-changed', (event) => {
      if (this.orbitControls) {
        this.orbitControls.enabled = !event.value;
      }
    });
  }

  private initializeGrid(): void {
    const size = this.settings.gridSize || 20;
    this.gridHelper = new THREE.GridHelper(size, size, 0x444444, 0x222222);
    this.gridHelper.position.y = 0;
    this.gridHelper.visible = this.settings.gridVisible !== false;
    this.scene.add(this.gridHelper);
  }

  private initializeAxes(): void {
    this.axesHelper = new THREE.AxesHelper(5);
    this.axesHelper.visible = this.settings.axesVisible !== false;
    this.scene.add(this.axesHelper);
  }

  private applySettings(): void {
    if (this.settings.backgroundColor) {
      this.scene.background = this.settings.backgroundColor;
    }
    if (this.settings.hdri) {
      this.scene.environment = this.settings.hdri;
    }
    if (this.settings.exposure !== undefined) {
      this.renderer.toneMappingExposure = this.settings.exposure;
    }
  }

  // ============================================================================
  // Update and Cleanup
  // ============================================================================

  /**
   * Update viewport (call in animation loop)
   */
  update(): void {
    if (this.orbitControls) {
      this.orbitControls.update();
    }

    // Update LOD
    this.updateLOD();

    // Update selection outlines to match object transforms
    this.selectionOutlines.forEach((outline, obj) => {
      outline.position.copy(obj.position);
      outline.rotation.copy(obj.rotation);
      outline.scale.copy(obj.scale);
    });
  }

  /**
   * Dispose of all resources
   */
  dispose(): void {
    // Dispose controls
    if (this.orbitControls) {
      this.orbitControls.dispose();
    }
    if (this.transformControls) {
      this.scene.remove(this.transformControls);
      this.transformControls.dispose();
    }

    // Dispose helpers
    if (this.gridHelper) {
      this.scene.remove(this.gridHelper);
      this.gridHelper.dispose();
    }
    if (this.axesHelper) {
      this.scene.remove(this.axesHelper);
    }

    // Clear selection
    this.clearSelection();

    // Restore original materials
    this.originalMaterials.forEach((material, mesh) => {
      if (mesh instanceof THREE.Mesh) {
        mesh.material = material;
      }
    });
    this.originalMaterials.clear();
  }
}
