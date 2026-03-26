// GPU Loop Subdivision Shader v2 - Exact CPU parity path
// Uses exact Loop beta weights and per-edge opposite vertices.

@group(0) @binding(0) var<storage, read> positions_in: array<f32>;
@group(0) @binding(1) var<storage, read> indices_in: array<u32>;
@group(0) @binding(2) var<storage, read_write> positions_out: array<f32>;
@group(0) @binding(3) var<storage, read> neighbor_offsets: array<u32>;
@group(0) @binding(4) var<storage, read> neighbor_data: array<u32>;
@group(0) @binding(5) var<storage, read> edge_endpoints: array<u32>;
@group(0) @binding(6) var<storage, read> edge_opposites: array<u32>;
@group(0) @binding(7) var<uniform> uniforms: Uniforms;

struct Uniforms {
    orig_vertex_count: u32,
    edge_count: u32,
    _pad0: u32,
    _pad1: u32,
}

fn get_pos(idx: u32) -> vec3<f32> {
    return vec3<f32>(
        positions_in[idx * 3u],
        positions_in[idx * 3u + 1u],
        positions_in[idx * 3u + 2u]
    );
}

fn set_pos(idx: u32, pos: vec3<f32>) {
    positions_out[idx * 3u] = pos.x;
    positions_out[idx * 3u + 1u] = pos.y;
    positions_out[idx * 3u + 2u] = pos.z;
}

// Exact CPU reference formula:
// beta = (1/n) * (5/8 - (3/8 + 1/4 * cos(2*pi/n))^2)
fn loop_beta_exact(n: u32) -> f32 {
    let n_f = f32(n);
    let angle = 2.0 * 3.14159265358979323846 / n_f;
    return (1.0 / n_f) * (0.625 - pow(0.375 + 0.25 * cos(angle), 2.0));
}

@compute @workgroup_size(256)
fn smooth_original_vertices(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let vertex_idx = global_id.x;
    if (vertex_idx >= uniforms.orig_vertex_count) {
        return;
    }

    let start = neighbor_offsets[vertex_idx];
    let end = neighbor_offsets[vertex_idx + 1u];
    let n = end - start;

    if (n == 0u) {
        set_pos(vertex_idx, get_pos(vertex_idx));
        return;
    }

    var neighbor_sum = vec3<f32>(0.0, 0.0, 0.0);
    for (var i = start; i < end; i = i + 1u) {
        let neighbor_idx = neighbor_data[i];
        neighbor_sum = neighbor_sum + get_pos(neighbor_idx);
    }

    let beta = loop_beta_exact(n);
    let original_pos = get_pos(vertex_idx);
    let weight_self = 1.0 - f32(n) * beta;
    let new_pos = weight_self * original_pos + beta * neighbor_sum;

    set_pos(vertex_idx, new_pos);
}

@compute @workgroup_size(256)
fn compute_edge_vertices(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let edge_idx = global_id.x;
    if (edge_idx >= uniforms.edge_count) {
        return;
    }

    let base = edge_idx * 2u;
    let v0 = edge_endpoints[base];
    let v1 = edge_endpoints[base + 1u];
    let opp0 = edge_opposites[base];
    let opp1 = edge_opposites[base + 1u];

    let p0 = get_pos(v0);
    let p1 = get_pos(v1);

    var edge_pos = (p0 + p1) * 0.5;

    // Interior edge with two valid opposite vertices:
    if (opp0 != 0xFFFFFFFFu && opp1 != 0xFFFFFFFFu) {
        let o0 = get_pos(opp0);
        let o1 = get_pos(opp1);
        edge_pos = (p0 + p1) * (3.0 / 8.0) + (o0 + o1) * (1.0 / 8.0);
    }

    let new_vertex_idx = uniforms.orig_vertex_count + edge_idx;
    set_pos(new_vertex_idx, edge_pos);
}
