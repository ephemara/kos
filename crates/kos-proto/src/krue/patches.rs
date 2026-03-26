//! Patches - State changes from Bevy to React
//!
//! Patches are the ONLY way Bevy sends state to React.
//! They enable efficient incremental updates.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use ts_rs::TS;

use super::NodeId;
use super::node::UiNode;

/// A state change notification from Bevy to React
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "bindings/krue/")]
pub enum UiPatch {
    /// Update a binding value
    /// Example: { path: "brush.radius", value: 75.0 }
    Set { 
        path: String, 
        value: serde_json::Value 
    },
    
    /// Batch update multiple bindings
    SetBatch {
        updates: Vec<(String, serde_json::Value)>,
    },
    
    /// Create or update a UI node
    NodeSet { 
        id: NodeId, 
        node: UiNode 
    },
    
    /// Remove a UI node (and its children)
    NodeRemove { 
        id: NodeId 
    },
    
    /// Move a node in the tree
    NodeMove { 
        id: NodeId, 
        new_parent: NodeId, 
        index: usize 
    },
    
    /// Update specific props on an existing node (without full replacement)
    NodePropUpdate {
        id: NodeId,
        props: serde_json::Value,
    },
    
    /// Full state sync (on connect/reconnect)
    FullSync { 
        /// All binding values
        bindings: HashMap<String, serde_json::Value>, 
        /// Complete node tree
        nodes: Vec<UiNode>,
        /// Current sequence number
        seq: u64,
    },
    
    /// Focus changed
    FocusChange {
        /// New focused node (None = nothing focused)
        node_id: Option<NodeId>,
    },
    
    /// Undo/Redo state changed
    UndoStateChange {
        can_undo: bool,
        can_redo: bool,
        undo_label: Option<String>,
        redo_label: Option<String>,
    },
}

impl UiPatch {
    /// Create a Set patch
    pub fn set(path: impl Into<String>, value: impl Serialize) -> Self {
        Self::Set {
            path: path.into(),
            value: serde_json::to_value(value).unwrap_or_default(),
        }
    }
    
    /// Create a batch of Set patches
    pub fn batch(updates: Vec<(impl Into<String>, impl Serialize)>) -> Self {
        Self::SetBatch {
            updates: updates
                .into_iter()
                .map(|(p, v)| (p.into(), serde_json::to_value(v).unwrap_or_default()))
                .collect(),
        }
    }
    
    /// Create a NodeSet patch
    pub fn node(node: UiNode) -> Self {
        Self::NodeSet { id: node.id, node }
    }
    
    /// Create a NodeRemove patch
    pub fn remove(id: NodeId) -> Self {
        Self::NodeRemove { id }
    }
}

/// A batch of patches (for efficient network transmission)
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "bindings/krue/")]
pub struct UiPatchBatch {
    /// The patches in this batch
    pub patches: Vec<UiPatch>,
    
    /// Sequence number for ordering
    pub seq: u64,
    
    /// Timestamp for debugging
    pub timestamp: f64,
}

impl UiPatchBatch {
    pub fn new(patches: Vec<UiPatch>, seq: u64) -> Self {
        Self {
            patches,
            seq,
            timestamp: 0.0, // Set by sender
        }
    }
}
