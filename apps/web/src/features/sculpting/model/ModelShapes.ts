/**
 * ModelShapes.ts - Shape definitions and geometry creation
 * Clean extraction from KGreeble's messy engine
 * 
 * NOTE: This file now bridges to the Universal Primitive Library.
 * For best quality, use createGeometryAsync() which calls Rust generators.
 * createGeometry() is kept for sync fallback.
 */

import * as THREE from 'three';
import type { ShapeDefinition, ShapeCategory } from './ModelTypes';
import { spawnPrimitiveToThree, getPrimitiveById } from '@/lib/primitives';

// --- SHAPE IDS (Type-safe) ---
export const SHAPE_IDS = {
    // Primitives
    CUBE: 'cube',
    SPHERE: 'sphere',
    CYLINDER: 'cylinder',
    CONE: 'cone',
    TORUS: 'torus',
    PYRAMID: 'pyramid',
    CAPSULE: 'capsule',
    RING: 'ring',
    ICOSA: 'icosphere',  // Renamed to match universal registry
    // Architectural
    WALL: 'wall',
    PLATFORM: 'platform',
    PILLAR: 'pillar',
    TOWER: 'tower',
    ARC: 'arch',  // Renamed to match universal registry
    STRUCT: 'struct',
    // Organic
    SPIKE: 'spike',
    TENTACLE: 'tentacle',
    SPINE: 'spine',
    FLORA: 'flora',
    // Procedural
    PIPE: 'tube',  // Renamed to match universal registry
    CRYSTAL: 'crystal',
    GREEBLE: 'greeble',
    SWARM: 'swarm',
    CITY: 'city',
    FRACTAL: 'fractal',
    CHAIN: 'chain',
    GEAR: 'gear',
    RUINS: 'ruins',
} as const;

export type ShapeId = typeof SHAPE_IDS[keyof typeof SHAPE_IDS];

// --- MAP: Local Shape IDs to Universal Primitive IDs ---
// Some shapes have 1:1 mapping, others need custom Three.js generation
const UNIVERSAL_PRIMITIVE_MAP: Record<string, string | null> = {
    [SHAPE_IDS.CUBE]: 'cube',
    [SHAPE_IDS.SPHERE]: 'sphere',
    [SHAPE_IDS.CYLINDER]: 'cylinder',
    [SHAPE_IDS.CONE]: 'cone',
    [SHAPE_IDS.TORUS]: 'torus',
    [SHAPE_IDS.PYRAMID]: 'pyramid',
    [SHAPE_IDS.CAPSULE]: 'capsule',
    [SHAPE_IDS.RING]: 'ring',
    [SHAPE_IDS.ICOSA]: 'icosphere',
    [SHAPE_IDS.WALL]: 'wall',
    [SHAPE_IDS.PLATFORM]: 'platform',
    [SHAPE_IDS.PILLAR]: 'pillar',
    [SHAPE_IDS.ARC]: 'arch',
    [SHAPE_IDS.PIPE]: 'tube',
    [SHAPE_IDS.CRYSTAL]: 'crystal',
    [SHAPE_IDS.GREEBLE]: 'greeble',
    // Shapes that don't have universal equivalents - use null to fall back to Three.js
    [SHAPE_IDS.TOWER]: null,
    [SHAPE_IDS.STRUCT]: null,
    [SHAPE_IDS.SPIKE]: null,
    [SHAPE_IDS.TENTACLE]: null,
    [SHAPE_IDS.SPINE]: null,
    [SHAPE_IDS.FLORA]: null,
    [SHAPE_IDS.SWARM]: null,
    [SHAPE_IDS.CITY]: null,
    [SHAPE_IDS.FRACTAL]: null,
    [SHAPE_IDS.CHAIN]: null,
    [SHAPE_IDS.GEAR]: null,
    [SHAPE_IDS.RUINS]: null,
};

