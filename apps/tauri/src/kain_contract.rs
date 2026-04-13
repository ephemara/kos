use serde::{Deserialize, Serialize};
use specta::Type;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, Type)]
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

#[derive(Debug, Clone, Copy, Serialize, Deserialize, Type)]
#[serde(rename_all = "snake_case")]
pub enum KainSourceDomain {
    Fluid,
    Sculpt,
    Mocap,
    Paint,
    Renderer,
    Materials,
    Imports,
    SculptingEngine,
    Brush,
    Shader,
    Procedural,
    Kainscript,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, Type)]
#[serde(rename_all = "lowercase")]
pub enum KainRegistryTargetKind {
    Spirv,
    Source,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, Type)]
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

#[derive(Debug, Clone, Copy, Serialize, Deserialize, Type)]
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

#[derive(Debug, Clone, Copy, Serialize, Deserialize, Type)]
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

#[derive(Debug, Clone, Copy, Serialize, Deserialize, Type)]
#[serde(rename_all = "snake_case")]
pub enum KainIntegrationStatus {
    ActiveInKos,
    PartiallyAdopted,
    ModeledForAdoption,
    UpstreamOnly,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct KainCompileResponse {
    pub success: bool,
    pub output: Option<String>,
    pub output_path: Option<String>,
    pub errors: Option<String>,
    pub duration_ms: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct KainRunResponse {
    pub success: bool,
    pub stdout: String,
    pub stderr: String,
    pub exit_code: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct KainSourceRegistryEntry {
    pub id: String,
    pub label: String,
    pub domain: KainSourceDomain,
    pub source_path: String,
    pub compiled_path: Option<String>,
    pub target: KainRegistryTargetKind,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct KainRuntimeOutputRegistryEntry {
    pub target: KainCliTarget,
    pub path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct KainRuntimeRegistryEntry {
    pub id: String,
    pub label: String,
    pub source_path: String,
    pub runtime_kind: KainRuntimeKind,
    pub host_kind: KainHostKind,
    pub namespace: String,
    pub outputs: Vec<KainRuntimeOutputRegistryEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct KainUpstreamCapabilityEntry {
    pub id: String,
    pub label: String,
    pub category: KainCapabilityCategory,
    pub integration_status: KainIntegrationStatus,
    pub summary: String,
    pub commands: Vec<String>,
    pub compile_targets: Vec<KainCliTarget>,
    pub runtime_kinds: Vec<KainRuntimeKind>,
    pub host_kinds: Vec<KainHostKind>,
    pub upstream_crates: Vec<String>,
    pub recommended_kos_next_step: String,
    pub notes: Vec<String>,
}
