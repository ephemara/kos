//! Feature Detection Module
//!
//! Extracts keypoints and descriptors from images using AKAZE or SIFT algorithms.
//! Supports GPU acceleration for batch processing.

#[cfg(feature = "photogrammetry")]
use anyhow::Context;
use anyhow::Result;
use rayon::prelude::*;
use serde::{Deserialize, Serialize};
use std::sync::Arc;

use super::ImageData;
use k_os_gpu_pipeline::device::GpuComputeDevice as GpuCompute;

#[cfg(feature = "photogrammetry")]
use akaze::Akaze;

/// Feature detector for extracting keypoints and descriptors
pub struct FeatureDetector {
    _gpu_compute: Arc<GpuCompute>,
    #[cfg(feature = "photogrammetry")]
    akaze: Akaze,
}

/// Set of features detected in an image
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FeatureSet {
    /// Image index
    pub image_index: usize,
    /// Detected keypoints
    pub keypoints: Vec<Keypoint>,
    /// Feature descriptors (one per keypoint)
    pub descriptors: Vec<FeatureDescriptor>,
}

/// 2D keypoint in an image
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct Keypoint {
    /// X coordinate in pixels
    pub x: f32,
    /// Y coordinate in pixels
    pub y: f32,
    /// Scale (size) of the feature
    pub scale: f32,
    /// Orientation in radians
    pub orientation: f32,
    /// Response strength
    pub response: f32,
}

/// Feature descriptor (binary or float vector)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum FeatureDescriptor {
    /// Binary descriptor (e.g., AKAZE, ORB)
    Binary(Vec<u8>),
    /// Float descriptor (e.g., SIFT, SURF)
    Float(Vec<f32>),
}

impl FeatureDetector {
    /// Create a new feature detector
    pub fn new(gpu_compute: Arc<GpuCompute>) -> Result<Self> {
        #[cfg(feature = "photogrammetry")]
        let akaze = Akaze::default();

        Ok(Self {
            _gpu_compute: gpu_compute,
            #[cfg(feature = "photogrammetry")]
            akaze,
        })
    }

    /// Detect features in a single image
    #[cfg_attr(not(feature = "photogrammetry"), allow(unused_variables))]
    pub fn detect(&self, image: &ImageData, max_features: usize) -> Result<FeatureSet> {
        #[cfg(feature = "photogrammetry")]
        {
            self.detect_akaze(image, max_features, 0)
        }

        #[cfg(not(feature = "photogrammetry"))]
        {
            anyhow::bail!(
                "Photogrammetry feature not enabled. Enable with --features photogrammetry"
            );
        }
    }

    /// Detect features in multiple images (batch processing)
    pub fn detect_batch(
        &self,
        images: &[ImageData],
        max_features: usize,
    ) -> Result<Vec<FeatureSet>> {
        log::info!(
            "Detecting features in {} images (max {} features per image)",
            images.len(),
            max_features
        );

        // Process images in parallel using Rayon
        let results: Result<Vec<FeatureSet>> = images
            .par_iter()
            .enumerate()
            .map(|(idx, image)| self.detect_with_index(image, max_features, idx))
            .collect();

        let feature_sets = results?;

        let total_features: usize = feature_sets.iter().map(|fs| fs.keypoints.len()).sum();
        log::info!(
            "Detected {} total features across {} images",
            total_features,
            images.len()
        );

        Ok(feature_sets)
    }

    /// Detect features with image index
    #[cfg_attr(not(feature = "photogrammetry"), allow(unused_variables))]
    fn detect_with_index(
        &self,
        image: &ImageData,
        max_features: usize,
        image_index: usize,
    ) -> Result<FeatureSet> {
        #[cfg(feature = "photogrammetry")]
        {
            self.detect_akaze(image, max_features, image_index)
        }

        #[cfg(not(feature = "photogrammetry"))]
        {
            anyhow::bail!("Photogrammetry feature not enabled");
        }
    }

