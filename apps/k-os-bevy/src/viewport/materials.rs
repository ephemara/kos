//! K_OS Bevy Material System
//!
//! Material management for unified viewport.
//!
//! FEATURES:
//! - Material library (synced with kernel materials)
//! - Matcap support
//! - PBR material editing
//! - Material assignment IPC
//! - Preview thumbnails

pub mod brush_cursor;

use bevy::prelude::*;

// =============================================================================
// COMPONENTS
// =============================================================================

/// Marker for K_OS managed materials
#[derive(Component, Debug)]
pub struct KMaterial;

/// Reference to kernel material for IPC sync
#[derive(Component, Debug, Clone)]
pub struct KernelMaterialSync {
    /// Kernel material ID from React side
    pub kernel_id: String,
    /// Last sync timestamp
    pub last_sync: f64,
}

/// Matcap material data
#[derive(Component, Debug)]
pub struct MatcapMaterial {
    /// Matcap texture handle
    pub texture: Handle<Image>,
    /// Matcap name
    pub name: String,
}

/// Display mode override
#[derive(Component, Debug, Clone, Copy, PartialEq)]
pub enum DisplayMode {
    /// Full PBR
    Rendered,
    /// Solid color
    Solid,
    /// Matcap shading
    Matcap,
    /// Wireframe overlay
    Wireframe,
    /// Flat shading (faceted)
    Flat,
}

impl Default for DisplayMode {
    fn default() -> Self {
        Self::Rendered
    }
}

// =============================================================================
// RESOURCES
// =============================================================================

/// Material library
#[derive(Resource, Default)]
pub struct MaterialLibrary {
    /// Named materials
    pub materials: Vec<MaterialEntry>,
    /// Default material handle
    pub default_material: Option<Handle<StandardMaterial>>,
    /// Current active material for new objects
    pub active_material: Option<Handle<StandardMaterial>>,
}

#[derive(Debug, Clone)]
pub struct MaterialEntry {
    pub name: String,
    pub handle: Handle<StandardMaterial>,
    pub kernel_id: Option<String>,
}

/// Matcap library
#[derive(Resource, Default)]
pub struct MatcapLibrary {
    pub matcaps: Vec<MatcapEntry>,
    pub active_matcap: Option<Handle<Image>>,
}

#[derive(Debug, Clone)]
pub struct MatcapEntry {
    pub name: String,
    pub handle: Handle<Image>,
}

/// Global display mode override
#[derive(Resource, Default)]
pub struct GlobalDisplayMode {
    pub mode: DisplayMode,
    /// Show wireframe overlay
    pub show_wireframe: bool,
    /// Wireframe color
    pub wireframe_color: Color,
}

// =============================================================================
// EVENTS (Messages in Bevy 0.17)
// =============================================================================

/// Request to create a new material
#[derive(Event, Clone, Debug)]
pub struct CreateMaterialEvent {
    pub name: String,
    pub base_color: Color,
    pub roughness: f32,
    pub metallic: f32,
}
impl Message for CreateMaterialEvent {}

/// Request to update material properties
#[derive(Event, Clone, Debug)]
pub struct UpdateMaterialEvent {
    pub handle: Handle<StandardMaterial>,
    pub base_color: Option<Color>,
    pub roughness: Option<f32>,
    pub metallic: Option<f32>,
    pub emissive: Option<Color>,
}
impl Message for UpdateMaterialEvent {}

/// Request to assign material to entity
#[derive(Event, Clone, Debug)]
pub struct AssignMaterialToEntityEvent {
    pub entity: Entity,
    pub material: Handle<StandardMaterial>,
}
impl Message for AssignMaterialToEntityEvent {}

/// Request to set global display mode
#[derive(Event, Clone, Debug)]
pub struct SetDisplayModeEvent(pub DisplayMode);
impl Message for SetDisplayModeEvent {}

/// Request to toggle wireframe
#[derive(Event, Clone, Debug)]
pub struct ToggleWireframeEvent;
impl Message for ToggleWireframeEvent {}

/// Sync material from React kernel
#[derive(Event, Clone, Debug)]
pub struct SyncKernelMaterialEvent {
    pub kernel_id: String,
    pub name: String,
    pub base_color: [f32; 4],
    pub roughness: f32,
    pub metallic: f32,
}
impl Message for SyncKernelMaterialEvent {}

// =============================================================================
// PLUGIN
// =============================================================================

pub struct MaterialPlugin;

impl Plugin for MaterialPlugin {
    fn build(&self, app: &mut App) {
        app
            // Resources
            .init_resource::<MaterialLibrary>()
            .init_resource::<MatcapLibrary>()
            .init_resource::<GlobalDisplayMode>()
            // Messages
            .add_message::<CreateMaterialEvent>()
            .add_message::<UpdateMaterialEvent>()
            .add_message::<AssignMaterialToEntityEvent>()
            .add_message::<SetDisplayModeEvent>()
            .add_message::<ToggleWireframeEvent>()
            .add_message::<SyncKernelMaterialEvent>()
            // Systems
            .add_systems(Startup, setup_default_materials)
            .add_systems(
                Update,
                (
                    handle_create_material,
                    handle_update_material,
                    handle_assign_material,
                    handle_display_mode,
                    handle_kernel_sync,
                ),
            );
    }
}

// =============================================================================
// SYSTEMS
// =============================================================================

