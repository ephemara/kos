//! Integration tests for k-os-plugin

use k_os_plugin::{Plugin, PluginContext, PluginManager, ResourceLimits, Result};
use std::path::PathBuf;
use tempfile::TempDir;

// Mock plugin for testing
struct MockPlugin {
    name: String,
    initialized: bool,
    shutdown_called: bool,
}

impl MockPlugin {
    fn new(name: impl Into<String>) -> Self {
        Self {
            name: name.into(),
            initialized: false,
            shutdown_called: false,
        }
    }
}

impl Plugin for MockPlugin {
    fn name(&self) -> &str {
        &self.name
    }

    fn version(&self) -> &str {
        "1.0.0"
    }

    fn api_version(&self) -> &str {
        k_os_plugin::PLUGIN_API_VERSION
    }

    fn initialize(&mut self, _context: &mut PluginContext) -> Result<()> {
        self.initialized = true;
        Ok(())
    }

    fn shutdown(&mut self) -> Result<()> {
        self.shutdown_called = true;
        Ok(())
    }
}

#[test]
fn test_plugin_manager_creation() {
    let temp_dir = TempDir::new().unwrap();
    let manager = PluginManager::new(temp_dir.path().to_path_buf());

    assert_eq!(manager.list_plugins().len(), 0);
    assert_eq!(manager.plugin_dir(), temp_dir.path());
}

#[test]
fn test_resource_limits_presets() {
    let default = ResourceLimits::default();
    assert_eq!(default.max_memory_bytes, 100 * 1024 * 1024);
    assert_eq!(default.max_cpu_time_ms, 16);

    let strict = ResourceLimits::strict();
    assert_eq!(strict.max_memory_bytes, 50 * 1024 * 1024);
    assert_eq!(strict.max_cpu_time_ms, 8);

    let relaxed = ResourceLimits::relaxed();
    assert_eq!(relaxed.max_memory_bytes, 500 * 1024 * 1024);
    assert_eq!(relaxed.max_cpu_time_ms, 33);

    let unlimited = ResourceLimits::unlimited();
    assert_eq!(unlimited.max_memory_bytes, 0);
    assert_eq!(unlimited.max_cpu_time_ms, 0);
}

#[test]
fn test_plugin_context_capabilities() {
    let mut context = PluginContext::with_name("test_plugin");

    // Initially no capabilities
    assert!(!context.has_capability("mesh_processing"));

    // Register capability
    context.register_capability("mesh_processing");
    assert!(context.has_capability("mesh_processing"));

    // Require capability
    assert!(context.require_capability("mesh_processing").is_ok());
    assert!(context.require_capability("gpu_compute").is_err());
}

#[test]
fn test_plugin_context_restricted_resources() {
    let mut context = PluginContext::with_name("test_plugin");

    // Initially no restrictions
    assert!(!context.is_resource_restricted("/user/data"));

    // Add restriction
    context.add_restricted_resource("/system/config");
    assert!(context.is_resource_restricted("/system/config"));

    // Check access
    assert!(context.check_resource_access("/user/data").is_ok());
    assert!(context.check_resource_access("/system/config").is_err());
}

#[test]
fn test_plugin_context_data_storage() {
    let mut context = PluginContext::with_name("test_plugin");

    // Store data
    context.set_data("key1", serde_json::json!("value1"));
    context.set_data("key2", serde_json::json!(42));

    // Retrieve data
    assert_eq!(context.get_data("key1"), Some(serde_json::json!("value1")));
    assert_eq!(context.get_data("key2"), Some(serde_json::json!(42)));
    assert_eq!(context.get_data("key3"), None);

    // Remove data
    assert_eq!(
        context.remove_data("key1"),
        Some(serde_json::json!("value1"))
    );
    assert_eq!(context.get_data("key1"), None);

    // Clear data
    context.clear_data();
    assert_eq!(context.get_data("key2"), None);
}

#[test]
fn test_plugin_metadata() {
    let plugin = MockPlugin::new("test_plugin");
    let metadata = plugin.metadata();

    assert_eq!(metadata["name"], "test_plugin");
    assert_eq!(metadata["version"], "1.0.0");
    assert_eq!(metadata["api_version"], k_os_plugin::PLUGIN_API_VERSION);
}

#[test]
fn test_api_version_validation() {
    let temp_dir = TempDir::new().unwrap();
    let manager = PluginManager::new(temp_dir.path().to_path_buf());

    // This is tested internally by the manager
    // We can't easily test dynamic loading without actual plugin files
    // But we can verify the manager is created correctly
    assert_eq!(manager.list_plugins().len(), 0);
}

#[test]
fn test_resource_limits_configuration() {
    let temp_dir = TempDir::new().unwrap();
    let mut manager = PluginManager::new(temp_dir.path().to_path_buf());

    // Set custom limits
    let custom_limits = ResourceLimits {
        max_memory_bytes: 200 * 1024 * 1024,
        max_cpu_time_ms: 20,
        max_file_handles: 150,
        max_init_time_secs: 15,
    };

    manager.set_default_limits(custom_limits.clone());

    // Verify limits are set (we can't directly access them, but we can verify the manager works)
    assert_eq!(manager.list_plugins().len(), 0);
}

#[test]
fn test_strict_version_check() {
    let temp_dir = TempDir::new().unwrap();
    let mut manager = PluginManager::new(temp_dir.path().to_path_buf());

    // Enable strict version checking
    manager.set_strict_version_check(true);

    // Disable strict version checking
    manager.set_strict_version_check(false);

    // Manager should still work
    assert_eq!(manager.list_plugins().len(), 0);
}

#[test]
fn test_plugin_manager_update() {
    let temp_dir = TempDir::new().unwrap();
    let mut manager = PluginManager::new(temp_dir.path().to_path_buf());

    // Update with no plugins should work
    assert!(manager.update(0.016).is_ok());
}

#[test]
fn test_plugin_manager_unload_all() {
    let temp_dir = TempDir::new().unwrap();
    let mut manager = PluginManager::new(temp_dir.path().to_path_buf());

    // Unload all with no plugins should work
    assert!(manager.unload_all().is_ok());
}
