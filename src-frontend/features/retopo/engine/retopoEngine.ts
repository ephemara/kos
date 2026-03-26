import * as THREE from 'three';
import { DrawingTools } from './drawingTools';
import { TopologyTools } from './topologyTools';
import { SnappingSystem } from './snapping';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export type RetopoMode = 'draw' | 'select' | 'move' | 'extrude' | 'loop';

export interface TopologyStats {
  vertices: number;
  edges: number;
  faces: number;
  quads: number;
  tris: number;
  ngons: number;
}

/**
 * Core retopology engine for KRetopo
 * Manages 3D scene, reference mesh, retopo mesh, and tool systems
 */
export class RetopoEngine {
  private canvas: HTMLCanvasElement;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;

  // Reference mesh (high-poly sculpt)
  private referenceMesh: THREE.Mesh | null = null;
  private referenceMaterial: THREE.Material | null = null;

  // Retopo mesh (clean quad topology being created)
  private retopoMesh: THREE.Mesh | null = null;
  private retopoGeometry: THREE.BufferGeometry | null = null;

  // Tool systems
  private drawingTools: DrawingTools;
  private topologyTools: TopologyTools;
  private snappingSystem: SnappingSystem;

  // State
  private mode: RetopoMode = 'draw';

  // Animation
  private animationId: number | null = null;

  // Mouse interaction
  private raycaster: THREE.Raycaster;
  private mouse: THREE.Vector2;

  private createRenderer(canvas: HTMLCanvasElement): THREE.WebGLRenderer {
    try {
      return new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: false,
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
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    // Initialize Three.js scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1a1a);

    // Camera
    const width = canvas.clientWidth || canvas.width || 1;
    const height = canvas.clientHeight || canvas.height || 1;
    this.camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
    this.camera.position.set(0, 0, 5);

    // Renderer
    this.renderer = this.createRenderer(canvas);
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    // Controls
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 5, 5);
    this.scene.add(directionalLight);

    // Grid
    const gridHelper = new THREE.GridHelper(10, 10, 0x444444, 0x222222);
    this.scene.add(gridHelper);

    // Initialize tool systems
    this.drawingTools = new DrawingTools(this.scene, this.camera);
    this.topologyTools = new TopologyTools();
    this.snappingSystem = new SnappingSystem();

    // Handle window resize
    window.addEventListener('resize', this.handleResize);

    // Mouse event handlers for drawing
    canvas.addEventListener('click', this.handleClick);
    canvas.addEventListener('mousemove', this.handleMouseMove);
    canvas.addEventListener('contextmenu', this.handleContextMenu);
  }

  /**
   * Initialize the engine and start render loop
   */
  initialize(): void {
    this.animate();
  }

  /**
   * Set the current tool mode
   */
  setMode(mode: RetopoMode): void {
    this.mode = mode;
    this.drawingTools.setMode(mode);
  }

