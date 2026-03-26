/**
 * UVEditor.ts
 * Core UV editing functionality with brush-based manipulation
 * 
 * Provides tools for interactive UV editing:
 * - Grab brush: Move UVs interactively
 * - Relax brush: Smooth UV distortion using Laplacian smoothing
 * - Selection tools: Pick and manipulate UV islands
 * 
 * Designed to work with 2D orthographic view of UV space.
 */

import * as THREE from 'three';
import type { UVBrushType, UVBrushParams } from './UVTypes';

// ============================================================================
// UV Brush Engine
// ============================================================================

/**
 * UV brush for interactive editing
 * 
 * Supports multiple brush types with falloff and intensity control.
 */
export class UVBrush {
    private raycaster = new THREE.Raycaster();
    private mouse = new THREE.Vector2();

    // Drag state for Grab brush
    private isDragging = false;
    private dragStartUV = new THREE.Vector2();
    private dragCurrentUV = new THREE.Vector2();
    private grabWeights: Map<number, number> = new Map();

    constructor() { }

    /**
     * Apply brush operation to UVs
     * 
     * @param meshes - Map of meshes by UUID
     * @param selectedIds - IDs of selected meshes
     * @param camera - Orthographic camera for UV view
     * @param pointer - Pointer position in NDC (-1 to +1)
     * @param params - Brush parameters
     * @param isDown - Whether pointer is pressed
     * @param rect - Viewport rectangle for coordinate mapping
     */
    applyBrush(
        meshes: { [uuid: string]: THREE.Mesh },
        selectedIds: string[],
        camera: THREE.Camera,
        pointer: THREE.Vector2,
        params: UVBrushParams,
        isDown: boolean,
        rect: DOMRect
    ): void {
        // Convert pointer NDC to UV world coordinates
        if (!(camera instanceof THREE.OrthographicCamera)) return;

        const x = pointer.x * (camera.right - camera.left) / 2 + (camera.right + camera.left) / 2;
        const y = pointer.y * (camera.top - camera.bottom) / 2 + (camera.top + camera.bottom) / 2;
        const cursorUV = new THREE.Vector2(x, y);

        // Handle drag state
        if (isDown && !this.isDragging) {
            this.isDragging = true;
            this.dragStartUV.copy(cursorUV);
            this.dragCurrentUV.copy(cursorUV);

            if (params.type === 'GRAB') {
                this.calculateGrabWeights(meshes, selectedIds, cursorUV, params.radius);
            }
        } else if (!isDown) {
            this.isDragging = false;
            this.grabWeights.clear();
            return;
        }

        this.dragCurrentUV.copy(cursorUV);

        // Apply brush based on type
        const rSq = params.radius * params.radius;

        selectedIds.forEach(id => {
            const mesh = meshes[id];
            if (!mesh) return;

            const uvAttr = mesh.geometry.attributes.uv;
            if (!uvAttr) return;

            let needsUpdate = false;

            if (params.type === 'GRAB' && this.isDragging) {
                needsUpdate = this.applyGrabBrush(uvAttr, cursorUV, params, rSq);
            } else if (params.type === 'RELAX') {
                needsUpdate = this.applyRelaxBrush(mesh, uvAttr, cursorUV, params, rSq);
            }

            if (needsUpdate) {
                uvAttr.needsUpdate = true;
            }
        });
    }

    /**
     * Apply grab brush (move UVs)
     */
    private applyGrabBrush(
        uvAttr: THREE.BufferAttribute | THREE.InterleavedBufferAttribute,
        cursorUV: THREE.Vector2,
        params: UVBrushParams,
        rSq: number
    ): boolean {
        const moveVec = new THREE.Vector2()
            .subVectors(this.dragCurrentUV, this.dragStartUV)
            .multiplyScalar(params.intensity);

        // Reset start for incremental movement
        this.dragStartUV.copy(this.dragCurrentUV);

        let needsUpdate = false;
        const count = uvAttr.count;

        for (let i = 0; i < count; i++) {
            const u = uvAttr.getX(i);
            const v = uvAttr.getY(i);
            const dx = u - cursorUV.x;
            const dy = v - cursorUV.y;
            const distSq = dx * dx + dy * dy;

            if (distSq < rSq) {
                const dist = Math.sqrt(distSq);
                const falloff = this.smoothStep(dist, params.radius);

                uvAttr.setXY(
                    i,
                    u + moveVec.x * falloff,
                    v + moveVec.y * falloff
                );
                needsUpdate = true;
            }
        }

        return needsUpdate;
    }

