//! K_OS Bevy Layer System
//!
//! Blender-style layer/object management for unified viewport.
//!
//! FEATURES:
//! - Layer hierarchy (like Blender's outliner)
//! - Per-layer visibility, lock, solo
//! - Material assignments per object
//! - Selection state
//! - Layer ordering/reordering

use bevy::prelude::*;

// =============================================================================
// COMPONENTS
// =============================================================================

/// Marker component for objects managed by the layer system
#[derive(Component, Debug, Default)]
pub struct LayerObject;

/// Layer metadata - the "layer" an object belongs to
#[derive(Component, Debug, Clone)]
pub struct LayerInfo {
    /// Display name in UI
    pub name: String,
    /// Layer index for ordering
    pub order: i32,
    /// Layer color for UI wireframe/selection
    pub color: Color,
    /// UUID for IPC reference
    pub id: u64,
}

impl Default for LayerInfo {
    fn default() -> Self {
        Self {
            name: "Object".to_string(),
            order: 0,
            color: Color::srgb(1.0, 1.0, 1.0),
            id: rand::random(),
        }
    }
}

/// Visibility state - separate from Bevy's Visibility for layer logic
#[derive(Component, Debug, Default)]
pub struct LayerVisibility {
    /// User toggled visible
    pub visible: bool,
    /// Layer is in solo mode (only this shows)
    pub solo: bool,
    /// Hidden by another layer's solo
    pub hidden_by_solo: bool,
}

/// Lock state - prevents modifications
#[derive(Component, Debug, Default)]
pub struct LayerLock {
    /// Fully locked (no select, no transform, no edit)
    pub locked: bool,
    /// Transform only locked (can still edit mesh)
    pub transform_locked: bool,
}

/// Selection state
#[derive(Component, Debug, Default)]
pub struct Selectable {
    /// Currently selected
    pub selected: bool,
    /// Part of multi-selection
    pub multi_selected: bool,
    /// Hovered by cursor
    pub hovered: bool,
}

/// Active object marker (the one receiving edits)
#[derive(Component, Debug)]
pub struct ActiveObject;

/// Parent layer reference (for hierarchy)
#[derive(Component, Debug)]
pub struct ParentLayer(pub Entity);

/// Child layers/objects
#[derive(Component, Debug, Default)]
pub struct ChildLayers(pub Vec<Entity>);

// =============================================================================
// MATERIAL ASSIGNMENT
// =============================================================================

/// Material slot assignment for an object
#[derive(Component, Debug)]
pub struct MaterialSlots {
    /// List of material handles per slot
    pub slots: Vec<Handle<StandardMaterial>>,
    /// Active slot index for editing
    pub active_slot: usize,
}

impl Default for MaterialSlots {
    fn default() -> Self {
        Self {
            slots: vec![],
            active_slot: 0,
        }
    }
}

/// Reference to a K_OS kernel material (for IPC sync)
#[derive(Component, Debug)]
pub struct KernelMaterialRef {
    /// Kernel material ID from React side
    pub kernel_id: String,
}

// =============================================================================
// OBJECT TYPES
// =============================================================================

/// What type of object this is
#[derive(Component, Debug, Clone, PartialEq)]
pub enum ObjectType {
    Mesh,
    Light,
    Camera,
    Empty,
    Curve,
    Armature,
    Group,
}

impl Default for ObjectType {
    fn default() -> Self {
        Self::Mesh
    }
}

// =============================================================================
// RESOURCES
// =============================================================================

/// Global layer system state
#[derive(Resource, Default)]
pub struct LayerSystemState {
    /// Currently active layer (for new object creation)
    pub active_layer: Option<Entity>,
    /// Solo mode active (any layer in solo)
    pub solo_active: bool,
    /// Next layer order index
    pub next_order: i32,
    /// Layer ID counter
    pub next_id: u64,
}

/// Selection state resource
#[derive(Resource, Default)]
pub struct SelectionState {
    /// Primary selected entity
    pub primary: Option<Entity>,
    /// Multi-selection set
    pub selection: Vec<Entity>,
    /// Last clicked entity (for shift-click range)
    pub last_clicked: Option<Entity>,
}

// =============================================================================
// EVENTS (Messages in Bevy 0.17)
// =============================================================================

/// Request to create a new layer
#[derive(Event, Clone, Debug)]
pub struct CreateLayerEvent {
    pub name: String,
    pub parent: Option<Entity>,
}
impl Message for CreateLayerEvent {}

/// Request to delete a layer
#[derive(Event, Clone, Debug)]
pub struct DeleteLayerEvent(pub Entity);
impl Message for DeleteLayerEvent {}

