/**
 * AtlasPacker.ts
 * 2D bin packing for UV atlas optimization
 * 
 * Uses MaxRects algorithm with Best Short Side Fit (BSSF) heuristic
 * for efficient packing of UV islands into texture space.
 * 
 * Features:
 * - MaxRects algorithm for tight packing
 * - Rotation support for better space utilization
 * - Aspect ratio preservation
 * - Configurable padding between islands
 * - Automatic normalization to 0-1 UV space
 */

import * as THREE from 'three';
import { invoke } from '@tauri-apps/api/core';
import type { Rect, FreeRect, GpuPackResult, AtlasPackResult } from './UVTypes';

// ============================================================================
// Bin Packer Class
// ============================================================================

/**
 * 2D bin packer using MaxRects algorithm
 * 
 * MaxRects (Maximal Rectangles) maintains a list of free rectangles
 * and uses heuristics to find the best placement for each new rectangle.
 */
export class AtlasPacker {
    private freeRects: FreeRect[] = [];
    private binW: number;
    private binH: number;

    constructor(w: number = 1.0, h: number = 1.0) {
        this.binW = w;
        this.binH = h;
        this.freeRects = [{ x: 0, y: 0, w: w, h: h }];
    }

    /**
     * Pack rectangles into UV space using MaxRects BSSF
     * 
     * @param blocks - Rectangles to pack
     * @param padding - Padding between rectangles
     */
    fit(blocks: Rect[], padding: number = 0.01): void {
        // Reset packer state
        this.freeRects = [{ x: 0, y: 0, w: this.binW, h: this.binH }];

        // Sort by area (largest first) for better packing
        blocks.sort((a, b) => (b.w * b.h) - (a.w * a.h));

        // Calculate total area and estimate bin size
        let totalArea = 0;
        for (const b of blocks) {
            totalArea += (b.w + padding) * (b.h + padding);
        }

        // Estimate bin size with 15% waste overhead
        const estimatedSide = Math.sqrt(totalArea) * 1.15;

        // Scale blocks to fit estimated bin
        const maxBlockDim = Math.max(...blocks.map(b => Math.max(b.w, b.h)));
        const scaleFactor = maxBlockDim > 0 ? (estimatedSide * 0.3) / maxBlockDim : 1;

        // Apply initial scaling and padding
        const scaledBlocks = blocks.map(b => ({
            ...b,
            w: b.w * scaleFactor + padding,
            h: b.h * scaleFactor + padding
        }));

        // Expand bin to fit all blocks
        const neededW = Math.max(this.binW, estimatedSide * 1.2);
        const neededH = Math.max(this.binH, estimatedSide * 1.2);
        this.freeRects = [{ x: 0, y: 0, w: neededW, h: neededH }];

        // Pack each block using BSSF heuristic
        for (const block of scaledBlocks) {
            const result = this.findPositionBSSF(block.w, block.h);

            if (result) {
                block.x = result.x;
                block.y = result.y;
                if (result.rotated) {
                    // Swap dimensions if rotated
                    const tmp = block.w;
                    block.w = block.h;
                    block.h = tmp;
                    block.rotated = true;
                }
                this.placeRect(block);
            } else {
                // Fallback: place outside bounds
                console.warn('[AtlasPacker] Could not fit block, placing at end');
                block.x = this.binW;
                block.y = 0;
            }
        }

        // Copy positions back to original blocks
        for (let i = 0; i < blocks.length; i++) {
            blocks[i].x = scaledBlocks[i].x;
            blocks[i].y = scaledBlocks[i].y;
            blocks[i].w = scaledBlocks[i].w;
            blocks[i].h = scaledBlocks[i].h;
            blocks[i].rotated = scaledBlocks[i].rotated;
        }

        // Normalize to 0-1 UV space
        this.normalizeToUVSpace(blocks, padding);
    }

