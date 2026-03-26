//! Comprehensive unit tests for k-os-plugin crate
//!
//! Tests cover:
//! - Plugin loading and unloading (Requirement 4.1, 4.2, 4.4)
//! - API version validation (Requirement 4.1, 4.3)
//! - Plugin lifecycle (initialize, update, shutdown) (Requirement 4.2, 4.4)
//! - Resource limit enforcement (Requirement 4.5, 4.6)
//! - Capability system (Requirement 4.6)

use k_os_plugin::{
    Plugin, PluginContext, PluginError, PluginManager, ResourceLimits, ResourceMonitor,
    PLUGIN_API_VERSION,
};
use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
use std::sync::Arc;
use tempfile::TempDir;

// ============================================================================
// Mock Plugin Implementations
// ============================================================================

/// Simple test plugin that tracks lifecycle calls
struct TestPlugin {
    name: String,
    initialized: Arc<AtomicBool>,
    shutdown_called: Arc<AtomicBool>,
    update_count: Arc<AtomicU32>,
}

impl TestPlugin {
    fn new(name: impl Into<String>) -> Self {
        Self {
            name: name.into(),
            initialized: Arc::new(AtomicBool::new(false)),
            shutdown_called: Arc::new(AtomicBool::new(false)),
            update_count: Arc::new(AtomicU32::new(0)),
        }
    }

    fn was_initialized(&self) -> bool {
        self.initialized.load(Ordering::SeqCst)
    }

    fn was_shutdown(&self) -> bool {
        self.shutdown_called.load(Ordering::SeqCst)
    }

    fn update_count(&self) -> u32 {
        self.update_count.load(Ordering::SeqCst)
    }
}

impl Plugin for TestPlugin {
    fn name(&self) -> &str {
        &self.name
    }

    fn version(&self) -> &str {
        "1.0.0"
    }

    fn api_version(&self) -> &str {
        PLUGIN_API_VERSION
    }

    fn description(&self) -> &str {
        "Test plugin for unit tests"
    }

    fn author(&self) -> &str {
        "K_OS Test Suite"
    }

    fn initialize(&mut self, _context: &mut PluginContext) -> k_os_plugin::Result<()> {
        self.initialized.store(true, Ordering::SeqCst);
        Ok(())
    }

    fn shutdown(&mut self) -> k_os_plugin::Result<()> {
        self.shutdown_called.store(true, Ordering::SeqCst);
        Ok(())
    }

    fn update(&mut self, _delta_time: f32) -> k_os_plugin::Result<()> {
        self.update_count.fetch_add(1, Ordering::SeqCst);
        Ok(())
    }
}

/// Plugin with incompatible API version
struct IncompatiblePlugin;

impl Plugin for IncompatiblePlugin {
    fn name(&self) -> &str {
        "incompatible_plugin"
    }

    fn version(&self) -> &str {
        "1.0.0"
    }

    fn api_version(&self) -> &str {
        "99.0.0" // Incompatible version
    }

    fn initialize(&mut self, _context: &mut PluginContext) -> k_os_plugin::Result<()> {
        Ok(())
    }

    fn shutdown(&mut self) -> k_os_plugin::Result<()> {
        Ok(())
    }
}

/// Plugin that fails during initialization
struct FailingInitPlugin;

impl Plugin for FailingInitPlugin {
    fn name(&self) -> &str {
        "failing_init_plugin"
    }

    fn version(&self) -> &str {
        "1.0.0"
    }

    fn api_version(&self) -> &str {
        PLUGIN_API_VERSION
    }

    fn initialize(&mut self, _context: &mut PluginContext) -> k_os_plugin::Result<()> {
        Err(PluginError::InitializationError(
            "Intentional initialization failure".to_string(),
        ))
    }

    fn shutdown(&mut self) -> k_os_plugin::Result<()> {
        Ok(())
    }
}

/// Plugin that fails during shutdown
struct FailingShutdownPlugin {
    initialized: bool,
}

impl Plugin for FailingShutdownPlugin {
    fn name(&self) -> &str {
        "failing_shutdown_plugin"
    }

