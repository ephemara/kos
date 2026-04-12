/**
 * jsSculptEngine.ts - Pure JavaScript Sculpting Engine
 * 
 * Fallback sculpting engine for browser mode when Rust backend is unavailable.
 * Uses three-mesh-bvh for spatial queries and direct BufferGeometry manipulation.
 * 
 * Not as fast as Rust GPU, but fully functional for prototyping and development.
 */

import * as THREE from 'three';
import { computeBoundsTree, disposeBoundsTree, acceleratedRaycast } from 'three-mesh-bvh';

// Ensure BVH extensions are patched
THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;

// ============================================================================
// BRUSH KERNELS - Pure JS implementations
// ============================================================================

type BrushKernelFn = (
    position: THREE.Vector3,
    normal: THREE.Vector3,
    center: THREE.Vector3,
    brushNormal: THREE.Vector3,
    radius: number,
    falloff: number,
    intensity: number,
    delta?: THREE.Vector3
) => THREE.Vector3;

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

// Gaussian falloff
const gaussianFalloff = (distance: number, radius: number, hardness: number = 0.5): number => {
    const t = distance / radius;
    if (t >= 1) return 0;
    const stdDev = 1 - hardness * 0.8;
    return Math.exp(-(t * t) / (2 * stdDev * stdDev));
};

// CLAY brush - adds material along the normal
const clayKernel: BrushKernelFn = (pos, normal, center, brushNormal, radius, falloff, intensity) => {
    return normal.clone().multiplyScalar(falloff * intensity * radius * 0.3);
};

// DRAW brush - like clay but follows brush stroke
const drawKernel: BrushKernelFn = (pos, normal, center, brushNormal, radius, falloff, intensity) => {
    return brushNormal.clone().multiplyScalar(falloff * intensity * radius * 0.4);
};

// SMOOTH brush - moves towards average of neighbors (simplified: towards center)
const smoothKernel: BrushKernelFn = (pos, normal, center, brushNormal, radius, falloff, intensity) => {
    const toCenter = center.clone().sub(pos);
    const dist = toCenter.length();
    if (dist < 0.001) return new THREE.Vector3();
    toCenter.normalize().multiplyScalar(falloff * intensity * dist * 0.3);
    return toCenter;
};

// MOVE/GRAB brush - drags vertices with mouse delta
const moveKernel: BrushKernelFn = (pos, normal, center, brushNormal, radius, falloff, intensity, delta) => {
    if (!delta) return new THREE.Vector3();
    return delta.clone().multiplyScalar(falloff * intensity);
};

// FLATTEN brush - projects vertices onto a plane
const flattenKernel: BrushKernelFn = (pos, normal, center, brushNormal, radius, falloff, intensity) => {
    // Project position onto plane defined by center and brushNormal
    const toPos = pos.clone().sub(center);
    const dist = toPos.dot(brushNormal);
    return brushNormal.clone().multiplyScalar(-dist * falloff * intensity);
};

// INFLATE brush - pushes vertices along their own normals
const inflateKernel: BrushKernelFn = (pos, normal, center, brushNormal, radius, falloff, intensity) => {
    return normal.clone().multiplyScalar(falloff * intensity * radius * 0.25);
};

// PINCH brush - pulls vertices towards the center line
const pinchKernel: BrushKernelFn = (pos, normal, center, brushNormal, radius, falloff, intensity) => {
    const toCenter = center.clone().sub(pos);
    // Remove component along brush normal to pinch perpendicular
    const alongNormal = brushNormal.clone().multiplyScalar(toCenter.dot(brushNormal));
    const perpendicular = toCenter.clone().sub(alongNormal);
    return perpendicular.multiplyScalar(falloff * intensity * 0.5);
};

// SCRAPE brush - removes material by flattening high points
const scrapeKernel: BrushKernelFn = (pos, normal, center, brushNormal, radius, falloff, intensity) => {
    const toPos = pos.clone().sub(center);
    const height = toPos.dot(brushNormal);
    if (height > 0) {
        return brushNormal.clone().multiplyScalar(-height * falloff * intensity * 0.8);
    }
    return new THREE.Vector3();
};

