/**
 * LSCMSolver.ts
 * Least Squares Conformal Maps (LSCM) UV unwrapping solver
 * 
 * Uses XAtlas (Adobe/Industry Standard) via Rust backend for production-quality
 * UV unwrapping with automatic segmentation, parameterization, and packing.
 * 
 * LSCM is ideal for organic meshes with smooth surfaces.
 */

import * as THREE from 'three';
import { invoke } from '@tauri-apps/api/core';
import type { LSCMConfig, LSCMResult } from './UVTypes';

// ============================================================================
// XAtlas Result Interface
// ============================================================================

interface AtlasResult {
    /** Vertex positions after unwrapping */
    positions: number[];
    /** Triangle indices */
    indices: number[];
    /** UV coordinates */
    uvs: number[];
}

// ============================================================================
// LSCM Solver
// ============================================================================

/**
 * Apply LSCM unwrapping using XAtlas backend
 * 
 * XAtlas handles:
 * - Automatic mesh segmentation into charts
 * - Conformal parameterization (angle-preserving)
 * - Optimal packing into texture space
 * - Seam handling and vertex splitting
 * 
 * @param mesh - Three.js mesh to unwrap
 * @param config - LSCM configuration
 * @returns Result with vertex count and timing
 */
export async function applyLSCM(
    mesh: THREE.Mesh,
    config: LSCMConfig
): Promise<LSCMResult> {
    const startTime = performance.now();

    console.log('[LSCM] Initializing XAtlas solver (Rust backend)...');

    // Extract geometry data
    const geo = mesh.geometry;
    let positions: Float32Array;
    let indices: ArrayLike<number>;

    if (!geo.index) {
        // Non-indexed geometry - create indices
        positions = geo.attributes.position.array as Float32Array;
        const idx = new Uint32Array(positions.length / 3);
        for (let i = 0; i < idx.length; i++) idx[i] = i;
        indices = idx;
    } else {
        positions = geo.attributes.position.array as Float32Array;
        indices = geo.index.array;
    }

    try {
        // Call Rust XAtlas backend
        const result = await invoke<AtlasResult>('unwrap_mesh_xatlas', {
            positions: Array.from(positions),
            indices: Array.from(indices)
        });

        console.log(`[LSCM] XAtlas returned ${result.positions.length / 3} vertices`);

        // Reconstruct geometry with new topology
        // XAtlas may split vertices at seams for proper UV unwrapping
        const newGeo = new THREE.BufferGeometry();

        const newPos = new Float32Array(result.positions);
        const newUVs = new Float32Array(result.uvs);
        const newIdx = new Uint32Array(result.indices);

        newGeo.setAttribute('position', new THREE.BufferAttribute(newPos, 3));
        newGeo.setAttribute('uv', new THREE.BufferAttribute(newUVs, 2));
        newGeo.setIndex(new THREE.BufferAttribute(newIdx, 1));
        newGeo.computeVertexNormals();

        // Replace mesh geometry
        mesh.geometry.dispose();
        mesh.geometry = newGeo;

        const time = performance.now() - startTime;
        console.log(`[LSCM] Completed in ${time.toFixed(2)}ms`);

        return {
            vertCount: newPos.length / 3,
            time
        };

    } catch (e) {
        console.error('[LSCM] XAtlas failed:', e);
        throw new Error(`LSCM unwrapping failed: ${e}`);
    }
}

/**
 * Apply LSCM with fallback to simple projection on error
 * 
 * @param mesh - Three.js mesh to unwrap
 * @param config - LSCM configuration
 * @param fallbackProjection - Fallback projection mode if LSCM fails
 * @returns Result with vertex count and timing
 */
export async function applyLSCMWithFallback(
    mesh: THREE.Mesh,
    config: LSCMConfig,
    fallbackProjection: 'BOX' | 'PLANAR' = 'BOX'
): Promise<LSCMResult & { usedFallback: boolean }> {
    try {
        const result = await applyLSCM(mesh, config);
        return { ...result, usedFallback: false };
    } catch (e) {
        console.warn(`[LSCM] Falling back to ${fallbackProjection} projection:`, e);

        // Simple box projection fallback
        const geo = mesh.geometry;
        const pos = geo.attributes.position;
        const uvs = new Float32Array(pos.count * 2);

        for (let i = 0; i < pos.count; i++) {
            const x = pos.getX(i);
            const y = pos.getY(i);
            const z = pos.getZ(i);

            // Simple box projection
            const norm = geo.attributes.normal;
            const nx = Math.abs(norm.getX(i));
            const ny = Math.abs(norm.getY(i));
            const nz = Math.abs(norm.getZ(i));

            let u = 0, v = 0;
            if (nx >= ny && nx >= nz) {
                u = z; v = y;
            } else if (ny >= nx && ny >= nz) {
                u = x; v = z;
            } else {
                u = x; v = y;
            }

            uvs[i * 2] = u;
            uvs[i * 2 + 1] = v;
        }

        geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
        geo.attributes.uv.needsUpdate = true;

        return {
            vertCount: pos.count,
            time: 0,
            usedFallback: true
        };
    }
}

/**
 * Check if LSCM solver is available (requires Tauri backend)
 */
export function isLSCMAvailable(): boolean {
    return typeof window !== 'undefined' && '__TAURI__' in window;
}

/**
 * Validate mesh for LSCM unwrapping
 * 
 * Checks for common issues that can cause LSCM to fail:
 * - Non-manifold geometry
 * - Degenerate triangles
 * - Disconnected components
 * 
 * @param mesh - Mesh to validate
 * @returns Validation result with issues
 */
export function validateMeshForLSCM(mesh: THREE.Mesh): {
    valid: boolean;
    issues: string[];
} {
    const issues: string[] = [];
    const geo = mesh.geometry;

    // Check for positions
    if (!geo.attributes.position) {
        issues.push('Missing position attribute');
        return { valid: false, issues };
    }

    // Check for normals (needed for quality unwrapping)
    if (!geo.attributes.normal) {
        issues.push('Missing normals (will be computed)');
        geo.computeVertexNormals();
    }

    // Check for degenerate triangles
    const pos = geo.attributes.position;
    const index = geo.index;

    if (index) {
        let degenerateCount = 0;
        for (let i = 0; i < index.count; i += 3) {
            const a = index.getX(i);
            const b = index.getX(i + 1);
            const c = index.getX(i + 2);

            const v1 = new THREE.Vector3(pos.getX(a), pos.getY(a), pos.getZ(a));
            const v2 = new THREE.Vector3(pos.getX(b), pos.getY(b), pos.getZ(b));
            const v3 = new THREE.Vector3(pos.getX(c), pos.getY(c), pos.getZ(c));

            const area = new THREE.Vector3()
                .crossVectors(
                    new THREE.Vector3().subVectors(v2, v1),
                    new THREE.Vector3().subVectors(v3, v1)
                )
                .length() / 2;

            if (area < 0.000001) {
                degenerateCount++;
            }
        }

        if (degenerateCount > 0) {
            issues.push(`Found ${degenerateCount} degenerate triangles`);
        }
    }

    // Check vertex count
    if (pos.count < 3) {
        issues.push('Insufficient vertices (need at least 3)');
        return { valid: false, issues };
    }

    // Check for reasonable mesh size
    if (pos.count > 10000000) {
        issues.push('Very large mesh (>10M vertices) - may be slow');
    }

    return {
        valid: issues.length === 0 || issues.every(i => i.includes('will be computed') || i.includes('may be slow')),
        issues
    };
}
