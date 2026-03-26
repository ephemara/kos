/**
 * useUV.ts
 * React hook for UV unwrapping and editing
 * 
 * Provides a simple interface for UV operations in React components.
 */

import { useState, useCallback, useRef } from 'react';
import * as THREE from 'three';
import type {
    ProjectionConfig,
    LSCMConfig,
    BoxProjectionConfig,
    HybridConfig,
    UVStats,
    ProjectionMode,
    CoordSpace,
    TargetAxis
} from './UVTypes';
import { applyUVProjection, applyBoxProjection, applyHybridAutoUnwrap, applyGpuProjection, canUseGpuProjection } from './UVProjection';
import { applyLSCM, isLSCMAvailable } from './LSCMSolver';
import { packUVsGPU, packUVsGrid, isGpuPackingAvailable } from './AtlasPacker';
import { UVBrush, calculateMultiMeshUVBounds } from './UVEditor';

// ============================================================================
// UV Hook Interface
// ============================================================================

export interface UseUVOptions {
    /** Enable GPU acceleration */
    useGpu?: boolean;
    /** Default projection mode */
    defaultProjection?: ProjectionMode;
    /** Default coordinate space */
    defaultCoordSpace?: CoordSpace;
    /** Default target axis */
    defaultTargetAxis?: TargetAxis;
}

export interface UseUVReturn {
    // State
    projection: ProjectionMode;
    setProjection: (mode: ProjectionMode) => void;
    coordSpace: CoordSpace;
    setCoordSpace: (space: CoordSpace) => void;
    targetAxis: TargetAxis;
    setTargetAxis: (axis: TargetAxis) => void;
    isProcessing: boolean;
    uvStats: UVStats | null;

    // Projection parameters
    scale: number;
    setScale: (value: number) => void;
    stretchU: number;
    setStretchU: (value: number) => void;
    stretchV: number;
    setStretchV: (value: number) => void;
    rotation: number;
    setRotation: (value: number) => void;
    offsetU: number;
    setOffsetU: (value: number) => void;
    offsetV: number;
    setOffsetV: (value: number) => void;
    jitter: number;
    setJitter: (value: number) => void;

    // LSCM parameters
    lscmIterations: number;
    setLscmIterations: (value: number) => void;
    lscmPadding: number;
    setLscmPadding: (value: number) => void;
    lscmTexels: number;
    setLscmTexels: (value: number) => void;
    lscmResolution: number;
    setLscmResolution: (value: number) => void;

    // Box projection parameters
    boxPadding: number;
    setBoxPadding: (value: number) => void;
    boxWorldAlign: boolean;
    setBoxWorldAlign: (value: boolean) => void;
    boxCameraCount: number;
    setBoxCameraCount: (value: number) => void;

    // Hybrid parameters
    hybridAutoClassify: boolean;
    setHybridAutoClassify: (value: boolean) => void;
    hybridForceMode: 'AUTO' | 'LSCM' | 'BOX';
    setHybridForceMode: (value: 'AUTO' | 'LSCM' | 'BOX') => void;

    // Operations
    performUnwrap: (meshes: { [uuid: string]: THREE.Mesh }, selectedIds: string[], originalGeos: { [uuid: string]: THREE.BufferGeometry }, camera?: THREE.Camera) => Promise<void>;
    performPack: (meshes: { [uuid: string]: THREE.Mesh }, selectedIds: string[]) => Promise<void>;
    applyPreset: (preset: 'WALL' | 'FLOOR' | 'PROP' | 'ATLAS_GRID', meshes: { [uuid: string]: THREE.Mesh }, selectedIds: string[], originalGeos: { [uuid: string]: THREE.BufferGeometry }) => Promise<void>;

    // Capabilities
    gpuAvailable: boolean;
    lscmAvailable: boolean;
}

// ============================================================================
// UV Hook
// ============================================================================

/**
 * React hook for UV unwrapping and editing
 * 
 * @param options - Hook configuration options
 * @returns UV operations and state
 * 
 * @example
 * ```tsx
 * const uv = useUV({ useGpu: true });
 * 
 * // Unwrap selected meshes
 * await uv.performUnwrap(meshes, selectedIds, originalGeos);
 * 
 * // Pack UV islands
 * await uv.performPack(meshes, selectedIds);
 * ```
 */
