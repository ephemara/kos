use egui_dock::{DockState, NodeIndex};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};
use zen_core::ZenPlayMode;

const DEFAULT_WORKSPACE_MANIFEST: &str = include_str!("../../zen/resources/workspace_ui.toml");

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ZenEditorSession {
    pub active_shell: String,
    pub viewport_layout: String,
    pub play_mode: ZenPlayMode,
    pub active_document: Option<String>,
    pub workspace_preset: Option<String>,
    pub user_layout: Option<String>,
    pub open_features: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ZenWorkspaceManifest {
    pub workspace: ZenWorkspaceMeta,
    pub documents: Vec<ZenWorkspaceDocument>,
    pub presets: Vec<ZenWorkspacePreset>,
    pub features: Vec<ZenUiFeature>,
    pub layout: ZenWorkspaceLayout,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ZenWorkspaceMeta {
    pub key: String,
    pub title: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ZenUiFeature {
    pub key: String,
    pub title: String,
    pub kind: ZenUiFeatureKind,
    pub binding: Option<String>,
    pub actions: Vec<String>,
    pub props: BTreeMap<String, String>,
    pub closable: bool,
    pub default_open: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ZenUiFeatureKind {
    ActionStrip,
    Viewport,
    SceneTree,
    SelectionInspector,
    RuntimeInspector,
    Timeline,
    HostApi,
    Registry,
    KainStatus,
    DocumentContext,
    FileEditor,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ZenWorkspaceDocument {
    pub key: String,
    pub title: String,
    pub kind: String,
    pub path: Option<String>,
    pub source_path: Option<String>,
    pub primary: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ZenWorkspacePreset {
    pub key: String,
    pub title: String,
    pub viewport_layout: String,
    pub layout: ZenWorkspaceLayout,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ZenWorkspaceLayout {
    pub center_tabs: Vec<String>,
    pub left_tabs: Vec<String>,
    pub right_tabs: Vec<String>,
    pub bottom_tabs: Vec<String>,
    pub left_ratio: f32,
    pub right_ratio: f32,
    pub bottom_ratio: f32,
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct ZenDockTab {
    pub feature_key: String,
}

#[derive(Debug, Clone)]
pub struct ZenFeatureRegistry {
    features: Vec<ZenUiFeature>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ZenWorkspaceLayoutState {
    workspace_key: String,
    dock_state: DockState<ZenDockTab>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ZenEditorSessionState {
    workspace_key: String,
    session: ZenEditorSession,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ZenUserWorkspaceLayout {
    pub key: String,
    pub title: String,
    pub viewport_layout: String,
    pub dock_state: DockState<ZenDockTab>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ZenUserWorkspaceLayoutState {
    workspace_key: String,
    layouts: Vec<ZenUserWorkspaceLayout>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ZenInspectorSchema {
    pub title: String,
    pub sections: Vec<ZenInspectorSection>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ZenInspectorSection {
    pub title: String,
    pub fields: Vec<ZenInspectorField>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ZenInspectorField {
    pub key: String,
    pub label: String,
    pub value: ZenInspectorFieldValue,
    pub editable: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ZenInspectorFieldValue {
    Text(String),
    Number(f32),
    Integer(i64),
    Vec3([f32; 3]),
    Quaternion([f32; 4]),
}

impl ZenWorkspaceManifest {
    pub fn load(configured: &str) -> Result<Self, String> {
        for candidate in source_path_candidates(configured) {
            if candidate.exists() {
                let source = fs::read_to_string(&candidate).map_err(|err| {
                    format!(
                        "Failed to read Zen workspace manifest '{}': {err}",
                        candidate.display()
                    )
                })?;
                return Self::parse(&source);
            }
        }
        Self::parse(DEFAULT_WORKSPACE_MANIFEST)
    }

    pub fn parse(source: &str) -> Result<Self, String> {
        let manifest: ZenWorkspaceManifestFile = toml::from_str(source)
            .map_err(|err| format!("Failed to parse Zen workspace manifest: {err}"))?;
        let workspace = ZenWorkspaceMeta {
            key: required("workspace key", manifest.workspace.key)?,
            title: required("workspace title", manifest.workspace.title)?,
        };
        let documents = manifest
            .documents
            .unwrap_or_default()
            .into_iter()
            .map(|document| {
                Ok::<ZenWorkspaceDocument, String>(ZenWorkspaceDocument {
                    key: required("document key", document.key)?,
                    title: required("document title", document.title)?,
                    kind: required("document kind", document.kind)?,
                    path: document.path.filter(|value| !value.trim().is_empty()),
                    source_path: document
                        .source_path
                        .filter(|value| !value.trim().is_empty()),
                    primary: document.primary.unwrap_or(false),
                })
            })
            .collect::<Result<Vec<_>, _>>()?;
        let features = manifest
            .features
            .into_iter()
            .map(|feature| {
                Ok::<ZenUiFeature, String>(ZenUiFeature {
                    key: required("feature key", feature.key)?,
                    title: required("feature title", feature.title)?,
                    kind: ZenUiFeatureKind::parse(&feature.kind)?,
                    binding: feature.binding.filter(|value| !value.trim().is_empty()),
                    actions: feature.actions.unwrap_or_default(),
                    props: feature.props.unwrap_or_default(),
                    closable: feature.closable.unwrap_or(true),
                    default_open: feature.default_open.unwrap_or(true),
                })
            })
            .collect::<Result<Vec<_>, _>>()?;
        if features.is_empty() {
            return Err("Zen workspace manifest must declare at least one feature".to_string());
        }
        let layout = ZenWorkspaceLayout {
            center_tabs: manifest.layout.center_tabs,
            left_tabs: manifest.layout.left_tabs.unwrap_or_default(),
            right_tabs: manifest.layout.right_tabs.unwrap_or_default(),
            bottom_tabs: manifest.layout.bottom_tabs.unwrap_or_default(),
            left_ratio: manifest.layout.left_ratio.unwrap_or(0.22).clamp(0.1, 0.45),
            right_ratio: manifest.layout.right_ratio.unwrap_or(0.24).clamp(0.1, 0.45),
            bottom_ratio: manifest.layout.bottom_ratio.unwrap_or(0.28).clamp(0.1, 0.5),
        };
        let presets = manifest
            .presets
            .unwrap_or_default()
            .into_iter()
            .map(|preset| {
                Ok::<ZenWorkspacePreset, String>(ZenWorkspacePreset {
                    key: required("preset key", preset.key)?,
                    title: required("preset title", preset.title)?,
                    viewport_layout: required("preset viewport_layout", preset.viewport_layout)?,
                    layout: ZenWorkspaceLayout {
                        center_tabs: preset.layout.center_tabs,
                        left_tabs: preset.layout.left_tabs.unwrap_or_default(),
                        right_tabs: preset.layout.right_tabs.unwrap_or_default(),
                        bottom_tabs: preset.layout.bottom_tabs.unwrap_or_default(),
                        left_ratio: preset.layout.left_ratio.unwrap_or(0.22).clamp(0.1, 0.45),
                        right_ratio: preset.layout.right_ratio.unwrap_or(0.24).clamp(0.1, 0.45),
                        bottom_ratio: preset.layout.bottom_ratio.unwrap_or(0.28).clamp(0.1, 0.5),
                    },
                })
            })
            .collect::<Result<Vec<_>, _>>()?;
        if layout.center_tabs.is_empty() {
            return Err("Zen workspace manifest must declare at least one center tab".to_string());
        }
        Ok(Self {
            workspace,
            documents,
            presets,
            features,
            layout,
        })
    }

    pub fn feature(&self, key: &str) -> Option<&ZenUiFeature> {
        self.features.iter().find(|feature| feature.key == key)
    }

    pub fn build_dock_state(&self) -> DockState<ZenDockTab> {
        let mut dock_state = DockState::new(tab_vec(&self.layout.center_tabs));
        {
            let surface = dock_state.main_surface_mut();
            let mut center = NodeIndex::root();
            if !self.layout.left_tabs.is_empty() {
                let [_, new_node] = surface.split_left(
                    center,
                    self.layout.left_ratio,
                    tab_vec(&self.layout.left_tabs),
                );
                center = new_node;
            }
            if !self.layout.right_tabs.is_empty() {
                surface.split_right(
                    center,
                    self.layout.right_ratio,
                    tab_vec(&self.layout.right_tabs),
                );
            }
            if !self.layout.bottom_tabs.is_empty() {
                surface.split_below(
                    center,
                    self.layout.bottom_ratio,
                    tab_vec(&self.layout.bottom_tabs),
                );
            }
        }
        dock_state
    }

    pub fn feature_registry(&self) -> ZenFeatureRegistry {
        ZenFeatureRegistry {
            features: self.features.clone(),
        }
    }

    pub fn primary_document(&self) -> Option<&ZenWorkspaceDocument> {
        self.documents
            .iter()
            .find(|document| document.primary)
            .or_else(|| self.documents.first())
    }

    pub fn document(&self, key: &str) -> Option<&ZenWorkspaceDocument> {
        self.documents.iter().find(|document| document.key == key)
    }

    pub fn preset(&self, key: &str) -> Option<&ZenWorkspacePreset> {
        self.presets.iter().find(|preset| preset.key == key)
    }
}

impl ZenWorkspacePreset {
    pub fn build_dock_state(&self) -> DockState<ZenDockTab> {
        let mut dock_state = DockState::new(tab_vec(&self.layout.center_tabs));
        {
            let surface = dock_state.main_surface_mut();
            let mut center = NodeIndex::root();
            if !self.layout.left_tabs.is_empty() {
                let [_, new_node] = surface.split_left(
                    center,
                    self.layout.left_ratio,
                    tab_vec(&self.layout.left_tabs),
                );
                center = new_node;
            }
            if !self.layout.right_tabs.is_empty() {
                surface.split_right(
                    center,
                    self.layout.right_ratio,
                    tab_vec(&self.layout.right_tabs),
                );
            }
            if !self.layout.bottom_tabs.is_empty() {
                surface.split_below(
                    center,
                    self.layout.bottom_ratio,
                    tab_vec(&self.layout.bottom_tabs),
                );
            }
        }
        dock_state
    }
}

impl Default for ZenEditorSession {
    fn default() -> Self {
        Self {
            active_shell: "zen.shell.main".to_string(),
            viewport_layout: "universal".to_string(),
            play_mode: ZenPlayMode::Edit,
            active_document: None,
            workspace_preset: None,
            user_layout: None,
            open_features: vec![
                "workspace.viewport.perspective".to_string(),
                "workspace.outliner".to_string(),
                "workspace.documents".to_string(),
                "workspace.selection".to_string(),
                "workspace.runtime".to_string(),
            ],
        }
    }
}

impl ZenUiFeatureKind {
    fn parse(value: &str) -> Result<Self, String> {
        match value.trim() {
            "action_strip" => Ok(Self::ActionStrip),
            "viewport" => Ok(Self::Viewport),
            "scene_tree" => Ok(Self::SceneTree),
            "selection_inspector" => Ok(Self::SelectionInspector),
            "runtime_inspector" => Ok(Self::RuntimeInspector),
            "timeline" => Ok(Self::Timeline),
            "host_api" => Ok(Self::HostApi),
            "registry" => Ok(Self::Registry),
            "kain_status" => Ok(Self::KainStatus),
            "document_context" => Ok(Self::DocumentContext),
            "file_editor" => Ok(Self::FileEditor),
            other => Err(format!("Unsupported Zen UI feature kind '{other}'")),
        }
    }
}

impl ZenFeatureRegistry {
    pub fn features(&self) -> &[ZenUiFeature] {
        &self.features
    }

    pub fn search(&self, query: &str) -> Vec<ZenUiFeature> {
        let query = query.trim().to_ascii_lowercase();
        if query.is_empty() {
            return self.features.clone();
        }

        self.features
            .iter()
            .filter(|feature| {
                feature.key.to_ascii_lowercase().contains(&query)
                    || feature.title.to_ascii_lowercase().contains(&query)
                    || feature
                        .binding
                        .as_deref()
                        .map(|binding| binding.to_ascii_lowercase().contains(&query))
                        .unwrap_or(false)
                    || feature
                        .actions
                        .iter()
                        .any(|action| action.to_ascii_lowercase().contains(&query))
            })
            .cloned()
            .collect()
    }
}

pub fn load_persisted_dock_state(
    workspace_key: &str,
) -> Result<Option<DockState<ZenDockTab>>, String> {
    let Some(path) = workspace_layout_state_path(workspace_key) else {
        return Ok(None);
    };
    if !path.exists() {
        return Ok(None);
    }
    let source = fs::read_to_string(&path).map_err(|err| {
        format!(
            "Failed to read Zen workspace layout state '{}': {err}",
            path.display()
        )
    })?;
    let state: ZenWorkspaceLayoutState = serde_json::from_str(&source).map_err(|err| {
        format!(
            "Failed to parse Zen workspace layout state '{}': {err}",
            path.display()
        )
    })?;
    if !state.workspace_key.eq_ignore_ascii_case(workspace_key) {
        return Ok(None);
    }
    Ok(Some(state.dock_state))
}

pub fn persist_dock_state(
    workspace_key: &str,
    dock_state: &DockState<ZenDockTab>,
) -> Result<Option<PathBuf>, String> {
    let Some(path) = workspace_layout_state_path(workspace_key) else {
        return Ok(None);
    };
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|err| {
            format!(
                "Failed to create Zen workspace layout directory '{}': {err}",
                parent.display()
            )
        })?;
    }
    let payload = ZenWorkspaceLayoutState {
        workspace_key: workspace_key.to_string(),
        dock_state: dock_state.clone(),
    };
    let serialized = serde_json::to_string_pretty(&payload)
        .map_err(|err| format!("Failed to serialize Zen workspace layout state: {err}"))?;
    fs::write(&path, serialized).map_err(|err| {
        format!(
            "Failed to write Zen workspace layout state '{}': {err}",
            path.display()
        )
    })?;
    Ok(Some(path))
}

pub fn sanitize_dock_state(
    workspace: &ZenWorkspaceManifest,
    dock_state: &DockState<ZenDockTab>,
) -> DockState<ZenDockTab> {
    let sanitized = dock_state.filter_tabs(|tab| workspace.feature(&tab.feature_key).is_some());
    if sanitized.main_surface().is_empty() {
        workspace.build_dock_state()
    } else {
        sanitized
    }
}

pub fn load_editor_session(workspace_key: &str) -> Result<Option<ZenEditorSession>, String> {
    let Some(path) = workspace_session_state_path(workspace_key) else {
        return Ok(None);
    };
    if !path.exists() {
        return Ok(None);
    }
    let source = fs::read_to_string(&path).map_err(|err| {
        format!(
            "Failed to read Zen editor session state '{}': {err}",
            path.display()
        )
    })?;
    let state: ZenEditorSessionState = serde_json::from_str(&source).map_err(|err| {
        format!(
            "Failed to parse Zen editor session state '{}': {err}",
            path.display()
        )
    })?;
    if !state.workspace_key.eq_ignore_ascii_case(workspace_key) {
        return Ok(None);
    }
    Ok(Some(state.session))
}

pub fn persist_editor_session(
    workspace_key: &str,
    session: &ZenEditorSession,
) -> Result<Option<PathBuf>, String> {
    let Some(path) = workspace_session_state_path(workspace_key) else {
        return Ok(None);
    };
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|err| {
            format!(
                "Failed to create Zen editor session directory '{}': {err}",
                parent.display()
            )
        })?;
    }
    let payload = ZenEditorSessionState {
        workspace_key: workspace_key.to_string(),
        session: session.clone(),
    };
    let serialized = serde_json::to_string_pretty(&payload)
        .map_err(|err| format!("Failed to serialize Zen editor session state: {err}"))?;
    fs::write(&path, serialized).map_err(|err| {
        format!(
            "Failed to write Zen editor session state '{}': {err}",
            path.display()
        )
    })?;
    Ok(Some(path))
}

pub fn load_user_layouts(workspace_key: &str) -> Result<Vec<ZenUserWorkspaceLayout>, String> {
    let Some(path) = workspace_user_layouts_path(workspace_key) else {
        return Ok(Vec::new());
    };
    if !path.exists() {
        return Ok(Vec::new());
    }
    let source = fs::read_to_string(&path).map_err(|err| {
        format!(
            "Failed to read Zen user layout state '{}': {err}",
            path.display()
        )
    })?;
    let state: ZenUserWorkspaceLayoutState = serde_json::from_str(&source).map_err(|err| {
        format!(
            "Failed to parse Zen user layout state '{}': {err}",
            path.display()
        )
    })?;
    if !state.workspace_key.eq_ignore_ascii_case(workspace_key) {
        return Ok(Vec::new());
    }
    Ok(state.layouts)
}

pub fn persist_user_layouts(
    workspace_key: &str,
    layouts: &[ZenUserWorkspaceLayout],
) -> Result<Option<PathBuf>, String> {
    let Some(path) = workspace_user_layouts_path(workspace_key) else {
        return Ok(None);
    };
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|err| {
            format!(
                "Failed to create Zen user layout directory '{}': {err}",
                parent.display()
            )
        })?;
    }
    let payload = ZenUserWorkspaceLayoutState {
        workspace_key: workspace_key.to_string(),
        layouts: layouts.to_vec(),
    };
    let serialized = serde_json::to_string_pretty(&payload)
        .map_err(|err| format!("Failed to serialize Zen user layout state: {err}"))?;
    fs::write(&path, serialized).map_err(|err| {
        format!(
            "Failed to write Zen user layout state '{}': {err}",
            path.display()
        )
    })?;
    Ok(Some(path))
}

pub fn sanitize_user_layouts(
    workspace: &ZenWorkspaceManifest,
    layouts: &[ZenUserWorkspaceLayout],
) -> Vec<ZenUserWorkspaceLayout> {
    let mut sanitized = Vec::new();
    for layout in layouts {
        let dock_state = sanitize_dock_state(workspace, &layout.dock_state);
        if dock_state.main_surface().is_empty() {
            continue;
        }
        sanitized.push(ZenUserWorkspaceLayout {
            key: layout.key.clone(),
            title: layout.title.clone(),
            viewport_layout: layout.viewport_layout.clone(),
            dock_state,
        });
    }
    sanitized
}

#[derive(Debug, Deserialize)]
struct ZenWorkspaceManifestFile {
    workspace: ZenWorkspaceMetaFile,
    documents: Option<Vec<ZenWorkspaceDocumentFile>>,
    presets: Option<Vec<ZenWorkspacePresetFile>>,
    features: Vec<ZenUiFeatureFile>,
    layout: ZenWorkspaceLayoutFile,
}

#[derive(Debug, Deserialize)]
struct ZenWorkspaceMetaFile {
    key: String,
    title: String,
}

#[derive(Debug, Deserialize)]
struct ZenUiFeatureFile {
    key: String,
    title: String,
    kind: String,
    binding: Option<String>,
    actions: Option<Vec<String>>,
    props: Option<BTreeMap<String, String>>,
    closable: Option<bool>,
    default_open: Option<bool>,
}

#[derive(Debug, Deserialize)]
struct ZenWorkspaceDocumentFile {
    key: String,
    title: String,
    kind: String,
    path: Option<String>,
    source_path: Option<String>,
    primary: Option<bool>,
}

#[derive(Debug, Deserialize)]
struct ZenWorkspacePresetFile {
    key: String,
    title: String,
    viewport_layout: String,
    layout: ZenWorkspaceLayoutFile,
}

#[derive(Debug, Deserialize)]
struct ZenWorkspaceLayoutFile {
    center_tabs: Vec<String>,
    left_tabs: Option<Vec<String>>,
    right_tabs: Option<Vec<String>>,
    bottom_tabs: Option<Vec<String>>,
    left_ratio: Option<f32>,
    right_ratio: Option<f32>,
    bottom_ratio: Option<f32>,
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
            candidates.push(parent.join("zen").join(&configured_path));
            candidates.push(
                parent
                    .join("zen")
                    .join(file_name_or_original(&configured_path)),
            );
        }
    }
    candidates.push(
        k_os_kain::workspace_root()
            .join("crates")
            .join("zen")
            .join("resources")
            .join(&configured_path),
    );
    candidates.push(k_os_kain::workspace_root().join(&configured_path));
    candidates
}

pub fn resolve_document_source_path(document: &ZenWorkspaceDocument) -> Option<PathBuf> {
    let configured = document
        .source_path
        .as_deref()
        .or(document.path.as_deref())?;
    if configured.starts_with("workspace://") {
        return None;
    }
    source_path_candidates(configured)
        .into_iter()
        .find(|candidate| candidate.exists())
        .or_else(|| source_path_candidates(configured).into_iter().next())
}

fn file_name_or_original(path: &Path) -> PathBuf {
    path.file_name()
        .map(PathBuf::from)
        .unwrap_or_else(|| path.to_path_buf())
}

fn required(label: &str, value: String) -> Result<String, String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        Err(format!("Zen workspace manifest {label} cannot be empty"))
    } else {
        Ok(trimmed.to_string())
    }
}

fn tab_vec(keys: &[String]) -> Vec<ZenDockTab> {
    keys.iter()
        .map(|key| ZenDockTab {
            feature_key: key.clone(),
        })
        .collect()
}

fn workspace_layout_state_path(workspace_key: &str) -> Option<PathBuf> {
    let file_name = format!(
        "{}.layout.json",
        workspace_key.replace(['/', '\\', ':', ' '], "_")
    );
    if let Ok(current_exe) = std::env::current_exe() {
        if let Some(parent) = current_exe.parent() {
            return Some(parent.join("zen").join("layout-state").join(file_name));
        }
    }
    std::env::current_dir()
        .ok()
        .map(|dir| dir.join("zen").join("layout-state").join(file_name))
}

fn workspace_session_state_path(workspace_key: &str) -> Option<PathBuf> {
    let file_name = format!(
        "{}.session.json",
        workspace_key.replace(['/', '\\', ':', ' '], "_")
    );
    if let Ok(current_exe) = std::env::current_exe() {
        if let Some(parent) = current_exe.parent() {
            return Some(parent.join("zen").join("session-state").join(file_name));
        }
    }
    std::env::current_dir()
        .ok()
        .map(|dir| dir.join("zen").join("session-state").join(file_name))
}

fn workspace_user_layouts_path(workspace_key: &str) -> Option<PathBuf> {
    let file_name = format!(
        "{}.user-layouts.json",
        workspace_key.replace(['/', '\\', ':', ' '], "_")
    );
    if let Ok(current_exe) = std::env::current_exe() {
        if let Some(parent) = current_exe.parent() {
            return Some(parent.join("zen").join("user-layouts").join(file_name));
        }
    }
    std::env::current_dir()
        .ok()
        .map(|dir| dir.join("zen").join("user-layouts").join(file_name))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_editor_session_starts_in_edit_mode() {
        let session = ZenEditorSession::default();
        assert_eq!(session.play_mode, ZenPlayMode::Edit);
        assert_eq!(session.active_shell, "zen.shell.main");
    }

    #[test]
    fn parses_default_workspace_manifest() {
        let manifest = ZenWorkspaceManifest::parse(DEFAULT_WORKSPACE_MANIFEST)
            .expect("default workspace manifest should parse");
        assert_eq!(manifest.workspace.key, "zen.workspace.default.v2");
        assert!(manifest.feature("workspace.viewport.perspective").is_some());
        assert!(manifest.feature("workspace.file_editor").is_some());
        assert!(manifest.primary_document().is_some());
        assert_eq!(
            manifest
                .document("document.scene.default")
                .and_then(|document| document.source_path.as_deref()),
            Some("workspace/main_scene.zen")
        );
        assert!(!manifest.presets.is_empty());
        assert!(!manifest.build_dock_state().main_surface().is_empty());
    }
}