// --- SHAPE DEFINITIONS (For UI) ---
export const SHAPE_DEFINITIONS: ShapeDefinition[] = [
    // Primitives
    { id: SHAPE_IDS.CUBE, label: 'Cube', category: 'primitive' },
    { id: SHAPE_IDS.SPHERE, label: 'Sphere', category: 'primitive' },
    { id: SHAPE_IDS.CYLINDER, label: 'Cylinder', category: 'primitive' },
    { id: SHAPE_IDS.CONE, label: 'Cone', category: 'primitive' },
    { id: SHAPE_IDS.TORUS, label: 'Torus', category: 'primitive' },
    { id: SHAPE_IDS.PYRAMID, label: 'Pyramid', category: 'primitive' },
    { id: SHAPE_IDS.CAPSULE, label: 'Capsule', category: 'primitive' },
    { id: SHAPE_IDS.RING, label: 'Ring', category: 'primitive' },
    { id: SHAPE_IDS.ICOSA, label: 'Icosahedron', category: 'primitive' },
    // Architectural
    { id: SHAPE_IDS.WALL, label: 'Wall', category: 'architectural' },
    { id: SHAPE_IDS.PLATFORM, label: 'Platform', category: 'architectural' },
    { id: SHAPE_IDS.PILLAR, label: 'Pillar', category: 'architectural' },
    { id: SHAPE_IDS.TOWER, label: 'Tower', category: 'architectural' },
    { id: SHAPE_IDS.ARC, label: 'Arc', category: 'architectural' },
    { id: SHAPE_IDS.STRUCT, label: 'Structure', category: 'architectural' },
    // Organic
    { id: SHAPE_IDS.SPIKE, label: 'Spike', category: 'organic' },
    { id: SHAPE_IDS.TENTACLE, label: 'Tentacle', category: 'organic' },
    { id: SHAPE_IDS.SPINE, label: 'Spine', category: 'organic' },
    { id: SHAPE_IDS.FLORA, label: 'Flora', category: 'organic' },
    // Procedural
    { id: SHAPE_IDS.PIPE, label: 'Pipe', category: 'procedural' },
    { id: SHAPE_IDS.CRYSTAL, label: 'Crystal', category: 'procedural' },
    { id: SHAPE_IDS.GREEBLE, label: 'Greeble', category: 'procedural' },
    { id: SHAPE_IDS.SWARM, label: 'Swarm', category: 'procedural' },
    { id: SHAPE_IDS.CITY, label: 'City', category: 'procedural' },
    { id: SHAPE_IDS.FRACTAL, label: 'Fractal', category: 'procedural' },
    { id: SHAPE_IDS.CHAIN, label: 'Chain', category: 'procedural' },
    { id: SHAPE_IDS.GEAR, label: 'Gear', category: 'procedural' },
    { id: SHAPE_IDS.RUINS, label: 'Ruins', category: 'procedural' },
];

// --- HELPER: Get shapes by category ---
export const getShapesByCategory = (category: ShapeCategory): ShapeDefinition[] => {
    return SHAPE_DEFINITIONS.filter(s => s.category === category);
};

// --- HELPER: Check if a shape has a universal primitive ---
export const hasUniversalPrimitive = (shapeId: string): boolean => {
    return UNIVERSAL_PRIMITIVE_MAP[shapeId] !== undefined && UNIVERSAL_PRIMITIVE_MAP[shapeId] !== null;
};

// --- ASYNC GEOMETRY CREATION (Uses Universal Primitive Library) ---
// This is the preferred method - uses high-quality Rust generators
export const createGeometryAsync = async (shapeId: string): Promise<THREE.BufferGeometry> => {
    const universalId = UNIVERSAL_PRIMITIVE_MAP[shapeId];

    if (universalId && getPrimitiveById(universalId)) {
        try {
            console.log(`[ModelShapes] Using Universal Primitive: ${universalId}`);
            return await spawnPrimitiveToThree(universalId);
        } catch (error) {
            console.warn(`[ModelShapes] Universal primitive failed, falling back to Three.js:`, error);
        }
    }

    // Fallback to synchronous Three.js geometry
    return createGeometry(shapeId);
};

// --- GEOMETRY CREATION ---
const SEGMENTS = 64; // High quality default

