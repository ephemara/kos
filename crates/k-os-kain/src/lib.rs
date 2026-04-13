use once_cell::sync::OnceCell;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::time::Instant;
use thiserror::Error;

const SOURCE_MANIFEST_PATH: &str = "crates/k-os-kain/manifests/sources.json";
const RUNTIME_APP_MANIFEST_PATH: &str = "crates/k-os-kain/manifests/runtime_apps.json";
const UPSTREAM_CAPABILITY_MANIFEST_PATH: &str =
    "crates/k-os-kain/manifests/upstream_capabilities.json";

#[derive(Debug, Clone, Copy)]
pub struct GeneratedSpirvAsset {
    pub id: &'static str,
    pub label: &'static str,
    pub domain: KainDomain,
    pub source_path: &'static str,
    pub compiled_path: &'static str,
    pub bytes: &'static [u8],
}

#[derive(Debug, Clone, Copy)]
pub struct GeneratedRuntimeOutput {
    pub target: KainCliTarget,
    pub path: &'static str,
}

#[derive(Debug, Clone, Copy)]
pub struct GeneratedRuntimeApp {
    pub id: &'static str,
    pub label: &'static str,
    pub source_path: &'static str,
    pub runtime_kind: KainRuntimeKind,
    pub host_kind: KainHostKind,
    pub namespace: &'static str,
    pub outputs: &'static [GeneratedRuntimeOutput],
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum KainDomain {
    Fluid,
    Brush,
    Shader,
    Procedural,
    Kainscript,
    Sculpting,
    #[serde(rename = "sculpting_engine")]
    SculptingEngine,
    Supermotion,
    Paint,
    Renderer,
    Materials,
    Imports,
}

impl KainDomain {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Fluid => "fluid",
            Self::Brush => "brush",
            Self::Shader => "shader",
            Self::Procedural => "procedural",
            Self::Kainscript => "kainscript",
            Self::Sculpting => "sculpting",
            Self::SculptingEngine => "sculpting_engine",
            Self::Supermotion => "supermotion",
            Self::Paint => "paint",
            Self::Renderer => "renderer",
            Self::Materials => "materials",
            Self::Imports => "imports",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum KainTargetKind {
    Spirv,
    Source,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum KainImportLanguage {
    C,
    Typescript,
    Cpp,
    Rust,
    Assembly,
}

impl KainImportLanguage {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::C => "c",
            Self::Typescript => "typescript",
            Self::Cpp => "cpp",
            Self::Rust => "rust",
            Self::Assembly => "assembly",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum KainRuntimeKind {
    TauriFrontend,
    DesktopScript,
    ComputeKernel,
    HybridModule,
    NativeUiApp,
    Viewport3dApp,
    PythonBridge,
    NodeBridge,
    RustCrateBridge,
    CAbiBridge,
    OmniPipeline,
    SelfhostHarness,
}

impl KainRuntimeKind {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::TauriFrontend => "tauri_frontend",
            Self::DesktopScript => "desktop_script",
            Self::ComputeKernel => "compute_kernel",
            Self::HybridModule => "hybrid_module",
            Self::NativeUiApp => "native_ui_app",
            Self::Viewport3dApp => "viewport3d_app",
            Self::PythonBridge => "python_bridge",
            Self::NodeBridge => "node_bridge",
            Self::RustCrateBridge => "rust_crate_bridge",
            Self::CAbiBridge => "c_abi_bridge",
            Self::OmniPipeline => "omni_pipeline",
            Self::SelfhostHarness => "selfhost_harness",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum KainHostKind {
    Tauri,
    Webview,
    WasmRuntime,
    Hybrid,
    NativeRuntime,
    Python,
    Node,
    RustHost,
    CAbi,
    Ue5,
    Cli,
}

impl KainHostKind {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Tauri => "tauri",
            Self::Webview => "webview",
            Self::WasmRuntime => "wasm_runtime",
            Self::Hybrid => "hybrid",
            Self::NativeRuntime => "native_runtime",
            Self::Python => "python",
            Self::Node => "node",
            Self::RustHost => "rust_host",
            Self::CAbi => "c_abi",
            Self::Ue5 => "ue5",
            Self::Cli => "cli",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum KainCliTarget {
    Wasm,
    Llvm,
    Spirv,
    Ts,
    Js,
    Ks,
    Hybrid,
    Rust,
    Cpp,
    Run,
    Test,
    Hlsl,
    Usf,
    Ue5,
    Ue5Editor,
}

impl KainCliTarget {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Wasm => "wasm",
            Self::Llvm => "llvm",
            Self::Spirv => "spirv",
            Self::Ts => "ts",
            Self::Js => "js",
            Self::Ks => "ks",
            Self::Hybrid => "hybrid",
            Self::Rust => "rust",
            Self::Cpp => "cpp",
            Self::Run => "run",
            Self::Test => "test",
            Self::Hlsl => "hlsl",
            Self::Usf => "usf",
            Self::Ue5 => "ue5",
            Self::Ue5Editor => "ue5editor",
        }
    }
}

impl TryFrom<&str> for KainCliTarget {
    type Error = KainError;

    fn try_from(value: &str) -> Result<Self, Self::Error> {
        Ok(match value {
            "wasm" => Self::Wasm,
            "llvm" => Self::Llvm,
            "spirv" => Self::Spirv,
            "ts" => Self::Ts,
            "js" => Self::Js,
            "ks" => Self::Ks,
            "hybrid" => Self::Hybrid,
            "rust" => Self::Rust,
            "cpp" => Self::Cpp,
            "run" => Self::Run,
            "test" => Self::Test,
            "hlsl" => Self::Hlsl,
            "usf" => Self::Usf,
            "ue5" => Self::Ue5,
            "ue5editor" => Self::Ue5Editor,
            _ => return Err(KainError::InvalidTarget(value.to_string())),
        })
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct KainSourceAsset {
    pub id: String,
    pub label: String,
    pub domain: KainDomain,
    pub source_path: String,
    pub compiled_path: Option<String>,
    pub target: KainTargetKind,
    #[serde(default)]
    pub import_language: Option<KainImportLanguage>,
    #[serde(default)]
    pub source_namespace: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct KainRuntimeAppOutput {
    pub target: KainCliTarget,
    pub path: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct KainRuntimeAppAsset {
    pub id: String,
    pub label: String,
    pub source_path: String,
    pub runtime_kind: KainRuntimeKind,
    pub host_kind: KainHostKind,
    pub namespace: String,
    pub outputs: Vec<KainRuntimeAppOutput>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum KainCapabilityCategory {
    LanguageFrontend,
    Codegen,
    Importer,
    RuntimeBridge,
    AppRuntime,
    Orchestration,
    GpuRuntime,
    Unreal,
    IntentSystem,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum KainIntegrationStatus {
    ActiveInKos,
    PartiallyAdopted,
    ModeledForAdoption,
    UpstreamOnly,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct KainUpstreamCapability {
    pub id: String,
    pub label: String,
    pub category: KainCapabilityCategory,
    pub integration_status: KainIntegrationStatus,
    pub summary: String,
    #[serde(default)]
    pub commands: Vec<String>,
    #[serde(default)]
    pub compile_targets: Vec<KainCliTarget>,
    #[serde(default)]
    pub runtime_kinds: Vec<KainRuntimeKind>,
    #[serde(default)]
    pub host_kinds: Vec<KainHostKind>,
    #[serde(default)]
    pub upstream_crates: Vec<String>,
    pub recommended_kos_next_step: String,
    #[serde(default)]
    pub notes: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct KainCompileOutput {
    pub success: bool,
    pub output: Option<String>,
    pub output_path: Option<String>,
    pub errors: Option<String>,
    pub duration_ms: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct KainRunOutput {
    pub success: bool,
    pub stdout: String,
    pub stderr: String,
    pub exit_code: i32,
}

#[derive(Debug)]
pub struct ValidationResult {
    pub shader_name: String,
    pub success: bool,
    pub entry_points: Vec<String>,
    pub error: Option<String>,
    pub file_size: u64,
}

#[derive(Debug, Error)]
pub enum KainError {
    #[error("invalid KAIN target: {0}")]
    InvalidTarget(String),
    #[error("failed to write temp source: {0}")]
    TempSourceWrite(String),
    #[error("failed to spawn kain: {0}")]
    Spawn(String),
    #[error("failed to wait on kain: {0}")]
    Wait(String),
    #[error("KAIN source not found: {0}")]
    SourceNotFound(String),
    #[error("failed to load KAIN manifest: {0}")]
    Manifest(String),
}

static SOURCE_REGISTRY: OnceCell<Vec<KainSourceAsset>> = OnceCell::new();
static RUNTIME_APP_REGISTRY: OnceCell<Vec<KainRuntimeAppAsset>> = OnceCell::new();
static UPSTREAM_CAPABILITY_REGISTRY: OnceCell<Vec<KainUpstreamCapability>> = OnceCell::new();

pub fn list_sources() -> &'static [KainSourceAsset] {
    SOURCE_REGISTRY.get_or_init(load_manifest).as_slice()
}

pub fn list_runtime_apps() -> &'static [KainRuntimeAppAsset] {
    RUNTIME_APP_REGISTRY
        .get_or_init(load_runtime_manifest)
        .as_slice()
}

pub fn list_upstream_capabilities() -> &'static [KainUpstreamCapability] {
    UPSTREAM_CAPABILITY_REGISTRY
        .get_or_init(load_upstream_capability_manifest)
        .as_slice()
}

pub fn sources_for_domain(domain: KainDomain) -> Vec<&'static KainSourceAsset> {
    list_sources()
        .iter()
        .filter(|asset| asset.domain == domain)
        .collect()
}

pub fn runtime_app_by_id(id: &str) -> Option<&'static KainRuntimeAppAsset> {
    list_runtime_apps().iter().find(|asset| asset.id == id)
}

pub fn runtime_apps_for_kind(kind: KainRuntimeKind) -> Vec<&'static KainRuntimeAppAsset> {
    list_runtime_apps()
        .iter()
        .filter(|asset| asset.runtime_kind == kind)
        .collect()
}

pub fn runtime_apps_for_host(host: KainHostKind) -> Vec<&'static KainRuntimeAppAsset> {
    list_runtime_apps()
        .iter()
        .filter(|asset| asset.host_kind == host)
        .collect()
}

pub fn upstream_capability_by_id(id: &str) -> Option<&'static KainUpstreamCapability> {
    list_upstream_capabilities()
        .iter()
        .find(|capability| capability.id == id)
}

pub fn upstream_capabilities_for_category(
    category: KainCapabilityCategory,
) -> Vec<&'static KainUpstreamCapability> {
    list_upstream_capabilities()
        .iter()
        .filter(|capability| capability.category == category)
        .collect()
}

pub fn upstream_capabilities_for_status(
    status: KainIntegrationStatus,
) -> Vec<&'static KainUpstreamCapability> {
    list_upstream_capabilities()
        .iter()
        .filter(|capability| capability.integration_status == status)
        .collect()
}

pub fn workspace_root() -> PathBuf {
    if let Ok(path) = std::env::var("KAIN_WORKSPACE_ROOT") {
        let trimmed = path.trim();
        if !trimmed.is_empty() {
            let candidate = PathBuf::from(trimmed);
            if candidate.exists() {
                return candidate;
            }
        }
    }

    find_workspace_root(Path::new(env!("CARGO_MANIFEST_DIR"))).unwrap_or_else(|| {
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("..")
            .join("..")
    })
}

pub fn domain_dir(domain: KainDomain) -> PathBuf {
    workspace_root()
        .join("crates")
        .join("k-os-kain")
        .join("domains")
        .join(domain.as_str())
}

pub fn imports_dir() -> PathBuf {
    workspace_root()
        .join("crates")
        .join("k-os-kain")
        .join("imports")
}

pub fn imports_language_dir(language: KainImportLanguage) -> PathBuf {
    imports_dir().join(language.as_str())
}

pub fn generated_dir() -> PathBuf {
    workspace_root()
        .join("crates")
        .join("k-os-kain")
        .join("generated")
}

pub fn generated_runtime_root() -> PathBuf {
    generated_dir().join("runtime")
}

pub fn generated_runtime_target_dir(target: KainCliTarget) -> PathBuf {
    generated_runtime_root().join(target.as_str())
}

pub fn generated_spv_root() -> PathBuf {
    generated_dir().join("spv")
}

pub fn generated_spv_dir(domain: KainDomain) -> PathBuf {
    generated_spv_root().join(domain.as_str())
}

pub fn generated_ts_registry_path() -> PathBuf {
    generated_dir().join("ts").join("spv_registry.ts")
}

pub fn generated_json_registry_path() -> PathBuf {
    generated_dir().join("json").join("spv_registry.json")
}

pub fn generated_runtime_ts_registry_path() -> PathBuf {
    generated_dir().join("ts").join("runtime_registry.ts")
}

pub fn generated_runtime_json_registry_path() -> PathBuf {
    generated_dir().join("json").join("runtime_registry.json")
}

pub fn fabric_dir() -> PathBuf {
    workspace_root()
        .join("crates")
        .join("k-os-kain")
        .join("fabric")
}

pub fn fabric_workspace_dir(workspace_name: &str) -> PathBuf {
    fabric_dir().join(workspace_name)
}

pub fn zen_dcc_fabric_dir() -> PathBuf {
    fabric_workspace_dir("zen-dcc")
}

pub fn zen_dcc_fabric_manifest_path() -> PathBuf {
    zen_dcc_fabric_dir().join("KAIN.fabric.toml")
}

pub fn zen_dcc_fabric_intent_registry_path() -> PathBuf {
    zen_dcc_fabric_dir()
        .join("config")
        .join("fabric_intents.json")
}

pub fn manifest_path() -> PathBuf {
    workspace_root().join(SOURCE_MANIFEST_PATH)
}

pub fn runtime_manifest_path() -> PathBuf {
    workspace_root().join(RUNTIME_APP_MANIFEST_PATH)
}

pub fn upstream_capability_manifest_path() -> PathBuf {
    workspace_root().join(UPSTREAM_CAPABILITY_MANIFEST_PATH)
}

pub fn src_kain_dir() -> PathBuf {
    workspace_root().join("sources/kain")
}

pub fn src_kain_apps_dir() -> PathBuf {
    src_kain_dir().join("apps")
}

pub fn src_kain_scripts_dir() -> PathBuf {
    src_kain_dir().join("scripts")
}

pub fn src_kain_kernels_dir() -> PathBuf {
    src_kain_dir().join("kernels")
}

pub fn src_kain_hybrid_dir() -> PathBuf {
    src_kain_dir().join("hybrid")
}

pub fn compile_source(
    source: String,
    target: KainCliTarget,
    output_name: String,
    verbose: bool,
    strict: bool,
) -> Result<KainCompileOutput, KainError> {
    let start = Instant::now();
    let tmp_dir = std::env::temp_dir();
    let src_path = tmp_dir.join(format!("kain_tmp_{}.kn", std::process::id()));
    let ext = match target {
        KainCliTarget::Wasm => "wasm",
        KainCliTarget::Llvm => "ll",
        KainCliTarget::Spirv => "spv",
        KainCliTarget::Ts => "ts",
        KainCliTarget::Js => "js",
        KainCliTarget::Ks => "ks",
        KainCliTarget::Hybrid => "hybrid",
        KainCliTarget::Rust => "rs",
        KainCliTarget::Cpp => "cpp",
        KainCliTarget::Hlsl => "hlsl",
        KainCliTarget::Usf => "usf",
        KainCliTarget::Ue5 | KainCliTarget::Ue5Editor => "out",
        _ => "out",
    };
    let out_path = tmp_dir.join(format!("{}_{}.{}", output_name, std::process::id(), ext));

    fs::write(&src_path, &source).map_err(|e| KainError::TempSourceWrite(e.to_string()))?;

    let mut cmd = Command::new(resolve_cli_bin());
    cmd.arg("build")
        .arg(&src_path)
        .arg("-t")
        .arg(target.as_str())
        .arg("-o")
        .arg(&out_path);

    if verbose {
        cmd.arg("-v");
    }
    if strict {
        cmd.arg("--strict");
    }

    cmd.stdout(Stdio::piped()).stderr(Stdio::piped());
    let out = cmd
        .spawn()
        .map_err(|e| KainError::Spawn(e.to_string()))?
        .wait_with_output()
        .map_err(|e| KainError::Wait(e.to_string()))?;

    let duration_ms = start.elapsed().as_secs_f64() * 1000.0;
    let success = out.status.success();
    let stderr_str = String::from_utf8_lossy(&out.stderr).to_string();

    let _ = fs::remove_file(&src_path);

    if success {
        let output = match target {
            KainCliTarget::Llvm
            | KainCliTarget::Ts
            | KainCliTarget::Js
            | KainCliTarget::Ks
            | KainCliTarget::Hybrid
            | KainCliTarget::Rust
            | KainCliTarget::Cpp => fs::read_to_string(&out_path)
                .ok()
                .or_else(|| String::from_utf8(out.stdout.clone()).ok()),
            _ => fs::read(&out_path).ok().map(|bytes| base64_encode(&bytes)),
        };

        let output_path = if out_path.exists() {
            Some(out_path.to_string_lossy().to_string())
        } else {
            None
        };

        Ok(KainCompileOutput {
            success: true,
            output,
            output_path,
            errors: if stderr_str.is_empty() {
                None
            } else {
                Some(stderr_str)
            },
            duration_ms,
        })
    } else {
        let _ = fs::remove_file(&out_path);
        Ok(KainCompileOutput {
            success: false,
            output: None,
            output_path: None,
            errors: Some(stderr_str),
            duration_ms,
        })
    }
}

pub fn run_source(source: String, verbose: bool) -> Result<KainRunOutput, KainError> {
    let tmp_dir = std::env::temp_dir();
    let src_path = tmp_dir.join(format!("kain_run_{}.kn", std::process::id()));
    fs::write(&src_path, &source).map_err(|e| KainError::TempSourceWrite(e.to_string()))?;

    let mut cmd = Command::new(resolve_cli_bin());
    cmd.arg("run").arg(&src_path);
    if verbose {
        cmd.arg("-v");
    }
    cmd.stdout(Stdio::piped()).stderr(Stdio::piped());

    let out = cmd
        .spawn()
        .map_err(|e| KainError::Spawn(e.to_string()))?
        .wait_with_output()
        .map_err(|e| KainError::Wait(e.to_string()))?;

    let _ = fs::remove_file(&src_path);

    Ok(KainRunOutput {
        success: out.status.success(),
        stdout: String::from_utf8_lossy(&out.stdout).to_string(),
        stderr: String::from_utf8_lossy(&out.stderr).to_string(),
        exit_code: out.status.code().unwrap_or(-1),
    })
}

pub fn build_file(
    path: String,
    target: KainCliTarget,
    output: Option<String>,
) -> Result<KainCompileOutput, KainError> {
    let start = Instant::now();
    let workspace = workspace_root();
    let src_path = workspace.join(&path);

    if !src_path.exists() {
        return Err(KainError::SourceNotFound(src_path.display().to_string()));
    }

    let mut cmd = Command::new(resolve_cli_bin());
    cmd.arg("build")
        .arg(&src_path)
        .arg("-t")
        .arg(target.as_str());

    if let Some(ref out) = output {
        let out_path = if Path::new(out).is_absolute() {
            PathBuf::from(out)
        } else {
            workspace.join(out)
        };
        cmd.arg("-o").arg(out_path);
    }

    cmd.stdout(Stdio::piped()).stderr(Stdio::piped());
    let result = cmd
        .spawn()
        .map_err(|e| KainError::Spawn(e.to_string()))?
        .wait_with_output()
        .map_err(|e| KainError::Wait(e.to_string()))?;

    let duration_ms = start.elapsed().as_secs_f64() * 1000.0;
    let success = result.status.success();
    let stderr_str = String::from_utf8_lossy(&result.stderr).to_string();

    Ok(KainCompileOutput {
        success,
        output: if success {
            Some(String::from_utf8_lossy(&result.stdout).to_string())
        } else {
            None
        },
        output_path: output,
        errors: if !success || !stderr_str.is_empty() {
            Some(stderr_str)
        } else {
            None
        },
        duration_ms,
    })
}

pub fn validate_spirv_file(path: &Path) -> ValidationResult {
    let shader_name = path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unknown")
        .to_string();

    let bytes = match fs::read(path) {
        Ok(b) => b,
        Err(e) => {
            return ValidationResult {
                shader_name,
                success: false,
                entry_points: vec![],
                error: Some(format!("Failed to read file: {}", e)),
                file_size: 0,
            };
        }
    };

    let file_size = bytes.len() as u64;
    let options = naga::front::spv::Options::default();
    let module = match naga::front::spv::parse_u8_slice(&bytes, &options) {
        Ok(m) => m,
        Err(e) => {
            return ValidationResult {
                shader_name,
                success: false,
                entry_points: vec![],
                error: Some(format!("SPIR-V parse error: {:?}", e)),
                file_size,
            };
        }
    };

    let entry_points: Vec<String> = module
        .entry_points
        .iter()
        .map(|ep| ep.name.clone())
        .collect();

    if entry_points.is_empty() {
        return ValidationResult {
            shader_name,
            success: false,
            entry_points: vec![],
            error: Some("No entry points found in shader".to_string()),
            file_size,
        };
    }

    ValidationResult {
        shader_name,
        success: true,
        entry_points,
        error: None,
        file_size,
    }
}

pub fn validate_all_shaders_in_dir(dir: &Path) -> Vec<ValidationResult> {
    let mut results = Vec::new();
    if let Ok(entries) = fs::read_dir(dir) {
        let mut files: Vec<PathBuf> = entries
            .flatten()
            .map(|entry| entry.path())
            .filter(|path| path.extension().and_then(|ext| ext.to_str()) == Some("spv"))
            .collect();
        files.sort();
        for path in files {
            results.push(validate_spirv_file(&path));
        }
    }
    results
}

pub fn validate_all_shaders_for_domain(domain: KainDomain) -> Vec<ValidationResult> {
    validate_all_shaders_in_dir(&generated_spv_dir(domain))
}

pub mod generated {
    pub mod spv {
        include!(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/generated/rust/spv_registry.rs"
        ));
    }

    pub mod runtime {
        include!(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/generated/rust/runtime_registry.rs"
        ));
    }
}

pub fn generated_spirv_assets() -> &'static [&'static GeneratedSpirvAsset] {
    generated::spv::assets()
}

