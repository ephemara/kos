export type GraphosTool =
  | 'brush'
  | 'eraser'
  | 'move'
  | 'marquee'
  | 'lasso'
  | 'wand';

export type GraphosSelectionMode = 'replace' | 'add' | 'subtract' | 'intersect';

export interface SelectionPreviewRect {
  u0: number;
  v0: number;
  u1: number;
  v1: number;
}

export interface SelectionPreviewLassoPoint {
  u: number;
  v: number;
}

export interface GraphosSelectionPreview {
  rect?: SelectionPreviewRect | null;
  lasso?: SelectionPreviewLassoPoint[] | null;
}

export const DEFAULT_GRAPHOS_TOOL: GraphosTool = 'brush';
export const DEFAULT_GRAPHOS_SELECTION_MODE: GraphosSelectionMode = 'replace';
