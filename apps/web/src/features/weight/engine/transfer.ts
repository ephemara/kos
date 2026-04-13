/**
 * Weight Transfer - Transfer weights between meshes
 * 
 * Implements weight transfer algorithms for copying vertex weights
 * from one mesh to another using nearest surface or nearest vertex methods.
 */

import * as THREE from 'three';
import { VertexGroup } from './weightEngine';

export interface TransferSettings {
  method: 'nearestSurface' | 'nearestVertex';
  maxDistance: number;
  falloff: boolean;
  falloffRadius: number;
}

/**
 * Octree node for spatial partitioning
 */
interface OctreeNode {
  bounds: THREE.Box3;
  vertices: number[];
  children: OctreeNode[] | null;
}

/**
 * Spatial acceleration structure for efficient nearest neighbor queries
 */
class Octree {
  private root: OctreeNode | null = null;
  private maxDepth: number = 8;
  private maxVerticesPerNode: number = 32;
  private mesh: THREE.Mesh;

  constructor(mesh: THREE.Mesh) {
    this.mesh = mesh;
    this.build();
  }

  private build(): void {
    const geometry = this.mesh.geometry;
    const position = geometry.attributes.position;
    
    // Calculate bounds
    const bounds = new THREE.Box3();
    const vertex = new THREE.Vector3();
    
    for (let i = 0; i < position.count; i++) {
      vertex.fromBufferAttribute(position, i);
      vertex.applyMatrix4(this.mesh.matrixWorld);
      bounds.expandByPoint(vertex);
    }

    // Collect all vertex indices
    const vertices: number[] = [];
    for (let i = 0; i < position.count; i++) {
      vertices.push(i);
    }

    this.root = this.buildNode(bounds, vertices, 0);
  }

  private buildNode(bounds: THREE.Box3, vertices: number[], depth: number): OctreeNode {
    const node: OctreeNode = {
      bounds,
      vertices,
      children: null,
    };

    // Stop subdivision if we've reached max depth or have few vertices
    if (depth >= this.maxDepth || vertices.length <= this.maxVerticesPerNode) {
      return node;
    }

    // Subdivide
    const center = bounds.getCenter(new THREE.Vector3());
    const size = bounds.getSize(new THREE.Vector3());
    const halfSize = size.multiplyScalar(0.5);

    const childBounds: THREE.Box3[] = [];
    for (let x = 0; x < 2; x++) {
      for (let y = 0; y < 2; y++) {
        for (let z = 0; z < 2; z++) {
          const min = new THREE.Vector3(
            center.x + (x - 0.5) * halfSize.x,
            center.y + (y - 0.5) * halfSize.y,
            center.z + (z - 0.5) * halfSize.z
          );
          const max = new THREE.Vector3(
            min.x + halfSize.x,
            min.y + halfSize.y,
            min.z + halfSize.z
          );
          childBounds.push(new THREE.Box3(min, max));
        }
      }
    }

    // Distribute vertices to children
    const childVertices: number[][] = Array(8).fill(null).map(() => []);
    const position = this.mesh.geometry.attributes.position;
    const vertex = new THREE.Vector3();

    vertices.forEach(index => {
      vertex.fromBufferAttribute(position, index);
      vertex.applyMatrix4(this.mesh.matrixWorld);

      for (let i = 0; i < 8; i++) {
        if (childBounds[i].containsPoint(vertex)) {
          childVertices[i].push(index);
          break;
        }
      }
    });

    // Create children
    node.children = [];
    for (let i = 0; i < 8; i++) {
      if (childVertices[i].length > 0) {
        node.children.push(this.buildNode(childBounds[i], childVertices[i], depth + 1));
      }
    }

    return node;
  }

  findNearest(point: THREE.Vector3, maxDistance: number): { index: number; distance: number } | null {
    if (!this.root) return null;

    let nearest: { index: number; distance: number } | null = null;
    let minDistSq = maxDistance * maxDistance;

    this.searchNode(this.root, point, minDistSq, (index, distSq) => {
      if (distSq < minDistSq) {
        minDistSq = distSq;
        nearest = { index, distance: Math.sqrt(distSq) };
      }
    });

    return nearest;
  }

  private searchNode(
    node: OctreeNode,
    point: THREE.Vector3,
    maxDistSq: number,
    callback: (index: number, distSq: number) => void
  ): void {
    // Check if point is within search radius of node bounds
    const distSq = node.bounds.distanceToPoint(point);
    if (distSq * distSq > maxDistSq) return;

    if (!node.children) {
      // Leaf node - check all vertices
      const position = this.mesh.geometry.attributes.position;
      const vertex = new THREE.Vector3();

      node.vertices.forEach(index => {
        vertex.fromBufferAttribute(position, index);
        vertex.applyMatrix4(this.mesh.matrixWorld);
        const distSq = vertex.distanceToSquared(point);
        callback(index, distSq);
      });
    } else {
      // Internal node - recurse to children
      node.children.forEach(child => {
        this.searchNode(child, point, maxDistSq, callback);
      });
    }
  }
}

