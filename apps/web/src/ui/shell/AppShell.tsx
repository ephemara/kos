import React from 'react';
import { Menu } from 'lucide-react';
import { useHotkeys } from 'react-hotkeys-hook';
import { cn } from '@/ui/primitives/cn';
import { Button } from '@/ui/primitives/Button';
import { DockPanel, type DockTab } from './DockPanel';
import { GlobalCommandPalette } from './GlobalCommandPalette';
import { PerfHud } from '@/ui/widgets/PerfHud';
import { LookdevHud } from '@/ui/lookdev/LookdevHud';
import { bindLookdevToActiveStage, initLookdevStore } from '@/ui/lookdev/lookdevStore';
import { UiStudioHud, getUiStudioWidgetRegistry, setUiStudioOpen } from '../studio';
import { ResizeHandle } from './ResizeHandle';
import { AppViewport } from '@/ui/viewport/AppViewport';

export type AppShellProps = {
    layoutKey?: string;
    menuBar?: React.ReactNode;
    menuBarDefaultOpen?: boolean;
    topBar?: React.ReactNode;
    left?: {
        title?: string;
        tabs: DockTab[];
        defaultTabId?: string;
        defaultSize?: number;
        minSize?: number;
        collapsedSize?: number;
    };
    right?: {
        title?: string;
        tabs: DockTab[];
        defaultTabId?: string;
        defaultSize?: number;
        minSize?: number;
        collapsedSize?: number;
    };
    bottom?: React.ReactNode;
    bottomTabs?: DockTab[];
    bottomTitle?: string;
    bottomHeight?: number;
    centerTransparent?: boolean;
    children: React.ReactNode;
    statusBar?: React.ReactNode;
    className?: string;
};

type LayoutPreset = 'standard' | 'focus' | 'wide';
type WorkspacePanelPosition = 'left' | 'right' | 'bottom';
type WorkspaceLeafId = 'center' | WorkspacePanelPosition;
type WorkspacePanelConfig = {
    title?: string;
    tabs: DockTab[];
    defaultTabId?: string;
    defaultSize?: number;
    minSize?: number;
    collapsedSize?: number;
};

type WorkspacePanelState = {
    activeTabId: string;
    collapsed: boolean;
    size: number;
};

type WorkspaceState = {
    preset: LayoutPreset;
    panels: Partial<Record<WorkspacePanelPosition, WorkspacePanelState>>;
};

type WorkspaceNode =
    | { kind: 'leaf'; id: WorkspaceLeafId }
    | {
        kind: 'split';
        id: string;
        direction: 'horizontal' | 'vertical';
        fixed: 'a' | 'b';
        panelId: WorkspacePanelPosition;
        a: WorkspaceNode;
        b: WorkspaceNode;
    };

const PANEL_POSITIONS: WorkspacePanelPosition[] = ['left', 'right', 'bottom'];

function slugifyLayoutKey(raw: string | undefined): string {
    return String(raw ?? 'app')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '') || 'app';
}

function resolveDefaultTabId(config?: WorkspacePanelConfig): string {
    return config?.defaultTabId ?? config?.tabs?.[0]?.id ?? '';
}

function resolveSideSize(defaultSize: number | undefined, viewportWidth: number): number {
    return (viewportWidth * (defaultSize ?? 20)) / 100;
}

function resolveBottomSize(bottomHeight: number | undefined, viewportHeight: number): number {
    if (typeof bottomHeight !== 'number') return (viewportHeight * 25) / 100;
    if (bottomHeight <= 0) return 0;
    if (bottomHeight > 100) return bottomHeight;
    return (viewportHeight * bottomHeight) / 100;
}

function inferBottomTabLabel(bottomTitle: string | undefined, content: React.ReactNode): string {
    if (bottomTitle) return bottomTitle;
    if (React.isValidElement(content) && typeof content.type !== 'string') {
        const componentType = content.type as { displayName?: string; name?: string };
        const componentName = componentType.displayName ?? componentType.name ?? '';
        if (componentName) {
            return componentName
                .replace(/^K/, '')
                .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
                .replace(/\s+/g, ' ')
                .trim()
                .toUpperCase();
        }
    }
    return 'BOTTOM';
}

