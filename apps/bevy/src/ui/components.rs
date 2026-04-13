//! Reusable bevy_egui components and helpers
//! Based on official bevy_egui 0.38 examples
//!
//! CRITICAL: All egui systems must:
//! 1. Use EguiPrimaryContextPass schedule (NOT Update)
//! 2. Return Result type
//! 3. Use ctx_mut()? pattern

#![allow(dead_code)]

use bevy::prelude::*;
use bevy_egui::{egui, EguiContexts, EguiGlobalSettings, EguiPlugin, EguiPrimaryContextPass};

// Re-export the run conditions for easy use
pub use bevy_egui::input::{
    egui_wants_any_keyboard_input as wants_keyboard, egui_wants_any_pointer_input as wants_pointer,
};

// ============================================================================
// PLUGIN
// ============================================================================

/// Plugin that sets up egui with proper input absorption
pub struct KOsEguiPlugin;

impl Plugin for KOsEguiPlugin {
    fn build(&self, app: &mut App) {
        app.add_plugins(EguiPlugin::default())
            .init_resource::<EguiInputState>()
            .add_systems(EguiPrimaryContextPass, update_egui_input_state);
    }
}

// ============================================================================
// INPUT STATE TRACKING
// ============================================================================

/// Resource tracking egui's input desires (updated each frame)
#[derive(Resource, Default)]
pub struct EguiInputState {
    /// True if egui wants pointer input (mouse over egui area + interacting)
    pub wants_pointer: bool,
    /// True if egui wants keyboard input (text field focused)
    pub wants_keyboard: bool,
    /// True if pointer is over any egui area
    pub pointer_over_area: bool,
}

/// System that updates EguiInputState each frame
/// Add this to EguiPrimaryContextPass
fn update_egui_input_state(mut state: ResMut<EguiInputState>, mut contexts: EguiContexts) {
    if let Ok(ctx) = contexts.ctx_mut() {
        state.wants_pointer = ctx.wants_pointer_input();
        state.wants_keyboard = ctx.wants_keyboard_input();
        state.pointer_over_area = ctx.is_pointer_over_area();
    }
}

// ============================================================================
// UI HELPERS
// ============================================================================

/// Helper for creating a standard debug window
pub fn debug_window(ctx: &egui::Context, title: &str, add_contents: impl FnOnce(&mut egui::Ui)) {
    egui::Window::new(title)
        .default_open(true)
        .collapsible(true)
        .resizable(true)
        .show(ctx, add_contents);
}

/// Helper for creating a tool panel (side panel)
/// Use with static str id like "my_panel"
pub fn tool_panel(
    ctx: &egui::Context,
    id: egui::Id,
    width: f32,
    add_contents: impl FnOnce(&mut egui::Ui),
) {
    egui::SidePanel::left(id)
        .default_width(width)
        .show(ctx, add_contents);
}

/// Helper for creating a top menu bar
pub fn top_menu_bar(ctx: &egui::Context, add_contents: impl FnOnce(&mut egui::Ui)) {
    egui::TopBottomPanel::top("top_menu").show(ctx, |ui| {
        egui::MenuBar::new().ui(ui, add_contents);
    });
}

/// Helper for creating a status bar at bottom
pub fn status_bar(ctx: &egui::Context, add_contents: impl FnOnce(&mut egui::Ui)) {
    egui::TopBottomPanel::bottom("status_bar").show(ctx, add_contents);
}

// ============================================================================
// COMMON WIDGETS
// ============================================================================

/// Tool button grid - displays a row of selectable tool buttons
pub fn tool_button_grid(
    ui: &mut egui::Ui,
    tools: &[(&str, &str)], // (name, tooltip)
    current: &mut u8,
) {
    ui.horizontal_wrapped(|ui| {
        for (i, (name, _tip)) in tools.iter().enumerate() {
            let selected = *current == i as u8;
            if ui.selectable_label(selected, *name).clicked() {
                *current = i as u8;
            }
        }
    });
}

/// Add/Subtract mode toggle
pub fn mode_toggle(ui: &mut egui::Ui, is_add: &mut bool) {
    ui.horizontal(|ui| {
        ui.label("Mode:");
        if ui.selectable_label(*is_add, "➕ Add").clicked() {
            *is_add = true;
        }
        if ui.selectable_label(!*is_add, "➖ Sub").clicked() {
            *is_add = false;
        }
    });
}

/// Slider with label
pub fn labeled_slider(
    ui: &mut egui::Ui,
    label: &str,
    value: &mut f32,
    range: std::ops::RangeInclusive<f32>,
) -> bool {
    ui.add(egui::Slider::new(value, range).text(label))
        .changed()
}

/// Section header with separator
pub fn section(ui: &mut egui::Ui, label: &str) {
    ui.separator();
    ui.label(egui::RichText::new(label).strong());
}

