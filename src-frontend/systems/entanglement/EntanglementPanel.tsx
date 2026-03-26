/**
 * EntanglementPanel.tsx — The Matrix Connection UI
 *
 * Displayed in KQuantum's right panel when CFD mode is active.
 * Provides live controls and telemetry for the Quantum Entanglement Bridge
 * connecting the CFD lab to KFlux / KSculpt.
 *
 * Visual metaphor: a neon oscilloscope / connection status dashboard.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { quantumBridge, EntanglementStats, EntanglementConfig } from '@/systems/entanglement/QuantumEntanglementBridge';
import { Zap, Activity, Wifi, WifiOff, Gauge, Link, Unlink, RotateCw } from 'lucide-react';
import * as THREE from 'three';

// ─── Types ────────────────────────────────────────────────────────────────────

interface EntanglementPanelProps {
    /** CFD simulation ID — from KQuantumEngine's cfdSimIdRef */
    cfdSimId: number | null;
    /** CFD grid resolution */
    resolution: [number, number, number];
    /** Called when the user activates entanglement — lets KSculpt know */
    onEntangle: () => void;
    onDisentangle: () => void;
}

// ─── CFD domain params (data-driven) ─────────────────────────────────────────

const DOMAIN_PRESETS = {
    'Small (50³)': { min: new THREE.Vector3(-25, -25, -25), max: new THREE.Vector3(25, 25, 25) },
    'Medium (100³)': { min: new THREE.Vector3(-50, -50, -50), max: new THREE.Vector3(50, 50, 50) },
    'Large (200³)': { min: new THREE.Vector3(-100, -100, -100), max: new THREE.Vector3(100, 100, 100) },
    'Sculpture': { min: new THREE.Vector3(-5, -5, -5), max: new THREE.Vector3(5, 5, 5) },
} as const;

type DomainPreset = keyof typeof DOMAIN_PRESETS;

// ─── Oscilloscope canvas (draws velocity magnitude history) ──────────────────

function Oscilloscope({ values }: { values: number[] }) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d')!;
        const W = canvas.width, H = canvas.height;

        ctx.clearRect(0, 0, W, H);
        ctx.fillStyle = '#0a0a0f';
        ctx.fillRect(0, 0, W, H);

        if (values.length < 2) return;

        const maxVal = Math.max(...values, 0.001);
        const stride = W / (values.length - 1);

        // Grid lines
        ctx.strokeStyle = 'rgba(251,146,60,0.08)';
        ctx.lineWidth = 0.5;
        for (let g = 0; g < 4; g++) {
            const y = H * g / 4;
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
        }

        // Signal
        const grad = ctx.createLinearGradient(0, 0, W, 0);
        grad.addColorStop(0, 'rgba(251,146,60,0.2)');
        grad.addColorStop(0.5, 'rgba(251,146,60,0.9)');
        grad.addColorStop(1, 'rgba(251,146,60,0.5)');

        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.5;
        ctx.shadowColor = '#fb923c';
        ctx.shadowBlur = 6;
        ctx.beginPath();
        values.forEach((v, i) => {
            const x = i * stride;
            const y = H - (v / maxVal) * H * 0.9 - H * 0.05;
            i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        });
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Fill under signal
        ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath();
        const fillGrad = ctx.createLinearGradient(0, 0, 0, H);
        fillGrad.addColorStop(0, 'rgba(251,146,60,0.15)');
        fillGrad.addColorStop(1, 'rgba(251,146,60,0)');
        ctx.fillStyle = fillGrad;
        ctx.fill();
    }, [values]);

    return (
        <canvas
            ref={canvasRef}
            width={240}
            height={48}
            className="w-full rounded-md"
            style={{ imageRendering: 'pixelated' }}
        />
    );
}

// ─── Stat row ────────────────────────────────────────────────────────────────

