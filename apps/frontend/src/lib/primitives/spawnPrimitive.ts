/**
 * K_OS Universal Primitive Spawner
 * 
 * Single function to spawn ANY primitive, regardless of backend.
 * 
 * Flow:
 *   1. spawnPrimitive('sphere', { subdivisions: 4 })
 *   2. Looks up primitive in registry
 *   3. If generator='rust' → invoke('spawn_primitive', ...)
 *   4. If generator='ts_procedural' → call TS generator
 *   5. Returns mesh data (positions, normals, uvs, indices)
 *   6. Optionally: spawnPrimitiveToThree() creates Three.js BufferGeometry
 */

import * as THREE from 'three';
import { invoke } from '@tauri-apps/api/core';
import { getEngineProvider } from '@/engine/providerFactory';
import { getPrimitiveById, type PrimitiveDefinition } from './primitiveRegistry';

// ============================================================================
// TYPES
// ============================================================================

export interface SpawnParams {
    [key: string]: number | boolean;
}

export interface SpawnResult {
    positions: Float32Array;
    normals: Float32Array;
    uvs: Float32Array;
    indices: Uint32Array;
    vertexCount: number;
    triangleCount: number;
}

interface RustPrimitiveResult {
    positions: number[];
    normals: number[];
    uvs: number[];
    indices: number[];
}

// ============================================================================
// RUST BACKEND
// ============================================================================

/**
 * Spawn primitive via Rust backend
 */
async function spawnFromRust(
    primitiveId: string,
    params: SpawnParams
): Promise<SpawnResult> {
    try {
        const isTauri = typeof (window as any).__TAURI__ !== 'undefined';
        if (isTauri) {
            const result = await invoke<RustPrimitiveResult>('spawn_primitive', {
                primitiveId,
                params,
            });
            return {
                positions: new Float32Array(result.positions),
                normals: new Float32Array(result.normals),
                uvs: new Float32Array(result.uvs),
                indices: new Uint32Array(result.indices),
                vertexCount: result.positions.length / 3,
                triangleCount: result.indices.length / 3,
            };
        } else {
            const provider = getEngineProvider();
            const res = await provider.spawnPrimitive(primitiveId, params);
            return {
                positions: res.vertices,
                normals: res.normals,
                uvs: res.uvs,
                indices: res.indices,
                vertexCount: res.vertices.length / 3,
                triangleCount: res.indices.length / 3,
            };
        }
    } catch (error) {
        console.error(`[PrimitiveSpawner] Rust spawn failed for ${primitiveId}:`, error);
        throw error;
    }
}

// ============================================================================
// TS PROCEDURAL GENERATORS
// ============================================================================

/**
 * Generate a greeble (hard-surface detail modules)
 */
function generateGreeble(params: SpawnParams): SpawnResult {
    const seed = (params.seed as number) ?? 42;
    const density = (params.density as number) ?? 0.5;

    // Use seed for deterministic randomness
    const seededRandom = (n: number) => {
        const x = Math.sin(seed * 9999 + n) * 10000;
        return x - Math.floor(x);
    };

    // Start with a base cube
    const baseGeo = new THREE.BoxGeometry(0.6, 0.6, 0.6, 2, 2, 2);

    // Add random modules
    const numModules = Math.floor(4 + density * 8);
    const geos: THREE.BufferGeometry[] = [baseGeo];

    for (let i = 0; i < numModules; i++) {
        const type = Math.floor(seededRandom(i) * 4);
        let geo: THREE.BufferGeometry;

        switch (type) {
            case 0: // Panel
                geo = new THREE.BoxGeometry(0.4, 0.06, 0.4, 1, 1, 1);
                break;
            case 1: // Strip
                geo = new THREE.BoxGeometry(0.5, 0.04, 0.04, 1, 1, 1);
                break;
            case 2: // Cylinder
                geo = new THREE.CylinderGeometry(0.06, 0.06, 0.3, 8, 1);
                break;
            default: // Sphere
                geo = new THREE.SphereGeometry(0.1, 8, 8);
        }

        // Position on random face
        const face = Math.floor(seededRandom(i + 100) * 6);
        const offset = 0.32;
        const randX = (seededRandom(i + 200) - 0.5) * 0.4;
        const randY = (seededRandom(i + 300) - 0.5) * 0.4;
        const randZ = (seededRandom(i + 400) - 0.5) * 0.4;

        switch (face) {
            case 0: geo.translate(randX, offset, randZ); break;
            case 1: geo.translate(randX, -offset, randZ); break;
            case 2: geo.translate(offset, randY, randZ); break;
            case 3: geo.translate(-offset, randY, randZ); break;
            case 4: geo.translate(randX, randY, offset); break;
            default: geo.translate(randX, randY, -offset); break;
        }

        geos.push(geo);
    }

    // Merge all geometries
    const merged = mergeBufferGeometries(geos);

    return geometryToSpawnResult(merged);
}

