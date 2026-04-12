/**
 * K_OS Mesh Pipeline - Canonical Mesh Import & Normalization System
 * 
 * This module provides the single source of truth for mesh normalization,
 * material sanitization, UV generation, and BVH acceleration.
 * 
 * ## Conventions
 * - **Units**: K_OS uses meters as the base unit
 * - **Target Size**: Default is 3.0m (fits comfortably in viewport)
 * - **Rig Height**: Characters are normalized to 1.8m (human standard)
 * 
 * ## Origin Policies
 * - `floor`: Object sits on Y=0 plane (default for most apps)
 * - `center`: Object centered at origin (for painting, atlas)
 * - `preserve`: Keep original position (for multi-object scenes)
 * 
 * ## Profiles
 * - `default`: General use (3.0m, floor)
 * - `preview`: Smaller preview meshes (2.0m, center)
 * - `rig`: Character rigs (1.8m height, floor)
 * - `atlas`: UV unwrapping (3.0m, center)
 * - `paint`: Texture painting (3.0m, center)
 * - `inspect`: Model inspection (3.0m, floor)
 * 
 * ## Usage Examples
 * ```typescript
 * // Simple normalization
 * normalizeObject(mesh, MeshImportProfiles.default);
 * 
 * // Full pipeline (normalize + sanitize + UVs + BVH)
 * prepareObject(mesh, {
 *     normalizeOptions: MeshImportProfiles.paint,
 *     ensureUVs: true,
 *     buildBVH: true,
 * });
 * 
 * // Character rig
 * const { root } = prepareRigRoot(scene, MeshImportProfiles.rig);
 * ```
 */

import * as THREE from 'three';
import { registerObject3D } from '@mocap/three-d/systems/objects/meshRegistryBridge';

export type KOriginPolicy = 'center' | 'floor' | 'preserve';

export type KNormalizeOptions = {
    targetSize?: number;
    originPolicy?: KOriginPolicy;
};

export const MeshImportProfiles = {
    default: {
        targetSize: 3.0,
        originPolicy: 'floor' as const,
    },
    preview: {
        targetSize: 2.0,
        originPolicy: 'center' as const,
    },
    rig: {
        targetHeight: 1.8,
        originPolicy: 'floor' as const,
    },
    atlas: {
        targetSize: 3.0,
        originPolicy: 'center' as const,
    },
    paint: {
        targetSize: 3.0,
        originPolicy: 'center' as const,
    },
    inspect: {
        targetSize: 3.0,
        originPolicy: 'floor' as const,
    },
} as const;

export type KNormalizeMeta = {
    originalSize: THREE.Vector3;
    scaleFactor: number;
};

export type KNormalizeResult = {
    object: THREE.Object3D;
    meta: KNormalizeMeta;
};

function computeBoxSafe(object: THREE.Object3D): { box: THREE.Box3; size: THREE.Vector3; center: THREE.Vector3 } {
    object.updateMatrixWorld(true);

    const box = new THREE.Box3().setFromObject(object);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();

    if (box.isEmpty()) {
        size.set(1, 1, 1);
        center.set(0, 0, 0);
        box.min.set(-0.5, -0.5, -0.5);
        box.max.set(0.5, 0.5, 0.5);
        return { box, size, center };
    }

    box.getSize(size);
    box.getCenter(center);
    return { box, size, center };
}

export type KNormalizeToHeightOptions = {
    targetHeight?: number;
    originPolicy?: KOriginPolicy;
    axis?: 'y';
};

export function normalizeToHeight(object: THREE.Object3D, options: KNormalizeToHeightOptions = {}): KNormalizeResult {
    const { targetHeight = 1.8, originPolicy = 'floor' } = options;

    const { size: originalSize, center } = computeBoxSafe(object);
    const height = originalSize.y;
    const scaleFactor = targetHeight / (height || 1);

    object.scale.multiplyScalar(scaleFactor);

    if (originPolicy !== 'preserve') {
        object.position.sub(center.multiplyScalar(scaleFactor));
    }

    object.updateMatrixWorld(true);

    if (originPolicy === 'floor') {
        const { box: boxAfter } = computeBoxSafe(object);
        object.position.y -= boxAfter.min.y;
        object.updateMatrixWorld(true);
    }

    return {
        object,
        meta: {
            originalSize,
            scaleFactor,
        },
    };
}

export function wrapInContainer(object: THREE.Object3D): THREE.Group {
    const container = new THREE.Group();
    container.add(object);
    return container;
}

export type KPrepareRigRootOptions = {
    targetHeight?: number;
    originPolicy?: KOriginPolicy;
};

export function prepareRigRoot(scene: THREE.Object3D, options: KPrepareRigRootOptions = {}): KNormalizeResult & { root: THREE.Group } {
    const root = wrapInContainer(scene);
    const result = normalizeToHeight(root, {
        targetHeight: options.targetHeight ?? 1.8,
        originPolicy: options.originPolicy ?? 'floor',
    });

    return {
        ...result,
        root,
    };
}

export function normalizeObject(object: THREE.Object3D, options: KNormalizeOptions = {}): KNormalizeResult {
    const { targetSize = 3.0, originPolicy = 'floor' } = options;

    const { size: originalSize, center } = computeBoxSafe(object);
    const maxDim = Math.max(originalSize.x, originalSize.y, originalSize.z);
    const scaleFactor = targetSize / (maxDim || 1);

    object.scale.multiplyScalar(scaleFactor);

    if (originPolicy !== 'preserve') {
        object.position.sub(center.multiplyScalar(scaleFactor));
    }

    object.updateMatrixWorld(true);

    if (originPolicy === 'floor') {
        const { box: boxAfter } = computeBoxSafe(object);
        object.position.y -= boxAfter.min.y;
        object.updateMatrixWorld(true);
    }

    return {
        object,
        meta: {
            originalSize,
            scaleFactor,
        },
    };
}

