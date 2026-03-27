use crate::config::{KainUiConfig, RendererConfig};
use crate::fabric::ZenFabricService;
use crate::theme::{resolve_source_path, ZenUiTheme};
use crate::FlyCamera;
use egui::{Color32, RichText, Stroke, Vec2, WidgetText};
use egui_dock::{DockArea, DockState, TabViewer};
use k_os_asset_pipeline::importers::{GltfImporter, ObjImporter};
use k_os_asset_pipeline::AssetPipeline;
use k_os_workspace_registry::{
    adapter_manifest_for_target, adapter_manifests, integration_contract_for_package,
    integration_registry, packages_for_host, workspace_registry,
};
use kain_core::{build_ui_output_from_source, render_ui_output_debug};
use std::collections::hash_map::DefaultHasher;
use std::collections::{HashMap, HashSet};
use std::fs;
use std::hash::{Hash, Hasher};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::{Duration, Instant, SystemTime};
use zen_core::{
    command_label, ZenCommandEnvelope, ZenCommandSource, ZenEvent, ZenPlayMode, ZenTransactionId,
};
use zen_editor::{
    load_editor_session, load_persisted_dock_state, load_user_layouts, persist_dock_state,
    persist_editor_session, persist_user_layouts, resolve_document_source_path,
    sanitize_dock_state, sanitize_user_layouts, ZenDockTab, ZenEditorSession, ZenFeatureRegistry,
    ZenInspectorField, ZenInspectorFieldValue, ZenInspectorSchema, ZenInspectorSection,
    ZenUiFeature, ZenUiFeatureKind, ZenUserWorkspaceLayout, ZenWorkspaceDocument,
    ZenWorkspaceManifest,
};
use zen_host::{ZenHostAction, ZenHostApi, ZenHostBindingKind};
use zen_kain_api::ZenKainContract;
use zen_kain_modules::{ZenKainModuleRegistry, ZenResolvedShell};
use zen_runtime::ZenRuntimeSession;
use zen_scene::{SceneObjectEntry, SelectedObjectDetails, ZenScene};

const DEFAULT_ZEN_SHELL_SOURCE: &str = include_str!("../resources/zen_shell.kn");

#[derive(Clone, Copy, Debug)]
pub(crate) struct ZenViewportHud {
    pub camera_position: [f32; 3],
    pub camera_forward: [f32; 3],
    pub vertex_count: u32,
    pub index_count: u32,
    pub viewport_texture_id: Option<egui::TextureId>,
    pub viewport_extent: [u32; 2],
}

#[derive(Default)]
struct InspectorDraft {
    selected_handle: Option<u64>,
    name: String,
    translation: [f32; 3],
    scale: [f32; 3],
}

#[derive(Clone, Debug)]
struct WatchedFile {
    path: PathBuf,
    modified: Option<SystemTime>,
}

#[derive(Clone, Debug, Default)]
struct DocumentEditorBuffer {
    source_path: Option<PathBuf>,
    source_label: String,
    text: String,
    saved_text: String,
    status: String,
    read_only: bool,
}

#[derive(Clone, Debug)]
enum CommandPaletteSelection {
    HostAction(String),
    Feature(String),
    RegistryPackage(String),
    Document(String),
    Preset(String),
    UserLayout(String),
}

#[derive(Clone, Debug)]
enum WorkspacePanelAction {
    SelectDocument(String),
    ImportAsset,
    ApplyPreset(String),
    ApplyUserLayout(String),
    SaveCurrentLayout(String),
    ResetWorkspace,
    DeleteUserLayout(String),
}

pub(crate) struct ZenKainUiHost {
    config: KainUiConfig,
    theme: ZenUiTheme,
    host_api: ZenHostApi,
    module_registry: ZenKainModuleRegistry,
    workspace: ZenWorkspaceManifest,
    feature_registry: ZenFeatureRegistry,
    session: ZenEditorSession,
    user_layouts: Vec<ZenUserWorkspaceLayout>,
    runtime_documents: Vec<ZenWorkspaceDocument>,
    document_buffers: HashMap<String, DocumentEditorBuffer>,
    asset_pipeline: Option<AssetPipeline>,
    dock_state: DockState<ZenDockTab>,
    debug_tree: String,
    source_label: String,
    shell_status: String,
    host_api_status: String,
    module_status: String,
    contract_status: String,
    registry_status: String,
    workspace_status: String,
    activity_status: String,
    import_status: String,
    inspector: InspectorDraft,
    viewport_request: Option<[u32; 2]>,
    viewport_rect_pixels: Option<[f32; 4]>,
    watched_files: Vec<WatchedFile>,
    last_hot_reload_poll: Instant,
    last_layout_persist: Instant,
    command_palette_open: bool,
    command_query: String,
    layout_name_draft: String,
}

impl ZenKainUiHost {
    pub(crate) fn new(config: KainUiConfig, theme: ZenUiTheme) -> Self {
        let host_api = ZenHostApi::load(&config.host_api_path).unwrap_or_else(|err| {
            panic!(
                "failed to load Zen host api manifest '{}': {err}",
                config.host_api_path
            )
        });
        let module_registry = ZenKainModuleRegistry::load(&config.modules_manifest_path)
            .unwrap_or_else(|err| {
                panic!(
                    "failed to load Zen Kain module manifest '{}': {err}",
                    config.modules_manifest_path
                )
            });
        let workspace =
            ZenWorkspaceManifest::load(&config.workspace_manifest_path).unwrap_or_else(|err| {
                panic!(
                    "failed to load Zen workspace manifest '{}': {err}",
                    config.workspace_manifest_path
                )
            });
        let mut session = load_editor_session(&workspace.workspace.key)
            .ok()
            .flatten()
            .unwrap_or_else(|| default_editor_session(&workspace));
        sync_session_with_workspace(&workspace, &mut session);
        let user_layouts = sanitize_user_layouts(
            &workspace,
            &load_user_layouts(&workspace.workspace.key)
                .ok()
                .unwrap_or_default(),
        );
        sync_session_with_user_layouts(&mut session, &user_layouts);
        let dock_state = load_persisted_dock_state(&workspace.workspace.key)
            .ok()
            .flatten()
            .map(|state| sanitize_dock_state(&workspace, &state))
            .unwrap_or_else(|| resolve_workspace_dock_state(&workspace, &session, &user_layouts));
        let (asset_pipeline, import_status) = match build_asset_pipeline() {
            Ok(pipeline) => (
                Some(pipeline),
                "asset import ready // gltf glb obj".to_string(),
            ),
            Err(err) => (None, format!("asset import unavailable: {err}")),
        };
        let mut host = Self {
            config,
            theme,
            host_api_status: host_api.summary(),
            module_status: module_registry.summary(),
            contract_status: contract_status(&host_api, &module_registry),
            registry_status: registry_status(),
            workspace_status: workspace_summary(&workspace),
            host_api,
            module_registry,
            feature_registry: workspace.feature_registry(),
            session,
            user_layouts,
            runtime_documents: Vec::new(),
            document_buffers: HashMap::new(),
            asset_pipeline,
            workspace,
            dock_state,
            debug_tree: String::new(),
            source_label: "embedded zen shell".to_string(),
            shell_status: "Kain shell idle".to_string(),
            activity_status: "workspace ready".to_string(),
            import_status,
            inspector: InspectorDraft::default(),
            viewport_request: None,
            viewport_rect_pixels: None,
            watched_files: Vec::new(),
            last_hot_reload_poll: Instant::now(),
            last_layout_persist: Instant::now(),
            command_palette_open: false,
            command_query: String::new(),
            layout_name_draft: String::new(),
        };
        host.reload();
        host
    }

    fn combined_documents(&self) -> Vec<ZenWorkspaceDocument> {
        let mut documents = self.workspace.documents.clone();
        documents.extend(self.runtime_documents.clone());
        documents
    }

    fn find_document(&self, document_key: &str) -> Option<ZenWorkspaceDocument> {
        self.workspace.document(document_key).cloned().or_else(|| {
            self.runtime_documents
                .iter()
                .find(|document| document.key == document_key)
                .cloned()
        })
    }

    fn document_exists(&self, document_key: &str) -> bool {
        self.workspace.document(document_key).is_some()
            || self
                .runtime_documents
                .iter()
                .any(|document| document.key == document_key)
    }

    fn reload(&mut self) {
        match ZenHostApi::load(&self.config.host_api_path) {
            Ok(host_api) => {
                self.host_api_status = host_api.summary();
                self.host_api = host_api;
            }
            Err(err) => {
                self.activity_status = format!("host api reload failed: {err}");
            }
        }

        match ZenKainModuleRegistry::load(&self.config.modules_manifest_path) {
            Ok(module_registry) => {
                self.module_status = module_registry.summary();
                self.module_registry = module_registry;
            }
            Err(err) => {
                self.activity_status = format!("module reload failed: {err}");
            }
        }

        match ZenWorkspaceManifest::load(&self.config.workspace_manifest_path) {
            Ok(workspace) => {
                self.workspace_status = workspace_summary(&workspace);
                self.session = load_editor_session(&workspace.workspace.key)
                    .ok()
                    .flatten()
                    .unwrap_or_else(|| default_editor_session(&workspace));
                sync_session_with_workspace(&workspace, &mut self.session);
                self.user_layouts = sanitize_user_layouts(
                    &workspace,
                    &load_user_layouts(&workspace.workspace.key)
                        .ok()
                        .unwrap_or_default(),
                );
                sync_session_with_user_layouts(&mut self.session, &self.user_layouts);
                self.dock_state = load_persisted_dock_state(&workspace.workspace.key)
                    .ok()
                    .flatten()
                    .map(|state| sanitize_dock_state(&workspace, &state))
                    .unwrap_or_else(|| {
                        resolve_workspace_dock_state(&workspace, &self.session, &self.user_layouts)
                    });
                self.feature_registry = workspace.feature_registry();
                self.workspace = workspace;
                let valid_document_keys = self
                    .workspace
                    .documents
                    .iter()
                    .chain(self.runtime_documents.iter())
                    .map(|document| document.key.clone())
                    .collect::<HashSet<_>>();
                self.document_buffers
                    .retain(|document_key, _| valid_document_keys.contains(document_key));
                if self
                    .session
                    .active_document
                    .as_deref()
                    .map(|document_key| !self.document_exists(document_key))
                    .unwrap_or(false)
                {
                    self.session.active_document = self
                        .workspace
                        .primary_document()
                        .map(|document| document.key.clone())
                        .or_else(|| {
                            self.runtime_documents
                                .first()
                                .map(|document| document.key.clone())
                        });
                }
            }
            Err(err) => {
                self.activity_status = format!("workspace reload failed: {err}");
            }
        }

        self.contract_status = contract_status(&self.host_api, &self.module_registry);
        self.registry_status = registry_status();

        let resolved_shell = load_shell_source(&self.config, &self.module_registry);
        let root_component = resolved_shell
            .as_ref()
            .map(|shell| shell.root_component.as_str())
            .unwrap_or(self.config.root_component.as_str());
        let source = resolved_shell
            .as_ref()
            .map(|shell| shell.source.as_str())
            .unwrap_or(DEFAULT_ZEN_SHELL_SOURCE);
        self.source_label = resolved_shell
            .as_ref()
            .map(|shell| format!("{} // {}", shell.module_key, shell.source_label))
            .unwrap_or_else(|| "embedded zen shell".to_string());

        match build_ui_output_from_source(source, root_component) {
            Ok(output) => {
                self.debug_tree = render_ui_output_debug(&output);
                self.shell_status = format!(
                    "Kain shell ready // root {} // {} nodes // {}",
                    root_component,
                    output.tree.nodes.len(),
                    self.source_label
                );
            }
            Err(err) => {
                self.debug_tree.clear();
                self.shell_status = format!(
                    "Kain shell compile failed for root {} from {}: {}",
                    root_component, self.source_label, err
                );
            }
        }

        self.watched_files = collect_watch_paths(&self.config, resolved_shell.as_ref())
            .into_iter()
            .map(|path| WatchedFile {
                modified: read_modified_time(&path),
                path,
            })
            .collect();
    }

    pub(crate) fn set_theme(&mut self, theme: ZenUiTheme) {
        self.theme = theme;
    }

    pub(crate) fn poll_hot_reload(&mut self) -> bool {
        if !self.config.hot_reload_enabled {
            return false;
        }
        let interval = Duration::from_millis(self.config.hot_reload_poll_ms);
        if self.last_hot_reload_poll.elapsed() < interval {
            return false;
        }
        self.last_hot_reload_poll = Instant::now();

        let mut changed_paths = Vec::new();
        for watched in &mut self.watched_files {
            let next_modified = read_modified_time(&watched.path);
            if next_modified != watched.modified {
                watched.modified = next_modified;
                changed_paths.push(watched.path.display().to_string());
            }
        }

        if changed_paths.is_empty() {
            return false;
        }

        self.reload();
        self.activity_status = format!("ui hot reloaded // {}", changed_paths.join(" | "));
        true
    }

    fn open_feature_tab(&mut self, feature_key: &str) {
        let tab = ZenDockTab {
            feature_key: feature_key.to_string(),
        };
        if let Some((surface, node, tab_index)) = self.dock_state.find_tab(&tab) {
            self.dock_state
                .set_focused_node_and_surface((surface, node));
            self.dock_state.set_active_tab((surface, node, tab_index));
        } else {
            self.dock_state.push_to_focused_leaf(tab);
        }
        if !self
            .session
            .open_features
            .iter()
            .any(|existing| existing == feature_key)
        {
            self.session.open_features.push(feature_key.to_string());
        }
    }

