/**
 * MathBrushPanel.tsx — KMath Experimental Brush Control Panel
 *
 * Displayed in KSculpt's left panel as an "Experimental" tab.
 * Renders all 8 math brushes from the data-driven MATH_BRUSH_REGISTRY —
 * no hardcoded UI per brush. New brushes appear automatically.
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
    MATH_BRUSH_REGISTRY, MathBrushId, MathBrushDef, MathBrushParamType,
    type MathBrushCategory,
} from '@/systems/kmath/mathBrushes';
import {
    Waves, Droplets, Mountain, Target, Hand,
    GitBranch, Activity, Hexagon, ChevronDown, ChevronRight, Zap,
} from 'lucide-react';

// ─── Icon map (data-driven) ───────────────────────────────────────────────────

const ICON_MAP: Record<string, React.FC<any>> = {
    Waves, Droplets, Mountain, Target, Hand,
    GitBranch, Activity, Hexagon, Zap,
};

// ─── Category display config ──────────────────────────────────────────────────

const CATEGORY_CONFIG: Record<MathBrushCategory, { label: string; color: string }> = {
    FAIRING: { label: 'Fairing', color: 'text-cyan-400/70' },
    CURVATURE: { label: 'Curvature', color: 'text-orange-400/70' },
    DEFORMATION: { label: 'Deformation', color: 'text-emerald-400/70' },
    TOPOLOGY: { label: 'Topology', color: 'text-teal-400/70' },
    ANALYSIS: { label: 'Analysis', color: 'text-violet-400/70' },
};

// ─── Param control ────────────────────────────────────────────────────────────

function ParamControl({
    param, value, onChange,
}: {
    param: { key: string; label: string; type: MathBrushParamType; min?: number; max?: number; step?: number; options?: string[]; description?: string };
    value: number | boolean | string;
    onChange: (key: string, v: number | boolean | string) => void;
}) {
    if (param.type === 'bool') {
        return (
            <label className="flex items-center justify-between cursor-pointer py-0.5">
                <span className="text-[8px] font-mono text-white/50 uppercase">{param.label}</span>
                <button
                    onClick={() => onChange(param.key, !value)}
                    className={`relative w-7 h-3.5 rounded-full transition-colors ${value ? 'bg-orange-500/60' : 'bg-white/10'
                        }`}
                >
                    <span className={`absolute top-0.5 w-2.5 h-2.5 rounded-full bg-white transition-all ${value ? 'left-[14px]' : 'left-0.5'
                        }`} />
                </button>
            </label>
        );
    }

    if (param.type === 'select') {
        return (
            <div className="space-y-0.5">
                <span className="text-[8px] font-mono text-white/50 uppercase">{param.label}</span>
                <div className="flex gap-1 flex-wrap">
                    {param.options?.map(opt => (
                        <button
                            key={opt}
                            onClick={() => onChange(param.key, opt)}
                            className={`px-1.5 py-0.5 rounded text-[7px] font-mono transition-colors ${value === opt
                                    ? 'bg-orange-500/25 border border-orange-500/40 text-orange-300'
                                    : 'bg-white/[0.03] border border-white/8 text-white/40 hover:border-white/15'
                                }`}
                        >
                            {opt}
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    // float / int slider
    const numVal = value as number;
    const pct = param.min !== undefined && param.max !== undefined
        ? ((numVal - param.min) / (param.max - param.min)) * 100
        : 50;

    return (
        <div className="space-y-0.5">
            <div className="flex items-center justify-between">
                <span className="text-[8px] font-mono text-white/50 uppercase">{param.label}</span>
                <span className="text-[8px] font-mono tabular-nums text-white/70">
                    {param.type === 'int' ? Math.round(numVal) : numVal.toFixed(3)}
                </span>
            </div>
            <div className="relative h-1 bg-white/8 rounded-full">
                <div className="absolute inset-y-0 left-0 bg-orange-500/50 rounded-full transition-none"
                    style={{ width: `${pct}%` }} />
                <input
                    type="range"
                    min={param.min ?? 0} max={param.max ?? 1}
                    step={param.step ?? (param.type === 'int' ? 1 : 0.001)}
                    value={numVal}
                    onChange={e => onChange(param.key, param.type === 'int' ? parseInt(e.target.value) : parseFloat(e.target.value))}
                    className="absolute inset-0 w-full opacity-0 cursor-pointer h-full"
                />
            </div>
            {param.description && (
                <p className="text-[7px] text-white/25 leading-relaxed">{param.description}</p>
            )}
        </div>
    );
}

// ─── Brush card ───────────────────────────────────────────────────────────────

function BrushCard({
    def, isActive, onSelect, params, onParamChange,
}: {
    def: MathBrushDef;
    isActive: boolean;
    onSelect: (id: MathBrushId) => void;
    params: Record<string, number | boolean | string>;
    onParamChange: (key: string, v: number | boolean | string) => void;
}) {
    const [expanded, setExpanded] = useState(false);
    const Icon = ICON_MAP[def.icon] ?? Zap;
    const catCfg = CATEGORY_CONFIG[def.category];

    return (
        <div className={`rounded-lg border overflow-hidden transition-all duration-150 ${isActive
                ? 'border-orange-500/40 bg-orange-500/[0.06] shadow-[0_0_8px_rgba(251,146,60,0.15)]'
                : 'border-white/[0.06] bg-white/[0.02] hover:border-white/10'
            }`}>
            {/* Header */}
            <button
                className="w-full flex items-center gap-2 px-2.5 py-2 text-left"
                onClick={() => onSelect(def.id as MathBrushId)}
            >
                <div className={`flex-shrink-0 ${isActive ? def.color : 'text-white/30'}`}>
                    <Icon size={12} strokeWidth={1.8} />
                </div>
                <div className="flex-1 min-w-0">
                    <p className={`text-[9px] font-mono truncate ${isActive ? 'text-white/90' : 'text-white/60'}`}>
                        {def.label}
                    </p>
                    <p className={`text-[7px] ${catCfg.color}`}>{catCfg.label}</p>
                </div>
                {isActive && (
                    <button
                        className="text-white/30 hover:text-white/60 transition-colors"
                        onClick={(e) => { e.stopPropagation(); setExpanded(v => !v); }}
                    >
                        {expanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                    </button>
                )}
            </button>

            {/* Expanded params — only when active */}
            {isActive && expanded && (
                <div className="px-2.5 pb-2.5 space-y-2 border-t border-white/[0.05] pt-2">
                    <p className="text-[7px] text-white/25 leading-relaxed mb-1.5">{def.description}</p>
                    {def.params.map(p => (
                        <ParamControl
                            key={p.key}
                            param={p}
                            value={params[p.key] ?? p.default}
                            onChange={onParamChange}
                        />
                    ))}
                    <p className="text-[6px] text-white/15 font-mono mt-1">{def.algorithm}</p>
                </div>
            )}
        </div>
    );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

