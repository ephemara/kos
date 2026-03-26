//! Command modules
//!
//! This module organizes Tauri commands into logical groups.

pub mod file;
pub mod mocap;
pub mod utils;
pub mod window;

// Re-export all commands for easy registration
pub use file::*;
pub use mocap::*;
pub use window::*;
