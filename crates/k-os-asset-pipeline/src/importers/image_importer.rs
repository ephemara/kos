//! Image/texture importer for PNG, JPEG, TGA, TIFF, EXR, etc.

use crate::asset::{Asset, AssetData, AssetType, TextureData, TextureFormat};
use crate::error::{AssetError, Result};
use crate::pipeline::AssetImporter;
use image::{DynamicImage, GenericImageView};
use std::path::Path;

/// Image/texture importer
#[derive(Clone)]
pub struct ImageImporter;

impl ImageImporter {
    pub fn new() -> Self {
        Self
    }

    fn detect_format(img: &DynamicImage) -> TextureFormat {
        use image::ColorType;

        match img.color() {
            ColorType::L8 => TextureFormat::R8,
            ColorType::La8 => TextureFormat::Rg8,
            ColorType::Rgb8 => TextureFormat::Rgb8,
            ColorType::Rgba8 => TextureFormat::Rgba8,
            ColorType::L16 => TextureFormat::R16,
            ColorType::La16 => TextureFormat::Rg16,
            ColorType::Rgb16 => TextureFormat::Rgb16,
            ColorType::Rgba16 => TextureFormat::Rgba16,
            ColorType::Rgb32F => TextureFormat::Rgb32F,
            ColorType::Rgba32F => TextureFormat::Rgba32F,
            _ => TextureFormat::Rgba8, // Default fallback
        }
    }
}

impl AssetImporter for ImageImporter {
    fn supported_extensions(&self) -> Vec<&str> {
        vec!["png", "jpg", "jpeg", "tga", "tiff", "tif", "bmp", "webp"]
    }

    fn import(&self, path: &Path) -> Result<Asset> {
        let img = image::open(path).map_err(|e| AssetError::ImportFailed {
            path: path.to_path_buf(),
            source: anyhow::anyhow!("Image import error: {}", e),
        })?;

        let (width, height) = img.dimensions();
        let format = Self::detect_format(&img);

        // Convert to RGBA8 for consistency
        let rgba = img.to_rgba8();
        let data = rgba.into_raw();

        let texture_data = TextureData {
            width,
            height,
            format,
            data,
            mip_levels: 1,
        };

        let mut asset = Asset::new(
            String::new(), // Will be set by pipeline
            AssetType::Texture,
            path.to_path_buf(),
            AssetData::Texture(texture_data),
        );

        // Add metadata
        asset.add_metadata("format".to_string(), "image".to_string());
        asset.add_metadata("width".to_string(), width.to_string());
        asset.add_metadata("height".to_string(), height.to_string());
        asset.add_metadata("pixel_format".to_string(), format!("{:?}", format));

        Ok(asset)
    }

    fn name(&self) -> &str {
        "ImageImporter"
    }
}

impl Default for ImageImporter {
    fn default() -> Self {
        Self::new()
    }
}
