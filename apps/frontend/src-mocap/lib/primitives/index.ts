/**
 * K_OS Universal Primitive Library
 * 
 * Central exports for the primitive system.
 * 
 * Usage:
 *   import { spawnPrimitive, PRIMITIVES, getPrimitiveById } from '@mocap/lib/primitives';
 */

// Registry exports
export {
    // Types
    type PrimitiveCategory,
    type PrimitiveTag,
    type ParamType,
    type ParamDefinition,
    type GeneratorBackend,
    type PrimitiveDefinition,

    // Data
    PRIMITIVES,
    PRIMITIVE_CATEGORIES,

    // Lookup helpers
    getPrimitiveById,
    getPrimitivesByCategory,
    getPrimitivesByTag,
    getRustPrimitives,
    getProceduralPrimitives,
    getDefaultParams,
    isSculptReady,
    getAllPrimitiveIds,
} from './primitiveRegistry';

// Spawner exports
export {
    spawnPrimitive,
    spawnPrimitiveToThree,
    type SpawnResult,
    type SpawnParams,
} from './spawnPrimitive';