function buildBottomConfig(
    bottom: React.ReactNode,
    bottomTabs: DockTab[] | undefined,
    bottomTitle: string | undefined,
    layoutKey: string | undefined
): WorkspacePanelConfig | undefined {
    if (bottomTabs?.length) {
        return {
            title: bottomTitle ?? 'BOTTOM',
            tabs: bottomTabs,
            defaultTabId: bottomTabs[0]?.id,
            minSize: 14,
        };
    }

    if (!bottom) return undefined;

    const inferredLabel = inferBottomTabLabel(bottomTitle, bottom);
    const fallbackId = `${slugifyLayoutKey(layoutKey)}-bottom-panel`;

    return {
        title: bottomTitle ?? inferredLabel,
        tabs: [
            {
                id: fallbackId,
                label: inferredLabel,
                content: bottom,
            },
        ],
        defaultTabId: fallbackId,
        minSize: 14,
    };
}

function buildWorkspaceTree(options: {
    hasLeft: boolean;
    hasRight: boolean;
    hasBottom: boolean;
}): WorkspaceNode {
    let node: WorkspaceNode = { kind: 'leaf', id: 'center' };

    if (options.hasBottom) {
        node = {
            kind: 'split',
            id: 'workspace-center-bottom',
            direction: 'vertical',
            fixed: 'b',
            panelId: 'bottom',
            a: node,
            b: { kind: 'leaf', id: 'bottom' },
        };
    }

    if (options.hasLeft) {
        node = {
            kind: 'split',
            id: 'workspace-left',
            direction: 'horizontal',
            fixed: 'a',
            panelId: 'left',
            a: { kind: 'leaf', id: 'left' },
            b: node,
        };
    }

    if (options.hasRight) {
        node = {
            kind: 'split',
            id: 'workspace-right',
            direction: 'horizontal',
            fixed: 'b',
            panelId: 'right',
            a: node,
            b: { kind: 'leaf', id: 'right' },
        };
    }

    return node;
}

function createDefaultWorkspaceState(
    panelConfigs: Partial<Record<WorkspacePanelPosition, WorkspacePanelConfig>>,
    bottomHeight: number | undefined
): WorkspaceState {
    const viewportWidth = typeof window === 'undefined' ? 1600 : window.innerWidth;
    const viewportHeight = typeof window === 'undefined' ? 900 : window.innerHeight;

    return {
        preset: 'standard',
        panels: {
            left: panelConfigs.left ? {
                activeTabId: resolveDefaultTabId(panelConfigs.left),
                collapsed: false,
                size: resolveSideSize(panelConfigs.left.defaultSize, viewportWidth),
            } : undefined,
            right: panelConfigs.right ? {
                activeTabId: resolveDefaultTabId(panelConfigs.right),
                collapsed: false,
                size: resolveSideSize(panelConfigs.right.defaultSize, viewportWidth),
            } : undefined,
            bottom: panelConfigs.bottom ? {
                activeTabId: resolveDefaultTabId(panelConfigs.bottom),
                collapsed: false,
                size: resolveBottomSize(bottomHeight, viewportHeight),
            } : undefined,
        },
    };
}

function sanitizeWorkspaceState(
    raw: unknown,
    panelConfigs: Partial<Record<WorkspacePanelPosition, WorkspacePanelConfig>>,
    bottomHeight: number | undefined
): WorkspaceState {
    const defaults = createDefaultWorkspaceState(panelConfigs, bottomHeight);
    const parsed = typeof raw === 'object' && raw !== null ? raw as WorkspaceState : defaults;
    const preset = parsed.preset === 'focus' || parsed.preset === 'wide' ? parsed.preset : 'standard';

    const panels = PANEL_POSITIONS.reduce<WorkspaceState['panels']>((next, position) => {
        const config = panelConfigs[position];
        if (!config) return next;

        const fallback = defaults.panels[position]!;
        const persisted = parsed.panels?.[position];
        const activeTabId = typeof persisted?.activeTabId === 'string' && config.tabs.some((tab) => tab.id === persisted.activeTabId)
            ? persisted.activeTabId
            : fallback.activeTabId;
        const collapsed = position === 'bottom' ? false : Boolean(persisted?.collapsed);
        const size = typeof persisted?.size === 'number' && Number.isFinite(persisted.size)
            ? Math.max(0, persisted.size)
            : fallback.size;

        next[position] = {
            activeTabId,
            collapsed,
            size,
        };

        return next;
    }, {});

    return { preset, panels };
}

