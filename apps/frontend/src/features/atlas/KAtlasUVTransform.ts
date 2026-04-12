/**
 * KAtlasUVTransform - UV Island Transform Tools
 * 
 * Provides interactive move, rotate, and scale tools for UV islands
 */

import * as THREE from 'three';
import { KAtlasUVIslands, UVIsland } from './KAtlasUVIslands';

export type UVTransformMode = 'SELECT' | 'MOVE' | 'ROTATE' | 'SCALE' | 'BRUSH';

export interface TransformState {
    mode: UVTransformMode;
    selectedIslands: Array<{ meshId: string; islandIndex: number }>;
    isTransforming: boolean;
    transformStart: THREE.Vector2;
    transformCurrent: THREE.Vector2;
    rotationAngle: number; // Accumulated rotation in degrees
    scaleFactorX: number;
    scaleFactorY: number;
    snapRotation: boolean; // Snap to 15-degree increments
    uniformScale: boolean; // Lock aspect ratio for scaling
}

export class KAtlasUVTransform {
    private state: TransformState;
    private islandCache: Map<string, UVIsland[]>;
    private originalUVs: Map<string, Float32Array>; // Store original UVs for transform preview

    constructor() {
        this.state = {
            mode: 'SELECT',
            selectedIslands: [],
            isTransforming: false,
            transformStart: new THREE.Vector2(),
            transformCurrent: new THREE.Vector2(),
            rotationAngle: 0,
            scaleFactorX: 1,
            scaleFactorY: 1,
            snapRotation: true,
            uniformScale: true
        };
        this.islandCache = new Map();
        this.originalUVs = new Map();
    }

    /**
     * Set transform mode
     */
    setMode(mode: UVTransformMode) {
        this.state.mode = mode;
        this.state.selectedIslands = [];
        this.clearTransform();
    }

    /**
     * Get current mode
     */
    getMode(): UVTransformMode {
        return this.state.mode;
    }

    /**
     * Get selected islands
     */
    getSelectedIslands(): Array<{ meshId: string; islandIndex: number }> {
        return this.state.selectedIslands;
    }

    /**
     * Toggle rotation snap
     */
    toggleRotationSnap() {
        this.state.snapRotation = !this.state.snapRotation;
    }

    /**
     * Toggle uniform scale
     */
    toggleUniformScale() {
        this.state.uniformScale = !this.state.uniformScale;
    }

    /**
     * Update island cache for meshes
     */
    updateIslandCache(meshes: { [uuid: string]: THREE.Mesh }, selectedIds: string[]) {
        this.islandCache = KAtlasUVIslands.getAllIslands(meshes, selectedIds);
    }

    /**
     * Handle pointer down for island selection or transform start
     */
    handlePointerDown(
        meshes: { [uuid: string]: THREE.Mesh },
        selectedIds: string[],
        uvPosition: THREE.Vector2,
        multiSelect: boolean
    ): boolean {
        if (this.state.mode === 'SELECT') {
            return this.selectIslandAtPosition(meshes, selectedIds, uvPosition, multiSelect);
        } else if (this.state.mode === 'MOVE' || this.state.mode === 'ROTATE' || this.state.mode === 'SCALE') {
            this.startTransform(meshes, uvPosition);
            return true;
        }
        return false;
    }

    /**
     * Handle pointer move for transform
     */
    handlePointerMove(
        meshes: { [uuid: string]: THREE.Mesh },
        uvPosition: THREE.Vector2
    ): boolean {
        if (!this.state.isTransforming) return false;

        this.state.transformCurrent.copy(uvPosition);

        if (this.state.mode === 'MOVE') {
            this.updateMove(meshes);
        } else if (this.state.mode === 'ROTATE') {
            this.updateRotate(meshes);
        } else if (this.state.mode === 'SCALE') {
            this.updateScale(meshes);
        }

        return true;
    }

    /**
     * Handle pointer up to finalize transform
     */
    handlePointerUp(): boolean {
        if (this.state.isTransforming) {
            this.finalizeTransform();
            return true;
        }
        return false;
    }

