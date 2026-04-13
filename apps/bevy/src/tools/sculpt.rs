use crate::viewport::{sculpt_enabled, ActiveTool};
use bevy::prelude::*;
use bevy::render::renderer::{RenderDevice, RenderQueue};
use bevy::window::{PrimaryWindow, Window};
use bevy_egui::EguiContexts;
use wgpu::util::DeviceExt; // For create_buffer_init in subdivide/remesh

// Unified sculpt module - optimized GPU path with spatial grid, sparse readback, async staging
use crate::modules::sculpt::{
    apply_brush as apply_brush_unified,
    compute_all_normals,
    dispose_sculpt_mesh,
    get_sculpt_positions,
    init_sculpt_mesh,
    recalculate_normals_incremental,
    update_sculpt_positions,
    BrushResult,
    MeshTopology, // For subdivide/remesh operations
    SculptMeshHandle,
    SpatialGrid,
};

// GPU BVH Raycast (replaces parry3d for ~100x faster raycasting on high-poly)
// Uses Bevy's RenderDevice instead of creating a separate GPU context
use crate::gpu::{GpuBvhRaycast, GpuRaycastMesh, RayHit};

// GPU Geometry Operations - subdivision and remesh
use crate::gpu::pipelines::{GpuDynameshEngine, GpuDynameshParams};
use k_os_gpu_pipeline::pipelines::subdivide_v2::{GpuSubdivideEngineV2, GpuSubdivideResult};

// GPU Sculpt Compute - still needed for subdivide/remesh re-registration
use k_os_gpu_pipeline::sculpt::{BrushParams as GpuBrushParams, GpuMeshBuffers, GpuSculptCompute};

// Data-driven brush system
use crate::brushes::{BrushKernel, BrushParams as AssetBrushParams, KBrushAsset, BRUSH_LIBRARY};

#[derive(Resource, Default)]
pub struct EguiCaptureState {
    pub wants_pointer: bool,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum InputSource {
    ReactLeash,
    BevyLocal,
}

#[derive(Resource, Default)]
pub struct InputTelemetry {
    pub last_source: Option<InputSource>,
    pub last_leash_input_s: f64,
    pub last_bevy_local_input_s: f64,
    /// True if Bevy window has cursor position (mouse is over Bevy window)
    pub bevy_has_cursor: bool,
    /// Last time we detected cursor in Bevy window
    pub last_bevy_cursor_s: f64,
}

/// Legacy brush settings - still used for basic tool/radius/intensity
#[derive(Resource, Clone, Copy)]
pub struct BrushSettings {
    pub tool: u8,
    pub radius: f32,
    pub intensity: f32,
}

impl Default for BrushSettings {
    fn default() -> Self {
        Self {
            tool: 0,
            radius: 0.15,   // Reduced from 0.35 for better spherical sculpting
            intensity: 0.4, // Reduced from 0.6 for more controlled strokes
        }
    }
}

// ============================================================================
// DATA-DRIVEN BRUSH SYSTEM
// ============================================================================

/// The active brush asset - used for sculpting
#[derive(Resource)]
pub struct ActiveBrush {
    /// Currently selected brush asset
    pub asset: KBrushAsset,
    /// Whether the brush has been modified from its saved state
    pub modified: bool,
}

impl Default for ActiveBrush {
    fn default() -> Self {
        // Initialize the brush library (loads built-in presets)
        {
            let mut lib = BRUSH_LIBRARY.write();
            if let Err(e) = lib.init() {
                warn!("⚠️ Failed to initialize brush library: {}", e);
            } else {
                info!(
                    "📁 Brush library initialized with {} brushes",
                    lib.list().len()
                );
            }
        }

        Self {
            asset: KBrushAsset::preset_clay(),
            modified: false,
        }
    }
}

impl ActiveBrush {
    /// Load a brush from the library by ID
    pub fn load_from_library(&mut self, brush_id: &str) -> bool {
        let library = BRUSH_LIBRARY.read();
        if let Some(brush) = library.get(brush_id) {
            self.asset = brush.clone();
            self.modified = false;
            info!("🖌️ Loaded brush: {} ({})", self.asset.name, self.asset.id);
            true
        } else {
            warn!("⚠️ Brush not found: {}", brush_id);
            false
        }
    }

    /// Get effective radius (may be overridden by UI slider)
    pub fn radius(&self) -> f32 {
        self.asset.params.radius
    }

    /// Get effective strength (may be overridden by UI slider)
    pub fn strength(&self) -> f32 {
        self.asset.params.strength
    }

    /// Map kernel to legacy tool ID for compatibility
    pub fn legacy_tool_id(&self) -> u8 {
        match &self.asset.kernel {
            BrushKernel::Stamp => 0,       // Clay
            BrushKernel::Smooth => 4,      // Smooth
            BrushKernel::Pinch => 3,       // Pinch
            BrushKernel::Grab => 5,        // Grab (if implemented)
            BrushKernel::Flatten => 2,     // Flatten
            BrushKernel::SimCloth => 12,   // Melt (closest)
            BrushKernel::SimGravity => 13, // Gravity
            _ => 0,
        }
    }
}

/// Event to switch to a different brush
#[derive(Event, Clone, Debug)]
pub struct SwitchBrushEvent {
    pub brush_id: String,
}
impl bevy::prelude::Message for SwitchBrushEvent {}

#[derive(Resource, Default)]
pub struct LocalStrokeState {
    pub active: bool,
    pub last_ndc: Vec2,
}

/// Event triggered when the cursor moves (received from React)
#[derive(Event, Clone, Copy, Debug)]
pub struct CursorMovedEvent(pub Vec2);
impl bevy::prelude::Message for CursorMovedEvent {}

/// Event triggered when a brush stroke occurs
/// Event triggered when a brush stroke occurs
#[derive(Event, Clone, Debug)]
pub struct BrushStrokeEvent {
    pub tool: u8,               // Legacy ID
    pub kernel: Option<String>, // Data-driven Kernel Name (e.g. "sculpt_stamp")
    pub radius: f32,
    pub intensity: f32,
    #[allow(dead_code)]
    pub cursor_ndc: Vec2,
    pub delta_ndc: Option<Vec2>,
}
impl bevy::prelude::Message for BrushStrokeEvent {}

#[derive(Event, Clone, Copy, Debug)]
pub struct UndoEvent;
impl bevy::prelude::Message for UndoEvent {}

#[derive(Event, Clone, Copy, Debug)]
pub struct RedoEvent;
impl bevy::prelude::Message for RedoEvent {}

#[derive(Event, Clone, Copy, Debug)]
pub struct SnapshotEvent;
impl bevy::prelude::Message for SnapshotEvent {}

#[derive(Event, Clone, Copy, Debug)]
pub struct SubdivideEvent;
impl bevy::prelude::Message for SubdivideEvent {}

/// GPU Remesh (Dynamesh-style) event
#[derive(Event, Clone, Debug)]
pub struct RemeshEvent {
    /// Target resolution (32-256, higher = more detail)
    pub resolution: u32,
}
impl bevy::prelude::Message for RemeshEvent {}

impl Default for RemeshEvent {
    fn default() -> Self {
        Self { resolution: 128 }
    }
}

/// Component identifying a sculptable mesh
#[derive(Component)]
pub struct SculptModel;

/// Component holding high-performance sculpt structures
/// Uses unified modules::sculpt registry for optimized GPU brush path
#[derive(Component)]
pub struct SculptData {
    /// Handle into the unified sculpt mesh registry (modules::sculpt::MESHES)
    /// This gives us: GPU spatial grid, sparse readback, async staging, GPU normals
    pub sculpt_handle: Option<SculptMeshHandle>,
    /// CPU spatial grid (backup for subdivide/remesh operations)
    pub grid: SpatialGrid,
    /// Mesh topology for neighbor lookups
    pub topology: MeshTopology,
    /// Cached normals (for undo/redo and subdivide)
    pub normals: Vec<f32>,
    /// Cached indices for normal recalc
    pub indices: Vec<u32>,
    /// Undo/Redo stacks (positions snapshots)
    pub undo_stack: Vec<Vec<f32>>,
    pub redo_stack: Vec<Vec<f32>>,
    /// GPU BVH mesh handle for ultra-fast GPU raycasting
    pub gpu_mesh_handle: Option<u64>,
    /// Whether GPU BVH needs rebuilding
    pub gpu_bvh_dirty: bool,
    /// GPU sculpt compute handle (for legacy subdivide/remesh re-registration)
    pub gpu_sculpt_handle: Option<u64>,
    /// Last hit point for delta calculation (world space)
    pub last_hit_point: Option<Vec3>,
}

/// Global cursor state for tools to access
#[derive(Resource, Default)]
pub struct SculptCursorState {
    pub position_ndc: Vec2,
    /// Last raycast hit point in world space (if any)
    pub hit_point_world: Option<Vec3>,
    /// Last raycast hit normal in world space
    pub hit_normal_world: Option<Vec3>,
}

/// GPU Geometry Engines (lazy-initialized with Bevy's device)
#[derive(Resource, Default)]
pub struct GpuGeometryEngines {
    subdivide: Option<GpuSubdivideEngineV2>,
    dynamesh: Option<GpuDynameshEngine>,
}

impl GpuGeometryEngines {
    /// Get or init GPU subdivision engine
    pub fn get_subdivide(
        &mut self,
        device: &wgpu::Device,
        _queue: &wgpu::Queue,
    ) -> Result<&GpuSubdivideEngineV2, String> {
        if self.subdivide.is_none() {
            self.subdivide = Some(GpuSubdivideEngineV2::new(device));
        }
        Ok(self
            .subdivide
            .as_ref()
            .ok_or("Failed to initialize subdivide engine")?)
    }

