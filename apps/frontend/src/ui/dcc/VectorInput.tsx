import React from 'react';
import { NumericInput } from './NumericInput';
import { cn } from '../primitives/cn';

export type VectorInputProps = {
    value: number[];
    onChange: (value: number[]) => void;
    labels?: string[];
    min?: number;
    max?: number;
    step?: number;
    precision?: number;
    disabled?: boolean;
    className?: string;
};

/**
 * VectorInput - Multi-component vector input (Vec2/Vec3/Vec4)
 * 
 * Features:
 * - Separate controls for each component
 * - Automatic component count detection (2, 3, or 4)
 * - Default labels (X, Y, Z, W) or custom labels
 * - Synchronized min/max/step/precision across components
 * - Color-coded labels for visual clarity
 * 
 * Validates: Requirement 9.3
 */
export function VectorInput({
    value,
    onChange,
    labels,
    min,
    max,
    step = 0.1,
    precision = 2,
    disabled = false,
    className,
}: VectorInputProps) {
    const componentCount = value.length;
    
    // Default labels based on component count
    const defaultLabels = ['X', 'Y', 'Z', 'W'].slice(0, componentCount);
    const componentLabels = labels || defaultLabels;

    // Color coding for each component (X=red, Y=green, Z=blue, W=white)
    const labelColors = [
        'text-red-400',
        'text-green-400',
        'text-blue-400',
        'text-white/70',
    ];

    // Handle component change
    const handleComponentChange = (index: number, newValue: number) => {
        const newVector = [...value];
        newVector[index] = newValue;
        onChange(newVector);
    };

    return (
        <div className={cn('flex gap-2', className)}>
            {value.map((component, index) => (
                <div key={index} className="flex-1">
                    <NumericInput
                        value={component}
                        onChange={(newValue) => handleComponentChange(index, newValue)}
                        min={min}
                        max={max}
                        step={step}
                        precision={precision}
                        label={componentLabels[index]}
                        labelClassName={labelColors[index]}
                        disabled={disabled}
                    />
                </div>
            ))}
        </div>
    );
}
