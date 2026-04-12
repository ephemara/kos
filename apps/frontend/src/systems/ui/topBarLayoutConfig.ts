/**
 * K_OS Top Bar Layout Configuration
 * 
 * Defines different top bar layout styles that users can choose from.
 * Similar pattern to appThemeConfig.ts for consistency.
 */

export type TopBarLayoutStyle = 'direct' | 'workflow';

export interface TopBarLayoutDefinition {
    id: TopBarLayoutStyle;
    name: string;
    description: string;
    icon: string; // Icon name for UI
}

/**
 * Available top bar layouts
 */
export const topBarLayouts: TopBarLayoutDefinition[] = [
    {
        id: 'direct',
        name: 'Direct Access',
        description: 'All apps visible in the top bar for quick access',
        icon: 'LayoutGrid',
    },
    {
        id: 'workflow',
        name: 'Workflow Groups',
        description: 'Apps grouped into workflow categories with dropdowns',
        icon: 'Layers',
    },
];

/**
 * Storage key for top bar layout preference
 */
export const TOPBAR_LAYOUT_KEY = 'kos-topbar-layout';

/**
 * Default layout (direct access is the new default)
 */
export const DEFAULT_TOPBAR_LAYOUT: TopBarLayoutStyle = 'direct';

/**
 * Get the current top bar layout preference
 */
export function getTopBarLayout(): TopBarLayoutStyle {
    try {
        const saved = localStorage.getItem(TOPBAR_LAYOUT_KEY);
        if (saved && ['direct', 'workflow'].includes(saved)) {
            return saved as TopBarLayoutStyle;
        }
    } catch {
        // Ignore localStorage errors
    }
    return DEFAULT_TOPBAR_LAYOUT;
}

/**
 * Set the top bar layout preference
 */
export function setTopBarLayout(layout: TopBarLayoutStyle): void {
    try {
        localStorage.setItem(TOPBAR_LAYOUT_KEY, layout);
    } catch {
        // Ignore localStorage errors
    }
}

/**
 * Get layout definition by id
 */
export function getLayoutDefinition(id: TopBarLayoutStyle): TopBarLayoutDefinition | undefined {
    return topBarLayouts.find(l => l.id === id);
}
