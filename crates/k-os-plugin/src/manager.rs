//! Plugin manager for loading and managing plugins

use crate::{
    plugin::CreatePluginFn, Plugin, PluginContext, PluginError, ResourceLimits, ResourceMonitor,
    Result, PLUGIN_API_VERSION,
};
use libloading::{Library, Symbol};
use parking_lot::RwLock;
use semver::Version;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Arc;

/// Loaded plugin instance with its library and metadata
struct LoadedPlugin {
    /// The plugin instance
    plugin: Box<dyn Plugin>,
    /// The loaded library (must be kept alive)
    _library: Library,
    /// Plugin context for API access
    _context: PluginContext,
    /// Resource monitor
    resource_monitor: ResourceMonitor,
    /// Plugin file path
    _path: PathBuf,
}

/// Plugin manager handles loading, initialization, and lifecycle of plugins
///
/// # Example
///
/// ```no_run
/// use k_os_plugin::PluginManager;
/// use std::path::PathBuf;
///
/// let plugin_dir = PathBuf::from("plugins");
/// let mut manager = PluginManager::new(plugin_dir);
///
/// // Load a plugin
/// let plugin_path = PathBuf::from("plugins/my_plugin.dll");
/// manager.load_plugin(&plugin_path).unwrap();
///
/// // List loaded plugins
/// for name in manager.list_plugins() {
///     println!("Loaded: {}", name);
/// }
///
/// // Update plugins (call periodically)
/// manager.update(0.016).unwrap(); // 16ms delta time
///
/// // Unload a plugin
/// manager.unload_plugin("my_plugin").unwrap();
/// ```
pub struct PluginManager {
    /// Directory where plugins are located
    plugin_dir: PathBuf,

    /// Loaded plugins by name
    plugins: Arc<RwLock<HashMap<String, LoadedPlugin>>>,

    /// Default resource limits for new plugins
    default_limits: ResourceLimits,

    /// Whether to enable strict API version checking
    strict_version_check: bool,
}

impl PluginManager {
    /// Create a new plugin manager
    pub fn new(plugin_dir: PathBuf) -> Self {
        Self {
            plugin_dir,
            plugins: Arc::new(RwLock::new(HashMap::new())),
            default_limits: ResourceLimits::default(),
            strict_version_check: true,
        }
    }

    /// Set default resource limits for new plugins
    pub fn set_default_limits(&mut self, limits: ResourceLimits) {
        self.default_limits = limits;
    }

    /// Enable or disable strict API version checking
    ///
    /// When enabled, only plugins with exact API version match are loaded.
    /// When disabled, plugins with compatible major version are loaded.
    pub fn set_strict_version_check(&mut self, strict: bool) {
        self.strict_version_check = strict;
    }