    fn select_document(&mut self, document_key: &str) {
        if let Some(document) = self.find_document(document_key) {
            self.session.active_document = Some(document.key.clone());
            self.ensure_document_buffer(&document);
            self.open_feature_tab("workspace.file_editor");
            self.activity_status = format!(
                "active document {} // {}",
                document.title,
                document.kind.to_ascii_lowercase()
            );
        }
    }

    fn import_asset_from_dialog(&mut self, scene: &mut ZenScene) {
        let Some(path) = rfd::FileDialog::new()
            .set_title("Import Asset Into Zen")
            .add_filter("3D Assets", &["gltf", "glb", "obj"])
            .pick_file()
        else {
            self.import_status = "asset import cancelled".to_string();
            self.activity_status = self.import_status.clone();
            return;
        };
        self.import_asset_path(path, scene);
    }

    fn import_asset_path(&mut self, path: PathBuf, scene: &mut ZenScene) {
        let Some(pipeline) = self.asset_pipeline.as_ref() else {
            self.import_status = "asset import unavailable".to_string();
            self.activity_status = self.import_status.clone();
            return;
        };

        match pipeline.import(&path) {
            Ok(asset) => match scene.import_asset(&asset) {
                Ok(report) => {
                    let document = runtime_document_from_asset(&asset);
                    self.upsert_runtime_document(document.clone());
                    self.ensure_document_buffer(&document);
                    self.session.active_document = Some(document.key.clone());
                    self.open_feature_tab("workspace.file_editor");
                    self.import_status = format!(
                        "imported {} // {} objects",
                        report.label, report.imported_objects
                    );
                    self.activity_status =
                        format!("imported {} from {}", report.label, path.display());
                }
                Err(err) => {
                    self.import_status = format!("scene import failed: {err}");
                    self.activity_status = self.import_status.clone();
                }
            },
            Err(err) => {
                self.import_status = format!("asset import failed: {err}");
                self.activity_status = self.import_status.clone();
            }
        }
    }

    fn upsert_runtime_document(&mut self, document: ZenWorkspaceDocument) {
        if let Some(existing) = self
            .runtime_documents
            .iter_mut()
            .find(|existing| existing.key == document.key)
        {
            *existing = document;
        } else {
            self.runtime_documents.push(document);
            self.runtime_documents
                .sort_by(|left, right| left.title.cmp(&right.title));
        }
    }

    fn ensure_document_buffer(&mut self, document: &ZenWorkspaceDocument) {
        if self.document_buffers.contains_key(&document.key) {
            return;
        }
        self.document_buffers.insert(
            document.key.clone(),
            load_document_editor_buffer(document)
                .unwrap_or_else(|_| DocumentEditorBuffer::default()),
        );
    }

    fn apply_workspace_preset(&mut self, preset_key: &str) {
        if let Some(preset) = self.workspace.preset(preset_key) {
            self.session.workspace_preset = Some(preset.key.clone());
            self.session.user_layout = None;
            self.session.viewport_layout = preset.viewport_layout.clone();
            self.dock_state = preset.build_dock_state();
            self.layout_name_draft.clear();
            self.activity_status = format!("workspace preset {}", preset.title);
            self.persist_editor_state();
        }
    }

    fn apply_user_layout(&mut self, layout_key: &str) {
        if let Some(layout) = self
            .user_layouts
            .iter()
            .find(|layout| layout.key == layout_key)
        {
            self.session.user_layout = Some(layout.key.clone());
            self.session.workspace_preset = None;
            self.session.viewport_layout = layout.viewport_layout.clone();
            self.dock_state = layout.dock_state.clone();
            self.layout_name_draft = layout.title.clone();
            self.activity_status = format!("user layout {}", layout.title);
            self.persist_editor_state();
        }
    }

    fn reset_workspace_layout(&mut self) {
        self.session.user_layout = None;
        if let Some(preset) = self
            .session
            .workspace_preset
            .as_deref()
            .and_then(|key| self.workspace.preset(key))
        {
            self.session.viewport_layout = preset.viewport_layout.clone();
            self.dock_state = preset.build_dock_state();
            self.layout_name_draft.clear();
            self.activity_status = format!("reset layout to {}", preset.title);
        } else {
            self.dock_state = self.workspace.build_dock_state();
            self.layout_name_draft.clear();
            self.activity_status = "reset layout to workspace default".to_string();
        }
        self.persist_editor_state();
    }

    fn save_user_layout(&mut self, requested_title: &str) {
        let fallback_title = self
            .session
            .user_layout
            .as_deref()
            .and_then(|key| self.user_layouts.iter().find(|layout| layout.key == key))
            .map(|layout| layout.title.clone())
            .unwrap_or_else(|| format!("Custom {}", self.user_layouts.len() + 1));
        let title = normalize_layout_title(requested_title).unwrap_or(fallback_title);
        let key = slugify_layout_key(&title);
        let layout = ZenUserWorkspaceLayout {
            key: key.clone(),
            title: title.clone(),
            viewport_layout: self.session.viewport_layout.clone(),
            dock_state: self.dock_state.clone(),
        };
        if let Some(existing) = self
            .user_layouts
            .iter_mut()
            .find(|existing| existing.key == key)
        {
            *existing = layout;
        } else {
            self.user_layouts.push(layout);
            self.user_layouts
                .sort_by(|left, right| left.title.cmp(&right.title));
        }
        self.session.user_layout = Some(key);
        self.session.workspace_preset = None;
        self.layout_name_draft = title.clone();
        let _ = persist_user_layouts(&self.workspace.workspace.key, &self.user_layouts);
        self.activity_status = format!("saved user layout {}", title);
        self.persist_editor_state();
    }

    fn delete_user_layout(&mut self, layout_key: &str) {
        let removed = self
            .user_layouts
            .iter()
            .find(|layout| layout.key == layout_key)
            .map(|layout| layout.title.clone());
        self.user_layouts.retain(|layout| layout.key != layout_key);
        if self.session.user_layout.as_deref() == Some(layout_key) {
            self.session.user_layout = None;
            self.reset_workspace_layout();
        }
        self.layout_name_draft.clear();
        let _ = persist_user_layouts(&self.workspace.workspace.key, &self.user_layouts);
        if let Some(title) = removed {
            self.activity_status = format!("removed user layout {}", title);
        }
        self.persist_editor_state();
    }

    fn persist_editor_state(&mut self) {
        let _ = persist_dock_state(&self.workspace.workspace.key, &self.dock_state);
        let _ = persist_editor_session(&self.workspace.workspace.key, &self.session);
        let _ = persist_user_layouts(&self.workspace.workspace.key, &self.user_layouts);
        self.last_layout_persist = Instant::now();
    }

    fn apply_palette_selection(
        &mut self,
        selection: CommandPaletteSelection,
        scene: &mut ZenScene,
        runtime: &mut ZenRuntimeSession,
        camera: &mut FlyCamera,
        fabric_service: &mut ZenFabricService,
    ) -> UiActionResult {
        match selection {
            CommandPaletteSelection::HostAction(action_key) => execute_ui_action(
                &self.host_api,
                &mut self.activity_status,
                Some(action_key.as_str()),
                scene,
                runtime,
                camera,
                fabric_service,
            ),
            CommandPaletteSelection::Feature(feature_key) => {
                self.open_feature_tab(&feature_key);
                if let Some(feature) = self.workspace.feature(&feature_key) {
                    self.activity_status = format!("opened feature {}", feature.title);
                }
                UiActionResult {
                    scene_changed: false,
                    reload_requested: false,
                }
            }
            CommandPaletteSelection::RegistryPackage(package_name) => {
                self.open_feature_tab("workspace.registry");
                self.activity_status = format!("opened registry package {}", package_name);
                UiActionResult {
                    scene_changed: false,
                    reload_requested: false,
                }
            }
            CommandPaletteSelection::Document(document_key) => {
                self.select_document(&document_key);
                UiActionResult {
                    scene_changed: false,
                    reload_requested: false,
                }
            }
            CommandPaletteSelection::Preset(preset_key) => {
                self.apply_workspace_preset(&preset_key);
                UiActionResult {
                    scene_changed: false,
                    reload_requested: false,
                }
            }
            CommandPaletteSelection::UserLayout(layout_key) => {
                self.apply_user_layout(&layout_key);
                UiActionResult {
                    scene_changed: false,
                    reload_requested: false,
                }
            }
        }
    }

    fn apply_workspace_panel_action(&mut self, action: WorkspacePanelAction, scene: &mut ZenScene) {
        match action {
            WorkspacePanelAction::SelectDocument(document_key) => {
                self.select_document(&document_key);
            }
            WorkspacePanelAction::ImportAsset => {
                self.import_asset_from_dialog(scene);
            }
            WorkspacePanelAction::ApplyPreset(preset_key) => {
                self.apply_workspace_preset(&preset_key);
            }
            WorkspacePanelAction::ApplyUserLayout(layout_key) => {
                self.apply_user_layout(&layout_key);
            }
            WorkspacePanelAction::SaveCurrentLayout(title) => {
                self.save_user_layout(&title);
            }
            WorkspacePanelAction::ResetWorkspace => {
                self.reset_workspace_layout();
            }
            WorkspacePanelAction::DeleteUserLayout(layout_key) => {
                self.delete_user_layout(&layout_key);
            }
        }
    }

    pub(crate) fn render(
        &mut self,
        ctx: &egui::Context,
        scene: &mut ZenScene,
        runtime: &mut ZenRuntimeSession,
        camera: &mut FlyCamera,
        fabric_service: &mut ZenFabricService,
        renderer: &mut RendererConfig,
        hud: ZenViewportHud,
        kain_status: &str,
    ) -> bool {
        if !self.config.enabled {
            return false;
        }

        apply_editor_theme(ctx, &self.theme);
        self.viewport_request = None;
        self.viewport_rect_pixels = None;
        let command_palette_shortcut =
            egui::KeyboardShortcut::new(egui::Modifiers::COMMAND, egui::Key::P);
        if ctx.input_mut(|input| input.consume_shortcut(&command_palette_shortcut)) {
            self.command_palette_open = true;
        }

        if self.config.show_runtime_inspector {
            egui::Window::new("Zen UI Diagnostics")
                .default_width(420.0)
                .show(ctx, |ui| {
                    ui.label(self.workspace_status.clone());
                    ui.label(self.host_api_status.clone());
                    ui.label(self.module_status.clone());
                    ui.label(self.contract_status.clone());
                    ui.label(self.registry_status.clone());
                    ui.label(self.shell_status.clone());
                    ui.separator();
                    ui.code(self.debug_tree.clone());
                });
        }

        render_workspace_topbar(
            ctx,
            &self.theme,
            &self.workspace.workspace.title,
            self.session.active_document.as_deref(),
            &self.session.viewport_layout,
            runtime.play_mode(),
            scene.selected_details(),
        );

        let documents = self.combined_documents();
        let palette_action = draw_command_palette(
            ctx,
            &self.theme,
            &mut self.command_palette_open,
            &mut self.command_query,
            &self.host_api,
            &self.feature_registry,
            &self.workspace,
            &documents,
            &self.session,
            &self.user_layouts,
        );
        let mut palette_scene_changed = false;
        let mut palette_reload_requested = false;
        if let Some(selection) = palette_action {
            let result = self.apply_palette_selection(selection, scene, runtime, camera, fabric_service);
            palette_scene_changed = result.scene_changed;
            palette_reload_requested = result.reload_requested;
        }

        let host_api_status = self.host_api_status.clone();
        let module_status = self.module_status.clone();
        let contract_status = self.contract_status.clone();
        let registry_status = self.registry_status.clone();
        let shell_status = self.shell_status.clone();
        let source_label = self.source_label.clone();
        let debug_tree = self.debug_tree.clone();
        let import_status = self.import_status.clone();
        let workspace = &self.workspace;
        let host_api = &self.host_api;
        let theme = &self.theme;
        let dock_state = &mut self.dock_state;
        let inspector = &mut self.inspector;
        let document_buffers = &mut self.document_buffers;
        let activity_status = &mut self.activity_status;
        let mut viewer = ZenDockViewer {
            workspace,
            documents: &documents,
            session: &mut self.session,
            user_layouts: &self.user_layouts,
            layout_name_draft: &mut self.layout_name_draft,
            document_buffers,
            host_api,
            theme,
            inspector,
            activity_status,
            scene,
            runtime,
            camera,
            fabric_service,
            renderer,
            hud,
            kain_status,
            pixels_per_point: ctx.pixels_per_point(),
            viewport_request: &mut self.viewport_request,
            viewport_rect_pixels: &mut self.viewport_rect_pixels,
            shell_status: &shell_status,
            source_label: &source_label,
            host_api_status: &host_api_status,
            module_status: &module_status,
            contract_status: &contract_status,
            registry_status: &registry_status,
            import_status: &import_status,
            debug_tree: &debug_tree,
            scene_changed: palette_scene_changed,
            requested_reload: palette_reload_requested,
            workspace_action: None,
        };

        egui::TopBottomPanel::bottom("zen-workspace-statusbar")
            .resizable(false)
            .exact_height(30.0)
            .frame(
                egui::Frame::default()
                    .fill(self.theme.palette.status_bg)
                    .inner_margin(egui::Margin::same(6)),
            )
            .show(ctx, |ui| {
                render_workspace_statusbar(
                    ui,
                    viewer.activity_status,
                    &shell_status,
                    &contract_status,
                    &registry_status,
                    viewer.fabric_service.status_summary(),
                    kain_status,
                );
            });

        egui::CentralPanel::default()
            .frame(egui::Frame::default().fill(Color32::TRANSPARENT))
            .show(ctx, |ui| {
                DockArea::new(dock_state)
                    .style(self.theme.dock_style(ctx.style().as_ref()))
                    .show_inside(ui, &mut viewer);
            });

        let scene_changed = viewer.scene_changed;
        let requested_reload = viewer.requested_reload;
        let workspace_action = viewer.workspace_action.clone();
        drop(viewer);
        if let Some(action) = workspace_action {
            self.apply_workspace_panel_action(action, scene);
        }
        if requested_reload {
            self.reload();
        }
        if self.last_layout_persist.elapsed() >= Duration::from_millis(900) {
            self.persist_editor_state();
        }

        scene_changed
    }

