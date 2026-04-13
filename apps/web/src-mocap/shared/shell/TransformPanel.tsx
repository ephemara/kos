import React from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import { Move, RefreshCcw, Maximize } from 'lucide-react';
import { cn } from '@mocap/shared/primitives/cn';
import { Button } from '@mocap/shared/primitives/Button';
import { Slider } from '@mocap/shared/primitives/Slider';

export type GizmoMode = 'translate' | 'rotate' | 'scale';
export type TransformSpace = 'world' | 'local';

export type TransformData = {
    posX: number; posY: number; posZ: number;
    rotX: number; rotY: number; rotZ: number;
    scaleX: number; scaleY: number; scaleZ: number;
};

export type TransformPanelProps = {
    hasSelection: boolean;

    mode: GizmoMode;
    onModeChange: (mode: GizmoMode) => void;

    space: TransformSpace;
    onSpaceChange: (space: TransformSpace) => void;

    snapEnabled: boolean;
    onSnapEnabledChange: (enabled: boolean) => void;

    value: TransformData;
    onChange: (key: keyof TransformData, value: number) => void;

    hint?: React.ReactNode;

    translateMin?: number;
    translateMax?: number;
    translateStep?: number;

    rotateMinDeg?: number;
    rotateMaxDeg?: number;
    rotateStepDeg?: number;

    scaleMin?: number;
    scaleMax?: number;
    scaleStep?: number;
};

function isFiniteNumber(v: unknown): v is number {
    return typeof v === 'number' && Number.isFinite(v);
}

function clamp(v: number, min: number, max: number) {
    return Math.min(max, Math.max(min, v));
}

function formatSmall(v: number) {
    if (!Number.isFinite(v)) return '0';
    const abs = Math.abs(v);
    if (abs >= 100) return v.toFixed(1);
    if (abs >= 10) return v.toFixed(2);
    return v.toFixed(3);
}

function toDeg(rad: number) {
    return (rad * 180) / Math.PI;
}

function toRad(deg: number) {
    return (deg * Math.PI) / 180;
}

function NumField({
    value,
    onCommit,
    className,
}: {
    value: number;
    onCommit: (v: number) => void;
    className?: string;
}) {
    const [text, setText] = React.useState(String(value));

    React.useEffect(() => {
        setText(String(value));
    }, [value]);

    return (
        <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={() => {
                const next = parseFloat(text);
                if (Number.isFinite(next)) onCommit(next);
                else setText(String(value));
            }}
            onKeyDown={(e) => {
                if (e.key === 'Enter') {
                    (e.currentTarget as HTMLInputElement).blur();
                }
                if (e.key === 'Escape') {
                    setText(String(value));
                    (e.currentTarget as HTMLInputElement).blur();
                }
            }}
            inputMode="decimal"
            className={cn(
                'w-[72px] h-8 rounded-md border border-white/10 bg-[#070707] px-2',
                'text-[11px] font-black tracking-wide text-gray-200 outline-none',
                'focus-visible:ring-2 focus-visible:ring-white/15',
                className
            )}
        />
    );
}

function Row({
    label,
    tone,
    slider,
    field,
}: {
    label: string;
    tone: 'x' | 'y' | 'z' | 'rot' | 'scale';
    slider: React.ReactNode;
    field: React.ReactNode;
}) {
    const toneClass =
        tone === 'x'
            ? 'text-red-400'
            : tone === 'y'
                ? 'text-green-400'
                : tone === 'z'
                    ? 'text-blue-400'
                    : tone === 'rot'
                        ? 'text-emerald-400'
                        : 'text-purple-400';

    return (
        <div className="grid grid-cols-[64px_1fr_auto] items-center gap-3">
            <div className={cn('text-[10px] font-black tracking-wider', toneClass)}>{label}</div>
            {slider}
            {field}
        </div>
    );
}

