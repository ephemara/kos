//! K-OS Commands - Tauri commands using the kos-proto system
//!
//! # THE GOD WORKFLOW
//! 
//! The `kos_send` command accepts ANY KosMessage variant - one command to rule them all!
//! 
//! ## Adding a new React → Bevy feature:
//! 1. Add variant to `crates/kos-proto/src/messages.rs`
//! 2. Run `npm run kos:gen` (regenerates TypeScript types)
//! 3. Add handler in Bevy
//! 4. Use `kos.send({ YourNewThing: {...} })` in React
//!
//! That's it. Zero boilerplate commands needed.
//!
//! ## Legacy Commands (below)
//! The individual kos_* commands below are KEPT for backwards compatibility and
//! convenience. New features should just use `kos_send`.

use kos_proto::{
    KosMessage, KosState, SculptState, BrushLibrary, ActiveTool,
    SymmetryState, LayerHierarchy, PrimitiveType,
};
use crate::kos_bridge;

// =============================================================================
// 🔥 GOD MODE: Generic Send
// =============================================================================

/// **THE GOD COMMAND** - Send ANY KosMessage variant to Bevy
/// 
/// This single command replaces the need for individual kos_* commands.
/// TypeScript discriminated unions provide full type safety and autocomplete.
/// 
/// # Usage in React:
/// ```typescript
/// kos.send({ Subdivide: null });
/// kos.send({ Remesh: { resolution: 128 } });
/// kos.send({ SetActiveTool: "Sculpt" });
/// kos.send({ UpdateBrushSettings: { radius: 50, intensity: null, is_add: true } });
/// ```
#[tauri::command]
pub fn kos_send(msg: KosMessage) -> Result<(), String> {
    kos_bridge::send(msg)
}

// =============================================================================
// STATE QUERIES (React polls these - cannot use generic send)

/// Get the complete application state
#[tauri::command]
pub fn kos_get_state() -> KosState {
    kos_bridge::get_state()
}

/// Get just the sculpt state
#[tauri::command]
pub fn kos_get_sculpt_state() -> SculptState {
    kos_bridge::get_sculpt_state()
}

/// Get the brush library
/// 
/// This loads directly from k-os-engine's BRUSH_LIBRARY, not from Bevy state.
/// The library is initialized on first access if needed.
#[tauri::command]
pub fn kos_get_brush_library() -> BrushLibrary {
    use k_os_brushes::BRUSH_LIBRARY;
    
    // Initialize if needed
    {
        let mut lib = BRUSH_LIBRARY.write();
        if let Err(e) = lib.init() {
            log::warn!("Failed to init brush library: {}", e);
        }
    }
    
    // Convert k-os-engine brushes to kos-proto format
    let lib = BRUSH_LIBRARY.read();
    let brushes: Vec<kos_proto::BrushAsset> = lib.list()
        .into_iter()
        .map(|b| kos_proto::BrushAsset {
            id: b.id.clone(),
            name: b.name.clone(),
            category: b.category.clone(),
            kernel: format!("{:?}", b.kernel).to_lowercase(),
            icon: b.icon.clone(),
        })
        .collect();
    
    BrushLibrary { brushes }
}

/// Check if Bevy is ready
#[tauri::command]
pub fn kos_is_ready() -> bool {
    kos_bridge::is_bevy_ready()
}

// =============================================================================
// TOOL COMMANDS
// =============================================================================

/// Set the active tool
#[tauri::command]
pub fn kos_set_active_tool(tool: String) -> Result<(), String> {
    let active_tool = ActiveTool::from_str(&tool);
    kos_bridge::send(KosMessage::SetActiveTool(active_tool))
}

/// Switch to a different brush
#[tauri::command]
pub fn kos_switch_brush(brush_id: String) -> Result<(), String> {
    kos_bridge::send(KosMessage::SwitchBrush { brush_id })
}

/// Update brush settings (partial update - only set fields that are Some)
#[tauri::command]
pub fn kos_update_brush_settings(
    radius: Option<f32>,
    intensity: Option<f32>,
    is_add: Option<bool>,
) -> Result<(), String> {
    kos_bridge::send(KosMessage::UpdateBrushSettings { radius, intensity, is_add })
}

/// Set symmetry state
#[tauri::command]
pub fn kos_set_symmetry(x: bool, y: bool, z: bool) -> Result<(), String> {
    kos_bridge::send(KosMessage::SetSymmetry(SymmetryState { x, y, z }))
}

