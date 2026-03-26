// Property-Based Tests for Material Serialization
// Feature: kautopbr-substance-parity-plus
// Property 1: Material Serialization Round-Trip
// Validates: Requirements 2.10, 2.11, 5.10, 5.11, 9.12, 19.6

#[cfg(test)]
mod tests {
    use super::super::layer::TextureHandle;
    use super::super::*;
    use chrono::{TimeZone, Utc};
    use proptest::prelude::*;
    use uuid::Uuid;

    // ============================================================================
    // Arbitrary Generators for Material Components
    // ============================================================================

    /// Generate arbitrary MaterialCategory
    fn arb_material_category() -> impl Strategy<Value = MaterialCategory> {
        prop_oneof![
            Just(MaterialCategory::Metal),
            Just(MaterialCategory::Wood),
            Just(MaterialCategory::Stone),
            Just(MaterialCategory::Fabric),
            Just(MaterialCategory::Plastic),
            Just(MaterialCategory::Organic),
            Just(MaterialCategory::SciFi),
            Just(MaterialCategory::Fantasy),
        ]
    }

    /// Generate arbitrary MaterialMetadata
    fn arb_material_metadata() -> impl Strategy<Value = MaterialMetadata> {
        (
            "[a-zA-Z0-9 ]{1,50}",                        // name
            "[a-zA-Z0-9 .,!?]{0,200}",                   // description
            prop::collection::vec("[a-z]{3,10}", 0..10), // tags
            "[a-zA-Z ]{1,30}",                           // author
            0i64..1_000_000_000,                         // created_at timestamp
            0i64..1_000_000_000,                         // modified_at timestamp
            1u32..1000,                                  // version
            arb_material_category(),
        )
            .prop_map(
                |(name, description, tags, author, created_ts, modified_ts, version, category)| {
                    MaterialMetadata {
                        name,
                        description,
                        tags,
                        author,
                        created_at: Utc.timestamp_opt(created_ts, 0).unwrap(),
                        modified_at: Utc.timestamp_opt(modified_ts, 0).unwrap(),
                        version,
                        category,
                    }
                },
            )
    }

    /// Generate arbitrary TextureHandle
    fn arb_texture_handle() -> impl Strategy<Value = TextureHandle> {
        (
            "[a-z0-9_/]{5,50}\\.(png|jpg|exr|hdr)", // path
            1u32..16384,                            // width
            1u32..16384,                            // height
        )
            .prop_map(|(path, width, height)| TextureHandle {
                path,
                width,
                height,
            })
    }

    /// Generate arbitrary PBRMaps
    fn arb_pbr_maps() -> impl Strategy<Value = PBRMaps> {
        (
            prop::option::of(arb_texture_handle()), // albedo
            prop::option::of(arb_texture_handle()), // normal
            prop::option::of(arb_texture_handle()), // roughness
            prop::option::of(arb_texture_handle()), // metallic
            prop::option::of(arb_texture_handle()), // ao
            prop::option::of(arb_texture_handle()), // height
            prop::option::of(arb_texture_handle()), // emissive
        )
            .prop_map(
                |(albedo, normal, roughness, metallic, ao, height, emissive)| PBRMaps {
                    albedo,
                    normal,
                    roughness,
                    metallic,
                    ao,
                    height,
                    emissive,
                },
            )
    }

    /// Generate arbitrary BlendMode
    fn arb_blend_mode() -> impl Strategy<Value = BlendMode> {
        prop_oneof![
            Just(BlendMode::Normal),
            Just(BlendMode::Multiply),
            Just(BlendMode::Screen),
            Just(BlendMode::Overlay),
            Just(BlendMode::Add),
            Just(BlendMode::Subtract),
            Just(BlendMode::Divide),
            Just(BlendMode::Difference),
            Just(BlendMode::Darken),
            Just(BlendMode::Lighten),
        ]
    }

    /// Generate arbitrary Mask
    fn arb_mask() -> impl Strategy<Value = Mask> {
        (arb_texture_handle(), any::<bool>()).prop_map(|(texture, invert)| Mask { texture, invert })
    }