    pub(crate) fn take_viewport_request(&mut self) -> Option<[u32; 2]> {
        self.viewport_request.take()
    }

    pub(crate) fn viewport_rect_pixels(&self) -> Option<[f32; 4]> {
        self.viewport_rect_pixels
    }
}

struct ZenDockViewer<'a> {
    workspace: &'a ZenWorkspaceManifest,
    documents: &'a [ZenWorkspaceDocument],
    session: &'a mut ZenEditorSession,
    user_layouts: &'a [ZenUserWorkspaceLayout],
    layout_name_draft: &'a mut String,
    document_buffers: &'a mut HashMap<String, DocumentEditorBuffer>,
    host_api: &'a ZenHostApi,
    theme: &'a ZenUiTheme,
    inspector: &'a mut InspectorDraft,
    activity_status: &'a mut String,
    scene: &'a mut ZenScene,
    runtime: &'a mut ZenRuntimeSession,
    camera: &'a mut FlyCamera,
    fabric_service: &'a mut ZenFabricService,
    renderer: &'a mut RendererConfig,
    hud: ZenViewportHud,
    kain_status: &'a str,
    pixels_per_point: f32,
    viewport_request: &'a mut Option<[u32; 2]>,
    viewport_rect_pixels: &'a mut Option<[f32; 4]>,
    shell_status: &'a str,
    source_label: &'a str,
    host_api_status: &'a str,
    module_status: &'a str,
    contract_status: &'a str,
    registry_status: &'a str,
    import_status: &'a str,
    debug_tree: &'a str,
    scene_changed: bool,
    requested_reload: bool,
    workspace_action: Option<WorkspacePanelAction>,
}

impl<'a> ZenDockViewer<'a> {
    fn render_feature(&mut self, ui: &mut egui::Ui, feature: &ZenUiFeature) {
        match feature.kind {
            ZenUiFeatureKind::ActionStrip => draw_action_strip(
                ui,
                self.theme,
                feature,
                self.host_api,
                self.activity_status,
                self.scene,
                self.runtime,
                self.camera,
                &mut self.scene_changed,
                &mut self.requested_reload,
            ),
            ZenUiFeatureKind::Viewport => {
                draw_feature_panel(ui, self.theme, feature, true, |ui| {
                    validate_binding(
                        ui,
                        self.theme,
                        self.host_api,
                        feature,
                        ZenHostBindingKind::SceneViewport,
                    );
                    draw_viewport_panel(
                        ui,
                        self.theme,
                        feature,
                        self.scene,
                        self.hud,
                        self.kain_status,
                        self.pixels_per_point,
                        self.viewport_request,
                        self.viewport_rect_pixels,
                    );
                });
            }
            ZenUiFeatureKind::SceneTree => {
                draw_feature_panel(ui, self.theme, feature, false, |ui| {
                    if validate_binding(
                        ui,
                        self.theme,
                        self.host_api,
                        feature,
                        ZenHostBindingKind::SceneObjects,
                    ) {
                        egui::ScrollArea::vertical()
                            .id_salt(("scene-tree", feature.key.as_str()))
                            .show(ui, |ui| {
                                for entry in self.scene.object_entries() {
                                    self.scene_changed |=
                                        draw_scene_object_entry(ui, self.scene, &entry);
                                }
                            });
                    }
                });
            }
            ZenUiFeatureKind::SelectionInspector => {
                draw_feature_panel(ui, self.theme, feature, false, |ui| {
                    if validate_binding(
                        ui,
                        self.theme,
                        self.host_api,
                        feature,
                        ZenHostBindingKind::SceneSelection,
                    ) {
                        egui::ScrollArea::vertical()
                            .id_salt(("selection", feature.key.as_str()))
                            .show(ui, |ui| {
                                self.scene_changed |=
                                    draw_scene_selection_inspector(self.inspector, ui, self.scene);
                            });
                    }
                });
            }
            ZenUiFeatureKind::RuntimeInspector => {
                draw_feature_panel(ui, self.theme, feature, false, |ui| {
                    if validate_binding(
                        ui,
                        self.theme,
                        self.host_api,
                        feature,
                        ZenHostBindingKind::EngineRuntime,
                    ) {
                        egui::ScrollArea::vertical()
                            .id_salt(("runtime", feature.key.as_str()))
                            .show(ui, |ui| {
                                draw_runtime_inspector(
                                    ui,
                                    self.theme,
                                    feature,
                                    self.host_api,
                                    self.activity_status,
                                    self.scene,
                                    self.runtime,
                                    self.camera,
                                    self.renderer,
                                    self.scene.selected_details(),
                                    self.hud,
                                    &mut self.scene_changed,
                                    &mut self.requested_reload,
                                );
                            });
                    }
                });
            }
            ZenUiFeatureKind::Timeline => {
                draw_feature_panel(ui, self.theme, feature, false, |ui| {
                    validate_binding(
                        ui,
                        self.theme,
                        self.host_api,
                        feature,
                        ZenHostBindingKind::EngineTimeline,
                    );
                    draw_timeline_panel(ui, self.theme, feature);
                });
            }
            ZenUiFeatureKind::HostApi => {
                draw_feature_panel(ui, self.theme, feature, false, |ui| {
                    if validate_binding(
                        ui,
                        self.theme,
                        self.host_api,
                        feature,
                        ZenHostBindingKind::EngineHostApi,
                    ) {
                        egui::ScrollArea::vertical()
                            .id_salt(("host-api", feature.key.as_str()))
                            .show(ui, |ui| {
                                draw_host_api_inspector(
                                    ui,
                                    self.theme,
                                    self.host_api,
                                    self.registry_status,
                                );
                            });
                    }
                });
            }
            ZenUiFeatureKind::Registry => {
                draw_feature_panel(ui, self.theme, feature, false, |ui| {
                    egui::ScrollArea::vertical()
                        .id_salt(("registry", feature.key.as_str()))
                        .show(ui, |ui| {
                            draw_registry_inspector(ui, self.theme, feature, self.registry_status);
                        });
                });
            }
            ZenUiFeatureKind::KainStatus => {
                draw_feature_panel(ui, self.theme, feature, false, |ui| {
                    if validate_binding(
                        ui,
                        self.theme,
                        self.host_api,
                        feature,
                        ZenHostBindingKind::EngineKain,
                    ) {
                        egui::ScrollArea::vertical()
                            .id_salt(("kain-status", feature.key.as_str()))
                            .show(ui, |ui| {
                                draw_kain_status_panel(
                                    ui,
                                    self.theme,
                                    self.kain_status,
                                    self.shell_status,
                                    self.source_label,
                                    self.host_api_status,
                                    self.module_status,
                                    self.contract_status,
                                    self.registry_status,
                                    self.debug_tree,
                                );
                            });
                    }
                });
            }
            ZenUiFeatureKind::Fabric => {
                draw_feature_panel(ui, self.theme, feature, false, |ui| {
                    if validate_binding(
                        ui,
                        self.theme,
                        self.host_api,
                        feature,
                        ZenHostBindingKind::EngineFabric,
                    ) {
                        egui::ScrollArea::vertical()
                            .id_salt(("fabric", feature.key.as_str()))
                            .show(ui, |ui| {
                                draw_fabric_panel(
                                    ui,
                                    self.theme,
                                    self.fabric_service,
                                    self.activity_status,
                                );
                            });
                    }
                });
            }
            ZenUiFeatureKind::DocumentContext => {
                draw_feature_panel(ui, self.theme, feature, false, |ui| {
                    egui::ScrollArea::vertical()
                        .id_salt(("documents", feature.key.as_str()))
                        .show(ui, |ui| {
                            if let Some(action) = draw_document_context_panel_with_layouts(
                                ui,
                                self.theme,
                                self.workspace,
                                self.documents,
                                self.session,
                                self.user_layouts,
                                self.layout_name_draft,
                                self.import_status,
                            ) {
                                self.workspace_action = Some(action);
                            }
                        });
                });
            }
            ZenUiFeatureKind::FileEditor => {
                draw_feature_panel(ui, self.theme, feature, false, |ui| {
                    draw_document_editor_panel(
                        ui,
                        self.theme,
                        self.documents,
                        self.session,
                        self.document_buffers,
                        self.activity_status,
                    );
                });
            }
        }
    }
}

impl TabViewer for ZenDockViewer<'_> {
    type Tab = ZenDockTab;

    fn title(&mut self, tab: &mut Self::Tab) -> WidgetText {
        self.workspace
            .feature(&tab.feature_key)
            .map(|feature| feature.title.clone().into())
            .unwrap_or_else(|| tab.feature_key.clone().into())
    }

    fn ui(&mut self, ui: &mut egui::Ui, tab: &mut Self::Tab) {
        if let Some(feature) = self.workspace.feature(&tab.feature_key).cloned() {
            self.render_feature(ui, &feature);
        } else {
            draw_missing_feature(ui, &tab.feature_key);
        }
    }

    fn closeable(&mut self, tab: &mut Self::Tab) -> bool {
        self.workspace
            .feature(&tab.feature_key)
            .map(|feature| feature.closable)
            .unwrap_or(true)
    }
}

fn apply_editor_theme(ctx: &egui::Context, theme: &ZenUiTheme) {
    let mut style = (*ctx.style()).clone();
    theme.apply_to_style(&mut style);
    ctx.set_style(style);
}

fn render_workspace_topbar(
    ctx: &egui::Context,
    theme: &ZenUiTheme,
    workspace_title: &str,
    active_document: Option<&str>,
    viewport_layout: &str,
    play_mode: ZenPlayMode,
    selected: Option<SelectedObjectDetails>,
) {
    egui::TopBottomPanel::top("zen-workspace-topbar")
        .resizable(false)
        .exact_height(42.0)
        .frame(
            egui::Frame::default()
                .fill(theme.palette.toolbar_bg)
                .inner_margin(egui::Margin::symmetric(10, 8)),
        )
        .show(ctx, |ui| {
            ui.horizontal(|ui| {
                ui.label(
                    RichText::new(workspace_title)
                        .strong()
                        .size(20.0)
                        .color(ctx.style().visuals.strong_text_color()),
                );
                ui.separator();
                ui.label(
                    RichText::new(format!("doc {}", active_document.unwrap_or("none")))
                        .small()
                        .color(theme.palette.text_muted),
                );
                ui.separator();
                ui.label(
                    RichText::new(format!("layout {}", viewport_layout))
                        .small()
                        .color(theme.palette.text_muted),
                );
                ui.separator();
                ui.label(
                    RichText::new(format!("mode {:?}", play_mode))
                        .strong()
                        .color(ctx.style().visuals.warn_fg_color),
                );
                if let Some(selected) = selected {
                    ui.separator();
                    ui.label(
                        RichText::new(format!("selected {}", selected.name))
                            .color(ctx.style().visuals.hyperlink_color),
                    );
                }
            });
        });
}

fn render_workspace_statusbar(
    ui: &mut egui::Ui,
    activity_status: &str,
    shell_status: &str,
    contract_status: &str,
    registry_status: &str,
    fabric_status: &str,
    kain_status: &str,
) {
    ui.horizontal_wrapped(|ui| {
        ui.label(
            RichText::new(activity_status)
                .small()
                .color(ui.style().visuals.strong_text_color()),
        );
        ui.separator();
        ui.label(
            RichText::new(shell_status)
                .small()
                .color(ui.style().visuals.text_color()),
        );
        ui.separator();
        ui.label(
            RichText::new(contract_status)
                .small()
                .color(ui.style().visuals.hyperlink_color),
        );
        ui.separator();
        ui.label(
            RichText::new(registry_status)
                .small()
                .color(ui.style().visuals.text_color()),
        );
        ui.separator();
        ui.label(
            RichText::new(fabric_status)
                .small()
                .color(ui.style().visuals.hyperlink_color),
        );
        ui.separator();
        ui.label(
            RichText::new(kain_status)
                .small()
                .color(ui.style().visuals.warn_fg_color),
        );
    });
}

