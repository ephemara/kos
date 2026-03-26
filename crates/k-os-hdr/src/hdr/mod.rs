// HDR Capture System - Future-grade implementation
// Quantum-optimized for maximum performance and precision

use nalgebra::Vector3;
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::sync::Arc;
pub mod io;
pub mod light_authoring;
pub mod merge;
pub mod tone_mapping;

use k_os_gpu_pipeline::device::GpuComputeDevice as GpuCompute;

/// HDR image with floating-point precision
#[derive(Clone, Debug)]
pub struct HDRImage {
    /// RGB float data (linear color space)
    pub data: Vec<f32>,
    pub width: u32,
    pub height: u32,
    pub format: HDRFormat,
}

/// Supported HDR formats
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum HDRFormat {
    /// Radiance RGBE (.hdr)
    RadianceRGBE,
    /// OpenEXR (.exr)
    OpenEXR,
}

/// Light source for HDR authoring
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Light {
    pub light_type: LightType,
    pub position: Vector3<f32>,
    pub direction: Vector3<f32>,
    /// Intensity in lumens (0.0 - 1000000.0)
    pub intensity: f32,
    /// Color temperature in Kelvin (1000K - 40000K)
    pub color_temperature: f32,
}

/// Types of light sources
#[derive(Clone, Debug, Serialize, Deserialize)]
pub enum LightType {
    Point,
    Directional,
    Area { width: f32, height: f32 },
}

/// Input for HDR merging from multiple exposures
#[derive(Clone, Debug)]
pub struct HDRMergeInput {
    /// Vector of (image_data, exposure_value) pairs
    /// Exposure values in EV (-10 to +10)
    pub exposures: Vec<(Vec<u8>, f32)>,
    pub width: u32,
    pub height: u32,
}

/// HDR capture and processing system
pub struct HDRCapture {
    gpu_compute: Arc<GpuCompute>,
}

impl HDRCapture {
    /// Create new HDR capture system
    pub fn new(gpu_compute: Arc<GpuCompute>) -> Self {
        Self { gpu_compute }
    }

    /// Merge multiple exposures into HDR image
    pub fn merge_exposures(&self, input: HDRMergeInput) -> Result<HDRImage, HDRError> {
        merge::merge_exposures(&self.gpu_compute, input)
    }

    /// Apply tone mapping to HDR image for display
    pub fn tone_map(&self, hdr: &HDRImage, method: ToneMappingMethod) -> Result<Vec<u8>, HDRError> {
        tone_mapping::apply_tone_mapping(hdr, method)
    }

    /// Add light to HDR environment
    pub fn add_light(&self, hdr: &mut HDRImage, light: &Light) -> Result<(), HDRError> {
        light_authoring::add_light_to_hdr(&self.gpu_compute, hdr, light)
    }

    /// Save HDR image to file
    pub fn save(&self, hdr: &HDRImage, path: &Path) -> Result<(), HDRError> {
        io::save_hdr(hdr, path)
    }

    /// Load HDR image from file
    pub fn load(&self, path: &Path) -> Result<HDRImage, HDRError> {
        io::load_hdr(path)
    }

    /// Convert 360° panorama to equirectangular HDR
    pub fn panorama_to_hdr(
        &self,
        image_data: &[u8],
        width: u32,
        height: u32,
    ) -> Result<HDRImage, HDRError> {
        // Convert LDR panorama to HDR format
        let pixel_count = (width * height * 3) as usize;
        let mut hdr_data = Vec::with_capacity(pixel_count);

        for chunk in image_data.chunks(3) {
            if chunk.len() == 3 {
                // Convert sRGB to linear and normalize to 0-1 range
                let r = Self::srgb_to_linear(chunk[0] as f32 / 255.0);
                let g = Self::srgb_to_linear(chunk[1] as f32 / 255.0);
                let b = Self::srgb_to_linear(chunk[2] as f32 / 255.0);

                hdr_data.push(r);
                hdr_data.push(g);
                hdr_data.push(b);
            }
        }

        Ok(HDRImage {
            data: hdr_data,
            width,
            height,
            format: HDRFormat::RadianceRGBE,
        })
    }