pub fn generated_spirv_by_id(id: &str) -> Option<&'static GeneratedSpirvAsset> {
    generated::spv::by_id(id)
}

pub fn generated_spirv_for_domain(domain: KainDomain) -> Vec<&'static GeneratedSpirvAsset> {
    generated_spirv_assets()
        .iter()
        .copied()
        .filter(|asset| asset.domain == domain)
        .collect()
}

pub fn generated_runtime_apps() -> &'static [&'static GeneratedRuntimeApp] {
    generated::runtime::assets()
}

pub fn generated_runtime_app_by_id(id: &str) -> Option<&'static GeneratedRuntimeApp> {
    generated::runtime::by_id(id)
}

pub fn generated_runtime_apps_for_target(
    target: KainCliTarget,
) -> Vec<&'static GeneratedRuntimeApp> {
    generated_runtime_apps()
        .iter()
        .copied()
        .filter(|asset| asset.outputs.iter().any(|output| output.target == target))
        .collect()
}

pub fn imported_sources() -> Vec<&'static KainSourceAsset> {
    list_sources()
        .iter()
        .filter(|asset| asset.target == KainTargetKind::Source)
        .collect()
}

pub fn imported_sources_for_language(
    language: KainImportLanguage,
) -> Vec<&'static KainSourceAsset> {
    imported_sources()
        .into_iter()
        .filter(|asset| asset.import_language == Some(language))
        .collect()
}

