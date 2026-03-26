// Property-Based Tests for Material UUID Uniqueness
// Feature: kautopbr-substance-parity-plus
// Property 11: Material UUID Uniqueness
// Validates: Requirements 9.2

#[cfg(test)]
mod tests {
    use super::super::*;
    use crate::gpu::GpuComputeDevice;
    use proptest::prelude::*;
    use std::collections::HashSet;
    use std::sync::Arc;

    // ============================================================================
    // Arbitrary Generators
    // ============================================================================

    /// Generate arbitrary MaterialMetadata for testing
    fn arb_material_metadata() -> impl Strategy<Value = MaterialMetadata> {
        (
            "[a-zA-Z0-9 ]{1,50}",                        // name
            "[a-zA-Z0-9 .,!?]{0,200}",                   // description
            prop::collection::vec("[a-z]{3,10}", 0..10), // tags
            "[a-zA-Z ]{1,30}",                           // author
            1u32..1000,                                  // version
            prop_oneof![
                Just(MaterialCategory::Metal),
                Just(MaterialCategory::Wood),
                Just(MaterialCategory::Stone),
                Just(MaterialCategory::Fabric),
                Just(MaterialCategory::Plastic),
                Just(MaterialCategory::Organic),
                Just(MaterialCategory::SciFi),
                Just(MaterialCategory::Fantasy),
            ],
        )
            .prop_map(|(name, description, tags, author, version, category)| {
                MaterialMetadata {
                    name,
                    description,
                    tags,
                    author,
                    created_at: chrono::Utc::now(),
                    modified_at: chrono::Utc::now(),
                    version,
                    category,
                }
            })
    }

    // ============================================================================
    // Property Tests
    // ============================================================================