    /**
     * Apply relax brush (Laplacian smoothing)
     */
    private applyRelaxBrush(
        mesh: THREE.Mesh,
        uvAttr: THREE.BufferAttribute | THREE.InterleavedBufferAttribute,
        cursorUV: THREE.Vector2,
        params: UVBrushParams,
        rSq: number
    ): boolean {
        const index = mesh.geometry.index;
        if (!index) return false;

        const count = uvAttr.count;
        const newPos = new Float32Array(count * 2);
        const counts = new Int32Array(count);

        // Initialize with current positions
        for (let i = 0; i < count; i++) {
            newPos[i * 2] = uvAttr.getX(i);
            newPos[i * 2 + 1] = uvAttr.getY(i);
        }

        // Accumulate neighbor averages
        const triCount = index.count / 3;
        for (let t = 0; t < triCount; t++) {
            const a = index.getX(t * 3);
            const b = index.getX(t * 3 + 1);
            const c = index.getX(t * 3 + 2);

            // Check if triangle is in brush radius
            const uA = uvAttr.getX(a), vA = uvAttr.getY(a);
            const uB = uvAttr.getX(b), vB = uvAttr.getY(b);
            const uC = uvAttr.getX(c), vC = uvAttr.getY(c);

            const cX = (uA + uB + uC) / 3;
            const cY = (vA + vB + vC) / 3;

            const dx = cX - cursorUV.x;
            const dy = cY - cursorUV.y;

            if (dx * dx + dy * dy < rSq) {
                // Accumulate neighbors
                newPos[a * 2] += uB + uC;
                newPos[a * 2 + 1] += vB + vC;
                counts[a] += 2;

                newPos[b * 2] += uA + uC;
                newPos[b * 2 + 1] += vA + vC;
                counts[b] += 2;

                newPos[c * 2] += uA + uB;
                newPos[c * 2 + 1] += vA + vB;
                counts[c] += 2;
            }
        }

        // Apply smoothing with falloff
        let needsUpdate = false;
        for (let i = 0; i < count; i++) {
            if (counts[i] > 0) {
                const targetX = newPos[i * 2] / counts[i];
                const targetY = newPos[i * 2 + 1] / counts[i];

                const u = uvAttr.getX(i);
                const v = uvAttr.getY(i);
                const dx = u - cursorUV.x;
                const dy = v - cursorUV.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < params.radius) {
                    const falloff = this.smoothStep(dist, params.radius) * params.intensity * 0.5;

                    uvAttr.setXY(
                        i,
                        u + (targetX - u) * falloff,
                        v + (targetY - v) * falloff
                    );
                    needsUpdate = true;
                }
            }
        }

        return needsUpdate;
    }

    /**
     * Calculate grab weights (for future use)
     */
    private calculateGrabWeights(
        meshes: any,
        ids: string[],
        center: THREE.Vector2,
        radius: number
    ): void {
        // Reserved for advanced grab implementation
        // Current implementation uses incremental movement
    }

    /**
     * Smooth step falloff function
     */
    private smoothStep(dist: number, radius: number): number {
        if (dist >= radius) return 0;
        const x = dist / radius;
        return 1 - (x * x * (3 - 2 * x));
    }
}

// ============================================================================
// UV Selection Tools
// ============================================================================

/**
 * UV selection manager
 * 
 * Handles face/vertex selection in UV space.
 */
export class UVSelection {
    private selectedFaces: Set<number> = new Set();
    private selectedVertices: Set<number> = new Set();

    /**
     * Select face at UV coordinates
     */
    selectFaceAt(
        mesh: THREE.Mesh,
        uvCoord: THREE.Vector2,
        threshold: number = 0.01
    ): number | null {
        const geo = mesh.geometry;
        const uvAttr = geo.attributes.uv;
        const index = geo.index;

        if (!uvAttr || !index) return null;

        const thresholdSq = threshold * threshold;
        let closestFace = -1;
        let minDist = Infinity;

        const triCount = index.count / 3;
        for (let i = 0; i < triCount; i++) {
            const a = index.getX(i * 3);
            const b = index.getX(i * 3 + 1);
            const c = index.getX(i * 3 + 2);

            const u1 = uvAttr.getX(a), v1 = uvAttr.getY(a);
            const u2 = uvAttr.getX(b), v2 = uvAttr.getY(b);
            const u3 = uvAttr.getX(c), v3 = uvAttr.getY(c);

            // Calculate centroid
            const cx = (u1 + u2 + u3) / 3;
            const cy = (v1 + v2 + v3) / 3;

            const dx = cx - uvCoord.x;
            const dy = cy - uvCoord.y;
            const distSq = dx * dx + dy * dy;

            if (distSq < minDist && distSq < thresholdSq) {
                minDist = distSq;
                closestFace = i;
            }
        }

        if (closestFace !== -1) {
            this.selectedFaces.add(closestFace);
            return closestFace;
        }

        return null;
    }