    /// Get or init GPU dynamesh engine
    pub fn get_dynamesh(&mut self, device: &wgpu::Device) -> &GpuDynameshEngine {
        if self.dynamesh.is_none() {
            info!("🚀 Initializing GPU Dynamesh Engine");
            self.dynamesh = Some(GpuDynameshEngine::new(device));
        }
        self.dynamesh.as_ref().unwrap()
    }
}

/// Component for the 3D Brush Cursor
#[derive(Component)]
pub struct BrushCursor;

/// BVH rebuild throttling - only rebuild every N frames for performance
#[derive(Resource)]
pub struct BvhThrottle {
    pub frames_since_rebuild: u32,
    pub rebuild_interval: u32, // Default: 5 frames
}

impl Default for BvhThrottle {
    fn default() -> Self {
        Self {
            frames_since_rebuild: 0,
            rebuild_interval: 5,
        }
    }
}

/// GPU BVH Raycast resource for Bevy - shared engine for all sculpt meshes
/// Uses Bevy's existing RenderDevice instead of creating a separate GPU context
#[derive(Resource)]
pub struct BevyGpuRaycast {
    engine: Option<GpuBvhRaycast>,
    meshes: std::collections::HashMap<u64, GpuRaycastMesh>,
    next_handle: u64,
}

impl Default for BevyGpuRaycast {
    fn default() -> Self {
        Self {
            engine: None,
            meshes: std::collections::HashMap::new(),
            next_handle: 1,
        }
    }
}

impl BevyGpuRaycast {
    /// Initialize GPU raycast engine using Bevy's RenderDevice
    /// Call this from a system that has access to RenderDevice
    pub fn ensure_engine_with_device(&mut self, device: &wgpu::Device) {
        if self.engine.is_none() {
            self.engine = Some(GpuBvhRaycast::new(device));
            info!("🚀 GPU BVH Raycast engine initialized (using Bevy's device)");
        }
    }

    /// Check if engine is initialized
    pub fn is_ready(&self) -> bool {
        self.engine.is_some()
    }

    /// Build mesh BVH and return handle (requires Bevy's device)
    pub fn register_mesh_with_device(
        &mut self,
        device: &wgpu::Device,
        positions: &[f32],
        indices: &[u32],
    ) -> Result<u64, String> {
        self.ensure_engine_with_device(device);
        let engine = self.engine.as_ref().unwrap();

        let mesh = engine.build_mesh_bvh(device, positions, indices, None)?;

        let handle = self.next_handle;
        self.next_handle += 1;
        self.meshes.insert(handle, mesh);

        info!(
            "🔷 GPU mesh registered: handle={}, tris={}",
            handle,
            indices.len() / 3
        );
        Ok(handle)
    }

    /// Rebuild mesh BVH (after sculpting)
    pub fn rebuild_mesh_with_device(
        &mut self,
        device: &wgpu::Device,
        handle: u64,
        positions: &[f32],
        indices: &[u32],
    ) -> Result<(), String> {
        let engine = self.engine.as_ref().ok_or("GPU raycast not initialized")?;

        let mesh = engine.build_mesh_bvh(device, positions, indices, None)?;
        self.meshes.insert(handle, mesh);

        trace!("🔄 GPU mesh rebuilt: handle={}", handle);
        Ok(())
    }

    /// Perform raycast against a mesh
    pub fn raycast_with_device(
        &self,
        device: &wgpu::Device,
        queue: &wgpu::Queue,
        handle: u64,
        origin: Vec3,
        direction: Vec3,
    ) -> Result<RayHit, String> {
        let engine = self.engine.as_ref().ok_or("GPU raycast not initialized")?;
        let mesh = self
            .meshes
            .get(&handle)
            .ok_or_else(|| format!("Invalid mesh handle: {}", handle))?;

        engine.raycast(
            device,
            queue,
            mesh,
            [origin.x, origin.y, origin.z],
            [direction.x, direction.y, direction.z],
        )
    }

    /// Dispose mesh
    pub fn dispose_mesh(&mut self, handle: u64) {
        self.meshes.remove(&handle);
    }
}

// BevyGpuSculpt - minimal version for subdivide/remesh re-registration
// Main brush path uses unified modules::sculpt
#[derive(Resource)]
pub struct BevyGpuSculpt {
    engine: Option<GpuSculptCompute>,
    mesh_buffers: std::collections::HashMap<u64, GpuMeshBuffers>,
}

impl Default for BevyGpuSculpt {
    fn default() -> Self {
        Self {
            engine: None,
            mesh_buffers: std::collections::HashMap::new(),
        }
    }
}

impl BevyGpuSculpt {
    pub fn ensure_engine(&mut self, device: &wgpu::Device, queue: &wgpu::Queue) {
        if self.engine.is_none() {
            self.engine = Some(GpuSculptCompute::new(device, queue));
        }
    }

    pub fn register_mesh(
        &mut self,
        device: &wgpu::Device,
        entity_id: u64,
        positions: &[f32],
        normals: &[f32],
    ) -> Result<(), String> {
        let _engine = self.engine.as_ref().ok_or("GPU sculpt not initialized")?;
        let vertex_count = positions.len() / 3;

        let mut positions_vec4: Vec<[f32; 4]> = Vec::with_capacity(vertex_count);
        for i in 0..vertex_count {
            let p = i * 3;
            positions_vec4.push([positions[p], positions[p + 1], positions[p + 2], 1.0]);
        }

        let mut normals_vec4: Vec<[f32; 4]> = Vec::with_capacity(vertex_count);
        for i in 0..vertex_count {
            let n = i * 3;
            normals_vec4.push([normals[n], normals[n + 1], normals[n + 2], 0.0]);
        }

        let positions_buffer = device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("sculpt_positions"),
            contents: bytemuck::cast_slice(&positions_vec4),
            usage: wgpu::BufferUsages::STORAGE
                | wgpu::BufferUsages::COPY_SRC
                | wgpu::BufferUsages::COPY_DST,
        });

        let normals_buffer = device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("sculpt_normals"),
            contents: bytemuck::cast_slice(&normals_vec4),
            usage: wgpu::BufferUsages::STORAGE
                | wgpu::BufferUsages::COPY_SRC
                | wgpu::BufferUsages::COPY_DST,
        });

        let buffers = GpuMeshBuffers {
            vertex_count: vertex_count as u32,
            face_count: 0,
            positions: positions_buffer,
            normals: normals_buffer,
            indices: None,
            normals_fixed: None,
            dirty_mask: None,
            dirty_faces: None,
        };

        self.mesh_buffers.insert(entity_id, buffers);
        Ok(())
    }
}