export const createGeometry = (shapeId: string): THREE.BufferGeometry => {
    switch (shapeId) {
        // Primitives (origin at bottom center)
        case SHAPE_IDS.CUBE:
            return new THREE.BoxGeometry(1, 1, 1, 1, 1, 1).translate(0, 0.5, 0);
        case SHAPE_IDS.SPHERE:
            return new THREE.SphereGeometry(0.5, SEGMENTS, SEGMENTS).translate(0, 0.5, 0);
        case SHAPE_IDS.CYLINDER:
            return new THREE.CylinderGeometry(0.5, 0.5, 1, SEGMENTS, 1).translate(0, 0.5, 0);
        case SHAPE_IDS.CONE:
            return new THREE.ConeGeometry(0.5, 1, SEGMENTS, 1).translate(0, 0.5, 0);
        case SHAPE_IDS.TORUS:
            return new THREE.TorusGeometry(0.4, 0.2, SEGMENTS, SEGMENTS).rotateX(-Math.PI / 2).translate(0, 0.2, 0);
        case SHAPE_IDS.PYRAMID:
            return new THREE.ConeGeometry(0.5, 1, 4, 1).translate(0, 0.5, 0);
        case SHAPE_IDS.CAPSULE:
            return new THREE.CapsuleGeometry(0.3, 0.8, 8, SEGMENTS).translate(0, 0.7, 0);
        case SHAPE_IDS.RING:
            return new THREE.TorusGeometry(0.5, 0.1, SEGMENTS, SEGMENTS * 2).rotateX(-Math.PI / 2).translate(0, 0.1, 0);
        case SHAPE_IDS.ICOSA:
            return new THREE.IcosahedronGeometry(0.5, 0).translate(0, 0.5, 0);

        // Architectural
        case SHAPE_IDS.WALL:
            return new THREE.BoxGeometry(2, 1, 0.2).translate(0, 0.5, 0);
        case SHAPE_IDS.PLATFORM:
            return new THREE.BoxGeometry(2, 0.2, 2).translate(0, 0.1, 0);
        case SHAPE_IDS.PILLAR:
            return new THREE.CylinderGeometry(0.2, 0.2, 2, 32).translate(0, 1, 0);
        case SHAPE_IDS.TOWER:
            return new THREE.BoxGeometry(0.5, 3, 0.5).translate(0, 1.5, 0);
        case SHAPE_IDS.ARC:
            return new THREE.TorusGeometry(1, 0.2, 32, SEGMENTS, Math.PI).rotateY(Math.PI / 2);

        // Organic
        case SHAPE_IDS.SPIKE:
            return new THREE.ConeGeometry(0.2, 2, SEGMENTS, 1).translate(0, 1, 0);

        // Procedural (simple fallback - complex ones handled in spawner)
        case SHAPE_IDS.PIPE:
            return new THREE.TorusKnotGeometry(0.4, 0.15, 256, 32, 2, 3).translate(0, 0.6, 0);
        case SHAPE_IDS.CRYSTAL:
            return new THREE.OctahedronGeometry(0.5, 0).translate(0, 0.5, 0);

        default:
            return new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
    }
};

// --- PROCEDURAL GREEBLE GENERATOR ---
export const generateGreeble = (material: THREE.Material): THREE.Group => {
    const container = new THREE.Group();
    container.userData.isContainer = true;

    // Core block with random dimensions
    const coreW = 0.5 + Math.random() * 0.5;
    const coreH = 0.5 + Math.random() * 0.5;
    const coreD = 0.5 + Math.random() * 0.5;

    const core = new THREE.Mesh(new THREE.BoxGeometry(coreW, coreH, coreD), material);
    core.castShadow = true;
    core.receiveShadow = true;
    container.add(core);

    // Random modules attached to faces
    const numModules = 4 + Math.floor(Math.random() * 6);

    for (let i = 0; i < numModules; i++) {
        const moduleType = Math.floor(Math.random() * 4);
        const mesh = new THREE.Mesh();
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.material = material;

        // Create geometry based on type
        switch (moduleType) {
            case 0: // Panel
                mesh.geometry = new THREE.BoxGeometry(coreW * 0.8, coreH * 0.1, coreD * 0.8);
                break;
            case 1: // Strip
                mesh.geometry = new THREE.BoxGeometry(coreW * 0.9, coreH * 0.05, coreD * 0.05);
                break;
            case 2: // Pipe
                mesh.geometry = new THREE.CylinderGeometry(0.1, 0.1, Math.max(coreW, coreH), 16);
                mesh.rotation.z = Math.PI / 2;
                break;
            default: // Sphere detail
                mesh.geometry = new THREE.SphereGeometry(0.15, 16, 16);
        }

        // Position on random face
        const face = Math.floor(Math.random() * 6);
        const offset = 0.05;

        switch (face) {
            case 0: // Top
                mesh.position.set((Math.random() - 0.5) * coreW, coreH / 2 + offset, (Math.random() - 0.5) * coreD);
                break;
            case 1: // Bottom
                mesh.position.set((Math.random() - 0.5) * coreW, -coreH / 2 - offset, (Math.random() - 0.5) * coreD);
                break;
            case 2: // Right
                mesh.position.set(coreW / 2 + offset, (Math.random() - 0.5) * coreH, (Math.random() - 0.5) * coreD);
                mesh.rotation.z = Math.PI / 2;
                break;
            case 3: // Left
                mesh.position.set(-coreW / 2 - offset, (Math.random() - 0.5) * coreH, (Math.random() - 0.5) * coreD);
                mesh.rotation.z = Math.PI / 2;
                break;
            case 4: // Front
                mesh.position.set((Math.random() - 0.5) * coreW, (Math.random() - 0.5) * coreH, coreD / 2 + offset);
                mesh.rotation.x = Math.PI / 2;
                break;
            default: // Back
                mesh.position.set((Math.random() - 0.5) * coreW, (Math.random() - 0.5) * coreH, -coreD / 2 - offset);
                mesh.rotation.x = Math.PI / 2;
        }

        container.add(mesh);
    }

    return container;
};