    /**
     * Best Short Side Fit heuristic
     * 
     * Finds the free rectangle where the short side leftover is smallest.
     * Provides good balance between density and predictability.
     */
    private findPositionBSSF(w: number, h: number): { x: number; y: number; rotated: boolean } | null {
        let bestScore = Infinity;
        let bestRect: FreeRect | null = null;
        let bestRotated = false;

        for (const rect of this.freeRects) {
            // Try without rotation
            if (w <= rect.w && h <= rect.h) {
                const leftoverH = rect.h - h;
                const leftoverW = rect.w - w;
                const shortSide = Math.min(leftoverH, leftoverW);
                if (shortSide < bestScore) {
                    bestScore = shortSide;
                    bestRect = rect;
                    bestRotated = false;
                }
            }

            // Try with 90° rotation
            if (h <= rect.w && w <= rect.h) {
                const leftoverH = rect.h - w;
                const leftoverW = rect.w - h;
                const shortSide = Math.min(leftoverH, leftoverW);
                if (shortSide < bestScore) {
                    bestScore = shortSide;
                    bestRect = rect;
                    bestRotated = true;
                }
            }
        }

        if (bestRect) {
            return { x: bestRect.x, y: bestRect.y, rotated: bestRotated };
        }
        return null;
    }

    /**
     * Place a rectangle and split the free space
     */
    private placeRect(rect: Rect): void {
        const newFreeRects: FreeRect[] = [];

        for (const free of this.freeRects) {
            if (this.intersects(rect, free)) {
                // Split the free rectangle

                // Left of placed rect
                if (rect.x > free.x) {
                    newFreeRects.push({
                        x: free.x,
                        y: free.y,
                        w: rect.x - free.x,
                        h: free.h
                    });
                }

                // Right of placed rect
                if (rect.x + rect.w < free.x + free.w) {
                    newFreeRects.push({
                        x: rect.x + rect.w,
                        y: free.y,
                        w: (free.x + free.w) - (rect.x + rect.w),
                        h: free.h
                    });
                }

                // Below placed rect
                if (rect.y > free.y) {
                    newFreeRects.push({
                        x: free.x,
                        y: free.y,
                        w: free.w,
                        h: rect.y - free.y
                    });
                }

                // Above placed rect
                if (rect.y + rect.h < free.y + free.h) {
                    newFreeRects.push({
                        x: free.x,
                        y: rect.y + rect.h,
                        w: free.w,
                        h: (free.y + free.h) - (rect.y + rect.h)
                    });
                }
            } else {
                // No overlap, keep this free rect
                newFreeRects.push(free);
            }
        }

        // Remove redundant/contained free rects
        this.freeRects = this.pruneRects(newFreeRects);
    }

    /**
     * Check if two rectangles intersect
     */
    private intersects(a: Rect | FreeRect, b: FreeRect): boolean {
        return !(a.x >= b.x + b.w ||
            a.x + a.w <= b.x ||
            a.y >= b.y + b.h ||
            a.y + a.h <= b.y);
    }

    /**
     * Remove free rectangles that are fully contained within others
     */
    private pruneRects(rects: FreeRect[]): FreeRect[] {
        const result: FreeRect[] = [];

        for (let i = 0; i < rects.length; i++) {
            let isContained = false;

            for (let j = 0; j < rects.length; j++) {
                if (i !== j && this.contains(rects[j], rects[i])) {
                    isContained = true;
                    break;
                }
            }

            if (!isContained && rects[i].w > 0.001 && rects[i].h > 0.001) {
                result.push(rects[i]);
            }
        }

        return result;
    }

    /**
     * Check if rect A fully contains rect B
     */
    private contains(a: FreeRect, b: FreeRect): boolean {
        return a.x <= b.x &&
            a.y <= b.y &&
            a.x + a.w >= b.x + b.w &&
            a.y + a.h >= b.y + b.h;
    }