/// Request to select an object
#[derive(Event, Clone, Debug)]
pub struct SelectObjectEvent {
    pub entity: Entity,
    pub add_to_selection: bool,
}
impl Message for SelectObjectEvent {}

/// Request to deselect all
#[derive(Event, Clone, Debug)]
pub struct DeselectAllEvent;
impl Message for DeselectAllEvent {}

/// Request to toggle visibility
#[derive(Event, Clone, Debug)]
pub struct ToggleVisibilityEvent(pub Entity);
impl Message for ToggleVisibilityEvent {}

/// Request to toggle lock
#[derive(Event, Clone, Debug)]
pub struct ToggleLockEvent(pub Entity);
impl Message for ToggleLockEvent {}

/// Request to set active object
#[derive(Event, Clone, Debug)]
pub struct SetActiveObjectEvent(pub Entity);
impl Message for SetActiveObjectEvent {}

/// Request to assign material to slot
#[derive(Event, Clone, Debug)]
pub struct AssignMaterialEvent {
    pub entity: Entity,
    pub slot: usize,
    pub material: Handle<StandardMaterial>,
}
impl Message for AssignMaterialEvent {}

/// Layer data changed (notify React)
#[derive(Event, Clone, Debug)]
pub struct LayerDataChangedEvent {
    pub entity: Entity,
    pub name: String,
    pub visible: bool,
    pub locked: bool,
}
impl Message for LayerDataChangedEvent {}

// =============================================================================
// PLUGIN
// =============================================================================

pub struct LayerPlugin;

impl Plugin for LayerPlugin {
    fn build(&self, app: &mut App) {
        app
            // Resources
            .init_resource::<LayerSystemState>()
            .init_resource::<SelectionState>()
            // Messages
            .add_message::<CreateLayerEvent>()
            .add_message::<DeleteLayerEvent>()
            .add_message::<SelectObjectEvent>()
            .add_message::<DeselectAllEvent>()
            .add_message::<ToggleVisibilityEvent>()
            .add_message::<ToggleLockEvent>()
            .add_message::<SetActiveObjectEvent>()
            .add_message::<AssignMaterialEvent>()
            .add_message::<LayerDataChangedEvent>()
            // Systems
            .add_systems(
                Update,
                (
                    handle_selection,
                    handle_visibility_toggle,
                    handle_lock_toggle,
                    handle_active_object,
                    sync_visibility_to_bevy,
                ),
            );
    }
}

// =============================================================================
// SYSTEMS
// =============================================================================

fn handle_selection(
    mut events: MessageReader<SelectObjectEvent>,
    mut deselect_events: MessageReader<DeselectAllEvent>,
    mut selection_state: ResMut<SelectionState>,
    mut query: Query<&mut Selectable>,
) {
    // Handle deselect all
    for _ in deselect_events.read() {
        for mut selectable in query.iter_mut() {
            selectable.selected = false;
            selectable.multi_selected = false;
        }
        selection_state.primary = None;
        selection_state.selection.clear();
    }

    // Handle selection
    for event in events.read() {
        if !event.add_to_selection {
            // Clear previous selection
            for mut selectable in query.iter_mut() {
                selectable.selected = false;
                selectable.multi_selected = false;
            }
            selection_state.selection.clear();
        }

        if let Ok(mut selectable) = query.get_mut(event.entity) {
            selectable.selected = true;
            if event.add_to_selection {
                selectable.multi_selected = true;
                selection_state.selection.push(event.entity);
            } else {
                selection_state.primary = Some(event.entity);
                selection_state.selection = vec![event.entity];
            }
        }
    }
}

fn handle_visibility_toggle(
    mut events: MessageReader<ToggleVisibilityEvent>,
    mut query: Query<&mut LayerVisibility>,
) {
    for event in events.read() {
        if let Ok(mut vis) = query.get_mut(event.0) {
            vis.visible = !vis.visible;
            info!("Toggled visibility for {:?}: {}", event.0, vis.visible);
        }
    }
}

fn handle_lock_toggle(
    mut events: MessageReader<ToggleLockEvent>,
    mut query: Query<&mut LayerLock>,
) {
    for event in events.read() {
        if let Ok(mut lock) = query.get_mut(event.0) {
            lock.locked = !lock.locked;
            info!("Toggled lock for {:?}: {}", event.0, lock.locked);
        }
    }
}