/**
 * Generate a rock (displaced sphere)
 */
function generateRock(params: SpawnParams): SpawnResult {
    const seed = (params.seed as number) ?? 42;
    const subdivisions = (params.subdivisions as number) ?? 2;

    const seededRandom = (n: number) => {
        const x = Math.sin(seed * 9999 + n) * 10000;
        return x - Math.floor(x);
    };

    const geo = new THREE.IcosahedronGeometry(0.5, subdivisions);
    const positions = geo.attributes.position.array as Float32Array;

    // Displace vertices
    for (let i = 0; i < positions.length; i += 3) {
        const noise = seededRandom(i) * 0.2 - 0.1;
        const len = Math.sqrt(positions[i] ** 2 + positions[i + 1] ** 2 + positions[i + 2] ** 2);
        const scale = 1 + noise;
        positions[i] *= scale;
        positions[i + 1] *= scale;
        positions[i + 2] *= scale;
    }

    // Shift to bottom pivot
    geo.computeBoundingBox();
    const minY = geo.boundingBox!.min.y;
    geo.translate(0, -minY, 0);

    geo.computeVertexNormals();

    return geometryToSpawnResult(geo);
}

/**
 * Generate a crystal cluster
 */
function generateCrystal(params: SpawnParams): SpawnResult {
    const facets = (params.facets as number) ?? 6;
    const seed = (params.seed as number) ?? 42;

    const seededRandom = (n: number) => {
        const x = Math.sin(seed * 9999 + n) * 10000;
        return x - Math.floor(x);
    };

    const geos: THREE.BufferGeometry[] = [];

    // Main crystal
    const mainGeo = new THREE.ConeGeometry(0.15, 0.8, facets, 1);
    mainGeo.translate(0, 0.4, 0);
    geos.push(mainGeo);

    // Secondary crystals
    const numSecondary = 2 + Math.floor(seededRandom(0) * 4);
    for (let i = 0; i < numSecondary; i++) {
        const height = 0.3 + seededRandom(i + 10) * 0.4;
        const radius = 0.06 + seededRandom(i + 20) * 0.08;
        const angle = seededRandom(i + 30) * Math.PI * 2;
        const dist = 0.15 + seededRandom(i + 40) * 0.15;
        const tilt = (seededRandom(i + 50) - 0.5) * 0.5;

        const crystal = new THREE.ConeGeometry(radius, height, facets, 1);
        crystal.rotateZ(tilt);
        crystal.translate(Math.cos(angle) * dist, height / 2, Math.sin(angle) * dist);
        geos.push(crystal);
    }

    const merged = mergeBufferGeometries(geos);

    return geometryToSpawnResult(merged);
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Simple geometry merge (no external deps)
 */
function mergeBufferGeometries(geometries: THREE.BufferGeometry[]): THREE.BufferGeometry {
    if (geometries.length === 0) {
        return new THREE.BufferGeometry();
    }
    if (geometries.length === 1) {
        return geometries[0];
    }

    let totalVerts = 0;
    let totalIndices = 0;

    for (const geo of geometries) {
        totalVerts += geo.attributes.position.count;
        totalIndices += geo.index?.count ?? 0;
    }

    const positions = new Float32Array(totalVerts * 3);
    const normals = new Float32Array(totalVerts * 3);
    const uvs = new Float32Array(totalVerts * 2);
    const indices = new Uint32Array(totalIndices);

    let vertOffset = 0;
    let indexOffset = 0;
    let indexVertOffset = 0;

    for (const geo of geometries) {
        const posAttr = geo.attributes.position;
        const normAttr = geo.attributes.normal;
        const uvAttr = geo.attributes.uv;
        const idxAttr = geo.index;

        // Copy positions
        positions.set(posAttr.array, vertOffset * 3);

        // Copy normals (if present)
        if (normAttr) {
            normals.set(normAttr.array, vertOffset * 3);
        }

        // Copy UVs (if present)
        if (uvAttr) {
            uvs.set(uvAttr.array, vertOffset * 2);
        }

        // Copy indices with offset
        if (idxAttr) {
            for (let i = 0; i < idxAttr.count; i++) {
                indices[indexOffset + i] = idxAttr.getX(i) + indexVertOffset;
            }
            indexOffset += idxAttr.count;
        }

        indexVertOffset += posAttr.count;
        vertOffset += posAttr.count;
    }

    const merged = new THREE.BufferGeometry();
    merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    merged.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    merged.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    merged.setIndex(new THREE.BufferAttribute(indices, 1));

    merged.computeVertexNormals();

    return merged;
}

/**
 * Convert Three.js geometry to SpawnResult
 */
function geometryToSpawnResult(geo: THREE.BufferGeometry): SpawnResult {
    const positions = geo.attributes.position.array as Float32Array;
    const normals = (geo.attributes.normal?.array as Float32Array) ?? new Float32Array(positions.length);
    const uvs = (geo.attributes.uv?.array as Float32Array) ?? new Float32Array(positions.length / 3 * 2);
    const indices = geo.index?.array as Uint32Array ?? new Uint32Array(0);

    return {
        positions: new Float32Array(positions),
        normals: new Float32Array(normals),
        uvs: new Float32Array(uvs),
        indices: new Uint32Array(indices),
        vertexCount: positions.length / 3,
        triangleCount: indices.length / 3,
    };
}

// ============================================================================
// MAIN SPAWNER
// ============================================================================

/**
 * Spawn a primitive by ID
 * 
 * @param primitiveId - The primitive ID from the registry
 * @param params - Optional parameters (uses defaults if not provided)
 * @returns SpawnResult with mesh data
 * 
 * @example
 * const sphere = await spawnPrimitive('sphere', { subdivisions: 5 });
 * console.log(`Spawned ${sphere.vertexCount} vertices`);
 */
export async function spawnPrimitive(
    primitiveId: string,
    params: SpawnParams = {}
): Promise<SpawnResult> {
    const primitive = getPrimitiveById(primitiveId);

    if (!primitive) {
        throw new Error(`[PrimitiveSpawner] Unknown primitive: ${primitiveId}`);
    }

    // Merge provided params with defaults
    const mergedParams = { ...primitive.defaults, ...params };

    console.log(`[PrimitiveSpawner] Spawning ${primitive.name} (${primitive.generator})`, mergedParams);

    if (primitive.generator === 'rust') {
        return spawnFromRust(primitiveId, mergedParams);
    }

    // TypeScript procedural generators
    switch (primitiveId) {
        case 'greeble':
            return generateGreeble(mergedParams);
        case 'rock':
            return generateRock(mergedParams);
        case 'crystal':
            return generateCrystal(mergedParams);
        default:
            throw new Error(`[PrimitiveSpawner] No TS generator for: ${primitiveId}`);
    }
}

/**
 * Spawn a primitive and immediately convert to Three.js BufferGeometry
 * 
 * @example
 * const geo = await spawnPrimitiveToThree('cube', { subdivisions: 3 });
 * const mesh = new THREE.Mesh(geo, material);
 * scene.add(mesh);
 */
export async function spawnPrimitiveToThree(
    primitiveId: string,
    params: SpawnParams = {}
): Promise<THREE.BufferGeometry> {
    const result = await spawnPrimitive(primitiveId, params);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(result.positions, 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(result.normals, 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(result.uvs, 2));
    geometry.setIndex(new THREE.BufferAttribute(result.indices, 1));

    // Add vertex colors (white default, for painting)
    const colors = new Float32Array(result.vertexCount * 3).fill(1);
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();

    return geometry;
}
