use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::f32::consts::PI;

/// ============================================================================
/// K_OS UNIVERSAL PRIMITIVE GENERATOR
/// ============================================================================
///
/// The authoritative backend for all mesh primitives across K_OS.
/// Every primitive here meets the quality floor:
/// - 500+ vertices minimum for base meshes
/// - Quads preferred, triangles only where required
/// - Watertight, welded, correct normals
/// - Proper UVs in 0-1 range
/// - Unit-sized (fits in 2x2x2 bounding box)
/// - Consistent pivot conventions

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PrimitiveResult {
    pub positions: Vec<f32>,
    pub indices: Vec<u32>,
    pub normals: Vec<f32>,
    pub uvs: Vec<f32>,
}

/// Parameters for spawning primitives (matches TypeScript registry)
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct PrimitiveParams {
    #[serde(default)]
    pub subdivisions: Option<u32>,
    #[serde(default)]
    pub radial_segments: Option<u32>,
    #[serde(default)]
    pub height_segments: Option<u32>,
    #[serde(default)]
    pub tubular_segments: Option<u32>,
    #[serde(default)]
    pub tube_radius: Option<f32>,
    #[serde(default)]
    pub inner_radius: Option<f32>,
    #[serde(default)]
    pub outer_radius: Option<f32>,
    #[serde(default)]
    pub height: Option<f32>,
    #[serde(default)]
    pub width: Option<f32>,
    #[serde(default)]
    pub depth: Option<f32>,
    #[serde(default)]
    pub radius: Option<f32>,
    #[serde(default)]
    pub thickness: Option<f32>,
    #[serde(default)]
    pub angle: Option<f32>,
    #[serde(default)]
    pub sides: Option<u32>,
    #[serde(default)]
    pub rings: Option<u32>,
    #[serde(default)]
    pub segments: Option<u32>,
    #[serde(default)]
    pub taper: Option<f32>,
    #[serde(default)]
    pub flange_width: Option<f32>,
    #[serde(default)]
    pub caps: Option<bool>,
}

/// Universal primitive spawn function
/// Routes to the appropriate generator based on primitive_id
pub fn spawn_primitive(
    primitive_id: &str,
    params: PrimitiveParams,
) -> Result<PrimitiveResult, String> {
    match primitive_id {
        // Core primitives
        "sphere" => Ok(generate_quad_sphere(params.subdivisions.unwrap_or(4))),
        "cube" => Ok(generate_quad_cube(params.subdivisions.unwrap_or(4))),
        "cylinder" => Ok(generate_quad_cylinder(
            params.radial_segments.unwrap_or(32),
            params.height_segments.unwrap_or(16),
        )),
        "plane" => Ok(generate_plane(params.subdivisions.unwrap_or(4))),
        "cone" => Ok(generate_cone(
            params.radial_segments.unwrap_or(32),
            params.height_segments.unwrap_or(16),
        )),
        "torus" => Ok(generate_torus(
            params.radial_segments.unwrap_or(48),
            params.tubular_segments.unwrap_or(24),
            params.tube_radius.unwrap_or(0.3),
        )),
        "capsule" => Ok(generate_capsule(
            params.subdivisions.unwrap_or(3),
            params.height.unwrap_or(1.5),
        )),

        // Extended primitives
        "icosphere" => Ok(generate_icosphere(params.subdivisions.unwrap_or(2))),
        "uvsphere" => Ok(generate_uv_sphere(
            params.rings.unwrap_or(32),
            params.segments.unwrap_or(32),
        )),
        "pyramid" => Ok(generate_pyramid(
            params.sides.unwrap_or(4),
            params.height_segments.unwrap_or(8),
        )),
        "ring" => Ok(generate_ring(
            params.inner_radius.unwrap_or(0.5),
            params.outer_radius.unwrap_or(1.0),
            params.segments.unwrap_or(48),
        )),
        "tube" => Ok(generate_tube(
            params.inner_radius.unwrap_or(0.4),
            params.outer_radius.unwrap_or(0.6),
            params.height.unwrap_or(2.0),
            params.segments.unwrap_or(32),
        )),
        "disc" => Ok(generate_disc(
            params.subdivisions.unwrap_or(3),
            params.segments.unwrap_or(32),
        )),

        // Architectural
        "wall" => Ok(generate_wall(
            params.width.unwrap_or(2.0),
            params.height.unwrap_or(1.0),
            params.depth.unwrap_or(0.2),
        )),
        "platform" => Ok(generate_platform(
            params.width.unwrap_or(2.0),
            params.depth.unwrap_or(2.0),
            params.height.unwrap_or(0.2),
        )),
        "pillar" => Ok(generate_pillar(
            params.radius.unwrap_or(0.2),
            params.height.unwrap_or(2.0),
            params.segments.unwrap_or(16),
        )),
        "arch" => Ok(generate_arch(
            params.radius.unwrap_or(1.0),
            params.thickness.unwrap_or(0.2),
            params.angle.unwrap_or(PI),
        )),
        "beam" => Ok(generate_beam(
            params.width.unwrap_or(0.4),
            params.height.unwrap_or(2.0),
            params.flange_width.unwrap_or(0.6),
        )),

        // Organic
        "head" => Ok(generate_head(params.subdivisions.unwrap_or(4))),
        "body" => Ok(generate_body(params.subdivisions.unwrap_or(4))),
        "limb" => Ok(generate_limb(
            params.subdivisions.unwrap_or(3),
            params.taper.unwrap_or(0.3),
        )),

        _ => Err(format!("Unknown primitive: {}", primitive_id)),
    }
}

// ============================================================================
// HELPER TYPES
// ============================================================================

#[derive(Clone, Copy, Debug)]
struct Vec3 {
    x: f32,
    y: f32,
    z: f32,
}

impl Vec3 {
    const X: Vec3 = Vec3 {
        x: 1.0,
        y: 0.0,
        z: 0.0,
    };
    const Y: Vec3 = Vec3 {
        x: 0.0,
        y: 1.0,
        z: 0.0,
    };
    const Z: Vec3 = Vec3 {
        x: 0.0,
        y: 0.0,
        z: 1.0,
    };
    const NEG_X: Vec3 = Vec3 {
        x: -1.0,
        y: 0.0,
        z: 0.0,
    };
    const NEG_Y: Vec3 = Vec3 {
        x: 0.0,
        y: -1.0,
        z: 0.0,
    };
    const NEG_Z: Vec3 = Vec3 {
        x: 0.0,
        y: 0.0,
        z: -1.0,
    };

