use serde_json::Value;
use std::collections::HashMap;
use std::fmt::Write as _;
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Clone, Debug)]
struct AssetMeta {
    id: String,
    label: String,
    domain: String,
    source_path: String,
    compiled_path: String,
}

#[derive(Clone, Debug)]
struct RuntimeOutputMeta {
    target: String,
    path: String,
}

#[derive(Clone, Debug)]
struct RuntimeAppMeta {
    id: String,
    label: String,
    source_path: String,
    runtime_kind: String,
    host_kind: String,
    namespace: String,
    outputs: Vec<RuntimeOutputMeta>,
}

fn main() {
    println!("cargo:rerun-if-changed=manifests/sources.json");
    println!("cargo:rerun-if-changed=manifests/runtime_apps.json");
    println!("cargo:rerun-if-changed=manifests/upstream_capabilities.json");
    println!("cargo:rerun-if-changed=generated/spv");
    println!("cargo:rerun-if-changed=domains");
    println!("cargo:rerun-if-changed=../../sources/kain");

    let source_manifest = load_spirv_manifest();
    let spv_assets = discover_spirv_assets(&source_manifest);
    let runtime_apps = load_runtime_manifest();

    let generated_root = PathBuf::from("generated");
    let rust_root = generated_root.join("rust");
    let ts_root = generated_root.join("ts");
    let json_root = generated_root.join("json");
    let runtime_root = generated_root.join("runtime");

    let rust_spv_out = rust_root.join("spv_registry.rs");
    let ts_spv_out = ts_root.join("spv_registry.ts");
    let json_spv_out = json_root.join("spv_registry.json");
    let rust_runtime_out = rust_root.join("runtime_registry.rs");
    let ts_runtime_out = ts_root.join("runtime_registry.ts");
    let json_runtime_out = json_root.join("runtime_registry.json");

    for dir in [
        &rust_root,
        &ts_root,
        &json_root,
        &runtime_root,
        &runtime_root.join("wasm"),
        &runtime_root.join("llvm"),
        &runtime_root.join("js"),
        &runtime_root.join("ts"),
        &runtime_root.join("ks"),
        &runtime_root.join("hybrid"),
        &runtime_root.join("ue5"),
        &runtime_root.join("ue5editor"),
    ] {
        let _ = fs::create_dir_all(dir);
    }

    for app in &runtime_apps {
        for output in &app.outputs {
            if let Some(parent) = Path::new(&output.path).parent() {
                let _ = fs::create_dir_all(parent);
            }
        }
    }

    write_if_changed(&rust_spv_out, &render_rust_spv_registry(&spv_assets))
        .expect("write rust spv registry");
    write_if_changed(&ts_spv_out, &render_ts_spv_registry(&spv_assets))
        .expect("write ts spv registry");
    write_if_changed(&json_spv_out, &render_json_spv_registry(&spv_assets))
        .expect("write json spv registry");
    write_if_changed(
        &rust_runtime_out,
        &render_rust_runtime_registry(&runtime_apps),
    )
    .expect("write rust runtime registry");
    write_if_changed(&ts_runtime_out, &render_ts_runtime_registry(&runtime_apps))
        .expect("write ts runtime registry");
    write_if_changed(
        &json_runtime_out,
        &render_json_runtime_registry(&runtime_apps),
    )
    .expect("write json runtime registry");
}

fn load_spirv_manifest() -> HashMap<String, AssetMeta> {
    let path = Path::new("manifests").join("sources.json");
    let Ok(contents) = fs::read_to_string(&path) else {
        return HashMap::new();
    };
    let Ok(value) = serde_json::from_str::<Value>(&contents) else {
        return HashMap::new();
    };
    let Some(items) = value.as_array() else {
        return HashMap::new();
    };

    let mut out = HashMap::new();
    for item in items {
        let Some(target) = item.get("target").and_then(Value::as_str) else {
            continue;
        };
        if target != "spirv" {
            continue;
        }
        let Some(id) = item.get("id").and_then(Value::as_str) else {
            continue;
        };
        let Some(domain) = item.get("domain").and_then(Value::as_str) else {
            continue;
        };
        let label = item
            .get("label")
            .and_then(Value::as_str)
            .map(str::to_string)
            .unwrap_or_else(|| title_case(id));
        let source_path = item
            .get("source_path")
            .and_then(Value::as_str)
            .map(str::to_string)
            .unwrap_or_else(|| format!("crates/k-os-kain/domains/{domain}/{id}.kn"));
        let compiled_path = item
            .get("compiled_path")
            .and_then(Value::as_str)
            .map(str::to_string)
            .unwrap_or_else(|| format!("crates/k-os-kain/generated/spv/{domain}/{id}.spv"));
        out.insert(
            id.to_string(),
            AssetMeta {
                id: id.to_string(),
                label,
                domain: domain.to_string(),
                source_path,
                compiled_path,
            },
        );
    }
    out
}

