import { useEffect } from 'react';
import hotkeys, { HotkeysEvent } from 'hotkeys-js';

export type HotkeyHandler = (keyboardEvent: KeyboardEvent, hotkeysEvent: HotkeysEvent) => void;

export type HotkeyBindings = Record<string, HotkeyHandler>;

const defaultFilter = (event: KeyboardEvent) => {
    const target = event.target as HTMLElement | null;
    if (!target) return true;
    const tagName = target.tagName;
    if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT') return false;
    if ((target as any).isContentEditable) return false;
    return true;
};

export function useGlobalHotkeys(bindings: HotkeyBindings, enabled: boolean = true) {
    useEffect(() => {
        if (!enabled) return;

        const prevFilter = hotkeys.filter;
        hotkeys.filter = defaultFilter;

        const entries = Object.entries(bindings);
        entries.forEach(([combo, handler]) => {
            hotkeys(combo, (keyboardEvent, hotkeysEvent) => {
                handler(keyboardEvent as unknown as KeyboardEvent, hotkeysEvent);
                return false;
            });
        });

        return () => {
            entries.forEach(([combo]) => hotkeys.unbind(combo));
            hotkeys.filter = prevFilter;
        };
    }, [bindings, enabled]);
}
