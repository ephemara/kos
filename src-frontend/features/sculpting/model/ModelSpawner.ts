/**
 * ModelSpawner.ts - Core IMM brush spawning logic
 * Clean extraction from KGreeble's messy utils
 */

import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createGeometry, generateGreeble, SHAPE_IDS } from './ModelShapes';
import type { SpawnContext, UserImport, ModelModifiers } from './ModelTypes';

/**
 * IMM-Style: Merge spawned geometry into an existing mesh
 * Like ZBrush - geometry is added to the active subtool, not as a new layer
 * 
 * APPROACH:
 * 1. Collect all geometries (original + spawned)
 * 2. Normalize attributes (keep only position + normal)
 * 3. Merge
 * 
 * @param targetMesh - The active sculpt mesh to merge into
 * @param spawnedGroups - Groups from spawnWithModifiers() - already positioned in world space
 * @param scale - Final scale to apply to spawned geometry
 * @returns Updated geometry (caller should update mesh.geometry)
 */
export const mergeIntoMesh = (
    targetMesh: THREE.Mesh,
    spawnedGroups: THREE.Group[],
    scale: number = 1.0
): THREE.BufferGeometry | null => {
    if (!targetMesh.geometry || spawnedGroups.length === 0) {
        console.warn('[mergeIntoMesh] No target geometry or spawned groups');
        return null;
    }

    // Helper: Strip geometry to only position + normal + uv, and convert to non-indexed
    const normalizeGeometry = (geom: THREE.BufferGeometry): THREE.BufferGeometry => {
        // Convert indexed to non-indexed first
        let workGeom = geom;
        if (geom.index) {
            workGeom = geom.toNonIndexed();
        }

        const newGeom = new THREE.BufferGeometry();

        // Copy position
        if (workGeom.attributes.position) {
            newGeom.setAttribute('position', workGeom.attributes.position.clone());
        }

        // Copy or compute normals
        if (workGeom.attributes.normal) {
            newGeom.setAttribute('normal', workGeom.attributes.normal.clone());
        } else {
            newGeom.computeVertexNormals();
        }

        // Copy UVs - critical for material preservation
        if (workGeom.attributes.uv) {
            newGeom.setAttribute('uv', workGeom.attributes.uv.clone());
        }

        // No index - we're keeping everything non-indexed for simpler merge
        return newGeom;
    };

    const geometries: THREE.BufferGeometry[] = [];

    // 1. Clone and normalize original geometry
    const originalGeom = normalizeGeometry(targetMesh.geometry);
    const hasUVs = !!originalGeom.attributes.uv;

    geometries.push(originalGeom);

    // 2. Get inverse of target mesh's world matrix to convert world -> local
    targetMesh.updateMatrixWorld(true);
    const worldToLocal = targetMesh.matrixWorld.clone().invert();

    // 3. Extract and transform spawned geometries to target's local space
    spawnedGroups.forEach(group => {
        // Update group's world matrix with scale
        group.scale.set(scale, scale, scale);
        group.updateMatrixWorld(true);

        group.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
                const mesh = child as THREE.Mesh;
                if (!mesh.geometry || !mesh.geometry.attributes.position) return;

                // Normalize first
                const geomClone = normalizeGeometry(mesh.geometry);

                // MATCH ATTRIBUTES: Ensure UV consistency
                if (hasUVs && !geomClone.attributes.uv) {
                    // Create dummy zero UVs
                    const count = geomClone.attributes.position.count;
                    const uvs = new Float32Array(count * 2);
                    geomClone.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
                } else if (!hasUVs && geomClone.attributes.uv) {
                    // Delete extra UVs
                    geomClone.deleteAttribute('uv');
                }

                // Get this mesh's full world transform
                mesh.updateMatrixWorld(true);

                // Apply: world transform of spawned mesh, then inverse of target to get into target's local space
                const transformMatrix = new THREE.Matrix4()
                    .copy(worldToLocal)
                    .multiply(mesh.matrixWorld);

                geomClone.applyMatrix4(transformMatrix);

                // Check if transform flipped the winding order (determinant < 0)
                if (transformMatrix.determinant() < 0) {
                    // Flip winding of triangles (Swap B and C)
                    // Since we are non-indexed, this is just swapping vertices 1&2, 4&5, etc.
                    const pos = geomClone.attributes.position;
                    const norm = geomClone.attributes.normal;
                    const uv = geomClone.attributes.uv;

                    for (let i = 0; i < pos.count; i += 3) {
                        // Swap Pos
                        const x2 = pos.getX(i + 1), y2 = pos.getY(i + 1), z2 = pos.getZ(i + 1);
                        const x3 = pos.getX(i + 2), y3 = pos.getY(i + 2), z3 = pos.getZ(i + 2);
                        pos.setXYZ(i + 1, x3, y3, z3);
                        pos.setXYZ(i + 2, x2, y2, z2);

                        // Swap Normals (if they exist)
                        if (norm) {
                            const nx2 = norm.getX(i + 1), ny2 = norm.getY(i + 1), nz2 = norm.getZ(i + 1);
                            const nx3 = norm.getX(i + 2), ny3 = norm.getY(i + 2), nz3 = norm.getZ(i + 2);
                            norm.setXYZ(i + 1, nx3, ny3, nz3);
                            norm.setXYZ(i + 2, nx2, ny2, nz2);
                        }

                        // Swap UVs (if they exist)
                        if (uv) {
                            const u2 = uv.getX(i + 1), v2 = uv.getY(i + 1);
                            const u3 = uv.getX(i + 2), v3 = uv.getY(i + 2);
                            uv.setXY(i + 1, u3, v3);
                            uv.setXY(i + 2, u2, v2);
                        }
                    }
                }

                // Only recompute normals if strictly necessary (missing), otherwise rely on transformed normals
                if (!geomClone.attributes.normal) {
                    geomClone.computeVertexNormals();
                }

                geometries.push(geomClone);
            }
        });
    });

    if (geometries.length <= 1) {
        console.warn('[mergeIntoMesh] No spawned geometry to merge');
        return null;
    }

    console.log('[mergeIntoMesh] Merging', geometries.length, 'geometries');

    try {
        // Merge all geometries
        const merged = BufferGeometryUtils.mergeGeometries(geometries, false);

        if (!merged) {
            console.error('[mergeIntoMesh] mergeGeometries returned null');
            return null;
        }

        // Compute bounds only
        merged.computeBoundingSphere();
        merged.computeBoundingBox();

        console.log('[mergeIntoMesh] Success! New vertex count:', merged.attributes.position.count);
        return merged;
    } catch (e) {
        console.error('[mergeIntoMesh] Failed to merge geometries:', e);
        return null;
    }
};

