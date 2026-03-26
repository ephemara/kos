//! Thumbnail generation utilities

use crate::error::Result;
use image::RgbaImage;
use std::path::Path;

/// Generate thumbnail from image file
pub fn generate_thumbnail(image_path: &Path, size: u32) -> Result<RgbaImage> {
    let img = image::open(image_path)?;
    let thumbnail = image::imageops::resize(
        &img.to_rgba8(),
        size,
        size,
        image::imageops::FilterType::Lanczos3,
    );
    Ok(thumbnail)
}

/// Save thumbnail to file
pub fn save_thumbnail(thumbnail: &RgbaImage, output_path: &Path) -> Result<()> {
    thumbnail.save(output_path)?;
    Ok(())
}
