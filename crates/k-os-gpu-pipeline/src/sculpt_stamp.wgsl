// ============================================================================
// K_OS Sculpt Stamp Kernel V2.1 - FINAL BOSS Edition
// ============================================================================
// Supports: Clay, Inflate, Standard, Blob, Draw, Layer, Flatten, Crease
// Uses BrushParamsV2.1 (464 bytes) for full feature support
// ============================================================================

// === CONSTANTS ===
const FLAG_SUBTRACT: u32 = 1u;
const FLAG_FRONT_FACES_ONLY: u32 = 2u;
const FLAG_ACCUMULATE: u32 = 4u;
const FLAG_LOCK_PLANE: u32 = 8u;
const FLAG_AUTO_MASKING: u32 = 64u;

const ALPHA_DISABLED: u32 = 0u;
const ALPHA_STAMP: u32 = 1u;

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

// === BRUSH PARAMS V2.1 (464 bytes) - FINAL BOSS ===
struct BrushParams {
    // Row 0-1: Position & Normal (32 bytes)
    center: vec4<f32>,           // xyz + pressure
    normal: vec4<f32>,           // xyz + tilt_angle
    
    // Row 2: Stroke Kinematics (16 bytes)
    velocity: vec4<f32>,         // xyz + speed
    
    // Row 3: Previous Position (16 bytes)
    prev_center: vec3<f32>,
    stroke_distance: f32,
    
    // Row 4: Core Params (16 bytes)
    radius: f32,
    strength: f32,
    hardness: f32,
    spacing: f32,
    
    // Row 5: Kernel Selection (16 bytes)
    kernel_id: u32,
    entry_point_id: u32,
    blend_mode: u32,
    flags: u32,
    
    // Row 6: Vertex Info (16 bytes)
    vertex_count: u32,
    candidate_count: u32,
    dab_index: u32,
    stroke_index: u32,
    
    // Row 7-12: Alpha Slots (96 bytes)
    alpha0: AlphaSlot,
    alpha1: AlphaSlot,
    alpha2: AlphaSlot,
    
    // Row 13: Jitter (16 bytes)
    jitter_position: f32,
    jitter_rotation: f32,
    jitter_strength: f32,
    random_seed: f32,
    
    // Row 14: Symmetry (16 bytes)
    symmetry_flags: u32,
    radial_count: u32,
    symmetry_offset_x: f32,
    symmetry_offset_y: f32,
    
    // Row 15: Automasking (16 bytes)
    automask_cavity: f32,
    automask_angle: f32,
    automask_border: f32,
    automask_face_set: u32,
    
    // Row 16: Curves (16 bytes)
    curve_pressure: u32,
    curve_speed: u32,
    curve_tilt: u32,
    curve_direction: u32,
    
    // Row 17-22: Extra Params (96 bytes) - aligned as vec4s
    extras: array<vec4<f32>, 6>,
    
    // Row 21: Locked Plane (16 bytes)
    locked_plane_normal: vec3<f32>,
    locked_plane_offset: f32,
    
    // Row 22: Locked Position (16 bytes)
    locked_position: vec3<f32>,
    locked_radius: f32,
    
    // Row 23: Pen & Stroke (16 bytes) - V2.1
    pen_rotation: f32,
    stroke_type: u32,
    backface_threshold: f32,
    accumulation_limit: f32,
    
    // Row 24: Color (16 bytes) - V2.1
    color: vec4<f32>,
    
    // Row 25: Gravity & Time (16 bytes) - V2.1
    gravity_direction: vec3<f32>,
    time: f32,
    