  /**
   * Load reference mesh for surface snapping
   */
  setReferenceMesh(mesh: THREE.Mesh): void {
    // Remove old reference mesh
    if (this.referenceMesh) {
      this.scene.remove(this.referenceMesh);
    }

    // Clone and setup reference mesh
    this.referenceMesh = mesh.clone();
    
    // Create semi-transparent material for reference
    this.referenceMaterial = new THREE.MeshStandardMaterial({
      color: 0x666666,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.referenceMesh.material = this.referenceMaterial;

    this.scene.add(this.referenceMesh);

    // Setup snapping system with reference mesh
    this.snappingSystem.setReferenceMesh(this.referenceMesh);

    // Fit camera to view
    this.fitToView();
  }

  /**
   * Enable/disable surface snapping
   */
  enableSurfaceSnapping(enabled: boolean): void {
    this.snappingSystem.setEnabled(enabled);
  }

  /**
   * Set snap distance threshold
   */
  setSnapDistance(distance: number): void {
    this.snappingSystem.setSnapDistance(distance);
  }

  /**
   * Enable symmetry on specified axis
   */
  enableSymmetry(axis: 'x' | 'y' | 'z'): void {
    this.drawingTools.enableSymmetry(axis);
  }

  /**
   * Disable symmetry
   */
  disableSymmetry(): void {
    this.drawingTools.disableSymmetry();
  }

  /**
   * Run auto-retopology algorithm
   * This will call the Rust backend for auto-retopo
   */
  async autoRetopo(targetPolyCount: number): Promise<void> {
    if (!this.referenceMesh) {
      throw new Error('No reference mesh loaded');
    }

    console.log('Auto-retopo requested:', targetPolyCount);

    // Import the retopo client
    const { retopoClient } = await import('@/services/retopoClient');

    // Perform auto-retopo with progress reporting
    const retopoGeometry = await retopoClient.autoRetopoMesh(
      this.referenceMesh,
      targetPolyCount,
      (progress) => {
        console.log(`[Auto-Retopo] ${progress.stage}: ${progress.message} (${(progress.progress * 100).toFixed(0)}%)`);
      }
    );

    // Create retopo mesh with the result
    const material = new THREE.MeshStandardMaterial({
      color: 0x4a9eff,
      side: THREE.DoubleSide,
      wireframe: false,
    });

    // Remove old retopo mesh if exists
    if (this.retopoMesh) {
      this.scene.remove(this.retopoMesh);
      this.retopoMesh.geometry.dispose();
    }

    // Create new retopo mesh
    this.retopoMesh = new THREE.Mesh(retopoGeometry, material);
    this.retopoGeometry = retopoGeometry;
    this.scene.add(this.retopoMesh);

    console.log(`Auto-retopo complete: ${retopoGeometry.index?.count ? retopoGeometry.index.count / 3 : 0} triangles`);
  }

  /**
   * Export the retopo mesh
   */
  exportMesh(): THREE.Mesh | null {
    if (!this.retopoMesh) {
      return null;
    }

    // Validate mesh is manifold
    const isValid = this.topologyTools.validateManifold(this.retopoMesh);
    if (!isValid) {
      console.warn('Retopo mesh is not manifold');
    }

    return this.retopoMesh.clone();
  }

  /**
   * Get topology statistics
   */
  getTopologyStats(): TopologyStats {
    if (!this.retopoGeometry) {
      return {
        vertices: 0,
        edges: 0,
        faces: 0,
        quads: 0,
        tris: 0,
        ngons: 0,
      };
    }

    return this.topologyTools.analyzeTopology(this.retopoGeometry);
  }

  /**
   * Insert an edge loop at the specified position
   * Exposes topology tool for UI interaction
   */
  insertEdgeLoop(edge: { v1: number; v2: number }, position: number = 0.5): void {
    if (!this.retopoMesh) {
      console.warn('No retopo mesh to modify');
      return;
    }

    this.topologyTools.insertEdgeLoop(this.retopoMesh, edge, position);
    this.retopoGeometry = this.retopoMesh.geometry;
  }

  /**
   * Dissolve an edge (merge adjacent faces)
   * Exposes topology tool for UI interaction
   */
  dissolveEdge(edge: { v1: number; v2: number }): void {
    if (!this.retopoMesh) {
      console.warn('No retopo mesh to modify');
      return;
    }

    this.topologyTools.dissolveEdge(this.retopoMesh, edge);
    this.retopoGeometry = this.retopoMesh.geometry;
  }

  /**
   * Collapse an edge (merge vertices)
   * Exposes topology tool for UI interaction
   */
  collapseEdge(edge: { v1: number; v2: number }): void {
    if (!this.retopoMesh) {
      console.warn('No retopo mesh to modify');
      return;
    }

    this.topologyTools.collapseEdge(this.retopoMesh, edge);
    this.retopoGeometry = this.retopoMesh.geometry;
  }

  /**
   * Subdivide a quad face into 4 quads
   * Exposes topology tool for UI interaction
   */
  subdivideQuad(face: { vertices: number[] }): void {
    if (!this.retopoMesh) {
      console.warn('No retopo mesh to modify');
      return;
    }

    this.topologyTools.subdivideQuad(this.retopoMesh, face);
    this.retopoGeometry = this.retopoMesh.geometry;
  }

  /**
   * Get the retopo mesh for operations
   * Creates one if it doesn't exist
   */
  getOrCreateRetopoMesh(): THREE.Mesh {
    if (!this.retopoMesh) {
      this.retopoGeometry = new THREE.BufferGeometry();
      const material = new THREE.MeshStandardMaterial({
        color: 0x4a9eff,
        side: THREE.DoubleSide,
        wireframe: false,
      });
      this.retopoMesh = new THREE.Mesh(this.retopoGeometry, material);
      this.scene.add(this.retopoMesh);
    }
    return this.retopoMesh;
  }

  /**
   * Update retopo mesh from drawing tools
   * Merges all created meshes into a single retopo mesh
   */
  updateRetopoMesh(): void {
    const createdMeshes = this.drawingTools.getCreatedMeshes();
    
    if (createdMeshes.length === 0) {
      return;
    }

    // Merge all created meshes into the retopo mesh
    const mergedGeometry = new THREE.BufferGeometry();
    const positions: number[] = [];
    const indices: number[] = [];
    let vertexOffset = 0;

    createdMeshes.forEach(mesh => {
      const geometry = mesh.geometry;
      const posAttr = geometry.getAttribute('position');
      const indexAttr = geometry.getIndex();

      if (!posAttr || !indexAttr) return;

      // Add positions
      for (let i = 0; i < posAttr.count; i++) {
        positions.push(
          posAttr.getX(i),
          posAttr.getY(i),
          posAttr.getZ(i)
        );
      }

      // Add indices with offset
      for (let i = 0; i < indexAttr.count; i++) {
        indices.push(indexAttr.getX(i) + vertexOffset);
      }

      vertexOffset += posAttr.count;
    });

    mergedGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
    mergedGeometry.setIndex(indices);
    mergedGeometry.computeVertexNormals();

    // Update retopo mesh
    const retopoMesh = this.getOrCreateRetopoMesh();
    retopoMesh.geometry.dispose();
    retopoMesh.geometry = mergedGeometry;
    this.retopoGeometry = mergedGeometry;
  }

  /**
   * Fit camera to view all objects
   */
  private fitToView(): void {
    if (!this.referenceMesh) return;

    const box = new THREE.Box3().setFromObject(this.referenceMesh);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());

    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = this.camera.fov * (Math.PI / 180);
    let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
    cameraZ *= 1.5; // Add some padding

    this.camera.position.set(center.x, center.y, center.z + cameraZ);
    this.controls.target.copy(center);
    this.controls.update();
  }

  /**
   * Handle mouse click for drawing
   */
  private handleClick = (event: MouseEvent): void => {
    if (this.mode !== 'draw') return;

    // Update mouse coordinates
    this.updateMouseCoords(event);

    // Raycast to find 3D point
    const point = this.getWorldPointFromMouse();
    if (!point) return;

    // Snap to surface if enabled
    const snappedPoint = this.snappingSystem.snapToSurface(point);

    // Add point to drawing tools
    this.drawingTools.addPoint(snappedPoint);
  };

  /**
   * Handle mouse move for preview
   */
  private handleMouseMove = (event: MouseEvent): void => {
    if (this.mode !== 'draw') return;

    this.updateMouseCoords(event);

    // Update preview in drawing tools
    const point = this.getWorldPointFromMouse();
    if (point) {
      const snappedPoint = this.snappingSystem.snapToSurface(point);
      this.drawingTools.updatePreview(snappedPoint);
    }
  };

  /**
   * Handle right-click to cancel drawing
   */
  private handleContextMenu = (event: MouseEvent): void => {
    event.preventDefault();
    
    if (this.mode === 'draw') {
      this.drawingTools.cancelDrawing();
    }
  };

  /**
   * Update mouse coordinates from event
   */
  private updateMouseCoords(event: MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  /**
   * Get 3D world point from mouse position using raycasting
   */
  private getWorldPointFromMouse(): THREE.Vector3 | null {
    // Update raycaster
    this.raycaster.setFromCamera(this.mouse, this.camera);

    // If we have a reference mesh, raycast against it
    if (this.referenceMesh) {
      const intersects = this.raycaster.intersectObject(this.referenceMesh, false);
      if (intersects.length > 0) {
        return intersects[0].point.clone();
      }
    }

    // Otherwise, raycast against a ground plane
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const planePoint = new THREE.Vector3();
    this.raycaster.ray.intersectPlane(plane, planePoint);
    
    return planePoint.length() > 0 ? planePoint : null;
  }

  /**
   * Handle window resize
   */
  private handleResize = (): void => {
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(width, height);
  };

  /**
   * Animation loop
   */
  private animate = (): void => {
    this.animationId = requestAnimationFrame(this.animate);

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };

  /**
   * Cleanup and dispose resources
   */
  dispose(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
    }

    // Remove event listeners
    window.removeEventListener('resize', this.handleResize);
    this.canvas.removeEventListener('click', this.handleClick);
    this.canvas.removeEventListener('mousemove', this.handleMouseMove);
    this.canvas.removeEventListener('contextmenu', this.handleContextMenu);

    this.renderer.dispose();
    this.controls.dispose();

    if (this.referenceMaterial) {
      this.referenceMaterial.dispose();
    }

    if (this.retopoGeometry) {
      this.retopoGeometry.dispose();
    }

    this.drawingTools.dispose();
  }
}