fn setup_default_materials(
    mut materials: ResMut<Assets<StandardMaterial>>,
    mut library: ResMut<MaterialLibrary>,
) {
    // Default gray material
    let default_mat = materials.add(StandardMaterial {
        base_color: Color::srgb(0.7, 0.7, 0.7),
        perceptual_roughness: 0.5,
        metallic: 0.0,
        ..default()
    });

    library.default_material = Some(default_mat.clone());
    library.active_material = Some(default_mat.clone());
    library.materials.push(MaterialEntry {
        name: "Default".to_string(),
        handle: default_mat.clone(),
        kernel_id: None,
    });

    // Clay material (for sculpting)
    let clay_mat = materials.add(StandardMaterial {
        base_color: Color::srgb(0.85, 0.75, 0.65),
        perceptual_roughness: 0.8,
        metallic: 0.0,
        ..default()
    });

    library.materials.push(MaterialEntry {
        name: "Clay".to_string(),
        handle: clay_mat,
        kernel_id: None,
    });

    // Metal material
    let metal_mat = materials.add(StandardMaterial {
        base_color: Color::srgb(0.9, 0.9, 0.9),
        perceptual_roughness: 0.2,
        metallic: 1.0,
        ..default()
    });

    library.materials.push(MaterialEntry {
        name: "Metal".to_string(),
        handle: metal_mat,
        kernel_id: None,
    });

    info!(
        "Material library initialized with {} materials",
        library.materials.len()
    );
}

fn handle_create_material(
    mut events: MessageReader<CreateMaterialEvent>,
    mut materials: ResMut<Assets<StandardMaterial>>,
    mut library: ResMut<MaterialLibrary>,
) {
    for event in events.read() {
        let mat = materials.add(StandardMaterial {
            base_color: event.base_color,
            perceptual_roughness: event.roughness,
            metallic: event.metallic,
            ..default()
        });

        library.materials.push(MaterialEntry {
            name: event.name.clone(),
            handle: mat.clone(),
            kernel_id: None,
        });

        info!("Created material: {}", event.name);
    }
}

fn handle_update_material(
    mut events: MessageReader<UpdateMaterialEvent>,
    mut materials: ResMut<Assets<StandardMaterial>>,
) {
    for event in events.read() {
        if let Some(mat) = materials.get_mut(&event.handle) {
            if let Some(color) = event.base_color {
                mat.base_color = color;
            }
            if let Some(roughness) = event.roughness {
                mat.perceptual_roughness = roughness;
            }
            if let Some(metallic) = event.metallic {
                mat.metallic = metallic;
            }
            if let Some(emissive) = event.emissive {
                mat.emissive = emissive.to_linear();
            }
        }
    }
}

fn handle_assign_material(
    mut events: MessageReader<AssignMaterialToEntityEvent>,
    mut commands: Commands,
    query: Query<Entity, With<Mesh3d>>,
) {
    for event in events.read() {
        if query.contains(event.entity) {
            commands
                .entity(event.entity)
                .insert(MeshMaterial3d(event.material.clone()));
            info!("Assigned material to {:?}", event.entity);
        }
    }
}

fn handle_display_mode(
    mut events: MessageReader<SetDisplayModeEvent>,
    mut toggle_events: MessageReader<ToggleWireframeEvent>,
    mut global_mode: ResMut<GlobalDisplayMode>,
) {
    for event in events.read() {
        global_mode.mode = event.0;
        info!("Display mode set to {:?}", event.0);
    }

    for _ in toggle_events.read() {
        global_mode.show_wireframe = !global_mode.show_wireframe;
        info!("Wireframe: {}", global_mode.show_wireframe);
    }
}

fn handle_kernel_sync(
    mut events: MessageReader<SyncKernelMaterialEvent>,
    mut materials: ResMut<Assets<StandardMaterial>>,
    mut library: ResMut<MaterialLibrary>,
) {
    for event in events.read() {
        // Check if material already exists
        let existing = library
            .materials
            .iter_mut()
            .find(|m| m.kernel_id.as_ref() == Some(&event.kernel_id));

        if let Some(entry) = existing {
            // Update existing
            if let Some(mat) = materials.get_mut(&entry.handle) {
                mat.base_color = Color::srgba(
                    event.base_color[0],
                    event.base_color[1],
                    event.base_color[2],
                    event.base_color[3],
                );
                mat.perceptual_roughness = event.roughness;
                mat.metallic = event.metallic;
            }
            entry.name = event.name.clone();
        } else {
            // Create new
            let mat = materials.add(StandardMaterial {
                base_color: Color::srgba(
                    event.base_color[0],
                    event.base_color[1],
                    event.base_color[2],
                    event.base_color[3],
                ),
                perceptual_roughness: event.roughness,
                metallic: event.metallic,
                ..default()
            });

            library.materials.push(MaterialEntry {
                name: event.name.clone(),
                handle: mat,
                kernel_id: Some(event.kernel_id.clone()),
            });
        }

        info!("Synced kernel material: {}", event.name);
    }
}

// =============================================================================
// HELPERS
// =============================================================================

/// Get material by name from library
pub fn get_material_by_name(
    library: &MaterialLibrary,
    name: &str,
) -> Option<Handle<StandardMaterial>> {
    library
        .materials
        .iter()
        .find(|m| m.name == name)
        .map(|m| m.handle.clone())
}

/// Get material by kernel ID
pub fn get_material_by_kernel_id(
    library: &MaterialLibrary,
    kernel_id: &str,
) -> Option<Handle<StandardMaterial>> {
    library
        .materials
        .iter()
        .find(|m| m.kernel_id.as_ref() == Some(&kernel_id.to_string()))
        .map(|m| m.handle.clone())
}