// CREASE brush - creates sharp creases
const creaseKernel: BrushKernelFn = (pos, normal, center, brushNormal, radius, falloff, intensity) => {
    const toCenter = center.clone().sub(pos);
    const perpComponent = toCenter.clone().sub(
        brushNormal.clone().multiplyScalar(toCenter.dot(brushNormal))
    );
    // Pull towards center and push down
    const pinch = perpComponent.multiplyScalar(falloff * intensity * 0.3);
    const push = brushNormal.clone().multiplyScalar(-falloff * intensity * radius * 0.1);
    return pinch.add(push);
};

// SNAKE HOOK brush - similar to grab but with falloff trail
const snakeHookKernel: BrushKernelFn = (pos, normal, center, brushNormal, radius, falloff, intensity, delta) => {
    if (!delta) return new THREE.Vector3();
    // Stronger than move, with exponential falloff
    const strongFalloff = Math.pow(falloff, 0.5);
    return delta.clone().multiplyScalar(strongFalloff * intensity * 1.5);
};

// Kernel registry
const KERNELS: Record<string, BrushKernelFn> = {
    'clay': clayKernel,
    'sculpt_clay': clayKernel,
    'sculpt_stamp': clayKernel,
    'draw': drawKernel,
    'sculpt_draw': drawKernel,
    'smooth': smoothKernel,
    'sculpt_smooth': smoothKernel,
    'move': moveKernel,
    'grab': moveKernel,
    'sculpt_grab': moveKernel,
    'flatten': flattenKernel,
    'sculpt_flatten': flattenKernel,
    'inflate': inflateKernel,
    'sculpt_inflate': inflateKernel,
    'pinch': pinchKernel,
    'sculpt_pinch': pinchKernel,
    'scrape': scrapeKernel,
    'sculpt_scrape': scrapeKernel,
    'crease': creaseKernel,
    'sculpt_crease': creaseKernel,
    'snake_hook': snakeHookKernel,
    'sculpt_snake_hook': snakeHookKernel,
};

// ============================================================================
// JS SCULPT ENGINE
// ============================================================================

export interface JsSculptResult {
    affectedCount: number;
    timeMs: number;
    usedGpu: false;
    gpuFallbackReason: string;
}

export class JsSculptEngine {
    private readonly tempVec3 = new THREE.Vector3();
    private readonly tempVec3b = new THREE.Vector3();
    private readonly tempVec3c = new THREE.Vector3();

