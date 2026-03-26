//! Photogrammetry Pipeline
//!
//! Multi-angle photo reconstruction system for 3D capture and PBR material generation.
//! Supports 2-500 input images with GPU-accelerated processing.

use anyhow::{Context, Result};
use nalgebra::{Matrix4, Point3, UnitQuaternion};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

use k_os_gpu_pipeline::device::GpuComputeDevice as GpuCompute;

pub mod feature_detection;
pub mod feature_matching;
pub mod mesh_generation;
pub mod pbr_extraction;
pub mod reconstruction;
pub mod texture_projection;

// Re-exports
pub use feature_detection::{FeatureDescriptor, FeatureDetector, FeatureSet};
pub use feature_matching::{CameraPoseEstimator, FeatureMatcher, FeatureMatches};
pub use mesh_generation::{
    MeshGenerationConfig, MeshGenerationStrategy, MeshGenerator, SparseCloudFallback, TriangleMesh,
};
pub use pbr_extraction::{
    PBRExtractor, PBRMapKind, PBRMapValidationContract, PBRMaps, TextureValidationRule,
};
pub use reconstruction::{PointCloud, PointCloudGenerator};
pub use texture_projection::{TextureAtlas, TextureProjector};

const MIN_INPUT_IMAGES: usize = 2;
const MAX_INPUT_IMAGES: usize = 500;
const MAX_TEXTURE_RESOLUTION: u32 = 16_384;

/// Photogrammetry pipeline for 3D reconstruction from multi-angle photos
pub struct PhotogrammetryPipeline {
    _gpu_compute: Arc<GpuCompute>,
    feature_detector: FeatureDetector,
    feature_matcher: FeatureMatcher,
    point_cloud_generator: PointCloudGenerator,
    mesh_generator: MeshGenerator,
    texture_projector: TextureProjector,
    pbr_extractor: PBRExtractor,
}

/// Input data for photogrammetry reconstruction
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PhotogrammetryInput {
    /// Input images with metadata
    pub images: Vec<ImageData>,
    /// Optional camera intrinsics (focal length, principal point, distortion)
    pub camera_intrinsics: Option<CameraIntrinsics>,
    /// Processing options
    pub options: ReconstructionOptions,
}

/// Image data with metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImageData {
    /// Image pixels (RGBA8)
    pub pixels: Vec<u8>,
    /// Image width
    pub width: u32,
    /// Image height
    pub height: u32,
    /// Optional image name/path
    pub name: Option<String>,
}

/// Camera intrinsic parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CameraIntrinsics {
    /// Focal length in pixels
    pub focal_length: f32,
    /// Principal point (image center offset)
    pub principal_point: (f32, f32),
    /// Radial distortion coefficients [k1, k2, k3]
    pub distortion: Vec<f32>,
}

/// Reconstruction processing options
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReconstructionOptions {
    /// Use GPU acceleration where available
    pub use_gpu: bool,
    /// Maximum number of features to detect per image
    pub max_features: usize,
    /// Minimum number of feature matches required
    pub min_matches: usize,
    /// Mesh generation quality (0.0-1.0)
    pub mesh_quality: f32,
    /// Texture atlas resolution
    pub texture_resolution: u32,
}

impl Default for ReconstructionOptions {
    fn default() -> Self {
        Self {
            use_gpu: true,
            max_features: 10000,
            min_matches: 50,
            mesh_quality: 0.8,
            texture_resolution: 4096,
        }
    }
}

/// Output from photogrammetry reconstruction
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PhotogrammetryOutput {
    /// Reconstructed point cloud
    pub point_cloud: PointCloud,
    /// Generated triangle mesh
    pub mesh: TriangleMesh,
    /// Estimated camera poses for each input image
    pub camera_poses: Vec<CameraPose>,
    /// Texture atlas
    pub texture_atlas: TextureAtlas,
    /// Extracted PBR maps
    pub pbr_maps: PBRMaps,
}

/// Camera pose (position and orientation)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CameraPose {
    /// Camera position in world space
    pub position: Point3<f32>,
    /// Camera orientation (quaternion)
    pub rotation: UnitQuaternion<f32>,
    /// View matrix (derived)
    #[serde(skip)]
    pub view_matrix: Matrix4<f32>,
    /// Projection matrix (derived)
    #[serde(skip)]
    pub projection_matrix: Matrix4<f32>,
}