pub fn print_validation_report(results: &[ValidationResult]) {
    println!("\n╔═══════════════════════════════════════════════════════════════╗");
    println!("║         KAIN SPIR-V Shader Validation Report                 ║");
    println!("╚═══════════════════════════════════════════════════════════════╝\n");

    let mut success_count = 0;
    let mut failure_count = 0;

    for result in results {
        if result.success {
            success_count += 1;
            println!("✓ {} - VALID", result.shader_name);
            println!("  Entry points: {:?}", result.entry_points);
            println!("  File size: {} bytes", result.file_size);
        } else {
            failure_count += 1;
            println!("✗ {} - FAILED", result.shader_name);
            if let Some(error) = &result.error {
                println!("  Error: {}", error);
            }
        }
        println!();
    }

    println!("─────────────────────────────────────────────────────────────");
    println!(
        "Summary: {} passed, {} failed, {} total",
        success_count,
        failure_count,
        results.len()
    );
    if failure_count == 0 {
        println!("🎉 All KAIN shaders are valid!");
    } else {
        println!("⚠️  {} shader(s) failed validation", failure_count);
    }
    println!("─────────────────────────────────────────────────────────────\n");
}

fn load_manifest() -> Vec<KainSourceAsset> {
    let manifest = manifest_path();
    let contents = fs::read_to_string(&manifest).unwrap_or_else(|err| {
        panic!(
            "Failed to load KAIN manifest '{}': {}",
            manifest.display(),
            err
        )
    });
    serde_json::from_str::<Vec<KainSourceAsset>>(&contents).unwrap_or_else(|err| {
        panic!(
            "Failed to parse KAIN manifest '{}': {}",
            manifest.display(),
            err
        )
    })
}