export class WeightTransfer {
  private raycaster: THREE.Raycaster;
  private octreeCache: Map<THREE.Mesh, Octree> = new Map();

  constructor() {
    this.raycaster = new THREE.Raycaster();
  }

  /**
   * Get or build octree for mesh
   */
  private getOctree(mesh: THREE.Mesh): Octree {
    if (!this.octreeCache.has(mesh)) {
      this.octreeCache.set(mesh, new Octree(mesh));
    }
    return this.octreeCache.get(mesh)!;
  }

  /**
   * Transfer weights from source mesh to target mesh
   */
  transferWeights(
    sourceMesh: THREE.Mesh,
    sourceGroup: VertexGroup,
    targetMesh: THREE.Mesh,
    settings: TransferSettings
  ): Map<number, number> {
    const targetWeights = new Map<number, number>();

    if (settings.method === 'nearestSurface') {
      return this.transferNearestSurface(sourceMesh, sourceGroup, targetMesh, settings);
    } else {
      return this.transferNearestVertex(sourceMesh, sourceGroup, targetMesh, settings);
    }
  }

  /**
   * Transfer using nearest surface point (ray projection with interpolation)
   */
  private transferNearestSurface(
    sourceMesh: THREE.Mesh,
    sourceGroup: VertexGroup,
    targetMesh: THREE.Mesh,
    settings: TransferSettings
  ): Map<number, number> {
    const targetWeights = new Map<number, number>();
    const targetGeometry = targetMesh.geometry;
    const targetPosition = targetGeometry.attributes.position;
    const targetNormal = targetGeometry.attributes.normal;

    const worldPosition = new THREE.Vector3();
    const worldNormal = new THREE.Vector3();
    const normalMatrix = new THREE.Matrix3().getNormalMatrix(targetMesh.matrixWorld);

    // Compute normals if not present
    if (!targetNormal) {
      targetGeometry.computeVertexNormals();
    }

    for (let i = 0; i < targetPosition.count; i++) {
      // Get target vertex position and normal in world space
      worldPosition.fromBufferAttribute(targetPosition, i);
      worldPosition.applyMatrix4(targetMesh.matrixWorld);

      if (targetGeometry.attributes.normal) {
        worldNormal.fromBufferAttribute(targetGeometry.attributes.normal, i);
        worldNormal.applyMatrix3(normalMatrix).normalize();
      } else {
        worldNormal.set(0, 1, 0);
      }

      // Cast ray in both directions along normal
      const weight = this.sampleWeightAtPoint(
        sourceMesh,
        sourceGroup,
        worldPosition,
        worldNormal,
        settings
      );

      if (weight > 0) {
        targetWeights.set(i, weight);
      }
    }

    return targetWeights;
  }

  /**
   * Transfer using nearest vertex with octree acceleration
   */
  private transferNearestVertex(
    sourceMesh: THREE.Mesh,
    sourceGroup: VertexGroup,
    targetMesh: THREE.Mesh,
    settings: TransferSettings
  ): Map<number, number> {
    const targetWeights = new Map<number, number>();
    const targetGeometry = targetMesh.geometry;
    const targetPosition = targetGeometry.attributes.position;

    // Build octree for source mesh
    const octree = this.getOctree(sourceMesh);

    const targetWorldPosition = new THREE.Vector3();

    for (let i = 0; i < targetPosition.count; i++) {
      targetWorldPosition.fromBufferAttribute(targetPosition, i);
      targetWorldPosition.applyMatrix4(targetMesh.matrixWorld);

      // Find nearest source vertex using octree
      const nearest = octree.findNearest(targetWorldPosition, settings.maxDistance);

      if (nearest) {
        let weight = sourceGroup.weights.get(nearest.index) || 0;

        // Apply falloff
        if (settings.falloff && nearest.distance > 0) {
          const falloffFactor = 1 - Math.min(1, nearest.distance / settings.falloffRadius);
          weight *= falloffFactor;
        }

        if (weight > 0) {
          targetWeights.set(i, weight);
        }
      }
    }

    return targetWeights;
  }

  /**
   * Sample weight at a point using raycasting
   */
  private sampleWeightAtPoint(
    sourceMesh: THREE.Mesh,
    sourceGroup: VertexGroup,
    point: THREE.Vector3,
    normal: THREE.Vector3,
    settings: TransferSettings
  ): number {
    // Cast ray in normal direction
    this.raycaster.set(point, normal);
    let intersects = this.raycaster.intersectObject(sourceMesh, false);

    // If no hit, try opposite direction
    if (intersects.length === 0) {
      this.raycaster.set(point, normal.clone().negate());
      intersects = this.raycaster.intersectObject(sourceMesh, false);
    }

    if (intersects.length === 0) return 0;

    const intersection = intersects[0];
    const distance = intersection.distance;

    if (distance > settings.maxDistance) return 0;

    // Get barycentric coordinates
    const face = intersection.face;
    if (!face) return 0;

    const { a, b, c } = face;
    const bary = this.getBarycentricCoordinates(
      intersection.point,
      sourceMesh,
      a,
      b,
      c
    );

    // Interpolate weights using barycentric coordinates
    const weightA = sourceGroup.weights.get(a) || 0;
    const weightB = sourceGroup.weights.get(b) || 0;
    const weightC = sourceGroup.weights.get(c) || 0;

    let weight = weightA * bary.x + weightB * bary.y + weightC * bary.z;

    // Apply falloff
    if (settings.falloff && distance > 0) {
      const falloffFactor = 1 - Math.min(1, distance / settings.falloffRadius);
      weight *= falloffFactor;
    }

    return weight;
  }

