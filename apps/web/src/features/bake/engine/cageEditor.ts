/**
 * CageEditor - Manual cage editing tools
 * 
 * Provides vertex manipulation tools for fine-tuning cage meshes.
 * Allows users to manually adjust cage vertices to fix problem areas.
 */

import * as THREE from 'three';
import type { BakeMesh } from './bakeEngine';

export interface CageEditMode {
  type: 'select' | 'move' | 'scale' | 'smooth';
  radius?: number;
  strength?: number;
}

export class CageEditor {
  private mesh: THREE.Mesh | null = null;
  private originalPositions: Float32Array | null = null;
  private selectedVertices: Set<number> = new Set();
  private mode: CageEditMode = { type: 'select' };
  private raycaster: THREE.Raycaster;
  private camera: THREE.Camera | null = null;

  constructor() {
    this.raycaster = new THREE.Raycaster();
    this.raycaster.params.Points = { threshold: 0.1 };
  }

  /**
   * Set the cage mesh to edit
   */
  setCageMesh(mesh: THREE.Mesh): void {
    this.mesh = mesh;
    
    // Store original positions for reset
    const positions = mesh.geometry.attributes.position.array as Float32Array;
    this.originalPositions = new Float32Array(positions);
    
    this.selectedVertices.clear();
  }

  /**
   * Set the camera for raycasting
   */
  setCamera(camera: THREE.Camera): void {
    this.camera = camera;
  }

  /**
   * Set edit mode
   */
  setMode(mode: CageEditMode): void {
    this.mode = mode;
  }

  /**
   * Get current edit mode
   */
  getMode(): CageEditMode {
    return this.mode;
  }

  /**
   * Select vertices at screen position
   */
  selectVertices(screenX: number, screenY: number, addToSelection: boolean = false): number {
    if (!this.mesh || !this.camera) return 0;

    // Convert screen coordinates to normalized device coordinates
    const rect = (this.camera as any).domElement?.getBoundingClientRect();
    if (!rect) return 0;

    const x = ((screenX - rect.left) / rect.width) * 2 - 1;
    const y = -((screenY - rect.top) / rect.height) * 2 + 1;

    // Raycast to find intersected vertices
    this.raycaster.setFromCamera(new THREE.Vector2(x, y), this.camera);
    const intersects = this.raycaster.intersectObject(this.mesh);

    if (intersects.length === 0) {
      if (!addToSelection) {
        this.selectedVertices.clear();
      }
      return 0;
    }

    // Find vertices within selection radius
    const point = intersects[0].point;
    const positions = this.mesh.geometry.attributes.position.array as Float32Array;
    const radius = this.mode.radius ?? 0.5;

    if (!addToSelection) {
      this.selectedVertices.clear();
    }

    let count = 0;
    for (let i = 0; i < positions.length; i += 3) {
      const vx = positions[i];
      const vy = positions[i + 1];
      const vz = positions[i + 2];

      const dx = vx - point.x;
      const dy = vy - point.y;
      const dz = vz - point.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

      if (dist <= radius) {
        this.selectedVertices.add(i / 3);
        count++;
      }
    }

    return count;
  }

  /**
   * Move selected vertices
   */
  moveVertices(delta: THREE.Vector3): void {
    if (!this.mesh || this.selectedVertices.size === 0) return;

    const positions = this.mesh.geometry.attributes.position.array as Float32Array;

    for (const vertexIndex of this.selectedVertices) {
      const i = vertexIndex * 3;
      positions[i] += delta.x;
      positions[i + 1] += delta.y;
      positions[i + 2] += delta.z;
    }

    this.mesh.geometry.attributes.position.needsUpdate = true;
    this.mesh.geometry.computeVertexNormals();
  }

  /**
   * Scale selected vertices from center
   */
  scaleVertices(scale: number, center?: THREE.Vector3): void {
    if (!this.mesh || this.selectedVertices.size === 0) return;

    const positions = this.mesh.geometry.attributes.position.array as Float32Array;

    // Calculate center if not provided
    const scaleCenter = center || this.getSelectionCenter();

    for (const vertexIndex of this.selectedVertices) {
      const i = vertexIndex * 3;
      const x = positions[i];
      const y = positions[i + 1];
      const z = positions[i + 2];

      // Scale from center
      positions[i] = scaleCenter.x + (x - scaleCenter.x) * scale;
      positions[i + 1] = scaleCenter.y + (y - scaleCenter.y) * scale;
      positions[i + 2] = scaleCenter.z + (z - scaleCenter.z) * scale;
    }

    this.mesh.geometry.attributes.position.needsUpdate = true;
    this.mesh.geometry.computeVertexNormals();
  }

