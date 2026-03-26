//! kain_commands.rs — KAIN Language Runtime Tauri Commands
//!
//! Bridges the KAIN compiler/interpreter to the K-OS frontend.
//!
//! Exposes three commands:
//!   - `kain_compile`    — compile .kn source to a target (spirv/wasm/ts/rust/cpp)
//!   - `kain_run`        — execute .kn source in the KAIN interpreter
//!   - `kain_build_file` — rebuild an existing .kn file from the K-OS source tree
//!
//! All commands shell out to the `kain` CLI which must be on PATH.
//! The CLI is the same KAIN v0.1.0 binary already powering the existing
//! sculpt brush GPU shaders and FluidDynamics.kn.

use k_os_kain::{
    build_file, compile_source, list_runtime_apps, list_sources, run_source, KainCliTarget,
    KainDomain, KainHostKind, KainRuntimeKind, KainTargetKind,
};
use serde::Serialize;
use std::path::{Path, PathBuf};

// ─── Response types (mirror TypeScript interfaces in KAINBridge.ts) ───────────

#[derive(Debug, Serialize)]
pub struct KAINCompileResponse {
    pub success: bool,
    pub output: Option<String>,
    pub output_path: Option<String>,
    pub errors: Option<String>,
    pub duration_ms: f64,
}

#[derive(Debug, Serialize)]
pub struct KAINRunResponse {
    pub success: bool,
    pub stdout: String,
    pub stderr: String,
    pub exit_code: i32,
}

#[derive(Debug, Serialize)]
pub struct KAINSourceRegistryEntry {
    pub id: String,
    pub label: String,
    pub domain: String,
    pub source_path: String,
    pub compiled_path: Option<String>,
    pub target: String,
}

#[derive(Debug, Serialize)]
pub struct KAINRuntimeOutputRegistryEntry {
    pub target: String,
    pub path: String,
}

#[derive(Debug, Serialize)]
pub struct KAINRuntimeRegistryEntry {
    pub id: String,
    pub label: String,
    pub source_path: String,
    pub runtime_kind: String,
    pub host_kind: String,
    pub namespace: String,
    pub outputs: Vec<KAINRuntimeOutputRegistryEntry>,
}

// ─── Target validation ────────────────────────────────────────────────────────

fn validate_target(target: &str) -> Result<(), String> {
    KainCliTarget::try_from(target)
        .map(|_| ())
        .map_err(|e| e.to_string())
}

// ─── Tauri Commands ───────────────────────────────────────────────────────────

/// Compile KAIN source text to a specified target.
///
/// Writes source to a temp file, invokes `kain build`, captures output.
/// For text targets (ts/js/rust/cpp): returns the compiled source in `output`.
/// For binary targets (wasm/spirv): returns base64-encoded bytes in `output`.
#[tauri::command]
pub async fn kain_compile(
    source: String,
    target: String,
    output_name: String,
    verbose: bool,
    strict: bool,
) -> Result<KAINCompileResponse, String> {
    let target = KainCliTarget::try_from(target.as_str()).map_err(|e| e.to_string())?;
    let result =
        compile_source(source, target, output_name, verbose, strict).map_err(|e| e.to_string())?;
    Ok(KAINCompileResponse {
        success: result.success,
        output: result.output,
        output_path: result.output_path,
        errors: result.errors,
        duration_ms: result.duration_ms,
    })
}

/// Run KAIN source in the interpreter (`kain run`).
/// Returns stdout and stderr separately.
#[tauri::command]
pub async fn kain_run(source: String, verbose: bool) -> Result<KAINRunResponse, String> {
    let result = run_source(source, verbose).map_err(|e| e.to_string())?;
    Ok(KAINRunResponse {
        success: result.success,
        stdout: result.stdout,
        stderr: result.stderr,
        exit_code: result.exit_code,
    })
}

