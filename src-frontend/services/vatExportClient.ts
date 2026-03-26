/**
 * VAT (Vertex Animation Texture) Export Client
 * 
 * Exports particle animations as texture maps for real-time playback in game engines
 * Supports position and normal textures for vertex animation
 */

import { invoke } from '@tauri-apps/api/core';

export interface VATExportOptions {
    /** Number of frames to capture */
    frameCount: number;
    /** Frame rate (fps) */
    frameRate: number;
    /** Texture resolution (power of 2, e.g. 512, 1024, 2048) */
    textureResolution: number;
    /** Export position texture */
    exportPosition: boolean;
    /** Export normal texture */
    exportNormal: boolean;
    /** Normalize positions to 0-1 range */
    normalizePositions: boolean;
    /** Bounding box padding factor */
    boundsPadding: number;
}

export interface VATExportResult {
    /** Position texture data (RGBA float) */
    positionTexture?: Uint8Array;
    /** Normal texture data (RGBA float) */
    normalTexture?: Uint8Array;
    /** Texture width */
    width: number;
    /** Texture height */
    height: number;
    /** Number of particles */
    particleCount: number;
    /** Number of frames captured */
    frameCount: number;
    /** Bounding box min */
    boundsMin: [number, number, number];
    /** Bounding box max */
    boundsMax: [number, number, number];
    /** Frame rate */
    frameRate: number;
}

export interface VATValidationResult {
    isValid: boolean;
    particleCount: number;
    estimatedTextureSize: number;
    estimatedMemoryMB: number;
    errors: string[];
    warnings: string[];
}

/**
 * Validate VAT export parameters
 */
export async function validateVATExport(
    simId: number,
    options: VATExportOptions
): Promise<VATValidationResult> {
    const result: VATValidationResult = {
        isValid: true,
        particleCount: 0,
        estimatedTextureSize: 0,
        estimatedMemoryMB: 0,
        errors: [],
        warnings: [],
    };

    try {
        // Get particle count
        result.particleCount = await invoke<number>('quantum_particle_count', { simId });

        // Validation: Empty particle system
        if (result.particleCount === 0) {
            result.isValid = false;
            result.errors.push('Cannot export empty particle system');
            return result;
        }

        // Validation: Frame count
        if (options.frameCount < 2 || options.frameCount > 1000) {
            result.isValid = false;
            result.errors.push('Frame count must be between 2 and 1000');
        }

        // Validation: Texture resolution
        const validResolutions = [256, 512, 1024, 2048, 4096, 8192];
        if (!validResolutions.includes(options.textureResolution)) {
            result.isValid = false;
            result.errors.push(`Texture resolution must be one of: ${validResolutions.join(', ')}`);
        }

        // Calculate required texture size
        const pixelsNeeded = result.particleCount * options.frameCount;
        const texturePixels = options.textureResolution * options.textureResolution;
        
        if (pixelsNeeded > texturePixels) {
            result.isValid = false;
            result.errors.push(
                `Texture too small: need ${pixelsNeeded.toLocaleString()} pixels, ` +
                `have ${texturePixels.toLocaleString()}. ` +
                `Increase resolution or reduce frame count.`
            );
        }

        result.estimatedTextureSize = options.textureResolution;
        
        // Estimate memory usage (RGBA float = 16 bytes per pixel)
        const bytesPerTexture = texturePixels * 16;
        const textureCount = (options.exportPosition ? 1 : 0) + (options.exportNormal ? 1 : 0);
        result.estimatedMemoryMB = (bytesPerTexture * textureCount) / (1024 * 1024);

        // Warnings
        if (result.estimatedMemoryMB > 100) {
            result.warnings.push(
                `Large export: ~${Math.round(result.estimatedMemoryMB)}MB. ` +
                `Consider reducing resolution or frame count.`
            );
        }

        if (result.particleCount > 50000) {
            result.warnings.push(
                `High particle count (${result.particleCount.toLocaleString()}). ` +
                `Export may take several seconds.`
            );
        }

        if (options.frameCount > 500) {
            result.warnings.push(
                `High frame count (${options.frameCount}). ` +
                `Consider reducing for better performance.`
            );
        }

    } catch (error) {
        result.isValid = false;
        result.errors.push(`Validation failed: ${error}`);
    }

    return result;
}

