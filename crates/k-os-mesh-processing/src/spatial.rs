//! Spatial data structures for mesh queries

use crate::{Mesh, Result};
use glam::Vec3;
use kiddo::KdTree;
use log::info;

/// KD-tree for nearest neighbor queries
pub struct MeshKdTree {
    tree: KdTree<f32, 3>,
}

impl MeshKdTree {
    /// Build KD-tree from mesh vertices
    pub fn new(mesh: &Mesh) -> Self {
        info!("Building KD-tree with {} vertices", mesh.vertices.len());

        let mut tree = KdTree::new();

        for (idx, vertex) in mesh.vertices.iter().enumerate() {
            tree.add(&[vertex.x, vertex.y, vertex.z], idx as u64);
        }

        Self { tree }
    }

    /// Find nearest vertex to a point
    pub fn nearest(&self, point: &Vec3) -> Result<usize> {
        use kiddo::SquaredEuclidean;
        let result = self
            .tree
            .nearest_one::<SquaredEuclidean>(&[point.x, point.y, point.z]);

        Ok(result.item as usize)
    }

    /// Find k nearest vertices to a point
    pub fn nearest_k(&self, point: &Vec3, k: usize) -> Result<Vec<usize>> {
        use kiddo::SquaredEuclidean;
        let results = self
            .tree
            .nearest_n::<SquaredEuclidean>(&[point.x, point.y, point.z], k);

        Ok(results.into_iter().map(|r| r.item as usize).collect())
    }

    /// Find all vertices within radius
    pub fn within_radius(&self, point: &Vec3, radius: f32) -> Result<Vec<usize>> {
        use kiddo::SquaredEuclidean;
        let results = self
            .tree
            .within::<SquaredEuclidean>(&[point.x, point.y, point.z], radius * radius);

        Ok(results.into_iter().map(|r| r.item as usize).collect())
    }
}

/// Ray hit information
#[derive(Debug, Clone)]
pub struct RayHit {
    pub distance: f32,
    pub triangle_index: usize,
    pub barycentric: Vec3,
    pub position: Vec3,
    pub normal: Vec3,
}

/// Simple BVH for ray tracing
pub struct MeshBVH {
    triangles: Vec<Triangle>,
}

#[derive(Debug, Clone)]
struct Triangle {
    vertices: [Vec3; 3],
    index: usize,
}

impl MeshBVH {
    /// Build BVH from mesh triangles
    pub fn new(mesh: &Mesh) -> Result<Self> {
        mesh.validate()?;

        info!("Building BVH with {} triangles", mesh.triangle_count());

        let mut triangles = Vec::new();

        for tri_idx in 0..mesh.triangle_count() {
            if let Some(tri) = mesh.get_triangle(tri_idx) {
                triangles.push(Triangle {
                    vertices: tri,
                    index: tri_idx,
                });
            }
        }

        Ok(Self { triangles })
    }

    /// Cast ray and find closest hit
    pub fn raycast(&self, origin: Vec3, direction: Vec3, max_distance: f32) -> Option<RayHit> {
        let dir_normalized = direction.normalize();
        let mut closest_hit: Option<RayHit> = None;
        let mut closest_distance = max_distance;

        // Simple linear search through triangles
        // In production, use proper BVH traversal for acceleration
        for triangle in &self.triangles {
            if let Some(hit) =
                ray_triangle_intersect(origin, dir_normalized, &triangle.vertices, closest_distance)
            {
                if hit.distance < closest_distance {
                    closest_distance = hit.distance;

                    let position = origin + dir_normalized * hit.distance;
                    let edge1 = triangle.vertices[1] - triangle.vertices[0];
                    let edge2 = triangle.vertices[2] - triangle.vertices[0];
                    let normal = edge1.cross(edge2).normalize();

                    closest_hit = Some(RayHit {
                        distance: hit.distance,
                        triangle_index: triangle.index,
                        barycentric: hit.barycentric,
                        position,
                        normal,
                    });
                }
            }
        }

        closest_hit
    }

