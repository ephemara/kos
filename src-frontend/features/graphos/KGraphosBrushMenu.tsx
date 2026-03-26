import React, { useEffect, useRef, useState } from 'react';
import {
    Brush, Eraser, PenTool, Highlighter, Square,
    Droplet, PaintBucket, Shuffle, Lock, Unlock, Sparkles, X
} from 'lucide-react';

// ─── Config ────────────────────────────────────────────────────────────────

const SYMMETRY_MODES = [
    { id: 'NONE', label: 'OFF' },
    { id: 'X', label: 'X' },
    { id: 'Y', label: 'Y' },
    { id: 'RADIAL', label: 'RAD' },
];

const ICON_MAP: Record<string, any> = {
    PenTool, Brush, Square, Highlighter, Droplet,
    Eraser, Shuffle, PaintBucket, Star: Sparkles,
};

// ─── Color Utils ────────────────────────────────────────────────────────────

function hslToHex(h: number, s: number, l: number): string {
    l /= 100;
    const a = (s * Math.min(l, 1 - l)) / 100;
    const f = (n: number) => {
        const k = (n + h / 30) % 12;
        const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
        return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function KGraphosBrushMenu({
    visible,
    position,
    brush,
    setBrush,
    onSelect,
    brushes,
    ...props
}: any) {
    const [colorState, setColorState] = useState({ h: 0, s: 100, l: 50 });
    const wheelRef = useRef<HTMLDivElement>(null);
    const isDraggingRef = useRef(false);

    useEffect(() => {
        if (visible) isDraggingRef.current = false;
    }, [visible]);

    const handleWheelMove = (e: React.PointerEvent) => {
        if (!wheelRef.current || !isDraggingRef.current) return;
        const rect = wheelRef.current.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = e.clientX - cx;
        const dy = e.clientY - cy;

        let angle = Math.atan2(dy, dx) * (180 / Math.PI);
        if (angle < 0) angle += 360;

        const dist = Math.min(Math.sqrt(dx * dx + dy * dy), rect.width / 2);
        const norm = dist / (rect.width / 2);
        const lit = 100 - norm * 50;

        const hex = hslToHex(angle, 100, lit);
        setColorState({ h: angle, s: 100, l: lit });
        setBrush((prev: any) => ({ ...prev, color: hex }));
    };

    if (!visible) return null;

    const RADIUS = 130;
    const brushList: any[] = brushes || [];

    const handlePreset = (preset: any) => {
        setBrush((prev: any) => ({
            ...prev,
            hardness: preset.hardness,
            flow: preset.flow,
            opacity: preset.opacity,
            erase: preset.id === 'ERASE',
            tool: preset.id,
            jitterPos: preset.id === 'SCATTER' ? 1.0 : 0.0,
            jitterSize: preset.id === 'SCATTER' ? 0.5 : 0.0,
            alphaMap: preset.alphaMap ?? prev.alphaMap,
        }));
        onSelect();
    };

    return (
        <div
            className="fixed z-[100] pointer-events-none"
            style={{
                left: position.x,
                top: position.y,
                transform: 'translate(-50%, -50%)',
            }}
        >
            {/* Backdrop */}
            <div
                className="fixed inset-[-200vw] pointer-events-auto"
                onClick={onSelect}
                onContextMenu={e => { e.preventDefault(); onSelect(); }}
            />

            <div className="relative w-0 h-0 animate-in zoom-in-95 duration-150 ease-out">

                {/* ── Color wheel ─────────────────────────────────────────── */}
                <div
                    ref={wheelRef}
                    className="absolute -translate-x-1/2 -translate-y-1/2 w-52 h-52 rounded-full pointer-events-auto cursor-crosshair"
                    style={{
                        boxShadow: '0 0 0 1px rgba(255,255,255,0.06), 0 20px 60px rgba(0,0,0,0.8)',
                    }}
                    onPointerDown={e => {
                        e.stopPropagation();
                        isDraggingRef.current = true;
                        e.currentTarget.setPointerCapture(e.pointerId);
                        handleWheelMove(e);
                    }}
                    onPointerMove={handleWheelMove}
                    onPointerUp={e => {
                        isDraggingRef.current = false;
                        e.currentTarget.releasePointerCapture(e.pointerId);
                    }}
                >
                    {/* Hue ring */}
                    <div
                        className="absolute inset-0 rounded-full"
                        style={{ background: 'conic-gradient(from 90deg, red, yellow, lime, aqua, blue, magenta, red)' }}
                    />
                    {/* Lightness overlay */}
                    <div
                        className="absolute inset-0 rounded-full"
                        style={{ background: 'radial-gradient(circle, white 0%, transparent 100%)' }}
                    />
                    {/* Dark center ring for contrast */}
                    <div
                        className="absolute inset-0 rounded-full"
                        style={{ background: 'radial-gradient(circle, rgba(0,0,0,0.4) 0%, transparent 50%)' }}
                    />

                    {/* Active color swatch */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div
                            className="w-10 h-10 rounded-full shadow-xl"
                            style={{
                                backgroundColor: brush.color,
                                boxShadow: `0 0 0 2px rgba(255,255,255,0.12), 0 4px 16px rgba(0,0,0,0.6)`,
                            }}
                        />
                    </div>
                </div>

                {/* ── Orbital brush buttons ────────────────────────────────── */}
                {brushList.map((b: any, i: number) => {
                    const angle = (i / brushList.length) * 2 * Math.PI - Math.PI / 2;
                    const bx = Math.cos(angle) * RADIUS;
                    const by = Math.sin(angle) * RADIUS;
                    const isActive = (brush.erase && b.id === 'ERASE') || (!brush.erase && brush.tool === b.id);
                    const Icon = ICON_MAP[b.icon] || Brush;

                    return (
                        <button
                            key={b.id}
                            onClick={e => { e.stopPropagation(); handlePreset(b); }}
                            title={b.label}
                            className="pointer-events-auto absolute transition-all duration-150 hover:scale-110 active:scale-95"
                            style={{ transform: `translate(calc(${bx}px - 50%), calc(${by}px - 50%))` }}
                        >
                            <div className={[
                                'w-10 h-10 rounded-full flex items-center justify-center',
                                'border backdrop-blur-md shadow-lg',
                                isActive
                                    ? 'bg-orange-500/20 border-orange-500/70 text-orange-300 shadow-[0_0_16px_rgba(249,115,22,0.3)]'
                                    : 'bg-black/80 border-white/10 text-gray-500 hover:border-white/25 hover:text-gray-200',
                            ].join(' ')}>
                                <Icon size={16} />
                            </div>
                            <span className={[
                                'absolute top-full mt-1 left-1/2 -translate-x-1/2 text-[8px] font-bold whitespace-nowrap',
                                isActive ? 'text-orange-400' : 'text-gray-600',
                            ].join(' ')}>
                                {b.label}
                            </span>
                        </button>
                    );
                })}

                {/* ── Settings panel ───────────────────────────────────────── */}
                <div
                    className="absolute pointer-events-auto"
                    style={{ left: '200px', top: '50%', transform: 'translateY(-50%)', width: '160px' }}
                >
                    <div className="bg-[#0e0e0e] border border-[#2a2a2a] rounded-xl p-3 flex flex-col gap-3 shadow-2xl">

                        {/* SIZE */}
                        <SliderRow
                            label="SIZE"
                            value={brush.size}
                            min={1} max={300}
                            display={`${brush.size.toFixed(0)}px`}
                            onChange={v => setBrush((b: any) => ({ ...b, size: v }))}
                        />

                        {/* OPACITY */}
                        <SliderRow
                            label="OPACITY"
                            value={brush.opacity}
                            min={0} max={1} step={0.01}
                            display={`${(brush.opacity * 100).toFixed(0)}%`}
                            onChange={v => setBrush((b: any) => ({ ...b, opacity: v }))}
                        />

                        {/* SYMMETRY */}
                        <div className="space-y-1.5">
                            <span className="text-[8px] font-bold text-gray-600 tracking-widest uppercase">Symmetry</span>
                            <div className="grid grid-cols-2 gap-1">
                                {SYMMETRY_MODES.map(m => (
                                    <button
                                        key={m.id}
                                        onClick={() => setBrush((b: any) => ({ ...b, symmetry: m.id }))}
                                        className={[
                                            'py-1.5 px-1 rounded text-[9px] font-bold transition-all',
                                            brush.symmetry === m.id
                                                ? 'bg-orange-500/15 border border-orange-500/40 text-orange-300'
                                                : 'bg-[#161616] border border-[#2a2a2a] text-gray-600 hover:text-gray-300',
                                        ].join(' ')}
                                    >
                                        {m.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="flex items-center justify-between pt-1 border-t border-[#222]">
                            <button
                                onClick={props.onToggleLock}
                                className={`p-1 rounded transition-colors ${props.isLocked ? 'text-orange-400 hover:text-orange-300' : 'text-gray-700 hover:text-gray-400'}`}
                                title={props.isLocked ? 'Unlock menu' : 'Keep menu open'}
                            >
                                {props.isLocked ? <Lock size={10} /> : <Unlock size={10} />}
                            </button>
                            <span className="text-[8px] font-mono text-gray-700">
                                {brush.tool}
                            </span>
                            <button
                                onClick={onSelect}
                                className="p-1 rounded text-gray-700 hover:text-gray-400 transition-colors"
                                title="Close"
                            >
                                <X size={10} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ── Sub-component ────────────────────────────────────────────────────────────

function SliderRow({
    label, value, min, max, step = 1, display, onChange
}: {
    label: string; value: number; min: number; max: number;
    step?: number; display: string; onChange: (v: number) => void;
}) {
    return (
        <div className="space-y-1">
            <div className="flex justify-between text-[8px] font-bold text-gray-600">
                <span>{label}</span>
                <span className="font-mono text-gray-400">{display}</span>
            </div>
            <div className="relative h-1 w-full rounded-full bg-[#1a1a1a] overflow-hidden">
                <div
                    className="h-full bg-orange-500/60 rounded-full"
                    style={{ width: `${((value - min) / (max - min)) * 100}%` }}
                />
                <input
                    type="range" min={min} max={max} step={step} value={value}
                    onChange={e => onChange(parseFloat(e.target.value))}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
            </div>
        </div>
    );
}
