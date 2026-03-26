use serde::{Deserialize, Serialize};
use specta::Type;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, Type)]
#[serde(rename_all = "lowercase")]
pub enum KainCliTarget {
    Wasm,
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
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, Type)]
#[serde(rename_all = "snake_case")]
pub enum KainHostKind {
    Tauri,
    Webview,
    WasmRuntime,
    Hybrid,
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
