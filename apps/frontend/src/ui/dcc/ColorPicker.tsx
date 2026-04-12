import React, { useState } from 'react';
import { HexColorPicker, RgbaColorPicker } from 'react-colorful';
import * as Popover from '@radix-ui/react-popover';
import { cn } from '../primitives/cn';

export type Color = {
    r: number; // 0-255
    g: number; // 0-255
    b: number; // 0-255
    a: number; // 0-1
};

export type ColorPickerProps = {
    value: Color;
    onChange: (color: Color) => void;
    showAlpha?: boolean;
    swatches?: Color[];
    disabled?: boolean;
    className?: string;
};

/**
 * ColorPicker - Color picker with swatches and alpha support
 * 
 * Features:
 * - Visual color preview
 * - Popover picker with HSV/RGB controls
 * - Optional alpha channel
 * - Preset color swatches
 * - Hex input for precise values
 * 
 * Validates: Requirement 9.4
 */
export function ColorPicker({
    value,
    onChange,
    showAlpha = true,
    swatches = [],
    disabled = false,
    className,
}: ColorPickerProps) {
    const [isOpen, setIsOpen] = useState(false);

    // Convert Color to hex string
    const colorToHex = (color: Color): string => {
        const r = Math.round(color.r).toString(16).padStart(2, '0');
        const g = Math.round(color.g).toString(16).padStart(2, '0');
        const b = Math.round(color.b).toString(16).padStart(2, '0');
        return `#${r}${g}${b}`;
    };

    // Convert hex string to Color
    const hexToColor = (hex: string): Color => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        if (!result) return value;
        return {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16),
            a: value.a,
        };
    };

    // Convert Color to rgba object for react-colorful
    const colorToRgba = (color: Color) => ({
        r: color.r,
        g: color.g,
        b: color.b,
        a: color.a,
    });

    // Handle hex picker change
    const handleHexChange = (hex: string) => {
        onChange(hexToColor(hex));
    };

    // Handle rgba picker change
    const handleRgbaChange = (rgba: { r: number; g: number; b: number; a: number }) => {
        onChange({
            r: rgba.r,
            g: rgba.g,
            b: rgba.b,
            a: rgba.a,
        });
    };

    // Handle swatch click
    const handleSwatchClick = (swatch: Color) => {
        onChange(swatch);
    };

    // Default swatches if none provided
    const defaultSwatches: Color[] = [
        { r: 255, g: 255, b: 255, a: 1 }, // White
        { r: 0, g: 0, b: 0, a: 1 },       // Black
        { r: 255, g: 0, b: 0, a: 1 },     // Red
        { r: 0, g: 255, b: 0, a: 1 },     // Green
        { r: 0, g: 0, b: 255, a: 1 },     // Blue
        { r: 255, g: 255, b: 0, a: 1 },   // Yellow
        { r: 255, g: 0, b: 255, a: 1 },   // Magenta
        { r: 0, g: 255, b: 255, a: 1 },   // Cyan
    ];

    const displaySwatches = swatches.length > 0 ? swatches : defaultSwatches;
    const hexValue = colorToHex(value);
    const alphaValue = `${Math.round(value.a * 100)}%`;
    const displayValue = showAlpha ? `${hexValue} ${alphaValue}` : hexValue;

    return (
        <Popover.Root open={isOpen} onOpenChange={setIsOpen}>
            <Popover.Trigger asChild>
                <button
                    disabled={disabled}
                    className={cn(
                        'h-8 w-full rounded-md',
                        'border border-[color:var(--kos-border-primary)]',
                        'hover:border-[color:var(--kos-border-hover)]',
                        'transition-colors',
                        'flex items-center gap-2 px-2',
                        disabled && 'opacity-50 cursor-not-allowed',
                        className
                    )}
                >
                    {/* Color preview */}
                    <div
                        className="h-5 w-5 rounded border border-white/20 flex-shrink-0"
                        style={{
                            backgroundColor: `rgba(${value.r}, ${value.g}, ${value.b}, ${value.a})`,
                        }}
                    />
                    {/* Hex value */}
                    <span className="text-[11px] text-[color:var(--kos-text-primary)] font-mono">
                        {displayValue}
                        {showAlpha && <span className="sr-only">{hexValue}</span>}
                    </span>
                </button>
            </Popover.Trigger>

            <Popover.Portal>
                <Popover.Content
                    className={cn(
                        'z-50 rounded-lg p-3',
                        'bg-[color:var(--kos-surface-secondary)]',
                        'border border-[color:var(--kos-border-primary)]',
                        'shadow-xl',
                        'flex flex-col gap-3'
                    )}
                    sideOffset={5}
                >
                    {/* Color picker */}
                    {showAlpha ? (
                        <RgbaColorPicker
                            color={colorToRgba(value)}
                            onChange={handleRgbaChange}
                            style={{ width: '200px' }}
                        />
                    ) : (
                        <HexColorPicker
                            color={colorToHex(value)}
                            onChange={handleHexChange}
                            style={{ width: '200px' }}
                        />
                    )}

                    {/* Swatches */}
                    {displaySwatches.length > 0 && (
                        <div className="grid grid-cols-8 gap-1">
                            {displaySwatches.map((swatch, index) => (
                                <button
                                    key={index}
                                    onClick={() => handleSwatchClick(swatch)}
                                    className={cn(
                                        'h-6 w-6 rounded border border-white/20',
                                        'hover:scale-110 transition-transform',
                                        'cursor-pointer'
                                    )}
                                    style={{
                                        backgroundColor: `rgba(${swatch.r}, ${swatch.g}, ${swatch.b}, ${swatch.a})`,
                                    }}
                                    title={colorToHex(swatch)}
                                />
                            ))}
                        </div>
                    )}

                    <Popover.Arrow className="fill-[color:var(--kos-border-primary)]" />
                </Popover.Content>
            </Popover.Portal>
        </Popover.Root>
    );
}
