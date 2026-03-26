//! Property-based tests for k-os-material
//!
//! These tests use proptest to verify invariants hold for all possible inputs.

use glam::Vec3;
use k_os_material::{Material, MaterialLibrary, TextureInfo, TextureSlot};
use proptest::prelude::*;

// ============================================================================
// Test Strategies (Generators)
// ============================================================================

/// Generate arbitrary Vec3 values
fn arb_vec3() -> impl Strategy<Value = Vec3> {
    (any::<f32>(), any::<f32>(), any::<f32>()).prop_map(|(x, y, z)| Vec3::new(x, y, z))
}

/// Generate arbitrary Vec3 values with finite components (no NaN/Inf)
fn arb_vec3_finite() -> impl Strategy<Value = Vec3> {
    (
        prop::num::f32::NORMAL,
        prop::num::f32::NORMAL,
        prop::num::f32::NORMAL,
    )
        .prop_map(|(x, y, z)| Vec3::new(x, y, z))
}

/// Generate arbitrary f32 values (including edge cases)
fn arb_f32() -> impl Strategy<Value = f32> {
    any::<f32>()
}

/// Generate arbitrary finite f32 values (no NaN/Inf)
fn arb_f32_finite() -> impl Strategy<Value = f32> {
    prop::num::f32::NORMAL
}

/// Generate arbitrary material names
fn arb_material_name() -> impl Strategy<Value = String> {
    "[a-zA-Z0-9 _-]{1,50}"
}

/// Generate arbitrary texture slots
fn arb_texture_slot() -> impl Strategy<Value = TextureSlot> {
    prop_oneof![
        Just(TextureSlot::BaseColor),
        Just(TextureSlot::Metallic),
        Just(TextureSlot::Roughness),
        Just(TextureSlot::Normal),
        Just(TextureSlot::AmbientOcclusion),
        Just(TextureSlot::Emissive),
        Just(TextureSlot::Height),
        Just(TextureSlot::Opacity),
    ]
}

/// Generate arbitrary texture info
fn arb_texture_info() -> impl Strategy<Value = TextureInfo> {
    (
        "[a-zA-Z0-9_/.-]{1,100}",
        0u8..4,
        (prop::num::f32::NORMAL, prop::num::f32::NORMAL),
        (prop::num::f32::NORMAL, prop::num::f32::NORMAL),
        prop::num::f32::NORMAL,
        any::<bool>(),
    )
        .prop_map(|(path, uv_channel, scale, offset, rotation, srgb)| {
            let mut info = TextureInfo::new(path);
            info.set_uv_channel(uv_channel);
            info.set_scale(scale);
            info.set_offset(offset);
            info.set_rotation(rotation);
            info.set_srgb(srgb);
            info
        })
}

/// Generate arbitrary materials with valid properties
fn arb_material() -> impl Strategy<Value = Material> {
    // Split into two tuples to avoid proptest's 12-element limit
    let pbr_props = (
        arb_material_name(),
        arb_vec3_finite(),
        arb_f32_finite(),
        arb_f32_finite(),
        arb_vec3_finite(),
        arb_f32_finite(),
    );

    let other_props = (
        arb_f32_finite(),
        arb_f32_finite(),
        arb_f32_finite(),
        arb_f32_finite(),
        arb_f32_finite(),
        prop::collection::hash_map(arb_texture_slot(), arb_texture_info(), 0..8),
        prop::collection::hash_map("[a-zA-Z0-9_]{1,20}", "[a-zA-Z0-9 _-]{0,50}", 0..10),
    );

    (pbr_props, other_props).prop_map(
        |(
            (name, base_color, metallic, roughness, emissive, emissive_strength),
            (ao_strength, normal_strength, height_strength, opacity, ior, textures, metadata),
        )| {
            let mut mat = Material::new(name);
            mat.set_base_color(base_color);
            mat.set_metallic(metallic);
            mat.set_roughness(roughness);
            mat.set_emissive(emissive);
            mat.set_emissive_strength(emissive_strength);
            mat.set_ao_strength(ao_strength);
            mat.set_normal_strength(normal_strength);
            mat.set_height_strength(height_strength);
            mat.set_opacity(opacity);
            mat.set_ior(ior);

            for (slot, info) in textures {
                mat.set_texture_info(slot, info);
            }

            for (key, value) in metadata {
                mat.set_metadata(key, value);
            }

            mat
        },
    )
}

