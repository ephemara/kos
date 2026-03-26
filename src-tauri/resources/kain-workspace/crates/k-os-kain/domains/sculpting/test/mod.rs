/// KAIN Sculpting Shaders Module
/// 
/// Contains 17 SPIR-V compiled sculpting shaders and validation tools.

pub mod validate_spirv;

#[cfg(test)]
mod integration_tests;

pub use validate_spirv::{validate_all_shaders, validate_spirv_file, print_validation_report, ValidationResult};