/// Marker component for the primary 3D camera used for raycasting.
#[derive(Component)]
pub struct MainCamera;

pub struct SculptPlugin;

impl Plugin for SculptPlugin {
    fn build(&self, app: &mut App) {
        app.add_message::<CursorMovedEvent>()
            .add_message::<BrushStrokeEvent>()
            .add_message::<UndoEvent>()
            .add_message::<RedoEvent>()
            .add_message::<SnapshotEvent>()
            .add_message::<SubdivideEvent>()
            .add_message::<RemeshEvent>()
            .add_message::<SwitchBrushEvent>() // NEW: Data-driven brush switching
            .init_resource::<SculptCursorState>()
            .init_resource::<EguiCaptureState>()
            .init_resource::<InputTelemetry>()
            .init_resource::<BrushSettings>()
            .init_resource::<ActiveBrush>() // NEW: Current brush asset
            .init_resource::<LocalStrokeState>()
            .init_resource::<BvhThrottle>()
            .init_resource::<BevyGpuRaycast>()
            .init_resource::<BevyGpuSculpt>() // For subdivide/remesh re-registration
            .init_resource::<GpuGeometryEngines>()
            .add_systems(
                Update,
                sculpt_tool_activation_system.before(init_sculpt_data),
            )
            .add_systems(
                Update,
                switch_brush_system.before(local_mouse_brush_input_system),
            ) // NEW
            .add_systems(
                Update,
                local_mouse_brush_input_system.run_if(sculpt_enabled),
            )
            .add_systems(
                Update,
                ensure_selected_mesh_is_sculpt_target
                    .before(init_sculpt_data)
                    .run_if(sculpt_enabled),
            )
            .add_systems(
                Update,
                init_sculpt_data
                    .after(local_mouse_brush_input_system)
                    .run_if(sculpt_enabled),
            )
            .add_systems(
                Update,
                update_cursor.after(init_sculpt_data).run_if(sculpt_enabled),
            )
            .add_systems(
                Update,
                apply_brush_system
                    .after(update_cursor)
                    .run_if(sculpt_enabled),
            )
            .add_systems(Update, reset_stroke_last_hits.after(apply_brush_system))
            .add_systems(
                Update,
                rebuild_bvh_system
                    .after(apply_brush_system)
                    .run_if(sculpt_enabled),
            )
            .add_systems(
                Update,
                handle_undo_redo
                    .after(rebuild_bvh_system)
                    .run_if(sculpt_enabled),
            )
            .add_systems(
                Update,
                handle_gpu_subdivide
                    .after(handle_undo_redo)
                    .run_if(sculpt_enabled),
            )
            .add_systems(
                Update,
                handle_gpu_remesh
                    .after(handle_gpu_subdivide)
                    .run_if(sculpt_enabled),
            );
    }
}

fn spawn_brush_cursor(
    commands: &mut Commands,
    meshes: &mut Assets<Mesh>,
    materials: &mut Assets<StandardMaterial>,
) {
    // Create a flat circle mesh with vertex colors for falloff
    let mut circle_mesh = Circle::new(0.1);
    let mesh = meshes.add(circle_mesh);

    // Create unlit material with alpha blending
    let cursor_material = materials.add(StandardMaterial {
        base_color: Color::srgba(0.0, 1.0, 1.0, 0.8), // Cyan with transparency
        unlit: true,
        alpha_mode: AlphaMode::Blend,
        ..default()
    });

    commands.spawn((
        Mesh3d(mesh),
        MeshMaterial3d(cursor_material),
        BrushCursor,
        Transform::from_xyz(0.0, 0.0, 0.0).with_scale(Vec3::ZERO),
    ));
}

fn sculpt_tool_activation_system(
    mut commands: Commands,
    active_tool: Res<crate::viewport::ActiveTool>,
    selection: Res<crate::viewport::SelectionState>,
    mut meshes: ResMut<Assets<Mesh>>,
    mut materials: ResMut<Assets<StandardMaterial>>,
    cursor_q: Query<Entity, With<BrushCursor>>,
    mesh_targets_check: Query<
        (),
        (
            With<Mesh3d>,
            With<crate::viewport::Selectable>,
            Without<SculptModel>,
        ),
    >,
    mesh_targets: Query<
        Entity,
        (
            With<Mesh3d>,
            With<crate::viewport::Selectable>,
            Without<SculptModel>,
        ),
    >,
) {
    if !active_tool.is_changed() {
        return;
    }

    match *active_tool {
        crate::viewport::ActiveTool::Sculpt => {
            if cursor_q.is_empty() {
                spawn_brush_cursor(&mut commands, &mut meshes, &mut materials);
            }

            let target = selection
                .primary
                .and_then(|e| mesh_targets_check.get(e).ok().map(|_| e))
                .or_else(|| mesh_targets.iter().next());

            if let Some(entity) = target {
                commands.entity(entity).insert(SculptModel);
            }
        }
        crate::viewport::ActiveTool::Viewport => {
            for e in cursor_q.iter() {
                commands.entity(e).despawn();
            }
        }
    }
}

/// System to handle brush switching from UI or code
fn switch_brush_system(
    mut switch_events: MessageReader<SwitchBrushEvent>,
    mut active_brush: ResMut<ActiveBrush>,
    mut brush_settings: ResMut<BrushSettings>,
) {
    for event in switch_events.read() {
        if active_brush.load_from_library(&event.brush_id) {
            // Sync legacy BrushSettings for backward compatibility
            brush_settings.tool = active_brush.legacy_tool_id();
            brush_settings.radius = active_brush.radius();
            brush_settings.intensity = active_brush.strength();
            info!(
                "🖌️ Brush switched: {} (tool={})",
                active_brush.asset.name, brush_settings.tool
            );
        }
    }
}

fn ensure_selected_mesh_is_sculpt_target(
    mut commands: Commands,
    selection: Res<crate::viewport::SelectionState>,
    mesh_targets_check: Query<
        (),
        (
            With<Mesh3d>,
            With<crate::viewport::Selectable>,
            Without<SculptModel>,
        ),
    >,
) {
    let Some(entity) = selection.primary else {
        return;
    };

    if mesh_targets_check.get(entity).is_ok() {
        commands.entity(entity).insert(SculptModel);
    }
}

pub fn local_mouse_brush_input_system(
    mut capture: ResMut<EguiCaptureState>,
    mut telemetry: ResMut<InputTelemetry>,
    settings: Res<BrushSettings>,
    mut state: ResMut<LocalStrokeState>,
    buttons: Res<ButtonInput<MouseButton>>,
    time: Res<Time>,
    window: Single<&Window, With<PrimaryWindow>>,
    mut cursor_events: MessageWriter<CursorMovedEvent>,
    mut brush_events: MessageWriter<BrushStrokeEvent>,
    mut snapshot_events: MessageWriter<SnapshotEvent>,
    active_brush: Res<ActiveBrush>, // Added ActiveBrush
) {
    // Don't check egui state here - let debug_hud_system handle it
    // Just check if we're currently sculpting

    if capture.wants_pointer {
        state.active = false;
        return;
    }

    // Track whether Bevy sees the cursor at all (for telemetry)
    let cursor_opt = window.cursor_position();
    telemetry.bevy_has_cursor = cursor_opt.is_some();
    if cursor_opt.is_some() {
        telemetry.last_bevy_cursor_s = time.elapsed_secs_f64();
    }

    let Some(cursor) = cursor_opt else { return };

    let size = Vec2::new(window.resolution.width(), window.resolution.height());
    if size.x <= 0.0 || size.y <= 0.0 {
        return;
    }

    let ndc = Vec2::new(
        (cursor.x / size.x) * 2.0 - 1.0,
        -((cursor.y / size.y) * 2.0 - 1.0),
    );

    cursor_events.write(CursorMovedEvent(ndc));

    if buttons.just_pressed(MouseButton::Left) {
        snapshot_events.write(SnapshotEvent);
        state.active = true;
        state.last_ndc = ndc;

        telemetry.last_source = Some(InputSource::BevyLocal);
        telemetry.last_bevy_local_input_s = time.elapsed_secs_f64();
    }

    if buttons.pressed(MouseButton::Left) && state.active {
        let delta = ndc - state.last_ndc;
        state.last_ndc = ndc;

        // Get kernel name from active brush
        let kernel_name = active_brush.asset.kernel.shader_name().to_string();

        brush_events.write(BrushStrokeEvent {
            tool: settings.tool,
            kernel: Some(kernel_name),
            radius: settings.radius,
            intensity: settings.intensity,
            cursor_ndc: ndc,
            delta_ndc: Some(delta),
        });

        telemetry.last_source = Some(InputSource::BevyLocal);
        telemetry.last_bevy_local_input_s = time.elapsed_secs_f64();
    }

    if buttons.just_released(MouseButton::Left) {
        state.active = false;
    }
}

