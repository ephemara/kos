import * as THREE from 'three';
import { getKMaterialBakedMaps, getKMaterialPreviewUrl, type KMaterialAsset } from './KMaterialAsset';

export type ResolveToThreeOptions = {
    textureLoader?: THREE.TextureLoader;
    flipY?: boolean;
};

function loadTexture(
    loader: THREE.TextureLoader,
    url: string,
    colorSpace: THREE.ColorSpace,
    flipY: boolean
): THREE.Texture | null {
    if (!url) return null;
    const tex = loader.load(url);
    tex.colorSpace = colorSpace;
    tex.flipY = flipY;
    return tex;
}

export function resolveToThreeStandardMaterial(
    asset: KMaterialAsset,
    overrides: Partial<THREE.MeshStandardMaterialParameters> = {},
    options: ResolveToThreeOptions = {}
): THREE.MeshStandardMaterial {
    const loader = options.textureLoader ?? new THREE.TextureLoader();
    const flipY = options.flipY ?? false;

    const baked = getKMaterialBakedMaps(asset);
    const preview = getKMaterialPreviewUrl(asset);

    const params = asset.params ?? {};

    const mat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: params.roughnessFactor ?? 0.5,
        metalness: params.metallicFactor ?? 0.0,
        ...overrides,
    });

    const base = baked.baseColor || preview;
    mat.map = loadTexture(loader, base, THREE.SRGBColorSpace, flipY) ?? null;

    mat.normalMap = loadTexture(loader, baked.normal ?? '', THREE.NoColorSpace, flipY) ?? null;

    mat.roughnessMap = loadTexture(loader, baked.roughness ?? '', THREE.NoColorSpace, flipY) ?? null;

    mat.metalnessMap = loadTexture(loader, baked.metallic ?? '', THREE.NoColorSpace, flipY) ?? null;

    mat.aoMap = loadTexture(loader, baked.ao ?? '', THREE.NoColorSpace, flipY) ?? null;

    mat.displacementMap = loadTexture(loader, baked.height ?? '', THREE.NoColorSpace, flipY) ?? null;
    mat.displacementScale = params.displacementScale ?? 0;

    mat.emissiveMap = loadTexture(loader, baked.emissive ?? '', THREE.SRGBColorSpace, flipY) ?? null;
    if (mat.emissiveMap) {
        mat.emissive = new THREE.Color(1, 1, 1);
        mat.emissiveIntensity = params.emissiveStrength ?? 1.0;
    }

    const normalStrength = params.normalStrength;
    if (typeof normalStrength === 'number') {
        mat.normalScale = new THREE.Vector2(normalStrength, normalStrength);
    }

    return mat;
}
