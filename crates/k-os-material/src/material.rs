//! Material definition with PBR properties

use crate::error::{MaterialError, Result};
use crate::texture::{TextureInfo, TextureSlot};
use glam::Vec3;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;
use uuid::Uuid;

/// A PBR material with properties and texture slots
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Material {
    /// Unique identifier
    id: Uuid,
    /// Material name
    name: String,
    /// Base color (albedo) - RGB values [0, 1]
    base_color: Vec3,
    /// Metallic factor [0, 1] - 0 = dielectric, 1 = metal
    metallic: f32,
    /// Roughness factor [0, 1] - 0 = smooth, 1 = rough
    roughness: f32,
    /// Emissive color - RGB values [0, ∞]
    emissive: Vec3,
    /// Emissive strength multiplier
    emissive_strength: f32,
    /// Ambient occlusion factor [0, 1]
    ao_strength: f32,
    /// Normal map strength [0, 1]
    normal_strength: f32,
    /// Height/displacement strength
    height_strength: f32,
    /// Opacity/alpha [0, 1] - 0 = transparent, 1 = opaque
    opacity: f32,
    /// Index of refraction for transparent materials
    ior: f32,
    /// Texture assignments
    textures: HashMap<TextureSlot, TextureInfo>,
    /// Custom metadata
    metadata: HashMap<String, String>,
}

impl Material {
    /// Create a new material with default PBR values
    pub fn new(name: impl Into<String>) -> Self {
        Self {
            id: Uuid::new_v4(),
            name: name.into(),
            base_color: Vec3::new(0.8, 0.8, 0.8), // Light gray default
            metallic: 0.0,
            roughness: 0.5,
            emissive: Vec3::ZERO,
            emissive_strength: 1.0,
            ao_strength: 1.0,
            normal_strength: 1.0,
            height_strength: 0.1,
            opacity: 1.0,
            ior: 1.45, // Typical for glass/plastic
            textures: HashMap::new(),
            metadata: HashMap::new(),
        }
    }

    /// Get the material ID
    pub fn id(&self) -> Uuid {
        self.id
    }

    /// Get the material name
    pub fn name(&self) -> &str {
        &self.name
    }

    /// Set the material name
    pub fn set_name(&mut self, name: impl Into<String>) -> Result<()> {
        let name = name.into();
        if name.is_empty() {
            return Err(MaterialError::InvalidName(
                "Name cannot be empty".to_string(),
            ));
        }
        self.name = name;
        Ok(())
    }

    /// Get the base color
    pub fn base_color(&self) -> Vec3 {
        self.base_color
    }

    /// Set the base color (RGB values should be in [0, 1])
    pub fn set_base_color(&mut self, color: Vec3) {
        self.base_color = color.clamp(Vec3::ZERO, Vec3::ONE);
    }

    /// Get the metallic factor
    pub fn metallic(&self) -> f32 {
        self.metallic
    }

    /// Set the metallic factor [0, 1]
    pub fn set_metallic(&mut self, metallic: f32) {
        self.metallic = metallic.clamp(0.0, 1.0);
    }

    /// Get the roughness factor
    pub fn roughness(&self) -> f32 {
        self.roughness
    }

    /// Set the roughness factor [0, 1]
    pub fn set_roughness(&mut self, roughness: f32) {
        self.roughness = roughness.clamp(0.0, 1.0);
    }

    /// Get the emissive color
    pub fn emissive(&self) -> Vec3 {
        self.emissive
    }

    /// Set the emissive color (RGB values can exceed 1.0 for HDR)
    pub fn set_emissive(&mut self, emissive: Vec3) {
        self.emissive = emissive.max(Vec3::ZERO);
    }

    /// Get the emissive strength
    pub fn emissive_strength(&self) -> f32 {
        self.emissive_strength
    }

    /// Set the emissive strength
    pub fn set_emissive_strength(&mut self, strength: f32) {
        self.emissive_strength = strength.max(0.0);
    }

    /// Get the ambient occlusion strength
    pub fn ao_strength(&self) -> f32 {
        self.ao_strength
    }