fn load_runtime_manifest() -> Vec<KainRuntimeAppAsset> {
    let manifest = runtime_manifest_path();
    let contents = fs::read_to_string(&manifest).unwrap_or_else(|err| {
        panic!(
            "Failed to load KAIN runtime manifest '{}': {}",
            manifest.display(),
            err
        )
    });
    serde_json::from_str::<Vec<KainRuntimeAppAsset>>(&contents).unwrap_or_else(|err| {
        panic!(
            "Failed to parse KAIN runtime manifest '{}': {}",
            manifest.display(),
            err
        )
    })
}

fn load_upstream_capability_manifest() -> Vec<KainUpstreamCapability> {
    let manifest = upstream_capability_manifest_path();
    let contents = fs::read_to_string(&manifest).unwrap_or_else(|err| {
        panic!(
            "Failed to load KAIN upstream capability manifest '{}': {}",
            manifest.display(),
            err
        )
    });
    serde_json::from_str::<Vec<KainUpstreamCapability>>(&contents).unwrap_or_else(|err| {
        panic!(
            "Failed to parse KAIN upstream capability manifest '{}': {}",
            manifest.display(),
            err
        )
    })
}

fn resolve_cli_bin() -> String {
    if let Ok(path) = std::env::var("KAIN_BIN_PATH") {
        if !path.trim().is_empty() {
            return path;
        }
    }
    "kain".to_string()
}