function StatRow({ label, value, unit, color = 'text-white/70' }: {
    label: string; value: string | number; unit?: string; color?: string;
}) {
    return (
        <div className="flex items-center justify-between py-0.5">
            <span className="text-[9px] font-mono text-white/40 uppercase tracking-wider">{label}</span>
            <span className={`text-[10px] font-mono tabular-nums ${color}`}>
                {value}{unit && <span className="text-white/30 ml-0.5">{unit}</span>}
            </span>
        </div>
    );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function EntanglementPanel({
    cfdSimId, resolution, onEntangle, onDisentangle,
}: EntanglementPanelProps) {
    const [connected, setConnected] = useState(false);
    const [hz, setHz] = useState(20);
    const [scale, setScale] = useState(3.5);
    const [obstacle, setObstacle] = useState(true);
    const [domainPreset, setDomainPreset] = useState<DomainPreset>('Medium (100³)');
    const [stats, setStats] = useState<EntanglementStats | null>(null);
    const velHistory = useRef<number[]>(new Array(60).fill(0));

    // Update history when stats arrive
    useEffect(() => {
        if (!stats) return;
        velHistory.current = [...velHistory.current.slice(1), stats.avgVelocityMagnitude];
    }, [stats]);

    const handleConnect = useCallback(async () => {
        if (!cfdSimId) return;

        const domain = DOMAIN_PRESETS[domainPreset];

        // We don't have direct access to fluxEngine / mesh here — those live in
        // KSculpt. We signal via the callback and expect the parent to pass them.
        onEntangle();

        // Note: actual .connect() is called by KSculpt's useEffect once it
        // receives the entangleActive signal. This panel just drives the config.
        setConnected(true);
    }, [cfdSimId, domainPreset, hz, scale, obstacle, onEntangle]);

    const handleDisconnect = useCallback(() => {
        quantumBridge.disconnect();
        setConnected(false);
        onDisentangle();
    }, [onDisentangle]);

    // Live stats subscription
    useEffect(() => {
        quantumBridge.onEntanglementFrame = (s) => setStats(s);
        return () => { quantumBridge.onEntanglementFrame = undefined; };
    }, []);

    const latColor = stats
        ? stats.injectLatencyMs < 10 ? 'text-emerald-400'
            : stats.injectLatencyMs < 33 ? 'text-yellow-400'
                : 'text-red-400'
        : 'text-white/40';

    const velColor = stats && stats.avgVelocityMagnitude > 0.5 ? 'text-orange-400' : 'text-white/70';

    return (
        <div className="flex flex-col gap-3 p-3 select-none">

            {/* ── Header ─────────────────────────────────────────────── */}
            <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full transition-all duration-300 ${connected
                        ? 'bg-orange-400 shadow-[0_0_8px_rgba(251,146,60,0.9)] animate-pulse'
                        : 'bg-zinc-600'
                    }`} />
                <div>
                    <p className="text-[10px] font-mono tracking-[0.2em] text-white/80 uppercase">
                        Quantum Entanglement
                    </p>
                    <p className="text-[8px] text-white/30">CFD Lab ←→ KFlux Dynamics</p>
                </div>
            </div>

            {/* ── Oscilloscope ────────────────────────────────────────── */}
            <div className="space-y-1">
                <p className="text-[8px] font-mono text-white/30 uppercase tracking-wider">
                    Velocity Field Magnitude
                </p>
                <Oscilloscope values={velHistory.current} />
            </div>

            {/* ── Live Stats ──────────────────────────────────────────── */}
            {stats && (
                <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-2 space-y-0.5">
                    <StatRow label="Inject Latency" value={stats.injectLatencyMs.toFixed(1)} unit="ms" color={latColor} />
                    <StatRow label="Avg Velocity" value={stats.avgVelocityMagnitude.toFixed(3)} unit="m/s" color={velColor} />
                    <StatRow label="Bridge Hz" value={stats.actualHz.toFixed(1)} unit="Hz" />
                    <StatRow label="Cycles" value={stats.cycleCount} />
                    <StatRow label="Obstacles" value={stats.obstacleCount} />
                    <StatRow label="Kernel" value={stats.usingWasm ? 'WASM' : 'JS'} />
                </div>
            )}

            <div className="h-px bg-white/[0.06]" />

            {/* ── Config ──────────────────────────────────────────────── */}
            <div className="space-y-2.5">
                <p className="text-[9px] font-mono tracking-wider text-white/40 uppercase">Config</p>

                {/* Domain preset */}
                <div>
                    <p className="text-[8px] text-white/30 mb-1 font-mono uppercase">CFD Domain</p>
                    <div className="grid grid-cols-2 gap-1">
                        {(Object.keys(DOMAIN_PRESETS) as DomainPreset[]).map(k => (
                            <button
                                key={k}
                                onClick={() => setDomainPreset(k)}
                                className={`py-1 px-1.5 rounded text-[8px] font-mono transition-colors ${domainPreset === k
                                        ? 'bg-orange-500/20 border border-orange-500/40 text-orange-300'
                                        : 'bg-white/[0.03] border border-white/8 text-white/40 hover:border-white/15'
                                    }`}
                            >
                                {k}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Hz */}
                <div className="space-y-1">
                    <div className="flex justify-between">
                        <span className="text-[8px] font-mono text-white/40 uppercase">Injection Rate</span>
                        <span className="text-[9px] font-mono text-white/70">{hz} Hz</span>
                    </div>
                    <div className="relative h-1.5 bg-white/8 rounded-full">
                        <div className="absolute inset-y-0 left-0 bg-orange-500/60 rounded-full"
                            style={{ width: `${(hz / 60) * 100}%` }} />
                        <input type="range" min={1} max={60} step={1} value={hz}
                            onChange={e => setHz(Number(e.target.value))}
                            className="absolute inset-0 w-full opacity-0 cursor-pointer h-full" />
                    </div>
                </div>

                {/* Scale */}
                <div className="space-y-1">
                    <div className="flex justify-between">
                        <span className="text-[8px] font-mono text-white/40 uppercase">Force Scale</span>
                        <span className="text-[9px] font-mono text-white/70">{scale.toFixed(1)}×</span>
                    </div>
                    <div className="relative h-1.5 bg-white/8 rounded-full">
                        <div className="absolute inset-y-0 left-0 bg-orange-500/60 rounded-full"
                            style={{ width: `${(scale / 10) * 100}%` }} />
                        <input type="range" min={0} max={10} step={0.1} value={scale}
                            onChange={e => setScale(Number(e.target.value))}
                            className="absolute inset-0 w-full opacity-0 cursor-pointer h-full" />
                    </div>
                </div>

                {/* Obstacle feedback toggle */}
                <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-[8px] font-mono text-white/40 uppercase">Obstacle Feedback</span>
                    <button
                        onClick={() => setObstacle(v => !v)}
                        className={`relative w-8 h-4 rounded-full transition-colors ${obstacle ? 'bg-orange-500/60' : 'bg-white/10'
                            }`}
                    >
                        <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${obstacle ? 'left-4.5' : 'left-0.5'
                            }`} />
                    </button>
                </label>
            </div>

            <div className="h-px bg-white/[0.06]" />

            {/* ── Connect/Disconnect ──────────────────────────────────── */}
            <div className="flex gap-2">
                {!connected ? (
                    <button
                        onClick={handleConnect}
                        disabled={!cfdSimId}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg
                                    text-[9px] font-mono tracking-wider uppercase transition-all
                                    ${cfdSimId
                                ? 'bg-orange-500/20 border border-orange-500/40 text-orange-300 hover:bg-orange-500/35 hover:shadow-[0_0_12px_rgba(251,146,60,0.3)]'
                                : 'bg-white/[0.04] border border-white/8 text-white/20 cursor-not-allowed'
                            }`}
                    >
                        <Zap size={10} />
                        {cfdSimId ? 'Entangle' : 'No CFD Active'}
                    </button>
                ) : (
                    <button
                        onClick={handleDisconnect}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg
                                   bg-red-500/15 border border-red-500/30 text-red-400
                                   text-[9px] font-mono tracking-wider uppercase
                                   hover:bg-red-500/25 transition-colors"
                    >
                        <WifiOff size={10} />
                        Disentangle
                    </button>
                )}
            </div>

            {/* ── Info ────────────────────────────────────────────────── */}
            <p className="text-[7px] text-white/20 leading-relaxed">
                {connected
                    ? `CFD velocity field sampled at ${hz}Hz and injected as forces into KFlux dynamics. Sculpt mesh projects back as ${obstacle ? 'obstacle surfaces' : 'ghost (one-way)'}.`
                    : 'Start a CFD simulation in CFD mode, then Entangle to link it to the active KFlux sculpt session.'
                }
            </p>

        </div>
    );
}

// ─── Slim indicator badge (shown in KQuantum topbar when entangled) ───────────

export function EntanglementBadge({ connected, hz }: { connected: boolean; hz: number }) {
    if (!connected) return null;
    return (
        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full
                        bg-orange-500/15 border border-orange-500/30 text-orange-400
                        text-[8px] font-mono animate-pulse">
            <Zap size={8} />
            ENTANGLED · {hz}Hz
        </div>
    );
}