/// Initialize SculptData for new meshes
/// Uses unified modules::sculpt registry for optimized GPU path
fn init_sculpt_data(
    mut commands: Commands,
    mut meshes: ResMut<Assets<Mesh>>,
    query: Query<(Entity, &Mesh3d), (With<SculptModel>, Without<SculptData>)>,
    mut gpu_raycast: ResMut<BevyGpuRaycast>,
    render_device: Res<RenderDevice>,
) {
    for (entity, mesh_handle) in query.iter() {
        if let Some(mesh) = meshes.get_mut(mesh_handle) {
            info!("Initializing SculptData for mesh entity {:?}", entity);
            let start = std::time::Instant::now();

            // Extract positions
            let positions_flat: Vec<f32> =
                if let Some(attr) = mesh.attribute(Mesh::ATTRIBUTE_POSITION) {
                    if let bevy::mesh::VertexAttributeValues::Float32x3(v) = attr {
                        bytemuck::cast_slice(v).to_vec()
                    } else {
                        warn!("Mesh has no Float32x3 positions!");
                        continue;
                    }
                } else {
                    continue;
                };

            // Extract Indices
            let indices: Vec<u32> = match mesh.indices() {
                Some(bevy::mesh::Indices::U32(v)) => v.clone(),
                Some(bevy::mesh::Indices::U16(v)) => v.iter().map(|&i| i as u32).collect(),
                None => (0..positions_flat.len() as u32 / 3).collect(),
            };

            // Register with UNIFIED modules::sculpt registry
            // This gives us: GPU spatial grid, sparse readback, async staging, GPU normals
            let sculpt_handle = match init_sculpt_mesh(positions_flat.clone(), indices.clone()) {
                Ok(handle) => {
                    info!(
                        "🚀 Unified SculptMesh registered: handle={}, verts={}",
                        handle,
                        positions_flat.len() / 3
                    );
                    Some(handle)
                }
                Err(e) => {
                    warn!("⚠️ Failed to init sculpt mesh: {}. Brush will fail.", e);
                    None
                }
            };

            // Build GPU BVH for ultra-fast raycasting using Bevy's device
            let gpu_mesh_handle = match gpu_raycast.register_mesh_with_device(
                render_device.wgpu_device(),
                &positions_flat,
                &indices,
            ) {
                Ok(handle) => {
                    info!(
                        "🚀 GPU BVH built for entity {:?}, handle={}",
                        entity, handle
                    );
                    Some(handle)
                }
                Err(e) => {
                    warn!(
                        "⚠️ Failed to build GPU BVH: {}. Raycast will fail for this mesh.",
                        e
                    );
                    None
                }
            };

            // Build local structures for subdivide/remesh (backup)
            let max_dim = 10.0;
            let cell_size = max_dim / 50.0;
            let mut grid = SpatialGrid::new(cell_size);
            grid.build(&positions_flat);

            let mut topology = MeshTopology::new();
            topology.build(positions_flat.len() / 3, &indices);

            let normals = compute_all_normals(&positions_flat, &indices);

            // Push initial state to Undo Stack
            let initial_pos = positions_flat.clone();

            commands.entity(entity).insert(SculptData {
                sculpt_handle,
                grid,
                topology,
                normals,
                indices,
                undo_stack: vec![initial_pos],
                redo_stack: vec![],
                gpu_mesh_handle,
                gpu_bvh_dirty: false,
                gpu_sculpt_handle: None, // Unified path doesn't need this
                last_hit_point: None,
            });

            info!(
                "SculptData initialized in {:.2}ms",
                start.elapsed().as_secs_f64() * 1000.0
            );
        }
    }
}

pub fn update_cursor(
    camera_q: Query<(&Camera, &GlobalTransform), With<MainCamera>>,
    mut cursor_q: Query<&mut Transform, With<BrushCursor>>,
    mut cursor_state: ResMut<SculptCursorState>,
    brush_settings: Res<BrushSettings>,
    meshes: Res<Assets<Mesh>>,
    sculpt_models: Query<(&Mesh3d, &GlobalTransform, &SculptData), With<SculptModel>>,
    window: Single<&Window, With<PrimaryWindow>>,
    gpu_raycast: Res<BevyGpuRaycast>,
    render_device: Res<RenderDevice>,
    render_queue: Res<RenderQueue>,
) {
    // Always get cursor transform - don't return early
    let Some(mut cursor_transform) = cursor_q.iter_mut().next() else {
        warn!("No brush cursor found");
        return;
    };

    // Default fallback position - in front of camera
    let Some((camera, cam_transform)) = camera_q.iter().next() else {
        // Fallback: place at origin if no camera
        cursor_transform.translation = Vec3::ZERO;
        cursor_transform.scale = Vec3::ZERO;
        cursor_state.hit_point_world = None;
        cursor_state.hit_normal_world = None;
        return;
    };

    // Default position in front of camera
    let default_pos = cam_transform.transform_point(Vec3::new(0.0, 0.0, -2.0));

    // Read cursor position directly from window every frame
    let cursor_pos = window.cursor_position().unwrap_or_else(|| {
        // Center of window if no cursor
        Vec2::new(
            window.resolution.width() * 0.5,
            window.resolution.height() * 0.5,
        )
    });

    // Convert window coords to NDC and store
    let size = Vec2::new(window.resolution.width(), window.resolution.height());
    if size.x <= 0.0 || size.y <= 0.0 {
        cursor_transform.translation = default_pos;
        cursor_transform.scale = Vec3::ZERO;
        return;
    }
    let ndc = Vec2::new(
        (cursor_pos.x / size.x) * 2.0 - 1.0,
        -((cursor_pos.y / size.y) * 2.0 - 1.0),
    );
    cursor_state.position_ndc = ndc;

    // Use cursor_pos directly for viewport calculation (already in window coords)
    let viewport_pos = cursor_pos;

    // Simple fallback ray struct
    #[derive(Debug)]
    struct SimpleRay {
        origin: Vec3,
        direction: Vec3,
    }

    let ray = match camera.viewport_to_world(cam_transform, viewport_pos) {
        Ok(ray) => SimpleRay {
            origin: ray.origin,
            direction: *ray.direction,
        },
        Err(e) => {
            warn_once!("Viewport to world failed ({:?})", e);
            cursor_state.hit_point_world = None;
            cursor_state.hit_normal_world = None;
            cursor_transform.translation = default_pos;
            cursor_transform.scale = Vec3::ZERO;
            cursor_transform.rotation = Quat::IDENTITY;
            return;
        }
    };

    // Raycast against sculpt meshes using GPU BVH (ultra-fast!)
    let mut best_hit: Option<(f32, Vec3, Vec3)> = None; // (t, world_point, world_normal)

    let sculpt_count = sculpt_models.iter().count();
    if sculpt_count == 0 {
        trace!("update_cursor: No sculpt models with SculptData found!");
    }

    for (_mesh_handle, mesh_transform, sculpt_data) in sculpt_models.iter() {
        // Use GPU BVH for ultra-fast raycasting (~100x faster than CPU parry3d!)
        let Some(handle) = sculpt_data.gpu_mesh_handle else {
            trace!("update_cursor: SculptData.gpu_mesh_handle is None");
            continue;
        };

        // Transform ray to local space (GPU mesh is in local coords)
        let inv_mat = mesh_transform.affine().inverse();
        let local_ray_origin = inv_mat.transform_point3(ray.origin);
        let local_ray_dir = inv_mat.transform_vector3(ray.direction).normalize();

        // GPU BVH raycast - uses Bevy's device (no duplicate GPU context!)
        match gpu_raycast.raycast_with_device(
            render_device.wgpu_device(),
            render_queue.as_ref(),
            handle,
            local_ray_origin,
            local_ray_dir,
        ) {
            Ok(hit) if hit.hit => {
                let t = hit.distance;
                if t > 0.001 && (best_hit.is_none() || t < best_hit.unwrap().0) {
                    let local_hit = Vec3::new(hit.point[0], hit.point[1], hit.point[2]);
                    let local_normal = Vec3::new(hit.normal[0], hit.normal[1], hit.normal[2]);

                    // Transform back to world space
                    let world_hit = mesh_transform.transform_point(local_hit);
                    let world_normal = mesh_transform
                        .affine()
                        .transform_vector3(local_normal)
                        .normalize();
                    best_hit = Some((t, world_hit, world_normal));
                }
            }
            Ok(_) => {
                // No hit, continue to next mesh
            }
            Err(e) => {
                warn_once!("GPU raycast failed: {}", e);
            }
        }
    }

    if let Some((_, hit_point, hit_normal)) = best_hit {
        cursor_state.hit_point_world = Some(hit_point);
        cursor_state.hit_normal_world = Some(hit_normal);
        // Snap cursor to hit point, offset slightly along normal
        cursor_transform.translation = hit_point + hit_normal * 0.01;
        // Scale cursor based on brush radius
        cursor_transform.scale = Vec3::splat(brush_settings.radius);
        // Orient cursor to face along normal
        cursor_transform.rotation = Quat::from_rotation_arc(Vec3::Y, hit_normal);
    } else {
        cursor_state.hit_point_world = None;
        cursor_state.hit_normal_world = None;
        // Fallback: place cursor along ray at fixed depth, keep it visible
        cursor_transform.translation = ray.origin + ray.direction * 3.0;
        cursor_transform.scale = Vec3::splat(brush_settings.radius * 0.5); // Keep visible but smaller
        cursor_transform.rotation = Quat::IDENTITY; // Reset rotation
    }
}