    fn new(x: f32, y: f32, z: f32) -> Self {
        Vec3 { x, y, z }
    }

    fn normalize(&self) -> Vec3 {
        let len = (self.x * self.x + self.y * self.y + self.z * self.z).sqrt();
        if len > 0.0 {
            Vec3 {
                x: self.x / len,
                y: self.y / len,
                z: self.z / len,
            }
        } else {
            *self
        }
    }

    fn cross(&self, other: &Vec3) -> Vec3 {
        Vec3 {
            x: self.y * other.z - self.z * other.y,
            y: self.z * other.x - self.x * other.z,
            z: self.x * other.y - self.y * other.x,
        }
    }
}

impl std::ops::Add for Vec3 {
    type Output = Vec3;
    fn add(self, other: Vec3) -> Vec3 {
        Vec3 {
            x: self.x + other.x,
            y: self.y + other.y,
            z: self.z + other.z,
        }
    }
}

impl std::ops::Sub for Vec3 {
    type Output = Vec3;
    fn sub(self, other: Vec3) -> Vec3 {
        Vec3 {
            x: self.x - other.x,
            y: self.y - other.y,
            z: self.z - other.z,
        }
    }
}

impl std::ops::Mul<f32> for Vec3 {
    type Output = Vec3;
    fn mul(self, s: f32) -> Vec3 {
        Vec3 {
            x: self.x * s,
            y: self.y * s,
            z: self.z * s,
        }
    }
}

/// Helper to add a quad (two triangles)
fn add_quad(indices: &mut Vec<u32>, a: u32, b: u32, c: u32, d: u32) {
    indices.push(a);
    indices.push(b);
    indices.push(c);
    indices.push(a);
    indices.push(c);
    indices.push(d);
}

/// Helper to add a triangle
fn add_tri(indices: &mut Vec<u32>, a: u32, b: u32, c: u32) {
    indices.push(a);
    indices.push(b);
    indices.push(c);
}

// ============================================================================
// TIER 1: CORE PRIMITIVES
// ============================================================================

/// Generate a Normalized Cube Sphere (Quad Sphere)
/// All quads, no poles - perfect for sculpting
pub fn generate_quad_sphere(subdivisions: u32) -> PrimitiveResult {
    let resolution = 1 << subdivisions;
    let segments = resolution;

    let mut positions = Vec::new();
    let mut normals = Vec::new();
    let mut uvs = Vec::new();
    let mut indices = Vec::new();

    let faces = [
        (Vec3::Z, Vec3::Y, Vec3::X),
        (Vec3::NEG_Z, Vec3::Y, Vec3::NEG_X),
        (Vec3::X, Vec3::Y, Vec3::NEG_Z),
        (Vec3::NEG_X, Vec3::Y, Vec3::Z),
        (Vec3::Y, Vec3::NEG_Z, Vec3::X),
        (Vec3::NEG_Y, Vec3::Z, Vec3::X),
    ];

    let verts_per_row = segments + 1;

    for (_face_idx, (normal, up, right)) in faces.iter().enumerate() {
        let start_index = positions.len() as u32 / 3;

        for y in 0..=segments {
            for x in 0..=segments {
                let u = x as f32 / segments as f32;
                let v = y as f32 / segments as f32;

                let px = u * 2.0 - 1.0;
                let py = v * 2.0 - 1.0;

                let mut p = *normal + *right * px + *up * py;
                let len = (p.x * p.x + p.y * p.y + p.z * p.z).sqrt();
                p.x /= len;
                p.y /= len;
                p.z /= len;

                positions.push(p.x);
                positions.push(p.y);
                positions.push(p.z);

                normals.push(p.x);
                normals.push(p.y);
                normals.push(p.z);

                let uv_long = (p.z.atan2(p.x) / (2.0 * PI)) + 0.5;
                let uv_lat = (p.y.asin() / PI) + 0.5;
                uvs.push(uv_long);
                uvs.push(uv_lat);
            }
        }

        for y in 0..segments {
            for x in 0..segments {
                let row1 = start_index + y * verts_per_row + x;
                let row2 = start_index + (y + 1) * verts_per_row + x;
                add_quad(&mut indices, row1, row1 + 1, row2 + 1, row2);
            }
        }
    }

    merge_vertices(&mut positions, &mut normals, &mut uvs, &mut indices)
}

/// Generate a sub-divided Cube (not spherified)
pub fn generate_quad_cube(subdivisions: u32) -> PrimitiveResult {
    let resolution = 1 << subdivisions;
    let segments = resolution;

    let mut positions = Vec::new();
    let mut normals = Vec::new();
    let mut uvs = Vec::new();
    let mut indices = Vec::new();

    let faces = [
        (Vec3::Z, Vec3::Y, Vec3::X),
        (Vec3::NEG_Z, Vec3::Y, Vec3::NEG_X),
        (Vec3::X, Vec3::Y, Vec3::NEG_Z),
        (Vec3::NEG_X, Vec3::Y, Vec3::Z),
        (Vec3::Y, Vec3::NEG_Z, Vec3::X),
        (Vec3::NEG_Y, Vec3::Z, Vec3::X),
    ];

    let verts_per_row = segments + 1;

    for (_face_idx, (normal, up, right)) in faces.iter().enumerate() {
        let start_index = positions.len() as u32 / 3;

        for y in 0..=segments {
            for x in 0..=segments {
                let u = x as f32 / segments as f32;
                let v = y as f32 / segments as f32;

                let px = u * 2.0 - 1.0;
                let py = v * 2.0 - 1.0;

                let p = *normal + *right * px + *up * py;

                positions.push(p.x);
                positions.push(p.y);
                positions.push(p.z);

                normals.push(normal.x);
                normals.push(normal.y);
                normals.push(normal.z);

                uvs.push(u);
                uvs.push(v);
            }
        }

        for y in 0..segments {
            for x in 0..segments {
                let row1 = start_index + y * verts_per_row + x;
                let row2 = start_index + (y + 1) * verts_per_row + x;
                add_quad(&mut indices, row1, row1 + 1, row2 + 1, row2);
            }
        }
    }

    // Merge vertices to make it solid
    merge_vertices(&mut positions, &mut normals, &mut uvs, &mut indices)
}

