//! K_OS Bevy Import System
//!
//! Asset importing for unified viewport.
//!
//! FEATURES:
//! - GLTF/GLB loading with scene hierarchy
//! - OBJ/FBX support (via bevy_gltf)
//! - Primitive spawning (cube, sphere, etc.)
//! - IPC integration for React-triggered imports
//! - Progress tracking for large assets

use super::layers::{
    LayerInfo, LayerLock, LayerObject, LayerObjectBundle, LayerVisibility, ObjectType, Selectable,
};
use bevy::prelude::*;

// =============================================================================
// COMPONENTS
// =============================================================================

/// Component for tracking loaded GLTF scenes
#[derive(Component, Debug)]
pub struct LoadedGltf {
    /// Original file path
    pub path: String,
    /// Scene index within GLTF
    pub scene_index: usize,
}

/// Component marking an entity as imported (not created in-app)
#[derive(Component, Debug)]
pub struct ImportedAsset {
    /// Original file path
    pub source_path: String,
    /// Import timestamp
    pub imported_at: f64,
}

/// Component for primitives spawned in-app
#[derive(Component, Debug)]
pub struct Primitive {
    pub primitive_type: PrimitiveType,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum PrimitiveType {
    Cube,
    Sphere,
    Cylinder,
    Plane,
    Torus,
    Cone,
    Icosphere,
    UVSphere,
}

/// Component tracking asset loading state
#[derive(Component, Debug)]
pub struct AssetLoadState {
    pub state: LoadState,
    pub progress: f32,
}

/// Marker for GLTF scenes that need child mesh processing
#[derive(Component, Debug)]
pub struct NeedsMeshDiscovery {
    /// Source path for naming
    pub source_path: String,
    /// Frames to wait for scene to fully spawn
    pub frames_remaining: u8,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum LoadState {
    Loading,
    Loaded,
    Failed,
}

// =============================================================================
// RESOURCES
// =============================================================================

/// Pending imports queue
#[derive(Resource, Default)]
pub struct ImportQueue {
    pub pending: Vec<PendingImport>,
}

#[derive(Debug, Clone)]
pub struct PendingImport {
    pub path: String,
    pub import_type: ImportType,
    pub handle: Option<Handle<Scene>>,
}

#[derive(Debug, Clone, Copy)]
pub enum ImportType {
    Gltf,
    Primitive(PrimitiveType),
}

/// Import settings resource
#[derive(Resource)]
pub struct ImportSettings {
    /// Auto-center imported models
    pub auto_center: bool,
    /// Auto-scale to fit viewport
    pub auto_scale: bool,
    /// Target size for auto-scale
    pub target_size: f32,
    /// Apply layer system components
    pub add_layer_components: bool,
    /// Flatten hierarchy (spawn each mesh as separate entity)
    pub flatten_hierarchy: bool,
}

impl Default for ImportSettings {
    fn default() -> Self {
        Self {
            auto_center: true,
            auto_scale: true,
            target_size: 2.0,
            add_layer_components: true,
            flatten_hierarchy: false,
        }
    }
}

// =============================================================================
// EVENTS (Messages in Bevy 0.17)
// =============================================================================

/// Request to import a GLTF file
#[derive(Event, Clone, Debug)]
pub struct ImportGltfEvent {
    /// File path (relative to assets or absolute)
    pub path: String,
    /// Position to spawn at
    pub position: Vec3,
}
impl Message for ImportGltfEvent {}

/// Request to spawn a primitive
#[derive(Event, Clone, Debug)]
pub struct SpawnPrimitiveEvent {
    pub primitive_type: PrimitiveType,
    pub position: Vec3,
    pub size: f32,
}
impl Message for SpawnPrimitiveEvent {}

/// Import completed notification
#[derive(Event, Clone, Debug)]
pub struct ImportCompletedEvent {
    pub entity: Entity,
    pub path: String,
    pub success: bool,
}
impl Message for ImportCompletedEvent {}

/// Load model from Leash IPC (matching existing protocol)
#[derive(Event, Clone, Debug)]
pub struct LeashLoadModelEvent {
    /// Primitive type ID (0=sphere, 1=cube, etc.)
    pub primitive_type: u8,
}
impl Message for LeashLoadModelEvent {}

// =============================================================================
// PLUGIN
// =============================================================================

pub struct ImportPlugin;

impl Plugin for ImportPlugin {
    fn build(&self, app: &mut App) {
        app
            // Resources
            .init_resource::<ImportQueue>()
            .init_resource::<ImportSettings>()
            // Messages
            .add_message::<ImportGltfEvent>()
            .add_message::<SpawnPrimitiveEvent>()
            .add_message::<ImportCompletedEvent>()
            .add_message::<LeashLoadModelEvent>()
            // Systems
            .add_systems(
                Update,
                (
                    handle_gltf_import,
                    handle_primitive_spawn,
                    handle_leash_load_model,
                    process_loaded_gltf,
                    discover_child_meshes,
                ),
            );
    }
}

// =============================================================================
// SYSTEMS
// =============================================================================

fn handle_gltf_import(
    mut events: MessageReader<ImportGltfEvent>,
    asset_server: Res<AssetServer>,
    mut import_queue: ResMut<ImportQueue>,
) {
    for event in events.read() {
        info!("Importing GLTF: {}", event.path);

        // Load the scene
        let scene_handle: Handle<Scene> = asset_server.load(format!("{}#Scene0", event.path));

        import_queue.pending.push(PendingImport {
            path: event.path.clone(),
            import_type: ImportType::Gltf,
            handle: Some(scene_handle),
        });
    }
}

fn process_loaded_gltf(
    mut commands: Commands,
    mut import_queue: ResMut<ImportQueue>,
    asset_server: Res<AssetServer>,
    settings: Res<ImportSettings>,
) {
    import_queue.pending.retain(|pending| {
        if let Some(handle) = &pending.handle {
            match asset_server.get_load_state(handle.id()) {
                Some(bevy::asset::LoadState::Loaded) => {
                    info!("GLTF loaded: {}", pending.path);

                    // Spawn the scene
                    let entity = commands
                        .spawn((
                            SceneRoot(handle.clone()),
                            Transform::default(),
                            LoadedGltf {
                                path: pending.path.clone(),
                                scene_index: 0,
                            },
                            ImportedAsset {
                                source_path: pending.path.clone(),
                                imported_at: 0.0,
                            },
                            // Mark for child mesh discovery (wait a few frames for scene to spawn)
                            NeedsMeshDiscovery {
                                source_path: pending.path.clone(),
                                frames_remaining: 3,
                            },
                        ))
                        .id();

                    // Add layer components to root if enabled
                    if settings.add_layer_components {
                        commands.entity(entity).insert(
                            LayerObjectBundle::new(&pending.path).with_type(ObjectType::Mesh),
                        );
                    }

                    info!(
                        "✅ GLTF spawned, waiting for child mesh discovery: {}",
                        pending.path
                    );

                    false // Remove from queue
                }
                Some(bevy::asset::LoadState::Failed(_)) => {
                    warn!("Failed to load GLTF: {}", pending.path);
                    false // Remove from queue
                }
                _ => true, // Keep in queue, still loading
            }
        } else {
            false
        }
    });
}

fn handle_primitive_spawn(
    mut events: MessageReader<SpawnPrimitiveEvent>,
    mut commands: Commands,
    mut meshes: ResMut<Assets<Mesh>>,
    mut materials: ResMut<Assets<StandardMaterial>>,
    settings: Res<ImportSettings>,
) {
    for event in events.read() {
        info!("Spawning primitive: {:?}", event.primitive_type);

        let mesh = create_primitive_mesh(event.primitive_type, event.size);
        let mesh_handle = meshes.add(mesh);

        let material = materials.add(StandardMaterial {
            base_color: Color::srgb(0.7, 0.7, 0.7),
            perceptual_roughness: 0.5,
            metallic: 0.0,
            ..default()
        });

        let mut entity_commands = commands.spawn((
            Mesh3d(mesh_handle),
            MeshMaterial3d(material),
            Transform::from_translation(event.position),
            Primitive {
                primitive_type: event.primitive_type,
            },
        ));

        // Add layer components if enabled
        if settings.add_layer_components {
            let name = format!("{:?}", event.primitive_type);
            entity_commands.insert(LayerObjectBundle::new(&name).with_type(ObjectType::Mesh));
        }
    }
}

fn handle_leash_load_model(
    mut events: MessageReader<LeashLoadModelEvent>,
    mut spawn_events: MessageWriter<SpawnPrimitiveEvent>,
) {
    for event in events.read() {
        let primitive_type = match event.primitive_type {
            0 => PrimitiveType::Sphere,
            1 => PrimitiveType::Cube,
            2 => PrimitiveType::Cylinder,
            3 => PrimitiveType::Torus,
            4 => PrimitiveType::Plane,
            5 => PrimitiveType::Icosphere,
            _ => PrimitiveType::Sphere,
        };

        spawn_events.write(SpawnPrimitiveEvent {
            primitive_type,
            position: Vec3::ZERO,
            size: 1.0,
        });
    }
}

// =============================================================================
// HELPERS
// =============================================================================

fn create_primitive_mesh(primitive_type: PrimitiveType, size: f32) -> Mesh {
    match primitive_type {
        PrimitiveType::Cube => Mesh::from(Cuboid::new(size, size, size)),
        PrimitiveType::Sphere | PrimitiveType::UVSphere => {
            Mesh::from(Sphere::new(size * 0.5).mesh().uv(32, 18))
        }
        PrimitiveType::Icosphere => Mesh::from(Sphere::new(size * 0.5).mesh().ico(3).unwrap()),
        PrimitiveType::Cylinder => Mesh::from(Cylinder::new(size * 0.5, size)),
        PrimitiveType::Plane => Mesh::from(Plane3d::new(Vec3::Y, Vec2::splat(size))),
        PrimitiveType::Torus => Mesh::from(Torus::new(size * 0.25, size * 0.5)),
        PrimitiveType::Cone => Mesh::from(Cone::new(size * 0.5, size)),
    }
}

/// Spawn a primitive with full layer integration
pub fn spawn_primitive(
    commands: &mut Commands,
    meshes: &mut Assets<Mesh>,
    materials: &mut Assets<StandardMaterial>,
    primitive_type: PrimitiveType,
    position: Vec3,
    size: f32,
) -> Entity {
    let mesh = create_primitive_mesh(primitive_type, size);
    let mesh_handle = meshes.add(mesh);

    let material = materials.add(StandardMaterial {
        base_color: Color::srgb(0.8, 0.8, 0.8),
        perceptual_roughness: 0.5,
        ..default()
    });

    let name = format!("{:?}", primitive_type);

    commands
        .spawn((
            Mesh3d(mesh_handle),
            MeshMaterial3d(material),
            Transform::from_translation(position),
            Primitive { primitive_type },
            LayerObjectBundle::new(&name).with_type(ObjectType::Mesh),
        ))
        .id()
}

// =============================================================================
// POST-IMPORT MESH DISCOVERY
// =============================================================================

/// Discovers all child meshes in imported GLTF scenes and makes them selectable/sculptable
/// This runs after scene spawning is complete (waits a few frames)
fn discover_child_meshes(
    mut commands: Commands,
    mut discovery_query: Query<(Entity, &mut NeedsMeshDiscovery)>,
    children_query: Query<&Children>,
    mesh_query: Query<(Entity, Option<&Name>), (With<Mesh3d>, Without<Selectable>)>,
    mesh_assets: Res<Assets<Mesh>>,
    mesh_handles: Query<&Mesh3d>,
    mut transform_query: Query<&mut Transform>,
    global_transforms: Query<&GlobalTransform>,
    settings: Res<ImportSettings>,
) {
    for (root_entity, mut discovery) in discovery_query.iter_mut() {
        // Wait for scene to fully spawn
        if discovery.frames_remaining > 0 {
            discovery.frames_remaining -= 1;
            continue;
        }

        // Collect all descendant entities with Mesh3d
        let mut mesh_entities: Vec<(Entity, Option<String>)> = Vec::new();
        collect_mesh_descendants(
            root_entity,
            &children_query,
            &mesh_query,
            &mut mesh_entities,
        );

        // Keep a copy for bounding box computation
        let all_mesh_entities: Vec<(Entity, Option<String>)> = mesh_entities.clone();
        let mesh_count = mesh_entities.len();

        if mesh_count == 0 {
            warn!("⚠️ No meshes found in GLTF: {}", discovery.source_path);
        } else {
            info!(
                "🔍 Discovered {} meshes in GLTF: {}",
                mesh_count, discovery.source_path
            );
        }

        // Add Selectable and layer components to each mesh
        for (i, (mesh_entity, name)) in mesh_entities.into_iter().enumerate() {
            let mesh_name = name.unwrap_or_else(|| format!("Mesh_{}", i));
            let display_name = format!(
                "{} - {}",
                discovery.source_path.split('/').last().unwrap_or("Import"),
                mesh_name
            );

            // Get vertex count for logging
            let vert_count = mesh_handles
                .get(mesh_entity)
                .ok()
                .and_then(|h| mesh_assets.get(h))
                .and_then(|m| m.attribute(Mesh::ATTRIBUTE_POSITION))
                .map(|attr| attr.len())
                .unwrap_or(0);

            info!("  📦 {} ({} verts) -> Selectable", display_name, vert_count);

            commands.entity(mesh_entity).insert((
                Selectable::default(),
                LayerObject,
                LayerInfo {
                    name: display_name,
                    order: i as i32,
                    color: Color::srgb(0.2, 0.6, 1.0),
                    id: rand::random(),
                },
                LayerVisibility {
                    visible: true,
                    solo: false,
                    hidden_by_solo: false,
                },
                LayerLock::default(),
            ));
        }

        // Remove the discovery marker - we're done
        commands.entity(root_entity).remove::<NeedsMeshDiscovery>();

        // ============================================
        // AUTO-CENTER / AUTO-SCALE
        // ============================================
        if mesh_count > 0 && (settings.auto_center || settings.auto_scale) {
            // Compute bounding box from all meshes
            let mut min_bound = Vec3::splat(f32::MAX);
            let mut max_bound = Vec3::splat(f32::MIN);

            for (mesh_entity, _) in all_mesh_entities.iter() {
                if let Ok(mesh_handle) = mesh_handles.get(*mesh_entity) {
                    if let Some(mesh) = mesh_assets.get(mesh_handle) {
                        if let Some(positions) = mesh.attribute(Mesh::ATTRIBUTE_POSITION) {
                            if let bevy::mesh::VertexAttributeValues::Float32x3(verts) = positions {
                                // Get global transform for this mesh
                                let gtf = global_transforms
                                    .get(*mesh_entity)
                                    .map(|g| g.compute_transform())
                                    .unwrap_or_default();
                                for v in verts {
                                    let world_pos =
                                        gtf.transform_point(Vec3::new(v[0], v[1], v[2]));
                                    min_bound = min_bound.min(world_pos);
                                    max_bound = max_bound.max(world_pos);
                                }
                            }
                        }
                    }
                }
            }

            if min_bound.x < f32::MAX {
                let center = (min_bound + max_bound) * 0.5;
                let extent = max_bound - min_bound;
                let max_extent = extent.max_element().max(0.001);

                if let Ok(mut root_tf) = transform_query.get_mut(root_entity) {
                    if settings.auto_center {
                        root_tf.translation -= center;
                        info!("📍 Auto-centered model (offset {:?})", center);
                    }
                    if settings.auto_scale {
                        let scale_factor = settings.target_size / max_extent;
                        root_tf.scale = Vec3::splat(scale_factor);
                        info!("📏 Auto-scaled model (factor {:.3})", scale_factor);
                    }
                }
            }
        }

        info!(
            "✅ GLTF import complete: {} ({} sculptable meshes)",
            discovery.source_path, mesh_count
        );
    }
}

/// Recursively collect all descendant entities with Mesh3d component
fn collect_mesh_descendants(
    entity: Entity,
    children_query: &Query<&Children>,
    mesh_query: &Query<(Entity, Option<&Name>), (With<Mesh3d>, Without<Selectable>)>,
    results: &mut Vec<(Entity, Option<String>)>,
) {
    // Check if this entity has a mesh
    if let Ok((mesh_entity, name)) = mesh_query.get(entity) {
        results.push((mesh_entity, name.map(|n| n.to_string())));
    }

    // Recurse into children
    if let Ok(children) = children_query.get(entity) {
        for child in children.iter() {
            collect_mesh_descendants(child, children_query, mesh_query, results);
        }
    }
}
