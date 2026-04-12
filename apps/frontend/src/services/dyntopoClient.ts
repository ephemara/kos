/**
 * DynTopo Client - Adaptive Mesh Refinement
 * 
 * Calls the Rust dyntopo_refine_mesh command to add local detail
 * during sculpting (like ZBrush DynaMesh but localized to brush area).
 */

import { invoke } from '@tauri-apps/api/core';

export interface DynTopoResult {
    positions: number[];
    normals: number[];
    indices: number[];
    vertices_added: number;
    faces_added: number;
    time_ms: number;
}

/**
 * Perform local DynTopo refinement within the brush radius.
 * 
 * This splits edges that are "too long" relative to the brush size,
 * adding detail exactly where the sculpting is happening.
 * 
 * @param positions Vertex positions (flat array: x,y,z,x,y,z,...)
 * @param normals Vertex normals (flat array: x,y,z,x,y,z,...)
 * @param indices Triangle indices
 * @param brushCenter World position of brush center [x,y,z]
 * @param brushRadius Brush radius
 * @param detailMultiplier 0.1-1.0 (lower = more detail, default 0.5)
 * @returns Updated mesh data with additional vertices where needed
 */
export async function dyntopoRefine(
    positions: Float32Array | number[],
    normals: Float32Array | number[],
    indices: Uint32Array | number[],
    brushCenter: [number, number, number],
    brushRadius: number,
    detailMultiplier: number = 0.5
): Promise<DynTopoResult> {
    // Convert to arrays if TypedArrays
    const posArray = positions instanceof Float32Array ? Array.from(positions) : positions;
    const normArray = normals instanceof Float32Array ? Array.from(normals) : normals;
    const indArray = indices instanceof Uint32Array ? Array.from(indices) : indices;

    return invoke<DynTopoResult>('dyntopo_refine_mesh', {
        positions: posArray,
        normals: normArray,
        indices: indArray,
        brushCenter,
        brushRadius,
        detailMultiplier
    });
}

/**
 * Helper to check if DynTopo should be triggered.
 * 
 * Returns true if the average edge length in the brush area
 * is above the detail threshold.
 */
export function shouldTriggerDyntopo(
    positions: Float32Array,
    indices: Uint32Array,
    brushCenter: THREE.Vector3,
    brushRadius: number,
    detailMultiplier: number = 0.5
): boolean {
    const targetEdgeLength = brushRadius * detailMultiplier * 0.5;
    const targetEdgeLengthSq = targetEdgeLength * targetEdgeLength;
    const radiusSq = (brushRadius * 1.5) ** 2;

    // Sample a few faces to check edge lengths
    const faceCount = indices.length / 3;
    const samplesToCheck = Math.min(100, faceCount);
    const step = Math.max(1, Math.floor(faceCount / samplesToCheck));

    let longEdges = 0;
    let totalChecked = 0;

    for (let f = 0; f < faceCount; f += step) {
        const i0 = indices[f * 3];
        const i1 = indices[f * 3 + 1];
        const i2 = indices[f * 3 + 2];

        // Check if any vertex is in brush radius
        const p0 = { x: positions[i0 * 3], y: positions[i0 * 3 + 1], z: positions[i0 * 3 + 2] };
        const d0 = (p0.x - brushCenter.x) ** 2 + (p0.y - brushCenter.y) ** 2 + (p0.z - brushCenter.z) ** 2;
        if (d0 > radiusSq) continue;

        const p1 = { x: positions[i1 * 3], y: positions[i1 * 3 + 1], z: positions[i1 * 3 + 2] };
        const p2 = { x: positions[i2 * 3], y: positions[i2 * 3 + 1], z: positions[i2 * 3 + 2] };

        // Check edge lengths
        const e01 = (p0.x - p1.x) ** 2 + (p0.y - p1.y) ** 2 + (p0.z - p1.z) ** 2;
        const e12 = (p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2 + (p1.z - p2.z) ** 2;
        const e02 = (p0.x - p2.x) ** 2 + (p0.y - p2.y) ** 2 + (p0.z - p2.z) ** 2;

        if (e01 > targetEdgeLengthSq || e12 > targetEdgeLengthSq || e02 > targetEdgeLengthSq) {
            longEdges++;
        }
        totalChecked++;
    }

    // Trigger if >30% of checked faces have long edges
    return totalChecked > 0 && (longEdges / totalChecked) > 0.3;
}
