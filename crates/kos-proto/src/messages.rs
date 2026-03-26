//! Message Definitions
//!
//! All messages that can be sent between Bevy, Tauri, and React.
//! The enum is auto-serialized - no manual byte pushing required.

use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::state::*;

// =============================================================================
// MAIN MESSAGE ENUM
// =============================================================================

/// All possible messages in the K-OS protocol.
///
/// ## Adding a new message
///
/// 1. Add a variant here
/// 2. Run `cargo test --features ts-rs` to regenerate TypeScript bindings
/// 3. That's it. No byte offsets. No manual serialization.
///
/// ## Bevy Integration
/// 
/// When the `bevy` feature is enabled, KosMessage implements both `Event` and
/// `Message`, allowing use with EventWriter/EventReader systems.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[cfg_attr(feature = "bevy", derive(bevy::prelude::Event))]
#[ts(export, export_to = "bindings/")]
pub enum KosMessage {
    // =========================================================================
    // STATE SYNC (Bevy -> React)
    // =========================================================================
    
    /// Full state snapshot (sent periodically or on major changes)
    StateSnapshot(KosState),
    
    /// Partial state update - just sculpt state
    SculptStateUpdate(SculptState),
    
    /// Layer hierarchy changed
    LayerUpdate(LayerHierarchy),
    
    /// Brush library loaded/reloaded
    BrushLibraryUpdate(BrushLibrary),

    // =========================================================================
    // COMMANDS (React -> Bevy)
    // =========================================================================
    
    /// Set the active tool
    SetActiveTool(ActiveTool),
    
    /// Switch to a different brush
    SwitchBrush { brush_id: String },
    
    /// Update brush settings (partial update)
    UpdateBrushSettings {
        radius: Option<f32>,
        intensity: Option<f32>,
        is_add: Option<bool>,
    },
    
    /// Set symmetry state
    SetSymmetry(SymmetryState),
    
    /// Subdivide the current mesh
    Subdivide,
    
    /// Remesh the current mesh
    Remesh { resolution: u32 },
    
    /// Undo last action
    Undo,
    
    /// Redo last undone action
    Redo,

    // =========================================================================
    // LAYER COMMANDS (React -> Bevy)
    // =========================================================================
    
    /// Select a layer/entity
    SelectLayer { entity_id: u32, add_to_selection: bool },
    
    /// Toggle layer visibility
    ToggleLayerVisibility { entity_id: u32 },
    
    /// Toggle layer lock
    ToggleLayerLock { entity_id: u32 },
    
    /// Delete a layer/entity
    DeleteLayer { entity_id: u32 },
    
    /// Rename a layer
    RenameLayer { entity_id: u32, name: String },

    // =========================================================================
    // VIEWPORT COMMANDS (React -> Bevy)
    // =========================================================================
    
    /// Request a full state snapshot
    RequestStateSnapshot,
    
    /// Window geometry changed
    WindowMove { x: i32, y: i32, width: u32, height: u32 },
    
    /// Cursor moved (for brush preview)
    CursorMove { x: i32, y: i32 },
    
    /// Mouse button event
    MouseButton { button: u8, pressed: bool },
    
    /// Scroll event
    Scroll { delta_x: f32, delta_y: f32 },
    
    /// Set gizmo visibility (show/hide transform gizmo)
    SetGizmoVisibility { visible: bool },

    // =========================================================================
    // IMPORT/SPAWN COMMANDS
    // =========================================================================
    
    /// Spawn a primitive
    SpawnPrimitive { primitive_type: PrimitiveType },
    
    /// Import a GLTF file
    ImportGltf { path: String },

    // =========================================================================
    // TELEMETRY (Bevy -> React)
    // =========================================================================
    
    /// A batch of log entries (rate-limited, never affects performance)
    LogBatch(Vec<LogEntry>),
    
    /// 🔥 GPU Error captured (non-fatal, app stays alive!)
    GpuError {
        /// The error message from WGPU
        error: String,
        /// Error category (Shader, Buffer, Texture, Pipeline, Other)
        category: GpuErrorCategory,
        /// Context (shader name, pipeline, etc)
        context: String,
        /// Timestamp when error occurred
        timestamp: f64,
        /// Unique error hash for dedup
        error_hash: u64,
    },

    // =========================================================================
    // DEBUG COMMANDS (React -> Bevy)
    // =========================================================================
    
    /// Set debug visualization mode
    SetDebugMode(DebugMode),
    
    /// Toggle individual debug overlay
    SetDebugOverlay {
        overlay: DebugOverlay,
        enabled: bool,
    },

    // =========================================================================
    // KRUE (Reactive UI Engine)
    // =========================================================================
    
    /// KRUE command from React (user intent)
    KrueCommand(crate::krue::UiCommand),
    
    /// KRUE patch batch to React (state changes)
    KruePatch(crate::krue::UiPatchBatch),
    
    /// KRUE acknowledgment
    KrueAck(crate::krue::UiAck),
    
    /// KRUE request full sync (sent when React connects or reconnects)
    KrueRequestSync,

    // =========================================================================
    // SYSTEM
    // =========================================================================
    
    /// Shutdown signal
    Shutdown,
    
    /// Ping/Pong for connection testing
    Ping,
    Pong,
}

/// Primitive types for spawning
#[derive(Debug, Clone, Copy, Serialize, Deserialize, TS, Default)]
#[ts(export, export_to = "bindings/")]
pub enum PrimitiveType {
    #[default]
    Cube,
    Sphere,
    Plane,
    Cylinder,
    Torus,
    Monkey,
}

impl KosMessage {
    /// Serialize to bytes using JSON (supports serde_json::Value)
    pub fn to_bytes(&self) -> Vec<u8> {
        serde_json::to_vec(self).unwrap_or_default()
    }

    /// Deserialize from bytes
    pub fn from_bytes(bytes: &[u8]) -> Option<Self> {
        match serde_json::from_slice(bytes) {
            Ok(msg) => Some(msg),
            Err(e) => {
                // Log the first few bytes for debugging
                let preview = String::from_utf8_lossy(&bytes[..bytes.len().min(100)]);
                eprintln!("❌ KosMessage::from_bytes failed: {:?}", e);
                eprintln!("   JSON preview ({} bytes): {}...", bytes.len(), preview);
                None
            }
        }
    }
}

// Implement Message trait for Bevy's event system
#[cfg(feature = "bevy")]
impl bevy::prelude::Message for KosMessage {}

// =============================================================================
// RESPONSE ENUM (For request-response patterns)
// =============================================================================

/// Responses from Bevy to specific requests
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "bindings/")]
pub enum KosResponse {
    /// Success with optional data
    Ok,
    
    /// Error with message
    Error { message: String },
    
    /// State snapshot response
    State(KosState),
    
    /// Raycast hit result
    RaycastHit { 
        entity_id: u32, 
        position: [f32; 3], 
        normal: [f32; 3] 
    },
}

impl KosResponse {
    pub fn to_bytes(&self) -> Vec<u8> {
        serde_json::to_vec(self).unwrap_or_default()
    }

    pub fn from_bytes(bytes: &[u8]) -> Option<Self> {
        serde_json::from_slice(bytes).ok()
    }
}
