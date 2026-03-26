# Animation Preset Schema Documentation

## Overview

The `animation.schema.json` defines the structure for KAutoPBR animation presets. This schema enables data-driven animation configuration with full support for keyframe, procedural, and physics-based animation types.

## Schema Location

- **File**: `config/autopbr/schemas/animation.schema.json`
- **Schema ID**: `https://k-os.dev/schemas/autopbr/animation.schema.json`
- **Specification**: JSON Schema Draft 7

## Preset Structure

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Preset display name (1-256 chars) |
| `description` | string | Detailed description (max 2048 chars) |
| `duration` | number | Animation duration in seconds (0.1 - 3600.0) |
| `loop_mode` | enum | Loop behavior: `"Once"`, `"Loop"`, or `"PingPong"` |
| `tracks` | array | Array of animation tracks (min 1 track) |

### Optional Metadata Fields

| Field | Type | Description |
|-------|------|-------------|
| `category` | enum | Preset category for organization |
| `tags` | string[] | Searchable tags (max 16 tags, 64 chars each) |
| `author` | string | Author name or organization (max 256 chars) |
| `version` | integer | Version number (min 1) |
| `thumbnail` | string | Path to preview thumbnail image |

### Categories

Presets can be organized into the following categories:
- `Quick Start` - Simple, ready-to-use presets
- `Metal` - Metal-specific animations (rust, corrosion, etc.)
- `Wood` - Wood-specific animations (aging, weathering)
- `Stone` - Stone-specific animations (erosion, cracking)
- `Fabric` - Fabric-specific animations (wind, wear)
- `Organic` - Organic material animations (growth, decay)
- `Sci-Fi` - Science fiction effects (glows, energy)
- `Fantasy` - Fantasy effects (magic, mystical)
- `Effects` - General visual effects
- `Custom` - User-created custom presets

## Animation Tracks

Each track animates a single parameter using one of three animation types:

### Animatable Parameters

- **Color**: `AlbedoColor`, `AlbedoRed`, `AlbedoGreen`, `AlbedoBlue`, `EmissiveColor`
- **Material**: `Roughness`, `Metallic`, `EmissiveIntensity`, `NormalStrength`, `HeightOffset`
- **UV**: `UVOffsetX`, `UVOffsetY`, `UVScaleX`, `UVScaleY`
- **Layer**: `LayerOpacity`, `LayerBlendMode`

### Animation Types

#### 1. Keyframe Animation

Interpolates between keyframes using various interpolation methods.

**Interpolation Types**:
- `Linear` - Straight line between keyframes
- `EaseIn` - Slow start, fast end
- `EaseOut` - Fast start, slow end
- `EaseInOut` - Slow start and end, fast middle
- `Bezier` - Custom curve using tangent control points

**Example**:
```json
{
  "parameter": "EmissiveIntensity",
  "animation_type": {
    "Keyframe": {
      "keyframes": [
        { "time": 0.0, "value": 0.2 },
        { "time": 1.0, "value": 1.0 },
        { "time": 2.0, "value": 0.2 }
      ],
      "interpolation": "EaseInOut"
    }
  }
}
```

#### 2. Procedural Animation

Uses mathematical expressions evaluated at runtime.

**Supported Functions**:
- Trigonometric: `sin`, `cos`, `tan`
- Math: `abs`, `sqrt`, `pow`, `min`, `max`, `clamp`, `lerp`
- Noise: `noise`, `fbm` (Perlin/Simplex noise)
- Variable: `t` (time in seconds)

**Example**:
```json
{
  "parameter": "UVOffsetX",
  "animation_type": {
    "Procedural": {
      "expression": "t * 0.1 + sin(t * 2.0) * 0.05"
    }
  }
}
```

#### 3. Physics Animation

GPU-accelerated physics simulations that modify material maps over time.

**Simulation Types**:
- `RustSpreading` - Oxidation spreading across metal
- `MossGrowth` - Organic growth using reaction-diffusion
- `Erosion` - Surface wear and weathering
- `Weathering` - General material degradation
- `Cracking` - Surface fracture patterns
- `Melting` - Material phase transition

**Example**:
```json
{
  "parameter": "Roughness",
  "animation_type": {
    "Physics": {
      "simulation_type": "RustSpreading"
    }
  }
}
```

## Complete Examples

### Example 1: Pulsing Emissive (Keyframe)

```json
{
  "name": "Pulsing Emissive",
  "description": "Smooth pulsing glow effect ideal for sci-fi interfaces, energy cores, or magical artifacts",
  "category": "Sci-Fi",
  "tags": ["glow", "pulse", "emissive", "sci-fi", "energy"],
  "author": "K_OS Team",
  "version": 1,
  "duration": 2.0,
  "loop_mode": "Loop",
  "tracks": [
    {
      "parameter": "EmissiveIntensity",
      "animation_type": {
        "Keyframe": {
          "keyframes": [
            { "time": 0.0, "value": 0.2 },
            { "time": 1.0, "value": 1.0 },
            { "time": 2.0, "value": 0.2 }
          ],
          "interpolation": "EaseInOut"
        }
      }
    }
  ]
}
```

### Example 2: Flowing Water (Procedural)

