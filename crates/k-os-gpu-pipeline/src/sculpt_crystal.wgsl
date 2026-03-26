// ============================================================================
// K_OS Sculpt Crystal Kernel V2 - Maximum Modularity Edition
// ============================================================================
// Supports: Crystal Growth, Voronoi Shatter, Bismuth, Hexagonal patterns
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

// Hash for Voronoi cells
fn hash3_to_3(p: vec3<f32>) -> vec3<f32> {
    var q = vec3<f32>(
        dot(p, vec3<f32>(127.1, 311.7, 74.7)),
        dot(p, vec3<f32>(269.5, 183.3, 246.1)),
        dot(p, vec3<f32>(113.5, 271.9, 124.6))
    );
    return fract(sin(q) * 43758.5453);
}

// ============================================================================
// CRYSTAL GROWTH - Snap to crystalline lattice
// extras[0] = lattice_scale
// extras[1] = snap_strength (0-1)
// extras[2] = mode (0=cubic, 1=hexagonal, 2=diamond)
// ============================================================================
@compute @workgroup_size(256)
fn crystal_growth(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let vertex_idx = get_vertex_idx(global_id.x);
    if (vertex_idx == 0xFFFFFFFFu) { return; }
    
    let pos = positions[vertex_idx].xyz;
    let nor = normals[vertex_idx].xyz;
    let center = params.center.xyz;
    
    let to_center = pos - center;
    let dist = length(to_center);
    if (dist > params.radius) { return; }
    
    if (has_flag(FLAG_FRONT_FACES_ONLY) && dot(nor, -params.normal.xyz) < 0.0) { return; }
    
    var weight = falloff(dist, params.radius, params.hardness);
    weight *= sample_alpha(to_center, params.radius);
    weight *= get_pressure();
    
    let lattice_scale = params.extras[0].x;
    let snap_strength = params.extras[1].x;
    let mode = u32(params.extras[2].x);
    
    var lattice_point: vec3<f32>;
    
    if (mode == 0u) {
        // CUBIC LATTICE
        lattice_point = round(pos / lattice_scale) * lattice_scale;
    } else if (mode == 1u) {
        // HEXAGONAL LATTICE
        let grid_pos = pos / lattice_scale;
        let row = floor(grid_pos.y);
        var offset_x = 0.0;
        if (i32(row) % 2 == 1) {
            offset_x = 0.5;
        }
        lattice_point = vec3<f32>(
            round(grid_pos.x - offset_x) + offset_x,
            round(grid_pos.y),
            round(grid_pos.z)
        ) * lattice_scale;
    } else {
        // DIAMOND/FCC LATTICE
        let grid_pos = pos / lattice_scale;
        let base = floor(grid_pos);
        let frac = grid_pos - base;
        
        // Find closest FCC point
        var min_dist = 999.0;
        var closest = base;
        
        // Check corners and face centers
        for (var dx = 0; dx <= 1; dx++) {
            for (var dy = 0; dy <= 1; dy++) {
                for (var dz = 0; dz <= 1; dz++) {
                    let corner = base + vec3<f32>(f32(dx), f32(dy), f32(dz));
                    let d = length(grid_pos - corner);
                    if (d < min_dist) {
                        min_dist = d;
                        closest = corner;
                    }
                }
            }
        }
        
        // Face centers
        let face_centers = array<vec3<f32>, 3>(
            base + vec3<f32>(0.5, 0.5, 0.0),
            base + vec3<f32>(0.5, 0.0, 0.5),
            base + vec3<f32>(0.0, 0.5, 0.5)
        );
        
        for (var i = 0; i < 3; i++) {
            let d = length(grid_pos - face_centers[i]);
            if (d < min_dist) {
                min_dist = d;
                closest = face_centers[i];
            }
        }
        
        lattice_point = closest * lattice_scale;
    }
    
    // Displacement toward lattice
    let to_lattice = lattice_point - pos;
    var displacement = to_lattice * snap_strength * weight * params.strength;
    
    if (has_flag(FLAG_SUBTRACT)) {
        displacement = -displacement;
    }
    
    positions[vertex_idx] = vec4<f32>(pos + displacement, 1.0);
}

