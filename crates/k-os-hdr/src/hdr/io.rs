// HDR File I/O - Radiance RGBE (.hdr) and OpenEXR (.exr)
// Using industry-standard libraries: image-hdr and exr crates

use std::fs::File;
use std::io::{BufReader, BufWriter};
use std::path::Path;

use image::ImageDecoder;

use super::{HDRError, HDRFormat, HDRImage};

/// Save HDR image to file
/// Automatically detects format from file extension
pub fn save_hdr(hdr: &HDRImage, path: &Path) -> Result<(), HDRError> {
    let extension = path
        .extension()
        .and_then(|e| e.to_str())
        .ok_or_else(|| HDRError::ImageError("No file extension".to_string()))?;

    match extension.to_lowercase().as_str() {
        "hdr" => save_radiance_rgbe(hdr, path),
        "exr" => save_openexr(hdr, path),
        _ => Err(HDRError::ImageError(format!(
            "Unsupported format: {}. Use .hdr or .exr",
            extension
        ))),
    }
}

/// Load HDR image from file
/// Automatically detects format from file extension
pub fn load_hdr(path: &Path) -> Result<HDRImage, HDRError> {
    let extension = path
        .extension()
        .and_then(|e| e.to_str())
        .ok_or_else(|| HDRError::ImageError("No file extension".to_string()))?;

    match extension.to_lowercase().as_str() {
        "hdr" => load_radiance_rgbe(path),
        "exr" => load_openexr(path),
        _ => Err(HDRError::ImageError(format!(
            "Unsupported format: {}. Use .hdr or .exr",
            extension
        ))),
    }
}

/// Save HDR image in Radiance RGBE format (.hdr)
/// Uses image-hdr crate for industry-standard encoding
fn save_radiance_rgbe(hdr: &HDRImage, path: &Path) -> Result<(), HDRError> {
    use image::codecs::hdr::HdrEncoder;

    let file = File::create(path)?;
    let writer = BufWriter::new(file);

    let encoder = HdrEncoder::new(writer);

    // Convert flat f32 array to RGB pixels
    let pixels: Vec<image::Rgb<f32>> = hdr
        .data
        .chunks_exact(3)
        .map(|chunk| image::Rgb([chunk[0], chunk[1], chunk[2]]))
        .collect();

    encoder
        .encode(&pixels, hdr.width as usize, hdr.height as usize)
        .map_err(|e| HDRError::ImageError(format!("RGBE encoding failed: {}", e)))?;

    Ok(())
}

/// Load HDR image from Radiance RGBE format (.hdr)
/// Uses image-hdr crate for industry-standard decoding
fn load_radiance_rgbe(path: &Path) -> Result<HDRImage, HDRError> {
    use image::codecs::hdr::HdrDecoder;

    let file = File::open(path)?;
    let reader = BufReader::new(file);

    let decoder = HdrDecoder::new(reader)
        .map_err(|e| HDRError::ImageError(format!("RGBE decoding failed: {}", e)))?;

    let metadata = decoder.metadata();
    let width = metadata.width as u32;
    let height = metadata.height as u32;

    let bytes_len = decoder.total_bytes() as usize;
    let mut bytes = vec![0u8; bytes_len];
    decoder
        .read_image(&mut bytes)
        .map_err(|e| HDRError::ImageError(format!("RGBE read failed: {}", e)))?;
    let pixels: Vec<image::Rgb<f32>> = bytes
        .chunks_exact(12)
        .map(|chunk| {
            image::Rgb([
                f32::from_ne_bytes(chunk[0..4].try_into().unwrap()),
                f32::from_ne_bytes(chunk[4..8].try_into().unwrap()),
                f32::from_ne_bytes(chunk[8..12].try_into().unwrap()),
            ])
        })
        .collect();

    // Convert RGB pixels to flat f32 array
    let mut data = Vec::with_capacity((width * height * 3) as usize);
    for pixel in pixels {
        data.push(pixel[0]);
        data.push(pixel[1]);
        data.push(pixel[2]);
    }

    Ok(HDRImage {
        data,
        width,
        height,
        format: HDRFormat::RadianceRGBE,
    })
}

