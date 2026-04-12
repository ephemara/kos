/**
 * K_OS DCC UI Component Library
 * 
 * Enhanced UI components optimized for DCC (Digital Content Creation) workflows.
 * All components follow the K_OS design system and are built with Radix UI + Tailwind CSS.
 * 
 * Components:
 * - NumericInput: Drag-to-change numeric input with precision control
 * - VectorInput: Multi-component vector input (Vec2/Vec3/Vec4)
 * - ColorPicker: Color picker with swatches and alpha support
 * - CurveEditor: Bezier curve editor with control points
 * - GradientEditor: Gradient editor with color stops
 * - NodeGraph: Node-based graph editor using @xyflow/react
 * - VirtualizedList: Efficient list rendering for large datasets
 * 
 * Validates: Requirements 9.1-9.8, 10.4
 */

export { NumericInput } from './NumericInput';
export type { NumericInputProps } from './NumericInput';

export { VectorInput } from './VectorInput';
export type { VectorInputProps } from './VectorInput';

export { ColorPicker } from './ColorPicker';
export type { Color, ColorPickerProps } from './ColorPicker';

export { CurveEditor } from './CurveEditor';
export type { CurvePoint, Curve, CurveEditorProps } from './CurveEditor';

export { GradientEditor } from './GradientEditor';
export type { GradientStop, Gradient, GradientEditorProps } from './GradientEditor';

export {
    NodeGraph,
    DefaultNode,
    InputNode,
    OutputNode,
    defaultNodeTypes,
} from './NodeGraph';
export type { NodeGraphProps } from './NodeGraph';

export { VirtualizedList, useVirtualizedList } from './VirtualizedList';
export type { VirtualizedListProps } from './VirtualizedList';
