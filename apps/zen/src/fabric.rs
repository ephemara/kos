use crate::config::KainFabricConfig;
use kain_host::fabric::execute_fabric_manifest_path;
use kain_omni::fabric::FabricExecutionResult;
use serde::Deserialize;
use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};
use zen_core::ZenEvent;

#[derive(Debug, Clone)]
pub(crate) struct ZenFabricIntentProfile {
    pub id: String,
    pub label: String,
    pub lane: String,
    pub summary: String,
    pub graph: String,
    pub debounce_ms: u64,
    pub produces: Vec<String>,
}

#[derive(Debug, Deserialize)]
struct ZenFabricIntentRegistryFile {
    #[serde(default)]
    intents: Vec<ZenFabricIntentProfileFile>,
}

#[derive(Debug, Deserialize)]
struct ZenFabricIntentProfileFile {
    id: String,
    #[serde(default)]
    label: Option<String>,
    #[serde(default)]
    lane: Option<String>,
    #[serde(default)]
    summary: Option<String>,
    graph: String,
    #[serde(default)]
    debounce_ms: Option<u64>,
    #[serde(default)]
    produces: Vec<String>,
}

pub(crate) struct ZenFabricService {
    config: KainFabricConfig,
    resolved_manifest_path: Option<PathBuf>,
    resolved_intent_registry_path: Option<PathBuf>,
    status_summary: String,
    last_error: Option<String>,
    intent_registry_error: Option<String>,
    last_result: Option<FabricExecutionResult>,
    recent_events: Vec<String>,
    intent_profiles: Vec<ZenFabricIntentProfile>,
    last_run_label: Option<String>,
}

impl ZenFabricService {
    pub(crate) fn new(config: KainFabricConfig) -> Self {
        let mut service = Self {
            config,
            resolved_manifest_path: None,
            resolved_intent_registry_path: None,
            status_summary: String::new(),
            last_error: None,
            intent_registry_error: None,
            last_result: None,
            recent_events: Vec::new(),
            intent_profiles: Vec::new(),
            last_run_label: None,
        };
        service.refresh_status();
        service
    }

    pub(crate) fn enabled(&self) -> bool {
        self.config.enabled
    }

    pub(crate) fn configured_manifest_path(&self) -> &str {
        &self.config.manifest_path
    }

    pub(crate) fn configured_intent_registry_path(&self) -> &str {
        &self.config.intent_registry_path
    }

    pub(crate) fn resolved_manifest_path(&self) -> Option<&Path> {
        self.resolved_manifest_path.as_deref()
    }

    pub(crate) fn resolved_intent_registry_path(&self) -> Option<&Path> {
        self.resolved_intent_registry_path.as_deref()
    }

    pub(crate) fn status_summary(&self) -> &str {
        &self.status_summary
    }

    pub(crate) fn last_error(&self) -> Option<&str> {
        self.last_error.as_deref()
    }

    pub(crate) fn intent_registry_error(&self) -> Option<&str> {
        self.intent_registry_error.as_deref()
    }

    pub(crate) fn last_result(&self) -> Option<&FabricExecutionResult> {
        self.last_result.as_ref()
    }

    pub(crate) fn recent_events(&self) -> &[String] {
        &self.recent_events
    }

    pub(crate) fn intent_profiles(&self) -> &[ZenFabricIntentProfile] {
        &self.intent_profiles
    }

    pub(crate) fn scene_dirty_intents(&self) -> &[String] {
        &self.config.scene_dirty_intents
    }

    pub(crate) fn last_run_label(&self) -> Option<&str> {
        self.last_run_label.as_deref()
    }

    pub(crate) fn refresh_status(&mut self) {
        self.resolved_manifest_path = resolve_source_path(&self.config.manifest_path);
        self.resolved_intent_registry_path = resolve_source_path(&self.config.intent_registry_path);
        self.load_intent_registry();
        self.status_summary = self.compute_status_summary();
        self.recent_events = self
            .last_result
            .as_ref()
            .map(|result| load_recent_events(result.events_path.as_deref()))
            .unwrap_or_default();
    }

    pub(crate) fn run_configured_manifest(&mut self) -> Result<&FabricExecutionResult, String> {
        let manifest_path = self.resolved_manifest_path.clone().ok_or_else(|| {
            format!(
                "Fabric manifest path is unresolved: {}",
                self.config.manifest_path
            )
        })?;
        self.run_manifest_at_path(manifest_path, "configured manifest".to_string())
    }