// --- SPAWN A SINGLE MESH/GROUP AT POSITION ---
export const spawnAtPosition = (
    point: THREE.Vector3,
    normal: THREE.Vector3,
    shapeId: string,
    material: THREE.Material,
    userImports: UserImport[] = []
): THREE.Group | null => {
    const container = new THREE.Group();
    container.userData.isContainer = true;
    container.userData.shapeId = shapeId;
    container.position.copy(point);

    // Orient to surface normal
    const up = new THREE.Vector3(0, 1, 0);
    container.quaternion.setFromUnitVectors(up, normal);

    // Handle user imports (GLB/OBJ)
    if (shapeId.startsWith('import_')) {
        const importData = userImports.find(u => u.id === shapeId);
        if (importData) {
            const clone = importData.scene.clone(true);
            clone.traverse((child: any) => {
                if (child.isMesh) {
                    if (!child.material) child.material = material;
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });
            container.add(clone);
        }
        container.scale.set(0.1, 0.1, 0.1);
        return container;
    }

    // Handle complex procedural shapes
    switch (shapeId) {
        case SHAPE_IDS.GREEBLE:
            container.add(generateGreeble(material));
            container.scale.set(0.5, 0.5, 0.5);
            break;

        case SHAPE_IDS.TENTACLE:
            for (let i = 0; i < 8; i++) {
                const m = new THREE.Mesh(
                    new THREE.SphereGeometry((1.0 - i / 8) * 0.3, 32, 32),
                    material
                );
                m.position.set(Math.sin(i * 0.5) * 0.2, i * 0.4 + 0.15, Math.cos(i * 0.5) * 0.2);
                m.castShadow = true;
                m.receiveShadow = true;
                container.add(m);
            }
            break;

        case SHAPE_IDS.SWARM:
            for (let i = 0; i < 12; i++) {
                const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.15, 1), material);
                m.position.set(
                    (Math.random() - 0.5) * 2.5,
                    Math.random() * 2.0 + 0.5,
                    (Math.random() - 0.5) * 2.5
                );
                m.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
                m.castShadow = true;
                m.receiveShadow = true;
                container.add(m);
            }
            break;

        case SHAPE_IDS.CHAIN:
            for (let i = 0; i < 6; i++) {
                const m = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.05, 16, 32), material);
                m.position.y = i * -0.3;
                if (i % 2 === 0) m.rotateY(Math.PI / 2);
                m.castShadow = true;
                m.receiveShadow = true;
                container.add(m);
            }
            break;

        case SHAPE_IDS.GEAR:
            const gearBody = new THREE.Mesh(
                new THREE.CylinderGeometry(0.5, 0.5, 0.2, 32, 4),
                material
            );
            gearBody.position.y = 0.1;
            gearBody.castShadow = true;
            container.add(gearBody);

            const gearHub = new THREE.Mesh(
                new THREE.CylinderGeometry(0.2, 0.2, 0.3, 32, 4),
                material
            );
            gearHub.position.y = 0.15;
            gearHub.castShadow = true;
            container.add(gearHub);
            break;

        case SHAPE_IDS.FLORA:
            for (let i = 0; i < 4; i++) {
                const m = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.8, 8, 16), material);
                m.position.set(
                    (Math.random() - 0.5) * 0.5,
                    0.4,
                    (Math.random() - 0.5) * 0.5
                );
                m.rotation.set(Math.random() - 0.5, 0, Math.random() - 0.5);
                m.castShadow = true;
                container.add(m);
            }
            break;

        case SHAPE_IDS.SPINE:
            for (let i = 0; i < 8; i++) {
                const m = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.4), material);
                m.position.y = i * 0.25;
                m.rotation.y = i * 0.2;
                m.castShadow = true;
                m.receiveShadow = true;
                container.add(m);
            }
            break;

        case SHAPE_IDS.RUINS:
            for (let i = 0; i < 4; i++) {
                const m = new THREE.Mesh(
                    new THREE.BoxGeometry(0.4, 0.8, 0.4, 4, 8, 4),
                    material
                );
                m.position.set(
                    (Math.random() - 0.5) * 1.5,
                    0.4,
                    (Math.random() - 0.5) * 1.5
                );
                m.rotation.set(
                    (Math.random() - 0.5) * 0.5,
                    Math.random(),
                    (Math.random() - 0.5) * 0.5
                );
                m.castShadow = true;
                container.add(m);
            }
            break;

        case SHAPE_IDS.STRUCT:
            // 4 corner pillars
            const corners = [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]];
            corners.forEach(([x, z]) => {
                const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2, 0.1), material);
                pillar.position.set(x, 1, z);
                pillar.castShadow = true;
                container.add(pillar);
            });
            // Cross beam
            const beam = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.1, 0.1), material);
            beam.position.y = 1;
            beam.castShadow = true;
            container.add(beam);
            break;

        case SHAPE_IDS.CITY:
            for (let i = 0; i < 8; i++) {
                const h = 0.5 + Math.random();
                const m = new THREE.Mesh(
                    new THREE.BoxGeometry(0.2, h, 0.2, 2, 8, 2),
                    material
                );
                m.position.set(
                    (Math.random() - 0.5) * 1.2,
                    h / 2,
                    (Math.random() - 0.5) * 1.2
                );
                m.castShadow = true;
                container.add(m);
            }
            break;

        case SHAPE_IDS.FRACTAL:
            const spawnFractal = (p: THREE.Vector3, s: number, depth: number) => {
                if (depth === 0) return;
                const m = new THREE.Mesh(new THREE.BoxGeometry(s, s, s, 4, 4, 4), material);
                m.position.copy(p);
                m.castShadow = true;
                container.add(m);

                const offset = s * 0.75;
                const nextSize = s * 0.5;
                spawnFractal(new THREE.Vector3(p.x + offset, p.y + offset, p.z), nextSize, depth - 1);
                spawnFractal(new THREE.Vector3(p.x - offset, p.y + offset, p.z), nextSize, depth - 1);
                spawnFractal(new THREE.Vector3(p.x, p.y + offset, p.z + offset), nextSize, depth - 1);
                spawnFractal(new THREE.Vector3(p.x, p.y + offset, p.z - offset), nextSize, depth - 1);
            };
            spawnFractal(new THREE.Vector3(0, 0.25, 0), 0.5, 2);
            break;

        // Standard primitives
        default:
            const mesh = new THREE.Mesh(createGeometry(shapeId), material);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            container.add(mesh);
    }

    container.scale.set(0.1, 0.1, 0.1);
    return container;
};

