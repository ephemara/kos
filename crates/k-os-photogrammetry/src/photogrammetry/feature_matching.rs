//! Feature Matching Module
//!
//! Matches features between image pairs using nearest neighbor search and RANSAC.
//! Estimates camera poses from feature correspondences.

use anyhow::{Context, Result};
use nalgebra::{DMatrix, Matrix3, Matrix4, Point3, Rotation3, UnitQuaternion, Vector3};
use serde::{Deserialize, Serialize};

use super::feature_detection::Keypoint;
use super::{CameraIntrinsics, CameraPose, FeatureDescriptor, FeatureSet};

/// Feature matcher for finding correspondences between images
pub struct FeatureMatcher {
    /// Ratio test threshold (Lowe's ratio test)
    ratio_threshold: f32,
}

/// Feature matches between image pairs
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FeatureMatches {
    /// Matches for each image pair
    pub pair_matches: Vec<ImagePairMatches>,
}

/// Matches between a pair of images
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImagePairMatches {
    /// Index of first image
    pub image_a: usize,
    /// Index of second image
    pub image_b: usize,
    /// Feature correspondences
    pub matches: Vec<FeatureMatch>,
}

/// A single feature match between two images
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct FeatureMatch {
    /// Keypoint index in image A
    pub keypoint_a: usize,
    /// Keypoint index in image B
    pub keypoint_b: usize,
    /// Matched 2D point in image A (pixel coordinates)
    pub point_a: [f32; 2],
    /// Matched 2D point in image B (pixel coordinates)
    pub point_b: [f32; 2],
    /// Match distance/score
    pub distance: f32,
}

impl FeatureMatcher {
    /// Create a new feature matcher
    pub fn new() -> Self {
        Self {
            ratio_threshold: 0.8, // Lowe's ratio test threshold
        }
    }

    /// Match features across all image pairs
    pub fn match_features(
        &self,
        feature_sets: &[FeatureSet],
        min_matches: usize,
    ) -> Result<FeatureMatches> {
        log::info!("Matching features across {} images", feature_sets.len());

        let mut pair_matches = Vec::new();

        // Match each image pair
        for i in 0..feature_sets.len() {
            for j in (i + 1)..feature_sets.len() {
                let matches = self.match_pair(&feature_sets[i], &feature_sets[j])?;

                if matches.len() >= min_matches {
                    log::debug!("Images {}-{}: {} matches", i, j, matches.len());

                    pair_matches.push(ImagePairMatches {
                        image_a: i,
                        image_b: j,
                        matches,
                    });
                } else {
                    log::warn!(
                        "Images {}-{}: insufficient matches ({} < {})",
                        i,
                        j,
                        matches.len(),
                        min_matches
                    );
                }
            }
        }

        if pair_matches.is_empty() {
            anyhow::bail!("No valid image pairs found with sufficient feature matches");
        }

        log::info!(
            "Found {} valid image pairs with sufficient matches",
            pair_matches.len()
        );

        Ok(FeatureMatches { pair_matches })
    }

    /// Match features between two images
    fn match_pair(
        &self,
        features_a: &FeatureSet,
        features_b: &FeatureSet,
    ) -> Result<Vec<FeatureMatch>> {
        let mut matches = Vec::new();

        // For each feature in image A, find best two matches in image B
        for (idx_a, desc_a) in features_a.descriptors.iter().enumerate() {
            let mut best_distance = f32::MAX;
            let mut second_best_distance = f32::MAX;
            let mut best_idx = None;

            for (idx_b, desc_b) in features_b.descriptors.iter().enumerate() {
                let distance = self.descriptor_distance(desc_a, desc_b)?;

                if distance < best_distance {
                    second_best_distance = best_distance;
                    best_distance = distance;
                    best_idx = Some(idx_b);
                } else if distance < second_best_distance {
                    second_best_distance = distance;
                }
            }

            // Apply Lowe's ratio test
            if let Some(idx_b) = best_idx {
                if best_distance < self.ratio_threshold * second_best_distance {
                    let kp_a = &features_a.keypoints[idx_a];
                    let kp_b = &features_b.keypoints[idx_b];
                    matches.push(FeatureMatch {
                        keypoint_a: idx_a,
                        keypoint_b: idx_b,
                        point_a: [kp_a.x, kp_a.y],
                        point_b: [kp_b.x, kp_b.y],
                        distance: best_distance,
                    });
                }
            }
        }

        // Apply RANSAC to filter outliers
        let inlier_matches =
            self.ransac_filter(&matches, &features_a.keypoints, &features_b.keypoints)?;

        Ok(inlier_matches)
    }

