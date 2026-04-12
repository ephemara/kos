/**
 * GraphosPainter - Pure TypeScript stroke engine for KGraphos
 * Uses perfect-freehand for smooth, pressure-sensitive strokes
 * Handles interpolation, jitter, and symmetry without WASM
 */

import { getStroke, StrokeOptions } from 'perfect-freehand';

export interface StrokePoint {
    x: number;
    y: number;
    pressure: number;
}

export interface SplatPoint {
    x: number;
    y: number;
    size: number;
    angle: number;
    pressure: number;
}

export interface BrushParams {
    size: number;
    spacing: number;
    jitterPos: number;
    jitterSize: number;
    jitterAngle: number;
    symmetry: 'NONE' | 'X' | 'Y' | 'RADIAL';
    radialSegments?: number;
}

// Simple seeded random for reproducible jitter
class SeededRandom {
    private seed: number;
    constructor(seed: number = Date.now()) {
        this.seed = seed;
    }
    next(): number {
        this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff;
        return this.seed / 0x7fffffff;
    }
    range(min: number, max: number): number {
        return min + this.next() * (max - min);
    }
}

export class GraphosPainter {
    private points: StrokePoint[] = [];
    private rng: SeededRandom = new SeededRandom();
    private lastSplatDistance: number = 0;

    reset(): void {
        this.points = [];
        this.lastSplatDistance = 0;
        this.rng = new SeededRandom(Date.now());
    }

    addPoint(x: number, y: number, pressure: number): void {
        this.points.push({ x, y, pressure });
    }

    /**
     * Generate splat points for rendering
     * This is the core of the painting system - it takes raw input points
     * and generates evenly-spaced, jittered splat positions
     */
    generateSplats(params: BrushParams): SplatPoint[] {
        if (this.points.length < 2) return [];

        const splats: SplatPoint[] = [];
        const spacing = Math.max(0.001, params.spacing) * params.size;

        // Interpolate between points and generate splats at regular intervals
        for (let i = 1; i < this.points.length; i++) {
            const p0 = this.points[i - 1];
            const p1 = this.points[i];

            const dx = p1.x - p0.x;
            const dy = p1.y - p0.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < 0.0001) continue;

            const steps = Math.max(1, Math.ceil(dist / spacing));

            for (let j = 0; j < steps; j++) {
                const t = j / steps;
                const x = p0.x + dx * t;
                const y = p0.y + dy * t;
                const pressure = p0.pressure + (p1.pressure - p0.pressure) * t;

                // Apply jitter
                const jitterX = params.jitterPos > 0 ? this.rng.range(-params.jitterPos, params.jitterPos) * params.size * 0.01 : 0;
                const jitterY = params.jitterPos > 0 ? this.rng.range(-params.jitterPos, params.jitterPos) * params.size * 0.01 : 0;
                const jitterSz = params.jitterSize > 0 ? this.rng.range(1 - params.jitterSize, 1 + params.jitterSize) : 1;
                const jitterAng = params.jitterAngle > 0 ? this.rng.range(-params.jitterAngle, params.jitterAngle) * Math.PI : 0;

                const baseSplat: SplatPoint = {
                    x: x + jitterX,
                    y: y + jitterY,
                    size: params.size * jitterSz * pressure,
                    angle: Math.atan2(dy, dx) + jitterAng,
                    pressure
                };

                // Add base splat
                splats.push(baseSplat);

                // Add symmetry splats
                if (params.symmetry === 'X' || params.symmetry === 'RADIAL') {
                    splats.push({ ...baseSplat, x: 1.0 - baseSplat.x, angle: Math.PI - baseSplat.angle });
                }
                if (params.symmetry === 'Y' || params.symmetry === 'RADIAL') {
                    splats.push({ ...baseSplat, y: 1.0 - baseSplat.y, angle: -baseSplat.angle });
                }
                if (params.symmetry === 'RADIAL') {
                    splats.push({ ...baseSplat, x: 1.0 - baseSplat.x, y: 1.0 - baseSplat.y, angle: baseSplat.angle + Math.PI });
                }
            }
        }

        // Keep only last point for continuity
        if (this.points.length > 1) {
            this.points = [this.points[this.points.length - 1]];
        }

        return splats;
    }

    /**
     * Generate smooth stroke outline using perfect-freehand
     * Useful for ink/pen tools that need smooth edges
     */
    getStrokeOutline(options?: Partial<StrokeOptions>): number[][] {
        if (this.points.length < 2) return [];

        const inputPoints = this.points.map(p => [p.x, p.y, p.pressure]);

        return getStroke(inputPoints, {
            size: 16,
            thinning: 0.5,
            smoothing: 0.5,
            streamline: 0.5,
            simulatePressure: false,
            ...options
        });
    }

    /**
     * Convert stroke outline to SVG path data
     */
    static outlineToPath(outline: number[][]): string {
        if (outline.length < 2) return '';

        const d = outline.reduce(
            (acc, [x0, y0], i, arr) => {
                const [x1, y1] = arr[(i + 1) % arr.length];
                return `${acc} ${x0},${y0} ${(x0 + x1) / 2},${(y0 + y1) / 2}`;
            },
            `M ${outline[0][0]},${outline[0][1]} Q`
        );

        return `${d} Z`;
    }
}

// Singleton instance for simple usage
export const graphosPainter = new GraphosPainter();
