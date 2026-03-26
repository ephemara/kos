//! K_OS Scatter Engine - High-Performance Procedural Distribution
//!
//! Uses kiddo KD-tree for ultra-fast Poisson disk sampling,
//! Rapier3D for physics-based drop simulation, and voronoice for
//! cell-based patterns.
//!
//! Used by: KScatter

use kiddo::{KdTree, SquaredEuclidean};
#[cfg(feature = "physics")]
use rapier3d::prelude::*;
use serde::{Deserialize, Serialize};

// ============================================================================
// TYPES
// ============================================================================

/// Transform returned from scatter operations
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ScatterTransform {
    pub position: [f32; 3],
    pub rotation: [f32; 4], // Quaternion (x, y, z, w)
    pub scale: [f32; 3],
}

impl Default for ScatterTransform {
    fn default() -> Self {
        Self {
            position: [0.0, 0.0, 0.0],
            rotation: [0.0, 0.0, 0.0, 1.0], // Identity quaternion
            scale: [1.0, 1.0, 1.0],
        }
    }
}

// ============================================================================
// POISSON DISK SAMPLING (KD-Tree Accelerated)
// ============================================================================

/// High-performance Poisson disk sampling using kiddo KD-tree.
/// Generates points with guaranteed minimum distance between them.
/// O(n log n) complexity - handles 100k+ points easily.
pub fn poisson_disk_scatter(
    count: usize,
    radius: f32,
    min_distance: f32,
    seed: u64,
) -> Result<Vec<[f32; 3]>, String> {
    use fastrand::Rng;

    let mut rng = Rng::with_seed(seed);
    let mut tree: KdTree<f32, 3> = KdTree::new();
    let mut points: Vec<[f32; 3]> = Vec::with_capacity(count);

    let max_attempts = count * 30; // Dart throwing attempts
    let mut attempts = 0;

    while points.len() < count && attempts < max_attempts {
        attempts += 1;

        // Generate random point in sphere
        let theta = rng.f32() * std::f32::consts::PI * 2.0;
        let phi = (rng.f32() * 2.0 - 1.0).acos();
        let r = rng.f32().powf(1.0 / 3.0) * radius; // Cube root for uniform volume distribution

        let x = r * phi.sin() * theta.cos();
        let y = r * phi.sin() * theta.sin();
        let z = r * phi.cos();

        let candidate = [x, y, z];

        // Check if too close to existing points using KD-tree
        if points.is_empty() {
            tree.add(&candidate, points.len() as u64);
            points.push(candidate);
        } else {
            let nearest = tree.nearest_one::<SquaredEuclidean>(&candidate);
            let dist_sq = nearest.distance;

            if dist_sq >= min_distance * min_distance {
                tree.add(&candidate, points.len() as u64);
                points.push(candidate);
            }
        }
    }

    log::info!(
        "[K_OS Scatter] Poisson disk: {} points in {} attempts",
        points.len(),
        attempts
    );
    Ok(points)
}

/// Surface-constrained Poisson disk sampling.
/// Takes surface points and normals, distributes with minimum spacing.
pub fn poisson_disk_surface(
    surface_points: Vec<[f32; 3]>,
    surface_normals: Vec<[f32; 3]>,
    count: usize,
    min_distance: f32,
    seed: u64,
) -> Result<Vec<ScatterTransform>, String> {
    use fastrand::Rng;

    if surface_points.is_empty() {
        return Err("No surface points provided".to_string());
    }

    let mut rng = Rng::with_seed(seed);
    let mut tree: KdTree<f32, 3> = KdTree::new();
    let mut results: Vec<ScatterTransform> = Vec::with_capacity(count);

    let max_attempts = count * 50;
    let mut attempts = 0;

    while results.len() < count && attempts < max_attempts {
        attempts += 1;

        // Pick random surface point
        let idx = rng.usize(0..surface_points.len());
        let pos = surface_points[idx];
        let normal = surface_normals.get(idx).copied().unwrap_or([0.0, 1.0, 0.0]);

        // Check distance constraint
        if results.is_empty() {
            tree.add(&pos, results.len() as u64);
        } else {
            let nearest = tree.nearest_one::<SquaredEuclidean>(&pos);
            if nearest.distance < min_distance * min_distance {
                continue;
            }
            tree.add(&pos, results.len() as u64);
        }

        // Calculate rotation from normal
        let up = [0.0_f32, 1.0, 0.0];
        let rotation = quaternion_from_to(up, normal);

        results.push(ScatterTransform {
            position: pos,
            rotation,
            scale: [1.0, 1.0, 1.0],
        });
    }

    log::info!("[K_OS Scatter] Surface Poisson: {} points", results.len());
    Ok(results)
}