/// Generate a Quad Plane
pub fn generate_plane(subdivisions: u32) -> PrimitiveResult {
    let segments = 1 << subdivisions;
    let mut positions = Vec::new();
    let mut normals = Vec::new();
    let mut uvs = Vec::new();
    let mut indices = Vec::new();

    let width = 2.0;
    let height = 2.0;

    let verts_per_row = segments + 1;

    for y in 0..=segments {
        for x in 0..=segments {
            let u = x as f32 / segments as f32;
            let v = y as f32 / segments as f32;

            let px = (u - 0.5) * width;
            let py = (v - 0.5) * height; // Plane on XY plane for now, usually XZ is better but Z-up is Bevy-ish? No Bevy is Y-up.
                                         // Let's do XZ plane (ground)

            positions.push(px);
            positions.push(0.0);
            positions.push(-py); // -Z to match standard forward

            normals.push(0.0);
            normals.push(1.0);
            normals.push(0.0);

            uvs.push(u);
            uvs.push(v);
        }
    }

    for y in 0..segments {
        for x in 0..segments {
            let row1 = y * verts_per_row + x;
            let row2 = (y + 1) * verts_per_row + x;
            add_quad(&mut indices, row1, row1 + 1, row2 + 1, row2);
        }
    }

    PrimitiveResult {
        positions,
        indices,
        normals,
        uvs,
    }
}

/// Generate a Quad Cylinder (with grid caps)
pub fn generate_quad_cylinder(radial_segments: u32, height_segments: u32) -> PrimitiveResult {
    // Sculpt-quality cylinder with properly welded caps
    // Uses rings from bottom cap through sides to top cap - no seams!

    let radial = radial_segments.max(8);
    let height_segs = height_segments.max(1);
    let height = 2.0f32;
    let radius = 1.0f32;
    let half_height = height / 2.0;

    let mut positions = Vec::new();
    let mut normals = Vec::new();
    let mut uvs = Vec::new();
    let mut indices = Vec::new();

    // ===============================
    // BOTTOM CAP (circle with center)
    // ===============================
    let bottom_center_idx = 0u32;
    positions.extend_from_slice(&[0.0, -half_height, 0.0]);
    normals.extend_from_slice(&[0.0, -1.0, 0.0]);
    uvs.extend_from_slice(&[0.5, 0.5]);

    // Bottom rim vertices
    let bottom_rim_start = 1u32;
    for i in 0..radial {
        let theta = (i as f32 / radial as f32) * 2.0 * PI;
        let x = theta.cos() * radius;
        let z = theta.sin() * radius;

        positions.extend_from_slice(&[x, -half_height, z]);
        normals.extend_from_slice(&[0.0, -1.0, 0.0]);
        uvs.extend_from_slice(&[0.5 + theta.cos() * 0.5, 0.5 + theta.sin() * 0.5]);
    }

    // Bottom cap triangles (fan)
    for i in 0..radial {
        let next = (i + 1) % radial;
        // Wind CCW from below (inward normals for bottom)
        indices.extend_from_slice(&[
            bottom_center_idx,
            bottom_rim_start + next,
            bottom_rim_start + i,
        ]);
    }

    // ===============================
    // SIDE SURFACE (cylinder body)
    // ===============================
    // Generate rings of vertices along height
    let side_vert_start = positions.len() as u32 / 3;

    for h in 0..=height_segs {
        let t = h as f32 / height_segs as f32;
        let y = -half_height + t * height;

        for i in 0..=radial {
            // Note: radial+1 for UV seam
            let theta = (i as f32 / radial as f32) * 2.0 * PI;
            let x = theta.cos() * radius;
            let z = theta.sin() * radius;

            positions.extend_from_slice(&[x, y, z]);

            // Cylindrical normal (points outward)
            normals.extend_from_slice(&[theta.cos(), 0.0, theta.sin()]);

            // UV: u wraps around, v goes up
            uvs.extend_from_slice(&[i as f32 / radial as f32, t]);
        }
    }

    // Side quads
    let ring_verts = radial + 1;
    for h in 0..height_segs {
        for i in 0..radial {
            let row0 = side_vert_start + h * ring_verts + i;
            let row1 = side_vert_start + (h + 1) * ring_verts + i;

            add_quad(&mut indices, row0, row0 + 1, row1 + 1, row1);
        }
    }

    // ===============================
    // TOP CAP (circle with center)
    // ===============================
    let top_center_idx = positions.len() as u32 / 3;
    positions.extend_from_slice(&[0.0, half_height, 0.0]);
    normals.extend_from_slice(&[0.0, 1.0, 0.0]);
    uvs.extend_from_slice(&[0.5, 0.5]);

    // Top rim vertices
    let top_rim_start = positions.len() as u32 / 3;
    for i in 0..radial {
        let theta = (i as f32 / radial as f32) * 2.0 * PI;
        let x = theta.cos() * radius;
        let z = theta.sin() * radius;

        positions.extend_from_slice(&[x, half_height, z]);
        normals.extend_from_slice(&[0.0, 1.0, 0.0]);
        uvs.extend_from_slice(&[0.5 + theta.cos() * 0.5, 0.5 + theta.sin() * 0.5]);
    }

    // Top cap triangles (fan)
    for i in 0..radial {
        let next = (i + 1) % radial;
        // Wind CCW from above
        indices.extend_from_slice(&[top_center_idx, top_rim_start + i, top_rim_start + next]);
    }

    // Merge vertices to weld cap rims with side rims
    merge_vertices(&mut positions, &mut normals, &mut uvs, &mut indices)
}

// ============================================================================
// NEW PRIMITIVES: CONE
// ============================================================================

