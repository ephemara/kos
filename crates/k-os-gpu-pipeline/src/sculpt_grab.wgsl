// ============================================================================
// K_OS Sculpt Grab Kernel V2 - Maximum Modularity Edition
// ============================================================================
// Supports: Grab, Snake Hook, Move, Twist, Rotate, Scale
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

// Get delta from previous position (V2 has this built-in!)
fn get_delta() -> vec3<f32> {
    return params.center.xyz - params.prev_center;
}

// ============================================================================
// GRAB MAIN - Direct translation by mouse delta
// ============================================================================
@compute @workgroup_size(256)
fn grab_main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let vertex_idx = get_vertex_idx(global_id.x);
    if (vertex_idx == 0xFFFFFFFFu) { return; }
    
    let pos = positions[vertex_idx].xyz;
    let center = params.locked_position; // Use locked position as grab anchor
    
    let to_center = pos - center;
    let dist = length(to_center);
    if (dist > params.locked_radius) { return; }
    
    var weight = falloff(dist, params.locked_radius, params.hardness);
    weight *= sample_alpha(to_center, params.locked_radius);
    weight *= get_pressure();
    
    let delta = get_delta();
    let displacement = delta * weight * params.strength;
    
    positions[vertex_idx] = vec4<f32>(pos + displacement, 1.0);
}

// ============================================================================
// GRAB SNAKE HOOK - Exponential falloff for trailing effect
// extras[0] = snake_falloff (0 = linear, 1 = exponential)
// ============================================================================
@compute @workgroup_size(256)
fn grab_snake_hook(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let vertex_idx = get_vertex_idx(global_id.x);
    if (vertex_idx == 0xFFFFFFFFu) { return; }
    
    let pos = positions[vertex_idx].xyz;
    let center = params.locked_position;
    
    let to_center = pos - center;
    let dist = length(to_center);
    if (dist > params.locked_radius) { return; }
    
    // Exponential vs linear falloff
    let t = dist / params.locked_radius;
    let snake_falloff = params.extras[0].x;
    let linear_weight = 1.0 - t;
    let exp_weight = exp(-t * 3.0);
    var weight = mix(linear_weight, exp_weight, snake_falloff);
    
    weight *= sample_alpha(to_center, params.locked_radius);
    weight *= get_pressure();
    
    let delta = get_delta();
    let displacement = delta * weight * params.strength;
    
    positions[vertex_idx] = vec4<f32>(pos + displacement, 1.0);
}

// ============================================================================
// GRAB MOVE - Uniform translation (no falloff)
// ============================================================================
@compute @workgroup_size(256)
fn grab_move(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let vertex_idx = get_vertex_idx(global_id.x);
    if (vertex_idx == 0xFFFFFFFFu) { return; }
    
    let pos = positions[vertex_idx].xyz;
    let center = params.locked_position;
    
    let to_center = pos - center;
    let dist = length(to_center);
    if (dist > params.locked_radius) { return; }
    
    var weight = 1.0; // Uniform - no falloff
    weight *= sample_alpha(to_center, params.locked_radius);
    weight *= get_pressure();
    
    let delta = get_delta();
    let displacement = delta * weight * params.strength;
    
    positions[vertex_idx] = vec4<f32>(pos + displacement, 1.0);
}

// ============================================================================
// GRAB TWIST - Rotate vertices around brush axis
// extras[0] = twist_angle (radians per frame, accumulated)
// ============================================================================
@compute @workgroup_size(256)
fn grab_twist(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let vertex_idx = get_vertex_idx(global_id.x);
    if (vertex_idx == 0xFFFFFFFFu) { return; }
    
    let pos = positions[vertex_idx].xyz;
    let center = params.locked_position;
    let axis = normalize(params.normal.xyz);
    
    let to_center = pos - center;
    let dist = length(to_center);
    if (dist > params.locked_radius) { return; }
    
    var weight = falloff(dist, params.locked_radius, params.hardness);
    weight *= sample_alpha(to_center, params.locked_radius);
    weight *= get_pressure();
    
    // Twist angle from delta (horizontal movement = rotation)
    let delta = get_delta();
    let twist_sensitivity = params.extras[0].x;
    let angle = length(delta) * twist_sensitivity * weight * params.strength;
    
    // Rodrigues' rotation formula
    let v = to_center;
    let k = axis;
    let cos_a = cos(angle);
    let sin_a = sin(angle);
    
    let rotated = v * cos_a + cross(k, v) * sin_a + k * dot(k, v) * (1.0 - cos_a);
    
    positions[vertex_idx] = vec4<f32>(center + rotated, 1.0);
}

