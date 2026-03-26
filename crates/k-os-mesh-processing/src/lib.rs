//! K_OS Mesh Processing
//!
//! Advanced mesh processing operations for K_OS DCC Suite including:
//! - Mesh decimation (reduce polygon count)
//! - Mesh smoothing (Laplacian, Taubin, HC)
//! - Mesh subdivision (Catmull-Clark, Loop)
//! - Mesh repair (fix non-manifold, fill holes, remove duplicates)
//! - Mesh analysis (quality metrics, topology validation)
//! - UV unwrapping (automatic UV generation)
//! - Mesh optimization (vertex cache, overdraw, index buffer)
//!
//! # Example
//!
//! ```no_run
//! use k_os_mesh_processing::{Mesh, decimation, smoothing, repair};
//! use glam::Vec3;
//!
//! // Create a mesh
//! let vertices = vec![
//!     Vec3::new(0.0, 0.0, 0.0),
//!     Vec3::new(1.0, 0.0, 0.0),
//!     Vec3::new(0.0, 1.0, 0.0),
//! ];
//! let indices = vec![0, 1, 2];
//! let mesh = Mesh::from_vertices_indices(vertices, indices);
//!
//! // Decimate mesh
//! let decimated = decimation::decimate(&mesh, 0.5).unwrap();
//!
//! // Smooth mesh
//! let smoothed = smoothing::taubin(&mesh, 10, 0.5, -0.53).unwrap();
//!
//! // Repair mesh
//! let mut repaired = mesh.clone();
//! repair::repair_all(&mut repaired).unwrap();
//! ```

pub mod analysis;
pub mod decimation;
pub mod error;
pub mod mesh;
pub mod optimization;
pub mod repair;
pub mod retopology;
pub mod smoothing;
pub mod spatial;
pub mod subdivision;
pub mod uv;

pub use error::{MeshError, Result};
pub use mesh::{Mesh, Vertex};

#[cfg(test)]
mod tests {
    use super::*;
    use glam::Vec3;

    #[test]
    fn test_mesh_creation() {
        let vertices = vec![
            Vec3::new(0.0, 0.0, 0.0),
            Vec3::new(1.0, 0.0, 0.0),
            Vec3::new(0.0, 1.0, 0.0),
        ];
        let indices = vec![0, 1, 2];
        let mesh = Mesh::from_vertices_indices(vertices, indices);

        assert_eq!(mesh.vertex_count(), 3);
        assert_eq!(mesh.triangle_count(), 1);
    }

    #[test]
    fn test_mesh_bounds() {
        let vertices = vec![
            Vec3::new(-1.0, -2.0, -3.0),
            Vec3::new(1.0, 2.0, 3.0),
            Vec3::new(0.0, 0.0, 0.0),
        ];
        let indices = vec![0, 1, 2];
        let mesh = Mesh::from_vertices_indices(vertices, indices);

        let bounds = mesh.bounds();
        assert_eq!(bounds.min, Vec3::new(-1.0, -2.0, -3.0));
        assert_eq!(bounds.max, Vec3::new(1.0, 2.0, 3.0));
    }
}