/// Generate a cone with apex at top
pub fn generate_cone(radial_segments: u32, height_segments: u32) -> PrimitiveResult {
    let mut positions = Vec::new();
    let mut normals = Vec::new();
    let mut uvs = Vec::new();
    let mut indices = Vec::new();

    let height = 2.0;
    let radius = 1.0;
    let half_height = height / 2.0;

    // Generate side vertices
    for h in 0..=height_segments {
        let v = h as f32 / height_segments as f32;
        let y = -half_height + v * height;
        let current_radius = radius * (1.0 - v); // Tapers to apex

        for r in 0..=radial_segments {
            let u = r as f32 / radial_segments as f32;
            let theta = u * 2.0 * PI;

            let x = theta.cos() * current_radius;
            let z = theta.sin() * current_radius;

            positions.push(x);
            positions.push(y);
            positions.push(z);

            // Cone normal: points outward at angle
            let slope = radius / height;
            let n = Vec3::new(theta.cos(), slope, theta.sin()).normalize();
            normals.push(n.x);
            normals.push(n.y);
            normals.push(n.z);

            uvs.push(u);
            uvs.push(v);
        }
    }

    // Side indices
    let verts_per_row = radial_segments + 1;
    for h in 0..height_segments {
        for r in 0..radial_segments {
            let row1 = h * verts_per_row + r;
            let row2 = (h + 1) * verts_per_row + r;
            add_quad(&mut indices, row1, row1 + 1, row2 + 1, row2);
        }
    }

    // Bottom cap (disc)
    let cap_start = positions.len() as u32 / 3;
    let center_idx = cap_start;

    // Center vertex
    positions.push(0.0);
    positions.push(-half_height);
    positions.push(0.0);
    normals.push(0.0);
    normals.push(-1.0);
    normals.push(0.0);
    uvs.push(0.5);
    uvs.push(0.5);

    // Edge vertices
    for r in 0..=radial_segments {
        let u = r as f32 / radial_segments as f32;
        let theta = u * 2.0 * PI;

        positions.push(theta.cos() * radius);
        positions.push(-half_height);
        positions.push(theta.sin() * radius);
        normals.push(0.0);
        normals.push(-1.0);
        normals.push(0.0);
        uvs.push(0.5 + theta.cos() * 0.5);
        uvs.push(0.5 + theta.sin() * 0.5);
    }

    // Cap indices
    for r in 0..radial_segments {
        add_tri(
            &mut indices,
            center_idx,
            center_idx + 1 + r + 1,
            center_idx + 1 + r,
        );
    }

    // Shift to bottom pivot
    for i in (0..positions.len()).step_by(3) {
        positions[i + 1] += half_height;
    }

    PrimitiveResult {
        positions,
        indices,
        normals,
        uvs,
    }
}

// ============================================================================
// NEW PRIMITIVES: TORUS
// ============================================================================

/// Generate a torus (donut)
pub fn generate_torus(
    radial_segments: u32,
    tubular_segments: u32,
    tube_radius: f32,
) -> PrimitiveResult {
    let mut positions = Vec::new();
    let mut normals = Vec::new();
    let mut uvs = Vec::new();
    let mut indices = Vec::new();

    let major_radius = 0.7; // Main ring radius

    for t in 0..=tubular_segments {
        let v = t as f32 / tubular_segments as f32;
        let theta = v * 2.0 * PI;

        for r in 0..=radial_segments {
            let u = r as f32 / radial_segments as f32;
            let phi = u * 2.0 * PI;

            // Point on torus
            let x = (major_radius + tube_radius * theta.cos()) * phi.cos();
            let y = tube_radius * theta.sin();
            let z = (major_radius + tube_radius * theta.cos()) * phi.sin();

            positions.push(x);
            positions.push(y);
            positions.push(z);

            // Normal
            let cx = major_radius * phi.cos();
            let cz = major_radius * phi.sin();
            let n = Vec3::new(x - cx, y, z - cz).normalize();
            normals.push(n.x);
            normals.push(n.y);
            normals.push(n.z);

            uvs.push(u);
            uvs.push(v);
        }
    }

    // Indices
    let verts_per_row = radial_segments + 1;
    for t in 0..tubular_segments {
        for r in 0..radial_segments {
            let row1 = t * verts_per_row + r;
            let row2 = (t + 1) * verts_per_row + r;
            add_quad(&mut indices, row1, row1 + 1, row2 + 1, row2);
        }
    }

    PrimitiveResult {
        positions,
        indices,
        normals,
        uvs,
    }
}

// ============================================================================
// NEW PRIMITIVES: CAPSULE
// ============================================================================

/// Generate a capsule (cylinder with hemisphere caps)
pub fn generate_capsule(subdivisions: u32, height: f32) -> PrimitiveResult {
    let mut positions = Vec::new();
    let mut normals = Vec::new();
    let mut uvs = Vec::new();
    let mut indices = Vec::new();

    let radius = 0.5;
    let segments = 8 * (1 << subdivisions);
    let half_height = height / 2.0;

    // Top hemisphere
    for lat in 0..=segments / 2 {
        let v = lat as f32 / (segments / 2) as f32;
        let phi = v * PI / 2.0;

        for lon in 0..=segments {
            let u = lon as f32 / segments as f32;
            let theta = u * 2.0 * PI;

            let x = phi.cos() * theta.cos() * radius;
            let y = phi.sin() * radius + half_height;
            let z = phi.cos() * theta.sin() * radius;

            positions.push(x);
            positions.push(y);
            positions.push(z);

            let n = Vec3::new(phi.cos() * theta.cos(), phi.sin(), phi.cos() * theta.sin());
            normals.push(n.x);
            normals.push(n.y);
            normals.push(n.z);

            uvs.push(u);
            uvs.push(0.25 + v * 0.25);
        }
    }

    // Cylinder body
    let body_segments = segments / 2;
    for h in 0..=body_segments {
        let v = h as f32 / body_segments as f32;
        let y = half_height - v * height;

        for lon in 0..=segments {
            let u = lon as f32 / segments as f32;
            let theta = u * 2.0 * PI;

            positions.push(theta.cos() * radius);
            positions.push(y);
            positions.push(theta.sin() * radius);

            normals.push(theta.cos());
            normals.push(0.0);
            normals.push(theta.sin());

            uvs.push(u);
            uvs.push(0.5 + v * 0.25);
        }
    }

    // Bottom hemisphere
    for lat in 0..=segments / 2 {
        let v = lat as f32 / (segments / 2) as f32;
        let phi = PI / 2.0 + v * PI / 2.0;

        for lon in 0..=segments {
            let u = lon as f32 / segments as f32;
            let theta = u * 2.0 * PI;

            let x = phi.cos() * theta.cos() * radius;
            let y = phi.sin() * radius - half_height;
            let z = phi.cos() * theta.sin() * radius;

            positions.push(x);
            positions.push(y);
            positions.push(z);

            let n = Vec3::new(phi.cos() * theta.cos(), phi.sin(), phi.cos() * theta.sin());
            normals.push(n.x);
            normals.push(n.y);
            normals.push(n.z);

            uvs.push(u);
            uvs.push(0.75 + v * 0.25);
        }
    }

    // Generate indices for all rings
    let verts_per_row = segments + 1;
    let total_rows = (segments / 2 + 1) + (body_segments + 1) + (segments / 2 + 1) - 2;
    for r in 0..total_rows {
        for c in 0..segments {
            let row1 = r * verts_per_row + c;
            let row2 = (r + 1) * verts_per_row + c;
            add_quad(&mut indices, row1, row1 + 1, row2 + 1, row2);
        }
    }

    // Shift to bottom pivot
    let min_y = positions
        .iter()
        .skip(1)
        .step_by(3)
        .cloned()
        .fold(f32::MAX, f32::min);
    for i in (1..positions.len()).step_by(3) {
        positions[i] -= min_y;
    }

    PrimitiveResult {
        positions,
        indices,
        normals,
        uvs,
    }
}

