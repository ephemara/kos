//! UI Node - The core structure for UI elements
//!
//! Each UiNode represents a React component with its props, bindings, and event handlers.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use ts_rs::TS;

use super::NodeId;
use super::layout::LayoutStyle;
use super::focus::FocusConfig;
use super::portal::PortalConfig;
use super::async_config::AsyncConfig;

/// A UI node that maps to a React component
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "bindings/krue/")]
pub struct UiNode {
    /// Unique identifier (usually Entity.to_bits())
    pub id: NodeId,
    
    /// React component to render (e.g., "Slider", "Button", "Panel")
    pub component: String,
    
    /// Parent node ID (None = root node)
    pub parent: Option<NodeId>,
    
    /// Static props passed to the component
    pub props: serde_json::Value,
    
    /// Reactive bindings: prop_name → binding_path
    /// Example: { "value": "brush.radius", "disabled": "!ui.canSculpt" }
    #[serde(default)]
    pub bindings: HashMap<String, String>,
    
    /// Command mappings: event_name → CommandBinding
    /// Example: { "onChange": { cmd: "SetBrushRadius", ... } }
    #[serde(default)]
    pub commands: HashMap<String, CommandBinding>,
    
    /// Layout style hints
    #[serde(default)]
    pub layout: Option<LayoutStyle>,
    
    /// Focus/tab navigation configuration
    #[serde(default)]
    pub focus: Option<FocusConfig>,
    
    /// Portal configuration (for modals/overlays)
    #[serde(default)]
    pub portal: Option<PortalConfig>,
    
    /// Target slot to fill (for child nodes)
    /// Example: "right_panel", "header"
    #[serde(default)]
    pub target_slot: Option<String>,
    
    /// Named slots this node defines (for layout containers)
    #[serde(default)]
    pub slots: Option<Vec<SlotDefinition>>,
    
    /// Async/loading state configuration
    #[serde(default)]
    pub async_config: Option<AsyncConfig>,
}

impl Default for UiNode {
    fn default() -> Self {
        Self {
            id: 0,
            component: "Div".into(),
            parent: None,
            props: serde_json::Value::Object(Default::default()),
            bindings: HashMap::new(),
            commands: HashMap::new(),
            layout: None,
            focus: None,
            portal: None,
            target_slot: None,
            slots: None,
            async_config: None,
        }
    }
}

/// How to turn a React event into a Bevy command
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "bindings/krue/")]
pub struct CommandBinding {
    /// The command type to send
    pub cmd: String,
    
    /// Static args (merged with event payload)
    #[serde(default)]
    pub args: serde_json::Value,
    
    /// If true, group rapid-fire events into one undo transaction
    /// Useful for sliders, drag operations, etc.
    #[serde(default)]
    pub debounce_tx: bool,
}

impl CommandBinding {
    pub fn new(cmd: impl Into<String>) -> Self {
        Self {
            cmd: cmd.into(),
            args: serde_json::Value::Object(Default::default()),
            debounce_tx: false,
        }
    }
    
    pub fn with_args(mut self, args: serde_json::Value) -> Self {
        self.args = args;
        self
    }
    
    pub fn debounced(mut self) -> Self {
        self.debounce_tx = true;
        self
    }
}

/// A named slot that child nodes can target
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "bindings/krue/")]
pub struct SlotDefinition {
    /// Slot name (e.g., "header", "left_panel")
    pub name: String,
    
    /// Default content if nothing fills the slot
    #[serde(default)]
    pub default: Option<Vec<UiNode>>,
}

impl SlotDefinition {
    pub fn new(name: impl Into<String>) -> Self {
        Self {
            name: name.into(),
            default: None,
        }
    }
    
    pub fn with_default(mut self, nodes: Vec<UiNode>) -> Self {
        self.default = Some(nodes);
        self
    }
}
