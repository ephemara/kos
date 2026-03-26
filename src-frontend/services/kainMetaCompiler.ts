import { invoke } from '@tauri-apps/api/core';
import type { KBrushAsset } from './brushClient';

export const KAIN_MULTI_TARGETS = [
  'kainscript',
  'typescript',
  'wasm',
  'usf',
  'spirv',
  'hlsl',
] as const;

export type KainCompileTarget = (typeof KAIN_MULTI_TARGETS)[number];

export type KainMetaProfile = {
  language: 'kain_meta' | string;
  entry?: string;
  source?: string;
  targets?: string[];
};

export type KainToolchainConfig = {
  enabled: boolean;
  kainRoot: string;
  asmCrateDir: string;
  webCrateDir: string;
  cliBin: string;
};

export type KainCompileRequest = {
  entry: string;
  source?: string;
  targets: KainCompileTarget[];
  toolchain: KainToolchainConfig;
};

export type KainCompileResult = {
  status: 'compiled' | 'fallback' | 'unsupported';
  targets: KainCompileTarget[];
  toolchain: KainToolchainConfig;
  error?: string;
};

const compileCache = new Map<string, KainCompileResult>();

const DEFAULT_KAIN_TOOLCHAIN: KainToolchainConfig = {
  enabled: true,
  kainRoot: 'M:/K_OS',
  asmCrateDir: 'M:/K_OS/crates/k-os-kain',
  webCrateDir: 'M:/K_OS/crates/k-os-kain',
  cliBin: 'kain',
};

function readEnvVar(name: string): string | undefined {
  const env = (import.meta as any)?.env ?? {};
  const value = env[name];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

export function resolveKainToolchainConfig(
  overrides: Partial<KainToolchainConfig> = {}
): KainToolchainConfig {
  const enabledRaw = readEnvVar('VITE_KAIN_ENABLED');
  const envEnabled =
    enabledRaw == null ? undefined : !['0', 'false', 'off'].includes(enabledRaw.toLowerCase());

  return {
    enabled: overrides.enabled ?? envEnabled ?? DEFAULT_KAIN_TOOLCHAIN.enabled,
    kainRoot: overrides.kainRoot ?? readEnvVar('VITE_KAIN_ROOT') ?? DEFAULT_KAIN_TOOLCHAIN.kainRoot,
    asmCrateDir:
      overrides.asmCrateDir ??
      readEnvVar('VITE_KAIN_ASM_CRATE_DIR') ??
      DEFAULT_KAIN_TOOLCHAIN.asmCrateDir,
    webCrateDir:
      overrides.webCrateDir ??
      readEnvVar('VITE_KAIN_WEB_CRATE_DIR') ??
      DEFAULT_KAIN_TOOLCHAIN.webCrateDir,
    cliBin: overrides.cliBin ?? readEnvVar('VITE_KAIN_CLI_BIN') ?? DEFAULT_KAIN_TOOLCHAIN.cliBin,
  };
}

export function resolveKainTargets(
  requested: string[] | undefined
): KainCompileTarget[] {
  if (!requested || requested.length === 0) return [...KAIN_MULTI_TARGETS];
  const valid = requested.filter((target): target is KainCompileTarget =>
    KAIN_MULTI_TARGETS.includes(target as KainCompileTarget)
  );
  return valid.length ? valid : [...KAIN_MULTI_TARGETS];
}

export function isMetaphysicalBrush(brush: KBrushAsset | null | undefined): boolean {
  const language = brush?.meta?.language?.toLowerCase();
  return language === 'kain_meta' || language === 'metaphysical';
}

export function buildKainCompileRequest(
  brush: KBrushAsset,
  options: {
    requestedTargets?: string[];
    toolchain?: Partial<KainToolchainConfig>;
  } = {}
): KainCompileRequest {
  const meta = brush.meta ?? {};
  return {
    entry: meta.entry || brush.kernel?.shader || brush.id,
    source: meta.source,
    targets: resolveKainTargets(options.requestedTargets ?? meta.targets),
    toolchain: resolveKainToolchainConfig(options.toolchain),
  };
}

export async function compileKainMetaChainForBrush(
  brush: KBrushAsset,
  options: {
    requestedTargets?: string[];
    toolchain?: Partial<KainToolchainConfig>;
  } = {}
): Promise<KainCompileResult> {
  const request = buildKainCompileRequest(brush, options);
  const cacheKey = `${request.entry}|${request.targets.join(',')}|${request.toolchain.cliBin}|${request.toolchain.kainRoot}`;
  const cached = compileCache.get(cacheKey);
  if (cached) return cached;

  if (!request.toolchain.enabled) {
    const result: KainCompileResult = {
      status: 'unsupported',
      targets: request.targets,
      toolchain: request.toolchain,
      error: 'Kain toolchain disabled',
    };
    compileCache.set(cacheKey, result);
    return result;
  }

  const isTauri = typeof (window as any).__TAURI__ !== 'undefined';
  if (!isTauri) {
    const result: KainCompileResult = {
      status: 'fallback',
      targets: request.targets,
      toolchain: request.toolchain,
      error: 'No Tauri backend available',
    };
    compileCache.set(cacheKey, result);
    return result;
  }

  try {
    await invoke('kain_compile_multi_target', { request });
    const result: KainCompileResult = {
      status: 'compiled',
      targets: request.targets,
      toolchain: request.toolchain,
    };
    compileCache.set(cacheKey, result);
    return result;
  } catch (error) {
    const result: KainCompileResult = {
      status: 'fallback',
      targets: request.targets,
      toolchain: request.toolchain,
      error: error instanceof Error ? error.message : String(error),
    };
    compileCache.set(cacheKey, result);
    return result;
  }
}
