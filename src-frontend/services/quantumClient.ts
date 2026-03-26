/**
 * KQuantum Export Client
 * 
 * TypeScript client for exporting particle systems from KQuantum
 * Includes validation and progress indication for large exports
 */

import { invoke } from '@tauri-apps/api/core';

type ExportProgressCallback = (progress: number, message: string) => void;

function toErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }

    return String(error);
}

export interface ParticleExportData {
    position: [number, number, number];
    velocity: [number, number, number];
    acceleration: [number, number, number];
    mass: number;
    charge: number;
    age: number;
    life: number;
    id: number;
}

export interface ExportValidationResult {
    isValid: boolean;
    particleCount: number;
    errors: string[];
    warnings: string[];
}

/**
 * Validate particle system before export
 * @param simId - Simulation ID from quantum_create
 * @returns Validation result with errors and warnings
 */
export async function validateParticleExport(simId: number): Promise<ExportValidationResult> {
    const result: ExportValidationResult = {
        isValid: true,
        particleCount: 0,
        errors: [],
        warnings: [],
    };

    try {
        // Get particle count
        result.particleCount = await invoke<number>('quantum_particle_count', { simId });

        // Validation: Empty particle system
        if (result.particleCount === 0) {
            result.isValid = false;
            result.errors.push('Cannot export empty particle system. Please run the simulation to generate particles.');
            return result;
        }

        // Warning: Large particle count
        if (result.particleCount > 100_000) {
            result.warnings.push(
                `Exporting ${result.particleCount.toLocaleString()} particles. This may take a while and produce a large file (estimated ${Math.round(result.particleCount / 1000)}+ MB).`
            );
        }

        // Warning: Very large particle count
        if (result.particleCount > 500_000) {
            result.warnings.push(
                'Consider reducing particle count or exporting in batches for better performance.'
            );
        }

    } catch (error: unknown) {
        result.isValid = false;
        result.errors.push(`Validation failed: ${toErrorMessage(error)}`);
    }

    return result;
}

/**
 * Export particle system to custom JSON format
 * @param simId - Simulation ID from quantum_create
 * @returns JSON string with full particle data
 */
export async function exportParticlesJSON(simId: number): Promise<string> {
    return await invoke<string>('quantum_export_json', { simId });
}

/**
 * Export particle system to GLTF/GLB format
 * Each particle becomes a small sphere instance
 * @param simId - Simulation ID from quantum_create
 * @param particleRadius - Radius of each particle sphere (default: 0.5)
 * @param subdivisions - Sphere subdivisions for quality (default: 1)
 * @returns GLB binary data as Uint8Array
 */
export async function exportParticlesGLTF(
    simId: number,
    particleRadius: number = 0.5,
    subdivisions: number = 1
): Promise<Uint8Array> {
    // Validate parameters
    if (particleRadius <= 0 || particleRadius > 100) {
        throw new Error(`Invalid particle radius: ${particleRadius}. Radius must be between 0.0 and 100.0.`);
    }

    if (subdivisions < 0 || subdivisions > 5) {
        throw new Error(`Invalid subdivision level: ${subdivisions}. Subdivision must be between 0 and 5.`);
    }

    const bytes = await invoke<number[]>('quantum_export_gltf', {
        simId,
        particleRadius,
        subdivisions,
    });
    return new Uint8Array(bytes);
}

/**
 * Export particles to JSON file with validation and progress
 * Downloads the file using browser download API
 * @param simId - Simulation ID
 * @param filename - Optional filename (default: kquantum_particles.json)
 * @param onProgress - Optional progress callback (0-100)
 */
export async function exportParticlesJSONToFile(
    simId: number,
    filename: string = 'kquantum_particles.json',
    onProgress?: ExportProgressCallback
): Promise<void> {
    // Validate before export
    if (onProgress) onProgress(0, 'Validating particle system...');
    
    const validation = await validateParticleExport(simId);
    
    if (!validation.isValid) {
        throw new Error(`Export validation failed:\n${validation.errors.join('\n')}`);
    }

    // Show warnings if any
    if (validation.warnings.length > 0 && onProgress) {
        onProgress(10, validation.warnings[0]);
    }

    // Export JSON
    if (onProgress) onProgress(30, `Exporting ${validation.particleCount.toLocaleString()} particles...`);
    
    const jsonData = await exportParticlesJSON(simId);
    
    if (onProgress) onProgress(70, 'Creating download file...');
    
    // Create blob and download
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    if (onProgress) onProgress(100, 'Export complete!');
}

/**
 * Export particles to GLB file with validation and progress
 * Downloads the file using browser download API
 * @param simId - Simulation ID
 * @param particleRadius - Radius of each particle sphere
 * @param subdivisions - Sphere subdivisions for quality
 * @param filename - Optional filename (default: kquantum_particles.glb)
 * @param onProgress - Optional progress callback (0-100)
 */
export async function exportParticlesGLBToFile(
    simId: number,
    particleRadius: number = 0.5,
    subdivisions: number = 1,
    filename: string = 'kquantum_particles.glb',
    onProgress?: ExportProgressCallback
): Promise<void> {
    // Validate before export
    if (onProgress) onProgress(0, 'Validating particle system...');
    
    const validation = await validateParticleExport(simId);
    
    if (!validation.isValid) {
        throw new Error(`Export validation failed:\n${validation.errors.join('\n')}`);
    }

    // Show warnings if any
    if (validation.warnings.length > 0 && onProgress) {
        onProgress(10, validation.warnings[0]);
    }

    // Export GLB
    if (onProgress) onProgress(30, `Exporting ${validation.particleCount.toLocaleString()} particles as GLB...`);
    
    const glbData = await exportParticlesGLTF(simId, particleRadius, subdivisions);
    
    if (onProgress) onProgress(70, 'Creating download file...');
    
    // Create blob and download
    const glbBinary = new Uint8Array(glbData);
    const blob = new Blob([glbBinary.buffer], { type: 'model/gltf-binary' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    if (onProgress) onProgress(100, 'Export complete!');
}

export const quantumExportClient = {
    validateExport: validateParticleExport,
    exportJSON: exportParticlesJSON,
    exportGLTF: exportParticlesGLTF,
    exportJSONToFile: exportParticlesJSONToFile,
    exportGLBToFile: exportParticlesGLBToFile,
};