/// Generate arbitrary material libraries
fn arb_material_library() -> impl Strategy<Value = MaterialLibrary> {
    (
        "[a-zA-Z0-9 _-]{1,50}",
        prop::collection::vec(arb_material(), 0..20),
    )
        .prop_map(|(name, materials)| {
            let mut library = MaterialLibrary::with_name(name);
            for material in materials {
                library.add_material(material);
            }
            library
        })
}

// ============================================================================
// Property 13: Material Property Clamping
// **Validates: Requirements 5.1, 5.2**
// ============================================================================

proptest! {
    /// Property 13.1: Metallic is always clamped to [0.0, 1.0]
    ///
    /// For any input value, the metallic property should be clamped to the valid range.
    /// This ensures materials always have physically valid metallic values.
    ///
    /// **Validates: Requirements 5.1, 5.2**
    #[test]
    fn prop_metallic_clamping(value in arb_f32()) {
        let mut mat = Material::new("Test");
        mat.set_metallic(value);

        let metallic = mat.metallic();

        // Property: metallic is always in [0.0, 1.0]
        prop_assert!(metallic >= 0.0 && metallic <= 1.0,
            "Metallic {} is outside valid range [0.0, 1.0] for input {}",
            metallic, value);

        // Property: if input is in range, output equals input
        if value >= 0.0 && value <= 1.0 && value.is_finite() {
            prop_assert!((metallic - value).abs() < 1e-6,
                "Metallic {} should equal input {} when input is in valid range",
                metallic, value);
        }
    }

    /// Property 13.2: Roughness is always clamped to [0.0, 1.0]
    ///
    /// For any input value, the roughness property should be clamped to the valid range.
    /// This ensures materials always have physically valid roughness values.
    ///
    /// **Validates: Requirements 5.1, 5.2**
    #[test]
    fn prop_roughness_clamping(value in arb_f32()) {
        let mut mat = Material::new("Test");
        mat.set_roughness(value);

        let roughness = mat.roughness();

        // Property: roughness is always in [0.0, 1.0]
        prop_assert!(roughness >= 0.0 && roughness <= 1.0,
            "Roughness {} is outside valid range [0.0, 1.0] for input {}",
            roughness, value);

        // Property: if input is in range, output equals input
        if value >= 0.0 && value <= 1.0 && value.is_finite() {
            prop_assert!((roughness - value).abs() < 1e-6,
                "Roughness {} should equal input {} when input is in valid range",
                roughness, value);
        }
    }

    /// Property 13.3: Opacity is always clamped to [0.0, 1.0]
    ///
    /// For any input value, the opacity property should be clamped to the valid range.
    /// This ensures materials always have valid transparency values.
    ///
    /// **Validates: Requirements 5.1, 5.2**
    #[test]
    fn prop_opacity_clamping(value in arb_f32()) {
        let mut mat = Material::new("Test");
        mat.set_opacity(value);

        let opacity = mat.opacity();

        // Property: opacity is always in [0.0, 1.0]
        prop_assert!(opacity >= 0.0 && opacity <= 1.0,
            "Opacity {} is outside valid range [0.0, 1.0] for input {}",
            opacity, value);

        // Property: if input is in range, output equals input
        if value >= 0.0 && value <= 1.0 && value.is_finite() {
            prop_assert!((opacity - value).abs() < 1e-6,
                "Opacity {} should equal input {} when input is in valid range",
                opacity, value);
        }
    }

    /// Property 13.4: AO strength is always clamped to [0.0, 1.0]
    ///
    /// For any input value, the AO strength property should be clamped to the valid range.
    ///
    /// **Validates: Requirements 5.1, 5.2**
    #[test]
    fn prop_ao_strength_clamping(value in arb_f32()) {
        let mut mat = Material::new("Test");
        mat.set_ao_strength(value);

        let ao_strength = mat.ao_strength();

        // Property: ao_strength is always in [0.0, 1.0]
        prop_assert!(ao_strength >= 0.0 && ao_strength <= 1.0,
            "AO strength {} is outside valid range [0.0, 1.0] for input {}",
            ao_strength, value);
    }

    /// Property 13.5: Normal strength is always clamped to [0.0, 1.0]
    ///
    /// For any input value, the normal strength property should be clamped to the valid range.
    ///
    /// **Validates: Requirements 5.1, 5.2**
    #[test]
    fn prop_normal_strength_clamping(value in arb_f32()) {
        let mut mat = Material::new("Test");
        mat.set_normal_strength(value);

        let normal_strength = mat.normal_strength();

        // Property: normal_strength is always in [0.0, 1.0]
        prop_assert!(normal_strength >= 0.0 && normal_strength <= 1.0,
            "Normal strength {} is outside valid range [0.0, 1.0] for input {}",
            normal_strength, value);
    }

    /// Property 13.6: Base color is clamped to [0.0, 1.0] per component
    ///
    /// For any input color, each component should be clamped to the valid range.
    /// This ensures materials always have valid color values.
    ///
    /// **Validates: Requirements 5.1, 5.2**
    #[test]
    fn prop_base_color_clamping(color in arb_vec3()) {
        let mut mat = Material::new("Test");
        mat.set_base_color(color);

        let base_color = mat.base_color();

        // Property: each component is in [0.0, 1.0]
        prop_assert!(base_color.x >= 0.0 && base_color.x <= 1.0,
            "Base color X {} is outside valid range [0.0, 1.0]", base_color.x);
        prop_assert!(base_color.y >= 0.0 && base_color.y <= 1.0,
            "Base color Y {} is outside valid range [0.0, 1.0]", base_color.y);
        prop_assert!(base_color.z >= 0.0 && base_color.z <= 1.0,
            "Base color Z {} is outside valid range [0.0, 1.0]", base_color.z);
    }

    /// Property 13.7: Emissive color is clamped to non-negative values
    ///
    /// For any input color, each component should be >= 0.0 (but can exceed 1.0 for HDR).
    /// This ensures materials can have HDR emissive values while preventing negative values.
    ///
    /// **Validates: Requirements 5.1, 5.2**
    #[test]
    fn prop_emissive_non_negative(color in arb_vec3()) {
        let mut mat = Material::new("Test");
        mat.set_emissive(color);

        let emissive = mat.emissive();

        // Property: each component is >= 0.0 (can exceed 1.0 for HDR)
        prop_assert!(emissive.x >= 0.0,
            "Emissive X {} should be non-negative", emissive.x);
        prop_assert!(emissive.y >= 0.0,
            "Emissive Y {} should be non-negative", emissive.y);
        prop_assert!(emissive.z >= 0.0,
            "Emissive Z {} should be non-negative", emissive.z);
    }

    /// Property 13.8: Emissive strength is clamped to non-negative values
    ///
    /// For any input value, the emissive strength should be >= 0.0.
    ///
    /// **Validates: Requirements 5.1, 5.2**
    #[test]
    fn prop_emissive_strength_non_negative(value in arb_f32()) {
        let mut mat = Material::new("Test");
        mat.set_emissive_strength(value);

        let strength = mat.emissive_strength();

        // Property: emissive_strength is >= 0.0
        prop_assert!(strength >= 0.0,
            "Emissive strength {} should be non-negative for input {}",
            strength, value);
    }

    /// Property 13.9: IOR is clamped to >= 1.0
    ///
    /// For any input value, the index of refraction should be >= 1.0.
    /// This ensures physically valid IOR values (vacuum has IOR = 1.0).
    ///
    /// **Validates: Requirements 5.1, 5.2**
    #[test]
    fn prop_ior_minimum(value in arb_f32()) {
        let mut mat = Material::new("Test");
        mat.set_ior(value);

        let ior = mat.ior();

        // Property: ior is >= 1.0
        prop_assert!(ior >= 1.0,
            "IOR {} should be >= 1.0 for input {}",
            ior, value);
    }

    /// Property 13.10: All clamped properties remain valid after multiple operations
    ///
    /// After setting multiple properties with arbitrary values, all clamped properties
    /// should still be within their valid ranges.
    ///
    /// **Validates: Requirements 5.1, 5.2**
    #[test]
    fn prop_all_properties_valid_after_operations(
        metallic in arb_f32(),
        roughness in arb_f32(),
        opacity in arb_f32(),
        ao in arb_f32(),
        normal in arb_f32(),
        base_color in arb_vec3(),
        emissive in arb_vec3(),
        emissive_strength in arb_f32(),
        ior in arb_f32(),
    ) {
        let mut mat = Material::new("Test");

        // Set all properties
        mat.set_metallic(metallic);
        mat.set_roughness(roughness);
        mat.set_opacity(opacity);
        mat.set_ao_strength(ao);
        mat.set_normal_strength(normal);
        mat.set_base_color(base_color);
        mat.set_emissive(emissive);
        mat.set_emissive_strength(emissive_strength);
        mat.set_ior(ior);

        // Verify all properties are valid
        prop_assert!(mat.metallic() >= 0.0 && mat.metallic() <= 1.0);
        prop_assert!(mat.roughness() >= 0.0 && mat.roughness() <= 1.0);
        prop_assert!(mat.opacity() >= 0.0 && mat.opacity() <= 1.0);
        prop_assert!(mat.ao_strength() >= 0.0 && mat.ao_strength() <= 1.0);
        prop_assert!(mat.normal_strength() >= 0.0 && mat.normal_strength() <= 1.0);

        let bc = mat.base_color();
        prop_assert!(bc.x >= 0.0 && bc.x <= 1.0);
        prop_assert!(bc.y >= 0.0 && bc.y <= 1.0);
        prop_assert!(bc.z >= 0.0 && bc.z <= 1.0);

        let em = mat.emissive();
        prop_assert!(em.x >= 0.0);
        prop_assert!(em.y >= 0.0);
        prop_assert!(em.z >= 0.0);

        prop_assert!(mat.emissive_strength() >= 0.0);
        prop_assert!(mat.ior() >= 1.0);
    }
}

