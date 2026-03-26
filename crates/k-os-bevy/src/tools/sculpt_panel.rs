//! K_OS Sculpt Mode UI
//!
//! Clean, ZBrush-inspired sculpting interface for the unified viewport.
//! Activated when ActiveTool == Sculpt.

use bevy::diagnostic::{DiagnosticsStore, FrameTimeDiagnosticsPlugin};
use bevy::prelude::*;
use bevy_egui::{egui, EguiContexts, EguiPrimaryContextPass};

use super::sculpt::{
    ActiveBrush, BrushSettings, RedoEvent, RemeshEvent, SculptCursorState, SculptData, SculptModel,
    SnapshotEvent, SubdivideEvent, SwitchBrushEvent, UndoEvent,
};
use crate::brushes::BRUSH_LIBRARY;
use crate::viewport::ActiveTool;

// =============================================================================
// PLUGIN
// =============================================================================

pub struct SculptUiPlugin;

impl Plugin for SculptUiPlugin {
    fn build(&self, app: &mut App) {
        app.init_resource::<SculptUiState>().add_systems(
            EguiPrimaryContextPass,
            (
                sculpt_left_panel_system,
                sculpt_properties_panel_system,
                sculpt_status_bar_system,
            )
                .run_if(sculpt_mode_active),
        );
    }
}

fn sculpt_mode_active(active_tool: Res<ActiveTool>) -> bool {
    *active_tool == ActiveTool::Sculpt
}

// =============================================================================
// STATE
// =============================================================================

#[derive(Resource)]
pub struct SculptUiState {
    // Brush selection is now handled by ActiveBrush resource
    pub brush_category: BrushCategory,

    // Settings (synced with BrushSettings)
    pub radius: f32,
    pub intensity: f32,
    pub is_add_mode: bool,

    // Symmetry
    pub symmetry_x: bool,
    pub symmetry_y: bool,
    pub symmetry_z: bool,

    // UI state
    pub show_brush_preview: bool,
    pub geometry_collapsed: bool,
    pub stroke_count: u64,
}