export function useUV(options: UseUVOptions = {}): UseUVReturn {
    const {
        useGpu = true,
        defaultProjection = 'BOX',
        defaultCoordSpace = 'LOCAL',
        defaultTargetAxis = 'Y'
    } = options;

    // Core state
    const [projection, setProjection] = useState<ProjectionMode>(defaultProjection);
    const [coordSpace, setCoordSpace] = useState<CoordSpace>(defaultCoordSpace);
    const [targetAxis, setTargetAxis] = useState<TargetAxis>(defaultTargetAxis);
    const [isProcessing, setIsProcessing] = useState(false);
    const [uvStats, setUvStats] = useState<UVStats | null>(null);

    // Projection parameters
    const [scale, setScale] = useState(1.0);
    const [stretchU, setStretchU] = useState(1.0);
    const [stretchV, setStretchV] = useState(1.0);
    const [rotation, setRotation] = useState(0);
    const [offsetU, setOffsetU] = useState(0.0);
    const [offsetV, setOffsetV] = useState(0.0);
    const [jitter, setJitter] = useState(0.0);

    // LSCM parameters
    const [lscmIterations, setLscmIterations] = useState(600);
    const [lscmPadding, setLscmPadding] = useState(2);
    const [lscmTexels, setLscmTexels] = useState(32);
    const [lscmResolution, setLscmResolution] = useState(1024);

    // Box projection parameters
    const [boxPadding, setBoxPadding] = useState(0.005);
    const [boxWorldAlign, setBoxWorldAlign] = useState(true);
    const [boxCameraCount, setBoxCameraCount] = useState(6);

    // Hybrid parameters
    const [hybridAutoClassify, setHybridAutoClassify] = useState(true);
    const [hybridForceMode, setHybridForceMode] = useState<'AUTO' | 'LSCM' | 'BOX'>('AUTO');

    // Capabilities
    const gpuAvailable = canUseGpuProjection();
    const lscmAvailable = isLSCMAvailable();

    /**
     * Perform UV unwrapping
     */
    const performUnwrap = useCallback(async (
        meshes: { [uuid: string]: THREE.Mesh },
        selectedIds: string[],
        originalGeos: { [uuid: string]: THREE.BufferGeometry },
        camera?: THREE.Camera
    ) => {
        if (selectedIds.length === 0) return;

        setIsProcessing(true);

        try {
            let totalVerts = 0;
            const promises: Promise<void>[] = [];

            // Build projection config
            const config: ProjectionConfig = {
                projection,
                targetAxis,
                coordSpace,
                scale,
                stretchU,
                stretchV,
                rotation,
                offsetU,
                offsetV,
                jitter,
                camera
            };

            for (const id of selectedIds) {
                const mesh = meshes[id];
                if (!mesh || !mesh.visible) continue;

                // GPU projection path
                const gpuModes: ProjectionMode[] = ['BOX', 'BOX_6AXIS', 'PLANAR_AXIS', 'PLANAR_X', 'PLANAR_Y', 'PLANAR_Z', 'CYLINDRICAL', 'SPHERICAL'];
                const canUseGpuPath = useGpu && gpuAvailable && gpuModes.includes(projection);

                if (canUseGpuPath) {
                    promises.push(
                        applyGpuProjection(mesh, {
                            mode: projection,
                            scale,
                            offsetU,
                            offsetV,
                        }).then(result => {
                            totalVerts += result.vertCount;
                        }).catch(() => {
                            // Fallback to CPU
                            const vertCount = applyUVProjection(mesh, originalGeos[id], config);
                            totalVerts += vertCount;
                        })
                    );
                } else if (projection === 'LSCM') {
                    promises.push(
                        applyLSCM(mesh, {
                            maxIterations: lscmIterations,
                            padding: lscmPadding,
                            texelsPerUnit: lscmTexels,
                            resolution: lscmResolution
                        }).then(result => {
                            totalVerts += result.vertCount;
                        })
                    );
                } else if (projection === 'BOX_6AXIS') {
                    applyBoxProjection(mesh, {
                        padding: boxPadding,
                        worldAlign: boxWorldAlign,
                        cameraCount: boxCameraCount
                    });
                    totalVerts += mesh.geometry.attributes.position.count;
                    promises.push(Promise.resolve());
                } else if (projection === 'HYBRID_AUTO') {
                    promises.push(
                        applyHybridAutoUnwrap(mesh, {
                            lscmIterations,
                            boxPadding,
                            boxWorldAlign,
                            boxCameraCount,
                            autoClassify: hybridAutoClassify,
                            forceMode: hybridForceMode === 'AUTO' ? undefined : hybridForceMode
                        }).then(result => {
                            totalVerts += result.vertCount;
                        })
                    );
                } else {
                    const vertCount = applyUVProjection(mesh, originalGeos[id], config);
                    totalVerts += vertCount;
                }
            }

            await Promise.all(promises);

            setUvStats({
                verts: totalVerts,
                meshes: selectedIds.length,
                version: Date.now()
            });
        } finally {
            setIsProcessing(false);
        }
    }, [
        projection, targetAxis, coordSpace, scale, stretchU, stretchV, rotation,
        offsetU, offsetV, jitter, lscmIterations, lscmPadding, lscmTexels,
        lscmResolution, boxPadding, boxWorldAlign, boxCameraCount,
        hybridAutoClassify, hybridForceMode, useGpu, gpuAvailable
    ]);

    /**
     * Perform UV packing
     */
    const performPack = useCallback(async (
        meshes: { [uuid: string]: THREE.Mesh },
        selectedIds: string[]
    ) => {
        if (selectedIds.length === 0) return;

        setIsProcessing(true);

        try {
            if (useGpu && isGpuPackingAvailable()) {
                let totalIslands = 0;
                for (const id of selectedIds) {
                    const mesh = meshes[id];
                    if (!mesh || !mesh.geometry.attributes.uv) continue;

                    const result = await packUVsGPU(mesh, 0.01);
                    totalIslands += result.islandCount;
                }
                console.log(`[UV] GPU packed ${totalIslands} islands`);
            } else {
                packUVsGrid(meshes, selectedIds);
                console.log(`[UV] CPU grid packed ${selectedIds.length} meshes`);
            }

            setUvStats(prev => ({ ...prev!, version: Date.now() }));
        } finally {
            setIsProcessing(false);
        }
    }, [useGpu]);

    /**
     * Apply preset configuration
     */
    const applyPreset = useCallback(async (
        preset: 'WALL' | 'FLOOR' | 'PROP' | 'ATLAS_GRID',
        meshes: { [uuid: string]: THREE.Mesh },
        selectedIds: string[],
        originalGeos: { [uuid: string]: THREE.BufferGeometry }
    ) => {
        switch (preset) {
            case 'WALL':
                setProjection('BOX');
                setCoordSpace('WORLD');
                setScale(1.0);
                setStretchU(1.0);
                setStretchV(1.0);
                setJitter(0.0);
                setTimeout(() => performUnwrap(meshes, selectedIds, originalGeos), 0);
                break;

            case 'FLOOR':
                setProjection('PLANAR_AXIS');
                setTargetAxis('Y');
                setCoordSpace('WORLD');
                setScale(0.5);
                setJitter(0.0);
                setTimeout(() => performUnwrap(meshes, selectedIds, originalGeos), 0);
                break;

            case 'PROP':
                setProjection('BOX');
                setCoordSpace('LOCAL');
                setScale(1.0);
                setJitter(0.0);
                setTimeout(() => performUnwrap(meshes, selectedIds, originalGeos), 0);
                break;

            case 'ATLAS_GRID':
                setProjection('BOX');
                setScale(4.0);
                setTimeout(() => performUnwrap(meshes, selectedIds, originalGeos), 0);
                break;
        }
    }, [performUnwrap]);

    return {
        // State
        projection,
        setProjection,
        coordSpace,
        setCoordSpace,
        targetAxis,
        setTargetAxis,
        isProcessing,
        uvStats,

        // Projection parameters
        scale,
        setScale,
        stretchU,
        setStretchU,
        stretchV,
        setStretchV,
        rotation,
        setRotation,
        offsetU,
        setOffsetU,
        offsetV,
        setOffsetV,
        jitter,
        setJitter,

        // LSCM parameters
        lscmIterations,
        setLscmIterations,
        lscmPadding,
        setLscmPadding,
        lscmTexels,
        setLscmTexels,
        lscmResolution,
        setLscmResolution,

        // Box projection parameters
        boxPadding,
        setBoxPadding,
        boxWorldAlign,
        setBoxWorldAlign,
        boxCameraCount,
        setBoxCameraCount,

        // Hybrid parameters
        hybridAutoClassify,
        setHybridAutoClassify,
        hybridForceMode,
        setHybridForceMode,

        // Operations
        performUnwrap,
        performPack,
        applyPreset,

        // Capabilities
        gpuAvailable,
        lscmAvailable,
    };
}
