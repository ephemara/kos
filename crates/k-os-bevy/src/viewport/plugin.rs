use bevy::prelude::*;

use super::gizmo::UniversalGizmoPlugin;
use super::import::ImportPlugin;
use super::layers::{LayerPlugin, LayerSyncPlugin};
use super::materials::MaterialPlugin;
use super::selection::SelectionPlugin;
// DISABLED: Using React BevyLayerPanel instead of egui
// use crate::ui::LayersUiPlugin;

#[derive(Resource, Clone, Copy, Debug, PartialEq, Eq)]
pub enum ActiveTool {
    Viewport,
    Sculpt,
}

impl Default for ActiveTool {
    fn default() -> Self {
        Self::Viewport
    }
}

pub fn sculpt_enabled(active_tool: Res<ActiveTool>) -> bool {
    *active_tool == ActiveTool::Sculpt
}

pub struct UniversalViewportPlugin;

impl Plugin for UniversalViewportPlugin {
    fn build(&self, app: &mut App) {
        app.init_resource::<ActiveTool>().add_plugins((
            LayerPlugin,
            LayerSyncPlugin, // React layer panel sync
            MaterialPlugin,
            ImportPlugin,
            SelectionPlugin,
            // DISABLED: Using React BevyLayerPanel instead of egui
            // LayersUiPlugin,
            UniversalGizmoPlugin,
        ));
    }
}
