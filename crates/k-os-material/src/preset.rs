//! Material presets for common material types

use crate::material::Material;
use glam::Vec3;

/// Material presets for common material types
pub struct MaterialPreset;

impl MaterialPreset {
    // === METALS ===

    /// Gold material preset
    pub fn gold() -> Material {
        let mut mat = Material::new("Gold");
        mat.set_base_color(Vec3::new(1.0, 0.766, 0.336));
        mat.set_metallic(1.0);
        mat.set_roughness(0.15);
        mat.set_metadata("category", "Metal");
        mat.set_metadata("preset", "gold");
        mat
    }

    /// Silver material preset
    pub fn silver() -> Material {
        let mut mat = Material::new("Silver");
        mat.set_base_color(Vec3::new(0.972, 0.960, 0.915));
        mat.set_metallic(1.0);
        mat.set_roughness(0.1);
        mat.set_metadata("category", "Metal");
        mat.set_metadata("preset", "silver");
        mat
    }

    /// Copper material preset
    pub fn copper() -> Material {
        let mut mat = Material::new("Copper");
        mat.set_base_color(Vec3::new(0.955, 0.637, 0.538));
        mat.set_metallic(1.0);
        mat.set_roughness(0.2);
        mat.set_metadata("category", "Metal");
        mat.set_metadata("preset", "copper");
        mat
    }

    /// Aluminum material preset
    pub fn aluminum() -> Material {
        let mut mat = Material::new("Aluminum");
        mat.set_base_color(Vec3::new(0.913, 0.921, 0.925));
        mat.set_metallic(1.0);
        mat.set_roughness(0.3);
        mat.set_metadata("category", "Metal");
        mat.set_metadata("preset", "aluminum");
        mat
    }

    /// Iron material preset
    pub fn iron() -> Material {
        let mut mat = Material::new("Iron");
        mat.set_base_color(Vec3::new(0.560, 0.570, 0.580));
        mat.set_metallic(1.0);
        mat.set_roughness(0.4);
        mat.set_metadata("category", "Metal");
        mat.set_metadata("preset", "iron");
        mat
    }

    /// Brushed metal material preset
    pub fn brushed_metal() -> Material {
        let mut mat = Material::new("Brushed Metal");
        mat.set_base_color(Vec3::new(0.8, 0.8, 0.8));
        mat.set_metallic(1.0);
        mat.set_roughness(0.5);
        mat.set_metadata("category", "Metal");
        mat.set_metadata("preset", "brushed_metal");
        mat
    }

    // === PLASTICS ===

    /// Glossy plastic material preset
    pub fn plastic_glossy() -> Material {
        let mut mat = Material::new("Glossy Plastic");
        mat.set_base_color(Vec3::new(0.8, 0.8, 0.8));
        mat.set_metallic(0.0);
        mat.set_roughness(0.1);
        mat.set_metadata("category", "Plastic");
        mat.set_metadata("preset", "plastic_glossy");
        mat
    }

    /// Matte plastic material preset
    pub fn plastic_matte() -> Material {
        let mut mat = Material::new("Matte Plastic");
        mat.set_base_color(Vec3::new(0.8, 0.8, 0.8));
        mat.set_metallic(0.0);
        mat.set_roughness(0.7);
        mat.set_metadata("category", "Plastic");
        mat.set_metadata("preset", "plastic_matte");
        mat
    }

    /// Red plastic material preset
    pub fn plastic_red() -> Material {
        let mut mat = Material::new("Red Plastic");
        mat.set_base_color(Vec3::new(0.8, 0.1, 0.1));
        mat.set_metallic(0.0);
        mat.set_roughness(0.3);
        mat.set_metadata("category", "Plastic");
        mat.set_metadata("preset", "plastic_red");
        mat
    }

    /// Blue plastic material preset
    pub fn plastic_blue() -> Material {
        let mut mat = Material::new("Blue Plastic");
        mat.set_base_color(Vec3::new(0.1, 0.3, 0.8));
        mat.set_metallic(0.0);
        mat.set_roughness(0.3);
        mat.set_metadata("category", "Plastic");
        mat.set_metadata("preset", "plastic_blue");
        mat
    }

    /// Green plastic material preset
    pub fn plastic_green() -> Material {
        let mut mat = Material::new("Green Plastic");
        mat.set_base_color(Vec3::new(0.1, 0.7, 0.2));
        mat.set_metallic(0.0);
        mat.set_roughness(0.3);
        mat.set_metadata("category", "Plastic");
        mat.set_metadata("preset", "plastic_green");
        mat
    }

