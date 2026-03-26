# Design Document: DCC Suite Production Readiness

## Overview

This design document outlines the technical architecture and implementation approach for making the K_OS DCC Suite production-ready and shippable. The suite consists of 10+ specialized applications (KSculpt, KPainter, KAtlas, KGraphos, KAutopbr, KGreeble, KTecton, KQuantum, KCloner, KInspect) built on a Tauri v2 architecture with React + TypeScript frontend, Rust backend, and wgpu GPU compute engine.

### Current State

The DCC Suite has significant functionality but suffers from critical blocking issues, system integration gaps, and widespread violations of data-driven architecture principles. Production readiness scores range from 55% (KCloner) to 95% (KAutopbr), with an average of 78%. The goal is to achieve minimum 85% across all apps.

### Critical Issues to Address

**P0 Blockers:**
- Broken export systems in KTecton, KQuantum, KCloner (placeholder stubs)
- AppShell panel flickering during resize (react-resizable-panels)

**P1 Major Issues:**
- Top bar inconsistency (only KSculpt uses AppTopBar)
- Missing Uplink buttons in KQuantum and KInspect
- KSculpt subdivision and masking not wired to UI
- KAtlas missing UV editing tools
- KGraphos needs complete fluid painting overhaul

**Architecture Violations:**
- Hardcoded view modes, brush settings, export formats
- Hardcoded grid/camera/lighting parameters
- Hardcoded greeble patterns
- No centralized configuration registry

### Design Principles

1. **Data-Driven Everything** - Replace all hardcoded values with JSON configuration
2. **GPU-First Performance** - Leverage wgpu compute for all heavy operations
3. **Robust Error Handling** - Graceful degradation and clear error messages
4. **Consistent UX** - Unified AppShell, TopBar, and interaction patterns
5. **Production Quality** - Comprehensive testing, validation, and polish


## Architecture

### System Layers

```
┌─────────────────────────────────────────────────────────────┐
│                    React Frontend Layer                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   AppShell   │  │  DCC Apps    │  │  UI Library  │      │
│  │  (Unified)   │  │  (10+ apps)  │  │ (Radix/Mantine)│    │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                           ↕ Tauri IPC
┌─────────────────────────────────────────────────────────────┐
│                    Tauri Backend Layer                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Commands   │  │    Kernel    │  │ File Ops     │      │
│  │   Registry   │  │  (Assets)    │  │ (GLTF/OBJ)   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                           ↕ Direct Calls
┌─────────────────────────────────────────────────────────────┐
│                   GPU Compute Engine (wgpu)                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Sculpting   │  │  Subdivision │  │  SVT System  │      │
│  │  Pipelines   │  │  Pipeline    │  │  (Painting)  │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                           ↕ UDP (Leash IPC)
┌─────────────────────────────────────────────────────────────┐
│              Optional Bevy Viewport (Native 3D)              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Rendering  │  │   Camera     │  │  Selection   │      │
│  │   Pipeline   │  │   Controls   │  │  System      │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

### Configuration System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  Configuration Registry                      │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Global Defaults (embedded in binary)                │   │
│  │  - Default brushes, tools, export formats            │   │
│  │  - Default viewport settings, camera presets         │   │
│  └──────────────────────────────────────────────────────┘   │
│                           ↓ Override                         │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  User Preferences (~/.kos/config/)                   │   │
│  │  - Custom brushes, modified tool settings            │   │
│  │  - UI preferences, keyboard shortcuts                │   │
│  └──────────────────────────────────────────────────────┘   │
│                           ↓ Override                         │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Project Overrides (project/.kos/config/)            │   │
│  │  - Project-specific settings                         │   │
│  │  - Custom tool configurations for this project       │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
│  Features:                                                    │
│  - Hot-reload during development                             │
│  - JSON Schema validation                                    │
│  - Type-safe Rust deserialization (serde)                   │
│  - Migration system for version changes                      │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow Patterns

**Sculpting Pipeline:**
```
User Input → React Event → Tauri Command → GPU Engine → Buffer Update → Viewport Refresh
     ↓                                           ↓
  Undo Stack                              Normal Recalc
```

**File Export Pipeline:**
```
Export Request → Validation → Format Registry Lookup → Serialization → File Write → Verification
                                      ↓
                              Format-specific options
                              (GLTF/GLB/OBJ/PNG/EXR)
```

**Configuration Loading:**
```
App Start → Load Global Defaults → Load User Prefs → Load Project Config → Merge & Validate
                                                              ↓
                                                    Runtime Config Object
```


## Components and Interfaces

### 1. Unified AppShell Component

**Purpose:** Provide consistent UI layout and behavior across all 10+ DCC applications.

**Location:** `src-frontend/ui/AppShell/`

**Interface:**
```typescript
interface AppShellProps {
  appName: string;
  topBarConfig: TopBarConfig;
  leftPanel?: PanelConfig;
  rightPanel?: PanelConfig;
  bottomPanel?: PanelConfig;
  viewportComponent: React.ComponentType<ViewportProps>;
  onResize?: (layout: LayoutState) => void;
}

interface TopBarConfig {
  showFileMenu: boolean;
  showEditMenu: boolean;
  showViewMenu: boolean;
  showUplinkButton: boolean;
  customActions?: TopBarAction[];
  projectName?: string;
  hasUnsavedChanges: boolean;
}

interface PanelConfig {
  title: string;
  defaultWidth?: number;
  minWidth?: number;
  maxWidth?: number;
  collapsible: boolean;
  content: React.ComponentType;
}
```

**Key Features:**
- Replace `react-resizable-panels` with custom resize implementation to fix flickering
- Use CSS transforms for smooth resizing without triggering viewport re-renders
- Implement resize debouncing (16ms) to maintain 60fps
- Save panel layout to localStorage with per-app keys
- Provide consistent keyboard shortcuts (Ctrl+K for command palette)

**Implementation Strategy:**
- Create `ResizeHandle` component with pointer events (not mouse events)
- Use `requestAnimationFrame` for smooth resize updates
- Implement `useLayoutPreferences` hook for persistence
- Ensure all apps migrate from custom layouts to AppShell

### 2. AppTopBar Component

**Purpose:** Unified top bar with consistent menus, actions, and Uplink button.

**Location:** `src-frontend/ui/AppTopBar/`

**Interface:**
```typescript
interface AppTopBarProps {
  appName: string;
  projectName?: string;
  hasUnsavedChanges: boolean;
  onSave: () => Promise<void>;
  onExport: () => Promise<void>;
  onUplink?: () => Promise<void>;  // Export to Kernel/Asset Browser
  customMenus?: MenuConfig[];
  viewModes?: ViewModeConfig[];
}