fn find_workspace_root(start: &Path) -> Option<PathBuf> {
    let mut current = start.to_path_buf();
    for _ in 0..10 {
        if current.join("Cargo.toml").exists() && current.join("package.json").exists() {
            return Some(current);
        }
        if !current.pop() {
            break;
        }
    }
    None
}

fn base64_encode(bytes: &[u8]) -> String {
    const CHARS: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = String::with_capacity(((bytes.len() + 2) / 3) * 4);
    for chunk in bytes.chunks(3) {
        let b0 = chunk[0] as usize;
        let b1 = if chunk.len() > 1 {
            chunk[1] as usize
        } else {
            0
        };
        let b2 = if chunk.len() > 2 {
            chunk[2] as usize
        } else {
            0
        };
        out.push(CHARS[b0 >> 2] as char);
        out.push(CHARS[((b0 & 3) << 4) | (b1 >> 4)] as char);
        out.push(if chunk.len() > 1 {
            CHARS[((b1 & 0xf) << 2) | (b2 >> 6)] as char
        } else {
            '='
        });
        out.push(if chunk.len() > 2 {
            CHARS[b2 & 0x3f] as char
        } else {
            '='
        });
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn registry_contains_domain_sources_for_builders_and_engines() {
        let fluid = sources_for_domain(KainDomain::Fluid);
        let brush = sources_for_domain(KainDomain::Brush);
        let shader = sources_for_domain(KainDomain::Shader);
        let procedural = sources_for_domain(KainDomain::Procedural);
        let kainscript = sources_for_domain(KainDomain::Kainscript);
        let sculpt = sources_for_domain(KainDomain::Sculpting);
        let sculpt_engine = sources_for_domain(KainDomain::SculptingEngine);
        let supermotion = sources_for_domain(KainDomain::Supermotion);
        let imports = sources_for_domain(KainDomain::Imports);

        assert!(!fluid.is_empty());
        assert!(!brush.is_empty());
        assert!(!shader.is_empty());
        assert!(!procedural.is_empty());
        assert!(!kainscript.is_empty());
        assert!(!sculpt.is_empty());
        assert!(!sculpt_engine.is_empty());
        assert!(!supermotion.is_empty());
        assert!(!imports.is_empty());
        assert!(fluid.iter().any(|asset| asset.id == "fluid_builder_kernel"));
        assert!(brush.iter().any(|asset| asset.id == "brush_builder_kernel"));
        assert!(shader
            .iter()
            .any(|asset| asset.id == "shader_builder_kernel"));
        assert!(procedural
            .iter()
            .any(|asset| asset.id == "procedural_builder_kernel"));
        assert!(kainscript
            .iter()
            .any(|asset| asset.id == "kainscript_builder_kernel"));
        assert!(imported_sources()
            .iter()
            .any(|asset| asset.id == "perlin_noise"));
        assert!(imported_sources_for_language(KainImportLanguage::C)
            .iter()
            .any(|asset| asset.id == "perlin_noise"));
    }

    #[test]
    fn import_language_directories_cover_all_enabled_importer_families() {
        assert_eq!(
            imports_language_dir(KainImportLanguage::C),
            imports_dir().join("c")
        );
        assert_eq!(
            imports_language_dir(KainImportLanguage::Typescript),
            imports_dir().join("typescript")
        );
        assert_eq!(
            imports_language_dir(KainImportLanguage::Cpp),
            imports_dir().join("cpp")
        );
    }

    #[test]
    fn runtime_registry_exposes_desktop_host_scaffolds() {
        assert!(runtime_app_by_id("suite_shell").is_some());
        assert!(runtime_app_by_id("shader_builder").is_some());
        assert!(runtime_app_by_id("brush_builder").is_some());
        assert!(runtime_app_by_id("kainscript_builder").is_some());
        assert!(runtime_app_by_id("material_builder").is_some());
        assert!(runtime_app_by_id("fluid_builder").is_some());
        assert!(runtime_app_by_id("procedural_builder").is_some());
        assert!(generated_runtime_app_by_id("suite_shell").is_some());
        assert!(generated_runtime_app_by_id("shader_builder").is_some());
        assert!(generated_runtime_app_by_id("brush_builder").is_some());
        assert!(generated_runtime_app_by_id("kainscript_builder").is_some());
        assert!(generated_runtime_app_by_id("material_builder").is_some());
        assert!(generated_runtime_app_by_id("fluid_builder").is_some());
        assert!(generated_runtime_app_by_id("procedural_builder").is_some());
        assert!(runtime_apps_for_host(KainHostKind::Tauri)
            .iter()
            .any(|asset| asset.id == "suite_shell"));
        assert!(runtime_apps_for_host(KainHostKind::Tauri)
            .iter()
            .any(|asset| asset.id == "shader_builder"));
        assert!(runtime_apps_for_host(KainHostKind::Tauri)
            .iter()
            .any(|asset| asset.id == "brush_builder"));
        assert!(runtime_apps_for_host(KainHostKind::Tauri)
            .iter()
            .any(|asset| asset.id == "kainscript_builder"));
        assert!(runtime_apps_for_host(KainHostKind::Tauri)
            .iter()
            .any(|asset| asset.id == "material_builder"));
        assert!(runtime_apps_for_host(KainHostKind::Tauri)
            .iter()
            .any(|asset| asset.id == "fluid_builder"));
        assert!(runtime_apps_for_host(KainHostKind::Tauri)
            .iter()
            .any(|asset| asset.id == "procedural_builder"));
        assert!(runtime_apps_for_kind(KainRuntimeKind::ComputeKernel)
            .iter()
            .any(|asset| asset.id == "signal_kernel"));
        assert!(generated_runtime_apps_for_target(KainCliTarget::Ts)
            .iter()
            .any(|asset| asset.id == "suite_shell"));
        assert!(generated_runtime_apps_for_target(KainCliTarget::Ts)
            .iter()
            .any(|asset| asset.id == "material_builder"));
        assert!(generated_runtime_apps_for_target(KainCliTarget::Ts)
            .iter()
            .any(|asset| asset.id == "fluid_builder"));
        assert!(generated_runtime_apps_for_target(KainCliTarget::Ts)
            .iter()
            .any(|asset| asset.id == "procedural_builder"));
        assert!(generated_runtime_apps_for_target(KainCliTarget::Ks)
            .iter()
            .any(|asset| asset.id == "kainscript_builder"));
        assert!(generated_runtime_apps_for_target(KainCliTarget::Ks)
            .iter()
            .any(|asset| asset.id == "material_builder"));
        assert!(generated_runtime_apps_for_target(KainCliTarget::Ks)
            .iter()
            .any(|asset| asset.id == "fluid_builder"));
        assert!(generated_runtime_apps_for_target(KainCliTarget::Ks)
            .iter()
            .any(|asset| asset.id == "procedural_builder"));
        assert_eq!(src_kain_apps_dir(), src_kain_dir().join("apps"));
        assert_eq!(src_kain_scripts_dir(), src_kain_dir().join("scripts"));
        assert_eq!(src_kain_kernels_dir(), src_kain_dir().join("kernels"));
        assert_eq!(src_kain_hybrid_dir(), src_kain_dir().join("hybrid"));
        assert_eq!(
            generated_runtime_target_dir(KainCliTarget::Wasm),
            generated_runtime_root().join("wasm")
        );
        assert_eq!(
            generated_runtime_target_dir(KainCliTarget::Llvm),
            generated_runtime_root().join("llvm")
        );
    }

    #[test]
    fn generated_spirv_registry_contains_core_domains() {
        let sculpt = generated_spirv_for_domain(KainDomain::Sculpting);
        let sculpt_engine = generated_spirv_for_domain(KainDomain::SculptingEngine);
        let supermotion = generated_spirv_for_domain(KainDomain::Supermotion);
        let materials = generated_spirv_for_domain(KainDomain::Materials);

        assert!(!sculpt.is_empty());
        assert!(!sculpt_engine.is_empty());
        assert!(!supermotion.is_empty());
        assert!(!materials.is_empty());
        assert!(generated_spirv_by_id("sculpt_stamp_main").is_some());
        assert!(generated_spirv_by_id("mocap_denoise").is_some());
        assert!(generated_spirv_by_id("material_pbr_standard").is_some());
    }

    #[test]
    fn upstream_capability_registry_tracks_modern_kain_surfaces() {
        assert!(upstream_capability_by_id("native_ui_apps").is_some());
        assert!(upstream_capability_by_id("python_bridge").is_some());
        assert!(upstream_capability_by_id("compiler_owned_intents").is_some());
        assert!(upstream_capability_by_id("ue5_codegen")
            .expect("ue5 capability should exist")
            .compile_targets
            .contains(&KainCliTarget::Ue5));
        assert!(upstream_capabilities_for_category(KainCapabilityCategory::RuntimeBridge)
            .iter()
            .any(|capability| capability.id == "python_bridge"));
        assert!(upstream_capabilities_for_status(KainIntegrationStatus::ModeledForAdoption)
            .iter()
            .any(|capability| capability.id == "native_ui_apps"));
    }

    #[test]
    fn modern_targets_parse_from_strings() {
        assert_eq!(KainCliTarget::try_from("llvm").unwrap(), KainCliTarget::Llvm);
        assert_eq!(KainCliTarget::try_from("ue5").unwrap(), KainCliTarget::Ue5);
        assert_eq!(
            KainCliTarget::try_from("ue5editor").unwrap(),
            KainCliTarget::Ue5Editor
        );
    }
}
