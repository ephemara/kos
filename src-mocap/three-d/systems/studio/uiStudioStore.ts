import type { UiSurfaceKey } from './types';

type UiStudioState = {
    open: boolean;
    activeSurface: UiSurfaceKey | null;
    selectedNodeId: string | null;
};

let state: UiStudioState = {
    open: false,
    activeSurface: null,
    selectedNodeId: null,
};

const listeners = new Set<() => void>();

function emit() {
    for (const l of listeners) l();
}

export function getUiStudioState(): UiStudioState {
    return state;
}

export function setUiStudioOpen(open: boolean): void {
    state = { ...state, open };
    emit();
}

export function setUiStudioActiveSurface(activeSurface: UiSurfaceKey | null): void {
    state = { ...state, activeSurface };
    if (!activeSurface) {
        state = { ...state, selectedNodeId: null };
    }
    emit();
}

export function setUiStudioSelectedNodeId(selectedNodeId: string | null): void {
    state = { ...state, selectedNodeId };
    emit();
}

export function subscribeUiStudio(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}