    /// Compute distance between two descriptors
    fn descriptor_distance(
        &self,
        desc_a: &FeatureDescriptor,
        desc_b: &FeatureDescriptor,
    ) -> Result<f32> {
        match (desc_a, desc_b) {
            (FeatureDescriptor::Binary(_), FeatureDescriptor::Binary(_)) => {
                let hamming = desc_a
                    .hamming_distance(desc_b)
                    .context("Failed to compute Hamming distance")?;
                Ok(hamming as f32)
            }
            (FeatureDescriptor::Float(_), FeatureDescriptor::Float(_)) => desc_a
                .euclidean_distance(desc_b)
                .context("Failed to compute Euclidean distance"),
            _ => anyhow::bail!("Descriptor type mismatch"),
        }
    }

    /// Filter matches using RANSAC (Random Sample Consensus)
    fn ransac_filter(
        &self,
        matches: &[FeatureMatch],
        keypoints_a: &[Keypoint],
        keypoints_b: &[Keypoint],
    ) -> Result<Vec<FeatureMatch>> {
        if matches.len() < 8 {
            // Need at least 8 points for fundamental matrix estimation
            return Ok(matches.to_vec());
        }

        let max_iterations = 1000;
        let inlier_threshold = 3.0; // pixels
        let mut best_inliers = Vec::new();

        use rand::{rngs::StdRng, seq::SliceRandom, SeedableRng};
        let mut rng = StdRng::seed_from_u64(42);

        for _ in 0..max_iterations {
            // Sample 8 random matches
            let sample: Vec<_> = matches.choose_multiple(&mut rng, 8).cloned().collect();

            // Estimate fundamental matrix from sample
            if let Ok(fundamental_matrix) = self.estimate_fundamental_matrix(&sample) {
                // Count inliers
                let inliers: Vec<FeatureMatch> = matches
                    .iter()
                    .filter(|m| {
                        let kp_a = &keypoints_a[m.keypoint_a];
                        let kp_b = &keypoints_b[m.keypoint_b];
                        let error = self.epipolar_error(&fundamental_matrix, kp_a, kp_b);
                        error < inlier_threshold
                    })
                    .cloned()
                    .collect();

                if inliers.len() > best_inliers.len() {
                    best_inliers = inliers;
                }
            }
        }

        log::debug!(
            "RANSAC: {} inliers from {} matches",
            best_inliers.len(),
            matches.len()
        );

        Ok(best_inliers)
    }

    /// Estimate fundamental matrix from point correspondences using a normalized 8-point algorithm.
    fn estimate_fundamental_matrix(&self, matches: &[FeatureMatch]) -> Result<Matrix3<f32>> {
        estimate_fundamental_matrix_from_matches(matches)
    }

    /// Compute epipolar error for a point correspondence
    fn epipolar_error(
        &self,
        fundamental_matrix: &Matrix3<f32>,
        kp_a: &Keypoint,
        kp_b: &Keypoint,
    ) -> f32 {
        // Sampson distance approximation for robust RANSAC inlier tests.
        let p_a = Vector3::new(kp_a.x, kp_a.y, 1.0);
        let p_b = Vector3::new(kp_b.x, kp_b.y, 1.0);

        let fpa = fundamental_matrix * p_a;
        let ftpb = fundamental_matrix.transpose() * p_b;
        let numerator = p_b.dot(&fpa).abs();
        let denom = (fpa.x * fpa.x + fpa.y * fpa.y + ftpb.x * ftpb.x + ftpb.y * ftpb.y).sqrt();

        if !denom.is_finite() || denom <= f32::EPSILON {
            return f32::INFINITY;
        }
        numerator / denom
    }
}

