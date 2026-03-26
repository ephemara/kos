//! Mesh Generation Module
//!
//! Generates triangle meshes from point clouds using Poisson surface reconstruction.

use anyhow::Result;
use nalgebra::{Point2, Point3, Vector3};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

use super::PointCloud;
use k_os_gpu_pipeline::device::GpuComputeDevice as GpuCompute;

/// Mesh generator
pub struct MeshGenerator {
    _gpu_compute: Arc<GpuCompute>,
    config: MeshGenerationConfig,
}

/// Strategy for generating topology from a reconstructed point cloud.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum MeshGenerationStrategy {
    /// Compatibility strategy using sampled points plus triangle-fan topology.
    TriangleFanCompat,
}

/// Fallback behavior for sparse clouds that cannot form a triangulated surface.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum SparseCloudFallback {
    /// Preserve legacy behavior by returning a minimal quad mesh.
    CompatibilityQuad,
    /// Return an empty mesh and let downstream systems decide recovery behavior.
    EmptyMesh,
}

/// Data-driven mesh generation contract for the photogrammetry domain.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MeshGenerationConfig {
    pub strategy: MeshGenerationStrategy,
    pub sparse_cloud_fallback: SparseCloudFallback,
}

impl Default for MeshGenerationConfig {
    fn default() -> Self {
        Self {
            strategy: MeshGenerationStrategy::TriangleFanCompat,
            sparse_cloud_fallback: SparseCloudFallback::CompatibilityQuad,
        }
    }
}

/// Triangle mesh with UVs
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TriangleMesh {
    /// Vertex positions
    pub vertices: Vec<Point3<f32>>,
    /// Vertex normals
    pub normals: Vec<Vector3<f32>>,
    /// UV coordinates
    pub uvs: Vec<Point2<f32>>,
    /// Triangle indices (3 per triangle)
    pub indices: Vec<u32>,
}

impl MeshGenerator {
    /// Create a new mesh generator
    pub fn new(gpu_compute: Arc<GpuCompute>) -> Self {
        Self {
            _gpu_compute: gpu_compute,
            config: MeshGenerationConfig::default(),
        }
    }

    /// Create a new mesh generator with explicit generation config.
    pub fn with_config(gpu_compute: Arc<GpuCompute>, config: MeshGenerationConfig) -> Self {
        Self {
            _gpu_compute: gpu_compute,
            config,
        }
    }

    /// Generate triangle mesh from point cloud
    pub fn generate(&self, point_cloud: &PointCloud, quality: f32) -> Result<TriangleMesh> {
        log::info!(
            "Generating mesh from {} points (quality: {})",
            point_cloud.points.len(),
            quality
        );

        let selected_indices = select_point_indices(point_cloud.points.len(), quality);
        if selected_indices.len() < 3 {
            log::warn!(
                "Insufficient point cloud data ({} points) for triangulated mesh; applying sparse-cloud fallback {:?}",
                point_cloud.points.len(),
                self.config.sparse_cloud_fallback
            );
            return Ok(match self.config.sparse_cloud_fallback {
                SparseCloudFallback::CompatibilityQuad => compatibility_quad(),
                SparseCloudFallback::EmptyMesh => empty_mesh(),
            });
        }

        match self.config.strategy {
            MeshGenerationStrategy::TriangleFanCompat => {
                let mut vertices = Vec::with_capacity(selected_indices.len());
                let mut normals = Vec::with_capacity(selected_indices.len());
                let mut uvs = Vec::with_capacity(selected_indices.len());
                let mut indices =
                    Vec::with_capacity((selected_indices.len().saturating_sub(2)) * 3);

                for idx in &selected_indices {
                    vertices.push(point_cloud.points[*idx]);
                    let normal = point_cloud
                        .normals
                        .get(*idx)
                        .copied()
                        .unwrap_or_else(|| Vector3::new(0.0, 1.0, 0.0));
                    normals.push(normal);
                }

                let (min_x, max_x) = vertices.iter().fold(
                    (f32::INFINITY, f32::NEG_INFINITY),
                    |(min_v, max_v), point| (min_v.min(point.x), max_v.max(point.x)),
                );
                let (min_z, max_z) = vertices.iter().fold(
                    (f32::INFINITY, f32::NEG_INFINITY),
                    |(min_v, max_v), point| (min_v.min(point.z), max_v.max(point.z)),
                );
                let range_x = (max_x - min_x).max(1e-6);
                let range_z = (max_z - min_z).max(1e-6);

                for vertex in &vertices {
                    uvs.push(Point2::new(
                        (vertex.x - min_x) / range_x,
                        (vertex.z - min_z) / range_z,
                    ));
                }

                for i in 1..(vertices.len() - 1) {
                    indices.push(0);
                    indices.push(i as u32);
                    indices.push((i + 1) as u32);
                }

                log::info!(
                    "Generated mesh with {} vertices and {} triangles",
                    vertices.len(),
                    indices.len() / 3
                );

                Ok(TriangleMesh {
                    vertices,
                    normals,
                    uvs,
                    indices,
                })
            }
        }
    }
}

