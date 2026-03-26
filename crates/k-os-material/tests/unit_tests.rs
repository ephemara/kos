//! Unit tests for k-os-material crate
//!
//! Tests cover:
//! - Material creation and property validation
//! - Texture slot management
//! - Material library operations
//! - Material presets
//! - Serialization/deserialization
//! - Error handling

use glam::Vec3;
use k_os_material::{Material, MaterialError, MaterialLibrary, MaterialPreset, TextureSlot};

// ============================================================================
// Material Creation and Property Validation Tests
// ============================================================================

#[test]
fn test_material_creation_with_default_values() {
    let material = Material::new("Test Material");

    assert_eq!(material.name(), "Test Material");
    assert_eq!(material.base_color(), Vec3::new(0.8, 0.8, 0.8));
    assert_eq!(material.metallic(), 0.0);
    assert_eq!(material.roughness(), 0.5);
    assert_eq!(material.emissive(), Vec3::ZERO);
    assert_eq!(material.opacity(), 1.0);
}

#[test]
fn test_material_set_base_color() {
    let mut material = Material::new("Test");
    let color = Vec3::new(1.0, 0.0, 0.0);

    material.set_base_color(color);
    assert_eq!(material.base_color(), color);
}

#[test]
fn test_material_metallic_clamping() {
    let mut material = Material::new("Test");

    // Test valid range
    material.set_metallic(0.5);
    assert_eq!(material.metallic(), 0.5);

    // Test clamping at lower bound
    material.set_metallic(-0.5);
    assert_eq!(material.metallic(), 0.0);

    // Test clamping at upper bound
    material.set_metallic(1.5);
    assert_eq!(material.metallic(), 1.0);
}

#[test]
fn test_material_roughness_clamping() {
    let mut material = Material::new("Test");

    // Test valid range
    material.set_roughness(0.7);
    assert_eq!(material.roughness(), 0.7);

    // Test clamping at lower bound
    material.set_roughness(-0.1);
    assert_eq!(material.roughness(), 0.0);

    // Test clamping at upper bound
    material.set_roughness(2.0);
    assert_eq!(material.roughness(), 1.0);
}

#[test]
fn test_material_opacity_clamping() {
    let mut material = Material::new("Test");

    // Test valid range
    material.set_opacity(0.5);
    assert_eq!(material.opacity(), 0.5);

    // Test clamping at lower bound
    material.set_opacity(-0.5);
    assert_eq!(material.opacity(), 0.0);

    // Test clamping at upper bound
    material.set_opacity(1.5);
    assert_eq!(material.opacity(), 1.0);
}

#[test]
fn test_material_emissive_color() {
    let mut material = Material::new("Test");
    let emissive = Vec3::new(1.0, 0.5, 0.0);

    material.set_emissive(emissive);
    assert_eq!(material.emissive(), emissive);
}

#[test]
fn test_material_rename() {
    let mut material = Material::new("Original Name");
    let _ = material.set_name("New Name");

    assert_eq!(material.name(), "New Name");
}

#[test]
fn test_material_id_uniqueness() {
    let mat1 = Material::new("Material 1");
    let mat2 = Material::new("Material 2");

    assert_ne!(mat1.id(), mat2.id());
}

// ============================================================================
// Texture Slot Management Tests
// ============================================================================

#[test]
fn test_set_texture_slot() {
    let mut material = Material::new("Test");
    let texture_path = "textures/albedo.png";

    material.set_texture(TextureSlot::BaseColor, texture_path);

    let texture = material.get_texture(TextureSlot::BaseColor);
    assert!(texture.is_some());
    assert_eq!(texture.unwrap().path(), texture_path);
}

#[test]
fn test_get_texture_slot_empty() {
    let material = Material::new("Test");

    let texture = material.get_texture(TextureSlot::BaseColor);
    assert!(texture.is_none());
}

#[test]
fn test_remove_texture_slot() {
    let mut material = Material::new("Test");

    material.set_texture(TextureSlot::BaseColor, "textures/albedo.png");
    assert!(material.get_texture(TextureSlot::BaseColor).is_some());

    material.remove_texture(TextureSlot::BaseColor);
    assert!(material.get_texture(TextureSlot::BaseColor).is_none());
}