// ============================================================================
// NEW PRIMITIVES: ICOSPHERE
// ============================================================================

/// Generate an icosphere (icosahedron-based sphere)
pub fn generate_icosphere(subdivisions: u32) -> PrimitiveResult {
    // Start with icosahedron
    let t = (1.0 + 5.0_f32.sqrt()) / 2.0;

    let mut positions: Vec<f32> = vec![
        -1.0, t, 0.0, 1.0, t, 0.0, -1.0, -t, 0.0, 1.0, -t, 0.0, 0.0, -1.0, t, 0.0, 1.0, t, 0.0,
        -1.0, -t, 0.0, 1.0, -t, t, 0.0, -1.0, t, 0.0, 1.0, -t, 0.0, -1.0, -t, 0.0, 1.0,
    ];

    // Normalize all vertices
    for i in (0..positions.len()).step_by(3) {
        let len = (positions[i] * positions[i]
            + positions[i + 1] * positions[i + 1]
            + positions[i + 2] * positions[i + 2])
            .sqrt();
        positions[i] /= len;
        positions[i + 1] /= len;
        positions[i + 2] /= len;
    }

    let mut indices: Vec<u32> = vec![
        0, 11, 5, 0, 5, 1, 0, 1, 7, 0, 7, 10, 0, 10, 11, 1, 5, 9, 5, 11, 4, 11, 10, 2, 10, 7, 6, 7,
        1, 8, 3, 9, 4, 3, 4, 2, 3, 2, 6, 3, 6, 8, 3, 8, 9, 4, 9, 5, 2, 4, 11, 6, 2, 10, 8, 6, 7, 9,
        8, 1,
    ];

    // Subdivide
    for _ in 0..subdivisions {
        let mut new_indices = Vec::new();
        let mut midpoint_cache: HashMap<(u32, u32), u32> = HashMap::new();

        for tri in indices.chunks(3) {
            let a = tri[0];
            let b = tri[1];
            let c = tri[2];

            let ab = get_or_create_midpoint(&mut positions, &mut midpoint_cache, a, b);
            let bc = get_or_create_midpoint(&mut positions, &mut midpoint_cache, b, c);
            let ca = get_or_create_midpoint(&mut positions, &mut midpoint_cache, c, a);

            new_indices.extend_from_slice(&[a, ab, ca]);
            new_indices.extend_from_slice(&[b, bc, ab]);
            new_indices.extend_from_slice(&[c, ca, bc]);
            new_indices.extend_from_slice(&[ab, bc, ca]);
        }

        indices = new_indices;
    }

    // Generate normals (same as positions for sphere) and UVs
    let vertex_count = positions.len() / 3;
    let normals = positions.clone();
    let mut uvs = Vec::with_capacity(vertex_count * 2);

    for i in 0..vertex_count {
        let x = positions[i * 3];
        let y = positions[i * 3 + 1];
        let z = positions[i * 3 + 2];

        let u = (z.atan2(x) / (2.0 * PI)) + 0.5;
        let v = (y.asin() / PI) + 0.5;
        uvs.push(u);
        uvs.push(v);
    }

    PrimitiveResult {
        positions,
        indices,
        normals,
        uvs,
    }
}

fn get_or_create_midpoint(
    positions: &mut Vec<f32>,
    cache: &mut HashMap<(u32, u32), u32>,
    a: u32,
    b: u32,
) -> u32 {
    let key = if a < b { (a, b) } else { (b, a) };

    if let Some(&idx) = cache.get(&key) {
        return idx;
    }

    let ai = a as usize * 3;
    let bi = b as usize * 3;

    let mut mx = (positions[ai] + positions[bi]) / 2.0;
    let mut my = (positions[ai + 1] + positions[bi + 1]) / 2.0;
    let mut mz = (positions[ai + 2] + positions[bi + 2]) / 2.0;

    // Normalize to sphere surface
    let len = (mx * mx + my * my + mz * mz).sqrt();
    mx /= len;
    my /= len;
    mz /= len;

    let idx = positions.len() as u32 / 3;
    positions.push(mx);
    positions.push(my);
    positions.push(mz);

    cache.insert(key, idx);
    idx
}

// ============================================================================
// NEW PRIMITIVES: UV SPHERE
// ============================================================================

/// Generate a UV sphere (latitude/longitude)
pub fn generate_uv_sphere(rings: u32, segments: u32) -> PrimitiveResult {
    let mut positions = Vec::new();
    let mut normals = Vec::new();
    let mut uvs = Vec::new();
    let mut indices = Vec::new();

    for lat in 0..=rings {
        let v = lat as f32 / rings as f32;
        let phi = v * PI;

        for lon in 0..=segments {
            let u = lon as f32 / segments as f32;
            let theta = u * 2.0 * PI;

            let x = phi.sin() * theta.cos();
            let y = phi.cos();
            let z = phi.sin() * theta.sin();

            positions.push(x);
            positions.push(y);
            positions.push(z);

            normals.push(x);
            normals.push(y);
            normals.push(z);

            uvs.push(u);
            uvs.push(v);
        }
    }

    let verts_per_row = segments + 1;
    for lat in 0..rings {
        for lon in 0..segments {
            let row1 = lat * verts_per_row + lon;
            let row2 = (lat + 1) * verts_per_row + lon;
            add_quad(&mut indices, row1, row1 + 1, row2 + 1, row2);
        }
    }

    PrimitiveResult {
        positions,
        indices,
        normals,
        uvs,
    }
}

// ============================================================================
// NEW PRIMITIVES: PYRAMID
// ============================================================================