/**
 * Export particle animation as VAT textures
 */
export async function exportVAT(
    simId: number,
    options: VATExportOptions,
    onProgress?: (progress: number, message: string) => void
): Promise<VATExportResult> {
    // Validate first
    if (onProgress) onProgress(0, 'Validating export parameters...');
    
    const validation = await validateVATExport(simId, options);
    
    if (!validation.isValid) {
        throw new Error(`VAT export validation failed:\n${validation.errors.join('\n')}`);
    }

    // Show warnings
    if (validation.warnings.length > 0 && onProgress) {
        onProgress(5, validation.warnings[0]);
    }

    // Export VAT data from Rust
    if (onProgress) onProgress(20, `Capturing ${options.frameCount} frames...`);
    
    const result = await invoke<VATExportResult>('quantum_export_vat', {
        simId,
        frameCount: options.frameCount,
        frameRate: options.frameRate,
        textureResolution: options.textureResolution,
        exportPosition: options.exportPosition,
        exportNormal: options.exportNormal,
        normalizePositions: options.normalizePositions,
        boundsPadding: options.boundsPadding,
    });

    if (onProgress) onProgress(100, 'VAT export complete!');
    
    return result;
}

/**
 * Export VAT textures to PNG files
 */
export async function exportVATToFiles(
    simId: number,
    options: VATExportOptions,
    baseFilename: string = 'kquantum_vat',
    onProgress?: (progress: number, message: string) => void
): Promise<void> {
    // Export VAT data
    const result = await exportVAT(simId, options, (progress, message) => {
        if (onProgress) onProgress(progress * 0.8, message);
    });

    if (onProgress) onProgress(85, 'Saving texture files...');

    // Save position texture
    if (result.positionTexture && options.exportPosition) {
        const posBlob = new Blob([new Uint8Array(result.positionTexture)], { type: 'image/png' });
        const posUrl = URL.createObjectURL(posBlob);
        const posLink = document.createElement('a');
        posLink.href = posUrl;
        posLink.download = `${baseFilename}_position.png`;
        document.body.appendChild(posLink);
        posLink.click();
        document.body.removeChild(posLink);
        URL.revokeObjectURL(posUrl);
    }

    // Save normal texture
    if (result.normalTexture && options.exportNormal) {
        const normBlob = new Blob([new Uint8Array(result.normalTexture)], { type: 'image/png' });
        const normUrl = URL.createObjectURL(normBlob);
        const normLink = document.createElement('a');
        normLink.href = normUrl;
        normLink.download = `${baseFilename}_normal.png`;
        document.body.appendChild(normLink);
        normLink.click();
        document.body.removeChild(normLink);
        URL.revokeObjectURL(normUrl);
    }

    // Save metadata JSON
    const metadata = {
        particleCount: result.particleCount,
        frameCount: result.frameCount,
        frameRate: result.frameRate,
        textureResolution: result.width,
        boundsMin: result.boundsMin,
        boundsMax: result.boundsMax,
        exportDate: new Date().toISOString(),
    };

    const metaBlob = new Blob([JSON.stringify(metadata, null, 2)], { type: 'application/json' });
    const metaUrl = URL.createObjectURL(metaBlob);
    const metaLink = document.createElement('a');
    metaLink.href = metaUrl;
    metaLink.download = `${baseFilename}_metadata.json`;
    document.body.appendChild(metaLink);
    metaLink.click();
    document.body.removeChild(metaLink);
    URL.revokeObjectURL(metaUrl);

    if (onProgress) onProgress(100, 'Files saved successfully!');
}

export const vatExportClient = {
    validate: validateVATExport,
    export: exportVAT,
    exportToFiles: exportVATToFiles,
};
