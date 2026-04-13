import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js';
import { ColladaLoader } from 'three/examples/jsm/loaders/ColladaLoader.js';
import { normalizeObject, type KOriginPolicy } from './meshPipeline';

export interface ImportOptions {
    normalize?: boolean;
    targetSize?: number;
    center?: boolean;
    originPolicy?: KOriginPolicy;
}

/**
 * Load a 3D model from a file
 */
export const loadModel = (
    file: File,
    options: ImportOptions = {}
): Promise<{ scene: THREE.Group | THREE.Scene; animations: THREE.AnimationClip[] }> => {
    return new Promise((resolve, reject) => {
        const {
            normalize = true,
            targetSize = 4.0,
            center = true,
            originPolicy
        } = options;

        const resolvedOriginPolicy: KOriginPolicy = originPolicy ?? (center ? 'center' : 'preserve');

        const filename = file.name.toLowerCase();
        const url = URL.createObjectURL(file);
        let loader: any;
        let isGeometry = false;

        if (filename.endsWith('.glb') || filename.endsWith('.gltf')) {
            loader = new GLTFLoader();
            loader.load(
                url,
                (gltf: any) => {
                    URL.revokeObjectURL(url);
                    let scene = gltf.scene;
                    const animations = gltf.animations || [];
                    if (normalize) {
                        normalizeObject(scene, { targetSize, originPolicy: resolvedOriginPolicy });
                    }
                    resolve({ scene, animations });
                },
                undefined,
                reject
            );
        } else if (filename.endsWith('.fbx')) {
            loader = new FBXLoader();
            loader.load(
                url,
                (scene: THREE.Group) => {
                    URL.revokeObjectURL(url);
                    // FBX loader attaches animations to the group
                    const animations = (scene as any).animations || [];
                    if (normalize) {
                        normalizeObject(scene, { targetSize, originPolicy: resolvedOriginPolicy });
                    }
                    resolve({ scene, animations });
                },
                undefined,
                reject
            );
        } else if (filename.endsWith('.obj')) {
            loader = new OBJLoader();
            loader.load(
                url,
                (group: THREE.Group) => {
                    URL.revokeObjectURL(url);
                    if (normalize) {
                        normalizeObject(group, { targetSize, originPolicy: resolvedOriginPolicy });
                    }
                    resolve({ scene: group, animations: [] });
                },
                undefined,
                reject
            );
        } else if (filename.endsWith('.stl')) {
            loader = new STLLoader();
            isGeometry = true;
            loader.load(
                url,
                (geo: THREE.BufferGeometry) => {
                    URL.revokeObjectURL(url);
                    const mesh = new THREE.Mesh(
                        geo,
                        new THREE.MeshStandardMaterial({ color: 0xaaaaaa })
                    );
                    const group = new THREE.Group();
                    group.add(mesh);
                    if (normalize) {
                        normalizeObject(group, { targetSize, originPolicy: resolvedOriginPolicy });
                    }
                    resolve({ scene: group, animations: [] });
                },
                undefined,
                reject
            );
        } else if (filename.endsWith('.ply')) {
            loader = new PLYLoader();
            isGeometry = true;
            loader.load(
                url,
                (geo: THREE.BufferGeometry) => {
                    URL.revokeObjectURL(url);
                    geo.computeVertexNormals();
                    const mesh = new THREE.Mesh(
                        geo,
                        new THREE.MeshStandardMaterial({ color: 0xaaaaaa })
                    );
                    const group = new THREE.Group();
                    group.add(mesh);
                    if (normalize) {
                        normalizeObject(group, { targetSize, originPolicy: resolvedOriginPolicy });
                    }
                    resolve({ scene: group, animations: [] });
                },
                undefined,
                reject
            );
        } else if (filename.endsWith('.dae')) {
            loader = new ColladaLoader();
            loader.load(
                url,
                (collada: any) => {
                    URL.revokeObjectURL(url);
                    let scene = collada.scene;
                    // Collada loader may have animations in the library
                    const animations = collada.animations || [];
                    if (normalize) {
                        normalizeObject(scene, { targetSize, originPolicy: resolvedOriginPolicy });
                    }
                    resolve({ scene, animations });
                },
                undefined,
                reject
            );
        } else {
            URL.revokeObjectURL(url);
            reject(new Error(`Unsupported file format: ${filename}`));
        }
    });
};