    pub(crate) fn run_intent(&mut self, intent_id: &str) -> Result<&FabricExecutionResult, String> {
        if !self.config.enabled {
            let error = "Fabric is disabled in the Zen runtime config".to_string();
            self.last_error = Some(error.clone());
            self.status_summary = format!("fabric disabled // {}", self.config.manifest_path);
            return Err(error);
        }

        let Some(intent_profile) = self
            .intent_profiles
            .iter()
            .find(|profile| profile.id.eq_ignore_ascii_case(intent_id))
            .cloned()
        else {
            let error = format!("Fabric intent is unknown: {intent_id}");
            self.last_error = Some(error.clone());
            self.status_summary = format!("fabric intent missing // {intent_id}");
            return Err(error);
        };

        let Some(workspace_root) = self.workspace_root() else {
            let error = format!(
                "Fabric workspace root is unresolved for manifest {}",
                self.config.manifest_path
            );
            self.last_error = Some(error.clone());
            self.status_summary = "fabric workspace unresolved".to_string();
            return Err(error);
        };

        let manifest_path = resolve_relative_to_root(workspace_root, &intent_profile.graph);
        self.run_manifest_at_path(manifest_path, format!("intent {}", intent_profile.id))
    }

    pub(crate) fn apply_runtime_events(&mut self, events: &[ZenEvent]) -> Vec<String> {
        if !self.config.enabled {
            return Vec::new();
        }

        let mut messages = Vec::new();
        let mut scene_changed = false;
        let mut requested_intents = HashSet::new();

        for event in events {
            match event {
                ZenEvent::FabricIntentRequested { intent_id, .. } => {
                    requested_intents.insert(intent_id.to_ascii_lowercase());
                    match self.run_intent(intent_id) {
                        Ok(result) => messages.push(format!(
                            "fabric intent {} // session {} // {:?} // {} steps",
                            intent_id,
                            result.session_id,
                            result.status,
                            result.step_results.len()
                        )),
                        Err(err) => messages.push(err),
                    }
                }
                ZenEvent::SceneChanged { .. } => scene_changed = true,
                ZenEvent::ShellReloadRequested { .. }
                | ZenEvent::SelectionChanged { .. }
                | ZenEvent::CameraFocusRequested { .. }
                | ZenEvent::CameraFrameRequested { .. }
                | ZenEvent::PlayModeChanged { .. } => {}
            }
        }

        if scene_changed {
            for intent_id in self.config.scene_dirty_intents.clone() {
                if requested_intents.contains(&intent_id.to_ascii_lowercase()) {
                    continue;
                }
                match self.run_intent(&intent_id) {
                    Ok(result) => messages.push(format!(
                        "fabric auto {} // session {} // {:?} // {} steps",
                        intent_id,
                        result.session_id,
                        result.status,
                        result.step_results.len()
                    )),
                    Err(err) => messages.push(err),
                }
            }
        }

        messages
    }

    fn load_intent_registry(&mut self) {
        self.intent_profiles.clear();
        self.intent_registry_error = None;

        let Some(registry_path) = self.resolved_intent_registry_path.clone() else {
            self.intent_registry_error = Some(format!(
                "Fabric intent registry path is unresolved: {}",
                self.config.intent_registry_path
            ));
            return;
        };

        if !registry_path.exists() {
            self.intent_registry_error = Some(format!(
                "Fabric intent registry missing: {}",
                registry_path.display()
            ));
            return;
        }

        let source = match fs::read_to_string(&registry_path) {
            Ok(source) => source,
            Err(err) => {
                self.intent_registry_error = Some(format!(
                    "Failed to read Fabric intent registry '{}': {err}",
                    registry_path.display()
                ));
                return;
            }
        };

        match serde_json::from_str::<ZenFabricIntentRegistryFile>(&source) {
            Ok(parsed) => {
                self.intent_profiles = parsed
                    .intents
                    .into_iter()
                    .map(|intent| ZenFabricIntentProfile {
                        label: intent.label.unwrap_or_else(|| intent.id.clone()),
                        lane: intent.lane.unwrap_or_else(|| "default".to_string()),
                        summary: intent
                            .summary
                            .unwrap_or_else(|| format!("Embedded Fabric intent for {}", intent.id)),
                        graph: intent.graph,
                        debounce_ms: intent.debounce_ms.unwrap_or(0),
                        produces: intent.produces,
                        id: intent.id,
                    })
                    .collect();
            }
            Err(err) => {
                self.intent_registry_error = Some(format!(
                    "Failed to parse Fabric intent registry '{}': {err}",
                    registry_path.display()
                ));
            }
        }
    }

