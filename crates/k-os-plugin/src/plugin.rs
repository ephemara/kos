//! Plugin trait and core plugin interface

use crate::{PluginContext, Result};

/// Plugin trait that all K_OS plugins must implement
///
/// Plugins are dynamically loaded libraries that extend K_OS functionality.
/// Each plugin must export a `create_plugin` function that returns a boxed
/// instance of a type implementing this trait.
///
/// # Example
///
/// ```no_run
/// use k_os_plugin::{Plugin, PluginContext, Result};
///
/// pub struct MyPlugin {
///     initialized: bool,
/// }
///
/// impl Plugin for MyPlugin {
///     fn name(&self) -> &str {
///         "my_plugin"
///     }
///
///     fn version(&self) -> &str {
///         "1.0.0"
///     }
///
///     fn api_version(&self) -> &str {
///         "1.0.0"
///     }
///
///     fn initialize(&mut self, context: &mut PluginContext) -> Result<()> {
///         // Initialize plugin
///         Ok(())
///     }
///
///     fn shutdown(&mut self) -> Result<()> {
///         // Clean up resources
///         Ok(())
///     }
/// }
///
/// // Export plugin creation function
/// #[no_mangle]
/// pub extern "C" fn create_plugin() -> *mut dyn Plugin {
///     Box::into_raw(Box::new(MyPlugin { initialized: false }))
/// }
///
/// // Export plugin destruction function
/// #[no_mangle]
/// pub extern "C" fn destroy_plugin(plugin: *mut dyn Plugin) {
///     if !plugin.is_null() {
///         unsafe {
///             let _ = Box::from_raw(plugin);
///         }
///     }
/// }
/// ```
pub trait Plugin: Send + Sync {
    /// Returns the plugin name (must be unique)
    fn name(&self) -> &str;

    /// Returns the plugin version (semver format)
    fn version(&self) -> &str;

    /// Returns the K_OS plugin API version this plugin was built against
    fn api_version(&self) -> &str;

    /// Returns the plugin description
    fn description(&self) -> &str {
        "No description provided"
    }

    /// Returns the plugin author
    fn author(&self) -> &str {
        "Unknown"
    }

    /// Initialize the plugin with access to K_OS APIs
    ///
    /// This is called after the plugin is loaded and API version is validated.
    /// The plugin can register functionality and access K_OS APIs through the context.
    fn initialize(&mut self, context: &mut PluginContext) -> Result<()>;

    /// Shutdown the plugin and release resources
    ///
    /// This is called before the plugin is unloaded.
    /// The plugin should clean up any resources it allocated.
    fn shutdown(&mut self) -> Result<()>;

    /// Optional: Called on each frame/tick for plugins that need periodic updates
    fn update(&mut self, _delta_time: f32) -> Result<()> {
        Ok(())
    }

    /// Optional: Returns plugin metadata as JSON
    fn metadata(&self) -> serde_json::Value {
        serde_json::json!({
            "name": self.name(),
            "version": self.version(),
            "api_version": self.api_version(),
            "description": self.description(),
            "author": self.author(),
        })
    }
}

/// Type alias for the plugin creation function signature
///
/// Plugins must export a function with this signature named `create_plugin`
#[allow(improper_ctypes_definitions)]
pub type CreatePluginFn = unsafe extern "C" fn() -> *mut dyn Plugin;

/// Type alias for the plugin destruction function signature
///
/// Plugins should export a function with this signature named `destroy_plugin`
#[allow(improper_ctypes_definitions)]
pub type DestroyPluginFn = unsafe extern "C" fn(*mut dyn Plugin);

#[cfg(test)]
mod tests {
    use super::*;

    struct TestPlugin;

    impl Plugin for TestPlugin {
        fn name(&self) -> &str {
            "test_plugin"
        }

        fn version(&self) -> &str {
            "1.0.0"
        }

        fn api_version(&self) -> &str {
            "1.0.0"
        }

        fn initialize(&mut self, _context: &mut PluginContext) -> Result<()> {
            Ok(())
        }

        fn shutdown(&mut self) -> Result<()> {
            Ok(())
        }
    }

    #[test]
    fn test_plugin_metadata() {
        let plugin = TestPlugin;
        let metadata = plugin.metadata();

        assert_eq!(metadata["name"], "test_plugin");
        assert_eq!(metadata["version"], "1.0.0");
        assert_eq!(metadata["api_version"], "1.0.0");
    }
}
