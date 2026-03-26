//! Portal - Modals, overlays, and out-of-tree rendering
//!
//! Portal configuration for rendering nodes outside the normal tree
//! (modals, tooltips, context menus, etc.)

use serde::{Deserialize, Serialize};
use ts_rs::TS;

use super::NodeId;

/// Portal configuration for out-of-tree rendering
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "bindings/krue/")]
pub struct PortalConfig {
    /// Portal target layer
    pub target: PortalTarget,
    
    /// Z-index (higher = on top)
    #[serde(default = "default_z_index")]
    pub z_index: i32,
    
    /// Positioning strategy
    pub position: PortalPosition,
    
    /// Trap focus inside portal
    #[serde(default)]
    pub focus_trap: bool,
    
    /// Auto-dismiss triggers
    #[serde(default)]
    pub dismiss_on: Vec<DismissTrigger>,
    
    /// Backdrop (darken background)
    #[serde(default)]
    pub backdrop: Option<BackdropConfig>,
}

fn default_z_index() -> i32 { 1000 }

impl Default for PortalConfig {
    fn default() -> Self {
        Self {
            target: PortalTarget::Overlay,
            z_index: 1000,
            position: PortalPosition::Center,
            focus_trap: false,
            dismiss_on: vec![],
            backdrop: None,
        }
    }
}

impl PortalConfig {
    pub fn modal() -> Self {
        Self {
            target: PortalTarget::Overlay,
            z_index: 1000,
            position: PortalPosition::Center,
            focus_trap: true,
            dismiss_on: vec![DismissTrigger::Escape],
            backdrop: Some(BackdropConfig::default()),
        }
    }
    
    pub fn tooltip() -> Self {
        Self {
            target: PortalTarget::Tooltip,
            z_index: 2000,
            position: PortalPosition::Cursor,
            focus_trap: false,
            dismiss_on: vec![DismissTrigger::MouseLeave],
            backdrop: None,
        }
    }
    
    pub fn context_menu() -> Self {
        Self {
            target: PortalTarget::Overlay,
            z_index: 1500,
            position: PortalPosition::Cursor,
            focus_trap: true,
            dismiss_on: vec![DismissTrigger::ClickOutside, DismissTrigger::Escape],
            backdrop: None,
        }
    }
    
    pub fn dropdown(anchor: NodeId) -> Self {
        Self {
            target: PortalTarget::Overlay,
            z_index: 1100,
            position: PortalPosition::RelativeTo { 
                node_id: anchor, 
                anchor: Anchor::BottomStart 
            },
            focus_trap: true,
            dismiss_on: vec![DismissTrigger::ClickOutside, DismissTrigger::Escape],
            backdrop: None,
        }
    }
}

/// Portal target layer
#[derive(Debug, Clone, Copy, Serialize, Deserialize, TS, Default)]
#[ts(export, export_to = "bindings/krue/")]
pub enum PortalTarget {
    #[default]
    Overlay,
    Tooltip,
    Dropdown,
    Custom(u32),
}

/// How to position the portal
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "bindings/krue/")]
pub enum PortalPosition {
    /// Fixed position on screen
    Fixed { x: f32, y: f32 },
    
    /// At cursor position (for context menus)
    Cursor,
    
    /// Relative to another node
    RelativeTo { node_id: NodeId, anchor: Anchor },
    
    /// Centered on screen
    Center,
}

impl Default for PortalPosition {
    fn default() -> Self { Self::Center }
}

/// Anchor point for relative positioning
#[derive(Debug, Clone, Copy, Serialize, Deserialize, TS, Default)]
#[ts(export, export_to = "bindings/krue/")]
pub enum Anchor {
    TopStart,
    TopCenter,
    TopEnd,
    #[default]
    BottomStart,
    BottomCenter,
    BottomEnd,
    StartTop,
    StartCenter,
    StartBottom,
    EndTop,
    EndCenter,
    EndBottom,
}

/// What triggers portal dismissal
#[derive(Debug, Clone, Copy, Serialize, Deserialize, TS, PartialEq, Eq)]
#[ts(export, export_to = "bindings/krue/")]
pub enum DismissTrigger {
    /// Click outside the portal
    ClickOutside,
    /// Press Escape key
    Escape,
    /// Focus leaves the portal
    FocusLost,
    /// Mouse leaves the portal
    MouseLeave,
    /// Timeout in milliseconds
    Timeout { ms: u32 },
}

/// Backdrop (overlay behind modal)
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "bindings/krue/")]
pub struct BackdropConfig {
    /// Background color (RGBA)
    pub color: [f32; 4],
    
    /// Click backdrop to dismiss
    pub dismiss_on_click: bool,
    
    /// Blur background
    pub blur: Option<f32>,
}

impl Default for BackdropConfig {
    fn default() -> Self {
        Self {
            color: [0.0, 0.0, 0.0, 0.5],  // Semi-transparent black
            dismiss_on_click: true,
            blur: None,
        }
    }
}
