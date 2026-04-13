import React from 'react';
import { X, Sun, RotateCcw } from 'lucide-react';
import { getActiveStage } from './lookdevRegistry';
import {
    getLookdevAppOverride,
    getLookdevEffective,
    getLookdevGlobal,
    initLookdevStore,
    setLookdevAppOverride,
    setLookdevGlobal,
    subscribeLookdev,
    clearLookdevAppOverride,
    type LookdevSettings,
} from './lookdevStore';
import { StudioStagePresets } from '@/systems/three/StudioStage';

function clamp(v: number, lo: number, hi: number): number {
    return Math.max(lo, Math.min(hi, v));
}

function toNum(v: string, fallback: number): number {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
}

export function LookdevHud({
    open,
    onOpenChange,
    appKey,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    appKey: string;
}) {
    const [, force] = React.useState(0);

    React.useEffect(() => {
        if (!open) return;
        initLookdevStore();
        return subscribeLookdev(() => force((v) => v + 1));
    }, [open]);

    if (!open) return null;

    const activeStage = getActiveStage();
    const global = getLookdevGlobal();
    const override = getLookdevAppOverride(appKey);
    const effective = getLookdevEffective(appKey);

    const hasOverride = !!override;

    const write = (patch: Partial<LookdevSettings>) => {
        if (hasOverride) setLookdevAppOverride(appKey, patch);
        else setLookdevGlobal(patch);
    };

    const hdrOptions = [
        { label: 'Cloudy Studio', value: '/hdr/HDR_029_Sky_Cloudy_Env.hdr' },
        { label: 'Night', value: '/hdr/night.hdr' },
    ];

    const presets = Object.keys(StudioStagePresets) as Array<keyof typeof StudioStagePresets>;

    return (
        <div className="pointer-events-none fixed top-16 left-4 z-[190] w-[420px]">
            <div className="pointer-events-auto rounded-xl border border-white/10 bg-black/70 backdrop-blur-xl shadow-2xl overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <Sun size={14} className="text-white/70" />
                            <div className="text-[11px] font-black tracking-widest text-white/80">LOOKDEV</div>
                        </div>
                        <div className="text-[10px] font-mono text-white/40 truncate">
                            {activeStage ? 'active stage connected' : 'no active stage (click a viewport)'}
                        </div>
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            className="h-7 px-2 rounded-md border border-white/10 bg-white/5 hover:bg-white/10 text-[10px] text-white/70"
                            onClick={() => {
                                if (hasOverride) clearLookdevAppOverride(appKey);
                                else setLookdevGlobal(global);
                            }}
                            title={hasOverride ? 'Clear app override' : 'Reset global'}
                        >
                            <RotateCcw size={14} className="inline-block mr-1" />
                            {hasOverride ? 'Clear App' : 'Reset'}
                        </button>
                        <button
                            className="h-7 w-7 rounded-md border border-white/10 bg-white/5 hover:bg-white/10 text-white/70 flex items-center justify-center"
                            onClick={() => onOpenChange(false)}
                            aria-label="Close"
                            title="Close (F9)"
                        >
                            <X size={14} />
                        </button>
                    </div>
                </div>

                <div className="p-3 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                        <div className="text-[10px] text-white/40 font-mono">scope</div>
                        <label className="flex items-center gap-2 text-[10px] text-white/70">
                            <input
                                type="checkbox"
                                checked={hasOverride}
                                onChange={(e) => {
                                    if (e.target.checked) {
                                        setLookdevAppOverride(appKey, effective);
                                    } else {
                                        clearLookdevAppOverride(appKey);
                                    }
                                }}
                            />
                            per-app override
                        </label>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <label className="text-[10px] text-white/50">
                            preset
                            <select
                                className="mt-1 w-full h-8 rounded-md bg-black/40 border border-white/10 text-white/80 px-2"
                                value={effective.preset}
                                onChange={(e) => write({ preset: e.target.value as any })}
                            >
                                {presets.map((p) => (
                                    <option key={p} value={p}>
                                        {p}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label className="text-[10px] text-white/50">
                            env
                            <select
                                className="mt-1 w-full h-8 rounded-md bg-black/40 border border-white/10 text-white/80 px-2"
                                value={effective.envMode}
                                onChange={(e) => write({ envMode: e.target.value as any })}
                            >
                                <option value="room">room</option>
                                <option value="hdr">hdr</option>
                            </select>
                        </label>
                    </div>

                    {effective.envMode === 'hdr' ? (
                        <label className="text-[10px] text-white/50 block">
                            hdr
                            <select
                                className="mt-1 w-full h-8 rounded-md bg-black/40 border border-white/10 text-white/80 px-2"
                                value={effective.hdrPath}
                                onChange={(e) => write({ hdrPath: e.target.value })}
                            >
                                {hdrOptions.map((o) => (
                                    <option key={o.value} value={o.value}>
                                        {o.label}
                                    </option>
                                ))}
                            </select>
                        </label>
                    ) : null}

                    <div className="space-y-2">
                        <Slider
                            label="exposure"
                            value={effective.exposure}
                            min={0.1}
                            max={3.0}
                            step={0.05}
                            onChange={(v) => write({ exposure: v })}
                        />
                        <Slider
                            label="ibl intensity"
                            value={effective.environmentIntensity}
                            min={0.0}
                            max={3.0}
                            step={0.05}
                            onChange={(v) => write({ environmentIntensity: v })}
                        />
                        <Slider
                            label="ibl blur"
                            value={effective.environmentBlur}
                            min={0.0}
                            max={0.35}
                            step={0.01}
                            onChange={(v) => write({ environmentBlur: v })}
                            disabled={effective.envMode !== 'room'}
                        />
                        <Slider
                            label="pixel ratio scale"
                            value={effective.pixelRatioScale}
                            min={0.5}
                            max={2.0}
                            step={0.05}
                            onChange={(v) => write({ pixelRatioScale: v })}
                        />
                        <Slider
                            label="max pixel ratio"
                            value={effective.maxPixelRatio}
                            min={1.0}
                            max={3.0}
                            step={0.1}
                            onChange={(v) => write({ maxPixelRatio: v })}
                        />
                    </div>

                    <div className="text-[10px] text-white/30 font-mono flex items-center justify-between">
                        <span>{hasOverride ? 'app override' : 'global default'}</span>
                        <span>F9 toggle</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

function Slider({
    label,
    value,
    min,
    max,
    step,
    onChange,
    disabled,
}: {
    label: string;
    value: number;
    min: number;
    max: number;
    step: number;
    onChange: (v: number) => void;
    disabled?: boolean;
}) {
    const v = clamp(value, min, max);

    return (
        <label className={disabled ? 'opacity-40' : ''}>
            <div className="flex items-center justify-between text-[10px] text-white/50">
                <span>{label}</span>
                <span className="font-mono text-white/40">{v.toFixed(2)}</span>
            </div>
            <input
                type="range"
                className="w-full"
                min={min}
                max={max}
                step={step}
                value={v}
                disabled={disabled}
                onChange={(e) => onChange(toNum(e.target.value, v))}
            />
        </label>
    );
}