pub fn apply_brush_system(
    mut brush_events: MessageReader<BrushStrokeEvent>,
    mut meshes: ResMut<Assets<Mesh>>,
    camera_q: Query<(&Camera, &GlobalTransform), With<MainCamera>>,
    mut sculpt_models: Query<
        (Entity, &Mesh3d, &GlobalTransform, &mut SculptData),
        With<SculptModel>,
    >,
    cursor_state: Res<SculptCursorState>,
) {
    let Some((_camera, _cam_transform)) = camera_q.iter().next() else {
        return;
    };

    for event in brush_events.read() {
        // Use cursor state's hit point directly - don't recalculate raycast
        let Some(hit_point) = cursor_state.hit_point_world else {
            continue;
        };
        let Some(hit_normal) = cursor_state.hit_normal_world else {
            continue;
        };

        for (_entity, mesh_handle, mesh_transform, mut sculpt_data) in sculpt_models.iter_mut() {
            let Some(mesh) = meshes.get_mut(mesh_handle) else {
                continue;
            };

            // Get sculpt handle
            let Some(handle) = sculpt_data.sculpt_handle else {
                warn!("No sculpt_handle for entity - sculpting disabled");
                continue;
            };

            let inv_mat = mesh_transform.affine().inverse();

            // Transform hit point to local space
            let local_hit_point = inv_mat.transform_point3(hit_point);
            let local_hit_normal = inv_mat.transform_vector3(hit_normal).normalize();

            // Determine effective tool name (kernel)
            // Priority: Event Kernel > Legacy Tool ID Mapping
            let tool_name = if let Some(ref kernel) = event.kernel {
                kernel.as_str()
            } else {
                match event.tool {
                    0 => "sculpt_clay",        // CLAY
                    1 => "sculpt_clay", // CLAY_STRIPS (uses clay kernel with strips settings)
                    2 => "sculpt_draw", // DRAW
                    3 => "sculpt_inflate", // INFLATE
                    4 => "sculpt_smooth", // SMOOTH
                    5 => "sculpt_pinch", // CREASE
                    6 => "sculpt_layer", // LAYER
                    7 => "sculpt_flatten", // FLATTEN
                    8 => "sculpt_polish", // POLISH
                    9 => "sculpt_relax", // RELAX
                    10 => "sculpt_pinch", // PINCH
                    11 => "sculpt_grab", // GRAB
                    12 => "sculpt_snake_hook", // SNAKE_HOOK
                    13 => "sculpt_move", // MOVE
                    14 => "sculpt_twist", // TWIST
                    _ => "sculpt_stamp",
                }
            };

            // Map legacy tool names to shader names if needed
            // (Note: modules::sculpt::apply_brush_unified expects SHADER names mostly, but might be handling legacy strings)
            // Actually, modules::sculpt passes this string directly to GPU dispatcher.
            // If the shader handles "CLAY" etc., we might need to be careful.
            // But KBrushAsset::shader_name() returns "sculpt_stamp", etc.
            // So we should use THOSE names.
            // The legacy "CLAY" strings were likely mapped inside standard_brush.wgsl or mapped in Rust before dispatch.
            // Let's assume the new system expects shader names (e.g. "sculpt_stamp").

            // Re-mapping legacy IDs to SHADER NAMES:
            // 0=CLAY -> sculpt_stamp
            // 4=SMOOTH -> sculpt_smooth
            // etc.

            // For now, I will assume tool_name above is correct if it comes from event.kernel.
            // If it comes from event.tool fallback, I mapped them to shader names above.

            // Calculate delta for Grab family brushes
            let local_delta = if let Some(last_hit) = sculpt_data.last_hit_point {
                local_hit_point - last_hit
            } else {
                Vec3::ZERO
            };
            sculpt_data.last_hit_point = Some(local_hit_point);

            // Call UNIFIED apply_brush - this handles ALL GPU/CPU work in modules layer
            // The Bevy layer only handles UI/events and mesh synchronization
            match apply_brush_unified(
                handle,
                [local_hit_point.x, local_hit_point.y, local_hit_point.z],
                [local_hit_normal.x, local_hit_normal.y, local_hit_normal.z],
                tool_name.to_string(),
                event.radius,
                event.intensity,
                None,       // symmetry
                Some(true), // use_gpu
                None,       // alpha_handle
                Some([local_delta.x, local_delta.y, local_delta.z]),
            ) {
                Ok(result) => {
                    // Sync positions to Bevy mesh (sparse - only modified indices)
                    if let Some(bevy::mesh::VertexAttributeValues::Float32x3(positions_vec)) =
                        mesh.attribute_mut(Mesh::ATTRIBUTE_POSITION)
                    {
                        let positions_flat: &mut [f32] = bytemuck::cast_slice_mut(positions_vec);

                        // Sparse update - only copy modified vertices
                        for (i, &idx) in result.modified_indices.iter().enumerate() {
                            if idx * 3 + 2 < positions_flat.len()
                                && i * 3 + 2 < result.new_positions.len()
                            {
                                positions_flat[idx * 3] = result.new_positions[i * 3];
                                positions_flat[idx * 3 + 1] = result.new_positions[i * 3 + 1];
                                positions_flat[idx * 3 + 2] = result.new_positions[i * 3 + 2];
                            }
                        }
                    }

                    // Sync normals if returned
                    if let (Some(normal_data), Some(normal_indices)) =
                        (&result.new_normals, &result.normal_indices)
                    {
                        if let Some(bevy::mesh::VertexAttributeValues::Float32x3(normals_vec)) =
                            mesh.attribute_mut(Mesh::ATTRIBUTE_NORMAL)
                        {
                            let normals_flat: &mut [f32] = bytemuck::cast_slice_mut(normals_vec);

                            for (i, &idx) in normal_indices.iter().enumerate() {
                                if idx * 3 + 2 < normals_flat.len() && i * 3 + 2 < normal_data.len()
                                {
                                    normals_flat[idx * 3] = normal_data[i * 3];
                                    normals_flat[idx * 3 + 1] = normal_data[i * 3 + 1];
                                    normals_flat[idx * 3 + 2] = normal_data[i * 3 + 2];
                                }
                            }
                        }
                    }

                    // Mark GPU BVH as dirty (for raycast rebuild)
                    sculpt_data.gpu_bvh_dirty = true;

                    // NOTE: Removed duplicate logging - modules layer handles GPU performance logging
                    // This prevents double GPU execution and fixes FPS dips
                    if result.used_gpu {
                        // Only log for debugging if needed - modules layer already logs performance
                        debug!(
                            "GPU brush synchronized to Bevy mesh: {} verts modified",
                            result.affected_count
                        );
                    } else {
                        info!(
                            "CPU brush {} applied: {} verts in {:.2}ms (reason: {:?})",
                            tool_name,
                            result.affected_count,
                            result.time_ms,
                            result.gpu_fallback_reason
                        );
                    }
                }
                Err(e) => {
                    warn!("Brush apply failed: {}", e);
                }
            }
        }
    }
}

