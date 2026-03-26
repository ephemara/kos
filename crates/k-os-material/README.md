# k-os-material

A comprehensive material system for K_OS DCC Suite with PBR (Physically Based Rendering) support, texture management, material presets, and serialization.

## Features

- **PBR Material Properties**: Full support for physically based rendering with metallic-roughness workflow
- **Texture Slot Management**: Manage textures for all PBR properties (albedo, normal, roughness, metallic, AO, emissive, height, opacity)
- **Material Library**: Organize and manage multiple materials with name-based lookup
- **Material Presets**: Pre-configured materials for common types (metals, plastics, glass, wood, stone, fabric, etc.)
- **Serialization**: Save and load materials and libraries to/from JSON
- **Validation**: Built-in validation for material properties and texture paths
- **Thread-Safe**: Shared material libraries with Arc<RwLock<>> support

## Usage

### Creating Materials

```rust
use k_os_material::{Material, TextureSlot};
use glam::Vec3;

// Create a new material
let mut material = Material::new("My Material");

// Set PBR properties
material.set_base_color(Vec3::new(0.8, 0.2, 0.2));
material.set_metallic(0.9);
material.set_roughness(0.1);

// Add textures
material.set_texture(TextureSlot::BaseColor, "textures/albedo.png");
material.set_texture(TextureSlot::Normal, "textures/normal.png");
material.set_texture(TextureSlot::Roughness, "textures/roughness.png");

// Set emissive properties
material.set_emissive(Vec3::new(1.0, 0.5, 0.0));
material.set_emissive_strength(2.0);

// Set transparency
material.set_opacity(0.8);
material.set_ior(1.5);
```

### Using Material Library

```rust
use k_os_material::{Material, MaterialLibrary};

// Create a library
let mut library = MaterialLibrary::new();

// Add materials
let mat1 = Material::new("Material 1");
let id1 = library.add_material(mat1);

let mat2 = Material::new("Material 2");
let id2 = library.add_material(mat2);

// Retrieve materials
if let Some(material) = library.get_material(&id1) {
    println!("Found: {}", material.name());
}

// Get by name
if let Some(material) = library.get_material_by_name("Material 1") {
    println!("Found by name: {}", material.name());
}

// Rename material
library.rename_material(&id1, "Renamed Material").unwrap();

// Duplicate material
let duplicate_id = library.duplicate_material(&id1, "Copy of Material").unwrap();

// Save to file
library.save_to_file("materials.json").unwrap();

// Load from file
let loaded = MaterialLibrary::load_from_file("materials.json").unwrap();
```

### Using Material Presets

```rust
use k_os_material::MaterialPreset;
use glam::Vec3;

// Create preset materials
let gold = MaterialPreset::gold();
let silver = MaterialPreset::silver();
let glass = MaterialPreset::glass();
let plastic = MaterialPreset::plastic_red();

// Create custom colored materials
let blue_glass = MaterialPreset::glass_colored(Vec3::new(0.2, 0.4, 1.0));
let pink_neon = MaterialPreset::neon(Vec3::new(1.0, 0.2, 0.8));

// Get preset by name
if let Some(copper) = MaterialPreset::get_preset("copper") {
    println!("Loaded copper preset");
}

// List all presets
let all_presets = MaterialPreset::all_preset_names();
for name in all_presets {
    println!("Available preset: {}", name);
}
```

### Texture Management

```rust
use k_os_material::{Material, TextureSlot, TextureInfo};

let mut material = Material::new("Textured");

// Simple texture assignment
material.set_texture(TextureSlot::BaseColor, "albedo.png");

// Advanced texture configuration
let mut texture_info = TextureInfo::new("normal.png");
texture_info.set_scale((2.0, 2.0)); // Tile 2x
texture_info.set_offset((0.5, 0.0)); // Offset by half
texture_info.set_rotation(std::f32::consts::PI / 4.0); // Rotate 45 degrees
texture_info.set_uv_channel(1); // Use UV channel 1
texture_info.set_srgb(false); // Non-color data

material.set_texture_info(TextureSlot::Normal, texture_info);

// Check if texture exists
if let Some(tex) = material.get_texture(TextureSlot::BaseColor) {
    println!("Texture path: {:?}", tex.path());
    println!("Exists: {}", tex.exists());
}

// Remove texture
material.remove_texture(TextureSlot::BaseColor);
```

### Thread-Safe Shared Library

