use bevy::prelude::*;
use bevy_egui::{egui, EguiContexts, EguiPrimaryContextPass};

use crate::viewport::{
    DeleteSelectedEvent, LayerInfo, LayerLock, LayerVisibility, SelectObjectEvent, Selectable,
    SelectionState, ToggleLockEvent, ToggleVisibilityEvent,
};

#[derive(Resource)]
pub struct LayersUiState {
    pub open: bool,
    pub search: String,
    pub renaming: Option<Entity>,
    pub rename_buf: String,
}

impl Default for LayersUiState {
    fn default() -> Self {
        Self {
            open: true,
            search: String::new(),
            renaming: None,
            rename_buf: String::new(),
        }
    }
}

pub struct LayersUiPlugin;

impl Plugin for LayersUiPlugin {
    fn build(&self, app: &mut App) {
        app.init_resource::<LayersUiState>()
            .add_systems(EguiPrimaryContextPass, layers_ui_system);
    }
}

#[derive(Clone)]
struct RowSnapshot {
    entity: Entity,
    name: String,
    order: i32,
    visible: bool,
    locked: bool,
    selected: bool,
}

fn layers_ui_system(
    mut contexts: EguiContexts,
    mut ui_state: ResMut<LayersUiState>,
    selection_state: Res<SelectionState>,
    mut layer_queries: ParamSet<(
        Query<(
            Entity,
            &LayerInfo,
            &LayerVisibility,
            &LayerLock,
            &Selectable,
        )>,
        Query<&mut LayerInfo>,
    )>,
    mut select_events: MessageWriter<SelectObjectEvent>,
    mut toggle_vis_events: MessageWriter<ToggleVisibilityEvent>,
    mut toggle_lock_events: MessageWriter<ToggleLockEvent>,
    mut delete_selected_events: MessageWriter<DeleteSelectedEvent>,
) -> Result {
    let ctx = contexts.ctx_mut()?;

    if !ui_state.open {
        return Ok(());
    }

    let mut rows: Vec<RowSnapshot> = layer_queries
        .p0()
        .iter()
        .map(|(entity, info, vis, lock, selectable)| RowSnapshot {
            entity,
            name: info.name.clone(),
            order: info.order,
            visible: vis.visible && !vis.hidden_by_solo,
            locked: lock.locked,
            selected: selection_state.primary == Some(entity) || selectable.selected,
        })
        .collect();

    rows.sort_by(|a, b| a.order.cmp(&b.order).then_with(|| a.name.cmp(&b.name)));

    egui::SidePanel::right("layers_ui")
        .resizable(true)
        .default_width(240.0)
        .min_width(180.0)
        .frame(egui::Frame {
            inner_margin: egui::Margin::same(10),
            fill: egui::Color32::from_rgb(28, 28, 35),
            stroke: egui::Stroke::new(1.0, egui::Color32::from_rgb(18, 18, 22)),
            ..default()
        })
        .show(ctx, |ui| {
            ui.horizontal(|ui| {
                ui.colored_label(
                    egui::Color32::from_rgb(0, 255, 204),
                    egui::RichText::new("📑 LAYERS").strong().size(12.0),
                );
                ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                    if ui.small_button("✕").clicked() {
                        ui_state.open = false;
                    }
                });
            });

            ui.separator();

            ui.horizontal(|ui| {
                ui.label("🔍");
                ui.add(
                    egui::TextEdit::singleline(&mut ui_state.search)
                        .hint_text("Filter...")
                        .desired_width(f32::INFINITY),
                );
            });

            ui.separator();

            ui.horizontal(|ui| {
                let has_selection = selection_state.primary.is_some();
                if ui
                    .add_enabled(has_selection, egui::Button::new("Delete"))
                    .clicked()
                {
                    delete_selected_events.write(DeleteSelectedEvent);
                }
            });

            ui.separator();

            egui::ScrollArea::vertical().show(ui, |ui| {
                for row in rows.iter() {
                    if !ui_state.search.is_empty()
                        && !row
                            .name
                            .to_lowercase()
                            .contains(&ui_state.search.to_lowercase())
                    {
                        continue;
                    }

                    ui.horizontal(|ui| {
                        let vis_label = if row.visible { "👁" } else { "🚫" };
                        if ui.button(vis_label).clicked() {
                            toggle_vis_events.write(ToggleVisibilityEvent(row.entity));
                        }

                        let lock_label = if row.locked { "🔒" } else { "🔓" };
                        if ui.button(lock_label).clicked() {
                            toggle_lock_events.write(ToggleLockEvent(row.entity));
                        }

                        if ui_state.renaming == Some(row.entity) {
                            let resp = ui.add(
                                egui::TextEdit::singleline(&mut ui_state.rename_buf)
                                    .desired_width(f32::INFINITY),
                            );

                            let commit =
                                resp.lost_focus() && ui.input(|i| i.key_pressed(egui::Key::Enter));

                            if commit {
                                if let Ok(mut info) = layer_queries.p1().get_mut(row.entity) {
                                    if !ui_state.rename_buf.trim().is_empty() {
                                        info.name = ui_state.rename_buf.trim().to_string();
                                    }
                                }
                                ui_state.renaming = None;
                            }
                        } else {
                            let resp = ui.selectable_label(row.selected, row.name.clone());
                            if resp.clicked() {
                                select_events.write(SelectObjectEvent {
                                    entity: row.entity,
                                    add_to_selection: false,
                                });
                            }
                            if resp.double_clicked() {
                                ui_state.renaming = Some(row.entity);
                                ui_state.rename_buf = row.name.clone();
                            }
                        }
                    });
                }
            });
        });

    Ok(())
}
