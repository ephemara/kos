/**
 * UVProjection.ts
 * UV projection algorithms for unwrapping 3D meshes
 * 
 * Supports multiple projection modes:
 * - Box projection (6-axis and multi-camera)
 * - Planar projection (X, Y, Z axes)
 * - Cylindrical unwrap
 * - Spherical unwrap
 * - Camera view projection
 * - GPU-accelerated projection
 * - Hybrid auto-classification
 */

import * as THREE from 'three';
import { invoke } from '@tauri-apps/api/core';
import type {
    ProjectionConfig,
    ProjectionMode,
    BoxProjectionConfig,
    HybridConfig,
    HybridResult,
    GpuProjectConfig,
    GpuProjectResult,
    MeshClassification,
    ClassificationResult
} from './UVTypes';
import { applyLSCM } from './LSCMSolver';
import { AtlasPacker } from './AtlasPacker';

// ============================================================================
// CPU Projection Engine
// ============================================================================

/**
 * Apply UV projection to a mesh
 * 
 * @param mesh - Mesh to project
 * @param originalGeo - Original geometry (for restoring UVs)
 * @param config - Projection configuration
 * @returns Number of vertices processed
 */
export function applyUVProjection(
    mesh: THREE.Mesh,
    originalGeo: THREE.BufferGeometry,
    config: ProjectionConfig
): number {
    const geo = mesh.geometry;
    const pos = geo.attributes.position;

    // Restore original UVs
    if (config.projection === 'ORIGINAL') {
        if (originalGeo && originalGeo.attributes.uv) {
            geo.setAttribute('uv', originalGeo.attributes.uv.clone());
            geo.attributes.uv.needsUpdate = true;
        }
        return pos.count;
    }

    // Calculate new UVs
    const norm = geo.attributes.normal;
    const uvs = new Float32Array(pos.count * 2);

    const rotRad = (config.rotation * Math.PI) / 180;
    const cosR = Math.cos(rotRad);
    const sinR = Math.sin(rotRad);

    // World matrix for world space projection
    const worldMat = mesh.matrixWorld;
    const vec = new THREE.Vector3();

    for (let i = 0; i < pos.count; i++) {
        // Get coordinates
        let x, y, z;
        let nx, ny, nz;

        if (config.coordSpace === 'WORLD') {
            vec.set(pos.getX(i), pos.getY(i), pos.getZ(i));
            vec.applyMatrix4(worldMat);
            x = vec.x;
            y = vec.y;
            z = vec.z;

            vec.set(norm.getX(i), norm.getY(i), norm.getZ(i));
            vec.transformDirection(worldMat);
            nx = Math.abs(vec.x);
            ny = Math.abs(vec.y);
            nz = Math.abs(vec.z);
        } else {
            x = pos.getX(i);
            y = pos.getY(i);
            z = pos.getZ(i);
            nx = Math.abs(norm.getX(i));
            ny = Math.abs(norm.getY(i));
            nz = Math.abs(norm.getZ(i));
        }

        let u = 0, v = 0;

        // Apply projection based on mode
        switch (config.projection) {
            case 'BOX':
                if (nx >= ny && nx >= nz) {
                    u = z; v = y;
                } else if (ny >= nx && ny >= nz) {
                    u = x; v = z;
                } else {
                    u = x; v = y;
                }
                break;

            case 'SPHERICAL':
                const r = Math.sqrt(x * x + y * y + z * z);
                u = Math.atan2(x, z) / (Math.PI * 2) + 0.5;
                v = Math.asin(y / r) / Math.PI + 0.5;
                break;

            case 'CYLINDRICAL':
                let angle, height;
                if (config.targetAxis === 'Y') {
                    angle = Math.atan2(x, z);
                    height = y;
                } else if (config.targetAxis === 'X') {
                    angle = Math.atan2(y, z);
                    height = x;
                } else {
                    angle = Math.atan2(x, y);
                    height = z;
                }
                u = angle / (2 * Math.PI) + 0.5;
                v = height;
                break;

            case 'PLANAR_AXIS':
            case 'PLANAR_X':
            case 'PLANAR_Y':
            case 'PLANAR_Z':
                const axis = config.projection === 'PLANAR_AXIS' ? config.targetAxis :
                    config.projection === 'PLANAR_X' ? 'X' :
                        config.projection === 'PLANAR_Y' ? 'Y' : 'Z';

                if (axis === 'X') {
                    u = z; v = y;
                } else if (axis === 'Y') {
                    u = x; v = z;
                } else {
                    u = x; v = y;
                }
                break;

            case 'CAMERA_VIEW':
                if (config.camera) {
                    vec.set(x, y, z);
                    if (config.coordSpace === 'LOCAL') vec.applyMatrix4(worldMat);
                    vec.project(config.camera);
                    u = vec.x * 0.5 + 0.5;
                    v = vec.y * 0.5 + 0.5;
                }
                break;

            case 'NORMAL_FRACTURE':
                u = x + (config.coordSpace === 'WORLD' ? vec.x : norm.getX(i));
                v = y + (config.coordSpace === 'WORLD' ? vec.y : norm.getY(i));
                break;
        }

        // Apply modifiers
        u *= config.scale;
        v *= config.scale;
        u *= config.stretchU;
        v *= config.stretchV;

        // Rotation
        const uC = u;
        const vC = v;
        u = (uC * cosR - vC * sinR);
        v = (uC * sinR + vC * cosR);

        // Offset
        u += config.offsetU;
        v += config.offsetV;

        // Jitter
        if (config.jitter > 0) {
            u += (Math.random() - 0.5) * config.jitter;
            v += (Math.random() - 0.5) * config.jitter;
        }

        uvs[i * 2] = u;
        uvs[i * 2 + 1] = v;
    }

    geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geo.attributes.uv.needsUpdate = true;

    return pos.count;
}

