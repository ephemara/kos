/**
 * ModelPanel.tsx - Complete left panel content for MODEL mode
 * Combines ShapePicker + Modifiers into one swappable component
 */

import React from 'react';
import { cn } from '@/ui/primitives/cn';
import { ModelShapePicker } from './ModelShapePicker';
import { ModelModifiers } from './ModelModifiers';
import type { ModelModifiers as ModifiersType, UserImport } from './ModelTypes';

interface ModelPanelProps {
    activeShape: string;
    onShapeChange: (shapeId: string) => void;
    modifiers: ModifiersType;
    onModifiersChange: (modifiers: ModifiersType) => void;
    userImports?: UserImport[];
    className?: string;
}

export const ModelPanel: React.FC<ModelPanelProps> = ({
    activeShape,
    onShapeChange,
    modifiers,
    onModifiersChange,
    userImports = [],
    className,
}) => {
    return (
        <div className={cn('flex flex-col gap-4 p-3', className)}>
            {/* Shape Picker */}
            <ModelShapePicker
                activeShape={activeShape}
                onShapeChange={onShapeChange}
                userImports={userImports}
            />

            {/* Divider */}
            <div className="h-px bg-zinc-800" />

            {/* Modifiers */}
            <ModelModifiers
                modifiers={modifiers}
                onModifiersChange={onModifiersChange}
            />
        </div>
    );
};

export default ModelPanel;