```rust
use k_os_material::{create_shared_library, Material};

// Create a shared library
let library = create_shared_library();

// Write access
{
    let mut lib = library.write();
    lib.add_material(Material::new("Shared Material"));
}

// Read access
{
    let lib = library.read();
    println!("Material count: {}", lib.material_count());
}
```

## PBR Properties

### Base Properties
- **Base Color**: RGB albedo color [0, 1]
- **Metallic**: Metallic factor [0, 1] - 0 = dielectric, 1 = metal
- **Roughness**: Surface roughness [0, 1] - 0 = smooth/glossy, 1 = rough/matte

### Additional Properties
- **Emissive**: RGB emissive color [0, ∞] for HDR
- **Emissive Strength**: Multiplier for emissive intensity
- **Ambient Occlusion**: AO strength [0, 1]
- **Normal Strength**: Normal map intensity [0, 1]
- **Height Strength**: Displacement/parallax strength
- **Opacity**: Alpha/transparency [0, 1]
- **IOR**: Index of refraction for transparent materials (typically 1.0-3.0)

## Texture Slots

The material system supports the following texture slots:

- **BaseColor**: Albedo/diffuse color texture (sRGB)
- **Metallic**: Metallic map (linear, grayscale)
- **Roughness**: Roughness map (linear, grayscale)
- **Normal**: Tangent-space normal map (linear, RGB)
- **AmbientOcclusion**: AO map (linear, grayscale)
- **Emissive**: Emissive color texture (sRGB)
- **Height**: Height/displacement map (linear, grayscale)
- **Opacity**: Alpha/transparency map (linear, grayscale)

## Material Presets

### Metals
- `gold`, `silver`, `copper`, `aluminum`, `iron`, `brushed_metal`

### Plastics
- `plastic_glossy`, `plastic_matte`, `plastic_red`, `plastic_blue`, `plastic_green`

### Glass
- `glass`, `glass_frosted`, `glass_colored(color)`

### Wood
- `wood`, `wood_polished`

### Stone
- `stone`, `marble`

### Fabric
- `fabric`, `velvet`

### Rubber
- `rubber`

### Emissive
- `neon(color)`, `led(color)`

### Utility
- `default`, `white`, `black`

## Serialization

Materials and libraries can be serialized to JSON:

```rust
use k_os_material::{Material, MaterialLibrary};

// Serialize material
let material = Material::new("Test");
let json = serde_json::to_string_pretty(&material).unwrap();

// Deserialize material
let loaded: Material = serde_json::from_str(&json).unwrap();

// Save library to file
let library = MaterialLibrary::new();
library.save_to_file("materials.json").unwrap();

// Load library from file
let loaded = MaterialLibrary::load_from_file("materials.json").unwrap();
```

## Validation

Materials can be validated to ensure correctness:

```rust
use k_os_material::Material;

let material = Material::new("Test");

// Validate material
match material.validate() {
    Ok(_) => println!("Material is valid"),
    Err(e) => println!("Validation error: {}", e),
}

// Validate entire library
let library = MaterialLibrary::new();
match library.validate() {
    Ok(_) => println!("All materials valid"),
    Err(e) => println!("Validation error: {}", e),
}
```

## Error Handling

The crate uses a custom `Result<T>` type with `MaterialError`:

```rust
use k_os_material::{Material, MaterialError, Result};

fn create_material() -> Result<Material> {
    let mut mat = Material::new("Test");
    mat.set_name("")?; // Returns error for empty name
    Ok(mat)
}

match create_material() {
    Ok(mat) => println!("Created: {}", mat.name()),
    Err(MaterialError::InvalidName(msg)) => println!("Invalid name: {}", msg),
    Err(e) => println!("Error: {}", e),
}
```

## Integration with K_OS

This crate is designed to integrate seamlessly with the K_OS DCC Suite:

1. **Backend**: Use in Rust backend for material management
2. **Tauri Commands**: Expose material operations via Tauri IPC
3. **Frontend**: TypeScript service clients wrap material operations
4. **GPU Rendering**: Material properties map directly to PBR shaders
5. **Asset Pipeline**: Materials can be imported/exported with 3D assets

## Dependencies

- `serde` - Serialization/deserialization
- `uuid` - Unique material identifiers
- `glam` - Math types (Vec3 for colors)
- `parking_lot` - Thread-safe RwLock
- `thiserror` - Error handling
- `validator` - Property validation

## License

Part of the K_OS DCC Suite project.
