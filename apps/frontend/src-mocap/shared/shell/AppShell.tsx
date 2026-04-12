import React from 'react';
import {
    PanelGroup,
    Panel,
    PanelResizeHandle,
    type ImperativePanelHandle,
} from 'react-resizable-panels';
import { Menu, LayoutTemplate, Monitor, Maximize2 } from 'lucide-react';
import { cn } from '@mocap/shared/primitives/cn';
import { Button } from '@mocap/shared/primitives/Button';
import { DockPanel, type DockTab } from './DockPanel';
import * as Toolbar from '@mocap/shared/primitives/Toolbar';
import { useHotkeys } from 'react-hotkeys-hook';

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
    bottomHeight?: number; // default height percentage
    children: React.ReactNode;
    statusBar?: React.ReactNode;
    className?: string;
};

type LayoutPreset = 'standard' | 'focus' | 'wide';

export function AppShell({
    layoutKey,
    menuBar,
    menuBarDefaultOpen = false,
    topBar,
    left,
    right,
    bottom,
    bottomHeight,
    children,
    statusBar,
    className
}: AppShellProps) {
    const leftPanelRef = React.useRef<ImperativePanelHandle>(null);
    const rightPanelRef = React.useRef<ImperativePanelHandle>(null);

    const [leftCollapsed, setLeftCollapsed] = React.useState(false);
    const [rightCollapsed, setRightCollapsed] = React.useState(false);

    const [leftActiveTabId, setLeftActiveTabId] = React.useState(left?.defaultTabId ?? left?.tabs?.[0]?.id ?? '');
    const [rightActiveTabId, setRightActiveTabId] = React.useState(right?.defaultTabId ?? right?.tabs?.[0]?.id ?? '');

    const [menuBarOpen, setMenuBarOpen] = React.useState(menuBarDefaultOpen);
    const [layoutPreset, setLayoutPreset] = React.useState<LayoutPreset>('standard');

    const persistBaseId = React.useMemo(() => {
        const raw = layoutKey ?? left?.title ?? right?.title ?? 'app';
        const slug = String(raw)
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '');
        return `kos-appshell-${slug || 'app'}`;
    }, [layoutKey, left?.title, right?.title]);

    const dockPrefsKey = React.useMemo(() => `${persistBaseId}-dock-prefs`, [persistBaseId]);

    const resizeRafRef = React.useRef<number | null>(null);
    const dispatchWindowResize = React.useCallback(() => {
        if (resizeRafRef.current != null) {
            cancelAnimationFrame(resizeRafRef.current);
        }
        resizeRafRef.current = requestAnimationFrame(() => {
            window.dispatchEvent(new Event('resize'));
            resizeRafRef.current = null;
        });
    }, []);

    React.useEffect(() => {
        try {
            const raw = localStorage.getItem(dockPrefsKey);
            if (!raw) return;
            const parsed = JSON.parse(raw);
            if (parsed?.left?.collapsed != null) setLeftCollapsed(Boolean(parsed.left.collapsed));
            if (parsed?.right?.collapsed != null) setRightCollapsed(Boolean(parsed.right.collapsed));
            if (typeof parsed?.left?.activeTabId === 'string') setLeftActiveTabId(parsed.left.activeTabId);
            if (typeof parsed?.right?.activeTabId === 'string') setRightActiveTabId(parsed.right.activeTabId);
        } catch {
            // ignore
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dockPrefsKey]);

    // Apply Layout Presets
    React.useEffect(() => {
        const lp = leftPanelRef.current;
        const rp = rightPanelRef.current;
        if (!lp || !rp) return;

        if (layoutPreset === 'focus') {
            lp.collapse();
            rp.collapse();
        } else if (layoutPreset === 'wide') {
            lp.resize(15);
            lp.expand();
            rp.resize(35);
            rp.expand();
        } else if (layoutPreset === 'standard') {
            lp.resize(left?.defaultSize ?? 20);
            lp.expand();
            rp.resize(right?.defaultSize ?? 20);
            rp.expand();
        }
    }, [layoutPreset, left?.defaultSize, right?.defaultSize]);

    const writeDockPrefs = React.useCallback(
        (next: any) => {
            try {
                localStorage.setItem(dockPrefsKey, JSON.stringify(next));
            } catch {
                // ignore
            }
        },
        [dockPrefsKey]
    );

    const updateDockPrefs = React.useCallback(
        (partial: any) => {
            try {
                const raw = localStorage.getItem(dockPrefsKey);
                const current = raw ? JSON.parse(raw) : {};
                const next = {
                    ...current,
                    ...partial,
                    left: { ...(current.left ?? {}), ...(partial.left ?? {}) },
                    right: { ...(current.right ?? {}), ...(partial.right ?? {}) },
                };
                writeDockPrefs(next);
            } catch {
                writeDockPrefs(partial);
            }
        },
        [dockPrefsKey, writeDockPrefs]
    );

    React.useEffect(() => {
        const p = leftPanelRef.current;
        if (!p) return;
        if (leftCollapsed) p.collapse();
        else p.expand();
        dispatchWindowResize();
    }, [dispatchWindowResize, leftCollapsed]);

    React.useEffect(() => {
        const p = rightPanelRef.current;
        if (!p) return;
        if (rightCollapsed) p.collapse();
        else p.expand();
        dispatchWindowResize();
    }, [dispatchWindowResize, rightCollapsed]);

    const toggleLeft = React.useCallback(() => {
        const p = leftPanelRef.current;
        if (!p) return;
        if (leftCollapsed) {
            p.expand();
            setLeftCollapsed(false);
            updateDockPrefs({ left: { collapsed: false } });
        } else {
            p.collapse();
            setLeftCollapsed(true);
            updateDockPrefs({ left: { collapsed: true } });
        }
        dispatchWindowResize();
    }, [dispatchWindowResize, leftCollapsed]);

    const toggleRight = React.useCallback(() => {
        const p = rightPanelRef.current;
        if (!p) return;
        if (rightCollapsed) {
            p.expand();
            setRightCollapsed(false);
            updateDockPrefs({ right: { collapsed: false } });
        } else {
            p.collapse();
            setRightCollapsed(true);
            updateDockPrefs({ right: { collapsed: true } });
        }
        dispatchWindowResize();
    }, [dispatchWindowResize, rightCollapsed]);

    const resetLeftSize = React.useCallback(() => {
        const p = leftPanelRef.current;
        if (!p) return;
        if (leftCollapsed) {
            p.expand();
            setLeftCollapsed(false);
        }
        (p as any).resize(left?.defaultSize ?? 20);
        dispatchWindowResize();
    }, [dispatchWindowResize, left?.defaultSize, leftCollapsed]);

    const resetRightSize = React.useCallback(() => {
        const p = rightPanelRef.current;
        if (!p) return;
        if (rightCollapsed) {
            p.expand();
            setRightCollapsed(false);
        }
        (p as any).resize(right?.defaultSize ?? 20);
        dispatchWindowResize();
    }, [dispatchWindowResize, right?.defaultSize, rightCollapsed]);

    return (
        <div className={cn('h-full w-full flex flex-col overflow-hidden bg-[#050505]', className)}>
            <div className="flex-1 min-h-0 relative">
                <PanelGroup
                    direction="horizontal"
                    autoSaveId={persistBaseId}
                    className="h-full w-full"
                    onLayout={() => dispatchWindowResize()}
                >
                    {/* LEFT PANEL */}
                    {left?.tabs?.length ? (
                        <>
                            <Panel
                                ref={leftPanelRef}
                                collapsible
                                collapsedSize={left.collapsedSize ?? 4}
                                defaultSize={left.defaultSize ?? 20}
                                minSize={left.minSize ?? 12}
                                className="min-w-[56px] bg-[#0a0a0a]"
                                onCollapse={() => {
                                    setLeftCollapsed(true);
                                    updateDockPrefs({ left: { collapsed: true } });
                                }}
                                onExpand={() => {
                                    setLeftCollapsed(false);
                                    updateDockPrefs({ left: { collapsed: false } });
                                }}
                            >
                                <DockPanel
                                    side="left"
                                    title={left.title}
                                    tabs={left.tabs}
                                    defaultTabId={left.defaultTabId}
                                    activeTabId={leftActiveTabId}
                                    onActiveTabIdChange={(tabId) => {
                                        setLeftActiveTabId(tabId);
                                        updateDockPrefs({ left: { activeTabId: tabId } });
                                    }}
                                    collapsed={leftCollapsed}
                                    onToggleCollapsed={toggleLeft}
                                    onResetSize={resetLeftSize}
                                />
                            </Panel>
                            <PanelResizeHandle className="w-1 bg-[#0b0b0b] hover:bg-orange-500/50 transition-colors data-[resize-handle-active]:bg-orange-500 shadow-[1px_0_0_#1a1a1a]" />
                        </>
                    ) : null}

                    {/* CENTER CONTENT */}
                    <Panel defaultSize={60} minSize={20} className="min-w-0">
                        <div className="relative h-full w-full bg-[#050505] flex flex-col">
                            {/* TOP BAR / MENU BAR AREA */}
                            {menuBar || topBar ? (
                                <div className="flex-none z-40 flex items-start gap-3 p-3 pb-0">
                                    {menuBar ? (
                                        <div className="flex items-center gap-2">
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                onClick={() => setMenuBarOpen((v) => !v)}
                                                aria-label={menuBarOpen ? 'Hide menu bar' : 'Show menu bar'}
                                            >
                                                <Menu size={16} />
                                            </Button>
                                            {menuBarOpen ? <div className="min-w-0">{menuBar}</div> : null}
                                        </div>
                                    ) : null}

                                    {/* Main Top Bar: Flex-1 to take available space, min-w-0 to allow shrinking */}
                                    {topBar ? <div className="flex-1 min-w-0">{topBar}</div> : null}

                                    {/* LAYOUT CONTROLS: Flex-none to keep strict size */}
                                    <div className="flex-none h-14 flex items-center px-1 bg-black/40 border border-[#222] rounded-xl backdrop-blur-md">
                                        <Toolbar.Root className="w-auto h-auto bg-transparent border-none shadow-none p-0 flex items-center justify-center gap-1">
                                            <Toolbar.ToggleGroup type="single" value={layoutPreset} onValueChange={(v) => v && setLayoutPreset(v as LayoutPreset)}>
                                                <Toolbar.ToggleItem value="standard" tooltip="Standard Layout">
                                                    <LayoutTemplate size={14} />
                                                </Toolbar.ToggleItem>
                                                <Toolbar.ToggleItem value="focus" tooltip="Focus Mode">
                                                    <Maximize2 size={14} />
                                                </Toolbar.ToggleItem>
                                                <Toolbar.ToggleItem value="wide" tooltip="Wide Layout">
                                                    <Monitor size={14} />
                                                </Toolbar.ToggleItem>
                                            </Toolbar.ToggleGroup>
                                        </Toolbar.Root>
                                    </div>
                                </div>
                            ) : null}

                            {/* CONTENT AREA */}
                            <div className="flex-1 min-h-0 relative">
                                {bottom ? (
                                    <PanelGroup direction="vertical" className="h-full w-full" autoSaveId={`${persistBaseId}-bottom`}>
                                        <Panel className="relative">
                                            <div className="absolute inset-0 overflow-hidden">
                                                {children}
                                            </div>
                                        </Panel>
                                        <PanelResizeHandle className="h-1 bg-[#0b0b0b] hover:bg-orange-500/50 transition-colors data-[resize-handle-active]:bg-orange-500 shadow-[0_1px_0_#1a1a1a]" />
                                        <Panel defaultSize={bottomHeight ?? 25} minSize={10} collapsible onCollapse={() => { }} onExpand={() => { }}>
                                            <div className="h-full w-full overflow-hidden bg-[#0a0a0a] border-t border-[#222]">
                                                {bottom}
                                            </div>
                                        </Panel>
                                    </PanelGroup>
                                ) : (
                                    <div className="absolute inset-0 overflow-hidden">
                                        {children}
                                    </div>
                                )}
                            </div>
                        </div>
                    </Panel>

                    {/* RIGHT PANEL */}
                    {right?.tabs?.length ? (
                        <>
                            <PanelResizeHandle className="w-1 bg-[#0b0b0b] hover:bg-orange-500/50 transition-colors data-[resize-handle-active]:bg-orange-500 shadow-[-1px_0_0_#1a1a1a]" />
                            <Panel
                                ref={rightPanelRef}
                                collapsible
                                collapsedSize={right.collapsedSize ?? 4}
                                defaultSize={right.defaultSize ?? 20}
                                minSize={right.minSize ?? 12}
                                className="min-w-[56px] bg-[#0a0a0a]"
                                onCollapse={() => {
                                    setRightCollapsed(true);
                                    updateDockPrefs({ right: { collapsed: true } });
                                }}
                                onExpand={() => {
                                    setRightCollapsed(false);
                                    updateDockPrefs({ right: { collapsed: false } });
                                }}
                            >
                                <DockPanel
                                    side="right"
                                    title={right.title}
                                    tabs={right.tabs}
                                    defaultTabId={right.defaultTabId}
                                    activeTabId={rightActiveTabId}
                                    onActiveTabIdChange={(tabId) => {
                                        setRightActiveTabId(tabId);
                                        updateDockPrefs({ right: { activeTabId: tabId } });
                                    }}
                                    collapsed={rightCollapsed}
                                    onToggleCollapsed={toggleRight}
                                    onResetSize={resetRightSize}
                                />
                            </Panel>
                        </>
                    ) : null}
                </PanelGroup>
            </div>

            {/* STATUS BAR */}
            {statusBar && (
                <div className="h-6 w-full bg-[#080808] border-t border-[#222] flex items-center px-2 text-[10px] text-gray-400 select-none cursor-default">
                    {statusBar}
                </div>
            )}
        </div>
    );
}
