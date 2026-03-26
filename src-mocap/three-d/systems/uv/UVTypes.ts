/**
 * UVTypes.ts
 * Type definitions for the Universal UV System
 * 
 * Supports LSCM unwrapping, atlas packing, box projection, and UV editing.
 */

import * as THREE from 'three';

// ============================================================================
// Core UV Types
// ============================================================================

/**
 * Projection modes for UV unwrapping
 */
export type ProjectionMode =
    | 'ORIGINAL'           // Restore original UVs
    | 'BOX'                // Simple box projection
    | 'BOX_6AXIS'          // Multi-camera box projection
    | 'PLANAR_AXIS'        // Planar projection along axis
    | 'PLANAR_X'           // Planar projection on X axis
    | 'PLANAR_Y'           // Planar projection on Y axis
    | 'PLANAR_Z'           // Planar projection on Z axis
    | 'CYLINDRICAL'        // Cylindrical unwrap
    | 'SPHERICAL'          // Spherical unwrap
    | 'CAMERA_VIEW'        // Project from camera view
    | 'NORMAL_FRACTURE'    // Normal-based fracture
    | 'LSCM'               // Least Squares Conformal Maps
    | 'HYBRID_AUTO';       // Intelligent auto-classification

/**
 * Coordinate space for projection
 */
export type CoordSpace = 'LOCAL' | 'WORLD';

/**
 * Target axis for planar/cylindrical projections
 */
export type TargetAxis = 'X' | 'Y' | 'Z';

/**
 * Mesh classification for hybrid unwrapping
 */
export type MeshClassification = 'ORGANIC' | 'HARD_SURFACE' | 'MIXED';

// ============================================================================
// Configuration Interfaces
// ============================================================================

/**
 * Configuration for UV projection operations
 */
export interface ProjectionConfig {
    /** Projection mode */
    projection: ProjectionMode;
    /** Target axis for planar/cylindrical projections */
    targetAxis: TargetAxis;
    /** Coordinate space (local or world) */
    coordSpace: CoordSpace;
    /** Scale factor */
    scale: number;
    /** U-axis stretch */
    stretchU: number;
    /** V-axis stretch */
    stretchV: number;
    /** Rotation in degrees */
    rotation: number;
    /** U-axis offset */
    offsetU: number;
    /** V-axis offset */
    offsetV: number;
    /** Random jitter amount */
    jitter: number;
    /** Camera for camera-view projection */
    camera?: THREE.Camera;
}

/**
 * Configuration for LSCM solver
 */
export interface LSCMConfig {
    /** Maximum solver iterations */
    maxIterations: number;
    /** Padding between UV islands */
    padding: number;
    /** Texels per unit for resolution */
    texelsPerUnit: number;
    /** Target texture resolution */
    resolution: number;
}

/**
 * Configuration for box projection
 */
export interface BoxProjectionConfig {
    /** Padding between UV islands */
    padding: number;
    /** Use world-aligned projection */
    worldAlign: boolean;
    /** Number of projection cameras (6, 14, 26, 50, 98) */
    cameraCount?: number;
}

/**
 * Configuration for hybrid auto-unwrap
 */
export interface HybridConfig {
    /** LSCM solver iterations */
    lscmIterations: number;
    /** Box projection padding */
    boxPadding: number;
    /** Box world alignment */
    boxWorldAlign: boolean;
    /** Box camera count */
    boxCameraCount?: number;
    /** Enable automatic classification */
    autoClassify: boolean;
    /** Force specific solver mode */
    forceMode?: 'LSCM' | 'BOX';
}

/**
 * Configuration for GPU projection
 */
export interface GpuProjectConfig {
    /** Projection mode */
    mode: ProjectionMode;
    /** Scale factor */
    scale: number;
    /** U-axis offset */
    offsetU: number;
    /** V-axis offset */
    offsetV: number;
}

// ============================================================================
// Result Interfaces
// ============================================================================

/**
 * Result from LSCM unwrapping
 */
export interface LSCMResult {
    /** Number of vertices processed */
    vertCount: number;
    /** Processing time in milliseconds */
    time: number;
}

/**
 * Result from hybrid unwrapping
 */
export interface HybridResult {
    /** Number of vertices processed */
    vertCount: number;
    /** Processing time in milliseconds */
    time: number;
    /** Mesh classification */
    classification: MeshClassification;
    /** Solver used */
    solver: 'LSCM' | 'BOX' | 'HYBRID';
}

/**
 * Result from GPU projection
 */
export interface GpuProjectResult {
    /** Number of vertices processed */
    vertCount: number;
    /** Processing time in milliseconds */
    timeMs: number;
}

/**
 * Result from GPU packing
 */
export interface GpuPackResult {
    /** Number of vertices processed */
    vertCount: number;
    /** Number of UV islands */
    islandCount: number;
    /** Processing time in milliseconds */
    timeMs: number;
}

/**
 * Result from atlas initialization
 */
export interface AtlasInitResult {
    /** Handle for GPU operations */
    handle: number;
    /** Number of vertices */
    vertex_count: number;
}

/**
 * Result from atlas projection
 */
export interface AtlasProjectResult {
    /** UV coordinates */
    uvs: number[];
    /** Processing time in milliseconds */
    time_ms: number;
}

/**
 * Result from atlas packing
 */
export interface AtlasPackResult {
    /** Packed UV coordinates */
    uvs: number[];
    /** Number of islands packed */
    island_count: number;
    /** Processing time in milliseconds */
    time_ms: number;
}

/**
 * Result from mesh classification
 */
export interface ClassificationResult {
    /** Classification type */
    classification: string;
    /** Percentage of sharp edges */
    sharp_edge_percent: number;
    /** Average curvature */
    avg_curvature: number;
    /** Planarity score */
    planarity_score: number;
    /** Processing time in milliseconds */
    time_ms: number;
}

// ============================================================================
// UV Editing Types
// ============================================================================

/**
 * UV brush types for editing
 */
export type UVBrushType = 'GRAB' | 'RELAX';

/**
 * Parameters for UV brush operations
 */
export interface UVBrushParams {
    /** Brush radius in UV space */
    radius: number;
    /** Brush intensity (0-1) */
    intensity: number;
    /** Brush type */
    type: UVBrushType;
}

// ============================================================================
// Bin Packing Types
// ============================================================================

/**
 * Rectangle for bin packing
 */
export interface Rect {
    /** Unique identifier */
    id: number;
    /** Width */
    w: number;
    /** Height */
    h: number;
    /** X position */
    x: number;
    /** Y position */
    y: number;
    /** Whether the rect was rotated */
    rotated?: boolean;
}

/**
 * Free rectangle in bin packing
 */
export interface FreeRect {
    /** X position */
    x: number;
    /** Y position */
    y: number;
    /** Width */
    w: number;
    /** Height */
    h: number;
}

// ============================================================================
// UV Statistics
// ============================================================================

/**
 * UV statistics for display
 */
export interface UVStats {
    /** Number of vertices */
    verts: number;
    /** Number of meshes */
    meshes: number;
    /** Version number for updates */
    version?: number;
}

/**
 * UV bounds for framing
 */
export interface UVBounds {
    /** Minimum U coordinate */
    minU: number;
    /** Maximum U coordinate */
    maxU: number;
    /** Minimum V coordinate */
    minV: number;
    /** Maximum V coordinate */
    maxV: number;
}