impl CameraPose {
    /// Create a new camera pose
    pub fn new(position: Point3<f32>, rotation: UnitQuaternion<f32>) -> Self {
        let view_matrix = Self::compute_view_matrix(&position, &rotation);
        let projection_matrix = Matrix4::identity(); // Will be set based on intrinsics

        Self {
            position,
            rotation,
            view_matrix,
            projection_matrix,
        }
    }

    /// Compute view matrix from position and rotation
    fn compute_view_matrix(position: &Point3<f32>, rotation: &UnitQuaternion<f32>) -> Matrix4<f32> {
        let rotation_matrix = rotation.to_rotation_matrix();
        let mut view = Matrix4::identity();

        // Set rotation part
        for i in 0..3 {
            for j in 0..3 {
                view[(i, j)] = rotation_matrix[(i, j)];
            }
        }

        // Set translation part
        let translation = rotation_matrix.matrix() * (-position.coords);
        view[(0, 3)] = translation.x;
        view[(1, 3)] = translation.y;
        view[(2, 3)] = translation.z;

        view
    }
}

impl PhotogrammetryPipeline {
    /// Create a new photogrammetry pipeline
    pub fn new(gpu_compute: Arc<GpuCompute>) -> Result<Self> {
        Ok(Self {
            feature_detector: FeatureDetector::new(gpu_compute.clone())?,
            feature_matcher: FeatureMatcher::new(),
            point_cloud_generator: PointCloudGenerator::new(gpu_compute.clone()),
            mesh_generator: MeshGenerator::new(gpu_compute.clone()),
            texture_projector: TextureProjector::new(gpu_compute.clone())?,
            pbr_extractor: PBRExtractor::new(gpu_compute.clone())?,
            _gpu_compute: gpu_compute,
        })
    }

    /// Reconstruct 3D model from multi-angle photos
    pub fn reconstruct(&self, input: PhotogrammetryInput) -> Result<PhotogrammetryOutput> {
        Self::validate_input(&input)?;

        log::info!(
            "Starting photogrammetry reconstruction with {} images",
            input.images.len()
        );

        // Step 1: Extract features from all images
        log::info!("Step 1/6: Extracting features...");
        let features = self
            .extract_features(&input.images, &input.options)
            .context("Failed to extract features")?;

        // Step 2: Match features between image pairs
        log::info!("Step 2/6: Matching features...");
        let matches = self
            .match_features(&features, &input.options)
            .context("Failed to match features")?;

        // Step 3: Estimate camera poses
        log::info!("Step 3/6: Estimating camera poses...");
        let camera_poses = self
            .estimate_camera_poses(&matches, &input.camera_intrinsics)
            .context("Failed to estimate camera poses")?;

        // Step 4: Triangulate 3D points
        log::info!("Step 4/6: Generating point cloud...");
        let point_cloud = self
            .triangulate_points(&matches, &camera_poses)
            .context("Failed to triangulate points")?;

        // Step 5: Generate mesh from point cloud
        log::info!("Step 5/6: Generating mesh...");
        let mesh = self
            .generate_mesh(&point_cloud, &input.options)
            .context("Failed to generate mesh")?;

        // Step 6: Project textures onto mesh
        log::info!("Step 6/6: Projecting textures...");
        let texture_atlas = self
            .project_textures(&mesh, &input.images, &camera_poses, &input.options)
            .context("Failed to project textures")?;

        // Step 7: Extract PBR maps
        log::info!("Extracting PBR maps...");
        let pbr_maps = self
            .extract_pbr_maps(&mesh, &texture_atlas)
            .context("Failed to extract PBR maps")?;

        log::info!("Photogrammetry reconstruction complete!");

        Ok(PhotogrammetryOutput {
            point_cloud,
            mesh,
            camera_poses,
            texture_atlas,
            pbr_maps,
        })
    }

