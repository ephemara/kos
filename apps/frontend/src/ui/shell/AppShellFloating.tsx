/**
 * AppShellFloating — AppShell variant with floating dock system
 * ─────────────────────────────────────────────────────────────────────────────
 * Drop-in replacement for AppShell that uses FloatingDock instead of fixed panels
 */

import React from 'react';
import { Menu } from 'lucide-react';
import { cn } from '@/ui/primitives/cn';
import { Button } from '@/ui/primitives/Button';
import { FloatingDock, FloatingDockTab } from './FloatingDock';
import { useHotkeys } from 'react-hotkeys-hook';
import { GlobalCommandPalette } from './GlobalCommandPalette';
import { PerfHud } from '@/ui/widgets/PerfHud';
import { LookdevHud } from '@/ui/lookdev/LookdevHud';
import { bindLookdevToActiveStage, initLookdevStore } from '@/ui/lookdev/lookdevStore';
import { UiStudioHud, getUiStudioWidgetRegistry, setUiStudioOpen } from '../studio';

export type AppShellFloatingProps = {
    layoutKey: string;
    menuBar?: React.ReactNode;
    menuBarDefaultOpen?: boolean;
    topBar?: React.ReactNode;
    dockTabs?: FloatingDockTab[];
    defaultDockLayout?: 'left-right' | 'top-bottom' | 'single';
    children: React.ReactNode;
    statusBar?: React.ReactNode;
    className?: string;
};

type LayoutPreset = 'standard' | 'focus' | 'wide';

export function AppShellFloating({
    layoutKey,
    menuBar,
    menuBarDefaultOpen = false,
    topBar,
    dockTabs = [],
    defaultDockLayout = 'left-right',
    children,
    statusBar,
    className
}: AppShellFloatingProps) {
    const [menuBarOpen, setMenuBarOpen] = React.useState(menuBarDefaultOpen);
    const [layoutPreset, setLayoutPreset] = React.useState<LayoutPreset>('standard');
    const [cmdOpen, setCmdOpen] = React.useState(false);
    const [perfHudOpen, setPerfHudOpen] = React.useState(false);
    const [lookdevOpen, setLookdevOpen] = React.useState(false);
    const [uiStudioOpen, setUiStudioOpenLocal] = React.useState(false);

    useHotkeys('ctrl+k, meta+k', (e) => {
        e.preventDefault();
        setCmdOpen((v) => !v);
    });

    useHotkeys('f8', (e) => {
        e.preventDefault();
        setPerfHudOpen((v) => !v);
    });

    useHotkeys('f9', (e) => {
        e.preventDefault();
        setLookdevOpen((v) => !v);
    });

    useHotkeys('f10', (e) => {
        e.preventDefault();
        setUiStudioOpenLocal((v) => {
            const next = !v;
            setUiStudioOpen(next);
            return next;
        });
    });

    const lookdevAppKey = React.useMemo(() => layoutKey, [layoutKey]);
    const uiStudioRegistry = React.useMemo(() => getUiStudioWidgetRegistry(), []);

    React.useEffect(() => {
        initLookdevStore();
        const unbind = bindLookdevToActiveStage(() => lookdevAppKey);
        return () => { unbind(); };
    }, [lookdevAppKey]);

    return (
        <div className={cn('h-full w-full flex flex-col overflow-hidden bg-[#050505]', className)}>
            {/* TOP BAR */}
            {(menuBar || topBar) && (
                <div className="flex-none z-40 flex items-stretch border-b border-[#1a1a1a]">
                    {menuBar && (
                        <div className="flex items-center gap-0 shrink-0 border-r border-[#1a1a1a]">
                            <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => setMenuBarOpen((v) => !v)}
                                className="h-full w-10 rounded-none"
                                aria-label={menuBarOpen ? 'Hide menu bar' : 'Show menu bar'}
                            >
                                <Menu size={15} />
                            </Button>
                            {menuBarOpen && (
                                <div className="min-w-0 px-2">{menuBar}</div>
                            )}
                        </div>
                    )}
                    {topBar && (
                        <div className="flex-1 min-w-0">{topBar}</div>
                    )}
                </div>
            )}

            {/* MAIN BODY WITH FLOATING DOCK */}
            <div className="flex-1 min-h-0 relative">
                {dockTabs.length > 0 ? (
                    <FloatingDock
                        layoutKey={layoutKey}
                        tabs={dockTabs}
                        defaultLayout={defaultDockLayout}
                    />
                ) : (
                    <div className="absolute inset-0 overflow-hidden">
                        {children}
                    </div>
                )}
                
                {/* Viewport overlay (when using dock) */}
                {dockTabs.length > 0 && (
                    <div className="absolute inset-0 pointer-events-none">
                        <div className="h-full w-full pointer-events-auto">
                            {children}
                        </div>
                    </div>
                )}
            </div>

            {/* STATUS BAR */}
            {statusBar && (
                <div className="h-6 w-full bg-[#080808] border-t border-[#1a1a1a] flex items-center px-2 text-[10px] text-gray-400 select-none cursor-default">
                    {statusBar}
                </div>
            )}

            {/* GLOBAL OVERLAYS */}
            <GlobalCommandPalette
                open={cmdOpen}
                onOpenChange={setCmdOpen}
                onSelectLayout={setLayoutPreset}
                onTogglePerfHud={() => setPerfHudOpen((v) => !v)}
                onToggleLookdev={() => setLookdevOpen((v) => !v)}
                onToggleUiStudio={() =>
                    setUiStudioOpenLocal((v) => {
                        const next = !v;
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
                appKey={layoutKey}
                registry={uiStudioRegistry}
            />
        </div>
    );
}