    /// Load a plugin from a dynamic library file
    ///
    /// # Requirements (Requirement 4.1, 4.2, 4.3)
    /// - Validates API version compatibility
    /// - Initializes plugin if compatible
    /// - Logs error and continues if incompatible
    pub fn load_plugin(&mut self, path: &Path) -> Result<()> {
        let plugin_name = path
            .file_stem()
            .and_then(|s| s.to_str())
            .ok_or_else(|| PluginError::LoadError("Invalid plugin path".to_string()))?
            .to_string();

        // Check if already loaded
        {
            let plugins = self.plugins.read();
            if plugins.contains_key(&plugin_name) {
                return Err(PluginError::PluginAlreadyLoaded(plugin_name));
            }
        }

        log::info!("Loading plugin: {} from {:?}", plugin_name, path);

        // Load the dynamic library
        let library =
            unsafe { Library::new(path).map_err(|e| PluginError::LoadError(format!("{}", e)))? };

        // Get the create_plugin function
        let create_plugin: Symbol<CreatePluginFn> = unsafe {
            library
                .get(b"create_plugin")
                .map_err(|_| PluginError::SymbolNotFound("create_plugin".to_string()))?
        };

        // Create the plugin instance
        let plugin_ptr = unsafe { create_plugin() };
        if plugin_ptr.is_null() {
            return Err(PluginError::LoadError(
                "create_plugin returned null".to_string(),
            ));
        }

        let mut plugin: Box<dyn Plugin> = unsafe { Box::from_raw(plugin_ptr) };

        // Validate API version (Requirement 4.1)
        self.validate_api_version(plugin.api_version())?;

        log::info!(
            "Plugin '{}' v{} loaded (API v{})",
            plugin.name(),
            plugin.version(),
            plugin.api_version()
        );

        // Create plugin context
        let mut context = PluginContext::with_name(plugin.name());

        // Grant default capabilities
        context.register_capability("logging");

        // Create resource monitor
        let resource_monitor = ResourceMonitor::new(plugin.name(), self.default_limits.clone());

        // Initialize the plugin (Requirement 4.2)
        resource_monitor.start_operation();
        let init_result = plugin.initialize(&mut context);
        resource_monitor.end_operation();

        if let Err(e) = init_result {
            log::error!("Plugin '{}' initialization failed: {}", plugin.name(), e);
            return Err(PluginError::InitializationError(format!("{}", e)));
        }

        log::info!("Plugin '{}' initialized successfully", plugin.name());

        // Store the loaded plugin
        let loaded = LoadedPlugin {
            plugin,
            _library: library,
            _context: context,
            resource_monitor,
            _path: path.to_path_buf(),
        };

        let mut plugins = self.plugins.write();
        plugins.insert(plugin_name, loaded);

        Ok(())
    }

    /// Unload a plugin by name
    ///
    /// # Requirements (Requirement 4.4)
    /// - Calls shutdown method
    /// - Releases all resources
    pub fn unload_plugin(&mut self, name: &str) -> Result<()> {
        log::info!("Unloading plugin: {}", name);

        let mut plugins = self.plugins.write();
        let mut loaded = plugins
            .remove(name)
            .ok_or_else(|| PluginError::PluginNotFound(name.to_string()))?;

        // Shutdown the plugin (Requirement 4.4)
        if let Err(e) = loaded.plugin.shutdown() {
            log::error!("Plugin '{}' shutdown failed: {}", name, e);
            return Err(PluginError::ShutdownError(format!("{}", e)));
        }

        log::info!("Plugin '{}' unloaded successfully", name);

        // Plugin and library are dropped here, releasing resources
        Ok(())
    }

    /// Get a reference to a loaded plugin
    ///
    /// Note: This returns plugin metadata instead of a direct reference
    /// to avoid lifetime issues with the RwLock
    pub fn get_plugin_info(&self, name: &str) -> Option<(String, String, String)> {
        let plugins = self.plugins.read();
        plugins.get(name).map(|p| {
            (
                p.plugin.name().to_string(),
                p.plugin.version().to_string(),
                p.plugin.api_version().to_string(),
            )
        })
    }

    /// List all loaded plugin names
    pub fn list_plugins(&self) -> Vec<String> {
        let plugins = self.plugins.read();
        plugins.keys().cloned().collect()
    }

    /// Get plugin metadata
    pub fn get_plugin_metadata(&self, name: &str) -> Option<serde_json::Value> {
        let plugins = self.plugins.read();
        plugins.get(name).map(|p| p.plugin.metadata())
    }

    /// Update all plugins (call periodically, e.g., each frame)
    pub fn update(&mut self, delta_time: f32) -> Result<()> {
        let mut plugins = self.plugins.write();

        for (name, loaded) in plugins.iter_mut() {
            // Start resource monitoring
            loaded.resource_monitor.start_operation();

            // Update the plugin
            if let Err(e) = loaded.plugin.update(delta_time) {
                log::error!("Plugin '{}' update failed: {}", name, e);
                // Continue with other plugins
            }

            // Check resource limits
            if let Err(e) = loaded.resource_monitor.check_operation_time() {
                log::warn!("Plugin '{}' exceeded time limit: {}", name, e);
            }

            loaded.resource_monitor.end_operation();

            // Warn if near resource limits
            if loaded.resource_monitor.is_near_limit() {
                let usage = loaded.resource_monitor.usage_summary();
                log::warn!(
                    "Plugin '{}' is near resource limits: memory={:.1}%, handles={:.1}%",
                    name,
                    usage.memory_percent(),
                    usage.file_handle_percent()
                );
            }
        }

        Ok(())
    }