    /**
     * Apply a brush stroke to the mesh geometry
     */
    applyBrush(
        mesh: THREE.Mesh,
        worldCenter: THREE.Vector3,
        worldNormal: THREE.Vector3,
        tool: string,
        radius: number,
        intensity: number,
        hardness: number = 0.5,
        symmetry: 'X' | 'NONE' = 'NONE',
        delta: THREE.Vector3 | null = null
    ): JsSculptResult {
        const startTime = performance.now();
        const geometry = mesh.geometry;
        const positionAttr = geometry.attributes.position;
        const normalAttr = geometry.attributes.normal;

        if (!positionAttr) {
            return { affectedCount: 0, timeMs: 0, usedGpu: false, gpuFallbackReason: 'No position attribute' };
        }

        // Transform to local space
        const invMatrix = mesh.matrixWorld.clone().invert();
        const localCenter = worldCenter.clone().applyMatrix4(invMatrix);
        const localNormal = worldNormal.clone().transformDirection(invMatrix).normalize();

        // Get scale for radius adjustment
        const scale = new THREE.Vector3();
        mesh.matrixWorld.decompose(new THREE.Vector3(), new THREE.Quaternion(), scale);
        const avgScale = (Math.abs(scale.x) + Math.abs(scale.y) + Math.abs(scale.z)) / 3 || 1;
        const localRadius = radius / avgScale;

        // Transform delta to local space
        let localDelta: THREE.Vector3 | null = null;
        if (delta) {
            localDelta = delta.clone().transformDirection(invMatrix);
        }

        // Get kernel
        const kernelKey = tool.toLowerCase().replace('-', '_');
        const kernel = KERNELS[kernelKey] || KERNELS['clay'];

        // Apply brush
        let affectedCount = 0;
        const positions = positionAttr.array as Float32Array;
        const normals = normalAttr ? (normalAttr.array as Float32Array) : null;
        const vertexCount = positionAttr.count;

        // Collect affected vertices using BVH
        const affectedIndices: number[] = [];
        const radiusSq = localRadius * localRadius;

        // Simple spatial query (BVH accelerated if available)
        for (let i = 0; i < vertexCount; i++) {
            const x = positions[i * 3];
            const y = positions[i * 3 + 1];
            const z = positions[i * 3 + 2];

            const dx = x - localCenter.x;
            const dy = y - localCenter.y;
            const dz = z - localCenter.z;
            const distSq = dx * dx + dy * dy + dz * dz;

            if (distSq < radiusSq) {
                affectedIndices.push(i);
            }
        }

        // Apply kernel to affected vertices
        for (const i of affectedIndices) {
            const x = positions[i * 3];
            const y = positions[i * 3 + 1];
            const z = positions[i * 3 + 2];

            this.tempVec3.set(x, y, z);
            const dist = this.tempVec3.distanceTo(localCenter);
            const falloff = gaussianFalloff(dist, localRadius, hardness);

            if (falloff < 0.001) continue;

            // Get vertex normal
            if (normals) {
                this.tempVec3b.set(normals[i * 3], normals[i * 3 + 1], normals[i * 3 + 2]).normalize();
            } else {
                this.tempVec3b.copy(localNormal);
            }

            // Apply kernel
            const displacement = kernel(
                this.tempVec3,
                this.tempVec3b,
                localCenter,
                localNormal,
                localRadius,
                falloff,
                intensity,
                localDelta || undefined
            );

            positions[i * 3] += displacement.x;
            positions[i * 3 + 1] += displacement.y;
            positions[i * 3 + 2] += displacement.z;
            affectedCount++;
        }

        // Apply X symmetry if enabled
        if (symmetry === 'X' && affectedCount > 0) {
            const symmetryCenter = localCenter.clone();
            symmetryCenter.x = -symmetryCenter.x;
            const symmetryNormal = localNormal.clone();
            symmetryNormal.x = -symmetryNormal.x;
            let symmetryDelta: THREE.Vector3 | null = null;
            if (localDelta) {
                symmetryDelta = localDelta.clone();
                symmetryDelta.x = -symmetryDelta.x;
            }

            for (let i = 0; i < vertexCount; i++) {
                const x = positions[i * 3];
                const y = positions[i * 3 + 1];
                const z = positions[i * 3 + 2];

                const dx = x - symmetryCenter.x;
                const dy = y - symmetryCenter.y;
                const dz = z - symmetryCenter.z;
                const distSq = dx * dx + dy * dy + dz * dz;

                if (distSq >= radiusSq) continue;

                this.tempVec3.set(x, y, z);
                const dist = this.tempVec3.distanceTo(symmetryCenter);
                const falloff = gaussianFalloff(dist, localRadius, hardness);

                if (falloff < 0.001) continue;

                if (normals) {
                    this.tempVec3b.set(normals[i * 3], normals[i * 3 + 1], normals[i * 3 + 2]).normalize();
                } else {
                    this.tempVec3b.copy(symmetryNormal);
                }

                const displacement = kernel(
                    this.tempVec3,
                    this.tempVec3b,
                    symmetryCenter,
                    symmetryNormal,
                    localRadius,
                    falloff,
                    intensity,
                    symmetryDelta || undefined
                );

                positions[i * 3] += displacement.x;
                positions[i * 3 + 1] += displacement.y;
                positions[i * 3 + 2] += displacement.z;
                affectedCount++;
            }
        }

        if (affectedCount > 0) {
            positionAttr.needsUpdate = true;

            // Recompute normals
            geometry.computeVertexNormals();

            // Refit BVH
            // @ts-ignore
            if (geometry.boundsTree) {
                // @ts-ignore
                geometry.boundsTree.refit();
            }
        }

        const timeMs = performance.now() - startTime;
        return {
            affectedCount,
            timeMs,
            usedGpu: false,
            gpuFallbackReason: 'JavaScript engine (browser mode)'
        };
    }
}

// Global singleton
export const jsSculptEngine = new JsSculptEngine();
