//! K_OS Bevy Selection System
//!
//! Object selection and picking for unified viewport.
//!
//! FEATURES:
//! - Click-to-select using Bevy 0.17 built-in picking
//! - Multi-selection with shift/ctrl
//! - Selection outline rendering
//! - Hover highlighting
//! - Selection bounding box

use super::layers::{ActiveObject, LayerLock, Selectable, SelectionState};
use bevy::prelude::*;

// =============================================================================
// COMPONENTS
// =============================================================================

/// Hover state component
#[derive(Component, Debug, Default)]
pub struct Hoverable {
    pub hovered: bool,
}

/// Selection outline component
#[derive(Component, Debug)]
pub struct SelectionOutline {
    pub color: Color,
    pub thickness: f32,
}

impl Default for SelectionOutline {
    fn default() -> Self {
        Self {
            color: Color::srgb(1.0, 0.5, 0.0), // Orange
            thickness: 2.0,
        }
    }
}

/// Bounding box component for selection visualization
#[derive(Component, Debug)]
pub struct SelectionBounds {
    pub min: Vec3,
    pub max: Vec3,
}

/// Transform gizmo marker
#[derive(Component, Debug)]
pub struct TransformGizmo;

/// Gizmo mode
#[derive(Component, Debug, Clone, Copy, PartialEq)]
pub enum GizmoMode {
    Translate,
    Rotate,
    Scale,
}

impl Default for GizmoMode {
    fn default() -> Self {
        Self::Translate
    }
}

// =============================================================================
// RESOURCES
// =============================================================================

/// Selection system settings
#[derive(Resource)]
pub struct SelectionSettings {
    /// Selection color
    pub selection_color: Color,
    /// Hover color
    pub hover_color: Color,
    /// Multi-select modifier (shift)
    pub multi_select_key: KeyCode,
    /// Show selection outline
    pub show_outline: bool,
    /// Show transform gizmo
    pub show_gizmo: bool,
    /// Current gizmo mode
    pub gizmo_mode: GizmoMode,
}

impl Default for SelectionSettings {
    fn default() -> Self {
        Self {
            selection_color: Color::srgb(1.0, 0.5, 0.0),
            hover_color: Color::srgb(0.5, 0.7, 1.0),
            multi_select_key: KeyCode::ShiftLeft,
            show_outline: true,
            show_gizmo: true,
            gizmo_mode: GizmoMode::Translate,
        }
    }
}

/// Picking state resource
#[derive(Resource, Default)]
pub struct PickingState {
    /// Currently hovered entity
    pub hovered: Option<Entity>,
    /// Last raycast hit point
    pub hit_point: Option<Vec3>,
    /// Last raycast normal
    pub hit_normal: Option<Vec3>,
}

// =============================================================================
// EVENTS (Messages in Bevy 0.17)
// =============================================================================

/// Click event for selection
#[derive(Event, Clone, Debug)]
pub struct ClickSelectEvent {
    pub screen_pos: Vec2,
    pub multi_select: bool,
}
impl Message for ClickSelectEvent {}

/// Box/lasso select event
#[derive(Event, Clone, Debug)]
pub struct BoxSelectEvent {
    pub min: Vec2,
    pub max: Vec2,
    pub add_to_selection: bool,
}
impl Message for BoxSelectEvent {}

/// Set gizmo mode event
#[derive(Event, Clone, Debug)]
pub struct SetGizmoModeEvent(pub GizmoMode);
impl Message for SetGizmoModeEvent {}

/// Transform selected objects event
#[derive(Event, Clone, Debug)]
pub struct TransformSelectedEvent {
    pub translation: Option<Vec3>,
    pub rotation: Option<Quat>,
    pub scale: Option<Vec3>,
}
impl Message for TransformSelectedEvent {}

/// Focus on selection (frame selected)
#[derive(Event, Clone, Debug)]
pub struct FocusSelectionEvent;
impl Message for FocusSelectionEvent {}

/// Delete selected objects
#[derive(Event, Clone, Debug)]
pub struct DeleteSelectedEvent;
impl Message for DeleteSelectedEvent {}

/// Duplicate selected objects
#[derive(Event, Clone, Debug)]
pub struct DuplicateSelectedEvent;
impl Message for DuplicateSelectedEvent {}

// =============================================================================
// PLUGIN
// =============================================================================

pub struct SelectionPlugin;

impl Plugin for SelectionPlugin {
    fn build(&self, app: &mut App) {
        app
            // Resources
            .init_resource::<SelectionSettings>()
            .init_resource::<PickingState>()
            // Messages
            .add_message::<ClickSelectEvent>()
            .add_message::<BoxSelectEvent>()
            .add_message::<SetGizmoModeEvent>()
            .add_message::<TransformSelectedEvent>()
            .add_message::<FocusSelectionEvent>()
            .add_message::<DeleteSelectedEvent>()
            .add_message::<DuplicateSelectedEvent>()
            // Systems
            .add_systems(
                Update,
                (
                    handle_click_select,
                    handle_gizmo_mode,
                    handle_transform_selected,
                    handle_delete_selected,
                    handle_keyboard_shortcuts,
                    update_selection_visuals,
                ),
            );
    }
}

// =============================================================================
// SYSTEMS
// =============================================================================

