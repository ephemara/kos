// @ts-nocheck
/**
 * Retopology Service Client
 * 
 * Provides TypeScript interface to Rust retopology backend
 */

import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';

export interface RetopoResult {
  vertices: number[];
  indices: number[];
  triangleCount: number;
  vertexCount: number;
}

export interface RetopoProgress {
  stage: 'starting' | 'processing' | 'finalizing' | 'complete';
  progress: number; // 0.0 to 1.0
  message: string;
}

export type RetopoProgressCallback = (progress: RetopoProgress) => void;

/**
 * Auto-retopology - Generate clean quad topology from high-poly mesh
 * 
 * @param vertices - Flat array of vertex positions [x, y, z, x, y, z, ...]
 * @param indices - Triangle indices
 * @param targetPolyCount - Target number of polygons
 * @param onProgress - Optional callback for progress updates
 * @returns Retopologized mesh data
 */
export async function autoRetopo(
  vertices: number[],
  indices: number[],
  targetPolyCount: number,
  onProgress?: RetopoProgressCallback
): Promise<RetopoResult> {
  // Validate inputs
  if (vertices.length % 3 !== 0) {
    throw new Error('Vertex array length must be multiple of 3');
  }

  if (targetPolyCount <= 0) {
    throw new Error('Target poly count must be greater than 0');
  }

  // Setup progress listener if callback provided
  let unlisten: UnlistenFn | null = null;
  if (onProgress) {
    unlisten = await listen<RetopoProgress>('retopo-progress', (event) => {
      onProgress(event.payload);
    });
  }

  try {
    const result = await invoke<RetopoResult>('auto_retopo', {
      vertices,
      indices,
      targetPolyCount,
    });

    return result;
  } finally {
    // Cleanup progress listener
    if (unlisten) {
      unlisten();
    }
  }
}

/**
 * Convert Three.js BufferGeometry to flat arrays for retopo
 */
export function geometryToArrays(geometry: THREE.BufferGeometry): {
  vertices: number[];
  indices: number[];
} {
  const positionAttr = geometry.getAttribute('position');
  const indexAttr = geometry.getIndex();

  if (!positionAttr) {
    throw new Error('Geometry has no position attribute');
  }

  // Extract vertices
  const vertices: number[] = [];
  for (let i = 0; i < positionAttr.count; i++) {
    vertices.push(
      positionAttr.getX(i),
      positionAttr.getY(i),
      positionAttr.getZ(i)
    );
  }

  // Extract indices
  let indices: number[];
  if (indexAttr) {
    indices = Array.from(indexAttr.array);
  } else {
    // Non-indexed geometry - create sequential indices
    indices = Array.from({ length: positionAttr.count }, (_, i) => i);
  }

  return { vertices, indices };
}

/**
 * Convert flat arrays back to Three.js BufferGeometry
 */
export function arraysToGeometry(
  vertices: number[],
  indices: number[]
): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();

  // Set vertices
  const positions = new Float32Array(vertices);
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  // Set indices
  geometry.setIndex(indices);

  // Compute normals
  geometry.computeVertexNormals();

  return geometry;
}

/**
 * Retopology client with convenience methods
 */
export const retopoClient = {
  /**
   * Auto-retopo a Three.js mesh
   */
  async autoRetopoMesh(
    mesh: THREE.Mesh,
    targetPolyCount: number,
    onProgress?: RetopoProgressCallback
  ): Promise<THREE.BufferGeometry> {
    const { vertices, indices } = geometryToArrays(mesh.geometry as THREE.BufferGeometry);
    const result = await autoRetopo(vertices, indices, targetPolyCount, onProgress);
    return arraysToGeometry(result.vertices, result.indices);
  },

  /**
   * Auto-retopo with automatic target calculation based on percentage
   */
  async autoRetopoByRatio(
    mesh: THREE.Mesh,
    ratio: number, // 0.0 to 1.0
    onProgress?: RetopoProgressCallback
  ): Promise<THREE.BufferGeometry> {
    const geometry = mesh.geometry as THREE.BufferGeometry;
    const currentTriCount = geometry.index
      ? geometry.index.count / 3
      : geometry.getAttribute('position').count / 3;

    const targetPolyCount = Math.max(1, Math.floor(currentTriCount * ratio));

    return this.autoRetopoMesh(mesh, targetPolyCount, onProgress);
  },
};

export default retopoClient;
// @ts-nocheck
