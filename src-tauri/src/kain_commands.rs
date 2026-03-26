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

use crate::kain_contract::{
    KainCliTarget, KainCompileResponse, KainHostKind as ContractKainHostKind,
    KainRegistryTargetKind, KainRunResponse, KainRuntimeKind as ContractKainRuntimeKind,
    KainRuntimeOutputRegistryEntry, KainRuntimeRegistryEntry, KainSourceDomain,
    KainSourceRegistryEntry,
};
use k_os_kain::{
    build_file, compile_source, list_runtime_apps, list_sources, run_source,
    KainCliTarget as NativeKainCliTarget, KainDomain, KainHostKind, KainRuntimeKind,
    KainTargetKind,
};
use std::path::{Path, PathBuf};

fn into_native_cli_target(target: KainCliTarget) -> NativeKainCliTarget {
    match target {
        KainCliTarget::Wasm => NativeKainCliTarget::Wasm,
        KainCliTarget::Spirv => NativeKainCliTarget::Spirv,
        KainCliTarget::Ts => NativeKainCliTarget::Ts,
        KainCliTarget::Js => NativeKainCliTarget::Js,
        KainCliTarget::Ks => NativeKainCliTarget::Ks,
        KainCliTarget::Hybrid => NativeKainCliTarget::Hybrid,
        KainCliTarget::Rust => NativeKainCliTarget::Rust,
        KainCliTarget::Cpp => NativeKainCliTarget::Cpp,
        KainCliTarget::Run => NativeKainCliTarget::Run,
        KainCliTarget::Test => NativeKainCliTarget::Test,
        KainCliTarget::Hlsl => NativeKainCliTarget::Hlsl,
        KainCliTarget::Usf => NativeKainCliTarget::Usf,
    }
}

fn into_contract_domain(domain: KainDomain) -> KainSourceDomain {
    match domain {
        KainDomain::Fluid => KainSourceDomain::Fluid,
        KainDomain::Sculpting => KainSourceDomain::Sculpt,
        KainDomain::Supermotion => KainSourceDomain::Mocap,
        KainDomain::Paint => KainSourceDomain::Paint,
        KainDomain::Renderer => KainSourceDomain::Renderer,
        KainDomain::Materials => KainSourceDomain::Materials,
        KainDomain::Imports => KainSourceDomain::Imports,
        KainDomain::SculptingEngine => KainSourceDomain::SculptingEngine,
        KainDomain::Brush => KainSourceDomain::Brush,
        KainDomain::Shader => KainSourceDomain::Shader,
        KainDomain::Procedural => KainSourceDomain::Procedural,
        KainDomain::Kainscript => KainSourceDomain::Kainscript,
    }
}

fn into_contract_registry_target(target: KainTargetKind) -> KainRegistryTargetKind {
    match target {
        KainTargetKind::Spirv => KainRegistryTargetKind::Spirv,
        KainTargetKind::Source => KainRegistryTargetKind::Source,
    }
}

fn into_contract_runtime_kind(kind: KainRuntimeKind) -> ContractKainRuntimeKind {
    match kind {
        KainRuntimeKind::TauriFrontend => ContractKainRuntimeKind::TauriFrontend,
        KainRuntimeKind::DesktopScript => ContractKainRuntimeKind::DesktopScript,
        KainRuntimeKind::ComputeKernel => ContractKainRuntimeKind::ComputeKernel,
        KainRuntimeKind::HybridModule => ContractKainRuntimeKind::HybridModule,
    }
}

fn into_contract_host_kind(kind: KainHostKind) -> ContractKainHostKind {
    match kind {
        KainHostKind::Tauri => ContractKainHostKind::Tauri,
        KainHostKind::Webview => ContractKainHostKind::Webview,
        KainHostKind::WasmRuntime => ContractKainHostKind::WasmRuntime,
        KainHostKind::Hybrid => ContractKainHostKind::Hybrid,
    }
}

fn into_contract_cli_target(target: &str) -> Result<KainCliTarget, String> {
    match NativeKainCliTarget::try_from(target) {
        Ok(native_target) => Ok(match native_target {
            NativeKainCliTarget::Wasm => KainCliTarget::Wasm,
            NativeKainCliTarget::Spirv => KainCliTarget::Spirv,
            NativeKainCliTarget::Ts => KainCliTarget::Ts,
            NativeKainCliTarget::Js => KainCliTarget::Js,
            NativeKainCliTarget::Ks => KainCliTarget::Ks,
            NativeKainCliTarget::Hybrid => KainCliTarget::Hybrid,
            NativeKainCliTarget::Rust => KainCliTarget::Rust,
            NativeKainCliTarget::Cpp => KainCliTarget::Cpp,
            NativeKainCliTarget::Run => KainCliTarget::Run,
            NativeKainCliTarget::Test => KainCliTarget::Test,
            NativeKainCliTarget::Hlsl => KainCliTarget::Hlsl,
            NativeKainCliTarget::Usf => KainCliTarget::Usf,
        }),
        Err(error) => Err(error.to_string()),
    }
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
    target: KainCliTarget,
    output_name: String,
    verbose: bool,
    strict: bool,
) -> Result<KainCompileResponse, String> {
    let result = compile_source(
        source,
        into_native_cli_target(target),
        output_name,
        verbose,
        strict,
    )
    .map_err(|e| e.to_string())?;
    Ok(KainCompileResponse {
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
pub async fn kain_run(source: String, verbose: bool) -> Result<KainRunResponse, String> {
    let result = run_source(source, verbose).map_err(|e| e.to_string())?;
    Ok(KainRunResponse {
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
    target: KainCliTarget,
    output: Option<String>,
) -> Result<KainCompileResponse, String> {
    let result =
        build_file(path, into_native_cli_target(target), output).map_err(|e| e.to_string())?;
    Ok(KainCompileResponse {
        success: result.success,
        output: result.output,
        output_path: result.output_path,
        errors: result.errors,
        duration_ms: result.duration_ms,
    })
}

/// List KAIN sources from the native registry crate.
#[tauri::command]
pub async fn kain_list_sources() -> Result<Vec<KainSourceRegistryEntry>, String> {
    let sources = list_sources()
        .iter()
        .map(|entry| KainSourceRegistryEntry {
            id: entry.id.to_string(),
            label: entry.label.to_string(),
            domain: into_contract_domain(entry.domain),
            source_path: entry.source_path.to_string(),
            compiled_path: entry.compiled_path.clone(),
            target: into_contract_registry_target(entry.target),
        })
        .collect();

    Ok(sources)
}

#[tauri::command]
pub async fn kain_list_runtime_apps() -> Result<Vec<KainRuntimeRegistryEntry>, String> {
    let apps = list_runtime_apps()
        .iter()
        .map(|entry| KainRuntimeRegistryEntry {
            id: entry.id.to_string(),
            label: entry.label.to_string(),
            source_path: entry.source_path.to_string(),
            runtime_kind: into_contract_runtime_kind(entry.runtime_kind),
            host_kind: into_contract_host_kind(entry.host_kind),
            namespace: entry.namespace.to_string(),
            outputs: entry
                .outputs
                .iter()
                .map(|output| KainRuntimeOutputRegistryEntry {
                    target: into_contract_cli_target(output.target.as_str())
                        .expect("runtime manifest target should always be valid"),
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