fn load_runtime_manifest() -> Vec<RuntimeAppMeta> {
    let path = Path::new("manifests").join("runtime_apps.json");
    let Ok(contents) = fs::read_to_string(&path) else {
        return Vec::new();
    };
    let Ok(value) = serde_json::from_str::<Value>(&contents) else {
        return Vec::new();
    };
    let Some(items) = value.as_array() else {
        return Vec::new();
    };

    let mut out = Vec::new();
    for item in items {
        let Some(id) = item.get("id").and_then(Value::as_str) else {
            continue;
        };
        let label = item
            .get("label")
            .and_then(Value::as_str)
            .map(str::to_string)
            .unwrap_or_else(|| title_case(id));
        let source_path = item
            .get("source_path")
            .and_then(Value::as_str)
            .map(str::to_string)
            .unwrap_or_default();
        let runtime_kind = item
            .get("runtime_kind")
            .and_then(Value::as_str)
            .map(str::to_string)
            .unwrap_or_else(|| "desktop_script".to_string());
        let host_kind = item
            .get("host_kind")
            .and_then(Value::as_str)
            .map(str::to_string)
            .unwrap_or_else(|| "tauri".to_string());
        let namespace = item
            .get("namespace")
            .and_then(Value::as_str)
            .map(str::to_string)
            .unwrap_or_else(|| id.to_string());
        let outputs = item
            .get("outputs")
            .and_then(Value::as_array)
            .map(|entries| {
                entries
                    .iter()
                    .filter_map(|entry| {
                        let target = entry.get("target").and_then(Value::as_str)?;
                        let path = entry.get("path").and_then(Value::as_str)?;
                        Some(RuntimeOutputMeta {
                            target: target.to_string(),
                            path: path.to_string(),
                        })
                    })
                    .collect::<Vec<_>>()
            })
            .unwrap_or_default();
        out.push(RuntimeAppMeta {
            id: id.to_string(),
            label,
            source_path,
            runtime_kind,
            host_kind,
            namespace,
            outputs,
        });
    }

    out.sort_by(|a, b| a.namespace.cmp(&b.namespace).then_with(|| a.id.cmp(&b.id)));
    out
}

fn discover_spirv_assets(manifest: &HashMap<String, AssetMeta>) -> Vec<AssetMeta> {
    let root = Path::new("generated").join("spv");
    let mut assets = Vec::new();
    if !root.exists() {
        return assets;
    }

    let Ok(domains) = fs::read_dir(&root) else {
        return assets;
    };

    for domain_entry in domains.flatten() {
        let domain_path = domain_entry.path();
        if !domain_path.is_dir() {
            continue;
        }
        let Some(domain) = domain_path.file_name().and_then(|name| name.to_str()) else {
            continue;
        };
        let Ok(files) = fs::read_dir(&domain_path) else {
            continue;
        };
        for file in files.flatten() {
            let path = file.path();
            if path.extension().and_then(|ext| ext.to_str()) != Some("spv") {
                continue;
            }
            let Some(stem) = path.file_stem().and_then(|name| name.to_str()) else {
                continue;
            };
            let relative_compiled = format!("crates/k-os-kain/generated/spv/{domain}/{stem}.spv");
            let meta = manifest.get(stem).cloned().unwrap_or_else(|| AssetMeta {
                id: stem.to_string(),
                label: title_case(stem),
                domain: domain.to_string(),
                source_path: format!("crates/k-os-kain/domains/{domain}/{stem}.kn"),
                compiled_path: relative_compiled.clone(),
            });
            let mut merged = meta;
            merged.domain = domain.to_string();
            merged.compiled_path = relative_compiled;
            assets.push(merged);
        }
    }

    assets.sort_by(|a, b| a.domain.cmp(&b.domain).then_with(|| a.id.cmp(&b.id)));
    assets
}