#[test]
fn test_has_texture() {
    let mut material = Material::new("Test");

    assert!(!material.has_texture(TextureSlot::BaseColor));

    material.set_texture(TextureSlot::BaseColor, "textures/albedo.png");
    assert!(material.has_texture(TextureSlot::BaseColor));
}

#[test]
fn test_multiple_texture_slots() {
    let mut material = Material::new("Test");

    material.set_texture(TextureSlot::BaseColor, "textures/albedo.png");
    material.set_texture(TextureSlot::Normal, "textures/normal.png");
    material.set_texture(TextureSlot::Metallic, "textures/metallic.png");
    material.set_texture(TextureSlot::Roughness, "textures/roughness.png");

    assert!(material.has_texture(TextureSlot::BaseColor));
    assert!(material.has_texture(TextureSlot::Normal));
    assert!(material.has_texture(TextureSlot::Metallic));
    assert!(material.has_texture(TextureSlot::Roughness));
    assert!(!material.has_texture(TextureSlot::AmbientOcclusion));
}

#[test]
fn test_replace_texture_slot() {
    let mut material = Material::new("Test");

    material.set_texture(TextureSlot::BaseColor, "textures/old.png");
    assert_eq!(
        material.get_texture(TextureSlot::BaseColor).unwrap().path(),
        "textures/old.png"
    );

    material.set_texture(TextureSlot::BaseColor, "textures/new.png");
    assert_eq!(
        material.get_texture(TextureSlot::BaseColor).unwrap().path(),
        "textures/new.png"
    );
}

#[test]
fn test_clear_all_textures() {
    let mut material = Material::new("Test");

    material.set_texture(TextureSlot::BaseColor, "textures/albedo.png");
    material.set_texture(TextureSlot::Normal, "textures/normal.png");
    material.set_texture(TextureSlot::Metallic, "textures/metallic.png");

    // Remove each texture individually since there's no clear_textures method
    material.remove_texture(TextureSlot::BaseColor);
    material.remove_texture(TextureSlot::Normal);
    material.remove_texture(TextureSlot::Metallic);

    assert!(!material.has_texture(TextureSlot::BaseColor));
    assert!(!material.has_texture(TextureSlot::Normal));
    assert!(!material.has_texture(TextureSlot::Metallic));
}

// ============================================================================
// Material Library Operations Tests
// ============================================================================

#[test]
fn test_library_creation() {
    let library = MaterialLibrary::new();
    assert_eq!(library.material_count(), 0);
}

#[test]
fn test_library_add_material() {
    let mut library = MaterialLibrary::new();
    let material = Material::new("Test Material");

    let id = library.add_material(material);

    assert_eq!(library.material_count(), 1);
    assert!(library.get_material(&id).is_some());
}

#[test]
fn test_library_get_material() {
    let mut library = MaterialLibrary::new();
    let material = Material::new("Test Material");
    let id = library.add_material(material);

    let retrieved = library.get_material(&id);
    assert!(retrieved.is_some());
    assert_eq!(retrieved.unwrap().name(), "Test Material");
}

#[test]
fn test_library_get_material_mut() {
    let mut library = MaterialLibrary::new();
    let material = Material::new("Test Material");
    let id = library.add_material(material);

    if let Some(mat) = library.get_material_mut(&id) {
        let _ = mat.set_name("Modified Material");
    }

    assert_eq!(
        library.get_material(&id).unwrap().name(),
        "Modified Material"
    );
}

#[test]
fn test_library_remove_material() {
    let mut library = MaterialLibrary::new();
    let material = Material::new("Test Material");
    let id = library.add_material(material);

    assert_eq!(library.material_count(), 1);

    let removed = library.remove_material(&id);
    assert!(removed.is_some());
    assert_eq!(library.material_count(), 0);
    assert!(library.get_material(&id).is_none());
}

#[test]
fn test_library_remove_nonexistent_material() {
    let mut library = MaterialLibrary::new();
    let fake_id = uuid::Uuid::new_v4();

    let removed = library.remove_material(&fake_id);
    assert!(removed.is_none());
}

