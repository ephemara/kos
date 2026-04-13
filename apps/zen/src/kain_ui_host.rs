use crate::config::{KainUiConfig, RendererConfig};
use crate::fabric::ZenFabricService;
use crate::theme::{resolve_source_path, ZenUiTheme};
use crate::FlyCamera;
use egui::{Color32, RichText, Stroke, Vec2, WidgetText};
use egui_dock::{DockArea, DockState, TabViewer};
use k_os_asset_pipeline::importers::{GltfImporter, ObjImporter};
use k_os_asset_pipeline::{Asset as PipelineAsset, AssetData as PipelineAssetData, AssetPipeline};
use k_os_brushes::{BrushKernel, BrushParams, KBrushAsset};
use k_os_io::{import_export::ImportExportEngine, Asset as IoAsset, AssetType as IoAssetType};
use k_os_material::{Material, MaterialLibrary, MaterialPreset, TextureSlot};
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
    ZenWorkspaceManifest, ZenWorkspaceMenu, ZenWorkspaceMenuBar, ZenWorkspaceMenuItem,
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

#[derive(Clone, Debug)]
enum WorkspaceChromeAction {
    HostAction(String),
    SelectDocument(String),
    ApplyPreset(String),
    ImportAsset,
    ResetWorkspace,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum PainterPanelMode {
    Import,
    Materials,
    Brushes,
    Layers,
}

impl PainterPanelMode {
    fn from_feature(feature: &ZenUiFeature) -> Self {
        match feature
            .props
            .get("painter_panel")
            .map(|value| value.as_str())
            .unwrap_or("import")
        {
            "materials" => Self::Materials,
            "brushes" => Self::Brushes,
            "layers" => Self::Layers,
            _ => Self::Import,
        }
    }
}

#[derive(Clone, Debug)]
struct PainterMeshSource {
    format_label: String,
    source_label: String,
    imported_objects: usize,
    imported_vertices: usize,
    imported_triangles: usize,
    import_note: String,
}

#[derive(Clone, Debug)]
struct PainterFbxIngest {
    source_label: String,
    asset_count: usize,
    metadata_count: usize,
    status_note: String,
}

#[derive(Clone, Debug)]
struct SvgStencilSummary {
    source_label: String,
    size: [f32; 2],
    node_count: usize,
}

#[derive(Clone, Debug)]
struct PainterWorkspaceState {
    material_library: MaterialLibrary,
    active_material_name: String,
    brushes: Vec<KBrushAsset>,
    active_brush_id: String,
    active_texture_slot: TextureSlot,
    mesh_source: Option<PainterMeshSource>,
    fbx_ingest: Option<PainterFbxIngest>,
    svg_stencil: Option<SvgStencilSummary>,
    session_note: String,
}

impl PainterWorkspaceState {
    fn new() -> Self {
        let mut material_library = MaterialLibrary::with_name("Zen Painter Rack");
        for material in [
            MaterialPreset::plastic_red(),
            MaterialPreset::gold(),
            MaterialPreset::glass(),
            MaterialPreset::wood_polished(),
        ] {
            material_library.add_material(material);
        }

        let brushes = default_painter_brushes();
        let active_material_name = material_library
            .iter()
            .next()
            .map(|material| material.name().to_string())
            .unwrap_or_else(|| "Material".to_string());
        let active_brush_id = brushes
            .first()
            .map(|brush| brush.id.clone())
            .unwrap_or_else(|| "paint_surface".to_string());

        Self {
            material_library,
            active_material_name,
            brushes,
            active_brush_id,
            active_texture_slot: TextureSlot::BaseColor,
            mesh_source: None,
            fbx_ingest: None,
            svg_stencil: None,
            session_note: "Painter workspace ready".to_string(),
        }
    }

    fn material_names(&self) -> Vec<String> {
        let mut names = self
            .material_library
            .iter()
            .map(|material| material.name().to_string())
            .collect::<Vec<_>>();
        names.sort();
        names
    }

    fn active_material(&self) -> Option<&Material> {
        self.material_library
            .get_material_by_name(&self.active_material_name)
    }

    fn active_material_mut(&mut self) -> Option<&mut Material> {
        let active_name = self.active_material_name.clone();
        let material_id = self
            .material_library
            .material_ids()
            .into_iter()
            .find(|id| {
                self.material_library
                    .get_material(id)
                    .map(|material| material.name() == active_name)
                    .unwrap_or(false)
            })?;
        self.material_library.get_material_mut(&material_id)
    }

    fn active_brush(&self) -> Option<&KBrushAsset> {
        self.brushes
            .iter()
            .find(|brush| brush.id == self.active_brush_id)
    }

    fn active_brush_mut(&mut self) -> Option<&mut KBrushAsset> {
        self.brushes
            .iter_mut()
            .find(|brush| brush.id == self.active_brush_id)
    }

    fn set_mesh_source(&mut self, source: PainterMeshSource) {
        self.mesh_source = Some(source);
        self.fbx_ingest = None;
    }

    fn set_fbx_ingest(&mut self, ingest: PainterFbxIngest) {
        self.fbx_ingest = Some(ingest);
    }

    fn set_svg_stencil(&mut self, summary: SvgStencilSummary) {
        self.svg_stencil = Some(summary);
    }

    fn assign_texture_to_active_material(&mut self, path: &Path) -> Result<String, String> {
        let slot = self.active_texture_slot;
        let material_name = self.active_material_name.clone();
        let Some(material) = self.active_material_mut() else {
            return Err("no active material".to_string());
        };
        material.set_texture(slot, path);
        let note = format!(
            "assigned {} to {} on {}",
            path.file_name()
                .and_then(|value| value.to_str())
                .unwrap_or("texture"),
            slot.display_name(),
            material_name
        );
        self.session_note = note.clone();
        Ok(note)
    }