// ============================================================================
// Property 14: Material Serialization Round-Trip
// **Validates: Requirement 5.6**
// ============================================================================

proptest! {
    /// Property 14.1: Material serialization round-trip preserves all properties
    ///
    /// For any valid material, serializing to JSON and deserializing back should
    /// produce an equivalent material with all properties preserved.
    ///
    /// **Validates: Requirement 5.6**
    #[test]
    fn prop_material_serialization_roundtrip(material in arb_material()) {
        // Serialize to JSON
        let json = serde_json::to_string(&material)
            .expect("Failed to serialize material");

        // Deserialize back
        let deserialized: Material = serde_json::from_str(&json)
            .expect("Failed to deserialize material");

        // Verify all properties are preserved
        prop_assert_eq!(material.name(), deserialized.name(),
            "Material name not preserved");

        // PBR properties
        prop_assert!((material.metallic() - deserialized.metallic()).abs() < 1e-6,
            "Metallic not preserved: {} vs {}", material.metallic(), deserialized.metallic());
        prop_assert!((material.roughness() - deserialized.roughness()).abs() < 1e-6,
            "Roughness not preserved");
        prop_assert!((material.opacity() - deserialized.opacity()).abs() < 1e-6,
            "Opacity not preserved");
        prop_assert!((material.ao_strength() - deserialized.ao_strength()).abs() < 1e-6,
            "AO strength not preserved");
        prop_assert!((material.normal_strength() - deserialized.normal_strength()).abs() < 1e-6,
            "Normal strength not preserved");
        prop_assert!((material.height_strength() - deserialized.height_strength()).abs() < 1e-6,
            "Height strength not preserved");
        prop_assert!((material.emissive_strength() - deserialized.emissive_strength()).abs() < 1e-6,
            "Emissive strength not preserved");
        prop_assert!((material.ior() - deserialized.ior()).abs() < 1e-6,
            "IOR not preserved");

        // Vec3 properties
        let bc_diff = (material.base_color() - deserialized.base_color()).length();
        prop_assert!(bc_diff < 1e-6, "Base color not preserved");

        let em_diff = (material.emissive() - deserialized.emissive()).length();
        prop_assert!(em_diff < 1e-6, "Emissive not preserved");

        // Texture slots
        prop_assert_eq!(material.texture_slots().len(), deserialized.texture_slots().len(),
            "Texture slot count not preserved");

        for slot in material.texture_slots() {
            prop_assert!(deserialized.has_texture(slot),
                "Texture slot {:?} not preserved", slot);

            let orig_tex = material.get_texture(slot).unwrap();
            let deser_tex = deserialized.get_texture(slot).unwrap();

            prop_assert_eq!(orig_tex.path(), deser_tex.path(),
                "Texture path not preserved for slot {:?}", slot);
            prop_assert_eq!(orig_tex.uv_channel(), deser_tex.uv_channel(),
                "UV channel not preserved for slot {:?}", slot);
            prop_assert_eq!(orig_tex.is_srgb(), deser_tex.is_srgb(),
                "sRGB flag not preserved for slot {:?}", slot);
        }

        // Metadata
        prop_assert_eq!(material.metadata().len(), deserialized.metadata().len(),
            "Metadata count not preserved");

        for (key, value) in material.metadata() {
            prop_assert_eq!(deserialized.get_metadata(key), Some(value.as_str()),
                "Metadata key '{}' not preserved", key);
        }
    }

    /// Property 14.2: Material library serialization round-trip preserves all materials
    ///
    /// For any valid material library, serializing to JSON and deserializing back should
    /// produce an equivalent library with all materials preserved.
    ///
    /// **Validates: Requirement 5.6**
    #[test]
    fn prop_library_serialization_roundtrip(library in arb_material_library()) {
        // Serialize to JSON
        let json = serde_json::to_string(&library)
            .expect("Failed to serialize library");

        // Deserialize back
        let deserialized: MaterialLibrary = serde_json::from_str(&json)
            .expect("Failed to deserialize library");

        // Verify library properties
        prop_assert_eq!(library.name(), deserialized.name(),
            "Library name not preserved");
        prop_assert_eq!(library.material_count(), deserialized.material_count(),
            "Material count not preserved");

        // Verify all materials are preserved
        for id in library.material_ids() {
            prop_assert!(deserialized.contains_material(&id),
                "Material ID {:?} not preserved", id);

            let orig_mat = library.get_material(&id).unwrap();
            let deser_mat = deserialized.get_material(&id).unwrap();

            prop_assert_eq!(orig_mat.name(), deser_mat.name(),
                "Material name not preserved for ID {:?}", id);
            prop_assert!((orig_mat.metallic() - deser_mat.metallic()).abs() < 1e-6,
                "Material properties not preserved for ID {:?}", id);
        }

        // Verify name index is preserved
        for name in library.material_names() {
            prop_assert!(deserialized.contains_name(&name),
                "Material name '{}' not in name index", name);
        }
    }

    /// Property 14.3: Serialization is deterministic
    ///
    /// Serializing the same material multiple times should produce the same JSON.
    ///
    /// **Validates: Requirement 5.6**
    #[test]
    fn prop_serialization_deterministic(material in arb_material()) {
        let json1 = serde_json::to_string(&material)
            .expect("Failed to serialize material (1)");
        let json2 = serde_json::to_string(&material)
            .expect("Failed to serialize material (2)");

        prop_assert_eq!(json1, json2,
            "Serialization is not deterministic");
    }

    /// Property 14.4: Deserialization handles valid JSON
    ///
    /// Any material that can be serialized should be deserializable.
    ///
    /// **Validates: Requirement 5.6**
    #[test]
    fn prop_valid_json_deserializes(material in arb_material()) {
        let json = serde_json::to_string(&material)
            .expect("Failed to serialize material");

        let result: Result<Material, _> = serde_json::from_str(&json);

        prop_assert!(result.is_ok(),
            "Failed to deserialize valid JSON: {:?}", result.err());
    }

    /// Property 14.5: Library round-trip preserves material order
    ///
    /// After serialization and deserialization, materials should be retrievable
    /// by their original IDs.
    ///
    /// **Validates: Requirement 5.6**
    #[test]
    fn prop_library_preserves_material_ids(library in arb_material_library()) {
        let json = serde_json::to_string(&library)
            .expect("Failed to serialize library");

        let deserialized: MaterialLibrary = serde_json::from_str(&json)
            .expect("Failed to deserialize library");

        // Collect original IDs
        let original_ids: Vec<_> = library.material_ids();

        // Verify all IDs are present in deserialized library
        for id in original_ids {
            prop_assert!(deserialized.contains_material(&id),
                "Material ID {:?} not found after round-trip", id);
        }
    }

    /// Property 14.6: Texture slot information is preserved through serialization
    ///
    /// All texture slot assignments and their properties should be preserved.
    ///
    /// **Validates: Requirement 5.6**
    #[test]
    fn prop_texture_slots_preserved(
        material in arb_material(),
        slot in arb_texture_slot(),
        texture_info in arb_texture_info(),
    ) {
        let mut mat = material;
        mat.set_texture_info(slot, texture_info.clone());

        // Serialize and deserialize
        let json = serde_json::to_string(&mat)
            .expect("Failed to serialize material");
        let deserialized: Material = serde_json::from_str(&json)
            .expect("Failed to deserialize material");

        // Verify texture slot is preserved
        prop_assert!(deserialized.has_texture(slot),
            "Texture slot {:?} not preserved", slot);

        let deser_tex = deserialized.get_texture(slot).unwrap();
        prop_assert_eq!(texture_info.path(), deser_tex.path(),
            "Texture path not preserved");
        prop_assert_eq!(texture_info.uv_channel(), deser_tex.uv_channel(),
            "UV channel not preserved");
        prop_assert_eq!(texture_info.scale(), deser_tex.scale(),
            "Texture scale not preserved");
        prop_assert_eq!(texture_info.offset(), deser_tex.offset(),
            "Texture offset not preserved");
        prop_assert!((texture_info.rotation() - deser_tex.rotation()).abs() < 1e-6,
            "Texture rotation not preserved");
        prop_assert_eq!(texture_info.is_srgb(), deser_tex.is_srgb(),
            "sRGB flag not preserved");
    }
}