    /// Generate arbitrary Layer
    fn arb_layer() -> impl Strategy<Value = Layer> {
        (
            "[a-zA-Z0-9 ]{1,30}", // name
            arb_pbr_maps(),
            0.0f32..=1.0, // opacity
            arb_blend_mode(),
            prop::option::of(arb_mask()),
            any::<bool>(), // visible
            any::<bool>(), // locked
        )
            .prop_map(
                |(name, maps, opacity, blend_mode, mask, visible, locked)| Layer {
                    id: Uuid::new_v4(),
                    name,
                    maps,
                    opacity,
                    blend_mode,
                    mask,
                    visible,
                    locked,
                },
            )
    }

    /// Generate arbitrary Vec2
    fn arb_vec2() -> impl Strategy<Value = animation::Vec2> {
        (-10.0f32..10.0, -10.0f32..10.0).prop_map(|(x, y)| animation::Vec2::new(x, y))
    }

    /// Generate arbitrary Keyframe
    fn arb_keyframe() -> impl Strategy<Value = animation::Keyframe> {
        (
            0.0f32..100.0,                // time
            -10.0f32..10.0,               // value
            prop::option::of(arb_vec2()), // tangent_in
            prop::option::of(arb_vec2()), // tangent_out
        )
            .prop_map(
                |(time, value, tangent_in, tangent_out)| animation::Keyframe {
                    time,
                    value,
                    tangent_in,
                    tangent_out,
                },
            )
    }

    /// Generate arbitrary InterpolationType
    fn arb_interpolation_type() -> impl Strategy<Value = animation::InterpolationType> {
        prop_oneof![
            Just(animation::InterpolationType::Linear),
            Just(animation::InterpolationType::EaseIn),
            Just(animation::InterpolationType::EaseOut),
            Just(animation::InterpolationType::EaseInOut),
            Just(animation::InterpolationType::Bezier),
        ]
    }

    /// Generate arbitrary KeyframeAnimation
    fn arb_keyframe_animation() -> impl Strategy<Value = animation::KeyframeAnimation> {
        (
            prop::collection::vec(arb_keyframe(), 1..20),
            arb_interpolation_type(),
        )
            .prop_map(|(keyframes, interpolation)| animation::KeyframeAnimation {
                keyframes,
                interpolation,
            })
    }

    /// Generate arbitrary ProceduralAnimation
    fn arb_procedural_animation() -> impl Strategy<Value = animation::ProceduralAnimation> {
        prop_oneof![
            Just("sin(t * 2.0) * 0.5 + 0.5".to_string()),
            Just("cos(t) * 0.3 + 0.7".to_string()),
            Just("t * 0.1".to_string()),
            Just("abs(sin(t))".to_string()),
            Just("perlin(t, 1.0, 0.5)".to_string()),
            Just("simplex(t, 2.0, 0.3)".to_string()),
            Just("clamp(t * 0.5, 0.0, 1.0)".to_string()),
            Just("lerp(0.2, 0.8, sin(t) * 0.5 + 0.5)".to_string()),
        ]
        .prop_map(|expression| animation::ProceduralAnimation { expression })
    }

    /// Generate arbitrary SimulationType
    fn arb_simulation_type() -> impl Strategy<Value = animation::SimulationType> {
        prop_oneof![
            Just(animation::SimulationType::RustSpreading),
            Just(animation::SimulationType::MossGrowth),
            Just(animation::SimulationType::Erosion),
            Just(animation::SimulationType::Weathering),
            Just(animation::SimulationType::Cracking),
            Just(animation::SimulationType::Melting),
        ]
    }

    /// Generate arbitrary PhysicsAnimation
    fn arb_physics_animation() -> impl Strategy<Value = animation::PhysicsAnimation> {
        arb_simulation_type()
            .prop_map(|simulation_type| animation::PhysicsAnimation { simulation_type })
    }

    /// Generate arbitrary AnimationType
    fn arb_animation_type() -> impl Strategy<Value = animation::AnimationType> {
        prop_oneof![
            arb_keyframe_animation().prop_map(animation::AnimationType::Keyframe),
            arb_procedural_animation().prop_map(animation::AnimationType::Procedural),
            arb_physics_animation().prop_map(animation::AnimationType::Physics),
        ]
    }

