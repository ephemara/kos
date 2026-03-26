// GPU Atlas Projection Compute Shaders
// Supports: Box (6-axis), Planar, Cylindrical, Spherical projections

struct ProjectParams {
    mode: u32,           // 0=box, 1=planar_x, 2=planar_y, 3=planar_z, 4=cylindrical, 5=spherical
    vertex_count: u32,
    scale: f32,
    offset_u: f32,
    offset_v: f32,
    _padding: u32,
}

@group(0) @binding(0) var<uniform> params: ProjectParams;
@group(0) @binding(1) var<storage, read> positions: array<f32>;      // xyz interleaved
@group(0) @binding(2) var<storage, read> normals: array<f32>;        // xyz interleaved  
@group(0) @binding(3) var<storage, read_write> uvs: array<f32>;      // uv interleaved

const PI: f32 = 3.14159265359;
const TWO_PI: f32 = 6.28318530718;

// Get position for vertex i
fn get_pos(i: u32) -> vec3<f32> {
    let idx = i * 3u;
    return vec3<f32>(positions[idx], positions[idx + 1u], positions[idx + 2u]);
}

// Get normal for vertex i
fn get_normal(i: u32) -> vec3<f32> {
    let idx = i * 3u;
    return normalize(vec3<f32>(normals[idx], normals[idx + 1u], normals[idx + 2u]));
}

// Set UV for vertex i
fn set_uv(i: u32, uv: vec2<f32>) {
    let idx = i * 2u;
    uvs[idx] = uv.x * params.scale + params.offset_u;
    uvs[idx + 1u] = uv.y * params.scale + params.offset_v;
}

// Box projection: choose best axis based on normal, project to that plane
fn project_box(pos: vec3<f32>, normal: vec3<f32>) -> vec2<f32> {
    let abs_n = abs(normal);
    
    // Find dominant axis
    if abs_n.x >= abs_n.y && abs_n.x >= abs_n.z {
        // Project onto YZ plane (looking from X)
        return vec2<f32>(pos.y, pos.z);
    } else if abs_n.y >= abs_n.x && abs_n.y >= abs_n.z {
        // Project onto XZ plane (looking from Y)
        return vec2<f32>(pos.x, pos.z);
    } else {
        // Project onto XY plane (looking from Z)
        return vec2<f32>(pos.x, pos.y);
    }
}

// Planar projection along X axis
fn project_planar_x(pos: vec3<f32>) -> vec2<f32> {
    return vec2<f32>(pos.y, pos.z);
}

// Planar projection along Y axis
fn project_planar_y(pos: vec3<f32>) -> vec2<f32> {
    return vec2<f32>(pos.x, pos.z);
}

// Planar projection along Z axis
fn project_planar_z(pos: vec3<f32>) -> vec2<f32> {
    return vec2<f32>(pos.x, pos.y);
}

// Cylindrical projection (theta, height)
fn project_cylindrical(pos: vec3<f32>) -> vec2<f32> {
    let theta = atan2(pos.z, pos.x);
    let u = (theta + PI) / TWO_PI;  // Normalize to 0-1
    let v = pos.y * 0.5 + 0.5;      // Normalize height assuming -1 to 1 range
    return vec2<f32>(u, v);
}

// Spherical projection (theta, phi)
fn project_spherical(pos: vec3<f32>) -> vec2<f32> {
    let r = length(pos);
    if r < 0.0001 {
        return vec2<f32>(0.5, 0.5);
    }
    
    let theta = atan2(pos.z, pos.x);
    let phi = acos(clamp(pos.y / r, -1.0, 1.0));
    
    let u = (theta + PI) / TWO_PI;
    let v = phi / PI;
    return vec2<f32>(u, v);
}

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let i = global_id.x;
    if i >= params.vertex_count {
        return;
    }
    
    let pos = get_pos(i);
    let normal = get_normal(i);
    
    var uv: vec2<f32>;
    
    switch params.mode {
        case 0u: { // Box
            uv = project_box(pos, normal);
        }
        case 1u: { // Planar X
            uv = project_planar_x(pos);
        }
        case 2u: { // Planar Y
            uv = project_planar_y(pos);
        }
        case 3u: { // Planar Z
            uv = project_planar_z(pos);
        }
        case 4u: { // Cylindrical
            uv = project_cylindrical(pos);
        }
        case 5u: { // Spherical
            uv = project_spherical(pos);
        }
        default: {
            uv = vec2<f32>(0.0, 0.0);
        }
    }
    
    set_uv(i, uv);
}
