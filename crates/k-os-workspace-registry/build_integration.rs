use serde::Serialize;
use std::collections::{BTreeMap, BTreeSet};

#[derive(Debug, Clone, Serialize)]
pub struct IntegrationRegistryDocument {
    pub package_count: usize,
    pub host_api_count: usize,
    pub integration_count: usize,
    pub internal_count: usize,
    pub packages: Vec<IntegrationPackageRecord>,
}

#[derive(Debug, Clone, Serialize)]
pub struct IntegrationPackageRecord {
    pub package_name: String,
    pub stability_tier: String,
    pub capabilities: Vec<String>,
    pub adapter_targets: Vec<String>,
    pub recommended_entrypoints: Vec<String>,
    pub pressure_priority: String,
    pub pressure_score: usize,
    pub notes: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct AdapterManifestsDocument {
    pub adapter_count: usize,
    pub adapters: Vec<AdapterManifestRecord>,
}

#[derive(Debug, Clone, Serialize)]
pub struct AdapterManifestRecord {
    pub adapter_target: String,
    pub package_count: usize,
    pub packages: Vec<AdapterPackageBinding>,
}

#[derive(Debug, Clone, Serialize)]
pub struct AdapterPackageBinding {
    pub package_name: String,
    pub stability_tier: String,
    pub capabilities: Vec<String>,
    pub recommended_entrypoints: Vec<String>,
    pub pressure_priority: String,
}

pub fn build_integration_registry(
    config: &super::WorkspaceConfig,
    workspace_registry: &super::WorkspaceRegistryDocument,
    public_api_registry: &super::build_public_api::PublicApiRegistryDocument,
    api_bloat_report: &super::build_public_api::ApiBloatPressureReport,
) -> IntegrationRegistryDocument {
    let public_api_by_package = public_api_registry
        .packages
        .iter()
        .map(|package| (package.package_name.clone(), package))
        .collect::<BTreeMap<_, _>>();
    let pressure_by_package = api_bloat_report
        .packages
        .iter()
        .map(|package| (package.package_name.clone(), package))
        .collect::<BTreeMap<_, _>>();

    let mut packages = workspace_registry
        .packages
        .iter()
        .map(|package| {
            let public_api = public_api_by_package.get(&package.name).copied();
            let pressure = pressure_by_package.get(&package.name).copied();
            let package_override = config.overrides.get(&package.name);
            derive_integration_package_record(package, public_api, pressure, package_override)
        })
        .collect::<Vec<_>>();
    packages.sort_by(|left, right| left.package_name.cmp(&right.package_name));

    IntegrationRegistryDocument {
        package_count: packages.len(),
        host_api_count: packages
            .iter()
            .filter(|package| package.stability_tier == "host-api")
            .count(),
        integration_count: packages
            .iter()
            .filter(|package| package.stability_tier == "integration")
            .count(),
        internal_count: packages
            .iter()
            .filter(|package| package.stability_tier == "internal")
            .count(),
        packages,
    }
}

pub fn build_adapter_manifests(
    integration_registry: &IntegrationRegistryDocument,
) -> AdapterManifestsDocument {
    let mut grouped = BTreeMap::<String, Vec<AdapterPackageBinding>>::new();

    for package in &integration_registry.packages {
        for adapter_target in &package.adapter_targets {
            grouped
                .entry(adapter_target.clone())
                .or_default()
                .push(AdapterPackageBinding {
                    package_name: package.package_name.clone(),
                    stability_tier: package.stability_tier.clone(),
                    capabilities: package.capabilities.clone(),
                    recommended_entrypoints: package.recommended_entrypoints.clone(),
                    pressure_priority: package.pressure_priority.clone(),
                });
        }
    }

    let adapters = grouped
        .into_iter()
        .map(|(adapter_target, mut packages)| {
            packages.sort_by(|left, right| {
                left.package_name
                    .cmp(&right.package_name)
                    .then_with(|| left.stability_tier.cmp(&right.stability_tier))
            });
            AdapterManifestRecord {
                adapter_target,
                package_count: packages.len(),
                packages,
            }
        })
        .collect::<Vec<_>>();

    AdapterManifestsDocument {
        adapter_count: adapters.len(),
        adapters,
    }
}

pub fn render_integration_registry_summary(document: &IntegrationRegistryDocument) -> String {
    let mut output = String::new();
    use std::fmt::Write as _;

    writeln!(output, "# Integration Registry").unwrap();
    writeln!(output).unwrap();
    writeln!(output, "- Packages: {}", document.package_count).unwrap();
    writeln!(output, "- Host API packages: {}", document.host_api_count).unwrap();
    writeln!(output, "- Integration packages: {}", document.integration_count).unwrap();
    writeln!(output, "- Internal packages: {}", document.internal_count).unwrap();
    writeln!(output).unwrap();

    writeln!(output, "## Recommended Integration Surfaces").unwrap();
    let mut packages = document.packages.clone();
    packages.sort_by(|left, right| {
        rank_stability_tier(&left.stability_tier)
            .cmp(&rank_stability_tier(&right.stability_tier))
            .then_with(|| left.package_name.cmp(&right.package_name))
    });
    for package in packages.iter().take(16) {
        if package.stability_tier == "internal" {
            continue;
        }
        writeln!(
            output,
            "- `{}`: tier {}, adapters [{}], entrypoints [{}]",
            package.package_name,
            package.stability_tier,
            package.adapter_targets.join(", "),
            package.recommended_entrypoints.join(", ")
        )
        .unwrap();
    }

    output
}

pub fn render_adapter_manifests_summary(document: &AdapterManifestsDocument) -> String {
    let mut output = String::new();
    use std::fmt::Write as _;

    writeln!(output, "# Adapter Manifests").unwrap();
    writeln!(output).unwrap();
    writeln!(output, "- Adapters: {}", document.adapter_count).unwrap();
    writeln!(output).unwrap();
    for adapter in &document.adapters {
        writeln!(
            output,
            "- `{}`: {} packages",
            adapter.adapter_target,
            adapter.package_count
        )
        .unwrap();
    }
    output
}

fn derive_integration_package_record(
    package: &super::WorkspacePackageRecord,
    public_api: Option<&super::build_public_api::PublicApiPackageRecord>,
    pressure: Option<&super::build_public_api::ApiBloatPressureRecord>,
    package_override: Option<&super::PackageOverride>,
) -> IntegrationPackageRecord {
    let stability_tier = package_override
        .and_then(|override_data| override_data.stability_tier.clone())
        .unwrap_or_else(|| infer_stability_tier(package));
    let adapter_targets = if let Some(override_data) = package_override {
        if !override_data.adapter_targets.is_empty() {
            override_data.adapter_targets.clone()
        } else {
            infer_adapter_targets(package, &stability_tier)
        }
    } else {
        infer_adapter_targets(package, &stability_tier)
    };
    let recommended_entrypoints = if let Some(override_data) = package_override {
        if !override_data.recommended_entrypoints.is_empty() {
            override_data.recommended_entrypoints.clone()
        } else {
            infer_recommended_entrypoints(public_api, &stability_tier)
        }
    } else {
        infer_recommended_entrypoints(public_api, &stability_tier)
    };

    let mut notes = Vec::new();
    notes.push(match stability_tier.as_str() {
        "host-api" => "intended as a top-level host-facing surface".to_string(),
        "integration" => "intended for adapter and cross-system composition".to_string(),
        _ => "prefer indirect use through curated adapters".to_string(),
    });
    if let Some(pressure) = pressure {
        notes.extend(pressure.notes.iter().cloned());
    }
    notes.sort();
    notes.dedup();

    IntegrationPackageRecord {
        package_name: package.name.clone(),
        stability_tier,
        capabilities: package.capabilities.clone(),
        adapter_targets,
        recommended_entrypoints,
        pressure_priority: pressure
            .map(|pressure| pressure.priority.clone())
            .unwrap_or_else(|| "low".to_string()),
        pressure_score: pressure.map(|pressure| pressure.score).unwrap_or_default(),
        notes,
    }
}

fn infer_stability_tier(package: &super::WorkspacePackageRecord) -> String {
    if package.roles.iter().any(|role| role == "host")
        || package.roles.iter().any(|role| role == "aggregator")
    {
        "host-api".to_string()
    } else if !package.hosts.is_empty()
        || package.capabilities.iter().any(|capability| {
            matches!(
                capability.as_str(),
                "artifact-provider"
                    | "kain"
                    | "gpu"
                    | "compute-pipeline"
                    | "shader-dispatch"
                    | "sculpt"
                    | "mesh-edit"
                    | "runtime-policy"
                    | "pipeline-manifest-schema"
                    | "registry-compatibility"
                    | "workspace-proof"
            )
        })
    {
        "integration".to_string()
    } else {
        "internal".to_string()
    }
}

fn infer_adapter_targets(
    package: &super::WorkspacePackageRecord,
    stability_tier: &str,
) -> Vec<String> {
    let mut adapter_targets = BTreeSet::new();
    for host in &package.hosts {
        adapter_targets.insert(match host.as_str() {
            "backend" => "tauri".to_string(),
            "bevy" => "bevy".to_string(),
            "zen" => "zen".to_string(),
            other => other.to_string(),
        });
    }
    if stability_tier != "internal" {
        adapter_targets.insert("external".to_string());
    }
    adapter_targets.into_iter().collect()
}

fn infer_recommended_entrypoints(
    public_api: Option<&super::build_public_api::PublicApiPackageRecord>,
    stability_tier: &str,
) -> Vec<String> {
    let Some(public_api) = public_api else {
        return Vec::new();
    };

    let preferred_items = public_api
        .items
        .iter()
        .filter(|item| matches!(item.kind.as_str(), "function" | "reexport"))
        .filter(|item| {
            item.item_path.contains("crate::commands::")
                || item.item_path.contains("crate::viewport::")
                || item.module_path == "crate"
        })
        .map(|item| item.item_path.clone())
        .collect::<Vec<_>>();

    let fallback_items = public_api
        .items
        .iter()
        .filter(|item| matches!(item.kind.as_str(), "function" | "reexport" | "struct" | "enum"))
        .map(|item| item.item_path.clone())
        .collect::<Vec<_>>();

    let candidates = if preferred_items.is_empty() {
        fallback_items
    } else {
        preferred_items
    };

    let mut unique = BTreeSet::new();
    let mut output = Vec::new();
    for candidate in candidates {
        if unique.insert(candidate.clone()) {
            output.push(candidate);
        }
        let limit = if stability_tier == "host-api" { 8 } else { 6 };
        if output.len() >= limit {
            break;
        }
    }
    output
}

fn rank_stability_tier(tier: &str) -> usize {
    match tier {
        "host-api" => 0,
        "integration" => 1,
        _ => 2,
    }
}