    fn run_manifest_at_path(
        &mut self,
        manifest_path: PathBuf,
        run_label: String,
    ) -> Result<&FabricExecutionResult, String> {
        if !self.config.enabled {
            let error = "Fabric is disabled in the Zen runtime config".to_string();
            self.last_error = Some(error.clone());
            self.status_summary = format!("fabric disabled // {}", self.config.manifest_path);
            return Err(error);
        }

        if !manifest_path.exists() {
            let error = format!("Fabric manifest missing: {}", manifest_path.display());
            self.last_error = Some(error.clone());
            self.last_run_label = Some(run_label.clone());
            self.status_summary = format!(
                "fabric manifest missing // {} // {}",
                run_label,
                manifest_path.display()
            );
            return Err(error);
        }

        self.last_run_label = Some(run_label.clone());
        match execute_fabric_manifest_path(&manifest_path) {
            Ok(result) => {
                self.recent_events = load_recent_events(result.events_path.as_deref());
                self.last_error = None;
                self.last_result = Some(result);
                self.status_summary = self.compute_status_summary();
                Ok(self
                    .last_result
                    .as_ref()
                    .expect("fabric result just stored"))
            }
            Err(err) => {
                let error = format!("Fabric execution failed: {err}");
                self.last_error = Some(error.clone());
                self.status_summary = format!(
                    "fabric failed // {} // {}",
                    run_label,
                    manifest_path.display()
                );
                Err(error)
            }
        }
    }

    fn compute_status_summary(&self) -> String {
        let intent_summary = format!("{} intents", self.intent_profiles.len());

        if !self.config.enabled {
            return format!(
                "fabric disabled // {} // {}",
                self.config.manifest_path, intent_summary
            );
        }

        if let Some(result) = &self.last_result {
            return format!(
                "fabric {:?} // {} // {} steps // {}",
                result.status,
                self.last_run_label.as_deref().unwrap_or("manifest"),
                result.step_results.len(),
                result.session_id
            );
        }

        match &self.resolved_manifest_path {
            Some(path) if path.exists() => {
                format!("fabric ready // {} // {}", path.display(), intent_summary)
            }
            Some(path) => format!(
                "fabric manifest missing // {} // {}",
                path.display(),
                intent_summary
            ),
            None => format!(
                "fabric unresolved // {} // {}",
                self.config.manifest_path, intent_summary
            ),
        }
    }

    fn workspace_root(&self) -> Option<&Path> {
        self.resolved_manifest_path
            .as_deref()
            .and_then(|path| path.parent())
    }
}

fn resolve_source_path(configured: &str) -> Option<PathBuf> {
    let configured_path = PathBuf::from(configured);
    if configured_path.is_absolute() {
        return Some(configured_path);
    }

    let mut candidates = Vec::new();
    if let Ok(current_exe) = std::env::current_exe() {
        if let Some(parent) = current_exe.parent() {
            candidates.push(parent.join(&configured_path));
            candidates.push(
                parent
                    .join("zen")
                    .join(file_name_or_original(&configured_path)),
            );
        }
    }
    candidates.push(k_os_kain::workspace_root().join(&configured_path));

    let fallback = candidates.last().cloned();
    candidates
        .into_iter()
        .find(|candidate| candidate.exists())
        .or(fallback)
}

fn file_name_or_original(path: &Path) -> PathBuf {
    path.file_name()
        .map(PathBuf::from)
        .unwrap_or_else(|| path.to_path_buf())
}

fn resolve_relative_to_root(root: &Path, configured: &str) -> PathBuf {
    let configured_path = PathBuf::from(configured);
    if configured_path.is_absolute() {
        configured_path
    } else {
        root.join(configured_path)
    }
}

fn load_recent_events(path: Option<&Path>) -> Vec<String> {
    let Some(path) = path else {
        return Vec::new();
    };
    let Ok(source) = fs::read_to_string(path) else {
        return vec![format!("unable to read events // {}", path.display())];
    };

    let mut lines = source
        .lines()
        .filter(|line| !line.trim().is_empty())
        .map(|line| line.to_string())
        .collect::<Vec<_>>();
    if lines.len() > 12 {
        lines.drain(0..lines.len().saturating_sub(12));
    }
    lines
}
