/**
 * K_OS Icon Registry
 * Auto-generated icon imports for type-safe icon usage
 */

import { createElement, type CSSProperties } from 'react';

// Icon categories
export type IconCategory =
  | 'modeling'
  | 'sculpting'
  | 'texturing'
  | 'rigging'
  | 'animation'
  | 'rendering'
  | 'simulation'
  | 'selection'
  | 'view'
  | 'file'
  | 'organization'
  | 'utilities'
  | 'playback'
  | 'compositing'
  | 'grease_pencil'
  | 'curves'
  | 'measurement'
  | 'procedural'
  | 'modifiers';

// Icon names by category
export const ICONS = {
  modeling: [
    'cube', 'sphere', 'cylinder', 'cone', 'torus', 'plane',
    'extrude', 'bevel', 'boolean_union', 'boolean_subtract', 'boolean_intersect',
    'subdivide', 'mirror', 'array', 'lattice'
  ],
  sculpting: [
    'sculpt_draw', 'sculpt_grab', 'sculpt_smooth', 'sculpt_inflate',
    'sculpt_crease', 'sculpt_pinch', 'sculpt_clay', 'sculpt_flatten'
  ],
  texturing: [
    'uv_unwrap', 'texture_paint', 'material', 'shader', 'normal_map', 'bake'
  ],
  rigging: ['bone', 'ik', 'fk', 'constraint'],
  animation: ['keyframe', 'timeline', 'graph_editor', 'dope_sheet'],
  rendering: [
    'camera', 'light_point', 'light_spot', 'light_area', 'light_sun',
    'render', 'viewport', 'wireframe'
  ],
  simulation: ['particle', 'cloth', 'fluid', 'smoke', 'collision', 'force_field'],
  selection: ['select_box', 'select_circle', 'select_lasso', 'move', 'rotate', 'scale'],
  view: [
    'view_front', 'view_side', 'view_top', 'view_perspective',
    'zoom_in', 'zoom_out', 'frame_all'
  ],
  file: ['new', 'open', 'save', 'import', 'export', 'undo', 'redo'],
  organization: [
    'layer', 'group', 'collection', 'outliner',
    'visible', 'hidden', 'lock', 'unlock'
  ],
  utilities: [
    'settings', 'preferences', 'help', 'search', 'filter',
    'pin', 'bookmark', 'trash', 'duplicate', 'link', 'unlink'
  ],
  playback: ['play', 'pause', 'stop', 'record', 'skip_forward', 'skip_back', 'loop'],
  compositing: ['compositor', 'color_correction', 'blur', 'glow', 'mask'],
  grease_pencil: ['grease_pencil', 'draw_line', 'draw_curve', 'eraser', 'fill'],
  curves: ['bezier', 'nurbs', 'path_edit', 'spline'],
  measurement: ['ruler', 'protractor', 'grid', 'snap'],
  procedural: ['geometry_nodes', 'procedural', 'noise', 'voronoi'],
  modifiers: ['modifier', 'bend', 'twist', 'wave', 'shrinkwrap'],
} as const;

/**
 * Get icon path for use in img src
 */
export function getIconPath(category: IconCategory, name: string): string {
  return `/src/assets/icons/${category}/${name}.svg`;
}

/**
 * Icon component props
 */
export interface IconProps {
  category: IconCategory;
  name: string;
  size?: number;
  className?: string;
  style?: CSSProperties;
}

/**
 * Generic Icon component
 */
export function Icon({ category, name, size = 24, className = '', style }: IconProps) {
  return createElement('img', {
    src: getIconPath(category, name),
    alt: name,
    width: size,
    height: size,
    className,
    style,
  });
}

// Convenience exports for common icons
export const ModelingIcon = (props: Omit<IconProps, 'category'>) =>
  createElement(Icon, { ...props, category: 'modeling' });
export const SculptingIcon = (props: Omit<IconProps, 'category'>) =>
  createElement(Icon, { ...props, category: 'sculpting' });
export const TexturingIcon = (props: Omit<IconProps, 'category'>) =>
  createElement(Icon, { ...props, category: 'texturing' });
export const RenderingIcon = (props: Omit<IconProps, 'category'>) =>
  createElement(Icon, { ...props, category: 'rendering' });
