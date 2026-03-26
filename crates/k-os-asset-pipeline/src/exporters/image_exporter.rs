//! Image/texture exporter for PNG, JPEG, TGA, TIFF, etc.

use crate::asset::{Asset, AssetData};
use crate::error::{AssetError, Result};
use crate::pipeline::AssetExporter;
use image::{ImageBuffer, Rgba};
use std::path::Path;

/// Image/texture exporter
#[derive(Clone)]
pub struct ImageExporter;

impl ImageExporter {
    pub fn new() -> Self {
        Self
    }
}

impl AssetExporter for ImageExporter {
    fn supported_formats(&self) -> Vec<&str> {
        vec!["png", "jpg", "jpeg", "tga", "tiff", "tif", "bmp"]
    }

    fn export(&self, asset: &Asset, path: &Path) -> Result<()> {
        let texture_data = match &asset.data {
            AssetData::Texture(texture) => texture,
            _ => {
                return Err(AssetError::InvalidAsset(
                    "Asset is not a texture".to_string(),
                ))
            }
        };

        // Create image buffer from texture data
        let img = ImageBuffer::<Rgba<u8>, _>::from_raw(
            texture_data.width,
            texture_data.height,
            texture_data.data.clone(),
        )
        .ok_or_else(|| {
            AssetError::InvalidAsset("Failed to create image buffer from texture data".to_string())
        })?;

        // Save image
        img.save(path)?;

        Ok(())
    }

    fn name(&self) -> &str {
        "ImageExporter"
    }
}

impl Default for ImageExporter {
    fn default() -> Self {
        Self::new()
    }
}