interface ViewModeConfig {
  id: string;
  label: string;
  icon: string;
  shortcut?: string;
}
```

**Current Issues:**
- Only KSculpt uses AppTopBar
- Other apps have custom implementations with glitchy spacing
- KQuantum and KInspect missing Uplink button

**Fix Strategy:**
- Refactor all apps to use AppTopBar
- Add Uplink button to KQuantum and KInspect
- Fix spacing with consistent Tailwind classes
- Implement responsive overflow menu for narrow screens

### 3. Configuration Registry System

**Purpose:** Centralized, data-driven configuration for all app settings.

**Location:** 
- Rust: `crates/k-os-engine/src/config/`
- TypeScript: `src-frontend/config/`

**Rust Interface:**
```rust
pub struct ConfigRegistry {
    brushes: BrushRegistry,
    tools: ToolRegistry,
    export_formats: ExportFormatRegistry,
    viewport_presets: ViewportPresetRegistry,
    greeble_patterns: GreeblePatternRegistry,
}

#[derive(Deserialize, Serialize, JsonSchema)]
pub struct BrushConfig {
    pub id: String,
    pub name: String,
    pub category: BrushCategory,
    pub default_size: f32,
    pub default_strength: f32,
    pub supports_pressure: bool,
    pub gpu_shader: Option<String>,
    pub icon: String,
}

#[derive(Deserialize, Serialize, JsonSchema)]
pub struct ExportFormatConfig {
    pub id: String,
    pub name: String,
    pub extensions: Vec<String>,
    pub supports_meshes: bool,
    pub supports_textures: bool,
    pub supports_materials: bool,
    pub options: Vec<ExportOption>,
}

#[derive(Deserialize, Serialize, JsonSchema)]
pub struct ViewportPresetConfig {
    pub id: String,
    pub name: String,
    pub grid_size: f32,
    pub grid_divisions: u32,
    pub camera_distance: f32,
    pub camera_fov: f32,
    pub lighting: LightingConfig,
}
```

**TypeScript Interface:**
```typescript
interface ConfigRegistry {
  brushes: BrushConfig[];
  tools: ToolConfig[];
  exportFormats: ExportFormatConfig[];
  viewportPresets: ViewportPresetConfig[];
  greeblePatterns: GreeblePatternConfig[];
}

// Load configuration with inheritance
async function loadConfig(): Promise<ConfigRegistry> {
  const defaults = await loadEmbeddedDefaults();
  const userPrefs = await loadUserPreferences();
  const projectConfig = await loadProjectConfig();
  return mergeConfigs(defaults, userPrefs, projectConfig);
}
```

**Configuration Files:**
```
~/.kos/config/
├── brushes.json          # User custom brushes
├── tools.json            # User tool preferences
├── export_formats.json   # User export presets
├── viewport.json         # User viewport preferences
└── keyboard.json         # User keyboard shortcuts

project/.kos/config/
├── brushes.json          # Project-specific brushes
└── settings.json         # Project settings
```

**Hot-Reload Implementation:**
- Use `notify` crate for file watching in Rust
- Emit Tauri event on config change
- React components subscribe to config updates
- Validate with JSON Schema before applying

### 4. Export System

**Purpose:** Unified, format-agnostic export system with validation.

**Location:** `crates/k-os-engine/src/export/`

**Interface:**
```rust
pub trait ExportFormat {
    fn id(&self) -> &str;
    fn extensions(&self) -> &[String];
    fn validate(&self, scene: &Scene) -> Result<(), ExportError>;
    fn export(&self, scene: &Scene, path: &Path, options: &ExportOptions) 
        -> Result<(), ExportError>;
}

pub struct ExportRegistry {
    formats: HashMap<String, Box<dyn ExportFormat>>,
}

impl ExportRegistry {
    pub fn register(&mut self, format: Box<dyn ExportFormat>) {
        self.formats.insert(format.id().to_string(), format);
    }
    
    pub fn export(&self, format_id: &str, scene: &Scene, path: &Path) 
        -> Result<(), ExportError> {
        let format = self.formats.get(format_id)
            .ok_or(ExportError::UnknownFormat)?;
        format.validate(scene)?;
        format.export(scene, path, &ExportOptions::default())
    }
}
```

**Implementations:**
- `GltfExportFormat` - GLTF/GLB with embedded textures
- `ObjExportFormat` - OBJ + MTL with external textures
- `HeightmapExportFormat` - PNG/EXR heightmaps for terrain
- `ParticleExportFormat` - Custom format for KQuantum
- `CloneArrayExportFormat` - Instance data for KCloner

**Fix Strategy for Broken Exports:**
1. **KTecton** (lines 410-412): Implement terrain mesh + heightmap export
2. **KQuantum** (lines 87-98): Implement particle system serialization
3. **KCloner** (lines 692-698): Implement clone instance array export

### 5. GPU Compute Pipelines

**Purpose:** High-performance GPU operations for sculpting, subdivision, painting.

**Location:** `crates/k-os-engine/src/gpu/pipelines/`

**Key Pipelines:**

**Sculpting Pipeline:**
```rust
pub struct SculptPipeline {
    device: Arc<wgpu::Device>,
    queue: Arc<wgpu::Queue>,
    brush_pipeline: wgpu::ComputePipeline,
    normal_pipeline: wgpu::ComputePipeline,
}

impl SculptPipeline {
    pub fn apply_brush(
        &self,
        mesh: &mut GpuMesh,
        brush: &BrushConfig,
        stroke: &BrushStroke,
        mask: Option<&MaskBuffer>,
    ) -> Result<(), GpuError> {
        // GPU compute shader applies brush modifications
        // Respects mask if provided
        // Updates normals in same pass
    }
}
```

**Subdivision Pipeline:**
```rust
pub struct SubdivisionPipeline {
    catmull_clark_pipeline: wgpu::ComputePipeline,
}

impl SubdivisionPipeline {
    pub fn subdivide(
        &self,
        mesh: &GpuMesh,
        levels: u32,
    ) -> Result<GpuMesh, GpuError> {
        // GPU Catmull-Clark subdivision
        // Already exists, needs UI wiring
    }
}
```

**SVT (Sparse Virtual Texture) Pipeline:**
```rust
pub struct SvtPipeline {
    page_table: GpuBuffer,
    physical_cache: GpuTexture,
    tile_size: u32,
    virtual_resolution: u32,
}

impl SvtPipeline {
    pub fn paint(
        &mut self,
        uv: Vec2,
        brush: &PaintBrush,
        color: Vec4,
    ) -> Result<(), GpuError> {
        // Allocate tiles on-demand
        // Update page table
        // Paint to physical cache
    }
}
```

### 6. File Operations System

**Purpose:** Robust file import/export with validation and progress tracking.

**Location:** `crates/k-os-engine/src/file_ops/`

**Interface:**
```rust
pub struct FileOpsManager {
    import_handlers: HashMap<String, Box<dyn ImportHandler>>,
    export_registry: ExportRegistry,
}

pub trait ImportHandler {
    fn supported_extensions(&self) -> &[String];
    fn import(&self, path: &Path) -> Result<Scene, ImportError>;
    fn validate(&self, path: &Path) -> Result<(), ImportError>;
}

impl FileOpsManager {
    pub async fn import_with_progress(
        &self,
        path: &Path,
        progress_callback: impl Fn(f32),
    ) -> Result<Scene, ImportError> {
        // Validate file
        // Stream import with progress
        // Return scene
    }
    
