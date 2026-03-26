//! Configuration Registry System
//!
//! Data-driven configuration for all DCC Suite settings.
//! Supports inheritance: embedded defaults → user prefs → project config
//! Hot-reload during development with JSON Schema validation.

pub mod loader;
pub mod registry;
pub mod types;
pub mod validation;
pub mod watcher;

pub use loader::ConfigLoader;
pub use registry::{ConfigRegistry, GLOBAL_CONFIG};
pub use types::*;
pub use validation::validate_config;
pub use watcher::ConfigWatcher;