    fn validate_input(input: &PhotogrammetryInput) -> Result<()> {
        let image_count = input.images.len();
        if image_count < MIN_INPUT_IMAGES {
            anyhow::bail!("Photogrammetry requires at least {MIN_INPUT_IMAGES} input images");
        }
        if image_count > MAX_INPUT_IMAGES {
            anyhow::bail!("Photogrammetry supports maximum {MAX_INPUT_IMAGES} input images");
        }

        if input.options.max_features == 0 {
            anyhow::bail!("max_features must be greater than 0");
        }
        if input.options.min_matches == 0 {
            anyhow::bail!("min_matches must be greater than 0");
        }
        if !input.options.mesh_quality.is_finite()
            || !(0.0..=1.0).contains(&input.options.mesh_quality)
        {
            anyhow::bail!("mesh_quality must be a finite value between 0.0 and 1.0");
        }
        if input.options.texture_resolution == 0
            || input.options.texture_resolution > MAX_TEXTURE_RESOLUTION
        {
            anyhow::bail!("texture_resolution must be between 1 and {MAX_TEXTURE_RESOLUTION}");
        }

        for (idx, image) in input.images.iter().enumerate() {
            if image.width == 0 || image.height == 0 {
                anyhow::bail!(
                    "Image at index {idx} has invalid dimensions {}x{}",
                    image.width,
                    image.height
                );
            }

            let expected_pixels = image
                .width
                .checked_mul(image.height)
                .and_then(|px| px.checked_mul(4))
                .context("Image dimensions overflow pixel capacity computation")?
                as usize;

            if image.pixels.len() != expected_pixels {
                anyhow::bail!(
                    "Image at index {idx} has invalid RGBA pixel data length: expected {expected_pixels}, got {}",
                    image.pixels.len()
                );
            }
        }

        if let Some(intrinsics) = &input.camera_intrinsics {
            if !intrinsics.focal_length.is_finite() || intrinsics.focal_length <= 0.0 {
                anyhow::bail!("camera_intrinsics.focal_length must be finite and > 0");
            }
            if !intrinsics.principal_point.0.is_finite()
                || !intrinsics.principal_point.1.is_finite()
            {
                anyhow::bail!("camera_intrinsics.principal_point values must be finite");
            }
            if intrinsics.distortion.len() > 8 {
                anyhow::bail!("camera_intrinsics.distortion supports at most 8 coefficients");
            }
            if intrinsics.distortion.iter().any(|k| !k.is_finite()) {
                anyhow::bail!("camera_intrinsics.distortion contains non-finite coefficients");
            }
        }

        Ok(())
    }

    /// Extract features from all input images
    fn extract_features(
        &self,
        images: &[ImageData],
        options: &ReconstructionOptions,
    ) -> Result<Vec<FeatureSet>> {
        self.feature_detector
            .detect_batch(images, options.max_features)
    }

    /// Match features between image pairs
    fn match_features(
        &self,
        features: &[FeatureSet],
        options: &ReconstructionOptions,
    ) -> Result<FeatureMatches> {
        self.feature_matcher
            .match_features(features, options.min_matches)
    }

    /// Estimate camera poses from feature matches
    fn estimate_camera_poses(
        &self,
        matches: &FeatureMatches,
        intrinsics: &Option<CameraIntrinsics>,
    ) -> Result<Vec<CameraPose>> {
        let estimator = CameraPoseEstimator::new(intrinsics.clone());
        estimator.estimate_poses(matches)
    }

    /// Triangulate 3D points from feature matches and camera poses
    fn triangulate_points(
        &self,
        matches: &FeatureMatches,
        poses: &[CameraPose],
    ) -> Result<PointCloud> {
        self.point_cloud_generator.triangulate(matches, poses)
    }

    /// Generate triangle mesh from point cloud
    fn generate_mesh(
        &self,
        point_cloud: &PointCloud,
        options: &ReconstructionOptions,
    ) -> Result<TriangleMesh> {
        self.mesh_generator
            .generate(point_cloud, options.mesh_quality)
    }

    /// Project textures from source images onto mesh
    fn project_textures(
        &self,
        mesh: &TriangleMesh,
        images: &[ImageData],
        poses: &[CameraPose],
        options: &ReconstructionOptions,
    ) -> Result<TextureAtlas> {
        self.texture_projector
            .project(mesh, images, poses, options.texture_resolution)
    }

    /// Extract PBR maps from textured mesh
    fn extract_pbr_maps(&self, mesh: &TriangleMesh, texture: &TextureAtlas) -> Result<PBRMaps> {
        self.pbr_extractor.extract(mesh, texture)
    }
}

#[cfg(test)]
mod tests {
    use super::feature_matching::{FeatureMatch, FeatureMatches, ImagePairMatches};
    use super::*;
    use nalgebra::Matrix4;

    fn sample_image() -> ImageData {
        ImageData {
            pixels: vec![255u8; 4 * 4 * 4],
            width: 4,
            height: 4,
            name: Some("sample".to_string()),
        }
    }

    fn sample_input() -> PhotogrammetryInput {
        PhotogrammetryInput {
            images: vec![sample_image(), sample_image()],
            camera_intrinsics: None,
            options: ReconstructionOptions::default(),
        }
    }