    /**
     * Clear selection
     */
    clearSelection(): void {
        this.selectedFaces.clear();
        this.selectedVertices.clear();
    }

    /**
     * Get selected faces
     */
    getSelectedFaces(): number[] {
        return Array.from(this.selectedFaces);
    }

    /**
     * Toggle face selection
     */
    toggleFace(faceIndex: number): void {
        if (this.selectedFaces.has(faceIndex)) {
            this.selectedFaces.delete(faceIndex);
        } else {
            this.selectedFaces.add(faceIndex);
        }
    }
}

// ============================================================================
// UV Utilities
// ============================================================================

/**
 * Calculate UV bounds for a mesh
 */
export function calculateUVBounds(mesh: THREE.Mesh): {
    minU: number;
    maxU: number;
    minV: number;
    maxV: number;
} {
    const uvAttr = mesh.geometry.attributes.uv;
    if (!uvAttr) {
        return { minU: 0, maxU: 1, minV: 0, maxV: 1 };
    }

    let minU = Infinity, maxU = -Infinity;
    let minV = Infinity, maxV = -Infinity;

    for (let i = 0; i < uvAttr.count; i++) {
        const u = uvAttr.getX(i);
        const v = uvAttr.getY(i);
        minU = Math.min(minU, u);
        maxU = Math.max(maxU, u);
        minV = Math.min(minV, v);
        maxV = Math.max(maxV, v);
    }

    return { minU, maxU, minV, maxV };
}

/**
 * Calculate UV bounds for multiple meshes
 */
export function calculateMultiMeshUVBounds(
    meshes: { [uuid: string]: THREE.Mesh },
    selectedIds: string[]
): {
    minU: number;
    maxU: number;
    minV: number;
    maxV: number;
} {
    let minU = Infinity, maxU = -Infinity;
    let minV = Infinity, maxV = -Infinity;

    selectedIds.forEach(id => {
        const mesh = meshes[id];
        if (!mesh) return;

        const bounds = calculateUVBounds(mesh);
        minU = Math.min(minU, bounds.minU);
        maxU = Math.max(maxU, bounds.maxU);
        minV = Math.min(minV, bounds.minV);
        maxV = Math.max(maxV, bounds.maxV);
    });

    // Add 10% padding
    const paddingU = (maxU - minU) * 0.1;
    const paddingV = (maxV - minV) * 0.1;

    return {
        minU: minU - paddingU,
        maxU: maxU + paddingU,
        minV: minV - paddingV,
        maxV: maxV + paddingV
    };
}

/**
 * Create UV grid texture for visualization
 */
export function createUVGridTexture(resolution: number = 1024): THREE.Texture {
    const canvas = document.createElement('canvas');
    canvas.width = resolution;
    canvas.height = resolution;
    const ctx = canvas.getContext('2d');
    if (!ctx) return new THREE.Texture();

    // Base dark background
    ctx.fillStyle = '#111111';
    ctx.fillRect(0, 0, resolution, resolution);

    const tiles = 8;
    const size = resolution / tiles;

    // Draw checkerboard
    for (let y = 0; y < tiles; y++) {
        for (let x = 0; x < tiles; x++) {
            const isDark = (x + y) % 2 === 0;
            ctx.fillStyle = isDark ? '#1a1a1a' : '#252525';
            ctx.fillRect(x * size, y * size, size, size);

            // Grid lines
            ctx.strokeStyle = '#333333';
            ctx.lineWidth = 2;
            ctx.strokeRect(x * size, y * size, size, size);

            // Coordinates
            ctx.fillStyle = isDark ? '#00b894' : '#ffffff';
            ctx.font = 'bold 24px monospace';
            ctx.fillText(`${x},${y}`, x * size + 20, y * size + 40);

            // Axis indicators
            ctx.strokeStyle = isDark ? '#00b894' : '#ffffff';
            ctx.beginPath();
            ctx.moveTo(x * size + 20, y * size + 80);
            ctx.lineTo(x * size + 80, y * size + 80);
            ctx.moveTo(x * size + 20, y * size + 80);
            ctx.lineTo(x * size + 20, y * size + 20);
            ctx.stroke();
        }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = 4;
    return tex;
}