    pub async fn export_with_progress(
        &self,
        scene: &Scene,
        format: &str,
        path: &Path,
        progress_callback: impl Fn(f32),
    ) -> Result<(), ExportError> {
        // Validate scene
        // Export with progress
        // Verify output
    }
}
```

**Supported Formats:**
- Import: GLTF, GLB, OBJ, FBX (via external lib), PNG, JPG, EXR
- Export: GLTF, GLB, OBJ, PNG, JPG, EXR, heightmaps

### 7. Integration Testing Framework

**Purpose:** Automated testing of multi-system interactions.

**Location:** `crates/k-os-engine/tests/integration/`

**Test Structure:**
```rust
#[tokio::test]
async fn test_sculpt_export_roundtrip() {
    // Create mesh
    let mesh = create_test_mesh();
    
    // Apply sculpting
    let sculpted = apply_test_sculpt(&mesh).await;
    
    // Export to GLTF
    let path = temp_dir().join("test.gltf");
    export_gltf(&sculpted, &path).await.unwrap();
    
    // Re-import
    let imported = import_gltf(&path).await.unwrap();
    
    // Verify mesh integrity
    assert_mesh_equivalent(&sculpted, &imported);
}

#[tokio::test]
async fn test_svt_painting_persistence() {
    // Create SVT texture
    // Paint strokes
    // Export texture
    // Re-import
    // Verify painted regions
}
```

**Test Categories:**
- IPC communication tests
- GPU compute correctness tests
- File import/export roundtrip tests
- Undo/redo state management tests
- Cross-app Kernel integration tests


## Data Models

### Configuration Schema

**Brush Configuration:**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "id": { "type": "string" },
    "name": { "type": "string" },
    "category": { 
      "type": "string",
      "enum": ["sculpt", "paint", "mask", "smooth"]
    },
    "defaultSize": { "type": "number", "minimum": 1, "maximum": 512 },
    "defaultStrength": { "type": "number", "minimum": 0, "maximum": 1 },
    "supportsPressure": { "type": "boolean" },
    "gpuShader": { "type": "string" },
    "icon": { "type": "string" },
    "parameters": {
      "type": "object",
      "additionalProperties": {
        "type": "object",
        "properties": {
          "type": { "enum": ["float", "int", "bool", "color"] },
          "default": {},
          "min": { "type": "number" },
          "max": { "type": "number" }
        }
      }
    }
  },
  "required": ["id", "name", "category"]
}
```

**Export Format Configuration:**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "id": { "type": "string" },
    "name": { "type": "string" },
    "extensions": { 
      "type": "array",
      "items": { "type": "string" }
    },
    "supportsMeshes": { "type": "boolean" },
    "supportsTextures": { "type": "boolean" },
    "supportsMaterials": { "type": "boolean" },
    "options": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": { "type": "string" },
          "label": { "type": "string" },
          "type": { "enum": ["bool", "int", "float", "enum"] },
          "default": {},
          "values": { "type": "array" }
        }
      }
    }
  },
  "required": ["id", "name", "extensions"]
}
```

**Viewport Preset Configuration:**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "id": { "type": "string" },
    "name": { "type": "string" },
    "gridSize": { "type": "number", "minimum": 0.1 },
    "gridDivisions": { "type": "integer", "minimum": 1 },
    "cameraDistance": { "type": "number", "minimum": 1 },
    "cameraFov": { "type": "number", "minimum": 10, "maximum": 120 },
    "lighting": {
      "type": "object",
      "properties": {
        "ambient": { "type": "number", "minimum": 0, "maximum": 1 },
        "directional": {
          "type": "object",
          "properties": {
            "intensity": { "type": "number" },
            "direction": { 
              "type": "array",
              "items": { "type": "number" },
              "minItems": 3,
              "maxItems": 3
            }
          }
        }
      }
    }
  },
  "required": ["id", "name"]
}
```

**Greeble Pattern Configuration:**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "id": { "type": "string" },
    "name": { "type": "string" },
    "category": { "type": "string" },
    "primitives": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "type": { "enum": ["box", "cylinder", "sphere", "custom"] },
          "probability": { "type": "number", "minimum": 0, "maximum": 1 },
          "scaleRange": {
            "type": "object",
            "properties": {
              "min": { "type": "array", "items": { "type": "number" } },
              "max": { "type": "array", "items": { "type": "number" } }
            }
          }
        }
      }
    }
  },
  "required": ["id", "name", "primitives"]
}
```

### Scene Data Model

**Unified Scene Representation:**
```rust
pub struct Scene {
    pub objects: Vec<SceneObject>,
    pub materials: Vec<Material>,
    pub textures: Vec<Texture>,
    pub metadata: SceneMetadata,
}

pub struct SceneObject {
    pub id: Uuid,  // KObjectRegistry ID
    pub name: String,
    pub mesh: Option<MeshHandle>,
    pub material: Option<MaterialHandle>,
    pub transform: Transform,
    pub metadata: HashMap<String, serde_json::Value>,
}

pub struct Material {
    pub id: Uuid,
    pub name: String,
    pub pbr: PbrMaterial,
}

pub struct PbrMaterial {
    pub albedo: Option<TextureHandle>,
    pub normal: Option<TextureHandle>,
    pub roughness: Option<TextureHandle>,
    pub metallic: Option<TextureHandle>,
    pub ao: Option<TextureHandle>,
    pub height: Option<TextureHandle>,
    pub base_color: [f32; 4],
    pub roughness_factor: f32,
    pub metallic_factor: f32,
}
```

### GPU Buffer Layouts

**Mesh Buffer Layout:**
```rust
pub struct GpuMesh {
    pub vertex_buffer: wgpu::Buffer,  // [position, normal, uv, color]
    pub index_buffer: wgpu::Buffer,
    pub vertex_count: u32,
    pub index_count: u32,
}

// Vertex layout (32 bytes, aligned)
#[repr(C)]
#[derive(Copy, Clone, bytemuck::Pod, bytemuck::Zeroable)]
pub struct Vertex {
    pub position: [f32; 3],
    pub normal: [f32; 3],
    pub uv: [f32; 2],
}
```

**Brush Stroke Data:**
```rust
#[repr(C)]
#[derive(Copy, Clone, bytemuck::Pod, bytemuck::Zeroable)]
pub struct BrushStroke {
    pub center: [f32; 3],
    pub radius: f32,
    pub strength: f32,
    pub falloff: f32,
    pub _padding: [f32; 2],  // 16-byte alignment
}
```

**SVT Page Table:**
```rust
pub struct SvtPageTable {
    pub entries: Vec<PageTableEntry>,
    pub virtual_resolution: u32,
    pub tile_size: u32,
    pub physical_cache_size: u32,
}

