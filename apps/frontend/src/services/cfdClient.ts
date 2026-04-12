/**
 * CFD (Computational Fluid Dynamics) Client
 * 
 * TypeScript client for grid-based Navier-Stokes fluid simulation
 * Supports smoke, fire, liquids, and gas simulation
 */

import { invoke } from '@tauri-apps/api/core';

export type FluidType = 'Smoke' | 'Fire' | 'Liquid' | 'Gas' | 'Viscous';
export type SolverType = 'NavierStokes' | 'SPH' | 'FLIP' | 'PIC' | 'APIC';

export interface CFDConfig {
    fluid_type: FluidType;
    solver_type: SolverType;
    resolution: [number, number, number];
    domain_size: [number, number, number];
    
    // Physics
    viscosity: number;
    density: number;
    gravity: [number, number, number];
    buoyancy: number;
    vorticity_confinement: number;
    pressure_iterations: number;
    
    // SPH
    particle_radius: number;
    rest_density: number;
    stiffness: number;
    surface_tension: number;
    
    // FLIP/PIC
    flip_ratio: number;
    particle_per_cell: number;
    
    // Boundaries
    boundary_friction: number;
    boundary_stickiness: number;
}

export const DEFAULT_CFD_CONFIG: CFDConfig = {
    fluid_type: 'Smoke',
    solver_type: 'NavierStokes',
    resolution: [64, 64, 64],
    domain_size: [10.0, 10.0, 10.0],
    viscosity: 0.001,
    density: 1.0,
    gravity: [0.0, -9.81, 0.0],
    buoyancy: 1.0,
    vorticity_confinement: 0.05,
    pressure_iterations: 50,
    particle_radius: 0.1,
    rest_density: 1000.0,
    stiffness: 1000.0,
    surface_tension: 0.0728,
    flip_ratio: 0.95,
    particle_per_cell: 8,
    boundary_friction: 0.5,
    boundary_stickiness: 0.0,
};

/**
 * Create a new CFD simulation
 */
export async function createCFD(config: Partial<CFDConfig> = {}): Promise<number> {
    const fullConfig = { ...DEFAULT_CFD_CONFIG, ...config };
    return await invoke<number>('cfd_create', { config: fullConfig });
}

/**
 * Step the CFD simulation forward in time
 */
export async function stepCFD(simId: number, dt: number): Promise<void> {
    await invoke('cfd_step', { simId, dt });
}

/**
 * Add a fluid source (emitter)
 */
export async function addCFDSource(
    simId: number,
    position: [number, number, number],
    radius: number,
    velocity: [number, number, number],
    density: number,
    temperature: number
): Promise<void> {
    await invoke('cfd_add_source', {
        simId,
        position,
        radius,
        velocity,
        density,
        temperature,
    });
}

/**
 * Get the velocity field as a flat array
 * Returns [vx, vy, vz, vx, vy, vz, ...] for each grid cell
 */
export async function getCFDVelocityField(simId: number): Promise<Float32Array> {
    const data = await invoke<number[]>('cfd_get_velocity_field', { simId });
    return new Float32Array(data);
}

/**
 * Get the density field as a flat array
 * Returns density value for each grid cell
 */
export async function getCFDDensityField(simId: number): Promise<Float32Array> {
    const data = await invoke<number[]>('cfd_get_density_field', { simId });
    return new Float32Array(data);
}

/**
 * Dispose of a CFD simulation
 */
export async function disposeCFD(simId: number): Promise<void> {
    await invoke('cfd_dispose', { simId });
}

export const cfdClient = {
    create: createCFD,
    step: stepCFD,
    addSource: addCFDSource,
    getVelocityField: getCFDVelocityField,
    getDensityField: getCFDDensityField,
    dispose: disposeCFD,
};