    /// Cast ray and find all hits
    pub fn raycast_all(&self, origin: Vec3, direction: Vec3, max_distance: f32) -> Vec<RayHit> {
        let dir_normalized = direction.normalize();
        let mut hits = Vec::new();

        for triangle in &self.triangles {
            if let Some(hit) =
                ray_triangle_intersect(origin, dir_normalized, &triangle.vertices, max_distance)
            {
                let position = origin + dir_normalized * hit.distance;
                let edge1 = triangle.vertices[1] - triangle.vertices[0];
                let edge2 = triangle.vertices[2] - triangle.vertices[0];
                let normal = edge1.cross(edge2).normalize();

                hits.push(RayHit {
                    distance: hit.distance,
                    triangle_index: triangle.index,
                    barycentric: hit.barycentric,
                    position,
                    normal,
                });
            }
        }

        hits.sort_by(|a, b| a.distance.partial_cmp(&b.distance).unwrap());
        hits
    }
}

struct RayTriangleHit {
    distance: f32,
    barycentric: Vec3,
}

/// Möller-Trumbore ray-triangle intersection
fn ray_triangle_intersect(
    origin: Vec3,
    direction: Vec3,
    triangle: &[Vec3; 3],
    max_distance: f32,
) -> Option<RayTriangleHit> {
    const EPSILON: f32 = 1e-6;

    let edge1 = triangle[1] - triangle[0];
    let edge2 = triangle[2] - triangle[0];
    let h = direction.cross(edge2);
    let a = edge1.dot(h);

    if a.abs() < EPSILON {
        return None; // Ray parallel to triangle
    }

    let f = 1.0 / a;
    let s = origin - triangle[0];
    let u = f * s.dot(h);

    if u < 0.0 || u > 1.0 {
        return None;
    }

    let q = s.cross(edge1);
    let v = f * direction.dot(q);

    if v < 0.0 || u + v > 1.0 {
        return None;
    }

    let t = f * edge2.dot(q);

    if t > EPSILON && t < max_distance {
        Some(RayTriangleHit {
            distance: t,
            barycentric: Vec3::new(1.0 - u - v, u, v),
        })
    } else {
        None
    }
}

/// Build KD-tree for mesh
pub fn build_kdtree(mesh: &Mesh) -> MeshKdTree {
    MeshKdTree::new(mesh)
}

/// Build BVH for mesh
pub fn build_bvh(mesh: &Mesh) -> Result<MeshBVH> {
    MeshBVH::new(mesh)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::Mesh;

    fn create_test_mesh() -> Mesh {
        let vertices = vec![
            Vec3::new(0.0, 0.0, 0.0),
            Vec3::new(1.0, 0.0, 0.0),
            Vec3::new(0.0, 1.0, 0.0),
        ];
        let indices = vec![0, 1, 2];
        Mesh::from_vertices_indices(vertices, indices)
    }

    #[test]
    fn test_kdtree_nearest() {
        let mesh = create_test_mesh();
        let kdtree = build_kdtree(&mesh);

        let result = kdtree.nearest(&Vec3::new(0.1, 0.1, 0.0));
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), 0); // Closest to first vertex
    }

    #[test]
    fn test_kdtree_nearest_k() {
        let mesh = create_test_mesh();
        let kdtree = build_kdtree(&mesh);

        let result = kdtree.nearest_k(&Vec3::new(0.5, 0.5, 0.0), 2);
        assert!(result.is_ok());
        assert_eq!(result.unwrap().len(), 2);
    }

    #[test]
    fn test_bvh_raycast() {
        let mesh = create_test_mesh();
        let bvh = build_bvh(&mesh).unwrap();

        // Ray pointing at triangle
        let origin = Vec3::new(0.25, 0.25, -1.0);
        let direction = Vec3::new(0.0, 0.0, 1.0);

        let hit = bvh.raycast(origin, direction, 10.0);
        assert!(hit.is_some());

        if let Some(hit) = hit {
            assert_eq!(hit.triangle_index, 0);
            assert!(hit.distance > 0.0);
        }
    }

    #[test]
    fn test_bvh_raycast_miss() {
        let mesh = create_test_mesh();
        let bvh = build_bvh(&mesh).unwrap();

        // Ray pointing away from triangle
        let origin = Vec3::new(0.25, 0.25, -1.0);
        let direction = Vec3::new(0.0, 0.0, -1.0);

        let hit = bvh.raycast(origin, direction, 10.0);
        assert!(hit.is_none());
    }
}