// ============================================================================
// VORONOI SHATTER - Displace toward Voronoi cell centers
// extras[0] = cell_scale
// extras[1] = shatter_depth
// extras[2] = crack_width (edge depression)
// ============================================================================
@compute @workgroup_size(256)
fn voronoi_shatter(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let vertex_idx = get_vertex_idx(global_id.x);
    if (vertex_idx == 0xFFFFFFFFu) { return; }
    
    let pos = positions[vertex_idx].xyz;
    let nor = normalize(normals[vertex_idx].xyz);
    let center = params.center.xyz;
    
    let to_center = pos - center;
    let dist = length(to_center);
    if (dist > params.radius) { return; }
    
    if (has_flag(FLAG_FRONT_FACES_ONLY) && dot(nor, -params.normal.xyz) < 0.0) { return; }
    
    var weight = falloff(dist, params.radius, params.hardness);
    weight *= sample_alpha(to_center, params.radius);
    weight *= get_pressure();
    
    let cell_scale = params.extras[0].x;
    let shatter_depth = params.extras[1].x;
    let crack_width = params.extras[2].x;
    
    // Find Voronoi cell
    let scaled_pos = pos / cell_scale;
    let cell_base = floor(scaled_pos);
    
    var nearest_center = vec3<f32>(0.0);
    var nearest_dist = 999.0;
    var second_nearest_dist = 999.0;
    
    // Search 3x3x3 neighborhood
    for (var dx = -1; dx <= 1; dx++) {
        for (var dy = -1; dy <= 1; dy++) {
            for (var dz = -1; dz <= 1; dz++) {
                let cell = cell_base + vec3<f32>(f32(dx), f32(dy), f32(dz));
                let cell_center = cell + hash3_to_3(cell);
                let d = length(scaled_pos - cell_center);
                
                if (d < nearest_dist) {
                    second_nearest_dist = nearest_dist;
                    nearest_dist = d;
                    nearest_center = cell_center;
                } else if (d < second_nearest_dist) {
                    second_nearest_dist = d;
                }
            }
        }
    }
    
    // Edge detection: if close to boundary between cells
    let edge_dist = second_nearest_dist - nearest_dist;
    let is_edge = smoothstep(crack_width, 0.0, edge_dist);
    
    let world_cell_center = nearest_center * cell_scale;
    
    var displacement: vec3<f32>;
    if (is_edge > 0.5) {
        // Edge vertices: push down (creates cracks)
        displacement = -nor * is_edge * shatter_depth * weight * params.strength;
    } else {
        // Interior: slight push toward cell center
        let to_cell = world_cell_center - pos;
        let planar_push = to_cell - nor * dot(to_cell, nor);
        displacement = planar_push * (1.0 - is_edge) * shatter_depth * weight * params.strength * 0.3;
    }
    
    if (has_flag(FLAG_SUBTRACT)) {
        displacement = -displacement;
    }
    
    positions[vertex_idx] = vec4<f32>(pos + displacement, 1.0);
}

// ============================================================================
// CRYSTAL BISMUTH - Stepped terracing effect
// extras[0] = step_height
// extras[1] = step_count
// ============================================================================
@compute @workgroup_size(256)
fn crystal_bismuth(@builtin(global_invocation_id) global_id: vec3<u32>) {
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
    
    let step_height = params.extras[0].x;
    let step_count = params.extras[1].x;
    
    // Height along brush normal
    let height_along_normal = dot(to_center, brush_normal);
    
    // Quantize to steps
    let step_unit = params.radius / step_count;
    let quantized_height = round(height_along_normal / step_unit) * step_unit;
    let height_diff = quantized_height - height_along_normal;
    
    // Apply stepped displacement
    var displacement = brush_normal * height_diff * weight * params.strength;
    
    if (has_flag(FLAG_SUBTRACT)) {
        displacement = -displacement;
    }
    
    positions[vertex_idx] = vec4<f32>(pos + displacement, 1.0);
}

