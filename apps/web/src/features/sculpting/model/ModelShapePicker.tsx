/**
 * ModelShapePicker.tsx - Clean shape picker UI for MODEL mode
 * Uses Radix UI primitives + Tailwind styling
 */

import React from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import * as ToggleGroup from '@radix-ui/react-toggle-group';
import { cn } from '@/ui/primitives/cn';
import { SHAPE_DEFINITIONS, getShapesByCategory, type ShapeId } from './ModelShapes';
import type { ShapeCategory, UserImport } from './ModelTypes';

interface ModelShapePickerProps {
    activeShape: string;
    onShapeChange: (shapeId: string) => void;
    userImports?: UserImport[];
    className?: string;
}

const CATEGORIES: { id: ShapeCategory; label: string }[] = [
    { id: 'primitive', label: 'Primitives' },
    { id: 'architectural', label: 'Architectural' },
    { id: 'organic', label: 'Organic' },
    { id: 'procedural', label: 'Procedural' },
];

export const ModelShapePicker: React.FC<ModelShapePickerProps> = ({
    activeShape,
    onShapeChange,
    userImports = [],
    className,
}) => {
    return (
        <div className={cn('flex flex-col gap-2', className)}>
            <div className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
                Shape Brush
            </div>

            <Tabs.Root defaultValue="primitive" className="flex flex-col gap-2">
                {/* Category Tabs */}
                <Tabs.List className="flex gap-1 p-1 bg-zinc-900/50 rounded-md">
                    {CATEGORIES.map(cat => (
                        <Tabs.Trigger
                            key={cat.id}
                            value={cat.id}
                            className={cn(
                                'flex-1 px-2 py-1 text-xs rounded transition-colors',
                                'text-zinc-500 hover:text-zinc-300',
                                'data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100'
                            )}
                        >
                            {cat.label}
                        </Tabs.Trigger>
                    ))}
                </Tabs.List>

                {/* Shape Grids */}
                {CATEGORIES.map(cat => (
                    <Tabs.Content key={cat.id} value={cat.id}>
                        <ShapeGrid
                            shapes={getShapesByCategory(cat.id)}
                            activeShape={activeShape}
                            onShapeChange={onShapeChange}
                        />
                    </Tabs.Content>
                ))}
            </Tabs.Root>

            {/* User Imports Section */}
            {userImports.length > 0 && (
                <div className="mt-2 pt-2 border-t border-zinc-800">
                    <div className="text-xs font-medium text-zinc-500 mb-2">
                        Imported Models
                    </div>
                    <ShapeGrid
                        shapes={userImports.map(imp => ({
                            id: imp.id,
                            label: imp.name,
                            category: 'primitive' as ShapeCategory,
                        }))}
                        activeShape={activeShape}
                        onShapeChange={onShapeChange}
                    />
                </div>
            )}
        </div>
    );
};

// --- SHAPE GRID COMPONENT ---
interface ShapeGridProps {
    shapes: { id: string; label: string }[];
    activeShape: string;
    onShapeChange: (shapeId: string) => void;
}

const ShapeGrid: React.FC<ShapeGridProps> = ({ shapes, activeShape, onShapeChange }) => {
    return (
        <ToggleGroup.Root
            type="single"
            value={activeShape}
            onValueChange={(value) => value && onShapeChange(value)}
            className="grid grid-cols-3 gap-1"
        >
            {shapes.map(shape => (
                <ToggleGroup.Item
                    key={shape.id}
                    value={shape.id}
                    className={cn(
                        'px-2 py-1.5 text-xs rounded transition-all',
                        'bg-zinc-900/50 hover:bg-zinc-800',
                        'text-zinc-400 hover:text-zinc-200',
                        'border border-transparent',
                        'data-[state=on]:bg-blue-600/20 data-[state=on]:border-blue-500/50',
                        'data-[state=on]:text-blue-300'
                    )}
                >
                    {shape.label}
                </ToggleGroup.Item>
            ))}
        </ToggleGroup.Root>
    );
};

export default ModelShapePicker;
