# Configuration Schemas

This directory contains JSON Schema definitions and default configuration data for the K_OS DCC Suite.

## Files

### Brushes Configuration
- **Schema**: `brushes.schema.json` - JSON Schema for brush configurations
- **Default Data**: `brushes.json` - Default brush presets embedded in the binary

**Categories**:
- `sculpt` - Sculpting brushes (Standard, Draw, Clay, Grab, Pinch, Inflate)
- `paint` - Painting brushes (Basic Paint, Smear, Watercolor, Oil Paint)
- `mask` - Masking brushes (Mask Paint, Lasso Mask)
- `smooth` - Smoothing brushes (Smooth, Flatten)

**GPU Shaders**: Each brush references a GPU shader for high-performance operations.

### Export Formats Configuration
- **Schema**: `export_formats.schema.json` - JSON Schema for export format configurations
- **Default Data**: `export_formats.json` - Default export format definitions

**Supported Formats**:
- **Mesh Formats**: GLTF, GLB, OBJ, FBX
- **Texture Formats**: PNG, JPG, EXR
- **Heightmap Formats**: PNG (8/16-bit), EXR (32-bit float)

**Options**: Each format includes customizable export options (compression, resolution, embedding, etc.)

### Viewport Presets Configuration
- **Schema**: `viewport_presets.schema.json` - JSON Schema for viewport preset configurations
- **Default Data**: `viewport_presets.json` - Default viewport presets

**Presets**:
- `modeling` - General 3D modeling (10m grid, 60° FOV)
- `sculpting` - Close-up sculpting (5m grid, 50° FOV, warm lighting)
- `painting` - Texture painting (5m grid, 55° FOV, flat lighting)
- `animation` - Animation work (10m grid, 65° FOV, wide view)
- `rendering` - Final rendering (50° FOV, dramatic lighting)
- `technical` - Technical/CAD work (1m grid, 45° FOV, flat lighting)
- `closeup` - Detailed work (2m grid, 40° FOV, close camera)
- `wide` - Scene overview (50m grid, 75° FOV, distant camera)

**Parameters**: Grid size, camera distance, FOV, ambient/directional lighting, shadows

### Greeble Patterns Configuration
- **Schema**: `greeble_patterns.schema.json` - JSON Schema for greeble pattern configurations
- **Default Data**: `greeble_patterns.json` - Default greeble pattern library

**Categories**:
- `sci-fi` - Sci-fi surface details (panels, vents, antennas)
- `industrial` - Industrial elements (pipes, bolts, grates)
- `organic` - Organic growths (barnacles, crystals, spikes)
- `architectural` - Architectural features (windows, columns)
- `tech` - Tech/circuit patterns

**Primitives**: Each pattern consists of primitives (box, cylinder, sphere, custom) with probability, scale range, and rotation range.

## Usage

### Loading Configuration

The configuration system uses a three-tier inheritance model:

1. **Embedded Defaults** (this directory) - Compiled into the binary
2. **User Preferences** (`~/.kos/config/`) - User customizations
3. **Project Overrides** (`project/.kos/config/`) - Project-specific settings

Configuration is loaded in order, with later tiers overriding earlier ones.

### Rust API

```rust
use k_os_config::registry::GLOBAL_CONFIG;

// Get a brush configuration
let brush = GLOBAL_CONFIG.read().get_brush("standard");

// List all export formats
let formats = GLOBAL_CONFIG.read().list_export_formats();

// Get viewport preset
let preset = GLOBAL_CONFIG.read().get_viewport_preset("sculpting");
```

### TypeScript API

```typescript
import { invoke } from '@tauri-apps/api';

// Get all brushes
const brushes = await invoke('list_config_brushes');

// Get specific export format
const format = await invoke('get_config_export_format', { id: 'gltf' });

// Get viewport presets
const presets = await invoke('list_config_viewport_presets');
```

### Hot-Reload

During development, configuration files are watched for changes and automatically reloaded:

```rust
// Reload configuration (development only)
invoke('reload_config', { projectDir: '/path/to/project' });
```

## Customization

### User Customization

Users can create custom configurations in `~/.kos/config/`:

```bash
~/.kos/config/
├── brushes.json          # Custom brushes
├── export_formats.json   # Custom export formats
├── viewport_presets.json # Custom viewport presets
└── greeble_patterns.json # Custom greeble patterns
```

### Project-Specific Configuration

Projects can override settings in `project/.kos/config/`:

```bash
my_project.kos/
└── .kos/
    └── config/
        ├── brushes.json          # Project-specific brushes
        └── viewport_presets.json # Project-specific presets
```

## Validation

All configuration files are validated against their JSON Schema before loading. Invalid configurations will be rejected with detailed error messages including:
- File path
- Line and column number
- Validation error description

## Schema Generation

The JSON Schemas in this directory are manually maintained but should match the Rust type definitions in `../types.rs`. The Rust types use `schemars` to derive JSON Schema at compile time for validation.

## Adding New Configuration Types

To add a new configuration type:

1. Define the Rust type in `../types.rs` with `#[derive(Serialize, Deserialize, JsonSchema)]`
2. Create a JSON Schema file: `{name}.schema.json`
3. Create default data file: `{name}.json`
4. Add registry methods in `../registry.rs`
5. Add loader support in `../loader.rs`
6. Update this README

## References

- [JSON Schema Specification](https://json-schema.org/)
- [Configuration Registry](../registry.rs)
- [Configuration Loader](../loader.rs)
- [Configuration Types](../types.rs)
