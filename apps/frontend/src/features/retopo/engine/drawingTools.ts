import * as THREE from 'three';

export type DrawMode = 'quad' | 'strip' | 'fill';

/**
 * Drawing tools for creating retopology geometry
 * Handles quad drawing, strip drawing, and hole filling
 */
export class DrawingTools {
  private scene: THREE.Scene;
  private camera: THREE.Camera;
  private mode: string = 'draw';
  private drawMode: DrawMode = 'quad';

  // Drawing state
  private drawingPoints: THREE.Vector3[] = [];
  private stripPairs: THREE.Vector3[][] = []; // For quad strip mode
  private previewMesh: THREE.Mesh | null = null;
  private previewLines: THREE.Line | null = null;
  private symmetryEnabled = false;
  private symmetryAxis: 'x' | 'y' | 'z' = 'x';

  // Visual helpers
  private pointMarkers: THREE.Mesh[] = [];
  
  // Created geometry storage
  private createdMeshes: THREE.Mesh[] = [];

  constructor(scene: THREE.Scene, camera: THREE.Camera) {
    this.scene = scene;
    this.camera = camera;
  }

  /**
   * Set the current drawing mode
   */
  setMode(mode: string): void {
    this.mode = mode;
    this.clearDrawing();
  }

  /**
   * Set the drawing tool mode (quad, strip, fill)
   */
  setDrawMode(mode: DrawMode): void {
    this.drawMode = mode;
    this.clearDrawing();
  }

  /**
   * Enable symmetry on specified axis
   */
  enableSymmetry(axis: 'x' | 'y' | 'z'): void {
    this.symmetryEnabled = true;
    this.symmetryAxis = axis;
  }

  /**
   * Disable symmetry
   */
  disableSymmetry(): void {
    this.symmetryEnabled = false;
  }

  /**
   * Add a point to the current drawing
   * Behavior depends on draw mode
   */
  addPoint(point: THREE.Vector3): void {
    switch (this.drawMode) {
      case 'quad':
        this.addQuadPoint(point);
        break;
      case 'strip':
        this.addStripPoint(point);
        break;
      case 'fill':
        this.addFillPoint(point);
        break;
    }
  }

  /**
   * Add point for quad drawing mode
   */
  private addQuadPoint(point: THREE.Vector3): void {
    this.drawingPoints.push(point.clone());

    // Add visual marker
    this.addPointMarker(point);

    // Create quad when we have 4 points
    if (this.drawingPoints.length === 4) {
      this.createQuad(this.drawingPoints);
      this.clearDrawing();
    }

    // Handle symmetry
    if (this.symmetryEnabled) {
      const mirroredPoint = this.mirrorPoint(point);
      this.addPointMarker(mirroredPoint);
    }
  }

  /**
   * Add point for quad strip mode
   * Collects pairs of points and creates connected quads
   */
  private addStripPoint(point: THREE.Vector3): void {
    this.drawingPoints.push(point.clone());
    this.addPointMarker(point);

    // When we have 2 points, create a pair
    if (this.drawingPoints.length === 2) {
      this.stripPairs.push([...this.drawingPoints]);
      
      // If we have at least 2 pairs, create a quad
      if (this.stripPairs.length >= 2) {
        const pair1 = this.stripPairs[this.stripPairs.length - 2];
        const pair2 = this.stripPairs[this.stripPairs.length - 1];
        
        // Create quad from the 4 points
        const quadPoints = [pair1[0], pair1[1], pair2[1], pair2[0]];
        this.createQuad(quadPoints);
      }
      
      // Clear points but keep the last pair for continuity
      this.drawingPoints = [];
      this.clearPointMarkers();
    }

    // Handle symmetry
    if (this.symmetryEnabled) {
      const mirroredPoint = this.mirrorPoint(point);
      this.addPointMarker(mirroredPoint);
    }
  }

  /**
   * Add point for hole filling mode
   */
  private addFillPoint(point: THREE.Vector3): void {
    this.drawingPoints.push(point.clone());
    this.addPointMarker(point);

    // Handle symmetry
    if (this.symmetryEnabled) {
      const mirroredPoint = this.mirrorPoint(point);
      this.addPointMarker(mirroredPoint);
    }
  }

  /**
   * Complete hole filling (called externally or on key press)
   */
  completeFill(): void {
    if (this.drawMode === 'fill' && this.drawingPoints.length >= 3) {
      this.fillHole(this.drawingPoints);
      this.clearDrawing();
    }
  }

