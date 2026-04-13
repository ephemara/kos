/**
 * Layout System Types
 * 
 * Defines types for the data-driven panel layout system.
 * Following VS Code/UE5 UI Philosophy: fully dockable, collapsible, resizable panels.
 */

import type { ComponentType } from 'react';

/**
 * Panel position in the layout
 */
export type PanelPosition = 'left' | 'right' | 'top' | 'bottom' | 'center' | 'floating';

/**
 * Panel definition
 */
export interface PanelDefinition {
  /** Unique panel identifier */
  id: string;
  /** Display title */
  title: string;
  /** Panel component */
  component: ComponentType<any>;
  /** Default position */
  defaultPosition: PanelPosition;
  /** Default width (for left/right panels) */
  defaultWidth?: number;
  /** Default height (for top/bottom panels) */
  defaultHeight?: number;
  /** Minimum width */
  minWidth?: number;
  /** Minimum height */
  minHeight?: number;
  /** Maximum width */
  maxWidth?: number;
  /** Maximum height */
  maxHeight?: number;
  /** Whether panel can be closed */
  closeable?: boolean;
  /** Whether panel can be moved */
  moveable?: boolean;
  /** Whether panel can be resized */
  resizable?: boolean;
  /** Whether panel starts collapsed */
  defaultCollapsed?: boolean;
  /** Icon component or name */
  icon?: ComponentType<any> | string;
  /** Keyboard shortcut to toggle panel */
  shortcut?: string;
}

/**
 * Panel state in the layout
 */
export interface PanelState {
  /** Panel ID */
  id: string;
  /** Current position */
  position: PanelPosition;
  /** Current width */
  width?: number;
  /** Current height */
  height?: number;
  /** Whether panel is visible */
  visible: boolean;
  /** Whether panel is collapsed */
  collapsed: boolean;
  /** Z-index for floating panels */
  zIndex?: number;
  /** Position for floating panels */
  floatingPosition?: { x: number; y: number };
}

/**
 * Layout configuration
 */
export interface LayoutConfig {
  /** Layout name */
  name: string;
  /** Panel states */
  panels: Record<string, PanelState>;
  /** Viewport configuration */
  viewport?: {
    /** Whether viewport is maximized */
    maximized?: boolean;
  };
}

/**
 * Layout preset
 */
export interface LayoutPreset {
  /** Preset ID */
  id: string;
  /** Preset name */
  name: string;
  /** Preset description */
  description?: string;
  /** Layout configuration */
  layout: LayoutConfig;
  /** Keyboard shortcut */
  shortcut?: string;
  /** Thumbnail image */
  thumbnail?: string;
}

/**
 * Panel registry
 */
export interface PanelRegistry {
  /** All available panels */
  panels: PanelDefinition[];
  /** Default layout */
  defaultLayout: LayoutConfig;
  /** Available layout presets */
  presets: LayoutPreset[];
}

/**
 * Layout manager events
 */
export type LayoutEvent =
  | { type: 'panel-moved'; panelId: string; position: PanelPosition }
  | { type: 'panel-resized'; panelId: string; width?: number; height?: number }
  | { type: 'panel-toggled'; panelId: string; visible: boolean }
  | { type: 'panel-collapsed'; panelId: string; collapsed: boolean }
  | { type: 'layout-changed'; layout: LayoutConfig }
  | { type: 'preset-applied'; presetId: string };