impl Default for SculptUiState {
    fn default() -> Self {
        Self {
            brush_category: BrushCategory::Sculpt,
            radius: 0.35,
            intensity: 0.6,
            is_add_mode: true,
            symmetry_x: false,
            symmetry_y: false,
            symmetry_z: false,
            show_brush_preview: true,
            geometry_collapsed: true,
            stroke_count: 0,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BrushCategory {
    Sculpt,
    Smooth,
    Grab,
    Special,
}

// =============================================================================
// BRUSH DEFINITIONS
// =============================================================================

// Brush definitions are now loaded from src-tauri/src/brushes/library.rs
use crate::brushes::BrushKernel;

/// Helper to get an icon for a brush kernel
fn get_brush_icon(kernel: &BrushKernel) -> &'static str {
    match kernel {
        BrushKernel::Stamp => "🏺",
        BrushKernel::Smooth => "✨",
        BrushKernel::Pinch => "🤏",
        BrushKernel::Grab => "✊",
        BrushKernel::Flatten => "⬛",
        BrushKernel::Physics => "⚡",
        BrushKernel::SimCloth => "👕",
        BrushKernel::SimGravity => "🍎",
        BrushKernel::SimInflate => "🎈",
        BrushKernel::PaintColor => "🎨",
        BrushKernel::PaintMask => "🎭",
        // Experimental kernels
        BrushKernel::CrystalGrowth => "💎",
        BrushKernel::CrystalBismuth => "🔮",
        BrushKernel::VoronoiShatter => "💥",
        BrushKernel::Custom(_) => "🔧",
    }
}

// =============================================================================
// COLORS (K_OS Theme)
// =============================================================================

mod colors {
    use bevy_egui::egui::Color32;

    pub const BG_DARK: Color32 = Color32::from_rgb(18, 18, 22);
    pub const BG_PANEL: Color32 = Color32::from_rgb(28, 28, 35);
    pub const BG_WIDGET: Color32 = Color32::from_rgb(38, 38, 48);
    pub const ACCENT_CYAN: Color32 = Color32::from_rgb(0, 255, 204);
    pub const ACCENT_PURPLE: Color32 = Color32::from_rgb(168, 85, 247);
    pub const ACCENT_ORANGE: Color32 = Color32::from_rgb(255, 140, 50);
    pub const TEXT_PRIMARY: Color32 = Color32::from_rgb(230, 230, 235);
    pub const TEXT_DIM: Color32 = Color32::from_rgb(140, 140, 150);
    pub const TEXT_MUTED: Color32 = Color32::from_rgb(90, 90, 100);
    pub const SELECTED: Color32 = Color32::from_rgb(60, 60, 80);
    pub const HOVER: Color32 = Color32::from_rgb(50, 50, 65);
}

// =============================================================================
// LEFT PANEL - Tools & Brushes
// =============================================================================

fn sculpt_left_panel_system(
    mut contexts: EguiContexts,
    mut ui_state: ResMut<SculptUiState>,
    mut brush_settings: ResMut<BrushSettings>,
    active_brush: Res<ActiveBrush>,
    mut switch_events: MessageWriter<SwitchBrushEvent>,
    mut subdivide_events: MessageWriter<SubdivideEvent>,
    mut remesh_events: MessageWriter<RemeshEvent>,
) -> Result {
    let ctx = contexts.ctx_mut()?;

    egui::SidePanel::left("sculpt_tools")
        .resizable(true)
        .default_width(220.0)
        .min_width(180.0)
        .max_width(320.0)
        .frame(egui::Frame {
            inner_margin: egui::Margin::same(12),
            fill: colors::BG_PANEL,
            stroke: egui::Stroke::new(1.0, colors::BG_DARK),
            ..default()
        })
        .show(ctx, |ui| {
            ui.style_mut().spacing.item_spacing = egui::vec2(8.0, 6.0);

            // === .KBRUSH LIBRARY (Data-driven) ===
            ui.horizontal(|ui| {
                ui.colored_label(
                    colors::ACCENT_PURPLE,
                    egui::RichText::new("📁 BRUSH LIBRARY").strong().size(13.0),
                );
            });
            ui.add_space(4.0);

            // Show current active brush
            ui.horizontal(|ui| {
                ui.label(
                    egui::RichText::new("Active:")
                        .size(10.0)
                        .color(colors::TEXT_DIM),
                );
                ui.label(
                    egui::RichText::new(&active_brush.asset.name)
                        .size(11.0)
                        .color(colors::ACCENT_CYAN)
                        .strong(),
                );
            });
            ui.add_space(4.0);

            // Load brushes from library
            let library = BRUSH_LIBRARY.read();
            // Sort brushes by category then name
            let mut brushes: Vec<_> = library.list().into_iter().cloned().collect();
            brushes.sort_by(|a, b| {
                let cat_cmp = a.category.cmp(&b.category);
                if cat_cmp == std::cmp::Ordering::Equal {
                    a.name.cmp(&b.name)
                } else {
                    cat_cmp
                }
            });
            drop(library); // Release lock

            // Group by category
            let mut current_category = String::new();

            egui::ScrollArea::vertical()
                .max_height(350.0)
                .show(ui, |ui| {
                    for brush in &brushes {
                        // Show category header if changed
                        let category = brush.category.split('/').next().unwrap_or("Other");
                        if category != current_category {
                            ui.add_space(8.0);
                            ui.label(
                                egui::RichText::new(category.to_uppercase())
                                    .size(9.0)
                                    .color(colors::TEXT_DIM)
                                    .strong(),
                            );
                            current_category = category.to_string();
                        }

                        let is_active = active_brush.asset.id == brush.id;
                        let (bg, text_col) = if is_active {
                            (colors::ACCENT_PURPLE, colors::BG_DARK)
                        } else {
                            (colors::BG_WIDGET, colors::TEXT_PRIMARY)
                        };

                        let icon = get_brush_icon(&brush.kernel);

                        let btn = ui.add_sized(
                            [ui.available_width(), 28.0],
                            egui::Button::new(
                                egui::RichText::new(format!("{} {}", icon, brush.name))
                                    .size(11.0)
                                    .color(text_col),
                            )
                            .fill(bg)
                            .stroke(if is_active {
                                egui::Stroke::new(1.0, colors::ACCENT_PURPLE)
                            } else {
                                egui::Stroke::NONE
                            }),
                        );

                        if btn.clicked() && !is_active {
                            switch_events.write(SwitchBrushEvent {
                                brush_id: brush.id.clone(),
                            });
                        }
                        btn.on_hover_text(format!(
                            "Category: {}\nKernel: {:?}",
                            brush.category, brush.kernel
                        ));
                    }

                    if brushes.is_empty() {
                        ui.label(
                            egui::RichText::new("No brushes loaded")
                                .size(10.0)
                                .color(colors::TEXT_MUTED),
                        );
                    }
                });

            ui.add_space(8.0);
            ui.separator();

            // === BRUSH SETTINGS ===
            ui.colored_label(colors::TEXT_DIM, egui::RichText::new("SETTINGS").size(10.0));
            ui.add_space(4.0);

            // Radius slider
            ui.horizontal(|ui| {
                ui.label(
                    egui::RichText::new("Size")
                        .size(11.0)
                        .color(colors::TEXT_DIM),
                );
                ui.add_space(ui.available_width() - 140.0);
                if ui
                    .add(
                        egui::Slider::new(&mut ui_state.radius, 0.01..=2.0)
                            .show_value(true)
                            .custom_formatter(|v, _| format!("{:.2}", v)),
                    )
                    .changed()
                {
                    brush_settings.radius = ui_state.radius;
                }
            });

            // Intensity slider
            ui.horizontal(|ui| {
                ui.label(
                    egui::RichText::new("Strength")
                        .size(11.0)
                        .color(colors::TEXT_DIM),
                );
                ui.add_space(ui.available_width() - 140.0);
                if ui
                    .add(
                        egui::Slider::new(&mut ui_state.intensity, 0.0..=2.0)
                            .show_value(true)
                            .custom_formatter(|v, _| format!("{:.0}%", v * 100.0)),
                    )
                    .changed()
                {
                    brush_settings.intensity = ui_state.intensity;
                }
            });

            ui.add_space(8.0);

            // Add/Subtract toggle
            ui.horizontal(|ui| {
                ui.label(
                    egui::RichText::new("Mode")
                        .size(11.0)
                        .color(colors::TEXT_DIM),
                );
                ui.add_space(8.0);

                if ui
                    .selectable_label(
                        ui_state.is_add_mode,
                        egui::RichText::new("➕ Add")
                            .size(10.0)
                            .color(if ui_state.is_add_mode {
                                colors::ACCENT_CYAN
                            } else {
                                colors::TEXT_DIM
                            }),
                    )
                    .clicked()
                {
                    ui_state.is_add_mode = true;
                }

                if ui
                    .selectable_label(
                        !ui_state.is_add_mode,
                        egui::RichText::new("➖ Sub")
                            .size(10.0)
                            .color(if !ui_state.is_add_mode {
                                colors::ACCENT_ORANGE
                            } else {
                                colors::TEXT_DIM
                            }),
                    )
                    .clicked()
                {
                    ui_state.is_add_mode = false;
                }
            });

            ui.add_space(12.0);
            ui.separator();

            // === SYMMETRY ===
            ui.colored_label(colors::TEXT_DIM, egui::RichText::new("SYMMETRY").size(10.0));
            ui.add_space(4.0);

            ui.horizontal(|ui| {
                let x_color = if ui_state.symmetry_x {
                    colors::ACCENT_ORANGE
                } else {
                    colors::TEXT_DIM
                };
                let y_color = if ui_state.symmetry_y {
                    colors::ACCENT_CYAN
                } else {
                    colors::TEXT_DIM
                };
                let z_color = if ui_state.symmetry_z {
                    colors::ACCENT_PURPLE
                } else {
                    colors::TEXT_DIM
                };

                if ui
                    .selectable_label(
                        ui_state.symmetry_x,
                        egui::RichText::new("X").size(12.0).strong().color(x_color),
                    )
                    .clicked()
                {
                    ui_state.symmetry_x = !ui_state.symmetry_x;
                }
                if ui
                    .selectable_label(
                        ui_state.symmetry_y,
                        egui::RichText::new("Y").size(12.0).strong().color(y_color),
                    )
                    .clicked()
                {
                    ui_state.symmetry_y = !ui_state.symmetry_y;
                }
                if ui
                    .selectable_label(
                        ui_state.symmetry_z,
                        egui::RichText::new("Z").size(12.0).strong().color(z_color),
                    )
                    .clicked()
                {
                    ui_state.symmetry_z = !ui_state.symmetry_z;
                }
            });

            ui.add_space(12.0);
            ui.separator();

            // === GEOMETRY ===
            let geo_header = ui.collapsing(
                egui::RichText::new("GEOMETRY")
                    .size(10.0)
                    .color(colors::TEXT_DIM),
                |ui| {
                    ui.horizontal_wrapped(|ui| {
                        if ui
                            .button(egui::RichText::new("Subdivide").size(10.0))
                            .clicked()
                        {
                            subdivide_events.write(SubdivideEvent);
                        }
                        if ui
                            .button(egui::RichText::new("Remesh").size(10.0))
                            .clicked()
                        {
                            remesh_events.write(RemeshEvent { resolution: 128 });
                        }
                        if ui
                            .button(egui::RichText::new("Decimate").size(10.0))
                            .clicked()
                        {
                            // TODO: Decimate event
                        }
                    });
                },
            );
        });

    Ok(())
}

// =============================================================================
// RIGHT PANEL - Brush Properties (below Layers)
// =============================================================================

fn sculpt_properties_panel_system(
    mut contexts: EguiContexts,
    active_brush: Res<ActiveBrush>, // Use ActiveBrush directly
    cursor_state: Res<SculptCursorState>,
    mut undo_events: MessageWriter<UndoEvent>,
    mut redo_events: MessageWriter<RedoEvent>,
    mut snapshot_events: MessageWriter<SnapshotEvent>,
) -> Result {
    let ctx = contexts.ctx_mut()?;

    // This panel appears below the Layers panel on the right
    egui::Window::new("Brush")
        .anchor(egui::Align2::RIGHT_BOTTOM, [-10.0, -50.0])
        .resizable(false)
        .collapsible(true)
        .default_width(240.0)
        .frame(egui::Frame {
            inner_margin: egui::Margin::same(10),
            fill: colors::BG_PANEL,
            stroke: egui::Stroke::new(1.0, colors::BG_DARK),
            corner_radius: egui::CornerRadius::same(6),
            ..default()
        })
        .show(ctx, |ui| {
            // Current brush info from ActiveBrush
            let brush = &active_brush.asset;
            let icon = get_brush_icon(&brush.kernel);

            ui.horizontal(|ui| {
                ui.label(egui::RichText::new(icon).size(20.0));
                ui.vertical(|ui| {
                    ui.label(
                        egui::RichText::new(&brush.name)
                            .strong()
                            .size(12.0)
                            .color(colors::TEXT_PRIMARY),
                    );
                    ui.label(
                        egui::RichText::new(&brush.category)
                            .size(9.0)
                            .color(colors::TEXT_MUTED),
                    );
                });
            });

            ui.separator();

            // Cursor info
            if let Some(hit) = cursor_state.hit_point_world {
                ui.colored_label(
                    colors::ACCENT_CYAN,
                    egui::RichText::new(format!("Hit: {:.2}, {:.2}, {:.2}", hit.x, hit.y, hit.z))
                        .size(9.0),
                );
            } else {
                ui.colored_label(
                    colors::TEXT_MUTED,
                    egui::RichText::new("No surface hit").size(9.0),
                );
            }

            ui.add_space(8.0);

            // Quick actions
            ui.horizontal(|ui| {
                if ui.button("↩ Undo").clicked() {
                    undo_events.write(UndoEvent);
                }
                if ui.button("↪ Redo").clicked() {
                    redo_events.write(RedoEvent);
                }
                if ui.button("📷").on_hover_text("Save snapshot").clicked() {
                    snapshot_events.write(SnapshotEvent);
                }
            });
        });

    Ok(())
}

// =============================================================================
// BOTTOM STATUS BAR
// =============================================================================

fn sculpt_status_bar_system(
    mut contexts: EguiContexts,
    diagnostics: Res<DiagnosticsStore>,
    sculpt_q: Query<(&Mesh3d, &SculptData), With<SculptModel>>,
    meshes: Res<Assets<Mesh>>,
    ui_state: Res<SculptUiState>,
) -> Result {
    let ctx = contexts.ctx_mut()?;

    let fps = diagnostics
        .get(&FrameTimeDiagnosticsPlugin::FPS)
        .and_then(|d| d.smoothed())
        .unwrap_or(0.0);

    let mut total_verts = 0usize;
    let mut total_tris = 0usize;
    let mut undo_count = 0usize;

    for (mesh_handle, sculpt_data) in sculpt_q.iter() {
        if let Some(mesh) = meshes.get(mesh_handle) {
            if let Some(bevy::mesh::VertexAttributeValues::Float32x3(positions)) =
                mesh.attribute(Mesh::ATTRIBUTE_POSITION)
            {
                total_verts += positions.len();
            }
            if let Some(indices) = mesh.indices() {
                total_tris += match indices {
                    bevy::mesh::Indices::U16(v) => v.len() / 3,
                    bevy::mesh::Indices::U32(v) => v.len() / 3,
                };
            }
        }
        undo_count += sculpt_data.undo_stack.len();
    }

    egui::TopBottomPanel::bottom("sculpt_status")
        .frame(egui::Frame {
            inner_margin: egui::Margin::symmetric(12, 6),
            fill: colors::BG_DARK,
            stroke: egui::Stroke::new(1.0, colors::BG_PANEL),
            ..default()
        })
        .show(ctx, |ui| {
            ui.horizontal(|ui| {
                // Left side - mesh stats
                ui.colored_label(
                    colors::TEXT_DIM,
                    egui::RichText::new(format!("Verts: {}", format_number(total_verts)))
                        .size(10.0),
                );
                ui.separator();
                ui.colored_label(
                    colors::TEXT_DIM,
                    egui::RichText::new(format!("Tris: {}", format_number(total_tris))).size(10.0),
                );
                ui.separator();
                ui.colored_label(
                    colors::TEXT_DIM,
                    egui::RichText::new(format!("Undo: {}", undo_count)).size(10.0),
                );

                // Right side - FPS and mode
                ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                    let fps_color = if fps > 55.0 {
                        colors::ACCENT_CYAN
                    } else if fps > 30.0 {
                        colors::ACCENT_ORANGE
                    } else {
                        egui::Color32::RED
                    };
                    ui.colored_label(
                        fps_color,
                        egui::RichText::new(format!("{:.0} FPS", fps))
                            .size(10.0)
                            .strong(),
                    );
                    ui.separator();
                    ui.colored_label(
                        colors::ACCENT_PURPLE,
                        egui::RichText::new("SCULPT MODE").size(9.0),
                    );
                });
            });
        });

    Ok(())
}

fn format_number(n: usize) -> String {
    if n >= 1_000_000 {
        format!("{:.1}M", n as f64 / 1_000_000.0)
    } else if n >= 1_000 {
        format!("{:.1}K", n as f64 / 1_000.0)
    } else {
        n.to_string()
    }
}