fn draw_command_palette(
    ctx: &egui::Context,
    theme: &ZenUiTheme,
    open: &mut bool,
    query: &mut String,
    host_api: &ZenHostApi,
    feature_registry: &ZenFeatureRegistry,
    workspace: &ZenWorkspaceManifest,
    documents: &[ZenWorkspaceDocument],
    session: &ZenEditorSession,
    user_layouts: &[ZenUserWorkspaceLayout],
) -> Option<CommandPaletteSelection> {
    if !*open {
        return None;
    }

    let mut chosen = None;
    let mut window_open = *open;
    let mut close_after_select = false;
    egui::Window::new("Zen Command Palette")
        .collapsible(false)
        .resizable(true)
        .default_width(520.0)
        .default_height(380.0)
        .open(&mut window_open)
        .frame(
            egui::Frame::default()
                .fill(theme.palette.panel_bg)
                .stroke(Stroke::new(1.0, theme.palette.border_strong))
                .corner_radius(corner_radius(theme.rounding.panel))
                .inner_margin(egui::Margin::same(theme.spacing.panel_margin as i8)),
        )
        .show(ctx, |ui| {
            ui.label(
                RichText::new("Search actions")
                    .strong()
                    .color(theme.palette.text_primary),
            );
            let response = ui.add(
                egui::TextEdit::singleline(query)
                    .hint_text("Search actions, tabs, documents, or presets...")
                    .desired_width(f32::INFINITY),
            );
            if response.lost_focus() && ui.input(|input| input.key_pressed(egui::Key::Escape)) {
                close_after_select = true;
            }
            ui.add_space(6.0);

            let query_lower = query.trim().to_ascii_lowercase();
            let matching_actions = host_api
                .actions()
                .iter()
                .filter(|action| {
                    query_lower.is_empty()
                        || action.label.to_ascii_lowercase().contains(&query_lower)
                        || action.key.to_ascii_lowercase().contains(&query_lower)
                        || action
                            .description
                            .to_ascii_lowercase()
                            .contains(&query_lower)
                })
                .collect::<Vec<_>>();
            let matching_features = feature_registry.search(query);
            let matching_documents = documents
                .iter()
                .filter(|document| {
                    query_lower.is_empty()
                        || document.key.to_ascii_lowercase().contains(&query_lower)
                        || document.title.to_ascii_lowercase().contains(&query_lower)
                        || document.kind.to_ascii_lowercase().contains(&query_lower)
                })
                .collect::<Vec<_>>();
            let matching_presets = workspace
                .presets
                .iter()
                .filter(|preset| {
                    query_lower.is_empty()
                        || preset.key.to_ascii_lowercase().contains(&query_lower)
                        || preset.title.to_ascii_lowercase().contains(&query_lower)
                        || preset
                            .viewport_layout
                            .to_ascii_lowercase()
                            .contains(&query_lower)
                })
                .collect::<Vec<_>>();
            let matching_user_layouts = user_layouts
                .iter()
                .filter(|layout| {
                    query_lower.is_empty()
                        || layout.key.to_ascii_lowercase().contains(&query_lower)
                        || layout.title.to_ascii_lowercase().contains(&query_lower)
                        || layout
                            .viewport_layout
                            .to_ascii_lowercase()
                            .contains(&query_lower)
                })
                .collect::<Vec<_>>();
            let matching_registry_packages = packages_for_host("zen")
                .into_iter()
                .filter(|package| {
                    query_lower.is_empty()
                        || package.name.to_ascii_lowercase().contains(&query_lower)
                        || package
                            .description
                            .to_ascii_lowercase()
                            .contains(&query_lower)
                        || package
                            .roles
                            .iter()
                            .any(|role| role.to_ascii_lowercase().contains(&query_lower))
                        || package
                            .capabilities
                            .iter()
                            .any(|capability| capability.to_ascii_lowercase().contains(&query_lower))
                        || package
                            .hosts
                            .iter()
                            .any(|host| host.to_ascii_lowercase().contains(&query_lower))
                        || package
                            .notes
                            .iter()
                            .any(|note| note.to_ascii_lowercase().contains(&query_lower))
                })
                .collect::<Vec<_>>();
            let result_count = matching_actions.len()
                + matching_features.len()
                + matching_documents.len()
                + matching_presets.len()
                + matching_user_layouts.len()
                + matching_registry_packages.len();

            ui.label(
                RichText::new(format!(
                    "{} results // actions {} // tabs {} // docs {} // presets {} // user layouts {} // registry {}",
                    result_count,
                    matching_actions.len(),
                    matching_features.len(),
                    matching_documents.len(),
                    matching_presets.len(),
                    matching_user_layouts.len(),
                    matching_registry_packages.len()
                ))
                .small()
                .color(theme.palette.text_muted),
            );
            ui.separator();
            egui::ScrollArea::vertical().show(ui, |ui| {
                if !matching_actions.is_empty() {
                    ui.label(
                        RichText::new("Actions")
                            .strong()
                            .color(theme.palette.text_secondary),
                    );
                    ui.add_space(4.0);
                }
                for action in matching_actions {
                    let label = format!("{}  ({})", action.label, action.key);
                    if ui
                        .add(
                            egui::Button::new(
                                RichText::new(label).color(theme.palette.text_primary),
                            )
                            .fill(theme.palette.panel_bg_alt)
                            .stroke(Stroke::new(1.0, theme.palette.border_subtle)),
                        )
                        .on_hover_text(&action.description)
                        .clicked()
                    {
                        chosen = Some(CommandPaletteSelection::HostAction(action.key.clone()));
                        close_after_select = true;
                    }
                    ui.label(
                        RichText::new(&action.description)
                            .small()
                            .color(theme.palette.text_muted),
                    );
                    ui.add_space(4.0);
                }

                if !matching_features.is_empty() {
                    ui.separator();
                    ui.label(
                        RichText::new("Feature Tabs")
                            .strong()
                            .color(theme.palette.text_secondary),
                    );
                    for feature in matching_features {
                        let subtitle = feature
                            .binding
                            .as_deref()
                            .map(|binding| format!("{} // {:?}", binding, feature.kind))
                            .unwrap_or_else(|| format!("{:?}", feature.kind));
                        if ui
                            .add(
                                egui::Button::new(
                                    RichText::new(format!("{}  ({})", feature.title, feature.key))
                                        .color(theme.palette.text_primary),
                                )
                                .fill(theme.palette.panel_bg_alt)
                                .stroke(Stroke::new(1.0, theme.palette.border_subtle)),
                            )
                            .clicked()
                        {
                            chosen = Some(CommandPaletteSelection::Feature(feature.key.clone()));
                            close_after_select = true;
                        }
                        ui.label(
                            RichText::new(subtitle)
                                .small()
                                .color(theme.palette.text_muted),
                        );
                        ui.add_space(4.0);
                    }
                }

                if !matching_documents.is_empty() {
                    ui.separator();
                    ui.label(
                        RichText::new("Documents")
                            .strong()
                            .color(theme.palette.text_secondary),
                    );
                    for document in matching_documents {
                        let is_active = session
                            .active_document
                            .as_deref()
                            .map(|active| active == document.key)
                            .unwrap_or(false);
                        let button_label = if is_active {
                            format!("{}  ({})  ACTIVE", document.title, document.kind)
                        } else {
                            format!("{}  ({})", document.title, document.kind)
                        };
                        if ui
                            .add(
                                egui::Button::new(
                                    RichText::new(button_label).color(theme.palette.text_primary),
                                )
                                .fill(theme.palette.panel_bg_alt)
                                .stroke(Stroke::new(1.0, theme.palette.border_subtle)),
                            )
                            .clicked()
                        {
                            chosen = Some(CommandPaletteSelection::Document(document.key.clone()));
                            close_after_select = true;
                        }
                        if let Some(path) = document.source_path.as_deref().or(document.path.as_deref()) {
                            ui.label(RichText::new(path).small().color(theme.palette.text_muted));
                        }
                        ui.add_space(4.0);
                    }
                }

                if !matching_presets.is_empty() {
                    ui.separator();
                    ui.label(
                        RichText::new("Workspace Presets")
                            .strong()
                            .color(theme.palette.text_secondary),
                    );
                    for preset in matching_presets {
                        let is_active = session
                            .workspace_preset
                            .as_deref()
                            .map(|active| active == preset.key)
                            .unwrap_or(false);
                        let button_label = if is_active {
                            format!("{}  ({})  ACTIVE", preset.title, preset.viewport_layout)
                        } else {
                            format!("{}  ({})", preset.title, preset.viewport_layout)
                        };
                        if ui
                            .add(
                                egui::Button::new(
                                    RichText::new(button_label).color(theme.palette.text_primary),
                                )
                                .fill(theme.palette.panel_bg_alt)
                                .stroke(Stroke::new(1.0, theme.palette.border_subtle)),
                            )
                            .clicked()
                        {
                            chosen = Some(CommandPaletteSelection::Preset(preset.key.clone()));
                            close_after_select = true;
                        }
                        ui.label(
                            RichText::new(format!(
                                "center {} // left {} // right {} // bottom {}",
                                preset.layout.center_tabs.len(),
                                preset.layout.left_tabs.len(),
                                preset.layout.right_tabs.len(),
                                preset.layout.bottom_tabs.len()
                            ))
                            .small()
                            .color(theme.palette.text_muted),
                        );
                        ui.add_space(4.0);
                    }
                }

                if !matching_user_layouts.is_empty() {
                    ui.separator();
                    ui.label(
                        RichText::new("User Layouts")
                            .strong()
                            .color(theme.palette.text_secondary),
                    );
                    for layout in matching_user_layouts {
                        let is_active = session
                            .user_layout
                            .as_deref()
                            .map(|active| active == layout.key)
                            .unwrap_or(false);
                        let button_label = if is_active {
                            format!("{}  ({})  ACTIVE", layout.title, layout.viewport_layout)
                        } else {
                            format!("{}  ({})", layout.title, layout.viewport_layout)
                        };
                        if ui
                            .add(
                                egui::Button::new(
                                    RichText::new(button_label).color(theme.palette.text_primary),
                                )
                                .fill(theme.palette.panel_bg_alt)
                                .stroke(Stroke::new(1.0, theme.palette.border_subtle)),
                            )
                            .clicked()
                        {
                            chosen =
                                Some(CommandPaletteSelection::UserLayout(layout.key.clone()));
                            close_after_select = true;
                        }
                        ui.label(
                            RichText::new(format!("layout {}", layout.viewport_layout))
                            .small()
                            .color(theme.palette.text_muted),
                        );
                        ui.add_space(4.0);
                    }
                }

                if !matching_registry_packages.is_empty() {
                    ui.separator();
                    ui.label(
                        RichText::new("Registry Packages")
                            .strong()
                            .color(theme.palette.text_secondary),
                    );
                    for package in matching_registry_packages {
                        let details = integration_contract_for_package(&package.name)
                            .map(|contract| {
                                format!(
                                    "{} // {} // {} entrypoints",
                                    contract.stability_tier,
                                    contract.pressure_priority,
                                    contract.recommended_entrypoints.len()
                                )
                            })
                            .unwrap_or_else(|| "untracked contract".to_string());
                        if ui
                            .add(
                                egui::Button::new(
                                    RichText::new(format!(
                                        "{}  ({})",
                                        package.name, package.description
                                    ))
                                    .color(theme.palette.text_primary),
                                )
                                .fill(theme.palette.panel_bg_alt)
                                .stroke(Stroke::new(1.0, theme.palette.border_subtle)),
                            )
                            .clicked()
                        {
                            chosen = Some(CommandPaletteSelection::RegistryPackage(
                                package.name.clone(),
                            ));
                            close_after_select = true;
                        }
                        ui.label(
                            RichText::new(format!(
                                "{} // hosts {} // caps {}",
                                details,
                                package.hosts.join(", "),
                                package.capabilities.join(", ")
                            ))
                            .small()
                            .color(theme.palette.text_muted),
                        );
                        ui.add_space(4.0);
                    }
                }
            });
        });

    *open = window_open && !close_after_select;
    chosen
}

fn draw_feature_panel(
    ui: &mut egui::Ui,
    theme: &ZenUiTheme,
    feature: &ZenUiFeature,
    transparent: bool,
    draw: impl FnOnce(&mut egui::Ui),
) {
    let frame = if transparent {
        egui::Frame::default()
            .fill(Color32::from_rgba_unmultiplied(
                theme.palette.window_bg.r(),
                theme.palette.window_bg.g(),
                theme.palette.window_bg.b(),
                26,
            ))
            .inner_margin(egui::Margin::same(theme.spacing.panel_margin as i8))
    } else {
        egui::Frame::default()
            .fill(theme.palette.panel_bg)
            .stroke(Stroke::new(1.0, theme.palette.border_subtle))
            .corner_radius(corner_radius(theme.rounding.panel))
            .inner_margin(egui::Margin::same(theme.spacing.panel_margin as i8))
    };

    frame.show(ui, |ui| {
        if !transparent {
            ui.label(
                RichText::new(&feature.title)
                    .strong()
                    .size(16.0)
                    .color(theme.palette.text_primary),
            );
            ui.add_space(6.0);
        }
        draw(ui);
    });
}

fn validate_binding(
    ui: &mut egui::Ui,
    theme: &ZenUiTheme,
    host_api: &ZenHostApi,
    feature: &ZenUiFeature,
    expected: ZenHostBindingKind,
) -> bool {
    let Some(binding_key) = feature.binding.as_deref() else {
        ui.label(
            RichText::new("feature missing binding")
                .small()
                .color(theme.palette.danger),
        );
        return false;
    };
    let Some(binding) = host_api.binding(binding_key) else {
        ui.label(
            RichText::new(format!("unresolved binding {}", binding_key))
                .small()
                .color(theme.palette.danger),
        );
        return false;
    };
    if binding.kind != expected {
        ui.label(
            RichText::new(format!(
                "binding {} resolved to {:?}, expected {:?}",
                binding_key, binding.kind, expected
            ))
            .small()
            .color(theme.palette.danger),
        );
        return false;
    }
    true
}