    /// Unload all plugins
    pub fn unload_all(&mut self) -> Result<()> {
        let plugin_names: Vec<String> = self.list_plugins();

        for name in plugin_names {
            if let Err(e) = self.unload_plugin(&name) {
                log::error!("Failed to unload plugin '{}': {}", name, e);
            }
        }

        Ok(())
    }

    /// Validate plugin API version compatibility
    ///
    /// # Requirements (Requirement 4.1, 4.3)
    /// - Compatible: Initialize and register
    /// - Incompatible: Log error and continue without loading
    fn validate_api_version(&self, plugin_api_version: &str) -> Result<()> {
        let required = Version::parse(PLUGIN_API_VERSION)?;
        let plugin = Version::parse(plugin_api_version)?;

        if self.strict_version_check {
            // Exact version match required
            if plugin != required {
                let error = PluginError::IncompatibleVersion {
                    plugin_version: plugin_api_version.to_string(),
                    required_version: PLUGIN_API_VERSION.to_string(),
                };
                log::error!("{}", error);
                return Err(error);
            }
        } else {
            // Compatible major version required
            if plugin.major != required.major {
                let error = PluginError::IncompatibleVersion {
                    plugin_version: plugin_api_version.to_string(),
                    required_version: PLUGIN_API_VERSION.to_string(),
                };
                log::error!("{}", error);
                return Err(error);
            }
        }

        Ok(())
    }

    /// Get the plugin directory
    pub fn plugin_dir(&self) -> &Path {
        &self.plugin_dir
    }

    /// Scan plugin directory and load all plugins
    pub fn load_all_plugins(&mut self) -> Result<()> {
        if !self.plugin_dir.exists() {
            log::warn!("Plugin directory does not exist: {:?}", self.plugin_dir);
            return Ok(());
        }

        let entries = std::fs::read_dir(&self.plugin_dir).map_err(|e| PluginError::IoError(e))?;

        for entry in entries {
            let entry = entry.map_err(|e| PluginError::IoError(e))?;
            let path = entry.path();

            // Check if it's a dynamic library
            if let Some(ext) = path.extension() {
                let ext_str = ext.to_string_lossy();
                #[cfg(target_os = "windows")]
                let is_library = ext_str == "dll";
                #[cfg(target_os = "macos")]
                let is_library = ext_str == "dylib";
                #[cfg(target_os = "linux")]
                let is_library = ext_str == "so";

                if is_library {
                    if let Err(e) = self.load_plugin(&path) {
                        log::error!("Failed to load plugin {:?}: {}", path, e);
                        // Continue loading other plugins (Requirement 4.3)
                    }
                }
            }
        }

        Ok(())
    }
}

impl Drop for PluginManager {
    fn drop(&mut self) {
        if let Err(e) = self.unload_all() {
            log::error!("Error unloading plugins during shutdown: {}", e);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_plugin_manager_creation() {
        let manager = PluginManager::new(PathBuf::from("plugins"));
        assert_eq!(manager.plugin_dir(), Path::new("plugins"));
        assert_eq!(manager.list_plugins().len(), 0);
    }

    #[test]
    fn test_api_version_validation() {
        let manager = PluginManager::new(PathBuf::from("plugins"));

        // Exact match should pass
        assert!(manager.validate_api_version(PLUGIN_API_VERSION).is_ok());

        // Different version should fail
        assert!(manager.validate_api_version("2.0.0").is_err());
    }

    #[test]
    fn test_resource_limits() {
        let mut manager = PluginManager::new(PathBuf::from("plugins"));

        let strict_limits = ResourceLimits::strict();
        manager.set_default_limits(strict_limits.clone());

        assert_eq!(
            manager.default_limits.max_memory_bytes,
            strict_limits.max_memory_bytes
        );
    }
}