// ============================================================================
// Box Projection
// ============================================================================

/**
 * Apply box projection with multiple cameras
 * 
 * @param mesh - Mesh to project
 * @param config - Box projection configuration
 */
export function applyBoxProjection(mesh: THREE.Mesh, config: BoxProjectionConfig): void {
    const geo = mesh.geometry;
    geo.computeBoundingBox();
    const bbox = geo.boundingBox!;
    const center = new THREE.Vector3();
    bbox.getCenter(center);
    const size = new THREE.Vector3();
    bbox.getSize(size);

    // Prevent divide by zero
    size.x = Math.max(size.x, 0.001);
    size.y = Math.max(size.y, 0.001);
    size.z = Math.max(size.z, 0.001);

    const maxDim = Math.max(size.x, size.y, size.z);

    // Convert to non-indexed for sharp seams
    const nonIndexed = geo.toNonIndexed();
    const pos = nonIndexed.attributes.position;
    const count = pos.count;

    // Generate camera directions
    const cameraCount = config.cameraCount || 6;
    const cameraDirections = generateCameraDirections(cameraCount);

    const pA = new THREE.Vector3(), pB = new THREE.Vector3(), pC = new THREE.Vector3();
    const cb = new THREE.Vector3(), ab = new THREE.Vector3();
    const normal = new THREE.Vector3();

    const uvs = new Float32Array(count * 2);

    // World matrix for alignment
    const worldMatrix = mesh.matrixWorld;
    const worldNormalMatrix = new THREE.Matrix3().getNormalMatrix(worldMatrix);

    // Group triangles by best matching camera
    const islands: Map<number, number[]> = new Map();
    for (let i = 0; i < cameraDirections.length; i++) {
        islands.set(i, []);
    }

    // Assign faces to cameras
    for (let i = 0; i < count; i += 3) {
        pA.fromBufferAttribute(pos, i);
        pB.fromBufferAttribute(pos, i + 1);
        pC.fromBufferAttribute(pos, i + 2);

        ab.subVectors(pB, pA);
        cb.subVectors(pC, pA);
        normal.crossVectors(ab, cb).normalize();

        if (config.worldAlign) {
            normal.applyMatrix3(worldNormalMatrix).normalize();
        }

        // Find best matching camera
        let bestCamera = 0;
        let bestDot = -Infinity;
        for (let c = 0; c < cameraDirections.length; c++) {
            const dot = normal.dot(cameraDirections[c]);
            if (dot > bestDot) {
                bestDot = dot;
                bestCamera = c;
            }
        }

        islands.get(bestCamera)!.push(i);
    }

    // Project and pack each island
    const charts: any[] = [];

    for (let [cameraIdx, triangles] of islands) {
        if (triangles.length === 0) continue;

        const direction = cameraDirections[cameraIdx];
        const { u: uAxis, v: vAxis } = getProjectionPlane(direction);

        let minU = Infinity, maxU = -Infinity;
        let minV = Infinity, maxV = -Infinity;
        const islandUVs: { idx: number; u: number; v: number }[] = [];

        for (const tIdx of triangles) {
            for (let k = 0; k < 3; k++) {
                const idx = tIdx + k;
                pA.fromBufferAttribute(pos, idx);

                let projPoint = pA.clone();
                if (config.worldAlign) {
                    projPoint.applyMatrix4(worldMatrix);
                }

                const u = projPoint.dot(uAxis) / maxDim;
                const v = projPoint.dot(vAxis) / maxDim;

                islandUVs.push({ idx, u, v });

                minU = Math.min(minU, u);
                maxU = Math.max(maxU, u);
                minV = Math.min(minV, v);
                maxV = Math.max(maxV, v);
            }
        }

        const width = maxU - minU;
        const height = maxV - minV;

        if (width > 0.0001 && height > 0.0001) {
            charts.push({ cameraIdx, width, height, minU, minV, uvs: islandUVs });
        }
    }

    // Pack islands using bin packer
    const packerInput = charts.map((c, i) => ({
        id: i, w: c.width, h: c.height, x: 0, y: 0
    }));

    const packer = new AtlasPacker(1, 1);
    packer.fit(packerInput, config.padding);

    // Apply to geometry
    for (let i = 0; i < charts.length; i++) {
        const chart = charts[i];
        const rect = packerInput[i];

        for (const vert of chart.uvs) {
            const localU = chart.width > 0 ? (vert.u - chart.minU) / chart.width : 0;
            const localV = chart.height > 0 ? (vert.v - chart.minV) / chart.height : 0;

            const finalU = rect.x + (localU * rect.w);
            const finalV = rect.y + (localV * rect.h);

            uvs[vert.idx * 2] = finalU;
            uvs[vert.idx * 2 + 1] = finalV;
        }
    }

    nonIndexed.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    nonIndexed.computeVertexNormals();

    mesh.geometry.dispose();
    mesh.geometry = nonIndexed;
}

