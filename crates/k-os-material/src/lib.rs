//! K_OS Material System
//!
//! A comprehensive material system for K_OS DCC Suite with:
//! - PBR (Physically Based Rendering) material properties
//! - Material library for organizing and managing materials
//! - Material presets for common materials (metal, plastic, glass, etc.)
//! - Texture slot management for all PBR texture types
//! - Serialization/deserialization for saving/loading materials
//! - Material validation and error handling
//!
//! # Example
//!
//! ```no_run
//! use k_os_material::{Material, MaterialLibrary, TextureSlot};
//! use glam::Vec3;
//!
//! // Create a material library
//! let mut library = MaterialLibrary::new();
//!
//! // Create a new material
//! let mut material = Material::new("My Material");
//! material.set_base_color(Vec3::new(0.8, 0.2, 0.2));
//! material.set_metallic(0.9);
//! material.set_roughness(0.1);
//!
//! // Add to library
//! let id = library.add_material(material);
//!
//! // Retrieve material
//! if let Some(mat) = library.get_material(&id) {
//!     println!("Material: {}", mat.name());
//! }
//! ```
//!
//! # PBR Properties
//!
//! Materials support standard PBR properties:
//! - Base Color (albedo)
//! - Metallic
//! - Roughness
//! - Normal mapping
//! - Ambient Occlusion
//! - Emissive
//! - Alpha/Transparency
//!
//! # Texture Slots
//!
//! Each PBR property can have an associated texture:
//!
//! ```no_run
//! use k_os_material::{Material, TextureSlot};
//!
//! let mut material = Material::new("Textured Material");
//!
//! // Set texture for base color
//! material.set_texture(TextureSlot::BaseColor, "path/to/albedo.png");
//!
//! // Set texture for normal map
//! material.set_texture(TextureSlot::Normal, "path/to/normal.png");
//! ```
//!
//! # Material Presets
//!
//! Common material types are available as presets:
//!
//! ```no_run
//! use k_os_material::MaterialPreset;
//!
//! // Create preset materials
//! let gold = MaterialPreset::gold();
//! let plastic = MaterialPreset::plastic_red();
//! let glass = MaterialPreset::glass();
//! ```

pub mod autopbr;
pub mod error;
pub mod gpu;
pub mod library;
pub mod material;
pub mod paint_ops;
pub mod pbr;
pub mod preset;
pub mod texture;
pub mod texture_ops;

pub use error::{MaterialError, Result};
pub use library::MaterialLibrary;
pub use material::Material;
pub use pbr::{
    AlphaMode, ClearcoatExtension, PbrMaterial, PbrWorkflow, SheenExtension, TransmissionExtension,
};
pub use preset::MaterialPreset;
pub use texture::{TextureInfo, TextureSlot};

#[cfg(test)]
mod tests {
    use super::*;
    use glam::Vec3;

    #[test]
    fn test_material_creation() {
        let material = Material::new("Test Material");
        assert_eq!(material.name(), "Test Material");
        assert_eq!(material.base_color(), Vec3::new(0.8, 0.8, 0.8));
        assert_eq!(material.metallic(), 0.0);
        assert_eq!(material.roughness(), 0.5);
    }

    #[test]
    fn test_material_library() {
        let mut library = MaterialLibrary::new();
        let material = Material::new("Test");
        let id = library.add_material(material);

        assert!(library.get_material(&id).is_some());
        assert_eq!(library.material_count(), 1);
    }

    #[test]
    fn test_material_preset() {
        let gold = MaterialPreset::gold();
        assert!(gold.metallic() > 0.9);
        assert!(gold.roughness() < 0.2);
    }
}