#[repr(C)]
#[derive(Copy, Clone)]
pub struct PageTableEntry {
    pub physical_x: u16,
    pub physical_y: u16,
    pub mip_level: u8,
    pub is_resident: u8,
    pub lru_timestamp: u32,
}
```

### Project File Structure

```
project_name.kos/
├── manifest.json              # Project metadata
├── content/
│   ├── meshes/
│   │   ├── {uuid}.mesh       # Binary mesh data
│   │   └── {uuid}.meta.json  # Mesh metadata
│   ├── textures/
│   │   ├── {uuid}.png
│   │   └── {uuid}.meta.json
│   └── materials/
│       └── {uuid}.mat.json
├── .kos/
│   ├── config/               # Project-specific config
│   ├── cache/                # Computed data cache
│   └── backups/              # Auto-save backups
└── exports/                  # Export output directory
```

**Manifest Schema:**
```json
{
  "version": "1.0.0",
  "name": "My Project",
  "created": "2024-01-01T00:00:00Z",
  "modified": "2024-01-02T00:00:00Z",
  "apps": {
    "ksculpt": {
      "activeObject": "uuid-here",
      "subdivisionLevel": 2
    },
    "kpainter": {
      "activeTexture": "uuid-here",
      "svtResolution": 8192
    }
  },
  "objects": [
    {
      "id": "uuid-here",
      "name": "Character Head",
      "type": "mesh",
      "app": "ksculpt",
      "file": "content/meshes/uuid-here.mesh"
    }
  ]
}
```


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property Reflection

After analyzing all acceptance criteria, I identified the following testable properties and performed redundancy elimination:

**Redundancies Eliminated:**
- Property "GLTF import preserves hierarchy" (4.5) is subsumed by "GLTF round-trip preserves data" (4.1)
- Property "SVT painting near tile boundaries is seamless" (7.11) is subsumed by "SVT painting produces no artifacts" (2.5)
- Property "GPU subdivision matches CPU" (15.1) is the same as property 11.2
- Properties about storage subdirectories (6.3-6.5) are covered by "project directory structure is correct" (6.2)

**Properties Combined:**
- GPU correctness properties (11.2, 11.3, 11.4) can be tested together as "GPU operations match CPU reference"
- File round-trip properties (4.1, 4.3, 4.4) can be unified as "file format round-trips preserve data"
- Configuration validation properties (19.11, 19.12) can be combined as "configuration validation catches errors"

### Property 1: Undo/Redo Round-Trip

*For any* sequence of operations followed by the same number of undo operations, the system state should be identical to the initial state.

**Validates: Requirements 2.2**

### Property 2: App State Isolation

*For any* app state and any sequence of app switches, returning to the original app should show the same state as before switching.

**Validates: Requirements 2.3**

### Property 3: SVT Painting Seamlessness

*For any* painting operation that crosses tile boundaries in the SVT system, the resulting texture should have no visible seams or artifacts at tile edges.

**Validates: Requirements 2.5, 7.11**

### Property 4: GPU Normal Calculation Correctness

*For any* mesh and any sculpting operation, GPU-calculated normals should be equivalent to CPU-calculated normals within floating-point epsilon.

**Validates: Requirements 2.6**

### Property 5: Symmetry Preservation

*For any* symmetric operation (X, Y, Z, or radial symmetry), the resulting mesh should be perfectly symmetric with no offset errors.

**Validates: Requirements 2.7**

### Property 6: Cross-App Asset Availability

*For any* asset created in any app, that asset should be retrievable from any other app via KObjectRegistry with the same ID and data.

**Validates: Requirements 3.2**

### Property 7: File Format Round-Trip Preservation

*For any* valid scene exported to GLTF/GLB/OBJ format and then re-imported, the mesh data, hierarchy, materials, and KObjectRegistry IDs should be preserved.

**Validates: Requirements 4.1, 4.3, 4.5, 4.6**

### Property 8: Texture Round-Trip Preservation

*For any* valid texture exported to PNG/JPG/EXR format and then re-imported, the image data should be preserved within acceptable lossy compression bounds (lossless for PNG/EXR).

**Validates: Requirements 4.4**

### Property 9: Invalid File Rejection

*For any* invalid or corrupted file, the import system should reject it with an error message rather than crashing or producing corrupted data.

**Validates: Requirements 4.9**

### Property 10: Export Resolution Support

*For any* texture resolution in the range [512, 8192] pixels, export should succeed and produce a texture of the requested resolution.

**Validates: Requirements 4.10**

### Property 11: Batch Export Equivalence

*For any* list of assets, batch export should produce identical results to exporting each asset individually.

**Validates: Requirements 4.11**

### Property 12: Project Directory Structure

*For any* newly created project, the directory structure should match the expected schema with meshes/, textures/, materials/, and .kos/ subdirectories.

**Validates: Requirements 6.2, 6.3, 6.4, 6.5**

### Property 13: Project Manifest Validity

*For any* saved project, the manifest.json file should be valid JSON that validates against the project manifest schema.

**Validates: Requirements 6.6**

### Property 14: Backup Creation

*For any* save operation, a backup file should be created in the .kos/backups/ directory with a timestamp.

**Validates: Requirements 6.7**

### Property 15: Project Integrity Validation

*For any* corrupted or invalid project file, opening the project should fail with a validation error rather than loading corrupted data.

**Validates: Requirements 6.11**

### Property 16: Project Archive Round-Trip

*For any* project exported to .kos archive format and then re-imported, all project data (meshes, textures, materials, metadata) should be preserved.

**Validates: Requirements 6.12**

### Property 17: SVT Tile Allocation

*For any* painting operation on a previously unpainted region, the SVT system should allocate tiles on-demand and make them available for subsequent operations.

**Validates: Requirements 7.2**

### Property 18: SVT Channel Independence

*For any* PBR channel (albedo, normal, roughness, metallic, AO, height), painting on one channel should not affect data in other channels.

**Validates: Requirements 7.6, 7.7**

### Property 19: SVT Undo/Redo

*For any* painting operation followed by undo, the texture should return to its previous state, and redo should restore the painted state.

**Validates: Requirements 7.8**

### Property 20: SVT Export Compositing

*For any* painted SVT texture exported to a standard format and re-imported, the painted data should be preserved (round-trip).

**Validates: Requirements 7.9**

### Property 21: SVT Brush Size Support

*For any* brush size in the range [1, 512] pixels, painting should work correctly without artifacts or errors.

**Validates: Requirements 7.12**

### Property 22: GPU Subdivision Equivalence

*For any* mesh, GPU Catmull-Clark subdivision should produce a mesh topologically and geometrically equivalent to CPU Catmull-Clark subdivision.

**Validates: Requirements 11.2, 15.1**

### Property 23: GPU Sculpting Equivalence

*For any* mesh and brush stroke, GPU sculpting should produce vertex positions and normals equivalent to CPU sculpting within floating-point epsilon.

**Validates: Requirements 11.3**

### Property 24: GPU Normal Recalculation Equivalence

*For any* mesh, GPU normal recalculation should produce normals identical to CPU normal recalculation within floating-point epsilon.

**Validates: Requirements 11.4**

### Property 25: GPU Degenerate Mesh Handling

*For any* mesh containing degenerate triangles or zero-area faces, GPU operations should complete without crashing and produce valid output (even if the output is an error result).

**Validates: Requirements 11.5**

### Property 26: GPU Buffer Validation

*For any* GPU operation with invalid buffer sizes (too large, too small, misaligned), the system should reject the operation with an error before GPU dispatch.

**Validates: Requirements 11.7**

### Property 27: GLTF Export Completeness

*For any* scene exported to GLTF, the output file should contain all meshes, materials, and textures from the scene.

**Validates: Requirements 14.1**

### Property 28: GLTF Export Validity

*For any* scene exported to GLTF, the output file should be valid GLTF that passes schema validation.

**Validates: Requirements 14.2**

### Property 29: 3D Print Mesh Validation

*For any* mesh exported for 3D printing, the mesh should pass manifold and watertight validation checks.

**Validates: Requirements 14.11**

### Property 30: Subdivision UV Preservation

*For any* mesh with UV coordinates, subdivision should preserve UV topology (no UV seams introduced).

**Validates: Requirements 15.5**

### Property 31: Subdivision Vertex Color Preservation

*For any* mesh with vertex colors, subdivision should interpolate vertex colors smoothly without introducing color discontinuities.

**Validates: Requirements 15.6**

### Property 32: Mask Prevents Sculpting

*For any* masked region on a mesh, sculpting operations should not modify vertices in the masked region.

**Validates: Requirements 17.2, 17.3**

### Property 33: Mask Extraction Correctness

*For any* mask on a mesh, extracting the mask should create a new mesh containing exactly the masked vertices and their connected faces.

**Validates: Requirements 17.4**

### Property 34: Configuration Hot-Reload

*For any* configuration file change during development, hot-reload should apply the change without requiring application restart.

**Validates: Requirements 19.10**

### Property 35: Configuration Validation

*For any* invalid configuration file (malformed JSON, schema violations), the system should reject it with detailed validation errors including line numbers.

**Validates: Requirements 19.11, 19.12**

### Property 36: Configuration Default Fallback

*For any* missing configuration file, the system should use embedded default values and continue operating normally.

**Validates: Requirements 19.13**


## Error Handling

### Error Categories

**1. User Input Errors**
- Invalid file formats
- Corrupted files
- Out-of-range parameters
- Invalid configuration

**Strategy:** Validate early, provide clear error messages with recovery suggestions, never crash.

**2. System Resource Errors**
- Out of memory
- GPU device loss
- Disk full
- File permission denied

**Strategy:** Graceful degradation, fallback to CPU when GPU fails, prompt user for action when disk full.

**3. Internal Logic Errors**
- Assertion failures
- Unexpected state
- Algorithm failures

**Strategy:** Log detailed error context, attempt recovery, provide bug report mechanism.

**4. External Dependency Errors**
- Missing external libraries (Instant Meshes)
- Python sidecar unavailable
- Bevy viewport connection lost

**Strategy:** Detect at startup, provide clear installation instructions, degrade gracefully.

### Error Handling Patterns

**Result Types (Rust):**
```rust
pub enum DccError {
    FileNotFound(PathBuf),
    InvalidFormat { path: PathBuf, reason: String },
    GpuError(GpuError),
    ValidationError { field: String, message: String },
    InternalError(String),
}

