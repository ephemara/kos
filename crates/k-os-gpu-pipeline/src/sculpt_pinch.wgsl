// ============================================================================
// K_OS Sculpt Pinch Kernel V2 - Maximum Modularity Edition
// ============================================================================
// Supports: Pinch, Crease, Dam Standard, Magnify, Inflate-Pinch
// Uses BrushParamsV2 (384 bytes) for full feature support
// ============================================================================

// === CONSTANTS ===
const FLAG_SUBTRACT: u32 = 1u;
const FLAG_FRONT_FACES_ONLY: u32 = 2u;
const ALPHA_DISABLED: u32 = 0u;

// === ALPHA SLOT (32 bytes) ===
struct AlphaSlot {
    pool_id: u32,
    mode: u32,
    scale: f32,
    rotation: f32,
    offset: vec2<f32>,
    blend_weight: f32,
    mirror: u32,
}

// === BRUSH PARAMS V2 (384 bytes) ===
struct BrushParams {
    center: vec4<f32>,
    normal: vec4<f32>,
    velocity: vec4<f32>,
    prev_center: vec3<f32>,
    stroke_distance: f32,
    radius: f32,
    strength: f32,
    hardness: f32,
    spacing: f32,
    kernel_id: u32,
    entry_point_id: u32,
    blend_mode: u32,
    flags: u32,
    vertex_count: u32,
    candidate_count: u32,
    dab_index: u32,
    stroke_index: u32,
    alpha0: AlphaSlot,
    alpha1: AlphaSlot,
    alpha2: AlphaSlot,
    jitter_position: f32,
    jitter_rotation: f32,
    jitter_strength: f32,
    random_seed: f32,
    symmetry_flags: u32,
    radial_count: u32,
    symmetry_offset_x: f32,
    symmetry_offset_y: f32,
    automask_cavity: f32,
    automask_angle: f32,
    automask_border: f32,
    automask_face_set: u32,
    curve_pressure: u32,
    curve_speed: u32,
    curve_tilt: u32,
    curve_direction: u32,
    extras: array<vec4<f32>, 6>,
    locked_plane_normal: vec3<f32>,
    locked_plane_offset: f32,
    locked_position: vec3<f32>,
    locked_radius: f32,
    // V2.1 fields
    pen_rotation: f32,
    stroke_type: u32,
    backface_threshold: f32,
    accumulation_limit: f32,
    color: vec4<f32>,
    gravity_direction: vec3<f32>,
    time: f32,
    _reserved: vec4<f32>,
}

// === BINDINGS ===
@group(0) @binding(0) var<storage, read_write> positions: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read_write> normals: array<vec4<f32>>;
@group(0) @binding(2) var<uniform> params: BrushParams;
@group(0) @binding(3) var<storage, read> candidates: array<u32>;
@group(0) @binding(4) var<storage, read> counter: array<u32>;

@group(1) @binding(0) var alpha_texture: texture_2d<f32>;
@group(1) @binding(1) var alpha_sampler: sampler;

// === HELPERS ===
fn has_flag(flag: u32) -> bool {
    return (params.flags & flag) != 0u;
}

fn get_pressure() -> f32 {
    return params.center.w;
}

fn falloff(dist: f32, radius: f32, hardness: f32) -> f32 {
    let t = clamp(dist / radius, 0.0, 1.0);
    let soft = 1.0 - t * t;
    let hard = 1.0 - t;
    return mix(soft, hard, hardness);
}

fn sample_alpha(local_pos: vec3<f32>, radius: f32) -> f32 {
    if (params.alpha0.mode == ALPHA_DISABLED) { return 1.0; }
    let uv = (local_pos.xz / radius + 1.0) * 0.5 * params.alpha0.scale;
    return textureSampleLevel(alpha_texture, alpha_sampler, uv, 0.0).r;
}

