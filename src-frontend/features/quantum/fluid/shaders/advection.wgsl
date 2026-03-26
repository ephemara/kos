// Advection Shaders - Semi-Lagrangian, MacCormack, BFECC
// Based on FluidDynamics.kn shader implementations

struct PhysicsParams {
    viscosity: f32,
    density: f32,
    surface_tension: f32,
    compressibility: f32,
    conductivity: f32,
    permittivity: f32,
    permeability: f32,
    reactivity: f32,
    radiation_absorption: f32,
    gravity_scale: f32,
    anisotropy: f32,
    cavitation_threshold: f32,
    yield_stress: f32,
    foam_threshold: f32,
    spray_threshold: f32,
    bubble_coalescence: f32,
}

struct TimeParams {
    dt: f32,
    current_time: f32,
    cfl_number: f32,
    _padding: f32,
}

@group(0) @binding(0) var<uniform> physics: PhysicsParams;
@group(0) @binding(1) var<uniform> time: TimeParams;
@group(0) @binding(2) var velocity_texture: texture_3d<f32>;
@group(0) @binding(3) var velocity_sampler: sampler;
@group(0) @binding(4) var velocity_output: texture_storage_3d<rgba32float, write>;

// Trilinear interpolation for 3D texture sampling
fn sample_velocity(pos: vec3<f32>) -> vec3<f32> {
    let clamped = clamp(pos, vec3<f32>(0.0), vec3<f32>(1.0));
    return textureSampleLevel(velocity_texture, velocity_sampler, clamped, 0.0).xyz;
}

@compute @workgroup_size(8, 8, 8)
fn advect_velocity(@builtin(global_invocation_id) id: vec3<u32>) {
    let dims = textureDimensions(velocity_texture);
    if (id.x >= dims.x || id.y >= dims.y || id.z >= dims.z) {
        return;
    }
    
    // Normalized position [0, 1]
    let pos = vec3<f32>(id) / vec3<f32>(dims);
    
    // Semi-Lagrangian: trace back in time
    let vel = sample_velocity(pos);
    let prev_pos = pos - vel * time.dt;
    let advected_vel = sample_velocity(prev_pos);
    
    // Viscous dissipation
    let decay = 1.0 - (physics.viscosity * time.dt);
    
    textureStore(velocity_output, id, vec4<f32>(advected_vel * decay, 1.0));
}

@group(0) @binding(5) var density_texture: texture_3d<f32>;
@group(0) @binding(6) var density_sampler: sampler;
@group(0) @binding(7) var density_output: texture_storage_3d<rgba32float, write>;

fn sample_density(pos: vec3<f32>) -> f32 {
    let clamped = clamp(pos, vec3<f32>(0.0), vec3<f32>(1.0));
    return textureSampleLevel(density_texture, density_sampler, clamped, 0.0).x;
}

@compute @workgroup_size(8, 8, 8)
fn advect_density(@builtin(global_invocation_id) id: vec3<u32>) {
    let dims = textureDimensions(velocity_texture);
    if (id.x >= dims.x || id.y >= dims.y || id.z >= dims.z) {
        return;
    }
    
    let pos = vec3<f32>(id) / vec3<f32>(dims);
    let vel = sample_velocity(pos);
    let prev_pos = pos - vel * time.dt;
    let new_density = sample_density(prev_pos);
    
    textureStore(density_output, id, vec4<f32>(new_density, 0.0, 0.0, 1.0));
}

@group(0) @binding(8) var temperature_texture: texture_3d<f32>;
@group(0) @binding(9) var temperature_sampler: sampler;
@group(0) @binding(10) var temperature_output: texture_storage_3d<rgba32float, write>;

fn sample_temperature(pos: vec3<f32>) -> f32 {
    let clamped = clamp(pos, vec3<f32>(0.0), vec3<f32>(1.0));
    return textureSampleLevel(temperature_texture, temperature_sampler, clamped, 0.0).x;
}

@compute @workgroup_size(8, 8, 8)
fn advect_temperature(@builtin(global_invocation_id) id: vec3<u32>) {
    let dims = textureDimensions(velocity_texture);
    if (id.x >= dims.x || id.y >= dims.y || id.z >= dims.z) {
        return;
    }
    
    let pos = vec3<f32>(id) / vec3<f32>(dims);
    let vel = sample_velocity(pos);
    let prev_pos = pos - vel * time.dt;
    let new_temp = sample_temperature(prev_pos);
    
    // Thermal diffusion
    let decay = 1.0 - (physics.conductivity * time.dt);
    
    textureStore(temperature_output, id, vec4<f32>(new_temp * decay, 0.0, 0.0, 1.0));
}
