/**
 * useIMMInteraction.ts - ZBrush IMM-style drag-to-spawn hook for KSculpt
 * 
 * BEHAVIOR:
 * - Left-click + drag on mesh surface to spawn geometry
 * - Drag distance controls scale
 * - Geometry is MERGED into active subtool mesh (not a new layer)
 * - Only works at subdivision level 0
 */

import { useCallback, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { spawnWithModifiers, mergeIntoMesh } from './ModelSpawner';
import type { ModelModifiers, UserImport } from './ModelTypes';

// Interaction state (not React state for perf)
interface IMMState {
    isDragging: boolean;
    hasSpawned: boolean;
    startScreen: THREE.Vector2;
    spawnPoint: THREE.Vector3;
    spawnNormal: THREE.Vector3;
    previewGroups: THREE.Group[];
    currentScale: number;
}

export interface UseIMMInteractionConfig {
    // Required refs
    mountRef: React.RefObject<HTMLDivElement | null>;
    sceneRef: React.MutableRefObject<any>;

    // Active state
    appMode: 'SCULPT' | 'MODEL';
    activeShape: string;
    modifiers: ModelModifiers;
    userImports: UserImport[];

    // Active mesh info
    getActiveMesh: () => THREE.Mesh | null;
    getSubdivisionLevel: () => number;

    // Callbacks
    onMeshUpdated: (mesh: THREE.Mesh) => void;
    onStatusChange: (status: string) => void;
}

const DRAG_THRESHOLD = 15; // pixels
const MIN_SCALE = 0.05;
const MAX_SCALE = 5.0;
const SCALE_SENSITIVITY = 0.01;

export const useIMMInteraction = (config: UseIMMInteractionConfig) => {
    const {
        mountRef,
        sceneRef,
        appMode,
        activeShape,
        modifiers,
        userImports,
        getActiveMesh,
        getSubdivisionLevel,
        onMeshUpdated,
        onStatusChange,
    } = config;

    const stateRef = useRef<IMMState>({
        isDragging: false,
        hasSpawned: false,
        startScreen: new THREE.Vector2(),
        spawnPoint: new THREE.Vector3(),
        spawnNormal: new THREE.Vector3(),
        previewGroups: [],
        currentScale: 0.5,
    });

    // Get default material for spawned geometry
    const getDefaultMaterial = useCallback(() => {
        const mesh = getActiveMesh();
        if (mesh && mesh.material) {
            if (Array.isArray(mesh.material)) {
                return mesh.material[0].clone();
            }
            return (mesh.material as THREE.Material).clone();
        }
        return new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.5, metalness: 0.1 });
    }, [getActiveMesh]);

    // Raycast to active mesh - uses BVH for speed
    const raycastToMesh = useCallback((clientX: number, clientY: number): { point: THREE.Vector3; normal: THREE.Vector3 } | null => {
        const mount = mountRef.current;
        const scene = sceneRef.current;
        const mesh = getActiveMesh();

        if (!mount || !scene || !mesh) {
            console.warn('[IMM] Raycast failed: missing mount/scene/mesh');
            return null;
        }

        // Ensure BVH is computed for fast raycasting
        if (mesh.geometry && !(mesh.geometry as any).boundsTree) {
            console.log('[IMM] Computing BVH for mesh...');
            if ((mesh.geometry as any).computeBoundsTree) {
                (mesh.geometry as any).computeBoundsTree();
            }
        }

        const rect = mount.getBoundingClientRect();
        const mouse = new THREE.Vector2(
            ((clientX - rect.left) / rect.width) * 2 - 1,
            -((clientY - rect.top) / rect.height) * 2 + 1
        );

        // Use scene's raycaster or create new one
        const raycaster = scene.raycaster || new THREE.Raycaster();
        const camera = scene.camera;

        if (!camera) {
            console.warn('[IMM] No camera available');
            return null;
        }

        // Set firstHitOnly for BVH optimization
        raycaster.firstHitOnly = true;
        raycaster.setFromCamera(mouse, camera);

        try {
            const intersects = raycaster.intersectObject(mesh, false);

            if (intersects.length > 0) {
                const hit = intersects[0];
                const normal = hit.face
                    ? hit.face.normal.clone().transformDirection(mesh.matrixWorld).normalize()
                    : new THREE.Vector3(0, 1, 0);

                console.log('[IMM] Hit at', hit.point.toArray());
                return { point: hit.point.clone(), normal };
            }
        } catch (e) {
            console.error('[IMM] Raycast error:', e);
        }

        return null;
    }, [mountRef, sceneRef, getActiveMesh]);

    // Create preview spawns (added to scene temporarily)
    const createPreview = useCallback((point: THREE.Vector3, normal: THREE.Vector3) => {
        const scene = sceneRef.current;
        if (!scene || !scene.scene) {
            console.warn('[IMM] No scene available for preview');
            return;
        }

        console.log('[IMM] Creating preview at', point.toArray(), 'shape:', activeShape);

        const material = getDefaultMaterial();
        const context = { point, normal, material, modifiers };
        const groups = spawnWithModifiers(context, activeShape, userImports);

        console.log('[IMM] Spawned', groups.length, 'groups');

        // Add to scene as preview
        groups.forEach(g => {
            g.userData.isIMMPreview = true;
            scene.scene.add(g);
        });

        stateRef.current.previewGroups = groups;
    }, [sceneRef, activeShape, modifiers, userImports, getDefaultMaterial]);

    // Update preview scale
    const updatePreviewScale = useCallback((scale: number) => {
        const groups = stateRef.current.previewGroups;
        groups.forEach(g => {
            g.scale.set(scale, scale, scale);
        });
        stateRef.current.currentScale = scale;
    }, []);

    // Remove preview from scene
    const clearPreview = useCallback(() => {
        const scene = sceneRef.current;
        const groups = stateRef.current.previewGroups;

        if (scene) {
            groups.forEach(g => scene.scene.remove(g));
        }
        stateRef.current.previewGroups = [];
    }, [sceneRef]);

    // Commit preview to mesh (IMM merge)
    const commitToMesh = useCallback(() => {
        const mesh = getActiveMesh();
        const groups = stateRef.current.previewGroups;
        const scale = stateRef.current.currentScale;

        console.log('[IMM] commitToMesh called', {
            hasMesh: !!mesh,
            groupCount: groups.length,
            scale
        });

        if (!mesh || groups.length === 0) {
            console.warn('[IMM] No mesh or groups to commit');
            clearPreview();
            return false;
        }

        // Check subdivision level
        const subdivLevel = getSubdivisionLevel();
        if (subdivLevel > 0) {
            onStatusChange(`Cannot insert at subdivision ${subdivLevel} - go to level 0`);
            clearPreview();
            return false;
        }

        // Store original geometry in case of failure
        const originalGeometry = mesh.geometry;

        // Merge into mesh
        const newGeometry = mergeIntoMesh(mesh, groups, scale);

        if (newGeometry) {
            try {
                // Apply new merged geometry
                mesh.geometry = newGeometry;

                // Dispose old geometry AFTER successful assignment
                originalGeometry.dispose();

                // Ensure geometry update is reflected
                mesh.geometry.attributes.position.needsUpdate = true;
                if (mesh.geometry.attributes.normal) {
                    mesh.geometry.attributes.normal.needsUpdate = true;
                }

                // Recompute BVH if it existed
                if ((mesh.geometry as any).computeBoundsTree) {
                    (mesh.geometry as any).computeBoundsTree();
                }

                onMeshUpdated(mesh);
                onStatusChange('Geometry merged into subtool');
                clearPreview();
                return true;
            } catch (e) {
                console.error('[IMM] Failed to apply new geometry:', e);
                // Restore original
                mesh.geometry = originalGeometry;
                onStatusChange('Merge failed - restored original');
                clearPreview();
                return false;
            }
        } else {
            onStatusChange('Merge failed - check console');
            clearPreview();
            return false;
        }
    }, [getActiveMesh, getSubdivisionLevel, clearPreview, onMeshUpdated, onStatusChange]);

    // --- MOUSE    // Event handlers
    const handleMouseDown = useCallback((e: MouseEvent) => {
        if (e.button !== 0) return; // Only left click
        if (e.altKey) return; // Allow ALT to orbit (disable IMM)

        // Only raycast if input is within mount
        const mount = mountRef.current;
        if (!mount) return;
        const rect = mount.getBoundingClientRect();
        if (
            e.clientX < rect.left ||
            e.clientX > rect.right ||
            e.clientY < rect.top ||
            e.clientY > rect.bottom
        ) return;

        // Reset state
        stateRef.current.isDragging = false;
        stateRef.current.hasSpawned = false;
        stateRef.current.startScreen.set(e.clientX, e.clientY);
        stateRef.current.currentScale = 0.1; // Start small

        // Raycast
        const hit = raycastToMesh(e.clientX, e.clientY);
        if (hit) {
            stateRef.current.spawnPoint.copy(hit.point);
            stateRef.current.spawnNormal.copy(hit.normal);

            // Check subdiv logic early
            const subdivLevel = getSubdivisionLevel();
            if (subdivLevel > 0) {
                onStatusChange(`IMM only works at subdivision 0 (currently ${subdivLevel})`);
                return;
            }

            stateRef.current.isDragging = true;
            onStatusChange('Drag to size...');
        }
    }, [raycastToMesh, getSubdivisionLevel, onStatusChange]);

    const handleMouseMove = useCallback((e: MouseEvent) => {
        const state = stateRef.current;
        if (!state.isDragging) return;

        const dx = e.clientX - state.startScreen.x;
        const dy = e.clientY - state.startScreen.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Spawn preview after threshold
        if (!state.hasSpawned && dist > DRAG_THRESHOLD) {
            createPreview(state.spawnPoint, state.spawnNormal);
            state.hasSpawned = true;
        }

        // Update scale based on drag distance
        if (state.hasSpawned) {
            const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, dist * SCALE_SENSITIVITY));
            updatePreviewScale(scale);
        }
    }, [createPreview, updatePreviewScale]);

    const handleMouseUp = useCallback((e: MouseEvent) => {
        const state = stateRef.current;
        if (!state.isDragging) return;

        state.isDragging = false;

        if (state.hasSpawned) {
            commitToMesh();
        }

        state.hasSpawned = false;
    }, [commitToMesh]);

    // Attach event listeners when in MODEL mode
    useEffect(() => {
        const mount = mountRef.current;
        if (!mount) return;

        if (appMode === 'MODEL') {
            mount.addEventListener('mousedown', handleMouseDown);
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);

            return () => {
                mount.removeEventListener('mousedown', handleMouseDown);
                window.removeEventListener('mousemove', handleMouseMove);
                window.removeEventListener('mouseup', handleMouseUp);
                clearPreview();
            };
        }
    }, [appMode, mountRef, handleMouseDown, handleMouseMove, handleMouseUp, clearPreview]);

    // Cleanup on unmount
    useEffect(() => {
        return () => clearPreview();
    }, [clearPreview]);

    return {
        isActive: appMode === 'MODEL',
    };
};