fn get_vertex_idx(idx: u32) -> u32 {
    let count = counter[0];
    if (count > 0u) {
        if (idx >= count) { return 0xFFFFFFFFu; }
        return candidates[idx];
    } else {
        if (idx >= params.vertex_count) { return 0xFFFFFFFFu; }
        return idx;
    }
}

// ============================================================================
// PINCH MAIN - Pull vertices toward brush center axis
// extras[0] = magnify (negative = expand instead of pinch)
// ============================================================================
@compute @workgroup_size(256)
fn pinch_main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let vertex_idx = get_vertex_idx(global_id.x);
    if (vertex_idx == 0xFFFFFFFFu) { return; }
    
    let pos = positions[vertex_idx].xyz;
    let nor = normals[vertex_idx].xyz;
    let center = params.center.xyz;
    let brush_normal = params.normal.xyz;
    
    let to_center = pos - center;
    let dist = length(to_center);
    if (dist > params.radius) { return; }
    
    var weight = falloff(dist, params.radius, params.hardness);
    weight *= sample_alpha(to_center, params.radius);
    weight *= get_pressure();
    
    // Project to plane perpendicular to brush normal
    let along_normal = dot(to_center, brush_normal);
    let on_plane = to_center - brush_normal * along_normal;
    
    // Pinch direction: toward brush axis
    let pinch_dir = -normalize(on_plane + vec3<f32>(0.0001, 0.0001, 0.0001));
    let pinch_dist = length(on_plane);
    
    var displacement = pinch_dir * pinch_dist * weight * params.strength;
    
    // Magnify: positive = pinch, negative = expand
    let magnify = params.extras[0].x;
    displacement = displacement * (1.0 + magnify);
    
    if (has_flag(FLAG_SUBTRACT)) {
        displacement = -displacement;
    }
    
    positions[vertex_idx] = vec4<f32>(pos + displacement, 1.0);
}

// ============================================================================
// PINCH CREASE - Pinch + depth displacement
// extras[0] = magnify
// extras[1] = depth
// ============================================================================
@compute @workgroup_size(256)
fn pinch_crease(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let vertex_idx = get_vertex_idx(global_id.x);
    if (vertex_idx == 0xFFFFFFFFu) { return; }
    
    let pos = positions[vertex_idx].xyz;
    let nor = normals[vertex_idx].xyz;
    let center = params.center.xyz;
    let brush_normal = params.normal.xyz;
    
    let to_center = pos - center;
    let dist = length(to_center);
    if (dist > params.radius) { return; }
    
    var weight = falloff(dist, params.radius, params.hardness);
    weight *= sample_alpha(to_center, params.radius);
    weight *= get_pressure();
    
    // Project to plane
    let along_normal = dot(to_center, brush_normal);
    let on_plane = to_center - brush_normal * along_normal;
    
    // Pinch toward axis
    let pinch_dir = -normalize(on_plane + vec3<f32>(0.0001, 0.0001, 0.0001));
    let pinch_dist = length(on_plane);
    let pinch = pinch_dir * pinch_dist * weight * params.strength * 0.5;
    
    // Depth along normal
    let depth = params.extras[1].x;
    var depth_disp = -brush_normal * weight * params.strength * depth;
    
    var displacement = pinch + depth_disp;
    
    if (has_flag(FLAG_SUBTRACT)) {
        displacement = -displacement;
    }
    
    positions[vertex_idx] = vec4<f32>(pos + displacement, 1.0);
}