// ============================================================================
// GRAB ROTATE - Rotate around arbitrary axis (3-finger gesture style)
// extras[0-2] = rotation axis
// extras[3] = rotation angle
// ============================================================================
@compute @workgroup_size(256)
fn grab_rotate(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let vertex_idx = get_vertex_idx(global_id.x);
    if (vertex_idx == 0xFFFFFFFFu) { return; }
    
    let pos = positions[vertex_idx].xyz;
    let center = params.locked_position;
    
    let to_center = pos - center;
    let dist = length(to_center);
    if (dist > params.locked_radius) { return; }
    
    var weight = falloff(dist, params.locked_radius, params.hardness);
    weight *= get_pressure();
    
    let axis = normalize(vec3<f32>(params.extras[0].x, params.extras[1].x, params.extras[2].x));
    let angle = params.extras[3].x * weight * params.strength;
    
    // Rodrigues' rotation
    let v = to_center;
    let k = axis;
    let cos_a = cos(angle);
    let sin_a = sin(angle);
    
    let rotated = v * cos_a + cross(k, v) * sin_a + k * dot(k, v) * (1.0 - cos_a);
    
    positions[vertex_idx] = vec4<f32>(center + rotated, 1.0);
}

// ============================================================================
// GRAB SCALE - Scale vertices relative to center
// extras[0] = scale factor (>1 = expand, <1 = shrink)
// ============================================================================
@compute @workgroup_size(256)
fn grab_scale(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let vertex_idx = get_vertex_idx(global_id.x);
    if (vertex_idx == 0xFFFFFFFFu) { return; }
    
    let pos = positions[vertex_idx].xyz;
    let center = params.locked_position;
    
    let to_center = pos - center;
    let dist = length(to_center);
    if (dist > params.locked_radius) { return; }
    
    var weight = falloff(dist, params.locked_radius, params.hardness);
    weight *= get_pressure();
    
    // Scale factor from delta (vertical movement = scale)
    let delta = get_delta();
    let scale_sensitivity = params.extras[0].x;
    let scale = 1.0 + delta.y * scale_sensitivity * weight * params.strength;
    
    let scaled_pos = center + to_center * scale;
    
    positions[vertex_idx] = vec4<f32>(scaled_pos, 1.0);
}

// ============================================================================
// GRAB ELASTIC - Springy grab with bounce-back
// extras[0] = stiffness
// extras[1] = damping
// ============================================================================
@compute @workgroup_size(256)
fn grab_elastic(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let vertex_idx = get_vertex_idx(global_id.x);
    if (vertex_idx == 0xFFFFFFFFu) { return; }
    
    let pos = positions[vertex_idx].xyz;
    let center = params.locked_position;
    
    let to_center = pos - center;
    let dist = length(to_center);
    if (dist > params.locked_radius) { return; }
    
    let stiffness = params.extras[0].x;
    let damping = params.extras[1].x;
    
    // Elastic falloff - stiffer at center, springy at edges
    let t = dist / params.locked_radius;
    var weight = exp(-t * stiffness);
    weight *= (1.0 - damping * t);
    weight *= get_pressure();
    
    let delta = get_delta();
    let displacement = delta * weight * params.strength;
    
    positions[vertex_idx] = vec4<f32>(pos + displacement, 1.0);
}