#[allow(clippy::too_many_arguments)]
fn draw_action_strip(
    ui: &mut egui::Ui,
    theme: &ZenUiTheme,
    feature: &ZenUiFeature,
    host_api: &ZenHostApi,
    activity_status: &mut String,
    scene: &mut ZenScene,
    runtime: &mut ZenRuntimeSession,
    camera: &mut FlyCamera,
    scene_changed: &mut bool,
    requested_reload: &mut bool,
) {
    draw_feature_panel(ui, theme, feature, false, |ui| {
        ui.label(
            RichText::new("Feature-declared actions")
                .small()
                .color(theme.palette.text_muted),
        );
        ui.add_space(6.0);
        egui::ScrollArea::vertical()
            .id_salt(("action-strip", feature.key.as_str()))
            .show(ui, |ui| {
                ui.horizontal_wrapped(|ui| {
                    for action_key in &feature.actions {
                        if let Some(action) = host_api.action(action_key) {
                            if draw_action_button(ui, theme, action).clicked() {
                                let result = execute_ui_action(
                                    host_api,
                                    activity_status,
                                    Some(action.key.as_str()),
                                    scene,
                                    runtime,
                                    camera,
                                    fabric_service,
                                );
                                *scene_changed |= result.scene_changed;
                                *requested_reload |= result.reload_requested;
                            }
                        } else {
                            ui.label(
                                RichText::new(format!("missing {}", action_key))
                                    .small()
                                    .monospace()
                                    .color(theme.palette.danger),
                            );
                        }
                    }
                });
            });
    });
}

fn draw_action_button(
    ui: &mut egui::Ui,
    theme: &ZenUiTheme,
    action: &ZenHostAction,
) -> egui::Response {
    ui.add(
        egui::Button::new(RichText::new(&action.label).size(13.0))
            .fill(theme.palette.accent_soft)
            .stroke(Stroke::new(1.0, theme.palette.border_strong)),
    )
    .on_hover_text(format!("{} ({})", action.description, action.key))
}

fn draw_scene_object_entry(
    ui: &mut egui::Ui,
    scene: &mut ZenScene,
    entry: &SceneObjectEntry,
) -> bool {
    let mut changed = false;
    ui.horizontal(|ui| {
        let label = format!(
            "{}  [{}v/{}f]",
            entry.name, entry.vertex_count, entry.face_count
        );
        if ui.selectable_label(entry.selected, label).clicked() {
            changed |= scene.select_raw_handle(entry.handle_raw);
        }
    });
    changed
}

fn draw_scene_selection_inspector(
    inspector: &mut InspectorDraft,
    ui: &mut egui::Ui,
    scene: &mut ZenScene,
) -> bool {
    let mut changed = false;
    let details = scene.selected_details();
    sync_inspector_draft(inspector, details.as_ref());

    if let Some(details) = details {
        ui.group(|ui| {
            ui.label(
                RichText::new(format!("Object #{}", details.summary.handle.raw()))
                    .color(ui.style().visuals.text_color())
                    .size(12.0),
            );
            if ui.text_edit_singleline(&mut inspector.name).changed() {
                changed |= scene
                    .rename_selected(inspector.name.clone())
                    .unwrap_or(false);
            }
        });

        ui.add_space(8.0);
        ui.group(|ui| {
            ui.label(RichText::new("Translation").strong());
            changed |= draw_vec3_controls(ui, &mut inspector.translation)
                .and_then(|value| scene.set_selected_translation(value).ok())
                .unwrap_or(false);
        });

        ui.add_space(8.0);
        ui.group(|ui| {
            ui.label(RichText::new("Scale").strong());
            changed |= draw_vec3_controls(ui, &mut inspector.scale)
                .and_then(|value| scene.set_selected_scale(value).ok())
                .unwrap_or(false);
        });

        let schema = selection_inspector_schema(&details);
        ui.add_space(8.0);
        render_inspector_schema(ui, &schema, None);
    } else {
        ui.group(|ui| {
            ui.label(RichText::new("No object selected").strong());
            ui.label("Left-click a primitive in the viewport or pick one from the outliner.");
        });
    }

    changed
}

#[allow(clippy::too_many_arguments)]
fn draw_runtime_inspector(
    ui: &mut egui::Ui,
    theme: &ZenUiTheme,
    feature: &ZenUiFeature,
    host_api: &ZenHostApi,
    activity_status: &mut String,
    scene: &mut ZenScene,
    runtime: &mut ZenRuntimeSession,
    camera: &mut FlyCamera,
    renderer: &mut RendererConfig,
    details: Option<SelectedObjectDetails>,
    hud: ZenViewportHud,
    scene_changed: &mut bool,
    requested_reload: &mut bool,
) {
    ui.horizontal_wrapped(|ui| {
        ui.label(
            RichText::new(format!("mode {:?}", runtime.play_mode()))
                .strong()
                .color(theme.palette.warning),
        );
        for action_key in &feature.actions {
            if let Some(action) = host_api.action(action_key) {
                if draw_action_button(ui, theme, action).clicked() {
                    let result = execute_ui_action(
                        host_api,
                        activity_status,
                        Some(action.key.as_str()),
                        scene,
                        runtime,
                        camera,
                        fabric_service,
                    );
                    *scene_changed |= result.scene_changed;
                    *requested_reload |= result.reload_requested;
                }
            }
        }
        ui.label(
            RichText::new("Hotkeys: F focus, H frame, RMB freelook")
                .small()
                .color(theme.palette.text_muted),
        );
    });
    let schema = runtime_inspector_schema(runtime, renderer, hud, details.as_ref());
    render_inspector_schema(ui, &schema, None);
    ui.separator();
    ui.label(RichText::new("Renderer").strong());
    ui.add(
        egui::Slider::new(&mut renderer.ambient_strength, 0.05..=1.0)
            .text("Ambient")
            .clamping(egui::SliderClamping::Always),
    );
    ui.add(
        egui::Slider::new(&mut renderer.fog_density, 0.0..=0.18)
            .text("Fog")
            .clamping(egui::SliderClamping::Always),
    );
    ui.add(
        egui::Slider::new(&mut renderer.shadow_strength, 0.0..=1.0)
            .text("Shadow")
            .clamping(egui::SliderClamping::Always),
    );
    ui.add(
        egui::Slider::new(&mut renderer.rim_strength, 0.0..=2.0)
            .text("Rim")
            .clamping(egui::SliderClamping::Always),
    );
    ui.add(
        egui::Slider::new(&mut renderer.grid_intensity, 0.0..=2.0)
            .text("Grid")
            .clamping(egui::SliderClamping::Always),
    );
}

fn draw_host_api_inspector(
    ui: &mut egui::Ui,
    theme: &ZenUiTheme,
    host_api: &ZenHostApi,
    registry_status: &str,
) {
    ui.label(
        RichText::new(host_api.summary())
            .small()
            .color(theme.palette.text_muted),
    );
    ui.separator();
    ui.label(
        RichText::new("Actions")
            .strong()
            .color(theme.palette.text_secondary),
    );
    for action in host_api.actions() {
        ui.horizontal_wrapped(|ui| {
            ui.label(
                RichText::new(&action.label)
                    .strong()
                    .color(theme.palette.text_primary),
            );
            ui.label(
                RichText::new(&action.key)
                    .monospace()
                    .color(theme.palette.text_muted),
            );
            ui.label(
                RichText::new(command_label(&action.command))
                    .small()
                    .color(theme.palette.warning),
            );
        });
        ui.small(&action.description);
        ui.add_space(6.0);
    }
    ui.separator();
    ui.label(
        RichText::new("Bindings")
            .strong()
            .color(theme.palette.text_secondary),
    );
    for binding in host_api.bindings() {
        ui.horizontal_wrapped(|ui| {
            ui.label(
                RichText::new(&binding.label)
                    .strong()
                    .color(theme.palette.text_primary),
            );
            ui.label(
                RichText::new(&binding.key)
                    .monospace()
                    .color(theme.palette.text_muted),
            );
            ui.label(
                RichText::new(format!("widget {}", binding.widget))
                    .small()
                    .color(theme.palette.warning),
            );
        });
        ui.small(&binding.description);
        ui.add_space(6.0);
    }
    ui.separator();
    ui.label(
        RichText::new("Generated Registry")
            .strong()
            .color(theme.palette.text_secondary),
    );
    ui.monospace(registry_status);
    if let Some(adapter) = adapter_manifest_for_target("zen") {
        ui.label(
            RichText::new(format!(
                "zen adapter {} packages // {} bindings",
                adapter.package_count,
                adapter.packages.len()
            ))
            .small()
            .color(theme.palette.text_muted),
        );
    }
}

fn draw_registry_inspector(
    ui: &mut egui::Ui,
    theme: &ZenUiTheme,
    feature: &ZenUiFeature,
    registry_status: &str,
) {
    ui.label(
        RichText::new(feature.title.clone())
            .strong()
            .color(theme.palette.text_primary),
    );
    ui.monospace(registry_status);
    ui.separator();

    let workspace = workspace_registry();
    let integration = integration_registry();
    let adapters = adapter_manifests();
    let zen_packages = packages_for_host("zen");

    ui.label(
        RichText::new("Workspace Registry")
            .strong()
            .color(theme.palette.text_secondary),
    );
    ui.monospace(format!(
        "{} packages // {} edges // {} artifacts // {} aggregators",
        workspace.package_count,
        workspace.local_dependency_edge_count,
        workspace.artifacts.len(),
        workspace.aggregator_packages.len()
    ));
    ui.monospace(format!(
        "integration {} host-api // {} integration // {} internal",
        integration.host_api_count, integration.integration_count, integration.internal_count
    ));
    ui.monospace(format!("adapter targets {}", adapters.adapter_count));

    if let Some(zen_adapter) = adapter_manifest_for_target("zen") {
        ui.separator();
        ui.label(
            RichText::new("Zen Adapter")
                .strong()
                .color(theme.palette.text_secondary),
        );
        ui.monospace(format!(
            "{} packages // {} bindings",
            zen_adapter.package_count,
            zen_adapter.packages.len()
        ));
        for package in &zen_adapter.packages {
            ui.label(
                RichText::new(format!(
                    "{} // {} // {}",
                    package.package_name, package.stability_tier, package.pressure_priority
                ))
                .small()
                .color(theme.palette.text_primary),
            );
            ui.small(package.capabilities.join(", "));
            if !package.recommended_entrypoints.is_empty() {
                ui.small(format!(
                    "entrypoints: {}",
                    package.recommended_entrypoints.join(", ")
                ));
            }
            ui.add_space(4.0);
        }
    }

    ui.separator();
    ui.label(
        RichText::new("Zen Host Packages")
            .strong()
            .color(theme.palette.text_secondary),
    );
    ui.monospace(format!(
        "{} packages discovered for host zen",
        zen_packages.len()
    ));
    for package in zen_packages {
        let contract = integration_contract_for_package(&package.name);
        ui.label(
            RichText::new(format!("{} // {}", package.name, package.description))
                .small()
                .color(theme.palette.text_primary),
        );
        ui.small(format!(
            "roles: {}",
            if package.roles.is_empty() {
                "none".to_string()
            } else {
                package.roles.join(", ")
            }
        ));
        ui.small(format!(
            "caps: {}",
            if package.capabilities.is_empty() {
                "none".to_string()
            } else {
                package.capabilities.join(", ")
            }
        ));
        if let Some(contract) = contract {
            ui.small(format!(
                "{} // {} // score {}",
                contract.stability_tier, contract.pressure_priority, contract.pressure_score
            ));
            if !contract.recommended_entrypoints.is_empty() {
                ui.small(format!(
                    "entrypoints: {}",
                    contract.recommended_entrypoints.join(", ")
                ));
            }
        }
        ui.add_space(6.0);
    }
}

