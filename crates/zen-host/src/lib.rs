use serde::Deserialize;
use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};
use zen_core::{ZenCommand, ZenPlayMode};

const DEFAULT_ZEN_HOST_API: &str = include_str!("../../../apps/zen/resources/host_api.toml");

#[derive(Clone, Debug)]
pub struct ZenHostApi {
    name: String,
    version: String,
    source_label: String,
    actions: Vec<ZenHostAction>,
    bindings: Vec<ZenHostBinding>,
}

#[derive(Clone, Debug)]
pub struct ZenHostAction {
    pub key: String,
    pub label: String,
    pub description: String,
    pub command: ZenCommand,
}

#[derive(Clone, Debug)]
pub struct ZenHostBinding {
    pub key: String,
    pub label: String,
    pub widget: String,
    pub description: String,
    pub kind: ZenHostBindingKind,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ZenHostBindingKind {
    SceneObjects,
    SceneSelection,
    SceneViewport,
    EngineRuntime,
    EngineKain,
    EngineFabric,
    EngineTimeline,
    EngineHostApi,
}

impl ZenHostApi {
    pub fn load(configured: &str) -> Result<Self, String> {
        for candidate in source_path_candidates(configured) {
            if candidate.exists() {
                let source = fs::read_to_string(&candidate).map_err(|err| {
                    format!(
                        "Failed to read Zen host API manifest '{}': {err}",
                        candidate.display()
                    )
                })?;
                return parse_host_api(&source, candidate.display().to_string());
            }
        }

        parse_host_api(DEFAULT_ZEN_HOST_API, "embedded zen host api".to_string())
    }

    pub fn summary(&self) -> String {
        format!(
            "{} v{} // {} actions / {} bindings // {}",
            self.name,
            self.version,
            self.actions.len(),
            self.bindings.len(),
            self.source_label
        )
    }

    pub fn action(&self, key: &str) -> Option<&ZenHostAction> {
        self.actions
            .iter()
            .find(|action| action.key.eq_ignore_ascii_case(key))
    }

    pub fn binding(&self, key: &str) -> Option<&ZenHostBinding> {
        self.bindings
            .iter()
            .find(|binding| binding.key.eq_ignore_ascii_case(key))
    }

    pub fn actions(&self) -> &[ZenHostAction] {
        &self.actions
    }