  /**
   * Smooth selected vertices
   */
  smoothVertices(iterations: number = 1): void {
    if (!this.mesh || this.selectedVertices.size === 0) return;

    const positions = this.mesh.geometry.attributes.position.array as Float32Array;
    const indices = this.mesh.geometry.index?.array as Uint32Array;

    if (!indices) return;

    // Build adjacency list
    const adjacency = new Map<number, Set<number>>();
    for (let i = 0; i < indices.length; i += 3) {
      const v0 = indices[i];
      const v1 = indices[i + 1];
      const v2 = indices[i + 2];

      if (!adjacency.has(v0)) adjacency.set(v0, new Set());
      if (!adjacency.has(v1)) adjacency.set(v1, new Set());
      if (!adjacency.has(v2)) adjacency.set(v2, new Set());

      adjacency.get(v0)!.add(v1);
      adjacency.get(v0)!.add(v2);
      adjacency.get(v1)!.add(v0);
      adjacency.get(v1)!.add(v2);
      adjacency.get(v2)!.add(v0);
      adjacency.get(v2)!.add(v1);
    }

    // Smooth iterations
    for (let iter = 0; iter < iterations; iter++) {
      const newPositions = new Float32Array(positions);

      for (const vertexIndex of this.selectedVertices) {
        const neighbors = adjacency.get(vertexIndex);
        if (!neighbors || neighbors.size === 0) continue;

        let avgX = 0, avgY = 0, avgZ = 0;
        for (const neighbor of neighbors) {
          const ni = neighbor * 3;
          avgX += positions[ni];
          avgY += positions[ni + 1];
          avgZ += positions[ni + 2];
        }

        const count = neighbors.size;
        const i = vertexIndex * 3;
        const strength = this.mode.strength ?? 0.5;

        // Blend between original and smoothed position
        newPositions[i] = positions[i] * (1 - strength) + (avgX / count) * strength;
        newPositions[i + 1] = positions[i + 1] * (1 - strength) + (avgY / count) * strength;
        newPositions[i + 2] = positions[i + 2] * (1 - strength) + (avgZ / count) * strength;
      }

      positions.set(newPositions);
    }

    this.mesh.geometry.attributes.position.needsUpdate = true;
    this.mesh.geometry.computeVertexNormals();
  }

  /**
   * Reset cage to original positions
   */
  reset(): void {
    if (!this.mesh || !this.originalPositions) return;

    const positions = this.mesh.geometry.attributes.position.array as Float32Array;
    positions.set(this.originalPositions);

    this.mesh.geometry.attributes.position.needsUpdate = true;
    this.mesh.geometry.computeVertexNormals();
  }

  /**
   * Get selected vertex count
   */
  getSelectionCount(): number {
    return this.selectedVertices.size;
  }

  /**
   * Clear selection
   */
  clearSelection(): void {
    this.selectedVertices.clear();
  }

  /**
   * Get selection center
   */
  getSelectionCenter(): THREE.Vector3 {
    if (!this.mesh || this.selectedVertices.size === 0) {
      return new THREE.Vector3();
    }

    const positions = this.mesh.geometry.attributes.position.array as Float32Array;
    const center = new THREE.Vector3();

    for (const vertexIndex of this.selectedVertices) {
      const i = vertexIndex * 3;
      center.x += positions[i];
      center.y += positions[i + 1];
      center.z += positions[i + 2];
    }

    center.divideScalar(this.selectedVertices.size);
    return center;
  }

  /**
   * Export edited cage mesh
   */
  exportCageMesh(): BakeMesh | null {
    if (!this.mesh) return null;

    const geometry = this.mesh.geometry;
    const positions = geometry.attributes.position.array as Float32Array;
    const normals = geometry.attributes.normal.array as Float32Array;
    const indices = geometry.index?.array as Uint32Array;

    if (!indices) return null;

    // Generate tangents if not present
    if (!geometry.attributes.tangent) {
      geometry.computeTangents();
    }
    const tangents = geometry.attributes.tangent.array as Float32Array;

    // UVs might not exist for cage mesh, create dummy UVs
    const uvs = geometry.attributes.uv?.array as Float32Array || new Float32Array(positions.length / 3 * 2);

    return {
      positions: new Float32Array(positions),
      normals: new Float32Array(normals),
      tangents: new Float32Array(tangents),
      uvs: new Float32Array(uvs),
      indices: new Uint32Array(indices)
    };
  }

  /**
   * Visualize selected vertices
   */
  createSelectionVisualization(): THREE.Points | null {
    if (!this.mesh || this.selectedVertices.size === 0) return null;

    const positions = this.mesh.geometry.attributes.position.array as Float32Array;
    const selectedPositions: number[] = [];

    for (const vertexIndex of this.selectedVertices) {
      const i = vertexIndex * 3;
      selectedPositions.push(positions[i], positions[i + 1], positions[i + 2]);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(selectedPositions, 3));

    const material = new THREE.PointsMaterial({
      color: 0xffff00,
      size: 0.05,
      sizeAttenuation: true
    });

    return new THREE.Points(geometry, material);
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this.mesh = null;
    this.originalPositions = null;
    this.selectedVertices.clear();
    this.camera = null;
  }
}