function applyLayoutPreset(
    preset: LayoutPreset,
    current: WorkspaceState,
    panelConfigs: Partial<Record<WorkspacePanelPosition, WorkspacePanelConfig>>,
    bottomHeight: number | undefined,
    container: HTMLDivElement | null
): WorkspaceState {
    const defaults = createDefaultWorkspaceState(panelConfigs, bottomHeight);
    const viewportWidth = container?.getBoundingClientRect().width || (typeof window === 'undefined' ? 1600 : window.innerWidth);
    const viewportHeight = container?.getBoundingClientRect().height || (typeof window === 'undefined' ? 900 : window.innerHeight);
    const next = sanitizeWorkspaceState(current, panelConfigs, bottomHeight);

    next.preset = preset;

    if (preset === 'focus') {
        for (const position of PANEL_POSITIONS) {
            if (!next.panels[position]) continue;
            if (position === 'bottom') {
                next.panels[position]!.size = 0;
                continue;
            }
            next.panels[position]!.collapsed = true;
        }
        return next;
    }

    for (const position of PANEL_POSITIONS) {
        const config = panelConfigs[position];
        const panel = next.panels[position];
        if (!config || !panel) continue;

        panel.collapsed = false;

        if (position === 'bottom') {
            panel.size = resolveBottomSize(bottomHeight, viewportHeight);
            continue;
        }

        if (preset === 'wide') {
            panel.size = position === 'left'
                ? viewportWidth * 0.15
                : viewportWidth * 0.35;
        } else {
            panel.size = defaults.panels[position]?.size ?? panel.size;
        }
    }

    return next;
}

