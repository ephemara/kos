// Volume Rendering & Visualization
// Based on FluidDynamics.kn FluidRaymarching, Schlieren, Holography shaders

struct VisualizationParams {
    exposure: f32,
    contrast: f32,
    saturation: f32,
    line_thickness: f32,
    sample_count: i32,
    step_size: f32,
    _padding1: f32,
    _padding2: f32,
    color_a: vec3<f32>,
    _padding3: f32,
    color_b: vec3<f32>,
    _padding4: f32,
    color_c: vec3<f32>,
    _padding5: f32,
}

@group(0) @binding(0) var<uniform> viz: VisualizationParams;
@group(0) @binding(1) var density_texture: texture_3d<f32>;
@group(0) @binding(2) var density_sampler: sampler;
@group(0) @binding(3) var velocity_texture: texture_3d<f32>;
@group(0) @binding(4) var velocity_sampler: sampler;
@group(0) @binding(5) var temperature_texture: texture_3d<f32>;
@group(0) @binding(6) var temperature_sampler: sampler;
@group(0) @binding(7) var<storage, read_write> output: array<vec4<f32>>;

fn sample_density(pos: vec3<f32>) -> f32 {
    let clamped = clamp(pos, vec3<f32>(0.0), vec3<f32>(1.0));
    return textureSampleLevel(density_texture, density_sampler, clamped, 0.0).x;
}

fn sample_velocity(pos: vec3<f32>) -> vec3<f32> {
    let clamped = clamp(pos, vec3<f32>(0.0), vec3<f32>(1.0));
    return textureSampleLevel(velocity_texture, velocity_sampler, clamped, 0.0).xyz;
}

fn sample_temperature(pos: vec3<f32>) -> f32 {
    let clamped = clamp(pos, vec3<f32>(0.0), vec3<f32>(1.0));
    return textureSampleLevel(temperature_texture, temperature_sampler, clamped, 0.0).x;
}

// Volume raymarching for density visualization
@compute @workgroup_size(8, 8, 1)
fn volume_raymarch(@builtin(global_invocation_id) id: vec3<u32>) {
    let screen_size = vec2<u32>(1920u, 1080u); // TODO: Pass as uniform
    if (id.x >= screen_size.x || id.y >= screen_size.y) {
        return;
    }
    
    // Ray setup
    let uv = vec2<f32>(id.xy) / vec2<f32>(screen_size);
    let ray_origin = vec3<f32>(0.5, 0.5, -1.0);
    let ray_dir = normalize(vec3<f32>(uv.x - 0.5, uv.y - 0.5, 1.0));
    
    var accumulated_color = vec3<f32>(0.0);
    var accumulated_alpha = 0.0;
    var t = 0.0;
    
    // Raymarch through volume
    for (var i = 0; i < viz.sample_count; i++) {
        let pos = ray_origin + ray_dir * t;
        
        // Check bounds
        if (pos.x < 0.0 || pos.x > 1.0 || pos.y < 0.0 || pos.y > 1.0 || pos.z < 0.0 || pos.z > 1.0) {
            break;
        }
        
        let density = sample_density(pos);
        let temp = sample_temperature(pos);
        
        if (density > 0.01) {
            // Color based on temperature
            let temp_norm = clamp((temp - 273.0) / 100.0, 0.0, 1.0);
            let color = mix(viz.color_a, viz.color_b, temp_norm);
            
            let alpha = density * viz.exposure;
            accumulated_color += color * alpha * (1.0 - accumulated_alpha);
            accumulated_alpha += alpha * (1.0 - accumulated_alpha);
            
            if (accumulated_alpha > 0.99) {
                break;
            }
        }
        
        t += viz.step_size;
    }
    
    // Apply contrast and saturation
    accumulated_color = pow(accumulated_color, vec3<f32>(viz.contrast));
    let luminance = dot(accumulated_color, vec3<f32>(0.299, 0.587, 0.114));
    accumulated_color = mix(vec3<f32>(luminance), accumulated_color, viz.saturation);
    
    let idx = id.x + id.y * screen_size.x;
    output[idx] = vec4<f32>(accumulated_color, accumulated_alpha);
}

// Schlieren visualization (density gradient)
@compute @workgroup_size(8, 8, 8)
fn schlieren(@builtin(global_invocation_id) id: vec3<u32>) {
    let dims = textureDimensions(density_texture);
    if (id.x >= dims.x || id.y >= dims.y || id.z >= dims.z) {
        return;
    }
    
    let pos = vec3<f32>(id) / vec3<f32>(dims);
    let h = 1.0 / f32(dims.x);
    
    let dx = vec3<f32>(h, 0.0, 0.0);
    let dy = vec3<f32>(0.0, h, 0.0);
    let dz = vec3<f32>(0.0, 0.0, h);
    
    // Compute density gradient
    let dL = sample_density(pos - dx);
    let dR = sample_density(pos + dx);
    let dD = sample_density(pos - dy);
    let dU = sample_density(pos + dy);
    let dB = sample_density(pos - dz);
    let dF = sample_density(pos + dz);
    
    let grad = vec3<f32>(
        dR - dL,
        dU - dD,
        dF - dB
    ) * 0.5;
    
    let grad_mag = length(grad);
    let schlieren_value = grad_mag * viz.contrast;
    
    let idx = id.x + id.y * dims.x + id.z * dims.x * dims.y;
    output[idx] = vec4<f32>(vec3<f32>(schlieren_value), 1.0);
}
