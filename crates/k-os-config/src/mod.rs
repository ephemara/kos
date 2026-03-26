//! Configuration Registry System
//!
//! Data-driven configuration for all DCC Suite settings.
//! Supports inheritance: embedded defaults → user prefs → project config
//! Hot-reload during development with JSON Schema validation.

pub mod registry;
pub mod types;
pub mod loader;
pub mod watcher;
pub mod validation;

pub use registry::{ConfigRegistry, GLOBAL_CONFIG};
pub use types::*;
pub use loader::ConfigLoader;
pub use watcher::ConfigWatcher;
pub use validation::validate_config;
