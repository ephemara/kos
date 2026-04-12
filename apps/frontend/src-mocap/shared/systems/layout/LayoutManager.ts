/**
 * Layout Manager
 * 
 * Manages panel layouts, persistence, and presets.
 * Implements VS Code/UE5-style dockable panel system.
 */

import type {
  LayoutConfig,
  LayoutPreset,
  PanelState,
  PanelDefinition,
  LayoutEvent,
} from './types';

/**
 * Event listener type
 */
type LayoutEventListener = (event: LayoutEvent) => void;

/**
 * Layout Manager class
 */
export class LayoutManager {
  private currentLayout: LayoutConfig;
  private presets: Map<string, LayoutPreset> = new Map();
  private listeners: Set<LayoutEventListener> = new Set();
  private storageKey: string;

  constructor(
    defaultLayout: LayoutConfig,
    presets: LayoutPreset[] = [],
    storageKey = 'app-layout'
  ) {
    this.storageKey = storageKey;
    this.currentLayout = defaultLayout;
    
    // Register presets
    presets.forEach(preset => {
      this.presets.set(preset.id, preset);
    });

    // Load saved layout from localStorage
    this.loadLayout();
  }

  /**
   * Get current layout
   */
  getLayout(): LayoutConfig {
    return { ...this.currentLayout };
  }

  /**
   * Get panel state
   */
  getPanelState(panelId: string): PanelState | undefined {
    return this.currentLayout.panels[panelId];
  }

  /**
   * Update panel state
   */
  updatePanelState(panelId: string, updates: Partial<PanelState>): void {
    const currentState = this.currentLayout.panels[panelId];
    if (!currentState) {
      console.warn(`[LayoutManager] Panel ${panelId} not found`);
      return;
    }

    this.currentLayout.panels[panelId] = {
      ...currentState,
      ...updates,
    };

    this.saveLayout();
    this.emitEvent({ type: 'layout-changed', layout: this.currentLayout });
  }

  /**
   * Move panel to new position
   */
  movePanel(panelId: string, position: PanelState['position']): void {
    this.updatePanelState(panelId, { position });
    this.emitEvent({ type: 'panel-moved', panelId, position });
  }

  /**
   * Resize panel
   */
  resizePanel(panelId: string, width?: number, height?: number): void {
    this.updatePanelState(panelId, { width, height });
    this.emitEvent({ type: 'panel-resized', panelId, width, height });
  }

  /**
   * Toggle panel visibility
   */
  togglePanel(panelId: string, visible?: boolean): void {
    const currentState = this.getPanelState(panelId);
    if (!currentState) return;

    const newVisible = visible !== undefined ? visible : !currentState.visible;
    this.updatePanelState(panelId, { visible: newVisible });
    this.emitEvent({ type: 'panel-toggled', panelId, visible: newVisible });
  }

  /**
   * Toggle panel collapsed state
   */
  toggleCollapsed(panelId: string, collapsed?: boolean): void {
    const currentState = this.getPanelState(panelId);
    if (!currentState) return;

    const newCollapsed = collapsed !== undefined ? collapsed : !currentState.collapsed;
    this.updatePanelState(panelId, { collapsed: newCollapsed });
    this.emitEvent({ type: 'panel-collapsed', panelId, collapsed: newCollapsed });
  }

  /**
   * Apply a layout preset
   */
  applyPreset(presetId: string): void {
    const preset = this.presets.get(presetId);
    if (!preset) {
      console.warn(`[LayoutManager] Preset ${presetId} not found`);
      return;
    }

    this.currentLayout = { ...preset.layout };
    this.saveLayout();
    this.emitEvent({ type: 'preset-applied', presetId });
    this.emitEvent({ type: 'layout-changed', layout: this.currentLayout });
  }

  /**
   * Get all available presets
   */
  getPresets(): LayoutPreset[] {
    return Array.from(this.presets.values());
  }

  /**
   * Get a specific preset
   */
  getPreset(presetId: string): LayoutPreset | undefined {
    return this.presets.get(presetId);
  }

  /**
   * Save current layout to localStorage
   */
  saveLayout(): void {
    try {
      const serialized = JSON.stringify(this.currentLayout);
      localStorage.setItem(this.storageKey, serialized);
    } catch (error) {
      console.error('[LayoutManager] Failed to save layout:', error);
    }
  }

  /**
   * Load layout from localStorage
   */
  loadLayout(): void {
    try {
      const serialized = localStorage.getItem(this.storageKey);
      if (serialized) {
        const loaded = JSON.parse(serialized);
        this.currentLayout = this.validateLayout(loaded);
      }
    } catch (error) {
      console.error('[LayoutManager] Failed to load layout:', error);
    }
  }

  /**
   * Validate and merge loaded layout with default
   */
  private validateLayout(loaded: LayoutConfig): LayoutConfig {
    // Ensure all panels from default layout exist
    const merged: LayoutConfig = {
      name: loaded.name || this.currentLayout.name,
      panels: { ...this.currentLayout.panels },
      viewport: loaded.viewport || this.currentLayout.viewport,
    };

    // Merge loaded panel states
    Object.keys(loaded.panels).forEach(panelId => {
      if (merged.panels[panelId]) {
        merged.panels[panelId] = {
          ...merged.panels[panelId],
          ...loaded.panels[panelId],
        };
      }
    });

    return merged;
  }

  /**
   * Reset to default layout
   */
  resetLayout(): void {
    // This would need the original default layout passed in constructor
    // For now, just clear localStorage
    localStorage.removeItem(this.storageKey);
    this.loadLayout();
    this.emitEvent({ type: 'layout-changed', layout: this.currentLayout });
  }

  /**
   * Subscribe to layout events
   */
  subscribe(listener: LayoutEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Emit layout event
   */
  private emitEvent(event: LayoutEvent): void {
    this.listeners.forEach(listener => listener(event));
  }

  /**
   * Create default layout from panel definitions
   */
  static createDefaultLayout(
    name: string,
    panels: PanelDefinition[]
  ): LayoutConfig {
    const panelStates: Record<string, PanelState> = {};

    panels.forEach(panel => {
      panelStates[panel.id] = {
        id: panel.id,
        position: panel.defaultPosition,
        width: panel.defaultWidth,
        height: panel.defaultHeight,
        visible: true,
        collapsed: panel.defaultCollapsed || false,
      };
    });

    return {
      name,
      panels: panelStates,
    };
  }
}
