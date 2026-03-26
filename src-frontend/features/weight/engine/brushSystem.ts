/**
 * Brush System - Weight painting brush implementation
 * 
 * Handles brush-based weight painting with various falloff curves,
 * raycasting for surface interaction, and affected vertex calculation.
 */

import * as THREE from 'three';

export interface BrushSettings {
  radius: number;
  strength: number;
  falloff: 'linear' | 'smooth' | 'sharp' | 'constant';
  spacing: number; // For stroke sampling
}

export interface AffectedVertex {
  index: number;
  influence: number; // [0, 1] based on distance and falloff
  distance: number;
}

export class BrushSystem {
  private mesh: THREE.Mesh | null = null;
  private raycaster: THREE.Raycaster;
  private spatialHash: Map<string, number[]> | null = null;
  private cellSize: number = 0.1;

  constructor() {
    this.raycaster = new THREE.Raycaster();
    this.raycaster.params.Points!.threshold = 0.1;
  }

  setMesh(mesh: THREE.Mesh): void {
    this.mesh = mesh;
    this.buildSpatialHash();
  }

  /**
   * Get vertices affected by brush at given position
   */
  getAffectedVertices(
    position: THREE.Vector3,
    radius: number,
    falloff: 'linear' | 'smooth' | 'sharp' | 'constant'
  ): AffectedVertex[] {
    if (!this.mesh) return [];
    if (radius <= 0) return [];

    const geometry = this.mesh.geometry;
    const positionAttr = geometry.attributes.position;
    const affected: AffectedVertex[] = [];

    // Use spatial hash for efficient lookup
    const candidates = this.getCandidateVertices(position, radius);

    const worldPosition = new THREE.Vector3();
    const radiusSquared = radius * radius;

    candidates.forEach(index => {
      worldPosition.fromBufferAttribute(positionAttr, index);
      worldPosition.applyMatrix4(this.mesh!.matrixWorld);

      const distanceSquared = worldPosition.distanceToSquared(position);
      
      if (distanceSquared <= radiusSquared) {
        const distance = Math.sqrt(distanceSquared);
        const influence = this.calculateInfluence(distance, radius, falloff);
        
        affected.push({
          index,
          influence,
          distance,
        });
      }
    });

    return affected;
  }

  /**
   * Raycast to find surface position under cursor
   */
  raycastSurface(
    mouse: THREE.Vector2,
    camera: THREE.Camera
  ): THREE.Vector3 | null {
    if (!this.mesh) return null;

    this.raycaster.setFromCamera(mouse, camera);
    const intersects = this.raycaster.intersectObject(this.mesh, false);

    if (intersects.length > 0) {
      return intersects[0].point;
    }

    return null;
  }

  /**
   * Get closest vertex to a point
   */
  getClosestVertex(position: THREE.Vector3): number | null {
    if (!this.mesh) return null;

    const geometry = this.mesh.geometry;
    const positionAttr = geometry.attributes.position;
    
    let closestIndex = -1;
    let closestDistance = Infinity;
    const worldPosition = new THREE.Vector3();

    for (let i = 0; i < positionAttr.count; i++) {
      worldPosition.fromBufferAttribute(positionAttr, i);
      worldPosition.applyMatrix4(this.mesh.matrixWorld);

      const distance = worldPosition.distanceTo(position);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = i;
      }
    }

    return closestIndex >= 0 ? closestIndex : null;
  }

  /**
   * Calculate influence based on distance and falloff curve
   */
  private calculateInfluence(
    distance: number,
    radius: number,
    falloff: 'linear' | 'smooth' | 'sharp' | 'constant'
  ): number {
    if (radius <= 0) return 0;
    if (falloff === 'constant') return distance <= radius ? 1 : 0;
    if (distance >= radius) return 0;
    if (distance === 0) return 1;

    const t = distance / radius;

    switch (falloff) {
      case 'linear':
        return 1 - t;
      
      case 'smooth':
        // Smoothstep
        return 1 - (t * t * (3 - 2 * t));
      
      case 'sharp':
        // Quadratic falloff
        return 1 - (t * t);
      
      default:
        return 1 - t;
    }
  }

  /**
   * Build spatial hash for efficient vertex lookup
   */
  private buildSpatialHash(): void {
    if (!this.mesh) return;

    this.spatialHash = new Map();
    const geometry = this.mesh.geometry;
    const positionAttr = geometry.attributes.position;
    const worldPosition = new THREE.Vector3();

    for (let i = 0; i < positionAttr.count; i++) {
      worldPosition.fromBufferAttribute(positionAttr, i);
      worldPosition.applyMatrix4(this.mesh.matrixWorld);

      const cellKey = this.getCellKey(worldPosition);
      
      if (!this.spatialHash.has(cellKey)) {
        this.spatialHash.set(cellKey, []);
      }
      this.spatialHash.get(cellKey)!.push(i);
    }
  }

  /**
   * Get candidate vertices from spatial hash
   */
  private getCandidateVertices(position: THREE.Vector3, radius: number): number[] {
    if (!this.spatialHash) return [];

    const candidates = new Set<number>();
    const cellRadius = Math.ceil(radius / this.cellSize);

    const centerCell = this.getCellCoords(position);

    // Check neighboring cells
    for (let x = -cellRadius; x <= cellRadius; x++) {
      for (let y = -cellRadius; y <= cellRadius; y++) {
        for (let z = -cellRadius; z <= cellRadius; z++) {
          const cellKey = `${centerCell.x + x},${centerCell.y + y},${centerCell.z + z}`;
          const vertices = this.spatialHash.get(cellKey);
          
          if (vertices) {
            vertices.forEach(v => candidates.add(v));
          }
        }
      }
    }

    return Array.from(candidates);
  }

  /**
   * Get spatial hash cell key for position
   */
  private getCellKey(position: THREE.Vector3): string {
    const coords = this.getCellCoords(position);
    return `${coords.x},${coords.y},${coords.z}`;
  }

  /**
   * Get spatial hash cell coordinates
   */
  private getCellCoords(position: THREE.Vector3): { x: number; y: number; z: number } {
    return {
      x: Math.floor(position.x / this.cellSize),
      y: Math.floor(position.y / this.cellSize),
      z: Math.floor(position.z / this.cellSize),
    };
  }

  /**
   * Sample stroke positions for continuous painting
   */
  sampleStroke(
    start: THREE.Vector3,
    end: THREE.Vector3,
    spacing: number
  ): THREE.Vector3[] {
    const distance = start.distanceTo(end);
    const numSamples = Math.max(1, Math.ceil(distance / spacing));
    const samples: THREE.Vector3[] = [];

    for (let i = 0; i <= numSamples; i++) {
      const t = i / numSamples;
      const sample = new THREE.Vector3().lerpVectors(start, end, t);
      samples.push(sample);
    }

    return samples;
  }

  /**
   * Get brush cursor mesh for visualization
   */
  createBrushCursor(radius: number): THREE.Mesh {
    const geometry = new THREE.RingGeometry(radius * 0.95, radius, 32);
    const material = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.5,
      depthTest: false,
    });

    return new THREE.Mesh(geometry, material);
  }

  dispose(): void {
    this.mesh = null;
    this.spatialHash = null;
  }
}
