//! SPIR-V Shader Loader for KAIN Sculpting Brushes
//!
//! Auto-discovers and loads compiled SPIR-V bytecode for KAIN sculpting kernels.
//! Provides a registry mapping brush names to SPIR-V bytecode for runtime pipeline creation.

use k_os_kain::{generated_spirv_for_domain, KainDomain};
use once_cell::sync::Lazy;
use std::collections::HashMap;

/// Kernel family enumeration - matches KernelFamily from sculpt.rs
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum KernelFamily {
    Stamp,   // Clay, Inflate, Draw, Layer, Blob, etc.
    Physics, // Attractor, Magnet, Elastic, Turbulence, Gravity, etc.
}

/// SPIR-V shader metadata and bytecode
pub struct SpirvShader {
    pub name: &'static str,
    pub family: KernelFamily,
    pub bytecode: &'static [u8],
}

/// Global registry of all SPIR-V shaders
/// Loaded from the auto-generated k-os-kain SPIR-V registry.
pub static SPIRV_SHADERS: Lazy<HashMap<&'static str, SpirvShader>> = Lazy::new(|| {
    let mut map = HashMap::new();

    for asset in generated_spirv_for_domain(KainDomain::Sculpting) {
        if let Some(name) = asset.id.strip_prefix("sculpt_") {
            let family = if name.starts_with("stamp_") {
                Some(KernelFamily::Stamp)
            } else if name.starts_with("physics_") {
                Some(KernelFamily::Physics)
            } else {
                None
            };

            if let Some(family) = family {
                map.insert(
                    name,
                    SpirvShader {
                        name,
                        family,
                        bytecode: asset.bytes,
                    },
                );
            }
        }
    }

    map
});

/// Get all shader names in a specific kernel family
pub fn get_shaders_by_family(family: KernelFamily) -> Vec<&'static str> {
    SPIRV_SHADERS
        .iter()
        .filter(|(_, shader)| shader.family == family)
        .map(|(name, _)| *name)
        .collect()
}

/// Get shader count by family
pub fn get_shader_count() -> (usize, usize) {
    let stamp_count = SPIRV_SHADERS
        .values()
        .filter(|s| s.family == KernelFamily::Stamp)
        .count();
    let physics_count = SPIRV_SHADERS
        .values()
        .filter(|s| s.family == KernelFamily::Physics)
        .count();
    (stamp_count, physics_count)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_all_shaders_loaded() {
        assert!(
            SPIRV_SHADERS.len() >= 17,
            "Expected at least the core 17 SPIR-V shaders"
        );

        let (stamp_count, physics_count) = get_shader_count();
        assert!(stamp_count >= 9, "Expected at least 9 stamp shaders");
        assert!(physics_count >= 8, "Expected at least 8 physics shaders");
    }

    #[test]
    fn test_shader_bytecode_not_empty() {
        // Verify all shaders have non-empty bytecode
        for (name, shader) in SPIRV_SHADERS.iter() {
            assert!(
                !shader.bytecode.is_empty(),
                "Shader {} has empty bytecode",
                name
            );
            assert!(
                shader.bytecode.len() > 100,
                "Shader {} bytecode suspiciously small",
                name
            );
        }
    }

    #[test]
    fn test_get_shaders_by_family() {
        let stamp_shaders = get_shaders_by_family(KernelFamily::Stamp);
        assert!(stamp_shaders.len() >= 9);
        assert!(stamp_shaders.contains(&"stamp_main"));
        assert!(stamp_shaders.contains(&"stamp_clay"));

        let physics_shaders = get_shaders_by_family(KernelFamily::Physics);
        assert!(physics_shaders.len() >= 8);
        assert!(physics_shaders.contains(&"physics_attractor"));
        assert!(physics_shaders.contains(&"physics_vortex"));
    }
}