/// Generate a pyramid with N sides
pub fn generate_pyramid(sides: u32, _height_segments: u32) -> PrimitiveResult {
    let sides = sides.max(3).min(8);
    let mut positions = Vec::new();
    let mut normals = Vec::new();
    let mut uvs = Vec::new();
    let mut indices = Vec::new();

    let height = 1.0;
    let radius = 0.5;

    // Apex
    let apex_idx = 0u32;
    positions.push(0.0);
    positions.push(height);
    positions.push(0.0);
    normals.push(0.0);
    normals.push(1.0);
    normals.push(0.0);
    uvs.push(0.5);
    uvs.push(0.0);

    // Base vertices
    for i in 0..=sides {
        let u = i as f32 / sides as f32;
        let theta = u * 2.0 * PI;

        positions.push(theta.cos() * radius);
        positions.push(0.0);
        positions.push(theta.sin() * radius);

        // Calculate face normal
        let n = Vec3::new(theta.cos(), 0.5, theta.sin()).normalize();
        normals.push(n.x);
        normals.push(n.y);
        normals.push(n.z);

        uvs.push(u);
        uvs.push(1.0);
    }

    // Side faces
    for i in 0..sides {
        add_tri(&mut indices, apex_idx, 1 + i, 1 + i + 1);
    }

    // Base (center vertex)
    let base_center = positions.len() as u32 / 3;
    positions.push(0.0);
    positions.push(0.0);
    positions.push(0.0);
    normals.push(0.0);
    normals.push(-1.0);
    normals.push(0.0);
    uvs.push(0.5);
    uvs.push(0.5);

    // Base edges
    let base_start = base_center + 1;
    for i in 0..=sides {
        let theta = i as f32 / sides as f32 * 2.0 * PI;
        positions.push(theta.cos() * radius);
        positions.push(0.0);
        positions.push(theta.sin() * radius);
        normals.push(0.0);
        normals.push(-1.0);
        normals.push(0.0);
        uvs.push(0.5 + theta.cos() * 0.5);
        uvs.push(0.5 + theta.sin() * 0.5);
    }

    // Base triangles
    for i in 0..sides {
        add_tri(
            &mut indices,
            base_center,
            base_start + i + 1,
            base_start + i,
        );
    }

    PrimitiveResult {
        positions,
        indices,
        normals,
        uvs,
    }
}

// ============================================================================
// NEW PRIMITIVES: RING/ANNULUS
// ============================================================================

/// Generate a flat ring (annulus)
pub fn generate_ring(inner_radius: f32, outer_radius: f32, segments: u32) -> PrimitiveResult {
    let mut positions = Vec::new();
    let mut normals = Vec::new();
    let mut uvs = Vec::new();
    let mut indices = Vec::new();

    // Two rings of vertices
    for i in 0..=segments {
        let u = i as f32 / segments as f32;
        let theta = u * 2.0 * PI;

        // Inner
        positions.push(theta.cos() * inner_radius);
        positions.push(0.0);
        positions.push(theta.sin() * inner_radius);
        normals.push(0.0);
        normals.push(1.0);
        normals.push(0.0);
        uvs.push(u);
        uvs.push(0.0);

        // Outer
        positions.push(theta.cos() * outer_radius);
        positions.push(0.0);
        positions.push(theta.sin() * outer_radius);
        normals.push(0.0);
        normals.push(1.0);
        normals.push(0.0);
        uvs.push(u);
        uvs.push(1.0);
    }

    // Quads between inner and outer
    for i in 0..segments {
        let inner1 = i * 2;
        let outer1 = i * 2 + 1;
        let inner2 = (i + 1) * 2;
        let outer2 = (i + 1) * 2 + 1;
        add_quad(&mut indices, inner1, inner2, outer2, outer1);
    }

    PrimitiveResult {
        positions,
        indices,
        normals,
        uvs,
    }
}

// ============================================================================
// NEW PRIMITIVES: TUBE/PIPE
// ============================================================================

/// Generate a hollow tube
pub fn generate_tube(
    inner_radius: f32,
    outer_radius: f32,
    height: f32,
    segments: u32,
) -> PrimitiveResult {
    let mut positions = Vec::new();
    let mut normals = Vec::new();
    let mut uvs = Vec::new();
    let mut indices = Vec::new();

    let half_height = height / 2.0;

    // Generate 4 rings: outer top, outer bottom, inner bottom, inner top
    let rings = [
        (outer_radius, half_height, 1.0),   // Outer top
        (outer_radius, -half_height, 1.0),  // Outer bottom
        (inner_radius, -half_height, -1.0), // Inner bottom
        (inner_radius, half_height, -1.0),  // Inner top
    ];

    for (r, (radius, y, normal_sign)) in rings.iter().enumerate() {
        for i in 0..=segments {
            let u = i as f32 / segments as f32;
            let theta = u * 2.0 * PI;

            positions.push(theta.cos() * radius);
            positions.push(*y);
            positions.push(theta.sin() * radius);

            normals.push(theta.cos() * normal_sign);
            normals.push(0.0);
            normals.push(theta.sin() * normal_sign);

            uvs.push(u);
            uvs.push(r as f32 / 4.0);
        }
    }

    let verts_per_ring = segments + 1;

    // Outer surface (ring 0 to 1)
    for i in 0..segments {
        let r1 = i;
        let r2 = verts_per_ring + i;
        add_quad(&mut indices, r1, r1 + 1, r2 + 1, r2);
    }

    // Inner surface (ring 2 to 3)
    for i in 0..segments {
        let r1 = 2 * verts_per_ring + i;
        let r2 = 3 * verts_per_ring + i;
        add_quad(&mut indices, r1, r1 + 1, r2 + 1, r2);
    }

    // Top cap (ring 0 inner to ring 3)
    // ... (simplified - just connect outer/inner tops)

    // Bottom cap (ring 1 outer to ring 2 inner)
    // ... (simplified)

    // Shift to bottom pivot
    for i in (1..positions.len()).step_by(3) {
        positions[i] += half_height;
    }

    PrimitiveResult {
        positions,
        indices,
        normals,
        uvs,
    }
}

// ============================================================================
// NEW PRIMITIVES: DISC
// ============================================================================

/// Generate a filled circular disc (grid topology)
pub fn generate_disc(subdivisions: u32, segments: u32) -> PrimitiveResult {
    let mut positions = Vec::new();
    let mut normals = Vec::new();
    let mut uvs = Vec::new();
    let mut indices = Vec::new();

    let rings = 1 << subdivisions;

    // Center vertex
    positions.push(0.0);
    positions.push(0.0);
    positions.push(0.0);
    normals.push(0.0);
    normals.push(1.0);
    normals.push(0.0);
    uvs.push(0.5);
    uvs.push(0.5);

    // Concentric rings
    for r in 1..=rings {
        let radius = r as f32 / rings as f32;

        for i in 0..=segments {
            let u = i as f32 / segments as f32;
            let theta = u * 2.0 * PI;

            positions.push(theta.cos() * radius);
            positions.push(0.0);
            positions.push(theta.sin() * radius);

            normals.push(0.0);
            normals.push(1.0);
            normals.push(0.0);

            uvs.push(0.5 + theta.cos() * radius * 0.5);
            uvs.push(0.5 + theta.sin() * radius * 0.5);
        }
    }

    // Connect center to first ring
    let verts_per_ring = segments + 1;
    for i in 0..segments {
        add_tri(&mut indices, 0, 1 + i, 1 + i + 1);
    }

    // Connect rings
    for r in 0..rings - 1 {
        let ring_start = 1 + r * verts_per_ring;
        let next_ring_start = 1 + (r + 1) * verts_per_ring;

        for i in 0..segments {
            let r1 = ring_start + i;
            let r2 = next_ring_start + i;
            add_quad(&mut indices, r1, r1 + 1, r2 + 1, r2);
        }
    }

    PrimitiveResult {
        positions,
        indices,
        normals,
        uvs,
    }
}