    /// Set the ambient occlusion strength [0, 1]
    pub fn set_ao_strength(&mut self, strength: f32) {
        self.ao_strength = strength.clamp(0.0, 1.0);
    }

    /// Get the normal map strength
    pub fn normal_strength(&self) -> f32 {
        self.normal_strength
    }

    /// Set the normal map strength [0, 1]
    pub fn set_normal_strength(&mut self, strength: f32) {
        self.normal_strength = strength.clamp(0.0, 1.0);
    }

    /// Get the height/displacement strength
    pub fn height_strength(&self) -> f32 {
        self.height_strength
    }

    /// Set the height/displacement strength
    pub fn set_height_strength(&mut self, strength: f32) {
        self.height_strength = strength;
    }

    /// Get the opacity
    pub fn opacity(&self) -> f32 {
        self.opacity
    }

    /// Set the opacity [0, 1]
    pub fn set_opacity(&mut self, opacity: f32) {
        self.opacity = opacity.clamp(0.0, 1.0);
    }

    /// Get the index of refraction
    pub fn ior(&self) -> f32 {
        self.ior
    }

    /// Set the index of refraction (typically 1.0-3.0)
    pub fn set_ior(&mut self, ior: f32) {
        self.ior = ior.max(1.0);
    }

    /// Check if the material is transparent
    pub fn is_transparent(&self) -> bool {
        self.opacity < 1.0
    }

    /// Check if the material is emissive
    pub fn is_emissive(&self) -> bool {
        self.emissive.length() > 0.0 && self.emissive_strength > 0.0
    }

    /// Set a texture for a specific slot
    pub fn set_texture(&mut self, slot: TextureSlot, path: impl AsRef<Path>) {
        let info = match slot {
            TextureSlot::BaseColor | TextureSlot::Emissive => TextureInfo::new(path),
            _ => TextureInfo::new_data(path), // Non-color data
        };
        self.textures.insert(slot, info);
    }

    /// Set texture info for a specific slot
    pub fn set_texture_info(&mut self, slot: TextureSlot, info: TextureInfo) {
        self.textures.insert(slot, info);
    }

    /// Get texture info for a specific slot
    pub fn get_texture(&self, slot: TextureSlot) -> Option<&TextureInfo> {
        self.textures.get(&slot)
    }

    /// Get mutable texture info for a specific slot
    pub fn get_texture_mut(&mut self, slot: TextureSlot) -> Option<&mut TextureInfo> {
        self.textures.get_mut(&slot)
    }

    /// Remove a texture from a slot
    pub fn remove_texture(&mut self, slot: TextureSlot) -> Option<TextureInfo> {
        self.textures.remove(&slot)
    }

    /// Check if a texture is assigned to a slot
    pub fn has_texture(&self, slot: TextureSlot) -> bool {
        self.textures.contains_key(&slot)
    }

    /// Get all texture slots with assigned textures
    pub fn texture_slots(&self) -> Vec<TextureSlot> {
        self.textures.keys().copied().collect()
    }

    /// Get all textures
    pub fn textures(&self) -> &HashMap<TextureSlot, TextureInfo> {
        &self.textures
    }

    /// Set custom metadata
    pub fn set_metadata(&mut self, key: impl Into<String>, value: impl Into<String>) {
        self.metadata.insert(key.into(), value.into());
    }

    /// Get custom metadata
    pub fn get_metadata(&self, key: &str) -> Option<&str> {
        self.metadata.get(key).map(|s| s.as_str())
    }

    /// Remove custom metadata
    pub fn remove_metadata(&mut self, key: &str) -> Option<String> {
        self.metadata.remove(key)
    }

    /// Get all metadata
    pub fn metadata(&self) -> &HashMap<String, String> {
        &self.metadata
    }