    proptest! {
        #![proptest_config(ProptestConfig {
            cases: 100,  // Run 100+ iterations as specified in requirements
            .. ProptestConfig::default()
        })]

        /// **Property 11: Material UUID Uniqueness**
        ///
        /// For any two materials created by the MaterialSystem, their UUIDs must be
        /// unique and conform to valid RFC 4122 UUID format.
        ///
        /// **Validates: Requirements 9.2**
        ///
        /// This property ensures:
        /// - All generated UUIDs are unique across multiple material creations
        /// - UUIDs conform to RFC 4122 format (version 4, random)
        /// - No UUID collisions occur even with many materials
        /// - UUIDs are not nil (all zeros)
        #[test]
        fn prop_material_uuid_uniqueness(
            metadatas in prop::collection::vec(arb_material_metadata(), 10..100)
        ) {
            // Create MaterialSystem with mock GPU compute
            let gpu_compute = Arc::new(GpuComputeDevice::new_mock());
            let mut system = MaterialSystem::new(gpu_compute);

            let mut uuid_set = HashSet::new();
            let mut created_ids = Vec::new();

            // Create materials and collect their UUIDs
            for metadata in metadatas.iter() {
                let id = system.create_material(metadata.clone())
                    .expect("Material creation should succeed");

                // Verify UUID is not nil
                prop_assert_ne!(
                    id,
                    uuid::Uuid::nil(),
                    "Generated UUID should not be nil"
                );

                // Verify UUID is version 4 (random)
                prop_assert_eq!(
                    id.get_version(),
                    Some(uuid::Version::Random),
                    "UUID should be version 4 (random) per RFC 4122"
                );

                // Verify UUID is unique
                prop_assert!(
                    !uuid_set.contains(&id),
                    "Duplicate UUID generated: {}. This UUID was already created.",
                    id
                );

                uuid_set.insert(id);
                created_ids.push(id);
            }

            // Verify all UUIDs are unique (set size equals vector size)
            prop_assert_eq!(
                uuid_set.len(),
                created_ids.len(),
                "All UUIDs should be unique: expected {} unique UUIDs, got {}",
                created_ids.len(),
                uuid_set.len()
            );

            // Verify MaterialSystem contains all created materials
            prop_assert_eq!(
                system.materials().len(),
                created_ids.len(),
                "MaterialSystem should contain all created materials"
            );

            // Verify each UUID can retrieve its material
            for id in created_ids.iter() {
                prop_assert!(
                    system.get_material(id).is_some(),
                    "Material with UUID {} should be retrievable from MaterialSystem",
                    id
                );
            }
        }

        /// **Property 11b: Material UUID Format Validation**
        ///
        /// Verifies that all generated UUIDs conform to RFC 4122 format
        /// by checking string representation and byte structure.
        ///
        /// **Validates: Requirements 9.2**
        #[test]
        fn prop_material_uuid_format_validation(
            metadatas in prop::collection::vec(arb_material_metadata(), 10..50)
        ) {
            let gpu_compute = Arc::new(GpuComputeDevice::new_mock());
            let mut system = MaterialSystem::new(gpu_compute);

            for metadata in metadatas.iter() {
                let id = system.create_material(metadata.clone())
                    .expect("Material creation should succeed");

                // Verify UUID string format (8-4-4-4-12 hex digits)
                let uuid_str = id.to_string();
                prop_assert_eq!(
                    uuid_str.len(),
                    36,
                    "UUID string should be 36 characters long (including hyphens)"
                );

                // Verify hyphen positions
                prop_assert_eq!(
                    uuid_str.chars().nth(8),
                    Some('-'),
                    "UUID should have hyphen at position 8"
                );
                prop_assert_eq!(
                    uuid_str.chars().nth(13),
                    Some('-'),
                    "UUID should have hyphen at position 13"
                );
                prop_assert_eq!(
                    uuid_str.chars().nth(18),
                    Some('-'),
                    "UUID should have hyphen at position 18"
                );
                prop_assert_eq!(
                    uuid_str.chars().nth(23),
                    Some('-'),
                    "UUID should have hyphen at position 23"
                );

                // Verify all non-hyphen characters are valid hex digits
                for (i, c) in uuid_str.chars().enumerate() {
                    if i != 8 && i != 13 && i != 18 && i != 23 {
                        prop_assert!(
                            c.is_ascii_hexdigit(),
                            "Character at position {} should be a hex digit, got '{}'",
                            i,
                            c
                        );
                    }
                }

                // Verify UUID can be parsed back from string
                let parsed_uuid = uuid::Uuid::parse_str(&uuid_str);
                prop_assert!(
                    parsed_uuid.is_ok(),
                    "UUID string '{}' should be parseable",
                    uuid_str
                );
                prop_assert_eq!(
                    parsed_uuid.unwrap(),
                    id,
                    "Parsed UUID should match original"
                );
            }
        }

        /// **Property 11c: Material UUID Persistence**
        ///
        /// Verifies that material UUIDs remain stable across operations
        /// (adding layers, modifying metadata, etc.)
        ///
        /// **Validates: Requirements 9.2**
        #[test]
        fn prop_material_uuid_persistence(
            metadata in arb_material_metadata()
        ) {
            let gpu_compute = Arc::new(GpuComputeDevice::new_mock());
            let mut system = MaterialSystem::new(gpu_compute);

            // Create material and record its UUID
            let original_id = system.create_material(metadata.clone())
                .expect("Material creation should succeed");

            // Verify UUID doesn't change after adding layers
            let layer = Layer {
                id: uuid::Uuid::new_v4(),
                name: "Test Layer".to_string(),
                maps: PBRMaps {
                    albedo: None,
                    normal: None,
                    roughness: None,
                    metallic: None,
                    ao: None,
                    height: None,
                    emissive: None,
                },
                opacity: 1.0,
                blend_mode: BlendMode::Normal,
                mask: None,
                visible: true,
                locked: false,
            };

            system.add_layer(original_id, layer)
                .expect("Adding layer should succeed");

            // Verify material still exists with same UUID
            let material = system.get_material(&original_id);
            prop_assert!(
                material.is_some(),
                "Material should still exist after adding layer"
            );
            prop_assert_eq!(
                material.unwrap().id,
                original_id,
                "Material UUID should not change after adding layer"
            );

            // Verify UUID is still in the materials map
            prop_assert!(
                system.materials().contains_key(&original_id),
                "Material UUID should still be in materials map"
            );
        }
    }
}