    /// sRGB to linear color space conversion
    fn srgb_to_linear(srgb: f32) -> f32 {
        if srgb <= 0.04045 {
            srgb / 12.92
        } else {
            ((srgb + 0.055) / 1.055).powf(2.4)
        }
    }
}

/// Tone mapping methods
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum ToneMappingMethod {
    Reinhard,
    Filmic,
    ACES,
    Uncharted2,
}

/// HDR processing errors
#[derive(Debug, thiserror::Error)]
pub enum HDRError {
    #[error("Invalid exposure value: {0} (must be between -10 and +10 EV)")]
    InvalidExposure(f32),

    #[error("Insufficient exposures: {0} (need at least 2)")]
    InsufficientExposures(usize),

    #[error("Image dimension mismatch")]
    DimensionMismatch,

    #[error("Invalid light intensity: {0} (must be between 0 and 1000000 lumens)")]
    InvalidIntensity(f32),

    #[error("Invalid color temperature: {0} (must be between 1000K and 40000K)")]
    InvalidColorTemperature(f32),

    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),

    #[error("Image format error: {0}")]
    ImageError(String),

    #[error("GPU compute error: {0}")]
    GpuError(String),
}

impl HDRImage {
    /// Create new HDR image with given dimensions
    pub fn new(width: u32, height: u32, format: HDRFormat) -> Self {
        let pixel_count = (width * height * 3) as usize;
        Self {
            data: vec![0.0; pixel_count],
            width,
            height,
            format,
        }
    }

    /// Get pixel at (x, y) as RGB
    pub fn get_pixel(&self, x: u32, y: u32) -> Option<Vector3<f32>> {
        if x >= self.width || y >= self.height {
            return None;
        }

        let idx = ((y * self.width + x) * 3) as usize;
        Some(Vector3::new(
            self.data[idx],
            self.data[idx + 1],
            self.data[idx + 2],
        ))
    }

    /// Set pixel at (x, y) with RGB values
    pub fn set_pixel(&mut self, x: u32, y: u32, color: Vector3<f32>) {
        if x >= self.width || y >= self.height {
            return;
        }

        let idx = ((y * self.width + x) * 3) as usize;
        self.data[idx] = color.x;
        self.data[idx + 1] = color.y;
        self.data[idx + 2] = color.z;
    }

    /// Get luminance at pixel (x, y)
    pub fn get_luminance(&self, x: u32, y: u32) -> Option<f32> {
        self.get_pixel(x, y).map(|rgb| {
            // Rec. 709 luminance coefficients
            0.2126 * rgb.x + 0.7152 * rgb.y + 0.0722 * rgb.z
        })
    }
}

impl Light {
    /// Create new point light
    pub fn point(
        position: Vector3<f32>,
        intensity: f32,
        color_temperature: f32,
    ) -> Result<Self, HDRError> {
        Self::validate_intensity(intensity)?;
        Self::validate_color_temperature(color_temperature)?;

        Ok(Self {
            light_type: LightType::Point,
            position,
            direction: Vector3::zeros(),
            intensity,
            color_temperature,
        })
    }

    /// Create new directional light
    pub fn directional(
        direction: Vector3<f32>,
        intensity: f32,
        color_temperature: f32,
    ) -> Result<Self, HDRError> {
        Self::validate_intensity(intensity)?;
        Self::validate_color_temperature(color_temperature)?;

        Ok(Self {
            light_type: LightType::Directional,
            position: Vector3::zeros(),
            direction: direction.normalize(),
            intensity,
            color_temperature,
        })
    }

    /// Create new area light
    pub fn area(
        position: Vector3<f32>,
        direction: Vector3<f32>,
        width: f32,
        height: f32,
        intensity: f32,
        color_temperature: f32,
    ) -> Result<Self, HDRError> {
        Self::validate_intensity(intensity)?;
        Self::validate_color_temperature(color_temperature)?;

        Ok(Self {
            light_type: LightType::Area { width, height },
            position,
            direction: direction.normalize(),
            intensity,
            color_temperature,
        })
    }

