/**
 * useEntanglement.ts — KSculpt-side hook for the Quantum Entanglement Bridge
 *
 * Manages the full lifecycle of the bridge from KSculpt's perspective:
 *   • When `active` becomes true: calls quantumBridge.connect() with the
 *     live flux engine + current sculpt mesh
 *   • When `active` becomes false: calls quantumBridge.disconnect()
 *   • Re-connects if cfdSimId changes (new CFD session started in KQuantum)
 *   • Exposes live stats for the FluxPanel / status bar
 *
 * Usage in KSculpt:
 *   const entanglement = useEntanglement({
 *       active: entanglementActive,
 *       cfdSimId,
 *       fluxEngine: flux,
 *       mesh: activeMesh,
 *       config: { hz: 20, velocityToForceScale: 4.0, ... }
 *   });
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import {
    quantumBridge,
    EntanglementStats,
    EntanglementConfig,
    DEFAULT_ENTANGLEMENT_CONFIG,
} from './QuantumEntanglementBridge';
import type { FluxEngine } from '@/features/sculpting/engine/fluxEngine';

export interface UseEntanglementOptions {
    active: boolean;
    cfdSimId: number | null;
    fluxEngine: { ready: boolean;[key: string]: any } | null;
    mesh: THREE.Mesh | null;
    config?: Partial<Omit<EntanglementConfig, 'cfdSimId' | 'fluxEngine' | 'mesh'>>;
}

export interface UseEntanglementReturn {
    stats: EntanglementStats | null;
    connected: boolean;
    reconnect: () => void;
    disconnect: () => void;
}

export function useEntanglement(opts: UseEntanglementOptions): UseEntanglementReturn {
    const [stats, setStats] = useState<EntanglementStats | null>(null);
    const [connected, setConnected] = useState(false);

    const optsRef = useRef(opts);
    optsRef.current = opts;

    // Register stats callback
    useEffect(() => {
        quantumBridge.onEntanglementFrame = (s) => {
            setStats(s);
            setConnected(true);
        };
        return () => { quantumBridge.onEntanglementFrame = undefined; };
    }, []);

    // Connect / disconnect on active flag or cfdSimId change
    useEffect(() => {
        const { active, cfdSimId, fluxEngine, mesh } = opts;

        if (!active || !cfdSimId || !fluxEngine?.ready || !mesh) {
            if (quantumBridge.connected) {
                quantumBridge.disconnect();
                setConnected(false);
            }
            return;
        }

        const cfg: EntanglementConfig = {
            ...DEFAULT_ENTANGLEMENT_CONFIG as any,
            ...opts.config,
            cfdSimId,
            fluxEngine: fluxEngine as unknown as FluxEngine,
            mesh,
            resolution: opts.config?.resolution ?? [64, 64, 64],
            domainMin: opts.config?.domainMin ?? new THREE.Vector3(-50, -50, -50),
            domainMax: opts.config?.domainMax ?? new THREE.Vector3(50, 50, 50),
            hz: opts.config?.hz ?? 20,
            velocityToForceScale: opts.config?.velocityToForceScale ?? 3.5,
            enableObstacleFeedback: opts.config?.enableObstacleFeedback ?? true,
            obstacleDrag: opts.config?.obstacleDrag ?? 0.6,
        };

        quantumBridge.connect(cfg).then(() => setConnected(true));

        return () => {
            quantumBridge.disconnect();
            setConnected(false);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [opts.active, opts.cfdSimId, opts.mesh?.uuid, opts.fluxEngine?.ready]);

    const reconnect = useCallback(() => {
        const { cfdSimId, fluxEngine, mesh } = optsRef.current;
        if (!cfdSimId || !fluxEngine?.ready || !mesh) return;

        quantumBridge.disconnect();
        setTimeout(() => {
            const newCfg: EntanglementConfig = {
                ...DEFAULT_ENTANGLEMENT_CONFIG as any,
                ...optsRef.current.config,
                cfdSimId,
                fluxEngine: fluxEngine as unknown as FluxEngine,
                mesh,
                resolution: optsRef.current.config?.resolution ?? [64, 64, 64],
                domainMin: optsRef.current.config?.domainMin ?? new THREE.Vector3(-50, -50, -50),
                domainMax: optsRef.current.config?.domainMax ?? new THREE.Vector3(50, 50, 50),
                hz: optsRef.current.config?.hz ?? 20,
                velocityToForceScale: optsRef.current.config?.velocityToForceScale ?? 3.5,
                enableObstacleFeedback: optsRef.current.config?.enableObstacleFeedback ?? true,
                obstacleDrag: optsRef.current.config?.obstacleDrag ?? 0.6,
            };
            quantumBridge.connect(newCfg).then(() => setConnected(true));
        }, 100);
    }, []);

    const disconnect = useCallback(() => {
        quantumBridge.disconnect();
        setConnected(false);
    }, []);

    return { stats, connected, reconnect, disconnect };
}