fn select_point_indices(point_count: usize, quality: f32) -> Vec<usize> {
    if point_count == 0 {
        return Vec::new();
    }

    let clamped_quality = quality.clamp(0.0, 1.0);
    let target = ((point_count as f32) * clamped_quality).round() as usize;
    let target = target.max(3).min(point_count);
    if target == point_count {
        return (0..point_count).collect();
    }

    let stride = ((point_count as f32) / (target as f32)).floor().max(1.0) as usize;
    let mut selected = Vec::with_capacity(target);
    let mut idx = 0usize;
    while idx < point_count && selected.len() < target {
        selected.push(idx);
        idx = idx.saturating_add(stride);
    }
    if let Some(last) = point_count.checked_sub(1) {
        if selected.last().copied() != Some(last) && selected.len() < target {
            selected.push(last);
        }
    }
    selected
}

fn compatibility_quad() -> TriangleMesh {
    let vertices = vec![
        Point3::new(-1.0, 0.0, -1.0),
        Point3::new(1.0, 0.0, -1.0),
        Point3::new(1.0, 0.0, 1.0),
        Point3::new(-1.0, 0.0, 1.0),
    ];
    let normals = vec![Vector3::new(0.0, 1.0, 0.0); 4];
    let uvs = vec![
        Point2::new(0.0, 0.0),
        Point2::new(1.0, 0.0),
        Point2::new(1.0, 1.0),
        Point2::new(0.0, 1.0),
    ];
    let indices = vec![0, 1, 2, 0, 2, 3];
    TriangleMesh {
        vertices,
        normals,
        uvs,
        indices,
    }
}

fn empty_mesh() -> TriangleMesh {
    TriangleMesh {
        vertices: Vec::new(),
        normals: Vec::new(),
        uvs: Vec::new(),
        indices: Vec::new(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::photogrammetry::PointCloud;

    #[test]
    fn test_triangle_mesh_creation() {
        let vertices = vec![
            Point3::new(0.0, 0.0, 0.0),
            Point3::new(1.0, 0.0, 0.0),
            Point3::new(0.0, 1.0, 0.0),
        ];
        let normals = vec![Vector3::new(0.0, 0.0, 1.0); 3];
        let uvs = vec![Point2::new(0.0, 0.0); 3];
        let indices = vec![0, 1, 2];

        let mesh = TriangleMesh {
            vertices,
            normals,
            uvs,
            indices,
        };
        assert_eq!(mesh.vertices.len(), 3);
        assert_eq!(mesh.indices.len(), 3);
    }

    #[test]
    fn test_mesh_generation_uses_point_cloud_geometry() {
        let generator = MeshGenerator::new(Arc::new(GpuCompute::new_mock()));
        let point_cloud = PointCloud {
            points: vec![
                Point3::new(0.0, 0.0, 0.0),
                Point3::new(1.0, 0.0, 0.0),
                Point3::new(1.0, 1.0, 0.0),
                Point3::new(0.0, 1.0, 0.0),
            ],
            colors: vec![Vector3::new(1.0, 1.0, 1.0); 4],
            normals: vec![Vector3::new(0.0, 0.0, 1.0); 4],
        };

        let mesh = generator.generate(&point_cloud, 1.0).unwrap();
        assert_eq!(mesh.vertices.len(), 4);
        assert_eq!(mesh.vertices[0], point_cloud.points[0]);
        assert_eq!(mesh.vertices[3], point_cloud.points[3]);
        assert_eq!(mesh.indices.len(), 6);
    }

    #[test]
    fn test_sparse_cloud_empty_fallback_returns_empty_mesh() {
        let generator = MeshGenerator::with_config(
            Arc::new(GpuCompute::new_mock()),
            MeshGenerationConfig {
                strategy: MeshGenerationStrategy::TriangleFanCompat,
                sparse_cloud_fallback: SparseCloudFallback::EmptyMesh,
            },
        );
        let point_cloud = PointCloud {
            points: vec![Point3::new(0.0, 0.0, 0.0), Point3::new(1.0, 0.0, 0.0)],
            colors: vec![Vector3::new(1.0, 1.0, 1.0); 2],
            normals: vec![Vector3::new(0.0, 1.0, 0.0); 2],
        };

        let mesh = generator.generate(&point_cloud, 1.0).unwrap();
        assert!(mesh.vertices.is_empty());
        assert!(mesh.indices.is_empty());
    }
}