    #[test]
    fn test_reconstruction_options_default() {
        let options = ReconstructionOptions::default();
        assert!(options.use_gpu);
        assert_eq!(options.max_features, 10000);
        assert_eq!(options.min_matches, 50);
        assert_eq!(options.mesh_quality, 0.8);
        assert_eq!(options.texture_resolution, 4096);
    }

    #[test]
    fn test_camera_pose_creation() {
        let position = Point3::new(0.0, 0.0, 5.0);
        let rotation = UnitQuaternion::identity();
        let pose = CameraPose::new(position, rotation);

        assert_eq!(pose.position, position);
        assert_eq!(pose.rotation, rotation);
    }

    #[test]
    fn test_validate_input_accepts_valid_input() {
        let input = sample_input();
        assert!(PhotogrammetryPipeline::validate_input(&input).is_ok());
    }

    #[test]
    fn test_validate_input_rejects_invalid_image_pixel_length() {
        let mut input = sample_input();
        input.images[0].pixels = vec![0u8; 3];

        let err = PhotogrammetryPipeline::validate_input(&input).unwrap_err();
        assert!(err.to_string().contains("invalid RGBA pixel data length"));
    }

    #[test]
    fn test_validate_input_rejects_invalid_texture_resolution() {
        let mut input = sample_input();
        input.options.texture_resolution = 0;

        let err = PhotogrammetryPipeline::validate_input(&input).unwrap_err();
        assert!(err.to_string().contains("texture_resolution"));
    }

    fn fixture_pose(translation_x: f32) -> CameraPose {
        let mut pose = CameraPose::new(
            Point3::new(translation_x, 0.0, 0.0),
            UnitQuaternion::identity(),
        );
        pose.projection_matrix = Matrix4::new(
            1000.0, 0.0, 0.0, 0.0, 0.0, 1000.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0,
        );
        pose
    }

    #[test]
    fn test_smoke_non_placeholder_pointcloud_mesh_and_atlas() {
        let poses = vec![fixture_pose(0.0), fixture_pose(1.0)];
        let matches = FeatureMatches {
            pair_matches: vec![ImagePairMatches {
                image_a: 0,
                image_b: 1,
                matches: vec![
                    FeatureMatch {
                        keypoint_a: 0,
                        keypoint_b: 0,
                        point_a: [200.0, 300.0],
                        point_b: [100.0, 300.0],
                        distance: 0.1,
                    },
                    FeatureMatch {
                        keypoint_a: 1,
                        keypoint_b: 1,
                        point_a: [125.0, 125.0],
                        point_b: [0.0, 125.0],
                        distance: 0.1,
                    },
                    FeatureMatch {
                        keypoint_a: 2,
                        keypoint_b: 2,
                        point_a: [250.0, 166.66667],
                        point_b: [166.66667, 166.66667],
                        distance: 0.1,
                    },
                ],
            }],
        };

        let point_cloud = PointCloudGenerator::new(Arc::new(GpuCompute::new_mock()))
            .triangulate(&matches, &poses)
            .unwrap();
        assert_eq!(point_cloud.points.len(), 3);

        let mesh = MeshGenerator::new(Arc::new(GpuCompute::new_mock()))
            .generate(&point_cloud, 1.0)
            .unwrap();
        assert_eq!(mesh.vertices.len(), 3);
        assert_eq!(mesh.vertices[0], point_cloud.points[0]);
        assert_eq!(mesh.indices.len(), 3);

        let image_a = ImageData {
            pixels: vec![
                255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 0, 255,
            ],
            width: 2,
            height: 2,
            name: Some("fixture-a".to_string()),
        };
        let image_b = ImageData {
            pixels: vec![
                0, 255, 255, 255, 255, 0, 255, 255, 255, 128, 0, 255, 64, 64, 64, 255,
            ],
            width: 2,
            height: 2,
            name: Some("fixture-b".to_string()),
        };
        let atlas = TextureProjector::new(Arc::new(GpuCompute::new_mock()))
            .unwrap()
            .project(&mesh, &[image_a, image_b], &poses, 2)
            .unwrap();
        assert_eq!(atlas.width, 2);
        assert_eq!(atlas.height, 2);
        assert_eq!(atlas.pixels.len(), 16);
        let unique_rgbs = atlas
            .pixels
            .chunks_exact(4)
            .map(|px| (px[0], px[1], px[2]))
            .collect::<std::collections::BTreeSet<_>>();
        assert!(
            unique_rgbs.len() > 1,
            "expected non-uniform atlas output from source imagery"
        );
    }
}
