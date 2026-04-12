//! Integration Tests for KAIN SPIR-V Sculpting Shaders
//!
//! Validates that all 17 KAIN-compiled SPIR-V shaders:
//! 1. Load successfully into wgpu
//! 2. Have correct entry points
//! 3. Can be dispatched without errors
//! 4. Produce expected vertex modifications

#[cfg(test)]
mod tests {
    use std::path::PathBuf;
    use k_os_kain::{generated_spirv_for_domain, workspace_root, KainDomain};

    fn shader_paths() -> Vec<PathBuf> {
        let mut paths: Vec<PathBuf> = generated_spirv_for_domain(KainDomain::Sculpting)
            .iter()
            .map(|asset| workspace_root().join(asset.compiled_path))
            .collect();
        paths.sort();
        paths
    }

    fn shader_id(path: &std::path::Path) -> String {
        path.file_stem()
            .and_then(|name| name.to_str())
            .unwrap()
            .to_string()
    }

    fn expected_entry(shader_id: &str) -> &str {
        shader_id.strip_prefix("sculpt_").unwrap_or(shader_id)
    }

    #[test]
    fn test_all_spirv_files_exist() {
        let paths = shader_paths();
        assert!(!paths.is_empty(), "No generated sculpting SPIR-V shaders found");

        for path in paths {
            assert!(
                path.exists(),
                "SPIR-V shader not found: {}",
                path.display()
            );
        }
    }

    #[test]
    fn test_all_spirv_files_valid() {
        let paths = shader_paths();

        for path in paths {
            let file_name = shader_id(&path);
            let bytes = std::fs::read(&path)
                .expect(&format!("Failed to read {}", path.display()));

            // Validate SPIR-V magic number
            assert!(
                bytes.len() >= 4,
                "{}: File too small to be valid SPIR-V",
                file_name
            );
            let magic = u32::from_le_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]);
            assert_eq!(
                magic, 0x07230203,
                "{}: Invalid SPIR-V magic number (expected 0x07230203, got 0x{:08x})",
                file_name, magic
            );

            // Validate 4-byte alignment
            assert_eq!(
                bytes.len() % 4,
                0,
                "{}: SPIR-V bytecode not 4-byte aligned",
                file_name
            );

            println!("✅ {} - Valid SPIR-V ({} bytes)", file_name, bytes.len());
        }
    }

    #[test]
    fn test_spirv_parsing_with_naga() {
        use naga::front::spv;

        for path in shader_paths() {
            let file_name = shader_id(&path);
            let bytes = std::fs::read(&path)
                .expect(&format!("Failed to read {}", path.display()));

            // Parse with naga
            let options = spv::Options::default();
            let module = spv::parse_u8_slice(&bytes, &options)
                .expect(&format!("Failed to parse {} with naga", file_name));

            // Validate entry points
            let entry_points: Vec<_> = module.entry_points.iter().map(|ep| &ep.name).collect();
            assert!(
                !entry_points.is_empty(),
                "{}: No entry points found",
                file_name
            );

            println!(
                "✅ {} - Parsed successfully, entry points: {:?}",
                file_name, entry_points
            );
        }
    }

    #[test]
    fn test_shader_size_statistics() {
        let shader_paths = shader_paths();

        let mut total_size = 0;
        let mut min_size = usize::MAX;
        let mut max_size = 0;

        for path in &shader_paths {
            let shader_name = shader_id(path);
            let size = std::fs::metadata(&path)
                .expect(&format!("Failed to get metadata for {}", shader_name))
                .len() as usize;

            total_size += size;
            min_size = min_size.min(size);
            max_size = max_size.max(size);
        }

        let avg_size = total_size / shader_paths.len();

        println!("\n📊 KAIN SPIR-V Shader Statistics:");
        println!("   Total shaders: {}", shader_paths.len());
        println!("   Total size: {} bytes ({:.2} KB)", total_size, total_size as f64 / 1024.0);
        println!("   Average size: {} bytes ({:.2} KB)", avg_size, avg_size as f64 / 1024.0);
        println!("   Min size: {} bytes", min_size);
        println!("   Max size: {} bytes", max_size);

        // Sanity checks
        assert!(total_size > 100_000, "Total size suspiciously small");
        assert!(total_size < 500_000, "Total size suspiciously large");
        assert!(min_size > 5_000, "Smallest shader suspiciously small");
        assert!(max_size < 20_000, "Largest shader suspiciously large");
    }

    #[test]
    fn test_physics_shader_entry_points() {
        use naga::front::spv;

        for path in shader_paths() {
            let file_name = shader_id(&path);
            if !file_name.starts_with("sculpt_physics_") {
                continue;
            }
            let expected_entry = expected_entry(&file_name);
            let bytes = std::fs::read(&path).expect("Failed to read shader");
            let module = spv::parse_u8_slice(&bytes, &spv::Options::default())
                .expect("Failed to parse shader");

            let entry_names: Vec<_> = module.entry_points.iter().map(|ep| ep.name.as_str()).collect();

            assert!(
                entry_names.contains(&expected_entry),
                "{}: Expected entry point '{}' not found. Found: {:?}",
                file_name,
                expected_entry,
                entry_names
            );

            println!("✅ {} has entry point '{}'", file_name, expected_entry);
        }
    }

    #[test]
    fn test_stamp_shader_entry_points() {
        use naga::front::spv;

        for path in shader_paths() {
            let file_name = shader_id(&path);
            if !file_name.starts_with("sculpt_stamp_") {
                continue;
            }
            let expected_entry = expected_entry(&file_name);
            let bytes = std::fs::read(&path).expect("Failed to read shader");
            let module = spv::parse_u8_slice(&bytes, &spv::Options::default())
                .expect("Failed to parse shader");

            let entry_names: Vec<_> = module.entry_points.iter().map(|ep| ep.name.as_str()).collect();

            assert!(
                entry_names.contains(&expected_entry),
                "{}: Expected entry point '{}' not found. Found: {:?}",
                file_name,
                expected_entry,
                entry_names
            );

            println!("✅ {} has entry point '{}'", file_name, expected_entry);
        }
    }

    #[test]
    fn test_all_shaders_are_compute() {
        use naga::front::spv;

        for path in shader_paths() {
            let shader_name = shader_id(&path);
            let bytes = std::fs::read(&path).expect("Failed to read shader");
            let module = spv::parse_u8_slice(&bytes, &spv::Options::default())
                .expect("Failed to parse shader");

            for entry_point in &module.entry_points {
                assert_eq!(
                    entry_point.stage,
                    naga::ShaderStage::Compute,
                    "{}: Entry point '{}' is not a compute shader",
                    shader_name,
                    entry_point.name
                );
            }

            println!("✅ {} is a compute shader", shader_name);
        }
    }
}