/// Save HDR image in OpenEXR format (.exr)
/// Uses exr crate for industry-standard encoding
fn save_openexr(hdr: &HDRImage, path: &Path) -> Result<(), HDRError> {
    use exr::prelude::*;

    // Create RGB channels from flat data
    let width = hdr.width as usize;
    let height = hdr.height as usize;

    // Extract R, G, B channels
    let mut r_channel = Vec::with_capacity(width * height);
    let mut g_channel = Vec::with_capacity(width * height);
    let mut b_channel = Vec::with_capacity(width * height);

    for chunk in hdr.data.chunks_exact(3) {
        r_channel.push(chunk[0]);
        g_channel.push(chunk[1]);
        b_channel.push(chunk[2]);
    }

    // Create EXR image with RGB channels
    let layer = Layer::new(
        (width, height),
        LayerAttributes::named("rgba"),
        Encoding::SMALL_FAST_LOSSLESS,
        SpecificChannels::rgb(|position: exr::math::Vec2<usize>| {
            let index = position.y() * width + position.x();
            (r_channel[index], g_channel[index], b_channel[index])
        }),
    );

    let image = Image::from_layer(layer);

    image
        .write()
        .to_file(path)
        .map_err(|e| HDRError::ImageError(format!("EXR write failed: {}", e)))?;

    Ok(())
}

/// Load HDR image from OpenEXR format (.exr)
/// Uses exr crate for industry-standard decoding
fn load_openexr(path: &Path) -> Result<HDRImage, HDRError> {
    use exr::prelude::*;

    let image = read()
        .no_deep_data()
        .largest_resolution_level()
        .rgb_channels(
            |resolution, _channels| {
                let width = resolution.width();
                let height = resolution.height();
                (width, height, vec![0.0f32; width * height * 3])
            },
            |buffer, position, (r, g, b): (f32, f32, f32)| {
                let (width, _height, data) = buffer;
                let index = (position.y() * *width + position.x()) * 3;
                data[index] = r;
                data[index + 1] = g;
                data[index + 2] = b;
            },
        )
        .first_valid_layer()
        .all_attributes()
        .from_file(path)
        .map_err(|e| HDRError::ImageError(format!("EXR read failed: {}", e)))?;

    let (width, height, data) = image.layer_data.channel_data.pixels;

    Ok(HDRImage {
        data,
        width: width as u32,
        height: height as u32,
        format: HDRFormat::OpenEXR,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    #[test]
    fn test_rgbe_round_trip() {
        let temp_dir = TempDir::new().unwrap();
        let path = temp_dir.path().join("test.hdr");

        // Create test HDR image
        let mut hdr = HDRImage::new(4, 4, HDRFormat::RadianceRGBE);
        for i in 0..hdr.data.len() {
            hdr.data[i] = (i as f32) / 10.0;
        }

        // Save and load
        save_hdr(&hdr, &path).unwrap();
        let loaded = load_hdr(&path).unwrap();

        // Verify dimensions
        assert_eq!(loaded.width, hdr.width);
        assert_eq!(loaded.height, hdr.height);

        // Verify data (with tolerance for RGBE encoding)
        for (original, loaded) in hdr.data.iter().zip(loaded.data.iter()) {
            let diff = (original - loaded).abs();
            assert!(diff < 0.1, "Difference too large: {}", diff);
        }
    }

    #[test]
    fn test_exr_round_trip() {
        let temp_dir = TempDir::new().unwrap();
        let path = temp_dir.path().join("test.exr");

        // Create test HDR image
        let mut hdr = HDRImage::new(4, 4, HDRFormat::OpenEXR);
        for i in 0..hdr.data.len() {
            hdr.data[i] = (i as f32) / 10.0;
        }

        // Save and load
        save_hdr(&hdr, &path).unwrap();
        let loaded = load_hdr(&path).unwrap();

        // Verify dimensions
        assert_eq!(loaded.width, hdr.width);
        assert_eq!(loaded.height, hdr.height);

        // Verify data (EXR should be lossless for our use case)
        for (original, loaded) in hdr.data.iter().zip(loaded.data.iter()) {
            let diff = (original - loaded).abs();
            assert!(diff < 0.001, "Difference too large: {}", diff);
        }
    }

    #[test]
    fn test_unsupported_format() {
        let temp_dir = TempDir::new().unwrap();
        let path = temp_dir.path().join("test.png");

        let hdr = HDRImage::new(4, 4, HDRFormat::RadianceRGBE);

        // Should fail with unsupported format
        assert!(save_hdr(&hdr, &path).is_err());
    }

    #[test]
    fn test_format_detection() {
        let temp_dir = TempDir::new().unwrap();

        let hdr = HDRImage::new(2, 2, HDRFormat::RadianceRGBE);

        // Test .hdr extension
        let hdr_path = temp_dir.path().join("test.hdr");
        assert!(save_hdr(&hdr, &hdr_path).is_ok());

        // Test .exr extension
        let exr_path = temp_dir.path().join("test.exr");
        assert!(save_hdr(&hdr, &exr_path).is_ok());
    }
}
