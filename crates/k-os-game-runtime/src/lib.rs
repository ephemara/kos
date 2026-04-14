use serde::{Deserialize, Serialize};
use serde_json::{json, Value as JsonValue};
use sha2::{Digest, Sha256};
use std::collections::{BTreeMap, BTreeSet, HashSet};
use std::fs;
use std::path::{Path, PathBuf};
use thiserror::Error;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PipelineManifest {
    pub version: String,
    pub product: ProductDescriptor,
    pub profiles: BTreeMap<String, ExecutionProfile>,
    #[serde(default)]
    pub preflight: PreflightConfig,
    #[serde(default)]
    pub runner: RunnerConfig,
    #[serde(default)]
    pub data_registry: DataRegistryConfig,
    #[serde(default)]
    pub stage_schemas: StageSchemasConfig,
    #[serde(default)]
    pub runtime_policy: RuntimePolicyConfig,
    pub stages: Vec<PipelineStage>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProductDescriptor {
    pub id: String,
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionProfile {
    pub runtime_host: String,
    pub renderer_contract: String,
    pub ui_shell: String,
    #[serde(default)]
    pub features: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PreflightConfig {
    #[serde(default)]
    pub workspace_root: Option<String>,
    #[serde(default)]
    pub required_paths: Vec<String>,
    #[serde(default = "default_true")]
    pub fail_on_missing: bool,
}

impl Default for PreflightConfig {
    fn default() -> Self {
        Self {
            workspace_root: None,
            required_paths: Vec::new(),
            fail_on_missing: true,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RunnerConfig {
    #[serde(default)]
    pub adapters: BTreeMap<String, String>,
    #[serde(default)]
    pub strict_adapter_binding: bool,
    #[serde(default = "default_runner_prefix")]
    pub default_adapter_prefix: String,
}

impl Default for RunnerConfig {
    fn default() -> Self {
        Self {
            adapters: BTreeMap::new(),
            strict_adapter_binding: false,
            default_adapter_prefix: default_runner_prefix(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DataRegistryConfig {
    #[serde(default)]
    pub strict_schema: bool,
    #[serde(default)]
    pub schemas: BTreeMap<String, DataRegistrySchemaPolicy>,
}

impl Default for DataRegistryConfig {
    fn default() -> Self {
        Self {
            strict_schema: false,
            schemas: BTreeMap::new(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DataRegistrySchemaPolicy {
    pub expected_version: String,
    #[serde(default)]
    pub supported_versions: Vec<String>,
    #[serde(default)]
    pub required_tables: Vec<String>,
    #[serde(default)]
    pub migration_hook: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StageSchemasConfig {
    #[serde(default)]
    pub strict_schema: bool,
    #[serde(default)]
    pub schemas: BTreeMap<String, StageSchemaPolicy>,
}

impl Default for StageSchemasConfig {
    fn default() -> Self {
        Self {
            strict_schema: false,
            schemas: BTreeMap::new(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StageSchemaPolicy {
    pub expected_version: String,
    #[serde(default)]
    pub supported_versions: Vec<String>,
    #[serde(default)]
    pub required_fields: Vec<String>,
    #[serde(default)]
    pub migration_hook: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RuntimePolicyConfig {
    #[serde(default = "default_required_runtime_registry_kinds")]
    pub required_registry_kinds: Vec<String>,
    #[serde(default = "default_true")]
    pub strict_readiness: bool,
}

impl Default for RuntimePolicyConfig {
    fn default() -> Self {
        Self {
            required_registry_kinds: default_required_runtime_registry_kinds(),
            strict_readiness: true,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord, Hash)]
#[serde(rename_all = "snake_case")]
pub enum StageKind {
    Scene,
    KainHotReload,
    NarrativeGraph,
    DataRegistry,
    Cook,
    Build,
    Export,
}

impl StageKind {
    fn as_key(&self) -> &'static str {
        match self {
            StageKind::Scene => "scene",
            StageKind::KainHotReload => "kain_hot_reload",
            StageKind::NarrativeGraph => "narrative_graph",
            StageKind::DataRegistry => "data_registry",
            StageKind::Cook => "cook",
            StageKind::Build => "build",
            StageKind::Export => "export",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PipelineStage {
    pub id: String,
    pub kind: StageKind,
    pub profile: String,
    #[serde(default)]
    pub depends_on: Vec<String>,
    pub scene_asset: Option<String>,
    pub scene_format: Option<String>,
    pub enable_hot_reload: Option<bool>,
    pub source_registry: Option<String>,
    pub watch_roots: Option<Vec<String>>,
    pub debounce_ms: Option<u64>,
    pub target: Option<String>,
    pub graph_asset: Option<String>,
    pub entry_node: Option<String>,
    pub evaluate_via: Option<String>,
    pub registry_kind: Option<String>,
    pub registry_asset: Option<String>,
    pub merge_strategy: Option<String>,
    pub schema_version: Option<String>,
    pub recipe_asset: Option<String>,
    pub output_dir: Option<String>,
    pub target_platform: Option<String>,
    pub package_asset: Option<String>,
    pub artifact_name: Option<String>,
    pub package_format: Option<String>,
    pub source_dir: Option<String>,
    pub export_path: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ExecutionPlan {
    pub product_id: String,
    pub product_name: String,
    pub ordered_stage_ids: Vec<String>,
    pub stages: Vec<PlannedStage>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PlannedStage {
    pub id: String,
    pub kind: StageKind,
    pub profile: String,
    pub depends_on: Vec<String>,
    pub schema_version: Option<String>,
    pub payload: StagePayload,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum StagePayload {
    Scene(SceneStagePayload),
    KainHotReload(KainHotReloadPayload),
    NarrativeGraph(NarrativeGraphPayload),
    DataRegistry(DataRegistryPayload),
    Cook(CookStagePayload),
    Build(BuildStagePayload),
    Export(ExportStagePayload),
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SceneStagePayload {
    pub scene_asset: String,
    pub scene_format: String,
    pub enable_hot_reload: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct KainHotReloadPayload {
    pub source_registry: String,
    pub watch_roots: Vec<String>,
    pub debounce_ms: u64,
    pub target: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct NarrativeGraphPayload {
    pub graph_asset: String,
    pub entry_node: String,
    pub evaluate_via: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DataRegistryPayload {
    pub registry_kind: String,
    pub registry_asset: String,
    pub merge_strategy: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CookStagePayload {
    pub recipe_asset: String,
    pub output_dir: String,
    pub target_platform: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BuildStagePayload {
    pub package_asset: String,
    pub output_dir: String,
    pub artifact_name: String,
    pub target_platform: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ExportStagePayload {
    pub package_asset: String,
    pub source_dir: String,
    pub export_path: String,
    pub package_format: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PreflightReport {
    pub checked_paths: Vec<String>,
    pub missing_paths: Vec<String>,
    pub fail_on_missing: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RuntimeExecutionOptions {
    pub fail_fast: bool,
    pub emit_artifacts: bool,
}

impl Default for RuntimeExecutionOptions {
    fn default() -> Self {
        Self {
            fail_fast: true,
            emit_artifacts: true,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum StageExecutionStatus {
    Planned,
    Succeeded,
    Failed,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct StageExecutionRecord {
    pub stage_id: String,
    pub kind: StageKind,
    pub profile: String,
    pub adapter_id: String,
    pub status: StageExecutionStatus,
    pub detail: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ExecutionRunReport {
    pub product_id: String,
    pub product_name: String,
    pub ordered_stage_ids: Vec<String>,
    pub records: Vec<StageExecutionRecord>,
}

#[derive(Debug, Error)]
pub enum PipelineError {
    #[error("failed to read pipeline manifest at {path}: {source}")]
    ReadManifest {
        path: String,
        source: std::io::Error,
    },
    #[error("failed to parse pipeline manifest TOML: {0}")]
    ParseToml(#[from] toml::de::Error),
    #[error("manifest validation error: {0}")]
    Validation(String),
    #[error("pipeline preflight error: {0}")]
    Preflight(String),
    #[error("pipeline runner error: {0}")]
    Runner(String),
}

pub fn load_manifest_from_file(path: impl AsRef<Path>) -> Result<PipelineManifest, PipelineError> {
    let path_ref = path.as_ref();
    let raw = fs::read_to_string(path_ref).map_err(|source| PipelineError::ReadManifest {
        path: path_ref.display().to_string(),
        source,
    })?;
    load_manifest_from_str(&raw)
}

pub fn load_manifest_from_str(raw: &str) -> Result<PipelineManifest, PipelineError> {
    let manifest: PipelineManifest = toml::from_str(raw)?;
    manifest.validate()?;
    Ok(manifest)
}

pub fn build_execution_plan(manifest: &PipelineManifest) -> Result<ExecutionPlan, PipelineError> {
    manifest.validate()?;

    let mut indegree: BTreeMap<String, usize> = BTreeMap::new();
    let mut dependents: BTreeMap<String, Vec<String>> = BTreeMap::new();
    let mut stage_index: BTreeMap<String, &PipelineStage> = BTreeMap::new();

    for stage in &manifest.stages {
        indegree.insert(stage.id.clone(), stage.depends_on.len());
        stage_index.insert(stage.id.clone(), stage);
        for dependency in &stage.depends_on {
            dependents
                .entry(dependency.clone())
                .or_default()
                .push(stage.id.clone());
        }
    }

    let mut ready: Vec<String> = indegree
        .iter()
        .filter_map(|(id, degree)| (*degree == 0).then_some(id.clone()))
        .collect();
    ready.sort();

    let mut ordered_stage_ids = Vec::with_capacity(manifest.stages.len());
    let mut planned_stages = Vec::with_capacity(manifest.stages.len());

    while let Some(stage_id) = ready.first().cloned() {
        ready.remove(0);
        let stage = stage_index.get(&stage_id).ok_or_else(|| {
            PipelineError::Validation(format!("missing stage index for '{stage_id}'"))
        })?;

        ordered_stage_ids.push(stage_id.clone());
        planned_stages.push(PlannedStage {
            id: stage.id.clone(),
            kind: stage.kind.clone(),
            profile: stage.profile.clone(),
            depends_on: stage.depends_on.clone(),
            schema_version: stage.schema_version.clone(),
            payload: stage.payload()?,
        });

        if let Some(stage_dependents) = dependents.get(&stage_id) {
            let mut sorted_dependents = stage_dependents.clone();
            sorted_dependents.sort();

            for dependent_id in sorted_dependents {
                let degree = indegree.get_mut(&dependent_id).ok_or_else(|| {
                    PipelineError::Validation(format!("missing indegree for '{dependent_id}'"))
                })?;
                *degree = degree.saturating_sub(1);
                if *degree == 0 {
                    ready.push(dependent_id);
                }
            }
            ready.sort();
        }
    }

    if ordered_stage_ids.len() != manifest.stages.len() {
        return Err(PipelineError::Validation(
            "dependency cycle detected while building execution plan".to_string(),
        ));
    }

    Ok(ExecutionPlan {
        product_id: manifest.product.id.clone(),
        product_name: manifest.product.name.clone(),
        ordered_stage_ids,
        stages: planned_stages,
    })
}

pub fn run_preflight_checks(
    manifest: &PipelineManifest,
    default_workspace_root: impl AsRef<Path>,
) -> Result<PreflightReport, PipelineError> {
    manifest.validate()?;

    let root = configured_workspace_root_or_default(&manifest.preflight, default_workspace_root);

    let mut checked_paths = collect_referenced_paths(manifest)
        .into_iter()
        .collect::<Vec<_>>();
    checked_paths.sort();

    let mut missing_paths = Vec::new();
    for path in &checked_paths {
        let resolved = resolve_path(&root, path);
        if !resolved.exists() {
            missing_paths.push(path.clone());
        }
    }

    if manifest.preflight.fail_on_missing && !missing_paths.is_empty() {
        return Err(PipelineError::Preflight(format!(
            "missing required pipeline paths: {}",
            missing_paths.join(", ")
        )));
    }

    Ok(PreflightReport {
        checked_paths,
        missing_paths,
        fail_on_missing: manifest.preflight.fail_on_missing,
    })
}

pub fn execute_plan_with_runner(
    manifest: &PipelineManifest,
    plan: &ExecutionPlan,
) -> Result<ExecutionRunReport, PipelineError> {
    manifest.validate()?;

    let mut records = Vec::with_capacity(plan.stages.len());
    for stage in &plan.stages {
        let adapter = resolve_adapter_id(&manifest.runner, &stage.kind);
        if manifest.runner.strict_adapter_binding
            && !manifest.runner.adapters.contains_key(stage.kind.as_key())
        {
            return Err(PipelineError::Runner(format!(
                "strict adapter binding enabled and no adapter configured for stage kind '{}'",
                stage.kind.as_key()
            )));
        }

        records.push(StageExecutionRecord {
            stage_id: stage.id.clone(),
            kind: stage.kind.clone(),
            profile: stage.profile.clone(),
            adapter_id: adapter,
            status: StageExecutionStatus::Planned,
            detail: "planned adapter dispatch".to_string(),
        });
    }

    Ok(ExecutionRunReport {
        product_id: plan.product_id.clone(),
        product_name: plan.product_name.clone(),
        ordered_stage_ids: plan.ordered_stage_ids.clone(),
        records,
    })
}

pub fn execute_plan_with_builtin_adapters(
    manifest: &PipelineManifest,
    plan: &ExecutionPlan,
    workspace_root: impl AsRef<Path>,
    options: &RuntimeExecutionOptions,
) -> Result<ExecutionRunReport, PipelineError> {
    manifest.validate()?;

    let root = configured_workspace_root_or_default(&manifest.preflight, workspace_root);

    let mut records = Vec::with_capacity(plan.stages.len());
    let mut stage_outcomes: BTreeMap<String, StageExecutionStatus> = BTreeMap::new();

    for stage in &plan.stages {
        let adapter = resolve_adapter_id(&manifest.runner, &stage.kind);
        if manifest.runner.strict_adapter_binding
            && !manifest.runner.adapters.contains_key(stage.kind.as_key())
        {
            return Err(PipelineError::Runner(format!(
                "strict adapter binding enabled and no adapter configured for stage kind '{}'",
                stage.kind.as_key()
            )));
        }

        let blocked_dependencies = stage
            .depends_on
            .iter()
            .filter(|dependency| {
                stage_outcomes.get(*dependency) == Some(&StageExecutionStatus::Failed)
            })
            .cloned()
            .collect::<Vec<_>>();

        if !blocked_dependencies.is_empty() {
            let detail = format!(
                "blocked by failed dependencies: {}",
                blocked_dependencies.join(", ")
            );
            records.push(StageExecutionRecord {
                stage_id: stage.id.clone(),
                kind: stage.kind.clone(),
                profile: stage.profile.clone(),
                adapter_id: adapter,
                status: StageExecutionStatus::Failed,
                detail: detail.clone(),
            });
            stage_outcomes.insert(stage.id.clone(), StageExecutionStatus::Failed);
            if options.fail_fast {
                return Err(PipelineError::Runner(format!(
                    "stage '{}' blocked by dependency failures: {}",
                    stage.id,
                    blocked_dependencies.join(", ")
                )));
            }
            continue;
        }

        match execute_stage_with_builtin_adapter(
            stage,
            &root,
            &manifest.data_registry,
            &manifest.stage_schemas,
            options.emit_artifacts,
        ) {
            Ok(detail) => {
                records.push(StageExecutionRecord {
                    stage_id: stage.id.clone(),
                    kind: stage.kind.clone(),
                    profile: stage.profile.clone(),
                    adapter_id: adapter,
                    status: StageExecutionStatus::Succeeded,
                    detail,
                });
                stage_outcomes.insert(stage.id.clone(), StageExecutionStatus::Succeeded);
            }
            Err(error_detail) => {
                records.push(StageExecutionRecord {
                    stage_id: stage.id.clone(),
                    kind: stage.kind.clone(),
                    profile: stage.profile.clone(),
                    adapter_id: adapter,
                    status: StageExecutionStatus::Failed,
                    detail: error_detail.clone(),
                });
                stage_outcomes.insert(stage.id.clone(), StageExecutionStatus::Failed);
                if options.fail_fast {
                    return Err(PipelineError::Runner(format!(
                        "stage '{}' failed: {error_detail}",
                        stage.id
                    )));
                }
            }
        }
    }

    Ok(ExecutionRunReport {
        product_id: plan.product_id.clone(),
        product_name: plan.product_name.clone(),
        ordered_stage_ids: plan.ordered_stage_ids.clone(),
        records,
    })
}

fn execute_stage_with_builtin_adapter(
    stage: &PlannedStage,
    root: &Path,
    data_registry: &DataRegistryConfig,
    stage_schemas: &StageSchemasConfig,
    emit_artifacts: bool,
) -> Result<String, String> {
    let stage_schema_detail = evaluate_non_registry_stage_schema_policy(stage, stage_schemas)?;
    match &stage.payload {
        StagePayload::Scene(payload) => execute_scene_adapter(payload, root).map(|detail| {
            if stage_schema_detail.is_empty() {
                detail
            } else {
                format!("{detail}; {stage_schema_detail}")
            }
        }),
        StagePayload::KainHotReload(payload) => {
            execute_kain_hot_reload_adapter(payload, root).map(|detail| {
                if stage_schema_detail.is_empty() {
                    detail
                } else {
                    format!("{detail}; {stage_schema_detail}")
                }
            })
        }
        StagePayload::NarrativeGraph(payload) => execute_narrative_graph_adapter(payload, root)
            .map(|detail| {
                if stage_schema_detail.is_empty() {
                    detail
                } else {
                    format!("{detail}; {stage_schema_detail}")
                }
            }),
        StagePayload::DataRegistry(payload) => {
            execute_data_registry_adapter(payload, root, data_registry)
        }
        StagePayload::Cook(payload) => execute_cook_stage_adapter(payload, root, emit_artifacts)
            .map(|detail| {
                if stage_schema_detail.is_empty() {
                    detail
                } else {
                    format!("{detail}; {stage_schema_detail}")
                }
            }),
        StagePayload::Build(payload) => execute_build_stage_adapter(payload, root, emit_artifacts)
            .map(|detail| {
                if stage_schema_detail.is_empty() {
                    detail
                } else {
                    format!("{detail}; {stage_schema_detail}")
                }
            }),
        StagePayload::Export(payload) => {
            execute_export_stage_adapter(payload, root, emit_artifacts).map(|detail| {
                if stage_schema_detail.is_empty() {
                    detail
                } else {
                    format!("{detail}; {stage_schema_detail}")
                }
            })
        }
    }
}

fn write_json_artifact(path: &Path, payload: &JsonValue) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|source| {
            format!(
                "failed to create artifact directory '{}': {source}",
                parent.display()
            )
        })?;
    }

    let encoded = serde_json::to_string_pretty(payload).map_err(|source| {
        format!(
            "failed to serialize artifact payload '{}': {source}",
            path.display()
        )
    })?;
    fs::write(path, encoded)
        .map_err(|source| format!("failed to write artifact '{}': {source}", path.display()))
}

fn sha256_hex(path: &Path) -> Result<String, String> {
    let bytes = fs::read(path).map_err(|source| {
        format!(
            "failed to read asset '{}' for hashing: {source}",
            path.display()
        )
    })?;
    let mut hasher = Sha256::new();
    hasher.update(&bytes);
    let digest = hasher.finalize();
    Ok(digest
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect::<String>())
}

fn collect_files_recursive(dir: &Path, suffix: &str) -> Result<Vec<PathBuf>, String> {
    let mut files = Vec::new();
    if !dir.exists() {
        return Ok(files);
    }

    let mut stack = vec![dir.to_path_buf()];
    while let Some(current) = stack.pop() {
        let entries = fs::read_dir(&current).map_err(|source| {
            format!(
                "failed to enumerate directory '{}' while collecting artifacts: {source}",
                current.display()
            )
        })?;
        for entry in entries {
            let entry = entry.map_err(|source| {
                format!(
                    "failed to read directory entry in '{}': {source}",
                    current.display()
                )
            })?;
            let path = entry.path();
            if path.is_dir() {
                stack.push(path);
                continue;
            }
            if path
                .file_name()
                .and_then(|name| name.to_str())
                .is_some_and(|name| name.ends_with(suffix))
            {
                files.push(path);
            }
        }
    }

    files.sort();
    Ok(files)
}

fn parse_registry_version_from_asset(path: &Path) -> Result<Option<JsonValue>, String> {
    let Some(file_name) = path.file_name().and_then(|name| name.to_str()) else {
        return Ok(None);
    };
    if !file_name.ends_with(".registry.toml") {
        return Ok(None);
    }

    let raw = fs::read_to_string(path).map_err(|source| {
        format!(
            "failed to read registry asset '{}' for provenance: {source}",
            path.display()
        )
    })?;
    let registry_toml: toml::Value = toml::from_str(&raw).map_err(|source| {
        format!(
            "failed to parse registry TOML '{}' for provenance: {source}",
            path.display()
        )
    })?;
    let Some(registry_kind) = registry_toml
        .get("registry_kind")
        .and_then(|value| value.as_str())
    else {
        return Ok(None);
    };
    let Some(version) = registry_toml
        .get("version")
        .and_then(|value| value.as_str())
    else {
        return Ok(None);
    };

    Ok(Some(json!({
        "registry_kind": registry_kind,
        "version": version,
        "asset_path": path.display().to_string(),
        "sha256": sha256_hex(path)?
    })))
}

fn dedupe_registry_versions(mut entries: Vec<JsonValue>) -> Vec<JsonValue> {
    let mut seen = BTreeSet::new();
    entries.retain(|entry| {
        let key = (
            entry
                .get("registry_kind")
                .and_then(|value| value.as_str())
                .unwrap_or_default()
                .to_string(),
            entry
                .get("version")
                .and_then(|value| value.as_str())
                .unwrap_or_default()
                .to_string(),
            entry
                .get("asset_path")
                .and_then(|value| value.as_str())
                .unwrap_or_default()
                .to_string(),
        );
        seen.insert(key)
    });
    entries
}

fn registry_versions_from_upstream_contracts(contracts: &[PathBuf]) -> Vec<JsonValue> {
    let mut registry_versions = Vec::new();
    for contract_path in contracts {
        let Ok(raw) = fs::read_to_string(contract_path) else {
            continue;
        };
        let Ok(contract_json) = serde_json::from_str::<JsonValue>(&raw) else {
            continue;
        };
        if let Some(entries) = contract_json
            .get("provenance")
            .and_then(|value| value.get("registry_versions"))
            .and_then(|value| value.as_array())
        {
            registry_versions.extend(entries.iter().cloned());
        }
    }
    dedupe_registry_versions(registry_versions)
}

fn execute_cook_stage_adapter(
    payload: &CookStagePayload,
    root: &Path,
    emit_artifacts: bool,
) -> Result<String, String> {
    let recipe_path = resolve_path(root, &payload.recipe_asset);
    let raw = fs::read_to_string(&recipe_path).map_err(|source| {
        format!(
            "failed to read cook recipe '{}': {source}",
            recipe_path.display()
        )
    })?;
    let recipe_toml: toml::Value = toml::from_str(&raw).map_err(|source| {
        format!(
            "failed to parse cook recipe TOML '{}': {source}",
            recipe_path.display()
        )
    })?;

    let recipe_platform = recipe_toml
        .get("target_platform")
        .and_then(|value| value.as_str())
        .ok_or_else(|| {
            format!(
                "cook recipe '{}' missing string field 'target_platform'",
                recipe_path.display()
            )
        })?;
    if recipe_platform != payload.target_platform {
        return Err(format!(
            "cook recipe '{}' target_platform mismatch: expected '{}', found '{}'",
            recipe_path.display(),
            payload.target_platform,
            recipe_platform
        ));
    }

    let inputs = recipe_toml
        .get("inputs")
        .and_then(|value| value.as_array())
        .ok_or_else(|| {
            format!(
                "cook recipe '{}' missing array field 'inputs'",
                recipe_path.display()
            )
        })?;
    let mut resolved_inputs = Vec::with_capacity(inputs.len());
    for input in inputs {
        let input_path = input.as_str().ok_or_else(|| {
            format!(
                "cook recipe '{}' contains non-string input entry",
                recipe_path.display()
            )
        })?;
        let resolved = resolve_path(root, input_path);
        if !resolved.exists() {
            return Err(format!(
                "cook recipe '{}' references missing input '{}'",
                recipe_path.display(),
                resolved.display()
            ));
        }
        resolved_inputs.push(resolved);
    }

    let output_dir = resolve_path(root, &payload.output_dir);
    if emit_artifacts {
        fs::create_dir_all(&output_dir).map_err(|source| {
            format!(
                "failed to create cook output directory '{}': {source}",
                output_dir.display()
            )
        })?;

        let cook_contract_name = recipe_toml
            .get("cook")
            .and_then(|cook| cook.get("contract_asset"))
            .and_then(|value| value.as_str())
            .unwrap_or("cook.contract.json");
        let cook_artifact = output_dir.join(cook_contract_name);
        let input_contract = resolved_inputs
            .iter()
            .map(|path| path.display().to_string())
            .collect::<Vec<_>>();
        let recipe_hash = sha256_hex(&recipe_path)?;
        let mut source_assets = Vec::with_capacity(resolved_inputs.len() + 1);
        source_assets.push(json!({
            "kind": "recipe",
            "path": recipe_path.display().to_string(),
            "sha256": recipe_hash
        }));
        let mut registry_versions = Vec::new();
        for input_path in &resolved_inputs {
            source_assets.push(json!({
                "kind": "input",
                "path": input_path.display().to_string(),
                "sha256": sha256_hex(input_path)?
            }));
            if let Some(registry_version) = parse_registry_version_from_asset(input_path)? {
                registry_versions.push(registry_version);
            }
        }
        let registry_versions = dedupe_registry_versions(registry_versions);
        let payload = json!({
            "kind": "cook_contract",
            "target_platform": payload.target_platform,
            "recipe_asset": recipe_path.display().to_string(),
            "output_dir": output_dir.display().to_string(),
            "inputs": input_contract,
            "cook": recipe_toml.get("cook").cloned().unwrap_or(toml::Value::Table(Default::default())),
            "provenance": {
                "hash_algorithm": "sha256",
                "source_assets": source_assets,
                "registry_versions": registry_versions
            }
        });
        write_json_artifact(&cook_artifact, &payload)?;
        return Ok(format!(
            "cook stage emitted artifact (platform={}, inputs={}, output_dir={}, contract={})",
            payload["target_platform"].as_str().unwrap_or_default(),
            inputs.len(),
            output_dir.display(),
            cook_artifact.display()
        ));
    }

    Ok(format!(
        "cook stage validated (platform={}, inputs={}, output_dir={})",
        payload.target_platform,
        inputs.len(),
        output_dir.display()
    ))
}

fn execute_build_stage_adapter(
    payload: &BuildStagePayload,
    root: &Path,
    emit_artifacts: bool,
) -> Result<String, String> {
    let package_path = resolve_path(root, &payload.package_asset);
    let raw = fs::read_to_string(&package_path).map_err(|source| {
        format!(
            "failed to read build package '{}': {source}",
            package_path.display()
        )
    })?;
    let package_toml: toml::Value = toml::from_str(&raw).map_err(|source| {
        format!(
            "failed to parse build package TOML '{}': {source}",
            package_path.display()
        )
    })?;

    let target_platform = package_toml
        .get("target_platform")
        .and_then(|value| value.as_str())
        .ok_or_else(|| {
            format!(
                "build package '{}' missing string field 'target_platform'",
                package_path.display()
            )
        })?;
    if target_platform != payload.target_platform {
        return Err(format!(
            "build package '{}' target_platform mismatch: expected '{}', found '{}'",
            package_path.display(),
            payload.target_platform,
            target_platform
        ));
    }

    let cooked_dir = package_toml
        .get("cooked_dir")
        .and_then(|value| value.as_str())
        .ok_or_else(|| {
            format!(
                "build package '{}' missing string field 'cooked_dir'",
                package_path.display()
            )
        })?;
    let cooked_dir_path = resolve_path(root, cooked_dir);
    if !cooked_dir_path.exists() {
        return Err(format!(
            "build package '{}' references missing cooked_dir '{}'",
            package_path.display(),
            cooked_dir_path.display()
        ));
    }

    let output_dir = resolve_path(root, &payload.output_dir);
    if emit_artifacts {
        fs::create_dir_all(&output_dir).map_err(|source| {
            format!(
                "failed to create build output directory '{}': {source}",
                output_dir.display()
            )
        })?;

        let artifact_dir = output_dir.join(&payload.artifact_name);
        fs::create_dir_all(&artifact_dir).map_err(|source| {
            format!(
                "failed to create build artifact directory '{}': {source}",
                artifact_dir.display()
            )
        })?;

        let runtime_executable = package_toml
            .get("runtime")
            .and_then(|runtime| runtime.get("executable"))
            .and_then(|value| value.as_str())
            .unwrap_or_else(|| {
                if payload.artifact_name.ends_with(".exe") {
                    payload.artifact_name.as_str()
                } else {
                    "k_os_game_player.exe"
                }
            });
        let executable_path = artifact_dir.join(runtime_executable);
        fs::write(
            &executable_path,
            format!(
                "k_os build placeholder\nartifact={}\nplatform={}\n",
                payload.artifact_name, payload.target_platform
            ),
        )
        .map_err(|source| {
            format!(
                "failed to emit build executable placeholder '{}': {source}",
                executable_path.display()
            )
        })?;

        let build_contract_name = package_toml
            .get("bundle")
            .and_then(|bundle| bundle.get("contract_asset"))
            .and_then(|value| value.as_str())
            .unwrap_or("build.contract.json");
        let build_artifact = artifact_dir.join(build_contract_name);
        let upstream_contracts = collect_files_recursive(&cooked_dir_path, ".contract.json")?;
        let source_contracts = upstream_contracts
            .iter()
            .map(|path| {
                Ok(json!({
                    "path": path.display().to_string(),
                    "sha256": sha256_hex(path)?
                }))
            })
            .collect::<Result<Vec<_>, String>>()?;
        let source_assets = vec![
            json!({
                "kind": "package",
                "path": package_path.display().to_string(),
                "sha256": sha256_hex(&package_path)?
            }),
            json!({
                "kind": "runtime_executable",
                "path": executable_path.display().to_string(),
                "sha256": sha256_hex(&executable_path)?
            }),
        ];
        let registry_versions = registry_versions_from_upstream_contracts(&upstream_contracts);
        let contract_payload = json!({
            "kind": "build_contract",
            "target_platform": payload.target_platform,
            "artifact_name": payload.artifact_name,
            "package_asset": package_path.display().to_string(),
            "cooked_dir": cooked_dir_path.display().to_string(),
            "output_dir": output_dir.display().to_string(),
            "runtime": package_toml.get("runtime").cloned().unwrap_or(toml::Value::Table(Default::default())),
            "bundle": package_toml.get("bundle").cloned().unwrap_or(toml::Value::Table(Default::default())),
            "provenance": {
                "hash_algorithm": "sha256",
                "source_assets": source_assets,
                "source_contracts": source_contracts,
                "registry_versions": registry_versions
            }
        });
        write_json_artifact(&build_artifact, &contract_payload)?;

        return Ok(format!(
            "build stage emitted artifact (platform={}, artifact_name={}, artifact_dir={}, executable={})",
            payload.target_platform,
            payload.artifact_name,
            artifact_dir.display(),
            executable_path.display()
        ));
    }

    Ok(format!(
        "build stage validated (platform={}, artifact_name={}, cooked_dir={})",
        payload.target_platform,
        payload.artifact_name,
        cooked_dir_path.display()
    ))
}

fn execute_export_stage_adapter(
    payload: &ExportStagePayload,
    root: &Path,
    emit_artifacts: bool,
) -> Result<String, String> {
    let package_path = resolve_path(root, &payload.package_asset);
    let raw = fs::read_to_string(&package_path).map_err(|source| {
        format!(
            "failed to read export package '{}': {source}",
            package_path.display()
        )
    })?;
    let package_toml: toml::Value = toml::from_str(&raw).map_err(|source| {
        format!(
            "failed to parse export package TOML '{}': {source}",
            package_path.display()
        )
    })?;

    let export_format = package_toml
        .get("package_format")
        .and_then(|value| value.as_str())
        .ok_or_else(|| {
            format!(
                "export package '{}' missing string field 'package_format'",
                package_path.display()
            )
        })?;
    if export_format != payload.package_format {
        return Err(format!(
            "export package '{}' package_format mismatch: expected '{}', found '{}'",
            package_path.display(),
            payload.package_format,
            export_format
        ));
    }

    let source_dir = resolve_path(root, &payload.source_dir);
    if !source_dir.exists() {
        return Err(format!(
            "export stage source_dir does not exist: '{}'",
            source_dir.display()
        ));
    }

    let export_artifact_path = resolve_path(root, &payload.export_path);
    let export_parent = export_artifact_path
        .parent()
        .map(Path::to_path_buf)
        .unwrap_or_else(|| root.to_path_buf());

    if emit_artifacts {
        let upstream_contracts = collect_files_recursive(&source_dir, ".contract.json")?;
        let source_contracts = upstream_contracts
            .iter()
            .map(|path| {
                Ok(json!({
                    "path": path.display().to_string(),
                    "sha256": sha256_hex(path)?
                }))
            })
            .collect::<Result<Vec<_>, String>>()?;
        let registry_versions = registry_versions_from_upstream_contracts(&upstream_contracts);
        let contract_payload = json!({
            "kind": "export_contract",
            "package_format": payload.package_format,
            "source_dir": source_dir.display().to_string(),
            "package_asset": package_path.display().to_string(),
            "bundle": package_toml.get("bundle").cloned().unwrap_or(toml::Value::Table(Default::default())),
            "provenance": {
                "hash_algorithm": "sha256",
                "source_assets": [{
                    "kind": "package",
                    "path": package_path.display().to_string(),
                    "sha256": sha256_hex(&package_path)?
                }],
                "source_contracts": source_contracts,
                "registry_versions": registry_versions
            }
        });
        write_json_artifact(&export_artifact_path, &contract_payload)?;

        return Ok(format!(
            "export stage emitted artifact (format={}, source_dir={}, export_path={})",
            payload.package_format,
            source_dir.display(),
            export_artifact_path.display()
        ));
    }

    Ok(format!(
        "export stage validated (format={}, source_dir={}, export_parent={})",
        payload.package_format,
        source_dir.display(),
        export_parent.display()
    ))
}

fn evaluate_non_registry_stage_schema_policy(
    stage: &PlannedStage,
    config: &StageSchemasConfig,
) -> Result<String, String> {
    let stage_key = stage.kind.as_key();
    if stage.kind == StageKind::DataRegistry {
        return Ok(String::new());
    }

    let policy = match config.schemas.get(stage_key) {
        Some(policy) => policy,
        None => {
            if config.strict_schema {
                return Err(format!(
                    "stage '{}' kind '{}' is missing policy under [stage_schemas.schemas.{}]",
                    stage.id, stage_key, stage_key
                ));
            }
            return Ok(String::new());
        }
    };

    let schema_version = match stage_schema_version(stage) {
        Some(version) if !version.trim().is_empty() => version.trim(),
        _ => {
            return Err(format!(
                "stage '{}' kind '{}' requires non-empty field 'schema_version' when [stage_schemas.schemas.{}] is declared",
                stage.id, stage_key, stage_key
            ));
        }
    };

    let supported_versions = if policy.supported_versions.is_empty() {
        vec![policy.expected_version.clone()]
    } else {
        policy.supported_versions.clone()
    };

    if !supported_versions
        .iter()
        .any(|supported| supported == schema_version)
    {
        return Err(format!(
            "stage '{}' kind '{}' schema_version '{}' is unsupported; supported versions: {}",
            stage.id,
            stage_key,
            schema_version,
            supported_versions.join(", ")
        ));
    }

    if schema_version != policy.expected_version && policy.migration_hook.is_none() {
        return Err(format!(
            "stage '{}' kind '{}' schema_version '{}' requires migration to expected version '{}' but no migration_hook is configured",
            stage.id, stage_key, schema_version, policy.expected_version
        ));
    }

    for required_field in &policy.required_fields {
        if !stage_payload_field_present(stage, required_field) {
            return Err(format!(
                "stage '{}' kind '{}' schema policy requires payload field '{}' to be present",
                stage.id, stage_key, required_field
            ));
        }
    }

    Ok(format!(
        "stage_schema validated (kind={}, version={}, expected={}, migration_hook={})",
        stage_key,
        schema_version,
        policy.expected_version,
        policy.migration_hook.as_deref().unwrap_or("none")
    ))
}

fn stage_schema_version(stage: &PlannedStage) -> Option<&str> {
    stage.schema_version.as_deref()
}

fn stage_payload_field_present(stage: &PlannedStage, field_name: &str) -> bool {
    match (&stage.payload, field_name) {
        (StagePayload::Scene(payload), "scene_asset") => !payload.scene_asset.trim().is_empty(),
        (StagePayload::Scene(payload), "scene_format") => !payload.scene_format.trim().is_empty(),
        (StagePayload::Scene(_), "enable_hot_reload") => true,
        (StagePayload::KainHotReload(payload), "source_registry") => {
            !payload.source_registry.trim().is_empty()
        }
        (StagePayload::KainHotReload(payload), "watch_roots") => !payload.watch_roots.is_empty(),
        (StagePayload::KainHotReload(_), "debounce_ms") => true,
        (StagePayload::KainHotReload(payload), "target") => !payload.target.trim().is_empty(),
        (StagePayload::NarrativeGraph(payload), "graph_asset") => {
            !payload.graph_asset.trim().is_empty()
        }
        (StagePayload::NarrativeGraph(payload), "entry_node") => {
            !payload.entry_node.trim().is_empty()
        }
        (StagePayload::NarrativeGraph(payload), "evaluate_via") => {
            !payload.evaluate_via.trim().is_empty()
        }
        (StagePayload::Cook(payload), "recipe_asset") => !payload.recipe_asset.trim().is_empty(),
        (StagePayload::Cook(payload), "output_dir") => !payload.output_dir.trim().is_empty(),
        (StagePayload::Cook(payload), "target_platform") => {
            !payload.target_platform.trim().is_empty()
        }
        (StagePayload::Build(payload), "package_asset") => !payload.package_asset.trim().is_empty(),
        (StagePayload::Build(payload), "output_dir") => !payload.output_dir.trim().is_empty(),
        (StagePayload::Build(payload), "artifact_name") => !payload.artifact_name.trim().is_empty(),
        (StagePayload::Build(payload), "target_platform") => {
            !payload.target_platform.trim().is_empty()
        }
        (StagePayload::Export(payload), "package_asset") => {
            !payload.package_asset.trim().is_empty()
        }
        (StagePayload::Export(payload), "source_dir") => !payload.source_dir.trim().is_empty(),
        (StagePayload::Export(payload), "export_path") => !payload.export_path.trim().is_empty(),
        (StagePayload::Export(payload), "package_format") => {
            !payload.package_format.trim().is_empty()
        }
        _ => false,
    }
}

fn execute_scene_adapter(payload: &SceneStagePayload, root: &Path) -> Result<String, String> {
    let scene_path = resolve_path(root, &payload.scene_asset);
    let raw = fs::read_to_string(&scene_path).map_err(|source| {
        format!(
            "failed to read scene asset '{}': {source}",
            scene_path.display()
        )
    })?;
    let scene_json: JsonValue = serde_json::from_str(&raw).map_err(|source| {
        format!(
            "failed to parse scene JSON '{}': {source}",
            scene_path.display()
        )
    })?;

    let schema = scene_json
        .get("schema")
        .and_then(|value| value.as_str())
        .ok_or_else(|| {
            format!(
                "scene asset '{}' missing string field 'schema'",
                scene_path.display()
            )
        })?;
    if schema != payload.scene_format {
        return Err(format!(
            "scene schema mismatch for '{}': expected '{}', found '{}'",
            scene_path.display(),
            payload.scene_format,
            schema
        ));
    }

    let actor_count = scene_json
        .get("actors")
        .and_then(|value| value.as_array())
        .map(|actors| actors.len())
        .ok_or_else(|| {
            format!(
                "scene asset '{}' missing array field 'actors'",
                scene_path.display()
            )
        })?;

    Ok(format!(
        "scene validated (schema={}, actors={}, hot_reload={})",
        payload.scene_format, actor_count, payload.enable_hot_reload
    ))
}

fn execute_kain_hot_reload_adapter(
    payload: &KainHotReloadPayload,
    root: &Path,
) -> Result<String, String> {
    let source_registry_path = resolve_path(root, &payload.source_registry);
    if !source_registry_path.exists() {
        return Err(format!(
            "kain source registry path does not exist: '{}'",
            source_registry_path.display()
        ));
    }

    let mut existing_watch_roots = 0usize;
    let mut missing_watch_roots = Vec::new();
    for watch_root in &payload.watch_roots {
        let watch_path = resolve_path(root, watch_root);
        if watch_path.exists() {
            existing_watch_roots += 1;
        } else {
            missing_watch_roots.push(watch_root.clone());
        }
    }

    Ok(format!(
        "kain hot reload prepared (target={}, debounce_ms={}, watch_roots_present={}, watch_roots_missing={}){}",
        payload.target,
        payload.debounce_ms,
        existing_watch_roots,
        missing_watch_roots.len(),
        if missing_watch_roots.is_empty() {
            String::new()
        } else {
            format!(" [{}]", missing_watch_roots.join(", "))
        }
    ))
}

fn execute_narrative_graph_adapter(
    payload: &NarrativeGraphPayload,
    root: &Path,
) -> Result<String, String> {
    let graph_path = resolve_path(root, &payload.graph_asset);
    let raw = fs::read_to_string(&graph_path).map_err(|source| {
        format!(
            "failed to read narrative graph asset '{}': {source}",
            graph_path.display()
        )
    })?;
    let graph_json: JsonValue = serde_json::from_str(&raw).map_err(|source| {
        format!(
            "failed to parse narrative graph JSON '{}': {source}",
            graph_path.display()
        )
    })?;

    let nodes = graph_json
        .get("nodes")
        .and_then(|value| value.as_array())
        .ok_or_else(|| {
            format!(
                "narrative graph '{}' missing array field 'nodes'",
                graph_path.display()
            )
        })?;
    let has_entry_node = nodes.iter().any(|node| {
        node.get("id")
            .and_then(|id| id.as_str())
            .map(|id| id == payload.entry_node)
            .unwrap_or(false)
    });
    if !has_entry_node {
        return Err(format!(
            "narrative graph '{}' does not contain entry node '{}'",
            graph_path.display(),
            payload.entry_node
        ));
    }

    Ok(format!(
        "narrative graph preflight validated (entry_node={}, nodes={}, evaluator={})",
        payload.entry_node,
        nodes.len(),
        payload.evaluate_via
    ))
}

fn execute_data_registry_adapter(
    payload: &DataRegistryPayload,
    root: &Path,
    config: &DataRegistryConfig,
) -> Result<String, String> {
    let registry_path = resolve_path(root, &payload.registry_asset);
    let raw = fs::read_to_string(&registry_path).map_err(|source| {
        format!(
            "failed to read data registry '{}': {source}",
            registry_path.display()
        )
    })?;
    let registry_toml: toml::Value = toml::from_str(&raw).map_err(|source| {
        format!(
            "failed to parse data registry TOML '{}': {source}",
            registry_path.display()
        )
    })?;

    let registry_kind = registry_toml
        .get("registry_kind")
        .and_then(|value| value.as_str())
        .ok_or_else(|| {
            format!(
                "data registry '{}' missing 'registry_kind'",
                registry_path.display()
            )
        })?;
    if registry_kind != payload.registry_kind {
        return Err(format!(
            "registry kind mismatch for '{}': expected '{}', found '{}'",
            registry_path.display(),
            payload.registry_kind,
            registry_kind
        ));
    }

    let version = registry_toml
        .get("version")
        .and_then(|value| value.as_str())
        .ok_or_else(|| {
            format!(
                "data registry '{}' missing string field 'version'",
                registry_path.display()
            )
        })?;
    if version.trim().is_empty() {
        return Err(format!(
            "data registry '{}' has empty 'version'",
            registry_path.display()
        ));
    }

    let schema_policy = config.schemas.get(&payload.registry_kind);
    if config.strict_schema && schema_policy.is_none() {
        return Err(format!(
            "data registry '{}' kind '{}' is missing manifest schema policy under [data_registry.schemas.{}]",
            registry_path.display(),
            payload.registry_kind,
            payload.registry_kind
        ));
    }

    let mut schema_detail = "schema_policy=none".to_string();
    if let Some(policy) = schema_policy {
        let supported_versions = if policy.supported_versions.is_empty() {
            vec![policy.expected_version.clone()]
        } else {
            policy.supported_versions.clone()
        };

        if !supported_versions
            .iter()
            .any(|supported| supported == version)
        {
            return Err(format!(
                "data registry '{}' version '{}' is unsupported for kind '{}'; supported versions: {}",
                registry_path.display(),
                version,
                payload.registry_kind,
                supported_versions.join(", ")
            ));
        }

        if version != policy.expected_version {
            match policy.migration_hook.as_ref() {
                Some(migration_hook) => {
                    schema_detail = format!(
                        "schema_policy=expected:{}, migration_hook:{}",
                        policy.expected_version, migration_hook
                    );
                }
                None => {
                    return Err(format!(
                        "data registry '{}' version '{}' for kind '{}' requires migration to expected version '{}' but no migration_hook is configured",
                        registry_path.display(),
                        version,
                        payload.registry_kind,
                        policy.expected_version
                    ));
                }
            }
        } else {
            schema_detail = format!(
                "schema_policy=expected:{}, migration_hook:{}",
                policy.expected_version,
                policy.migration_hook.as_deref().unwrap_or("none")
            );
        }

        for required_table in &policy.required_tables {
            if registry_toml.get(required_table).is_none() {
                return Err(format!(
                    "data registry '{}' missing required top-level table/array '{}'",
                    registry_path.display(),
                    required_table
                ));
            }
        }
    }

    Ok(format!(
        "data registry validated (kind={}, merge_strategy={}, version={}, {})",
        payload.registry_kind, payload.merge_strategy, version, schema_detail
    ))
}

impl PipelineManifest {
    pub fn validate(&self) -> Result<(), PipelineError> {
        if self.version.trim().is_empty() {
            return Err(PipelineError::Validation(
                "manifest field 'version' must not be empty".to_string(),
            ));
        }
        if self.product.id.trim().is_empty() {
            return Err(PipelineError::Validation(
                "manifest field 'product.id' must not be empty".to_string(),
            ));
        }
        if self.product.name.trim().is_empty() {
            return Err(PipelineError::Validation(
                "manifest field 'product.name' must not be empty".to_string(),
            ));
        }
        if self.profiles.is_empty() {
            return Err(PipelineError::Validation(
                "manifest requires at least one profile".to_string(),
            ));
        }
        if self.stages.is_empty() {
            return Err(PipelineError::Validation(
                "manifest requires at least one stage".to_string(),
            ));
        }

        for (name, profile) in &self.profiles {
            validate_non_empty(name, "profile name")?;
            validate_non_empty(&profile.runtime_host, "profile.runtime_host")?;
            validate_non_empty(&profile.renderer_contract, "profile.renderer_contract")?;
            validate_non_empty(&profile.ui_shell, "profile.ui_shell")?;
        }

        for path in &self.preflight.required_paths {
            validate_non_empty(path, "preflight.required_paths[]")?;
        }

        if self.runner.default_adapter_prefix.trim().is_empty() {
            return Err(PipelineError::Validation(
                "manifest field 'runner.default_adapter_prefix' must not be empty".to_string(),
            ));
        }

        if self.runtime_policy.required_registry_kinds.is_empty() {
            return Err(PipelineError::Validation(
                "manifest field 'runtime_policy.required_registry_kinds' must include at least one registry kind"
                    .to_string(),
            ));
        }
        for required_kind in &self.runtime_policy.required_registry_kinds {
            if required_kind.trim().is_empty() {
                return Err(PipelineError::Validation(
                    "manifest field 'runtime_policy.required_registry_kinds[]' must not be empty"
                        .to_string(),
                ));
            }
        }

        for (registry_kind, policy) in &self.data_registry.schemas {
            if registry_kind.trim().is_empty() {
                return Err(PipelineError::Validation(
                    "manifest field 'data_registry.schemas' contains an empty registry_kind key"
                        .to_string(),
                ));
            }
            if policy.expected_version.trim().is_empty() {
                return Err(PipelineError::Validation(format!(
                    "manifest field 'data_registry.schemas.{}.expected_version' must not be empty",
                    registry_kind
                )));
            }
            for supported_version in &policy.supported_versions {
                if supported_version.trim().is_empty() {
                    return Err(PipelineError::Validation(format!(
                        "manifest field 'data_registry.schemas.{}.supported_versions[]' must not be empty",
                        registry_kind
                    )));
                }
            }
            if !policy.supported_versions.is_empty()
                && !policy
                    .supported_versions
                    .iter()
                    .any(|supported| supported == &policy.expected_version)
            {
                return Err(PipelineError::Validation(format!(
                    "manifest field 'data_registry.schemas.{}.supported_versions' must include expected_version '{}'",
                    registry_kind, policy.expected_version
                )));
            }
            if let Some(migration_hook) = policy.migration_hook.as_ref() {
                if migration_hook.trim().is_empty() {
                    return Err(PipelineError::Validation(format!(
                        "manifest field 'data_registry.schemas.{}.migration_hook' must not be empty when provided",
                        registry_kind
                    )));
                }
            }
            for required_table in &policy.required_tables {
                if required_table.trim().is_empty() {
                    return Err(PipelineError::Validation(format!(
                        "manifest field 'data_registry.schemas.{}.required_tables[]' must not be empty",
                        registry_kind
                    )));
                }
            }
        }

        for (stage_kind, policy) in &self.stage_schemas.schemas {
            let parsed_kind = parse_stage_kind_key(stage_kind).ok_or_else(|| {
                PipelineError::Validation(format!(
                    "manifest field 'stage_schemas.schemas' contains unknown stage kind key '{}'",
                    stage_kind
                ))
            })?;
            if parsed_kind == StageKind::DataRegistry {
                return Err(PipelineError::Validation(
                    "manifest field 'stage_schemas.schemas.data_registry' is not supported; use [data_registry.schemas.*] for registry payload evolution".to_string(),
                ));
            }
            if policy.expected_version.trim().is_empty() {
                return Err(PipelineError::Validation(format!(
                    "manifest field 'stage_schemas.schemas.{}.expected_version' must not be empty",
                    stage_kind
                )));
            }
            for supported_version in &policy.supported_versions {
                if supported_version.trim().is_empty() {
                    return Err(PipelineError::Validation(format!(
                        "manifest field 'stage_schemas.schemas.{}.supported_versions[]' must not be empty",
                        stage_kind
                    )));
                }
            }
            if !policy.supported_versions.is_empty()
                && !policy
                    .supported_versions
                    .iter()
                    .any(|supported| supported == &policy.expected_version)
            {
                return Err(PipelineError::Validation(format!(
                    "manifest field 'stage_schemas.schemas.{}.supported_versions' must include expected_version '{}'",
                    stage_kind, policy.expected_version
                )));
            }
            if let Some(migration_hook) = policy.migration_hook.as_ref() {
                if migration_hook.trim().is_empty() {
                    return Err(PipelineError::Validation(format!(
                        "manifest field 'stage_schemas.schemas.{}.migration_hook' must not be empty when provided",
                        stage_kind
                    )));
                }
            }
            for required_field in &policy.required_fields {
                if required_field.trim().is_empty() {
                    return Err(PipelineError::Validation(format!(
                        "manifest field 'stage_schemas.schemas.{}.required_fields[]' must not be empty",
                        stage_kind
                    )));
                }
            }
        }

        let mut stage_ids = HashSet::new();
        for stage in &self.stages {
            validate_non_empty(&stage.id, "stage.id")?;
            if !stage_ids.insert(stage.id.clone()) {
                return Err(PipelineError::Validation(format!(
                    "duplicate stage id '{}'",
                    stage.id
                )));
            }
            if !self.profiles.contains_key(&stage.profile) {
                return Err(PipelineError::Validation(format!(
                    "stage '{}' references unknown profile '{}'",
                    stage.id, stage.profile
                )));
            }
            stage.validate_fields()?;
            if self.data_registry.strict_schema && stage.kind == StageKind::DataRegistry {
                let registry_kind = stage.registry_kind.as_ref().ok_or_else(|| {
                    PipelineError::Validation(format!(
                        "stage '{}' missing required field 'registry_kind' for {:?} stage",
                        stage.id,
                        StageKind::DataRegistry
                    ))
                })?;
                if !self.data_registry.schemas.contains_key(registry_kind) {
                    return Err(PipelineError::Validation(format!(
                        "stage '{}' data registry kind '{}' is missing policy under [data_registry.schemas.{}]",
                        stage.id, registry_kind, registry_kind
                    )));
                }
            }
            if stage.kind != StageKind::DataRegistry
                && self.stage_schemas.strict_schema
                && !self.stage_schemas.schemas.contains_key(stage.kind.as_key())
            {
                return Err(PipelineError::Validation(format!(
                    "stage '{}' kind '{}' is missing policy under [stage_schemas.schemas.{}]",
                    stage.id,
                    stage.kind.as_key(),
                    stage.kind.as_key()
                )));
            }
            if stage.kind != StageKind::DataRegistry
                && self.stage_schemas.schemas.contains_key(stage.kind.as_key())
            {
                let schema_version = stage.schema_version.as_ref().ok_or_else(|| {
                    PipelineError::Validation(format!(
                        "stage '{}' kind '{}' requires field 'schema_version' because [stage_schemas.schemas.{}] is declared",
                        stage.id,
                        stage.kind.as_key(),
                        stage.kind.as_key()
                    ))
                })?;
                if schema_version.trim().is_empty() {
                    return Err(PipelineError::Validation(format!(
                        "stage '{}' field 'schema_version' must not be empty",
                        stage.id
                    )));
                }
            }
        }

        for stage in &self.stages {
            for dependency in &stage.depends_on {
                if dependency == &stage.id {
                    return Err(PipelineError::Validation(format!(
                        "stage '{}' cannot depend on itself",
                        stage.id
                    )));
                }
                if !stage_ids.contains(dependency) {
                    return Err(PipelineError::Validation(format!(
                        "stage '{}' depends on unknown stage '{}'",
                        stage.id, dependency
                    )));
                }
            }
        }

        let cycle = detect_dependency_cycle(&self.stages);
        if let Some(cycle_path) = cycle {
            return Err(PipelineError::Validation(format!(
                "dependency cycle detected: {}",
                cycle_path.join(" -> ")
            )));
        }

        Ok(())
    }
}

impl PipelineStage {
    fn validate_fields(&self) -> Result<(), PipelineError> {
        match self.kind {
            StageKind::Scene => {
                required_field(&self.scene_asset, &self.id, "scene_asset")?;
                required_field(&self.scene_format, &self.id, "scene_format")?;
                forbid_field(self.source_registry.as_ref(), &self.id, "source_registry")?;
                forbid_field(self.watch_roots.as_ref(), &self.id, "watch_roots")?;
                forbid_field(self.debounce_ms.as_ref(), &self.id, "debounce_ms")?;
                forbid_field(self.target.as_ref(), &self.id, "target")?;
                forbid_field(self.graph_asset.as_ref(), &self.id, "graph_asset")?;
                forbid_field(self.entry_node.as_ref(), &self.id, "entry_node")?;
                forbid_field(self.evaluate_via.as_ref(), &self.id, "evaluate_via")?;
                forbid_field(self.registry_kind.as_ref(), &self.id, "registry_kind")?;
                forbid_field(self.registry_asset.as_ref(), &self.id, "registry_asset")?;
                forbid_field(self.merge_strategy.as_ref(), &self.id, "merge_strategy")?;
                if let Some(schema_version) = self.schema_version.as_ref() {
                    validate_non_empty(schema_version, "stage.schema_version")?;
                }
            }
            StageKind::KainHotReload => {
                required_field(&self.source_registry, &self.id, "source_registry")?;
                let watch_roots = required_field(&self.watch_roots, &self.id, "watch_roots")?;
                if watch_roots.is_empty() {
                    return Err(PipelineError::Validation(format!(
                        "stage '{}' field 'watch_roots' must contain at least one path",
                        self.id
                    )));
                }
                if let Some(debounce_ms) = self.debounce_ms {
                    if debounce_ms == 0 {
                        return Err(PipelineError::Validation(format!(
                            "stage '{}' field 'debounce_ms' must be greater than 0",
                            self.id
                        )));
                    }
                }
                required_field(&self.target, &self.id, "target")?;
                forbid_field(self.scene_asset.as_ref(), &self.id, "scene_asset")?;
                forbid_field(self.scene_format.as_ref(), &self.id, "scene_format")?;
                forbid_field(self.graph_asset.as_ref(), &self.id, "graph_asset")?;
                forbid_field(self.entry_node.as_ref(), &self.id, "entry_node")?;
                forbid_field(self.evaluate_via.as_ref(), &self.id, "evaluate_via")?;
                forbid_field(self.registry_kind.as_ref(), &self.id, "registry_kind")?;
                forbid_field(self.registry_asset.as_ref(), &self.id, "registry_asset")?;
                forbid_field(self.merge_strategy.as_ref(), &self.id, "merge_strategy")?;
                if let Some(schema_version) = self.schema_version.as_ref() {
                    validate_non_empty(schema_version, "stage.schema_version")?;
                }
            }
            StageKind::NarrativeGraph => {
                required_field(&self.graph_asset, &self.id, "graph_asset")?;
                required_field(&self.entry_node, &self.id, "entry_node")?;
                required_field(&self.evaluate_via, &self.id, "evaluate_via")?;
                forbid_field(self.scene_asset.as_ref(), &self.id, "scene_asset")?;
                forbid_field(self.scene_format.as_ref(), &self.id, "scene_format")?;
                forbid_field(self.source_registry.as_ref(), &self.id, "source_registry")?;
                forbid_field(self.watch_roots.as_ref(), &self.id, "watch_roots")?;
                forbid_field(self.debounce_ms.as_ref(), &self.id, "debounce_ms")?;
                forbid_field(self.target.as_ref(), &self.id, "target")?;
                forbid_field(self.registry_kind.as_ref(), &self.id, "registry_kind")?;
                forbid_field(self.registry_asset.as_ref(), &self.id, "registry_asset")?;
                forbid_field(self.merge_strategy.as_ref(), &self.id, "merge_strategy")?;
                if let Some(schema_version) = self.schema_version.as_ref() {
                    validate_non_empty(schema_version, "stage.schema_version")?;
                }
            }
            StageKind::DataRegistry => {
                required_field(&self.registry_kind, &self.id, "registry_kind")?;
                required_field(&self.registry_asset, &self.id, "registry_asset")?;
                if let Some(merge_strategy) = self.merge_strategy.as_ref() {
                    validate_non_empty(merge_strategy, "stage.merge_strategy")?;
                }
                forbid_field(self.scene_asset.as_ref(), &self.id, "scene_asset")?;
                forbid_field(self.scene_format.as_ref(), &self.id, "scene_format")?;
                forbid_field(self.source_registry.as_ref(), &self.id, "source_registry")?;
                forbid_field(self.watch_roots.as_ref(), &self.id, "watch_roots")?;
                forbid_field(self.debounce_ms.as_ref(), &self.id, "debounce_ms")?;
                forbid_field(self.target.as_ref(), &self.id, "target")?;
                forbid_field(self.graph_asset.as_ref(), &self.id, "graph_asset")?;
                forbid_field(self.entry_node.as_ref(), &self.id, "entry_node")?;
                forbid_field(self.evaluate_via.as_ref(), &self.id, "evaluate_via")?;
                forbid_field(self.schema_version.as_ref(), &self.id, "schema_version")?;
                forbid_field(self.recipe_asset.as_ref(), &self.id, "recipe_asset")?;
                forbid_field(self.output_dir.as_ref(), &self.id, "output_dir")?;
                forbid_field(self.target_platform.as_ref(), &self.id, "target_platform")?;
                forbid_field(self.package_asset.as_ref(), &self.id, "package_asset")?;
                forbid_field(self.artifact_name.as_ref(), &self.id, "artifact_name")?;
                forbid_field(self.package_format.as_ref(), &self.id, "package_format")?;
                forbid_field(self.source_dir.as_ref(), &self.id, "source_dir")?;
                forbid_field(self.export_path.as_ref(), &self.id, "export_path")?;
            }
            StageKind::Cook => {
                required_field(&self.recipe_asset, &self.id, "recipe_asset")?;
                required_field(&self.output_dir, &self.id, "output_dir")?;
                required_field(&self.target_platform, &self.id, "target_platform")?;
                if let Some(schema_version) = self.schema_version.as_ref() {
                    validate_non_empty(schema_version, "stage.schema_version")?;
                }
                forbid_field(self.scene_asset.as_ref(), &self.id, "scene_asset")?;
                forbid_field(self.scene_format.as_ref(), &self.id, "scene_format")?;
                forbid_field(
                    self.enable_hot_reload.as_ref(),
                    &self.id,
                    "enable_hot_reload",
                )?;
                forbid_field(self.source_registry.as_ref(), &self.id, "source_registry")?;
                forbid_field(self.watch_roots.as_ref(), &self.id, "watch_roots")?;
                forbid_field(self.debounce_ms.as_ref(), &self.id, "debounce_ms")?;
                forbid_field(self.target.as_ref(), &self.id, "target")?;
                forbid_field(self.graph_asset.as_ref(), &self.id, "graph_asset")?;
                forbid_field(self.entry_node.as_ref(), &self.id, "entry_node")?;
                forbid_field(self.evaluate_via.as_ref(), &self.id, "evaluate_via")?;
                forbid_field(self.registry_kind.as_ref(), &self.id, "registry_kind")?;
                forbid_field(self.registry_asset.as_ref(), &self.id, "registry_asset")?;
                forbid_field(self.merge_strategy.as_ref(), &self.id, "merge_strategy")?;
                forbid_field(self.package_asset.as_ref(), &self.id, "package_asset")?;
                forbid_field(self.artifact_name.as_ref(), &self.id, "artifact_name")?;
                forbid_field(self.package_format.as_ref(), &self.id, "package_format")?;
                forbid_field(self.source_dir.as_ref(), &self.id, "source_dir")?;
                forbid_field(self.export_path.as_ref(), &self.id, "export_path")?;
            }
            StageKind::Build => {
                required_field(&self.package_asset, &self.id, "package_asset")?;
                required_field(&self.output_dir, &self.id, "output_dir")?;
                required_field(&self.artifact_name, &self.id, "artifact_name")?;
                required_field(&self.target_platform, &self.id, "target_platform")?;
                if let Some(schema_version) = self.schema_version.as_ref() {
                    validate_non_empty(schema_version, "stage.schema_version")?;
                }
                forbid_field(self.scene_asset.as_ref(), &self.id, "scene_asset")?;
                forbid_field(self.scene_format.as_ref(), &self.id, "scene_format")?;
                forbid_field(
                    self.enable_hot_reload.as_ref(),
                    &self.id,
                    "enable_hot_reload",
                )?;
                forbid_field(self.source_registry.as_ref(), &self.id, "source_registry")?;
                forbid_field(self.watch_roots.as_ref(), &self.id, "watch_roots")?;
                forbid_field(self.debounce_ms.as_ref(), &self.id, "debounce_ms")?;
                forbid_field(self.target.as_ref(), &self.id, "target")?;
                forbid_field(self.graph_asset.as_ref(), &self.id, "graph_asset")?;
                forbid_field(self.entry_node.as_ref(), &self.id, "entry_node")?;
                forbid_field(self.evaluate_via.as_ref(), &self.id, "evaluate_via")?;
                forbid_field(self.registry_kind.as_ref(), &self.id, "registry_kind")?;
                forbid_field(self.registry_asset.as_ref(), &self.id, "registry_asset")?;
                forbid_field(self.merge_strategy.as_ref(), &self.id, "merge_strategy")?;
                forbid_field(self.recipe_asset.as_ref(), &self.id, "recipe_asset")?;
                forbid_field(self.package_format.as_ref(), &self.id, "package_format")?;
                forbid_field(self.source_dir.as_ref(), &self.id, "source_dir")?;
                forbid_field(self.export_path.as_ref(), &self.id, "export_path")?;
            }
            StageKind::Export => {
                required_field(&self.package_asset, &self.id, "package_asset")?;
                required_field(&self.source_dir, &self.id, "source_dir")?;
                required_field(&self.export_path, &self.id, "export_path")?;
                required_field(&self.package_format, &self.id, "package_format")?;
                if let Some(schema_version) = self.schema_version.as_ref() {
                    validate_non_empty(schema_version, "stage.schema_version")?;
                }
                forbid_field(self.scene_asset.as_ref(), &self.id, "scene_asset")?;
                forbid_field(self.scene_format.as_ref(), &self.id, "scene_format")?;
                forbid_field(
                    self.enable_hot_reload.as_ref(),
                    &self.id,
                    "enable_hot_reload",
                )?;
                forbid_field(self.source_registry.as_ref(), &self.id, "source_registry")?;
                forbid_field(self.watch_roots.as_ref(), &self.id, "watch_roots")?;
                forbid_field(self.debounce_ms.as_ref(), &self.id, "debounce_ms")?;
                forbid_field(self.target.as_ref(), &self.id, "target")?;
                forbid_field(self.graph_asset.as_ref(), &self.id, "graph_asset")?;
                forbid_field(self.entry_node.as_ref(), &self.id, "entry_node")?;
                forbid_field(self.evaluate_via.as_ref(), &self.id, "evaluate_via")?;
                forbid_field(self.registry_kind.as_ref(), &self.id, "registry_kind")?;
                forbid_field(self.registry_asset.as_ref(), &self.id, "registry_asset")?;
                forbid_field(self.merge_strategy.as_ref(), &self.id, "merge_strategy")?;
                forbid_field(self.recipe_asset.as_ref(), &self.id, "recipe_asset")?;
                forbid_field(self.output_dir.as_ref(), &self.id, "output_dir")?;
                forbid_field(self.target_platform.as_ref(), &self.id, "target_platform")?;
                forbid_field(self.artifact_name.as_ref(), &self.id, "artifact_name")?;
            }
        }
        Ok(())
    }

    fn payload(&self) -> Result<StagePayload, PipelineError> {
        match self.kind {
            StageKind::Scene => Ok(StagePayload::Scene(SceneStagePayload {
                scene_asset: required_field(&self.scene_asset, &self.id, "scene_asset")?.clone(),
                scene_format: required_field(&self.scene_format, &self.id, "scene_format")?.clone(),
                enable_hot_reload: self.enable_hot_reload.unwrap_or(true),
            })),
            StageKind::KainHotReload => Ok(StagePayload::KainHotReload(KainHotReloadPayload {
                source_registry: required_field(
                    &self.source_registry,
                    &self.id,
                    "source_registry",
                )?
                .clone(),
                watch_roots: required_field(&self.watch_roots, &self.id, "watch_roots")?.clone(),
                debounce_ms: self.debounce_ms.unwrap_or(100),
                target: required_field(&self.target, &self.id, "target")?.clone(),
            })),
            StageKind::NarrativeGraph => Ok(StagePayload::NarrativeGraph(NarrativeGraphPayload {
                graph_asset: required_field(&self.graph_asset, &self.id, "graph_asset")?.clone(),
                entry_node: required_field(&self.entry_node, &self.id, "entry_node")?.clone(),
                evaluate_via: required_field(&self.evaluate_via, &self.id, "evaluate_via")?.clone(),
            })),
            StageKind::DataRegistry => Ok(StagePayload::DataRegistry(DataRegistryPayload {
                registry_kind: required_field(&self.registry_kind, &self.id, "registry_kind")?
                    .clone(),
                registry_asset: required_field(&self.registry_asset, &self.id, "registry_asset")?
                    .clone(),
                merge_strategy: self
                    .merge_strategy
                    .clone()
                    .unwrap_or_else(|| "replace".to_string()),
            })),
            StageKind::Cook => Ok(StagePayload::Cook(CookStagePayload {
                recipe_asset: required_field(&self.recipe_asset, &self.id, "recipe_asset")?.clone(),
                output_dir: required_field(&self.output_dir, &self.id, "output_dir")?.clone(),
                target_platform: required_field(
                    &self.target_platform,
                    &self.id,
                    "target_platform",
                )?
                .clone(),
            })),
            StageKind::Build => Ok(StagePayload::Build(BuildStagePayload {
                package_asset: required_field(&self.package_asset, &self.id, "package_asset")?
                    .clone(),
                output_dir: required_field(&self.output_dir, &self.id, "output_dir")?.clone(),
                artifact_name: required_field(&self.artifact_name, &self.id, "artifact_name")?
                    .clone(),
                target_platform: required_field(
                    &self.target_platform,
                    &self.id,
                    "target_platform",
                )?
                .clone(),
            })),
            StageKind::Export => Ok(StagePayload::Export(ExportStagePayload {
                package_asset: required_field(&self.package_asset, &self.id, "package_asset")?
                    .clone(),
                source_dir: required_field(&self.source_dir, &self.id, "source_dir")?.clone(),
                export_path: required_field(&self.export_path, &self.id, "export_path")?.clone(),
                package_format: required_field(&self.package_format, &self.id, "package_format")?
                    .clone(),
            })),
        }
    }
}

fn default_true() -> bool {
    true
}

fn default_runner_prefix() -> String {
    "builtin::".to_string()
}

fn default_required_runtime_registry_kinds() -> Vec<String> {
    [
        "input_bindings",
        "gameplay_tags",
        "actor_archetypes",
        "camera_rigs",
        "visual_scripting",
    ]
    .into_iter()
    .map(ToOwned::to_owned)
    .collect()
}

fn configured_workspace_root_or_default(
    preflight: &PreflightConfig,
    fallback_root: impl AsRef<Path>,
) -> PathBuf {
    match preflight.workspace_root.as_ref() {
        Some(config_root) if !config_root.trim().is_empty() => PathBuf::from(config_root),
        _ => fallback_root.as_ref().to_path_buf(),
    }
}

fn resolve_path(root: &Path, configured_path: &str) -> PathBuf {
    let candidate = Path::new(configured_path);
    if candidate.is_absolute() {
        candidate.to_path_buf()
    } else {
        root.join(candidate)
    }
}

fn collect_referenced_paths(manifest: &PipelineManifest) -> BTreeSet<String> {
    let mut paths = BTreeSet::new();

    for required in &manifest.preflight.required_paths {
        if !required.trim().is_empty() {
            paths.insert(required.clone());
        }
    }

    for stage in &manifest.stages {
        match stage.kind {
            StageKind::Scene => {
                if let Some(scene_asset) = stage.scene_asset.as_ref() {
                    paths.insert(scene_asset.clone());
                }
            }
            StageKind::KainHotReload => {
                if let Some(source_registry) = stage.source_registry.as_ref() {
                    paths.insert(source_registry.clone());
                }
                if let Some(watch_roots) = stage.watch_roots.as_ref() {
                    for watch_root in watch_roots {
                        paths.insert(watch_root.clone());
                    }
                }
            }
            StageKind::NarrativeGraph => {
                if let Some(graph_asset) = stage.graph_asset.as_ref() {
                    paths.insert(graph_asset.clone());
                }
            }
            StageKind::DataRegistry => {
                if let Some(registry_asset) = stage.registry_asset.as_ref() {
                    paths.insert(registry_asset.clone());
                }
            }
            StageKind::Cook => {
                if let Some(recipe_asset) = stage.recipe_asset.as_ref() {
                    paths.insert(recipe_asset.clone());
                }
                if let Some(output_dir) = stage.output_dir.as_ref() {
                    paths.insert(output_dir.clone());
                }
            }
            StageKind::Build => {
                if let Some(package_asset) = stage.package_asset.as_ref() {
                    paths.insert(package_asset.clone());
                }
                if let Some(output_dir) = stage.output_dir.as_ref() {
                    paths.insert(output_dir.clone());
                }
            }
            StageKind::Export => {
                if let Some(package_asset) = stage.package_asset.as_ref() {
                    paths.insert(package_asset.clone());
                }
                if let Some(source_dir) = stage.source_dir.as_ref() {
                    paths.insert(source_dir.clone());
                }
            }
        }
    }

    paths
}

fn resolve_adapter_id(config: &RunnerConfig, stage_kind: &StageKind) -> String {
    if let Some(adapter) = config.adapters.get(stage_kind.as_key()) {
        return adapter.clone();
    }

    format!("{}{}", config.default_adapter_prefix, stage_kind.as_key())
}

fn parse_stage_kind_key(value: &str) -> Option<StageKind> {
    match value {
        "scene" => Some(StageKind::Scene),
        "kain_hot_reload" => Some(StageKind::KainHotReload),
        "narrative_graph" => Some(StageKind::NarrativeGraph),
        "data_registry" => Some(StageKind::DataRegistry),
        "cook" => Some(StageKind::Cook),
        "build" => Some(StageKind::Build),
        "export" => Some(StageKind::Export),
        _ => None,
    }
}

fn validate_non_empty(value: &str, field_name: &str) -> Result<(), PipelineError> {
    if value.trim().is_empty() {
        return Err(PipelineError::Validation(format!(
            "manifest field '{}' must not be empty",
            field_name
        )));
    }
    Ok(())
}

fn required_field<'a, T>(
    value: &'a Option<T>,
    stage_id: &str,
    field_name: &str,
) -> Result<&'a T, PipelineError> {
    value.as_ref().ok_or_else(|| {
        PipelineError::Validation(format!(
            "stage '{}' missing required field '{}' for {:?} stage",
            stage_id,
            field_name,
            infer_kind_for_field(field_name)
        ))
    })
}

fn forbid_field<T>(
    value: Option<&T>,
    stage_id: &str,
    field_name: &str,
) -> Result<(), PipelineError> {
    if value.is_some() {
        return Err(PipelineError::Validation(format!(
            "stage '{}' includes unsupported field '{}' for this stage kind",
            stage_id, field_name
        )));
    }
    Ok(())
}

fn infer_kind_for_field(field_name: &str) -> StageKind {
    match field_name {
        "scene_asset" | "scene_format" | "enable_hot_reload" => StageKind::Scene,
        "source_registry" | "watch_roots" | "debounce_ms" | "target" => StageKind::KainHotReload,
        "graph_asset" | "entry_node" | "evaluate_via" => StageKind::NarrativeGraph,
        "registry_kind" | "registry_asset" | "merge_strategy" => StageKind::DataRegistry,
        "recipe_asset" | "output_dir" | "target_platform" => StageKind::Cook,
        "package_asset" | "artifact_name" => StageKind::Build,
        "source_dir" | "export_path" | "package_format" => StageKind::Export,
        _ => StageKind::DataRegistry,
    }
}

fn detect_dependency_cycle(stages: &[PipelineStage]) -> Option<Vec<String>> {
    #[derive(Clone, Copy, PartialEq, Eq)]
    enum Mark {
        Visiting,
        Visited,
    }

    fn dfs(
        node_id: &str,
        index: &BTreeMap<String, &PipelineStage>,
        marks: &mut BTreeMap<String, Mark>,
        stack: &mut Vec<String>,
    ) -> Option<Vec<String>> {
        marks.insert(node_id.to_string(), Mark::Visiting);
        stack.push(node_id.to_string());

        if let Some(stage) = index.get(node_id) {
            for dependency in &stage.depends_on {
                match marks.get(dependency) {
                    Some(Mark::Visiting) => {
                        if let Some(cycle_start) = stack.iter().position(|id| id == dependency) {
                            let mut cycle = stack[cycle_start..].to_vec();
                            cycle.push(dependency.clone());
                            return Some(cycle);
                        }
                        return Some(vec![dependency.clone(), dependency.clone()]);
                    }
                    Some(Mark::Visited) => continue,
                    None => {
                        if let Some(cycle) = dfs(dependency, index, marks, stack) {
                            return Some(cycle);
                        }
                    }
                }
            }
        }

        stack.pop();
        marks.insert(node_id.to_string(), Mark::Visited);
        None
    }

    let index: BTreeMap<String, &PipelineStage> = stages
        .iter()
        .map(|stage| (stage.id.clone(), stage))
        .collect();
    let mut marks: BTreeMap<String, Mark> = BTreeMap::new();
    let mut stack = Vec::new();

    for stage in stages {
        if marks.contains_key(&stage.id) {
            continue;
        }
        if let Some(cycle) = dfs(&stage.id, &index, &mut marks, &mut stack) {
            return Some(cycle);
        }
    }

    None
}

pub fn stage_ids(manifest: &PipelineManifest) -> BTreeSet<String> {
    manifest
        .stages
        .iter()
        .map(|stage| stage.id.clone())
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn base_manifest() -> String {
        r#"
version = "1"

[product]
id = "k_os_game"
name = "K_OS Game"

[profiles.editor_preview]
runtime_host = "bevy"
renderer_contract = "k-os-renderer"
ui_shell = "react_tauri"
features = ["live_reload", "narrative"]

[profiles.runtime_play]
runtime_host = "bevy"
renderer_contract = "k-os-renderer"
ui_shell = "bevy_egui"
features = ["play_mode"]

[runtime_policy]
required_registry_kinds = ["input_bindings", "gameplay_tags", "actor_archetypes", "camera_rigs", "visual_scripting"]
strict_readiness = true

[preflight]
workspace_root = ""
required_paths = []
fail_on_missing = false

[runner]
strict_adapter_binding = false
default_adapter_prefix = "builtin::"

[runner.adapters]
scene = "adapter::scene_loader"
kain_hot_reload = "adapter::kain_compiler"
narrative_graph = "adapter::narrative_eval"
data_registry = "adapter::registry_loader"

[[stages]]
id = "scene_bootstrap"
kind = "scene"
profile = "editor_preview"
scene_asset = "sources/game/assets/scenes/sandbox.kscene"
scene_format = "k_os_scene_v1"
enable_hot_reload = true

[[stages]]
id = "kain_hot_reload"
kind = "kain_hot_reload"
profile = "editor_preview"
depends_on = ["scene_bootstrap"]
source_registry = "crates/k-os-kain/domains/supermotion"
watch_roots = ["sources/game/scripts", "sources/kain/domains"]
debounce_ms = 120
target = "gameplay"

[[stages]]
id = "gameplay_tags_registry"
kind = "data_registry"
profile = "editor_preview"
depends_on = ["scene_bootstrap"]
registry_kind = "gameplay_tags"
registry_asset = "sources/game/assets/gameplay/tags.registry.toml"
merge_strategy = "append_unique"

[[stages]]
id = "narrative_graph"
kind = "narrative_graph"
profile = "runtime_play"
depends_on = ["scene_bootstrap", "kain_hot_reload", "gameplay_tags_registry"]
graph_asset = "sources/game/assets/narrative/intro.kgraph"
entry_node = "boot"
evaluate_via = "k-os-eval"
"#
        .to_string()
    }

    fn unique_temp_dir(label: &str) -> PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("clock should be monotonic")
            .as_nanos();
        std::env::temp_dir().join(format!("k_os_game_runtime_{label}_{nanos}"))
    }

    fn with_data_registry_config(manifest: &str, config_block: &str) -> String {
        manifest.replacen("[[stages]]", &format!("{config_block}\n\n[[stages]]"), 1)
    }

    fn with_stage_schema_versions(manifest: &str) -> String {
        manifest
            .replace(
                "enable_hot_reload = true",
                "enable_hot_reload = true\nschema_version = \"1\"",
            )
            .replace(
                "target = \"gameplay\"",
                "target = \"gameplay\"\nschema_version = \"1\"",
            )
            .replace(
                "evaluate_via = \"k-os-eval\"",
                "evaluate_via = \"k-os-eval\"\nschema_version = \"1\"",
            )
    }

    fn with_packaging_stages(manifest: &str) -> String {
        let manifest = manifest.replace(
            "data_registry = \"adapter::registry_loader\"",
            "data_registry = \"adapter::registry_loader\"\ncook = \"adapter::cook\"\nbuild = \"adapter::build\"\nexport = \"adapter::export\"",
        );
        format!(
            "{manifest}\n\n[[stages]]\nid = \"cook_windows_content\"\nkind = \"cook\"\nprofile = \"runtime_play\"\ndepends_on = [\"narrative_graph\"]\nrecipe_asset = \"sources/game/assets/packaging/windows.cook.toml\"\noutput_dir = \"sources/game/build/cooked/windows\"\ntarget_platform = \"windows\"\nschema_version = \"1\"\n\n[[stages]]\nid = \"build_windows_player\"\nkind = \"build\"\nprofile = \"runtime_play\"\ndepends_on = [\"cook_windows_content\"]\npackage_asset = \"sources/game/assets/packaging/windows.build.toml\"\noutput_dir = \"sources/game/build/player/windows\"\nartifact_name = \"k_os_game_windows_dev\"\ntarget_platform = \"windows\"\nschema_version = \"1\"\n\n[[stages]]\nid = \"export_windows_bundle\"\nkind = \"export\"\nprofile = \"runtime_play\"\ndepends_on = [\"build_windows_player\"]\npackage_asset = \"sources/game/assets/packaging/windows.export.toml\"\nsource_dir = \"sources/game/build/player/windows\"\nexport_path = \"dist/game/k_os_game_windows_dev.zip\"\npackage_format = \"zip\"\nschema_version = \"1\"\n"
        )
    }

    #[test]
    fn builds_execution_plan_in_dependency_order() {
        let manifest = load_manifest_from_str(&base_manifest()).expect("manifest should parse");
        let plan = build_execution_plan(&manifest).expect("plan should be valid");

        assert_eq!(
            plan.ordered_stage_ids,
            vec![
                "scene_bootstrap".to_string(),
                "gameplay_tags_registry".to_string(),
                "kain_hot_reload".to_string(),
                "narrative_graph".to_string()
            ]
        );
        assert_eq!(plan.stages.len(), 4);
    }

    #[test]
    fn rejects_duplicate_stage_ids() {
        let mut manifest = base_manifest();
        manifest.push_str(
            r#"
[[stages]]
id = "scene_bootstrap"
kind = "scene"
profile = "editor_preview"
scene_asset = "sources/game/assets/scenes/dupe.kscene"
scene_format = "k_os_scene_v1"
"#,
        );

        let err = load_manifest_from_str(&manifest).expect_err("duplicate stage id should fail");
        assert!(err.to_string().contains("duplicate stage id"));
    }

    #[test]
    fn rejects_unknown_dependency() {
        let manifest = base_manifest().replace(
            "depends_on = [\"scene_bootstrap\"]",
            "depends_on = [\"missing_stage\"]",
        );

        let err = load_manifest_from_str(&manifest).expect_err("unknown dependency should fail");
        assert!(err.to_string().contains("depends on unknown stage"));
    }

    #[test]
    fn rejects_cycle() {
        let manifest = base_manifest().replace(
            "depends_on = [\"scene_bootstrap\"]",
            "depends_on = [\"scene_bootstrap\", \"narrative_graph\"]",
        );

        let err = load_manifest_from_str(&manifest).expect_err("cycle should fail");
        assert!(err.to_string().contains("dependency cycle detected"));
    }

    #[test]
    fn rejects_unknown_profile() {
        let manifest =
            base_manifest().replace("profile = \"runtime_play\"", "profile = \"shipping\"");

        let err = load_manifest_from_str(&manifest).expect_err("unknown profile should fail");
        assert!(err.to_string().contains("unknown profile"));
    }

    #[test]
    fn rejects_stage_specific_payload_mismatch() {
        let manifest = base_manifest().replace(
            "watch_roots = [\"sources/game/scripts\", \"sources/kain/domains\"]",
            "watch_roots = []",
        );

        let err = load_manifest_from_str(&manifest).expect_err("empty watch roots should fail");
        assert!(err.to_string().contains("watch_roots"));
    }

    #[test]
    fn runtime_policy_rejects_empty_registry_kind_entries() {
        let manifest = base_manifest().replace(
            "required_registry_kinds = [\"input_bindings\", \"gameplay_tags\", \"actor_archetypes\", \"camera_rigs\", \"visual_scripting\"]",
            "required_registry_kinds = [\"input_bindings\", \"\"]",
        );

        let err =
            load_manifest_from_str(&manifest).expect_err("empty runtime policy kind should fail");
        assert!(err
            .to_string()
            .contains("runtime_policy.required_registry_kinds[]"));
    }

    #[test]
    fn runtime_policy_defaults_when_not_declared() {
        let manifest = base_manifest().replace(
            "[runtime_policy]\nrequired_registry_kinds = [\"input_bindings\", \"gameplay_tags\", \"actor_archetypes\", \"camera_rigs\", \"visual_scripting\"]\nstrict_readiness = true\n\n",
            "",
        );
        let parsed = load_manifest_from_str(&manifest).expect("manifest should parse");
        assert_eq!(
            parsed.runtime_policy.required_registry_kinds,
            vec![
                "input_bindings".to_string(),
                "gameplay_tags".to_string(),
                "actor_archetypes".to_string(),
                "camera_rigs".to_string(),
                "visual_scripting".to_string(),
            ]
        );
        assert!(parsed.runtime_policy.strict_readiness);
    }

    #[test]
    fn preflight_reports_missing_paths() {
        let manifest = load_manifest_from_str(&base_manifest()).expect("manifest should parse");
        let temp_root = unique_temp_dir("preflight_missing");
        fs::create_dir_all(&temp_root).expect("temp root should be created");

        let report = run_preflight_checks(&manifest, &temp_root)
            .expect("preflight should pass in warn mode");
        assert!(!report.checked_paths.is_empty());
        assert!(!report.missing_paths.is_empty());

        let _ = fs::remove_dir_all(&temp_root);
    }

    #[test]
    fn preflight_fails_when_configured_to_fail_on_missing() {
        let manifest_str =
            base_manifest().replace("fail_on_missing = false", "fail_on_missing = true");
        let manifest = load_manifest_from_str(&manifest_str).expect("manifest should parse");
        let temp_root = unique_temp_dir("preflight_fail");
        fs::create_dir_all(&temp_root).expect("temp root should be created");

        let err = run_preflight_checks(&manifest, &temp_root).expect_err("preflight should fail");
        assert!(err.to_string().contains("missing required pipeline paths"));

        let _ = fs::remove_dir_all(&temp_root);
    }

    #[test]
    fn runner_uses_manifest_adapter_map() {
        let manifest = load_manifest_from_str(&base_manifest()).expect("manifest should parse");
        let plan = build_execution_plan(&manifest).expect("plan should be valid");
        let run_report =
            execute_plan_with_runner(&manifest, &plan).expect("runner should resolve adapters");

        assert_eq!(run_report.records.len(), plan.stages.len());
        assert!(run_report
            .records
            .iter()
            .any(|record| record.adapter_id == "adapter::registry_loader"));
    }

    #[test]
    fn runner_rejects_missing_adapter_in_strict_mode() {
        let manifest_str = base_manifest()
            .replace(
                "strict_adapter_binding = false",
                "strict_adapter_binding = true",
            )
            .replace("data_registry = \"adapter::registry_loader\"", "");
        let manifest = load_manifest_from_str(&manifest_str).expect("manifest should parse");
        let plan = build_execution_plan(&manifest).expect("plan should be valid");

        let err = execute_plan_with_runner(&manifest, &plan)
            .expect_err("runner should fail in strict mode");
        assert!(err.to_string().contains("strict adapter binding enabled"));
    }

    #[test]
    fn strict_data_registry_schema_requires_policy_for_each_registry_stage() {
        let manifest_str = with_data_registry_config(
            &base_manifest(),
            r#"[data_registry]
strict_schema = true"#,
        );

        let err = load_manifest_from_str(&manifest_str)
            .expect_err("strict schema should require registry policy");
        assert!(err
            .to_string()
            .contains("missing policy under [data_registry.schemas.gameplay_tags]"));
    }

    #[test]
    fn strict_stage_schema_requires_policy_for_each_non_registry_stage() {
        let manifest_str = with_data_registry_config(
            &with_stage_schema_versions(&base_manifest()),
            r#"[stage_schemas]
strict_schema = true

[stage_schemas.schemas.scene]
expected_version = "1"
supported_versions = ["1"]
required_fields = ["scene_asset", "scene_format"]"#,
        );

        let err = load_manifest_from_str(&manifest_str)
            .expect_err("strict stage schema should require policy for each non-registry stage");
        assert!(err
            .to_string()
            .contains("missing policy under [stage_schemas.schemas.kain_hot_reload]"));
    }

    #[test]
    fn stage_schema_policy_requires_schema_version_field() {
        let manifest_str = with_data_registry_config(
            &base_manifest(),
            r#"[stage_schemas]
strict_schema = false

[stage_schemas.schemas.scene]
expected_version = "1"
supported_versions = ["1"]"#,
        );

        let err = load_manifest_from_str(&manifest_str)
            .expect_err("schema version should be required when stage policy is declared");
        assert!(err.to_string().contains("requires field 'schema_version'"));
    }

    #[test]
    fn builtin_stage_schema_policy_rejects_unsupported_stage_schema_version() {
        let manifest_str = with_data_registry_config(
            &with_stage_schema_versions(&base_manifest()),
            r#"[stage_schemas]
strict_schema = true

[stage_schemas.schemas.scene]
expected_version = "1"
supported_versions = ["1"]
required_fields = ["scene_asset", "scene_format"]

[stage_schemas.schemas.kain_hot_reload]
expected_version = "1"
supported_versions = ["1"]
required_fields = ["source_registry", "watch_roots", "target"]

[stage_schemas.schemas.narrative_graph]
expected_version = "1"
supported_versions = ["1"]
required_fields = ["graph_asset", "entry_node", "evaluate_via"]"#,
        )
        .replace("schema_version = \"1\"", "schema_version = \"2\"");
        let manifest = load_manifest_from_str(&manifest_str).expect("manifest should parse");
        let plan = build_execution_plan(&manifest).expect("plan should be valid");
        let temp_root = unique_temp_dir("stage_schema_unsupported_version");

        fs::create_dir_all(temp_root.join("sources/game/assets/scenes"))
            .expect("scene dir should be created");
        fs::create_dir_all(temp_root.join("sources/game/assets/narrative"))
            .expect("narrative dir should be created");
        fs::create_dir_all(temp_root.join("sources/game/assets/gameplay"))
            .expect("gameplay dir should be created");
        fs::create_dir_all(temp_root.join("crates/k-os-kain/domains/supermotion"))
            .expect("kain source registry should be created");
        fs::create_dir_all(temp_root.join("sources/game/scripts"))
            .expect("scripts dir should be created");
        fs::create_dir_all(temp_root.join("sources/kain/domains"))
            .expect("watch root should be created");

        fs::write(
            temp_root.join("sources/game/assets/scenes/sandbox.kscene"),
            r#"{"schema":"k_os_scene_v1","actors":[{"id":"player_spawn"}]}"#,
        )
        .expect("scene should be written");
        fs::write(
            temp_root.join("sources/game/assets/narrative/intro.kgraph"),
            r#"{"nodes":[{"id":"boot"},{"id":"handoff_input"}]}"#,
        )
        .expect("graph should be written");
        fs::write(
            temp_root.join("sources/game/assets/gameplay/tags.registry.toml"),
            "version = \"1\"\nregistry_kind = \"gameplay_tags\"\n",
        )
        .expect("registry should be written");

        let options = RuntimeExecutionOptions {
            fail_fast: true,
            emit_artifacts: true,
        };
        let err = execute_plan_with_builtin_adapters(&manifest, &plan, &temp_root, &options)
            .expect_err("unsupported stage schema version should fail");
        assert!(err.to_string().contains("schema_version"));
        assert!(err.to_string().contains("unsupported"));

        let _ = fs::remove_dir_all(&temp_root);
    }

    #[test]
    fn builtin_packaging_stages_validate_cook_build_and_export_contracts() {
        let manifest_str = with_data_registry_config(
            &with_packaging_stages(&with_stage_schema_versions(&base_manifest())),
            r#"[stage_schemas]
strict_schema = true

[stage_schemas.schemas.scene]
expected_version = "1"
supported_versions = ["1"]
required_fields = ["scene_asset", "scene_format"]

[stage_schemas.schemas.kain_hot_reload]
expected_version = "1"
supported_versions = ["1"]
required_fields = ["source_registry", "watch_roots", "target"]

[stage_schemas.schemas.narrative_graph]
expected_version = "1"
supported_versions = ["1"]
required_fields = ["graph_asset", "entry_node", "evaluate_via"]

[stage_schemas.schemas.cook]
expected_version = "1"
supported_versions = ["1"]
required_fields = ["recipe_asset", "output_dir", "target_platform"]

[stage_schemas.schemas.build]
expected_version = "1"
supported_versions = ["1"]
required_fields = ["package_asset", "output_dir", "artifact_name", "target_platform"]

[stage_schemas.schemas.export]
expected_version = "1"
supported_versions = ["1"]
required_fields = ["package_asset", "source_dir", "export_path", "package_format"]"#,
        );
        let manifest = load_manifest_from_str(&manifest_str).expect("manifest should parse");
        let plan = build_execution_plan(&manifest).expect("plan should be valid");
        let temp_root = unique_temp_dir("builtin_packaging_success");

        fs::create_dir_all(temp_root.join("sources/game/assets/scenes"))
            .expect("scene dir should be created");
        fs::create_dir_all(temp_root.join("sources/game/assets/narrative"))
            .expect("narrative dir should be created");
        fs::create_dir_all(temp_root.join("sources/game/assets/gameplay"))
            .expect("gameplay dir should be created");
        fs::create_dir_all(temp_root.join("sources/game/assets/packaging"))
            .expect("packaging dir should be created");
        fs::create_dir_all(temp_root.join("crates/k-os-kain/domains/supermotion"))
            .expect("kain source registry should be created");
        fs::create_dir_all(temp_root.join("sources/game/scripts"))
            .expect("scripts dir should be created");
        fs::create_dir_all(temp_root.join("sources/kain/domains"))
            .expect("watch root should be created");
        fs::create_dir_all(temp_root.join("sources/game/build/cooked/windows"))
            .expect("cooked dir should be created");
        fs::create_dir_all(temp_root.join("sources/game/build/player/windows"))
            .expect("player dir should be created");

        fs::write(
            temp_root.join("sources/game/assets/scenes/sandbox.kscene"),
            r#"{"schema":"k_os_scene_v1","actors":[{"id":"player_spawn"}]}"#,
        )
        .expect("scene should be written");
        fs::write(
            temp_root.join("sources/game/assets/narrative/intro.kgraph"),
            r#"{"nodes":[{"id":"boot"},{"id":"handoff_input"}]}"#,
        )
        .expect("graph should be written");
        fs::write(
            temp_root.join("sources/game/assets/gameplay/tags.registry.toml"),
            "version = \"1\"\nregistry_kind = \"gameplay_tags\"\n",
        )
        .expect("registry should be written");
        fs::write(
            temp_root.join("sources/game/assets/packaging/windows.cook.toml"),
            "version = \"1\"\ntarget_platform = \"windows\"\ninputs = [\"sources/game/assets/scenes/sandbox.kscene\", \"sources/game/assets/narrative/intro.kgraph\", \"sources/game/assets/gameplay/tags.registry.toml\"]\n",
        )
        .expect("cook recipe should be written");
        fs::write(
            temp_root.join("sources/game/assets/packaging/windows.build.toml"),
            "version = \"1\"\ntarget_platform = \"windows\"\ncooked_dir = \"sources/game/build/cooked/windows\"\n[runtime]\nexecutable = \"k_os_game_windows_dev.exe\"\n",
        )
        .expect("build package should be written");
        fs::write(
            temp_root.join("sources/game/assets/packaging/windows.export.toml"),
            "version = \"1\"\npackage_format = \"zip\"\n",
        )
        .expect("export package should be written");

        let options = RuntimeExecutionOptions {
            fail_fast: true,
            emit_artifacts: true,
        };
        let report = execute_plan_with_builtin_adapters(&manifest, &plan, &temp_root, &options)
            .expect("builtin execution should succeed");

        assert!(report.records.iter().any(|record| {
            record.stage_id == "cook_windows_content"
                && record.status == StageExecutionStatus::Succeeded
        }));
        assert!(report.records.iter().any(|record| {
            record.stage_id == "build_windows_player"
                && record.status == StageExecutionStatus::Succeeded
        }));
        assert!(report.records.iter().any(|record| {
            record.stage_id == "export_windows_bundle"
                && record.status == StageExecutionStatus::Succeeded
        }));
        assert!(temp_root
            .join("sources/game/build/cooked/windows/cook.contract.json")
            .exists());
        assert!(temp_root
            .join("sources/game/build/player/windows/k_os_game_windows_dev/build.contract.json")
            .exists());
        assert!(temp_root
            .join(
                "sources/game/build/player/windows/k_os_game_windows_dev/k_os_game_windows_dev.exe"
            )
            .exists());
        assert!(temp_root
            .join("dist/game/k_os_game_windows_dev.zip")
            .exists());
        let cook_contract_path =
            temp_root.join("sources/game/build/cooked/windows/cook.contract.json");
        let build_contract_path = temp_root
            .join("sources/game/build/player/windows/k_os_game_windows_dev/build.contract.json");
        let export_contract_path = temp_root.join("dist/game/k_os_game_windows_dev.zip");

        let cook_contract: JsonValue = serde_json::from_str(
            &fs::read_to_string(&cook_contract_path).expect("cook contract should be readable"),
        )
        .expect("cook contract should be valid JSON");
        let build_contract: JsonValue = serde_json::from_str(
            &fs::read_to_string(&build_contract_path).expect("build contract should be readable"),
        )
        .expect("build contract should be valid JSON");
        let export_contract: JsonValue = serde_json::from_str(
            &fs::read_to_string(&export_contract_path).expect("export contract should be readable"),
        )
        .expect("export contract should be valid JSON");

        let cook_registry_versions = cook_contract
            .get("provenance")
            .and_then(|value| value.get("registry_versions"))
            .and_then(|value| value.as_array())
            .expect("cook contract should include provenance.registry_versions");
        assert!(cook_registry_versions.iter().any(|entry| {
            entry
                .get("registry_kind")
                .and_then(|value| value.as_str())
                .is_some_and(|kind| kind == "gameplay_tags")
                && entry
                    .get("version")
                    .and_then(|value| value.as_str())
                    .is_some_and(|version| version == "1")
        }));
        assert!(build_contract
            .get("provenance")
            .and_then(|value| value.get("source_contracts"))
            .and_then(|value| value.as_array())
            .is_some_and(|entries| !entries.is_empty()));
        assert!(export_contract
            .get("provenance")
            .and_then(|value| value.get("registry_versions"))
            .and_then(|value| value.as_array())
            .is_some_and(|entries| !entries.is_empty()));

        let _ = fs::remove_dir_all(&temp_root);
    }

    #[test]
    fn builtin_data_registry_requires_migration_hook_for_older_supported_version() {
        let manifest_str = with_data_registry_config(
            &base_manifest(),
            r#"[data_registry]
strict_schema = true

[data_registry.schemas.gameplay_tags]
expected_version = "2"
supported_versions = ["1", "2"]"#,
        );
        let manifest = load_manifest_from_str(&manifest_str).expect("manifest should parse");
        let plan = build_execution_plan(&manifest).expect("plan should be valid");
        let temp_root = unique_temp_dir("registry_needs_migration_hook");

        fs::create_dir_all(temp_root.join("sources/game/assets/scenes"))
            .expect("scene dir should be created");
        fs::create_dir_all(temp_root.join("sources/game/assets/narrative"))
            .expect("narrative dir should be created");
        fs::create_dir_all(temp_root.join("sources/game/assets/gameplay"))
            .expect("gameplay dir should be created");
        fs::create_dir_all(temp_root.join("crates/k-os-kain/domains/supermotion"))
            .expect("kain source registry should be created");
        fs::create_dir_all(temp_root.join("sources/game/scripts"))
            .expect("scripts dir should be created");
        fs::create_dir_all(temp_root.join("sources/kain/domains"))
            .expect("watch root should be created");

        fs::write(
            temp_root.join("sources/game/assets/scenes/sandbox.kscene"),
            r#"{"schema":"k_os_scene_v1","actors":[{"id":"player_spawn"}]}"#,
        )
        .expect("scene should be written");
        fs::write(
            temp_root.join("sources/game/assets/narrative/intro.kgraph"),
            r#"{"nodes":[{"id":"boot"},{"id":"handoff_input"}]}"#,
        )
        .expect("graph should be written");
        fs::write(
            temp_root.join("sources/game/assets/gameplay/tags.registry.toml"),
            "version = \"1\"\nregistry_kind = \"gameplay_tags\"\n[domains]\nvalues = [\"tag.a\"]\n",
        )
        .expect("registry should be written");

        let options = RuntimeExecutionOptions {
            fail_fast: true,
            emit_artifacts: true,
        };
        let err = execute_plan_with_builtin_adapters(&manifest, &plan, &temp_root, &options)
            .expect_err("migration hook should be required");
        assert!(err.to_string().contains("requires migration"));

        let _ = fs::remove_dir_all(&temp_root);
    }

    #[test]
    fn builtin_data_registry_validates_required_tables_from_manifest_policy() {
        let manifest_str = with_data_registry_config(
            &base_manifest(),
            r#"[data_registry]
strict_schema = true

[data_registry.schemas.gameplay_tags]
expected_version = "1"
supported_versions = ["1"]
required_tables = ["domains", "metadata"]"#,
        );
        let manifest = load_manifest_from_str(&manifest_str).expect("manifest should parse");
        let plan = build_execution_plan(&manifest).expect("plan should be valid");
        let temp_root = unique_temp_dir("registry_required_tables");

        fs::create_dir_all(temp_root.join("sources/game/assets/scenes"))
            .expect("scene dir should be created");
        fs::create_dir_all(temp_root.join("sources/game/assets/narrative"))
            .expect("narrative dir should be created");
        fs::create_dir_all(temp_root.join("sources/game/assets/gameplay"))
            .expect("gameplay dir should be created");
        fs::create_dir_all(temp_root.join("crates/k-os-kain/domains/supermotion"))
            .expect("kain source registry should be created");
        fs::create_dir_all(temp_root.join("sources/game/scripts"))
            .expect("scripts dir should be created");
        fs::create_dir_all(temp_root.join("sources/kain/domains"))
            .expect("watch root should be created");

        fs::write(
            temp_root.join("sources/game/assets/scenes/sandbox.kscene"),
            r#"{"schema":"k_os_scene_v1","actors":[{"id":"player_spawn"}]}"#,
        )
        .expect("scene should be written");
        fs::write(
            temp_root.join("sources/game/assets/narrative/intro.kgraph"),
            r#"{"nodes":[{"id":"boot"},{"id":"handoff_input"}]}"#,
        )
        .expect("graph should be written");
        fs::write(
            temp_root.join("sources/game/assets/gameplay/tags.registry.toml"),
            "version = \"1\"\nregistry_kind = \"gameplay_tags\"\n[domains]\nvalues = [\"tag.a\"]\n",
        )
        .expect("registry should be written");

        let options = RuntimeExecutionOptions {
            fail_fast: true,
            emit_artifacts: true,
        };
        let err = execute_plan_with_builtin_adapters(&manifest, &plan, &temp_root, &options)
            .expect_err("required table enforcement should fail");
        assert!(err
            .to_string()
            .contains("missing required top-level table/array 'metadata'"));

        let _ = fs::remove_dir_all(&temp_root);
    }

    #[test]
    fn builtin_adapter_runner_executes_and_marks_success() {
        let manifest = load_manifest_from_str(&base_manifest()).expect("manifest should parse");
        let plan = build_execution_plan(&manifest).expect("plan should be valid");
        let temp_root = unique_temp_dir("builtin_success");

        fs::create_dir_all(temp_root.join("sources/game/assets/scenes"))
            .expect("scene dir should be created");
        fs::create_dir_all(temp_root.join("sources/game/assets/narrative"))
            .expect("narrative dir should be created");
        fs::create_dir_all(temp_root.join("sources/game/assets/gameplay"))
            .expect("gameplay dir should be created");
        fs::create_dir_all(temp_root.join("crates/k-os-kain/domains/supermotion"))
            .expect("kain source registry should be created");
        fs::create_dir_all(temp_root.join("sources/game/scripts"))
            .expect("scripts dir should be created");
        fs::create_dir_all(temp_root.join("sources/kain/domains"))
            .expect("watch root should be created");

        fs::write(
            temp_root.join("sources/game/assets/scenes/sandbox.kscene"),
            r#"{"schema":"k_os_scene_v1","actors":[{"id":"player_spawn"}]}"#,
        )
        .expect("scene should be written");
        fs::write(
            temp_root.join("sources/game/assets/narrative/intro.kgraph"),
            r#"{"nodes":[{"id":"boot"},{"id":"handoff_input"}]}"#,
        )
        .expect("graph should be written");
        fs::write(
            temp_root.join("sources/game/assets/gameplay/tags.registry.toml"),
            "version = \"1\"\nregistry_kind = \"gameplay_tags\"\n",
        )
        .expect("registry should be written");

        let options = RuntimeExecutionOptions {
            fail_fast: true,
            emit_artifacts: true,
        };
        let report = execute_plan_with_builtin_adapters(&manifest, &plan, &temp_root, &options)
            .expect("builtin execution should succeed");

        assert_eq!(report.records.len(), 4);
        assert!(report
            .records
            .iter()
            .all(|record| record.status == StageExecutionStatus::Succeeded));

        let _ = fs::remove_dir_all(&temp_root);
    }

    #[test]
    fn builtin_adapter_runner_fails_for_invalid_narrative_entry() {
        let manifest_str =
            base_manifest().replace("entry_node = \"boot\"", "entry_node = \"missing_node\"");
        let manifest = load_manifest_from_str(&manifest_str).expect("manifest should parse");
        let plan = build_execution_plan(&manifest).expect("plan should be valid");
        let temp_root = unique_temp_dir("builtin_bad_narrative");

        fs::create_dir_all(temp_root.join("sources/game/assets/scenes"))
            .expect("scene dir should be created");
        fs::create_dir_all(temp_root.join("sources/game/assets/narrative"))
            .expect("narrative dir should be created");
        fs::create_dir_all(temp_root.join("sources/game/assets/gameplay"))
            .expect("gameplay dir should be created");
        fs::create_dir_all(temp_root.join("crates/k-os-kain/domains/supermotion"))
            .expect("kain source registry should be created");
        fs::create_dir_all(temp_root.join("sources/game/scripts"))
            .expect("scripts dir should be created");
        fs::create_dir_all(temp_root.join("sources/kain/domains"))
            .expect("watch root should be created");

        fs::write(
            temp_root.join("sources/game/assets/scenes/sandbox.kscene"),
            r#"{"schema":"k_os_scene_v1","actors":[{"id":"player_spawn"}]}"#,
        )
        .expect("scene should be written");
        fs::write(
            temp_root.join("sources/game/assets/narrative/intro.kgraph"),
            r#"{"nodes":[{"id":"boot"},{"id":"handoff_input"}]}"#,
        )
        .expect("graph should be written");
        fs::write(
            temp_root.join("sources/game/assets/gameplay/tags.registry.toml"),
            "version = \"1\"\nregistry_kind = \"gameplay_tags\"\n",
        )
        .expect("registry should be written");

        let options = RuntimeExecutionOptions {
            fail_fast: true,
            emit_artifacts: true,
        };
        let err = execute_plan_with_builtin_adapters(&manifest, &plan, &temp_root, &options)
            .expect_err("narrative entry mismatch should fail");
        assert!(err.to_string().contains("missing_node"));

        let _ = fs::remove_dir_all(&temp_root);
    }

    #[test]
    fn builtin_adapter_runner_blocks_dependent_stages_when_fail_fast_disabled() {
        let manifest = load_manifest_from_str(&base_manifest()).expect("manifest should parse");
        let plan = build_execution_plan(&manifest).expect("plan should be valid");
        let temp_root = unique_temp_dir("builtin_blocked_dependencies");

        fs::create_dir_all(temp_root.join("sources/game/assets/scenes"))
            .expect("scene dir should be created");
        fs::create_dir_all(temp_root.join("sources/game/assets/narrative"))
            .expect("narrative dir should be created");
        fs::create_dir_all(temp_root.join("sources/game/assets/gameplay"))
            .expect("gameplay dir should be created");
        fs::create_dir_all(temp_root.join("crates/k-os-kain/domains/supermotion"))
            .expect("kain source registry should be created");
        fs::create_dir_all(temp_root.join("sources/game/scripts"))
            .expect("scripts dir should be created");
        fs::create_dir_all(temp_root.join("sources/kain/domains"))
            .expect("watch root should be created");

        // Intentionally wrong schema to force the first stage failure.
        fs::write(
            temp_root.join("sources/game/assets/scenes/sandbox.kscene"),
            r#"{"schema":"wrong_schema","actors":[{"id":"player_spawn"}]}"#,
        )
        .expect("scene should be written");
        fs::write(
            temp_root.join("sources/game/assets/narrative/intro.kgraph"),
            r#"{"nodes":[{"id":"boot"},{"id":"handoff_input"}]}"#,
        )
        .expect("graph should be written");
        fs::write(
            temp_root.join("sources/game/assets/gameplay/tags.registry.toml"),
            "version = \"1\"\nregistry_kind = \"gameplay_tags\"\n",
        )
        .expect("registry should be written");

        let options = RuntimeExecutionOptions {
            fail_fast: false,
            emit_artifacts: true,
        };
        let report = execute_plan_with_builtin_adapters(&manifest, &plan, &temp_root, &options)
            .expect("report expected");

        let status_by_stage = report
            .records
            .iter()
            .map(|record| (record.stage_id.clone(), record.status.clone()))
            .collect::<std::collections::BTreeMap<_, _>>();
        assert_eq!(
            status_by_stage.get("scene_bootstrap"),
            Some(&StageExecutionStatus::Failed)
        );
        assert_eq!(
            status_by_stage.get("kain_hot_reload"),
            Some(&StageExecutionStatus::Failed)
        );
        assert_eq!(
            status_by_stage.get("gameplay_tags_registry"),
            Some(&StageExecutionStatus::Failed)
        );
        assert_eq!(
            status_by_stage.get("narrative_graph"),
            Some(&StageExecutionStatus::Failed)
        );

        let narrative_detail = report
            .records
            .iter()
            .find(|record| record.stage_id == "narrative_graph")
            .map(|record| record.detail.clone())
            .unwrap_or_default();
        assert!(narrative_detail.contains("blocked by failed dependencies"));

        let _ = fs::remove_dir_all(&temp_root);
    }
}