fn render_rust_spv_registry(assets: &[AssetMeta]) -> String {
    let mut out = String::new();
    out.push_str("pub struct GeneratedSpirvLookupEntry {\n");
    out.push_str("    pub id: &'static str,\n");
    out.push_str("    pub asset: &'static crate::GeneratedSpirvAsset,\n");
    out.push_str("}\n\n");

    for asset in assets {
        let upper = upper_ident(&asset.id);
        let fn_name = rust_ident(&asset.id);
        let domain_variant = domain_variant(&asset.domain);
        let compiled_suffix = asset
            .compiled_path
            .strip_prefix("crates/k-os-kain/")
            .unwrap_or(&asset.compiled_path)
            .replace('\\', "/");
        let source_path = escape_str(&asset.source_path);
        let compiled_path = escape_str(&asset.compiled_path);
        let label = escape_str(&asset.label);
        let id = escape_str(&asset.id);
        writeln!(out, "pub const {upper}_BYTES: &[u8] = include_bytes!(concat!(env!(\"CARGO_MANIFEST_DIR\"), \"/{compiled_suffix}\"));").unwrap();
        writeln!(
            out,
            "pub static {upper}: crate::GeneratedSpirvAsset = crate::GeneratedSpirvAsset {{"
        )
        .unwrap();
        writeln!(out, "    id: \"{id}\",").unwrap();
        writeln!(out, "    label: \"{label}\",").unwrap();
        writeln!(out, "    domain: crate::KainDomain::{domain_variant},").unwrap();
        writeln!(out, "    source_path: \"{source_path}\",").unwrap();
        writeln!(out, "    compiled_path: \"{compiled_path}\",").unwrap();
        writeln!(out, "    bytes: {upper}_BYTES,").unwrap();
        writeln!(out, "}};").unwrap();
        writeln!(
            out,
            "pub fn {fn_name}() -> &'static crate::GeneratedSpirvAsset {{ &{upper} }}"
        )
        .unwrap();
        out.push('\n');
    }

    out.push_str("pub static ASSETS: &[&crate::GeneratedSpirvAsset] = &[\n");
    for asset in assets {
        let upper = upper_ident(&asset.id);
        writeln!(out, "    &{upper},").unwrap();
    }
    out.push_str("];\n\n");
    out.push_str(
        "pub fn assets() -> &'static [&'static crate::GeneratedSpirvAsset] { ASSETS }\n\n",
    );

    out.push_str("pub static ALL: &[GeneratedSpirvLookupEntry] = &[\n");
    for asset in assets {
        let upper = upper_ident(&asset.id);
        let id = escape_str(&asset.id);
        writeln!(
            out,
            "    GeneratedSpirvLookupEntry {{ id: \"{id}\", asset: &{upper} }},"
        )
        .unwrap();
    }
    out.push_str("];\n\n");
    out.push_str("pub fn all() -> &'static [GeneratedSpirvLookupEntry] { ALL }\n\n");
    out.push_str("pub fn by_id(id: &str) -> Option<&'static crate::GeneratedSpirvAsset> {\n");
    out.push_str("    match id {\n");
    for asset in assets {
        let upper = upper_ident(&asset.id);
        let id = escape_str(&asset.id);
        writeln!(out, "        \"{id}\" => Some(&{upper}),").unwrap();
    }
    out.push_str("        _ => None,\n");
    out.push_str("    }\n");
    out.push_str("}\n");
    out
}