    // Row 26: Reserved (16 bytes)
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

// === HELPER FUNCTIONS ===
fn has_flag(flag: u32) -> bool {
    return (params.flags & flag) != 0u;
}

fn get_pressure() -> f32 {
    return params.center.w;
}

// Gaussian falloff - butter-smooth brush strokes
fn gaussian_falloff(dist: f32, radius: f32, hardness: f32) -> f32 {
    let std_dev = mix(0.8, 0.2, hardness);
    let normalized_dist = (dist / radius) * 4.0;
    let exponent = -(normalized_dist * normalized_dist) / (2.0 * std_dev * std_dev);
    return max(exp(exponent), 0.0);
}

fn falloff(dist: f32, radius: f32, hardness: f32) -> f32 {
    return gaussian_falloff(dist, radius, hardness);
}

// Sample alpha with full transform support
fn sample_alpha(local_pos: vec3<f32>, radius: f32) -> f32 {
    let slot = params.alpha0;
    if (slot.mode == ALPHA_DISABLED) {
        return 1.0;
    }
    
    // Project to UV
    var uv = (local_pos.xz / radius + 1.0) * 0.5;
    
    // Apply rotation
    let centered = uv - vec2<f32>(0.5);
    let cos_r = cos(slot.rotation);
    let sin_r = sin(slot.rotation);
    var rotated = vec2<f32>(
        centered.x * cos_r - centered.y * sin_r,
        centered.x * sin_r + centered.y * cos_r
    );
    
    // Apply scale and offset
    rotated = rotated / slot.scale;
    uv = rotated + vec2<f32>(0.5) + slot.offset;
    
    // Apply mirror
    if ((slot.mirror & 1u) != 0u) { uv.x = 1.0 - uv.x; }
    if ((slot.mirror & 2u) != 0u) { uv.y = 1.0 - uv.y; }
    
    return textureSampleLevel(alpha_texture, alpha_sampler, uv, 0.0).r * slot.blend_weight;
}

// Hash for noise/jitter
fn hash(p: vec3<f32>) -> f32 {
    var p3 = fract(p * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

// Get vertex index (handles both candidate and full dispatch modes)
fn get_vertex_idx(idx: u32) -> u32 {
    let count = counter[0];
    if (count > 0u) {
        if (idx >= count) { return 0xFFFFFFFFu; } // Invalid
        return candidates[idx];
    } else {
        if (idx >= params.vertex_count) { return 0xFFFFFFFFu; }
        return idx;
    }
}

// ============================================================================
// STAMP MAIN - Standard displacement along brush normal
// ============================================================================
@compute @workgroup_size(256)
fn stamp_main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let vertex_idx = get_vertex_idx(global_id.x);
    if (vertex_idx == 0xFFFFFFFFu) { return; }
    
    let pos = positions[vertex_idx].xyz;
    let nor = normals[vertex_idx].xyz;
    let center = params.center.xyz;
    let brush_normal = params.normal.xyz;
    
    let to_center = pos - center;
    let dist = length(to_center);
    if (dist > params.radius) { return; }
    
    // Front face check
    if (has_flag(FLAG_FRONT_FACES_ONLY) && dot(nor, -brush_normal) < 0.0) { return; }
    
    // Calculate weight
    var weight = falloff(dist, params.radius, params.hardness);
    let surface_local = to_center - dot(to_center, brush_normal) * brush_normal;
    weight *= sample_alpha(surface_local, params.radius);
    
    // Apply pressure
    weight *= get_pressure();
    
    // Apply jitter
    if (params.jitter_strength > 0.0) {
        let noise = hash(pos + params.random_seed);
        weight *= 1.0 + (noise - 0.5) * params.jitter_strength;
    }
    
    // Calculate displacement
    var displacement = brush_normal * weight * params.strength;
    
    // Subtract mode
    if (has_flag(FLAG_SUBTRACT)) {
        displacement = -displacement;
    }
    
    positions[vertex_idx] = vec4<f32>(pos + displacement, 1.0);
}

// ============================================================================
// STAMP CLAY - Plane-based displacement with buildup
// ============================================================================
@compute @workgroup_size(256)
fn stamp_clay(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let vertex_idx = get_vertex_idx(global_id.x);
    if (vertex_idx == 0xFFFFFFFFu) { return; }
    
    let pos = positions[vertex_idx].xyz;
    let nor = normals[vertex_idx].xyz;
    let center = params.center.xyz;
    let brush_normal = params.normal.xyz;
    
    let to_center = pos - center;
    let dist = length(to_center);
    if (dist > params.radius) { return; }
    
    if (has_flag(FLAG_FRONT_FACES_ONLY) && dot(nor, -brush_normal) < 0.0) { return; }
    
    var weight = falloff(dist, params.radius, params.hardness);
    let surface_local = to_center - dot(to_center, brush_normal) * brush_normal;
    weight *= sample_alpha(surface_local, params.radius);
    weight *= get_pressure();
    
    // Clay: plane-based displacement
    let plane_dist = dot(to_center, brush_normal);
    let plane_offset = params.extras[0].x; // extra0 = plane offset (scalar)
    
    var displacement: f32;
    if (!has_flag(FLAG_SUBTRACT)) {
        displacement = max(0.0, (plane_offset - plane_dist)) * weight * params.strength;
    } else {
        displacement = min(0.0, (-plane_offset - plane_dist)) * weight * params.strength;
    }
    
    positions[vertex_idx] = vec4<f32>(pos + brush_normal * displacement, 1.0);
}

// ============================================================================
// STAMP INFLATE - Displacement along vertex normal
// ============================================================================
@compute @workgroup_size(256)
fn stamp_inflate(@builtin(global_invocation_id) global_id: vec3<u32>) {
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
    
    // Inflate: displace along VERTEX normal (not brush normal)
    var displacement = nor * weight * params.strength;
    
    if (has_flag(FLAG_SUBTRACT)) {
        displacement = -displacement;
    }
    
    positions[vertex_idx] = vec4<f32>(pos + displacement, 1.0);
}

// ============================================================================
// STAMP FLATTEN - Project vertices toward a plane
// extras[0] = lock_plane (0 = dynamic, 1 = use locked_plane_normal)
// ============================================================================
@compute @workgroup_size(256)
fn stamp_flatten(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let vertex_idx = get_vertex_idx(global_id.x);
    if (vertex_idx == 0xFFFFFFFFu) { return; }
    
    let pos = positions[vertex_idx].xyz;
    let nor = normals[vertex_idx].xyz;
    let center = params.center.xyz;
    let brush_normal = params.normal.xyz;
    
    let to_center = pos - center;
    let dist = length(to_center);
    if (dist > params.radius) { return; }
    
    if (has_flag(FLAG_FRONT_FACES_ONLY) && dot(nor, -brush_normal) < 0.0) { return; }
    
    var weight = falloff(dist, params.radius, params.hardness);
    weight *= sample_alpha(to_center, params.radius);
    weight *= get_pressure();
    
    // Determine plane normal
    var plane_normal = brush_normal;
    if (has_flag(FLAG_LOCK_PLANE)) {
        plane_normal = normalize(params.locked_plane_normal);
    }
    
    // Calculate signed distance to plane
    let plane_dist = dot(to_center, plane_normal);
    
    // Move vertex toward plane
    let displacement = -plane_normal * plane_dist * weight * params.strength;
    
    positions[vertex_idx] = vec4<f32>(pos + displacement, 1.0);
}

// ============================================================================
// STAMP CREASE - Pinch toward center + depth displacement
// extras[0] = crease_depth
// ============================================================================
@compute @workgroup_size(256)
fn stamp_crease(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let vertex_idx = get_vertex_idx(global_id.x);
    if (vertex_idx == 0xFFFFFFFFu) { return; }
    
    let pos = positions[vertex_idx].xyz;
    let nor = normals[vertex_idx].xyz;
    let center = params.center.xyz;
    let brush_normal = params.normal.xyz;
    
    let to_center = pos - center;
    let dist = length(to_center);
    if (dist > params.radius) { return; }
    
    if (has_flag(FLAG_FRONT_FACES_ONLY) && dot(nor, -brush_normal) < 0.0) { return; }
    
    var weight = falloff(dist, params.radius, params.hardness);
    weight *= sample_alpha(to_center, params.radius);
    weight *= get_pressure();
    
    let crease_depth = params.extras[0].x;
    
    // Project to plane perpendicular to brush normal
    let radial = to_center - dot(to_center, brush_normal) * brush_normal;
    let radial_dist = length(radial);
    
    // Pinch toward center line
    var pinch_displacement = vec3<f32>(0.0);
    if (radial_dist > 0.001) {
        let pinch_dir = -normalize(radial);
        pinch_displacement = pinch_dir * radial_dist * weight * params.strength;
    }
    
    // Depth displacement
    var depth_displacement = brush_normal * weight * params.strength * crease_depth;
    if (has_flag(FLAG_SUBTRACT)) {
        depth_displacement = -depth_displacement;
    }
    
    positions[vertex_idx] = vec4<f32>(pos + pinch_displacement + depth_displacement, 1.0);
}

// ============================================================================
// STAMP LAYER - Displacement to a fixed height ceiling
// extras[0] = layer_height (target height from initial surface)
// ============================================================================
@compute @workgroup_size(256)
fn stamp_layer(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let vertex_idx = get_vertex_idx(global_id.x);
    if (vertex_idx == 0xFFFFFFFFu) { return; }
    
    let pos = positions[vertex_idx].xyz;
    let nor = normals[vertex_idx].xyz;
    let center = params.center.xyz;
    let brush_normal = params.normal.xyz;
    
    let to_center = pos - center;
    let dist = length(to_center);
    if (dist > params.radius) { return; }
    
    if (has_flag(FLAG_FRONT_FACES_ONLY) && dot(nor, -brush_normal) < 0.0) { return; }
    
    var weight = falloff(dist, params.radius, params.hardness);
    weight *= sample_alpha(to_center, params.radius);
    weight *= get_pressure();
    
    let layer_height = params.extras[0].x;
    
    // Calculate current height along brush normal from locked position
    let locked_center = params.locked_position;
    let height_from_locked = dot(pos - locked_center, brush_normal);
    
    // Move toward target layer height
    let target_height = layer_height * params.strength;
    let height_diff = target_height - height_from_locked;
    
    var displacement = brush_normal * height_diff * weight;
    
    if (has_flag(FLAG_SUBTRACT)) {
        displacement = -displacement;
    }
    
    positions[vertex_idx] = vec4<f32>(pos + displacement, 1.0);
}

// ============================================================================
// STAMP BLOB - Soft organic buildup with randomized direction
// ============================================================================
@compute @workgroup_size(256)
fn stamp_blob(@builtin(global_invocation_id) global_id: vec3<u32>) {
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
    
    // Blend between brush normal and vertex normal for organic feel
    let blend = params.extras[0].x; // 0 = pure brush normal, 1 = pure vertex normal
    let direction = normalize(mix(brush_normal, nor, blend));
    
    // Add some noise for organic variation
    let noise = hash(pos * 10.0 + params.random_seed) * 2.0 - 1.0;
    let noise_amount = params.extras[1].x;
    let noisy_weight = weight * (1.0 + noise * noise_amount);
    
    var displacement = direction * noisy_weight * params.strength;
    
    if (has_flag(FLAG_SUBTRACT)) {
        displacement = -displacement;
    }
    
    positions[vertex_idx] = vec4<f32>(pos + displacement, 1.0);
}

// ============================================================================
// STAMP HPOLISH - Trims peaks while keeping valleys (hard surface polish)
// ============================================================================
@compute @workgroup_size(256)
fn stamp_hpolish(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let vertex_idx = get_vertex_idx(global_id.x);
    if (vertex_idx == 0xFFFFFFFFu) { return; }
    
    let pos = positions[vertex_idx].xyz;
    let nor = normals[vertex_idx].xyz;
    let center = params.center.xyz;
    let brush_normal = params.normal.xyz;
    
    let to_center = pos - center;
    let dist = length(to_center);
    if (dist > params.radius) { return; }
    
    if (has_flag(FLAG_FRONT_FACES_ONLY) && dot(nor, -brush_normal) < 0.0) { return; }
    
    var weight = falloff(dist, params.radius, params.hardness);
    weight *= sample_alpha(to_center, params.radius);
    weight *= get_pressure();
    
    // Only affect vertices ABOVE the plane (peaks)
    let plane_dist = dot(to_center, brush_normal);
    
    var displacement = vec3<f32>(0.0);
    if (plane_dist > 0.0) {
        // Push down toward plane (trim peaks)
        displacement = -brush_normal * plane_dist * weight * params.strength;
    }
    // Valleys (plane_dist < 0) are left untouched
    
    if (has_flag(FLAG_SUBTRACT)) {
        // Invert: fill valleys instead
        if (plane_dist < 0.0) {
            displacement = -brush_normal * plane_dist * weight * params.strength;
        } else {
            displacement = vec3<f32>(0.0);
        }
    }
    
    positions[vertex_idx] = vec4<f32>(pos + displacement, 1.0);
}

// ============================================================================
// STAMP SCRAPE - Directional plane cut (like a knife)
// extras[0] = scrape_angle (tilt of the scrape plane)
// ============================================================================
@compute @workgroup_size(256)
fn stamp_scrape(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let vertex_idx = get_vertex_idx(global_id.x);
    if (vertex_idx == 0xFFFFFFFFu) { return; }
    
    let pos = positions[vertex_idx].xyz;
    let nor = normals[vertex_idx].xyz;
    let center = params.center.xyz;
    let brush_normal = params.normal.xyz;
    
    let to_center = pos - center;
    let dist = length(to_center);
    if (dist > params.radius) { return; }
    
    if (has_flag(FLAG_FRONT_FACES_ONLY) && dot(nor, -brush_normal) < 0.0) { return; }
    
    var weight = falloff(dist, params.radius, params.hardness);
    weight *= sample_alpha(to_center, params.radius);
    weight *= get_pressure();
    
    // Scrape uses stroke direction for tilted plane
    let stroke_dir = normalize(params.velocity.xyz + vec3<f32>(0.0001, 0.0, 0.0));
    let scrape_angle = params.extras[0].x;
    
    // Tilt the plane based on stroke direction
    let tilt_axis = cross(brush_normal, stroke_dir);
    let cos_a = cos(scrape_angle);
    let sin_a = sin(scrape_angle);
    let tilted_normal = brush_normal * cos_a + cross(tilt_axis, brush_normal) * sin_a;
    
    let plane_dist = dot(to_center, tilted_normal);
    
    var displacement = vec3<f32>(0.0);
    if (plane_dist > 0.0) {
        displacement = -tilted_normal * plane_dist * weight * params.strength;
    }
    
    if (has_flag(FLAG_SUBTRACT)) {
        displacement = -displacement;
    }
    
    positions[vertex_idx] = vec4<f32>(pos + displacement, 1.0);
}