/// Rebuild an existing .kn file from the K-OS source tree.
/// `path` is relative to the K-OS workspace root.
/// Used by the KAIN Source Registry browser for GPU brush hot-reload.
#[tauri::command]
pub async fn kain_build_file(
    path: String,
    target: String,
    output: Option<String>,
) -> Result<KAINCompileResponse, String> {
    let target = KainCliTarget::try_from(target.as_str()).map_err(|e| e.to_string())?;
    let result = build_file(path, target, output).map_err(|e| e.to_string())?;
    Ok(KAINCompileResponse {
        success: result.success,
        output: result.output,
        output_path: result.output_path,
        errors: result.errors,
        duration_ms: result.duration_ms,
    })
}

/// List KAIN sources from the native registry crate.
#[tauri::command]
pub async fn kain_list_sources() -> Result<Vec<KAINSourceRegistryEntry>, String> {
    let sources = list_sources()
        .iter()
        .map(|entry| KAINSourceRegistryEntry {
            id: entry.id.to_string(),
            label: entry.label.to_string(),
            domain: match entry.domain {
                KainDomain::Fluid => "fluid".to_string(),
                KainDomain::Sculpting => "sculpt".to_string(),
                KainDomain::Supermotion => "mocap".to_string(),
                KainDomain::Paint => "paint".to_string(),
                KainDomain::Renderer => "renderer".to_string(),
                KainDomain::Materials => "materials".to_string(),
                KainDomain::Imports => "imports".to_string(),
                KainDomain::SculptingEngine => "sculpting_engine".to_string(),
                KainDomain::Brush => "brush".to_string(),
                KainDomain::Shader => "shader".to_string(),
                KainDomain::Procedural => "procedural".to_string(),
                KainDomain::Kainscript => "kainscript".to_string(),
            },
            source_path: entry.source_path.to_string(),
            compiled_path: entry.compiled_path.clone(),
            target: match entry.target {
                KainTargetKind::Spirv => "spirv".to_string(),
                KainTargetKind::Source => "source".to_string(),
            },
        })
        .collect();

    Ok(sources)
}

#[tauri::command]
pub async fn kain_list_runtime_apps() -> Result<Vec<KAINRuntimeRegistryEntry>, String> {
    let apps = list_runtime_apps()
        .iter()
        .map(|entry| KAINRuntimeRegistryEntry {
            id: entry.id.to_string(),
            label: entry.label.to_string(),
            source_path: entry.source_path.to_string(),
            runtime_kind: match entry.runtime_kind {
                KainRuntimeKind::TauriFrontend => "tauri_frontend".to_string(),
                KainRuntimeKind::DesktopScript => "desktop_script".to_string(),
                KainRuntimeKind::ComputeKernel => "compute_kernel".to_string(),
                KainRuntimeKind::HybridModule => "hybrid_module".to_string(),
            },
            host_kind: match entry.host_kind {
                KainHostKind::Tauri => "tauri".to_string(),
                KainHostKind::Webview => "webview".to_string(),
                KainHostKind::WasmRuntime => "wasm_runtime".to_string(),
                KainHostKind::Hybrid => "hybrid".to_string(),
            },
            namespace: entry.namespace.to_string(),
            outputs: entry
                .outputs
                .iter()
                .map(|output| KAINRuntimeOutputRegistryEntry {
                    target: output.target.as_str().to_string(),
                    path: output.path.to_string(),
                })
                .collect(),
        })
        .collect();

    Ok(apps)
}

#[tauri::command]
pub async fn kain_read_source(path: String) -> Result<String, String> {
    let workspace = k_os_kain::workspace_root();
    let full_path = workspace.join(&path);
    std::fs::read_to_string(&full_path).map_err(|e| {
        format!(
            "Failed to read KAIN source '{}': {}",
            full_path.display(),
            e
        )
    })
}

#[tauri::command]
pub async fn kain_write_source(path: String, source: String) -> Result<(), String> {
    let workspace = k_os_kain::workspace_root();
    let full_path = workspace.join(&path);
    if let Some(parent) = full_path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| {
            format!(
                "Failed to create KAIN source directory '{}': {}",
                parent.display(),
                e
            )
        })?;
    }
    std::fs::write(&full_path, source).map_err(|e| {
        format!(
            "Failed to write KAIN source '{}': {}",
            full_path.display(),
            e
        )
    })
}
