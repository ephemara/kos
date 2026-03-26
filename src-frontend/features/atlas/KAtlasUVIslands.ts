/**
 * KAtlasUVIslands - UV Island Detection and Manipulation
 * 
 * Provides island selection, move, rotate, and scale operations for UV editing.
 */

import * as THREE from 'three';

type UVAttribute = THREE.BufferAttribute | THREE.InterleavedBufferAttribute;

export interface UVIsland {
    vertexIndices: number[];
    bounds: { minU: number; maxU: number; minV: number; maxV: number };
    center: THREE.Vector2;
}

export class KAtlasUVIslands {
    /**
     * Detect UV islands in a mesh using connectivity analysis
     */
    static detectIslands(mesh: THREE.Mesh): UVIsland[] {
        const geometry = mesh.geometry;
        const uvAttr = geometry.attributes.uv;
        const index = geometry.index;

        if (!uvAttr || !index) return [];

        const vertexCount = uvAttr.count;
        const visited = new Array(vertexCount).fill(false);
        const islands: UVIsland[] = [];

        // Build adjacency list based on UV connectivity
        const adjacency = this.buildUVAdjacency(geometry);

        // Flood fill to find islands
        for (let i = 0; i < vertexCount; i++) {
            if (!visited[i]) {
                const island = this.floodFillIsland(i, visited, adjacency, uvAttr);
                if (island.vertexIndices.length > 0) {
                    islands.push(island);
                }
            }
        }

        return islands;
    }

    /**
     * Build adjacency list based on UV connectivity
     * Two vertices are connected if they share the same UV coordinates and are in the same triangle
     */
    private static buildUVAdjacency(geometry: THREE.BufferGeometry): Map<number, Set<number>> {
        const adjacency = new Map<number, Set<number>>();
        const uvAttr = geometry.attributes.uv;
        const index = geometry.index;

        if (!index) return adjacency;

        const triCount = index.count / 3;

        for (let t = 0; t < triCount; t++) {
            const a = index.getX(t * 3);
            const b = index.getX(t * 3 + 1);
            const c = index.getX(t * 3 + 2);

            // Connect vertices in this triangle
            this.addEdge(adjacency, a, b);
            this.addEdge(adjacency, b, c);
            this.addEdge(adjacency, c, a);
        }

        return adjacency;
    }

    private static addEdge(adjacency: Map<number, Set<number>>, a: number, b: number) {
        if (!adjacency.has(a)) adjacency.set(a, new Set());
        if (!adjacency.has(b)) adjacency.set(b, new Set());
        adjacency.get(a)!.add(b);
        adjacency.get(b)!.add(a);
    }

    /**
     * Flood fill to find all vertices in an island
     */
    private static floodFillIsland(
        startVertex: number,
        visited: boolean[],
        adjacency: Map<number, Set<number>>,
        uvAttr: UVAttribute
    ): UVIsland {
        const stack = [startVertex];
        const vertexIndices: number[] = [];
        let minU = Infinity, maxU = -Infinity;
        let minV = Infinity, maxV = -Infinity;

        while (stack.length > 0) {
            const v = stack.pop()!;
            if (visited[v]) continue;

            visited[v] = true;
            vertexIndices.push(v);

            // Update bounds
            const u = uvAttr.getX(v);
            const vCoord = uvAttr.getY(v);
            minU = Math.min(minU, u);
            maxU = Math.max(maxU, u);
            minV = Math.min(minV, vCoord);
            maxV = Math.max(maxV, vCoord);

            // Add neighbors
            const neighbors = adjacency.get(v);
            if (neighbors) {
                neighbors.forEach(n => {
                    if (!visited[n]) {
                        stack.push(n);
                    }
                });
            }
        }

        const center = new THREE.Vector2(
            (minU + maxU) / 2,
            (minV + maxV) / 2
        );

        return {
            vertexIndices,
            bounds: { minU, maxU, minV, maxV },
            center
        };
    }

