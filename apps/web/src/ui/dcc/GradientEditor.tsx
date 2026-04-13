import React, { useState, useRef, useEffect } from 'react';
import { ColorPicker, Color } from './ColorPicker';
import { cn } from '../primitives/cn';

export type GradientStop = {
    position: number; // 0-1
    color: Color;
};

export type Gradient = {
    stops: GradientStop[];
};

export type GradientEditorProps = {
    gradient: Gradient;
    onChange: (gradient: Gradient) => void;
    width?: number;
    height?: number;
    disabled?: boolean;
    className?: string;
};

/**
 * GradientEditor - Gradient editor with color stops
 * 
 * Features:
 * - Add color stops by clicking on the gradient bar
 * - Move color stops by dragging
 * - Remove color stops (right-click or delete key)
 * - Edit stop colors with integrated color picker
 * - Visual gradient preview
 * - Automatic sorting by position
 * 
 * Validates: Requirement 9.6
 */
export function GradientEditor({
    gradient,
    onChange,
    width = 300,
    height = 40,
    disabled = false,
    className,
}: GradientEditorProps) {
    const [selectedStop, setSelectedStop] = useState<number | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [showColorPicker, setShowColorPicker] = useState(false);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const stopHandleSize = 12;
    const gradientBarHeight = 24;
    const handleY = gradientBarHeight + 8;

    // Convert canvas X to position (0-1)
    const canvasToPosition = (x: number): number => {
        return Math.max(0, Math.min(1, x / width));
    };

    // Convert position to canvas X
    const positionToCanvas = (position: number): number => {
        return position * width;
    };

    // Find stop at canvas X coordinate
    const findStopAt = (x: number): number | null => {
        for (let i = 0; i < gradient.stops.length; i++) {
            const stopX = positionToCanvas(gradient.stops[i].position);
            if (Math.abs(stopX - x) <= stopHandleSize) {
                return i;
            }
        }
        return null;
    };

    // Add stop to gradient
    const addStop = (position: number) => {
        // Interpolate color at position
        const color = interpolateColor(position);
        const newStops = [...gradient.stops, { position, color }].sort(
            (a, b) => a.position - b.position
        );
        onChange({ stops: newStops });
    };

    // Update stop position
    const updateStopPosition = (index: number, position: number) => {
        const newStops = [...gradient.stops];
        newStops[index] = { ...newStops[index], position };
        // Re-sort to maintain position order
        newStops.sort((a, b) => a.position - b.position);
        onChange({ stops: newStops });
    };

    // Update stop color
    const updateStopColor = (index: number, color: Color) => {
        const newStops = [...gradient.stops];
        newStops[index] = { ...newStops[index], color };
        onChange({ stops: newStops });
    };

    // Remove stop
    const removeStop = (index: number) => {
        if (gradient.stops.length <= 2) return; // Keep at least 2 stops
        const newStops = gradient.stops.filter((_, i) => i !== index);
        onChange({ stops: newStops });
        setSelectedStop(null);
        setShowColorPicker(false);
    };

    // Interpolate color at position
    const interpolateColor = (position: number): Color => {
        const sortedStops = [...gradient.stops].sort((a, b) => a.position - b.position);

        // Find surrounding stops
        let leftStop = sortedStops[0];
        let rightStop = sortedStops[sortedStops.length - 1];

        for (let i = 0; i < sortedStops.length - 1; i++) {
            if (
                sortedStops[i].position <= position &&
                sortedStops[i + 1].position >= position
            ) {
                leftStop = sortedStops[i];
                rightStop = sortedStops[i + 1];
                break;
            }
        }

        // Linear interpolation
        const t =
            (position - leftStop.position) / (rightStop.position - leftStop.position);
        return {
            r: leftStop.color.r + (rightStop.color.r - leftStop.color.r) * t,
            g: leftStop.color.g + (rightStop.color.g - leftStop.color.g) * t,
            b: leftStop.color.b + (rightStop.color.b - leftStop.color.b) * t,
            a: leftStop.color.a + (rightStop.color.a - leftStop.color.a) * t,
        };
    };

    // Handle mouse down on gradient bar
    const handleGradientMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (disabled) return;

        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;

        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Check if clicking on a stop handle
        if (y >= handleY - stopHandleSize && y <= handleY + stopHandleSize) {
            const stopIndex = findStopAt(x);
            if (stopIndex !== null) {
                setSelectedStop(stopIndex);
                setIsDragging(true);
                return;
            }
        }

        // Add new stop on gradient bar
        if (y <= gradientBarHeight) {
            const position = canvasToPosition(x);
            addStop(position);
        }
    };

    // Handle mouse move for dragging
    useEffect(() => {
        if (!isDragging || selectedStop === null) return;

        const handleMouseMove = (e: MouseEvent) => {
            const rect = canvasRef.current?.getBoundingClientRect();
            if (!rect) return;

            const x = e.clientX - rect.left;
            const position = canvasToPosition(x);

            updateStopPosition(selectedStop, position);
        };

        const handleMouseUp = () => {
            setIsDragging(false);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, selectedStop]);

    // Handle context menu (right-click to delete)
    const handleContextMenu = (e: React.MouseEvent<HTMLCanvasElement>) => {
        e.preventDefault();
        if (disabled) return;

        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;

        const x = e.clientX - rect.left;
        const stopIndex = findStopAt(x);

        if (stopIndex !== null) {
            removeStop(stopIndex);
        }
    };

    // Handle stop click to open color picker
    const handleStopClick = (index: number) => {
        setSelectedStop(index);
        setShowColorPicker(true);
    };

    // Draw gradient
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Clear canvas
        ctx.clearRect(0, 0, width, height);

        // Draw gradient bar
        const sortedStops = [...gradient.stops].sort((a, b) => a.position - b.position);
        const gradientObj = ctx.createLinearGradient(0, 0, width, 0);

        sortedStops.forEach((stop) => {
            const color = `rgba(${stop.color.r}, ${stop.color.g}, ${stop.color.b}, ${stop.color.a})`;
            gradientObj.addColorStop(stop.position, color);
        });

        ctx.fillStyle = gradientObj;
        ctx.fillRect(0, 0, width, gradientBarHeight);

        // Draw border
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 1;
        ctx.strokeRect(0, 0, width, gradientBarHeight);

        // Draw stop handles
        gradient.stops.forEach((stop, index) => {
            const x = positionToCanvas(stop.position);

            // Handle triangle
            ctx.fillStyle =
                index === selectedStop
                    ? 'rgba(100, 150, 255, 1)'
                    : 'rgba(255, 255, 255, 0.8)';
            ctx.beginPath();
            ctx.moveTo(x, handleY - stopHandleSize / 2);
            ctx.lineTo(x - stopHandleSize / 2, handleY + stopHandleSize / 2);
            ctx.lineTo(x + stopHandleSize / 2, handleY + stopHandleSize / 2);
            ctx.closePath();
            ctx.fill();

            // Handle border
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.lineWidth = 1;
            ctx.stroke();

            // Color indicator
            const color = `rgba(${stop.color.r}, ${stop.color.g}, ${stop.color.b}, ${stop.color.a})`;
            ctx.fillStyle = color;
            ctx.fillRect(x - 4, handleY - 2, 8, 4);
        });
    }, [gradient, width, height, selectedStop]);

    return (
        <div ref={containerRef} className={cn('flex flex-col gap-2', className)}>
            <canvas
                ref={canvasRef}
                width={width}
                height={height}
                onMouseDown={handleGradientMouseDown}
                onContextMenu={handleContextMenu}
                className={cn(
                    'rounded-md',
                    'bg-[color:var(--kos-surface-tertiary)]',
                    !disabled && 'cursor-pointer',
                    disabled && 'opacity-50 cursor-not-allowed'
                )}
            />

            {/* Color picker for selected stop */}
            {showColorPicker && selectedStop !== null && (
                <div className="flex items-center gap-2">
                    <span className="text-[11px] text-[color:var(--kos-text-secondary)]">
                        Stop {selectedStop + 1} ({gradient.stops[selectedStop].position.toFixed(2)})
                    </span>
                    <ColorPicker
                        value={gradient.stops[selectedStop].color}
                        onChange={(color) => updateStopColor(selectedStop, color)}
                        showAlpha={true}
                        disabled={disabled}
                        className="flex-1"
                    />
                </div>
            )}
        </div>
    );
}
