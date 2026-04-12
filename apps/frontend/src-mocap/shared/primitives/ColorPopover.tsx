import React from 'react';
import { HexColorPicker } from 'react-colorful';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { cn } from './cn';
import { Pipette, Hash } from 'lucide-react';

interface ColorPopoverProps {
    color: string;
    onChange: (color: string) => void;
    label?: string;
    presets?: string[];
    className?: string;
}

const DEFAULT_PRESETS = [
    '#ffffff', '#9ca3af', '#4b5563', '#000000', // Grayscale
    '#ef4444', '#f97316', '#f59e0b', '#eab308', // Warm
    '#84cc16', '#22c55e', '#10b981', '#14b8a6', // Cool Green
    '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1', // Cool Blue
    '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', // Purple/Pink
];

export function ColorPopover({
    color,
    onChange,
    label,
    presets = DEFAULT_PRESETS,
    className
}: ColorPopoverProps) {
    // Ensure hex is valid
    const safeColor = color || '#ffffff';

    return (
        <PopoverPrimitive.Root>
            <PopoverPrimitive.Trigger asChild>
                <div
                    className={cn(
                        "flex items-center gap-2 cursor-pointer group select-none",
                        className
                    )}
                >
                    <div className="w-5 h-5 rounded-md border border-[#333] group-hover:border-white/50 shadow-sm transition-colors overflow-hidden relative">
                        {/* Checkerboard background for alpha perception (if needed later) */}
                        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPjxyZWN0IHdpZHRoPSI0IiBoZWlnaHQ9IjQiIGZpbGw9IiMzMzMiLz48cmVjdCB4PSI0IiB5PSI0IiB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjMzMzIi8+PC9zdmc+')] opacity-20" />
                        <div
                            className="absolute inset-0"
                            style={{ backgroundColor: safeColor }}
                        />
                    </div>
                    {label && <span className="text-[10px] font-bold text-gray-400 group-hover:text-gray-200 transition-colors uppercase tracking-wider">{label}</span>}
                </div>
            </PopoverPrimitive.Trigger>

            <PopoverPrimitive.Portal>
                <PopoverPrimitive.Content
                    align="center"
                    sideOffset={8}
                    className="z-[250] w-[220px] bg-[#0a0a0a] border border-[#222] rounded-xl shadow-2xl p-3 animate-in fade-in zoom-in-95"
                >
                    {/* COLOR WHEEL */}
                    <div className="mb-3">
                        <HexColorPicker color={safeColor} onChange={onChange} style={{ width: '100%', height: '160px' }} />
                    </div>

                    {/* HEX INPUT */}
                    <div className="flex items-center gap-2 bg-[#111] border border-[#222] rounded-lg px-2 py-1.5 mb-3">
                        <Hash size={12} className="text-gray-500" />
                        <input
                            type="text"
                            value={safeColor}
                            onChange={(e) => onChange(e.target.value)}
                            className="flex-1 bg-transparent border-none outline-none text-[11px] font-mono text-gray-200 uppercase"
                        />
                        <Pipette size={12} className="text-gray-500 hover:text-white cursor-pointer" />
                    </div>

                    {/* PRESETS */}
                    <div className="grid grid-cols-8 gap-1.5">
                        {presets.map((c) => (
                            <button
                                key={c}
                                onClick={() => onChange(c)}
                                className="w-4 h-4 rounded-sm border border-transparent hover:border-white/50 hover:scale-110 transition-all ring-0 focus:outline-none"
                                style={{ backgroundColor: c }}
                                title={c}
                            />
                        ))}
                    </div>

                    <PopoverPrimitive.Arrow className="fill-[#0a0a0a] stroke-[#222]" />
                </PopoverPrimitive.Content>
            </PopoverPrimitive.Portal>
        </PopoverPrimitive.Root>
    );
}