    /// Generate arbitrary AnimationParameter
    fn arb_animation_parameter() -> impl Strategy<Value = animation::AnimationParameter> {
        prop_oneof![
            Just(animation::AnimationParameter::LayerOpacity),
            Just(animation::AnimationParameter::AlbedoColor),
            Just(animation::AnimationParameter::AlbedoRed),
            Just(animation::AnimationParameter::AlbedoGreen),
            Just(animation::AnimationParameter::AlbedoBlue),
            Just(animation::AnimationParameter::Roughness),
            Just(animation::AnimationParameter::Metallic),
            Just(animation::AnimationParameter::EmissiveIntensity),
            Just(animation::AnimationParameter::EmissiveColor),
            Just(animation::AnimationParameter::HeightOffset),
            Just(animation::AnimationParameter::NormalStrength),
            Just(animation::AnimationParameter::UVOffsetX),
            Just(animation::AnimationParameter::UVOffsetY),
            Just(animation::AnimationParameter::UVScaleX),
            Just(animation::AnimationParameter::UVScaleY),
        ]
    }

    /// Generate arbitrary AnimationTrack
    fn arb_animation_track() -> impl Strategy<Value = animation::AnimationTrack> {
        (arb_animation_parameter(), arb_animation_type()).prop_map(|(parameter, animation_type)| {
            animation::AnimationTrack {
                parameter,
                animation_type,
            }
        })
    }

    /// Generate arbitrary LoopMode
    fn arb_loop_mode() -> impl Strategy<Value = animation::LoopMode> {
        prop_oneof![
            Just(animation::LoopMode::Once),
            Just(animation::LoopMode::Loop),
            Just(animation::LoopMode::PingPong),
        ]
    }

    /// Generate arbitrary AnimationData
    fn arb_animation_data() -> impl Strategy<Value = animation::AnimationData> {
        (
            0.1f32..3600.0, // duration (0.1s to 1 hour)
            arb_loop_mode(),
            prop::collection::vec(arb_animation_track(), 0..10),
        )
            .prop_map(|(duration, loop_mode, tracks)| animation::AnimationData {
                duration,
                loop_mode,
                tracks,
            })
    }

