//! Bevy Engine Module
//!
//! Contains all Bevy-specific code for Advanced Mode viewport.
//! This is the "power user" rendering engine.
//!
//! The main entry point is `main.rs` which runs as a separate binary.
//! Other modules are plugins/components used by the Bevy app.

pub mod sculpt;
pub mod layers;
pub mod materials;
pub mod import;
pub mod selection;
pub mod layers_ui;
pub mod gizmo;
pub mod egui_components;
pub mod camera_experimental;
pub mod asset_browser;

// Re-export commonly used items
pub use sculpt::SculptPlugin;
pub use asset_browser::AssetBrowserPlugin;

