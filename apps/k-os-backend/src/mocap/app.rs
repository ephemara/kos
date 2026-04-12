//! App-level commands
//!
//! Core application commands for state management and external engine communication.

use crate::bridge::app_bridge;
use app_proto::{
    ActiveTool, AppMessage, AppState, BrushLibrary, PrimitiveType, SculptState, SymmetryState,
};

// =============================================================================
// 🔥 GOD MODE: Generic Send
// =============================================================================

/// **THE GOD COMMAND** - Send ANY AppMessage variant to external engine
///
/// This single command replaces the need for individual app_* commands.
/// TypeScript discriminated unions provide full type safety and autocomplete.
///
/// # Usage in React:
/// ```typescript
/// app.send({ Subdivide: null });
/// app.send({ Remesh: { resolution: 128 } });
/// app.send({ SetActiveTool: "Sculpt" });
/// app.send({ UpdateBrushSettings: { radius: 50, intensity: null, is_add: true } });
/// ```
#[tauri::command]
pub fn app_send(msg: AppMessage) -> Result<(), String> {
    app_bridge::send(msg)
}

// =============================================================================
// STATE QUERIES
// =============================================================================

/// Get the complete application state
#[tauri::command]
pub fn app_get_state() -> AppState {
    app_bridge::get_state()
}

/// Get just the sculpt state
#[tauri::command]
pub fn app_get_sculpt_state() -> SculptState {
    app_bridge::get_sculpt_state()
}

/// Get the brush library
///
/// This loads directly from k-os-engine's BRUSH_LIBRARY.
/// The library is initialized on first access if needed.
#[tauri::command]
pub fn app_get_brush_library() -> BrushLibrary {
    use k_os_brushes::BRUSH_LIBRARY;

    // Initialize if needed
    {
        let mut lib = BRUSH_LIBRARY.write();
        if let Err(e) = lib.init() {
            log::warn!("Failed to init brush library: {}", e);
        }
    }

    // Convert k-os-engine brushes to app-proto format
    let lib = BRUSH_LIBRARY.read();
    let brushes: Vec<app_proto::BrushAsset> = lib
        .list()
        .into_iter()
        .map(|b| app_proto::BrushAsset {
            id: b.id.clone(),
            name: b.name.clone(),
            category: b.category.clone(),
            kernel: format!("{:?}", b.kernel).to_lowercase(),
            icon: b.icon.clone(),
        })
        .collect();

    BrushLibrary { brushes }
}

/// Check if external engine is ready
#[tauri::command]
pub fn app_is_ready() -> bool {
    app_bridge::is_engine_ready()
}

// =============================================================================
// TOOL COMMANDS
// =============================================================================

/// Set the active tool
#[tauri::command]
pub fn app_set_active_tool(tool: String) -> Result<(), String> {
    let active_tool = ActiveTool::from_str(&tool);
    app_bridge::send(AppMessage::SetActiveTool(active_tool))
}

/// Switch to a different brush
#[tauri::command]
pub fn app_switch_brush(brush_id: String) -> Result<(), String> {
    app_bridge::send(AppMessage::SwitchBrush { brush_id })
}

/// Update brush settings (partial update - only set fields that are Some)
#[tauri::command]
pub fn app_update_brush_settings(
    radius: Option<f32>,
    intensity: Option<f32>,
    is_add: Option<bool>,
) -> Result<(), String> {
    app_bridge::send(AppMessage::UpdateBrushSettings {
        radius,
        intensity,
        is_add,
    })
}

/// Set symmetry state
#[tauri::command]
pub fn app_set_symmetry(x: bool, y: bool, z: bool) -> Result<(), String> {
    app_bridge::send(AppMessage::SetSymmetry(SymmetryState { x, y, z }))
}

// =============================================================================
// GEOMETRY COMMANDS
// =============================================================================

/// Subdivide the current mesh
#[tauri::command]
pub fn app_subdivide() -> Result<(), String> {
    app_bridge::send(AppMessage::Subdivide)
}

/// Remesh the current mesh
#[tauri::command]
pub fn app_remesh(resolution: u32) -> Result<(), String> {
    app_bridge::send(AppMessage::Remesh { resolution })
}

