//! Commands - User intents from React to Bevy
//!
//! Commands are the ONLY way React can mutate Bevy state.
//! This ensures unidirectional data flow and enables undo/redo.

use serde::{Deserialize, Serialize};
use ts_rs::TS;

/// A user intent sent from React to Bevy
/// 
/// Commands never mutate state directly - they express INTENT.
/// Bevy decides how to handle them.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "bindings/krue/")]
pub struct UiCommand {
    /// Command type (e.g., "SetBrushRadius", "SelectLayer", "ToggleVisibility")
    pub cmd: String,
    
    /// Command arguments (type depends on cmd)
    pub args: serde_json::Value,
    
    /// Transaction ID for undo grouping
    /// Same tx = undo together (e.g., all moves in one drag session)
    #[serde(default)]
    pub tx: Option<String>,
    
    /// Sequence number for ordering and acknowledgment
    pub seq: u64,
    
    /// Source node ID (which UI element triggered this)
    #[serde(default)]
    pub source: Option<u64>,
}

impl UiCommand {
    pub fn new(cmd: impl Into<String>, seq: u64) -> Self {
        Self {
            cmd: cmd.into(),
            args: serde_json::Value::Object(Default::default()),
            tx: None,
            seq,
            source: None,
        }
    }
    
    pub fn with_args(mut self, args: serde_json::Value) -> Self {
        self.args = args;
        self
    }
    
    pub fn with_tx(mut self, tx: impl Into<String>) -> Self {
        self.tx = Some(tx.into());
        self
    }
    
    pub fn from_source(mut self, node_id: u64) -> Self {
        self.source = Some(node_id);
        self
    }
}

/// Acknowledgment from Bevy for a command
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "bindings/krue/")]
pub struct UiAck {
    /// Sequence number of the acknowledged command
    pub seq: u64,
    
    /// Result of command execution
    pub result: AckResult,
}

/// Result of command execution
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "bindings/krue/")]
pub enum AckResult {
    /// Command executed successfully
    Ok,
    
    /// Command failed with error message
    Error { message: String },
    
    /// Command was queued (async execution)
    Pending,
}

impl UiAck {
    pub fn ok(seq: u64) -> Self {
        Self { seq, result: AckResult::Ok }
    }
    
    pub fn error(seq: u64, message: impl Into<String>) -> Self {
        Self { 
            seq, 
            result: AckResult::Error { message: message.into() } 
        }
    }
    
    pub fn pending(seq: u64) -> Self {
        Self { seq, result: AckResult::Pending }
    }
}
