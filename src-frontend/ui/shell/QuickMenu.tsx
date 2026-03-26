import React from 'react';
import { Command } from 'cmdk';
import { cn } from '@/ui/primitives/cn';
import { Dialog, DialogContent } from '@/ui/primitives/Dialog';
import type { QuickMenuCommand } from './quickMenuRegistry';

export type QuickMenuProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    commands: QuickMenuCommand[];
    placeholder?: string;
};

function groupByCategory(commands: QuickMenuCommand[]) {
    const groups = new Map<string, QuickMenuCommand[]>();
    commands.forEach((c) => {
        const key = c.category ?? 'Commands';
        const arr = groups.get(key) ?? [];
        arr.push(c);
        groups.set(key, arr);
    });
    return Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]));
}

export default function QuickMenu({ open, onOpenChange, commands, placeholder }: QuickMenuProps) {
    const groups = React.useMemo(() => groupByCategory(commands), [commands]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="p-0 overflow-hidden">
                <Command
                    className={cn(
                        'w-full',
                        'bg-[#0b0b0b] text-gray-200',
                        '[&_[cmdk-input]]:w-full [&_[cmdk-input]]:bg-transparent [&_[cmdk-input]]:outline-none',
                        '[&_[cmdk-item]]:cursor-default'
                    )}
                    loop
                >
                    <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10">
                        <div className="text-[10px] font-black tracking-[0.28em] text-gray-200">QUICK MENU</div>
                        <div className="ml-auto text-[10px] font-bold text-gray-500">CTRL/CMD + K</div>
                    </div>

                    <div className="px-4 py-3 border-b border-white/10">
                        <Command.Input
                            autoFocus
                            placeholder={placeholder ?? 'Search commands, apps, sims...'}
                            className="text-[12px] font-bold text-gray-200 placeholder:text-gray-600"
                        />
                    </div>

                    <Command.List className="max-h-[60vh] overflow-y-auto">
                        <Command.Empty className="px-4 py-6 text-[11px] font-bold text-gray-500">
                            No results.
                        </Command.Empty>

                        {groups.map(([category, items]) => (
                            <Command.Group key={category} className="px-2 py-2">
                                <div className="px-2 pb-2 text-[9px] font-black tracking-[0.25em] text-gray-500 uppercase">
                                    {category}
                                </div>

                                {items.map((cmd) => {
                                    const Icon = cmd.icon;
                                    return (
                                        <Command.Item
                                            key={cmd.id}
                                            value={[cmd.label, cmd.description, ...(cmd.keywords ?? [])].filter(Boolean).join(' ')}
                                            onSelect={() => {
                                                cmd.action();
                                                onOpenChange(false);
                                            }}
                                            className={cn(
                                                'flex items-center gap-3 rounded-md px-3 py-2',
                                                'text-[11px] font-bold text-gray-200',
                                                'aria-selected:bg-white/10 aria-selected:text-white',
                                                'focus-visible:outline-none'
                                            )}
                                        >
                                            <div className="w-5 flex items-center justify-center text-gray-500">
                                                {Icon ? <Icon size={14} /> : null}
                                            </div>

                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-2">
                                                    <div className="truncate">{cmd.label}</div>
                                                    {cmd.shortcut ? (
                                                        <div className="ml-auto text-[10px] font-black tracking-wider text-gray-600">
                                                            {cmd.shortcut}
                                                        </div>
                                                    ) : null}
                                                </div>
                                                {cmd.description ? (
                                                    <div className="text-[10px] font-bold text-gray-500 truncate">
                                                        {cmd.description}
                                                    </div>
                                                ) : null}
                                            </div>
                                        </Command.Item>
                                    );
                                })}
                            </Command.Group>
                        ))}
                    </Command.List>
                </Command>
            </DialogContent>
        </Dialog>
    );
}