// ============================================================================
// PHYSICS DROP SIMULATION
// ============================================================================

/// Physics-based scatter: spawn objects, let them fall and settle.
/// Uses Rapier3D for realistic stacking and collision.
#[cfg(feature = "physics")]
pub fn physics_drop_scatter(
    count: usize,
    spawn_height: f32,
    spawn_radius: f32,
    object_radius: f32,
    gravity: f32,
    iterations: usize,
    seed: u64,
) -> Result<Vec<ScatterTransform>, String> {
    use fastrand::Rng;
    use nalgebra::vector;

    let mut rng = Rng::with_seed(seed);

    // Create physics world
    let mut rigid_body_set = RigidBodySet::new();
    let mut collider_set = ColliderSet::new();
    let gravity_vec = vector![0.0, gravity, 0.0];
    let integration_parameters = IntegrationParameters::default();
    let mut physics_pipeline = PhysicsPipeline::new();
    let mut island_manager = IslandManager::new();
    let mut broad_phase = DefaultBroadPhase::new();
    let mut narrow_phase = NarrowPhase::new();
    let mut impulse_joint_set = ImpulseJointSet::new();
    let mut multibody_joint_set = MultibodyJointSet::new();
    let mut ccd_solver = CCDSolver::new();

    // Add ground plane
    let ground_collider = ColliderBuilder::cuboid(spawn_radius * 3.0, 0.1, spawn_radius * 3.0)
        .translation(vector![0.0, -0.1, 0.0])
        .friction(0.8)
        .restitution(0.2)
        .build();
    collider_set.insert(ground_collider);

    // Spawn dynamic bodies
    let mut body_handles = Vec::with_capacity(count);

    for i in 0..count {
        // Spread spawns over time by varying height
        let height_offset = (i as f32 / count as f32) * spawn_height * 0.5;
        let angle = rng.f32() * std::f32::consts::PI * 2.0;
        let dist = rng.f32().sqrt() * spawn_radius;

        let x = dist * angle.cos();
        let z = dist * angle.sin();
        let y = spawn_height + height_offset + rng.f32() * object_radius * 2.0;

        let rigid_body = RigidBodyBuilder::dynamic()
            .translation(vector![x, y, z])
            .angular_damping(0.5)
            .linear_damping(0.1)
            .build();

        let body_handle = rigid_body_set.insert(rigid_body);

        let collider = ColliderBuilder::ball(object_radius)
            .restitution(0.3)
            .friction(0.6)
            .density(1.0)
            .build();

        collider_set.insert_with_parent(collider, body_handle, &mut rigid_body_set);
        body_handles.push(body_handle);
    }

    // Run simulation
    for _ in 0..iterations {
        physics_pipeline.step(
            &gravity_vec,
            &integration_parameters,
            &mut island_manager,
            &mut broad_phase,
            &mut narrow_phase,
            &mut rigid_body_set,
            &mut collider_set,
            &mut impulse_joint_set,
            &mut multibody_joint_set,
            &mut ccd_solver,
            None,
            &(),
            &(),
        );
    }

    // Extract final transforms
    let results: Vec<ScatterTransform> = body_handles
        .iter()
        .filter_map(|handle| {
            rigid_body_set.get(*handle).map(|body| {
                let pos = body.translation();
                let rot = body.rotation();
                ScatterTransform {
                    position: [pos.x, pos.y, pos.z],
                    rotation: [rot.i, rot.j, rot.k, rot.w],
                    scale: [1.0, 1.0, 1.0],
                }
            })
        })
        .collect();

    log::info!(
        "[K_OS Scatter] Physics drop: {} objects after {} iterations",
        results.len(),
        iterations
    );
    Ok(results)
}