    // === GLASS ===

    /// Clear glass material preset
    pub fn glass() -> Material {
        let mut mat = Material::new("Glass");
        mat.set_base_color(Vec3::new(1.0, 1.0, 1.0));
        mat.set_metallic(0.0);
        mat.set_roughness(0.0);
        mat.set_opacity(0.1);
        mat.set_ior(1.5);
        mat.set_metadata("category", "Glass");
        mat.set_metadata("preset", "glass");
        mat
    }

    /// Frosted glass material preset
    pub fn glass_frosted() -> Material {
        let mut mat = Material::new("Frosted Glass");
        mat.set_base_color(Vec3::new(1.0, 1.0, 1.0));
        mat.set_metallic(0.0);
        mat.set_roughness(0.3);
        mat.set_opacity(0.2);
        mat.set_ior(1.5);
        mat.set_metadata("category", "Glass");
        mat.set_metadata("preset", "glass_frosted");
        mat
    }

    /// Colored glass material preset
    pub fn glass_colored(color: Vec3) -> Material {
        let mut mat = Material::new("Colored Glass");
        mat.set_base_color(color);
        mat.set_metallic(0.0);
        mat.set_roughness(0.0);
        mat.set_opacity(0.3);
        mat.set_ior(1.5);
        mat.set_metadata("category", "Glass");
        mat.set_metadata("preset", "glass_colored");
        mat
    }

    // === WOOD ===

    /// Wood material preset
    pub fn wood() -> Material {
        let mut mat = Material::new("Wood");
        mat.set_base_color(Vec3::new(0.6, 0.4, 0.2));
        mat.set_metallic(0.0);
        mat.set_roughness(0.8);
        mat.set_metadata("category", "Wood");
        mat.set_metadata("preset", "wood");
        mat
    }

    /// Polished wood material preset
    pub fn wood_polished() -> Material {
        let mut mat = Material::new("Polished Wood");
        mat.set_base_color(Vec3::new(0.5, 0.3, 0.15));
        mat.set_metallic(0.0);
        mat.set_roughness(0.2);
        mat.set_metadata("category", "Wood");
        mat.set_metadata("preset", "wood_polished");
        mat
    }

    // === STONE ===

    /// Stone material preset
    pub fn stone() -> Material {
        let mut mat = Material::new("Stone");
        mat.set_base_color(Vec3::new(0.5, 0.5, 0.5));
        mat.set_metallic(0.0);
        mat.set_roughness(0.9);
        mat.set_metadata("category", "Stone");
        mat.set_metadata("preset", "stone");
        mat
    }

    /// Marble material preset
    pub fn marble() -> Material {
        let mut mat = Material::new("Marble");
        mat.set_base_color(Vec3::new(0.9, 0.9, 0.85));
        mat.set_metallic(0.0);
        mat.set_roughness(0.1);
        mat.set_metadata("category", "Stone");
        mat.set_metadata("preset", "marble");
        mat
    }

    // === FABRIC ===

    /// Fabric material preset
    pub fn fabric() -> Material {
        let mut mat = Material::new("Fabric");
        mat.set_base_color(Vec3::new(0.7, 0.7, 0.7));
        mat.set_metallic(0.0);
        mat.set_roughness(0.95);
        mat.set_metadata("category", "Fabric");
        mat.set_metadata("preset", "fabric");
        mat
    }

    /// Velvet material preset
    pub fn velvet() -> Material {
        let mut mat = Material::new("Velvet");
        mat.set_base_color(Vec3::new(0.3, 0.1, 0.2));
        mat.set_metallic(0.0);
        mat.set_roughness(0.9);
        mat.set_metadata("category", "Fabric");
        mat.set_metadata("preset", "velvet");
        mat
    }

    // === RUBBER ===

    /// Rubber material preset
    pub fn rubber() -> Material {
        let mut mat = Material::new("Rubber");
        mat.set_base_color(Vec3::new(0.1, 0.1, 0.1));
        mat.set_metallic(0.0);
        mat.set_roughness(0.8);
        mat.set_metadata("category", "Rubber");
        mat.set_metadata("preset", "rubber");
        mat
    }

    // === EMISSIVE ===

    /// Neon light material preset
    pub fn neon(color: Vec3) -> Material {
        let mut mat = Material::new("Neon");
        mat.set_base_color(color);
        mat.set_emissive(color);
        mat.set_emissive_strength(5.0);
        mat.set_metallic(0.0);
        mat.set_roughness(0.0);
        mat.set_metadata("category", "Emissive");
        mat.set_metadata("preset", "neon");
        mat
    }

