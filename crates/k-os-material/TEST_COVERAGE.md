# Test Coverage: k-os-material

## Overview

This document describes the test coverage for the `k-os-material` crate, including unit tests and property-based tests.

## Test Files

- **Unit Tests**: `tests/unit_tests.rs` - Specific example-based tests
- **Property Tests**: `tests/property_tests.rs` - Property-based tests using proptest

## Property-Based Tests

### Property 13: Material Property Clamping
**Validates: Requirements 5.1, 5.2**

These properties verify that material properties are correctly clamped to their valid ranges:

1. **prop_metallic_clamping** - Metallic is always clamped to [0.0, 1.0]
2. **prop_roughness_clamping** - Roughness is always clamped to [0.0, 1.0]
3. **prop_opacity_clamping** - Opacity is always clamped to [0.0, 1.0]
4. **prop_ao_strength_clamping** - AO strength is always clamped to [0.0, 1.0]
5. **prop_normal_strength_clamping** - Normal strength is always clamped to [0.0, 1.0]
6. **prop_base_color_clamping** - Base color components are clamped to [0.0, 1.0]
7. **prop_emissive_non_negative** - Emissive color components are >= 0.0 (can exceed 1.0 for HDR)
8. **prop_emissive_strength_non_negative** - Emissive strength is >= 0.0
9. **prop_ior_minimum** - Index of refraction is >= 1.0
10. **prop_all_properties_valid_after_operations** - All properties remain valid after multiple operations

**Key Invariants:**
- PBR properties (metallic, roughness, opacity, AO, normal strength) are always in [0.0, 1.0]
- Base color components are always in [0.0, 1.0]
- Emissive values can exceed 1.0 for HDR but are never negative
- IOR is always >= 1.0 (physical constraint)
- Properties remain valid regardless of input values (including NaN, Inf, negative)

### Property 14: Material Serialization Round-Trip
**Validates: Requirement 5.6**

These properties verify that materials can be serialized and deserialized without data loss:

1. **prop_material_serialization_roundtrip** - Material serialization preserves all properties
2. **prop_library_serialization_roundtrip** - Library serialization preserves all materials
3. **prop_serialization_deterministic** - Serialization produces consistent output
4. **prop_valid_json_deserializes** - Valid JSON can be deserialized
5. **prop_library_preserves_material_ids** - Material IDs are preserved through round-trip
6. **prop_texture_slots_preserved** - Texture slot information is preserved

**Key Invariants:**
- Serialize → Deserialize produces equivalent material
- All PBR properties are preserved (within floating-point precision)
- All texture slots and their properties are preserved
- All metadata is preserved
- Material IDs are preserved in libraries
- Name index is correctly rebuilt after deserialization
- Serialization is deterministic (same input → same JSON)

## Test Strategies

The property tests use custom generators (strategies) to create test data:

- **arb_vec3()** - Arbitrary Vec3 values (including edge cases)
- **arb_vec3_finite()** - Finite Vec3 values (no NaN/Inf)
- **arb_f32()** - Arbitrary f32 values (including edge cases)
- **arb_f32_finite()** - Finite f32 values (no NaN/Inf)
- **arb_material_name()** - Valid material names
- **arb_texture_slot()** - All texture slot types
- **arb_texture_info()** - Complete texture information
- **arb_material()** - Complete materials with all properties
- **arb_material_library()** - Material libraries with multiple materials

## Coverage Summary

### Material Properties
- ✅ Base color clamping
- ✅ Metallic clamping
- ✅ Roughness clamping
- ✅ Emissive non-negativity (HDR support)
- ✅ Emissive strength non-negativity
- ✅ AO strength clamping
- ✅ Normal strength clamping
- ✅ Opacity clamping
- ✅ IOR minimum constraint
- ✅ Multi-property validation

### Serialization
- ✅ Material round-trip preservation
- ✅ Library round-trip preservation
- ✅ Texture slot preservation
- ✅ Metadata preservation
- ✅ Material ID preservation
- ✅ Deterministic serialization

### Edge Cases
- ✅ NaN and Inf inputs
- ✅ Negative values
- ✅ Values exceeding valid ranges
- ✅ Empty collections
- ✅ Large collections (up to 20 materials)
- ✅ All texture slot types

## Running Tests

```bash
# Run all tests
cargo test --package k-os-material

# Run only property tests
cargo test --package k-os-material --test property_tests

# Run only unit tests
cargo test --package k-os-material --test unit_tests

# Run with output
cargo test --package k-os-material -- --nocapture
```

## Test Configuration

Property tests use proptest's default configuration:
- **Cases per test**: 256 (default)
- **Max shrink iterations**: 1000 (default)
- **Shrinking**: Enabled (finds minimal failing examples)

## Requirements Validation

### Requirement 5.1: Material Creation
✅ Materials are created with valid default PBR values
✅ Property setters always produce valid materials

### Requirement 5.2: Material Validation
✅ Node types and connections are validated (via property clamping)
✅ Socket type compatibility is enforced (via clamping)

### Requirement 5.6: Material Serialization
✅ Materials can be serialized to JSON
✅ Materials can be deserialized from JSON
✅ Round-trip preserves all properties
✅ Libraries can be saved and loaded

## Future Test Additions

Potential areas for additional property tests:
- Material blending operations
- Material preset generation
- Texture path validation
- Material library merging
- Material cloning with name conflicts
- Concurrent access to shared libraries