impl DccError {
    pub fn user_message(&self) -> String {
        match self {
            Self::FileNotFound(path) => {
                format!("File not found: {}\nPlease check the file path.", path.display())
            }
            Self::InvalidFormat { path, reason } => {
                format!("Invalid file format: {}\n{}\nSupported formats: GLTF, GLB, OBJ, PNG, JPG, EXR", 
                    path.display(), reason)
            }
            Self::GpuError(e) => {
                format!("GPU operation failed: {}\nFalling back to CPU implementation.", e)
            }
            Self::ValidationError { field, message } => {
                format!("Validation error in {}: {}", field, message)
            }
            Self::InternalError(msg) => {
                format!("Internal error: {}\nPlease report this bug.", msg)
            }
        }
    }
    
    pub fn recovery_action(&self) -> Option<RecoveryAction> {
        match self {
            Self::FileNotFound(_) => Some(RecoveryAction::PromptForFile),
            Self::InvalidFormat { .. } => Some(RecoveryAction::ShowFormatHelp),
            Self::GpuError(_) => Some(RecoveryAction::FallbackToCpu),
            _ => None,
        }
    }
}
```

**Error Boundaries (React):**
```typescript
class DccErrorBoundary extends React.Component<Props, State> {
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log to error reporting service
    logError(error, errorInfo);
    
    // Show user-friendly error UI
    this.setState({
      hasError: true,
      error: error,
      errorInfo: errorInfo,
    });
  }
  
  render() {
    if (this.state.hasError) {
      return (
        <ErrorDisplay
          error={this.state.error}
          onReset={() => this.setState({ hasError: false })}
          onReport={() => reportBug(this.state.error, this.state.errorInfo)}
        />
      );
    }
    return this.props.children;
  }
}
```

**GPU Error Handling:**
```rust
impl GpuEngine {
    pub fn execute_with_fallback<T>(
        &self,
        gpu_op: impl FnOnce() -> Result<T, GpuError>,
        cpu_fallback: impl FnOnce() -> T,
    ) -> T {
        match gpu_op() {
            Ok(result) => result,
            Err(e) => {
                warn!("GPU operation failed: {}, falling back to CPU", e);
                cpu_fallback()
            }
        }
    }
}
```

### Critical Error Scenarios

**1. Export System Failures (P0 Fix)**

Current state: KTecton, KQuantum, KCloner have placeholder stubs that silently fail.

Fix:
```rust
// Before (KTecton lines 410-412)
async fn export_terrain() {
    // TODO: Implement export
}

// After
async fn export_terrain(terrain: &Terrain, path: &Path) -> Result<(), ExportError> {
    // Validate terrain
    if terrain.vertices.is_empty() {
        return Err(ExportError::EmptyMesh);
    }
    
    // Export mesh
    let mesh = terrain.to_mesh();
    export_gltf(&mesh, path)?;
    
    // Export heightmap
    let heightmap_path = path.with_extension("png");
    export_heightmap(&terrain.heightmap, &heightmap_path)?;
    
    Ok(())
}
```

**2. Panel Flickering (P0 Fix)**

Current state: react-resizable-panels causes rapid re-renders during resize.

Fix: Replace with custom resize implementation using CSS transforms:
```typescript
function useResizablePanel(initialWidth: number) {
  const [width, setWidth] = useState(initialWidth);
  const [isDragging, setIsDragging] = useState(false);
  const rafRef = useRef<number>();
  
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;
    
    // Cancel previous frame
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }
    
    // Schedule update for next frame
    rafRef.current = requestAnimationFrame(() => {
      setWidth(e.clientX);
    });
  }, [isDragging]);
  
  return { width, isDragging, setIsDragging, handleMouseMove };
}
```

**3. Memory Leaks (P1 Fix)**

Current state: KCloner doesn't dispose geometries on mode change.

Fix:
```typescript
function KCloner() {
  const geometriesRef = useRef<THREE.BufferGeometry[]>([]);
  
  const changeMode = useCallback((newMode: CloneMode) => {
    // Dispose all previous geometries
    geometriesRef.current.forEach(geo => geo.dispose());
    geometriesRef.current = [];
    
    // Create new geometries for new mode
    const newGeometries = createGeometriesForMode(newMode);
    geometriesRef.current = newGeometries;
  }, []);
  
  useEffect(() => {
    // Cleanup on unmount
    return () => {
      geometriesRef.current.forEach(geo => geo.dispose());
    };
  }, []);
}
```

### Error Logging and Reporting

**Structured Logging:**
```rust
use tracing::{error, warn, info, debug};

