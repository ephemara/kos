/**
 * ModelTypes.ts - Clean TypeScript interfaces for MODEL mode
 * Part of KSculpt's IMM brush / procedural modeling system
 */

import * as THREE from 'three';

// --- SHAPE CATEGORIES ---
export type ShapeCategory = 'primitive' | 'architectural' | 'organic' | 'procedural';

export interface ShapeDefinition {
    id: string;
    label: string;
    category: ShapeCategory;
    icon?: string;
}

// --- MODIFIER STATE ---
export interface ModelModifiers {
    symmetry: 'none' | 'x' | 'z' | 'radial';
    radialCount: number;
    gridLock: boolean;
    gridSize: number;
    chaosMode: boolean;
    fractalEcho: boolean;
    voidAnchor: boolean; // Forces Y-up normal regardless of surface
}

export const DEFAULT_MODIFIERS: ModelModifiers = {
    symmetry: 'none',
    radialCount: 8,
    gridLock: false,
    gridSize: 0.5,
    chaosMode: false,
    fractalEcho: false,
    voidAnchor: false,
};

// --- SPAWN CONTEXT ---
export interface SpawnContext {
    point: THREE.Vector3;
    normal: THREE.Vector3;
    material: THREE.Material;
    modifiers: ModelModifiers;
}

// --- SCENE REF (Minimal interface for interaction hook) ---
export interface ModelSceneRef {
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    raycaster: THREE.Raycaster;
    mouse: THREE.Vector2;
    controls: any; // OrbitControls
    rootGroup: THREE.Group;
    isDragging: boolean;
    startPoint: THREE.Vector3;
    activeObjects: THREE.Group[];
    pendingSpawn: { point: THREE.Vector3; normal: THREE.Vector3 } | null;
    hasSpawned: boolean;
}

// --- USER IMPORT (GLB/OBJ from Kernel) ---
export interface UserImport {
    id: string;
    name: string;
    scene: THREE.Group;
    thumbnail?: string;
}

// --- MODEL MODE STATE ---
export interface ModelModeState {
    activeShape: string;
    modifiers: ModelModifiers;
    userImports: UserImport[];
}

export const DEFAULT_MODEL_STATE: ModelModeState = {
    activeShape: 'cube',
    modifiers: DEFAULT_MODIFIERS,
    userImports: [],
};
