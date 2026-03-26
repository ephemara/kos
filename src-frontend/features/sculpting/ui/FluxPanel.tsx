/**
 * FluxPanel.tsx — KFlux Dynamics Control Panel
 *
 * Real-time controls for the Turbo Lightspeed Flux Capacitor™
 * Shown in the left/right panel area when FLUX mode is active in KSculpt.
 *
 * Controls:
 *   • Mode selector: PUSH / PULL / SPIN / ATTRACT / HEAT / FREEZE
 *   • Damping slider: how quickly energy dissipates
 *   • Surface tension: rest-spring to prevent explosion
 *   • Gravity: global downward force
 *   • Status: GPU / JS mode indicator
 *   • FREEZE button: commit deformation
 *   • RESET VELOCITY: drain all kinetic energy instantly
 */

import React, { useCallback } from 'react';
import { FluxMode, FluxParams } from '../engine/fluxEngine';
import {
    ArrowUp, ArrowDown, RotateCw, Magnet, Flame, Snowflake, Zap, RefreshCw,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface FluxPanelProps {
    active: boolean;
    fluxMode: FluxMode;
    setFluxMode: (m: FluxMode) => void;
    params: FluxParams;
    setParams: (p: Partial<FluxParams>) => void;
    onFreeze: () => void;
    onReset: () => void;
    isGPU: boolean;
    isReady: boolean;
}

// ─── Mode config (data-driven) ───────────────────────────────────────────────

const FLUX_MODES: {
    id: FluxMode;
    label: string;
    icon: React.FC<any>;
    desc: string;
    color: string;
}[] = [
        { id: 'PUSH', label: 'PUSH', icon: ArrowUp, desc: 'Eject verts outward along normals', color: 'text-orange-400 bg-orange-500/15 border-orange-500/30' },
        { id: 'PULL', label: 'PULL', icon: ArrowDown, desc: 'Suck verts inward along normals', color: 'text-blue-400 bg-blue-500/15 border-blue-500/30' },
        { id: 'SPIN', label: 'SPIN', icon: RotateCw, desc: 'Vortex swirl — tangential force field', color: 'text-violet-400 bg-violet-500/15 border-violet-500/30' },
        { id: 'ATTRACT', label: 'ATTRACT', icon: Magnet, desc: 'Pull all nearby verts toward centre', color: 'text-cyan-400 bg-cyan-500/15 border-cyan-500/30' },
        { id: 'HEAT', label: 'HEAT', icon: Flame, desc: 'Surface heat diffusion — inject chaos', color: 'text-red-400 bg-red-500/15 border-red-500/30' },
        { id: 'FREEZE', label: 'FREEZE', icon: Snowflake, desc: 'Commit current deformation to history', color: 'text-sky-300 bg-sky-500/15 border-sky-500/30' },
    ];

// ─── Sub-components ───────────────────────────────────────────────────────────

function FluxSlider({
    label, value, min, max, step, decimals = 2,
    onChange, description,
}: {
    label: string; value: number; min: number; max: number; step: number;
    decimals?: number; onChange: (v: number) => void; description?: string;
}) {
    const pct = ((value - min) / (max - min)) * 100;
    return (
        <div className="space-y-1">
            <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono tracking-wider text-white/60 uppercase">{label}</span>
                <span className="text-[10px] font-mono text-white/80 tabular-nums">{value.toFixed(decimals)}</span>
            </div>
            <div className="relative h-1.5 bg-white/8 rounded-full overflow-hidden">
                <div
                    className="absolute inset-y-0 left-0 bg-gradient-to-r from-orange-600 to-orange-400 rounded-full transition-none"
                    style={{ width: `${pct}%` }}
                />
                <input
                    type="range"
                    min={min} max={max} step={step}
                    value={value}
                    onChange={e => onChange(parseFloat(e.target.value))}
                    className="absolute inset-0 w-full opacity-0 cursor-pointer h-full"
                />
            </div>
            {description && (
                <p className="text-[8px] text-white/30">{description}</p>
            )}
        </div>
    );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function FluxPanel({
    active, fluxMode, setFluxMode, params, setParams,
    onFreeze, onReset, isGPU, isReady,
}: FluxPanelProps) {

    const handleModeClick = useCallback((mode: FluxMode) => {
        if (mode === 'FREEZE') {
            onFreeze();
        } else {
            setFluxMode(mode);
        }
    }, [onFreeze, setFluxMode]);

    return (
        <div className="flex flex-col gap-3 p-3 select-none">

            {/* ── Header ──────────────────────────────────────────────── */}
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-[10px] font-mono tracking-[0.2em] text-white/80 uppercase">Flux Capacitor</p>
                    <p className="text-[8px] text-white/30 mt-0.5">GPU Surface Dynamics</p>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className={`w-1.5 h-1.5 rounded-full ${!isReady ? 'bg-zinc-600' :
                            isGPU ? 'bg-emerald-400 animate-pulse shadow-[0_0_6px_rgba(52,211,153,0.8)]' :
                                'bg-yellow-400'
                        }`} />
                    <span className={`text-[8px] font-mono ${!isReady ? 'text-zinc-500' :
                            isGPU ? 'text-emerald-400' : 'text-yellow-400'
                        }`}>
                        {!isReady ? 'INIT' : isGPU ? 'GPU' : 'CPU'}
                    </span>
                </div>
            </div>

            {/* ── Mode Selector ───────────────────────────────────────── */}
            <div>
                <p className="text-[9px] font-mono tracking-wider text-white/40 uppercase mb-1.5">Force Mode</p>
                <div className="grid grid-cols-3 gap-1">
                    {FLUX_MODES.map(m => {
                        const Icon = m.icon;
                        const isActive = fluxMode === m.id && m.id !== 'FREEZE';
                        return (
                            <button
                                key={m.id}
                                title={m.desc}
                                onClick={() => handleModeClick(m.id)}
                                className={`
                                    relative flex flex-col items-center gap-0.5 py-1.5 px-1 rounded-lg border
                                    text-[8px] font-mono tracking-wider uppercase
                                    transition-all duration-100 cursor-pointer
                                    ${isActive
                                        ? m.color + ' shadow-sm'
                                        : 'bg-white/[0.03] border-white/8 text-white/40 hover:bg-white/[0.06] hover:text-white/70 hover:border-white/15'
                                    }
                                `}
                            >
                                <Icon size={12} strokeWidth={1.8} />
                                {m.label}
                                {isActive && (
                                    <span className="absolute top-0.5 right-0.5 w-1 h-1 rounded-full bg-current opacity-80" />
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="h-px bg-white/[0.06]" />

            {/* ── Physics Params ──────────────────────────────────────── */}
            <div className="space-y-3">
                <p className="text-[9px] font-mono tracking-wider text-white/40 uppercase">Dynamics</p>

                <FluxSlider
                    label="Damping"
                    value={params.damping}
                    min={0.5} max={0.999} step={0.001}
                    decimals={3}
                    onChange={v => setParams({ damping: v })}
                    description="Energy dissipation — higher = faster freeze"
                />

                <FluxSlider
                    label="Surface Tension"
                    value={params.surfaceTension}
                    min={0.0} max={0.3} step={0.005}
                    decimals={3}
                    onChange={v => setParams({ surfaceTension: v })}
                    description="Rest-spring strength — prevents shape explosion"
                />

                <FluxSlider
                    label="Gravity"
                    value={params.gravity}
                    min={0.0} max={2.0} step={0.01}
                    decimals={2}
                    onChange={v => setParams({ gravity: v })}
                    description="Downward pull on all vertices"
                />
            </div>

            <div className="h-px bg-white/[0.06]" />

            {/* ── Actions ─────────────────────────────────────────────── */}
            <div className="flex gap-1.5">
                <button
                    onClick={onFreeze}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg
                               bg-sky-500/15 border border-sky-500/30 text-sky-300
                               text-[9px] font-mono tracking-wider uppercase
                               hover:bg-sky-500/25 transition-colors"
                >
                    <Snowflake size={10} />
                    Freeze
                </button>

                <button
                    onClick={onReset}
                    title="Drain all velocity — mesh stops moving"
                    className="flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg
                               bg-white/[0.04] border border-white/10 text-white/40
                               text-[9px] font-mono tracking-wider uppercase
                               hover:bg-white/[0.08] hover:text-white/70 transition-colors"
                >
                    <RefreshCw size={10} />
                </button>
            </div>

            {/* ── Status / Tips ───────────────────────────────────────── */}
            <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-2">
                <p className="text-[8px] text-white/30 leading-relaxed">
                    {fluxMode === 'PUSH' && 'Paint to inject outward normal force. Mesh verts accelerate outward and oscillate.'}
                    {fluxMode === 'PULL' && 'Paint to inject inward pull. Combining with damping creates crater-like depressions.'}
                    {fluxMode === 'SPIN' && 'Tangential vortex. Creates swirling surface flow and twisting deformations.'}
                    {fluxMode === 'ATTRACT' && 'Convergence force. Pulls vertices toward brush centre — lattice collapse effect.'}
                    {fluxMode === 'HEAT' && 'Injects surface energy that diffuses outward over frames like thermal conduction.'}
                    {fluxMode === 'FREEZE' && 'Commits the current deformed state as the new rest position. Adds to undo history.'}
                </p>
            </div>

        </div>
    );
}

export default FluxPanel;
