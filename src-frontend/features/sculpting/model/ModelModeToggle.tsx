/**
 * ModelModeToggle.tsx - Top bar toggle for SCULPT/MODEL mode
 * Drop-in component for KSculpt's TopBar
 */

import React from 'react';
import * as ToggleGroup from '@radix-ui/react-toggle-group';
import { cn } from '@/ui/primitives/cn';

export type AppMode = 'SCULPT' | 'MODEL';

interface ModelModeToggleProps {
    mode: AppMode;
    onModeChange: (mode: AppMode) => void;
    className?: string;
}

export const ModelModeToggle: React.FC<ModelModeToggleProps> = ({
    mode,
    onModeChange,
    className,
}) => {
    return (
        <ToggleGroup.Root
            type="single"
            value={mode}
            onValueChange={(value) => value && onModeChange(value as AppMode)}
            className={cn('flex gap-0.5 p-0.5 bg-zinc-900 rounded-md', className)}
        >
            <ToggleGroup.Item
                value="SCULPT"
                className={cn(
                    'px-3 py-1 text-xs font-medium rounded transition-all',
                    'text-zinc-500 hover:text-zinc-300',
                    'data-[state=on]:bg-blue-600 data-[state=on]:text-white'
                )}
            >
                SCULPT
            </ToggleGroup.Item>
            <ToggleGroup.Item
                value="MODEL"
                className={cn(
                    'px-3 py-1 text-xs font-medium rounded transition-all',
                    'text-zinc-500 hover:text-zinc-300',
                    'data-[state=on]:bg-emerald-600 data-[state=on]:text-white'
                )}
            >
                MODEL
            </ToggleGroup.Item>
        </ToggleGroup.Root>
    );
};

export default ModelModeToggle;
