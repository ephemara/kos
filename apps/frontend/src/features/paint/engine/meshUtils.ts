/**
 * meshUtils.ts - Mesh Loading & Geometry Utilities for KPainter
 * 
 * Contains geometry creation (AtlasBox, QuadSphere) and mesh normalization.
 * Extracted from KPainter.tsx to reduce file size.
 */

import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { spawnPrimitiveToThree } from '@/lib/primitives';
import { prepareObject, MeshImportProfiles, ensureUVs, buildBVH } from '@/systems/three/meshPipeline';
import { restoreFromGLTFImport } from '@/systems/objects/meshRegistryBridge';

// ============================================================================
// GEOMETRY CREATION
// ============================================================================

/**
 * Creates a box with properly laid out UVs for texture atlasing
 */
export const createAtlasBox = (w = 1, h = 1, d = 1, seg = 16): THREE.BufferGeometry => {
    const geometries: THREE.BufferGeometry[] = [];

    const createFace = (
        uOff: number,
        vOff: number,
        width: number,
        height: number,
        widthSegments: number,
        heightSegments: number,
        matrix: THREE.Matrix4
    ): THREE.BufferGeometry => {
        const geo = new THREE.PlaneGeometry(width, height, widthSegments, heightSegments);
        geo.applyMatrix4(matrix);
        const uvs = geo.attributes.uv;
        for (let i = 0; i < uvs.count; i++) {
            let u = uvs.getX(i);
            let v = uvs.getY(i);
            u = (u + uOff) / 3;
            v = (v + vOff) / 2;
            uvs.setXY(i, u, v);
        }
        return geo;
    };

    const halfW = w / 2;
    const halfH = h / 2;
    const halfD = d / 2;

    const mFront = new THREE.Matrix4().makeTranslation(0, 0, halfD);
    geometries.push(createFace(1, 1, w, h, seg, seg, mFront));

    const mBack = new THREE.Matrix4().makeRotationY(Math.PI);
    mBack.setPosition(0, 0, -halfD);
    geometries.push(createFace(2, 1, w, h, seg, seg, mBack));

    const mRight = new THREE.Matrix4().makeRotationY(Math.PI / 2);
    mRight.setPosition(halfW, 0, 0);
    geometries.push(createFace(2, 0, d, h, seg, seg, mRight));

    const mLeft = new THREE.Matrix4().makeRotationY(-Math.PI / 2);
    mLeft.setPosition(-halfW, 0, 0);
    geometries.push(createFace(0, 1, d, h, seg, seg, mLeft));

    const mTop = new THREE.Matrix4().makeRotationX(-Math.PI / 2);
    mTop.setPosition(0, halfH, 0);
    geometries.push(createFace(1, 0, w, d, seg, seg, mTop));

    const mBottom = new THREE.Matrix4().makeRotationX(Math.PI / 2);
    mBottom.setPosition(0, -halfH, 0);
    geometries.push(createFace(0, 0, w, d, seg, seg, mBottom));

    return BufferGeometryUtils.mergeGeometries(geometries)!;
};

/**
 * Creates a sphere from a normalized cube (quad sphere)
 */
export const createQuadSphere = (radius = 1, seg = 24): THREE.BufferGeometry => {
    const geo = createAtlasBox(1, 1, 1, seg);
    const pos = geo.attributes.position;

    for (let i = 0; i < pos.count; i++) {
        const v = new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i));
        v.normalize().multiplyScalar(radius);
        pos.setXYZ(i, v.x, v.y, v.z);
    }

    geo.computeVertexNormals();
    return geo;
};

// ============================================================================
// MESH NORMALIZATION & LOADING
// ============================================================================

export interface NormalizeResult {
    object: THREE.Object3D;
    meshes: THREE.Mesh[];
}

/**
 * KippIO - Mesh normalization and primitive generation
 */