fn render_rust_runtime_registry(apps: &[RuntimeAppMeta]) -> String {
    let mut out = String::new();
    out.push_str("pub struct GeneratedRuntimeLookupEntry {\n");
    out.push_str("    pub id: &'static str,\n");
    out.push_str("    pub asset: &'static crate::GeneratedRuntimeApp,\n");
    out.push_str("}\n\n");

    for app in apps {
        let upper = upper_ident(&app.id);
        let outputs_ident = format!("{upper}_OUTPUTS");
        writeln!(
            out,
            "pub static {outputs_ident}: &[crate::GeneratedRuntimeOutput] = &["
        )
        .unwrap();
        for output in &app.outputs {
            let target_variant = cli_target_variant(&output.target);
            let path = escape_str(&output.path);
            writeln!(out, "    crate::GeneratedRuntimeOutput {{ target: crate::KainCliTarget::{target_variant}, path: \"{path}\" }},").unwrap();
        }
        out.push_str("];\n");
        let runtime_variant = runtime_kind_variant(&app.runtime_kind);
        let host_variant = host_kind_variant(&app.host_kind);
        let id = escape_str(&app.id);
        let label = escape_str(&app.label);
        let source_path = escape_str(&app.source_path);
        let namespace = escape_str(&app.namespace);
        writeln!(
            out,
            "pub static {upper}: crate::GeneratedRuntimeApp = crate::GeneratedRuntimeApp {{"
        )
        .unwrap();
        writeln!(out, "    id: \"{id}\",").unwrap();
        writeln!(out, "    label: \"{label}\",").unwrap();
        writeln!(out, "    source_path: \"{source_path}\",").unwrap();
        writeln!(
            out,
            "    runtime_kind: crate::KainRuntimeKind::{runtime_variant},"
        )
        .unwrap();
        writeln!(out, "    host_kind: crate::KainHostKind::{host_variant},").unwrap();
        writeln!(out, "    namespace: \"{namespace}\",").unwrap();
        writeln!(out, "    outputs: {outputs_ident},").unwrap();
        writeln!(out, "}};").unwrap();
        out.push('\n');
    }

    out.push_str("pub static ASSETS: &[&crate::GeneratedRuntimeApp] = &[\n");
    for app in apps {
        let upper = upper_ident(&app.id);
        writeln!(out, "    &{upper},").unwrap();
    }
    out.push_str("];\n\n");
    out.push_str(
        "pub fn assets() -> &'static [&'static crate::GeneratedRuntimeApp] { ASSETS }\n\n",
    );

    out.push_str("pub static ALL: &[GeneratedRuntimeLookupEntry] = &[\n");
    for app in apps {
        let upper = upper_ident(&app.id);
        let id = escape_str(&app.id);
        writeln!(
            out,
            "    GeneratedRuntimeLookupEntry {{ id: \"{id}\", asset: &{upper} }},"
        )
        .unwrap();
    }
    out.push_str("];\n\n");
    out.push_str("pub fn all() -> &'static [GeneratedRuntimeLookupEntry] { ALL }\n\n");
    out.push_str("pub fn by_id(id: &str) -> Option<&'static crate::GeneratedRuntimeApp> {\n");
    out.push_str("    match id {\n");
    for app in apps {
        let upper = upper_ident(&app.id);
        let id = escape_str(&app.id);
        writeln!(out, "        \"{id}\" => Some(&{upper}),").unwrap();
    }
    out.push_str("        _ => None,\n");
    out.push_str("    }\n");
    out.push_str("}\n");
    out
}

fn render_ts_spv_registry(assets: &[AssetMeta]) -> String {
    let mut out = String::new();
    let mut domains = assets
        .iter()
        .map(|asset| asset.domain.clone())
        .collect::<Vec<_>>();
    domains.sort();
    domains.dedup();
    let domain_union = if domains.is_empty() {
        "string".to_string()
    } else {
        domains
            .iter()
            .map(|domain| format!("'{}'", escape_single_quote(domain)))
            .collect::<Vec<_>>()
            .join(" | ")
    };
    writeln!(out, "export type KainGeneratedDomain = {};\n", domain_union).unwrap();
    out.push_str("export interface GeneratedSpirvAssetMeta {\n");
    out.push_str("  id: string;\n");
    out.push_str("  label: string;\n");
    out.push_str("  domain: KainGeneratedDomain;\n");
    out.push_str("  sourcePath: string;\n");
    out.push_str("  compiledPath: string;\n");
    out.push_str("}\n\n");
    out.push_str(
        "export const GENERATED_SPIRV_ASSETS: ReadonlyArray<GeneratedSpirvAssetMeta> = [\n",
    );
    for asset in assets {
        writeln!(
            out,
            "  {{ id: '{}', label: '{}', domain: '{}', sourcePath: '{}', compiledPath: '{}' }},",
            escape_single_quote(&asset.id),
            escape_single_quote(&asset.label),
            escape_single_quote(&asset.domain),
            escape_single_quote(&asset.source_path),
            escape_single_quote(&asset.compiled_path),
        )
        .unwrap();
    }
    out.push_str("] as const;\n\n");
    out.push_str("export const GENERATED_SPIRV_BY_ID: Readonly<Record<string, GeneratedSpirvAssetMeta>> = Object.fromEntries(\n");
    out.push_str("  GENERATED_SPIRV_ASSETS.map((asset) => [asset.id, asset]),\n");
    out.push_str(") as Readonly<Record<string, GeneratedSpirvAssetMeta>>;\n");
    out
}

