use bevy::prelude::*;
use bevy_egui::{egui, EguiContexts, EguiPrimaryContextPass};

use super::layers::SelectionState;
use super::selection::{GizmoMode, SelectionSettings, SetGizmoModeEvent};

#[derive(Resource)]
pub struct GizmoUiState {
    pub open: bool,
}

impl Default for GizmoUiState {
    fn default() -> Self {
        Self { open: true }
    }
}

pub struct UniversalGizmoPlugin;

impl Plugin for UniversalGizmoPlugin {
    fn build(&self, app: &mut App) {
        app.init_resource::<GizmoUiState>()
            .add_systems(Update, draw_selection_gizmo);
        // gizmo_ui_system removed - using sculpt_ui panel instead
    }
}

fn gizmo_ui_system(
    mut contexts: EguiContexts,
    mut ui_state: ResMut<GizmoUiState>,
    mut settings: ResMut<SelectionSettings>,
    mut set_mode_events: MessageWriter<SetGizmoModeEvent>,
) -> Result {
    let ctx = contexts.ctx_mut()?;

    if !ui_state.open {
        return Ok(());
    }

    egui::Window::new("Gizmo")
        .default_open(true)
        .collapsible(true)
        .resizable(false)
        .show(ctx, |ui| {
            ui.horizontal(|ui| {
                ui.label("Mode:");

                if ui
                    .selectable_label(settings.gizmo_mode == GizmoMode::Translate, "Move")
                    .clicked()
                {
                    set_mode_events.write(SetGizmoModeEvent(GizmoMode::Translate));
                }
                if ui
                    .selectable_label(settings.gizmo_mode == GizmoMode::Rotate, "Rotate")
                    .clicked()
                {
                    set_mode_events.write(SetGizmoModeEvent(GizmoMode::Rotate));
                }
                if ui
                    .selectable_label(settings.gizmo_mode == GizmoMode::Scale, "Scale")
                    .clicked()
                {
                    set_mode_events.write(SetGizmoModeEvent(GizmoMode::Scale));
                }
            });

            ui.checkbox(&mut settings.show_gizmo, "Show gizmo");
        });

    Ok(())
}

fn draw_selection_gizmo(
    selection: Res<SelectionState>,
    settings: Res<SelectionSettings>,
    transforms: Query<&GlobalTransform>,
    mut gizmos: Gizmos,
) {
    if !settings.show_gizmo {
        return;
    }

    let Some(entity) = selection.primary else {
        return;
    };

    let Ok(gt) = transforms.get(entity) else {
        return;
    };

    let origin = gt.translation();
    let rot = gt.rotation();

    let axis_len = match settings.gizmo_mode {
        GizmoMode::Translate => 1.2,
        GizmoMode::Rotate => 0.9,
        GizmoMode::Scale => 1.0,
    };

    let x = rot * Vec3::X;
    let y = rot * Vec3::Y;
    let z = rot * Vec3::Z;

    gizmos.line(origin, origin + x * axis_len, Color::srgb(1.0, 0.2, 0.2));
    gizmos.line(origin, origin + y * axis_len, Color::srgb(0.2, 1.0, 0.2));
    gizmos.line(origin, origin + z * axis_len, Color::srgb(0.2, 0.4, 1.0));
}