export type KEnsureUvOptions = {
    mode?: 'zero' | 'planar_xy';
};

export function ensureUVs(object: THREE.Object3D, options: KEnsureUvOptions = {}): void {
    const { mode = 'zero' } = options;

    object.traverse((c: any) => {
        if (!c?.isMesh) return;
        const mesh = c as THREE.Mesh;
        const geo = mesh.geometry as THREE.BufferGeometry | undefined;
        if (!geo?.attributes?.position) return;

        if (geo.attributes.uv) return;

        const count = geo.attributes.position.count;

        if (mode === 'zero') {
            geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 2), 2));
            return;
        }

        geo.computeBoundingBox();
        const bb = geo.boundingBox;
        if (!bb) {
            geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 2), 2));
            return;
        }

        const range = new THREE.Vector3();
        bb.getSize(range);
        const min = bb.min;

        const uvs = new Float32Array(count * 2);
        for (let i = 0; i < count; i++) {
            const x = geo.attributes.position.getX(i);
            const y = geo.attributes.position.getY(i);
            const u = range.x !== 0 ? (x - min.x) / range.x : 0;
            const v = range.y !== 0 ? (y - min.y) / range.y : 0;
            uvs[i * 2] = u;
            uvs[i * 2 + 1] = v;
        }

        geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    });
}

export type KSanitizeMaterialOptions = {
    upgradeLegacyMaterials?: boolean;
    doubleSided?: boolean;
    envMapIntensity?: number;
};

export function sanitizeMaterials(object: THREE.Object3D, options: KSanitizeMaterialOptions = {}): void {
    const {
        upgradeLegacyMaterials = true,
        doubleSided = true,
        envMapIntensity = 1.0,
    } = options;

    object.traverse((c: any) => {
        if (!c?.isMesh) return;

        c.castShadow = true;
        c.receiveShadow = true;

        const mat: any = c.material;
        const isLegacy = !mat
            || mat.type === 'MeshPhongMaterial'
            || mat.type === 'MeshLambertMaterial'
            || mat.type === 'MeshBasicMaterial';

        if (upgradeLegacyMaterials && isLegacy) {
            const oldColor = mat?.color || new THREE.Color(0xcccccc);
            const oldMap = mat?.map || null;
            const oldNormal = mat?.normalMap || null;

            c.material = new THREE.MeshStandardMaterial({
                color: oldColor,
                map: oldMap,
                normalMap: oldNormal,
                roughness: 0.5,
                metalness: 0.5,
                side: doubleSided ? THREE.DoubleSide : THREE.FrontSide,
            });
        }

        const activeMat: any = c.material;
        if (activeMat) {
            activeMat.envMapIntensity = envMapIntensity;
            activeMat.needsUpdate = true;
        }
    });
}

export type KBuildBvhOptions = {
    /** Lazy flag - if true, skips meshes that already have a boundsTree */
    lazyBuild?: boolean;
};

/**
 * Build BVH (Bounding Volume Hierarchy) for accelerated raycasting.
 * Requires three-mesh-bvh to be installed and geometry extended.
 */
export function buildBVH(object: THREE.Object3D, options: KBuildBvhOptions = {}): void {
    const { lazyBuild = true } = options;

    object.traverse((c: any) => {
        if (!c?.isMesh) return;
        const geo: any = c.geometry;
        if (!geo) return;

        // Skip if already has BVH and lazyBuild is enabled
        if (lazyBuild && geo.boundsTree) return;

        if (typeof geo.computeBoundsTree === 'function') {
            geo.computeBoundsTree();
        }
    });
}

export type KPrepareObjectOptions = {
    normalize?: boolean;
    normalizeOptions?: KNormalizeOptions;
    sanitizeMaterials?: boolean;
    sanitizeMaterialOptions?: KSanitizeMaterialOptions;
    ensureUVs?: boolean;
    ensureUvOptions?: KEnsureUvOptions;
    buildBVH?: boolean;
    buildBvhOptions?: KBuildBvhOptions;
    /** Register object with KObjectRegistry for cross-app persistence */
    register?: boolean;
    /** App name for registry (e.g., 'KSculpt', 'KPainter') */
    createdBy?: string;
    /** Layer K_OS ID to assign the object to */
    layerKId?: string;
};

export type KPrepareResult = KNormalizeResult & {
    /** K_OS ID if registered */
    kId?: string;
};

export function prepareObject(object: THREE.Object3D, options: KPrepareObjectOptions = {}): KPrepareResult {
    const {
        normalize = true,
        normalizeOptions,
        sanitizeMaterials: doSanitizeMaterials = true,
        sanitizeMaterialOptions,
        ensureUVs: doEnsureUVs = false,
        ensureUvOptions,
        buildBVH: doBuildBVH = false,
        buildBvhOptions,
        register = false,
        createdBy,
        layerKId,
    } = options;

    let meta: KNormalizeMeta = {
        originalSize: new THREE.Vector3(1, 1, 1),
        scaleFactor: 1,
    };

    if (normalize) {
        const r = normalizeObject(object, normalizeOptions);
        meta = r.meta;
    }

    if (doSanitizeMaterials) {
        sanitizeMaterials(object, sanitizeMaterialOptions);
    }

    if (doEnsureUVs) {
        ensureUVs(object, ensureUvOptions);
    }

    if (doBuildBVH) {
        buildBVH(object, buildBvhOptions);
    }

    // Register with KObjectRegistry for cross-app persistence
    let kId: string | undefined;
    if (register && createdBy) {
        kId = registerObject3D(object, createdBy, {
            layerKId,
            types: ['mesh', 'group'],
        });
    }

    return { object, meta, kId };
}
