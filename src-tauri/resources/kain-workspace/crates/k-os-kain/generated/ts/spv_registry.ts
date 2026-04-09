export type KainGeneratedDomain = string;

export interface GeneratedSpirvAssetMeta {
  id: string;
  label: string;
  domain: KainGeneratedDomain;
  sourcePath: string;
  compiledPath: string;
}

export const GENERATED_SPIRV_ASSETS: ReadonlyArray<GeneratedSpirvAssetMeta> = [
] as const;

export const GENERATED_SPIRV_BY_ID: Readonly<Record<string, GeneratedSpirvAssetMeta>> = Object.fromEntries(
  GENERATED_SPIRV_ASSETS.map((asset) => [asset.id, asset]),
) as Readonly<Record<string, GeneratedSpirvAssetMeta>>;
