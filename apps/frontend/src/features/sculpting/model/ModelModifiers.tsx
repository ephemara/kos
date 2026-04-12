/**
 * ModelModifiers.tsx - Clean modifier controls UI for MODEL mode
 * Symmetry, Grid Lock, Chaos, Fractal Echo, etc.
 */

import React from 'react';
import * as Switch from '@radix-ui/react-switch';
import * as ToggleGroup from '@radix-ui/react-toggle-group';
import * as Slider from '@radix-ui/react-slider';
import { cn } from '@/ui/primitives/cn';
import type { ModelModifiers as ModifiersType } from './ModelTypes';

interface ModelModifiersProps {
    modifiers: ModifiersType;
    onModifiersChange: (modifiers: ModifiersType) => void;
    className?: string;
}

export const ModelModifiers: React.FC<ModelModifiersProps> = ({
    modifiers,
    onModifiersChange,
    className,
}) => {
    const update = (partial: Partial<ModifiersType>) => {
        onModifiersChange({ ...modifiers, ...partial });
    };

    return (
        <div className={cn('flex flex-col gap-3', className)}>
            <div className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
                Modifiers
            </div>

            {/* Symmetry */}
            <div className="flex flex-col gap-1.5">
                <label className="text-xs text-zinc-500">Symmetry</label>
                <ToggleGroup.Root
                    type="single"
                    value={modifiers.symmetry}
                    onValueChange={(value) => value && update({ symmetry: value as any })}
                    className="flex gap-1"
                >
                    {(['none', 'x', 'z', 'radial'] as const).map(sym => (
                        <ToggleGroup.Item
                            key={sym}
                            value={sym}
                            className={cn(
                                'flex-1 px-2 py-1 text-xs rounded transition-colors',
                                'bg-zinc-900/50 hover:bg-zinc-800',
                                'text-zinc-500 hover:text-zinc-300',
                                'data-[state=on]:bg-blue-600/20 data-[state=on]:text-blue-300'
                            )}
                        >
                            {sym === 'none' ? 'Off' : sym.toUpperCase()}
                        </ToggleGroup.Item>
                    ))}
                </ToggleGroup.Root>
            </div>

            {/* Radial Count (only when radial symmetry) */}
            {modifiers.symmetry === 'radial' && (
                <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between">
                        <label className="text-xs text-zinc-500">Radial Count</label>
                        <span className="text-xs text-zinc-400">{modifiers.radialCount}</span>
                    </div>
                    <Slider.Root
                        value={[modifiers.radialCount]}
                        onValueChange={([v]) => update({ radialCount: v })}
                        min={3}
                        max={16}
                        step={1}
                        className="relative flex items-center h-4 w-full"
                    >
                        <Slider.Track className="relative h-1 w-full rounded-full bg-zinc-800">
                            <Slider.Range className="absolute h-full rounded-full bg-blue-500" />
                        </Slider.Track>
                        <Slider.Thumb className="block w-3 h-3 rounded-full bg-white shadow-md focus:outline-none" />
                    </Slider.Root>
                </div>
            )}

            {/* Grid Lock */}
            <div className="flex items-center justify-between">
                <label className="text-xs text-zinc-500">Grid Lock</label>
                <Switch.Root
                    checked={modifiers.gridLock}
                    onCheckedChange={(checked) => update({ gridLock: checked })}
                    className={cn(
                        'w-8 h-4 rounded-full transition-colors',
                        modifiers.gridLock ? 'bg-blue-500' : 'bg-zinc-700'
                    )}
                >
                    <Switch.Thumb
                        className={cn(
                            'block w-3 h-3 rounded-full bg-white transition-transform',
                            modifiers.gridLock ? 'translate-x-4' : 'translate-x-0.5'
                        )}
                    />
                </Switch.Root>
            </div>

            {/* Grid Size (only when grid lock enabled) */}
            {modifiers.gridLock && (
                <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between">
                        <label className="text-xs text-zinc-500">Grid Size</label>
                        <span className="text-xs text-zinc-400">{modifiers.gridSize.toFixed(2)}</span>
                    </div>
                    <Slider.Root
                        value={[modifiers.gridSize]}
                        onValueChange={([v]) => update({ gridSize: v })}
                        min={0.1}
                        max={2}
                        step={0.1}
                        className="relative flex items-center h-4 w-full"
                    >
                        <Slider.Track className="relative h-1 w-full rounded-full bg-zinc-800">
                            <Slider.Range className="absolute h-full rounded-full bg-blue-500" />
                        </Slider.Track>
                        <Slider.Thumb className="block w-3 h-3 rounded-full bg-white shadow-md focus:outline-none" />
                    </Slider.Root>
                </div>
            )}

            {/* Chaos Mode */}
            <div className="flex items-center justify-between">
                <label className="text-xs text-zinc-500">Chaos Mode</label>
                <Switch.Root
                    checked={modifiers.chaosMode}
                    onCheckedChange={(checked) => update({ chaosMode: checked })}
                    className={cn(
                        'w-8 h-4 rounded-full transition-colors',
                        modifiers.chaosMode ? 'bg-orange-500' : 'bg-zinc-700'
                    )}
                >
                    <Switch.Thumb
                        className={cn(
                            'block w-3 h-3 rounded-full bg-white transition-transform',
                            modifiers.chaosMode ? 'translate-x-4' : 'translate-x-0.5'
                        )}
                    />
                </Switch.Root>
            </div>

            {/* Fractal Echo */}
            <div className="flex items-center justify-between">
                <label className="text-xs text-zinc-500">Fractal Echo</label>
                <Switch.Root
                    checked={modifiers.fractalEcho}
                    onCheckedChange={(checked) => update({ fractalEcho: checked })}
                    className={cn(
                        'w-8 h-4 rounded-full transition-colors',
                        modifiers.fractalEcho ? 'bg-purple-500' : 'bg-zinc-700'
                    )}
                >
                    <Switch.Thumb
                        className={cn(
                            'block w-3 h-3 rounded-full bg-white transition-transform',
                            modifiers.fractalEcho ? 'translate-x-4' : 'translate-x-0.5'
                        )}
                    />
                </Switch.Root>
            </div>

            {/* Void Anchor */}
            <div className="flex items-center justify-between">
                <label className="text-xs text-zinc-500">Void Anchor (Y-Up)</label>
                <Switch.Root
                    checked={modifiers.voidAnchor}
                    onCheckedChange={(checked) => update({ voidAnchor: checked })}
                    className={cn(
                        'w-8 h-4 rounded-full transition-colors',
                        modifiers.voidAnchor ? 'bg-cyan-500' : 'bg-zinc-700'
                    )}
                >
                    <Switch.Thumb
                        className={cn(
                            'block w-3 h-3 rounded-full bg-white transition-transform',
                            modifiers.voidAnchor ? 'translate-x-4' : 'translate-x-0.5'
                        )}
                    />
                </Switch.Root>
            </div>
        </div>
    );
};

export default ModelModifiers;