    /**
     * Find island at UV position (for selection)
     */
    static findIslandAtPosition(
        islands: UVIsland[],
        uv: THREE.Vector2,
        uvAttr: UVAttribute
    ): number {
        for (let i = 0; i < islands.length; i++) {
            const island = islands[i];
            
            // Quick bounds check
            if (uv.x < island.bounds.minU || uv.x > island.bounds.maxU ||
                uv.y < island.bounds.minV || uv.y > island.bounds.maxV) {
                continue;
            }

            // Check if point is inside any triangle of this island
            // For simplicity, we'll just check if it's within bounds
            // A more accurate check would use point-in-triangle tests
            return i;
        }

        return -1;
    }

    /**
     * Move UV island by delta
     */
    static moveIsland(
        island: UVIsland,
        delta: THREE.Vector2,
        uvAttr: UVAttribute
    ) {
        island.vertexIndices.forEach(idx => {
            const u = uvAttr.getX(idx);
            const v = uvAttr.getY(idx);
            uvAttr.setXY(idx, u + delta.x, v + delta.y);
        });

        // Update island bounds and center
        island.bounds.minU += delta.x;
        island.bounds.maxU += delta.x;
        island.bounds.minV += delta.y;
        island.bounds.maxV += delta.y;
        island.center.add(delta);

        uvAttr.needsUpdate = true;
    }

    /**
     * Rotate UV island around its center
     */
    static rotateIsland(
        island: UVIsland,
        angleDegrees: number,
        uvAttr: UVAttribute
    ) {
        const angleRad = (angleDegrees * Math.PI) / 180;
        const cos = Math.cos(angleRad);
        const sin = Math.sin(angleRad);
        const center = island.center;

        island.vertexIndices.forEach(idx => {
            const u = uvAttr.getX(idx);
            const v = uvAttr.getY(idx);

            // Translate to origin
            const du = u - center.x;
            const dv = v - center.y;

            // Rotate
            const rotU = du * cos - dv * sin;
            const rotV = du * sin + dv * cos;

            // Translate back
            uvAttr.setXY(idx, rotU + center.x, rotV + center.y);
        });

        // Recalculate bounds after rotation
        this.recalculateBounds(island, uvAttr);
        uvAttr.needsUpdate = true;
    }

    /**
     * Scale UV island from its center
     */
    static scaleIsland(
        island: UVIsland,
        scaleX: number,
        scaleY: number,
        uvAttr: UVAttribute
    ) {
        const center = island.center;

        island.vertexIndices.forEach(idx => {
            const u = uvAttr.getX(idx);
            const v = uvAttr.getY(idx);

            // Translate to origin
            const du = u - center.x;
            const dv = v - center.y;

            // Scale
            const scaledU = du * scaleX;
            const scaledV = dv * scaleY;

            // Translate back
            uvAttr.setXY(idx, scaledU + center.x, scaledV + center.y);
        });

        // Recalculate bounds after scaling
        this.recalculateBounds(island, uvAttr);
        uvAttr.needsUpdate = true;
    }

    /**
     * Recalculate island bounds and center
     */
    private static recalculateBounds(island: UVIsland, uvAttr: UVAttribute) {
        let minU = Infinity, maxU = -Infinity;
        let minV = Infinity, maxV = -Infinity;

        island.vertexIndices.forEach(idx => {
            const u = uvAttr.getX(idx);
            const v = uvAttr.getY(idx);
            minU = Math.min(minU, u);
            maxU = Math.max(maxU, u);
            minV = Math.min(minV, v);
            maxV = Math.max(maxV, v);
        });

        island.bounds = { minU, maxU, minV, maxV };
        island.center.set((minU + maxU) / 2, (minV + maxV) / 2);
    }

    /**
     * Get all islands from multiple meshes
     */
    static getAllIslands(meshes: { [uuid: string]: THREE.Mesh }, selectedIds: string[]): Map<string, UVIsland[]> {
        const islandMap = new Map<string, UVIsland[]>();

        selectedIds.forEach(id => {
            const mesh = meshes[id];
            if (mesh) {
                const islands = this.detectIslands(mesh);
                islandMap.set(id, islands);
            }
        });

        return islandMap;
    }
}
