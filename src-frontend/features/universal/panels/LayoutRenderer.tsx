/**
 * LayoutRenderer.tsx — Recursive Binary-Tree Panel Layout Engine
 *
 * Renders the binary split-tree into actual DOM panels, handling:
 *   • Recursive H/V panel splitting
 *   • Drag-to-resize split handles
 *   • Fullscreen override
 *   • Focus management
 */

import React, { useCallback, useRef, useEffect, useState } from 'react';
import {
    LayoutNode, SplitNode, PanelLeaf, KOSAppId,
    setRatio, splitPanel, closePanel, setApp, mapNode,
} from '../universalStore';
import { PanelHost } from './PanelHost';

// ─── Split divider (draggable handle) ────────────────────────────────────────

interface SplitHandleProps {
    direction: 'horizontal' | 'vertical';
    onDrag: (delta: { x: number; y: number }) => void;
}

function SplitHandle({ direction, onDrag }: SplitHandleProps) {
    const dragging = useRef(false);
    const last = useRef({ x: 0, y: 0 });

    const onPointerDown = useCallback((e: React.PointerEvent) => {
        e.preventDefault();
        dragging.current = true;
        last.current = { x: e.clientX, y: e.clientY };
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
    }, []);

    const onPointerMove = useCallback((e: React.PointerEvent) => {
        if (!dragging.current) return;
        const dx = e.clientX - last.current.x;
        const dy = e.clientY - last.current.y;
        last.current = { x: e.clientX, y: e.clientY };
        onDrag({ x: dx, y: dy });
    }, [onDrag]);

    const onPointerUp = useCallback(() => {
        dragging.current = false;
    }, []);

    const isH = direction === 'horizontal';

    return (
        <div
            className={`group relative flex-shrink-0 flex items-center justify-center
                        transition-colors z-10
                        ${isH ? 'w-[5px] cursor-col-resize' : 'h-[5px] cursor-row-resize'}`}
            style={{ background: 'transparent' }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
        >
            {/* Visual line */}
            <div className={`transition-colors duration-150
                             ${isH ? 'w-px h-full' : 'h-px w-full'}
                             bg-white/[0.04] group-hover:bg-orange-500/40 group-active:bg-orange-500/70`} />
            {/* Hover zone hotspot */}
            <div className={`absolute inset-0 ${isH ? 'mx-[-2px]' : 'my-[-2px]'}`} />
        </div>
    );
}

// ─── Recursive Renderer ───────────────────────────────────────────────────────

interface LayoutRendererProps {
    node: LayoutNode;
    root: LayoutNode;
    focusedPanel: string | null;
    fullscreen: string | null;
    sharedState: Record<string, any>;
    bridgeProps: Record<string, any>;
    containerRef: React.RefObject<HTMLDivElement>;
    onRootChange: (newRoot: LayoutNode) => void;
    onFocusPanel: (id: string) => void;
    onFullscreen: (id: string | null) => void;
}

export function LayoutRenderer({
    node, root, focusedPanel, fullscreen,
    sharedState, bridgeProps, containerRef,
    onRootChange, onFocusPanel, onFullscreen,
}: LayoutRendererProps) {

    if (node.kind === 'split') {
        const sp = node as SplitNode;
        const isH = sp.direction === 'horizontal';

        const handleDrag = useCallback(({ x, y }: { x: number; y: number }) => {
            const container = containerRef.current;
            if (!container) return;
            const rect = container.getBoundingClientRect();
            const totalPx = isH ? rect.width : rect.height;
            const deltaPx = isH ? x : y;
            const newRatio = sp.ratio + deltaPx / totalPx;
            onRootChange(setRatio(root, sp.id, newRatio));
        }, [sp.ratio, sp.id, isH, root, onRootChange]);

        const aFlex = sp.ratio;
        const bFlex = 1 - sp.ratio;

        return (
            <div className={`flex w-full h-full ${isH ? 'flex-row' : 'flex-col'}`}>
                <div style={{ flex: aFlex, overflow: 'hidden', minWidth: 0, minHeight: 0 }}>
                    <LayoutRenderer
                        node={sp.a} root={root}
                        focusedPanel={focusedPanel} fullscreen={fullscreen}
                        sharedState={sharedState} bridgeProps={bridgeProps}
                        containerRef={containerRef}
                        onRootChange={onRootChange} onFocusPanel={onFocusPanel}
                        onFullscreen={onFullscreen}
                    />
                </div>
                <SplitHandle direction={sp.direction} onDrag={handleDrag} />
                <div style={{ flex: bFlex, overflow: 'hidden', minWidth: 0, minHeight: 0 }}>
                    <LayoutRenderer
                        node={sp.b} root={root}
                        focusedPanel={focusedPanel} fullscreen={fullscreen}
                        sharedState={sharedState} bridgeProps={bridgeProps}
                        containerRef={containerRef}
                        onRootChange={onRootChange} onFocusPanel={onFocusPanel}
                        onFullscreen={onFullscreen}
                    />
                </div>
            </div>
        );
    }

    // Leaf panel
    const panel = node as PanelLeaf;
    const isFocused = focusedPanel === panel.id;
    const isFullscreen = fullscreen === panel.id;

    const handleSplit = useCallback((dir: 'horizontal' | 'vertical') => {
        onRootChange(splitPanel(root, panel.id, dir, 'viewport'));
    }, [root, panel.id, onRootChange]);

    const handleClose = useCallback(() => {
        onRootChange(closePanel(root, panel.id));
    }, [root, panel.id, onRootChange]);

    const handleAppChange = useCallback((appId: KOSAppId) => {
        onRootChange(setApp(root, panel.id, appId));
    }, [root, panel.id, onRootChange]);

    const handleTabSelect = useCallback((i: number) => {
        onRootChange(mapNode(root, panel.id, (n) => {
            if (n.kind !== 'panel') return n;
            return { ...n, activeTab: i, appId: n.tabs[i].appId };
        }));
    }, [root, panel.id, onRootChange]);

    const handleTabClose = useCallback((i: number) => {
        onRootChange(mapNode(root, panel.id, (n) => {
            if (n.kind !== 'panel') return n;
            const tabs = n.tabs.filter((_, idx) => idx !== i);
            const activeTab = Math.min(n.activeTab, tabs.length - 1);
            return { ...n, tabs, activeTab, appId: tabs[activeTab]?.appId ?? null };
        }));
    }, [root, panel.id, onRootChange]);

    const hostContent = (
        <PanelHost
            panel={panel}
            focused={isFocused}
            sharedState={sharedState}
            bridgeProps={bridgeProps}
            onFocus={() => onFocusPanel(panel.id)}
            onSplitH={() => handleSplit('horizontal')}
            onSplitV={() => handleSplit('vertical')}
            onClose={handleClose}
            onFullscreen={() => onFullscreen(isFullscreen ? null : panel.id)}
            onAppChange={handleAppChange}
            onTabSelect={handleTabSelect}
            onTabClose={handleTabClose}
        />
    );

    if (isFullscreen) {
        return (
            <div className="absolute inset-0 z-50 bg-[#080810]">
                {hostContent}
            </div>
        );
    }

    return (
        <div className="w-full h-full overflow-hidden">
            {hostContent}
        </div>
    );
}