fn normalize_points(points: &[[f32; 2]]) -> Result<(Vec<[f32; 2]>, Matrix3<f32>)> {
    if points.is_empty() {
        anyhow::bail!("Cannot normalize empty point set");
    }

    let n = points.len() as f32;
    let centroid_x = points.iter().map(|p| p[0]).sum::<f32>() / n;
    let centroid_y = points.iter().map(|p| p[1]).sum::<f32>() / n;

    let mean_distance = points
        .iter()
        .map(|p| {
            let dx = p[0] - centroid_x;
            let dy = p[1] - centroid_y;
            (dx * dx + dy * dy).sqrt()
        })
        .sum::<f32>()
        / n;
    if !mean_distance.is_finite() || mean_distance <= f32::EPSILON {
        anyhow::bail!("Point normalization failed due to degenerate correspondences");
    }

    let scale = (2.0f32).sqrt() / mean_distance;
    let transform = Matrix3::new(
        scale,
        0.0,
        -scale * centroid_x,
        0.0,
        scale,
        -scale * centroid_y,
        0.0,
        0.0,
        1.0,
    );

    let normalized = points
        .iter()
        .map(|p| {
            let v = transform * Vector3::new(p[0], p[1], 1.0);
            [v.x, v.y]
        })
        .collect();

    Ok((normalized, transform))
}

fn estimate_fundamental_matrix_from_matches(matches: &[FeatureMatch]) -> Result<Matrix3<f32>> {
    if matches.len() < 8 {
        anyhow::bail!("Fundamental matrix estimation requires at least 8 correspondences");
    }

    let points_a: Vec<[f32; 2]> = matches.iter().map(|m| m.point_a).collect();
    let points_b: Vec<[f32; 2]> = matches.iter().map(|m| m.point_b).collect();

    let (norm_a, t_a) = normalize_points(&points_a)?;
    let (norm_b, t_b) = normalize_points(&points_b)?;

    let mut a = DMatrix::<f32>::zeros(matches.len(), 9);
    for (row, (pa, pb)) in norm_a.iter().zip(norm_b.iter()).enumerate() {
        let xa = pa[0];
        let ya = pa[1];
        let xb = pb[0];
        let yb = pb[1];

        a[(row, 0)] = xb * xa;
        a[(row, 1)] = xb * ya;
        a[(row, 2)] = xb;
        a[(row, 3)] = yb * xa;
        a[(row, 4)] = yb * ya;
        a[(row, 5)] = yb;
        a[(row, 6)] = xa;
        a[(row, 7)] = ya;
        a[(row, 8)] = 1.0;
    }

    let svd = a.svd(true, true);
    let v_t = svd
        .v_t
        .context("SVD decomposition did not produce V^T for fundamental matrix estimation")?;
    let f_vec = v_t.row(v_t.nrows() - 1);
    let mut f = Matrix3::new(
        f_vec[0], f_vec[1], f_vec[2], f_vec[3], f_vec[4], f_vec[5], f_vec[6], f_vec[7], f_vec[8],
    );

    // Enforce rank-2 constraint on F.
    let f_svd = f.svd(true, true);
    let u = f_svd.u.context("Fundamental matrix SVD missing U")?;
    let v_t = f_svd.v_t.context("Fundamental matrix SVD missing V^T")?;
    let mut singular_values = f_svd.singular_values;
    singular_values[2] = 0.0;
    let sigma = Matrix3::new(
        singular_values[0],
        0.0,
        0.0,
        0.0,
        singular_values[1],
        0.0,
        0.0,
        0.0,
        singular_values[2],
    );
    f = u * sigma * v_t;

    // Denormalize from normalized coordinate space back to pixel coordinates.
    f = t_b.transpose() * f * t_a;

    let fro_norm = f.norm();
    if !fro_norm.is_finite() || fro_norm <= f32::EPSILON {
        anyhow::bail!("Fundamental matrix normalization failed due to degenerate correspondences");
    }
    Ok(f / fro_norm)
}