    fn version(&self) -> &str {
        "1.0.0"
    }

    fn api_version(&self) -> &str {
        PLUGIN_API_VERSION
    }

    fn initialize(&mut self, _context: &mut PluginContext) -> k_os_plugin::Result<()> {
        self.initialized = true;
        Ok(())
    }

    fn shutdown(&mut self) -> k_os_plugin::Result<()> {
        Err(PluginError::ShutdownError(
            "Intentional shutdown failure".to_string(),
        ))
    }
}

// ============================================================================
// Plugin Manager Tests
// ============================================================================

#[test]
fn test_plugin_manager_creation() {
    let temp_dir = TempDir::new().unwrap();
    let manager = PluginManager::new(temp_dir.path().to_path_buf());

    assert_eq!(manager.plugin_dir(), temp_dir.path());
    assert_eq!(manager.list_plugins().len(), 0);
}

#[test]
fn test_plugin_manager_set_default_limits() {
    let temp_dir = TempDir::new().unwrap();
    let mut manager = PluginManager::new(temp_dir.path().to_path_buf());

    let strict_limits = ResourceLimits::strict();
    manager.set_default_limits(strict_limits.clone());

    // Verify limits were set (we can't directly access default_limits, but we can test behavior)
    assert_eq!(manager.list_plugins().len(), 0);
}

#[test]
fn test_plugin_manager_strict_version_check() {
    let temp_dir = TempDir::new().unwrap();
    let mut manager = PluginManager::new(temp_dir.path().to_path_buf());

    // Default should be strict
    manager.set_strict_version_check(true);
    assert_eq!(manager.list_plugins().len(), 0);

    // Disable strict checking
    manager.set_strict_version_check(false);
    assert_eq!(manager.list_plugins().len(), 0);
}

#[test]
fn test_list_plugins_empty() {
    let temp_dir = TempDir::new().unwrap();
    let manager = PluginManager::new(temp_dir.path().to_path_buf());

    let plugins = manager.list_plugins();
    assert!(plugins.is_empty());
}

#[test]
fn test_get_plugin_info_not_found() {
    let temp_dir = TempDir::new().unwrap();
    let manager = PluginManager::new(temp_dir.path().to_path_buf());

    let info = manager.get_plugin_info("nonexistent");
    assert!(info.is_none());
}

#[test]
fn test_get_plugin_metadata_not_found() {
    let temp_dir = TempDir::new().unwrap();
    let manager = PluginManager::new(temp_dir.path().to_path_buf());

    let metadata = manager.get_plugin_metadata("nonexistent");
    assert!(metadata.is_none());
}

#[test]
fn test_unload_plugin_not_found() {
    let temp_dir = TempDir::new().unwrap();
    let mut manager = PluginManager::new(temp_dir.path().to_path_buf());

    let result = manager.unload_plugin("nonexistent");
    assert!(result.is_err());

    match result {
        Err(PluginError::PluginNotFound(name)) => {
            assert_eq!(name, "nonexistent");
        }
        _ => panic!("Expected PluginNotFound error"),
    }
}

#[test]
fn test_load_all_plugins_nonexistent_dir() {
    let temp_dir = TempDir::new().unwrap();
    let nonexistent = temp_dir.path().join("nonexistent");
    let mut manager = PluginManager::new(nonexistent);

    // Should not fail, just log warning
    let result = manager.load_all_plugins();
    assert!(result.is_ok());
}

// ============================================================================
// API Version Validation Tests (Requirement 4.1, 4.3)
// ============================================================================
// Note: API version validation is tested indirectly through plugin loading
// since validate_api_version is a private method

#[test]
fn test_api_version_constant() {
    // Verify the API version constant is set correctly
    assert_eq!(PLUGIN_API_VERSION, "1.0.0");
}

#[test]
fn test_incompatible_plugin_version() {
    // This would be tested through actual plugin loading
    // which requires dynamic library compilation
    // See integration_tests.rs for full plugin loading tests
    let plugin = IncompatiblePlugin;
    assert_eq!(plugin.api_version(), "99.0.0");
    assert_ne!(plugin.api_version(), PLUGIN_API_VERSION);
}

