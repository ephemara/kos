//! K_OS Unified Viewport Systems
//!
//! Core systems shared by all tool modes:
//! - Layers (Blender-style object management)
//! - Selection (picking, multi-select, gizmos)
//! - Materials (PBR material library)
//! - Import (load models, spawn primitives)

mod gizmo;
mod import;
mod layers;
pub mod materials;
mod plugin;
pub mod selection; // Public so UI can access DeleteSelectedEvent

pub use gizmo::UniversalGizmoPlugin;
pub use import::ImportPlugin;
pub use import::{ImportCompletedEvent, ImportGltfEvent, PrimitiveType, SpawnPrimitiveEvent};
pub use layers::{
    LayerInfo, LayerLock, LayerObject, LayerObjectBundle, LayerPlugin, LayerSyncPlugin,
    LayerVisibility, ObjectType, SelectObjectEvent, Selectable, SelectionState, ToggleLockEvent,
    ToggleVisibilityEvent,
};
pub use materials::MaterialPlugin;
pub use plugin::{sculpt_enabled, ActiveTool, UniversalViewportPlugin};
pub use selection::{DeleteSelectedEvent, GizmoMode, SelectionPlugin, SelectionSettings};