    /**
     * Normalize all blocks to fit within 0-1 UV space
     */
    private normalizeToUVSpace(blocks: Rect[], margin: number): void {
        if (blocks.length === 0) return;

        // Find bounding box of all placed blocks
        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;

        for (const b of blocks) {
            minX = Math.min(minX, b.x);
            minY = Math.min(minY, b.y);
            maxX = Math.max(maxX, b.x + b.w);
            maxY = Math.max(maxY, b.y + b.h);
        }

        const rangeX = maxX - minX;
        const rangeY = maxY - minY;
        const maxRange = Math.max(rangeX, rangeY);

        if (maxRange < 0.0001) return;

        // Scale to fit in 0-1 with margin
        const targetSize = 1.0 - margin * 2;
        const scale = targetSize / maxRange;

        for (const b of blocks) {
            b.x = ((b.x - minX) * scale) + margin;
            b.y = ((b.y - minY) * scale) + margin;
            b.w *= scale;
            b.h *= scale;
        }
    }
}

// ============================================================================
// GPU-Accelerated Packing
// ============================================================================

/**
 * Pack UV islands using GPU compute shaders
 * 
 * Handles large meshes efficiently by offloading to GPU.
 * 
 * @param mesh - Mesh with UVs to pack
 * @param padding - Padding between islands
 * @returns Pack result with timing
 */
export async function packUVsGPU(
    mesh: THREE.Mesh,
    padding: number = 0.01
): Promise<GpuPackResult> {
    const geo = mesh.geometry;
    const uvAttr = geo.attributes.uv;
    const indexAttr = geo.index;

    if (!uvAttr) {
        throw new Error('Mesh has no UVs to pack');
    }

    // Extract UVs
    const uvs: number[] = [];
    for (let i = 0; i < uvAttr.count; i++) {
        uvs.push(uvAttr.getX(i), uvAttr.getY(i));
    }

    // Extract indices
    const indices: number[] = [];
    if (indexAttr) {
        for (let i = 0; i < indexAttr.count; i++) {
            indices.push(indexAttr.getX(i));
        }
    } else {
        // Non-indexed geometry - create sequential indices
        for (let i = 0; i < uvAttr.count; i++) {
            indices.push(i);
        }
    }

    console.log(`[AtlasPacker] GPU packing ${uvAttr.count} vertices`);

    // Call GPU packing
    const result = await invoke<AtlasPackResult>('gpu_atlas_pack', {
        uvs,
        indices,
        padding,
    });

    // Apply packed UVs to geometry
    const packedUvs = new Float32Array(result.uvs);
    geo.setAttribute('uv', new THREE.BufferAttribute(packedUvs, 2));
    geo.attributes.uv.needsUpdate = true;

    console.log(`[AtlasPacker] Packed ${result.island_count} islands in ${result.time_ms.toFixed(2)}ms`);

    return {
        vertCount: uvAttr.count,
        islandCount: result.island_count,
        timeMs: result.time_ms,
    };
}

/**
 * Simple CPU grid packer (fallback)
 * 
 * Arranges UV islands in a grid pattern.
 * Fast but not optimal for space utilization.
 * 
 * @param meshes - Meshes to pack
 * @param selectedIds - IDs of selected meshes
 * @returns Number of meshes packed
 */
export function packUVsGrid(
    meshes: { [uuid: string]: THREE.Mesh },
    selectedIds: string[]
): number {
    const cols = Math.ceil(Math.sqrt(selectedIds.length));
    const cellSize = 1.0 / cols;

    selectedIds.forEach((id, idx) => {
        const mesh = meshes[id];
        if (!mesh) return;

        const col = idx % cols;
        const row = Math.floor(idx / cols);

        const uOff = col * cellSize;
        const vOff = row * cellSize;

        const geo = mesh.geometry;
        const uvs = geo.attributes.uv;

        if (!uvs) return;

        for (let i = 0; i < uvs.count; i++) {
            let u = uvs.getX(i);
            let v = uvs.getY(i);

            u = u * cellSize + uOff;
            v = v * cellSize + vOff;

            uvs.setXY(i, u, v);
        }
        uvs.needsUpdate = true;
    });

    return selectedIds.length;
}

/**
 * Check if GPU packing is available
 */
export function isGpuPackingAvailable(): boolean {
    return typeof window !== 'undefined' && '__TAURI__' in window;
}
