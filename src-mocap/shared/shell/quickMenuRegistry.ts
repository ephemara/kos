import React from 'react';
import type { LucideIcon } from 'lucide-react';

export type QuickMenuCommand = {
    id: string;
    label: string;
    description?: string;
    icon?: LucideIcon;
    keywords?: string[];
    category?: string;
    shortcut?: string;
    action: () => void;
};

type RegistryState = {
    commandsBySource: Map<string, QuickMenuCommand[]>;
    listeners: Set<() => void>;
    snapshot: QuickMenuCommand[];
};

const state: RegistryState = {
    commandsBySource: new Map(),
    listeners: new Set(),
    snapshot: [],
};

function rebuildSnapshot() {
    const all: QuickMenuCommand[] = [];
    state.commandsBySource.forEach((cmds) => {
        all.push(...cmds);
    });
    state.snapshot = all;
}

function emitChange() {
    state.listeners.forEach((l) => l());
}

export function registerQuickMenuCommands(sourceId: string, commands: QuickMenuCommand[]) {
    state.commandsBySource.set(sourceId, commands);
    rebuildSnapshot();
    emitChange();
    return () => {
        unregisterQuickMenuCommands(sourceId);
    };
}

export function unregisterQuickMenuCommands(sourceId: string) {
    if (state.commandsBySource.delete(sourceId)) {
        rebuildSnapshot();
        emitChange();
    }
}

export function getQuickMenuCommands(): QuickMenuCommand[] {
    return state.snapshot;
}

export function subscribeQuickMenuCommands(listener: () => void) {
    state.listeners.add(listener);
    return () => {
        state.listeners.delete(listener);
    };
}

export function useQuickMenuCommands(): QuickMenuCommand[] {
    return React.useSyncExternalStore(subscribeQuickMenuCommands, getQuickMenuCommands, getQuickMenuCommands);
}

export function useRegisterQuickMenuCommands(sourceId: string, commands: QuickMenuCommand[]) {
    React.useEffect(() => {
        return registerQuickMenuCommands(sourceId, commands);
    }, [sourceId, commands]);
}