#[test]
fn test_library_rename_material() {
    let mut library = MaterialLibrary::new();
    let material = Material::new("Original Name");
    let id = library.add_material(material);

    let result = library.rename_material(&id, "New Name");
    assert!(result.is_ok());
    assert_eq!(library.get_material(&id).unwrap().name(), "New Name");
}

#[test]
fn test_library_rename_nonexistent_material() {
    let mut library = MaterialLibrary::new();
    let fake_id = uuid::Uuid::new_v4();

    let result = library.rename_material(&fake_id, "New Name");
    assert!(result.is_err());
    assert!(matches!(
        result.unwrap_err(),
        MaterialError::MaterialNotFound(_)
    ));
}

#[test]
fn test_library_duplicate_material() {
    let mut library = MaterialLibrary::new();
    let mut material = Material::new("Original");
    material.set_metallic(0.8);
    material.set_roughness(0.2);
    let original_id = library.add_material(material);

    let duplicate_id = library.duplicate_material(&original_id, "Copy");
    assert!(duplicate_id.is_ok());

    let dup_id = duplicate_id.unwrap();
    assert_ne!(original_id, dup_id);
    assert_eq!(library.material_count(), 2);

    let duplicate = library.get_material(&dup_id).unwrap();
    assert_eq!(duplicate.name(), "Copy");
    assert_eq!(duplicate.metallic(), 0.8);
    assert_eq!(duplicate.roughness(), 0.2);
}

#[test]
fn test_library_duplicate_nonexistent_material() {
    let mut library = MaterialLibrary::new();
    let fake_id = uuid::Uuid::new_v4();

    let result = library.duplicate_material(&fake_id, "Copy");
    assert!(result.is_err());
    assert!(matches!(
        result.unwrap_err(),
        MaterialError::MaterialNotFound(_)
    ));
}

#[test]
fn test_library_list_materials() {
    let mut library = MaterialLibrary::new();

    library.add_material(Material::new("Material 1"));
    library.add_material(Material::new("Material 2"));
    library.add_material(Material::new("Material 3"));

    let materials = library.materials();
    assert_eq!(materials.len(), 3);
}

#[test]
fn test_library_find_by_name() {
    let mut library = MaterialLibrary::new();

    library.add_material(Material::new("Unique Name"));
    library.add_material(Material::new("Other Name"));

    let found = library.get_material_by_name("Unique Name");
    assert!(found.is_some());
    assert_eq!(found.unwrap().name(), "Unique Name");
}

#[test]
fn test_library_find_by_name_not_found() {
    let mut library = MaterialLibrary::new();
    library.add_material(Material::new("Material 1"));

    let found = library.get_material_by_name("Nonexistent");
    assert!(found.is_none());
}

#[test]
fn test_library_clear() {
    let mut library = MaterialLibrary::new();

    library.add_material(Material::new("Material 1"));
    library.add_material(Material::new("Material 2"));
    library.add_material(Material::new("Material 3"));

    assert_eq!(library.material_count(), 3);

    library.clear();
    assert_eq!(library.material_count(), 0);
}

// ============================================================================
// Material Presets Tests
// ============================================================================

#[test]
fn test_preset_gold() {
    let gold = MaterialPreset::gold();

    assert_eq!(gold.name(), "Gold");
    assert!(gold.metallic() > 0.9);
    assert!(gold.roughness() < 0.2);
}

#[test]
fn test_preset_silver() {
    let silver = MaterialPreset::silver();

    assert_eq!(silver.name(), "Silver");
    assert!(silver.metallic() > 0.9);
    assert!(silver.roughness() < 0.2);
}

#[test]
fn test_preset_copper() {
    let copper = MaterialPreset::copper();

    assert_eq!(copper.name(), "Copper");
    assert!(copper.metallic() > 0.9);
    assert!(copper.roughness() < 0.3);
}

#[test]
fn test_preset_aluminum() {
    let aluminum = MaterialPreset::aluminum();

    assert_eq!(aluminum.name(), "Aluminum");
    assert!(aluminum.metallic() > 0.9);
    // Aluminum can have higher roughness for brushed finish
}

#[test]
fn test_preset_iron() {
    let iron = MaterialPreset::iron();

    assert_eq!(iron.name(), "Iron");
    assert!(iron.metallic() > 0.9);
}

