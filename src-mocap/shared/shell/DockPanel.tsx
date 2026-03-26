import React from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import * as ContextMenu from '@radix-ui/react-context-menu';
import * as ScrollArea from '@radix-ui/react-scroll-area';
import * as Tooltip from '@radix-ui/react-tooltip';
import { LucideIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@mocap/shared/primitives/cn';
import { Button } from '@mocap/shared/primitives/Button';

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
            if (activeTabIdProp == null) {
                setUncontrolledActiveTabId(nextId);
            }
            onActiveTabIdChange?.(nextId);
        },
        [activeTabIdProp, onActiveTabIdChange]
    );

    React.useEffect(() => {
        if (!tabs.some((t) => t.id === activeTabId)) {
            setActiveTabId(defaultTabId ?? tabs[0]?.id ?? '');
        }
    }, [tabs, activeTabId, defaultTabId]);

    const isRight = side === 'right';
    const tooltipSide: Tooltip.TooltipContentProps['side'] = isRight ? 'left' : 'right';

    const hasContextActions = Boolean(onToggleCollapsed || onResetSize);

    const contextMenuContent = hasContextActions ? (
        <ContextMenu.Portal>
            <ContextMenu.Content
                className={cn(
                    'z-50 min-w-[180px] rounded-[var(--kos-radius-md)] border border-[color:var(--kos-border-primary)] bg-[color:var(--kos-surface-secondary)] p-1 kos-glass',
                    'text-[11px] font-bold text-[color:var(--kos-text-secondary)] shadow-[var(--kos-shadow-lg)]'
                )}
            >
                {onToggleCollapsed ? (
                    <ContextMenu.Item
                        onSelect={(e) => {
                            e.preventDefault();
                            onToggleCollapsed();
                        }}
                        className={cn(
                            'cursor-default select-none rounded-[var(--kos-radius-sm)] px-2 py-2 outline-none',
                            'focus:bg-[color:var(--kos-surface-hover)] focus:text-[color:var(--kos-text-primary)]'
                        )}
                    >
                        {collapsed ? 'Expand Dock' : 'Collapse Dock'}
                    </ContextMenu.Item>
                ) : null}
                {onResetSize ? (
                    <ContextMenu.Item
                        onSelect={(e) => {
                            e.preventDefault();
                            onResetSize();
                        }}
                        className={cn(
                            'cursor-default select-none rounded-[var(--kos-radius-sm)] px-2 py-2 outline-none',
                            'focus:bg-[color:var(--kos-surface-hover)] focus:text-[color:var(--kos-text-primary)]'
                        )}
                    >
                        Reset Width
                    </ContextMenu.Item>
                ) : null}
            </ContextMenu.Content>
        </ContextMenu.Portal>
    ) : null;

    if (collapsed) {
        return (
            <div className={cn('h-full w-full bg-[color:var(--kos-surface-secondary)] border-[color:var(--kos-border-primary)] flex flex-col kos-glass', isRight ? 'border-l' : 'border-r', className)}>
                <div className={cn('h-12 flex items-center px-2 shrink-0', isRight ? 'justify-start' : 'justify-end')}>
                    <Button
                        size="icon"
                        variant="ghost"
                        onClick={onToggleCollapsed}
                        aria-label={isRight ? 'Expand right panel' : 'Expand left panel'}
                    >
                        {isRight ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
                    </Button>
                </div>
                <Tooltip.Provider delayDuration={200}>
                    <ScrollArea.Root className="flex-1 w-full">
                        <ScrollArea.Viewport className="h-full w-full">
                            <div className="flex flex-col items-center gap-3 py-3">
                                {tabs.map((t) => {
                                    const Icon = t.icon;
                                    const active = t.id === activeTabId;
                                    return (
                                        <ContextMenu.Root key={t.id}>
                                            <Tooltip.Root>
                                                <ContextMenu.Trigger asChild>
                                                    <Tooltip.Trigger asChild>
                                                        <Button
                                                            size="icon"
                                                            variant={active ? 'secondary' : 'ghost'}
                                                            onClick={() => setActiveTabId(t.id)}
                                                            aria-label={t.label}
                                                        >
                                                            {Icon ? (
                                                                <Icon size={16} />
                                                            ) : (
                                                                <span className="text-[10px]">{t.label.slice(0, 2).toUpperCase()}</span>
                                                            )}
                                                        </Button>
                                                    </Tooltip.Trigger>
                                                </ContextMenu.Trigger>
                                                <Tooltip.Portal>
                                                    <Tooltip.Content
                                                        side={tooltipSide}
                                                        sideOffset={10}
                                                        className={cn(
                                                            'z-50 rounded-[var(--kos-radius-md)] border border-[color:var(--kos-border-primary)] bg-[color:var(--kos-surface-secondary)] px-2 py-1 kos-glass',
                                                            'text-[10px] font-black tracking-wide text-[color:var(--kos-text-secondary)] shadow-[var(--kos-shadow-lg)]'
                                                        )}
                                                    >
                                                        {t.label}
                                                        <Tooltip.Arrow className="fill-[var(--kos-surface-secondary)]" />
                                                    </Tooltip.Content>
                                                </Tooltip.Portal>
                                            </Tooltip.Root>
                                            {contextMenuContent}
                                        </ContextMenu.Root>
                                    );
                                })}
                            </div>
                        </ScrollArea.Viewport>
                        <ScrollArea.Scrollbar
                            orientation="vertical"
                            className="flex w-2.5 touch-none select-none p-0.5 bg-transparent"
                        >
                            <ScrollArea.Thumb className="flex-1 rounded-full bg-white/10 hover:bg-white/20" />
                        </ScrollArea.Scrollbar>
                    </ScrollArea.Root>
                </Tooltip.Provider>
            </div>
        );
    }

    return (
        <div className={cn('h-full w-full bg-[color:var(--kos-surface-secondary)] border-[color:var(--kos-border-primary)] flex flex-col min-w-0 kos-glass', isRight ? 'border-l' : 'border-r', className)}>
            <div className="h-12 px-3 flex items-center justify-between shrink-0">
                <div className="min-w-0">
                    {title ? <div className="text-[10px] font-black tracking-[0.25em] text-[color:var(--kos-text-secondary)] truncate">{title}</div> : null}
                </div>
                {onToggleCollapsed ? (
                    <Button
                        size="icon"
                        variant="ghost"
                        onClick={onToggleCollapsed}
                        aria-label={isRight ? 'Collapse right panel' : 'Collapse left panel'}
                    >
                        {isRight ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
                    </Button>
                ) : null}
            </div>

            <Tabs.Root value={activeTabId} onValueChange={setActiveTabId} className="flex flex-col min-h-0 flex-1">
                <Tabs.List className="flex border-b border-[color:var(--kos-border-primary)] bg-[color:var(--kos-surface-primary)] shrink-0">
                    {tabs.map((t) => {
                        const Icon = t.icon;
                        return (
                            <ContextMenu.Root key={t.id}>
                                <ContextMenu.Trigger asChild>
                                    <Tabs.Trigger
                                        value={t.id}
                                        className={cn(
                                            'flex-1',
                                            'h-11 px-2 text-[10px] font-black tracking-wider text-[color:var(--kos-text-muted)]',
                                            'flex flex-col items-center justify-center gap-1',
                                            'data-[state=active]:text-[color:var(--kos-text-primary)] data-[state=active]:bg-[color:var(--kos-surface-tertiary)]',
                                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--kos-accent-glow)]'
                                        )}
                                    >
                                        {Icon ? <Icon size={14} /> : null}
                                        {t.label}
                                    </Tabs.Trigger>
                                </ContextMenu.Trigger>
                                {contextMenuContent}
                            </ContextMenu.Root>
                        );
                    })}
                </Tabs.List>

                <div className="flex-1 min-h-0 overflow-hidden">
                    {tabs.map((t) => (
                        <Tabs.Content key={t.id} value={t.id} className="h-full">
                            <ScrollArea.Root className="h-full w-full">
                                <ScrollArea.Viewport className="h-full w-full p-3">{t.content}</ScrollArea.Viewport>
                                <ScrollArea.Scrollbar
                                    orientation="vertical"
                                    className="flex w-2.5 touch-none select-none p-0.5 bg-transparent"
                                >
                                    <ScrollArea.Thumb className="flex-1 rounded-full bg-[color:var(--kos-accent-muted)] hover:bg-[color:var(--kos-accent-primary)]" />
                                </ScrollArea.Scrollbar>
                            </ScrollArea.Root>
                        </Tabs.Content>
                    ))}
                </div>
            </Tabs.Root>
        </div>
    );
}
