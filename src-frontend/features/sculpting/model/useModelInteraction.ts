/**
 * useModelInteraction.ts - Clean React hook for MODEL mode interaction
 * Handles mouse events, raycasting, and spawn triggering
 */

import { useCallback, useRef } from 'react';
import * as THREE from 'three';
import { spawnWithModifiers } from './ModelSpawner';
import type { ModelModifiers, UserImport } from './ModelTypes';

// --- INTERACTION STATE ---
interface InteractionState {
    isDragging: boolean;
    hasSpawned: boolean;
    startPoint: THREE.Vector3;
    pendingSpawn: { point: THREE.Vector3; normal: THREE.Vector3 } | null;
    activeObjects: THREE.Group[];
}

// --- HOOK CONFIG ---
interface UseModelInteractionConfig {
    sceneRef: React.MutableRefObject<{
        scene: THREE.Scene;
        camera: THREE.PerspectiveCamera;
        raycaster: THREE.Raycaster;
        mouse: THREE.Vector2;
        controls: any;
        rootGroup?: THREE.Group;
    } | null>;
    mountRef: React.RefObject<HTMLDivElement>;
    activeShape: string;
    modifiers: ModelModifiers;
    material: THREE.Material;
    userImports: UserImport[];
    onSpawn?: (objects: THREE.Group[]) => void;
    onStatusChange?: (status: string) => void;
}

// --- DRAG THRESHOLD (Normalized screen space) ---
const DRAG_THRESHOLD = 0.02;

export const useModelInteraction = (config: UseModelInteractionConfig) => {
    const {
        sceneRef,
        mountRef,
        activeShape,
        modifiers,
        material,
        userImports,
        onSpawn,
        onStatusChange,
    } = config;

    // Internal state (not React state - for performance)
    const stateRef = useRef<InteractionState>({
        isDragging: false,
        hasSpawned: false,
        startPoint: new THREE.Vector3(),
        pendingSpawn: null,
        activeObjects: [],
    });

    // --- EXECUTE SPAWN ---
    const executeSpawn = useCallback((point: THREE.Vector3, normal: THREE.Vector3) => {
        const scene = sceneRef.current;
        if (!scene) return;

        const context = {
            point,
            normal,
            material,
            modifiers,
        };

        const objects = spawnWithModifiers(context, activeShape, userImports);

        // Add to scene
        const targetGroup = scene.rootGroup || scene.scene;
        objects.forEach(obj => {
            if (obj) targetGroup.add(obj);
        });

        stateRef.current.activeObjects = objects;
        onSpawn?.(objects);
    }, [sceneRef, activeShape, modifiers, material, userImports, onSpawn]);

    // --- MOUSE DOWN ---
    const handleMouseDown = useCallback((e: React.MouseEvent | MouseEvent) => {
        if (e.button !== 0) return; // Left click only

        const scene = sceneRef.current;
        if (!scene) return;

        const { raycaster, mouse, camera } = scene;
        raycaster.setFromCamera(mouse, camera);

        // Raycast against scene
        const targetGroup = scene.rootGroup || scene.scene;
        const intersects = raycaster.intersectObjects(targetGroup.children, true);
        let hit = intersects.find((i: any) => i.object.visible);

        // Fallback to ground plane if no hit
        if (!hit) {
            const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
            const target = new THREE.Vector3();
            if (raycaster.ray.intersectPlane(plane, target)) {
                hit = {
                    point: target,
                    face: { normal: new THREE.Vector3(0, 1, 0) },
                    object: { matrixWorld: new THREE.Matrix4() },
                } as any;
            }
        }

        if (hit) {
            const state = stateRef.current;
            state.isDragging = true;
            state.hasSpawned = false;
            state.activeObjects = [];

            // Disable orbit controls during drag
            if (scene.controls) scene.controls.enabled = false;

            // Calculate spawn point
            let point = hit.point.clone();

            // Apply grid lock
            if (modifiers.gridLock && modifiers.gridSize > 0) {
                point.x = Math.round(point.x / modifiers.gridSize) * modifiers.gridSize;
                point.y = Math.round(point.y / modifiers.gridSize) * modifiers.gridSize;
                point.z = Math.round(point.z / modifiers.gridSize) * modifiers.gridSize;
            }

            // Get normal
            const normal = modifiers.voidAnchor
                ? new THREE.Vector3(0, 1, 0)
                : (hit.face
                    ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld).normalize()
                    : new THREE.Vector3(0, 1, 0));

            state.startPoint.copy(point);
            state.pendingSpawn = { point, normal };

            onStatusChange?.('Drag to size...');
        }
    }, [sceneRef, modifiers, onStatusChange]);

    // --- MOUSE MOVE ---
    const handleMouseMove = useCallback((e: React.MouseEvent | MouseEvent) => {
        const scene = sceneRef.current;
        const mount = mountRef.current;
        if (!scene || !mount) return;

        // Update mouse position
        const rect = mount.getBoundingClientRect();
        scene.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        scene.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        const state = stateRef.current;
        if (!state.isDragging) return;

        const { mouse, camera } = scene;

        // Check drag threshold
        const screenStart = state.startPoint.clone().project(camera);
        const dx = mouse.x - screenStart.x;
        const dy = mouse.y - screenStart.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Spawn on threshold
        if (!state.hasSpawned && dist > DRAG_THRESHOLD && state.pendingSpawn) {
            executeSpawn(state.pendingSpawn.point, state.pendingSpawn.normal);
            state.hasSpawned = true;
        }

        // Scale spawned objects based on drag distance
        if (state.hasSpawned && state.activeObjects.length > 0) {
            const scale = Math.max(0.05, Math.pow(dist * 4, 1.5));

            state.activeObjects.forEach(obj => {
                if (obj) {
                    const mult = modifiers.chaosMode ? (Math.random() * 0.5 + 0.75) : 1;
                    obj.scale.set(scale * mult, scale * mult, scale * mult);
                }
            });
        }
    }, [sceneRef, mountRef, modifiers, executeSpawn]);

    // --- MOUSE UP ---
    const handleMouseUp = useCallback(() => {
        const scene = sceneRef.current;
        const state = stateRef.current;

        state.isDragging = false;
        state.pendingSpawn = null;

        // Re-enable orbit controls
        if (scene?.controls) scene.controls.enabled = true;

        if (state.hasSpawned) {
            onStatusChange?.('Object placed');
        }

        state.activeObjects = [];
    }, [sceneRef, onStatusChange]);

    return {
        handleMouseDown,
        handleMouseMove,
        handleMouseUp,
    };
};
