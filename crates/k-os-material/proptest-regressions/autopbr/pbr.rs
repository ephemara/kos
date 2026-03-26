use glam::{Vec3, Vec4};
use serde::{Deserialize, Serialize};

/// PBR material workflow type
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum PbrWorkflow {
    /// Metallic/Roughness workflow (standard)
    MetallicRoughness,
    /// Specular/Glossiness workflow
    SpecularGlossiness,
}

/// PBR material definition
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PbrMaterial {
    pub name: String,
    pub workflow: PbrWorkflow,
    
    // Base properties
    pub base_color: Vec4,
    pub metallic: f32,
    pub roughness: f32,
    pub emissive: Vec3,
    pub emissive_strength: f32,
    
    // Texture maps (optional texture IDs)
    pub albedo_map: Option<u32>,
    pub normal_map: Option<u32>,
    pub metallic_map: Option<u32>,
    pub roughness_map: Option<u32>,
    pub ao_map: Option<u32>,
    pub emissive_map: Option<u32>,
    pub height_map: Option<u32>,
    
    // Map strengths
    pub normal_strength: f32,
    pub ao_strength: f32,
    pub height_scale: f32,
    
    // Advanced properties
    pub alpha_mode: AlphaMode,
    pub alpha_cutoff: f32,
    pub double_sided: bool,
    
    // Clearcoat extension
    pub clearcoat: Option<ClearcoatExtension>,
    
    // Transmission extension (glass)
    pub transmission: Option<TransmissionExtension>,
    
    // Sheen extension (cloth)
    pub sheen: Option<SheenExtension>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum AlphaMode {
    Opaque,
    Mask,
    Blend,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClearcoatExtension {
    pub factor: f32,
    pub roughness: f32,
    pub normal_map: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TransmissionExtension {
    pub factor: f32,
    pub ior: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SheenExtension {
    pub color: Vec3,
    pub roughness: f32,
}

impl Default for PbrMaterial {
    fn default() -> Self {
        Self {
            name: "Default Material".to_string(),
            workflow: PbrWorkflow::MetallicRoughness,
            base_color: Vec4::new(0.8, 0.8, 0.8, 1.0),
            metallic: 0.0,
            roughness: 0.5,
            emissive: Vec3::ZERO,
            emissive_strength: 0.0,
            albedo_map: None,
            normal_map: None,
            metallic_map: None,
            roughness_map: None,
            ao_map: None,
            emissive_map: None,
            height_map: None,
            normal_strength: 1.0,
            ao_strength: 1.0,
            height_scale: 0.05,
            alpha_mode: AlphaMode::Opaque,
            alpha_cutoff: 0.5,
            double_sided: false,
            clearcoat: None,
            transmission: None,
            sheen: None,
        }
    }
}

impl PbrMaterial {
    /// Create a new material with default values
    pub fn new(name: impl Into<String>) -> Self {
        Self {
            name: name.into(),
            ..Default::default()
        }
    }
    
    /// Create a metallic material (metal workflow)
    pub fn metallic(name: impl Into<String>, base_color: Vec4, metallic: f32, roughness: f32) -> Self {
        Self {
            name: name.into(),
            base_color,
            metallic,
            roughness,
            ..Default::default()
        }
    }
    
    /// Create a dielectric material (non-metal)
    pub fn dielectric(name: impl Into<String>, base_color: Vec4, roughness: f32) -> Self {
        Self {
            name: name.into(),
            base_color,
            metallic: 0.0,
            roughness,
            ..Default::default()
        }
    }
    
    /// Create an emissive material
    pub fn emissive(name: impl Into<String>, emissive_color: Vec3, strength: f32) -> Self {
        Self {
            name: name.into(),
            emissive: emissive_color,
            emissive_strength: strength,
            ..Default::default()
        }
    }
    
    /// Add clearcoat layer (car paint, lacquer)
    pub fn with_clearcoat(mut self, factor: f32, roughness: f32) -> Self {
        self.clearcoat = Some(ClearcoatExtension {
            factor,
            roughness,
            normal_map: None,
        });
        self
    }
    
    /// Add transmission (glass, transparent materials)
    pub fn with_transmission(mut self, factor: f32, ior: f32) -> Self {
        self.transmission = Some(TransmissionExtension { factor, ior });
        self.alpha_mode = AlphaMode::Blend;
        self
    }
    
    /// Add sheen (cloth, velvet)
    pub fn with_sheen(mut self, color: Vec3, roughness: f32) -> Self {
        self.sheen = Some(SheenExtension { color, roughness });
        self
    }
    
    /// Check if material requires alpha blending
    pub fn is_transparent(&self) -> bool {
        matches!(self.alpha_mode, AlphaMode::Blend) || self.transmission.is_some()
    }
    
    /// Check if material has any texture maps
    pub fn has_textures(&self) -> bool {
        self.albedo_map.is_some()
            || self.normal_map.is_some()
            || self.metallic_map.is_some()
            || self.roughness_map.is_some()
            || self.ao_map.is_some()
            || self.emissive_map.is_some()
            || self.height_map.is_some()
    }
}

/// Material presets for common use cases
pub mod presets {
    use super::*;
    
    pub fn chrome() -> PbrMaterial {
        PbrMaterial::metallic("Chrome", Vec4::new(0.95, 0.95, 0.95, 1.0), 1.0, 0.1)
    }
    
    pub fn gold() -> PbrMaterial {
        PbrMaterial::metallic("Gold", Vec4::new(1.0, 0.766, 0.336, 1.0), 1.0, 0.2)
    }
    
    pub fn copper() -> PbrMaterial {
        PbrMaterial::metallic("Copper", Vec4::new(0.955, 0.637, 0.538, 1.0), 1.0, 0.25)
    }
    
    pub fn plastic_white() -> PbrMaterial {
        PbrMaterial::dielectric("White Plastic", Vec4::new(0.9, 0.9, 0.9, 1.0), 0.4)
    }
    
    pub fn rubber_black() -> PbrMaterial {
        PbrMaterial::dielectric("Black Rubber", Vec4::new(0.05, 0.05, 0.05, 1.0), 0.9)
    }
    
    pub fn car_paint_red() -> PbrMaterial {
        PbrMaterial::dielectric("Red Car Paint", Vec4::new(0.8, 0.05, 0.05, 1.0), 0.3)
            .with_clearcoat(1.0, 0.05)
    }
    
    pub fn glass() -> PbrMaterial {
        PbrMaterial::dielectric("Glass", Vec4::new(1.0, 1.0, 1.0, 0.1), 0.0)
            .with_transmission(0.95, 1.5)
    }
    
    pub fn velvet_red() -> PbrMaterial {
        PbrMaterial::dielectric("Red Velvet", Vec4::new(0.6, 0.05, 0.05, 1.0), 0.8)
            .with_sheen(Vec3::new(1.0, 0.2, 0.2), 0.5)
    }
    
    pub fn neon_blue() -> PbrMaterial {
        PbrMaterial::emissive("Neon Blue", Vec3::new(0.0, 0.5, 1.0), 5.0)
    }
}