#[instrument(skip(mesh))]
pub fn subdivide_mesh(mesh: &Mesh, levels: u32) -> Result<Mesh, SubdivisionError> {
    info!("Starting subdivision with {} levels", levels);
    
    if mesh.vertices.is_empty() {
        error!("Cannot subdivide empty mesh");
        return Err(SubdivisionError::EmptyMesh);
    }
    
    if levels > 5 {
        warn!("Subdivision level {} is very high, may cause performance issues", levels);
    }
    
    debug!("Mesh has {} vertices, {} faces", mesh.vertices.len(), mesh.faces.len());
    
    // ... subdivision logic
}
```

**Error Reporting UI:**
- Collect error context (stack trace, system info, recent actions)
- Allow user to add description
- Generate bug report with all context
- Optionally submit to issue tracker


## Testing Strategy

### Dual Testing Approach

The testing strategy employs both unit tests and property-based tests as complementary approaches:

**Unit Tests:**
- Specific examples demonstrating correct behavior
- Edge cases and boundary conditions
- Integration points between components
- Error conditions and recovery

**Property-Based Tests:**
- Universal properties that hold for all inputs
- Comprehensive input coverage through randomization
- Catch unexpected edge cases through fuzzing
- Validate correctness properties from design document

Both are necessary for comprehensive coverage. Unit tests catch concrete bugs and document expected behavior. Property tests verify general correctness and find edge cases that humans might miss.

### Property-Based Testing Configuration

**Library Selection:**
- Rust: `proptest` crate (mature, well-integrated with cargo test)
- TypeScript: `fast-check` library (QuickCheck-style for JavaScript/TypeScript)

**Configuration:**
- Minimum 100 iterations per property test (due to randomization)
- Configurable via environment variable: `PROPTEST_CASES=1000` for CI
- Each property test must reference its design document property
- Tag format: `Feature: dcc-suite-production-readiness, Property {number}: {property_text}`

**Example Property Test (Rust):**
```rust
use proptest::prelude::*;

proptest! {
    #![proptest_config(ProptestConfig::with_cases(100))]
    
    /// Feature: dcc-suite-production-readiness, Property 1: Undo/Redo Round-Trip
    /// For any sequence of operations followed by the same number of undo operations,
    /// the system state should be identical to the initial state.
    #[test]
    fn test_undo_redo_roundtrip(
        operations in prop::collection::vec(any::<Operation>(), 1..20)
    ) {
        let mut state = State::new();
        let initial_state = state.clone();
        
        // Apply operations
        for op in &operations {
            state.apply(op);
        }
        
        // Undo all operations
        for _ in 0..operations.len() {
            state.undo();
        }
        
        // State should match initial
        prop_assert_eq!(state, initial_state);
    }
    
    /// Feature: dcc-suite-production-readiness, Property 7: File Format Round-Trip Preservation
    /// For any valid scene exported to GLTF and re-imported, the data should be preserved.
    #[test]
    fn test_gltf_roundtrip(
        scene in arbitrary_scene()
    ) {
        let temp_path = temp_dir().join("test.gltf");
        
        // Export
        export_gltf(&scene, &temp_path).unwrap();
        
        // Re-import
        let imported = import_gltf(&temp_path).unwrap();
        
        // Verify preservation
        prop_assert_eq!(scene.meshes.len(), imported.meshes.len());
        prop_assert_eq!(scene.materials.len(), imported.materials.len());
        
        for (original, imported) in scene.meshes.iter().zip(imported.meshes.iter()) {
            prop_assert_eq!(original.vertices.len(), imported.vertices.len());
            prop_assert_eq!(original.name, imported.name);
        }
    }
}

// Arbitrary generators for property testing
fn arbitrary_scene() -> impl Strategy<Value = Scene> {
    (
        prop::collection::vec(arbitrary_mesh(), 1..10),
        prop::collection::vec(arbitrary_material(), 1..5),
    ).prop_map(|(meshes, materials)| Scene { meshes, materials, ..Default::default() })
}

fn arbitrary_mesh() -> impl Strategy<Value = Mesh> {
    (
        prop::collection::vec(arbitrary_vertex(), 3..1000),
        prop::collection::vec(arbitrary_face(), 1..500),
        "[a-z]{3,10}",  // mesh name
    ).prop_map(|(vertices, faces, name)| Mesh { vertices, faces, name, ..Default::default() })
}
```

**Example Property Test (TypeScript):**
```typescript
import fc from 'fast-check';