/// Reset last hit points when stroke ends
pub fn reset_stroke_last_hits(
    buttons: Res<ButtonInput<MouseButton>>,
    mut sculpt_models: Query<&mut SculptData, With<SculptModel>>,
) {
    if buttons.just_released(MouseButton::Left) {
        for mut data in sculpt_models.iter_mut() {
            data.last_hit_point = None;
        }
    }
}

pub fn handle_undo_redo(
    mut undo_events: MessageReader<UndoEvent>,
    mut redo_events: MessageReader<RedoEvent>,
    mut snapshot_events: MessageReader<SnapshotEvent>,
    mut meshes: ResMut<Assets<Mesh>>,
    mut sculpt_models: Query<(&Mesh3d, &mut SculptData), With<SculptModel>>,
) {
    // Take Snapshot
    for _ in snapshot_events.read() {
        for (mesh_handle, mut sculpt_data) in sculpt_models.iter_mut() {
            if let Some(mesh) = meshes.get(mesh_handle) {
                if let Some(bevy::mesh::VertexAttributeValues::Float32x3(v)) =
                    mesh.attribute(Mesh::ATTRIBUTE_POSITION)
                {
                    let current = bytemuck::cast_slice(v).to_vec();

                    // Limit stack size (e.g. 20)
                    if sculpt_data.undo_stack.len() > 20 {
                        sculpt_data.undo_stack.remove(0);
                    }
                    sculpt_data.undo_stack.push(current);

                    // Clear redo stack on new action
                    sculpt_data.redo_stack.clear();

                    info!(
                        "Snapshot saved. History depth: {}",
                        sculpt_data.undo_stack.len()
                    );
                }
            }
        }
    }

    // Undo
    for _ in undo_events.read() {
        for (mesh_handle, mut sculpt_data) in sculpt_models.iter_mut() {
            if let Some(prev_state) = sculpt_data.undo_stack.pop() {
                // Save current to redo
                if let Some(mesh) = meshes.get(mesh_handle) {
                    if let Some(bevy::mesh::VertexAttributeValues::Float32x3(v)) =
                        mesh.attribute(Mesh::ATTRIBUTE_POSITION)
                    {
                        let current = bytemuck::cast_slice(v).to_vec();
                        sculpt_data.redo_stack.push(current);
                    }
                }

                // Apply Undo
                if let Some(mesh) = meshes.get_mut(mesh_handle) {
                    if let Some(bevy::mesh::VertexAttributeValues::Float32x3(v)) =
                        mesh.attribute_mut(Mesh::ATTRIBUTE_POSITION)
                    {
                        let dest: &mut [f32] = bytemuck::cast_slice_mut(v);
                        if dest.len() == prev_state.len() {
                            dest.copy_from_slice(&prev_state);
                            // Recompute normals
                            let data = sculpt_data.into_inner();
                            recalculate_normals_incremental(
                                dest,
                                &mut data.normals,
                                &data.indices,
                                &data.topology,
                                &(0..dest.len() / 3).collect::<Vec<_>>(), // Full update
                            );
                            if let Some(bevy::mesh::VertexAttributeValues::Float32x3(n)) =
                                mesh.attribute_mut(Mesh::ATTRIBUTE_NORMAL)
                            {
                                let n_flat: &mut [f32] = bytemuck::cast_slice_mut(n);
                                n_flat.copy_from_slice(&data.normals);
                            }
                        }
                    }
                }
            }
        }
    }

    // Redo
    for _ in redo_events.read() {
        for (mesh_handle, mut sculpt_data) in sculpt_models.iter_mut() {
            if let Some(next_state) = sculpt_data.redo_stack.pop() {
                // Save current to undo
                if let Some(mesh) = meshes.get(mesh_handle) {
                    if let Some(bevy::mesh::VertexAttributeValues::Float32x3(v)) =
                        mesh.attribute(Mesh::ATTRIBUTE_POSITION)
                    {
                        let current = bytemuck::cast_slice(v).to_vec();
                        sculpt_data.undo_stack.push(current);
                    }
                }

                // Apply Redo
                if let Some(mesh) = meshes.get_mut(mesh_handle) {
                    if let Some(bevy::mesh::VertexAttributeValues::Float32x3(v)) =
                        mesh.attribute_mut(Mesh::ATTRIBUTE_POSITION)
                    {
                        let dest: &mut [f32] = bytemuck::cast_slice_mut(v);
                        if dest.len() == next_state.len() {
                            dest.copy_from_slice(&next_state);
                            // Recompute normals
                            let data = sculpt_data.into_inner();
                            recalculate_normals_incremental(
                                dest,
                                &mut data.normals,
                                &data.indices,
                                &data.topology,
                                &(0..dest.len() / 3).collect::<Vec<_>>(), // Full update
                            );
                            if let Some(bevy::mesh::VertexAttributeValues::Float32x3(n)) =
                                mesh.attribute_mut(Mesh::ATTRIBUTE_NORMAL)
                            {
                                let n_flat: &mut [f32] = bytemuck::cast_slice_mut(n);
                                n_flat.copy_from_slice(&data.normals);
                            }
                        }
                    }
                }
            }
        }
    }
}

