/**
 * useQuantumRust - React hook for Rust-powered particle physics
 * 
 * Wraps Tauri IPC calls to the quantum simulation module.
 * 
 * Usage:
 *   const quantum = useQuantumRust();
 *   await quantum.create({ particle_count: 100000 });
 *   const data = await quantum.step(1/60);
 *   // data.positions = Float32Array for GPU upload
 */

import { invoke } from '@tauri-apps/api/core';
import { useRef, useCallback } from 'react';

// ============================================================================
// TYPES
// ============================================================================

export interface SimConfig {
    particle_count: number;
    substeps: number;
    nbody_enabled: boolean;
    nbody_g: number;
    gravity: [number, number, number];
    drag: number;
    bounds_min: [number, number, number];
    bounds_max: [number, number, number];
    bounds_mode: 'none' | 'kill' | 'wrap' | 'bounce';
}

export interface ParticleData {
    positions: number[];   // [x,y,z,age, ...]
    velocities: number[];  // [vx,vy,vz,mass, ...]
    count: number;
}

export type AttractorType =
    | 'point'
    | 'vortex'
    | 'blackhole'
    | 'magnetic'
    | 'turbulence'
    | 'curl'
    | 'lorenz'
    | 'rossler'
    | 'aizawa'
    | 'tokamak'
    | 'gravity_wave'
    | 'cosmic_web';

export interface AttractorParams {
    // Common
    enabled?: boolean;
    falloff?: number;
    max_force?: number;
    position?: [number, number, number];

    // Point
    mass?: number;
    softening?: number;

    // Vortex
    axis?: [number, number, number];
    strength?: number;
    radius?: number;

    // Black Hole
    spin?: number;
    event_horizon?: number;

    // Magnetic
    moment?: [number, number, number];

    // Turbulence / Curl
    seed?: number;
    octaves?: number;
    frequency?: number;
    amplitude?: number;
    scale?: number;

    // Strange Attractors (Lorenz, Rössler, Aizawa)
    sigma?: number;
    rho?: number;
    beta?: number;
    a?: number;
    b?: number;
    c?: number;
    d?: number;
    e?: number;
    f?: number;

    // Tokamak
    center?: [number, number, number];
    major_radius?: number;
    minor_radius?: number;
    field_strength?: number;

    // Gravity Wave
    source?: [number, number, number];
    phase?: number;

    // Cosmic Web
    cell_size?: number;
    filament_strength?: number;
}

// ============================================================================
// HOOK
// ============================================================================

export function useQuantumRust() {
    const simIdRef = useRef<number | null>(null);

    /**
     * Create a new quantum simulation
     */
    const create = useCallback(async (config: Partial<SimConfig> = {}) => {
        const fullConfig: SimConfig = {
            particle_count: 50000,
            substeps: 4,
            nbody_enabled: false,
            nbody_g: 1.0,
            gravity: [0, 0, 0],
            drag: 0.01,
            bounds_min: [-100, -100, -100],
            bounds_max: [100, 100, 100],
            bounds_mode: 'kill',
            ...config,
        };

        const simId = await invoke<number>('quantum_create', { config: fullConfig });
        simIdRef.current = simId;
        return simId;
    }, []);

    /**
     * Step the simulation and get particle data
     */
    const step = useCallback(async (dt: number = 1 / 60): Promise<ParticleData | null> => {
        if (simIdRef.current === null) return null;

        try {
            const data = await invoke<ParticleData>('quantum_step', {
                simId: simIdRef.current,
                dt,
            });
            return data;
        } catch (e) {
            console.error('[KQuantum] Rust step failed:', e);
            return null;
        }
    }, []);

    /**
     * Add an attractor to the simulation
     */
    const addAttractor = useCallback(async (
        type: AttractorType,
        params: AttractorParams = {}
    ): Promise<number | null> => {
        if (simIdRef.current === null) return null;

        try {
            const id = await invoke<number>('quantum_add_attractor', {
                simId: simIdRef.current,
                attractorType: type,
                params,
            });
            return id;
        } catch (e) {
            console.error('[KQuantum] Add attractor failed:', e);
            return null;
        }
    }, []);

    /**
     * Emit particles at a position
     */
    const emit = useCallback(async (
        count: number,
        position: [number, number, number] = [0, 0, 0],
        velocity: [number, number, number] = [0, 0, 0],
        spread: number = 1.0
    ) => {
        if (simIdRef.current === null) return;

        try {
            await invoke('quantum_emit', {
                simId: simIdRef.current,
                count,
                position,
                velocity,
                spread,
            });
        } catch (e) {
            console.error('[KQuantum] Emit failed:', e);
        }
    }, []);

    /**
     * Set audio data for reactivity
     */
    const setAudio = useCallback(async (bands: number[], amplitude: number) => {
        if (simIdRef.current === null) return;

        try {
            await invoke('quantum_set_audio', {
                simId: simIdRef.current,
                bands,
                amplitude,
            });
        } catch (e) {
            console.error('[KQuantum] Set audio failed:', e);
        }
    }, []);

    /**
     * Enable/disable N-body physics
     */
    const setNBody = useCallback(async (
        enabled: boolean,
        g: number = 1.0,
        softening: number = 0.5
    ) => {
        if (simIdRef.current === null) return;

        try {
            await invoke('quantum_set_nbody', {
                simId: simIdRef.current,
                enabled,
                g,
                softening,
            });
        } catch (e) {
            console.error('[KQuantum] Set N-body failed:', e);
        }
    }, []);

    /**
     * Clear all attractors
     */
    const clearAttractors = useCallback(async () => {
        if (simIdRef.current === null) return;

        try {
            await invoke('quantum_clear_attractors', {
                simId: simIdRef.current,
            });
        } catch (e) {
            console.error('[KQuantum] Clear attractors failed:', e);
        }
    }, []);

    /**
     * Dispose the simulation
     */
    const dispose = useCallback(async () => {
        if (simIdRef.current === null) return;

        try {
            await invoke('quantum_dispose', {
                simId: simIdRef.current,
            });
            simIdRef.current = null;
        } catch (e) {
            console.error('[KQuantum] Dispose failed:', e);
        }
    }, []);

    /**
     * Get current particle count
     */
    const getParticleCount = useCallback(async (): Promise<number> => {
        if (simIdRef.current === null) return 0;

        try {
            const count = await invoke<number>('quantum_particle_count', {
                simId: simIdRef.current,
            });
            return count;
        } catch (e) {
            console.error('[KQuantum] Get count failed:', e);
            return 0;
        }
    }, []);

    return {
        create,
        step,
        addAttractor,
        emit,
        setAudio,
        setNBody,
        clearAttractors,
        dispose,
        getParticleCount,
        isActive: () => simIdRef.current !== null,
    };
}

