use bevy_ecs::prelude::Resource;
use k_os_game_runtime::{
    ExecutionPlan, ExecutionRunReport, PipelineManifest, StageExecutionStatus, StageKind,
    StagePayload,
};
use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Resource, Default)]
pub struct GamePipelineBootstrapState {
    pub enabled: bool,
    pub manifest_path: String,
    pub workspace_root: String,
    pub preflight_missing_paths: Vec<String>,
    pub stage_total: usize,
    pub stage_failed: usize,
    pub registry_loaded: usize,
    pub registry_errors: usize,
    pub completed: bool,
    pub error: Option<String>,
}

impl GamePipelineBootstrapState {
    pub fn new(enabled: bool, manifest_path: String, workspace_root: String) -> Self {
        Self {
            enabled,
            manifest_path,
            workspace_root,
            preflight_missing_paths: Vec::new(),
            stage_total: 0,
            stage_failed: 0,
            registry_loaded: 0,
            registry_errors: 0,
            completed: false,
            error: None,
        }
    }
}

#[derive(Debug, Clone, Default, Resource)]
pub struct GameDataRegistryState {
    pub loaded: BTreeMap<String, RegistrySnapshot>,
    pub errors: Vec<String>,
}

#[derive(Debug, Clone, Default, Resource)]
pub struct GameRuntimeRegistryBindings {
    pub ready: bool,
    pub ready_reason: String,
    pub required_registry_kinds: Vec<String>,
    pub loaded_registry_versions: BTreeMap<String, String>,
    pub input_context_action_counts: BTreeMap<String, usize>,
    pub tag_domain_counts: BTreeMap<String, usize>,
    pub actor_archetypes: Vec<String>,
    pub camera_rigs: Vec<String>,
    pub visual_graphs: Vec<String>,
    pub default_player_input_context: Option<String>,
    pub default_player_camera_rig: Option<String>,
    pub issues: Vec<String>,
}

#[derive(Debug, Clone, Default, Resource)]
pub struct GameRuntimeActionBindings {
    pub ready: bool,
    pub status: String,
    pub detail: String,
    pub tick_index: u64,
    pub active_phase: String,
    pub routes_loaded: usize,
    pub agent_actions: BTreeMap<String, String>,
    pub agent_input_actions: BTreeMap<String, String>,
    pub agent_camera_rigs: BTreeMap<String, String>,
    pub issues: Vec<String>,
}

#[derive(Debug, Clone)]
pub struct RegistrySnapshot {
    pub stage_id: String,
    pub profile: String,
    pub merge_strategy: String,
    pub asset_path: String,
    pub version: String,
    pub required_table_counts: BTreeMap<String, usize>,
}

#[derive(Debug, Clone, Resource, Default, PartialEq, Eq)]
pub struct GameProductLaunchPreset {
    pub preset_id: String,
    pub product_id: String,
    pub product_name: String,
    pub profile_id: String,
    pub runtime_host: String,
    pub renderer_contract: String,
    pub ui_shell: String,
    pub features: Vec<String>,
    pub runtime_required_registry_kinds: Vec<String>,
    pub runtime_strict_readiness: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct GameProductLaunchPresetMatrix {
    pub presets: BTreeMap<String, GameProductLaunchPreset>,
}

#[derive(Debug, Clone)]
struct DataRegistryStageSpec {
    stage_id: String,
    profile: String,
    registry_kind: String,
    registry_asset: String,
    merge_strategy: String,
}

fn resolve_pipeline_path(workspace_root: &Path, raw_path: &str) -> PathBuf {
    let candidate = PathBuf::from(raw_path);
    if candidate.is_absolute() {
        candidate
    } else {
        workspace_root.join(candidate)
    }
}

fn table_entry_count(table: &toml::value::Table, table_name: &str) -> usize {
    match table.get(table_name) {
        Some(toml::Value::Array(values)) => values.len(),
        Some(toml::Value::Table(values)) => values.len(),
        _ => 0,
    }
}

fn stage_status_key(status: &StageExecutionStatus) -> &'static str {
    match status {
        StageExecutionStatus::Planned => "planned",
        StageExecutionStatus::Succeeded => "succeeded",
        StageExecutionStatus::Failed => "failed",
    }
}

fn build_data_registry_stage_specs(
    plan: &ExecutionPlan,
) -> BTreeMap<String, DataRegistryStageSpec> {
    let mut specs = BTreeMap::new();
    for stage in &plan.stages {
        if let StagePayload::DataRegistry(payload) = &stage.payload {
            specs.insert(
                stage.id.clone(),
                DataRegistryStageSpec {
                    stage_id: stage.id.clone(),
                    profile: stage.profile.clone(),
                    registry_kind: payload.registry_kind.clone(),
                    registry_asset: payload.registry_asset.clone(),
                    merge_strategy: payload.merge_strategy.clone(),
                },
            );
        }
    }
    specs
}