    /// Validate the material
    pub fn validate(&self) -> Result<()> {
        if self.name.is_empty() {
            return Err(MaterialError::ValidationError(
                "Material name cannot be empty".to_string(),
            ));
        }

        // Validate texture paths exist
        for (slot, texture) in &self.textures {
            if !texture.exists() {
                log::warn!(
                    "Texture for slot {:?} does not exist: {:?}",
                    slot,
                    texture.path()
                );
            }
        }

        Ok(())
    }

    /// Clone the material with a new ID and name
    pub fn clone_with_name(&self, name: impl Into<String>) -> Self {
        let mut cloned = self.clone();
        cloned.id = Uuid::new_v4();
        cloned.name = name.into();
        cloned
    }
}

pub use crate::autopbr::{BlendMode, Layer, MaterialCategory, MaterialMetadata, PBRMaps};

pub mod animation {
    pub use crate::autopbr::animation::*;
}

pub mod layer {
    pub use crate::autopbr::layer::*;
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_material_defaults() {
        let mat = Material::new("Test");
        assert_eq!(mat.name(), "Test");
        assert_eq!(mat.metallic(), 0.0);
        assert_eq!(mat.roughness(), 0.5);
        assert_eq!(mat.opacity(), 1.0);
        assert!(!mat.is_transparent());
        assert!(!mat.is_emissive());
    }

    #[test]
    fn test_material_pbr_properties() {
        let mut mat = Material::new("Metal");
        mat.set_base_color(Vec3::new(1.0, 0.8, 0.3));
        mat.set_metallic(0.9);
        mat.set_roughness(0.1);

        assert_eq!(mat.base_color(), Vec3::new(1.0, 0.8, 0.3));
        assert_eq!(mat.metallic(), 0.9);
        assert_eq!(mat.roughness(), 0.1);
    }

    #[test]
    fn test_material_clamping() {
        let mut mat = Material::new("Test");
        mat.set_metallic(1.5); // Should clamp to 1.0
        mat.set_roughness(-0.5); // Should clamp to 0.0
        mat.set_opacity(2.0); // Should clamp to 1.0

        assert_eq!(mat.metallic(), 1.0);
        assert_eq!(mat.roughness(), 0.0);
        assert_eq!(mat.opacity(), 1.0);
    }

    #[test]
    fn test_material_emissive() {
        let mut mat = Material::new("Glow");
        mat.set_emissive(Vec3::new(1.0, 0.5, 0.0));
        mat.set_emissive_strength(2.0);

        assert!(mat.is_emissive());
        assert_eq!(mat.emissive(), Vec3::new(1.0, 0.5, 0.0));
        assert_eq!(mat.emissive_strength(), 2.0);
    }

    #[test]
    fn test_material_transparency() {
        let mut mat = Material::new("Glass");
        mat.set_opacity(0.5);
        mat.set_ior(1.5);

        assert!(mat.is_transparent());
        assert_eq!(mat.opacity(), 0.5);
        assert_eq!(mat.ior(), 1.5);
    }

    #[test]
    fn test_material_textures() {
        let mut mat = Material::new("Textured");
        mat.set_texture(TextureSlot::BaseColor, "albedo.png");
        mat.set_texture(TextureSlot::Normal, "normal.png");

        assert!(mat.has_texture(TextureSlot::BaseColor));
        assert!(mat.has_texture(TextureSlot::Normal));
        assert!(!mat.has_texture(TextureSlot::Metallic));

        let slots = mat.texture_slots();
        assert_eq!(slots.len(), 2);
    }

    #[test]
    fn test_material_metadata() {
        let mut mat = Material::new("Test");
        mat.set_metadata("author", "Kipp");
        mat.set_metadata("category", "Metal");

        assert_eq!(mat.get_metadata("author"), Some("Kipp"));
        assert_eq!(mat.get_metadata("category"), Some("Metal"));
        assert_eq!(mat.get_metadata("nonexistent"), None);
    }

    #[test]
    fn test_material_clone_with_name() {
        let mat = Material::new("Original");
        let cloned = mat.clone_with_name("Clone");

        assert_ne!(mat.id(), cloned.id());
        assert_eq!(cloned.name(), "Clone");
        assert_eq!(mat.base_color(), cloned.base_color());
    }
}