// ============================================================================
// VORONOI CELLS
// ============================================================================

/// Voronoi cell-based scatter: places points at cell centroids
pub fn voronoi_cell_scatter(count: usize, radius: f32, seed: u64) -> Result<Vec<[f32; 3]>, String> {
    use fastrand::Rng;
    use voronoice::{BoundingBox, VoronoiBuilder};

    let mut rng = Rng::with_seed(seed);

    // Generate seed points for Voronoi
    let sites: Vec<voronoice::Point> = (0..count)
        .map(|_| voronoice::Point {
            x: (rng.f64() - 0.5) * radius as f64 * 2.0,
            y: (rng.f64() - 0.5) * radius as f64 * 2.0,
        })
        .collect();

    let bounding_box = BoundingBox::new_centered_square(radius as f64 * 2.5);

    let voronoi = VoronoiBuilder::default()
        .set_sites(sites)
        .set_bounding_box(bounding_box)
        .set_lloyd_relaxation_iterations(3) // Smooths distribution
        .build();

    match voronoi {
        Some(v) => {
            // Use cell centroids as scatter points
            let points: Vec<[f32; 3]> = v
                .sites()
                .iter()
                .map(|site| [site.x as f32, 0.0, site.y as f32])
                .collect();

            log::info!("[K_OS Scatter] Voronoi: {} cells", points.len());
            Ok(points)
        }
        None => Err("Voronoi generation failed".to_string()),
    }
}

// ============================================================================
// MATHEMATICAL PATTERNS
// ============================================================================

/// Fibonacci spiral (3D phyllotaxis) - golden angle distribution
pub fn fibonacci_spiral_scatter(
    count: usize,
    radius: f32,
    height: f32,
) -> Result<Vec<[f32; 3]>, String> {
    let golden_angle = std::f32::consts::PI * (3.0 - 5.0_f32.sqrt()); // ~137.5 degrees

    let points: Vec<[f32; 3]> = (0..count)
        .map(|i| {
            let t = i as f32 / count as f32;
            let angle = i as f32 * golden_angle;
            let r = t.sqrt() * radius; // Sqrt for uniform disk density

            let x = r * angle.cos();
            let z = r * angle.sin();
            let y = t * height - height * 0.5;

            [x, y, z]
        })
        .collect();

    log::info!("[K_OS Scatter] Fibonacci spiral: {} points", points.len());
    Ok(points)
}

/// Sunflower disk pattern (2D Fibonacci on plane)
pub fn sunflower_disk_scatter(count: usize, radius: f32) -> Result<Vec<[f32; 3]>, String> {
    let golden_angle = std::f32::consts::PI * (3.0 - 5.0_f32.sqrt());

    let points: Vec<[f32; 3]> = (0..count)
        .map(|i| {
            let angle = i as f32 * golden_angle;
            let r = (i as f32 / count as f32).sqrt() * radius;

            [r * angle.cos(), 0.0, r * angle.sin()]
        })
        .collect();

    log::info!("[K_OS Scatter] Sunflower disk: {} points", points.len());
    Ok(points)
}

/// Halton sequence (low-discrepancy quasi-random)
pub fn halton_scatter(count: usize, radius: f32) -> Result<Vec<[f32; 3]>, String> {
    let points: Vec<[f32; 3]> = (0..count)
        .map(|i| {
            let x = halton_sequence(i, 2) * 2.0 - 1.0;
            let y = halton_sequence(i, 3) * 2.0 - 1.0;
            let z = halton_sequence(i, 5) * 2.0 - 1.0;

            [x * radius, y * radius, z * radius]
        })
        .collect();

    log::info!("[K_OS Scatter] Halton sequence: {} points", points.len());
    Ok(points)
}

fn halton_sequence(mut index: usize, base: usize) -> f32 {
    let mut result = 0.0;
    let mut f = 1.0 / base as f32;

    while index > 0 {
        result += f * (index % base) as f32;
        index /= base;
        f /= base as f32;
    }

    result
}

// ============================================================================
// NATURE-INSPIRED PATTERNS
// ============================================================================