/// Horizontal button row
pub fn button_row(ui: &mut egui::Ui, buttons: &[&str]) -> Option<usize> {
    let mut clicked = None;
    ui.horizontal(|ui| {
        for (i, label) in buttons.iter().enumerate() {
            if ui.button(*label).clicked() {
                clicked = Some(i);
            }
        }
    });
    clicked
}

// ============================================================================
// ABSORB INPUT PATTERN
// ============================================================================

/// Enable automatic input absorption when egui is active
/// Call this once during setup or toggle via UI
pub fn enable_input_absorption(settings: &mut EguiGlobalSettings) {
    settings.enable_absorb_bevy_input_system = true;
}

/// Example system showing proper input absorption pattern
/// Use this as a template for your game input systems
#[allow(dead_code)]
fn example_game_input_system(
    egui_state: Res<EguiInputState>,
    mouse: Res<ButtonInput<MouseButton>>,
    keyboard: Res<ButtonInput<KeyCode>>,
) {
    // Skip if egui wants pointer input
    if egui_state.wants_pointer {
        return;
    }

    // Now safe to handle game pointer input
    if mouse.just_pressed(MouseButton::Left) {
        // Handle click...
    }

    // Skip if egui wants keyboard (text field)
    if egui_state.wants_keyboard {
        return;
    }

    // Now safe to handle game keyboard input
    if keyboard.just_pressed(KeyCode::Space) {
        // Handle space...
    }
}

// ============================================================================
// EXAMPLE: SCULPT TOOLBAR COMPONENT
// ============================================================================

/// State for a sculpt toolbar
#[derive(Resource, Default)]
pub struct SculptToolbarState {
    pub tool: u8,
    pub radius: f32,
    pub intensity: f32,
    pub is_add_mode: bool,
    pub symmetry_x: bool,
    pub strokes_sent: u64,
}

impl SculptToolbarState {
    pub fn new() -> Self {
        Self {
            tool: 0,
            radius: 0.5,
            intensity: 1.0,
            is_add_mode: true,
            symmetry_x: false,
            strokes_sent: 0,
        }
    }
}

/// Draw a sculpt toolbar window
/// Returns true if settings changed
pub fn sculpt_toolbar_ui(ctx: &egui::Context, state: &mut SculptToolbarState) -> bool {
    let mut changed = false;

    egui::Window::new("🎨 Sculpt Tools")
        .default_open(true)
        .collapsible(true)
        .resizable(true)
        .show(ctx, |ui| {
            // Instructions
            ui.colored_label(
                egui::Color32::from_rgb(100, 200, 100),
                "✅ Click + drag on mesh to sculpt!",
            );
            ui.small("LMB = sculpt | MMB = orbit | RMB = pan | Scroll = zoom");
            ui.separator();

            // Tool selection
            ui.label("🖌️ Brush Tools");
            let tools = [
                ("CLAY", "Build up surface"),
                ("SMOOTH", "Smooth surface"),
                ("FLATTEN", "Flatten to plane"),
                ("GRAB", "Grab and move"),
                ("MOVE", "Push geometry"),
                ("SNAKE", "Snake hook pull"),
            ];

            let old_tool = state.tool;
            tool_button_grid(ui, &tools, &mut state.tool);
            if state.tool != old_tool {
                changed = true;
            }

            ui.separator();

            // Mode toggle
            let old_add = state.is_add_mode;
            mode_toggle(ui, &mut state.is_add_mode);
            if state.is_add_mode != old_add {
                changed = true;
            }

            // Sliders
            if labeled_slider(ui, "Radius", &mut state.radius, 0.01..=3.0) {
                changed = true;
            }
            if labeled_slider(ui, "Intensity", &mut state.intensity, 0.0..=3.0) {
                changed = true;
            }

            section(ui, "Symmetry");
            ui.checkbox(&mut state.symmetry_x, "Mirror X");

            section(ui, "Stats");
            ui.label(format!("Strokes: {}", state.strokes_sent));
        });

    changed
}

// ============================================================================
// EXAMPLE: FPS COUNTER
// ============================================================================

/// Draw a simple FPS counter overlay
pub fn fps_overlay(ctx: &egui::Context, fps: f64) {
    egui::Area::new(egui::Id::new("fps_overlay"))
        .anchor(egui::Align2::RIGHT_TOP, egui::vec2(-10.0, 10.0))
        .show(ctx, |ui| {
            ui.label(
                egui::RichText::new(format!("FPS: {:.0}", fps))
                    .color(egui::Color32::GREEN)
                    .monospace(),
            );
        });
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sculpt_state_defaults() {
        let state = SculptToolbarState::new();
        assert_eq!(state.tool, 0);
        assert!(state.is_add_mode);
        assert!(!state.symmetry_x);
    }
}