  /**
   * Calculate barycentric coordinates for a point on a triangle
   */
  private getBarycentricCoordinates(
    point: THREE.Vector3,
    mesh: THREE.Mesh,
    indexA: number,
    indexB: number,
    indexC: number
  ): THREE.Vector3 {
    const geometry = mesh.geometry;
    const position = geometry.attributes.position;

    const a = new THREE.Vector3().fromBufferAttribute(position, indexA);
    const b = new THREE.Vector3().fromBufferAttribute(position, indexB);
    const c = new THREE.Vector3().fromBufferAttribute(position, indexC);

    a.applyMatrix4(mesh.matrixWorld);
    b.applyMatrix4(mesh.matrixWorld);
    c.applyMatrix4(mesh.matrixWorld);

    const v0 = new THREE.Vector3().subVectors(b, a);
    const v1 = new THREE.Vector3().subVectors(c, a);
    const v2 = new THREE.Vector3().subVectors(point, a);

    const d00 = v0.dot(v0);
    const d01 = v0.dot(v1);
    const d11 = v1.dot(v1);
    const d20 = v2.dot(v0);
    const d21 = v2.dot(v1);

    const denom = d00 * d11 - d01 * d01;
    
    if (Math.abs(denom) < 0.0001) {
      return new THREE.Vector3(1, 0, 0);
    }

    const v = (d11 * d20 - d01 * d21) / denom;
    const w = (d00 * d21 - d01 * d20) / denom;
    const u = 1 - v - w;

    return new THREE.Vector3(u, v, w);
  }

  /**
   * Transfer weights with automatic vertex correspondence
   * (useful for meshes with same topology but different positions)
   */
  transferWeightsTopological(
    sourceGroup: VertexGroup,
    targetVertexCount: number
  ): Map<number, number> {
    const targetWeights = new Map<number, number>();

    // Direct copy if vertex counts match
    if (sourceGroup.weights.size <= targetVertexCount) {
      sourceGroup.weights.forEach((weight, index) => {
        if (index < targetVertexCount) {
          targetWeights.set(index, weight);
        }
      });
    }

    return targetWeights;
  }

  /**
   * Smooth transferred weights to reduce artifacts
   */
  smoothTransferredWeights(
    mesh: THREE.Mesh,
    weights: Map<number, number>,
    iterations: number = 1
  ): Map<number, number> {
    const geometry = mesh.geometry;
    const index = geometry.index;
    if (!index) return weights;

    // Build adjacency
    const adjacency = this.buildAdjacency(geometry);

    let currentWeights = new Map(weights);

    for (let iter = 0; iter < iterations; iter++) {
      const newWeights = new Map<number, number>();

      currentWeights.forEach((weight, vertexIndex) => {
        const neighbors = adjacency.get(vertexIndex) || [];
        
        let sum = weight;
        let count = 1;

        neighbors.forEach(neighborIndex => {
          sum += currentWeights.get(neighborIndex) || 0;
          count++;
        });

        newWeights.set(vertexIndex, sum / count);
      });

      currentWeights = newWeights;
    }

    return currentWeights;
  }

  /**
   * Build vertex adjacency map
   */
  private buildAdjacency(geometry: THREE.BufferGeometry): Map<number, number[]> {
    const adjacency = new Map<number, number[]>();
    const index = geometry.index;
    if (!index) return adjacency;

    const indexArray = index.array;

    for (let i = 0; i < indexArray.length; i += 3) {
      const i0 = indexArray[i];
      const i1 = indexArray[i + 1];
      const i2 = indexArray[i + 2];

      this.addAdjacency(adjacency, i0, i1);
      this.addAdjacency(adjacency, i0, i2);
      this.addAdjacency(adjacency, i1, i0);
      this.addAdjacency(adjacency, i1, i2);
      this.addAdjacency(adjacency, i2, i0);
      this.addAdjacency(adjacency, i2, i1);
    }

    return adjacency;
  }

  private addAdjacency(adjacency: Map<number, number[]>, from: number, to: number): void {
    if (!adjacency.has(from)) {
      adjacency.set(from, []);
    }
    const neighbors = adjacency.get(from)!;
    if (!neighbors.includes(to)) {
      neighbors.push(to);
    }
  }

  dispose(): void {
    this.octreeCache.clear();
  }
}
