use k_os_workspace_registry::{
    self as workspace_registry, AdapterManifestRecord, IntegrationPackageRecord,
    PublicApiPackageRecord, WorkspacePackageRecord,
};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize)]
pub struct RegistryWorkspaceSummary {
    pub package_count: usize,
    pub local_dependency_edge_count: usize,
    pub aggregator_packages: Vec<String>,
    pub data_sources: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct RegistryAdapterManifest {
    pub adapter_target: String,
    pub package_count: usize,
    pub packages: Vec<RegistryAdapterPackageBinding>,
}

#[derive(Debug, Clone, Serialize)]
pub struct RegistryAdapterPackageBinding {
    pub package_name: String,
    pub stability_tier: String,
    pub capabilities: Vec<String>,
    pub recommended_entrypoints: Vec<String>,
    pub pressure_priority: String,
}

#[derive(Debug, Clone, Serialize)]
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

#[derive(Debug, Clone, Serialize)]
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

#[derive(Debug, Clone, Serialize)]
pub struct RegistryPublicApiEntrypoint {
    pub target_name: String,
    pub target_kind: String,
    pub src_path: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct RegistryAdapterTargetSummary {
    pub adapter_target: String,
    pub package_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RegistrySearchRequest {
    pub stability_tier: Option<String>,
    pub adapter_target: Option<String>,
    pub capability: Option<String>,
    pub package_name_contains: Option<String>,
}

#[tauri::command]
pub fn registry_get_workspace_summary() -> RegistryWorkspaceSummary {
    let document = workspace_registry::workspace_registry();
    RegistryWorkspaceSummary {
        package_count: document.package_count,
        local_dependency_edge_count: document.local_dependency_edge_count,
        aggregator_packages: document.aggregator_packages.clone(),
        data_sources: document.data_sources.clone(),
    }
}

#[tauri::command]
pub fn registry_list_adapter_targets() -> Vec<RegistryAdapterTargetSummary> {
    workspace_registry::adapter_manifests()
        .adapters
        .iter()
        .map(|adapter| RegistryAdapterTargetSummary {
            adapter_target: adapter.adapter_target.clone(),
            package_count: adapter.package_count,
        })
        .collect()
}

#[tauri::command]
pub fn registry_get_adapter_manifest(
    adapter_target: String,
) -> Result<RegistryAdapterManifest, String> {
    let adapter_manifest = workspace_registry::adapter_manifest_for_target(&adapter_target)
        .ok_or_else(|| format!("No adapter manifest found for target '{adapter_target}'"))?;
    Ok(map_adapter_manifest(adapter_manifest))
}

#[tauri::command]
pub fn registry_get_integration_contract(
    package_name: String,
) -> Result<RegistryIntegrationContract, String> {
    let integration_contract = workspace_registry::integration_contract_for_package(&package_name)
        .ok_or_else(|| format!("No integration contract found for package '{package_name}'"))?;
    let workspace_package = workspace_registry::package_by_name(&package_name)
        .ok_or_else(|| format!("No workspace package found for package '{package_name}'"))?;
    Ok(map_integration_contract(
        integration_contract,
        workspace_package,
    ))
}

#[tauri::command]
pub fn registry_list_integration_contracts(
    request: Option<RegistrySearchRequest>,
) -> Vec<RegistryIntegrationContract> {
    let request = request.unwrap_or(RegistrySearchRequest {
        stability_tier: None,
        adapter_target: None,
        capability: None,
        package_name_contains: None,
    });

    workspace_registry::integration_registry()
        .packages
        .iter()
        .filter_map(|integration_contract| {
            let workspace_package =
                workspace_registry::package_by_name(&integration_contract.package_name)?;
            let mapped = map_integration_contract(integration_contract, workspace_package);
            matches_search_request(&mapped, &request).then_some(mapped)
        })
        .collect()
}

#[tauri::command]
pub fn registry_get_public_api_summary(
    package_name: String,
) -> Result<RegistryPublicApiSummary, String> {
    let public_api = workspace_registry::public_api_for_package(&package_name)
        .ok_or_else(|| format!("No public API summary found for package '{package_name}'"))?;
    Ok(map_public_api_summary(public_api))
}

fn map_adapter_manifest(adapter_manifest: &AdapterManifestRecord) -> RegistryAdapterManifest {
    RegistryAdapterManifest {
        adapter_target: adapter_manifest.adapter_target.clone(),
        package_count: adapter_manifest.package_count,
        packages: adapter_manifest
            .packages
            .iter()
            .map(|package| RegistryAdapterPackageBinding {
                package_name: package.package_name.clone(),
                stability_tier: package.stability_tier.clone(),
                capabilities: package.capabilities.clone(),
                recommended_entrypoints: package.recommended_entrypoints.clone(),
                pressure_priority: package.pressure_priority.clone(),
            })
            .collect(),
    }
}

fn map_integration_contract(
    integration_contract: &IntegrationPackageRecord,
    workspace_package: &WorkspacePackageRecord,
) -> RegistryIntegrationContract {
    RegistryIntegrationContract {
        package_name: integration_contract.package_name.clone(),
        stability_tier: integration_contract.stability_tier.clone(),
        capabilities: integration_contract.capabilities.clone(),
        adapter_targets: integration_contract.adapter_targets.clone(),
        recommended_entrypoints: integration_contract.recommended_entrypoints.clone(),
        pressure_priority: integration_contract.pressure_priority.clone(),
        pressure_score: integration_contract.pressure_score,
        notes: integration_contract.notes.clone(),
        workspace_dependencies: workspace_package.workspace_dependencies.clone(),
        local_dependency_count: workspace_package.local_dependency_count,
        is_aggregator: workspace_package.is_aggregator,
    }
}

fn map_public_api_summary(public_api: &PublicApiPackageRecord) -> RegistryPublicApiSummary {
    RegistryPublicApiSummary {
        package_name: public_api.package_name.clone(),
        package_path: public_api.package_path.clone(),
        entrypoint_count: public_api.entrypoints.len(),
        item_count: public_api.item_count,
        function_count: public_api.function_count,
        method_count: public_api.method_count,
        reexport_count: public_api.reexport_count,
        entrypoints: public_api
            .entrypoints
            .iter()
            .map(|entrypoint| RegistryPublicApiEntrypoint {
                target_name: entrypoint.target_name.clone(),
                target_kind: entrypoint.target_kind.clone(),
                src_path: entrypoint.src_path.clone(),
            })
            .collect(),
    }
}

fn matches_search_request(
    contract: &RegistryIntegrationContract,
    request: &RegistrySearchRequest,
) -> bool {
    if let Some(stability_tier) = &request.stability_tier {
        if contract.stability_tier != *stability_tier {
            return false;
        }
    }

    if let Some(adapter_target) = &request.adapter_target {
        if !contract
            .adapter_targets
            .iter()
            .any(|candidate| candidate == adapter_target)
        {
            return false;
        }
    }

    if let Some(capability) = &request.capability {
        if !contract
            .capabilities
            .iter()
            .any(|candidate| candidate == capability)
        {
            return false;
        }
    }

    if let Some(package_name_contains) = &request.package_name_contains {
        if !contract.package_name.contains(package_name_contains) {
            return false;
        }
    }

    true
}