// ============================================================================
// Hybrid Auto-Unwrap
// ============================================================================

/**
 * Apply hybrid auto-unwrap with intelligent classification
 * 
 * @param mesh - Mesh to unwrap
 * @param config - Hybrid configuration
 * @returns Result with classification and solver used
 */
export async function applyHybridAutoUnwrap(
    mesh: THREE.Mesh,
    config: HybridConfig
): Promise<HybridResult> {
    const startTime = performance.now();

    // Force mode override
    if (config.forceMode) {
        if (config.forceMode === 'LSCM') {
            try {
                const result = await applyLSCM(mesh, { maxIterations: config.lscmIterations, padding: 0, texelsPerUnit: 32, resolution: 1024 });
                return {
                    vertCount: result.vertCount,
                    time: performance.now() - startTime,
                    classification: 'ORGANIC',
                    solver: 'LSCM'
                };
            } catch (e) {
                console.warn('[Hybrid] LSCM failed, falling back to Box');
                applyBoxProjection(mesh, {
                    padding: config.boxPadding,
                    worldAlign: config.boxWorldAlign,
                    cameraCount: config.boxCameraCount
                });
                return {
                    vertCount: mesh.geometry.attributes.position.count,
                    time: performance.now() - startTime,
                    classification: 'MIXED',
                    solver: 'BOX'
                };
            }
        } else {
            applyBoxProjection(mesh, {
                padding: config.boxPadding,
                worldAlign: config.boxWorldAlign,
                cameraCount: config.boxCameraCount
            });
            return {
                vertCount: mesh.geometry.attributes.position.count,
                time: performance.now() - startTime,
                classification: 'HARD_SURFACE',
                solver: 'BOX'
            };
        }
    }

    // Auto classification
    const classification = config.autoClassify ? await classifyMeshType(mesh) : 'MIXED';

    if (classification === 'ORGANIC') {
        try {
            const result = await applyLSCM(mesh, { maxIterations: config.lscmIterations, padding: 0, texelsPerUnit: 32, resolution: 1024 });
            return {
                vertCount: result.vertCount,
                time: performance.now() - startTime,
                classification,
                solver: 'LSCM'
            };
        } catch (e) {
            console.warn('[Hybrid] LSCM failed for organic mesh, using Box');
            applyBoxProjection(mesh, {
                padding: config.boxPadding,
                worldAlign: config.boxWorldAlign,
                cameraCount: config.boxCameraCount
            });
            return {
                vertCount: mesh.geometry.attributes.position.count,
                time: performance.now() - startTime,
                classification,
                solver: 'BOX'
            };
        }
    } else if (classification === 'HARD_SURFACE') {
        applyBoxProjection(mesh, {
            padding: config.boxPadding,
            worldAlign: config.boxWorldAlign,
            cameraCount: config.boxCameraCount
        });
        return {
            vertCount: mesh.geometry.attributes.position.count,
            time: performance.now() - startTime,
            classification,
            solver: 'BOX'
        };
    } else {
        // Mixed - try LSCM with fallback
        try {
            const result = await applyLSCM(mesh, { maxIterations: config.lscmIterations, padding: 0, texelsPerUnit: 32, resolution: 1024 });
            return {
                vertCount: result.vertCount,
                time: performance.now() - startTime,
                classification,
                solver: 'HYBRID'
            };
        } catch (e) {
            applyBoxProjection(mesh, {
                padding: config.boxPadding,
                worldAlign: config.boxWorldAlign,
                cameraCount: config.boxCameraCount
            });
            return {
                vertCount: mesh.geometry.attributes.position.count,
                time: performance.now() - startTime,
                classification,
                solver: 'BOX'
            };
        }
    }
}

