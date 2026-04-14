export type KainGeneratedRuntimeTarget = 'wasm' | 'llvm' | 'spirv' | 'js' | 'ts' | 'ks' | 'hybrid' | 'rust' | 'cpp' | 'run' | 'test' | 'hlsl' | 'usf' | 'ue5' | 'ue5editor';
export type KainGeneratedRuntimeKind = 'tauri_frontend' | 'desktop_script' | 'compute_kernel' | 'hybrid_module' | 'native_ui_app' | 'viewport3d_app' | 'python_bridge' | 'node_bridge' | 'rust_crate_bridge' | 'c_abi_bridge' | 'omni_pipeline' | 'selfhost_harness';
export type KainGeneratedHostKind = 'tauri' | 'webview' | 'wasm_runtime' | 'hybrid' | 'native_runtime' | 'python' | 'node' | 'rust_host' | 'c_abi' | 'ue5' | 'cli';

export interface GeneratedRuntimeOutputMeta {
  target: KainGeneratedRuntimeTarget;
  path: string;
}

export interface GeneratedRuntimeAppMeta {
  id: string;
  label: string;
  sourcePath: string;
  runtimeKind: KainGeneratedRuntimeKind;
  hostKind: KainGeneratedHostKind;
  namespace: string;
  outputs: ReadonlyArray<GeneratedRuntimeOutputMeta>;
}

export const GENERATED_RUNTIME_APPS: ReadonlyArray<GeneratedRuntimeAppMeta> = [
  { id: 'brush_builder', label: 'Brush Builder', sourcePath: 'sources/kain/apps/brush_builder/main.kn', runtimeKind: 'tauri_frontend', hostKind: 'tauri', namespace: 'brush_builder', outputs: [{ target: 'ts', path: 'crates/k-os-kain/generated/runtime/ts/brush_builder/main.ts' }, { target: 'js', path: 'crates/k-os-kain/generated/runtime/js/brush_builder/main.js' }, { target: 'ks', path: 'crates/k-os-kain/generated/runtime/ks/brush_builder/main.ks' }] },
  { id: 'desktop_automation', label: 'Desktop Automation', sourcePath: 'sources/kain/scripts/desktop_automation/main.kn', runtimeKind: 'desktop_script', hostKind: 'tauri', namespace: 'desktop_automation', outputs: [{ target: 'ks', path: 'crates/k-os-kain/generated/runtime/ks/desktop_automation/main.ks' }, { target: 'js', path: 'crates/k-os-kain/generated/runtime/js/desktop_automation/main.js' }] },
  { id: 'fluid_builder', label: 'Fluid Builder', sourcePath: 'sources/kain/apps/fluid_builder/main.kn', runtimeKind: 'tauri_frontend', hostKind: 'tauri', namespace: 'fluid_builder', outputs: [{ target: 'ts', path: 'crates/k-os-kain/generated/runtime/ts/fluid_builder/main.ts' }, { target: 'js', path: 'crates/k-os-kain/generated/runtime/js/fluid_builder/main.js' }, { target: 'ks', path: 'crates/k-os-kain/generated/runtime/ks/fluid_builder/main.ks' }] },
  { id: 'kainscript_builder', label: 'KainScript Builder', sourcePath: 'sources/kain/apps/kainscript_builder/main.kn', runtimeKind: 'tauri_frontend', hostKind: 'tauri', namespace: 'kainscript_builder', outputs: [{ target: 'ts', path: 'crates/k-os-kain/generated/runtime/ts/kainscript_builder/main.ts' }, { target: 'js', path: 'crates/k-os-kain/generated/runtime/js/kainscript_builder/main.js' }, { target: 'ks', path: 'crates/k-os-kain/generated/runtime/ks/kainscript_builder/main.ks' }] },
  { id: 'material_builder', label: 'Material Builder', sourcePath: 'sources/kain/apps/material_builder/main.kn', runtimeKind: 'tauri_frontend', hostKind: 'tauri', namespace: 'material_builder', outputs: [{ target: 'ts', path: 'crates/k-os-kain/generated/runtime/ts/material_builder/main.ts' }, { target: 'js', path: 'crates/k-os-kain/generated/runtime/js/material_builder/main.js' }, { target: 'ks', path: 'crates/k-os-kain/generated/runtime/ks/material_builder/main.ks' }] },
  { id: 'procedural_builder', label: 'Procedural Builder', sourcePath: 'sources/kain/apps/procedural_builder/main.kn', runtimeKind: 'tauri_frontend', hostKind: 'tauri', namespace: 'procedural_builder', outputs: [{ target: 'ts', path: 'crates/k-os-kain/generated/runtime/ts/procedural_builder/main.ts' }, { target: 'js', path: 'crates/k-os-kain/generated/runtime/js/procedural_builder/main.js' }, { target: 'ks', path: 'crates/k-os-kain/generated/runtime/ks/procedural_builder/main.ks' }] },
  { id: 'shader_builder', label: 'Shader Builder', sourcePath: 'sources/kain/apps/shader_builder/main.kn', runtimeKind: 'tauri_frontend', hostKind: 'tauri', namespace: 'shader_builder', outputs: [{ target: 'ts', path: 'crates/k-os-kain/generated/runtime/ts/shader_builder/main.ts' }, { target: 'js', path: 'crates/k-os-kain/generated/runtime/js/shader_builder/main.js' }, { target: 'ks', path: 'crates/k-os-kain/generated/runtime/ks/shader_builder/main.ks' }] },
  { id: 'signal_kernel', label: 'Signal Kernel', sourcePath: 'sources/kain/kernels/signal_kernel/main.kn', runtimeKind: 'compute_kernel', hostKind: 'wasm_runtime', namespace: 'signal_kernel', outputs: [{ target: 'wasm', path: 'crates/k-os-kain/generated/runtime/wasm/signal_kernel/main.wasm' }, { target: 'ts', path: 'crates/k-os-kain/generated/runtime/ts/signal_kernel/bindings.ts' }] },
  { id: 'suite_shell', label: 'Suite Shell', sourcePath: 'sources/kain/apps/suite_shell/main.kn', runtimeKind: 'tauri_frontend', hostKind: 'tauri', namespace: 'suite_shell', outputs: [{ target: 'ts', path: 'crates/k-os-kain/generated/runtime/ts/suite_shell/main.ts' }, { target: 'js', path: 'crates/k-os-kain/generated/runtime/js/suite_shell/main.js' }, { target: 'ks', path: 'crates/k-os-kain/generated/runtime/ks/suite_shell/main.ks' }] },
  { id: 'viewport_bridge', label: 'Viewport Bridge', sourcePath: 'sources/kain/hybrid/viewport_bridge/main.kn', runtimeKind: 'hybrid_module', hostKind: 'hybrid', namespace: 'viewport_bridge', outputs: [{ target: 'hybrid', path: 'crates/k-os-kain/generated/runtime/hybrid/viewport_bridge/module.hybrid' }, { target: 'wasm', path: 'crates/k-os-kain/generated/runtime/wasm/viewport_bridge/module.wasm' }, { target: 'ts', path: 'crates/k-os-kain/generated/runtime/ts/viewport_bridge/bindings.ts' }] },
] as const;

export const GENERATED_RUNTIME_BY_ID: Readonly<Record<string, GeneratedRuntimeAppMeta>> = Object.fromEntries(
  GENERATED_RUNTIME_APPS.map((asset) => [asset.id, asset]),
) as Readonly<Record<string, GeneratedRuntimeAppMeta>>;
