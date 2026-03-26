import React, { useState, useRef, useEffect } from 'react';
import { cn } from '../primitives/cn';

export type NumericInputProps = {
    value: number;
    onChange: (value: number) => void;
    min?: number;
    max?: number;
    step?: number;
    precision?: number;
    label?: string;
    labelClassName?: string;
    disabled?: boolean;
    className?: string;
    dragSensitivity?: number; // pixels per unit
};

/**
 * NumericInput - Drag-to-change numeric input with precision control
 * 
 * Features:
 * - Click and drag horizontally to change value
 * - Double-click to type exact value
 * - Automatic clamping to min/max bounds
 * - Configurable precision for display
 * - Keyboard support (arrow keys, enter)
 * 
 * Validates: Requirements 9.1, 9.2
 */
export function NumericInput({
    value,
    onChange,
    min = -Infinity,
    max = Infinity,
    step = 0.1,
    precision = 2,
    label,
    labelClassName,
    disabled = false,
    className,
    dragSensitivity = 2, // 2 pixels = 1 unit by default
}: NumericInputProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [editValue, setEditValue] = useState('');
    const [dragStartX, setDragStartX] = useState(0);
    const [dragStartValue, setDragStartValue] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);

    // Clamp value to valid range (Requirement 9.2)
    const clampValue = (val: number): number => {
        return Math.max(min, Math.min(max, val));
    };

    // Format value for display
    const formatValue = (val: number): string => {
        return val.toFixed(precision);
    };

    // Handle mouse down - start drag
    const handleMouseDown = (e: React.MouseEvent) => {
        if (disabled || isEditing) return;
        
        setIsDragging(true);
        setDragStartX(e.clientX);
        setDragStartValue(value);
        
        // Prevent text selection during drag
        e.preventDefault();
    };

    // Handle mouse move - update value continuously (Requirement 9.1)
    useEffect(() => {
        if (!isDragging) return;

        const handleMouseMove = (e: MouseEvent) => {
            const deltaX = e.clientX - dragStartX;
            const deltaValue = deltaX / dragSensitivity * step;
            const newValue = clampValue(dragStartValue + deltaValue);
            onChange(newValue);
        };

        const handleMouseUp = () => {
            setIsDragging(false);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        // Change cursor to indicate dragging
        document.body.style.cursor = 'ew-resize';

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = '';
        };
    }, [isDragging, dragStartX, dragStartValue, dragSensitivity, step, onChange]);

    // Handle double-click - enter edit mode
    const handleDoubleClick = () => {
        if (disabled) return;
        setIsEditing(true);
        setEditValue(formatValue(value));
        setTimeout(() => inputRef.current?.select(), 0);
    };

    // Handle edit commit
    const handleEditCommit = () => {
        const parsed = parseFloat(editValue);
        if (!isNaN(parsed)) {
            onChange(clampValue(parsed));
        }
        setIsEditing(false);
    };

    // Handle edit cancel
    const handleEditCancel = () => {
        setIsEditing(false);
    };

    // Handle keyboard input
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleEditCommit();
        } else if (e.key === 'Escape') {
            handleEditCancel();
        } else if (!isEditing) {
            // Arrow keys for fine adjustment
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                onChange(clampValue(value + step));
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                onChange(clampValue(value - step));
            }
        }
    };

    return (
        <div className={cn('flex flex-col gap-1', className)}>
            {label && (
                <label
                    className={cn(
                        'text-[11px] text-[color:var(--kos-text-secondary)] font-medium',
                        labelClassName
                    )}
                >
                    {label}
                </label>
            )}
            <div
                className={cn(
                    'relative h-8 px-2 rounded-md',
                    'bg-[color:var(--kos-surface-tertiary)]',
                    'border border-[color:var(--kos-border-primary)]',
                    'flex items-center justify-center',
                    'transition-colors',
                    !disabled && !isEditing && 'hover:border-[color:var(--kos-border-hover)] cursor-ew-resize',
                    disabled && 'opacity-50 cursor-not-allowed',
                    isDragging && 'border-[color:var(--kos-accent-primary)]'
                )}
                onMouseDown={handleMouseDown}
                onDoubleClick={handleDoubleClick}
                onKeyDown={handleKeyDown}
                tabIndex={disabled ? -1 : 0}
            >
                {isEditing ? (
                    <input
                        ref={inputRef}
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={handleEditCommit}
                        onKeyDown={handleKeyDown}
                        disabled={disabled}
                        className={cn(
                            'w-full h-full bg-transparent',
                            'text-[11px] text-[color:var(--kos-text-primary)] text-center',
                            'outline-none font-mono'
                        )}
                    />
                ) : (
                    <span className="text-[11px] text-[color:var(--kos-text-primary)] font-mono select-none">
                        {formatValue(value)}
                    </span>
                )}
            </div>
        </div>
    );
}