fn build_required_table_counts(
    registry_kind: &str,
    document: &toml::value::Table,
    manifest: &PipelineManifest,
) -> BTreeMap<String, usize> {
    let mut counts = BTreeMap::new();
    if let Some(policy) = manifest.data_registry.schemas.get(registry_kind) {
        for required_table in &policy.required_tables {
            counts.insert(
                required_table.clone(),
                table_entry_count(document, required_table),
            );
        }
    }
    counts
}

pub fn ingest_data_registry_stage_results(
    manifest: &PipelineManifest,
    plan: &ExecutionPlan,
    report: &ExecutionRunReport,
    workspace_root: &Path,
) -> GameDataRegistryState {
    let mut state = GameDataRegistryState::default();
    let specs = build_data_registry_stage_specs(plan);

    for record in &report.records {
        if record.kind != StageKind::DataRegistry {
            continue;
        }
        if record.status != StageExecutionStatus::Succeeded {
            state.errors.push(format!(
                "stage '{}' not ingested due to status '{}'",
                record.stage_id,
                stage_status_key(&record.status)
            ));
            continue;
        }

        let Some(spec) = specs.get(&record.stage_id) else {
            state.errors.push(format!(
                "stage '{}' missing data-registry stage spec in execution plan",
                record.stage_id
            ));
            continue;
        };

        let resolved_path = resolve_pipeline_path(workspace_root, &spec.registry_asset);
        let raw = match std::fs::read_to_string(&resolved_path) {
            Ok(raw) => raw,
            Err(error) => {
                state.errors.push(format!(
                    "stage '{}' failed to read registry '{}': {error}",
                    record.stage_id,
                    resolved_path.display()
                ));
                continue;
            }
        };

        let parsed = match raw.parse::<toml::Value>() {
            Ok(parsed) => parsed,
            Err(error) => {
                state.errors.push(format!(
                    "stage '{}' failed to parse registry TOML '{}': {error}",
                    record.stage_id,
                    resolved_path.display()
                ));
                continue;
            }
        };

        let Some(document) = parsed.as_table() else {
            state.errors.push(format!(
                "stage '{}' registry '{}' did not parse as TOML table",
                record.stage_id,
                resolved_path.display()
            ));
            continue;
        };

        let file_registry_kind = document
            .get("registry_kind")
            .and_then(toml::Value::as_str)
            .unwrap_or_default()
            .to_string();
        if file_registry_kind != spec.registry_kind {
            state.errors.push(format!(
                "stage '{}' registry_kind mismatch: manifest='{}' file='{}'",
                record.stage_id, spec.registry_kind, file_registry_kind
            ));
            continue;
        }

        let version = document
            .get("version")
            .and_then(toml::Value::as_str)
            .unwrap_or("unknown")
            .to_string();
        let required_table_counts =
            build_required_table_counts(&spec.registry_kind, document, manifest);

        state.loaded.insert(
            spec.registry_kind.clone(),
            RegistrySnapshot {
                stage_id: spec.stage_id.clone(),
                profile: spec.profile.clone(),
                merge_strategy: spec.merge_strategy.clone(),
                asset_path: resolved_path.display().to_string(),
                version,
                required_table_counts,
            },
        );
    }

    state
}

pub fn resolve_game_product_launch_preset(
    manifest: &PipelineManifest,
    requested_preset_id: Option<&str>,
    requested_profile: Option<&str>,
) -> Result<GameProductLaunchPreset, String> {
    let matrix = build_game_product_launch_preset_matrix(manifest)?;
    let preset_id = select_launch_preset_id(&matrix, requested_preset_id, requested_profile)?;
    matrix.presets.get(&preset_id).cloned().ok_or_else(|| {
        format!(
            "resolved launch preset '{}' missing from launch preset matrix",
            preset_id
        )
    })
}

pub fn build_game_product_launch_preset_matrix(
    manifest: &PipelineManifest,
) -> Result<GameProductLaunchPresetMatrix, String> {
    if manifest.profiles.is_empty() {
        return Err("pipeline manifest has no execution profiles".to_string());
    }

    let mut presets = BTreeMap::new();
    let runtime_required_registry_kinds = manifest.runtime_policy.required_registry_kinds.clone();
    let runtime_strict_readiness = manifest.runtime_policy.strict_readiness;

    for (profile_id, profile) in &manifest.profiles {
        let default_preset_id = format!("{profile_id}.default");
        let preset = GameProductLaunchPreset {
            preset_id: default_preset_id.clone(),
            product_id: manifest.product.id.clone(),
            product_name: manifest.product.name.clone(),
            profile_id: profile_id.clone(),
            runtime_host: profile.runtime_host.clone(),
            renderer_contract: profile.renderer_contract.clone(),
            ui_shell: profile.ui_shell.clone(),
            features: profile.features.clone(),
            runtime_required_registry_kinds: runtime_required_registry_kinds.clone(),
            runtime_strict_readiness,
        };
        presets.insert(default_preset_id, preset.clone());
        // Keep profile IDs as stable aliases to profile defaults for compatibility.
        presets.insert(profile_id.clone(), preset);
    }

    Ok(GameProductLaunchPresetMatrix { presets })
}