// ============================================================================
// CRYSTAL SCALES - Reptile/fish scale pattern
// extras[0] = scale_size
// extras[1] = scale_depth
// extras[2] = overlap (0-1)
// ============================================================================
@compute @workgroup_size(256)
fn crystal_scales(@builtin(global_invocation_id) global_id: vec3<u32>) {
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
    
    let scale_size = params.extras[0].x;
    let scale_depth = params.extras[1].x;
    let overlap = params.extras[2].x;
    
    // Project to 2D for scale pattern
    let local_2d = to_center.xz / scale_size;
    let row = floor(local_2d.y);
    var offset = 0.0;
    if (i32(row) % 2 == 1) {
        offset = 0.5;
    }
    
    let cell_x = floor(local_2d.x + offset);
    let cell_y = row;
    
    let scale_center = vec2<f32>(cell_x - offset + 0.5, cell_y + 0.5);
    let local_in_scale = local_2d - scale_center;
    
    // Elliptical scale shape with overlap
    let scale_dist = length(local_in_scale * vec2<f32>(1.0, 1.0 - overlap * 0.5));
    
    // Depression at scale edges, raised at center
    let scale_profile = smoothstep(0.5, 0.0, scale_dist);
    
    var displacement = nor * (scale_profile - 0.5) * scale_depth * weight * params.strength;
    
    if (has_flag(FLAG_SUBTRACT)) {
        displacement = -displacement;
    }
    
    positions[vertex_idx] = vec4<f32>(pos + displacement, 1.0);
}

// ============================================================================
// CRYSTAL FACETS - Hard-edged faceted surface
// extras[0] = facet_size
// extras[1] = facet_depth
// ============================================================================
@compute @workgroup_size(256)
fn crystal_facets(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let vertex_idx = get_vertex_idx(global_id.x);
    if (vertex_idx == 0xFFFFFFFFu) { return; }
    
    let pos = positions[vertex_idx].xyz;
    let nor = normalize(normals[vertex_idx].xyz);
    let center = params.center.xyz;
    
    let to_center = pos - center;
    let dist = length(to_center);
    if (dist > params.radius) { return; }
    
    var weight = falloff(dist, params.radius, params.hardness);
    weight *= get_pressure();
    
    let facet_size = params.extras[0].x;
    let facet_depth = params.extras[1].x;
    
    // Find nearest facet center using Voronoi
    let scaled = pos / facet_size;
    let cell = floor(scaled);
    
    var nearest = cell + hash3_to_3(cell);
    var min_d = length(scaled - nearest);
    
    for (var dx = -1; dx <= 1; dx++) {
        for (var dy = -1; dy <= 1; dy++) {
            for (var dz = -1; dz <= 1; dz++) {
                let nc = cell + vec3<f32>(f32(dx), f32(dy), f32(dz));
                let np = nc + hash3_to_3(nc);
                let d = length(scaled - np);
                if (d < min_d) {
                    min_d = d;
                    nearest = np;
                }
            }
        }
    }
    
    // Compute facet normal (gradient toward center)
    let facet_center = nearest * facet_size;
    let to_facet = normalize(pos - facet_center);
    
    // Project position onto facet plane
    let facet_dist = dot(pos - facet_center, to_facet);
    
    var displacement = -to_facet * facet_dist * facet_depth * weight * params.strength * 0.5;
    
    if (has_flag(FLAG_SUBTRACT)) {
        displacement = -displacement;
    }
    
    positions[vertex_idx] = vec4<f32>(pos + displacement, 1.0);
}
