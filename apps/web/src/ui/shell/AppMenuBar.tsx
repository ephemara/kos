import React from 'react';
import * as Menubar from '@radix-ui/react-menubar';
import { cn } from '@/ui/primitives/cn';

export type AppMenuBarItem = {
    label: string;
    onSelect?: () => void;
    disabled?: boolean;
    shortcut?: string;
};

export type AppMenuBarMenu = {
    label: string;
    items: AppMenuBarItem[];
};

export type AppMenuBarProps = {
    menus?: AppMenuBarMenu[];
    className?: string;
};

const defaultMenus: AppMenuBarMenu[] = [
    {
        label: 'File',
        items: [
            { label: 'New', disabled: true, shortcut: 'Ctrl+N' },
            { label: 'Open...', disabled: true, shortcut: 'Ctrl+O' },
            { label: 'Save', disabled: true, shortcut: 'Ctrl+S' },
        ],
    },
    {
        label: 'Edit',
        items: [
            { label: 'Undo', disabled: true, shortcut: 'Ctrl+Z' },
            { label: 'Redo', disabled: true, shortcut: 'Ctrl+Y' },
        ],
    },
    {
        label: 'View',
        items: [{ label: 'Reset Layout', disabled: true }],
    },
    {
        label: 'Help',
        items: [{ label: 'About', disabled: true }],
    },
];

export function AppMenuBar({ menus = defaultMenus, className }: AppMenuBarProps) {
    return (
        <Menubar.Root
            className={cn(
                'h-10 flex items-center rounded-md border border-white/10 bg-black/40 px-1 backdrop-blur-md',
                className
            )}
        >
            {menus.map((menu) => (
                <Menubar.Menu key={menu.label}>
                    <Menubar.Trigger
                        className={cn(
                            'h-8 px-3 text-[11px] font-black tracking-wide text-gray-200',
                            'rounded-sm outline-none',
                            'hover:bg-white/10 data-[state=open]:bg-white/10'
                        )}
                    >
                        {menu.label}
                    </Menubar.Trigger>
                    <Menubar.Portal>
                        <Menubar.Content
                            align="start"
                            sideOffset={6}
                            className={cn(
                                'z-50 min-w-[220px] rounded-md border border-white/10 bg-[#0b0b0b] p-1 shadow-xl',
                                'text-[11px] font-bold text-gray-200'
                            )}
                        >
                            {menu.items.map((item) => (
                                <Menubar.Item
                                    key={item.label}
                                    disabled={item.disabled}
                                    onSelect={() => item.onSelect?.()}
                                    className={cn(
                                        'cursor-default select-none rounded px-2 py-2 outline-none',
                                        'flex items-center justify-between gap-6',
                                        'focus:bg-white/10 focus:text-white',
                                        'data-[disabled]:opacity-40'
                                    )}
                                >
                                    <span>{item.label}</span>
                                    {item.shortcut ? (
                                        <span className="text-[10px] font-black tracking-widest text-gray-400">{item.shortcut}</span>
                                    ) : null}
                                </Menubar.Item>
                            ))}
                        </Menubar.Content>
                    </Menubar.Portal>
                </Menubar.Menu>
            ))}
        </Menubar.Root>
    );
}