    /// Get light color from color temperature (Kelvin to RGB)
    pub fn get_color(&self) -> Vector3<f32> {
        kelvin_to_rgb(self.color_temperature)
    }

    fn validate_intensity(intensity: f32) -> Result<(), HDRError> {
        if intensity < 0.0 || intensity > 1_000_000.0 {
            Err(HDRError::InvalidIntensity(intensity))
        } else {
            Ok(())
        }
    }

    fn validate_color_temperature(temp: f32) -> Result<(), HDRError> {
        if temp < 1000.0 || temp > 40_000.0 {
            Err(HDRError::InvalidColorTemperature(temp))
        } else {
            Ok(())
        }
    }
}

/// Convert color temperature (Kelvin) to RGB
/// Based on Tanner Helland's algorithm
fn kelvin_to_rgb(kelvin: f32) -> Vector3<f32> {
    let temp = kelvin / 100.0;

    let r = if temp <= 66.0 {
        1.0
    } else {
        let r = temp - 60.0;
        let r = 329.698727446 * r.powf(-0.1332047592);
        (r / 255.0).clamp(0.0, 1.0)
    };

    let g = if temp <= 66.0 {
        let g = 99.4708025861 * temp.ln() - 161.1195681661;
        (g / 255.0).clamp(0.0, 1.0)
    } else {
        let g = temp - 60.0;
        let g = 288.1221695283 * g.powf(-0.0755148492);
        (g / 255.0).clamp(0.0, 1.0)
    };

    let b = if temp >= 66.0 {
        1.0
    } else if temp <= 19.0 {
        0.0
    } else {
        let b = temp - 10.0;
        let b = 138.5177312231 * b.ln() - 305.0447927307;
        (b / 255.0).clamp(0.0, 1.0)
    };

    Vector3::new(r, g, b)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hdr_image_creation() {
        let hdr = HDRImage::new(1920, 1080, HDRFormat::RadianceRGBE);
        assert_eq!(hdr.width, 1920);
        assert_eq!(hdr.height, 1080);
        assert_eq!(hdr.data.len(), 1920 * 1080 * 3);
    }

    #[test]
    fn test_pixel_operations() {
        let mut hdr = HDRImage::new(100, 100, HDRFormat::RadianceRGBE);
        let color = Vector3::new(1.0, 0.5, 0.25);

        hdr.set_pixel(50, 50, color);
        let retrieved = hdr.get_pixel(50, 50).unwrap();

        assert!((retrieved.x - color.x).abs() < 1e-6);
        assert!((retrieved.y - color.y).abs() < 1e-6);
        assert!((retrieved.z - color.z).abs() < 1e-6);
    }

    #[test]
    fn test_light_validation() {
        // Valid intensity
        assert!(Light::point(Vector3::zeros(), 1000.0, 6500.0).is_ok());

        // Invalid intensity (too high)
        assert!(Light::point(Vector3::zeros(), 2_000_000.0, 6500.0).is_err());

        // Invalid color temperature (too low)
        assert!(Light::point(Vector3::zeros(), 1000.0, 500.0).is_err());

        // Invalid color temperature (too high)
        assert!(Light::point(Vector3::zeros(), 1000.0, 50_000.0).is_err());
    }

    #[test]
    fn test_kelvin_to_rgb() {
        // Daylight (6500K) should be close to white
        let daylight = kelvin_to_rgb(6500.0);
        assert!(daylight.x > 0.9 && daylight.x <= 1.0);
        assert!(daylight.y > 0.9 && daylight.y <= 1.0);
        assert!(daylight.z > 0.9 && daylight.z <= 1.0);

        // Warm light (2700K) should be orange-ish
        let warm = kelvin_to_rgb(2700.0);
        assert!(warm.x > warm.y);
        assert!(warm.y > warm.z);
    }
}