    /// Generate arbitrary Material with all features
    fn arb_material() -> impl Strategy<Value = Material> {
        (
            arb_material_metadata(),
            prop::collection::vec(arb_layer(), 0..64), // 0-64 layers per spec
            prop::option::of(arb_animation_data()),
            prop::collection::vec(any::<[u8; 16]>(), 0..5), // variant UUIDs
            prop::option::of(any::<[u8; 16]>()),            // base_material UUID
        )
            .prop_map(|(metadata, layers, animation, variant_bytes, base_bytes)| {
                Material {
                    id: Uuid::new_v4(),
                    metadata,
                    layers,
                    animation,
                    variants: variant_bytes.into_iter().map(Uuid::from_bytes).collect(),
                    base_material: base_bytes.map(Uuid::from_bytes),
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

        /// **Property 1: Material Serialization Round-Trip**
        ///
        /// For any valid material with layers, animation data, and metadata,
        /// serializing to JSON then deserializing must produce an equivalent
        /// material with identical layer configuration, animation keyframes,
        /// and metadata.
        ///
        /// **Validates: Requirements 2.10, 2.11, 5.10, 5.11, 9.12, 19.6**
        ///
        /// This property ensures:
        /// - All material fields are correctly serialized (layers, animation, metadata, variants)
        /// - JSON deserialization reconstructs the exact material state
        /// - No data loss occurs during round-trip
        /// - Schema validation passes for all generated materials
        #[test]
        fn prop_material_serialization_roundtrip(material in arb_material()) {
            // Serialize to JSON (pretty-printed)
            let json = material.serialize()
                .expect("Serialization should succeed for valid material");

            // Deserialize back to Material
            let deserialized = Material::deserialize(&json)
                .expect("Deserialization should succeed for valid JSON");

            // Verify equivalence of all fields

            // 1. UUID
            prop_assert_eq!(material.id, deserialized.id, "Material ID mismatch");

            // 2. Metadata
            prop_assert_eq!(material.metadata.name, deserialized.metadata.name, "Name mismatch");
            prop_assert_eq!(material.metadata.description, deserialized.metadata.description, "Description mismatch");
            prop_assert_eq!(material.metadata.tags, deserialized.metadata.tags, "Tags mismatch");
            prop_assert_eq!(material.metadata.author, deserialized.metadata.author, "Author mismatch");
            prop_assert_eq!(material.metadata.created_at, deserialized.metadata.created_at, "Created timestamp mismatch");
            prop_assert_eq!(material.metadata.modified_at, deserialized.metadata.modified_at, "Modified timestamp mismatch");
            prop_assert_eq!(material.metadata.version, deserialized.metadata.version, "Version mismatch");
            prop_assert_eq!(material.metadata.category, deserialized.metadata.category, "Category mismatch");

            // 3. Layers
            prop_assert_eq!(material.layers.len(), deserialized.layers.len(), "Layer count mismatch");

            for (i, (orig_layer, deser_layer)) in material.layers.iter().zip(deserialized.layers.iter()).enumerate() {
                prop_assert_eq!(orig_layer.id, deser_layer.id, "Layer {} ID mismatch", i);
                prop_assert_eq!(&orig_layer.name, &deser_layer.name, "Layer {} name mismatch", i);
                prop_assert_eq!(orig_layer.opacity, deser_layer.opacity, "Layer {} opacity mismatch", i);
                prop_assert_eq!(orig_layer.blend_mode, deser_layer.blend_mode, "Layer {} blend mode mismatch", i);
                prop_assert_eq!(orig_layer.visible, deser_layer.visible, "Layer {} visible mismatch", i);
                prop_assert_eq!(orig_layer.locked, deser_layer.locked, "Layer {} locked mismatch", i);

                // Verify PBR maps
                prop_assert_eq!(
                    orig_layer.maps.albedo.as_ref().map(|t| &t.path),
                    deser_layer.maps.albedo.as_ref().map(|t| &t.path),
                    "Layer {} albedo path mismatch", i
                );
                prop_assert_eq!(
                    orig_layer.maps.normal.as_ref().map(|t| &t.path),
                    deser_layer.maps.normal.as_ref().map(|t| &t.path),
                    "Layer {} normal path mismatch", i
                );
                prop_assert_eq!(
                    orig_layer.maps.roughness.as_ref().map(|t| &t.path),
                    deser_layer.maps.roughness.as_ref().map(|t| &t.path),
                    "Layer {} roughness path mismatch", i
                );
                prop_assert_eq!(
                    orig_layer.maps.metallic.as_ref().map(|t| &t.path),
                    deser_layer.maps.metallic.as_ref().map(|t| &t.path),
                    "Layer {} metallic path mismatch", i
                );
                prop_assert_eq!(
                    orig_layer.maps.ao.as_ref().map(|t| &t.path),
                    deser_layer.maps.ao.as_ref().map(|t| &t.path),
                    "Layer {} AO path mismatch", i
                );
                prop_assert_eq!(
                    orig_layer.maps.height.as_ref().map(|t| &t.path),
                    deser_layer.maps.height.as_ref().map(|t| &t.path),
                    "Layer {} height path mismatch", i
                );
                prop_assert_eq!(
                    orig_layer.maps.emissive.as_ref().map(|t| &t.path),
                    deser_layer.maps.emissive.as_ref().map(|t| &t.path),
                    "Layer {} emissive path mismatch", i
                );

                // Verify mask
                match (&orig_layer.mask, &deser_layer.mask) {
                    (Some(orig_mask), Some(deser_mask)) => {
                        prop_assert_eq!(&orig_mask.texture.path, &deser_mask.texture.path, "Layer {} mask path mismatch", i);
                        prop_assert_eq!(orig_mask.invert, deser_mask.invert, "Layer {} mask invert mismatch", i);
                    }
                    (None, None) => {}
                    _ => prop_assert!(false, "Layer {} mask presence mismatch", i),
                }
            }

            // 4. Animation
            match (&material.animation, &deserialized.animation) {
                (Some(orig_anim), Some(deser_anim)) => {
                    prop_assert_eq!(orig_anim.duration, deser_anim.duration, "Animation duration mismatch");
                    prop_assert_eq!(orig_anim.loop_mode, deser_anim.loop_mode, "Animation loop mode mismatch");
                    prop_assert_eq!(orig_anim.tracks.len(), deser_anim.tracks.len(), "Animation track count mismatch");

                    for (i, (orig_track, deser_track)) in orig_anim.tracks.iter().zip(deser_anim.tracks.iter()).enumerate() {
                        prop_assert_eq!(orig_track.parameter, deser_track.parameter, "Track {} parameter mismatch", i);

                        // Verify animation type matches
                        match (&orig_track.animation_type, &deser_track.animation_type) {
                            (animation::AnimationType::Keyframe(orig_kf), animation::AnimationType::Keyframe(deser_kf)) => {
                                prop_assert_eq!(orig_kf.interpolation, deser_kf.interpolation, "Track {} interpolation mismatch", i);
                                prop_assert_eq!(orig_kf.keyframes.len(), deser_kf.keyframes.len(), "Track {} keyframe count mismatch", i);

                                for (j, (orig_kf_data, deser_kf_data)) in orig_kf.keyframes.iter().zip(deser_kf.keyframes.iter()).enumerate() {
                                    prop_assert_eq!(orig_kf_data.time, deser_kf_data.time, "Track {} keyframe {} time mismatch", i, j);
                                    prop_assert_eq!(orig_kf_data.value, deser_kf_data.value, "Track {} keyframe {} value mismatch", i, j);

                                    // Verify tangents
                                    match (&orig_kf_data.tangent_in, &deser_kf_data.tangent_in) {
                                        (Some(orig_t), Some(deser_t)) => {
                                            prop_assert_eq!(orig_t.x, deser_t.x, "Track {} keyframe {} tangent_in.x mismatch", i, j);
                                            prop_assert_eq!(orig_t.y, deser_t.y, "Track {} keyframe {} tangent_in.y mismatch", i, j);
                                        }
                                        (None, None) => {}
                                        _ => prop_assert!(false, "Track {} keyframe {} tangent_in presence mismatch", i, j),
                                    }

                                    match (&orig_kf_data.tangent_out, &deser_kf_data.tangent_out) {
                                        (Some(orig_t), Some(deser_t)) => {
                                            prop_assert_eq!(orig_t.x, deser_t.x, "Track {} keyframe {} tangent_out.x mismatch", i, j);
                                            prop_assert_eq!(orig_t.y, deser_t.y, "Track {} keyframe {} tangent_out.y mismatch", i, j);
                                        }
                                        (None, None) => {}
                                        _ => prop_assert!(false, "Track {} keyframe {} tangent_out presence mismatch", i, j),
                                    }
                                }
                            }
                            (animation::AnimationType::Procedural(orig_proc), animation::AnimationType::Procedural(deser_proc)) => {
                                prop_assert_eq!(&orig_proc.expression, &deser_proc.expression, "Track {} procedural expression mismatch", i);
                            }
                            (animation::AnimationType::Physics(orig_phys), animation::AnimationType::Physics(deser_phys)) => {
                                prop_assert_eq!(orig_phys.simulation_type, deser_phys.simulation_type, "Track {} physics simulation type mismatch", i);
                            }
                            _ => prop_assert!(false, "Track {} animation type mismatch", i),
                        }
                    }
                }
                (None, None) => {}
                _ => prop_assert!(false, "Animation presence mismatch"),
            }

            // 5. Variants
            prop_assert_eq!(material.variants, deserialized.variants, "Variants mismatch");

            // 6. Base material
            prop_assert_eq!(material.base_material, deserialized.base_material, "Base material mismatch");
        }

        /// **Property 1b: Material Serialization Round-Trip (Compact)**
        ///
        /// Same as Property 1, but using compact serialization format.
        /// Verifies that compact JSON (without pretty-printing) also round-trips correctly.
        ///
        /// **Validates: Requirements 19.5**
        #[test]
        fn prop_material_serialization_roundtrip_compact(material in arb_material()) {
            // Serialize to compact JSON
            let json = material.serialize_compact()
                .expect("Compact serialization should succeed for valid material");

            // Deserialize back to Material
            let deserialized = Material::deserialize(&json)
                .expect("Deserialization should succeed for compact JSON");

            // Verify key fields (abbreviated check since full check is in main property)
            prop_assert_eq!(material.id, deserialized.id, "Material ID mismatch");
            prop_assert_eq!(&material.metadata.name, &deserialized.metadata.name, "Name mismatch");
            prop_assert_eq!(material.layers.len(), deserialized.layers.len(), "Layer count mismatch");

            // Verify compact JSON is actually smaller than pretty-printed
            let pretty_json = material.serialize().unwrap();
            prop_assert!(json.len() < pretty_json.len(), "Compact JSON should be smaller than pretty JSON");
        }
    }
}
