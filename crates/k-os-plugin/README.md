# k-os-plugin

Dynamic plugin system for K_OS DCC Suite with API versioning, sandboxing, and resource limits.

## Features

- **Dynamic Library Loading**: Load plugins at runtime (.dll/.so/.dylib)
- **Plugin Trait Interface**: Standardized API for plugin development
- **API Versioning**: Automatic compatibility checking with semver
- **Plugin Context**: Safe API access with capability-based permissions
- **Resource Limits**: Memory, CPU time, and file handle limits
- **Resource Monitoring**: Track and enforce resource usage
- **Sandboxing**: Isolate plugin execution to prevent crashes
- **Lifecycle Management**: Initialize, update, and shutdown hooks
- **Thread-Safe**: Safe concurrent access to plugin manager

## Usage

### Loading Plugins

```rust
use k_os_plugin::PluginManager;
use std::path::PathBuf;

// Create plugin manager
let plugin_dir = PathBuf::from("plugins");
let mut manager = PluginManager::new(plugin_dir);

// Load a single plugin
let plugin_path = PathBuf::from("plugins/my_plugin.dll");
manager.load_plugin(&plugin_path)?;

// Or load all plugins from directory
manager.load_all_plugins()?;

// List loaded plugins
for name in manager.list_plugins() {
    println!("Loaded: {}", name);
}
```

### Managing Plugins

```rust
// Get plugin metadata
if let Some(metadata) = manager.get_plugin_metadata("my_plugin") {
    println!("Plugin info: {}", metadata);
}

// Update plugins (call each frame)
manager.update(0.016)?; // 16ms delta time

// Unload a specific plugin
manager.unload_plugin("my_plugin")?;

// Unload all plugins
manager.unload_all()?;
```

### Resource Limits

```rust
use k_os_plugin::ResourceLimits;

// Use default limits (100MB memory, 16ms CPU time)
let mut manager = PluginManager::new(plugin_dir);

// Or set custom limits
let limits = ResourceLimits {
    max_memory_bytes: 200 * 1024 * 1024, // 200MB
    max_cpu_time_ms: 33,                  // 33ms (30fps)
    max_file_handles: 150,
    max_init_time_secs: 15,
};
manager.set_default_limits(limits);

// Use preset limits
manager.set_default_limits(ResourceLimits::strict());   // 50MB, 8ms
manager.set_default_limits(ResourceLimits::relaxed());  // 500MB, 33ms
manager.set_default_limits(ResourceLimits::unlimited()); // No limits
```

## Creating Plugins

### Basic Plugin

```rust
use k_os_plugin::{Plugin, PluginContext, Result};

pub struct MyPlugin {
    // Plugin state
    counter: i32,
}

impl Plugin for MyPlugin {
    fn name(&self) -> &str {
        "my_plugin"
    }

    fn version(&self) -> &str {
        "1.0.0"
    }

    fn api_version(&self) -> &str {
        "1.0.0" // Must match K_OS plugin API version
    }

    fn description(&self) -> &str {
        "My awesome plugin"
    }

    fn author(&self) -> &str {
        "Your Name"
    }

    fn initialize(&mut self, context: &mut PluginContext) -> Result<()> {
        context.log(k_os_plugin::context::LogLevel::Info, "Plugin initialized!");
        self.counter = 0;
        Ok(())
    }

    fn shutdown(&mut self) -> Result<()> {
        // Clean up resources
        Ok(())
    }

    fn update(&mut self, delta_time: f32) -> Result<()> {
        // Called each frame
        self.counter += 1;
        Ok(())
    }
}

// Export plugin creation function
#[no_mangle]
pub extern "C" fn create_plugin() -> *mut dyn Plugin {
    Box::into_raw(Box::new(MyPlugin { counter: 0 }))
}

// Export plugin destruction function (optional but recommended)
#[no_mangle]
pub extern "C" fn destroy_plugin(plugin: *mut dyn Plugin) {
    if !plugin.is_null() {
        unsafe {
            let _ = Box::from_raw(plugin);
        }
    }
}
```

### Plugin with Capabilities

