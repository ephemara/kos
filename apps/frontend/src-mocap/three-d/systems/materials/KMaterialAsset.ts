export type KMaterialWorkflow = 'metalRough';

export type KMaterialMapSlot =
    | 'baseColor'
    | 'normal'
    | 'roughness'
    | 'metallic'
    | 'ao'
    | 'height'
    | 'emissive'
    | 'orm';

export type KMaterialMapSet = Partial<Record<KMaterialMapSlot, string>>;

export type KMaterialUvTransform = {
    scale?: [number, number];
    offset?: [number, number];
    rotation?: number;
};

export type KMaterialParams = {
    baseColorFactor?: [number, number, number, number];
    roughnessFactor?: number;
    metallicFactor?: number;
    normalStrength?: number;
    emissiveFactor?: [number, number, number];
    emissiveStrength?: number;
    displacementScale?: number;
    uv?: KMaterialUvTransform;
};

export type KMaterialAuthoring = {
    layerStack?: unknown;
    graph?: unknown;
    bakeSettings?: unknown;
};

export type KMaterialAsset = {
    id: string;
    name: string;

    schemaVersion: number;
    workflow: KMaterialWorkflow;

    baked?: {
        maps?: KMaterialMapSet;
    };

    params?: KMaterialParams;

    authoring?: KMaterialAuthoring;

    base?: string;
    normal?: string;
    roughness?: string;
    metallic?: string;
    ao?: string;
    height?: string;
    emissive?: string;
    preview?: string;
};

export function getKMaterialBakedMaps(asset: KMaterialAsset): KMaterialMapSet {
    const baked = asset.baked?.maps ?? {};
    const baseColor = baked.baseColor ?? asset.base ?? '';

    return {
        baseColor,
        normal: baked.normal ?? asset.normal ?? '',
        roughness: baked.roughness ?? asset.roughness ?? '',
        metallic: baked.metallic ?? asset.metallic ?? '',
        ao: baked.ao ?? asset.ao ?? '',
        height: baked.height ?? asset.height ?? '',
        emissive: baked.emissive ?? asset.emissive ?? '',
        orm: baked.orm ?? '',
    };
}

export function getKMaterialPreviewUrl(asset: KMaterialAsset): string {
    return asset.preview ?? asset.baked?.maps?.baseColor ?? asset.base ?? '';
}