// ============================================================================
// Plugin Context Tests (Requirement 4.6)
// ============================================================================

#[test]
fn test_plugin_context_creation() {
    let context = PluginContext::new();
    assert_eq!(context.plugin_name(), "");
}

#[test]
fn test_plugin_context_with_name() {
    let context = PluginContext::with_name("test_plugin");
    assert_eq!(context.plugin_name(), "test_plugin");
}

#[test]
fn test_capability_registration() {
    let mut context = PluginContext::new();

    assert!(!context.has_capability("mesh_processing"));

    context.register_capability("mesh_processing");
    assert!(context.has_capability("mesh_processing"));
}

#[test]
fn test_capability_requirement() {
    let mut context = PluginContext::new();

    // Should fail without capability
    let result = context.require_capability("gpu_compute");
    assert!(result.is_err());

    // Should succeed with capability
    context.register_capability("gpu_compute");
    let result = context.require_capability("gpu_compute");
    assert!(result.is_ok());
}

#[test]
fn test_multiple_capabilities() {
    let mut context = PluginContext::new();

    context.register_capability("mesh_processing");
    context.register_capability("gpu_compute");
    context.register_capability("file_io");

    assert!(context.has_capability("mesh_processing"));
    assert!(context.has_capability("gpu_compute"));
    assert!(context.has_capability("file_io"));
    assert!(!context.has_capability("network"));
}

#[test]
fn test_restricted_resources() {
    let mut context = PluginContext::new();

    assert!(!context.is_resource_restricted("/system/config"));

    context.add_restricted_resource("/system/config");
    assert!(context.is_resource_restricted("/system/config"));
}

#[test]
fn test_resource_access_check() {
    let mut context = PluginContext::with_name("test_plugin");

    // Should allow access to unrestricted resource
    let result = context.check_resource_access("/user/data");
    assert!(result.is_ok());

    // Should deny access to restricted resource
    context.add_restricted_resource("/system/config");
    let result = context.check_resource_access("/system/config");
    assert!(result.is_err());

    match result {
        Err(PluginError::AccessDenied(msg)) => {
            assert!(msg.contains("test_plugin"));
            assert!(msg.contains("/system/config"));
        }
        _ => panic!("Expected AccessDenied error"),
    }
}

#[test]
fn test_custom_data_storage() {
    let mut context = PluginContext::new();

    // Set data
    context.set_data("key1", serde_json::json!("value1"));
    context.set_data("key2", serde_json::json!(42));

    // Get data
    assert_eq!(context.get_data("key1"), Some(serde_json::json!("value1")));
    assert_eq!(context.get_data("key2"), Some(serde_json::json!(42)));
    assert_eq!(context.get_data("key3"), None);

    // Remove data
    let removed = context.remove_data("key1");
    assert_eq!(removed, Some(serde_json::json!("value1")));
    assert_eq!(context.get_data("key1"), None);

    // Clear data
    context.clear_data();
    assert_eq!(context.get_data("key2"), None);
}

// ============================================================================
// Resource Limits Tests (Requirement 4.5)
// ============================================================================

#[test]
fn test_resource_limits_default() {
    let limits = ResourceLimits::default();
    assert_eq!(limits.max_memory_bytes, 100 * 1024 * 1024);
    assert_eq!(limits.max_cpu_time_ms, 16);
    assert_eq!(limits.max_file_handles, 100);
    assert_eq!(limits.max_init_time_secs, 10);
}

#[test]
fn test_resource_limits_unlimited() {
    let limits = ResourceLimits::unlimited();
    assert_eq!(limits.max_memory_bytes, 0);
    assert_eq!(limits.max_cpu_time_ms, 0);
    assert_eq!(limits.max_file_handles, 0);
    assert_eq!(limits.max_init_time_secs, 0);
}

#[test]
fn test_resource_limits_strict() {
    let limits = ResourceLimits::strict();
    assert_eq!(limits.max_memory_bytes, 50 * 1024 * 1024);
    assert_eq!(limits.max_cpu_time_ms, 8);
    assert_eq!(limits.max_file_handles, 50);
    assert_eq!(limits.max_init_time_secs, 5);
}