```rust
impl Plugin for MyPlugin {
    fn initialize(&mut self, context: &mut PluginContext) -> Result<()> {
        // Request capabilities
        context.require_capability("mesh_processing")?;
        context.require_capability("gpu_compute")?;

        // Store plugin data
        context.set_data("initialized_at", serde_json::json!(std::time::SystemTime::now()));

        Ok(())
    }

    fn update(&mut self, delta_time: f32) -> Result<()> {
        // Check resource access
        context.check_resource_access("/user/meshes")?;

        // Use plugin data
        if let Some(data) = context.get_data("my_data") {
            // Process data
        }

        Ok(())
    }
}
```

### Building Plugins

Create a `Cargo.toml` for your plugin:

```toml
[package]
name = "my_plugin"
version = "1.0.0"
edition = "2021"

[lib]
crate-type = ["cdylib"] # Important: must be cdylib for dynamic loading

[dependencies]
k-os-plugin = { path = "../k-os-plugin" }
serde_json = "1.0"
```

Build the plugin:

```bash
cargo build --release
```

The plugin will be in `target/release/my_plugin.dll` (Windows), `libmy_plugin.so` (Linux), or `libmy_plugin.dylib` (macOS).

## Architecture

### Plugin Lifecycle

1. **Load**: Dynamic library is loaded via `libloading`
2. **Create**: `create_plugin()` function is called to instantiate the plugin
3. **Validate**: API version is checked for compatibility
4. **Initialize**: `initialize()` is called with a `PluginContext`
5. **Update**: `update()` is called periodically (e.g., each frame)
6. **Shutdown**: `shutdown()` is called before unloading
7. **Unload**: Plugin instance and library are dropped

### API Versioning

The plugin system uses semantic versioning for API compatibility:

- **Strict mode** (default): Exact version match required (1.0.0 == 1.0.0)
- **Compatible mode**: Major version match required (1.x.x == 1.y.z)

```rust
// Enable compatible mode
manager.set_strict_version_check(false);
```

### Sandboxing

Plugins are sandboxed through:

1. **Capability System**: Plugins must request capabilities to access APIs
2. **Resource Restrictions**: Certain resources can be marked as restricted
3. **Resource Limits**: Memory, CPU time, and file handles are limited
4. **Isolated Execution**: Plugin crashes don't affect the main application

### Resource Monitoring

The resource monitor tracks:

- **Memory Usage**: Estimated memory allocation/deallocation
- **CPU Time**: Execution time per update
- **File Handles**: Number of open files
- **Warnings**: Alerts when usage exceeds 80% of limits

## Requirements

This crate satisfies the following K_OS requirements:

- **Requirement 4.1**: Validate plugin API version compatibility
- **Requirement 4.2**: Initialize compatible plugins and register functionality
- **Requirement 4.3**: Log error and continue without loading incompatible plugins
- **Requirement 4.4**: Call shutdown method and release resources on unload
- **Requirement 4.5**: Isolate plugin execution to prevent crashes
- **Requirement 4.6**: Deny access to restricted resources
- **Requirement 4.7**: Provide stable API for plugin interaction

## Security Considerations

### Trusted Plugins

For plugins from trusted sources, use relaxed limits:

```rust
manager.set_default_limits(ResourceLimits::relaxed());
```

### Untrusted Plugins

For plugins from untrusted sources, use strict limits:

```rust
manager.set_default_limits(ResourceLimits::strict());
```

### Restricted Resources

Mark sensitive resources as restricted:

```rust
context.add_restricted_resource("/system/config");
context.add_restricted_resource("/system/secrets");
```

### Capability-Based Access

Grant only necessary capabilities:

```rust
// Only grant specific capabilities
context.register_capability("mesh_processing");
// Don't grant: "file_io", "network", "gpu_compute"
```

## Performance

- **Load Time**: ~1-10ms per plugin (depends on plugin size)
- **Update Overhead**: <1ms for resource monitoring per plugin
- **Memory Overhead**: ~1KB per loaded plugin (excluding plugin data)
- **Thread Safety**: Lock-free reads, write locks only for load/unload

## Platform Support

- **Windows**: `.dll` files
- **Linux**: `.so` files
- **macOS**: `.dylib` files

## Examples

See the `examples/` directory for complete plugin examples:

- `basic_plugin`: Minimal plugin implementation
- `mesh_processor`: Plugin that processes meshes
- `gpu_compute`: Plugin that uses GPU compute
- `resource_heavy`: Plugin demonstrating resource limits

## License

Part of the K_OS DCC Suite project.
