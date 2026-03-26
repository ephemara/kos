//! Bounding Volume Hierarchy (BVH) for accelerated ray-mesh intersection
//!
//! This module implements a BVH tree structure for efficient ray tracing
//! during texture baking operations. The BVH is built using a Surface Area
//! Heuristic (SAH) for optimal performance.

use crate::error::{BakingError, Result};
use glam::{Vec3, Vec3A};

/// Axis-Aligned Bounding Box
#[derive(Debug, Clone, Copy)]
pub struct Aabb {
    pub min: Vec3A,
    pub max: Vec3A,
}

impl Aabb {
    /// Create a new AABB from min and max points
    pub fn new(min: Vec3A, max: Vec3A) -> Self {
        Self { min, max }
    }

    /// Create an empty AABB
    pub fn empty() -> Self {
        Self {
            min: Vec3A::splat(f32::INFINITY),
            max: Vec3A::splat(f32::NEG_INFINITY),
        }
    }

    /// Expand AABB to include a point
    pub fn expand_by_point(&mut self, point: Vec3A) {
        self.min = self.min.min(point);
        self.max = self.max.max(point);
    }

    /// Expand AABB to include another AABB
    pub fn expand_by_aabb(&mut self, other: &Aabb) {
        self.min = self.min.min(other.min);
        self.max = self.max.max(other.max);
    }

    /// Get the center of the AABB
    pub fn center(&self) -> Vec3A {
        (self.min + self.max) * 0.5
    }

    /// Get the surface area of the AABB
    pub fn surface_area(&self) -> f32 {
        let extent = self.max - self.min;
        2.0 * (extent.x * extent.y + extent.y * extent.z + extent.z * extent.x)
    }

    /// Test ray-AABB intersection
    pub fn intersect_ray(&self, ray_origin: Vec3A, ray_inv_dir: Vec3A) -> Option<f32> {
        let t1 = (self.min - ray_origin) * ray_inv_dir;
        let t2 = (self.max - ray_origin) * ray_inv_dir;

        let tmin = t1.min(t2);
        let tmax = t1.max(t2);

        let t_near = tmin.max_element();
        let t_far = tmax.min_element();

        if t_near <= t_far && t_far >= 0.0 {
            Some(t_near.max(0.0))
        } else {
            None
        }
    }
}

/// Triangle primitive for BVH
#[derive(Debug, Clone, Copy)]
pub struct Triangle {
    pub v0: Vec3A,
    pub v1: Vec3A,
    pub v2: Vec3A,
    pub index: u32,
}

impl Triangle {
    /// Create a new triangle
    pub fn new(v0: Vec3, v1: Vec3, v2: Vec3, index: u32) -> Self {
        Self {
            v0: Vec3A::from(v0),
            v1: Vec3A::from(v1),
            v2: Vec3A::from(v2),
            index,
        }
    }

    /// Get the AABB of the triangle
    pub fn aabb(&self) -> Aabb {
        let mut aabb = Aabb::empty();
        aabb.expand_by_point(self.v0);
        aabb.expand_by_point(self.v1);
        aabb.expand_by_point(self.v2);
        aabb
    }

    /// Get the centroid of the triangle
    pub fn centroid(&self) -> Vec3A {
        (self.v0 + self.v1 + self.v2) / 3.0
    }

    /// Test ray-triangle intersection using Möller-Trumbore algorithm
    pub fn intersect_ray(&self, ray_origin: Vec3A, ray_dir: Vec3A) -> Option<(f32, f32, f32)> {
        const EPSILON: f32 = 1e-8;

        let edge1 = self.v1 - self.v0;
        let edge2 = self.v2 - self.v0;
        let h = ray_dir.cross(edge2);
        let a = edge1.dot(h);

        if a.abs() < EPSILON {
            return None; // Ray is parallel to triangle
        }

        let f = 1.0 / a;
        let s = ray_origin - self.v0;
        let u = f * s.dot(h);

        if u < 0.0 || u > 1.0 {
            return None;
        }

        let q = s.cross(edge1);
        let v = f * ray_dir.dot(q);

        if v < 0.0 || u + v > 1.0 {
            return None;
        }

        let t = f * edge2.dot(q);

        if t > EPSILON {
            Some((t, u, v))
        } else {
            None
        }
    }
}