fn select_launch_preset_id(
    matrix: &GameProductLaunchPresetMatrix,
    requested_preset_id: Option<&str>,
    requested_profile: Option<&str>,
) -> Result<String, String> {
    let mut available_preset_ids = matrix.presets.keys().cloned().collect::<Vec<_>>();
    available_preset_ids.sort();
    let available = available_preset_ids.join(", ");

    if let Some(requested) = requested_preset_id
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        if matrix.presets.contains_key(requested) {
            return Ok(requested.to_string());
        }
        return Err(format!(
            "requested launch preset '{}' does not exist in manifest preset matrix (available: {})",
            requested, available
        ));
    }

    if let Some(requested) = requested_profile
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        let default_profile_preset = format!("{requested}.default");
        if matrix.presets.contains_key(&default_profile_preset) {
            return Ok(default_profile_preset);
        }
        if matrix.presets.contains_key(requested) {
            return Ok(requested.to_string());
        }
        return Err(format!(
            "requested launch profile '{}' does not exist in manifest",
            requested
        ));
    }

    if matrix.presets.contains_key("editor_preview.default") {
        return Ok("editor_preview.default".to_string());
    }
    if matrix.presets.contains_key("editor_preview") {
        return Ok("editor_preview".to_string());
    }

    matrix
        .presets
        .keys()
        .next()
        .cloned()
        .ok_or_else(|| "pipeline manifest has no execution profiles".to_string())
}

#[cfg(test)]
mod tests {
    use super::{build_game_product_launch_preset_matrix, resolve_game_product_launch_preset};
    use k_os_game_runtime::load_manifest_from_str;

    fn fixture_manifest() -> String {
        r#"
version = "1"
[product]
id = "k_os_game"
name = "K_OS Game"

[profiles.editor_preview]
runtime_host = "k-os-bevy"
renderer_contract = "k-os-renderer"
ui_shell = "react_tauri"
features = ["editor", "hot_reload"]

[profiles.runtime_play]
runtime_host = "k-os-bevy"
renderer_contract = "k-os-renderer"
ui_shell = "react_tauri"
features = ["player"]

[[stages]]
id = "scene_bootstrap"
kind = "scene"
profile = "editor_preview"
scene_asset = "src-game/assets/scenes/sandbox.kscene"
scene_format = "k_os_scene_v1"
schema_version = "1"
"#
        .to_string()
    }

    #[test]
    fn resolves_explicit_profile_from_manifest() {
        let manifest = load_manifest_from_str(&fixture_manifest()).expect("manifest should parse");
        let preset = resolve_game_product_launch_preset(&manifest, None, Some("runtime_play"))
            .expect("preset");
        assert_eq!(preset.profile_id, "runtime_play");
        assert_eq!(preset.product_id, "k_os_game");
        assert_eq!(preset.preset_id, "runtime_play.default");
        assert_eq!(preset.features, vec!["player".to_string()]);
    }

    #[test]
    fn defaults_to_editor_preview_when_not_requested() {
        let manifest = load_manifest_from_str(&fixture_manifest()).expect("manifest should parse");
        let preset = resolve_game_product_launch_preset(&manifest, None, None).expect("preset");
        assert_eq!(preset.profile_id, "editor_preview");
        assert_eq!(preset.preset_id, "editor_preview.default");
        assert_eq!(
            preset.features,
            vec!["editor".to_string(), "hot_reload".to_string()]
        );
    }

    #[test]
    fn rejects_missing_requested_profile() {
        let manifest = load_manifest_from_str(&fixture_manifest()).expect("manifest should parse");
        let error = resolve_game_product_launch_preset(&manifest, None, Some("missing"))
            .expect_err("missing profile should fail");
        assert!(error.contains("requested launch profile 'missing'"));
    }

    #[test]
    fn resolves_explicit_preset_id_alias() {
        let manifest = load_manifest_from_str(&fixture_manifest()).expect("manifest should parse");
        let preset = resolve_game_product_launch_preset(&manifest, Some("runtime_play"), None)
            .expect("preset");
        assert_eq!(preset.profile_id, "runtime_play");
        assert_eq!(preset.preset_id, "runtime_play.default");
    }

    #[test]
    fn launch_preset_matrix_bundles_runtime_policy_defaults() {
        let manifest = load_manifest_from_str(&fixture_manifest()).expect("manifest should parse");
        let matrix = build_game_product_launch_preset_matrix(&manifest).expect("matrix");
        let preset = matrix
            .presets
            .get("editor_preview.default")
            .expect("default preset should exist");
        assert_eq!(
            preset.runtime_required_registry_kinds,
            manifest.runtime_policy.required_registry_kinds
        );
        assert_eq!(
            preset.runtime_strict_readiness,
            manifest.runtime_policy.strict_readiness
        );
    }
}