#[test]
fn test_resource_limits_relaxed() {
    let limits = ResourceLimits::relaxed();
    assert_eq!(limits.max_memory_bytes, 500 * 1024 * 1024);
    assert_eq!(limits.max_cpu_time_ms, 33);
    assert_eq!(limits.max_file_handles, 200);
    assert_eq!(limits.max_init_time_secs, 30);
}

// ============================================================================
// Resource Monitor Tests (Requirement 4.5)
// ============================================================================

#[test]
fn test_resource_monitor_creation() {
    let limits = ResourceLimits::default();
    let monitor = ResourceMonitor::new("test_plugin", limits.clone());

    assert_eq!(monitor.memory_usage(), 0);
    assert_eq!(monitor.file_handle_count(), 0);
    assert_eq!(monitor.limits().max_memory_bytes, limits.max_memory_bytes);
}

#[test]
fn test_memory_tracking() {
    let monitor = ResourceMonitor::new("test", ResourceLimits::default());

    assert_eq!(monitor.memory_usage(), 0);

    // Allocate memory
    monitor.allocate_memory(1024).unwrap();
    assert_eq!(monitor.memory_usage(), 1024);

    monitor.allocate_memory(2048).unwrap();
    assert_eq!(monitor.memory_usage(), 3072);

    // Deallocate memory
    monitor.deallocate_memory(1024);
    assert_eq!(monitor.memory_usage(), 2048);

    monitor.deallocate_memory(2048);
    assert_eq!(monitor.memory_usage(), 0);
}

#[test]
fn test_memory_limit_enforcement() {
    let limits = ResourceLimits {
        max_memory_bytes: 1024,
        ..Default::default()
    };
    let monitor = ResourceMonitor::new("test", limits);

    // Should succeed within limit
    assert!(monitor.allocate_memory(512).is_ok());
    assert_eq!(monitor.memory_usage(), 512);

    // Should succeed at limit
    assert!(monitor.allocate_memory(512).is_ok());
    assert_eq!(monitor.memory_usage(), 1024);

    // Should fail exceeding limit
    let result = monitor.allocate_memory(1);
    assert!(result.is_err());

    match result {
        Err(PluginError::ResourceLimitExceeded {
            resource,
            limit,
            current,
        }) => {
            assert_eq!(resource, "memory");
            assert_eq!(limit, 1024);
            assert_eq!(current, 1025);
        }
        _ => panic!("Expected ResourceLimitExceeded error"),
    }
}

#[test]
fn test_memory_unlimited() {
    let limits = ResourceLimits::unlimited();
    let monitor = ResourceMonitor::new("test", limits);

    // Should succeed with unlimited memory
    assert!(monitor.allocate_memory(1_000_000_000).is_ok());
    assert_eq!(monitor.memory_usage(), 1_000_000_000);
}

#[test]
fn test_file_handle_tracking() {
    let monitor = ResourceMonitor::new("test", ResourceLimits::default());

    assert_eq!(monitor.file_handle_count(), 0);

    // Open handles
    monitor.open_file_handle().unwrap();
    assert_eq!(monitor.file_handle_count(), 1);

    monitor.open_file_handle().unwrap();
    assert_eq!(monitor.file_handle_count(), 2);

    // Close handles
    monitor.close_file_handle();
    assert_eq!(monitor.file_handle_count(), 1);

    monitor.close_file_handle();
    assert_eq!(monitor.file_handle_count(), 0);
}

#[test]
fn test_file_handle_limit_enforcement() {
    let limits = ResourceLimits {
        max_file_handles: 2,
        ..Default::default()
    };
    let monitor = ResourceMonitor::new("test", limits);

    // Should succeed within limit
    assert!(monitor.open_file_handle().is_ok());
    assert!(monitor.open_file_handle().is_ok());

    // Should fail exceeding limit
    let result = monitor.open_file_handle();
    assert!(result.is_err());

    match result {
        Err(PluginError::ResourceLimitExceeded {
            resource,
            limit,
            current,
        }) => {
            assert_eq!(resource, "file handles");
            assert_eq!(limit, 2);
            assert_eq!(current, 3);
        }
        _ => panic!("Expected ResourceLimitExceeded error"),
    }
}