// --- SPAWN WITH MODIFIERS (Symmetry, Chaos, Fractal Echo) ---
export const spawnWithModifiers = (
    context: SpawnContext,
    shapeId: string,
    userImports: UserImport[] = []
): THREE.Group[] => {
    const { point, normal, material, modifiers } = context;
    const results: THREE.Group[] = [];

    // Helper to spawn single + apply chaos
    const spawn = (p: THREE.Vector3, n: THREE.Vector3, isChild = false): THREE.Group | null => {
        const obj = spawnAtPosition(p, n, shapeId, material, userImports);
        if (!obj) return null;

        // Chaos modifier
        if (modifiers.chaosMode) {
            obj.rotation.set(
                Math.random() * Math.PI * 2,
                Math.random() * Math.PI * 2,
                Math.random() * Math.PI * 2
            );
            const s = 0.5 + Math.random();
            obj.scale.multiplyScalar(s);
        }

        // Fractal echo (recursive children)
        if (modifiers.fractalEcho && !isChild) {
            const childCount = 4;
            for (let i = 0; i < childCount; i++) {
                const angle = (Math.PI * 2 * i) / childCount;
                const offset = new THREE.Vector3(
                    Math.cos(angle),
                    0,
                    Math.sin(angle)
                ).multiplyScalar(0.5);

                // Orient offset to surface normal
                offset.applyQuaternion(
                    new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), n)
                );

                const childP = p.clone().add(offset);
                const child = spawn(childP, n, true);
                if (child) {
                    child.scale.multiplyScalar(0.4);
                    results.push(child);
                }
            }
        }

        return obj;
    };

    // Apply grid lock
    let spawnPoint = point.clone();
    if (modifiers.gridLock && modifiers.gridSize > 0) {
        spawnPoint.x = Math.round(spawnPoint.x / modifiers.gridSize) * modifiers.gridSize;
        spawnPoint.y = Math.round(spawnPoint.y / modifiers.gridSize) * modifiers.gridSize;
        spawnPoint.z = Math.round(spawnPoint.z / modifiers.gridSize) * modifiers.gridSize;
    }

    // Apply void anchor (force Y-up)
    const spawnNormal = modifiers.voidAnchor
        ? new THREE.Vector3(0, 1, 0)
        : normal.clone();

    // Primary spawn
    const primary = spawn(spawnPoint, spawnNormal);
    if (primary) results.push(primary);

    // Symmetry spawns
    if (modifiers.symmetry === 'x') {
        const symP = spawnPoint.clone();
        symP.x *= -1;
        const symN = spawnNormal.clone();
        symN.x *= -1;
        const sym = spawn(symP, symN);
        if (sym) results.push(sym);
    } else if (modifiers.symmetry === 'z') {
        const symP = spawnPoint.clone();
        symP.z *= -1;
        const symN = spawnNormal.clone();
        symN.z *= -1;
        const sym = spawn(symP, symN);
        if (sym) results.push(sym);
    } else if (modifiers.symmetry === 'radial') {
        const r = Math.sqrt(spawnPoint.x ** 2 + spawnPoint.z ** 2);
        const startAngle = Math.atan2(spawnPoint.z, spawnPoint.x);

        for (let i = 1; i < modifiers.radialCount; i++) {
            const angle = startAngle + (Math.PI * 2 * i) / modifiers.radialCount;
            const rx = Math.cos(angle) * r;
            const rz = Math.sin(angle) * r;
            const rP = new THREE.Vector3(rx, spawnPoint.y, rz);
            const rN = spawnNormal.clone().applyAxisAngle(
                new THREE.Vector3(0, 1, 0),
                (Math.PI * 2 * i) / modifiers.radialCount
            );
            const radial = spawn(rP, rN);
            if (radial) results.push(radial);
        }
    }

    return results;
};
