//! 3D Reconstruction Module
//!
//! Triangulates 3D points from feature matches and camera poses.

use anyhow::{Context, Result};
use nalgebra::{Matrix4, Point3, Vector3, Vector4};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

use super::{CameraPose, FeatureMatches};
use k_os_gpu_pipeline::device::GpuComputeDevice as GpuCompute;

const DEFAULT_REPROJECTION_ERROR_THRESHOLD_PX: f32 = 2.5;

/// Point cloud generator
pub struct PointCloudGenerator {
    _gpu_compute: Arc<GpuCompute>,
}

/// 3D point cloud with colors and normals
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PointCloud {
    /// 3D point positions
    pub points: Vec<Point3<f32>>,
    /// Point colors (RGB)
    pub colors: Vec<Vector3<f32>>,
    /// Point normals
    pub normals: Vec<Vector3<f32>>,
}

impl PointCloudGenerator {
    /// Create a new point cloud generator
    pub fn new(gpu_compute: Arc<GpuCompute>) -> Self {
        Self {
            _gpu_compute: gpu_compute,
        }
    }

    /// Triangulate 3D points from feature matches and camera poses
    pub fn triangulate(
        &self,
        matches: &FeatureMatches,
        poses: &[CameraPose],
    ) -> Result<PointCloud> {
        log::info!(
            "Triangulating 3D points from {} image pairs",
            matches.pair_matches.len()
        );

        let mut points = Vec::new();

        for pair in &matches.pair_matches {
            let pose_a = poses.get(pair.image_a).with_context(|| {
                format!(
                    "Missing camera pose for image {} required by match pair {}-{}",
                    pair.image_a, pair.image_a, pair.image_b
                )
            })?;
            let pose_b = poses.get(pair.image_b).with_context(|| {
                format!(
                    "Missing camera pose for image {} required by match pair {}-{}",
                    pair.image_b, pair.image_a, pair.image_b
                )
            })?;

            let projection_a = projection_for_pose(pose_a);
            let projection_b = projection_for_pose(pose_b);

            for feature_match in &pair.matches {
                let point_3d = triangulate_dlt(
                    &projection_a,
                    &projection_b,
                    feature_match.point_a,
                    feature_match.point_b,
                )?;

                let reproj_a = reprojection_error(&projection_a, point_3d, feature_match.point_a)?;
                let reproj_b = reprojection_error(&projection_b, point_3d, feature_match.point_b)?;
                let avg_error = 0.5 * (reproj_a + reproj_b);

                if avg_error <= DEFAULT_REPROJECTION_ERROR_THRESHOLD_PX {
                    points.push(point_3d);
                }
            }
        }

        let colors = vec![Vector3::new(0.8, 0.8, 0.8); points.len()];
        let normals = vec![Vector3::new(0.0, 1.0, 0.0); points.len()];

        log::info!(
            "Generated point cloud with {} triangulated points",
            points.len()
        );

        Ok(PointCloud {
            points,
            colors,
            normals,
        })
    }
}

fn projection_for_pose(pose: &CameraPose) -> Matrix4<f32> {
    pose.projection_matrix * pose.view_matrix
}

fn triangulate_dlt(
    projection_a: &Matrix4<f32>,
    projection_b: &Matrix4<f32>,
    point_a: [f32; 2],
    point_b: [f32; 2],
) -> Result<Point3<f32>> {
    let mut a = Matrix4::<f32>::zeros();

    for col in 0..4 {
        a[(0, col)] = point_a[0] * projection_a[(2, col)] - projection_a[(0, col)];
        a[(1, col)] = point_a[1] * projection_a[(2, col)] - projection_a[(1, col)];
        a[(2, col)] = point_b[0] * projection_b[(2, col)] - projection_b[(0, col)];
        a[(3, col)] = point_b[1] * projection_b[(2, col)] - projection_b[(1, col)];
    }

    let svd = a.svd(true, true);
    let v_t = svd
        .v_t
        .context("SVD decomposition did not produce V^T for DLT triangulation")?;

    let h = v_t.row(3);
    let w = h[3];
    if !w.is_finite() || w.abs() < 1e-6 {
        anyhow::bail!("DLT triangulation produced invalid homogeneous coordinate");
    }

    Ok(Point3::new(h[0] / w, h[1] / w, h[2] / w))
}

fn reprojection_error(
    projection: &Matrix4<f32>,
    point: Point3<f32>,
    observation: [f32; 2],
) -> Result<f32> {
    let homogeneous_point = Vector4::new(point.x, point.y, point.z, 1.0);
    let projected = projection * homogeneous_point;
    if !projected[2].is_finite() || projected[2].abs() < 1e-6 {
        anyhow::bail!("Cannot project triangulated point with near-zero depth");
    }

    let x = projected[0] / projected[2];
    let y = projected[1] / projected[2];
    let dx = x - observation[0];
    let dy = y - observation[1];
    Ok((dx * dx + dy * dy).sqrt())
}

#[cfg(test)]
mod tests {
    use super::super::feature_matching::{FeatureMatch, FeatureMatches, ImagePairMatches};
    use super::*;
    use nalgebra::UnitQuaternion;

    #[test]
    fn test_point_cloud_creation() {
        let points = vec![Point3::new(0.0, 0.0, 0.0)];
        let colors = vec![Vector3::new(1.0, 1.0, 1.0)];
        let normals = vec![Vector3::new(0.0, 1.0, 0.0)];

        let cloud = PointCloud {
            points,
            colors,
            normals,
        };
        assert_eq!(cloud.points.len(), 1);
    }

    fn test_pose(translation_x: f32) -> CameraPose {
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
    fn triangulate_dlt_recovers_fixture_point() {
        let projection_a = projection_for_pose(&test_pose(0.0));
        let projection_b = projection_for_pose(&test_pose(1.0));
        let true_point = Point3::new(2.0, 3.0, 10.0);

        let obs_a = [200.0, 300.0];
        let obs_b = [100.0, 300.0];

        let estimated = triangulate_dlt(&projection_a, &projection_b, obs_a, obs_b).unwrap();
        let error = (estimated - true_point).norm();
        assert!(error < 1e-3, "expected <1e-3, got {error}");
    }

    #[test]
    fn triangulate_filters_high_reprojection_error_matches() {
        let generator = PointCloudGenerator {
            _gpu_compute: Arc::new(GpuCompute::new_mock()),
        };
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
                        point_a: [200.0, 300.0],
                        point_b: [700.0, -400.0],
                        distance: 0.1,
                    },
                ],
            }],
        };
        let poses = vec![test_pose(0.0), test_pose(1.0)];

        let cloud = generator.triangulate(&matches, &poses).unwrap();
        assert_eq!(cloud.points.len(), 1);
    }
}