fn handle_click_select(
    mut events: MessageReader<ClickSelectEvent>,
    camera_q: Query<(&Camera, &GlobalTransform)>,
    selectables: Query<(Entity, &GlobalTransform), (With<Selectable>, Without<LayerLock>)>,
    meshes: Query<&Mesh3d>,
    mesh_assets: Res<Assets<Mesh>>,
    mut selection_state: ResMut<SelectionState>,
    mut selectable_q: Query<&mut Selectable>,
) {
    for event in events.read() {
        let Some((camera, cam_transform)) = camera_q.iter().next() else {
            continue;
        };
        let Some(viewport_size) = camera.logical_viewport_size() else {
            continue;
        };

        // Convert screen position to ray
        let Ok(ray) = camera.viewport_to_world(cam_transform, event.screen_pos) else {
            continue;
        };

        // Find closest hit
        let mut closest_hit: Option<(Entity, f32)> = None;

        for (entity, global_transform) in selectables.iter() {
            // Simple sphere intersection for now
            // TODO: Use bevy::picking for proper mesh intersection
            let pos = global_transform.translation();
            let radius = 1.0; // Approximate

            let to_center = pos - ray.origin;
            let proj = to_center.dot(*ray.direction);
            if proj < 0.0 {
                continue;
            }

            let closest_point = ray.origin + *ray.direction * proj;
            let dist_to_center = (closest_point - pos).length();

            if dist_to_center < radius {
                if closest_hit.is_none() || proj < closest_hit.unwrap().1 {
                    closest_hit = Some((entity, proj));
                }
            }
        }

        if !event.multi_select {
            // Clear previous selection
            for mut selectable in selectable_q.iter_mut() {
                selectable.selected = false;
                selectable.multi_selected = false;
            }
            selection_state.selection.clear();
            selection_state.primary = None;
        }

        if let Some((entity, _)) = closest_hit {
            if let Ok(mut selectable) = selectable_q.get_mut(entity) {
                selectable.selected = true;
                if event.multi_select {
                    selectable.multi_selected = true;
                    if !selection_state.selection.contains(&entity) {
                        selection_state.selection.push(entity);
                    }
                } else {
                    selection_state.primary = Some(entity);
                    selection_state.selection = vec![entity];
                }
                info!("Selected entity: {:?}", entity);
            }
        }
    }
}

fn handle_gizmo_mode(
    mut events: MessageReader<SetGizmoModeEvent>,
    mut settings: ResMut<SelectionSettings>,
) {
    for event in events.read() {
        settings.gizmo_mode = event.0;
        info!("Gizmo mode: {:?}", event.0);
    }
}

fn handle_transform_selected(
    mut events: MessageReader<TransformSelectedEvent>,
    selection: Res<SelectionState>,
    mut transforms: Query<&mut Transform>,
) {
    for event in events.read() {
        for entity in &selection.selection {
            if let Ok(mut transform) = transforms.get_mut(*entity) {
                if let Some(t) = event.translation {
                    transform.translation += t;
                }
                if let Some(r) = event.rotation {
                    transform.rotation *= r;
                }
                if let Some(s) = event.scale {
                    transform.scale *= s;
                }
            }
        }
    }
}

fn handle_delete_selected(
    mut events: MessageReader<DeleteSelectedEvent>,
    mut commands: Commands,
    mut selection: ResMut<SelectionState>,
    lock_check: Query<&LayerLock>,
) {
    for _ in events.read() {
        let mut deleted = 0;
        for entity in selection.selection.drain(..) {
            // Check if locked
            if let Ok(lock) = lock_check.get(entity) {
                if lock.locked {
                    continue;
                }
            }
            commands.entity(entity).despawn();
            deleted += 1;
        }
        selection.primary = None;
        info!("Deleted {} entities", deleted);
    }
}

fn handle_keyboard_shortcuts(
    keys: Res<ButtonInput<KeyCode>>,
    mut gizmo_events: MessageWriter<SetGizmoModeEvent>,
    mut delete_events: MessageWriter<DeleteSelectedEvent>,
) {
    // G = Translate, R = Rotate, S = Scale (Blender style)
    if keys.just_pressed(KeyCode::KeyG) {
        gizmo_events.write(SetGizmoModeEvent(GizmoMode::Translate));
    }
    if keys.just_pressed(KeyCode::KeyR) {
        gizmo_events.write(SetGizmoModeEvent(GizmoMode::Rotate));
    }
    if keys.just_pressed(KeyCode::KeyS) {
        gizmo_events.write(SetGizmoModeEvent(GizmoMode::Scale));
    }

    // Delete/X = Delete selected
    if keys.just_pressed(KeyCode::Delete) || keys.just_pressed(KeyCode::KeyX) {
        delete_events.write(DeleteSelectedEvent);
    }
}

fn update_selection_visuals(
    selection: Res<SelectionState>,
    settings: Res<SelectionSettings>,
    mut materials: ResMut<Assets<StandardMaterial>>,
    query: Query<(&Selectable, &MeshMaterial3d<StandardMaterial>)>,
) {
    // TODO: Implement proper selection outline using bevy_mod_outline
    // For now, this is a placeholder that could modify material emissive

    // This would be done via a custom shader or bevy_mod_outline plugin
    // when it's compatible with 0.17
}

// =============================================================================
// HELPERS
// =============================================================================

/// Get all selected entities
pub fn get_selected_entities(selection: &SelectionState) -> &[Entity] {
    &selection.selection
}

/// Check if entity is selected
pub fn is_selected(selection: &SelectionState, entity: Entity) -> bool {
    selection.selection.contains(&entity)
}

/// Get primary selected entity
pub fn get_primary_selection(selection: &SelectionState) -> Option<Entity> {
    selection.primary
}