// ============================================================================
// PRESET FACTORIES
// ============================================================================

export const QUANTUM_PRESETS = {
    // Strange Attractors
    LORENZ: (scale = 0.1) => ({
        type: 'lorenz' as AttractorType,
        params: { sigma: 10, rho: 28, beta: 2.667, scale },
    }),

    ROSSLER: (scale = 0.1) => ({
        type: 'rossler' as AttractorType,
        params: { a: 0.2, b: 0.2, c: 5.7, scale },
    }),

    AIZAWA: (scale = 0.5) => ({
        type: 'aizawa' as AttractorType,
        params: { a: 0.95, b: 0.7, c: 0.6, d: 3.5, e: 0.25, f: 0.1, scale },
    }),

    // Cosmic
    BLACK_HOLE: (mass = 100, spin = 20) => ({
        type: 'blackhole' as AttractorType,
        params: { position: [0, 0, 0], mass, spin, event_horizon: 2.0 },
    }),

    TOKAMAK: (fieldStrength = 15) => ({
        type: 'tokamak' as AttractorType,
        params: { center: [0, 0, 0], major_radius: 25, minor_radius: 8, field_strength: fieldStrength },
    }),

    GRAVITY_WAVE: (freq = 0.5, amp = 10) => ({
        type: 'gravity_wave' as AttractorType,
        params: { source: [0, 0, 0], frequency: freq, amplitude: amp, phase: 0 },
    }),

    COSMIC_WEB: (cellSize = 25) => ({
        type: 'cosmic_web' as AttractorType,
        params: { seed: 42, cell_size: cellSize, filament_strength: 3 },
    }),

    // Forces
    TURBULENCE: (amplitude = 5, frequency = 0.1) => ({
        type: 'turbulence' as AttractorType,
        params: { seed: 42, octaves: 4, frequency, amplitude },
    }),

    CURL_NOISE: (strength = 3, scale = 0.1) => ({
        type: 'curl' as AttractorType,
        params: { seed: 42, scale, strength },
    }),

    VORTEX: (strength = 10, radius = 30) => ({
        type: 'vortex' as AttractorType,
        params: { position: [0, 0, 0], axis: [0, 1, 0], strength, radius },
    }),

    MAGNETIC_DIPOLE: (momentY = 200) => ({
        type: 'magnetic' as AttractorType,
        params: { position: [0, 0, 0], moment: [0, momentY, 0] },
    }),

    POINT_GRAVITY: (mass = 50) => ({
        type: 'point' as AttractorType,
        params: { position: [0, 0, 0], mass, softening: 0.5 },
    }),
};