fn render_ts_runtime_registry(apps: &[RuntimeAppMeta]) -> String {
    let mut out = String::new();
    out.push_str(
        "export type KainGeneratedRuntimeTarget = 'wasm' | 'llvm' | 'spirv' | 'js' | 'ts' | 'ks' | 'hybrid' | 'rust' | 'cpp' | 'run' | 'test' | 'hlsl' | 'usf' | 'ue5' | 'ue5editor';\n",
    );
    out.push_str("export type KainGeneratedRuntimeKind = 'tauri_frontend' | 'desktop_script' | 'compute_kernel' | 'hybrid_module' | 'native_ui_app' | 'viewport3d_app' | 'python_bridge' | 'node_bridge' | 'rust_crate_bridge' | 'c_abi_bridge' | 'omni_pipeline' | 'selfhost_harness';\n");
    out.push_str(
        "export type KainGeneratedHostKind = 'tauri' | 'webview' | 'wasm_runtime' | 'hybrid' | 'native_runtime' | 'python' | 'node' | 'rust_host' | 'c_abi' | 'ue5' | 'cli';\n\n",
    );
    out.push_str("export interface GeneratedRuntimeOutputMeta {\n");
    out.push_str("  target: KainGeneratedRuntimeTarget;\n");
    out.push_str("  path: string;\n");
    out.push_str("}\n\n");
    out.push_str("export interface GeneratedRuntimeAppMeta {\n");
    out.push_str("  id: string;\n");
    out.push_str("  label: string;\n");
    out.push_str("  sourcePath: string;\n");
    out.push_str("  runtimeKind: KainGeneratedRuntimeKind;\n");
    out.push_str("  hostKind: KainGeneratedHostKind;\n");
    out.push_str("  namespace: string;\n");
    out.push_str("  outputs: ReadonlyArray<GeneratedRuntimeOutputMeta>;\n");
    out.push_str("}\n\n");
    out.push_str(
        "export const GENERATED_RUNTIME_APPS: ReadonlyArray<GeneratedRuntimeAppMeta> = [\n",
    );
    for app in apps {
        let outputs = app
            .outputs
            .iter()
            .map(|output| {
                format!(
                    "{{ target: '{}', path: '{}' }}",
                    escape_single_quote(&output.target),
                    escape_single_quote(&output.path)
                )
            })
            .collect::<Vec<_>>()
            .join(", ");
        writeln!(
            out,
            "  {{ id: '{}', label: '{}', sourcePath: '{}', runtimeKind: '{}', hostKind: '{}', namespace: '{}', outputs: [{}] }},",
            escape_single_quote(&app.id),
            escape_single_quote(&app.label),
            escape_single_quote(&app.source_path),
            escape_single_quote(&app.runtime_kind),
            escape_single_quote(&app.host_kind),
            escape_single_quote(&app.namespace),
            outputs,
        )
        .unwrap();
    }
    out.push_str("] as const;\n\n");
    out.push_str("export const GENERATED_RUNTIME_BY_ID: Readonly<Record<string, GeneratedRuntimeAppMeta>> = Object.fromEntries(\n");
    out.push_str("  GENERATED_RUNTIME_APPS.map((asset) => [asset.id, asset]),\n");
    out.push_str(") as Readonly<Record<string, GeneratedRuntimeAppMeta>>;\n");
    out
}

fn render_json_spv_registry(assets: &[AssetMeta]) -> String {
    let items: Vec<Value> = assets
        .iter()
        .map(|asset| {
            serde_json::json!({
                "id": asset.id,
                "label": asset.label,
                "domain": asset.domain,
                "source_path": asset.source_path,
                "compiled_path": asset.compiled_path,
            })
        })
        .collect();
    serde_json::to_string_pretty(&items).unwrap() + "\n"
}

fn render_json_runtime_registry(apps: &[RuntimeAppMeta]) -> String {
    let items: Vec<Value> = apps
        .iter()
        .map(|app| {
            serde_json::json!({
                "id": app.id,
                "label": app.label,
                "source_path": app.source_path,
                "runtime_kind": app.runtime_kind,
                "host_kind": app.host_kind,
                "namespace": app.namespace,
                "outputs": app.outputs.iter().map(|output| {
                    serde_json::json!({
                        "target": output.target,
                        "path": output.path,
                    })
                }).collect::<Vec<_>>(),
            })
        })
        .collect();
    serde_json::to_string_pretty(&items).unwrap() + "\n"
}

