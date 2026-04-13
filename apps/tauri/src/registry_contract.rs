use serde::{Deserialize, Serialize};
use specta::Type;

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct RegistryWorkspaceSummary {
    pub package_count: usize,
    pub local_dependency_edge_count: usize,
    pub aggregator_packages: Vec<String>,
    pub data_sources: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct RegistryAdapterManifest {
    pub adapter_target: String,
    pub package_count: usize,
    pub packages: Vec<RegistryAdapterPackageBinding>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct RegistryAdapterPackageBinding {
    pub package_name: String,
    pub stability_tier: String,
    pub capabilities: Vec<String>,
    pub recommended_entrypoints: Vec<String>,
    pub pressure_priority: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct RegistryIntegrationContract {
    pub package_name: String,
    pub stability_tier: String,
    pub capabilities: Vec<String>,
    pub adapter_targets: Vec<String>,
    pub recommended_entrypoints: Vec<String>,
    pub pressure_priority: String,
    pub pressure_score: usize,
    pub notes: Vec<String>,
    pub workspace_dependencies: Vec<String>,
    pub local_dependency_count: usize,
    pub is_aggregator: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct RegistryPublicApiSummary {
    pub package_name: String,
    pub package_path: String,
    pub entrypoint_count: usize,
    pub item_count: usize,
    pub function_count: usize,
    pub method_count: usize,
    pub reexport_count: usize,
    pub entrypoints: Vec<RegistryPublicApiEntrypoint>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct RegistryPublicApiEntrypoint {
    pub target_name: String,
    pub target_kind: String,
    pub src_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct RegistryAdapterTargetSummary {
    pub adapter_target: String,
    pub package_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct RegistrySearchRequest {
    pub stability_tier: Option<String>,
    pub adapter_target: Option<String>,
    pub capability: Option<String>,
    pub package_name_contains: Option<String>,
}