fn enforce_essential_constraints(essential: &Matrix3<f32>) -> Result<Matrix3<f32>> {
    let svd = essential.svd(true, true);
    let u = svd.u.context("Essential matrix SVD missing U")?;
    let v_t = svd.v_t.context("Essential matrix SVD missing V^T")?;
    let s0 = svd.singular_values[0];
    let s1 = svd.singular_values[1];
    let mean_s = 0.5 * (s0 + s1);
    if !mean_s.is_finite() || mean_s <= f32::EPSILON {
        anyhow::bail!("Essential matrix singular values are degenerate");
    }

    let sigma = Matrix3::new(mean_s, 0.0, 0.0, 0.0, mean_s, 0.0, 0.0, 0.0, 0.0);
    Ok(u * sigma * v_t)
}

fn decompose_essential_matrix(
    essential: &Matrix3<f32>,
) -> Result<Vec<(Matrix3<f32>, Vector3<f32>)>> {
    let svd = essential.svd(true, true);
    let mut u = svd.u.context("Essential decomposition missing U")?;
    let mut v_t = svd.v_t.context("Essential decomposition missing V^T")?;

    if u.determinant() < 0.0 {
        for row in 0..3 {
            u[(row, 2)] = -u[(row, 2)];
        }
    }
    if v_t.determinant() < 0.0 {
        for col in 0..3 {
            v_t[(2, col)] = -v_t[(2, col)];
        }
    }

    let w = Matrix3::new(0.0, -1.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0);
    let w_t = w.transpose();
    let mut r1 = u * w * v_t;
    let mut r2 = u * w_t * v_t;

    if r1.determinant() < 0.0 {
        r1 = -r1;
    }
    if r2.determinant() < 0.0 {
        r2 = -r2;
    }

    let mut t = u.column(2).into_owned();
    let t_norm = t.norm();
    if !t_norm.is_finite() || t_norm <= f32::EPSILON {
        anyhow::bail!("Essential decomposition produced invalid translation direction");
    }
    t /= t_norm;

    Ok(vec![(r1, t), (r1, -t), (r2, t), (r2, -t)])
}

fn triangulate_normalized_correspondence(
    point_a: [f32; 2],
    point_b: [f32; 2],
    rotation: &Matrix3<f32>,
    translation: &Vector3<f32>,
    k_inv: &Matrix3<f32>,
) -> Option<Point3<f32>> {
    let x_a = k_inv * Vector3::new(point_a[0], point_a[1], 1.0);
    let x_b = k_inv * Vector3::new(point_b[0], point_b[1], 1.0);
    if x_a.z.abs() <= f32::EPSILON || x_b.z.abs() <= f32::EPSILON {
        return None;
    }

    let xa = x_a / x_a.z;
    let xb = x_b / x_b.z;

    let p1 = Matrix4::new(
        1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0,
    );
    let p2 = Matrix4::new(
        rotation[(0, 0)],
        rotation[(0, 1)],
        rotation[(0, 2)],
        translation[0],
        rotation[(1, 0)],
        rotation[(1, 1)],
        rotation[(1, 2)],
        translation[1],
        rotation[(2, 0)],
        rotation[(2, 1)],
        rotation[(2, 2)],
        translation[2],
        0.0,
        0.0,
        0.0,
        1.0,
    );

    let mut a = Matrix4::<f32>::zeros();
    for col in 0..4 {
        a[(0, col)] = xa.x * p1[(2, col)] - p1[(0, col)];
        a[(1, col)] = xa.y * p1[(2, col)] - p1[(1, col)];
        a[(2, col)] = xb.x * p2[(2, col)] - p2[(0, col)];
        a[(3, col)] = xb.y * p2[(2, col)] - p2[(1, col)];
    }

    let svd = a.svd(true, true);
    let v_t = svd.v_t?;
    let h = v_t.row(3);
    let w = h[3];
    if !w.is_finite() || w.abs() < 1e-6 {
        return None;
    }

    Some(Point3::new(h[0] / w, h[1] / w, h[2] / w))
}

/// Camera pose estimator
pub struct CameraPoseEstimator {
    _intrinsics: Option<CameraIntrinsics>,
}

impl CameraPoseEstimator {
    /// Create a new camera pose estimator
    pub fn new(intrinsics: Option<CameraIntrinsics>) -> Self {
        Self {
            _intrinsics: intrinsics,
        }
    }