/// Undo last action
#[tauri::command]
pub fn app_undo() -> Result<(), String> {
    app_bridge::send(AppMessage::Undo)
}

/// Redo last undone action
#[tauri::command]
pub fn app_redo() -> Result<(), String> {
    app_bridge::send(AppMessage::Redo)
}

// =============================================================================
// LAYER COMMANDS
// =============================================================================

/// Select a layer
#[tauri::command]
pub fn app_select_layer(entity_id: u32, add_to_selection: bool) -> Result<(), String> {
    app_bridge::send(AppMessage::SelectLayer {
        entity_id,
        add_to_selection,
    })
}

/// Toggle layer visibility
#[tauri::command]
pub fn app_toggle_layer_visibility(entity_id: u32) -> Result<(), String> {
    app_bridge::send(AppMessage::ToggleLayerVisibility { entity_id })
}

/// Toggle layer lock
#[tauri::command]
pub fn app_toggle_layer_lock(entity_id: u32) -> Result<(), String> {
    app_bridge::send(AppMessage::ToggleLayerLock { entity_id })
}

/// Delete a layer
#[tauri::command]
pub fn app_delete_layer(entity_id: u32) -> Result<(), String> {
    app_bridge::send(AppMessage::DeleteLayer { entity_id })
}

/// Rename a layer
#[tauri::command]
pub fn app_rename_layer(entity_id: u32, name: String) -> Result<(), String> {
    app_bridge::send(AppMessage::RenameLayer { entity_id, name })
}

// =============================================================================
// VIEWPORT COMMANDS
// =============================================================================

/// Request a full state snapshot from external engine
#[tauri::command]
pub fn app_request_state() -> Result<(), String> {
    app_bridge::send(AppMessage::RequestStateSnapshot)
}

/// Notify external engine of window movement
#[tauri::command]
pub fn app_window_move(x: i32, y: i32, width: u32, height: u32) -> Result<(), String> {
    app_bridge::send(AppMessage::WindowMove {
        x,
        y,
        width,
        height,
    })
}

/// Send cursor position to external engine
#[tauri::command]
pub fn app_cursor_move(x: i32, y: i32) -> Result<(), String> {
    app_bridge::send(AppMessage::CursorMove { x, y })
}

/// Send mouse button event
#[tauri::command]
pub fn app_mouse_button(button: u8, pressed: bool) -> Result<(), String> {
    app_bridge::send(AppMessage::MouseButton { button, pressed })
}

/// Send scroll event
#[tauri::command]
pub fn app_scroll(delta_x: f32, delta_y: f32) -> Result<(), String> {
    app_bridge::send(AppMessage::Scroll { delta_x, delta_y })
}

// =============================================================================
// SPAWN/IMPORT COMMANDS
// =============================================================================

/// Spawn a primitive
#[tauri::command]
pub fn app_spawn_primitive(primitive_type: String) -> Result<(), String> {
    let ptype = match primitive_type.to_lowercase().as_str() {
        "cube" => PrimitiveType::Cube,
        "sphere" => PrimitiveType::Sphere,
        "plane" => PrimitiveType::Plane,
        "cylinder" => PrimitiveType::Cylinder,
        "torus" => PrimitiveType::Torus,
        "monkey" => PrimitiveType::Monkey,
        _ => PrimitiveType::Cube,
    };
    app_bridge::send(AppMessage::SpawnPrimitive {
        primitive_type: ptype,
    })
}

/// Import a GLTF file
#[tauri::command]
pub fn app_import_gltf(path: String) -> Result<(), String> {
    app_bridge::send(AppMessage::ImportGltf { path })
}

// =============================================================================
// SYSTEM COMMANDS
// =============================================================================

/// Ping external engine (for testing connection)
#[tauri::command]
pub fn app_ping() -> Result<(), String> {
    app_bridge::send(AppMessage::Ping)
}

/// Shutdown external engine
#[tauri::command]
pub fn app_shutdown() -> Result<(), String> {
    app_bridge::send(AppMessage::Shutdown)
}