/// Clustered distribution with organic feel
pub fn cluster_scatter(
    count: usize,
    radius: f32,
    cluster_count: usize,
    cluster_tightness: f32,
    seed: u64,
) -> Result<Vec<[f32; 3]>, String> {
    use fastrand::Rng;

    let mut rng = Rng::with_seed(seed);

    // Generate cluster centers
    let clusters: Vec<[f32; 3]> = (0..cluster_count)
        .map(|_| {
            let theta = rng.f32() * std::f32::consts::PI * 2.0;
            let phi = (rng.f32() * 2.0 - 1.0).acos();
            let r = rng.f32().powf(0.5) * radius * 0.7;

            [
                r * phi.sin() * theta.cos(),
                r * phi.sin() * theta.sin(),
                r * phi.cos(),
            ]
        })
        .collect();

    // Distribute points around clusters
    let points: Vec<[f32; 3]> = (0..count)
        .map(|_| {
            let cluster = &clusters[rng.usize(0..cluster_count)];
            let offset_radius = radius * (1.0 - cluster_tightness) * 0.3;

            let ox = (rng.f32() - 0.5) * offset_radius * 2.0;
            let oy = (rng.f32() - 0.5) * offset_radius * 2.0;
            let oz = (rng.f32() - 0.5) * offset_radius * 2.0;

            [cluster[0] + ox, cluster[1] + oy, cluster[2] + oz]
        })
        .collect();

    log::info!(
        "[K_OS Scatter] Cluster: {} points in {} clusters",
        points.len(),
        cluster_count
    );
    Ok(points)
}

/// Organic distribution using noise-based density
pub fn organic_scatter(
    count: usize,
    radius: f32,
    noise_scale: f32,
    density_threshold: f32,
    seed: u64,
) -> Result<Vec<[f32; 3]>, String> {
    use fastrand::Rng;
    use noise::{NoiseFn, Simplex};

    let mut rng = Rng::with_seed(seed);
    let noise = Simplex::new(seed as u32);

    let mut points = Vec::with_capacity(count);
    let max_attempts = count * 20;
    let mut attempts = 0;

    while points.len() < count && attempts < max_attempts {
        attempts += 1;

        let x = (rng.f32() - 0.5) * radius * 2.0;
        let y = (rng.f32() - 0.5) * radius * 2.0;
        let z = (rng.f32() - 0.5) * radius * 2.0;

        // Use noise as density function
        let density = noise.get([
            (x * noise_scale) as f64,
            (y * noise_scale) as f64,
            (z * noise_scale) as f64,
        ]) as f32
            * 0.5
            + 0.5;

        if density > density_threshold && rng.f32() < density {
            points.push([x, y, z]);
        }
    }

    log::info!("[K_OS Scatter] Organic: {} points", points.len());
    Ok(points)
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/// Calculate quaternion to rotate from one vector to another
fn quaternion_from_to(from: [f32; 3], to: [f32; 3]) -> [f32; 4] {
    let from_len = (from[0] * from[0] + from[1] * from[1] + from[2] * from[2]).sqrt();
    let to_len = (to[0] * to[0] + to[1] * to[1] + to[2] * to[2]).sqrt();

    if from_len < 0.0001 || to_len < 0.0001 {
        return [0.0, 0.0, 0.0, 1.0];
    }

    let from = [from[0] / from_len, from[1] / from_len, from[2] / from_len];
    let to = [to[0] / to_len, to[1] / to_len, to[2] / to_len];

    // Cross product
    let cx = from[1] * to[2] - from[2] * to[1];
    let cy = from[2] * to[0] - from[0] * to[2];
    let cz = from[0] * to[1] - from[1] * to[0];

    // Dot product
    let dot = from[0] * to[0] + from[1] * to[1] + from[2] * to[2];

    let w = 1.0 + dot;
    let len = (cx * cx + cy * cy + cz * cz + w * w).sqrt();

    if len < 0.0001 {
        // Vectors are opposite, return 180 degree rotation
        return [1.0, 0.0, 0.0, 0.0];
    }

    [cx / len, cy / len, cz / len, w / len]
}
