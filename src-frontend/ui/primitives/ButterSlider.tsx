import React from 'react';
import * as SliderPrimitive from '@radix-ui/react-slider';
import { cn } from './cn';

export type ButterSliderProps = {
    label: string;
    value: number;
    onValueChange: (value: number) => void;
    min: number;
    max: number;
    step: number;
    disabled?: boolean;

    toneClassName?: string;
    snapPoints?: number[];
    snapThreshold?: number;

    formatValue?: (value: number) => string;
};

function defaultFormat(v: number) {
    if (!Number.isFinite(v)) return '0';
    const abs = Math.abs(v);
    if (abs >= 100) return v.toFixed(1);
    if (abs >= 10) return v.toFixed(2);
    return v.toFixed(3);
}

function maybeSnap(value: number, snapPoints: number[] | undefined, threshold: number) {
    if (!snapPoints || snapPoints.length === 0) return value;
    let best = value;
    let bestDist = Infinity;
    for (const p of snapPoints) {
        const d = Math.abs(p - value);
        if (d < bestDist) {
            best = p;
            bestDist = d;
        }
    }
    if (bestDist <= threshold) return best;
    return value;
}

export function ButterSlider({
    label,
    value,
    onValueChange,
    min,
    max,
    step,
    disabled,
    toneClassName,
    snapPoints,
    snapThreshold,
    formatValue,
}: ButterSliderProps) {
    const threshold = snapThreshold ?? step * 0.75;
    const fmt = formatValue ?? defaultFormat;

    return (
        <div className={cn('space-y-1', disabled ? 'opacity-50' : '')}>
            <div className="flex justify-between items-center">
                <div className={cn('text-[8px] font-black tracking-[0.24em] text-gray-500 uppercase', toneClassName)}>
                    {label}
                </div>
                <div className={cn('text-[10px] font-black tracking-wide text-gray-300', toneClassName)}>
                    {fmt(value)}
                </div>
            </div>

            <SliderPrimitive.Root
                value={[value]}
                onValueChange={(v) => {
                    const next = v[0];
                    if (typeof next !== 'number') return;
                    onValueChange(maybeSnap(next, snapPoints, threshold));
                }}
                min={min}
                max={max}
                step={step}
                disabled={disabled}
                className="relative flex w-full touch-none select-none items-center"
            >
                <SliderPrimitive.Track
                    className={cn(
                        'relative h-2 w-full grow overflow-hidden rounded-full bg-white/10',
                        'shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]'
                    )}
                >
                    <SliderPrimitive.Range
                        className={cn(
                            'absolute h-full bg-white/25',
                            'shadow-[0_0_20px_rgba(255,255,255,0.06)]'
                        )}
                    />
                </SliderPrimitive.Track>
                <SliderPrimitive.Thumb
                    className={cn(
                        'block h-5 w-5 rounded-full border border-white/15 bg-[#0b0b0b]',
                        'shadow-[0_8px_24px_rgba(0,0,0,0.55)]',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20',
                        'transition-[transform,box-shadow] duration-75'
                    )}
                />
            </SliderPrimitive.Root>
        </div>
    );
}
