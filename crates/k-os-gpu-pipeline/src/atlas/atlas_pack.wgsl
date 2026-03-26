// GPU Atlas Island Packing Compute Shaders
// MaxRects bin packing algorithm on GPU

// Island data: bounding box (min_u, min_v, max_u, max_v)
struct Island {
    min_u: f32,
    min_v: f32,
    max_u: f32,
    max_v: f32,
    // Computed by shader:
    offset_u: f32,
    offset_v: f32,
    packed: u32,  // 1 if successfully packed, 0 otherwise
    _padding: u32,
}

struct PackParams {
    island_count: u32,
    padding: f32,        // Padding between islands (UV space)
    target_size: f32,    // Target atlas size (1.0 = full UV space)
    _padding: u32,
}

@group(0) @binding(0) var<uniform> params: PackParams;
@group(0) @binding(1) var<storage, read_write> islands: array<Island>;

// Get island dimensions
fn island_width(i: u32) -> f32 {
    return islands[i].max_u - islands[i].min_u + params.padding * 2.0;
}

fn island_height(i: u32) -> f32 {
    return islands[i].max_v - islands[i].min_v + params.padding * 2.0;
}

// Simple row-based packing (first pass)
// Each workgroup handles one island
@compute @workgroup_size(1)
fn pack_row(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let i = global_id.x;
    if i >= params.island_count {
        return;
    }
    
    let w = island_width(i);
    let h = island_height(i);
    
    // Simple row-based placement
    // This is a naive approach - real MaxRects would be more complex
    // For GPU efficiency, we use a simpler shelf-based algorithm
    
    var x: f32 = 0.0;
    var y: f32 = 0.0;
    var row_height: f32 = 0.0;
    
    // Calculate position based on previous islands
    for (var j: u32 = 0u; j < i; j++) {
        let prev_w = island_width(j);
        let prev_h = island_height(j);
        
        // Try to fit in current row
        if x + prev_w <= params.target_size {
            x += prev_w;
            row_height = max(row_height, prev_h);
        } else {
            // Move to next row
            x = prev_w;
            y += row_height;
            row_height = prev_h;
        }
    }
    
    // Now place this island
    if x + w <= params.target_size {
        // Fits in current row
        islands[i].offset_u = x + params.padding - islands[i].min_u;
        islands[i].offset_v = y + params.padding - islands[i].min_v;
        islands[i].packed = 1u;
    } else if y + row_height + h <= params.target_size {
        // Move to next row
        islands[i].offset_u = params.padding - islands[i].min_u;
        islands[i].offset_v = y + row_height + params.padding - islands[i].min_v;
        islands[i].packed = 1u;
    } else {
        // Doesn't fit - mark as not packed
        islands[i].offset_u = 0.0;
        islands[i].offset_v = 0.0;
        islands[i].packed = 0u;
    }
}

// Entry point for calculating island bounding boxes from UVs
struct BBoxParams {
    vertex_count: u32,
    island_count: u32,
    _padding1: u32,
    _padding2: u32,
}

@group(0) @binding(0) var<uniform> bbox_params: BBoxParams;
@group(0) @binding(1) var<storage, read> uvs: array<f32>;           // u,v interleaved
@group(0) @binding(2) var<storage, read> island_ids: array<u32>;    // Per-vertex island ID
@group(0) @binding(3) var<storage, read_write> island_bounds: array<Island>;

// Atomic min/max would be ideal but WGSL doesn't have atomic floats
// So we compute bounds on CPU and just do packing on GPU
