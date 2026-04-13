import { v4 as uuid } from 'uuid';
import type { KOSAppId, LayoutNode, PanelLeaf, PanelTab } from './universalStore';

export type UniversalViewportDriverPolicy = 'focused-panel';

export const UNIVERSAL_VIEWPORT_APP_ID: KOSAppId = 'viewport';
export const UNIVERSAL_FALLBACK_APP_ID: KOSAppId = 'properties';
export const UNIVERSAL_NEW_PANEL_DEFAULT_APP_ID: KOSAppId = 'assets';
export const UNIVERSAL_DEFAULT_PRIMITIVE_ID = 'sphere';
export const UNIVERSAL_VIEWPORT_OWNER_ID = 'universal.viewport';

export const UNIVERSAL_SUPPORTED_APP_IDS: readonly KOSAppId[] = [
  'viewport',
  'outliner',
  'properties',
  'timeline',
  'terminal',
  'assets',
  'kain',
] as const;

type LayoutSanitizeState = {
  hasViewportPanel: boolean;
};

export function isUniversalSupportedAppId(appId: KOSAppId | null): appId is KOSAppId {
  return appId != null && UNIVERSAL_SUPPORTED_APP_IDS.includes(appId);
}

export function findUniversalViewportPanel(root: LayoutNode): PanelLeaf | null {
  if (root.kind === 'panel') {
    return root.appId === UNIVERSAL_VIEWPORT_APP_ID ? root : null;
  }

  return findUniversalViewportPanel(root.a) ?? findUniversalViewportPanel(root.b);
}

export function getUniversalNewPanelAppId(root: LayoutNode): KOSAppId {
  return findUniversalViewportPanel(root) == null
    ? UNIVERSAL_VIEWPORT_APP_ID
    : UNIVERSAL_NEW_PANEL_DEFAULT_APP_ID;
}

export function sanitizeUniversalLayout(root: LayoutNode): LayoutNode {
  const state: LayoutSanitizeState = { hasViewportPanel: false };
  const sanitizedRoot = sanitizeUniversalNode(root, state);

  if (state.hasViewportPanel) {
    return sanitizedRoot;
  }

  return forceViewportIntoFirstPanel(sanitizedRoot);
}

function sanitizeUniversalNode(node: LayoutNode, state: LayoutSanitizeState): LayoutNode {
  if (node.kind === 'panel') {
    return sanitizeUniversalPanel(node, state);
  }

  return {
    ...node,
    a: sanitizeUniversalNode(node.a, state),
    b: sanitizeUniversalNode(node.b, state),
  };
}

function sanitizeUniversalPanel(panel: PanelLeaf, state: LayoutSanitizeState): PanelLeaf {
  const normalizedTabs = panel.tabs
    .map((tab) => normalizeUniversalTab(tab))
    .filter((tab): tab is PanelTab => tab != null);

  const viewportTab = normalizedTabs.find((tab) => tab.appId === UNIVERSAL_VIEWPORT_APP_ID);
  if (viewportTab) {
    if (!state.hasViewportPanel) {
      state.hasViewportPanel = true;
      return {
        ...panel,
        tabs: [viewportTab],
        activeTab: 0,
        appId: UNIVERSAL_VIEWPORT_APP_ID,
      };
    }

    const fallbackTabs = normalizedTabs.filter((tab) => tab.appId !== UNIVERSAL_VIEWPORT_APP_ID);
    return buildFallbackPanel(panel, fallbackTabs);
  }

  return buildFallbackPanel(panel, normalizedTabs);
}

function buildFallbackPanel(panel: PanelLeaf, tabs: PanelTab[]): PanelLeaf {
  const safeTabs = tabs.length > 0
    ? tabs
    : [{ id: panel.tabs[0]?.id ?? uuid(), appId: UNIVERSAL_FALLBACK_APP_ID }];
  const clampedActiveTab = Math.max(0, Math.min(panel.activeTab, safeTabs.length - 1));

  return {
    ...panel,
    tabs: safeTabs,
    activeTab: clampedActiveTab,
    appId: safeTabs[clampedActiveTab]?.appId ?? UNIVERSAL_FALLBACK_APP_ID,
  };
}

function normalizeUniversalTab(tab: PanelTab): PanelTab | null {
  if (isUniversalSupportedAppId(tab.appId)) {
    return tab;
  }

  return {
    ...tab,
    appId: UNIVERSAL_FALLBACK_APP_ID,
  };
}

function forceViewportIntoFirstPanel(node: LayoutNode): LayoutNode {
  if (node.kind === 'panel') {
    return {
      ...node,
      tabs: [{ id: node.tabs[0]?.id ?? uuid(), appId: UNIVERSAL_VIEWPORT_APP_ID }],
      activeTab: 0,
      appId: UNIVERSAL_VIEWPORT_APP_ID,
    };
  }

  return {
    ...node,
    a: forceViewportIntoFirstPanel(node.a),
  };
}
