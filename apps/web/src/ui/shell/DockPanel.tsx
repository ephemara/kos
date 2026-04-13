/**
 * DockPanel — Animated side-panel with tabs
 * ─────────────────────────────────────────────────────────────────────────────
 * Improvements over previous version:
 *  - Tab content transitions: AnimatePresence fade+slide between tabs
 *  - Active tab indicator is a motion.div with layoutId (slides along the tab bar)
 *  - Collapsed mode: spring scale on icon buttons, stagger reveal on expand
 *  - Tooltip delay shortened to 250ms
 *  - Context menu appearance uses CSS animation token from global.css
 */

import React from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import * as ContextMenu from '@radix-ui/react-context-menu';
import * as Tooltip from '@radix-ui/react-tooltip';
import { motion, AnimatePresence } from 'framer-motion';
import { LucideIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/ui/primitives/cn';

// ─── Types ─────────────────────────────────────────────────────────────────────

export type DockTab = {
    id: string;
    label: string;
    icon?: LucideIcon;
    content: React.ReactNode;
};

export type DockPanelProps = {
    side: 'left' | 'right';
    title?: string;
    tabs: DockTab[];
    defaultTabId?: string;
    activeTabId?: string;
    onActiveTabIdChange?: (tabId: string) => void;
    collapsed?: boolean;
    onToggleCollapsed?: () => void;
    onResetSize?: () => void;
    className?: string;
};

// ─── Spring presets ────────────────────────────────────────────────────────────

const PILL_SPRING = { type: 'spring', stiffness: 480, damping: 34, mass: 0.7 } as const;
const ICON_SPRING = { type: 'spring', stiffness: 560, damping: 28, mass: 0.6 } as const;
const CONTENT_ANIM = { duration: 0.22, ease: [0.16, 1, 0.3, 1] } as const;

// ─── DockPanel ─────────────────────────────────────────────────────────────────

export function DockPanel({
    side,
    title,
    tabs,
    defaultTabId,
    activeTabId: activeTabIdProp,
    onActiveTabIdChange,
    collapsed,
    onToggleCollapsed,
    onResetSize,
    className,
}: DockPanelProps) {
    const firstTabId = tabs[0]?.id ?? '';
    const [uncontrolledActiveTabId, setUncontrolledActiveTabId] = React.useState(defaultTabId ?? firstTabId);
    const activeTabId = activeTabIdProp ?? uncontrolledActiveTabId;

    const setActiveTabId = React.useCallback(
        (nextId: string) => {
            if (activeTabIdProp == null) setUncontrolledActiveTabId(nextId);
            onActiveTabIdChange?.(nextId);
        },
        [activeTabIdProp, onActiveTabIdChange]
    );

    // Recover to first tab when active tab is removed
    React.useEffect(() => {
        if (!tabs.some((t) => t.id === activeTabId)) {
            setActiveTabId(defaultTabId ?? tabs[0]?.id ?? '');
        }
    }, [tabs, activeTabId, defaultTabId, setActiveTabId]);

    const isRight          = side === 'right';
    const tooltipSide: Tooltip.TooltipContentProps['side'] = isRight ? 'left' : 'right';
    const hasContextActions = Boolean(onToggleCollapsed || onResetSize);

    // ── Context menu (shared across tab triggers) ─────────────────────────────
    const contextMenuContent = hasContextActions ? (
        <ContextMenu.Portal>
            <ContextMenu.Content
                className={cn(
                    'z-50 min-w-[160px] rounded-lg border border-[#2a2a2a] bg-[#0e0e0e] p-1 shadow-2xl kos-enter',
                    'text-[11px] font-bold text-gray-400'
                )}
            >
                {onToggleCollapsed && (
                    <ContextMenu.Item
                        onSelect={e => { e.preventDefault(); onToggleCollapsed(); }}
                        className="cursor-default select-none rounded-md px-2.5 py-2 outline-none hover:bg-white/5 hover:text-white transition-colors"
                    >
                        {collapsed ? 'Expand Panel' : 'Collapse Panel'}
                    </ContextMenu.Item>
                )}
                {onResetSize && (
                    <ContextMenu.Item
                        onSelect={e => { e.preventDefault(); onResetSize(); }}
                        className="cursor-default select-none rounded-md px-2.5 py-2 outline-none hover:bg-white/5 hover:text-white transition-colors"
                    >
                        Reset Width
                    </ContextMenu.Item>
                )}
            </ContextMenu.Content>
        </ContextMenu.Portal>
    ) : null;

    // ─── COLLAPSED ─────────────────────────────────────────────────────────────
    if (collapsed) {
        return (
            <div className={cn(
                'h-full w-full bg-[#0c0c0c] flex flex-col',
                isRight ? 'border-l border-[#1c1c1c]' : 'border-r border-[#1c1c1c]',
                className
            )}>
                {/* Expand button */}
                <div className={cn('h-10 flex items-center shrink-0 px-1.5', isRight ? 'justify-start' : 'justify-end')}>
                    <motion.button
                        onClick={onToggleCollapsed}
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-600 hover:text-gray-200 transition-colors kos-focus"
                        style={{ background: 'transparent' }}
                        whileHover={{ scale: 1.15, backgroundColor: 'rgba(255,255,255,0.05)' }}
                        whileTap={{ scale: 0.88 }}
                        transition={ICON_SPRING}
                        aria-label={isRight ? 'Expand right panel' : 'Expand left panel'}
                    >
                        {isRight ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
                    </motion.button>
                </div>

                {/* Tab icons — stagger in on mount */}
                <Tooltip.Provider delayDuration={250}>
                    <div className="flex flex-col items-center gap-2 py-2 flex-1 kos-stagger">
                        {tabs.map(t => {
                            const Icon   = t.icon;
                            const active = t.id === activeTabId;
                            return (
                                <ContextMenu.Root key={t.id}>
                                    <Tooltip.Root>
                                        <ContextMenu.Trigger asChild>
                                            <Tooltip.Trigger asChild>
                                                <motion.button
                                                    onClick={() => setActiveTabId(t.id)}
                                                    aria-label={t.label}
                                                    className={cn(
                                                        'w-8 h-8 flex items-center justify-center rounded-lg transition-colors kos-focus',
                                                        active
                                                            ? 'bg-orange-500/15 text-orange-400'
                                                            : 'text-gray-600 hover:text-gray-300'
                                                    )}
                                                    whileHover={{ scale: 1.14, backgroundColor: active ? undefined : 'rgba(255,255,255,0.05)' }}
                                                    whileTap={{ scale: 0.88 }}
                                                    transition={ICON_SPRING}
                                                >
                                                    {Icon
                                                        ? <Icon size={14} />
                                                        : <span className="text-[9px] font-black">{t.label.slice(0, 2).toUpperCase()}</span>
                                                    }
                                                </motion.button>
                                            </Tooltip.Trigger>
                                        </ContextMenu.Trigger>
                                        <Tooltip.Portal>
                                            <Tooltip.Content
                                                side={tooltipSide}
                                                sideOffset={8}
                                                className="z-50 kos-enter rounded-md border border-[#2a2a2a] bg-[#0e0e0e] px-2.5 py-1.5 text-[10px] font-bold text-gray-200 shadow-xl"
                                            >
                                                {t.label}
                                                <Tooltip.Arrow className="fill-[#0e0e0e]" />
                                            </Tooltip.Content>
                                        </Tooltip.Portal>
                                    </Tooltip.Root>
                                    {contextMenuContent}
                                </ContextMenu.Root>
                            );
                        })}
                    </div>
                </Tooltip.Provider>
            </div>
        );
    }

    // ─── EXPANDED ──────────────────────────────────────────────────────────────
    return (
        <div className={cn(
            'h-full w-full bg-[#0c0c0c] flex flex-col',
            isRight ? 'border-l border-[#1c1c1c]' : 'border-r border-[#1c1c1c]',
            className
        )}>
            <Tabs.Root value={activeTabId} onValueChange={setActiveTabId} className="flex flex-col h-full">

                {/* ── TAB LIST ──────────────────────────────────────────────── */}
                <Tabs.List className="flex shrink-0 border-b border-[#171717] bg-[#080808] relative">
                    {tabs.map(t => {
                        const Icon   = t.icon;
                        const active = t.id === activeTabId;
                        return (
                            <ContextMenu.Root key={t.id}>
                                <ContextMenu.Trigger asChild>
                                    <Tabs.Trigger
                                        value={t.id}
                                        className={cn(
                                            'flex-1 flex flex-col items-center justify-center gap-0.5 px-1 py-2.5',
                                            'text-[9px] font-black tracking-wider uppercase select-none outline-none',
                                            'relative transition-colors duration-150',
                                            active
                                                ? 'text-gray-100 bg-[#111]'
                                                : 'text-gray-700 hover:text-gray-400 hover:bg-white/[0.02]',
                                        )}
                                    >
                                        {/* Sliding active indicator */}
                                        {active && (
                                            <motion.div
                                                layoutId={`dock-tab-indicator-${side}`}
                                                className="absolute bottom-0 inset-x-2 h-[2px] rounded-full bg-orange-500"
                                                transition={PILL_SPRING}
                                            />
                                        )}

                                        {/* Icon with slight scale on active */}
                                        {Icon && (
                                            <motion.div
                                                animate={{ scale: active ? 1.1 : 1 }}
                                                transition={ICON_SPRING}
                                            >
                                                <Icon size={13} />
                                            </motion.div>
                                        )}
                                        {t.label}
                                    </Tabs.Trigger>
                                </ContextMenu.Trigger>
                                {contextMenuContent}
                            </ContextMenu.Root>
                        );
                    })}

                    {/* Collapse button */}
                    {onToggleCollapsed && (
                        <motion.button
                            onClick={onToggleCollapsed}
                            className="px-2 text-gray-700 hover:text-gray-300 transition-colors shrink-0 kos-focus"
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.88 }}
                            transition={ICON_SPRING}
                            aria-label={isRight ? 'Collapse right panel' : 'Collapse left panel'}
                        >
                            {isRight ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
                        </motion.button>
                    )}
                </Tabs.List>

                {/* ── CONTENT — animated tab switch ─────────────────────────── */}
                <div className="flex-1 min-h-0 relative overflow-hidden">
                    <AnimatePresence mode="wait" initial={false}>
                        {tabs.map(t => {
                            if (t.id !== activeTabId) return null;
                            return (
                                <motion.div
                                    key={t.id}
                                    className="absolute inset-0 overflow-y-auto overflow-x-hidden"
                                    initial={{ opacity: 0, y: 4 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{   opacity: 0, y: -4 }}
                                    transition={CONTENT_ANIM}
                                    style={{
                                        scrollbarWidth: 'thin',
                                        scrollbarColor: 'rgba(255,255,255,0.08) transparent',
                                    }}
                                >
                                    {t.content}
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                </div>
            </Tabs.Root>
        </div>
    );
}
