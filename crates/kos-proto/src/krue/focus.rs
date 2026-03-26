//! Focus - Keyboard navigation and focus management
//!
//! Focus configuration for tab navigation, focus trapping, and accessibility.

use serde::{Deserialize, Serialize};
use ts_rs::TS;

/// Focus and keyboard navigation configuration
#[derive(Debug, Clone, Serialize, Deserialize, TS, Default)]
#[ts(export, export_to = "bindings/krue/")]
pub struct FocusConfig {
    /// Tab order (lower = earlier in tab sequence)
    /// Use -1 to remove from tab order
    #[serde(default)]
    pub tab_index: i32,
    
    /// Focus group (Tab cycles within group)
    /// Example: "properties-panel", "modal-1"
    #[serde(default)]
    pub group: Option<String>,
    
    /// Can this element receive focus?
    #[serde(default = "default_true")]
    pub focusable: bool,
    
    /// Trap focus inside this element (for modals)
    #[serde(default)]
    pub trap: bool,
    
    /// Auto-focus when mounted
    #[serde(default)]
    pub auto_focus: bool,
    
    /// Restore focus when unmounted
    #[serde(default)]
    pub restore_focus: bool,
}

fn default_true() -> bool { true }

impl FocusConfig {
    pub fn new(tab_index: i32) -> Self {
        Self {
            tab_index,
            focusable: true,
            ..Default::default()
        }
    }
    
    pub fn not_focusable() -> Self {
        Self {
            tab_index: -1,
            focusable: false,
            ..Default::default()
        }
    }
    
    pub fn modal_trap() -> Self {
        Self {
            tab_index: 0,
            focusable: true,
            trap: true,
            auto_focus: true,
            restore_focus: true,
            ..Default::default()
        }
    }
    
    pub fn in_group(mut self, group: impl Into<String>) -> Self {
        self.group = Some(group.into());
        self
    }
}