/// BVH node
#[derive(Debug, Clone)]
enum BvhNode {
    Leaf {
        aabb: Aabb,
        triangles: Vec<Triangle>,
    },
    Internal {
        aabb: Aabb,
        left: Box<BvhNode>,
        right: Box<BvhNode>,
    },
}

impl BvhNode {
    fn aabb(&self) -> &Aabb {
        match self {
            BvhNode::Leaf { aabb, .. } => aabb,
            BvhNode::Internal { aabb, .. } => aabb,
        }
    }
}

/// Bounding Volume Hierarchy for accelerated ray tracing
#[derive(Clone)]
pub struct Bvh {
    root: Option<BvhNode>,
    triangle_count: usize,
}

impl Bvh {
    /// Build a BVH from a list of triangles
    pub fn build(triangles: Vec<Triangle>) -> Result<Self> {
        if triangles.is_empty() {
            return Ok(Self {
                root: None,
                triangle_count: 0,
            });
        }

        let triangle_count = triangles.len();
        let root = Self::build_recursive(triangles, 0)?;

        Ok(Self {
            root: Some(root),
            triangle_count,
        })
    }

    /// Build BVH from mesh vertices and indices
    pub fn from_mesh(vertices: &[Vec3], indices: &[u32]) -> Result<Self> {
        if indices.len() % 3 != 0 {
            return Err(BakingError::InvalidMesh(
                "Index count must be divisible by 3".to_string(),
            ));
        }

        let triangles: Vec<Triangle> = indices
            .chunks(3)
            .enumerate()
            .filter_map(|(i, chunk)| {
                let i0 = chunk[0] as usize;
                let i1 = chunk[1] as usize;
                let i2 = chunk[2] as usize;

                if i0 >= vertices.len() || i1 >= vertices.len() || i2 >= vertices.len() {
                    log::warn!("Triangle {} has out-of-bounds indices", i);
                    return None;
                }

                Some(Triangle::new(
                    vertices[i0],
                    vertices[i1],
                    vertices[i2],
                    i as u32,
                ))
            })
            .collect();

        Self::build(triangles)
    }

    /// Recursively build BVH using SAH
    fn build_recursive(mut triangles: Vec<Triangle>, depth: u32) -> Result<BvhNode> {
        const MAX_LEAF_SIZE: usize = 4;
        const MAX_DEPTH: u32 = 32;

        // Compute AABB for all triangles
        let mut aabb = Aabb::empty();
        for tri in &triangles {
            aabb.expand_by_aabb(&tri.aabb());
        }

        // Create leaf node if we have few triangles or reached max depth
        if triangles.len() <= MAX_LEAF_SIZE || depth >= MAX_DEPTH {
            return Ok(BvhNode::Leaf { aabb, triangles });
        }

        // Find best split using SAH
        let (axis, split_pos) = Self::find_best_split(&triangles, &aabb)?;

        // Partition triangles
        let mid = Self::partition_triangles(&mut triangles, axis, split_pos);

        if mid == 0 || mid == triangles.len() {
            // Split failed, create leaf
            return Ok(BvhNode::Leaf { aabb, triangles });
        }

        // Split triangles
        let right_triangles = triangles.split_off(mid);
        let left_triangles = triangles;

        // Recursively build children
        let left = Box::new(Self::build_recursive(left_triangles, depth + 1)?);
        let right = Box::new(Self::build_recursive(right_triangles, depth + 1)?);

        Ok(BvhNode::Internal { aabb, left, right })
    }