    /// Estimate camera poses from feature matches
    pub fn estimate_poses(&self, matches: &FeatureMatches) -> Result<Vec<CameraPose>> {
        log::info!(
            "Estimating camera poses from {} image pairs",
            matches.pair_matches.len()
        );

        // Build pose graph
        let num_images = self.count_images(matches);
        let mut poses = vec![None; num_images];

        // Set first camera as origin
        poses[0] = Some(CameraPose::new(
            Point3::new(0.0, 0.0, 0.0),
            UnitQuaternion::identity(),
        ));

        // Estimate relative poses for connected images
        for pair in &matches.pair_matches {
            if poses[pair.image_a].is_some() && poses[pair.image_b].is_none() {
                // Estimate pose of image_b relative to image_a
                if let Some(relative_pose) = self.estimate_relative_pose(pair)? {
                    let base_pose = poses[pair.image_a].as_ref().unwrap();
                    poses[pair.image_b] = Some(self.combine_poses(base_pose, &relative_pose));
                }
            } else if poses[pair.image_b].is_some() && poses[pair.image_a].is_none() {
                // Estimate pose of image_a relative to image_b
                if let Some(relative_pose) = self.estimate_relative_pose(pair)? {
                    let base_pose = poses[pair.image_b].as_ref().unwrap();
                    let inverse_relative = self.invert_pose(&relative_pose);
                    poses[pair.image_a] = Some(self.combine_poses(base_pose, &inverse_relative));
                }
            }
        }

        // Collect valid poses
        let valid_poses: Vec<CameraPose> = poses.into_iter().filter_map(|p| p).collect();

        if valid_poses.is_empty() {
            anyhow::bail!("Failed to estimate any camera poses");
        }

        log::info!("Estimated {} camera poses", valid_poses.len());

        Ok(valid_poses)
    }

    /// Count number of unique images in matches
    fn count_images(&self, matches: &FeatureMatches) -> usize {
        let mut max_index = 0;
        for pair in &matches.pair_matches {
            max_index = max_index.max(pair.image_a).max(pair.image_b);
        }
        max_index + 1
    }

    /// Estimate relative pose between two images using essential matrix decomposition
    fn estimate_relative_pose(&self, pair: &ImagePairMatches) -> Result<Option<CameraPose>> {
        if pair.matches.len() < 8 {
            return Ok(None);
        }

        let fundamental = estimate_fundamental_matrix_from_matches(&pair.matches)?;
        let k = self.calibration_matrix();
        let k_inv = k
            .try_inverse()
            .context("Camera intrinsics matrix is not invertible for relative pose estimation")?;
        let essential = enforce_essential_constraints(&(k.transpose() * fundamental * k))?;
        let candidates = decompose_essential_matrix(&essential)?;

        let mut best_candidate: Option<(Matrix3<f32>, Vector3<f32>)> = None;
        let mut best_cheirality = 0usize;

        for (rotation, translation) in candidates {
            let cheirality = pair
                .matches
                .iter()
                .take(64)
                .filter_map(|m| {
                    triangulate_normalized_correspondence(
                        m.point_a,
                        m.point_b,
                        &rotation,
                        &translation,
                        &k_inv,
                    )
                })
                .filter(|point_cam1| {
                    let point_cam2 = rotation * point_cam1.coords + translation;
                    point_cam1.z > 1e-4 && point_cam2.z > 1e-4
                })
                .count();

            if cheirality > best_cheirality {
                best_cheirality = cheirality;
                best_candidate = Some((rotation, translation));
            }
        }

        let Some((rotation_matrix, translation_vector)) = best_candidate else {
            return Ok(None);
        };
        if best_cheirality == 0 {
            return Ok(None);
        }

        let camera_center = -rotation_matrix.transpose() * translation_vector;
        let rotation = UnitQuaternion::from_rotation_matrix(&Rotation3::from_matrix_unchecked(
            rotation_matrix,
        ));

        Ok(Some(CameraPose::new(Point3::from(camera_center), rotation)))
    }

    fn calibration_matrix(&self) -> Matrix3<f32> {
        if let Some(intrinsics) = &self._intrinsics {
            Matrix3::new(
                intrinsics.focal_length,
                0.0,
                intrinsics.principal_point.0,
                0.0,
                intrinsics.focal_length,
                intrinsics.principal_point.1,
                0.0,
                0.0,
                1.0,
            )
        } else {
            Matrix3::identity()
        }
    }