fn draw_fabric_panel(
    ui: &mut egui::Ui,
    theme: &ZenUiTheme,
    fabric_service: &mut ZenFabricService,
    activity_status: &mut String,
) {
    ui.horizontal_wrapped(|ui| {
        ui.label(
            RichText::new(fabric_service.status_summary())
                .strong()
                .color(theme.palette.text_primary),
        );
        if ui.button("Refresh").clicked() {
            fabric_service.refresh_status();
            *activity_status = "fabric status refreshed".to_string();
        }
        if ui
            .add_enabled(fabric_service.enabled(), egui::Button::new("Run Configured Manifest"))
            .clicked()
        {
            match fabric_service.run_configured_manifest() {
                Ok(result) => {
                    *activity_status = format!(
                        "fabric session {} // {:?} // {} steps",
                        result.session_id,
                        result.status,
                        result.step_results.len()
                    );
                }
                Err(err) => {
                    *activity_status = err;
                }
            }
        }
    });

    ui.separator();
    ui.label(
        RichText::new("Intent Registry")
            .strong()
            .color(theme.palette.text_secondary),
    );
    ui.monospace(fabric_service.configured_intent_registry_path());
    match fabric_service.resolved_intent_registry_path() {
        Some(path) => {
            ui.small(format!("resolved: {}", path.display()));
            ui.small(format!("exists: {}", path.exists()));
        }
        None => {
            ui.small("resolved: unavailable");
        }
    }
    if !fabric_service.scene_dirty_intents().is_empty() {
        ui.small(format!(
            "scene-dirty intents: {}",
            fabric_service.scene_dirty_intents().join(", ")
        ));
    }

    if let Some(error) = fabric_service.intent_registry_error() {
        ui.colored_label(theme.palette.warning, error);
    } else if !fabric_service.intent_profiles().is_empty() {
        ui.add_space(6.0);
        ui.label(
            RichText::new("Available Intents")
                .strong()
                .color(theme.palette.text_secondary),
        );
        for intent in fabric_service.intent_profiles().to_vec() {
            ui.group(|ui| {
                ui.horizontal_wrapped(|ui| {
                    ui.label(
                        RichText::new(format!("{} [{}]", intent.label, intent.lane))
                            .strong()
                            .color(theme.palette.text_primary),
                    );
                    if ui
                        .add_enabled(
                            fabric_service.enabled(),
                            egui::Button::new(format!("Run {}", intent.id)),
                        )
                        .clicked()
                    {
                        match fabric_service.run_intent(&intent.id) {
                            Ok(result) => {
                                *activity_status = format!(
                                    "fabric intent {} // session {} // {:?} // {} steps",
                                    intent.id,
                                    result.session_id,
                                    result.status,
                                    result.step_results.len()
                                );
                            }
                            Err(err) => {
                                *activity_status = err;
                            }
                        }
                    }
                });
                ui.small(intent.summary.as_str());
                ui.small(format!("graph: {}", intent.graph));
                ui.small(format!("debounce: {} ms", intent.debounce_ms));
                if !intent.produces.is_empty() {
                    ui.small(format!("produces: {}", intent.produces.join(", ")));
                }
            });
            ui.add_space(4.0);
        }
    }

    ui.separator();
    ui.label(
        RichText::new("Configured Manifest")
            .strong()
            .color(theme.palette.text_secondary),
    );
    ui.monospace(fabric_service.configured_manifest_path());
    match fabric_service.resolved_manifest_path() {
        Some(path) => {
            ui.small(format!("resolved: {}", path.display()));
            ui.small(format!("exists: {}", path.exists()));
        }
        None => {
            ui.small("resolved: unavailable");
        }
    }

    if let Some(error) = fabric_service.last_error() {
        ui.separator();
        ui.label(
            RichText::new("Last Error")
                .strong()
                .color(theme.palette.danger),
        );
        ui.colored_label(theme.palette.danger, error);
    }

    if let Some(result) = fabric_service.last_result() {
        ui.separator();
        ui.label(
            RichText::new("Latest Session")
                .strong()
                .color(theme.palette.text_secondary),
        );
        if let Some(run_label) = fabric_service.last_run_label() {
            ui.small(format!("run: {run_label}"));
        }
        ui.monospace(format!("session: {}", result.session_id));
        ui.small(format!("status: {:?}", result.status));
        ui.small(format!("report: {}", result.report_path.display()));
        ui.small(format!("lock: {}", result.lock_path.display()));
        if let Some(events_path) = &result.events_path {
            ui.small(format!("events: {}", events_path.display()));
        }

        ui.add_space(6.0);
        ui.label(
            RichText::new("Step Results")
                .strong()
                .color(theme.palette.text_secondary),
        );
        for step in &result.step_results {
            ui.label(
                RichText::new(format!(
                    "{} // {:?} // {:?} // {} outputs",
                    step.id,
                    step.runtime,
                    step.status,
                    step.outputs.len()
                ))
                .small()
                .color(theme.palette.text_primary),
            );
            if let Some(adapter) = &step.adapter {
                ui.small(format!("adapter: {adapter}"));
            }
            if let Some(error) = &step.error {
                ui.small(format!("error: {} // {}", error.code, error.message));
            }
            ui.add_space(4.0);
        }
    }

    if !fabric_service.recent_events().is_empty() {
        ui.separator();
        ui.label(
            RichText::new("Recent Events")
                .strong()
                .color(theme.palette.text_secondary),
        );
        for event in fabric_service.recent_events() {
            ui.monospace(event);
        }
    }
}

fn draw_document_context_panel_with_layouts(
    ui: &mut egui::Ui,
    theme: &ZenUiTheme,
    workspace: &ZenWorkspaceManifest,
    documents: &[ZenWorkspaceDocument],
    session: &mut ZenEditorSession,
    user_layouts: &[ZenUserWorkspaceLayout],
    layout_name_draft: &mut String,
    import_status: &str,
) -> Option<WorkspacePanelAction> {
    let active_document = session.active_document.clone();
    let active_preset = session.workspace_preset.clone();
    let active_user_layout = session.user_layout.clone();
    let mut action = None;
    ui.label(
        RichText::new(format!(
            "{} documents // {} presets // {} user layouts",
            documents.len(),
            workspace.presets.len(),
            user_layouts.len()
        ))
        .small()
        .color(theme.palette.text_muted),
    );
    ui.horizontal_wrapped(|ui| {
        if ui.button("Import Asset").clicked() {
            action = Some(WorkspacePanelAction::ImportAsset);
        }
        ui.label(
            RichText::new(import_status)
                .small()
                .color(theme.palette.text_muted),
        );
    });
    ui.separator();
    for document in documents {
        let is_active = active_document
            .as_deref()
            .map(|selected| selected == document.key)
            .unwrap_or(false);
        if ui
            .selectable_label(
                is_active,
                format!("{}  ({})", document.title, document.kind),
            )
            .clicked()
        {
            action = Some(WorkspacePanelAction::SelectDocument(document.key.clone()));
        }
        if let Some(path) = document.source_path.as_deref().or(document.path.as_deref()) {
            ui.label(RichText::new(path).small().color(theme.palette.text_muted));
        }
        ui.add_space(4.0);
    }
    if !workspace.presets.is_empty() {
        ui.separator();
        ui.label(
            RichText::new("Default Layouts")
                .strong()
                .color(theme.palette.text_secondary),
        );
        for preset in &workspace.presets {
            let selected = active_preset
                .as_deref()
                .map(|active| active == preset.key)
                .unwrap_or(false);
            if ui
                .selectable_label(
                    selected,
                    format!("{}  ({})", preset.title, preset.viewport_layout),
                )
                .clicked()
            {
                action = Some(WorkspacePanelAction::ApplyPreset(preset.key.clone()));
            }
        }
    }

    ui.separator();
    ui.label(
        RichText::new("User Layouts")
            .strong()
            .color(theme.palette.text_secondary),
    );
    ui.horizontal(|ui| {
        ui.label(
            RichText::new("Name")
                .small()
                .color(theme.palette.text_muted),
        );
        ui.add(
            egui::TextEdit::singleline(layout_name_draft)
                .hint_text("Gameplay, Lookdev, Animation...")
                .desired_width(f32::INFINITY),
        );
    });
    ui.horizontal_wrapped(|ui| {
        if ui.button("Save Current").clicked() {
            action = Some(WorkspacePanelAction::SaveCurrentLayout(
                layout_name_draft.clone(),
            ));
        }
        if ui.button("Reset Workspace").clicked() {
            action = Some(WorkspacePanelAction::ResetWorkspace);
        }
    });
    if let Some(active) = active_user_layout.as_deref() {
        ui.label(
            RichText::new(format!("active user layout {}", active))
                .small()
                .color(theme.palette.warning),
        );
    } else if let Some(active) = active_preset.as_deref() {
        ui.label(
            RichText::new(format!("active default {}", active))
                .small()
                .color(theme.palette.text_muted),
        );
    }
    ui.add_space(4.0);
    if user_layouts.is_empty() {
        ui.label(
            RichText::new("No saved user layouts yet. Save the current dock to create one.")
                .small()
                .color(theme.palette.text_muted),
        );
    } else {
        for layout in user_layouts {
            let selected = active_user_layout
                .as_deref()
                .map(|active| active == layout.key)
                .unwrap_or(false);
            ui.group(|ui| {
                ui.horizontal_wrapped(|ui| {
                    if ui
                        .selectable_label(
                            selected,
                            format!("{}  ({})", layout.title, layout.viewport_layout),
                        )
                        .clicked()
                    {
                        action = Some(WorkspacePanelAction::ApplyUserLayout(layout.key.clone()));
                    }
                    if ui.small_button("Load").clicked() {
                        action = Some(WorkspacePanelAction::ApplyUserLayout(layout.key.clone()));
                    }
                    if ui.small_button("Delete").clicked() {
                        action = Some(WorkspacePanelAction::DeleteUserLayout(layout.key.clone()));
                    }
                });
                ui.label(
                    RichText::new(layout.key.as_str())
                        .small()
                        .color(theme.palette.text_muted),
                );
            });
            ui.add_space(4.0);
        }
    }

    action
}

fn draw_document_editor_panel(
    ui: &mut egui::Ui,
    theme: &ZenUiTheme,
    documents: &[ZenWorkspaceDocument],
    session: &ZenEditorSession,
    document_buffers: &mut HashMap<String, DocumentEditorBuffer>,
    activity_status: &mut String,
) {
    let Some(document_key) = session.active_document.as_deref() else {
        ui.label(
            RichText::new("No active document")
                .strong()
                .color(theme.palette.text_primary),
        );
        ui.label(
            RichText::new("Select a document from the Workspace tab to open it here.")
                .small()
                .color(theme.palette.text_muted),
        );
        return;
    };

    let Some(document) = documents
        .iter()
        .find(|document| document.key == document_key)
    else {
        ui.label(
            RichText::new("Missing document")
                .strong()
                .color(theme.palette.danger),
        );
        ui.label(
            RichText::new("The active document no longer exists in the workspace manifest.")
                .small()
                .color(theme.palette.text_muted),
        );
        return;
    };

    let buffer = document_buffers
        .entry(document.key.clone())
        .or_insert_with(|| load_document_editor_buffer(document).unwrap_or_default());
    let dirty = buffer.text != buffer.saved_text;

    ui.horizontal_wrapped(|ui| {
        ui.label(
            RichText::new(&document.title)
                .strong()
                .size(16.0)
                .color(theme.palette.text_primary),
        );
        ui.label(
            RichText::new(format!("kind {}", document.kind))
                .small()
                .color(theme.palette.text_muted),
        );
        if dirty {
            ui.label(
                RichText::new("modified")
                    .small()
                    .color(theme.palette.warning),
            );
        } else {
            ui.label(
                RichText::new("saved")
                    .small()
                    .color(theme.palette.text_muted),
            );
        }
    });
    ui.label(
        RichText::new(&buffer.source_label)
            .small()
            .monospace()
            .color(theme.palette.text_muted),
    );
    ui.add_space(6.0);

    ui.horizontal_wrapped(|ui| {
        let save_enabled = buffer.source_path.is_some() && !buffer.read_only;
        if ui
            .add_enabled(save_enabled, egui::Button::new("Save"))
            .clicked()
        {
            match save_document_editor_buffer(buffer) {
                Ok(status) => {
                    *activity_status = status.clone();
                    buffer.status = status;
                }
                Err(err) => {
                    *activity_status = format!("document save failed: {err}");
                    buffer.status = err;
                }
            }
        }
        if ui.button("Reload From Disk").clicked() {
            match load_document_editor_buffer(document) {
                Ok(reloaded) => {
                    *buffer = reloaded;
                    *activity_status = format!("reloaded {}", document.title);
                }
                Err(err) => {
                    *activity_status = format!("document reload failed: {err}");
                    buffer.status = err;
                }
            }
        }
        ui.label(
            RichText::new(&buffer.status)
                .small()
                .color(theme.palette.text_muted),
        );
    });
    ui.separator();

    let editor = egui::TextEdit::multiline(&mut buffer.text)
        .desired_width(f32::INFINITY)
        .desired_rows(28)
        .font(egui::TextStyle::Monospace)
        .code_editor();
    ui.add_enabled(!buffer.read_only, editor);
}

fn load_document_editor_buffer(
    document: &ZenWorkspaceDocument,
) -> Result<DocumentEditorBuffer, String> {
    let source_path = resolve_document_source_path(document);
    let source_label = source_path
        .as_ref()
        .map(|path| path.display().to_string())
        .or(document.source_path.clone())
        .or(document.path.clone())
        .unwrap_or_else(|| "unbound document".to_string());

    let Some(source_path) = source_path else {
        return Ok(DocumentEditorBuffer {
            source_path: None,
            source_label,
            text: String::new(),
            saved_text: String::new(),
            status: "document has no writable source file".to_string(),
            read_only: true,
        });
    };

    let text = if source_path.exists() {
        fs::read_to_string(&source_path).map_err(|err| {
            format!(
                "Failed to read document source '{}': {err}",
                source_path.display()
            )
        })?
    } else {
        String::new()
    };
    let status = if source_path.exists() {
        format!("loaded {}", source_path.display())
    } else {
        format!("new file {}", source_path.display())
    };
    Ok(DocumentEditorBuffer {
        source_label,
        source_path: Some(source_path),
        saved_text: text.clone(),
        text,
        status,
        read_only: false,
    })
}

fn save_document_editor_buffer(buffer: &mut DocumentEditorBuffer) -> Result<String, String> {
    let Some(source_path) = &buffer.source_path else {
        return Err("document has no source path".to_string());
    };
    if let Some(parent) = source_path.parent() {
        fs::create_dir_all(parent).map_err(|err| {
            format!(
                "Failed to create document directory '{}': {err}",
                parent.display()
            )
        })?;
    }
    fs::write(source_path, &buffer.text).map_err(|err| {
        format!(
            "Failed to write document source '{}': {err}",
            source_path.display()
        )
    })?;
    buffer.saved_text = buffer.text.clone();
    Ok(format!("saved {}", source_path.display()))
}

