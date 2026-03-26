/**
 * KSculpt Model Mode - Clean barrel exports
 * 
 * USAGE:
 * Import everything you need from this single entry point:
 * 
 * import { 
 *   ModelModeToggle, 
 *   ModelPanel, 
 *   useModelInteraction,
 *   SHAPE_IDS,
 *   DEFAULT_MODEL_STATE,
 * } from './model';
 * 
 * HOOKUP GUIDE:
 * 1. Add `appMode: 'SCULPT' | 'MODEL'` state to KSculpt
 * 2. Add `modelState: ModelModeState` state (use DEFAULT_MODEL_STATE)
 * 3. Drop <ModelModeToggle /> into TopBar
 * 4. Conditionally render <ModelPanel /> in LeftPanel when appMode === 'MODEL'
 * 5. Use useModelInteraction() hook for mouse handlers in MODEL mode
 * 6. Swap grid size based on appMode (50 for SCULPT, 150 for MODEL)
 */

// --- TYPES ---
export type {
    ShapeCategory,
    ShapeDefinition,
    ModelModifiers as ModelModifiersState,
    SpawnContext,
    ModelSceneRef,
    UserImport,
    ModelModeState,
} from './ModelTypes';

export { DEFAULT_MODIFIERS, DEFAULT_MODEL_STATE } from './ModelTypes';

// --- SHAPES ---
export {
    SHAPE_IDS,
    SHAPE_DEFINITIONS,
    getShapesByCategory,
    createGeometry,
    createGeometryAsync,    // NEW: Uses Universal Primitive Library (Rust)
    hasUniversalPrimitive,  // NEW: Check if shape has Rust generator
    generateGreeble
} from './ModelShapes';
export type { ShapeId } from './ModelShapes';

// --- SPAWNER ---
export { spawnAtPosition, spawnWithModifiers, mergeIntoMesh } from './ModelSpawner';

// --- INTERACTION HOOKS ---
export { useModelInteraction } from './useModelInteraction';
export { useIMMInteraction } from './useIMMInteraction';
export type { UseIMMInteractionConfig } from './useIMMInteraction';

// --- UI COMPONENTS ---
export { ModelModeToggle } from './ModelModeToggle';
export type { AppMode } from './ModelModeToggle';

export { ModelShapePicker } from './ModelShapePicker';
export { ModelModifiers } from './ModelModifiers';
export { ModelPanel } from './ModelPanel';
