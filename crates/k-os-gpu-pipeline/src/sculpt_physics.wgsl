// ============================================================================
// K_OS Sculpt Physics Kernel V2 - Maximum Modularity Edition
// ============================================================================
// Supports: Attractor, Magnet, Elastic, Inflate Pulse, Turbulence, Gravity
// Uses BrushParamsV2 (464 bytes) for full feature support
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

// === BRUSH PARAMS V2 (464 bytes) ===
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

// 3D noise for turbulence
fn hash3(p: vec3<f32>) -> vec3<f32> {
    var q = vec3<f32>(
        dot(p, vec3<f32>(127.1, 311.7, 74.7)),
        dot(p, vec3<f32>(269.5, 183.3, 246.1)),
        dot(p, vec3<f32>(113.5, 271.9, 124.6))
    );
    return fract(sin(q) * 43758.5453) * 2.0 - 1.0;
}

// ============================================================================
// PHYSICS ATTRACTOR - Pull/push toward center
// extras[0] = power (falloff curve exponent)
// ============================================================================
@compute @workgroup_size(256)
fn physics_attractor(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let vertex_idx = get_vertex_idx(global_id.x);
    if (vertex_idx == 0xFFFFFFFFu) { return; }
    
    let pos = positions[vertex_idx].xyz;
    let center = params.center.xyz;
    
    let to_center = center - pos;
    let dist = length(to_center);
    if (dist > params.radius) { return; }
    if (dist < 0.0001) { return; }
    
    let power = params.extras[0].x;
    let t = dist / params.radius;
    var weight = pow(1.0 - t, power);
    weight *= sample_alpha(pos - center, params.radius);
    weight *= get_pressure();
    
    let dir = normalize(to_center);
    var displacement = dir * dist * weight * params.strength;
    
    if (has_flag(FLAG_SUBTRACT)) {
        displacement = -displacement;
    }
    
    positions[vertex_idx] = vec4<f32>(pos + displacement, 1.0);
}

// ============================================================================
// PHYSICS MAGNET - Sticky attractor with snap threshold
// extras[0] = snap_threshold (distance for full snap)
// ============================================================================
@compute @workgroup_size(256)
fn physics_magnet(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let vertex_idx = get_vertex_idx(global_id.x);
    if (vertex_idx == 0xFFFFFFFFu) { return; }
    
    let pos = positions[vertex_idx].xyz;
    let center = params.center.xyz;
    
    let to_center = center - pos;
    let dist = length(to_center);
    if (dist > params.radius) { return; }
    if (dist < 0.0001) { return; }
    
    var weight = falloff(dist, params.radius, params.hardness);
    weight *= sample_alpha(pos - center, params.radius);
    weight *= get_pressure();
    
    // Snap effect: stronger pull at close range
    let snap_threshold = params.extras[0].x;
    let snap_boost = smoothstep(snap_threshold, 0.0, dist);
    weight = mix(weight, 1.0, snap_boost * 0.5);
    
    let dir = normalize(to_center);
    var displacement = dir * dist * weight * params.strength;
    
    if (has_flag(FLAG_SUBTRACT)) {
        displacement = -displacement;
    }
    
    positions[vertex_idx] = vec4<f32>(pos + displacement, 1.0);
}

// ============================================================================
// PHYSICS ELASTIC - Springy deformation
// extras[0] = stiffness
// extras[1] = damping
// ============================================================================
@compute @workgroup_size(256)
fn physics_elastic(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let vertex_idx = get_vertex_idx(global_id.x);
    if (vertex_idx == 0xFFFFFFFFu) { return; }
    
    let pos = positions[vertex_idx].xyz;
    let center = params.center.xyz;
    let brush_normal = params.normal.xyz;
    
    let to_center = pos - center;
    let dist = length(to_center);
    if (dist > params.radius) { return; }
    
    let stiffness = params.extras[0].x;
    let damping = params.extras[1].x;
    
    var weight = falloff(dist, params.radius, params.hardness);
    weight *= get_pressure();
    
    // Use stroke velocity for elastic response
    let delta = params.center.xyz - params.prev_center;
    
    // Stiffness: center moves full, edges spring back
    var displacement = delta * weight * params.strength;
    
    // Damping reduces displacement at edges
    displacement *= (1.0 - damping * (1.0 - weight));
    
    if (has_flag(FLAG_SUBTRACT)) {
        displacement = -displacement;
    }
    
    positions[vertex_idx] = vec4<f32>(pos + displacement, 1.0);
}

// ============================================================================
// PHYSICS INFLATE PULSE - Radial wave expansion
// extras[0] = wave_frequency
// extras[1] = wave_phase (animate this for pulsing)
// ============================================================================
@compute @workgroup_size(256)
fn physics_inflate_pulse(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let vertex_idx = get_vertex_idx(global_id.x);
    if (vertex_idx == 0xFFFFFFFFu) { return; }
    
    let pos = positions[vertex_idx].xyz;
    let nor = normalize(normals[vertex_idx].xyz);
    let center = params.center.xyz;
    
    let to_center = pos - center;
    let dist = length(to_center);
    if (dist > params.radius) { return; }
    
    var weight = falloff(dist, params.radius, params.hardness);
    weight *= sample_alpha(to_center, params.radius);
    weight *= get_pressure();
    
    let wave_freq = params.extras[0].x;
    let wave_phase = params.extras[1].x;
    
    // Radial wave pattern
    let wave = sin(dist * wave_freq + wave_phase) * 0.5 + 0.5;
    
    var displacement = nor * wave * weight * params.strength;
    
    if (has_flag(FLAG_SUBTRACT)) {
        displacement = -displacement;
    }
    
    positions[vertex_idx] = vec4<f32>(pos + displacement, 1.0);
}

