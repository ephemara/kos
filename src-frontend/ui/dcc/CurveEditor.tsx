import React, { useState, useRef, useEffect } from 'react';
import { cn } from '../primitives/cn';

export type CurvePoint = {
    x: number; // 0-1
    y: number; // 0-1
};

export type Curve = {
    points: CurvePoint[];
    interpolation: 'linear' | 'smooth' | 'step';
};

export type CurveEditorProps = {
    curve: Curve;
    onChange: (curve: Curve) => void;
    width: number;
    height: number;
    disabled?: boolean;
    className?: string;
    gridLines?: number;
    showValues?: boolean;
};

/**
 * CurveEditor - Bezier curve editor with control points
 * 
 * Features:
 * - Add control points by clicking
 * - Move control points by dragging
 * - Remove control points (right-click or delete key)
 * - Multiple interpolation modes (linear, smooth, step)
 * - Grid overlay for precision
 * - Value display on hover
 * 
 * Validates: Requirement 9.5
 */
export function CurveEditor({
    curve,
    onChange,
    width,
    height,
    disabled = false,
    className,
    gridLines = 4,
    showValues = true,
}: CurveEditorProps) {
    const [selectedPoint, setSelectedPoint] = useState<number | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [hoverPoint, setHoverPoint] = useState<number | null>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const pointRadius = 6;
    const hitRadius = 10;

    // Convert canvas coordinates to curve coordinates (0-1)
    const canvasToCurve = (x: number, y: number): CurvePoint => ({
        x: Math.max(0, Math.min(1, x / width)),
        y: Math.max(0, Math.min(1, 1 - y / height)),
    });

    // Convert curve coordinates to canvas coordinates
    const curveToCanvas = (point: CurvePoint): { x: number; y: number } => ({
        x: point.x * width,
        y: (1 - point.y) * height,
    });

    // Find point at canvas coordinates
    const findPointAt = (x: number, y: number): number | null => {
        for (let i = 0; i < curve.points.length; i++) {
            const canvasPoint = curveToCanvas(curve.points[i]);
            const distance = Math.sqrt(
                Math.pow(canvasPoint.x - x, 2) + Math.pow(canvasPoint.y - y, 2)
            );
            if (distance <= hitRadius) {
                return i;
            }
        }
        return null;
    };

    // Add point to curve
    const addPoint = (point: CurvePoint) => {
        const newPoints = [...curve.points, point].sort((a, b) => a.x - b.x);
        onChange({ ...curve, points: newPoints });
    };

    // Update point position
    const updatePoint = (index: number, point: CurvePoint) => {
        const newPoints = [...curve.points];
        newPoints[index] = point;
        // Re-sort to maintain x-order
        newPoints.sort((a, b) => a.x - b.x);
        onChange({ ...curve, points: newPoints });
    };

    // Remove point
    const removePoint = (index: number) => {
        if (curve.points.length <= 2) return; // Keep at least 2 points
        const newPoints = curve.points.filter((_, i) => i !== index);
        onChange({ ...curve, points: newPoints });
        setSelectedPoint(null);
    };

    // Handle mouse down
    const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (disabled) return;

        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;

        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const pointIndex = findPointAt(x, y);

        if (pointIndex !== null) {
            // Start dragging existing point
            setSelectedPoint(pointIndex);
            setIsDragging(true);
        } else {
            // Add new point
            const curvePoint = canvasToCurve(x, y);
            addPoint(curvePoint);
        }
    };

    // Handle mouse move
    useEffect(() => {
        if (!isDragging || selectedPoint === null) return;

        const handleMouseMove = (e: MouseEvent) => {
            const rect = canvasRef.current?.getBoundingClientRect();
            if (!rect) return;

            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const curvePoint = canvasToCurve(x, y);

            updatePoint(selectedPoint, curvePoint);
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
    }, [isDragging, selectedPoint]);

    // Handle context menu (right-click to delete)
    const handleContextMenu = (e: React.MouseEvent<HTMLCanvasElement>) => {
        e.preventDefault();
        if (disabled) return;

        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;

        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const pointIndex = findPointAt(x, y);

        if (pointIndex !== null) {
            removePoint(pointIndex);
        }
    };

    // Handle hover
    const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;

        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const pointIndex = findPointAt(x, y);

        setHoverPoint(pointIndex);
    };

    // Draw curve
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Clear canvas
        ctx.clearRect(0, 0, width, height);

        // Draw grid
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;
        for (let i = 0; i <= gridLines; i++) {
            const x = (i / gridLines) * width;
            const y = (i / gridLines) * height;
            
            // Vertical lines
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();

            // Horizontal lines
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }

        // Draw curve
        if (curve.points.length >= 2) {
            ctx.strokeStyle = 'rgba(100, 150, 255, 1)';
            ctx.lineWidth = 2;
            ctx.beginPath();

            const sortedPoints = [...curve.points].sort((a, b) => a.x - b.x);

            for (let i = 0; i < sortedPoints.length; i++) {
                const canvasPoint = curveToCanvas(sortedPoints[i]);
                
                if (i === 0) {
                    ctx.moveTo(canvasPoint.x, canvasPoint.y);
                } else {
                    if (curve.interpolation === 'linear') {
                        ctx.lineTo(canvasPoint.x, canvasPoint.y);
                    } else if (curve.interpolation === 'smooth') {
                        // Simple smooth interpolation using quadratic curves
                        const prevPoint = curveToCanvas(sortedPoints[i - 1]);
                        const midX = (prevPoint.x + canvasPoint.x) / 2;
                        const midY = (prevPoint.y + canvasPoint.y) / 2;
                        ctx.quadraticCurveTo(prevPoint.x, prevPoint.y, midX, midY);
                        if (i === sortedPoints.length - 1) {
                            ctx.lineTo(canvasPoint.x, canvasPoint.y);
                        }
                    } else if (curve.interpolation === 'step') {
                        const prevPoint = curveToCanvas(sortedPoints[i - 1]);
                        ctx.lineTo(canvasPoint.x, prevPoint.y);
                        ctx.lineTo(canvasPoint.x, canvasPoint.y);
                    }
                }
            }

            ctx.stroke();
        }

        // Draw control points
        curve.points.forEach((point, index) => {
            const canvasPoint = curveToCanvas(point);
            
            // Point fill
            ctx.fillStyle = index === selectedPoint 
                ? 'rgba(100, 150, 255, 1)' 
                : index === hoverPoint
                ? 'rgba(150, 180, 255, 1)'
                : 'rgba(255, 255, 255, 0.8)';
            
            ctx.beginPath();
            ctx.arc(canvasPoint.x, canvasPoint.y, pointRadius, 0, Math.PI * 2);
            ctx.fill();

            // Point border
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.lineWidth = 2;
            ctx.stroke();
        });

        // Draw value labels
        if (showValues && hoverPoint !== null) {
            const point = curve.points[hoverPoint];
            const canvasPoint = curveToCanvas(point);
            
            const text = `(${point.x.toFixed(2)}, ${point.y.toFixed(2)})`;
            ctx.font = '11px monospace';
            ctx.fillStyle = 'rgba(255, 255, 255, 1)';
            ctx.fillText(text, canvasPoint.x + 10, canvasPoint.y - 10);
        }
    }, [curve, width, height, selectedPoint, hoverPoint, gridLines, showValues]);

    return (
        <div ref={containerRef} className={cn('relative', className)}>
            <canvas
                ref={canvasRef}
                width={width}
                height={height}
                role="img"
                aria-label="Curve editor canvas"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onContextMenu={handleContextMenu}
                className={cn(
                    'rounded-md',
                    'bg-[color:var(--kos-surface-tertiary)]',
                    'border border-[color:var(--kos-border-primary)]',
                    !disabled && 'cursor-crosshair',
                    disabled && 'opacity-50 cursor-not-allowed'
                )}
            />
        </div>
    );
}