describe('DCC Suite Production Readiness', () => {
  /**
   * Feature: dcc-suite-production-readiness, Property 2: App State Isolation
   * For any app state and any sequence of app switches, returning to the original app
   * should show the same state as before switching.
   */
  it('preserves app state across switches', () => {
    fc.assert(
      fc.property(
        fc.record({
          appName: fc.constantFrom('ksculpt', 'kpainter', 'katlas'),
          state: fc.anything(),
        }),
        fc.array(fc.constantFrom('ksculpt', 'kpainter', 'katlas'), { minLength: 1, maxLength: 10 }),
        (initialApp, switchSequence) => {
          const appManager = new AppManager();
          
          // Set initial state
          appManager.switchTo(initialApp.appName);
          appManager.setState(initialApp.state);
          const initialState = appManager.getState();
          
          // Perform app switches
          for (const targetApp of switchSequence) {
            appManager.switchTo(targetApp);
          }
          
          // Return to original app
          appManager.switchTo(initialApp.appName);
          const finalState = appManager.getState();
          
          // State should be preserved
          expect(finalState).toEqual(initialState);
        }
      ),
      { numRuns: 100 }
    );
  });
  
  /**
   * Feature: dcc-suite-production-readiness, Property 35: Configuration Validation
   * For any invalid configuration file, the system should reject it with detailed errors.
   */
  it('validates configuration and rejects invalid files', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant('{ invalid json'),  // Malformed JSON
          fc.constant('{ "id": 123 }'),   // Wrong type
          fc.constant('{ "name": "" }'),  // Empty required field
        ),
        (invalidConfig) => {
          const result = validateConfig(invalidConfig);
          
          expect(result.isValid).toBe(false);
          expect(result.errors).toBeDefined();
          expect(result.errors.length).toBeGreaterThan(0);
          expect(result.errors[0]).toHaveProperty('line');
          expect(result.errors[0]).toHaveProperty('message');
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

### Integration Testing

**Test Categories:**

1. **IPC Communication Tests**
   - Verify Tauri commands work correctly
   - Test error propagation from Rust to TypeScript
   - Validate serialization/deserialization

2. **GPU Compute Tests**
   - Verify GPU operations produce correct results
   - Test GPU/CPU equivalence properties
   - Validate buffer management

3. **File Operations Tests**
   - Test import/export round-trips
   - Validate format support
   - Test error handling for invalid files

4. **Cross-App Integration Tests**
   - Test Kernel asset sharing
   - Verify KObjectRegistry identity tracking
   - Test app state isolation

**Example Integration Test:**
```rust
#[tokio::test]
async fn test_sculpt_export_import_roundtrip() {
    // Create test mesh
    let mesh = create_cube_mesh(1.0);
    let mut sculpt_engine = SculptEngine::new().await;
    
    // Apply sculpting operations
    let brush = BrushConfig::default();
    let stroke = BrushStroke {
        center: [0.0, 0.5, 0.0],
        radius: 0.3,
        strength: 0.5,
        falloff: 0.8,
        ..Default::default()
    };
    
    sculpt_engine.apply_brush(&mesh, &brush, &stroke).await.unwrap();
    let sculpted_mesh = sculpt_engine.get_mesh();
    
    // Export to GLTF
    let temp_path = temp_dir().join("sculpted.gltf");
    let export_registry = ExportRegistry::new();
    export_registry.export("gltf", &sculpted_mesh, &temp_path).await.unwrap();
    
    // Verify file exists and is valid
    assert!(temp_path.exists());
    
    // Re-import
    let file_ops = FileOpsManager::new();
    let imported_scene = file_ops.import(&temp_path).await.unwrap();
    
    // Verify mesh data preserved
    assert_eq!(sculpted_mesh.vertices.len(), imported_scene.meshes[0].vertices.len());
    assert_eq!(sculpted_mesh.faces.len(), imported_scene.meshes[0].faces.len());
    
    // Verify vertex positions within epsilon
    for (original, imported) in sculpted_mesh.vertices.iter()
        .zip(imported_scene.meshes[0].vertices.iter()) {
        assert!((original.position - imported.position).magnitude() < 0.001);
    }
}

#[tokio::test]
async fn test_svt_painting_persistence() {
    let mut svt_system = SvtPipeline::new(8192, 256).await;
    
    // Paint some strokes
    let strokes = vec![
        PaintStroke { uv: Vec2::new(0.5, 0.5), color: Vec4::new(1.0, 0.0, 0.0, 1.0), radius: 0.1 },
        PaintStroke { uv: Vec2::new(0.3, 0.7), color: Vec4::new(0.0, 1.0, 0.0, 1.0), radius: 0.15 },
    ];
    
    for stroke in &strokes {
        svt_system.paint(stroke.uv, &PaintBrush::default(), stroke.color).await.unwrap();
    }
    
    // Export texture
    let temp_path = temp_dir().join("painted.png");
    svt_system.export_texture(&temp_path).await.unwrap();
    
    // Create new SVT system and import
    let mut new_svt = SvtPipeline::new(8192, 256).await;
    new_svt.import_texture(&temp_path).await.unwrap();
    
    // Verify painted regions preserved
    for stroke in &strokes {
        let sampled_color = new_svt.sample_color(stroke.uv).await;
        assert!((sampled_color - stroke.color).magnitude() < 0.1);
    }
}
```

### Unit Testing Strategy

**Focus Areas:**
- Specific examples of correct behavior
- Edge cases (empty meshes, single vertex, degenerate triangles)
- Error conditions (invalid input, out of memory)
- Boundary conditions (min/max values)

**Example Unit Tests:**
```rust
#[test]
fn test_subdivision_preserves_uv_coordinates() {
    let mesh = create_quad_with_uvs();
    let subdivided = subdivide_catmull_clark(&mesh, 1).unwrap();
    
    // Verify UV topology preserved
    assert!(has_valid_uvs(&subdivided));
    assert_eq!(count_uv_seams(&mesh), count_uv_seams(&subdivided));
}

#[test]
fn test_export_rejects_empty_mesh() {
    let empty_mesh = Mesh::default();
    let result = export_gltf(&empty_mesh, Path::new("test.gltf"));
    
    assert!(result.is_err());
    assert!(matches!(result.unwrap_err(), ExportError::EmptyMesh));
}

#[test]
fn test_mask_prevents_sculpting() {
    let mut mesh = create_cube_mesh(1.0);
    
    // Mask half the mesh
    let mask = create_half_mask(&mesh);
    mesh.set_mask(mask);
    
    // Try to sculpt masked region
    let brush_stroke = BrushStroke {
        center: [0.5, 0.0, 0.0],  // In masked region
        radius: 0.5,
        strength: 1.0,
        ..Default::default()
    };
    
    let original_vertices = mesh.vertices.clone();
    apply_brush(&mut mesh, &brush_stroke);
    
    // Verify masked vertices unchanged
    for (i, vertex) in mesh.vertices.iter().enumerate() {
        if mesh.mask[i] > 0.5 {
            assert_eq!(vertex.position, original_vertices[i].position);
        }
    }
}
```

### Performance Testing

While not part of correctness properties, performance tests ensure the system meets performance requirements:

```rust
#[bench]
fn bench_gpu_subdivision(b: &mut Bencher) {
    let mesh = create_sphere_mesh(10000);  // 10K vertices
    let gpu_engine = GpuEngine::new();
    
    b.iter(|| {
        gpu_engine.subdivide(&mesh, 1)
    });
}

#[bench]
fn bench_svt_painting(b: &mut Bencher) {
    let mut svt = SvtPipeline::new(8192, 256);
    let stroke = PaintStroke::default();
    
    b.iter(|| {
        svt.paint(stroke.uv, &PaintBrush::default(), stroke.color)
    });
}
```

### Test Execution

**Local Development:**
```bash
# Run all tests
cargo test

# Run only property tests
cargo test --test proptest

# Run with more iterations
PROPTEST_CASES=1000 cargo test

# Run integration tests
cargo test --test integration

# Run benchmarks
cargo bench
```

**CI Pipeline:**
```yaml
test:
  script:
    - cargo test --all-features
    - PROPTEST_CASES=1000 cargo test --test proptest
    - cargo test --test integration
    - npm test
  coverage:
    target: 80%
```

### Test Coverage Goals

- Unit test coverage: 80% of code
- Property test coverage: 100% of correctness properties
- Integration test coverage: All critical workflows
- All P0 and P1 bugs have regression tests


## Implementation Roadmap

### Phase 1: Critical Blockers (P0) - Week 1

**Goal:** Fix all P0 issues that prevent basic functionality.

1. **Fix Export Systems**
   - KTecton: Implement terrain mesh + heightmap export (lines 410-412)
   - KQuantum: Implement particle system serialization (lines 87-98)
   - KCloner: Implement clone instance array export (lines 692-698)
   - Add validation and error handling to all export paths

2. **Fix Panel Flickering**
   - Replace react-resizable-panels with custom resize implementation
   - Use CSS transforms and requestAnimationFrame for smooth resizing
   - Add resize debouncing to prevent viewport re-renders
   - Test across all apps

**Deliverables:**
- All apps can export their data
- Panel resizing is smooth without flickering
- Regression tests for export functionality

### Phase 2: Major System Gaps (P1) - Week 2

**Goal:** Fix major integration and consistency issues.

1. **Unified AppShell and TopBar**
   - Refactor all apps to use AppTopBar component
   - Fix spacing and layout consistency
   - Add Uplink buttons to KQuantum and KInspect
   - Implement responsive overflow menu

2. **Fix Critical Bugs**
   - KTecton: Apply terrain resolution changes immediately
   - KCloner: Fix memory leaks on mode changes
   - Wire KSculpt subdivision to UI
   - Wire KSculpt masking system to UI

3. **KAtlas UV Tools**
   - Implement UV move, rotate, scale tools
   - Add UV unwrap functionality
   - Improve visual feedback during UV operations

**Deliverables:**
- Consistent UI across all apps
- All critical bugs fixed
- KAtlas has functional UV editing

### Phase 3: Data-Driven Architecture - Week 3

**Goal:** Replace all hardcoded values with JSON configuration.

1. **Configuration Registry System**
   - Implement ConfigRegistry in Rust
   - Create JSON schemas for all configuration types
   - Implement configuration loading with inheritance
   - Add hot-reload support for development

2. **Replace Hardcoded Values**
   - View modes (KTecton and others)
   - Brush settings (all sculpting/painting apps)
   - Export formats (all apps)
   - Grid/camera/lighting parameters (all apps)
   - Greeble patterns (KGreeble)

3. **Configuration UI**
   - Add configuration editor for common settings
   - Implement preset import/export
   - Add validation error display

**Deliverables:**
- All configuration is data-driven
- Hot-reload works in development
- Configuration presets can be shared

### Phase 4: KGraphos Overhaul - Week 4

**Goal:** Complete overhaul of KGraphos 2D painting system.

1. **Fluid Painting Engine**
   - Implement GPU-accelerated fluid simulation
   - Add smear brush with realistic dragging
   - Add watercolor brush with color mixing
   - Add oil brush with thick paint simulation

2. **Layer System**
   - Implement layer-based compositing
   - Add blend modes (Normal, Multiply, Overlay, etc.)
   - Add alpha masks for non-destructive editing

3. **Polish**
   - Add brush cursor preview
   - Implement symmetry modes
   - Add color picker with HSV/RGB modes
   - Optimize performance for 4K+ textures

**Deliverables:**
- KGraphos has professional-quality painting
- Fluid simulation works correctly
- Performance is acceptable for 4K textures

### Phase 5: Testing Infrastructure - Week 5

**Goal:** Comprehensive testing coverage.

1. **Property-Based Testing**
   - Implement all 36 correctness properties
   - Configure proptest and fast-check
   - Add arbitrary generators for all data types
   - Run property tests in CI with 1000 iterations

2. **Integration Testing**
   - IPC communication tests
   - GPU compute correctness tests
   - File operations round-trip tests
   - Cross-app integration tests

3. **Unit Testing**
   - Edge case tests for all critical functions
   - Error handling tests
   - Regression tests for all fixed bugs

**Deliverables:**
- 80% unit test coverage
- 100% property test coverage
- All integration tests passing
- CI pipeline running all tests

### Phase 6: Polish and Production Readiness - Week 6

**Goal:** Achieve 85%+ production readiness across all apps.

1. **UI Polish**
   - Consistent tooltips everywhere
   - Progress indicators for long operations
   - Keyboard shortcut hints
   - Error message improvements

2. **Performance Optimization**
   - Profile and optimize hot paths
   - Implement GPU operation batching
   - Optimize SVT tile cache
   - Reduce memory allocations

3. **Documentation**
   - Update DIRECTORY.md with all changes
   - Document all new configuration schemas
   - Add user guide for each app
   - Document keyboard shortcuts

4. **Final Testing**
   - Manual testing of all workflows
   - Performance testing on target hardware
   - Stress testing with large files
   - User acceptance testing

**Deliverables:**
- All apps at 85%+ production readiness
- Performance meets targets
- Documentation is complete
- Ready for release

### Risk Mitigation

**Technical Risks:**

1. **GPU Compatibility Issues**
   - Risk: wgpu may not work on all target GPUs
   - Mitigation: Implement CPU fallbacks for all GPU operations
   - Mitigation: Test on variety of GPU hardware

2. **Performance Degradation**
   - Risk: Data-driven architecture may add overhead
   - Mitigation: Profile before and after changes
   - Mitigation: Cache parsed configuration
   - Mitigation: Use lazy loading where possible

3. **Breaking Changes**
   - Risk: Refactoring may break existing functionality
   - Mitigation: Comprehensive test coverage before refactoring
   - Mitigation: Incremental changes with testing at each step
   - Mitigation: Feature flags for new implementations

4. **External Dependencies**
   - Risk: Instant Meshes integration may be fragile
   - Mitigation: Isolate external dependencies behind interfaces
   - Mitigation: Provide fallback when external tools unavailable

**Schedule Risks:**

1. **Scope Creep**
   - Risk: Additional issues discovered during implementation
   - Mitigation: Strict prioritization (P0 > P1 > P2)
   - Mitigation: Time-box each phase
   - Mitigation: Defer non-critical issues to future releases

2. **Complexity Underestimation**
   - Risk: Some tasks may take longer than estimated
   - Mitigation: 20% buffer time in each phase
   - Mitigation: Daily progress tracking
   - Mitigation: Early escalation of blockers

### Success Metrics

**Quantitative:**
- All apps achieve 85%+ production readiness score
- 80%+ unit test coverage
- 100% property test coverage
- All P0 and P1 issues resolved
- Zero known crash bugs
- Sub-16ms frame times for interactive operations

**Qualitative:**
- Consistent UI/UX across all apps
- Clear, actionable error messages
- Smooth, responsive interactions
- Professional-quality output
- Maintainable, data-driven codebase

## Summary

This design provides a comprehensive architecture for making the K_OS DCC Suite production-ready. The key innovations are:

1. **Unified AppShell** - Consistent UI across all 10+ apps with smooth panel resizing
2. **Data-Driven Configuration** - All settings in JSON with hot-reload and validation
3. **Robust Export System** - Format-agnostic export with validation and error handling
4. **GPU-First Architecture** - High-performance compute with CPU fallbacks
5. **Comprehensive Testing** - Property-based tests for correctness, unit tests for specifics
6. **Graceful Error Handling** - Clear messages, recovery actions, no crashes

The implementation roadmap spans 6 weeks with clear phases, deliverables, and risk mitigation strategies. By following this design, the DCC Suite will achieve production quality suitable for professional use.