// ============================================================================
// PINCH DAM STANDARD - Sharp crease with hard edges
// ============================================================================
@compute @workgroup_size(256)
fn pinch_dam(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let vertex_idx = get_vertex_idx(global_id.x);
    if (vertex_idx == 0xFFFFFFFFu) { return; }
    
    let pos = positions[vertex_idx].xyz;
    let nor = normals[vertex_idx].xyz;
    let center = params.center.xyz;
    let brush_normal = params.normal.xyz;
    
    let to_center = pos - center;
    let dist = length(to_center);
    if (dist > params.radius) { return; }
    
    // Dam uses hard falloff for sharp edges
    var weight = falloff(dist, params.radius, 0.9); // Force hard
    weight *= sample_alpha(to_center, params.radius);
    weight *= get_pressure();
    
    // Direction toward brush axis
    let along_normal = dot(to_center, brush_normal);
    let on_plane = to_center - brush_normal * along_normal;
    let side_dist = length(on_plane);
    
    // Sharp edge profile: vertices close to axis go deep, far ones minimal
    let edge_profile = smoothstep(params.radius, 0.0, side_dist);
    
    // Displacement straight down into surface
    var displacement = -brush_normal * edge_profile * weight * params.strength;
    
    if (has_flag(FLAG_SUBTRACT)) {
        displacement = -displacement;
    }
    
    positions[vertex_idx] = vec4<f32>(pos + displacement, 1.0);
}

// ============================================================================
// PINCH INFLATE - Inflate + Pinch combo (ZBrush-style)
// extras[0] = inflate_amount (blend between pure pinch and inflate)
// ============================================================================
@compute @workgroup_size(256)
fn pinch_inflate_pinch(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let vertex_idx = get_vertex_idx(global_id.x);
    if (vertex_idx == 0xFFFFFFFFu) { return; }
    
    let pos = positions[vertex_idx].xyz;
    let nor = normalize(normals[vertex_idx].xyz);
    let center = params.center.xyz;
    let brush_normal = params.normal.xyz;
    
    let to_center = pos - center;
    let dist = length(to_center);
    if (dist > params.radius) { return; }
    
    var weight = falloff(dist, params.radius, params.hardness);
    weight *= sample_alpha(to_center, params.radius);
    weight *= get_pressure();
    
    let inflate_amount = params.extras[0].x;
    
    // Pinch component
    let along_normal = dot(to_center, brush_normal);
    let on_plane = to_center - brush_normal * along_normal;
    let pinch_dir = -normalize(on_plane + vec3<f32>(0.0001, 0.0001, 0.0001));
    let pinch_dist = length(on_plane);
    let pinch_disp = pinch_dir * pinch_dist * weight * params.strength;
    
    // Inflate component
    let inflate_disp = nor * weight * params.strength * inflate_amount;
    
    var displacement = pinch_disp + inflate_disp;
    
    if (has_flag(FLAG_SUBTRACT)) {
        displacement = -displacement;
    }
    
    positions[vertex_idx] = vec4<f32>(pos + displacement, 1.0);
}

// ============================================================================
// PINCH MAGNIFY - Expand outward from center (opposite of pinch)
// ============================================================================
@compute @workgroup_size(256)
fn pinch_magnify(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let vertex_idx = get_vertex_idx(global_id.x);
    if (vertex_idx == 0xFFFFFFFFu) { return; }
    
    let pos = positions[vertex_idx].xyz;
    let center = params.center.xyz;
    let brush_normal = params.normal.xyz;
    
    let to_center = pos - center;
    let dist = length(to_center);
    if (dist > params.radius) { return; }
    
    var weight = falloff(dist, params.radius, params.hardness);
    weight *= sample_alpha(to_center, params.radius);
    weight *= get_pressure();
    
    // Project to plane and push AWAY from axis
    let along_normal = dot(to_center, brush_normal);
    let on_plane = to_center - brush_normal * along_normal;
    let expand_dir = normalize(on_plane + vec3<f32>(0.0001, 0.0001, 0.0001));
    let expand_dist = length(on_plane);
    
    // Push outward proportional to distance
    var displacement = expand_dir * (params.radius - expand_dist) * weight * params.strength * 0.5;
    
    if (has_flag(FLAG_SUBTRACT)) {
        displacement = -displacement;
    }
    
    positions[vertex_idx] = vec4<f32>(pos + displacement, 1.0);
}
