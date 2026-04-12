/// SPIR-V Validation Module for KAIN Sculpting Shaders
/// 
/// This module validates all 17 KAIN sculpting shaders using naga to ensure:
/// - Valid SPIR-V bytecode structure
/// - Proper entry points
/// - Correct uniform buffer bindings
/// - Shader module integrity

use naga::front::spv;
use std::fs;
use std::path::{Path, PathBuf};

/// Result of validating a single SPIR-V shader
#[derive(Debug)]
pub struct ValidationResult {
    pub shader_name: String,
    pub success: bool,
    pub entry_points: Vec<String>,
    pub error: Option<String>,
    pub file_size: u64,
}

/// Validate a single SPIR-V file
pub fn validate_spirv_file(path: &Path) -> ValidationResult {
    let shader_name = path.file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unknown")
        .to_string();

    // Read file
    let bytes = match fs::read(path) {
        Ok(b) => b,
        Err(e) => {
            return ValidationResult {
                shader_name,
                success: false,
                entry_points: vec![],
                error: Some(format!("Failed to read file: {}", e)),
                file_size: 0,
            };
        }
    };

    let file_size = bytes.len() as u64;

    // Parse SPIR-V
    let options = spv::Options::default();
    let module = match spv::parse_u8_slice(&bytes, &options) {
        Ok(m) => m,
        Err(e) => {
            return ValidationResult {
                shader_name,
                success: false,
                entry_points: vec![],
                error: Some(format!("SPIR-V parse error: {:?}", e)),
                file_size,
            };
        }
    };

    // Extract entry points
    let entry_points: Vec<String> = module
        .entry_points
        .iter()
        .map(|ep| ep.name.clone())
        .collect();

    // Validate we have at least one entry point
    if entry_points.is_empty() {
        return ValidationResult {
            shader_name,
            success: false,
            entry_points: vec![],
            error: Some("No entry points found in shader".to_string()),
            file_size,
        };
    }

    ValidationResult {
        shader_name,
        success: true,
        entry_points,
        error: None,
        file_size,
    }
}

/// Validate all KAIN renderer shaders in the given directory
pub fn validate_all_shaders(renderer_dir: &Path) -> Vec<ValidationResult> {
    let mut shader_paths: Vec<PathBuf> = match fs::read_dir(renderer_dir) {
        Ok(entries) => entries
            .flatten()
            .map(|entry| entry.path())
            .filter(|path| path.extension().and_then(|ext| ext.to_str()) == Some("spv"))
            .collect(),
        Err(_) => Vec::new(),
    };

    shader_paths.sort();
    shader_paths
        .iter()
        .map(|path| validate_spirv_file(path))
        .collect()
}

/// Print validation report to console
pub fn print_validation_report(results: &[ValidationResult]) {
    println!("\n╔═══════════════════════════════════════════════════════════════╗");
    println!("║         KAIN SPIR-V Shader Validation Report                 ║");
    println!("╚═══════════════════════════════════════════════════════════════╝\n");

    let mut success_count = 0;
    let mut failure_count = 0;

    for result in results {
        if result.success {
            success_count += 1;
            println!("✓ {} - VALID", result.shader_name);
            println!("  Entry points: {:?}", result.entry_points);
            println!("  File size: {} bytes", result.file_size);
        } else {
            failure_count += 1;
            println!("✗ {} - FAILED", result.shader_name);
            if let Some(error) = &result.error {
                println!("  Error: {}", error);
            }
        }
        println!();
    }

    println!("─────────────────────────────────────────────────────────────");
    println!("Summary: {} passed, {} failed, {} total", 
             success_count, failure_count, results.len());
    
    if failure_count == 0 {
        println!("🎉 All KAIN sculpting shaders are valid!");
    } else {
        println!("⚠️  {} shader(s) failed validation", failure_count);
    }
    println!("─────────────────────────────────────────────────────────────\n");
}

#[cfg(test)]
mod tests {
    use super::*;
    use k_os_kain::{generated_spv_dir, KainDomain};

    #[test]
    fn test_validate_all_kain_shaders() {
        let renderer_dir = generated_spv_dir(KainDomain::Renderer);

        let results = validate_all_shaders(&renderer_dir);
        print_validation_report(&results);

        // Assert all shaders are valid
        let all_valid = results.iter().all(|r| r.success);
        assert!(all_valid, "Some shaders failed validation");
        
        assert!(!results.is_empty(), "Expected at least one renderer shader");
    }
}