    #[cfg(feature = "photogrammetry")]
    /// Detect features using AKAZE algorithm
    fn detect_akaze(
        &self,
        image: &ImageData,
        max_features: usize,
        image_index: usize,
    ) -> Result<FeatureSet> {
        use image23::DynamicImage;

        // Convert RGBA to grayscale
        let gray_image = self.rgba_to_gray(image)?;
        let gray_image = DynamicImage::ImageLuma8(gray_image);

        // Detect features using AKAZE
        let (keypoints_raw, descriptors_raw) = self.akaze.extract(&gray_image);

        // Convert to our format
        let mut keypoints = Vec::with_capacity(keypoints_raw.len().min(max_features));
        let mut descriptors = Vec::with_capacity(keypoints_raw.len().min(max_features));

        for (kp, desc) in keypoints_raw
            .iter()
            .zip(descriptors_raw.iter())
            .take(max_features)
        {
            keypoints.push(Keypoint {
                x: kp.point.0 as f32,
                y: kp.point.1 as f32,
                scale: kp.size,
                orientation: kp.angle,
                response: kp.response,
            });

            descriptors.push(FeatureDescriptor::Binary(desc.bytes.to_vec()));
        }

        log::debug!(
            "Image {}: detected {} features",
            image_index,
            keypoints.len()
        );

        Ok(FeatureSet {
            image_index,
            keypoints,
            descriptors,
        })
    }

    /// Convert RGBA image to grayscale
    #[cfg(feature = "photogrammetry")]
    fn rgba_to_gray(&self, image: &ImageData) -> Result<image23::GrayImage> {
        use image23::{GrayImage, ImageBuffer, Luma, Rgba};

        let rgba_image = ImageBuffer::<Rgba<u8>, Vec<u8>>::from_raw(
            image.width,
            image.height,
            image.pixels.clone(),
        )
        .context("Failed to create RGBA image buffer")?;

        let gray_image = GrayImage::from_fn(image.width, image.height, |x, y| {
            let pixel = rgba_image.get_pixel(x, y);
            let r = pixel[0] as f32;
            let g = pixel[1] as f32;
            let b = pixel[2] as f32;

            // Standard RGB to grayscale conversion
            let gray = (0.299 * r + 0.587 * g + 0.114 * b) as u8;
            Luma([gray])
        });

        Ok(gray_image)
    }
}

impl FeatureDescriptor {
    /// Compute Hamming distance between two binary descriptors
    pub fn hamming_distance(&self, other: &Self) -> Option<u32> {
        match (self, other) {
            (FeatureDescriptor::Binary(a), FeatureDescriptor::Binary(b)) => {
                if a.len() != b.len() {
                    return None;
                }

                let distance: u32 = a
                    .iter()
                    .zip(b.iter())
                    .map(|(byte_a, byte_b)| (byte_a ^ byte_b).count_ones())
                    .sum();

                Some(distance)
            }
            _ => None,
        }
    }

    /// Compute Euclidean distance between two float descriptors
    pub fn euclidean_distance(&self, other: &Self) -> Option<f32> {
        match (self, other) {
            (FeatureDescriptor::Float(a), FeatureDescriptor::Float(b)) => {
                if a.len() != b.len() {
                    return None;
                }

                let distance_sq: f32 = a
                    .iter()
                    .zip(b.iter())
                    .map(|(val_a, val_b)| {
                        let diff = val_a - val_b;
                        diff * diff
                    })
                    .sum();

                Some(distance_sq.sqrt())
            }
            _ => None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hamming_distance() {
        let desc1 = FeatureDescriptor::Binary(vec![0b10101010, 0b11110000]);
        let desc2 = FeatureDescriptor::Binary(vec![0b10101011, 0b11110001]);

        let distance = desc1.hamming_distance(&desc2).unwrap();
        assert_eq!(distance, 2); // 2 bits different
    }

    #[test]
    fn test_euclidean_distance() {
        let desc1 = FeatureDescriptor::Float(vec![1.0, 2.0, 3.0]);
        let desc2 = FeatureDescriptor::Float(vec![1.0, 2.0, 6.0]);

        let distance = desc1.euclidean_distance(&desc2).unwrap();
        assert!((distance - 3.0).abs() < 0.001); // sqrt((6-3)^2) = 3
    }
}
