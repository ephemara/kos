//! K_OS Dynamic Plugin System
//!
//! Provides dynamic plugin loading with:
//! - Dynamic library loading (.dll/.so/.dylib)
//! - Plugin trait interface for standardized API
//! - Plugin context for safe API access
//! - API versioning and compatibility checks
//! - Plugin sandboxing and resource limits
//! - Lifecycle management (load, initialize, shutdown, unload)
//!
//! # Example
//!
//! ```no_run
//! use k_os_plugin::{PluginManager, PluginContext};
//! use std::path::PathBuf;
//!
//! // Create plugin manager
//! let plugin_dir = PathBuf::from("plugins");
//! let mut manager = PluginManager::new(plugin_dir);
//!
//! // Load a plugin
//! let plugin_path = PathBuf::from("plugins/my_plugin.dll");
//! manager.load_plugin(&plugin_path).unwrap();
//!
//! // List loaded plugins
//! for name in manager.list_plugins() {
//!     println!("Loaded plugin: {}", name);
//! }
//!
//! // Unload a plugin
//! manager.unload_plugin("my_plugin").unwrap();
//! ```
//!
//! # Plugin Development
//!
//! To create a plugin, implement the `Plugin` trait:
//!
//! ```no_run
//! use k_os_plugin::{Plugin, PluginContext, Result};
//!
//! pub struct MyPlugin;
//!
//! impl Plugin for MyPlugin {
//!     fn name(&self) -> &str {
//!         "my_plugin"
//!     }
//!
//!     fn version(&self) -> &str {
//!         "1.0.0"
//!     }
//!
//!     fn api_version(&self) -> &str {
//!         "1.0.0"
//!     }
//!
//!     fn initialize(&mut self, context: &mut PluginContext) -> Result<()> {
//!         // Initialize plugin
//!         Ok(())
//!     }
//!
//!     fn shutdown(&mut self) -> Result<()> {
//!         // Clean up resources
//!         Ok(())
//!     }
//! }
//!
//! // Export plugin creation function
//! #[no_mangle]
//! pub extern "C" fn create_plugin() -> *mut dyn Plugin {
//!     Box::into_raw(Box::new(MyPlugin))
//! }
//! ```

pub mod context;
pub mod error;
pub mod manager;
pub mod plugin;
pub mod resource_limits;

pub use context::PluginContext;
pub use error::{PluginError, Result};
pub use manager::PluginManager;
pub use plugin::Plugin;
pub use resource_limits::{ResourceLimits, ResourceMonitor};

/// Current K_OS plugin API version
pub const PLUGIN_API_VERSION: &str = "1.0.0";

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_api_version() {
        assert_eq!(PLUGIN_API_VERSION, "1.0.0");
    }
}