    /// LED light material preset
    pub fn led(color: Vec3) -> Material {
        let mut mat = Material::new("LED");
        mat.set_base_color(color);
        mat.set_emissive(color);
        mat.set_emissive_strength(10.0);
        mat.set_metallic(0.0);
        mat.set_roughness(0.0);
        mat.set_metadata("category", "Emissive");
        mat.set_metadata("preset", "led");
        mat
    }

    // === UTILITY ===

    /// Default gray material
    pub fn default() -> Material {
        Material::new("Default")
    }

    /// Pure white material
    pub fn white() -> Material {
        let mut mat = Material::new("White");
        mat.set_base_color(Vec3::ONE);
        mat
    }

    /// Pure black material
    pub fn black() -> Material {
        let mut mat = Material::new("Black");
        mat.set_base_color(Vec3::ZERO);
        mat
    }

    /// Get all preset names
    pub fn all_preset_names() -> Vec<&'static str> {
        vec![
            "gold",
            "silver",
            "copper",
            "aluminum",
            "iron",
            "brushed_metal",
            "plastic_glossy",
            "plastic_matte",
            "plastic_red",
            "plastic_blue",
            "plastic_green",
            "glass",
            "glass_frosted",
            "wood",
            "wood_polished",
            "stone",
            "marble",
            "fabric",
            "velvet",
            "rubber",
            "default",
            "white",
            "black",
        ]
    }

    /// Get a preset by name
    pub fn get_preset(name: &str) -> Option<Material> {
        match name {
            "gold" => Some(Self::gold()),
            "silver" => Some(Self::silver()),
            "copper" => Some(Self::copper()),
            "aluminum" => Some(Self::aluminum()),
            "iron" => Some(Self::iron()),
            "brushed_metal" => Some(Self::brushed_metal()),
            "plastic_glossy" => Some(Self::plastic_glossy()),
            "plastic_matte" => Some(Self::plastic_matte()),
            "plastic_red" => Some(Self::plastic_red()),
            "plastic_blue" => Some(Self::plastic_blue()),
            "plastic_green" => Some(Self::plastic_green()),
            "glass" => Some(Self::glass()),
            "glass_frosted" => Some(Self::glass_frosted()),
            "wood" => Some(Self::wood()),
            "wood_polished" => Some(Self::wood_polished()),
            "stone" => Some(Self::stone()),
            "marble" => Some(Self::marble()),
            "fabric" => Some(Self::fabric()),
            "velvet" => Some(Self::velvet()),
            "rubber" => Some(Self::rubber()),
            "default" => Some(Self::default()),
            "white" => Some(Self::white()),
            "black" => Some(Self::black()),
            _ => None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_metal_presets() {
        let gold = MaterialPreset::gold();
        assert_eq!(gold.metallic(), 1.0);
        assert!(gold.roughness() < 0.2);

        let silver = MaterialPreset::silver();
        assert_eq!(silver.metallic(), 1.0);
    }

    #[test]
    fn test_plastic_presets() {
        let glossy = MaterialPreset::plastic_glossy();
        assert_eq!(glossy.metallic(), 0.0);
        assert!(glossy.roughness() < 0.2);

        let matte = MaterialPreset::plastic_matte();
        assert!(matte.roughness() > 0.5);
    }

    #[test]
    fn test_glass_presets() {
        let glass = MaterialPreset::glass();
        assert!(glass.is_transparent());
        assert_eq!(glass.ior(), 1.5);
        assert_eq!(glass.roughness(), 0.0);
    }

    #[test]
    fn test_emissive_presets() {
        let neon = MaterialPreset::neon(Vec3::new(1.0, 0.0, 1.0));
        assert!(neon.is_emissive());
        assert!(neon.emissive_strength() > 0.0);
    }

    #[test]
    fn test_get_preset_by_name() {
        let gold = MaterialPreset::get_preset("gold");
        assert!(gold.is_some());
        assert_eq!(gold.unwrap().name(), "Gold");

        let invalid = MaterialPreset::get_preset("nonexistent");
        assert!(invalid.is_none());
    }

    #[test]
    fn test_all_preset_names() {
        let names = MaterialPreset::all_preset_names();
        assert!(!names.is_empty());
        assert!(names.contains(&"gold"));
        assert!(names.contains(&"glass"));
    }

    #[test]
    fn test_preset_metadata() {
        let gold = MaterialPreset::gold();
        assert_eq!(gold.get_metadata("category"), Some("Metal"));
        assert_eq!(gold.get_metadata("preset"), Some("gold"));
    }
}