    pub fn bindings(&self) -> &[ZenHostBinding] {
        &self.bindings
    }
}

#[derive(Debug, Deserialize)]
struct HostApiFile {
    api: HostApiMetaFile,
    actions: Vec<HostApiActionFile>,
    bindings: Vec<HostApiBindingFile>,
}

#[derive(Debug, Deserialize)]
struct HostApiMetaFile {
    name: String,
    version: String,
}

#[derive(Debug, Deserialize)]
struct HostApiActionFile {
    key: String,
    label: String,
    description: String,
    behavior: String,
}

#[derive(Debug, Deserialize)]
struct HostApiBindingFile {
    key: String,
    label: String,
    widget: String,
    description: String,
    handler: String,
}

fn parse_host_api(source: &str, source_label: String) -> Result<ZenHostApi, String> {
    let parsed: HostApiFile = toml::from_str(source)
        .map_err(|err| format!("Failed to parse Zen host API manifest: {err}"))?;

    let mut action_keys = HashSet::new();
    let mut actions = Vec::new();
    for action in parsed.actions {
        let key = normalized_non_empty("action key", &action.key)?;
        if !action_keys.insert(key.to_ascii_lowercase()) {
            return Err(format!("Zen host API action key '{}' is duplicated", key));
        }
        actions.push(ZenHostAction {
            key,
            label: normalized_non_empty("action label", &action.label)?,
            description: normalized_non_empty("action description", &action.description)?,
            command: parse_action_behavior(&action.behavior)?,
        });
    }

    let mut binding_keys = HashSet::new();
    let mut bindings = Vec::new();
    for binding in parsed.bindings {
        let key = normalized_non_empty("binding key", &binding.key)?;
        if !binding_keys.insert(key.to_ascii_lowercase()) {
            return Err(format!("Zen host API binding key '{}' is duplicated", key));
        }
        bindings.push(ZenHostBinding {
            key,
            label: normalized_non_empty("binding label", &binding.label)?,
            widget: normalized_non_empty("binding widget", &binding.widget)?,
            description: normalized_non_empty("binding description", &binding.description)?,
            kind: parse_binding_handler(&binding.handler)?,
        });
    }

    Ok(ZenHostApi {
        name: normalized_non_empty("api name", &parsed.api.name)?,
        version: normalized_non_empty("api version", &parsed.api.version)?,
        source_label,
        actions,
        bindings,
    })
}

fn parse_action_behavior(value: &str) -> Result<ZenCommand, String> {
    let trimmed = value.trim();
    if let Some(intent_id) = trimmed.strip_prefix("fabric_run_intent:") {
        let intent_id = intent_id.trim();
        if intent_id.is_empty() {
            return Err("Fabric host action behavior is missing an intent id".to_string());
        }
        return Ok(ZenCommand::FabricRunIntent {
            intent_id: intent_id.to_string(),
        });
    }

    match trimmed {
        "reload_shell" => Ok(ZenCommand::ShellReload),
        "scene_spawn_box" => Ok(ZenCommand::SceneSpawnWorkspaceBox),
        "scene_select_next" => Ok(ZenCommand::SceneSelectRelative { step: 1 }),
        "scene_select_previous" => Ok(ZenCommand::SceneSelectRelative { step: -1 }),
        "scene_clear_selection" => Ok(ZenCommand::SceneClearSelection),
        "camera_focus_selection" => Ok(ZenCommand::CameraFocusSelection),
        "camera_frame_scene" => Ok(ZenCommand::CameraFrameScene),
        "runtime_set_edit_mode" => Ok(ZenCommand::RuntimeSetPlayMode {
            mode: ZenPlayMode::Edit,
        }),
        "runtime_set_simulate_mode" => Ok(ZenCommand::RuntimeSetPlayMode {
            mode: ZenPlayMode::Simulate,
        }),
        "runtime_set_play_mode" => Ok(ZenCommand::RuntimeSetPlayMode {
            mode: ZenPlayMode::Play,
        }),
        other => Err(format!("Unsupported Zen host action behavior '{other}'")),
    }
}

fn parse_binding_handler(value: &str) -> Result<ZenHostBindingKind, String> {
    match value.trim() {
        "scene_objects" => Ok(ZenHostBindingKind::SceneObjects),
        "scene_selection" => Ok(ZenHostBindingKind::SceneSelection),
        "scene_viewport" => Ok(ZenHostBindingKind::SceneViewport),
        "engine_runtime" => Ok(ZenHostBindingKind::EngineRuntime),
        "engine_kain" => Ok(ZenHostBindingKind::EngineKain),
        "engine_fabric" => Ok(ZenHostBindingKind::EngineFabric),
        "engine_timeline" => Ok(ZenHostBindingKind::EngineTimeline),
        "engine_host_api" => Ok(ZenHostBindingKind::EngineHostApi),
        other => Err(format!("Unsupported Zen host binding handler '{other}'")),
    }
}

fn normalized_non_empty(label: &str, value: &str) -> Result<String, String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        Err(format!("Zen host API {label} cannot be empty"))
    } else {
        Ok(trimmed.to_string())
    }
}

fn source_path_candidates(configured: &str) -> Vec<PathBuf> {
    let configured_path = PathBuf::from(configured);
    if configured_path.is_absolute() {
        return vec![configured_path];
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
    candidates
}

fn file_name_or_original(path: &Path) -> PathBuf {
    path.file_name()
        .map(PathBuf::from)
        .unwrap_or_else(|| path.to_path_buf())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_default_host_api_manifest() {
        let api = parse_host_api(DEFAULT_ZEN_HOST_API, "embedded".to_string())
            .expect("default host api manifest should parse");
        assert!(api.action("scene.spawn_box").is_some());
        assert!(api.action("runtime.play").is_some());
        assert!(api.binding("engine.host_api").is_some());
        assert!(api.summary().contains("bindings"));
    }
}