fn render_inspector_schema(
    ui: &mut egui::Ui,
    schema: &ZenInspectorSchema,
    mut on_edit: Option<&mut dyn FnMut(&str, &ZenInspectorFieldValue)>,
) {
    ui.label(RichText::new(&schema.title).strong());
    for section in &schema.sections {
        ui.add_space(6.0);
        ui.group(|ui| {
            ui.label(RichText::new(&section.title).strong());
            for field in &section.fields {
                ui.horizontal_wrapped(|ui| {
                    ui.label(
                        RichText::new(&field.label)
                            .small()
                            .color(ui.style().visuals.weak_text_color()),
                    );
                    match &field.value {
                        ZenInspectorFieldValue::Text(value) => {
                            if field.editable {
                                let mut draft = value.clone();
                                if ui.text_edit_singleline(&mut draft).changed() {
                                    if let Some(edit_handler) = on_edit.as_deref_mut() {
                                        edit_handler(
                                            &field.key,
                                            &ZenInspectorFieldValue::Text(draft),
                                        );
                                    }
                                }
                            } else {
                                ui.monospace(value);
                            }
                        }
                        ZenInspectorFieldValue::Number(value) => {
                            ui.monospace(format!("{value:.3}"));
                        }
                        ZenInspectorFieldValue::Integer(value) => {
                            ui.monospace(value.to_string());
                        }
                        ZenInspectorFieldValue::Vec3(value) => {
                            ui.monospace(format!(
                                "{:.2}, {:.2}, {:.2}",
                                value[0], value[1], value[2]
                            ));
                        }
                        ZenInspectorFieldValue::Quaternion(value) => {
                            ui.monospace(format!(
                                "{:.2}, {:.2}, {:.2}, {:.2}",
                                value[0], value[1], value[2], value[3]
                            ));
                        }
                    }
                });
            }
        });
    }
}

fn selection_inspector_schema(details: &SelectedObjectDetails) -> ZenInspectorSchema {
    ZenInspectorSchema {
        title: "Selection Schema".to_string(),
        sections: vec![
            ZenInspectorSection {
                title: "Identity".to_string(),
                fields: vec![
                    ZenInspectorField {
                        key: "selection.handle".to_string(),
                        label: "Handle".to_string(),
                        value: ZenInspectorFieldValue::Integer(details.summary.handle.raw() as i64),
                        editable: false,
                    },
                    ZenInspectorField {
                        key: "selection.name".to_string(),
                        label: "Name".to_string(),
                        value: ZenInspectorFieldValue::Text(details.name.clone()),
                        editable: false,
                    },
                ],
            },
            ZenInspectorSection {
                title: "Runtime".to_string(),
                fields: vec![
                    ZenInspectorField {
                        key: "selection.vertex_count".to_string(),
                        label: "Vertices".to_string(),
                        value: ZenInspectorFieldValue::Integer(details.summary.vertex_count as i64),
                        editable: false,
                    },
                    ZenInspectorField {
                        key: "selection.face_count".to_string(),
                        label: "Faces".to_string(),
                        value: ZenInspectorFieldValue::Integer(details.summary.face_count as i64),
                        editable: false,
                    },
                    ZenInspectorField {
                        key: "selection.rotation".to_string(),
                        label: "Rotation".to_string(),
                        value: ZenInspectorFieldValue::Quaternion(details.summary.rotation),
                        editable: false,
                    },
                ],
            },
        ],
    }
}

fn runtime_inspector_schema(
    runtime: &ZenRuntimeSession,
    renderer: &RendererConfig,
    hud: ZenViewportHud,
    details: Option<&SelectedObjectDetails>,
) -> ZenInspectorSchema {
    let mut sections = vec![
        ZenInspectorSection {
            title: "Runtime".to_string(),
            fields: vec![
                ZenInspectorField {
                    key: "runtime.play_mode".to_string(),
                    label: "Play Mode".to_string(),
                    value: ZenInspectorFieldValue::Text(format!("{:?}", runtime.play_mode())),
                    editable: false,
                },
                ZenInspectorField {
                    key: "runtime.viewport_extent".to_string(),
                    label: "Viewport".to_string(),
                    value: ZenInspectorFieldValue::Vec3([
                        hud.viewport_extent[0] as f32,
                        hud.viewport_extent[1] as f32,
                        0.0,
                    ]),
                    editable: false,
                },
            ],
        },
        ZenInspectorSection {
            title: "Camera".to_string(),
            fields: vec![
                ZenInspectorField {
                    key: "camera.position".to_string(),
                    label: "Position".to_string(),
                    value: ZenInspectorFieldValue::Vec3(hud.camera_position),
                    editable: false,
                },
                ZenInspectorField {
                    key: "camera.forward".to_string(),
                    label: "Forward".to_string(),
                    value: ZenInspectorFieldValue::Vec3(hud.camera_forward),
                    editable: false,
                },
            ],
        },
        ZenInspectorSection {
            title: "Renderer".to_string(),
            fields: vec![
                ZenInspectorField {
                    key: "renderer.vertices".to_string(),
                    label: "Vertices".to_string(),
                    value: ZenInspectorFieldValue::Integer(hud.vertex_count as i64),
                    editable: false,
                },
                ZenInspectorField {
                    key: "renderer.indices".to_string(),
                    label: "Indices".to_string(),
                    value: ZenInspectorFieldValue::Integer(hud.index_count as i64),
                    editable: false,
                },
                ZenInspectorField {
                    key: "renderer.ambient".to_string(),
                    label: "Ambient".to_string(),
                    value: ZenInspectorFieldValue::Number(renderer.ambient_strength),
                    editable: false,
                },
                ZenInspectorField {
                    key: "renderer.fog".to_string(),
                    label: "Fog".to_string(),
                    value: ZenInspectorFieldValue::Number(renderer.fog_density),
                    editable: false,
                },
            ],
        },
    ];
    if let Some(details) = details {
        sections.push(ZenInspectorSection {
            title: "Active Selection".to_string(),
            fields: vec![
                ZenInspectorField {
                    key: "active.name".to_string(),
                    label: "Name".to_string(),
                    value: ZenInspectorFieldValue::Text(details.name.clone()),
                    editable: false,
                },
                ZenInspectorField {
                    key: "active.translation".to_string(),
                    label: "Position".to_string(),
                    value: ZenInspectorFieldValue::Vec3(details.summary.translation),
                    editable: false,
                },
            ],
        });
    }
    ZenInspectorSchema {
        title: "Runtime Schema".to_string(),
        sections,
    }
}

fn draw_timeline_panel(ui: &mut egui::Ui, theme: &ZenUiTheme, feature: &ZenUiFeature) {
    let title = &feature.title;
    render_surface_frame(
        ui,
        theme,
        title,
        Vec2::new(ui.available_width(), 144.0),
        |ui, rect| {
            let painter = ui.painter();
            painter.rect_filled(
                rect.shrink(4.0),
                corner_radius(theme.rounding.panel),
                theme.palette.timeline_track,
            );
            for tick in 0..12 {
                let x = rect.left() + 20.0 + (tick as f32 * 54.0);
                painter.line_segment(
                    [
                        egui::pos2(x, rect.top() + 18.0),
                        egui::pos2(x, rect.bottom() - 18.0),
                    ],
                    Stroke::new(1.0, theme.palette.timeline_tick),
                );
            }
            let clip = egui::Rect::from_min_size(
                egui::pos2(rect.left() + 58.0, rect.center().y - 14.0),
                Vec2::new(286.0, 28.0),
            );
            painter.rect_filled(
                clip,
                corner_radius(theme.rounding.overlay),
                theme.palette.timeline_clip,
            );
        },
    );
}

fn draw_viewport_panel(
    ui: &mut egui::Ui,
    theme: &ZenUiTheme,
    feature: &ZenUiFeature,
    scene: &mut ZenScene,
    hud: ZenViewportHud,
    kain_status: &str,
    pixels_per_point: f32,
    viewport_request: &mut Option<[u32; 2]>,
    viewport_rect_pixels: &mut Option<[f32; 4]>,
) {
    let title = &feature.title;
    let profile_label = feature
        .props
        .get("viewport_profile")
        .cloned()
        .unwrap_or_else(|| "universal".to_string());
    let mode_label = feature
        .props
        .get("viewport_mode")
        .cloned()
        .unwrap_or_else(|| "editor".to_string());
    let available = ui.available_rect_before_wrap();
    let rect = if available.width() < 40.0 || available.height() < 40.0 {
        ui.max_rect()
    } else {
        available
    };
    let response = ui.allocate_rect(rect, egui::Sense::click());
    let outline_color = if response.hovered() {
        theme.palette.viewport_outline_hover
    } else {
        theme.palette.viewport_outline
    };

    let viewport_rect = rect.shrink2(egui::vec2(6.0, 6.0));
    *viewport_request = Some([
        (viewport_rect.width() * pixels_per_point).round().max(1.0) as u32,
        (viewport_rect.height() * pixels_per_point).round().max(1.0) as u32,
    ]);
    *viewport_rect_pixels = Some([
        viewport_rect.left() * pixels_per_point,
        viewport_rect.top() * pixels_per_point,
        viewport_rect.width() * pixels_per_point,
        viewport_rect.height() * pixels_per_point,
    ]);

    if let Some(texture_id) = hud.viewport_texture_id {
        ui.put(
            viewport_rect,
            egui::Image::new((texture_id, viewport_rect.size()))
                .maintain_aspect_ratio(false)
                .sense(egui::Sense::click_and_drag()),
        );
    }
    let painter = ui.painter();
    painter.rect_stroke(
        rect.shrink(4.0),
        corner_radius(theme.rounding.viewport),
        Stroke::new(1.25, outline_color),
        egui::StrokeKind::Inside,
    );
    if hud.viewport_texture_id.is_none() {
        painter.rect_filled(
            viewport_rect,
            corner_radius(theme.rounding.viewport),
            theme.palette.panel_bg_alt,
        );
        painter.text(
            viewport_rect.center(),
            egui::Align2::CENTER_CENTER,
            "Viewport target booting...",
            egui::TextStyle::Button.resolve(ui.style()),
            theme.palette.text_muted,
        );
    }

    let title_badge = egui::Rect::from_min_size(
        rect.left_top() + egui::vec2(16.0, 16.0),
        Vec2::new((rect.width() * 0.34).clamp(220.0, 360.0), 48.0),
    );
    painter.rect_filled(
        title_badge,
        corner_radius(theme.rounding.overlay),
        theme.palette.overlay_bg,
    );
    painter.text(
        title_badge.left_top() + egui::vec2(14.0, 10.0),
        egui::Align2::LEFT_TOP,
        title,
        egui::TextStyle::Heading.resolve(ui.style()),
        theme.palette.text_primary,
    );
    painter.text(
        title_badge.left_top() + egui::vec2(14.0, 28.0),
        egui::Align2::LEFT_TOP,
        format!(
            "{} // {} // cam {:.1}, {:.1}, {:.1} // dir {:.2}, {:.2}, {:.2} // {}x{}",
            profile_label.to_ascii_uppercase(),
            mode_label,
            hud.camera_position[0],
            hud.camera_position[1],
            hud.camera_position[2],
            hud.camera_forward[0],
            hud.camera_forward[1],
            hud.camera_forward[2],
            hud.viewport_extent[0],
            hud.viewport_extent[1]
        ),
        egui::TextStyle::Small.resolve(ui.style()),
        theme.palette.text_secondary,
    );

    let footer = egui::Rect::from_min_size(
        egui::pos2(rect.left() + 16.0, rect.bottom() - 58.0),
        Vec2::new((rect.width() - 32.0).max(180.0), 40.0),
    );
    painter.rect_filled(
        footer,
        corner_radius(theme.rounding.overlay),
        theme.palette.overlay_bg,
    );
    let selection_label = scene
        .selected_details()
        .map(|details| format!("selected {}#{}", details.name, details.summary.handle.raw()))
        .unwrap_or_else(|| "selected none".to_string());
    painter.text(
        footer.left_top() + egui::vec2(14.0, 10.0),
        egui::Align2::LEFT_TOP,
        format!(
            "{} // scene {} verts // {} indices // {}",
            selection_label, hud.vertex_count, hud.index_count, kain_status
        ),
        egui::TextStyle::Small.resolve(ui.style()),
        theme.palette.warning,
    );
    painter.text(
        footer.left_top() + egui::vec2(14.0, 24.0),
        egui::Align2::LEFT_TOP,
        "WASD move | RMB freelook | left click selects | F focus | H frame",
        egui::TextStyle::Small.resolve(ui.style()),
        theme.palette.text_muted,
    );
}

fn draw_kain_status_panel(
    ui: &mut egui::Ui,
    theme: &ZenUiTheme,
    kain_status: &str,
    shell_status: &str,
    source_label: &str,
    host_api_status: &str,
    module_status: &str,
    contract_status: &str,
    registry_status: &str,
    debug_tree: &str,
) {
    ui.label(
        RichText::new(kain_status)
            .strong()
            .color(theme.palette.warning),
    );
    ui.monospace(shell_status);
    ui.monospace(source_label);
    ui.monospace(host_api_status);
    ui.monospace(module_status);
    ui.monospace(contract_status);
    ui.monospace(registry_status);
    if !debug_tree.trim().is_empty() {
        ui.separator();
        ui.label(
            RichText::new("Compiled Shell")
                .strong()
                .color(theme.palette.text_secondary),
        );
        ui.code(debug_tree);
    }
}