// ============================================================================
// PHYSICS TURBULENCE - Coherent noise displacement
// extras[0] = noise_scale
// extras[1] = noise_intensity
// ============================================================================
@compute @workgroup_size(256)
fn physics_turbulence(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let vertex_idx = get_vertex_idx(global_id.x);
    if (vertex_idx == 0xFFFFFFFFu) { return; }
    
    let pos = positions[vertex_idx].xyz;
    let nor = normals[vertex_idx].xyz;
    let center = params.center.xyz;
    
    let to_center = pos - center;
    let dist = length(to_center);
    if (dist > params.radius) { return; }
    
    var weight = falloff(dist, params.radius, params.hardness);
    weight *= sample_alpha(to_center, params.radius);
    weight *= get_pressure();
    
    let noise_scale = params.extras[0].x;
    let noise_intensity = params.extras[1].x;
    
    // 3D turbulent noise
    let noise = hash3(pos * noise_scale + vec3<f32>(params.random_seed)) * noise_intensity;
    
    var displacement = noise * weight * params.strength;
    
    if (has_flag(FLAG_SUBTRACT)) {
        displacement = -displacement;
    }
    
    positions[vertex_idx] = vec4<f32>(pos + displacement, 1.0);
}

// ============================================================================
// PHYSICS GRAVITY DROP - Vertices fall with gravity
// extras[0] = gravity_strength
// extras[1] = ground_plane_y
// ============================================================================
@compute @workgroup_size(256)
fn physics_gravity_drop(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let vertex_idx = get_vertex_idx(global_id.x);
    if (vertex_idx == 0xFFFFFFFFu) { return; }
    
    let pos = positions[vertex_idx].xyz;
    let center = params.center.xyz;
    
    let to_center = pos - center;
    let dist = length(to_center);
    if (dist > params.radius) { return; }
    
    var weight = falloff(dist, params.radius, params.hardness);
    weight *= get_pressure();
    
    let gravity = params.extras[0].x;
    let ground_y = params.extras[1].x;
    
    // Simple gravity: pull down in world Y
    var displacement = vec3<f32>(0.0, -gravity * weight * params.strength, 0.0);
    
    // Collision with ground plane
    let new_y = pos.y + displacement.y;
    if (new_y < ground_y) {
        displacement.y = ground_y - pos.y;
    }
    
    positions[vertex_idx] = vec4<f32>(pos + displacement, 1.0);
}

// ============================================================================
// PHYSICS WIND - Directional force field
// extras[0-2] = wind direction
// extras[3] = wind_strength
// extras[4] = turbulence (noise amount)
// ============================================================================
@compute @workgroup_size(256)
fn physics_wind(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let vertex_idx = get_vertex_idx(global_id.x);
    if (vertex_idx == 0xFFFFFFFFu) { return; }
    
    let pos = positions[vertex_idx].xyz;
    let nor = normals[vertex_idx].xyz;
    let center = params.center.xyz;
    
    let to_center = pos - center;
    let dist = length(to_center);
    if (dist > params.radius) { return; }
    
    var weight = falloff(dist, params.radius, params.hardness);
    weight *= get_pressure();
    
    let wind_dir = normalize(vec3<f32>(params.extras[0].x, params.extras[1].x, params.extras[2].x));
    let wind_strength = params.extras[3].x;
    let turbulence = params.extras[4].x;
    
    // Wind pushes surfaces facing it more
    let facing = max(0.0, dot(nor, wind_dir));
    
    // Add turbulence
    let noise = hash3(pos * 5.0 + vec3<f32>(params.random_seed)) * turbulence;
    
    var displacement = (wind_dir + noise) * facing * wind_strength * weight * params.strength;
    
    positions[vertex_idx] = vec4<f32>(pos + displacement, 1.0);
}

// ============================================================================
// PHYSICS VORTEX - Spiral force around brush axis
// extras[0] = vortex_strength
// extras[1] = inward_pull (0 = pure rotation, 1 = spiraling inward)
// ============================================================================
@compute @workgroup_size(256)
fn physics_vortex(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let vertex_idx = get_vertex_idx(global_id.x);
    if (vertex_idx == 0xFFFFFFFFu) { return; }
    
    let pos = positions[vertex_idx].xyz;
    let center = params.center.xyz;
    let axis = normalize(params.normal.xyz);
    
    let to_center = pos - center;
    let dist = length(to_center);
    if (dist > params.radius) { return; }
    
    var weight = falloff(dist, params.radius, params.hardness);
    weight *= get_pressure();
    
    let vortex_strength = params.extras[0].x;
    let inward_pull = params.extras[1].x;
    
    // Project to plane perpendicular to axis
    let along_axis = dot(to_center, axis);
    let on_plane = to_center - axis * along_axis;
    let plane_dist = length(on_plane);
    
    if (plane_dist < 0.001) { return; }
    
    // Tangent direction (perpendicular to both axis and radial)
    let radial = normalize(on_plane);
    let tangent = cross(axis, radial);
    
    // Vortex: rotate around axis + optional inward pull
    let rotation = tangent * vortex_strength * weight * params.strength;
    let pull = -radial * plane_dist * inward_pull * weight * params.strength * 0.5;
    
    positions[vertex_idx] = vec4<f32>(pos + rotation + pull, 1.0);
}