interface MathBrushPanelProps {
    activeMathBrush: MathBrushId | null;
    onSelectMathBrush: (id: MathBrushId | null) => void;
    brushParams: Record<string, Record<string, number | boolean | string>>;
    onParamChange: (brushId: MathBrushId, key: string, v: number | boolean | string) => void;
    computeMs?: number;
    affectedVerts?: number;
}

export function MathBrushPanel({
    activeMathBrush, onSelectMathBrush,
    brushParams, onParamChange,
    computeMs, affectedVerts,
}: MathBrushPanelProps) {
    // Group brushes by category
    const byCategory = useMemo(() => {
        const groups: Partial<Record<MathBrushCategory, MathBrushDef[]>> = {};
        for (const def of Object.values(MATH_BRUSH_REGISTRY)) {
            if (!groups[def.category]) groups[def.category] = [];
            groups[def.category]!.push(def);
        }
        return groups;
    }, []);

    const handleSelect = useCallback((id: MathBrushId) => {
        onSelectMathBrush(activeMathBrush === id ? null : id);
    }, [activeMathBrush, onSelectMathBrush]);

    return (
        <div className="flex flex-col gap-3 p-3 select-none">

            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-[10px] font-mono tracking-[0.15em] text-white/80 uppercase">KMath Lab</p>
                    <p className="text-[8px] text-white/30">Fortran-quality mesh algorithms</p>
                </div>
                {activeMathBrush && (
                    <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full
                                    bg-orange-500/15 border border-orange-500/30 text-orange-400
                                    text-[7px] font-mono">
                        <Zap size={7} />
                        {MATH_BRUSH_REGISTRY[activeMathBrush]?.label}
                    </div>
                )}
            </div>

            {/* Stats */}
            {computeMs !== undefined && affectedVerts !== undefined && (
                <div className="flex gap-2 text-[8px] font-mono">
                    <span className="text-white/30">Compute: <span className="text-white/60">{computeMs.toFixed(1)}ms</span></span>
                    <span className="text-white/30">Verts: <span className="text-white/60">{affectedVerts.toLocaleString()}</span></span>
                </div>
            )}

            {/* Brush grid by category */}
            {(Object.keys(CATEGORY_CONFIG) as MathBrushCategory[]).map(cat => {
                const defs = byCategory[cat];
                if (!defs?.length) return null;
                const catCfg = CATEGORY_CONFIG[cat];
                return (
                    <div key={cat} className="space-y-1">
                        <p className={`text-[8px] font-mono uppercase tracking-wider ${catCfg.color} mb-1`}>
                            {catCfg.label}
                        </p>
                        {defs.map(def => (
                            <BrushCard
                                key={def.id}
                                def={def}
                                isActive={activeMathBrush === def.id}
                                onSelect={handleSelect}
                                params={brushParams[def.id] ?? {}}
                                onParamChange={(key, v) => onParamChange(def.id as MathBrushId, key, v)}
                            />
                        ))}
                    </div>
                );
            })}

            {/* Info */}
            <div className="rounded-lg bg-white/[0.02] border border-white/[0.04] p-2 mt-1">
                <p className="text-[7px] text-white/25 leading-relaxed">
                    Click a brush to activate · Click again + expand ▶ to tune parameters · Math brushes run on the JS engine and are layered over the active sculpt mesh. Topology is cached per geometry.
                </p>
            </div>

        </div>
    );
}