    fn discover_textures_near_source(&mut self, source_path: &Path) -> usize {
        let Some(directory) = source_path.parent() else {
            return 0;
        };
        let source_stem = source_path
            .file_stem()
            .and_then(|value| value.to_str())
            .map(|value| value.to_ascii_lowercase())
            .unwrap_or_default();
        let mut assigned = 0usize;

        for slot in TextureSlot::all() {
            if let Some(texture_path) = discover_texture_for_slot(directory, &source_stem, *slot) {
                self.active_texture_slot = *slot;
                if self
                    .assign_texture_to_active_material(&texture_path)
                    .is_ok()
                {
                    assigned += 1;
                }
            }
        }

        if assigned > 0 {
            self.session_note = format!("discovered {assigned} nearby PBR textures");
        }
        assigned
    }
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
    painter: PainterWorkspaceState,
    inspector: InspectorDraft,
    viewport_request: Option<[u32; 2]>,
    viewport_rect_pixels: Option<[f32; 4]>,
    watched_files: Vec<WatchedFile>,
    last_hot_reload_poll: Instant,
    last_layout_persist: Instant,
    command_palette_open: bool,
    command_query: String,
    layout_name_draft: String,
    active_topbar_group: Option<String>,
    topbar_expanded: bool,
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
                "asset import ready // gltf glb obj fbx svg png jpg exr".to_string(),
            ),
            Err(err) => (None, format!("asset import unavailable: {err}")),
        };
        let active_topbar_group = resolve_default_topbar_group(&workspace);
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
            painter: PainterWorkspaceState::new(),
            inspector: InspectorDraft::default(),
            viewport_request: None,
            viewport_rect_pixels: None,
            watched_files: Vec::new(),
            last_hot_reload_poll: Instant::now(),
            last_layout_persist: Instant::now(),
            command_palette_open: false,
            command_query: String::new(),
            layout_name_draft: String::new(),
            active_topbar_group,
            topbar_expanded: false,
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
                if self
                    .active_topbar_group
                    .as_deref()
                    .map(|group_key| {
                        !self
                            .workspace
                            .topbar
                            .groups
                            .iter()
                            .any(|group| group.key == group_key)
                    })
                    .unwrap_or(true)
                {
                    self.active_topbar_group = resolve_default_topbar_group(&self.workspace);
                }
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
            .set_title("Import Asset Into Zen Painter")
            .add_filter("Mesh Assets", &["gltf", "glb", "obj", "fbx"])
            .add_filter("Texture Maps", &["png", "jpg", "jpeg", "tga", "bmp", "exr"])
            .add_filter("Vector Stencils", &["svg"])
            .pick_file()
        else {
            self.import_status = "asset import cancelled".to_string();
            self.activity_status = self.import_status.clone();
            return;
        };
        self.import_asset_path(path, scene);
    }

    fn import_asset_path(&mut self, path: PathBuf, scene: &mut ZenScene) {
        let extension = path
            .extension()
            .and_then(|value| value.to_str())
            .map(|value| value.to_ascii_lowercase())
            .unwrap_or_default();

        match extension.as_str() {
            "fbx" => {
                self.import_fbx_path(&path);
                return;
            }
            "svg" => {
                self.import_svg_path(&path);
                return;
            }
            "png" | "jpg" | "jpeg" | "tga" | "bmp" | "exr" => {
                self.import_texture_path(&path);
                return;
            }
            _ => {}
        }

        let Some(pipeline) = self.asset_pipeline.as_ref() else {
            self.import_status = "asset import unavailable".to_string();
            self.activity_status = self.import_status.clone();
            return;
        };

        match pipeline.import(&path) {
            Ok(asset) => match scene.import_asset(&asset) {
                Ok(report) => {
                    let document = runtime_document_from_import_path(&asset.source_path, &asset);
                    let buffer = import_document_buffer_from_asset(&asset, &report);
                    self.upsert_runtime_document_with_buffer(document.clone(), buffer);
                    self.session.active_document = Some(document.key.clone());
                    self.open_feature_tab("workspace.file_editor");
                    let discovered_textures = self.painter.discover_textures_near_source(&path);
                    self.painter.set_mesh_source(painter_mesh_source_from_asset(
                        &asset,
                        &report,
                        discovered_textures,
                    ));
                    self.import_status = format!(
                        "imported {} // {} objects",
                        report.label, report.imported_objects
                    );
                    self.activity_status = if discovered_textures > 0 {
                        format!(
                            "imported {} from {} // {} textures bound",
                            report.label,
                            path.display(),
                            discovered_textures
                        )
                    } else {
                        format!("imported {} from {}", report.label, path.display())
                    };
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

    fn import_texture_path(&mut self, path: &Path) {
        match self.painter.assign_texture_to_active_material(path) {
            Ok(note) => {
                let document = runtime_document_for_external_path(path, "Imported Texture");
                let buffer = external_text_document_buffer(
                    path,
                    "Texture Assignment",
                    &[
                        format!("active material: {}", self.painter.active_material_name),
                        format!(
                            "target channel: {}",
                            self.painter.active_texture_slot.display_name()
                        ),
                        note.clone(),
                    ],
                );
                self.upsert_runtime_document_with_buffer(document.clone(), buffer);
                self.session.active_document = Some(document.key.clone());
                self.open_feature_tab("workspace.file_editor");
                self.import_status = note.clone();
                self.activity_status = note;
            }
            Err(err) => {
                self.import_status = format!("texture assignment failed: {err}");
                self.activity_status = self.import_status.clone();
            }
        }
    }

    fn import_fbx_path(&mut self, path: &Path) {
        let engine = match ImportExportEngine::new() {
            Ok(engine) => engine,
            Err(err) => {
                self.import_status = format!("fbx ingest unavailable: {err}");
                self.activity_status = self.import_status.clone();
                return;
            }
        };

        match engine.import_file(path) {
            Ok(result) => {
                let pending_assets = result
                    .metadata
                    .iter()
                    .filter(|metadata| metadata.asset_type == IoAssetType::BinaryBlob)
                    .count();
                let note = format!(
                    "FBX ingest is metadata-first today: {} payloads staged, {} still pending full geometry parse",
                    result.assets.len(),
                    pending_assets
                );
                self.painter.set_fbx_ingest(PainterFbxIngest {
                    source_label: path.display().to_string(),
                    asset_count: result.assets.len(),
                    metadata_count: result.metadata.len(),
                    status_note: note.clone(),
                });
                let document = runtime_document_for_external_path(path, "Imported FBX");
                let buffer = import_document_buffer_from_fbx(path, &result, &note);
                self.upsert_runtime_document_with_buffer(document.clone(), buffer);
                self.session.active_document = Some(document.key.clone());
                self.open_feature_tab("workspace.file_editor");
                self.import_status = format!("ingested FBX {}", path.display());
                self.activity_status = note;
            }
            Err(err) => {
                self.import_status = format!("fbx ingest failed: {err}");
                self.activity_status = self.import_status.clone();
            }
        }
    }

    fn import_svg_path(&mut self, path: &Path) {
        match parse_svg_stencil_summary(path) {
            Ok(summary) => {
                let note = format!(
                    "loaded SVG stencil {} // {:.0} x {:.0} // {} nodes",
                    summary.source_label, summary.size[0], summary.size[1], summary.node_count
                );
                self.painter.set_svg_stencil(summary.clone());
                let document = runtime_document_for_external_path(path, "Imported SVG");
                let buffer = import_document_buffer_from_svg(&summary);
                self.upsert_runtime_document_with_buffer(document.clone(), buffer);
                self.session.active_document = Some(document.key.clone());
                self.open_feature_tab("workspace.file_editor");
                self.import_status = note.clone();
                self.activity_status = note;
            }
            Err(err) => {
                self.import_status = format!("svg ingest failed: {err}");
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

    fn upsert_runtime_document_with_buffer(
        &mut self,
        document: ZenWorkspaceDocument,
        buffer: DocumentEditorBuffer,
    ) {
        let document_key = document.key.clone();
        self.upsert_runtime_document(document);
        self.document_buffers.insert(document_key, buffer);
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

        let chrome_action = render_workspace_topbar(
            ctx,
            &self.theme,
            &self.workspace,
            &self.host_api,
            &self.workspace.workspace.title,
            self.session.active_document.as_deref(),
            &self.session.viewport_layout,
            runtime.play_mode(),
            scene.selected_details(),
            &mut self.active_topbar_group,
            &mut self.topbar_expanded,
        );
        let mut chrome_scene_changed = false;
        let mut chrome_reload_requested = false;
        if let Some(action) = chrome_action {
            match action {
                WorkspaceChromeAction::HostAction(action_key) => {
                    let result = execute_ui_action(
                        &self.host_api,
                        &mut self.activity_status,
                        Some(action_key.as_str()),
                        scene,
                        runtime,
                        camera,
                        fabric_service,
                    );
                    chrome_scene_changed = result.scene_changed;
                    chrome_reload_requested = result.reload_requested;
                }
                WorkspaceChromeAction::SelectDocument(document_key) => {
                    self.select_document(&document_key);
                }
                WorkspaceChromeAction::ApplyPreset(preset_key) => {
                    self.apply_workspace_preset(&preset_key);
                }
                WorkspaceChromeAction::ImportAsset => {
                    self.import_asset_from_dialog(scene);
                    chrome_scene_changed = true;
                }
                WorkspaceChromeAction::ResetWorkspace => {
                    self.reset_workspace_layout();
                }
            }
        }

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
        let mut palette_scene_changed = chrome_scene_changed;
        let mut palette_reload_requested = chrome_reload_requested;
        if let Some(selection) = palette_action {
            let result =
                self.apply_palette_selection(selection, scene, runtime, camera, fabric_service);
            palette_scene_changed |= result.scene_changed;
            palette_reload_requested |= result.reload_requested;
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
        let painter = &mut self.painter;
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
            painter,
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
            .exact_height(50.0)
            .frame(
                egui::Frame::default()
                    .fill(self.theme.palette.status_bg)
                    .inner_margin(egui::Margin::symmetric(8, 8)),
            )
            .show(ctx, |ui| {
                render_workspace_statusbar(
                    ui,
                    &self.theme,
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
    painter: &'a mut PainterWorkspaceState,
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
                self.fabric_service,
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
                                self.scene_changed |= draw_scene_selection_inspector(
                                    self.inspector,
                                    ui,
                                    self.theme,
                                    self.scene,
                                );
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
                                    self.fabric_service,
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
            ZenUiFeatureKind::Painter => {
                draw_feature_panel(ui, self.theme, feature, false, |ui| {
                    draw_painter_panel(
                        ui,
                        self.theme,
                        feature,
                        self.painter,
                        self.import_status,
                        self.scene.selected_details(),
                    );
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
    workspace: &ZenWorkspaceManifest,
    host_api: &ZenHostApi,
    workspace_title: &str,
    active_document: Option<&str>,
    viewport_layout: &str,
    play_mode: ZenPlayMode,
    selected: Option<SelectedObjectDetails>,
    active_topbar_group: &mut Option<String>,
    topbar_expanded: &mut bool,
) -> Option<WorkspaceChromeAction> {
    if active_topbar_group
        .as_deref()
        .map(|group_key| {
            !workspace
                .topbar
                .groups
                .iter()
                .any(|group| group.key == group_key)
        })
        .unwrap_or(true)
    {
        *active_topbar_group = resolve_default_topbar_group(workspace);
    }

    let mut chosen_action = None;
    let active_group = active_topbar_group.as_deref().and_then(|group_key| {
        workspace
            .topbar
            .groups
            .iter()
            .find(|group| group.key == group_key)
    });
    let expanded_height = if *topbar_expanded && active_group.is_some() {
        72.0
    } else {
        0.0
    };
    egui::TopBottomPanel::top("zen-workspace-topbar")
        .resizable(false)
        .exact_height(86.0 + expanded_height)
        .frame(
            egui::Frame::default()
                .fill(theme.palette.toolbar_bg)
                .inner_margin(egui::Margin::symmetric(14, 12)),
        )
        .show(ctx, |ui| {
            let panel_rect = ui.max_rect();
            let painter = ui.painter();
            let upper_band = egui::Rect::from_min_max(
                panel_rect.left_top(),
                egui::pos2(panel_rect.right(), panel_rect.top() + 46.0),
            );
            painter.rect_filled(
                upper_band,
                corner_radius(theme.rounding.overlay),
                tint_color(theme.palette.panel_header_bg, 232),
            );
            let accent_band = egui::Rect::from_min_max(
                panel_rect.left_top(),
                egui::pos2(
                    panel_rect.left() + panel_rect.width() * 0.34,
                    panel_rect.top() + 4.0,
                ),
            );
            painter.rect_filled(
                accent_band,
                corner_radius(theme.rounding.overlay),
                tint_color(theme.palette.panel_header_accent, 210),
            );
            painter.line_segment(
                [
                    egui::pos2(panel_rect.left(), panel_rect.bottom() - 1.0),
                    egui::pos2(panel_rect.right(), panel_rect.bottom() - 1.0),
                ],
                Stroke::new(1.0, theme.palette.border_subtle),
            );

            ui.vertical(|ui| {
                ui.spacing_mut().item_spacing = egui::vec2(10.0, 8.0);
                ui.horizontal_wrapped(|ui| {
                    ui.spacing_mut().item_spacing = egui::vec2(8.0, 8.0);
                    egui::Frame::default()
                        .fill(theme.palette.panel_header_bg)
                        .stroke(Stroke::new(1.0, theme.palette.border_subtle))
                        .corner_radius(corner_radius(theme.rounding.overlay))
                        .inner_margin(egui::Margin::symmetric(10, 8))
                        .show(ui, |ui| {
                            ui.horizontal_wrapped(|ui| {
                                ui.spacing_mut().item_spacing = egui::vec2(6.0, 0.0);
                                render_workspace_menubar(
                                    ui,
                                    theme,
                                    &workspace.menubar,
                                    &mut chosen_action,
                                );
                            });
                        });

                    egui::Frame::default()
                        .fill(theme.palette.panel_elevated_bg)
                        .stroke(Stroke::new(1.0, theme.palette.panel_header_accent))
                        .corner_radius(corner_radius(theme.rounding.panel))
                        .inner_margin(egui::Margin::symmetric(12, 9))
                        .show(ui, |ui| {
                            ui.vertical(|ui| {
                                ui.spacing_mut().item_spacing = egui::vec2(2.0, 2.0);
                                ui.label(
                                    RichText::new(workspace_title)
                                        .strong()
                                        .size(16.0)
                                        .color(theme.palette.text_primary),
                                );
                                ui.label(
                                    RichText::new(format!(
                                        "{} // {}",
                                        workspace.workspace.key,
                                        active_document.unwrap_or("no active doc")
                                    ))
                                    .small()
                                    .monospace()
                                    .color(theme.palette.text_muted),
                                );
                            });
                        });

                    egui::Frame::default()
                        .fill(theme.palette.panel_header_bg)
                        .stroke(Stroke::new(1.0, theme.palette.border_subtle))
                        .corner_radius(corner_radius(theme.rounding.overlay))
                        .inner_margin(egui::Margin::symmetric(8, 6))
                        .show(ui, |ui| {
                            ui.horizontal_wrapped(|ui| {
                                ui.spacing_mut().item_spacing = egui::vec2(6.0, 6.0);
                                for group in &workspace.topbar.groups {
                                    let is_active =
                                        active_topbar_group.as_deref() == Some(group.key.as_str());
                                    let button = egui::Button::new(
                                        RichText::new(&group.label).strong().size(13.0).color(
                                            if is_active {
                                                theme.palette.text_primary
                                            } else {
                                                theme.palette.text_secondary
                                            },
                                        ),
                                    )
                                    .min_size(Vec2::new(90.0, 30.0))
                                    .corner_radius(corner_radius(theme.rounding.overlay))
                                    .fill(if is_active {
                                        theme.palette.chip_active_bg
                                    } else {
                                        theme.palette.chip_bg
                                    })
                                    .stroke(Stroke::new(
                                        1.0,
                                        if is_active {
                                            theme.palette.selection_stroke
                                        } else {
                                            theme.palette.chip_outline
                                        },
                                    ));
                                    let response = ui.add(button);
                                    if response.clicked() {
                                        if is_active && *topbar_expanded {
                                            *topbar_expanded = false;
                                        } else {
                                            *active_topbar_group = Some(group.key.clone());
                                            *topbar_expanded = true;
                                        }
                                    }
                                    response.on_hover_text(&group.description);
                                }
                            });
                        });

                    ui.add_space(8.0);
                    ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                        render_status_chip(ui, theme, "cmd+p palette", theme.palette.success);
                        render_status_chip(
                            ui,
                            theme,
                            format!("layout {}", viewport_layout),
                            theme.palette.text_secondary,
                        );
                        render_status_chip(
                            ui,
                            theme,
                            format!("document {}", active_document.unwrap_or("none")),
                            theme.palette.text_muted,
                        );
                        render_status_chip(
                            ui,
                            theme,
                            format!("mode {}", format!("{play_mode:?}").to_ascii_lowercase()),
                            theme.palette.warning,
                        );
                        if let Some(selected) = selected {
                            render_status_chip(
                                ui,
                                theme,
                                format!("selected {}", selected.name),
                                theme.palette.accent,
                            );
                        }
                    });
                });

                if *topbar_expanded {
                    if let Some(group) = active_group {
                        egui::Frame::default()
                            .fill(theme.palette.panel_elevated_bg)
                            .stroke(Stroke::new(1.0, theme.palette.border_subtle))
                            .corner_radius(corner_radius(theme.rounding.overlay))
                            .inner_margin(egui::Margin::symmetric(14, 12))
                            .show(ui, |ui| {
                                ui.vertical(|ui| {
                                    ui.spacing_mut().item_spacing = egui::vec2(10.0, 10.0);
                                    ui.horizontal_wrapped(|ui| {
                                        ui.spacing_mut().item_spacing = egui::vec2(8.0, 8.0);
                                        ui.vertical(|ui| {
                                            ui.label(
                                                RichText::new(&group.label)
                                                    .strong()
                                                    .size(15.0)
                                                    .color(theme.palette.text_primary),
                                            );
                                            ui.label(
                                                RichText::new(&group.description)
                                                    .small()
                                                    .color(theme.palette.text_muted),
                                            );
                                        });
                                        ui.add_space(6.0);
                                        render_status_chip(
                                            ui,
                                            theme,
                                            format!("{} actions", group.actions.len()),
                                            theme.palette.accent,
                                        );
                                        render_status_chip(
                                            ui,
                                            theme,
                                            workspace.workspace.key.clone(),
                                            theme.palette.text_muted,
                                        );
                                    });
                                    ui.horizontal_wrapped(|ui| {
                                        ui.spacing_mut().item_spacing = egui::vec2(10.0, 8.0);
                                        for action_key in &group.actions {
                                            if let Some(action) = host_api.action(action_key) {
                                                let response =
                                                    draw_action_button(ui, theme, action);
                                                if response.clicked() {
                                                    chosen_action =
                                                        Some(WorkspaceChromeAction::HostAction(
                                                            action.key.clone(),
                                                        ));
                                                }
                                            } else {
                                                ui.label(
                                                    RichText::new(format!(
                                                        "missing {}",
                                                        action_key
                                                    ))
                                                    .small()
                                                    .monospace()
                                                    .color(theme.palette.danger),
                                                );
                                            }
                                        }
                                        if group.actions.is_empty() {
                                            ui.label(
                                                RichText::new(
                                                    "No actions bound to this group yet.",
                                                )
                                                .small()
                                                .color(theme.palette.text_muted),
                                            );
                                        }
                                    });
                                });
                            });
                    }
                }
            });
        });
    chosen_action
}

fn render_workspace_menubar(
    ui: &mut egui::Ui,
    theme: &ZenUiTheme,
    menubar: &ZenWorkspaceMenuBar,
    chosen_action: &mut Option<WorkspaceChromeAction>,
) {
    for menu in &menubar.menus {
        render_workspace_menu(ui, theme, menu, chosen_action);
    }
}

fn render_workspace_menu(
    ui: &mut egui::Ui,
    theme: &ZenUiTheme,
    menu: &ZenWorkspaceMenu,
    chosen_action: &mut Option<WorkspaceChromeAction>,
) {
    let label = RichText::new(&menu.label)
        .strong()
        .size(12.0)
        .color(theme.palette.text_primary);
    ui.menu_button(label, |ui| {
        ui.set_min_width(220.0);
        ui.spacing_mut().item_spacing = egui::vec2(6.0, 4.0);
        for item in &menu.items {
            match item {
                ZenWorkspaceMenuItem::Separator => {
                    ui.separator();
                }
                ZenWorkspaceMenuItem::HostAction { label, action, .. } => {
                    if ui.button(label).clicked() {
                        *chosen_action = Some(WorkspaceChromeAction::HostAction(action.clone()));
                        ui.close();
                    }
                }
                ZenWorkspaceMenuItem::Document {
                    label, document, ..
                } => {
                    if ui.button(label).clicked() {
                        *chosen_action =
                            Some(WorkspaceChromeAction::SelectDocument(document.clone()));
                        ui.close();
                    }
                }
                ZenWorkspaceMenuItem::Preset { label, preset, .. } => {
                    if ui.button(label).clicked() {
                        *chosen_action = Some(WorkspaceChromeAction::ApplyPreset(preset.clone()));
                        ui.close();
                    }
                }
                ZenWorkspaceMenuItem::ImportAsset { label, .. } => {
                    if ui.button(label).clicked() {
                        *chosen_action = Some(WorkspaceChromeAction::ImportAsset);
                        ui.close();
                    }
                }
                ZenWorkspaceMenuItem::ResetWorkspace { label, .. } => {
                    if ui.button(label).clicked() {
                        *chosen_action = Some(WorkspaceChromeAction::ResetWorkspace);
                        ui.close();
                    }
                }
            }
        }
    });
}

fn render_status_chip(
    ui: &mut egui::Ui,
    theme: &ZenUiTheme,
    label: impl Into<String>,
    color: Color32,
) {
    egui::Frame::default()
        .fill(theme.palette.chip_bg)
        .stroke(Stroke::new(
            1.0,
            if color == theme.palette.text_muted {
                theme.palette.chip_outline
            } else {
                tint_color(color, 210)
            },
        ))
        .corner_radius(corner_radius(theme.rounding.overlay))
        .inner_margin(egui::Margin::symmetric(10, 5))
        .show(ui, |ui| {
            ui.label(RichText::new(label.into()).small().color(color));
        });
}

fn render_workspace_statusbar(
    ui: &mut egui::Ui,
    theme: &ZenUiTheme,
    activity_status: &str,
    shell_status: &str,
    contract_status: &str,
    registry_status: &str,
    fabric_status: &str,
    kain_status: &str,
) {
    egui::Frame::default()
        .fill(theme.palette.panel_header_bg)
        .stroke(Stroke::new(1.0, theme.palette.border_subtle))
        .corner_radius(corner_radius(theme.rounding.overlay))
        .inner_margin(egui::Margin::symmetric(10, 7))
        .show(ui, |ui| {
            ui.horizontal_wrapped(|ui| {
                ui.spacing_mut().item_spacing = egui::vec2(6.0, 4.0);
                render_status_chip(ui, theme, activity_status, theme.palette.text_primary);
                render_status_chip(ui, theme, shell_status, theme.palette.text_secondary);
                render_status_chip(ui, theme, contract_status, theme.palette.accent);
                render_status_chip(ui, theme, registry_status, theme.palette.text_muted);
                render_status_chip(ui, theme, fabric_status, theme.palette.success);
                render_status_chip(ui, theme, kain_status, theme.palette.warning);
            });
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
            .fill(tint_color(theme.palette.window_bg, 36))
            .inner_margin(egui::Margin::same(theme.spacing.panel_margin as i8))
    } else {
        egui::Frame::default()
            .fill(theme.palette.panel_elevated_bg)
            .stroke(Stroke::new(1.0, theme.palette.border_subtle))
            .corner_radius(corner_radius(theme.rounding.panel))
            .inner_margin(egui::Margin::same(theme.spacing.panel_margin as i8))
    };

    frame.show(ui, |ui| {
        if !transparent {
            egui::Frame::default()
                .fill(theme.palette.panel_header_bg)
                .stroke(Stroke::new(1.0, theme.palette.chip_outline))
                .corner_radius(corner_radius(theme.rounding.overlay))
                .inner_margin(egui::Margin::symmetric(10, 8))
                .show(ui, |ui| {
                    ui.horizontal_wrapped(|ui| {
                        ui.spacing_mut().item_spacing = egui::vec2(8.0, 6.0);
                        ui.vertical(|ui| {
                            ui.spacing_mut().item_spacing = egui::vec2(2.0, 2.0);
                            ui.label(
                                RichText::new(&feature.title)
                                    .strong()
                                    .size(16.0)
                                    .color(theme.palette.text_primary),
                            );
                            ui.label(
                                RichText::new(feature_metadata_label(feature))
                                    .small()
                                    .monospace()
                                    .color(theme.palette.text_muted),
                            );
                        });
                        ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                            if !feature.actions.is_empty() {
                                render_status_chip(
                                    ui,
                                    theme,
                                    format!("{} actions", feature.actions.len()),
                                    theme.palette.accent,
                                );
                            }
                            if feature.closable {
                                render_status_chip(
                                    ui,
                                    theme,
                                    "dock tab",
                                    theme.palette.text_secondary,
                                );
                            }
                        });
                    });
                });
            ui.add_space(8.0);
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
    fabric_service: &mut ZenFabricService,
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
        egui::Button::new(
            RichText::new(&action.label)
                .strong()
                .size(12.5)
                .color(theme.palette.text_primary),
        )
        .min_size(Vec2::new(114.0, 30.0))
        .corner_radius(corner_radius(theme.rounding.overlay))
        .fill(theme.palette.chip_active_bg)
        .stroke(Stroke::new(1.0, theme.palette.border_strong)),
    )
    .on_hover_text(format!("{} ({})", action.description, action.key))
}

fn draw_toolbar_button(
    ui: &mut egui::Ui,
    theme: &ZenUiTheme,
    label: impl Into<WidgetText>,
) -> egui::Response {
    draw_toolbar_button_enabled(ui, theme, true, label)
}

fn draw_toolbar_button_enabled(
    ui: &mut egui::Ui,
    theme: &ZenUiTheme,
    enabled: bool,
    label: impl Into<WidgetText>,
) -> egui::Response {
    ui.add_enabled(
        enabled,
        egui::Button::new(label)
            .corner_radius(corner_radius(theme.rounding.overlay))
            .fill(theme.palette.chip_bg)
            .stroke(Stroke::new(1.0, theme.palette.chip_outline)),
    )
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
    theme: &ZenUiTheme,
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
        render_inspector_schema(ui, theme, &schema, None);
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
    fabric_service: &mut ZenFabricService,
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
    render_inspector_schema(ui, theme, &schema, None);
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

fn draw_painter_panel(
    ui: &mut egui::Ui,
    theme: &ZenUiTheme,
    feature: &ZenUiFeature,
    painter: &mut PainterWorkspaceState,
    import_status: &str,
    selected_details: Option<SelectedObjectDetails>,
) {
    let mode = PainterPanelMode::from_feature(feature);
    egui::ScrollArea::vertical()
        .id_salt(("painter", feature.key.as_str()))
        .show(ui, |ui| {
            ui.horizontal_wrapped(|ui| {
                ui.label(
                    RichText::new("Zen Painter")
                        .strong()
                        .color(theme.palette.text_primary),
                );
                ui.label(
                    RichText::new(format!("active material {}", painter.active_material_name))
                        .small()
                        .color(theme.palette.text_muted),
                );
                ui.label(
                    RichText::new(painter.session_note.as_str())
                        .small()
                        .color(theme.palette.warning),
                );
            });
            if !import_status.is_empty() {
                ui.label(
                    RichText::new(import_status)
                        .small()
                        .color(theme.palette.text_muted),
                );
            }
            ui.add_space(8.0);

            match mode {
                PainterPanelMode::Import => {
                    draw_painter_import_panel(ui, theme, painter, selected_details);
                }
                PainterPanelMode::Materials => {
                    draw_painter_materials_panel(ui, theme, feature.key.as_str(), painter);
                }
                PainterPanelMode::Brushes => {
                    draw_painter_brushes_panel(ui, theme, feature.key.as_str(), painter);
                }
                PainterPanelMode::Layers => {
                    draw_painter_layers_panel(ui, theme, painter);
                }
            }
        });
}

fn draw_painter_import_panel(
    ui: &mut egui::Ui,
    theme: &ZenUiTheme,
    painter: &PainterWorkspaceState,
    selected_details: Option<SelectedObjectDetails>,
) {
    ui.group(|ui| {
        ui.label(
            RichText::new("Import Surface")
                .strong()
                .color(theme.palette.text_secondary),
        );
        ui.label(
            RichText::new("Use File > Import Asset or the host import action. GLTF, GLB, and OBJ bind into the native scene. FBX is metadata-first until the parser grows real geometry decode.")
                .small()
                .color(theme.palette.text_muted),
        );
        ui.add_space(6.0);
        ui.horizontal_wrapped(|ui| {
            for label in ["GLTF", "GLB", "OBJ", "FBX", "SVG", "PNG", "EXR"] {
                ui.label(
                    RichText::new(label)
                        .small()
                        .color(theme.palette.warning),
                );
            }
        });
    });

    ui.add_space(8.0);
    if let Some(source) = painter.mesh_source.as_ref() {
        ui.group(|ui| {
            ui.label(
                RichText::new("Mesh Source")
                    .strong()
                    .color(theme.palette.text_secondary),
            );
            ui.label(
                RichText::new(format!(
                    "{} // {}",
                    source.format_label, source.source_label
                ))
                .small()
                .color(theme.palette.text_primary),
            );
            ui.horizontal_wrapped(|ui| {
                ui.label(format!("objects {}", source.imported_objects));
                ui.label(format!("verts {}", source.imported_vertices));
                ui.label(format!("tris {}", source.imported_triangles));
            });
            ui.label(
                RichText::new(source.import_note.as_str())
                    .small()
                    .color(theme.palette.text_muted),
            );
        });
    } else {
        ui.group(|ui| {
            ui.label(
                RichText::new("No imported mesh yet")
                    .strong()
                    .color(theme.palette.warning),
            );
            ui.label(
                RichText::new("Painter opens on the native viewport immediately, but geometry arrives after a GLTF, GLB, or OBJ import.")
                    .small()
                    .color(theme.palette.text_muted),
            );
        });
    }

    if let Some(details) = selected_details {
        ui.add_space(8.0);
        ui.group(|ui| {
            ui.label(
                RichText::new("Viewport Selection")
                    .strong()
                    .color(theme.palette.text_secondary),
            );
            ui.label(
                RichText::new(format!(
                    "{} #{}",
                    details.name,
                    details.summary.handle.raw()
                ))
                .small()
                .color(theme.palette.text_primary),
            );
            ui.horizontal_wrapped(|ui| {
                ui.label(format!("verts {}", details.summary.vertex_count));
                ui.label(format!("tris {}", details.summary.face_count));
                ui.label(format!(
                    "scale {:.2}, {:.2}, {:.2}",
                    details.summary.scale[0], details.summary.scale[1], details.summary.scale[2]
                ));
            });
        });
    }

    if let Some(ingest) = painter.fbx_ingest.as_ref() {
        ui.add_space(8.0);
        ui.group(|ui| {
            ui.label(
                RichText::new("FBX Ingest")
                    .strong()
                    .color(theme.palette.text_secondary),
            );
            ui.label(
                RichText::new(ingest.source_label.as_str())
                    .small()
                    .color(theme.palette.text_primary),
            );
            ui.horizontal_wrapped(|ui| {
                ui.label(format!("assets {}", ingest.asset_count));
                ui.label(format!("metadata {}", ingest.metadata_count));
            });
            ui.label(
                RichText::new(ingest.status_note.as_str())
                    .small()
                    .color(theme.palette.text_muted),
            );
        });
    }

    if let Some(stencil) = painter.svg_stencil.as_ref() {
        ui.add_space(8.0);
        ui.group(|ui| {
            ui.label(
                RichText::new("SVG Stencil")
                    .strong()
                    .color(theme.palette.text_secondary),
            );
            ui.label(
                RichText::new(stencil.source_label.as_str())
                    .small()
                    .color(theme.palette.text_primary),
            );
            ui.horizontal_wrapped(|ui| {
                ui.label(format!("size {:.0} x {:.0}", stencil.size[0], stencil.size[1]));
                ui.label(format!("nodes {}", stencil.node_count));
            });
            ui.label(
                RichText::new("Stencil metadata is parsed natively with usvg and kept ready for the paint lane.")
                    .small()
                    .color(theme.palette.text_muted),
            );
        });
    }
}

fn draw_painter_materials_panel(
    ui: &mut egui::Ui,
    theme: &ZenUiTheme,
    panel_key: &str,
    painter: &mut PainterWorkspaceState,
) {
    let material_names = painter.material_names();
    ui.horizontal_wrapped(|ui| {
        ui.label(
            RichText::new("Material Rack")
                .strong()
                .color(theme.palette.text_secondary),
        );
        egui::ComboBox::from_id_salt(("painter-material", panel_key))
            .selected_text(painter.active_material_name.as_str())
            .show_ui(ui, |ui| {
                for material_name in &material_names {
                    ui.selectable_value(
                        &mut painter.active_material_name,
                        material_name.clone(),
                        material_name.as_str(),
                    );
                }
            });
        egui::ComboBox::from_id_salt(("painter-slot", panel_key))
            .selected_text(painter.active_texture_slot.display_name())
            .show_ui(ui, |ui| {
                for slot in TextureSlot::all() {
                    ui.selectable_value(
                        &mut painter.active_texture_slot,
                        *slot,
                        slot.display_name(),
                    );
                }
            });
    });

    let active_slot = painter.active_texture_slot;
    if let Some(material) = painter.active_material_mut() {
        let base = material.base_color();
        let mut base_color = [base.x, base.y, base.z];
        let mut metallic = material.metallic();
        let mut roughness = material.roughness();
        let mut emissive_strength = material.emissive_strength();
        let mut opacity = material.opacity();
        let mut ior = material.ior();
        let swatch = vec3_to_color32(base_color);

        ui.add_space(8.0);
        ui.colored_label(swatch, "base color preview");
        ui.add(
            egui::Slider::new(&mut base_color[0], 0.0..=1.0)
                .text("Base R")
                .clamping(egui::SliderClamping::Always),
        );
        ui.add(
            egui::Slider::new(&mut base_color[1], 0.0..=1.0)
                .text("Base G")
                .clamping(egui::SliderClamping::Always),
        );
        ui.add(
            egui::Slider::new(&mut base_color[2], 0.0..=1.0)
                .text("Base B")
                .clamping(egui::SliderClamping::Always),
        );
        ui.add(
            egui::Slider::new(&mut metallic, 0.0..=1.0)
                .text("Metallic")
                .clamping(egui::SliderClamping::Always),
        );
        ui.add(
            egui::Slider::new(&mut roughness, 0.0..=1.0)
                .text("Roughness")
                .clamping(egui::SliderClamping::Always),
        );
        ui.add(
            egui::Slider::new(&mut emissive_strength, 0.0..=8.0)
                .text("Emissive")
                .clamping(egui::SliderClamping::Always),
        );
        ui.add(
            egui::Slider::new(&mut opacity, 0.0..=1.0)
                .text("Opacity")
                .clamping(egui::SliderClamping::Always),
        );
        ui.add(
            egui::Slider::new(&mut ior, 1.0..=2.5)
                .text("IOR")
                .clamping(egui::SliderClamping::Always),
        );

        material.set_base_color(glam::Vec3::new(base_color[0], base_color[1], base_color[2]));
        material.set_metallic(metallic);
        material.set_roughness(roughness);
        material.set_emissive_strength(emissive_strength);
        material.set_opacity(opacity);
        material.set_ior(ior);

        ui.add_space(8.0);
        ui.group(|ui| {
            ui.label(
                RichText::new("Texture Bindings")
                    .strong()
                    .color(theme.palette.text_secondary),
            );
            for slot in TextureSlot::all() {
                let label = material
                    .get_texture(*slot)
                    .map(|texture| texture.path().display().to_string())
                    .unwrap_or_else(|| "unassigned".to_string());
                let color = if *slot == active_slot {
                    theme.palette.warning
                } else {
                    theme.palette.text_muted
                };
                ui.horizontal_wrapped(|ui| {
                    ui.label(RichText::new(slot.display_name()).small().color(color));
                    ui.label(
                        RichText::new(label)
                            .small()
                            .monospace()
                            .color(theme.palette.text_primary),
                    );
                });
            }
        });
    } else {
        ui.label(
            RichText::new("No active material")
                .strong()
                .color(theme.palette.warning),
        );
    }
}

fn draw_painter_brushes_panel(
    ui: &mut egui::Ui,
    theme: &ZenUiTheme,
    panel_key: &str,
    painter: &mut PainterWorkspaceState,
) {
    ui.horizontal_wrapped(|ui| {
        ui.label(
            RichText::new("Brush Rack")
                .strong()
                .color(theme.palette.text_secondary),
        );
        egui::ComboBox::from_id_salt(("painter-brush", panel_key))
            .selected_text(
                painter
                    .active_brush()
                    .map(|brush| brush.name.as_str())
                    .unwrap_or("No Brush"),
            )
            .show_ui(ui, |ui| {
                for brush in &painter.brushes {
                    ui.selectable_value(
                        &mut painter.active_brush_id,
                        brush.id.clone(),
                        format!("{} // {}", brush.name, brush.category),
                    );
                }
            });
    });

    if let Some(brush) = painter.active_brush_mut() {
        ui.label(
            RichText::new(format!(
                "{} // kernel {} // entry {}",
                brush.category,
                brush.kernel.shader_name(),
                brush.kernel.default_entry_point()
            ))
            .small()
            .color(theme.palette.text_muted),
        );
        ui.add_space(8.0);

        ui.add(
            egui::Slider::new(&mut brush.params.radius, 0.01..=2.0)
                .text("Radius")
                .clamping(egui::SliderClamping::Always),
        );
        ui.add(
            egui::Slider::new(&mut brush.params.strength, 0.0..=2.0)
                .text("Strength")
                .clamping(egui::SliderClamping::Always),
        );
        ui.add(
            egui::Slider::new(&mut brush.params.hardness, 0.0..=1.0)
                .text("Hardness")
                .clamping(egui::SliderClamping::Always),
        );
        ui.add(
            egui::Slider::new(&mut brush.params.spacing, 0.01..=1.0)
                .text("Spacing")
                .clamping(egui::SliderClamping::Always),
        );
        ui.add(
            egui::Slider::new(&mut brush.params.lazy_radius, 0.0..=1.0)
                .text("Lazy Radius")
                .clamping(egui::SliderClamping::Always),
        );
        ui.add(
            egui::Slider::new(&mut brush.params.jitter_position, 0.0..=1.0)
                .text("Jitter Position")
                .clamping(egui::SliderClamping::Always),
        );
        ui.add(
            egui::Slider::new(&mut brush.params.jitter_strength, 0.0..=1.0)
                .text("Jitter Strength")
                .clamping(egui::SliderClamping::Always),
        );
        ui.checkbox(&mut brush.params.subtract, "Subtract");
        ui.checkbox(&mut brush.params.front_faces_only, "Front Faces Only");
        ui.checkbox(&mut brush.params.accumulate, "Accumulate");

        let extras = brush
            .params
            .extras
            .iter()
            .map(|(key, value)| format!("{key}={value:.2}"))
            .collect::<Vec<_>>()
            .join(", ");
        if !extras.is_empty() {
            ui.label(
                RichText::new(format!("extras {extras}"))
                    .small()
                    .color(theme.palette.text_muted),
            );
        }
        if let Some(stencil) = painter.svg_stencil.as_ref() {
            ui.label(
                RichText::new(format!("stencil ready {}", stencil.source_label))
                    .small()
                    .color(theme.palette.warning),
            );
        }
    } else {
        ui.label(
            RichText::new("No active brush")
                .strong()
                .color(theme.palette.warning),
        );
    }
}

fn draw_painter_layers_panel(
    ui: &mut egui::Ui,
    theme: &ZenUiTheme,
    painter: &PainterWorkspaceState,
) {
    let material_count = painter.material_library.material_count();
    let assigned_texture_count = painter
        .active_material()
        .map(|material| material.texture_slots().len())
        .unwrap_or(0);

    ui.group(|ui| {
        ui.label(
            RichText::new("Painter Stack")
                .strong()
                .color(theme.palette.text_secondary),
        );
        ui.label(
            RichText::new("This pass gives Zen a native painter workspace shell. The renderer-side live stroke bridge into the GPU PBR paint backend is still the next integration cut.")
                .small()
                .color(theme.palette.text_muted),
        );
    });
    ui.add_space(8.0);
    for row in [
        format!(
            "Geometry // {}",
            painter
                .mesh_source
                .as_ref()
                .map(|source| source.source_label.clone())
                .unwrap_or_else(|| "primitive preview or pending import".to_string())
        ),
        format!("Materials // {material_count} loaded"),
        format!("Texture Channels // {assigned_texture_count} assigned on active material"),
        format!(
            "Brush // {}",
            painter
                .active_brush()
                .map(|brush| brush.name.clone())
                .unwrap_or_else(|| "none".to_string())
        ),
        format!(
            "Stencil // {}",
            painter
                .svg_stencil
                .as_ref()
                .map(|stencil| stencil.source_label.clone())
                .unwrap_or_else(|| "none".to_string())
        ),
    ] {
        ui.group(|ui| {
            ui.label(RichText::new(row).small().color(theme.palette.text_primary));
        });
        ui.add_space(6.0);
    }
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
            .add_enabled(
                fabric_service.enabled(),
                egui::Button::new("Run Configured Manifest"),
            )
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
    let import_status_color = if import_status.contains("failed") {
        theme.palette.danger
    } else if import_status.is_empty() {
        theme.palette.text_muted
    } else {
        theme.palette.success
    };

    egui::Frame::default()
        .fill(theme.palette.panel_header_bg)
        .stroke(Stroke::new(1.0, theme.palette.border_subtle))
        .corner_radius(corner_radius(theme.rounding.overlay))
        .inner_margin(egui::Margin::symmetric(10, 8))
        .show(ui, |ui| {
            ui.vertical(|ui| {
                ui.horizontal_wrapped(|ui| {
                    ui.spacing_mut().item_spacing = egui::vec2(6.0, 6.0);
                    render_status_chip(
                        ui,
                        theme,
                        format!("{} docs", documents.len()),
                        theme.palette.text_secondary,
                    );
                    render_status_chip(
                        ui,
                        theme,
                        format!("{} presets", workspace.presets.len()),
                        theme.palette.accent,
                    );
                    render_status_chip(
                        ui,
                        theme,
                        format!("{} user layouts", user_layouts.len()),
                        theme.palette.warning,
                    );
                });
                ui.add_space(6.0);
                ui.horizontal_wrapped(|ui| {
                    if draw_toolbar_button(ui, theme, "Import Asset").clicked() {
                        action = Some(WorkspacePanelAction::ImportAsset);
                    }
                    if !import_status.is_empty() {
                        ui.label(
                            RichText::new(import_status)
                                .small()
                                .color(import_status_color),
                        );
                    }
                });
            });
        });
    ui.separator();
    for document in documents {
        let is_active = active_document
            .as_deref()
            .map(|selected| selected == document.key)
            .unwrap_or(false);
        egui::Frame::default()
            .fill(if is_active {
                theme.palette.chip_active_bg
            } else {
                theme.palette.panel_bg_alt
            })
            .stroke(Stroke::new(
                1.0,
                if is_active {
                    theme.palette.selection_stroke
                } else {
                    theme.palette.border_subtle
                },
            ))
            .corner_radius(corner_radius(theme.rounding.overlay))
            .inner_margin(egui::Margin::symmetric(10, 8))
            .show(ui, |ui| {
                ui.horizontal_wrapped(|ui| {
                    ui.spacing_mut().item_spacing = egui::vec2(6.0, 6.0);
                    if ui
                        .selectable_label(
                            is_active,
                            format!("{}  ({})", document.title, document.kind),
                        )
                        .clicked()
                    {
                        action = Some(WorkspacePanelAction::SelectDocument(document.key.clone()));
                    }
                    if document.primary {
                        render_status_chip(ui, theme, "primary", theme.palette.success);
                    }
                });
                if let Some(path) = document.source_path.as_deref().or(document.path.as_deref()) {
                    ui.label(
                        RichText::new(path)
                            .small()
                            .monospace()
                            .color(theme.palette.text_muted),
                    );
                }
            });
        ui.add_space(4.0);
    }
    if !workspace.presets.is_empty() {
        ui.separator();
        egui::Frame::default()
            .fill(theme.palette.panel_header_bg)
            .stroke(Stroke::new(1.0, theme.palette.border_subtle))
            .corner_radius(corner_radius(theme.rounding.overlay))
            .inner_margin(egui::Margin::symmetric(10, 8))
            .show(ui, |ui| {
                ui.label(
                    RichText::new("Default Layouts")
                        .strong()
                        .color(theme.palette.text_secondary),
                );
                ui.add_space(6.0);
                ui.horizontal_wrapped(|ui| {
                    ui.spacing_mut().item_spacing = egui::vec2(8.0, 8.0);
                    for preset in &workspace.presets {
                        let selected = active_preset
                            .as_deref()
                            .map(|active| active == preset.key)
                            .unwrap_or(false);
                        let response = ui.add(
                            egui::Button::new(
                                RichText::new(format!(
                                    "{}  ({})",
                                    preset.title, preset.viewport_layout
                                ))
                                .color(theme.palette.text_primary),
                            )
                            .corner_radius(corner_radius(theme.rounding.overlay))
                            .fill(if selected {
                                theme.palette.chip_active_bg
                            } else {
                                theme.palette.chip_bg
                            })
                            .stroke(Stroke::new(
                                1.0,
                                if selected {
                                    theme.palette.selection_stroke
                                } else {
                                    theme.palette.chip_outline
                                },
                            )),
                        );
                        if response.clicked() {
                            action = Some(WorkspacePanelAction::ApplyPreset(preset.key.clone()));
                        }
                    }
                });
            });
    }

    ui.separator();
    egui::Frame::default()
        .fill(theme.palette.panel_header_bg)
        .stroke(Stroke::new(1.0, theme.palette.border_subtle))
        .corner_radius(corner_radius(theme.rounding.overlay))
        .inner_margin(egui::Margin::symmetric(10, 8))
        .show(ui, |ui| {
            ui.label(
                RichText::new("User Layouts")
                    .strong()
                    .color(theme.palette.text_secondary),
            );
            ui.add_space(6.0);
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
            ui.add_space(6.0);
            ui.horizontal_wrapped(|ui| {
                if draw_toolbar_button(ui, theme, "Save Current").clicked() {
                    action = Some(WorkspacePanelAction::SaveCurrentLayout(
                        layout_name_draft.clone(),
                    ));
                }
                if draw_toolbar_button(ui, theme, "Reset Workspace").clicked() {
                    action = Some(WorkspacePanelAction::ResetWorkspace);
                }
                if let Some(active) = active_user_layout.as_deref() {
                    render_status_chip(
                        ui,
                        theme,
                        format!("active user {}", active),
                        theme.palette.warning,
                    );
                } else if let Some(active) = active_preset.as_deref() {
                    render_status_chip(
                        ui,
                        theme,
                        format!("active preset {}", active),
                        theme.palette.text_muted,
                    );
                }
            });
        });
    ui.add_space(6.0);
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
            egui::Frame::default()
                .fill(if selected {
                    theme.palette.chip_active_bg
                } else {
                    theme.palette.panel_bg_alt
                })
                .stroke(Stroke::new(
                    1.0,
                    if selected {
                        theme.palette.selection_stroke
                    } else {
                        theme.palette.border_subtle
                    },
                ))
                .corner_radius(corner_radius(theme.rounding.overlay))
                .inner_margin(egui::Margin::symmetric(10, 8))
                .show(ui, |ui| {
                    ui.horizontal_wrapped(|ui| {
                        if ui
                            .selectable_label(
                                selected,
                                format!("{}  ({})", layout.title, layout.viewport_layout),
                            )
                            .clicked()
                        {
                            action =
                                Some(WorkspacePanelAction::ApplyUserLayout(layout.key.clone()));
                        }
                        if draw_toolbar_button(ui, theme, "Load").clicked() {
                            action =
                                Some(WorkspacePanelAction::ApplyUserLayout(layout.key.clone()));
                        }
                        if draw_toolbar_button(ui, theme, "Delete").clicked() {
                            action =
                                Some(WorkspacePanelAction::DeleteUserLayout(layout.key.clone()));
                        }
                    });
                    ui.label(
                        RichText::new(layout.key.as_str())
                            .small()
                            .monospace()
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
        egui::Frame::default()
            .fill(theme.palette.panel_header_bg)
            .stroke(Stroke::new(1.0, theme.palette.border_subtle))
            .corner_radius(corner_radius(theme.rounding.overlay))
            .inner_margin(egui::Margin::symmetric(10, 8))
            .show(ui, |ui| {
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
            });
        return;
    };

    let Some(document) = documents
        .iter()
        .find(|document| document.key == document_key)
    else {
        egui::Frame::default()
            .fill(theme.palette.panel_header_bg)
            .stroke(Stroke::new(1.0, theme.palette.danger))
            .corner_radius(corner_radius(theme.rounding.overlay))
            .inner_margin(egui::Margin::symmetric(10, 8))
            .show(ui, |ui| {
                ui.label(
                    RichText::new("Missing document")
                        .strong()
                        .color(theme.palette.danger),
                );
                ui.label(
                    RichText::new(
                        "The active document no longer exists in the workspace manifest.",
                    )
                    .small()
                    .color(theme.palette.text_muted),
                );
            });
        return;
    };

    let buffer = document_buffers
        .entry(document.key.clone())
        .or_insert_with(|| load_document_editor_buffer(document).unwrap_or_default());
    let dirty = buffer.text != buffer.saved_text;
    let buffer_status_color = if buffer.status.contains("failed") {
        theme.palette.danger
    } else if dirty {
        theme.palette.warning
    } else {
        theme.palette.success
    };

    egui::Frame::default()
        .fill(theme.palette.panel_header_bg)
        .stroke(Stroke::new(1.0, theme.palette.border_subtle))
        .corner_radius(corner_radius(theme.rounding.overlay))
        .inner_margin(egui::Margin::symmetric(10, 8))
        .show(ui, |ui| {
            ui.vertical(|ui| {
                ui.horizontal_wrapped(|ui| {
                    ui.spacing_mut().item_spacing = egui::vec2(6.0, 6.0);
                    ui.label(
                        RichText::new(&document.title)
                            .strong()
                            .size(16.0)
                            .color(theme.palette.text_primary),
                    );
                    render_status_chip(
                        ui,
                        theme,
                        format!("kind {}", document.kind),
                        theme.palette.text_secondary,
                    );
                    render_status_chip(
                        ui,
                        theme,
                        if dirty { "modified" } else { "saved" },
                        if dirty {
                            theme.palette.warning
                        } else {
                            theme.palette.success
                        },
                    );
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
                    if draw_toolbar_button_enabled(ui, theme, save_enabled, "Save").clicked() {
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
                    if draw_toolbar_button(ui, theme, "Reload From Disk").clicked() {
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
                            .color(buffer_status_color),
                    );
                });
            });
        });
    ui.separator();

    let editor = egui::TextEdit::multiline(&mut buffer.text)
        .desired_width(f32::INFINITY)
        .desired_rows(28)
        .font(egui::TextStyle::Monospace)
        .code_editor();
    egui::Frame::default()
        .fill(theme.palette.panel_bg)
        .stroke(Stroke::new(1.0, theme.palette.border_subtle))
        .corner_radius(corner_radius(theme.rounding.overlay))
        .inner_margin(egui::Margin::same(8))
        .show(ui, |ui| {
            ui.add_enabled(!buffer.read_only, editor);
        });
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
    theme: &ZenUiTheme,
    schema: &ZenInspectorSchema,
    mut on_edit: Option<&mut dyn FnMut(&str, &ZenInspectorFieldValue)>,
) {
    egui::Frame::default()
        .fill(theme.palette.panel_header_bg)
        .stroke(Stroke::new(1.0, theme.palette.border_subtle))
        .corner_radius(corner_radius(theme.rounding.overlay))
        .inner_margin(egui::Margin::symmetric(10, 8))
        .show(ui, |ui| {
            ui.label(
                RichText::new(&schema.title)
                    .strong()
                    .color(theme.palette.text_primary),
            );
        });
    for section in &schema.sections {
        ui.add_space(8.0);
        egui::Frame::default()
            .fill(theme.palette.panel_bg_alt)
            .stroke(Stroke::new(1.0, theme.palette.border_subtle))
            .corner_radius(corner_radius(theme.rounding.overlay))
            .inner_margin(egui::Margin::symmetric(10, 8))
            .show(ui, |ui| {
                ui.label(
                    RichText::new(&section.title)
                        .strong()
                        .color(theme.palette.text_secondary),
                );
                ui.add_space(4.0);
                for field in &section.fields {
                    ui.horizontal_wrapped(|ui| {
                        ui.label(
                            RichText::new(&field.label)
                                .small()
                                .color(theme.palette.text_muted),
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

    ui.painter().rect_filled(
        viewport_rect,
        corner_radius(theme.rounding.viewport),
        theme.palette.panel_bg,
    );
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
    painter.rect_filled(
        egui::Rect::from_min_max(
            viewport_rect.left_top(),
            egui::pos2(viewport_rect.right(), viewport_rect.top() + 3.0),
        ),
        corner_radius(theme.rounding.overlay),
        tint_color(theme.palette.panel_header_accent, 200),
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
        Vec2::new((rect.width() * 0.32).clamp(248.0, 372.0), 68.0),
    );
    paint_overlay_badge(
        painter,
        ui.style(),
        theme,
        title_badge,
        &profile_label.to_ascii_uppercase(),
        title,
        &format!(
            "{} // {}x{} // cam {:.1}, {:.1}, {:.1}",
            mode_label,
            hud.viewport_extent[0],
            hud.viewport_extent[1],
            hud.camera_position[0],
            hud.camera_position[1],
            hud.camera_position[2],
        ),
        theme.palette.panel_header_accent,
    );

    let mode_badge = egui::Rect::from_min_size(
        egui::pos2(rect.right() - 220.0, rect.top() + 16.0),
        Vec2::new(204.0, 52.0),
    );
    paint_overlay_badge(
        painter,
        ui.style(),
        theme,
        mode_badge,
        "VIEW MODE",
        &mode_label.to_ascii_uppercase(),
        &format!(
            "dir {:.2}, {:.2}, {:.2}",
            hud.camera_forward[0], hud.camera_forward[1], hud.camera_forward[2]
        ),
        theme.palette.text_secondary,
    );

    let selection_badge = egui::Rect::from_min_size(
        egui::pos2(rect.left() + 16.0, rect.bottom() - 70.0),
        Vec2::new((rect.width() * 0.4).clamp(280.0, 440.0), 54.0),
    );
    let selection_label = scene
        .selected_details()
        .map(|details| format!("selected {}#{}", details.name, details.summary.handle.raw()))
        .unwrap_or_else(|| "selected none".to_string());
    paint_overlay_badge(
        painter,
        ui.style(),
        theme,
        selection_badge,
        "SELECTION",
        &selection_label,
        &format!(
            "{} verts // {} indices // {}",
            hud.vertex_count, hud.index_count, kain_status
        ),
        theme.palette.warning,
    );

    let shortcut_badge = egui::Rect::from_min_size(
        egui::pos2(rect.right() - 280.0, rect.bottom() - 70.0),
        Vec2::new(264.0, 54.0),
    );
    paint_overlay_badge(
        painter,
        ui.style(),
        theme,
        shortcut_badge,
        "CONTROLS",
        "WASD move // RMB freelook",
        "click select // F focus // H frame",
        theme.palette.success,
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
    egui::Frame::default()
        .fill(theme.palette.panel_header_bg)
        .stroke(Stroke::new(1.0, theme.palette.border_subtle))
        .corner_radius(corner_radius(theme.rounding.overlay))
        .inner_margin(egui::Margin::symmetric(10, 8))
        .show(ui, |ui| {
            ui.vertical(|ui| {
                ui.horizontal_wrapped(|ui| {
                    render_status_chip(ui, theme, kain_status, theme.palette.warning);
                    render_status_chip(ui, theme, shell_status, theme.palette.text_secondary);
                    render_status_chip(ui, theme, contract_status, theme.palette.accent);
                });
                ui.add_space(6.0);
                for line in [
                    source_label,
                    host_api_status,
                    module_status,
                    registry_status,
                ] {
                    ui.label(
                        RichText::new(line)
                            .small()
                            .monospace()
                            .color(theme.palette.text_muted),
                    );
                }
            });
        });
    if !debug_tree.trim().is_empty() {
        ui.separator();
        egui::Frame::default()
            .fill(theme.palette.panel_bg_alt)
            .stroke(Stroke::new(1.0, theme.palette.border_subtle))
            .corner_radius(corner_radius(theme.rounding.overlay))
            .inner_margin(egui::Margin::same(8))
            .show(ui, |ui| {
                ui.label(
                    RichText::new("Compiled Shell")
                        .strong()
                        .color(theme.palette.text_secondary),
                );
                ui.code(debug_tree);
            });
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

fn feature_metadata_label(feature: &ZenUiFeature) -> String {
    feature
        .binding
        .as_deref()
        .map(|binding| format!("{} // {}", feature_kind_label(&feature.kind), binding))
        .unwrap_or_else(|| feature_kind_label(&feature.kind).to_string())
}

fn feature_kind_label(kind: &ZenUiFeatureKind) -> &'static str {
    match kind {
        ZenUiFeatureKind::ActionStrip => "action strip",
        ZenUiFeatureKind::Viewport => "viewport",
        ZenUiFeatureKind::SceneTree => "scene tree",
        ZenUiFeatureKind::SelectionInspector => "selection inspector",
        ZenUiFeatureKind::RuntimeInspector => "runtime inspector",
        ZenUiFeatureKind::Timeline => "timeline",
        ZenUiFeatureKind::Painter => "painter",
        ZenUiFeatureKind::HostApi => "host api",
        ZenUiFeatureKind::Registry => "registry",
        ZenUiFeatureKind::KainStatus => "kain status",
        ZenUiFeatureKind::Fabric => "fabric",
        ZenUiFeatureKind::DocumentContext => "document context",
        ZenUiFeatureKind::FileEditor => "file editor",
    }
}

fn paint_overlay_badge(
    painter: &egui::Painter,
    style: &egui::Style,
    theme: &ZenUiTheme,
    rect: egui::Rect,
    eyebrow: &str,
    title: &str,
    detail: &str,
    accent: Color32,
) {
    painter.rect_filled(
        rect,
        corner_radius(theme.rounding.overlay),
        theme.palette.overlay_bg,
    );
    painter.rect_stroke(
        rect,
        corner_radius(theme.rounding.overlay),
        Stroke::new(1.0, tint_color(accent, 196)),
        egui::StrokeKind::Inside,
    );
    painter.rect_filled(
        egui::Rect::from_min_max(rect.left_top(), egui::pos2(rect.right(), rect.top() + 3.0)),
        corner_radius(theme.rounding.overlay),
        tint_color(accent, 220),
    );
    painter.text(
        rect.left_top() + egui::vec2(12.0, 7.0),
        egui::Align2::LEFT_TOP,
        eyebrow,
        egui::TextStyle::Small.resolve(style),
        theme.palette.text_muted,
    );
    painter.text(
        rect.left_top() + egui::vec2(12.0, 23.0),
        egui::Align2::LEFT_TOP,
        title,
        egui::TextStyle::Button.resolve(style),
        theme.palette.text_primary,
    );
    painter.text(
        rect.left_top() + egui::vec2(12.0, 40.0),
        egui::Align2::LEFT_TOP,
        detail,
        egui::TextStyle::Small.resolve(style),
        theme.palette.text_secondary,
    );
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

fn tint_color(color: Color32, alpha: u8) -> Color32 {
    Color32::from_rgba_unmultiplied(color.r(), color.g(), color.b(), alpha)
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

fn resolve_default_topbar_group(workspace: &ZenWorkspaceManifest) -> Option<String> {
    workspace.topbar.default_group.clone().or_else(|| {
        workspace
            .topbar
            .groups
            .first()
            .map(|group| group.key.clone())
    })
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

fn runtime_document_from_import_path(
    path: &Path,
    asset: &k_os_asset_pipeline::Asset,
) -> ZenWorkspaceDocument {
    let mut document = runtime_document_from_asset(asset);
    let source_path = path.to_string_lossy().to_string();
    document.key = runtime_document_key(path);
    document.path = Some(source_path.clone());
    document.source_path = Some(source_path);
    document
}

fn runtime_document_for_external_path(path: &Path, kind: &str) -> ZenWorkspaceDocument {
    let source_path = path.to_string_lossy().to_string();
    let title = path
        .file_name()
        .and_then(|name| name.to_str())
        .map(str::to_string)
        .unwrap_or_else(|| source_path.clone());
    ZenWorkspaceDocument {
        key: runtime_document_key(path),
        title,
        kind: kind.to_string(),
        path: Some(source_path.clone()),
        source_path: Some(source_path),
        primary: false,
    }
}

fn import_document_buffer_from_asset(
    asset: &PipelineAsset,
    report: &zen_scene::SceneImportReport,
) -> DocumentEditorBuffer {
    let source_label = asset.source_path.display().to_string();
    let mut lines = vec![
        "Zen Painter Import Summary".to_string(),
        format!("source: {source_label}"),
        format!("asset type: {:?}", asset.asset_type),
        format!("scene label: {}", report.label),
        format!("imported objects: {}", report.imported_objects),
    ];

    match &asset.data {
        PipelineAssetData::Mesh(mesh) => {
            lines.push(format!("vertices: {}", mesh.positions.len() / 3));
            lines.push(format!(
                "triangles: {}",
                mesh.indices
                    .as_ref()
                    .map(|indices| indices.len() / 3)
                    .unwrap_or(0)
            ));
            lines.push(format!(
                "uvs: {}",
                mesh.uvs.as_ref().map(|uvs| uvs.len() / 2).unwrap_or(0)
            ));
            lines.push(format!(
                "normals: {}",
                mesh.normals
                    .as_ref()
                    .map(|normals| normals.len() / 3)
                    .unwrap_or(0)
            ));
        }
        PipelineAssetData::Scene(scene) => {
            let vertex_count = scene
                .meshes
                .iter()
                .map(|mesh| mesh.positions.len() / 3)
                .sum::<usize>();
            let triangle_count = scene
                .meshes
                .iter()
                .map(|mesh| {
                    mesh.indices
                        .as_ref()
                        .map(|indices| indices.len() / 3)
                        .unwrap_or(0)
                })
                .sum::<usize>();
            lines.push(format!("nodes: {}", scene.nodes.len()));
            lines.push(format!("meshes: {}", scene.meshes.len()));
            lines.push(format!("materials: {}", scene.materials.len()));
            lines.push(format!("vertices: {vertex_count}"));
            lines.push(format!("triangles: {triangle_count}"));
        }
        PipelineAssetData::Texture(texture) => {
            lines.push(format!(
                "resolution: {} x {}",
                texture.width, texture.height
            ));
            lines.push(format!("mips: {}", texture.mip_levels));
        }
        PipelineAssetData::Material(material) => {
            lines.push(format!("material: {}", material.name));
            lines.push(format!("texture bindings: {}", material.textures.len()));
        }
        PipelineAssetData::Animation(animation) => {
            lines.push(format!("animation: {}", animation.name));
            lines.push(format!("channels: {}", animation.channels.len()));
            lines.push(format!("duration: {:.2}s", animation.duration));
        }
        PipelineAssetData::Raw(bytes) => {
            lines.push(format!("raw bytes: {}", bytes.len()));
        }
    }

    if !asset.metadata.is_empty() {
        lines.push(String::new());
        lines.push("metadata:".to_string());
        let mut metadata = asset.metadata.iter().collect::<Vec<_>>();
        metadata.sort_by(|left, right| left.0.cmp(right.0));
        for (key, value) in metadata {
            lines.push(format!("- {key}: {value}"));
        }
    }

    read_only_document_buffer(
        source_label,
        lines.join("\n"),
        "generated import summary".to_string(),
    )
}

fn external_text_document_buffer(
    path: &Path,
    title: &str,
    lines: &[String],
) -> DocumentEditorBuffer {
    let mut text = format!("{title}\nsource: {}\n", path.display());
    if !lines.is_empty() {
        text.push('\n');
        text.push_str(&lines.join("\n"));
    }
    read_only_document_buffer(
        path.display().to_string(),
        text,
        "generated external asset summary".to_string(),
    )
}

fn import_document_buffer_from_fbx(
    path: &Path,
    result: &k_os_io::import_export::ImportResult,
    note: &str,
) -> DocumentEditorBuffer {
    let mut text = format!(
        "FBX Ingest Summary\nsource: {}\nformat: {}\n\n{}\n\nassets: {}\nmetadata: {}\n",
        path.display(),
        result.format,
        note,
        result.assets.len(),
        result.metadata.len(),
    );

    if !result.assets.is_empty() {
        text.push_str("\nasset payloads:\n");
        for (index, asset) in result.assets.iter().enumerate() {
            text.push_str(&format!(
                "- {}. {}\n",
                index + 1,
                io_asset_summary_label(asset)
            ));
        }
    }

    if !result.metadata.is_empty() {
        text.push_str("\nmetadata entries:\n");
        for (index, metadata) in result.metadata.iter().enumerate() {
            text.push_str(&format!(
                "- {}. {:?} // {} bytes // {} tags\n",
                index + 1,
                metadata.asset_type,
                metadata.size_bytes,
                metadata.tags.join(", ")
            ));
        }
    }

    read_only_document_buffer(
        path.display().to_string(),
        text,
        "generated fbx ingest summary".to_string(),
    )
}

fn parse_svg_stencil_summary(path: &Path) -> Result<SvgStencilSummary, String> {
    let data = fs::read(path).map_err(|err| format!("failed to read svg: {err}"))?;
    let options = usvg::Options::default();
    let tree = usvg::Tree::from_data(&data, &options)
        .map_err(|err| format!("failed to parse svg: {err}"))?;
    let size = tree.size();
    Ok(SvgStencilSummary {
        source_label: path.display().to_string(),
        size: [size.width(), size.height()],
        node_count: count_svg_nodes(tree.root()),
    })
}

fn import_document_buffer_from_svg(summary: &SvgStencilSummary) -> DocumentEditorBuffer {
    let text = format!(
        "SVG Stencil Summary\nsource: {}\nsize: {:.0} x {:.0}\nnodes: {}\n\nThe SVG stencil was parsed natively and is available to the painter workspace for future masking and projection work.",
        summary.source_label,
        summary.size[0],
        summary.size[1],
        summary.node_count,
    );
    read_only_document_buffer(
        summary.source_label.clone(),
        text,
        "generated svg stencil summary".to_string(),
    )
}

fn painter_mesh_source_from_asset(
    asset: &PipelineAsset,
    report: &zen_scene::SceneImportReport,
    discovered_textures: usize,
) -> PainterMeshSource {
    let (imported_vertices, imported_triangles) = match &asset.data {
        PipelineAssetData::Mesh(mesh) => (
            mesh.positions.len() / 3,
            mesh.indices
                .as_ref()
                .map(|indices| indices.len() / 3)
                .unwrap_or(0),
        ),
        PipelineAssetData::Scene(scene) => (
            scene
                .meshes
                .iter()
                .map(|mesh| mesh.positions.len() / 3)
                .sum::<usize>(),
            scene
                .meshes
                .iter()
                .map(|mesh| {
                    mesh.indices
                        .as_ref()
                        .map(|indices| indices.len() / 3)
                        .unwrap_or(0)
                })
                .sum::<usize>(),
        ),
        _ => (0, 0),
    };

    let extension = asset
        .source_path
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| value.to_ascii_uppercase())
        .unwrap_or_else(|| "ASSET".to_string());
    let source_label = asset
        .source_path
        .file_name()
        .and_then(|name| name.to_str())
        .map(str::to_string)
        .unwrap_or_else(|| asset.source_path.display().to_string());
    let import_note = if discovered_textures > 0 {
        format!(
            "{} imported into the native scene and {} nearby PBR textures were bound",
            report.label, discovered_textures
        )
    } else {
        format!("{} imported into the native scene", report.label)
    };

    PainterMeshSource {
        format_label: extension,
        source_label,
        imported_objects: report.imported_objects,
        imported_vertices,
        imported_triangles,
        import_note,
    }
}

fn default_painter_brushes() -> Vec<KBrushAsset> {
    vec![
        KBrushAsset {
            id: "paint_surface".to_string(),
            name: "Surface Paint".to_string(),
            category: "Paint/Color".to_string(),
            tags: vec![
                "paint".to_string(),
                "surface".to_string(),
                "pbr".to_string(),
            ],
            kernel: BrushKernel::PaintColor,
            params: BrushParams {
                radius: 0.18,
                strength: 0.85,
                hardness: 0.62,
                spacing: 0.06,
                accumulate: true,
                extras: HashMap::from([
                    ("flow".to_string(), 0.88),
                    ("stabilize".to_string(), 0.35),
                ]),
                ..Default::default()
            },
            ..Default::default()
        },
        KBrushAsset {
            id: "paint_soft_fill".to_string(),
            name: "Soft Fill".to_string(),
            category: "Paint/Color".to_string(),
            tags: vec!["paint".to_string(), "soft".to_string(), "fill".to_string()],
            kernel: BrushKernel::PaintColor,
            params: BrushParams {
                radius: 0.42,
                strength: 0.55,
                hardness: 0.18,
                spacing: 0.03,
                accumulate: true,
                extras: HashMap::from([
                    ("flow".to_string(), 0.65),
                    ("projection".to_string(), 1.0),
                ]),
                ..Default::default()
            },
            ..Default::default()
        },
        KBrushAsset {
            id: "paint_mask_cut".to_string(),
            name: "Mask Cut".to_string(),
            category: "Paint/Mask".to_string(),
            tags: vec!["mask".to_string(), "cut".to_string(), "stencil".to_string()],
            kernel: BrushKernel::PaintMask,
            params: BrushParams {
                radius: 0.22,
                strength: 1.0,
                hardness: 0.86,
                spacing: 0.08,
                front_faces_only: true,
                extras: HashMap::from([
                    ("falloff".to_string(), 0.92),
                    ("edge_bias".to_string(), 0.15),
                ]),
                ..Default::default()
            },
            ..Default::default()
        },
        KBrushAsset {
            id: "paint_edge_wear".to_string(),
            name: "Edge Wear".to_string(),
            category: "Paint/Material".to_string(),
            tags: vec![
                "wear".to_string(),
                "edge".to_string(),
                "roughness".to_string(),
            ],
            kernel: BrushKernel::PaintColor,
            params: BrushParams {
                radius: 0.12,
                strength: 0.48,
                hardness: 0.74,
                spacing: 0.05,
                jitter_strength: 0.12,
                extras: HashMap::from([
                    ("roughness_push".to_string(), 0.72),
                    ("metal_expose".to_string(), 0.4),
                ]),
                ..Default::default()
            },
            ..Default::default()
        },
    ]
}

fn discover_texture_for_slot(
    directory: &Path,
    source_stem: &str,
    slot: TextureSlot,
) -> Option<PathBuf> {
    let aliases: &[&str] = match slot {
        TextureSlot::BaseColor => &["basecolor", "base_color", "albedo", "diffuse", "color"],
        TextureSlot::Metallic => &["metallic", "metalness", "metal"],
        TextureSlot::Roughness => &["roughness", "rough"],
        TextureSlot::Normal => &["normal", "nrm", "nor"],
        TextureSlot::AmbientOcclusion => &["ambientocclusion", "occlusion", "ao"],
        TextureSlot::Emissive => &["emissive", "emit"],
        TextureSlot::Height => &["height", "displacement", "disp"],
        TextureSlot::Opacity => &["opacity", "alpha", "mask"],
    };
    let source_hint = source_stem
        .split(['_', '-', ' '])
        .find(|token| !token.is_empty())
        .unwrap_or(source_stem);

    let mut candidates = fs::read_dir(directory)
        .ok()?
        .filter_map(Result::ok)
        .map(|entry| entry.path())
        .filter(|path| path.is_file())
        .filter(|path| {
            path.extension()
                .and_then(|ext| ext.to_str())
                .map(|ext| {
                    matches!(
                        ext.to_ascii_lowercase().as_str(),
                        "png" | "jpg" | "jpeg" | "tga" | "bmp" | "exr"
                    )
                })
                .unwrap_or(false)
        })
        .filter_map(|path| {
            let stem = path.file_stem()?.to_str()?.to_ascii_lowercase();
            let mentions_slot = aliases.iter().any(|alias| stem.contains(alias));
            let mentions_source = source_stem.is_empty()
                || stem.contains(source_stem)
                || (!source_hint.is_empty() && stem.contains(source_hint));
            if mentions_slot && mentions_source {
                Some(path)
            } else {
                None
            }
        })
        .collect::<Vec<_>>();
    candidates.sort();
    candidates.into_iter().next()
}

fn read_only_document_buffer(
    source_label: String,
    text: String,
    status: String,
) -> DocumentEditorBuffer {
    DocumentEditorBuffer {
        source_path: None,
        source_label,
        text: text.clone(),
        saved_text: text,
        status,
        read_only: true,
    }
}

fn io_asset_summary_label(asset: &IoAsset) -> String {
    match asset {
        IoAsset::Mesh(mesh) => format!(
            "mesh // {} verts // {} tris",
            mesh.positions.len() / 3,
            mesh.indices.len() / 3
        ),
        IoAsset::Animation(animation) => {
            format!(
                "animation // {:.2}s // {} curves",
                animation.duration,
                animation.curves.len()
            )
        }
        IoAsset::Texture(texture) => {
            format!(
                "texture // {} x {} // {:?}",
                texture.width, texture.height, texture.format
            )
        }
        IoAsset::Material(material) => {
            format!(
                "material // {} params // {} textures",
                material.parameters.len(),
                material.textures.len()
            )
        }
        IoAsset::SceneGraph(scene) => {
            format!("scene graph // {} nodes", scene.nodes.len())
        }
        IoAsset::BinaryBlob(bytes) => format!("binary blob // {} bytes", bytes.len()),
    }
}

fn count_svg_nodes(group: &usvg::Group) -> usize {
    let mut count = 0usize;
    for node in group.children() {
        count += 1;
        if let usvg::Node::Group(subgroup) = node {
            count += count_svg_nodes(subgroup);
        }
        node.subroots(|subroot| {
            count += count_svg_nodes(subroot);
        });
    }
    count
}

fn vec3_to_color32(color: [f32; 3]) -> Color32 {
    Color32::from_rgb(
        (color[0].clamp(0.0, 1.0) * 255.0) as u8,
        (color[1].clamp(0.0, 1.0) * 255.0) as u8,
        (color[2].clamp(0.0, 1.0) * 255.0) as u8,
    )
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
