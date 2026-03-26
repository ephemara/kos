// Texture Projection Shader
//
// Projects source images onto mesh surface using camera poses.
// Blends multiple projections for best quality.

struct CameraParams {
    view_matrix: mat4x4<f32>,
    projection_matrix: mat4x4<f32>,
    position: vec4<f32>,  // Camera position (w unused, for alignment)
}

struct ProjectionParams {
    num_cameras: u32,
    blend_mode: u32,  // 0 = average, 1 = weighted by angle
    _padding: vec2<u32>,
}

@group(0) @binding(0) var<storage, read> vertices: array<vec4<f32>>;  // Vertex positions (w=1 for alignment)
@group(0) @binding(1) var<storage, read> normals: array<vec4<f32>>;   // Vertex normals (w unused)
@group(0) @binding(2) var<storage, read> uvs: array<vec2<f32>>;       // UV coordinates
@group(0) @binding(3) var<storage, read> cameras: array<CameraParams>;
@group(0) @binding(4) var<uniform> params: ProjectionParams;

@group(1) @binding(0) var source_textures: binding_array<texture_2d<f32>>;
@group(1) @binding(1) var texture_sampler: sampler;

@group(2) @binding(0) var output_texture: texture_storage_2d<rgba8unorm, write>;

@compute @workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let dims = textureDimensions(output_texture);
    if (global_id.x >= dims.x || global_id.y >= dims.y) {
        return;
    }
    
    let coords = vec2<i32>(global_id.xy);
    let uv = vec2<f32>(global_id.xy) / vec2<f32>(dims);
    
    // Find closest vertex to this UV (simplified - in production, use proper UV lookup)
    var closest_vertex_idx = 0u;
    var min_dist = 999999.0;
    
    for (var i = 0u; i < arrayLength(&uvs); i++) {
        let vertex_uv = uvs[i];
        let dist = distance(uv, vertex_uv);
        if (dist < min_dist) {
            min_dist = dist;
            closest_vertex_idx = i;
        }
    }
    
    let vertex_pos = vertices[closest_vertex_idx].xyz;
    let vertex_normal = normalize(normals[closest_vertex_idx].xyz);
    
    // Project from all cameras and blend
    var accumulated_color = vec4<f32>(0.0);
    var total_weight = 0.0;
    
    for (var cam_idx = 0u; cam_idx < params.num_cameras; cam_idx++) {
        let camera = cameras[cam_idx];
        
        // Transform vertex to camera space
        let view_pos = camera.view_matrix * vec4<f32>(vertex_pos, 1.0);
        
        // Check if vertex is in front of camera
        if (view_pos.z > 0.0) {
            continue;
        }
        
        // Project to screen space
        let proj_pos = camera.projection_matrix * view_pos;
        let ndc = proj_pos.xyz / proj_pos.w;
        
        // Check if in viewport
        if (abs(ndc.x) > 1.0 || abs(ndc.y) > 1.0) {
            continue;
        }
        
        // Convert to texture coordinates
        let tex_coords = vec2<f32>(
            (ndc.x + 1.0) * 0.5,
            (1.0 - ndc.y) * 0.5
        );
        
        // Sample source texture
        let sampled_color = textureSampleLevel(
            source_textures[cam_idx],
            texture_sampler,
            tex_coords,
            0.0
        );
        
        // Compute weight based on viewing angle
        let view_dir = normalize(camera.position.xyz - vertex_pos);
        let angle_weight = max(0.0, dot(vertex_normal, view_dir));
        
        // Blend mode
        var weight = 1.0;
        if (params.blend_mode == 1u) {
            weight = angle_weight;
        }
        
        accumulated_color += sampled_color * weight;
        total_weight += weight;
    }
    
    // Normalize and write output
    var final_color = vec4<f32>(0.5, 0.5, 0.5, 1.0);  // Default gray
    if (total_weight > 0.0) {
        final_color = accumulated_color / total_weight;
    }
    
    textureStore(output_texture, coords, final_color);
}