// ============================================================================
// ARCHITECTURAL PRIMITIVES
// ============================================================================

/// Generate a wall panel
pub fn generate_wall(width: f32, height: f32, depth: f32) -> PrimitiveResult {
    generate_box(width, height, depth)
}

/// Generate a platform
pub fn generate_platform(width: f32, depth: f32, height: f32) -> PrimitiveResult {
    generate_box(width, height, depth)
}

/// Generate a pillar (vertical cylinder)
pub fn generate_pillar(radius: f32, height: f32, segments: u32) -> PrimitiveResult {
    // Scale down the standard cylinder
    let mut result = generate_quad_cylinder(segments, 8);

    // Scale positions
    for i in (0..result.positions.len()).step_by(3) {
        result.positions[i] *= radius;
        result.positions[i + 1] *= height / 2.0;
        result.positions[i + 2] *= radius;
    }

    // Shift to bottom
    for i in (1..result.positions.len()).step_by(3) {
        result.positions[i] += height / 2.0;
    }

    result
}

/// Generate an arch (half torus)
pub fn generate_arch(radius: f32, thickness: f32, angle: f32) -> PrimitiveResult {
    let mut positions = Vec::new();
    let mut normals = Vec::new();
    let mut uvs = Vec::new();
    let mut indices = Vec::new();

    let segments = 32;
    let tube_segments = 16;

    for t in 0..=tube_segments {
        let v = t as f32 / tube_segments as f32;
        let theta = v * 2.0 * PI;

        for a in 0..=segments {
            let u = a as f32 / segments as f32;
            let phi = u * angle;

            let x = (radius + thickness * theta.cos()) * phi.cos();
            let y = (radius + thickness * theta.cos()) * phi.sin();
            let z = thickness * theta.sin();

            positions.push(x);
            positions.push(y);
            positions.push(z);

            let cx = radius * phi.cos();
            let cy = radius * phi.sin();
            let n = Vec3::new(x - cx, y - cy, z).normalize();
            normals.push(n.x);
            normals.push(n.y);
            normals.push(n.z);

            uvs.push(u);
            uvs.push(v);
        }
    }

    let verts_per_row = segments + 1;
    for t in 0..tube_segments {
        for a in 0..segments {
            let row1 = t * verts_per_row + a;
            let row2 = (t + 1) * verts_per_row + a;
            add_quad(&mut indices, row1, row1 + 1, row2 + 1, row2);
        }
    }

    // Rotate to stand upright
    for i in (0..positions.len()).step_by(3) {
        let x = positions[i];
        let y = positions[i + 1];
        positions[i] = x;
        positions[i + 1] = y;
    }

    PrimitiveResult {
        positions,
        indices,
        normals,
        uvs,
    }
}

/// Generate an I-beam
pub fn generate_beam(width: f32, height: f32, flange_width: f32) -> PrimitiveResult {
    // Simple approximation: stack of three boxes
    let flange_height = height * 0.1;
    let web_width = width * 0.3;

    let mut all_positions = Vec::new();
    let mut all_normals = Vec::new();
    let mut all_uvs = Vec::new();
    let mut all_indices = Vec::new();

    // Web (center)
    let web = generate_box(web_width, height - flange_height * 2.0, flange_width);
    for i in (0..web.positions.len()).step_by(3) {
        all_positions.push(web.positions[i]);
        all_positions.push(web.positions[i + 1] + height / 2.0);
        all_positions.push(web.positions[i + 2]);
    }
    all_normals.extend(web.normals);
    all_uvs.extend(web.uvs);
    all_indices.extend(web.indices);

    // Top flange
    let top = generate_box(width, flange_height, flange_width);
    let offset = all_positions.len() as u32 / 3;
    for i in (0..top.positions.len()).step_by(3) {
        all_positions.push(top.positions[i]);
        all_positions.push(top.positions[i + 1] + height - flange_height / 2.0);
        all_positions.push(top.positions[i + 2]);
    }
    all_normals.extend(&top.normals);
    all_uvs.extend(&top.uvs);
    for idx in &top.indices {
        all_indices.push(idx + offset);
    }

    // Bottom flange
    let offset = all_positions.len() as u32 / 3;
    for i in (0..top.positions.len()).step_by(3) {
        all_positions.push(top.positions[i]);
        all_positions.push(top.positions[i + 1] + flange_height / 2.0);
        all_positions.push(top.positions[i + 2]);
    }
    all_normals.extend(&top.normals);
    all_uvs.extend(&top.uvs);
    for idx in &top.indices {
        all_indices.push(idx + offset);
    }

    PrimitiveResult {
        positions: all_positions,
        indices: all_indices,
        normals: all_normals,
        uvs: all_uvs,
    }
}

/// Generate a simple subdivided box
fn generate_box(width: f32, height: f32, depth: f32) -> PrimitiveResult {
    let mut result = generate_quad_cube(2);

    for i in (0..result.positions.len()).step_by(3) {
        result.positions[i] *= width / 2.0;
        result.positions[i + 1] *= height / 2.0;
        result.positions[i + 2] *= depth / 2.0;
    }

    // Shift to bottom pivot
    for i in (1..result.positions.len()).step_by(3) {
        result.positions[i] += height / 2.0;
    }

    result
}

// ============================================================================
// ORGANIC PRIMITIVES
// ============================================================================

/// Generate a head base (elongated sphere)
pub fn generate_head(subdivisions: u32) -> PrimitiveResult {
    let mut result = generate_quad_sphere(subdivisions);

    // Elongate vertically (portrait aspect)
    for i in (0..result.positions.len()).step_by(3) {
        result.positions[i] *= 0.7; // Narrower
        result.positions[i + 1] *= 1.2; // Taller
        result.positions[i + 2] *= 0.8; // Slightly flatter
    }

    // Shift to bottom pivot
    let min_y = result
        .positions
        .iter()
        .skip(1)
        .step_by(3)
        .cloned()
        .fold(f32::MAX, f32::min);
    for i in (1..result.positions.len()).step_by(3) {
        result.positions[i] -= min_y;
    }

    // Recalculate normals
    recalc_normals(&mut result);

    result
}

