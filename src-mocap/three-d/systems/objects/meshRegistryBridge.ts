/**
 * meshRegistryBridge.ts - Bridge between THREE.js meshes and K_OS Object Registry
 * 
 * Provides utilities to automatically register meshes with the K_OS registry
 * when they're created or imported.
 */

import * as THREE from 'three';
import { getKObjectRegistry, type KObjectType } from './KObjectRegistry';

/**
 * Register a THREE.js Object3D and its children with the K_OS registry
 */
export function registerObject3D(
    object: THREE.Object3D,
    createdBy: string,
    options?: {
        parentKId?: string;
        layerKId?: string;
        recursive?: boolean;
        types?: KObjectType[];
    }
): string {
    const registry = getKObjectRegistry();
    const recursive = options?.recursive ?? true;
    const allowedTypes = options?.types ?? ['mesh', 'group', 'light', 'camera'];

    // Determine object type
    let type: KObjectType = 'group';
    if ((object as THREE.Mesh).isMesh) {
        type = 'mesh';
    } else if ((object as THREE.Light).isLight) {
        type = 'light';
    } else if ((object as THREE.Camera).isCamera) {
        type = 'camera';
    } else if ((object as THREE.Bone).isBone) {
        type = 'bone';
    }

    // Skip if type not allowed
    if (!allowedTypes.includes(type)) {
        // Still process children
        if (recursive) {
            object.children.forEach(child => {
                registerObject3D(child, createdBy, { ...options, parentKId: options?.parentKId });
            });
        }
        return '';
    }

    // Check if already registered
    let kId = registry.getKIdFromThreeUuid(object.uuid);

    if (!kId) {
        // Register new object
        kId = registry.register({
            type,
            name: object.name || `Untitled ${type}`,
            createdBy,
            threeUuid: object.uuid,
            parentKId: options?.parentKId,
            layerKId: options?.layerKId
        });

        // Store kId on the THREE object for easy lookup
        object.userData.kId = kId;
    } else {
        // Update binding if needed
        registry.markLoaded(kId, object.uuid);
        object.userData.kId = kId;
    }

    // Process children
    if (recursive) {
        object.children.forEach(child => {
            registerObject3D(child, createdBy, { ...options, parentKId: kId });
        });
    }

    return kId;
}

/**
 * Unregister a THREE.js Object3D (mark as unloaded)
 */
export function unregisterObject3D(object: THREE.Object3D, recursive: boolean = true): void {
    const registry = getKObjectRegistry();

    const kId = object.userData.kId || registry.getKIdFromThreeUuid(object.uuid);
    if (kId) {
        registry.markUnloaded(kId);
    }

    if (recursive) {
        object.children.forEach(child => unregisterObject3D(child, true));
    }
}

/**
 * Get K_OS ID from a THREE.js object
 */
export function getKIdFromObject(object: THREE.Object3D): string | undefined {
    return object.userData.kId || getKObjectRegistry().getKIdFromThreeUuid(object.uuid);
}

/**
 * Get KObject from a THREE.js object
 */
export function getKObjectFromObject(object: THREE.Object3D) {
    const kId = getKIdFromObject(object);
    return kId ? getKObjectRegistry().get(kId) : undefined;
}

/**
 * Find THREE.js object by K_OS ID in a scene
 */
export function findObjectByKId(scene: THREE.Scene | THREE.Object3D, kId: string): THREE.Object3D | undefined {
    let found: THREE.Object3D | undefined;

    scene.traverse((child) => {
        if (child.userData.kId === kId) {
            found = child;
        }
    });

    return found;
}

/**
 * Sync registry state with scene (mark objects as loaded/unloaded)
 */
export function syncRegistryWithScene(scene: THREE.Scene, createdBy: string): void {
    const registry = getKObjectRegistry();

    // Get all kIds currently in scene
    const sceneKIds = new Set<string>();

    scene.traverse((child) => {
        const kId = child.userData.kId || registry.getKIdFromThreeUuid(child.uuid);
        if (kId) {
            sceneKIds.add(kId);
            registry.markLoaded(kId, child.uuid);
        }
    });

    // Mark objects not in scene as unloaded
    registry.getAllByApp(createdBy).forEach(obj => {
        if (!sceneKIds.has(obj.kId) && obj.isLoaded) {
            registry.markUnloaded(obj.kId);
        }
    });
}

/**
 * Store K_OS IDs in GLTF extras for persistence
 */
export function prepareForGLTFExport(object: THREE.Object3D): void {
    object.traverse((child) => {
        if (child.userData.kId) {
            // GLTF extras need to be serializable
            if (!child.userData.gltfExtras) {
                child.userData.gltfExtras = {};
            }
            child.userData.gltfExtras.kId = child.userData.kId;
        }
    });
}

/**
 * Restore K_OS IDs from GLTF extras after import
 */
export function restoreFromGLTFImport(object: THREE.Object3D, createdBy: string): void {
    const registry = getKObjectRegistry();

    object.traverse((child) => {
        const gltfKId = child.userData.gltfExtras?.kId;

        if (gltfKId && registry.has(gltfKId)) {
            // Object was previously registered, restore binding
            registry.markLoaded(gltfKId, child.uuid);
            child.userData.kId = gltfKId;
        } else {
            // New object, register it
            registerObject3D(child, createdBy, { recursive: false });
        }
    });
}