export function AppShell({
    layoutKey,
    menuBar,
    menuBarDefaultOpen = false,
    topBar,
    left,
    right,
    bottom,
    bottomTabs,
    bottomTitle,
    bottomHeight,
    centerTransparent = false,
    children,
    statusBar,
    className,
}: AppShellProps) {
    const containerRef = React.useRef<HTMLDivElement>(null);
    const resizeStartRef = React.useRef<Record<WorkspacePanelPosition, number>>({
        left: 0,
        right: 0,
        bottom: 0,
    });

    const [menuBarOpen, setMenuBarOpen] = React.useState(menuBarDefaultOpen);
    const [cmdOpen, setCmdOpen] = React.useState(false);
    const [perfHudOpen, setPerfHudOpen] = React.useState(false);
    const [lookdevOpen, setLookdevOpen] = React.useState(false);
    const [uiStudioOpen, setUiStudioOpenLocal] = React.useState(false);
    const [isResizingPanels, setIsResizingPanels] = React.useState(false);

    const bottomConfig = React.useMemo(
        () => buildBottomConfig(bottom, bottomTabs, bottomTitle, layoutKey),
        [bottom, bottomTabs, bottomTitle, layoutKey]
    );

    const panelConfigs = React.useMemo<Partial<Record<WorkspacePanelPosition, WorkspacePanelConfig>>>(
        () => ({
            left: left?.tabs?.length ? left : undefined,
            right: right?.tabs?.length ? right : undefined,
            bottom: bottomConfig?.tabs?.length ? bottomConfig : undefined,
        }),
        [left, right, bottomConfig]
    );

    const persistBaseId = React.useMemo(() => {
        return `kos-workspace-${slugifyLayoutKey(layoutKey ?? left?.title ?? right?.title ?? bottomConfig?.title ?? 'app')}`;
    }, [layoutKey, left?.title, right?.title, bottomConfig?.title]);

    const lookdevAppKey = React.useMemo(() => slugifyLayoutKey(layoutKey ?? left?.title ?? right?.title ?? bottomConfig?.title ?? 'app'), [
        layoutKey,
        left?.title,
        right?.title,
        bottomConfig?.title,
    ]);
    const uiStudioAppKey = React.useMemo(() => layoutKey ?? lookdevAppKey, [layoutKey, lookdevAppKey]);
    const uiStudioRegistry = React.useMemo(() => getUiStudioWidgetRegistry(), []);
    const dockPrefsKey = React.useMemo(() => `${persistBaseId}-layout`, [persistBaseId]);

    const workspaceSchemaKey = React.useMemo(() => JSON.stringify({
        left: panelConfigs.left ? {
            title: panelConfigs.left.title,
            defaultTabId: panelConfigs.left.defaultTabId,
            defaultSize: panelConfigs.left.defaultSize,
            collapsedSize: panelConfigs.left.collapsedSize,
            tabs: panelConfigs.left.tabs.map((tab) => tab.id),
        } : null,
        right: panelConfigs.right ? {
            title: panelConfigs.right.title,
            defaultTabId: panelConfigs.right.defaultTabId,
            defaultSize: panelConfigs.right.defaultSize,
            collapsedSize: panelConfigs.right.collapsedSize,
            tabs: panelConfigs.right.tabs.map((tab) => tab.id),
        } : null,
        bottom: panelConfigs.bottom ? {
            title: panelConfigs.bottom.title,
            defaultTabId: panelConfigs.bottom.defaultTabId,
            tabs: panelConfigs.bottom.tabs.map((tab) => tab.id),
            bottomHeight,
        } : null,
    }), [panelConfigs, bottomHeight]);

    const [workspace, setWorkspace] = React.useState<WorkspaceState>(() => {
        try {
            const raw = localStorage.getItem(dockPrefsKey);
            if (!raw) return createDefaultWorkspaceState(panelConfigs, bottomHeight);
            return sanitizeWorkspaceState(JSON.parse(raw), panelConfigs, bottomHeight);
        } catch {
            return createDefaultWorkspaceState(panelConfigs, bottomHeight);
        }
    });

    React.useEffect(() => {
        setWorkspace((current) => sanitizeWorkspaceState(current, panelConfigs, bottomHeight));
    }, [workspaceSchemaKey]);

    React.useEffect(() => {
        try {
            localStorage.setItem(dockPrefsKey, JSON.stringify(workspace));
        } catch {
            // Ignore persistence failures in embedded or private contexts.
        }
    }, [dockPrefsKey, workspace]);

    React.useEffect(() => {
        initLookdevStore();
        const unbind = bindLookdevToActiveStage(() => lookdevAppKey);
        return () => {
            unbind();
        };
    }, [lookdevAppKey]);

    const dispatchWindowResize = React.useCallback(() => {
        requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
    }, []);

    const updatePanelState = React.useCallback((
        position: WorkspacePanelPosition,
        patch: Partial<WorkspacePanelState> | ((current: WorkspacePanelState) => WorkspacePanelState)
    ) => {
        setWorkspace((current) => {
            const panel = current.panels[position];
            if (!panel) return current;

            const nextPanel = typeof patch === 'function'
                ? patch(panel)
                : { ...panel, ...patch };

            if (
                nextPanel.activeTabId === panel.activeTabId &&
                nextPanel.collapsed === panel.collapsed &&
                nextPanel.size === panel.size
            ) {
                return current;
            }

            return {
                ...current,
                panels: {
                    ...current.panels,
                    [position]: nextPanel,
                },
            };
        });
    }, []);

    React.useEffect(() => {
        if (!panelConfigs.bottom || typeof bottomHeight !== 'number' || bottomHeight <= 0) return;
        updatePanelState('bottom', (panel) => {
            if (panel.size > 0) return panel;
            const rect = containerRef.current?.getBoundingClientRect();
            const viewportHeight = rect?.height || window.innerHeight;
            return {
                ...panel,
                size: resolveBottomSize(bottomHeight, viewportHeight),
            };
        });
    }, [bottomHeight, panelConfigs.bottom, updatePanelState]);

    const togglePanel = React.useCallback((position: Exclude<WorkspacePanelPosition, 'bottom'>) => {
        updatePanelState(position, (panel) => ({ ...panel, collapsed: !panel.collapsed }));
        dispatchWindowResize();
    }, [dispatchWindowResize, updatePanelState]);

    const resetPanelSize = React.useCallback((position: WorkspacePanelPosition) => {
        const config = panelConfigs[position];
        if (!config) return;

        const rect = containerRef.current?.getBoundingClientRect();
        const viewportWidth = rect?.width || window.innerWidth;
        const viewportHeight = rect?.height || window.innerHeight;
        const nextSize = position === 'bottom'
            ? resolveBottomSize(bottomHeight, viewportHeight)
            : resolveSideSize(config.defaultSize, viewportWidth);

        updatePanelState(position, (panel) => ({
            ...panel,
            collapsed: position === 'bottom' ? false : false,
            size: nextSize,
        }));
        dispatchWindowResize();
    }, [bottomHeight, dispatchWindowResize, panelConfigs, updatePanelState]);

    const handleResizeStart = React.useCallback((position: WorkspacePanelPosition) => {
        resizeStartRef.current[position] = workspace.panels[position]?.size ?? 0;
        setIsResizingPanels(true);
    }, [workspace.panels]);

    const handleResize = React.useCallback((position: WorkspacePanelPosition, delta: number) => {
        const config = panelConfigs[position];
        const panel = workspace.panels[position];
        const rect = containerRef.current?.getBoundingClientRect();
        if (!config || !panel || !rect) return;

        const horizontal = position === 'left' || position === 'right';
        const totalSize = horizontal ? rect.width : rect.height;
        const minSize = position === 'bottom'
            ? Math.max(120, totalSize * 0.14)
            : Math.max(140, totalSize * ((config.minSize ?? 14) / 100));
        const maxSize = totalSize * 0.8;
        const signedDelta = position === 'right' || position === 'bottom' ? -delta : delta;
        const nextSize = Math.max(minSize, Math.min(maxSize, resizeStartRef.current[position] + signedDelta));

        updatePanelState(position, {
            collapsed: false,
            size: nextSize,
        });
    }, [panelConfigs, updatePanelState, workspace.panels]);

    const handleResizeEnd = React.useCallback(() => {
        setIsResizingPanels(false);
        dispatchWindowResize();
    }, [dispatchWindowResize]);

    useHotkeys('ctrl+k, meta+k', (event) => {
        event.preventDefault();
        setCmdOpen((open) => !open);
    });

    useHotkeys('f8', (event) => {
        event.preventDefault();
        setPerfHudOpen((open) => !open);
    });

    useHotkeys('f9', (event) => {
        event.preventDefault();
        setLookdevOpen((open) => !open);
    });

    useHotkeys('f10', (event) => {
        event.preventDefault();
        setUiStudioOpenLocal((open) => {
            const next = !open;
            setUiStudioOpen(next);
            return next;
        });
    });

    const viewportHeight = typeof window === 'undefined' ? 900 : window.innerHeight;
    const hasBottom = Boolean(panelConfigs.bottom?.tabs.length && resolveBottomSize(bottomHeight, viewportHeight) > 0);
    const workspaceTree = React.useMemo(() => buildWorkspaceTree({
        hasLeft: Boolean(panelConfigs.left?.tabs.length),
        hasRight: Boolean(panelConfigs.right?.tabs.length),
        hasBottom,
    }), [panelConfigs.left, panelConfigs.right, hasBottom]);

    const renderPanelLeaf = React.useCallback((position: WorkspacePanelPosition) => {
        const config = panelConfigs[position];
        const panelState = workspace.panels[position];
        if (!config || !panelState) return null;

        const sharedProps = {
            title: config.title,
            tabs: config.tabs,
            defaultTabId: config.defaultTabId,
            activeTabId: panelState.activeTabId,
            onActiveTabIdChange: (tabId: string) => updatePanelState(position, { activeTabId: tabId }),
            onResetSize: () => resetPanelSize(position),
        };

        if (position === 'bottom') {
            return (
                <div className="h-full w-full overflow-hidden border-t border-[#1c1c1c] bg-[#0c0c0c]">
                    <DockPanel
                        side="left"
                        {...sharedProps}
                    />
                </div>
            );
        }

        return (
            <div className="h-full w-full overflow-hidden bg-[#0c0c0c]">
                <DockPanel
                    side={position}
                    {...sharedProps}
                    collapsed={panelState.collapsed}
                    onToggleCollapsed={() => togglePanel(position)}
                />
            </div>
        );
    }, [panelConfigs, resetPanelSize, togglePanel, updatePanelState, workspace.panels]);

    const renderWorkspaceNode = React.useCallback((node: WorkspaceNode): React.ReactNode => {
        if (node.kind === 'leaf') {
            if (node.id === 'center') {
                return (
                    <div className={cn('relative h-full w-full min-h-0 min-w-0', centerTransparent ? 'bg-transparent' : 'bg-[#050505]')}>
                        <div className="absolute inset-0 overflow-hidden">
                            <AppViewport />
                        </div>
                        <div className="absolute inset-0 overflow-hidden">
                            {children}
                        </div>
                    </div>
                );
            }

            return renderPanelLeaf(node.id);
        }

        const isHorizontal = node.direction === 'horizontal';
        const fixedConfig = panelConfigs[node.panelId];
        const fixedState = workspace.panels[node.panelId];
        if (!fixedConfig || !fixedState) {
            return node.fixed === 'a' ? renderWorkspaceNode(node.b) : renderWorkspaceNode(node.a);
        }

        const fixedSize = node.panelId === 'bottom'
            ? fixedState.size
            : (fixedState.collapsed ? (fixedConfig.collapsedSize ?? 56) : fixedState.size);

        const fixedStyle = isHorizontal
            ? { width: `${fixedSize}px` }
            : { height: `${fixedSize}px` };
        const containerClass = isHorizontal ? 'flex-row' : 'flex-col';
        const handle = (
            <ResizeHandle
                direction={isHorizontal ? 'horizontal' : 'vertical'}
                onResizeStart={() => handleResizeStart(node.panelId)}
                onResize={(delta) => handleResize(node.panelId, delta)}
                onResizeEnd={handleResizeEnd}
                aria-label={`Resize ${node.panelId} panel`}
                className={cn(
                    isHorizontal ? 'shadow-[1px_0_0_#1a1a1a]' : 'shadow-[0_1px_0_#1a1a1a]',
                    isResizingPanels ? 'opacity-100' : undefined
                )}
            />
        );

        if (node.fixed === 'a') {
            return (
                <div className={cn('flex h-full w-full min-h-0 min-w-0', containerClass)}>
                    <div className="shrink-0 min-h-0 min-w-0 overflow-hidden" style={fixedStyle}>
                        {renderWorkspaceNode(node.a)}
                    </div>
                    {handle}
                    <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
                        {renderWorkspaceNode(node.b)}
                    </div>
                </div>
            );
        }

        return (
            <div className={cn('flex h-full w-full min-h-0 min-w-0', containerClass)}>
                <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
                    {renderWorkspaceNode(node.a)}
                </div>
                {handle}
                <div className="shrink-0 min-h-0 min-w-0 overflow-hidden" style={fixedStyle}>
                    {renderWorkspaceNode(node.b)}
                </div>
            </div>
        );
    }, [
        children,
        centerTransparent,
        handleResize,
        handleResizeEnd,
        handleResizeStart,
        isResizingPanels,
        panelConfigs,
        renderPanelLeaf,
        workspace.panels,
    ]);

    return (
        <div
            ref={containerRef}
            className={cn('flex h-full w-full flex-col overflow-hidden bg-[#050505] text-gray-200', className)}
        >
            {(menuBar || topBar) && (
                <div className="flex items-stretch border-b border-[#1a1a1a] bg-[#080808]">
                    {menuBar && (
                        <div className="flex shrink-0 items-center border-r border-[#1a1a1a]">
                            <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => setMenuBarOpen((open) => !open)}
                                className="h-full w-10 rounded-none"
                                aria-label={menuBarOpen ? 'Hide menu bar' : 'Show menu bar'}
                            >
                                <Menu size={15} />
                            </Button>
                            {menuBarOpen && (
                                <div className="min-w-0 px-2">
                                    {menuBar}
                                </div>
                            )}
                        </div>
                    )}
                    {topBar && (
                        <div className="min-w-0 flex-1">
                            {topBar}
                        </div>
                    )}
                </div>
            )}

            <div className="flex min-h-0 flex-1 flex-col">
                <div className="min-h-0 flex-1">
                    {renderWorkspaceNode(workspaceTree)}
                </div>

                {statusBar && (
                    <div className="flex h-6 items-center border-t border-[#1a1a1a] bg-[#080808] px-2 text-[10px] text-gray-400">
                        {statusBar}
                    </div>
                )}
            </div>

            <GlobalCommandPalette
                open={cmdOpen}
                onOpenChange={setCmdOpen}
                onSelectLayout={(preset) => {
                    setWorkspace((current) => applyLayoutPreset(preset, current, panelConfigs, bottomHeight, containerRef.current));
                    dispatchWindowResize();
                }}
                onTogglePerfHud={() => setPerfHudOpen((open) => !open)}
                onToggleLookdev={() => setLookdevOpen((open) => !open)}
                onToggleUiStudio={() =>
                    setUiStudioOpenLocal((open) => {
                        const next = !open;
                        setUiStudioOpen(next);
                        return next;
                    })
                }
            />

            <PerfHud open={perfHudOpen} onOpenChange={setPerfHudOpen} />
            <LookdevHud open={lookdevOpen} onOpenChange={setLookdevOpen} appKey={lookdevAppKey} />
            <UiStudioHud
                open={uiStudioOpen}
                onOpenChange={(open) => {
                    setUiStudioOpenLocal(open);
                    setUiStudioOpen(open);
                }}
                appKey={uiStudioAppKey}
                registry={uiStudioRegistry}
            />
        </div>
    );
}