#[test]
fn test_preset_plastic_red() {
    let plastic = MaterialPreset::plastic_red();

    assert_eq!(plastic.name(), "Red Plastic");
    assert!(plastic.metallic() < 0.1);
    // Plastic can have varying roughness values
}

#[test]
fn test_preset_plastic_blue() {
    let plastic = MaterialPreset::plastic_blue();

    assert_eq!(plastic.name(), "Blue Plastic");
    assert!(plastic.metallic() < 0.1);
}

#[test]
fn test_preset_plastic_matte() {
    let plastic = MaterialPreset::plastic_matte();

    assert_eq!(plastic.name(), "Matte Plastic");
    assert!(plastic.metallic() < 0.1);
}

#[test]
fn test_preset_rubber() {
    let rubber = MaterialPreset::rubber();

    assert_eq!(rubber.name(), "Rubber");
    assert!(rubber.metallic() < 0.1);
    assert!(rubber.roughness() > 0.7);
}

#[test]
fn test_preset_glass() {
    let glass = MaterialPreset::glass();

    assert_eq!(glass.name(), "Glass");
    assert!(glass.metallic() < 0.1);
    assert!(glass.roughness() < 0.1);
    assert!(glass.opacity() < 1.0);
}

#[test]
fn test_preset_wood() {
    let wood = MaterialPreset::wood();

    assert_eq!(wood.name(), "Wood");
    assert!(wood.metallic() < 0.1);
}

#[test]
fn test_preset_stone() {
    let stone = MaterialPreset::stone();

    assert_eq!(stone.name(), "Stone");
    assert!(stone.metallic() < 0.1);
    assert!(stone.roughness() > 0.7);
}

#[test]
fn test_preset_fabric() {
    let fabric = MaterialPreset::fabric();

    assert_eq!(fabric.name(), "Fabric");
    assert!(fabric.metallic() < 0.1);
    assert!(fabric.roughness() > 0.6);
}

#[test]
fn test_preset_marble() {
    let marble = MaterialPreset::marble();

    assert_eq!(marble.name(), "Marble");
    assert!(marble.metallic() < 0.1);
}

#[test]
fn test_all_presets_valid() {
    // Test that all presets have valid property ranges
    let presets = vec![
        MaterialPreset::gold(),
        MaterialPreset::silver(),
        MaterialPreset::copper(),
        MaterialPreset::aluminum(),
        MaterialPreset::iron(),
        MaterialPreset::plastic_red(),
        MaterialPreset::plastic_blue(),
        MaterialPreset::plastic_matte(),
        MaterialPreset::rubber(),
        MaterialPreset::glass(),
        MaterialPreset::wood(),
        MaterialPreset::stone(),
        MaterialPreset::fabric(),
        MaterialPreset::marble(),
    ];

    for preset in presets {
        assert!(preset.metallic() >= 0.0 && preset.metallic() <= 1.0);
        assert!(preset.roughness() >= 0.0 && preset.roughness() <= 1.0);
        assert!(preset.opacity() >= 0.0 && preset.opacity() <= 1.0);
        assert!(!preset.name().is_empty());
    }
}

// ============================================================================
// Serialization/Deserialization Tests
// ============================================================================

#[test]
fn test_material_serialization() {
    let mut material = Material::new("Test Material");
    material.set_base_color(Vec3::new(1.0, 0.0, 0.0));
    material.set_metallic(0.8);
    material.set_roughness(0.2);
    material.set_texture(TextureSlot::BaseColor, "textures/albedo.png");

    let json = serde_json::to_string(&material).unwrap();
    assert!(json.contains("Test Material"));
    assert!(json.contains("textures/albedo.png"));
}

#[test]
fn test_material_deserialization() {
    let json = r#"{
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "name": "Test Material",
        "base_color": [1.0, 0.0, 0.0],
        "metallic": 0.8,
        "roughness": 0.2,
        "emissive": [0.0, 0.0, 0.0],
        "emissive_strength": 1.0,
        "ao_strength": 1.0,
        "normal_strength": 1.0,
        "height_strength": 1.0,
        "opacity": 1.0,
        "ior": 1.45,
        "textures": {},
        "metadata": {}
    }"#;

    let material: Material = serde_json::from_str(json).unwrap();
    assert_eq!(material.name(), "Test Material");
    assert_eq!(material.base_color(), Vec3::new(1.0, 0.0, 0.0));
    assert_eq!(material.metallic(), 0.8);
    assert_eq!(material.roughness(), 0.2);
}

