//! Texture Projection Module
//!
//! Projects source images onto mesh surface and generates texture atlas.

use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

use super::{CameraPose, ImageData, TriangleMesh};
use k_os_gpu_pipeline::device::GpuComputeDevice as GpuCompute;
use nalgebra::Vector3;

/// Texture projector
pub struct TextureProjector {
    _gpu_compute: Arc<GpuCompute>,
}

/// Texture atlas
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TextureAtlas {
    /// Texture pixels (RGBA8)
    pub pixels: Vec<u8>,
    /// Texture width
    pub width: u32,
    /// Texture height
    pub height: u32,
}

impl TextureProjector {
    /// Create a new texture projector
    pub fn new(gpu_compute: Arc<GpuCompute>) -> Result<Self> {
        Ok(Self {
            _gpu_compute: gpu_compute,
        })
    }

    /// Project textures from source images onto mesh
    pub fn project(
        &self,
        mesh: &TriangleMesh,
        images: &[ImageData],
        poses: &[CameraPose],
        resolution: u32,
    ) -> Result<TextureAtlas> {
        log::info!(
            "Projecting {} images onto mesh (resolution: {}x{})",
            images.len(),
            resolution,
            resolution
        );

        anyhow::ensure!(
            !images.is_empty(),
            "Texture projection requires at least one source image"
        );
        anyhow::ensure!(
            poses.is_empty() || poses.len() == images.len(),
            "Camera pose count must match image count when provided"
        );

        let blend_weights = Self::compute_blend_weights(mesh, poses, images.len());
        let pixels = Self::build_blended_atlas(images, resolution, &blend_weights)?;

        log::info!("Generated texture atlas {}x{}", resolution, resolution);

        Ok(TextureAtlas {
            pixels,
            width: resolution,
            height: resolution,
        })
    }

    fn compute_blend_weights(
        mesh: &TriangleMesh,
        poses: &[CameraPose],
        image_count: usize,
    ) -> Vec<f32> {
        if image_count == 0 {
            return Vec::new();
        }
        if poses.len() != image_count {
            return vec![1.0; image_count];
        }

        let centroid = mesh
            .vertices
            .iter()
            .fold(Vector3::new(0.0, 0.0, 0.0), |acc, v| acc + v.coords)
            / (mesh.vertices.len().max(1) as f32);
        let avg_normal = if !mesh.normals.is_empty() {
            let n = mesh
                .normals
                .iter()
                .fold(Vector3::new(0.0, 0.0, 0.0), |acc, normal| acc + *normal);
            if n.norm_squared() > 1e-6 {
                n.normalize()
            } else {
                Vector3::new(0.0, 0.0, 1.0)
            }
        } else {
            Vector3::new(0.0, 0.0, 1.0)
        };

        let mut weights = Vec::with_capacity(image_count);
        for pose in poses.iter().take(image_count) {
            let to_surface = centroid - pose.position.coords;
            let distance = to_surface.norm().max(1e-3);
            let view_dir = to_surface / distance;
            let facing = avg_normal.dot(&view_dir).max(0.0);
            let weight = facing * (1.0 / distance);
            weights.push(weight.max(0.0));
        }

        let weight_sum: f32 = weights.iter().sum();
        if weight_sum <= 1e-6 {
            vec![1.0; image_count]
        } else {
            weights
        }
    }