// =============================================================================
// GEOMETRY COMMANDS
// =============================================================================

/// Subdivide the current mesh
#[tauri::command]
pub fn kos_subdivide() -> Result<(), String> {
    kos_bridge::send(KosMessage::Subdivide)
}

/// Remesh the current mesh
#[tauri::command]
pub fn kos_remesh(resolution: u32) -> Result<(), String> {
    kos_bridge::send(KosMessage::Remesh { resolution })
}

/// Undo last action
#[tauri::command]
pub fn kos_undo() -> Result<(), String> {
    kos_bridge::send(KosMessage::Undo)
}

/// Redo last undone action
#[tauri::command]
pub fn kos_redo() -> Result<(), String> {
    kos_bridge::send(KosMessage::Redo)
}

// =============================================================================
// LAYER COMMANDS
// =============================================================================

/// Select a layer
#[tauri::command]
pub fn kos_select_layer(entity_id: u32, add_to_selection: bool) -> Result<(), String> {
    kos_bridge::send(KosMessage::SelectLayer { entity_id, add_to_selection })
}

/// Toggle layer visibility
#[tauri::command]
pub fn kos_toggle_layer_visibility(entity_id: u32) -> Result<(), String> {
    kos_bridge::send(KosMessage::ToggleLayerVisibility { entity_id })
}

/// Toggle layer lock
#[tauri::command]
pub fn kos_toggle_layer_lock(entity_id: u32) -> Result<(), String> {
    kos_bridge::send(KosMessage::ToggleLayerLock { entity_id })
}

/// Delete a layer
#[tauri::command]
pub fn kos_delete_layer(entity_id: u32) -> Result<(), String> {
    kos_bridge::send(KosMessage::DeleteLayer { entity_id })
}

/// Rename a layer
#[tauri::command]
pub fn kos_rename_layer(entity_id: u32, name: String) -> Result<(), String> {
    kos_bridge::send(KosMessage::RenameLayer { entity_id, name })
}

// =============================================================================
// VIEWPORT COMMANDS
// =============================================================================

/// Request a full state snapshot from Bevy
#[tauri::command]
pub fn kos_request_state() -> Result<(), String> {
    kos_bridge::send(KosMessage::RequestStateSnapshot)
}

/// Notify Bevy of window movement
#[tauri::command]
pub fn kos_window_move(x: i32, y: i32, width: u32, height: u32) -> Result<(), String> {
    kos_bridge::send(KosMessage::WindowMove { x, y, width, height })
}

/// Send cursor position to Bevy
#[tauri::command]
pub fn kos_cursor_move(x: i32, y: i32) -> Result<(), String> {
    kos_bridge::send(KosMessage::CursorMove { x, y })
}

/// Send mouse button event
#[tauri::command]
pub fn kos_mouse_button(button: u8, pressed: bool) -> Result<(), String> {
    kos_bridge::send(KosMessage::MouseButton { button, pressed })
}

/// Send scroll event
#[tauri::command]
pub fn kos_scroll(delta_x: f32, delta_y: f32) -> Result<(), String> {
    kos_bridge::send(KosMessage::Scroll { delta_x, delta_y })
}

// =============================================================================
// SPAWN/IMPORT COMMANDS
// =============================================================================

/// Spawn a primitive
#[tauri::command]
pub fn kos_spawn_primitive(primitive_type: String) -> Result<(), String> {
    let ptype = match primitive_type.to_lowercase().as_str() {
        "cube" => PrimitiveType::Cube,
        "sphere" => PrimitiveType::Sphere,
        "plane" => PrimitiveType::Plane,
        "cylinder" => PrimitiveType::Cylinder,
        "torus" => PrimitiveType::Torus,
        "monkey" => PrimitiveType::Monkey,
        _ => PrimitiveType::Cube,
    };
    kos_bridge::send(KosMessage::SpawnPrimitive { primitive_type: ptype })
}

/// Import a GLTF file
#[tauri::command]
pub fn kos_import_gltf(path: String) -> Result<(), String> {
    kos_bridge::send(KosMessage::ImportGltf { path })
}

// =============================================================================
// SYSTEM COMMANDS
// =============================================================================

/// Ping Bevy (for testing connection)
#[tauri::command]
pub fn kos_ping() -> Result<(), String> {
    kos_bridge::send(KosMessage::Ping)
}

/// Shutdown Bevy
#[tauri::command]
pub fn kos_shutdown() -> Result<(), String> {
    kos_bridge::send(KosMessage::Shutdown)
}