    /// Find best split using Surface Area Heuristic
    fn find_best_split(triangles: &[Triangle], aabb: &Aabb) -> Result<(usize, f32)> {
        const NUM_BINS: usize = 16;

        let extent = aabb.max - aabb.min;
        let mut best_axis = 0;
        let mut best_cost = f32::INFINITY;
        let mut best_split = 0.5;

        // Try each axis
        for axis in 0..3 {
            if extent[axis] < 1e-6 {
                continue;
            }

            // Create bins
            let mut bins = vec![(Aabb::empty(), 0usize); NUM_BINS];

            // Assign triangles to bins
            for tri in triangles {
                let centroid = tri.centroid();
                let t = (centroid[axis] - aabb.min[axis]) / extent[axis];
                let bin_idx = ((t * NUM_BINS as f32) as usize).min(NUM_BINS - 1);

                bins[bin_idx].0.expand_by_aabb(&tri.aabb());
                bins[bin_idx].1 += 1;
            }

            // Evaluate splits
            for i in 1..NUM_BINS {
                let mut left_aabb = Aabb::empty();
                let mut left_count = 0;
                for j in 0..i {
                    left_aabb.expand_by_aabb(&bins[j].0);
                    left_count += bins[j].1;
                }

                let mut right_aabb = Aabb::empty();
                let mut right_count = 0;
                for j in i..NUM_BINS {
                    right_aabb.expand_by_aabb(&bins[j].0);
                    right_count += bins[j].1;
                }

                if left_count == 0 || right_count == 0 {
                    continue;
                }

                let cost = left_aabb.surface_area() * left_count as f32
                    + right_aabb.surface_area() * right_count as f32;

                if cost < best_cost {
                    best_cost = cost;
                    best_axis = axis;
                    best_split = aabb.min[axis] + extent[axis] * (i as f32 / NUM_BINS as f32);
                }
            }
        }

        Ok((best_axis, best_split))
    }

    /// Partition triangles around a split plane
    fn partition_triangles(triangles: &mut [Triangle], axis: usize, split_pos: f32) -> usize {
        let mut i = 0;
        let mut j = triangles.len();

        while i < j {
            if triangles[i].centroid()[axis] < split_pos {
                i += 1;
            } else {
                j -= 1;
                triangles.swap(i, j);
            }
        }

        i
    }

    /// Cast a ray and find the closest intersection
    pub fn raycast(&self, origin: Vec3, direction: Vec3) -> Option<RayHit> {
        let root = self.root.as_ref()?;
        let origin = Vec3A::from(origin);
        let direction = Vec3A::from(direction);
        let inv_dir = Vec3A::ONE / direction;

        Self::raycast_recursive(root, origin, direction, inv_dir, f32::INFINITY)
    }

    /// Recursively traverse BVH and find closest hit
    fn raycast_recursive(
        node: &BvhNode,
        origin: Vec3A,
        direction: Vec3A,
        inv_dir: Vec3A,
        mut closest_t: f32,
    ) -> Option<RayHit> {
        // Test AABB intersection
        if node.aabb().intersect_ray(origin, inv_dir).is_none() {
            return None;
        }

        match node {
            BvhNode::Leaf { triangles, .. } => {
                let mut best_hit: Option<RayHit> = None;

                for tri in triangles {
                    if let Some((t, u, v)) = tri.intersect_ray(origin, direction) {
                        if t < closest_t {
                            closest_t = t;
                            best_hit = Some(RayHit {
                                distance: t,
                                triangle_index: tri.index,
                                barycentric: (u, v),
                                position: origin + direction * t,
                            });
                        }
                    }
                }

                best_hit
            }
            BvhNode::Internal { left, right, .. } => {
                // Test both children
                let hit_left = Self::raycast_recursive(left, origin, direction, inv_dir, closest_t);
                if let Some(ref hit) = hit_left {
                    closest_t = hit.distance;
                }

                let hit_right =
                    Self::raycast_recursive(right, origin, direction, inv_dir, closest_t);

                // Return closest hit
                match (hit_left, hit_right) {
                    (Some(l), Some(r)) => {
                        if l.distance < r.distance {
                            Some(l)
                        } else {
                            Some(r)
                        }
                    }
                    (Some(l), None) => Some(l),
                    (None, Some(r)) => Some(r),
                    (None, None) => None,
                }
            }
        }
    }