  /**
   * Update preview visualization
   */
  updatePreview(point: THREE.Vector3): void {
    // Remove old preview
    if (this.previewLines) {
      this.scene.remove(this.previewLines);
      this.previewLines.geometry.dispose();
      (this.previewLines.material as THREE.Material).dispose();
      this.previewLines = null;
    }

    if (this.drawingPoints.length === 0) return;

    // Create preview lines
    const points = [...this.drawingPoints, point];
    
    // For quad mode, show preview of completing the quad
    if (this.drawMode === 'quad' && this.drawingPoints.length === 3) {
      points.push(this.drawingPoints[0]); // Close the quad
    }

    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ 
      color: 0x00ff00, 
      linewidth: 2,
      transparent: true,
      opacity: 0.6
    });
    
    this.previewLines = new THREE.Line(geometry, material);
    this.scene.add(this.previewLines);
  }

  /**
   * Cancel current drawing operation
   */
  cancelDrawing(): void {
    this.clearDrawing();
  }

  /**
   * Create a quad from 4 points
   */
  private createQuad(points: THREE.Vector3[]): void {
    if (points.length !== 4) {
      console.warn('Quad requires exactly 4 points');
      return;
    }

    // Create quad geometry
    const geometry = new THREE.BufferGeometry();
    const vertices = new Float32Array([
      points[0].x, points[0].y, points[0].z,
      points[1].x, points[1].y, points[1].z,
      points[2].x, points[2].y, points[2].z,
      points[3].x, points[3].y, points[3].z,
    ]);

    const indices = new Uint16Array([
      0, 1, 2,
      0, 2, 3,
    ]);

    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));
    geometry.computeVertexNormals();

    // Create mesh with wireframe overlay
    const material = new THREE.MeshStandardMaterial({
      color: 0x4a9eff,
      side: THREE.DoubleSide,
      wireframe: false,
      transparent: true,
      opacity: 0.8,
    });

    const mesh = new THREE.Mesh(geometry, material);
    this.scene.add(mesh);
    this.createdMeshes.push(mesh);

    // Add wireframe for better visibility
    const wireframeGeometry = new THREE.EdgesGeometry(geometry);
    const wireframeMaterial = new THREE.LineBasicMaterial({ color: 0x00ff00, linewidth: 2 });
    const wireframe = new THREE.LineSegments(wireframeGeometry, wireframeMaterial);
    mesh.add(wireframe);

    // Handle symmetry
    if (this.symmetryEnabled) {
      const mirroredPoints = points.map(p => this.mirrorPoint(p));
      this.createQuadGeometry(mirroredPoints);
    }
  }

  /**
   * Create quad geometry (helper for symmetry)
   */
  private createQuadGeometry(points: THREE.Vector3[]): void {
    const geometry = new THREE.BufferGeometry();
    const vertices = new Float32Array([
      points[0].x, points[0].y, points[0].z,
      points[1].x, points[1].y, points[1].z,
      points[2].x, points[2].y, points[2].z,
      points[3].x, points[3].y, points[3].z,
    ]);

    const indices = new Uint16Array([
      0, 1, 2,
      0, 2, 3,
    ]);

    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));
    geometry.computeVertexNormals();

    const material = new THREE.MeshStandardMaterial({
      color: 0x4a9eff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8,
    });

    const mesh = new THREE.Mesh(geometry, material);
    this.scene.add(mesh);
    this.createdMeshes.push(mesh);

    // Add wireframe
    const wireframeGeometry = new THREE.EdgesGeometry(geometry);
    const wireframeMaterial = new THREE.LineBasicMaterial({ color: 0x00ff00, linewidth: 2 });
    const wireframe = new THREE.LineSegments(wireframeGeometry, wireframeMaterial);
    mesh.add(wireframe);
  }

  /**
   * Create a quad strip from point pairs
   * Used for efficient retopology workflows
   */
  createQuadStrip(pointPairs: THREE.Vector3[][]): void {
    if (pointPairs.length < 2) {
      console.warn('Quad strip requires at least 2 point pairs');
      return;
    }

    // Create quads between consecutive pairs
    for (let i = 0; i < pointPairs.length - 1; i++) {
      const pair1 = pointPairs[i];
      const pair2 = pointPairs[i + 1];

      if (pair1.length !== 2 || pair2.length !== 2) {
        console.warn('Each pair must have exactly 2 points');
        continue;
      }

      // Create quad from the 4 points
      const quadPoints = [pair1[0], pair1[1], pair2[1], pair2[0]];
      this.createQuad(quadPoints);
    }
  }

  /**
   * Fill a hole defined by boundary edges
   * Uses simple fan triangulation for now
   */
  fillHole(boundaryPoints: THREE.Vector3[]): void {
    if (boundaryPoints.length < 3) {
      console.warn('Hole requires at least 3 boundary points');
      return;
    }

    // Calculate centroid for fan triangulation
    const centroid = new THREE.Vector3();
    boundaryPoints.forEach(p => centroid.add(p));
    centroid.divideScalar(boundaryPoints.length);

    // Create triangles from centroid to each edge
    const vertices: number[] = [];
    const indices: number[] = [];

    // Add centroid as first vertex
    vertices.push(centroid.x, centroid.y, centroid.z);

    // Add boundary points
    boundaryPoints.forEach(p => {
      vertices.push(p.x, p.y, p.z);
    });

    // Create fan triangles
    for (let i = 1; i <= boundaryPoints.length; i++) {
      const next = i === boundaryPoints.length ? 1 : i + 1;
      indices.push(0, i, next);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertices), 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    const material = new THREE.MeshStandardMaterial({
      color: 0x4a9eff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8,
    });

    const mesh = new THREE.Mesh(geometry, material);
    this.scene.add(mesh);
    this.createdMeshes.push(mesh);

    // Add wireframe
    const wireframeGeometry = new THREE.EdgesGeometry(geometry);
    const wireframeMaterial = new THREE.LineBasicMaterial({ color: 0x00ff00, linewidth: 2 });
    const wireframe = new THREE.LineSegments(wireframeGeometry, wireframeMaterial);
    mesh.add(wireframe);

    // Handle symmetry
    if (this.symmetryEnabled) {
      const mirroredPoints = boundaryPoints.map(p => this.mirrorPoint(p));
      this.fillHole(mirroredPoints);
    }
  }

  /**
   * Mirror a point across the symmetry axis
   */
  private mirrorPoint(point: THREE.Vector3): THREE.Vector3 {
    const mirrored = point.clone();

    switch (this.symmetryAxis) {
      case 'x':
        mirrored.x = -mirrored.x;
        break;
      case 'y':
        mirrored.y = -mirrored.y;
        break;
      case 'z':
        mirrored.z = -mirrored.z;
        break;
    }

    return mirrored;
  }

  /**
   * Add a visual marker for a point
   */
  private addPointMarker(point: THREE.Vector3): void {
    const geometry = new THREE.SphereGeometry(0.03, 16, 16);
    const material = new THREE.MeshBasicMaterial({ color: 0xff4444 });
    const marker = new THREE.Mesh(geometry, material);
    marker.position.copy(point);
    this.scene.add(marker);
    this.pointMarkers.push(marker);
  }

  /**
   * Clear point markers only
   */
  private clearPointMarkers(): void {
    this.pointMarkers.forEach(marker => {
      this.scene.remove(marker);
      marker.geometry.dispose();
      (marker.material as THREE.Material).dispose();
    });
    this.pointMarkers = [];
  }

  /**
   * Clear current drawing state
   */
  private clearDrawing(): void {
    this.drawingPoints = [];
    this.stripPairs = [];

    // Remove point markers
    this.clearPointMarkers();

    // Remove preview mesh
    if (this.previewMesh) {
      this.scene.remove(this.previewMesh);
      this.previewMesh.geometry.dispose();
      (this.previewMesh.material as THREE.Material).dispose();
      this.previewMesh = null;
    }

    // Remove preview lines
    if (this.previewLines) {
      this.scene.remove(this.previewLines);
      this.previewLines.geometry.dispose();
      (this.previewLines.material as THREE.Material).dispose();
      this.previewLines = null;
    }
  }

  /**
   * Get all created meshes
   */
  getCreatedMeshes(): THREE.Mesh[] {
    return this.createdMeshes;
  }

  /**
   * Clear all created geometry
   */
  clearAll(): void {
    this.createdMeshes.forEach(mesh => {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    });
    this.createdMeshes = [];
    this.clearDrawing();
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    this.clearAll();
  }
}