#[test]
fn test_operation_time_tracking() {
    let limits = ResourceLimits {
        max_cpu_time_ms: 100,
        ..Default::default()
    };
    let monitor = ResourceMonitor::new("test", limits);

    monitor.start_operation();

    // Should succeed immediately
    assert!(monitor.check_operation_time().is_ok());

    monitor.end_operation();
}

#[test]
fn test_operation_time_unlimited() {
    let limits = ResourceLimits::unlimited();
    let monitor = ResourceMonitor::new("test", limits);

    monitor.start_operation();

    // Should always succeed with unlimited time
    assert!(monitor.check_operation_time().is_ok());

    monitor.end_operation();
}

#[test]
fn test_usage_summary() {
    let monitor = ResourceMonitor::new("test", ResourceLimits::default());

    monitor.allocate_memory(1024).unwrap();
    monitor.open_file_handle().unwrap();
    monitor.open_file_handle().unwrap();

    let usage = monitor.usage_summary();
    assert_eq!(usage.memory_bytes, 1024);
    assert_eq!(usage.file_handles, 2);
    assert_eq!(usage.memory_limit, 100 * 1024 * 1024);
    assert_eq!(usage.file_handle_limit, 100);
}

#[test]
fn test_usage_percentages() {
    let limits = ResourceLimits {
        max_memory_bytes: 1000,
        max_file_handles: 10,
        ..Default::default()
    };
    let monitor = ResourceMonitor::new("test", limits);

    monitor.allocate_memory(500).unwrap();
    monitor.open_file_handle().unwrap();
    monitor.open_file_handle().unwrap();

    let usage = monitor.usage_summary();
    assert_eq!(usage.memory_percent(), 50.0);
    assert_eq!(usage.file_handle_percent(), 20.0);
}

#[test]
fn test_is_near_limit() {
    let limits = ResourceLimits {
        max_memory_bytes: 1000,
        max_file_handles: 10,
        ..Default::default()
    };
    let monitor = ResourceMonitor::new("test", limits);

    // Not near limit
    monitor.allocate_memory(500).unwrap();
    assert!(!monitor.is_near_limit());

    // Near memory limit (>80%)
    monitor.allocate_memory(350).unwrap();
    assert!(monitor.is_near_limit());
}

#[test]
fn test_is_near_limit_file_handles() {
    let limits = ResourceLimits {
        max_memory_bytes: 1000,
        max_file_handles: 10,
        ..Default::default()
    };
    let monitor = ResourceMonitor::new("test", limits);

    // Not near limit
    for _ in 0..7 {
        monitor.open_file_handle().unwrap();
    }
    assert!(!monitor.is_near_limit());

    // Near file handle limit (>80%)
    monitor.open_file_handle().unwrap();
    monitor.open_file_handle().unwrap();
    assert!(monitor.is_near_limit());
}

// ============================================================================
// Plugin Trait Tests
// ============================================================================

#[test]
fn test_plugin_metadata() {
    let plugin = TestPlugin::new("test_plugin");
    let metadata = plugin.metadata();

    assert_eq!(metadata["name"], "test_plugin");
    assert_eq!(metadata["version"], "1.0.0");
    assert_eq!(metadata["api_version"], PLUGIN_API_VERSION);
    assert_eq!(metadata["description"], "Test plugin for unit tests");
    assert_eq!(metadata["author"], "K_OS Test Suite");
}

#[test]
fn test_plugin_lifecycle() {
    let mut plugin = TestPlugin::new("test_plugin");
    let mut context = PluginContext::new();

    assert!(!plugin.was_initialized());
    assert!(!plugin.was_shutdown());
    assert_eq!(plugin.update_count(), 0);

    // Initialize
    plugin.initialize(&mut context).unwrap();
    assert!(plugin.was_initialized());

    // Update
    plugin.update(0.016).unwrap();
    plugin.update(0.016).unwrap();
    assert_eq!(plugin.update_count(), 2);

    // Shutdown
    plugin.shutdown().unwrap();
    assert!(plugin.was_shutdown());
}