    /**
     * Select island at UV position
     */
    private selectIslandAtPosition(
        meshes: { [uuid: string]: THREE.Mesh },
        selectedIds: string[],
        uvPosition: THREE.Vector2,
        multiSelect: boolean
    ): boolean {
        // Update island cache if needed
        if (this.islandCache.size === 0) {
            this.updateIslandCache(meshes, selectedIds);
        }

        // Find island at position
        for (const meshId of selectedIds) {
            const islands = this.islandCache.get(meshId);
            if (!islands) continue;

            const mesh = meshes[meshId];
            if (!mesh) continue;

            const islandIndex = KAtlasUVIslands.findIslandAtPosition(
                islands,
                uvPosition,
                mesh.geometry.attributes.uv
            );

            if (islandIndex !== -1) {
                const selection = { meshId, islandIndex };

                if (multiSelect) {
                    // Toggle selection
                    const existingIndex = this.state.selectedIslands.findIndex(
                        s => s.meshId === meshId && s.islandIndex === islandIndex
                    );
                    if (existingIndex !== -1) {
                        this.state.selectedIslands.splice(existingIndex, 1);
                    } else {
                        this.state.selectedIslands.push(selection);
                    }
                } else {
                    // Single selection
                    this.state.selectedIslands = [selection];
                }

                return true;
            }
        }

        // Clicked empty space - deselect if not multi-select
        if (!multiSelect) {
            this.state.selectedIslands = [];
        }

        return false;
    }

    /**
     * Start transform operation
     */
    private startTransform(meshes: { [uuid: string]: THREE.Mesh }, uvPosition: THREE.Vector2) {
        if (this.state.selectedIslands.length === 0) return;

        this.state.isTransforming = true;
        this.state.transformStart.copy(uvPosition);
        this.state.transformCurrent.copy(uvPosition);
        this.state.rotationAngle = 0;
        this.state.scaleFactorX = 1;
        this.state.scaleFactorY = 1;

        // Store original UVs for transform preview
        this.storeOriginalUVs(meshes);
    }

    /**
     * Store original UV coordinates before transform
     */
    private storeOriginalUVs(meshes: { [uuid: string]: THREE.Mesh }) {
        this.originalUVs.clear();

        this.state.selectedIslands.forEach(({ meshId }) => {
            const mesh = meshes[meshId];
            if (!mesh) return;

            const uvAttr = mesh.geometry.attributes.uv;
            if (!uvAttr) return;

            // Clone UV data
            const originalData = new Float32Array(uvAttr.count * 2);
            for (let i = 0; i < uvAttr.count; i++) {
                originalData[i * 2] = uvAttr.getX(i);
                originalData[i * 2 + 1] = uvAttr.getY(i);
            }
            this.originalUVs.set(meshId, originalData);
        });
    }

    /**
     * Restore original UVs
     */
    private restoreOriginalUVs(meshes: { [uuid: string]: THREE.Mesh }) {
        this.originalUVs.forEach((originalData, meshId) => {
            const mesh = meshes[meshId];
            if (!mesh) return;

            const uvAttr = mesh.geometry.attributes.uv;
            if (!uvAttr) return;

            for (let i = 0; i < uvAttr.count; i++) {
                uvAttr.setXY(i, originalData[i * 2], originalData[i * 2 + 1]);
            }
            uvAttr.needsUpdate = true;
        });
    }

    /**
     * Update move transform
     */
    private updateMove(meshes: { [uuid: string]: THREE.Mesh }) {
        // Restore original UVs first
        this.restoreOriginalUVs(meshes);

        const delta = new THREE.Vector2().subVectors(
            this.state.transformCurrent,
            this.state.transformStart
        );

        this.state.selectedIslands.forEach(({ meshId, islandIndex }) => {
            const mesh = meshes[meshId];
            const islands = this.islandCache.get(meshId);
            if (!mesh || !islands) return;

            const island = islands[islandIndex];
            const uvAttr = mesh.geometry.attributes.uv;

            KAtlasUVIslands.moveIsland(island, delta, uvAttr);
        });
    }