export function TransformPanel({
    hasSelection,
    mode,
    onModeChange,
    space,
    onSpaceChange,
    snapEnabled,
    onSnapEnabledChange,
    value,
    onChange,
    hint,
    translateMin = -100,
    translateMax = 100,
    translateStep = 0.1,
    rotateMinDeg = 0,
    rotateMaxDeg = 360,
    rotateStepDeg = 1,
    scaleMin = 0.001,
    scaleMax = 10,
    scaleStep = 0.01,
}: TransformPanelProps) {
    const setKey = React.useCallback(
        (key: keyof TransformData, next: number) => {
            if (!isFiniteNumber(next)) return;
            onChange(key, next);
        },
        [onChange]
    );

    const setRotDegKey = React.useCallback(
        (key: keyof TransformData, deg: number) => {
            const clamped = clamp(deg, rotateMinDeg, rotateMaxDeg);
            setKey(key, toRad(clamped));
        },
        [rotateMaxDeg, rotateMinDeg, setKey]
    );

    return (
        <div className="rounded-xl border border-white/10 bg-[#0b0b0b] overflow-hidden">
            <div className="p-3 border-b border-white/10 bg-[#070707]">
                <div className="flex items-center justify-between gap-3">
                    <Tabs.Root value={mode} onValueChange={(v) => onModeChange(v as GizmoMode)}>
                        <Tabs.List className="flex items-center gap-1 rounded-lg bg-black/50 border border-white/10 p-1">
                            <Tabs.Trigger value="translate" className={cn(
                                'h-8 px-3 rounded-md text-[10px] font-black tracking-widest text-gray-400',
                                'data-[state=active]:bg-white/10 data-[state=active]:text-white'
                            )}>
                                <span className="flex items-center gap-2"><Move size={14} /> MOVE</span>
                            </Tabs.Trigger>
                            <Tabs.Trigger value="rotate" className={cn(
                                'h-8 px-3 rounded-md text-[10px] font-black tracking-widest text-gray-400',
                                'data-[state=active]:bg-white/10 data-[state=active]:text-white'
                            )}>
                                <span className="flex items-center gap-2"><RefreshCcw size={14} /> ROT</span>
                            </Tabs.Trigger>
                            <Tabs.Trigger value="scale" className={cn(
                                'h-8 px-3 rounded-md text-[10px] font-black tracking-widest text-gray-400',
                                'data-[state=active]:bg-white/10 data-[state=active]:text-white'
                            )}>
                                <span className="flex items-center gap-2"><Maximize size={14} /> SCALE</span>
                            </Tabs.Trigger>
                        </Tabs.List>
                    </Tabs.Root>

                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            className="h-8 px-3 text-[10px] font-black tracking-widest border border-white/10 bg-black/40"
                            onClick={() => onSpaceChange(space === 'world' ? 'local' : 'world')}
                        >
                            {space.toUpperCase()}
                        </Button>
                        <Button
                            variant={snapEnabled ? 'secondary' : 'ghost'}
                            className={cn(
                                'h-8 px-3 text-[10px] font-black tracking-widest border border-white/10',
                                snapEnabled ? 'text-cyan-200 bg-cyan-500/10' : 'bg-black/40'
                            )}
                            onClick={() => onSnapEnabledChange(!snapEnabled)}
                        >
                            SNAP: {snapEnabled ? 'ON' : 'OFF'}
                        </Button>
                    </div>
                </div>
            </div>

            <div className="p-4">
                {!hasSelection ? (
                    <div className="p-6 text-center text-[11px] font-bold text-gray-500 border border-dashed border-white/10 rounded-xl bg-black/20">
                        Select an object to transform.
                    </div>
                ) : (
                    <div className="space-y-4">
                        {hint ? (
                            <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[11px] font-bold text-gray-200">
                                {hint}
                            </div>
                        ) : null}

                        <div className="space-y-3">
                            {mode === 'translate' ? (
                                <>
                                    <Row
                                        label="POS X"
                                        tone="x"
                                        slider={
                                            <Slider
                                                value={value.posX ?? 0}
                                                onValueChange={(v) => setKey('posX', v)}
                                                min={translateMin}
                                                max={translateMax}
                                                step={translateStep}
                                            />
                                        }
                                        field={
                                            <NumField
                                                value={Number.isFinite(value.posX) ? value.posX : 0}
                                                onCommit={(v) => setKey('posX', v)}
                                                className="text-red-200"
                                            />
                                        }
                                    />
                                    <Row
                                        label="POS Y"
                                        tone="y"
                                        slider={
                                            <Slider
                                                value={value.posY ?? 0}
                                                onValueChange={(v) => setKey('posY', v)}
                                                min={translateMin}
                                                max={translateMax}
                                                step={translateStep}
                                            />
                                        }
                                        field={
                                            <NumField
                                                value={Number.isFinite(value.posY) ? value.posY : 0}
                                                onCommit={(v) => setKey('posY', v)}
                                                className="text-green-200"
                                            />
                                        }
                                    />
                                    <Row
                                        label="POS Z"
                                        tone="z"
                                        slider={
                                            <Slider
                                                value={value.posZ ?? 0}
                                                onValueChange={(v) => setKey('posZ', v)}
                                                min={translateMin}
                                                max={translateMax}
                                                step={translateStep}
                                            />
                                        }
                                        field={
                                            <NumField
                                                value={Number.isFinite(value.posZ) ? value.posZ : 0}
                                                onCommit={(v) => setKey('posZ', v)}
                                                className="text-blue-200"
                                            />
                                        }
                                    />
                                </>
                            ) : null}

                            {mode === 'rotate' ? (
                                <>
                                    <Row
                                        label="ROT X"
                                        tone="rot"
                                        slider={
                                            <Slider
                                                value={toDeg(value.rotX ?? 0)}
                                                onValueChange={(deg) => setRotDegKey('rotX', deg)}
                                                min={rotateMinDeg}
                                                max={rotateMaxDeg}
                                                step={rotateStepDeg}
                                            />
                                        }
                                        field={
                                            <NumField
                                                value={parseFloat(formatSmall(toDeg(value.rotX ?? 0)))}
                                                onCommit={(deg) => setRotDegKey('rotX', deg)}
                                                className="text-emerald-200"
                                            />
                                        }
                                    />
                                    <Row
                                        label="ROT Y"
                                        tone="rot"
                                        slider={
                                            <Slider
                                                value={toDeg(value.rotY ?? 0)}
                                                onValueChange={(deg) => setRotDegKey('rotY', deg)}
                                                min={rotateMinDeg}
                                                max={rotateMaxDeg}
                                                step={rotateStepDeg}
                                            />
                                        }
                                        field={
                                            <NumField
                                                value={parseFloat(formatSmall(toDeg(value.rotY ?? 0)))}
                                                onCommit={(deg) => setRotDegKey('rotY', deg)}
                                                className="text-emerald-200"
                                            />
                                        }
                                    />
                                    <Row
                                        label="ROT Z"
                                        tone="rot"
                                        slider={
                                            <Slider
                                                value={toDeg(value.rotZ ?? 0)}
                                                onValueChange={(deg) => setRotDegKey('rotZ', deg)}
                                                min={rotateMinDeg}
                                                max={rotateMaxDeg}
                                                step={rotateStepDeg}
                                            />
                                        }
                                        field={
                                            <NumField
                                                value={parseFloat(formatSmall(toDeg(value.rotZ ?? 0)))}
                                                onCommit={(deg) => setRotDegKey('rotZ', deg)}
                                                className="text-emerald-200"
                                            />
                                        }
                                    />
                                </>
                            ) : null}

                            {mode === 'scale' ? (
                                <>
                                    <Row
                                        label="SCL X"
                                        tone="scale"
                                        slider={
                                            <Slider
                                                value={value.scaleX ?? 1}
                                                onValueChange={(v) => setKey('scaleX', v)}
                                                min={scaleMin}
                                                max={scaleMax}
                                                step={scaleStep}
                                            />
                                        }
                                        field={
                                            <NumField
                                                value={Number.isFinite(value.scaleX) ? value.scaleX : 1}
                                                onCommit={(v) => setKey('scaleX', v)}
                                                className="text-purple-200"
                                            />
                                        }
                                    />
                                    <Row
                                        label="SCL Y"
                                        tone="scale"
                                        slider={
                                            <Slider
                                                value={value.scaleY ?? 1}
                                                onValueChange={(v) => setKey('scaleY', v)}
                                                min={scaleMin}
                                                max={scaleMax}
                                                step={scaleStep}
                                            />
                                        }
                                        field={
                                            <NumField
                                                value={Number.isFinite(value.scaleY) ? value.scaleY : 1}
                                                onCommit={(v) => setKey('scaleY', v)}
                                                className="text-purple-200"
                                            />
                                        }
                                    />
                                    <Row
                                        label="SCL Z"
                                        tone="scale"
                                        slider={
                                            <Slider
                                                value={value.scaleZ ?? 1}
                                                onValueChange={(v) => setKey('scaleZ', v)}
                                                min={scaleMin}
                                                max={scaleMax}
                                                step={scaleStep}
                                            />
                                        }
                                        field={
                                            <NumField
                                                value={Number.isFinite(value.scaleZ) ? value.scaleZ : 1}
                                                onCommit={(v) => setKey('scaleZ', v)}
                                                className="text-purple-200"
                                            />
                                        }
                                    />
                                </>
                            ) : null}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
