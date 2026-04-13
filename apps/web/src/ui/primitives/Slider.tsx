import React from 'react';
import * as SliderPrimitive from '@radix-ui/react-slider';
import { cn } from './cn';

export type SliderProps = {
    value: number;
    onValueChange: (value: number) => void;
    min?: number;
    max?: number;
    step?: number;
    disabled?: boolean;
    className?: string;
    trackClassName?: string;
    rangeClassName?: string;
    thumbClassName?: string;
};

export function Slider({
    value,
    onValueChange,
    min = 0,
    max = 100,
    step = 1,
    disabled,
    className,
    trackClassName,
    rangeClassName,
    thumbClassName,
}: SliderProps) {
    return (
        <SliderPrimitive.Root
            value={[value]}
            onValueChange={(v) => onValueChange(v[0] ?? value)}
            min={min}
            max={max}
            step={step}
            disabled={disabled}
            className={cn('relative flex w-full touch-none select-none items-center', className)}
        >
            <SliderPrimitive.Track
                className={cn(
                    'relative h-1 w-full grow overflow-hidden rounded-full bg-white/10',
                    disabled ? 'opacity-50' : '',
                    trackClassName
                )}
            >
                <SliderPrimitive.Range className={cn('absolute h-full bg-white/30', rangeClassName)} />
            </SliderPrimitive.Track>
            <SliderPrimitive.Thumb
                className={cn(
                    'block h-3.5 w-3.5 rounded-full border border-white/25 bg-[#0b0b0b] shadow',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20',
                    thumbClassName
                )}
            />
        </SliderPrimitive.Root>
    );
}
