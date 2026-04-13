import type { StudioStage } from '@/systems/three/StudioStage';

let activeStage: StudioStage | null = null;
const listeners = new Set<() => void>();

export function getActiveStage(): StudioStage | null {
    return activeStage;
}

export function setActiveStage(stage: StudioStage | null): void {
    if (activeStage === stage) return;
    activeStage = stage;
    emit();
}

export function clearActiveStageIf(stage: StudioStage): void {
    if (activeStage === stage) {
        activeStage = null;
        emit();
    }
}

export function subscribeActiveStage(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

function emit() {
    for (const l of listeners) l();
}