    fn build_blended_atlas(
        images: &[ImageData],
        resolution: u32,
        blend_weights: &[f32],
    ) -> Result<Vec<u8>> {
        let atlas_len = resolution
            .checked_mul(resolution)
            .and_then(|px| px.checked_mul(4))
            .context("Texture atlas dimensions overflow")? as usize;
        let mut pixels = vec![0u8; atlas_len];
        anyhow::ensure!(
            blend_weights.len() == images.len(),
            "Blend weight count mismatch: expected {}, got {}",
            images.len(),
            blend_weights.len()
        );

        for image in images {
            let expected_len = image
                .width
                .checked_mul(image.height)
                .and_then(|px| px.checked_mul(4))
                .context("Image dimensions overflow during texture projection")?
                as usize;
            anyhow::ensure!(
                image.pixels.len() == expected_len,
                "Image '{}' pixel length mismatch: expected {}, got {}",
                image.name.as_deref().unwrap_or("<unnamed>"),
                expected_len,
                image.pixels.len()
            );
        }

        let total_weight: f32 = blend_weights.iter().sum();
        anyhow::ensure!(
            total_weight > 1e-6,
            "Total blend weight must be greater than zero"
        );

        for y in 0..resolution {
            for x in 0..resolution {
                let dst = ((y * resolution + x) * 4) as usize;
                let mut r_acc: f32 = 0.0;
                let mut g_acc: f32 = 0.0;
                let mut b_acc: f32 = 0.0;

                for (image, weight) in images.iter().zip(blend_weights.iter().copied()) {
                    let src_x = if resolution > 1 {
                        x.saturating_mul(image.width.saturating_sub(1)) / (resolution - 1)
                    } else {
                        0
                    };
                    let src_y = if resolution > 1 {
                        y.saturating_mul(image.height.saturating_sub(1)) / (resolution - 1)
                    } else {
                        0
                    };
                    let src = ((src_y * image.width + src_x) * 4) as usize;
                    r_acc += image.pixels[src] as f32 * weight;
                    g_acc += image.pixels[src + 1] as f32 * weight;
                    b_acc += image.pixels[src + 2] as f32 * weight;
                }

                pixels[dst] = (r_acc / total_weight).round().clamp(0.0, 255.0) as u8;
                pixels[dst + 1] = (g_acc / total_weight).round().clamp(0.0, 255.0) as u8;
                pixels[dst + 2] = (b_acc / total_weight).round().clamp(0.0, 255.0) as u8;
                pixels[dst + 3] = 255;
            }
        }

        Ok(pixels)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_texture_atlas_creation() {
        let atlas = TextureAtlas {
            pixels: vec![255u8; 256 * 256 * 4],
            width: 256,
            height: 256,
        };

        assert_eq!(atlas.width, 256);
        assert_eq!(atlas.height, 256);
        assert_eq!(atlas.pixels.len(), 256 * 256 * 4);
    }

    #[test]
    fn test_blended_atlas_averages_source_images() {
        let image_a = ImageData {
            pixels: vec![
                255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255,
            ],
            width: 2,
            height: 2,
            name: Some("red".to_string()),
        };
        let image_b = ImageData {
            pixels: vec![
                0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255,
            ],
            width: 2,
            height: 2,
            name: Some("blue".to_string()),
        };

        let atlas =
            TextureProjector::build_blended_atlas(&[image_a, image_b], 2, &[1.0, 1.0]).unwrap();

        for chunk in atlas.chunks_exact(4) {
            assert_eq!(chunk[0], 128);
            assert_eq!(chunk[1], 0);
            assert_eq!(chunk[2], 128);
            assert_eq!(chunk[3], 255);
        }
    }

    #[test]
    fn test_blended_atlas_rejects_invalid_source_image_length() {
        let bad_image = ImageData {
            pixels: vec![0u8; 3],
            width: 1,
            height: 1,
            name: Some("bad".to_string()),
        };

        let err = TextureProjector::build_blended_atlas(&[bad_image], 4, &[1.0]).unwrap_err();
        assert!(err.to_string().contains("pixel length mismatch"));
    }

    #[test]
    fn test_blended_atlas_respects_pose_weights() {
        let mesh = TriangleMesh {
            vertices: vec![
                nalgebra::Point3::new(0.0, 0.0, 0.0),
                nalgebra::Point3::new(1.0, 0.0, 0.0),
                nalgebra::Point3::new(0.0, 1.0, 0.0),
            ],
            normals: vec![Vector3::new(0.0, 0.0, 1.0); 3],
            uvs: vec![nalgebra::Point2::new(0.0, 0.0); 3],
            indices: vec![0, 1, 2],
        };
        let pose_front = CameraPose::new(
            nalgebra::Point3::new(0.0, 0.0, -1.0),
            nalgebra::UnitQuaternion::identity(),
        );
        let pose_back = CameraPose::new(
            nalgebra::Point3::new(0.0, 0.0, 1.0),
            nalgebra::UnitQuaternion::identity(),
        );

        let weights = TextureProjector::compute_blend_weights(&mesh, &[pose_front, pose_back], 2);
        assert!(weights[0] > weights[1]);

        let image_front = ImageData {
            pixels: vec![255, 0, 0, 255],
            width: 1,
            height: 1,
            name: Some("front".to_string()),
        };
        let image_back = ImageData {
            pixels: vec![0, 0, 255, 255],
            width: 1,
            height: 1,
            name: Some("back".to_string()),
        };
        let atlas =
            TextureProjector::build_blended_atlas(&[image_front, image_back], 1, &weights).unwrap();
        assert!(
            atlas[0] > atlas[2],
            "expected front-facing image contribution to dominate"
        );
    }
}