// ============================================================================
// GPU Projection
// ============================================================================

/**
 * Apply GPU-accelerated projection
 * 
 * @param mesh - Mesh to project
 * @param config - GPU projection configuration
 * @returns Result with timing
 */
export async function applyGpuProjection(
    mesh: THREE.Mesh,
    config: GpuProjectConfig
): Promise<GpuProjectResult> {
    const geo = mesh.geometry;
    const posAttr = geo.attributes.position;
    const normAttr = geo.attributes.normal;

    // Extract positions
    const positions: number[] = [];
    for (let i = 0; i < posAttr.count; i++) {
        positions.push(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i));
    }

    // Extract normals
    const normals: number[] = [];
    if (normAttr) {
        for (let i = 0; i < normAttr.count; i++) {
            normals.push(normAttr.getX(i), normAttr.getY(i), normAttr.getZ(i));
        }
    }

    // Call GPU projection
    const result = await invoke<{ uvs: number[]; time_ms: number }>('gpu_atlas_project_oneshot', {
        positions,
        normals,
        mode: config.mode,
        scale: config.scale,
        offsetU: config.offsetU,
        offsetV: config.offsetV,
    });

    // Apply UVs
    const uvArray = new Float32Array(result.uvs);
    geo.setAttribute('uv', new THREE.BufferAttribute(uvArray, 2));
    geo.attributes.uv.needsUpdate = true;

    return {
        vertCount: posAttr.count,
        timeMs: result.time_ms,
    };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate camera directions using Fibonacci sphere
 */
function generateCameraDirections(count: number): THREE.Vector3[] {
    const directions: THREE.Vector3[] = [];

    if (count <= 6) {
        // Standard 6-axis
        directions.push(
            new THREE.Vector3(1, 0, 0),
            new THREE.Vector3(-1, 0, 0),
            new THREE.Vector3(0, 1, 0),
            new THREE.Vector3(0, -1, 0),
            new THREE.Vector3(0, 0, 1),
            new THREE.Vector3(0, 0, -1)
        );
        return directions;
    }

    // Fibonacci sphere
    const goldenRatio = (1 + Math.sqrt(5)) / 2;

    for (let i = 0; i < count; i++) {
        const theta = 2 * Math.PI * i / goldenRatio;
        const phi = Math.acos(1 - 2 * (i + 0.5) / count);

        directions.push(new THREE.Vector3(
            Math.sin(phi) * Math.cos(theta),
            Math.sin(phi) * Math.sin(theta),
            Math.cos(phi)
        ).normalize());
    }

    return directions;
}

/**
 * Get projection plane for a camera direction
 */
function getProjectionPlane(direction: THREE.Vector3): { u: THREE.Vector3; v: THREE.Vector3 } {
    let worldUp = new THREE.Vector3(0, 1, 0);
    if (Math.abs(direction.dot(worldUp)) > 0.99) {
        worldUp = new THREE.Vector3(0, 0, 1);
    }

    const u = new THREE.Vector3().crossVectors(worldUp, direction).normalize();
    const v = new THREE.Vector3().crossVectors(direction, u).normalize();

    return { u, v };
}

/**
 * Classify mesh type using Rust backend
 */
async function classifyMeshType(mesh: THREE.Mesh): Promise<MeshClassification> {
    const geo = mesh.geometry;

    if (!geo.index) {
        return 'ORGANIC';
    }

    const positions = Array.from(geo.attributes.position.array as Float32Array);
    const indices = Array.from(geo.index.array);

    try {
        const result = await invoke<ClassificationResult>('classify_mesh', {
            positions,
            indices
        });

        return result.classification as MeshClassification;
    } catch (e) {
        console.warn('[Classification] Failed, defaulting to ORGANIC:', e);
        return 'ORGANIC';
    }
}

/**
 * Check if GPU projection is available
 */
export function canUseGpuProjection(): boolean {
    return typeof window !== 'undefined' && '__TAURI__' in window;
}
