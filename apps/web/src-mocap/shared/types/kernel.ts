/**
 * Kernel Types
 * 
 * Type definitions for kernel-related artifacts and materials
 */

export interface KernelArtifact {
  id: string;
  name: string;
  type: string;
  data: any;
  thumbnail?: string;
  metadata?: Record<string, any>;
}

export interface KernelMaterial {
  id: string;
  name: string;
  properties: Record<string, any>;
  thumbnail?: string;
}

export interface KernelAsset {
  id: string;
  name: string;
  type: 'mesh' | 'material' | 'texture' | 'scene' | 'other';
  path: string;
  thumbnail?: string;
  metadata?: Record<string, any>;
}

export interface KernelAlpha {
  id: string;
  name: string;
  imageData: string | ArrayBuffer;
  thumbnail?: string;
  preview?: string;
  resolution?: { width: number; height: number };
}