fn handle_active_object(
    mut events: MessageReader<SetActiveObjectEvent>,
    mut commands: Commands,
    current_active: Query<Entity, With<ActiveObject>>,
) {
    for event in events.read() {
        // Remove ActiveObject from previous
        for entity in current_active.iter() {
            commands.entity(entity).remove::<ActiveObject>();
        }
        // Add to new
        commands.entity(event.0).insert(ActiveObject);
        info!("Set active object: {:?}", event.0);
    }
}

fn sync_visibility_to_bevy(
    query: Query<(Entity, &LayerVisibility), Changed<LayerVisibility>>,
    mut visibility_query: Query<&mut Visibility>,
) {
    for (entity, layer_vis) in query.iter() {
        if let Ok(mut vis) = visibility_query.get_mut(entity) {
            *vis = if layer_vis.visible && !layer_vis.hidden_by_solo {
                Visibility::Inherited
            } else {
                Visibility::Hidden
            };
        }
    }
}

// =============================================================================
// SPAWN HELPERS
// =============================================================================

/// Bundle for spawning a layer-managed object
#[derive(Bundle, Default)]
pub struct LayerObjectBundle {
    pub layer_object: LayerObject,
    pub layer_info: LayerInfo,
    pub visibility_state: LayerVisibility,
    pub lock_state: LayerLock,
    pub selectable: Selectable,
    pub object_type: ObjectType,
    pub material_slots: MaterialSlots,
}

impl LayerObjectBundle {
    pub fn new(name: &str) -> Self {
        Self {
            layer_info: LayerInfo {
                name: name.to_string(),
                ..default()
            },
            visibility_state: LayerVisibility {
                visible: true,
                ..default()
            },
            ..default()
        }
    }

    pub fn with_type(mut self, obj_type: ObjectType) -> Self {
        self.object_type = obj_type;
        self
    }

    pub fn with_color(mut self, color: Color) -> Self {
        self.layer_info.color = color;
        self
    }
}

// =============================================================================
// LAYER SYNC FOR REACT (JSON file-based IPC)
// =============================================================================

use serde::Serialize;
use std::time::Duration;

/// Timer for periodic layer sync to file
#[derive(Resource)]
pub struct LayerSyncTimer(pub Timer);

impl Default for LayerSyncTimer {
    fn default() -> Self {
        // Sync every 100ms (10Hz)
        Self(Timer::from_seconds(0.1, TimerMode::Repeating))
    }
}

/// Serializable layer data for React
#[derive(Serialize)]
pub struct LayerSnapshot {
    pub entity: u32,
    pub name: String,
    pub order: i32,
    pub visible: bool,
    pub locked: bool,
    pub selected: bool,
    pub object_type: String,
    pub poly_count: Option<u32>,
    pub has_material: bool,
}

/// System that periodically writes layer state to a temp JSON file
pub fn sync_layers_to_file(
    time: Res<Time>,
    mut timer: ResMut<LayerSyncTimer>,
    selection_state: Res<SelectionState>,
    query: Query<(
        Entity,
        &LayerInfo,
        &LayerVisibility,
        &LayerLock,
        &Selectable,
        &ObjectType,
        Option<&MaterialSlots>,
    )>,
) {
    timer.0.tick(time.delta());

    if !timer.0.just_finished() {
        return;
    }

    // Build layer snapshots
    let mut layers: Vec<LayerSnapshot> = query
        .iter()
        .map(|(entity, info, vis, lock, sel, obj_type, mats)| {
            LayerSnapshot {
                entity: entity.index(),
                name: info.name.clone(),
                order: info.order,
                visible: vis.visible && !vis.hidden_by_solo,
                locked: lock.locked,
                selected: sel.selected || selection_state.primary == Some(entity),
                object_type: match obj_type {
                    ObjectType::Mesh => "mesh",
                    ObjectType::Light => "light",
                    ObjectType::Camera => "camera",
                    ObjectType::Armature => "armature",
                    ObjectType::Empty => "empty",
                    ObjectType::Curve => "curve",
                    ObjectType::Group => "group",
                }
                .to_string(),
                poly_count: None, // TODO: query mesh if needed
                has_material: mats.map(|m| !m.slots.is_empty()).unwrap_or(false),
            }
        })
        .collect();

    // Sort by order
    layers.sort_by_key(|l| l.order);

    // Write to temp file
    let path = std::env::temp_dir().join("kos_layers.json");
    if let Ok(json) = serde_json::to_string(&layers) {
        let _ = std::fs::write(&path, json);
    }
}

/// Plugin that adds layer sync to file
pub struct LayerSyncPlugin;

impl Plugin for LayerSyncPlugin {
    fn build(&self, app: &mut App) {
        app.init_resource::<LayerSyncTimer>()
            .add_systems(Update, sync_layers_to_file);
    }
}
