// Brush Cursor Shader - Industry standard sculpting cursor with falloff visualization
// Renders a circle with gradient falloff that projects onto mesh surface

#import bevy_pbr::forward_io::VertexOutput

struct BrushCursorData {
    color: vec4<f32>,
    radius: f32,
    falloff: f32,
    alpha: f32,
    // For grab brush delta visualization
    show_delta: f32,
    delta_start: vec3<f32>,
    delta_end: vec3<f32>,
    _padding: f32,
};

@group(0) @binding(0) var<uniform> material: BrushCursorData;

@fragment
fn fragment(in: VertexOutput) -> @location(0) vec4<f32> {
    // Calculate distance from center in UV space
    let uv = in.uv - vec2<f32>(0.5, 0.5);
    let dist = length(uv) * 2.0; // Normalize to 0-1 across the circle
    
    // Create falloff gradient
    let falloff_start = material.radius * (1.0 - material.falloff);
    let edge_alpha = smoothstep(material.radius, falloff_start, dist);
    
    // Add inner ring for better visibility
    let inner_ring = smoothstep(0.05, 0.1, dist) * (1.0 - smoothstep(0.15, 0.2, dist));
    
    // Combine alpha values
    let alpha = max(edge_alpha, inner_ring * 0.5) * material.alpha;
    
    // Apply color
    let out_color = vec4<f32>(material.color.rgb, alpha);
    
    // Alpha discard for transparency
    if (out_color.a < 0.01) {
        discard;
    }
    
    return out_color;
}