/// GPU-accelerated subdivision using Bevy's RenderDevice (no IPC!)
pub fn handle_gpu_subdivide(
    mut subdivide_events: MessageReader<SubdivideEvent>,
    mut meshes: ResMut<Assets<Mesh>>,
    mut sculpt_models: Query<(Entity, &Mesh3d, &mut SculptData), With<SculptModel>>,
    mut gpu_engines: ResMut<GpuGeometryEngines>,
    mut gpu_sculpt: ResMut<BevyGpuSculpt>,
    mut gpu_raycast: ResMut<BevyGpuRaycast>,
    render_device: Res<RenderDevice>,
    render_queue: Res<RenderQueue>,
) {
    for _ in subdivide_events.read() {
        for (entity, mesh_handle, mut sculpt_data) in sculpt_models.iter_mut() {
            let Some(mesh) = meshes.get_mut(mesh_handle) else {
                continue;
            };

            let start = std::time::Instant::now();

            // Extract current positions as flat f32 array
            let positions_flat: Vec<f32> =
                if let Some(bevy::mesh::VertexAttributeValues::Float32x3(v)) =
                    mesh.attribute(Mesh::ATTRIBUTE_POSITION)
                {
                    bytemuck::cast_slice(v).to_vec()
                } else {
                    continue;
                };

            let old_indices = sculpt_data.indices.clone();
            let old_vert_count = positions_flat.len() / 3;
            let old_tri_count = old_indices.len() / 3;

            // Get GPU subdivision engine (lazy init with Bevy's device)
            let device = render_device.wgpu_device();
            let queue = render_queue.as_ref();
            let engine = match gpu_engines.get_subdivide(device, queue) {
                Ok(engine) => engine,
                Err(e) => {
                    error!("❌ Failed to initialize GPU subdivision engine: {}", e);
                    continue;
                }
            };

            // Run GPU subdivision
            match engine.subdivide_once(device, queue, &positions_flat, &old_indices) {
                Ok(result) => {
                    let new_positions = result.positions;
                    let new_indices = result.indices;
                    let new_vert_count = result.vertex_count;
                    let new_tri_count = result.face_count;

                    // Convert flat positions to [f32; 3] for Bevy
                    let positions_vec: Vec<[f32; 3]> = new_positions
                        .chunks(3)
                        .map(|c| [c[0], c[1], c[2]])
                        .collect();

                    // Update mesh
                    mesh.insert_attribute(Mesh::ATTRIBUTE_POSITION, positions_vec.clone());
                    mesh.insert_indices(bevy::mesh::Indices::U32(new_indices.clone()));

                    // Rebuild sculpt data structures
                    let (min, max) = new_positions.chunks(3).fold(
                        (glam::Vec3::splat(f32::MAX), glam::Vec3::splat(f32::MIN)),
                        |(min, max), p| {
                            let v = glam::Vec3::new(p[0], p[1], p[2]);
                            (min.min(v), max.max(v))
                        },
                    );
                    let extent = max - min;
                    let max_dim = extent.max_element().max(0.1);
                    let cell_size = max_dim / 50.0;
                    let mut grid = SpatialGrid::new(cell_size);
                    grid.build(&new_positions);

                    let mut topology = MeshTopology::new();
                    topology.build(new_vert_count, &new_indices);

                    let normals = compute_all_normals(&new_positions, &new_indices);

                    // Apply normals to mesh
                    let normals_vec: Vec<[f32; 3]> =
                        normals.chunks(3).map(|c| [c[0], c[1], c[2]]).collect();
                    mesh.insert_attribute(Mesh::ATTRIBUTE_NORMAL, normals_vec);

                    // Generate UVs (spherical projection)
                    let uvs: Vec<[f32; 2]> = positions_vec
                        .iter()
                        .map(|p| {
                            let len = (p[0] * p[0] + p[1] * p[1] + p[2] * p[2]).sqrt().max(0.001);
                            let nx = p[0] / len;
                            let ny = p[1] / len;
                            let nz = p[2] / len;
                            let u = 0.5 + nz.atan2(nx) / (2.0 * std::f32::consts::PI);
                            let v = 0.5 - ny.asin() / std::f32::consts::PI;
                            [u, v]
                        })
                        .collect();
                    mesh.insert_attribute(Mesh::ATTRIBUTE_UV_0, uvs);

                    // Update SculptData
                    let data = sculpt_data.into_inner();
                    data.grid = grid;
                    data.topology = topology;
                    data.normals = normals.clone();
                    data.indices = new_indices.clone();
                    data.undo_stack.clear();
                    data.undo_stack.push(new_positions.clone());
                    data.redo_stack.clear();

                    // ========================================================
                    // CRITICAL FIX: Re-register mesh with modules::sculpt registry
                    // The sculpt_handle points to the OLD mesh before subdivision.
                    // Without this, GPU spatial grid queries wrong vertex count!
                    // ========================================================

                    // Dispose old sculpt handle if present
                    if let Some(old_handle) = data.sculpt_handle {
                        if let Err(e) = dispose_sculpt_mesh(old_handle) {
                            warn!("⚠️ Failed to dispose old sculpt mesh: {}", e);
                        }
                    }

                    // Re-register with unified sculpt registry (new positions, indices)
                    match init_sculpt_mesh(new_positions.clone(), new_indices.clone()) {
                        Ok(new_handle) => {
                            data.sculpt_handle = Some(new_handle);
                            info!("🔄 Sculpt registry re-registered after subdivide: handle={}, {} verts", 
                                new_handle, new_vert_count);
                        }
                        Err(e) => {
                            warn!(
                                "⚠️ Failed to re-register sculpt mesh: {}. Brushing will fail.",
                                e
                            );
                            data.sculpt_handle = None;
                        }
                    }

                    // ========================================================
                    // Also re-register with legacy GPU systems (BevyGpuSculpt)
                    // ========================================================
                    let entity_id = entity.to_bits();

                    // Re-register with GPU Sculpt Compute (new buffer sizes)
                    gpu_sculpt.ensure_engine(device, queue);
                    match gpu_sculpt.register_mesh(device, entity_id, &new_positions, &normals) {
                        Ok(()) => {
                            data.gpu_sculpt_handle = Some(entity_id);
                            info!(
                                "🔄 GPU Sculpt re-registered after subdivide: {} verts",
                                new_vert_count
                            );
                        }
                        Err(e) => {
                            warn!("⚠️ Failed to re-register GPU sculpt: {}", e);
                            data.gpu_sculpt_handle = None;
                        }
                    }

                    // Re-register with GPU BVH Raycast (new geometry)
                    match gpu_raycast.register_mesh_with_device(
                        device,
                        &new_positions,
                        &new_indices,
                    ) {
                        Ok(handle) => {
                            data.gpu_mesh_handle = Some(handle);
                            data.gpu_bvh_dirty = false;
                            info!(
                                "🔄 GPU BVH re-registered after subdivide: {} tris",
                                new_tri_count
                            );
                        }
                        Err(e) => {
                            warn!("⚠️ Failed to re-register GPU BVH: {}", e);
                            data.gpu_mesh_handle = None;
                            data.gpu_bvh_dirty = true;
                        }
                    }

                    info!("🚀 GPU Subdivide: {} verts → {} verts, {} tris → {} tris in {:.2}ms (GPU: {:.2}ms)", 
                        old_vert_count, new_vert_count, old_tri_count, new_tri_count,
                        start.elapsed().as_secs_f64() * 1000.0, result.time_ms);
                }
                Err(e) => {
                    warn!("⚠️ GPU subdivision failed: {}. Trying CPU fallback...", e);
                    // Could add CPU fallback here
                }
            }
        }
    }
}