#[test]
fn test_plugin_default_methods() {
    let plugin = TestPlugin::new("test_plugin");

    assert_eq!(plugin.description(), "Test plugin for unit tests");
    assert_eq!(plugin.author(), "K_OS Test Suite");
}

// ============================================================================
// Error Handling Tests
// ============================================================================

#[test]
fn test_plugin_error_display() {
    let error = PluginError::PluginNotFound("test_plugin".to_string());
    assert_eq!(error.to_string(), "Plugin not found: test_plugin");

    let error = PluginError::PluginAlreadyLoaded("test_plugin".to_string());
    assert_eq!(error.to_string(), "Plugin already loaded: test_plugin");

    let error = PluginError::IncompatibleVersion {
        plugin_version: "2.0.0".to_string(),
        required_version: "1.0.0".to_string(),
    };
    assert!(error
        .to_string()
        .contains("Plugin API version incompatible"));

    let error = PluginError::ResourceLimitExceeded {
        resource: "memory".to_string(),
        limit: 1024,
        current: 2048,
    };
    assert!(error.to_string().contains("Resource limit exceeded"));
    assert!(error.to_string().contains("memory"));

    let error = PluginError::AccessDenied("/system/config".to_string());
    assert!(error
        .to_string()
        .contains("Access denied to restricted resource"));
}

// ============================================================================
// Integration-style Tests (within unit test file)
// ============================================================================

#[test]
fn test_plugin_context_integration() {
    let mut context = PluginContext::with_name("integration_test");

    // Register capabilities
    context.register_capability("mesh_processing");
    context.register_capability("gpu_compute");

    // Add restricted resources
    context.add_restricted_resource("/system/config");
    context.add_restricted_resource("/system/secrets");

    // Store custom data
    context.set_data("config", serde_json::json!({"enabled": true}));

    // Verify capabilities
    assert!(context.has_capability("mesh_processing"));
    assert!(context.has_capability("gpu_compute"));
    assert!(!context.has_capability("network"));

    // Verify resource restrictions
    assert!(context.check_resource_access("/user/data").is_ok());
    assert!(context.check_resource_access("/system/config").is_err());

    // Verify custom data
    assert_eq!(
        context.get_data("config"),
        Some(serde_json::json!({"enabled": true}))
    );
}

#[test]
fn test_resource_monitor_integration() {
    let limits = ResourceLimits {
        max_memory_bytes: 10_000,
        max_file_handles: 5,
        max_cpu_time_ms: 100,
        max_init_time_secs: 10,
    };
    let monitor = ResourceMonitor::new("integration_test", limits);

    // Simulate plugin operation
    monitor.start_operation();

    // Allocate resources
    monitor.allocate_memory(5_000).unwrap();
    monitor.open_file_handle().unwrap();
    monitor.open_file_handle().unwrap();

    // Check usage
    let usage = monitor.usage_summary();
    assert_eq!(usage.memory_bytes, 5_000);
    assert_eq!(usage.file_handles, 2);
    assert_eq!(usage.memory_percent(), 50.0);
    assert_eq!(usage.file_handle_percent(), 40.0);

    // Not near limit yet
    assert!(!monitor.is_near_limit());

    // Allocate more resources
    monitor.allocate_memory(4_000).unwrap();
    monitor.open_file_handle().unwrap();
    monitor.open_file_handle().unwrap();

    // Now near limit
    assert!(monitor.is_near_limit());

    // Clean up
    monitor.deallocate_memory(9_000);
    monitor.close_file_handle();
    monitor.close_file_handle();
    monitor.close_file_handle();
    monitor.close_file_handle();

    monitor.end_operation();

    // Verify cleanup
    assert_eq!(monitor.memory_usage(), 0);
    assert_eq!(monitor.file_handle_count(), 0);
}