#[test]
fn test_material_roundtrip() {
    let mut original = Material::new("Roundtrip Test");
    original.set_base_color(Vec3::new(0.5, 0.5, 0.5));
    original.set_metallic(0.6);
    original.set_roughness(0.4);
    original.set_emissive(Vec3::new(0.1, 0.2, 0.3));
    original.set_opacity(0.9);
    original.set_texture(TextureSlot::BaseColor, "textures/test.png");

    let json = serde_json::to_string(&original).unwrap();
    let deserialized: Material = serde_json::from_str(&json).unwrap();

    assert_eq!(deserialized.name(), original.name());
    assert_eq!(deserialized.base_color(), original.base_color());
    assert_eq!(deserialized.metallic(), original.metallic());
    assert_eq!(deserialized.roughness(), original.roughness());
    assert_eq!(deserialized.emissive(), original.emissive());
    assert_eq!(deserialized.opacity(), original.opacity());
    assert_eq!(
        deserialized
            .get_texture(TextureSlot::BaseColor)
            .unwrap()
            .path(),
        original.get_texture(TextureSlot::BaseColor).unwrap().path()
    );
}

#[test]
fn test_library_serialization() {
    let mut library = MaterialLibrary::new();
    library.add_material(Material::new("Material 1"));
    library.add_material(Material::new("Material 2"));

    let json = serde_json::to_string(&library).unwrap();
    assert!(json.contains("Material 1"));
    assert!(json.contains("Material 2"));
}

#[test]
fn test_library_deserialization() {
    let json = r#"{
        "name": "Test Library",
        "name_index": {},
        "materials": {
            "550e8400-e29b-41d4-a716-446655440000": {
                "id": "550e8400-e29b-41d4-a716-446655440000",
                "name": "Material 1",
                "base_color": [0.8, 0.8, 0.8],
                "metallic": 0.0,
                "roughness": 0.5,
                "emissive": [0.0, 0.0, 0.0],
                "emissive_strength": 1.0,
                "ao_strength": 1.0,
                "normal_strength": 1.0,
                "height_strength": 1.0,
                "opacity": 1.0,
                "ior": 1.45,
                "textures": {},
                "metadata": {}
            }
        }
    }"#;

    let library: MaterialLibrary = serde_json::from_str(json).unwrap();
    assert_eq!(library.material_count(), 1);
}

#[test]
fn test_library_roundtrip() {
    let mut original = MaterialLibrary::new();
    let mut mat1 = Material::new("Material 1");
    mat1.set_metallic(0.8);
    let mut mat2 = Material::new("Material 2");
    mat2.set_roughness(0.3);

    original.add_material(mat1);
    original.add_material(mat2);

    let json = serde_json::to_string(&original).unwrap();
    let deserialized: MaterialLibrary = serde_json::from_str(&json).unwrap();

    assert_eq!(deserialized.material_count(), original.material_count());
}

// ============================================================================
// Error Handling Tests
// ============================================================================

#[test]
fn test_error_material_not_found() {
    let error = MaterialError::MaterialNotFound(uuid::Uuid::new_v4());
    assert!(error.to_string().contains("Material not found"));
}

#[test]
fn test_error_invalid_name() {
    let error = MaterialError::InvalidName("".to_string());
    assert!(error.to_string().contains("Invalid material name"));
}

#[test]
fn test_error_invalid_texture_path() {
    let error = MaterialError::InvalidTexturePath("".to_string());
    assert!(error.to_string().contains("Invalid texture path"));
}

#[test]
fn test_error_texture_not_found() {
    let error = MaterialError::TextureNotFound("missing.png".to_string());
    assert!(error.to_string().contains("Texture file not found"));
}

#[test]
fn test_error_invalid_property_value() {
    let error = MaterialError::InvalidPropertyValue("metallic out of range".to_string());
    assert!(error.to_string().contains("Invalid PBR property value"));
}