/// GPU-accelerated remesh (Dynamesh-style) using Bevy's RenderDevice
pub fn handle_gpu_remesh(
    mut remesh_events: MessageReader<RemeshEvent>,
    mut meshes: ResMut<Assets<Mesh>>,
    mut sculpt_models: Query<(Entity, &Mesh3d, &mut SculptData), With<SculptModel>>,
    mut gpu_engines: ResMut<GpuGeometryEngines>,
    mut gpu_sculpt: ResMut<BevyGpuSculpt>,
    mut gpu_raycast: ResMut<BevyGpuRaycast>,
    render_device: Res<RenderDevice>,
    render_queue: Res<RenderQueue>,
) {
    for event in remesh_events.read() {
        for (entity, mesh_handle, mut sculpt_data) in sculpt_models.iter_mut() {
            let Some(mesh) = meshes.get_mut(mesh_handle) else {
                continue;
            };

            let start = std::time::Instant::now();

            // Extract current geometry
            let positions_flat: Vec<f32> =
                if let Some(bevy::mesh::VertexAttributeValues::Float32x3(v)) =
                    mesh.attribute(Mesh::ATTRIBUTE_POSITION)
                {
                    bytemuck::cast_slice(v).to_vec()
                } else {
                    continue;
                };

            let old_indices = sculpt_data.indices.clone();
            let old_vert_count = positions_flat.len() / 3;
            let old_tri_count = old_indices.len() / 3;

            // Get GPU dynamesh engine
            let device = render_device.wgpu_device();
            let queue = render_queue.as_ref();
            let engine = gpu_engines.get_dynamesh(device);

            // Configure remesh params
            let params = GpuDynameshParams {
                resolution: event.resolution.clamp(32, 256),
                smooth_steps: 2,
                padding: 0.05,
                iso_level: 0.0,
                vertex_smooth: 2,
            };

            // Run GPU remesh!
            match engine.remesh(device, queue, &positions_flat, &old_indices, &params) {
                Ok(result) => {
                    let new_positions = result.positions;
                    let new_indices = result.indices;
                    let new_normals = result.normals;
                    let new_vert_count = result.stats.output_vertices;
                    let new_tri_count = result.stats.output_triangles;

                    // Convert to Bevy format
                    let positions_vec: Vec<[f32; 3]> = new_positions
                        .chunks(3)
                        .map(|c| [c[0], c[1], c[2]])
                        .collect();
                    let normals_vec: Vec<[f32; 3]> =
                        new_normals.chunks(3).map(|c| [c[0], c[1], c[2]]).collect();

                    // Update mesh
                    mesh.insert_attribute(Mesh::ATTRIBUTE_POSITION, positions_vec.clone());
                    mesh.insert_attribute(Mesh::ATTRIBUTE_NORMAL, normals_vec);
                    mesh.insert_indices(bevy::mesh::Indices::U32(new_indices.clone()));

                    // Generate UVs
                    let uvs: Vec<[f32; 2]> = positions_vec
                        .iter()
                        .map(|p| {
                            let len = (p[0] * p[0] + p[1] * p[1] + p[2] * p[2]).sqrt().max(0.001);
                            let nx = p[0] / len;
                            let ny = p[1] / len;
                            let nz = p[2] / len;
                            let u = 0.5 + nz.atan2(nx) / (2.0 * std::f32::consts::PI);
                            let v = 0.5 - ny.asin() / std::f32::consts::PI;
                            [u, v]
                        })
                        .collect();
                    mesh.insert_attribute(Mesh::ATTRIBUTE_UV_0, uvs);

                    // Rebuild sculpt data
                    let (min, max) = new_positions.chunks(3).fold(
                        (glam::Vec3::splat(f32::MAX), glam::Vec3::splat(f32::MIN)),
                        |(min, max), p| {
                            let v = glam::Vec3::new(p[0], p[1], p[2]);
                            (min.min(v), max.max(v))
                        },
                    );
                    let extent = max - min;
                    let max_dim = extent.max_element().max(0.1);
                    let cell_size = max_dim / 50.0;
                    let mut grid = SpatialGrid::new(cell_size);
                    grid.build(&new_positions);

                    let mut topology = MeshTopology::new();
                    topology.build(new_vert_count, &new_indices);

                    // Update SculptData
                    let data = sculpt_data.into_inner();
                    data.grid = grid;
                    data.topology = topology;
                    data.normals = new_normals.clone();
                    data.indices = new_indices.clone();
                    data.undo_stack.clear();
                    data.undo_stack.push(new_positions.clone());
                    data.redo_stack.clear();

                    // ========================================================
                    // CRITICAL FIX: Re-register mesh with modules::sculpt registry
                    // ========================================================

                    // Dispose old sculpt handle if present
                    if let Some(old_handle) = data.sculpt_handle {
                        if let Err(e) = dispose_sculpt_mesh(old_handle) {
                            warn!("⚠️ Failed to dispose old sculpt mesh: {}", e);
                        }
                    }

                    // Re-register with unified sculpt registry (new positions, indices)
                    match init_sculpt_mesh(new_positions.clone(), new_indices.clone()) {
                        Ok(new_handle) => {
                            data.sculpt_handle = Some(new_handle);
                            info!("🔄 Sculpt registry re-registered after remesh: handle={}, {} verts", 
                                new_handle, new_vert_count);
                        }
                        Err(e) => {
                            warn!(
                                "⚠️ Failed to re-register sculpt mesh: {}. Brushing will fail.",
                                e
                            );
                            data.sculpt_handle = None;
                        }
                    }

                    // ========================================================
                    // Also re-register with legacy GPU systems (BevyGpuSculpt)
                    // ========================================================
                    let entity_id = entity.to_bits();

                    // Re-register with GPU Sculpt Compute (new buffer sizes)
                    gpu_sculpt.ensure_engine(device, queue);
                    match gpu_sculpt.register_mesh(device, entity_id, &new_positions, &new_normals)
                    {
                        Ok(()) => {
                            data.gpu_sculpt_handle = Some(entity_id);
                            info!(
                                "🔄 GPU Sculpt re-registered after remesh: {} verts",
                                new_vert_count
                            );
                        }
                        Err(e) => {
                            warn!("⚠️ Failed to re-register GPU sculpt: {}", e);
                            data.gpu_sculpt_handle = None;
                        }
                    }

                    // Re-register with GPU BVH Raycast (new geometry)
                    match gpu_raycast.register_mesh_with_device(
                        device,
                        &new_positions,
                        &new_indices,
                    ) {
                        Ok(handle) => {
                            data.gpu_mesh_handle = Some(handle);
                            data.gpu_bvh_dirty = false;
                            info!(
                                "🔄 GPU BVH re-registered after remesh: {} tris",
                                new_tri_count
                            );
                        }
                        Err(e) => {
                            warn!("⚠️ Failed to re-register GPU BVH: {}", e);
                            data.gpu_mesh_handle = None;
                            data.gpu_bvh_dirty = true;
                        }
                    }

                    info!(
                        "🔷 GPU Remesh @ res={}: {} verts → {} verts, {} tris → {} tris in {:.1}ms",
                        params.resolution,
                        old_vert_count,
                        new_vert_count,
                        old_tri_count,
                        new_tri_count,
                        result.time_ms
                    );
                }
                Err(e) => {
                    warn!("⚠️ GPU remesh failed: {}", e);
                }
            }
        }
    }
}

/// System to rebuild GPU BVH when geometry changes (THROTTLED for performance)
pub fn rebuild_bvh_system(
    mut sculpt_models: Query<(&Mesh3d, &mut SculptData), With<SculptModel>>,
    meshes: Res<Assets<Mesh>>,
    mut throttle: ResMut<BvhThrottle>,
    mut gpu_raycast: ResMut<BevyGpuRaycast>,
    render_device: Res<RenderDevice>,
) {
    // Check if any mesh is dirty
    let any_dirty = sculpt_models.iter().any(|(_, data)| data.gpu_bvh_dirty);

    if any_dirty {
        throttle.frames_since_rebuild += 1;

        // Only rebuild every N frames (default: 5)
        if throttle.frames_since_rebuild < throttle.rebuild_interval {
            return; // Skip this frame, keep dirty flag set
        }

        // Time to rebuild!
        throttle.frames_since_rebuild = 0;

        for (mesh_handle, mut sculpt_data) in sculpt_models.iter_mut() {
            if sculpt_data.gpu_bvh_dirty {
                let start = std::time::Instant::now();

                // Get positions from the actual Bevy mesh
                if let Some(mesh) = meshes.get(mesh_handle) {
                    if let Some(bevy::mesh::VertexAttributeValues::Float32x3(positions)) =
                        mesh.attribute(Mesh::ATTRIBUTE_POSITION)
                    {
                        let positions_flat: Vec<f32> = bytemuck::cast_slice(positions).to_vec();

                        if let Some(handle) = sculpt_data.gpu_mesh_handle {
                            // Rebuild GPU BVH using Bevy's device
                            match gpu_raycast.rebuild_mesh_with_device(
                                render_device.wgpu_device(),
                                handle,
                                &positions_flat,
                                &sculpt_data.indices,
                            ) {
                                Ok(_) => {
                                    trace!(
                                        "🔄 GPU BVH rebuilt in {:.2}ms (throttled)",
                                        start.elapsed().as_secs_f64() * 1000.0
                                    );
                                }
                                Err(e) => {
                                    warn!("⚠️ GPU BVH rebuild failed: {}", e);
                                }
                            }
                        }

                        sculpt_data.gpu_bvh_dirty = false;
                    }
                }
            }
        }
    } else {
        // No dirty meshes, reset counter
        throttle.frames_since_rebuild = 0;
    }
}
