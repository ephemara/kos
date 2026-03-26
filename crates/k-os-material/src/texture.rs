//! Texture slot management for PBR materials

use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

/// Texture slots for PBR material properties
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum TextureSlot {
    /// Base color (albedo) texture
    BaseColor,
    /// Metallic texture (grayscale)
    Metallic,
    /// Roughness texture (grayscale)
    Roughness,
    /// Normal map texture (tangent space)
    Normal,
    /// Ambient occlusion texture (grayscale)
    AmbientOcclusion,
    /// Emissive texture (RGB)
    Emissive,
    /// Height/displacement map (grayscale)
    Height,
    /// Opacity/alpha texture (grayscale)
    Opacity,
}

impl TextureSlot {
    /// Get all available texture slots
    pub fn all() -> &'static [TextureSlot] {
        &[
            TextureSlot::BaseColor,
            TextureSlot::Metallic,
            TextureSlot::Roughness,
            TextureSlot::Normal,
            TextureSlot::AmbientOcclusion,
            TextureSlot::Emissive,
            TextureSlot::Height,
            TextureSlot::Opacity,
        ]
    }

    /// Get the display name for this texture slot
    pub fn display_name(&self) -> &'static str {
        match self {
            TextureSlot::BaseColor => "Base Color",
            TextureSlot::Metallic => "Metallic",
            TextureSlot::Roughness => "Roughness",
            TextureSlot::Normal => "Normal",
            TextureSlot::AmbientOcclusion => "Ambient Occlusion",
            TextureSlot::Emissive => "Emissive",
            TextureSlot::Height => "Height",
            TextureSlot::Opacity => "Opacity",
        }
    }

    /// Get the typical file suffix for this texture slot
    pub fn file_suffix(&self) -> &'static str {
        match self {
            TextureSlot::BaseColor => "_albedo",
            TextureSlot::Metallic => "_metallic",
            TextureSlot::Roughness => "_roughness",
            TextureSlot::Normal => "_normal",
            TextureSlot::AmbientOcclusion => "_ao",
            TextureSlot::Emissive => "_emissive",
            TextureSlot::Height => "_height",
            TextureSlot::Opacity => "_opacity",
        }
    }
}

/// Information about a texture assigned to a material slot
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TextureInfo {
    /// Path to the texture file
    path: PathBuf,
    /// UV channel to use (0-3)
    uv_channel: u8,
    /// Texture scale/tiling
    scale: (f32, f32),
    /// Texture offset
    offset: (f32, f32),
    /// Texture rotation in radians
    rotation: f32,
    /// Whether to use sRGB color space (true for color textures, false for data textures)
    srgb: bool,
}

impl TextureInfo {
    /// Create a new texture info with default settings
    pub fn new<P: AsRef<Path>>(path: P) -> Self {
        Self {
            path: path.as_ref().to_path_buf(),
            uv_channel: 0,
            scale: (1.0, 1.0),
            offset: (0.0, 0.0),
            rotation: 0.0,
            srgb: true,
        }
    }

    /// Create a new texture info for a data texture (non-sRGB)
    pub fn new_data<P: AsRef<Path>>(path: P) -> Self {
        Self {
            path: path.as_ref().to_path_buf(),
            uv_channel: 0,
            scale: (1.0, 1.0),
            offset: (0.0, 0.0),
            rotation: 0.0,
            srgb: false,
        }
    }

    /// Get the texture file path
    pub fn path(&self) -> &Path {
        &self.path
    }

    /// Set the texture file path
    pub fn set_path<P: AsRef<Path>>(&mut self, path: P) {
        self.path = path.as_ref().to_path_buf();
    }

    /// Get the UV channel
    pub fn uv_channel(&self) -> u8 {
        self.uv_channel
    }

    /// Set the UV channel (0-3)
    pub fn set_uv_channel(&mut self, channel: u8) {
        self.uv_channel = channel.min(3);
    }

    /// Get the texture scale
    pub fn scale(&self) -> (f32, f32) {
        self.scale
    }

    /// Set the texture scale
    pub fn set_scale(&mut self, scale: (f32, f32)) {
        self.scale = scale;
    }

    /// Get the texture offset
    pub fn offset(&self) -> (f32, f32) {
        self.offset
    }

    /// Set the texture offset
    pub fn set_offset(&mut self, offset: (f32, f32)) {
        self.offset = offset;
    }

    /// Get the texture rotation in radians
    pub fn rotation(&self) -> f32 {
        self.rotation
    }

    /// Set the texture rotation in radians
    pub fn set_rotation(&mut self, rotation: f32) {
        self.rotation = rotation;
    }

    /// Check if this texture uses sRGB color space
    pub fn is_srgb(&self) -> bool {
        self.srgb
    }

    /// Set whether this texture uses sRGB color space
    pub fn set_srgb(&mut self, srgb: bool) {
        self.srgb = srgb;
    }

    /// Check if the texture file exists
    pub fn exists(&self) -> bool {
        self.path.exists()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_texture_slot_all() {
        let slots = TextureSlot::all();
        assert_eq!(slots.len(), 8);
        assert!(slots.contains(&TextureSlot::BaseColor));
        assert!(slots.contains(&TextureSlot::Normal));
    }

    #[test]
    fn test_texture_slot_display_name() {
        assert_eq!(TextureSlot::BaseColor.display_name(), "Base Color");
        assert_eq!(TextureSlot::Normal.display_name(), "Normal");
    }

    #[test]
    fn test_texture_info_creation() {
        let info = TextureInfo::new("test.png");
        assert_eq!(info.path(), Path::new("test.png"));
        assert_eq!(info.uv_channel(), 0);
        assert_eq!(info.scale(), (1.0, 1.0));
        assert!(info.is_srgb());
    }

    #[test]
    fn test_texture_info_data() {
        let info = TextureInfo::new_data("normal.png");
        assert!(!info.is_srgb());
    }

    #[test]
    fn test_texture_info_modifications() {
        let mut info = TextureInfo::new("test.png");
        info.set_scale((2.0, 2.0));
        info.set_offset((0.5, 0.5));
        info.set_rotation(std::f32::consts::PI / 4.0);
        info.set_uv_channel(1);

        assert_eq!(info.scale(), (2.0, 2.0));
        assert_eq!(info.offset(), (0.5, 0.5));
        assert_eq!(info.rotation(), std::f32::consts::PI / 4.0);
        assert_eq!(info.uv_channel(), 1);
    }
}
