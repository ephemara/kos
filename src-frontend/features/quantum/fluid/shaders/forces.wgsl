// External Forces - Gravity, Buoyancy, Vorticity Confinement
// Based on FluidDynamics.kn ApplyExternalForces shader

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

struct ThermalParams {
    temperature: f32,
    thermal_diffusivity: f32,
    buoyancy_alpha: f32,
    buoyancy_beta: f32,
    radiation_gain: f32,
    _padding1: f32,
    _padding2: f32,
    _padding3: f32,
}

struct TimeParams {
    dt: f32,
    current_time: f32,
    cfl_number: f32,
    _padding: f32,
}

@group(0) @binding(0) var<uniform> physics: PhysicsParams;
@group(0) @binding(1) var<uniform> thermal: ThermalParams;
@group(0) @binding(2) var<uniform> time: TimeParams;
@group(0) @binding(3) var velocity_texture: texture_3d<f32>;
@group(0) @binding(4) var velocity_sampler: sampler;
@group(0) @binding(5) var density_texture: texture_3d<f32>;
@group(0) @binding(6) var density_sampler: sampler;
@group(0) @binding(7) var temperature_texture: texture_3d<f32>;
@group(0) @binding(8) var temperature_sampler: sampler;
@group(0) @binding(9) var velocity_output: texture_storage_3d<rgba32float, write>;

fn sample_velocity(pos: vec3<f32>) -> vec3<f32> {
    let clamped = clamp(pos, vec3<f32>(0.0), vec3<f32>(1.0));
    return textureSampleLevel(velocity_texture, velocity_sampler, clamped, 0.0).xyz;
}

fn sample_density(pos: vec3<f32>) -> f32 {
    let clamped = clamp(pos, vec3<f32>(0.0), vec3<f32>(1.0));
    return textureSampleLevel(density_texture, density_sampler, clamped, 0.0).x;
}

fn sample_temperature(pos: vec3<f32>) -> f32 {
    let clamped = clamp(pos, vec3<f32>(0.0), vec3<f32>(1.0));
    return textureSampleLevel(temperature_texture, temperature_sampler, clamped, 0.0).x;
}

@compute @workgroup_size(8, 8, 8)
fn apply_external_forces(@builtin(global_invocation_id) id: vec3<u32>) {
    let dims = textureDimensions(velocity_texture);
    if (id.x >= dims.x || id.y >= dims.y || id.z >= dims.z) {
        return;
    }
    
    let pos = vec3<f32>(id) / vec3<f32>(dims);
    let vel = sample_velocity(pos);
    let dens = sample_density(pos);
    let temp = sample_temperature(pos);
    
    // Gravity
    let gravity = vec3<f32>(0.0, -9.81, 0.0) * physics.gravity_scale;
    
    // Buoyancy (Boussinesq approximation)
    // F_buoyancy = (alpha * density - beta * (T - T_ambient)) * up
    let ambient_temp = 293.0; // Room temperature
    let buoyancy_force = (thermal.buoyancy_alpha * dens - thermal.buoyancy_beta * (temp - ambient_temp)) * vec3<f32>(0.0, 1.0, 0.0);
    
    // Apply forces
    let new_vel = vel + (gravity + buoyancy_force) * time.dt;
    
    textureStore(velocity_output, id, vec4<f32>(new_vel, 1.0));
}

// Vorticity Confinement - preserves swirls and turbulence
@group(0) @binding(10) var<uniform> vorticity_strength: f32;

fn compute_curl(pos: vec3<f32>, h: f32) -> vec3<f32> {
    let dx = vec3<f32>(h, 0.0, 0.0);
    let dy = vec3<f32>(0.0, h, 0.0);
    let dz = vec3<f32>(0.0, 0.0, h);
    
    let vL = sample_velocity(pos - dx);
    let vR = sample_velocity(pos + dx);
    let vD = sample_velocity(pos - dy);
    let vU = sample_velocity(pos + dy);
    let vB = sample_velocity(pos - dz);
    let vF = sample_velocity(pos + dz);
    
    let curl = vec3<f32>(
        (vU.z - vD.z) - (vF.y - vB.y),
        (vF.x - vB.x) - (vR.z - vL.z),
        (vR.y - vL.y) - (vU.x - vD.x)
    ) * 0.5;
    
    return curl;
}

@compute @workgroup_size(8, 8, 8)
fn vorticity_confinement(@builtin(global_invocation_id) id: vec3<u32>) {
    let dims = textureDimensions(velocity_texture);
    if (id.x >= dims.x || id.y >= dims.y || id.z >= dims.z) {
        return;
    }
    
    let pos = vec3<f32>(id) / vec3<f32>(dims);
    let h = 1.0 / f32(dims.x);
    
    let curl = compute_curl(pos, h);
    let curl_mag = length(curl);
    
    if (curl_mag < 0.0001) {
        return;
    }
    
    // Compute gradient of curl magnitude
    let dx = vec3<f32>(h, 0.0, 0.0);
    let dy = vec3<f32>(0.0, h, 0.0);
    let dz = vec3<f32>(0.0, 0.0, h);
    
    let curl_L = length(compute_curl(pos - dx, h));
    let curl_R = length(compute_curl(pos + dx, h));
    let curl_D = length(compute_curl(pos - dy, h));
    let curl_U = length(compute_curl(pos + dy, h));
    let curl_B = length(compute_curl(pos - dz, h));
    let curl_F = length(compute_curl(pos + dz, h));
    
    let grad_curl = vec3<f32>(
        curl_R - curl_L,
        curl_U - curl_D,
        curl_F - curl_B
    ) * 0.5;
    
    let N = normalize(grad_curl + vec3<f32>(0.0001));
    let force = vorticity_strength * h * cross(N, curl);
    
    let vel = sample_velocity(pos);
    let new_vel = vel + force * time.dt;
    
    textureStore(velocity_output, id, vec4<f32>(new_vel, 1.0));
}