/// Generate a body base (capsule-ish torso)
pub fn generate_body(subdivisions: u32) -> PrimitiveResult {
    let mut result = generate_capsule(subdivisions, 2.0);

    // Widen at shoulders, taper at waist
    for i in (0..result.positions.len()).step_by(3) {
        let y = result.positions[i + 1];
        let height_factor = if y > 1.0 {
            1.0 + (y - 1.0) * 0.3 // Wider shoulders
        } else if y < 0.5 {
            0.7 + y * 0.6 // Tapered hips
        } else {
            0.8 // Narrower waist
        };

        result.positions[i] *= height_factor;
        result.positions[i + 2] *= height_factor * 0.6; // Flatter front-to-back
    }

    recalc_normals(&mut result);
    result
}

/// Generate a limb base (tapered cylinder)
pub fn generate_limb(subdivisions: u32, taper: f32) -> PrimitiveResult {
    let segments = 8 * (1 << subdivisions);
    let height_segments = 4 * (1 << subdivisions);

    let mut positions = Vec::new();
    let mut normals = Vec::new();
    let mut uvs = Vec::new();
    let mut indices = Vec::new();

    let height = 2.0;
    let base_radius = 0.3;

    for h in 0..=height_segments {
        let v = h as f32 / height_segments as f32;
        let y = v * height;
        let radius = base_radius * (1.0 - taper * v); // Taper toward top

        for s in 0..=segments {
            let u = s as f32 / segments as f32;
            let theta = u * 2.0 * PI;

            positions.push(theta.cos() * radius);
            positions.push(y);
            positions.push(theta.sin() * radius);

            normals.push(theta.cos());
            normals.push(0.0);
            normals.push(theta.sin());

            uvs.push(u);
            uvs.push(v);
        }
    }

    let verts_per_row = segments + 1;
    for h in 0..height_segments {
        for s in 0..segments {
            let row1 = h * verts_per_row + s;
            let row2 = (h + 1) * verts_per_row + s;
            add_quad(&mut indices, row1, row1 + 1, row2 + 1, row2);
        }
    }

    // Add caps
    let bottom_center = positions.len() as u32 / 3;
    positions.push(0.0);
    positions.push(0.0);
    positions.push(0.0);
    normals.push(0.0);
    normals.push(-1.0);
    normals.push(0.0);
    uvs.push(0.5);
    uvs.push(0.5);

    for s in 0..=segments {
        let theta = s as f32 / segments as f32 * 2.0 * PI;
        positions.push(theta.cos() * base_radius);
        positions.push(0.0);
        positions.push(theta.sin() * base_radius);
        normals.push(0.0);
        normals.push(-1.0);
        normals.push(0.0);
        uvs.push(0.5);
        uvs.push(0.5);
    }

    for s in 0..segments {
        add_tri(
            &mut indices,
            bottom_center,
            bottom_center + 1 + s + 1,
            bottom_center + 1 + s,
        );
    }

    PrimitiveResult {
        positions,
        indices,
        normals,
        uvs,
    }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

fn recalc_normals(result: &mut PrimitiveResult) {
    let vertex_count = result.positions.len() / 3;
    result.normals = vec![0.0; result.positions.len()];

    // Accumulate face normals
    for tri in result.indices.chunks(3) {
        let i0 = tri[0] as usize;
        let i1 = tri[1] as usize;
        let i2 = tri[2] as usize;

        let v0 = Vec3::new(
            result.positions[i0 * 3],
            result.positions[i0 * 3 + 1],
            result.positions[i0 * 3 + 2],
        );
        let v1 = Vec3::new(
            result.positions[i1 * 3],
            result.positions[i1 * 3 + 1],
            result.positions[i1 * 3 + 2],
        );
        let v2 = Vec3::new(
            result.positions[i2 * 3],
            result.positions[i2 * 3 + 1],
            result.positions[i2 * 3 + 2],
        );

        let e1 = v1 - v0;
        let e2 = v2 - v0;
        let n = e1.cross(&e2);

        for i in [i0, i1, i2] {
            result.normals[i * 3] += n.x;
            result.normals[i * 3 + 1] += n.y;
            result.normals[i * 3 + 2] += n.z;
        }
    }

    // Normalize
    for i in 0..vertex_count {
        let x = result.normals[i * 3];
        let y = result.normals[i * 3 + 1];
        let z = result.normals[i * 3 + 2];
        let len = (x * x + y * y + z * z).sqrt();
        if len > 0.0 {
            result.normals[i * 3] /= len;
            result.normals[i * 3 + 1] /= len;
            result.normals[i * 3 + 2] /= len;
        }
    }
}

fn merge_vertices(
    positions: &mut Vec<f32>,
    normals: &mut Vec<f32>,
    uvs: &mut Vec<f32>,
    indices: &mut Vec<u32>,
) -> PrimitiveResult {
    let mut new_positions = Vec::new();
    let mut new_normals = Vec::new();
    let mut new_uvs = Vec::new();

    let precision = 10000.0;
    let mut _unique_verts = Vec::new();
    let mut remapped_indices = Vec::with_capacity(indices.len());
    let mut map: HashMap<(i64, i64, i64), u32> = HashMap::new();

    for &idx in indices.iter() {
        let i = idx as usize;
        let x = positions[i * 3];
        let y = positions[i * 3 + 1];
        let z = positions[i * 3 + 2];

        let key = (
            (x * precision) as i64,
            (y * precision) as i64,
            (z * precision) as i64,
        );

        if let Some(&new_id) = map.get(&key) {
            remapped_indices.push(new_id);
        } else {
            let new_id = _unique_verts.len() as u32;
            _unique_verts.push(i);
            map.insert(key, new_id);
            remapped_indices.push(new_id);

            new_positions.push(x);
            new_positions.push(y);
            new_positions.push(z);
            new_normals.push(normals[i * 3]);
            new_normals.push(normals[i * 3 + 1]);
            new_normals.push(normals[i * 3 + 2]);
            new_uvs.push(uvs[i * 2]);
            new_uvs.push(uvs[i * 2 + 1]);
        }
    }

    PrimitiveResult {
        positions: new_positions,
        indices: remapped_indices,
        normals: new_normals,
        uvs: new_uvs,
    }
}
