// Pressure Projection - Divergence, Jacobi, Gradient Subtraction
// Based on FluidDynamics.kn pressure solver shaders

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

@group(0) @binding(0) var<uniform> physics: PhysicsParams;
@group(0) @binding(1) var velocity_texture: texture_3d<f32>;
@group(0) @binding(2) var velocity_sampler: sampler;
@group(0) @binding(3) var divergence_output: texture_storage_3d<rgba32float, write>;

fn sample_velocity(pos: vec3<f32>) -> vec3<f32> {
    let clamped = clamp(pos, vec3<f32>(0.0), vec3<f32>(1.0));
    return textureSampleLevel(velocity_texture, velocity_sampler, clamped, 0.0).xyz;
}

// Compute divergence of velocity field
@compute @workgroup_size(8, 8, 8)
fn compute_divergence(@builtin(global_invocation_id) id: vec3<u32>) {
    let dims = textureDimensions(velocity_texture);
    if (id.x >= dims.x || id.y >= dims.y || id.z >= dims.z) {
        return;
    }
    
    let pos = vec3<f32>(id) / vec3<f32>(dims);
    let h = 1.0 / f32(dims.x);
    
    let dx = vec3<f32>(h, 0.0, 0.0);
    let dy = vec3<f32>(0.0, h, 0.0);
    let dz = vec3<f32>(0.0, 0.0, h);
    
    let vL = sample_velocity(pos - dx);
    let vR = sample_velocity(pos + dx);
    let vD = sample_velocity(pos - dy);
    let vU = sample_velocity(pos + dy);
    let vB = sample_velocity(pos - dz);
    let vF = sample_velocity(pos + dz);
    
    // Central difference
    let div = 0.5 * ((vR.x - vL.x) + (vU.y - vD.y) + (vF.z - vB.z));
    
    textureStore(divergence_output, id, vec4<f32>(div, 0.0, 0.0, 1.0));
}

// Jacobi iteration for pressure solve
@group(0) @binding(4) var pressure_texture: texture_3d<f32>;
@group(0) @binding(5) var pressure_sampler: sampler;
@group(0) @binding(6) var divergence_texture: texture_3d<f32>;
@group(0) @binding(7) var divergence_sampler: sampler;
@group(0) @binding(8) var pressure_output: texture_storage_3d<rgba32float, write>;

fn sample_pressure(pos: vec3<f32>) -> f32 {
    let clamped = clamp(pos, vec3<f32>(0.0), vec3<f32>(1.0));
    return textureSampleLevel(pressure_texture, pressure_sampler, clamped, 0.0).x;
}

fn sample_divergence(pos: vec3<f32>) -> f32 {
    let clamped = clamp(pos, vec3<f32>(0.0), vec3<f32>(1.0));
    return textureSampleLevel(divergence_texture, divergence_sampler, clamped, 0.0).x;
}

@compute @workgroup_size(8, 8, 8)
fn jacobi_pressure(@builtin(global_invocation_id) id: vec3<u32>) {
    let dims = textureDimensions(pressure_texture);
    if (id.x >= dims.x || id.y >= dims.y || id.z >= dims.z) {
        return;
    }
    
    let pos = vec3<f32>(id) / vec3<f32>(dims);
    let h = 1.0 / f32(dims.x);
    
    let dx = vec3<f32>(h, 0.0, 0.0);
    let dy = vec3<f32>(0.0, h, 0.0);
    let dz = vec3<f32>(0.0, 0.0, h);
    
    // Sample neighboring pressures
    let pL = sample_pressure(pos - dx);
    let pR = sample_pressure(pos + dx);
    let pD = sample_pressure(pos - dy);
    let pU = sample_pressure(pos + dy);
    let pB = sample_pressure(pos - dz);
    let pF = sample_pressure(pos + dz);
    
    let div = sample_divergence(pos);
    
    // Jacobi iteration: P_new = (sum of neighbors - divergence) / 6
    let p_new = (pL + pR + pD + pU + pB + pF - div) / 6.0;
    
    textureStore(pressure_output, id, vec4<f32>(p_new, 0.0, 0.0, 1.0));
}

// Subtract pressure gradient from velocity (projection step)
@group(0) @binding(9) var velocity_output: texture_storage_3d<rgba32float, write>;

@compute @workgroup_size(8, 8, 8)
fn subtract_gradient(@builtin(global_invocation_id) id: vec3<u32>) {
    let dims = textureDimensions(velocity_texture);
    if (id.x >= dims.x || id.y >= dims.y || id.z >= dims.z) {
        return;
    }
    
    let pos = vec3<f32>(id) / vec3<f32>(dims);
    let h = 1.0 / f32(dims.x);
    
    let dx = vec3<f32>(h, 0.0, 0.0);
    let dy = vec3<f32>(0.0, h, 0.0);
    let dz = vec3<f32>(0.0, 0.0, h);
    
    let vel_old = sample_velocity(pos);
    
    // Compute pressure gradient
    let pL = sample_pressure(pos - dx);
    let pR = sample_pressure(pos + dx);
    let pD = sample_pressure(pos - dy);
    let pU = sample_pressure(pos + dy);
    let pB = sample_pressure(pos - dz);
    let pF = sample_pressure(pos + dz);
    
    let grad_p = vec3<f32>(
        pR - pL,
        pU - pD,
        pF - pB
    ) * 0.5;
    
    // Project velocity to be divergence-free
    let vel_new = vel_old - grad_p;
    
    textureStore(velocity_output, id, vec4<f32>(vel_new, 1.0));
}
