/**
 * useFlux.ts — React hook for KFlux surface dynamics
 *
 * Manages the FluxEngine lifecycle inside KSculpt:
 *   • Initialises the engine when a mesh is selected & flux mode activates
 *   • Drives the animation loop (GPU compute per rAF)
 *   • Writes updated positions back into the Three.js geometry each frame
 *   • Exposes paintBrush() for tool integration
 *   • Handles freeze → sculpt history commit
 *
 * Usage in KSculpt:
 *   const flux = useFlux({ mesh, params, active, onFreeze });
 *   flux.paintBrush(brushParams);      // call on pointer-move in FLUX mode
 *   flux.freeze();                     // commit deformation to history
 *   flux.setParams({ damping: 0.85 }); // update dynamics live
 */

import { useRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import {
    FluxEngine,
    FluxBrushParams,
    FluxParams,
    DEFAULT_FLUX_PARAMS,
} from './fluxEngine';

export interface UseFluxOptions {
    /** The sculpt mesh to run dynamics on */
    mesh: THREE.Mesh | null;
    /** Flux physics parameters */
    params?: Partial<FluxParams>;
    /** Whether flux mode is active — engine only runs when true */
    active: boolean;
    /** Called when FREEZE is committed — with the mesh's new geometry so
     *  KSculpt can push to its undo history */
    onFreeze?: (geo: THREE.BufferGeometry) => void;
    /** Renderer — we schedule redraws via renderer.render after each step */
    renderer?: THREE.WebGLRenderer;
    scene?: THREE.Scene;
    camera?: THREE.Camera;
}

export interface UseFluxReturn {
    paintBrush: (params: FluxBrushParams) => void;
    freeze: () => void;
    resetVelocity: () => void;
    setParams: (p: Partial<FluxParams>) => void;
    syncMesh: () => void;
    isGPU: boolean;
    isReady: boolean;
}

export function useFlux(opts: UseFluxOptions): UseFluxReturn {
    const engineRef = useRef<FluxEngine | null>(null);
    const meshRef = useRef<THREE.Mesh | null>(null);
    const isReadyRef = useRef(false);
    const isGPURef = useRef(false);
    const lastMeshId = useRef<string>('');
    const activeRef = useRef(opts.active);
    activeRef.current = opts.active;

    // Keep stable refs to callbacks so the engine's onFrame closure never stales
    const rendererRef = useRef(opts.renderer);
    rendererRef.current = opts.renderer;
    const sceneRef = useRef(opts.scene);
    sceneRef.current = opts.scene;
    const cameraRef = useRef(opts.camera);
    cameraRef.current = opts.camera;
    const onFreezeRef = useRef(opts.onFreeze);
    onFreezeRef.current = opts.onFreeze;

    // ─── Engine lifecycle ─────────────────────────────────────────────────────

    useEffect(() => {
        const mesh = opts.mesh;
        const meshId = mesh?.uuid ?? '';
        let cancelled = false;

        // Skip if mesh didn't change and engine is already ready
        if (!mesh || meshId === lastMeshId.current) return;
        lastMeshId.current = meshId;
        meshRef.current = mesh;

        // Dispose previous engine
        engineRef.current?.dispose();
        isReadyRef.current = false;

        const engine = new FluxEngine();
        engineRef.current = engine;

        // onFrame — called by engine after each GPU/JS integration step
        engine.onFrame = (positions: Float32Array) => {
            if (!meshRef.current || !activeRef.current) return;
            engine.applyPositionsToMesh(meshRef.current, positions);

            // Trigger Three.js re-render
            if (rendererRef.current && sceneRef.current && cameraRef.current) {
                rendererRef.current.render(sceneRef.current, cameraRef.current);
            }
        };

        (async () => {
            const ok = await engine.initFromMesh(mesh, opts.params ?? {});
            if (cancelled || engineRef.current !== engine) return;
            if (!ok) { console.error('[useFlux] Engine init failed'); return; }

            isReadyRef.current = ok;
            isGPURef.current = engine.gpuActive;

            // Start the integration loop only when flux mode is active
            if (activeRef.current) {
                engine.startLoop();
            }
        })();

        return () => {
            cancelled = true;
            engine.stopLoop();
            engine.dispose();
            isReadyRef.current = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [opts.mesh]);

    // ─── Start / stop loop when active flag changes ───────────────────────────

    useEffect(() => {
        const engine = engineRef.current;
        if (!engine || !isReadyRef.current) return;

        if (opts.active) {
            if (meshRef.current) engine.syncPositionsFromMesh(meshRef.current);
            engine.startLoop();
        } else {
            engine.stopLoop();
        }
    }, [opts.active]);

    // ─── Param updates ────────────────────────────────────────────────────────

    useEffect(() => {
        if (opts.params) {
            engineRef.current?.setParams(opts.params);
        }
    }, [opts.params]);

    // ─── Exposed API ─────────────────────────────────────────────────────────

    const paintBrush = useCallback((bp: FluxBrushParams) => {
        engineRef.current?.paintBrush(bp);
    }, []);

    const freeze = useCallback(() => {
        const engine = engineRef.current;
        const mesh = meshRef.current;
        if (!engine || !mesh) return;

        engine.freeze();

        // Commit to history: clone the deformed geometry and call onFreeze
        if (onFreezeRef.current) {
            onFreezeRef.current(mesh.geometry.clone());
        }
    }, []);

    const resetVelocity = useCallback(() => {
        engineRef.current?.resetVelocity();
    }, []);

    const setParams = useCallback((p: Partial<FluxParams>) => {
        engineRef.current?.setParams(p);
    }, []);

    /** Force-sync the live mesh positions back into the flux buffers (call after
     *  a non-flux sculpt brush modifies the mesh, to keep dynamics consistent) */
    const syncMesh = useCallback(() => {
        const mesh = meshRef.current;
        if (!mesh) return;
        engineRef.current?.syncPositionsFromMesh(mesh);
    }, []);

    return {
        paintBrush,
        freeze,
        resetVelocity,
        setParams,
        syncMesh,
        get isGPU() { return isGPURef.current; },
        get isReady() { return isReadyRef.current; },
    };
}