fn write_if_changed(path: &Path, content: &str) -> std::io::Result<()> {
    match fs::read_to_string(path) {
        Ok(existing) if existing == content => Ok(()),
        _ => fs::write(path, content),
    }
}

fn title_case(value: &str) -> String {
    value
        .split('_')
        .filter(|part| !part.is_empty())
        .map(|part| {
            let mut chars = part.chars();
            match chars.next() {
                Some(first) => format!(
                    "{}{}",
                    first.to_ascii_uppercase(),
                    chars.as_str().to_ascii_lowercase()
                ),
                None => String::new(),
            }
        })
        .collect::<Vec<_>>()
        .join(" ")
}

fn upper_ident(value: &str) -> String {
    let mut out = String::new();
    for ch in value.chars() {
        if ch.is_ascii_alphanumeric() {
            out.push(ch.to_ascii_uppercase());
        } else {
            out.push('_');
        }
    }
    if out.is_empty() {
        out.push_str("ITEM");
    }
    if out.as_bytes()[0].is_ascii_digit() {
        out.insert(0, '_');
    }
    out
}

fn rust_ident(value: &str) -> String {
    let mut out = String::new();
    for ch in value.chars() {
        if ch.is_ascii_alphanumeric() {
            out.push(ch.to_ascii_lowercase());
        } else {
            out.push('_');
        }
    }
    if out.is_empty() {
        out.push_str("item");
    }
    if out.as_bytes()[0].is_ascii_digit() {
        out.insert(0, '_');
    }
    out
}

fn domain_variant(domain: &str) -> &'static str {
    match domain {
        "brush" => "Brush",
        "fluid" => "Fluid",
        "imports" => "Imports",
        "kainscript" => "Kainscript",
        "materials" => "Materials",
        "paint" => "Paint",
        "procedural" => "Procedural",
        "renderer" => "Renderer",
        "shader" => "Shader",
        "sculpting" => "Sculpting",
        "sculpting_engine" => "SculptingEngine",
        "supermotion" => "Supermotion",
        _ => panic!("unsupported domain in manifest: {domain}"),
    }
}

fn cli_target_variant(target: &str) -> &'static str {
    match target {
        "wasm" => "Wasm",
        "llvm" => "Llvm",
        "spirv" => "Spirv",
        "ts" => "Ts",
        "js" => "Js",
        "ks" => "Ks",
        "hybrid" => "Hybrid",
        "rust" => "Rust",
        "cpp" => "Cpp",
        "run" => "Run",
        "test" => "Test",
        "hlsl" => "Hlsl",
        "usf" => "Usf",
        "ue5" => "Ue5",
        "ue5editor" => "Ue5Editor",
        _ => panic!("unsupported CLI target in runtime manifest: {target}"),
    }
}

fn runtime_kind_variant(kind: &str) -> &'static str {
    match kind {
        "tauri_frontend" => "TauriFrontend",
        "desktop_script" => "DesktopScript",
        "compute_kernel" => "ComputeKernel",
        "hybrid_module" => "HybridModule",
        "native_ui_app" => "NativeUiApp",
        "viewport3d_app" => "Viewport3dApp",
        "python_bridge" => "PythonBridge",
        "node_bridge" => "NodeBridge",
        "rust_crate_bridge" => "RustCrateBridge",
        "c_abi_bridge" => "CAbiBridge",
        "omni_pipeline" => "OmniPipeline",
        "selfhost_harness" => "SelfhostHarness",
        _ => panic!("unsupported runtime kind in runtime manifest: {kind}"),
    }
}

fn host_kind_variant(kind: &str) -> &'static str {
    match kind {
        "tauri" => "Tauri",
        "webview" => "Webview",
        "wasm_runtime" => "WasmRuntime",
        "hybrid" => "Hybrid",
        "native_runtime" => "NativeRuntime",
        "python" => "Python",
        "node" => "Node",
        "rust_host" => "RustHost",
        "c_abi" => "CAbi",
        "ue5" => "Ue5",
        "cli" => "Cli",
        _ => panic!("unsupported host kind in runtime manifest: {kind}"),
    }
}

fn escape_str(value: &str) -> String {
    value.replace('\\', "\\\\").replace('"', "\\\"")
}

fn escape_single_quote(value: &str) -> String {
    value.replace('\\', "\\\\").replace('\'', "\\'")
}