```json
{
  "name": "Flowing Water",
  "description": "Continuous UV scrolling with noise variation for realistic water flow",
  "category": "Organic",
  "tags": ["water", "flow", "scroll", "procedural", "nature"],
  "author": "K_OS Team",
  "version": 1,
  "duration": 10.0,
  "loop_mode": "Loop",
  "tracks": [
    {
      "parameter": "UVOffsetX",
      "animation_type": {
        "Procedural": {
          "expression": "t * 0.1"
        }
      }
    },
    {
      "parameter": "UVOffsetY",
      "animation_type": {
        "Procedural": {
          "expression": "sin(t * 0.5) * 0.05"
        }
      }
    },
    {
      "parameter": "NormalStrength",
      "animation_type": {
        "Procedural": {
          "expression": "0.8 + sin(t * 2.0) * 0.2"
        }
      }
    }
  ]
}
```

### Example 3: Multi-Track Complex Animation

```json
{
  "name": "Magical Crystal",
  "description": "Complex multi-parameter animation combining color shifts, pulsing glow, and subtle movement",
  "category": "Fantasy",
  "tags": ["magic", "crystal", "glow", "color-shift", "fantasy"],
  "author": "K_OS Team",
  "version": 1,
  "thumbnail": "thumbnails/magical_crystal.png",
  "duration": 5.0,
  "loop_mode": "Loop",
  "tracks": [
    {
      "parameter": "EmissiveIntensity",
      "animation_type": {
        "Keyframe": {
          "keyframes": [
            { "time": 0.0, "value": 0.5 },
            { "time": 2.5, "value": 1.5 },
            { "time": 5.0, "value": 0.5 }
          ],
          "interpolation": "EaseInOut"
        }
      }
    },
    {
      "parameter": "AlbedoRed",
      "animation_type": {
        "Procedural": {
          "expression": "0.5 + sin(t * 1.26) * 0.3"
        }
      }
    },
    {
      "parameter": "AlbedoBlue",
      "animation_type": {
        "Procedural": {
          "expression": "0.7 + cos(t * 1.26) * 0.3"
        }
      }
    },
    {
      "parameter": "HeightOffset",
      "animation_type": {
        "Procedural": {
          "expression": "sin(t * 2.0) * 0.02"
        }
      }
    }
  ]
}
```

## Usage in Code

### Rust (Backend)

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct AnimationPreset {
    pub name: String,
    pub description: String,
    pub category: Option<String>,
    pub tags: Option<Vec<String>>,
    pub author: Option<String>,
    pub version: Option<u32>,
    pub thumbnail: Option<String>,
    pub duration: f32,
    pub loop_mode: LoopMode,
    pub tracks: Vec<AnimationTrack>,
}

// Load preset from JSON file
let preset_json = std::fs::read_to_string("config/autopbr/animation_presets/pulsing_emissive.json")?;
let preset: AnimationPreset = serde_json::from_str(&preset_json)?;
```

### TypeScript (Frontend)

```typescript
interface AnimationPreset {
  name: string;
  description: string;
  category?: string;
  tags?: string[];
  author?: string;
  version?: number;
  thumbnail?: string;
  duration: number;
  loop_mode: 'Once' | 'Loop' | 'PingPong';
  tracks: AnimationTrack[];
}

// Load preset via Tauri IPC
const preset = await invoke<AnimationPreset>('load_animation_preset', {
  path: 'pulsing_emissive.json'
});
```

## Validation

The schema includes comprehensive validation rules:

- **String lengths**: Names (1-256), descriptions (max 2048), tags (1-64)
- **Numeric ranges**: Duration (0.1-3600.0), version (min 1)
- **Array limits**: Tags (max 16), tracks (min 1), keyframes (min 2)
- **Enum validation**: Categories, loop modes, parameters, interpolation types
- **Required fields**: Enforced at schema level

## Best Practices

1. **Naming**: Use descriptive, searchable names (e.g., "Pulsing Emissive" not "Preset 1")
2. **Tags**: Include 3-8 relevant tags for searchability
3. **Categories**: Choose the most appropriate category for organization
4. **Descriptions**: Explain the effect and suggest use cases
5. **Duration**: Keep presets under 30 seconds unless physics-based
6. **Tracks**: Use 1-4 tracks for most presets; more can impact performance
7. **Expressions**: Keep procedural expressions simple for GPU evaluation
8. **Versioning**: Increment version when making breaking changes

## File Organization

Recommended directory structure:

```
config/autopbr/animation_presets/
├── quick_start/
│   ├── pulsing_emissive.json
│   ├── simple_fade.json
│   └── color_cycle.json
├── sci_fi/
│   ├── energy_core.json
│   ├── hologram_flicker.json
│   └── shield_pulse.json
├── organic/
│   ├── flowing_water.json
│   ├── breathing_effect.json
│   └── wind_sway.json
└── physics/
    ├── rust_spreading.json
    ├── moss_growth.json
    └── erosion.json
```

## Requirements Satisfied

This schema satisfies the following KAutoPBR requirements:

- **Requirement 18.2**: Data-driven animation preset loading from JSON
- **Requirement 18.9**: JSON schema documentation for configuration files
- **Requirement 14.3**: Preset categories for organization
- **Requirement 14.8**: Preset previews (thumbnail field)
- **Requirement 14.9**: Preset search by name or category (tags field)
- **Requirement 14.10**: Preset versioning for tracking updates

## Related Files

- `material.schema.json` - Material definition schema
- `extension.schema.json` - Plugin extension schema
- `lighting_preset.schema.json` - Lighting preset schema
- `crates/k-os-engine/src/material/animation.rs` - Rust implementation
- `src-frontend/features/material/kautopbr/ui/AnimationTimeline.tsx` - UI component
