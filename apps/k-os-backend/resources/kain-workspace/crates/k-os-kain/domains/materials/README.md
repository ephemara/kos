# KAIN Materials Domain

GPU-accelerated PBR material system using SPIR-V compute shaders.

## Overview

This domain provides physically-based rendering (PBR) materials compiled to SPIR-V for use in k-os-renderer. All shaders are written in KAIN and compiled to optimized GPU code.

## Shader Categories

### Core PBR Models
- `material_pbr_standard.kn` - Standard metallic/roughness PBR
- `material_pbr_specular.kn` - Specular/glossiness workflow
- `material_pbr_clearcoat.kn` - Clearcoat layer (car paint, lacquer)
- `material_pbr_cloth.kn` - Fabric/cloth with anisotropic highlights
- `material_pbr_skin.kn` - Subsurface scattering for skin
- `material_pbr_glass.kn` - Transparent/refractive materials
- `material_pbr_emission.kn` - Emissive materials

### Texture Sampling
- `material_sample_uv.kn` - Standard UV texture sampling
- `material_sample_triplanar.kn` - Triplanar projection (no UVs needed)
- `material_sample_procedural.kn` - Procedural texture generation

### Utilities
- `material_blend_layers.kn` - Multi-layer material blending
- `material_normal_blend.kn` - Normal map blending (RNM, UDN, etc.)
- `material_parallax.kn` - Parallax occlusion mapping

## Usage

Compile all shaders:
```bash
cd crates/k-os-kain/domains/materials
./build_spirv.bat
```

Access from Rust:
```rust
use k_os_kain::{generated_spirv_for_domain, KainDomain};

let materials = generated_spirv_for_domain(KainDomain::Materials);
for shader in materials {
    println!("Material shader: {}", shader.id);
}
```

## Material Parameters

All PBR shaders expect these bindings:

**Binding 0-3: G-Buffer Inputs**
- `positions` (vec4) - World-space positions
- `normals` (vec4) - World-space normals
- `uvs` (vec4) - Texture coordinates
- `tangents` (vec4) - Tangent space vectors

**Binding 4-9: Material Maps**
- `albedo_map` (texture2D) - Base color
- `normal_map` (texture2D) - Normal map
- `metallic_map` (texture2D) - Metallic values
- `roughness_map` (texture2D) - Roughness values
- `ao_map` (texture2D) - Ambient occlusion
- `emissive_map` (texture2D) - Emissive color

**Binding 10-15: Material Parameters**
- `base_color` (vec4) - Tint color
- `metallic` (f32) - Metallic factor
- `roughness` (f32) - Roughness factor
- `emissive_strength` (f32) - Emission multiplier
- `normal_strength` (f32) - Normal map intensity
- `ao_strength` (f32) - AO intensity

**Binding 16: Output**
- `color_out` (vec4) - Final shaded color

## Integration with k-os-renderer

Materials integrate with the existing render graph:

1. **Surface Pass** - Writes G-buffer (positions, normals, UVs)
2. **Material Pass** - Evaluates PBR lighting (NEW)
3. **Screen Composite** - Tonemapping and post-processing

The material pass dispatches per-pixel and samples textures to compute final lighting.