    /**
     * Update rotate transform
     */
    private updateRotate(meshes: { [uuid: string]: THREE.Mesh}) {
        // Restore original UVs first
        this.restoreOriginalUVs(meshes);

        // Calculate rotation angle from start to current position
        // Use the center of all selected islands as pivot
        const pivot = this.calculateSelectionCenter(meshes);

        const startVec = new THREE.Vector2().subVectors(this.state.transformStart, pivot);
        const currentVec = new THREE.Vector2().subVectors(this.state.transformCurrent, pivot);

        let angle = Math.atan2(currentVec.y, currentVec.x) - Math.atan2(startVec.y, startVec.x);
        angle = (angle * 180) / Math.PI;

        // Snap to 15-degree increments if enabled
        if (this.state.snapRotation) {
            angle = Math.round(angle / 15) * 15;
        }

        this.state.rotationAngle = angle;

        this.state.selectedIslands.forEach(({ meshId, islandIndex }) => {
            const mesh = meshes[meshId];
            const islands = this.islandCache.get(meshId);
            if (!mesh || !islands) return;

            const island = islands[islandIndex];
            const uvAttr = mesh.geometry.attributes.uv;

            KAtlasUVIslands.rotateIsland(island, angle, uvAttr);
        });
    }

    /**
     * Update scale transform
     */
    private updateScale(meshes: { [uuid: string]: THREE.Mesh }) {
        // Restore original UVs first
        this.restoreOriginalUVs(meshes);

        const pivot = this.calculateSelectionCenter(meshes);

        const startDist = this.state.transformStart.distanceTo(pivot);
        const currentDist = this.state.transformCurrent.distanceTo(pivot);

        let scaleX = startDist > 0.001 ? currentDist / startDist : 1;
        let scaleY = scaleX;

        // Non-uniform scaling if not locked
        if (!this.state.uniformScale) {
            const startVec = new THREE.Vector2().subVectors(this.state.transformStart, pivot);
            const currentVec = new THREE.Vector2().subVectors(this.state.transformCurrent, pivot);

            scaleX = Math.abs(startVec.x) > 0.001 ? Math.abs(currentVec.x / startVec.x) : 1;
            scaleY = Math.abs(startVec.y) > 0.001 ? Math.abs(currentVec.y / startVec.y) : 1;
        }

        this.state.scaleFactorX = scaleX;
        this.state.scaleFactorY = scaleY;

        this.state.selectedIslands.forEach(({ meshId, islandIndex }) => {
            const mesh = meshes[meshId];
            const islands = this.islandCache.get(meshId);
            if (!mesh || !islands) return;

            const island = islands[islandIndex];
            const uvAttr = mesh.geometry.attributes.uv;

            KAtlasUVIslands.scaleIsland(island, scaleX, scaleY, uvAttr);
        });
    }

    /**
     * Calculate center of all selected islands
     */
    private calculateSelectionCenter(meshes: { [uuid: string]: THREE.Mesh }): THREE.Vector2 {
        const center = new THREE.Vector2();
        let count = 0;

        this.state.selectedIslands.forEach(({ meshId, islandIndex }) => {
            const islands = this.islandCache.get(meshId);
            if (!islands) return;

            const island = islands[islandIndex];
            center.add(island.center);
            count++;
        });

        if (count > 0) {
            center.divideScalar(count);
        }

        return center;
    }

    /**
     * Finalize transform
     */
    private finalizeTransform() {
        this.state.isTransforming = false;
        this.originalUVs.clear();
    }

    /**
     * Clear transform state
     */
    private clearTransform() {
        this.state.isTransforming = false;
        this.state.rotationAngle = 0;
        this.state.scaleFactorX = 1;
        this.state.scaleFactorY = 1;
        this.originalUVs.clear();
    }

    /**
     * Get transform info for UI display
     */
    getTransformInfo(): { angle: number; scaleX: number; scaleY: number } {
        return {
            angle: this.state.rotationAngle,
            scaleX: this.state.scaleFactorX,
            scaleY: this.state.scaleFactorY
        };
    }

    /**
     * Clear island cache (call when meshes change)
     */
    clearCache() {
        this.islandCache.clear();
    }
}