export const KippIO = {
    /**
     * Normalize a loaded object - center, scale, and prepare for painting
     * Handles skinned meshes by baking to T-pose
     */
    normalize: (object: THREE.Object3D): NormalizeResult => {
        // *** T-POSE EXTRACTION: Handle animated/skinned meshes ***
        const skinnedMeshes: THREE.SkinnedMesh[] = [];
        object.traverse((c: any) => {
            if (c.isSkinnedMesh) {
                skinnedMeshes.push(c);
            }
        });

        // If we have skinned meshes, reset to bind pose and bake to static geometry
        if (skinnedMeshes.length > 0) {
            console.log(`[KPainter] Found ${skinnedMeshes.length} skinned meshes - extracting T-pose...`);

            skinnedMeshes.forEach((skinnedMesh) => {
                const skeleton = skinnedMesh.skeleton;
                if (skeleton) {
                    // Reset all bones to their bind pose (T-pose)
                    skeleton.bones.forEach((bone, i) => {
                        if (skeleton.boneInverses[i]) {
                            const bindMatrix = skeleton.boneInverses[i].clone().invert();
                            bone.matrix.copy(bindMatrix);
                            bone.matrix.decompose(bone.position, bone.quaternion, bone.scale);
                        }
                    });
                    skeleton.update();
                }

                // Bake the skinned mesh to a static mesh for painting
                skinnedMesh.updateMatrixWorld(true);
                const bakedGeometry = skinnedMesh.geometry.clone();

                const posAttr = bakedGeometry.attributes.position;
                const normalAttr = bakedGeometry.attributes.normal;
                const skinIndexAttr = bakedGeometry.attributes.skinIndex as THREE.BufferAttribute;
                const skinWeightAttr = bakedGeometry.attributes.skinWeight as THREE.BufferAttribute;

                if (skinIndexAttr && skinWeightAttr && skeleton) {
                    const boneMatrices = skeleton.boneMatrices;
                    const bindMatrix = skinnedMesh.bindMatrix;
                    const bindMatrixInverse = skinnedMesh.bindMatrixInverse;

                    const vertex = new THREE.Vector3();
                    const normal = new THREE.Vector3();
                    const skinned = new THREE.Vector3();
                    const skinnedNormal = new THREE.Vector3();
                    const temp = new THREE.Vector4();
                    const boneMatrix = new THREE.Matrix4();
                    const tempMatrix = new THREE.Matrix4();

                    for (let i = 0; i < posAttr.count; i++) {
                        vertex.fromBufferAttribute(posAttr, i);
                        vertex.applyMatrix4(bindMatrix);

                        skinned.set(0, 0, 0);

                        for (let j = 0; j < 4; j++) {
                            const boneIndex = skinIndexAttr.getComponent(i, j);
                            const weight = skinWeightAttr.getComponent(i, j);

                            if (weight > 0) {
                                boneMatrix.fromArray(boneMatrices, boneIndex * 16);
                                temp.copy(vertex as any).applyMatrix4(boneMatrix).multiplyScalar(weight);
                                skinned.add(temp as any);
                            }
                        }

                        skinned.applyMatrix4(bindMatrixInverse);
                        posAttr.setXYZ(i, skinned.x, skinned.y, skinned.z);

                        // Also transform normals
                        if (normalAttr) {
                            normal.fromBufferAttribute(normalAttr, i);
                            skinnedNormal.set(0, 0, 0);

                            for (let j = 0; j < 4; j++) {
                                const boneIndex = skinIndexAttr.getComponent(i, j);
                                const weight = skinWeightAttr.getComponent(i, j);

                                if (weight > 0) {
                                    boneMatrix.fromArray(boneMatrices, boneIndex * 16);
                                    tempMatrix.copy(boneMatrix).invert().transpose();
                                    temp.set(normal.x, normal.y, normal.z, 0).applyMatrix4(tempMatrix);
                                    skinnedNormal.add(new THREE.Vector3(temp.x, temp.y, temp.z).multiplyScalar(weight));
                                }
                            }

                            skinnedNormal.normalize();
                            normalAttr.setXYZ(i, skinnedNormal.x, skinnedNormal.y, skinnedNormal.z);
                        }
                    }

                    posAttr.needsUpdate = true;
                    if (normalAttr) normalAttr.needsUpdate = true;
                }

                // Remove skinning attributes - we're now a static mesh
                bakedGeometry.deleteAttribute('skinIndex');
                bakedGeometry.deleteAttribute('skinWeight');

                // Replace the skinned mesh with a regular mesh
                const staticMesh = new THREE.Mesh(bakedGeometry, skinnedMesh.material);
                staticMesh.name = skinnedMesh.name || `baked_mesh_${Date.now()}`;
                staticMesh.userData = skinnedMesh.userData || {};

                // Replace in parent
                if (skinnedMesh.parent) {
                    skinnedMesh.parent.add(staticMesh);
                    skinnedMesh.parent.remove(skinnedMesh);
                    staticMesh.position.copy(skinnedMesh.position);
                    staticMesh.rotation.copy(skinnedMesh.rotation);
                    staticMesh.scale.copy(skinnedMesh.scale);
                }
            });

            console.log('[KPainter] T-pose extraction complete - converted to static meshes');
        }

        // HOT POTATO MODE: First try to restore existing kIds from GLTF extras
        // This ensures objects from other apps (e.g., KSculpt) keep their identity
        restoreFromGLTFImport(object, 'KPainter');

        // Continue with standard normalization using canonical pipeline
        // NOTE: register=false to prevent scene trash accumulating in registry
        // Objects get kId only when exported/uplinked to Kernel
        const { kId } = prepareObject(object, {
            normalize: true,
            normalizeOptions: MeshImportProfiles.paint,
            sanitizeMaterials: true,
            ensureUVs: true,
            ensureUvOptions: { mode: 'planar_xy' },
            buildBVH: true,
            register: false,
            createdBy: 'KPainter',
        });

        const meshes: THREE.Mesh[] = [];
        object.traverse((c: any) => {
            if (c.isMesh) {
                c.castShadow = true;
                c.receiveShadow = true;

                // *** SAFETY: Ensure mesh and geometry have valid names ***
                if (!c.name) c.name = `mesh_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
                if (c.geometry && !c.geometry.name) c.geometry.name = `geo_${c.name}`;
                if (c.material && !c.material.name) c.material.name = `mat_${c.name}`;

                meshes.push(c);
            }
        });

        return { object, meshes };
    },

    /**
     * Get a primitive mesh by type name
     */
    getPrimitive: (type: string): NormalizeResult => {
        let geo: THREE.BufferGeometry;

        switch (type) {
            case 'cube':
                geo = createAtlasBox(1.5, 1.5, 1.5, 1);
                break;
            case 'sphere':
                geo = createQuadSphere(1.0, 32);
                break;
            case 'torus':
                geo = new THREE.TorusKnotGeometry(0.8, 0.3, 128, 64);
                break;
            case 'plane':
                geo = new THREE.PlaneGeometry(2, 2);
                break;
            case 'cylinder':
                geo = new THREE.CylinderGeometry(0.8, 0.8, 2, 32);
                break;
            case 'capsule':
                geo = new THREE.CapsuleGeometry(0.8, 2, 4, 16);
                break;
            case 'octahedron':
                geo = new THREE.OctahedronGeometry(1, 0);
                break;
            default:
                geo = createAtlasBox(1, 1, 1, 1);
        }

        const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial());
        return KippIO.normalize(mesh);
    },

    getPrimitiveAsync: async (type: string): Promise<NormalizeResult> => {
        let geo: THREE.BufferGeometry;

        switch (type) {
            case 'cylinder': {
                try {
                    geo = await spawnPrimitiveToThree('cylinder', { radialSegments: 32, heightSegments: 16, caps: true });
                    geo.scale(0.8, 1.0, 0.8);
                } catch (e) {
                    console.warn('[KPainter] Universal primitive failed, using fallback');
                    geo = new THREE.CylinderGeometry(0.8, 0.8, 2, 32);
                }
                break;
            }
            default:
                return KippIO.getPrimitive(type);
        }

        const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial());
        return KippIO.normalize(mesh);
    },
};