    /// Combine two poses (apply relative pose to base pose)
    fn combine_poses(&self, base: &CameraPose, relative: &CameraPose) -> CameraPose {
        let new_position = base.position + base.rotation * relative.position.coords;
        let new_rotation = base.rotation * relative.rotation;

        CameraPose::new(new_position, new_rotation)
    }

    fn invert_pose(&self, pose: &CameraPose) -> CameraPose {
        let inv_rotation = pose.rotation.inverse();
        let inv_position = -(inv_rotation * pose.position.coords);
        CameraPose::new(Point3::from(inv_position), inv_rotation)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use nalgebra::{Matrix3, Vector3};

    fn keypoint(x: f32, y: f32) -> Keypoint {
        Keypoint {
            x,
            y,
            scale: 1.0,
            orientation: 0.0,
            response: 1.0,
        }
    }

    fn correspondence(
        keypoint_a: usize,
        keypoint_b: usize,
        point_a: [f32; 2],
        point_b: [f32; 2],
    ) -> FeatureMatch {
        FeatureMatch {
            keypoint_a,
            keypoint_b,
            point_a,
            point_b,
            distance: 0.1,
        }
    }

    fn project_point(
        point_world: Point3<f32>,
        rotation_world_to_camera: &Matrix3<f32>,
        camera_center_world: Vector3<f32>,
        focal_length: f32,
        principal: (f32, f32),
    ) -> [f32; 2] {
        let camera_point = rotation_world_to_camera * (point_world.coords - camera_center_world);
        let x = focal_length * (camera_point.x / camera_point.z) + principal.0;
        let y = focal_length * (camera_point.y / camera_point.z) + principal.1;
        [x, y]
    }

    #[test]
    fn test_feature_matcher_creation() {
        let matcher = FeatureMatcher::new();
        assert_eq!(matcher.ratio_threshold, 0.8);
    }

    #[test]
    fn test_camera_pose_estimator_creation() {
        let estimator = CameraPoseEstimator::new(None);
        assert!(estimator._intrinsics.is_none());
    }

    #[test]
    fn test_estimate_fundamental_matrix_fits_fixture_correspondences() {
        let matcher = FeatureMatcher::new();
        let matches = vec![
            correspondence(0, 0, [10.0, 10.0], [20.0, 10.0]),
            correspondence(1, 1, [20.0, 15.0], [30.0, 15.0]),
            correspondence(2, 2, [30.0, 5.0], [40.0, 5.0]),
            correspondence(3, 3, [40.0, 25.0], [50.0, 25.0]),
            correspondence(4, 4, [50.0, 35.0], [60.0, 35.0]),
            correspondence(5, 5, [60.0, 45.0], [70.0, 45.0]),
            correspondence(6, 6, [70.0, 20.0], [80.0, 20.0]),
            correspondence(7, 7, [80.0, 30.0], [90.0, 30.0]),
            correspondence(8, 8, [90.0, 40.0], [100.0, 40.0]),
            correspondence(9, 9, [110.0, 12.0], [120.0, 12.0]),
        ];
        let f = matcher.estimate_fundamental_matrix(&matches).unwrap();

        let avg_error = matches
            .iter()
            .map(|m| {
                matcher.epipolar_error(
                    &f,
                    &keypoint(m.point_a[0], m.point_a[1]),
                    &keypoint(m.point_b[0], m.point_b[1]),
                )
            })
            .sum::<f32>()
            / matches.len() as f32;
        assert!(
            avg_error < 1e-2,
            "expected low epipolar error, got {avg_error}"
        );
    }

    #[test]
    fn test_ransac_filter_handles_outlier_contaminated_set() {
        let matcher = FeatureMatcher::new();

        let mut keypoints_a = Vec::new();
        let mut keypoints_b = Vec::new();
        let mut matches = Vec::new();
        for (i, (xa, ya)) in [
            (10.0, 10.0),
            (20.0, 15.0),
            (30.0, 5.0),
            (40.0, 25.0),
            (50.0, 35.0),
            (60.0, 45.0),
            (70.0, 20.0),
            (80.0, 30.0),
            (90.0, 40.0),
            (100.0, 22.0),
            (110.0, 18.0),
            (120.0, 28.0),
        ]
        .iter()
        .enumerate()
        {
            keypoints_a.push(keypoint(*xa, *ya));
            keypoints_b.push(keypoint(*xa + 10.0, *ya));
            matches.push(correspondence(i, i, [*xa, *ya], [*xa + 10.0, *ya]));
        }

        // Inject one strong outlier.
        keypoints_a.push(keypoint(130.0, 60.0));
        keypoints_b.push(keypoint(500.0, 5.0));
        matches.push(correspondence(12, 12, [130.0, 60.0], [500.0, 5.0]));

        let inliers = matcher
            .ransac_filter(&matches, &keypoints_a, &keypoints_b)
            .unwrap();

        assert!(
            inliers.len() >= 8,
            "expected RANSAC to return a minimally usable inlier set, got {}",
            inliers.len()
        );
    }

    #[test]
    fn test_estimate_relative_pose_recovers_translation_direction_from_fixture() {
        let intrinsics = CameraIntrinsics {
            focal_length: 800.0,
            principal_point: (320.0, 240.0),
            distortion: vec![],
        };
        let estimator = CameraPoseEstimator::new(Some(intrinsics.clone()));
        let rotation_identity = Matrix3::<f32>::identity();
        let camera_a_center = Vector3::new(0.0, 0.0, 0.0);
        let camera_b_center = Vector3::new(1.0, 0.0, 0.0);

        let points_world = [
            Point3::new(-0.3, -0.2, 4.0),
            Point3::new(0.2, -0.1, 4.3),
            Point3::new(0.4, 0.3, 4.8),
            Point3::new(-0.1, 0.4, 5.2),
            Point3::new(0.6, -0.3, 5.6),
            Point3::new(0.1, 0.2, 6.0),
            Point3::new(-0.5, 0.1, 6.4),
            Point3::new(0.3, -0.4, 6.8),
            Point3::new(0.0, 0.0, 7.2),
            Point3::new(-0.2, 0.5, 7.6),
            Point3::new(0.5, 0.2, 8.0),
            Point3::new(-0.4, -0.3, 8.4),
        ];

        let pair_matches = points_world
            .iter()
            .enumerate()
            .map(|(idx, p)| {
                let pa = project_point(
                    *p,
                    &rotation_identity,
                    camera_a_center,
                    intrinsics.focal_length,
                    intrinsics.principal_point,
                );
                let pb = project_point(
                    *p,
                    &rotation_identity,
                    camera_b_center,
                    intrinsics.focal_length,
                    intrinsics.principal_point,
                );
                correspondence(idx, idx, pa, pb)
            })
            .collect::<Vec<_>>();

        let pair = ImagePairMatches {
            image_a: 0,
            image_b: 1,
            matches: pair_matches,
        };
        let relative = estimator.estimate_relative_pose(&pair).unwrap().unwrap();
        let relative_dir = relative.position.coords.normalize();

        assert!(
            relative.position.coords.norm() > 0.1,
            "expected non-trivial relative translation estimate"
        );
        assert!(
            relative_dir.dot(&Vector3::x()) > 0.9,
            "expected translation direction close to +X, got {:?}",
            relative_dir
        );
    }

    #[test]
    fn test_estimate_relative_pose_requires_minimum_correspondences() {
        let estimator = CameraPoseEstimator::new(None);
        let pair = ImagePairMatches {
            image_a: 0,
            image_b: 1,
            matches: (0..7)
                .map(|i| correspondence(i, i, [i as f32, 0.0], [i as f32 + 1.0, 0.0]))
                .collect(),
        };
        assert!(estimator.estimate_relative_pose(&pair).unwrap().is_none());
    }

    #[test]
    fn test_estimate_fundamental_matrix_rejects_degenerate_correspondences() {
        let matcher = FeatureMatcher::new();
        let degenerate_matches: Vec<FeatureMatch> = (0..8)
            .map(|i| correspondence(i, i, [100.0, 100.0], [100.0, 100.0]))
            .collect();
        assert!(matcher
            .estimate_fundamental_matrix(&degenerate_matches)
            .is_err());
    }
}