fn draw_missing_feature(ui: &mut egui::Ui, feature_key: &str) {
    ui.centered_and_justified(|ui| {
        ui.label(
            RichText::new(format!("missing feature {}", feature_key))
                .strong()
                .color(ui.style().visuals.error_fg_color),
        );
    });
}

fn render_surface_frame(
    ui: &mut egui::Ui,
    theme: &ZenUiTheme,
    title: &str,
    desired_size: Vec2,
    draw: impl FnOnce(&mut egui::Ui, egui::Rect),
) {
    ui.label(
        RichText::new(title)
            .strong()
            .color(theme.palette.text_primary),
    );
    let width = ui.available_width().max(96.0);
    let available_height = ui.available_height().max(80.0);
    let height = desired_size.y.min(available_height).max(80.0);
    let (rect, _) = ui.allocate_exact_size(Vec2::new(width, height), egui::Sense::hover());
    draw(ui, rect);
}

fn corner_radius(value: f32) -> egui::CornerRadius {
    egui::CornerRadius::same(value.round().clamp(0.0, 255.0) as u8)
}

struct UiActionResult {
    scene_changed: bool,
    reload_requested: bool,
}

struct UiRuntimeEventResult {
    reload_requested: bool,
    fabric_status: Option<String>,
}

fn execute_ui_action(
    host_api: &ZenHostApi,
    activity_status: &mut String,
    action_key: Option<&str>,
    scene: &mut ZenScene,
    runtime: &mut ZenRuntimeSession,
    camera: &mut FlyCamera,
    fabric_service: &mut ZenFabricService,
) -> UiActionResult {
    let Some((command, action_label)) = action_key
        .and_then(|key| host_api.action(key))
        .map(|profile| (profile.command.clone(), profile.label.clone()))
    else {
        *activity_status = match action_key {
            Some(key) => format!("unknown action {key}"),
            None => "button missing action".to_string(),
        };
        return UiActionResult {
            scene_changed: false,
            reload_requested: false,
        };
    };

    let transaction_id = ZenTransactionId::new(runtime.command_history().len() as u64 + 1);
    let envelope = ZenCommandEnvelope::new(
        transaction_id,
        ZenCommandSource::HostAction(action_key.unwrap_or("unknown").to_string()),
        command,
    );
    match runtime.dispatch(scene, envelope) {
        Ok(result) => {
            let runtime_events =
                apply_runtime_events(scene, camera, fabric_service, &result.events);
            *activity_status = runtime_events.fabric_status.unwrap_or_else(|| {
                format!(
                    "executed {} // mode {:?}",
                    action_label.to_ascii_lowercase(),
                    runtime.play_mode()
                )
            });
            UiActionResult {
                scene_changed: result.scene_dirty,
                reload_requested: runtime_events.reload_requested,
            }
        }
        Err(err) => {
            *activity_status = format!("action failed: {err}");
            UiActionResult {
                scene_changed: false,
                reload_requested: false,
            }
        }
    }
}

fn apply_runtime_events(
    scene: &ZenScene,
    camera: &mut FlyCamera,
    fabric_service: &mut ZenFabricService,
    events: &[ZenEvent],
) -> UiRuntimeEventResult {
    let mut reload_requested = false;
    for event in events {
        match event {
            ZenEvent::ShellReloadRequested { .. } => reload_requested = true,
            ZenEvent::CameraFocusRequested { .. } => {
                if let Some(target) = scene.selected_focus_target() {
                    camera.focus_on(glam::Vec3::from_array(target.center), target.radius);
                }
            }
            ZenEvent::CameraFrameRequested { .. } => {
                if let Some(target) = scene.scene_focus_target() {
                    camera.focus_on(glam::Vec3::from_array(target.center), target.radius);
                }
            }
            ZenEvent::SceneChanged { .. }
            | ZenEvent::FabricIntentRequested { .. }
            | ZenEvent::SelectionChanged { .. }
            | ZenEvent::PlayModeChanged { .. } => {}
        }
    }
    let fabric_messages = fabric_service.apply_runtime_events(events);
    UiRuntimeEventResult {
        reload_requested,
        fabric_status: if fabric_messages.is_empty() {
            None
        } else {
            Some(fabric_messages.join(" | "))
        },
    }
}

fn contract_status(host_api: &ZenHostApi, modules: &ZenKainModuleRegistry) -> String {
    ZenKainContract::from_host_and_modules(host_api, modules)
        .emit_toml()
        .map(|contract| format!("contract {} bytes", contract.len()))
        .unwrap_or_else(|err| format!("contract unavailable: {err}"))
}

fn registry_status() -> String {
    let workspace = workspace_registry();
    let integration = integration_registry();
    let zen_packages = packages_for_host("zen");
    let zen_adapter_packages = adapter_manifest_for_target("zen")
        .map(|adapter| adapter.package_count)
        .unwrap_or(0);
    format!(
        "registry {} packages // {} edges // {} artifacts // zen {} packages // adapters {} // integration {} host-api / {} integration / {} internal",
        workspace.package_count,
        workspace.local_dependency_edge_count,
        workspace.artifacts.len(),
        zen_packages.len(),
        zen_adapter_packages,
        integration.host_api_count,
        integration.integration_count,
        integration.internal_count
    )
}

fn build_asset_pipeline() -> Result<AssetPipeline, String> {
    let pipeline = AssetPipeline::new(asset_cache_dir())
        .map_err(|err| format!("failed to create asset cache: {err}"))?;
    pipeline.register_importer(Arc::new(GltfImporter::new()));
    pipeline.register_importer(Arc::new(ObjImporter::new()));
    Ok(pipeline)
}

fn asset_cache_dir() -> PathBuf {
    if let Ok(current_exe) = std::env::current_exe() {
        if let Some(parent) = current_exe.parent() {
            return parent.join("zen").join("asset-cache");
        }
    }
    std::env::current_dir()
        .unwrap_or_else(|_| PathBuf::from("."))
        .join("zen")
        .join("asset-cache")
}

fn runtime_document_from_asset(asset: &k_os_asset_pipeline::Asset) -> ZenWorkspaceDocument {
    let source_path = asset.source_path.to_string_lossy().to_string();
    let title = asset
        .source_path
        .file_name()
        .and_then(|name| name.to_str())
        .map(str::to_string)
        .unwrap_or_else(|| source_path.clone());
    let extension = asset
        .source_path
        .extension()
        .and_then(|extension| extension.to_str())
        .map(|extension| extension.to_ascii_lowercase())
        .unwrap_or_else(|| "asset".to_string());
    ZenWorkspaceDocument {
        key: runtime_document_key(&asset.source_path),
        title,
        kind: format!("Imported {}", extension.to_ascii_uppercase()),
        path: Some(source_path.clone()),
        source_path: Some(source_path),
        primary: false,
    }
}

fn runtime_document_key(path: &Path) -> String {
    let mut hasher = DefaultHasher::new();
    path.to_string_lossy().hash(&mut hasher);
    let hash = hasher.finish();
    let stem = path
        .file_stem()
        .and_then(|stem| stem.to_str())
        .map(slug_fragment)
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| "asset".to_string());
    format!("runtime.import.{stem}.{hash:x}")
}

fn slug_fragment(value: &str) -> String {
    let mut slug = String::new();
    let mut last_dash = false;
    for ch in value.chars() {
        if ch.is_ascii_alphanumeric() {
            slug.push(ch.to_ascii_lowercase());
            last_dash = false;
        } else if !last_dash {
            slug.push('-');
            last_dash = true;
        }
    }
    slug.trim_matches('-').to_string()
}

fn workspace_summary(workspace: &ZenWorkspaceManifest) -> String {
    format!(
        "{} // {} features // {} docs // {} presets // center {}",
        workspace.workspace.title,
        workspace.features.len(),
        workspace.documents.len(),
        workspace.presets.len(),
        workspace.layout.center_tabs.len()
    )
}

fn load_shell_source(
    config: &KainUiConfig,
    registry: &ZenKainModuleRegistry,
) -> Option<ZenResolvedShell> {
    registry.resolve_shell(Some(&config.active_shell)).ok()
}

fn collect_watch_paths(config: &KainUiConfig, shell: Option<&ZenResolvedShell>) -> Vec<PathBuf> {
    let mut paths = Vec::new();
    for configured in [
        config.host_api_path.as_str(),
        config.modules_manifest_path.as_str(),
        config.workspace_manifest_path.as_str(),
    ] {
        if let Some(path) = resolve_source_path(configured) {
            paths.push(path);
        }
    }
    if let Some(shell) = shell {
        if let Some(path) = resolve_source_path(&shell.source_label) {
            paths.push(path);
        }
    }
    paths.sort();
    paths.dedup();
    paths
}

fn read_modified_time(path: &PathBuf) -> Option<SystemTime> {
    fs::metadata(path)
        .ok()
        .and_then(|meta| meta.modified().ok())
}

fn resolve_workspace_dock_state(
    workspace: &ZenWorkspaceManifest,
    session: &ZenEditorSession,
    user_layouts: &[ZenUserWorkspaceLayout],
) -> DockState<ZenDockTab> {
    if let Some(layout) = session
        .user_layout
        .as_deref()
        .and_then(|key| user_layouts.iter().find(|layout| layout.key == key))
    {
        return layout.dock_state.clone();
    }
    session
        .workspace_preset
        .as_deref()
        .and_then(|key| workspace.preset(key))
        .map(|preset| preset.build_dock_state())
        .unwrap_or_else(|| workspace.build_dock_state())
}

fn normalize_layout_title(title: &str) -> Option<String> {
    let trimmed = title.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_string())
    }
}

fn slugify_layout_key(title: &str) -> String {
    let mut key = String::new();
    let mut last_dash = false;
    for ch in title.chars() {
        if ch.is_ascii_alphanumeric() {
            key.push(ch.to_ascii_lowercase());
            last_dash = false;
        } else if !last_dash {
            key.push('-');
            last_dash = true;
        }
    }
    let key = key.trim_matches('-').to_string();
    if key.is_empty() {
        "custom-layout".to_string()
    } else {
        format!("user.{key}")
    }
}

fn default_editor_session(workspace: &ZenWorkspaceManifest) -> ZenEditorSession {
    let mut session = ZenEditorSession::default();
    session.active_document = workspace
        .primary_document()
        .map(|document| document.key.clone());
    session.workspace_preset = workspace.presets.first().map(|preset| preset.key.clone());
    session.user_layout = None;
    if let Some(preset) = workspace.presets.first() {
        session.viewport_layout = preset.viewport_layout.clone();
    }
    session
}

fn sync_session_with_workspace(workspace: &ZenWorkspaceManifest, session: &mut ZenEditorSession) {
    if session
        .active_document
        .as_deref()
        .and_then(|key| workspace.document(key))
        .is_none()
    {
        session.active_document = workspace
            .primary_document()
            .map(|document| document.key.clone());
    }

    if session
        .workspace_preset
        .as_deref()
        .and_then(|key| workspace.preset(key))
        .is_none()
    {
        session.workspace_preset = workspace.presets.first().map(|preset| preset.key.clone());
    }

    if session.user_layout.is_none() {
        if let Some(preset) = session
            .workspace_preset
            .as_deref()
            .and_then(|key| workspace.preset(key))
        {
            session.viewport_layout = preset.viewport_layout.clone();
        }
    }

    session
        .open_features
        .retain(|feature_key| workspace.feature(feature_key).is_some());
    if session.open_features.is_empty() {
        session.open_features = workspace
            .features
            .iter()
            .filter(|feature| feature.default_open)
            .map(|feature| feature.key.clone())
            .collect();
    }
}

fn sync_session_with_user_layouts(
    session: &mut ZenEditorSession,
    user_layouts: &[ZenUserWorkspaceLayout],
) {
    if session
        .user_layout
        .as_deref()
        .and_then(|key| user_layouts.iter().find(|layout| layout.key == key))
        .is_none()
    {
        session.user_layout = None;
    }

    if let Some(layout) = session
        .user_layout
        .as_deref()
        .and_then(|key| user_layouts.iter().find(|layout| layout.key == key))
    {
        session.viewport_layout = layout.viewport_layout.clone();
    }
}

fn sync_inspector_draft(inspector: &mut InspectorDraft, details: Option<&SelectedObjectDetails>) {
    match details {
        Some(details) if inspector.selected_handle != Some(details.summary.handle.raw()) => {
            inspector.selected_handle = Some(details.summary.handle.raw());
            inspector.name = details.name.clone();
            inspector.translation = details.summary.translation;
            inspector.scale = details.summary.scale;
        }
        None => {
            *inspector = InspectorDraft::default();
        }
        Some(_) => {}
    }
}

fn draw_vec3_controls(ui: &mut egui::Ui, value: &mut [f32; 3]) -> Option<[f32; 3]> {
    let mut changed = false;
    ui.horizontal(|ui| {
        ui.label("X");
        changed |= ui
            .add(egui::DragValue::new(&mut value[0]).speed(0.05))
            .changed();
        ui.label("Y");
        changed |= ui
            .add(egui::DragValue::new(&mut value[1]).speed(0.05))
            .changed();
        ui.label("Z");
        changed |= ui
            .add(egui::DragValue::new(&mut value[2]).speed(0.05))
            .changed();
    });
    changed.then_some(*value)
}
