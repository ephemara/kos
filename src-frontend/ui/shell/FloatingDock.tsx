/**
 * FloatingDock — Full-featured docking system with floating windows
 * ─────────────────────────────────────────────────────────────────────────────
 * Built on rc-dock for:
 *  - Drag panels to detach into floating windows
 *  - Re-dock by dragging back to dock zones
 *  - Multi-tab support in panels
 *  - Persistent layout state
 *  - Maximize/minimize/close controls
 */

import React from 'react';
import DockLayout, { LayoutData, TabData, PanelData, BoxData } from 'rc-dock';
import 'rc-dock/dist/rc-dock.css';
import { cn } from '@/ui/primitives/cn';
import { LucideIcon } from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────────

export type FloatingDockTab = {
    id: string;
    title: string;
    icon?: LucideIcon;
    content: React.ReactNode;
    closable?: boolean;
    cached?: boolean;
};

export type FloatingDockProps = {
    layoutKey: string;
    tabs: FloatingDockTab[];
    defaultLayout?: 'left-right' | 'top-bottom' | 'single';
    onLayoutChange?: (layout: LayoutData) => void;
    className?: string;
};

// ─── Layout Builders ───────────────────────────────────────────────────────────

function buildDefaultLayout(
    tabs: FloatingDockTab[],
    mode: 'left-right' | 'top-bottom' | 'single' = 'left-right'
): LayoutData {
    if (tabs.length === 0) {
        return {
            dockbox: {
                mode: 'horizontal',
                children: []
            }
        };
    }

    const tabData: TabData[] = tabs.map(t => ({
        id: t.id,
        title: t.title,
        content: <div className="h-full w-full overflow-auto">{t.content}</div>,
        closable: t.closable ?? true,
        cached: t.cached ?? true,
    }));

    if (mode === 'single' || tabs.length === 1) {
        return {
            dockbox: {
                mode: 'horizontal',
                children: [
                    {
                        tabs: tabData,
                        activeId: tabs[0].id,
                    } as PanelData
                ]
            }
        };
    }

    const midpoint = Math.ceil(tabs.length / 2);
    const leftTabs = tabData.slice(0, midpoint);
    const rightTabs = tabData.slice(midpoint);

    if (mode === 'left-right') {
        return {
            dockbox: {
                mode: 'horizontal',
                children: [
                    {
                        size: 300,
                        tabs: leftTabs,
                        activeId: leftTabs[0].id,
                    } as PanelData,
                    {
                        size: 300,
                        tabs: rightTabs,
                        activeId: rightTabs[0].id,
                    } as PanelData
                ]
            }
        };
    }

    // top-bottom
    return {
        dockbox: {
            mode: 'vertical',
            children: [
                {
                    size: 300,
                    tabs: leftTabs,
                    activeId: leftTabs[0].id,
                } as PanelData,
                {
                    size: 300,
                    tabs: rightTabs,
                    activeId: rightTabs[0].id,
                } as PanelData
            ]
        }
    };
}

// ─── FloatingDock ──────────────────────────────────────────────────────────────

export function FloatingDock({
    layoutKey,
    tabs,
    defaultLayout = 'left-right',
    onLayoutChange,
    className,
}: FloatingDockProps) {
    const dockRef = React.useRef<DockLayout>(null);
    const [layout, setLayout] = React.useState<LayoutData>(() => {
        // Try to restore from localStorage
        try {
            const saved = localStorage.getItem(`kos-dock-layout-${layoutKey}`);
            if (saved) {
                const parsed = JSON.parse(saved);
                // Validate that saved tabs still exist
                const savedTabIds = new Set<string>();
                const extractTabIds = (node: any) => {
                    if (node.tabs) {
                        node.tabs.forEach((t: TabData) => savedTabIds.add(t.id));
                    }
                    if (node.children) {
                        node.children.forEach(extractTabIds);
                    }
                };
                extractTabIds(parsed.dockbox);
                
                const currentTabIds = new Set(tabs.map(t => t.id));
                const allTabsExist = Array.from(savedTabIds).every(id => currentTabIds.has(id));
                
                if (allTabsExist) {
                    // Update content for saved tabs
                    const updateContent = (node: any) => {
                        if (node.tabs) {
                            node.tabs = node.tabs.map((t: TabData) => {
                                const tab = tabs.find(tab => tab.id === t.id);
                                if (tab) {
                                    return {
                                        ...t,
                                        title: tab.title,
                                        content: <div className="h-full w-full overflow-auto">{tab.content}</div>,
                                        closable: tab.closable ?? true,
                                        cached: tab.cached ?? true,
                                    };
                                }
                                return t;
                            });
                        }
                        if (node.children) {
                            node.children.forEach(updateContent);
                        }
                    };
                    updateContent(parsed.dockbox);
                    return parsed;
                }
            }
        } catch (e) {
            console.warn('Failed to restore dock layout:', e);
        }
        
        return buildDefaultLayout(tabs, defaultLayout);
    });

    const handleLayoutChange = React.useCallback((newLayout: LayoutData) => {
        setLayout(newLayout);
        onLayoutChange?.(newLayout);
        
        // Persist to localStorage
        try {
            // Clone and remove React content before saving
            const toSave = JSON.parse(JSON.stringify(newLayout, (key, value) => {
                if (key === 'content') return undefined;
                return value;
            }));
            localStorage.setItem(`kos-dock-layout-${layoutKey}`, JSON.stringify(toSave));
        } catch (e) {
            console.warn('Failed to save dock layout:', e);
        }
    }, [layoutKey, onLayoutChange]);

    // Update layout when tabs change
    React.useEffect(() => {
        const updateTabContent = (node: any): boolean => {
            let changed = false;
            if (node.tabs) {
                node.tabs = node.tabs.map((t: TabData) => {
                    const tab = tabs.find(tab => tab.id === t.id);
                    if (tab) {
                        changed = true;
                        return {
                            ...t,
                            title: tab.title,
                            content: <div className="h-full w-full overflow-auto">{tab.content}</div>,
                            closable: tab.closable ?? true,
                            cached: tab.cached ?? true,
                        };
                    }
                    return t;
                });
            }
            if (node.children) {
                node.children.forEach((child: any) => {
                    if (updateTabContent(child)) changed = true;
                });
            }
            return changed;
        };

        const newLayout = { ...layout };
        if (updateTabContent(newLayout.dockbox)) {
            setLayout(newLayout);
        }
    }, [tabs]);

    return (
        <div className={cn('h-full w-full kos-floating-dock', className)}>
            <DockLayout
                ref={dockRef}
                layout={layout}
                onLayoutChange={handleLayoutChange}
                style={{ 
                    position: 'absolute',
                    inset: 0,
                }}
            />
        </div>
    );
}