    /// Get the number of triangles in the BVH
    pub fn triangle_count(&self) -> usize {
        self.triangle_count
    }
}

/// Ray intersection result
#[derive(Debug, Clone, Copy)]
pub struct RayHit {
    /// Distance along the ray
    pub distance: f32,
    /// Index of the intersected triangle
    pub triangle_index: u32,
    /// Barycentric coordinates (u, v) where w = 1 - u - v
    pub barycentric: (f32, f32),
    /// World-space position of the hit
    pub position: Vec3A,
}

impl RayHit {
    /// Get the barycentric coordinates as (u, v, w)
    pub fn barycentric_uvw(&self) -> (f32, f32, f32) {
        let (u, v) = self.barycentric;
        (u, v, 1.0 - u - v)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_aabb_creation() {
        let aabb = Aabb::new(Vec3A::ZERO, Vec3A::ONE);
        assert_eq!(aabb.min, Vec3A::ZERO);
        assert_eq!(aabb.max, Vec3A::ONE);
    }

    #[test]
    fn test_aabb_expand() {
        let mut aabb = Aabb::empty();
        aabb.expand_by_point(Vec3A::new(1.0, 2.0, 3.0));
        aabb.expand_by_point(Vec3A::new(-1.0, -2.0, -3.0));

        assert_eq!(aabb.min, Vec3A::new(-1.0, -2.0, -3.0));
        assert_eq!(aabb.max, Vec3A::new(1.0, 2.0, 3.0));
    }

    #[test]
    fn test_triangle_creation() {
        let tri = Triangle::new(Vec3::ZERO, Vec3::X, Vec3::Y, 0);
        assert_eq!(tri.index, 0);
    }

    #[test]
    fn test_bvh_from_mesh() {
        let vertices = vec![
            Vec3::new(0.0, 0.0, 0.0),
            Vec3::new(1.0, 0.0, 0.0),
            Vec3::new(0.0, 1.0, 0.0),
            Vec3::new(1.0, 1.0, 0.0),
        ];
        let indices = vec![0, 1, 2, 1, 3, 2];

        let bvh = Bvh::from_mesh(&vertices, &indices).unwrap();
        assert_eq!(bvh.triangle_count(), 2);
    }

    #[test]
    fn test_raycast_hit() {
        let vertices = vec![
            Vec3::new(-1.0, -1.0, 0.0),
            Vec3::new(1.0, -1.0, 0.0),
            Vec3::new(0.0, 1.0, 0.0),
        ];
        let indices = vec![0, 1, 2];

        let bvh = Bvh::from_mesh(&vertices, &indices).unwrap();
        let hit = bvh.raycast(Vec3::new(0.0, 0.0, -1.0), Vec3::new(0.0, 0.0, 1.0));

        assert!(hit.is_some());
        let hit = hit.unwrap();
        assert!(hit.distance > 0.0);
    }

    #[test]
    fn test_raycast_miss() {
        let vertices = vec![
            Vec3::new(-1.0, -1.0, 0.0),
            Vec3::new(1.0, -1.0, 0.0),
            Vec3::new(0.0, 1.0, 0.0),
        ];
        let indices = vec![0, 1, 2];

        let bvh = Bvh::from_mesh(&vertices, &indices).unwrap();
        let hit = bvh.raycast(Vec3::new(10.0, 10.0, -1.0), Vec3::new(0.0, 0.0, 1.0));

        assert!(hit.is_none());
    }
}
