import * as THREE from 'three';
import type { KMaterialAsset } from '@/systems/materials/KMaterialAsset';

export interface KernelArtifact {
    id: string;
    name: string;
    source: string;
    blob: Blob;
    timestamp: number;
    size: number;
    thumbnail?: string;
    isWelded?: boolean;
    weldedBlob?: Blob;
    isProcessing?: boolean;
    artifactType?: 'mesh' | 'mocap-take' | 'animation';
    fileExtension?: string;
    canMount?: boolean;
    linkedArtifactId?: string;
    metadata?: Record<string, unknown>;
}

export type KernelMaterial = KMaterialAsset;

export interface KernelAlpha {
    id: string;
    name: string;
    url: string; // Blob URL
    preview: string; 
    texture: THREE.Texture;
}

export interface PerformanceSettings {
    resolution: number; // 0.5 - 2.0
    shadows: boolean;
    postFX: boolean;
    antialiasing: boolean;
    mode: 'ECO' | 'BALANCED' | 'ULTRA' | 'CUSTOM';
}

