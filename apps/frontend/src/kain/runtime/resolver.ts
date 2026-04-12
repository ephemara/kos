import { kainBridge, type KAINRuntimeApp, type KAINRuntimeOutputFile, type KAINTarget } from '../bridge/KAINBridge';
import { getPreferredRuntimeOutput } from './registry';

export interface ResolvedKAINRuntimeOutput {
    app: KAINRuntimeApp;
    output: KAINRuntimeOutputFile;
}

export async function loadRuntimeRegistry(): Promise<KAINRuntimeApp[]> {
    return kainBridge.listRuntimeAppsFromBackend();
}

export async function resolveRuntimeApp(id: string): Promise<KAINRuntimeApp | undefined> {
    return kainBridge.getRuntimeAppById(id);
}

export async function resolveRuntimeOutput(id: string, target: KAINTarget): Promise<ResolvedKAINRuntimeOutput | undefined> {
    const app = await resolveRuntimeApp(id);
    const output = app?.outputs.find((entry) => entry.target === target);
    if (!app || !output) {
        return undefined;
    }
    return { app, output };
}

export async function resolvePreferredRuntimeOutput(id: string, preferredTargets?: readonly KAINTarget[]): Promise<ResolvedKAINRuntimeOutput | undefined> {
    const app = await resolveRuntimeApp(id);
    const output = app ? getPreferredRuntimeOutput(app, preferredTargets) : undefined;
    if (!app || !output) {
        return undefined;
    }
    return { app, output };
}

export async function resolveRuntimeOutputPath(id: string, target: KAINTarget): Promise<string | undefined> {
    const resolved = await resolveRuntimeOutput(id, target);
    return resolved?.output.path;
}

export async function resolvePreferredRuntimeOutputPath(id: string, preferredTargets?: readonly KAINTarget[]): Promise<string | undefined> {
    const resolved = await resolvePreferredRuntimeOutput(id, preferredTargets);
    return resolved?.output.path;
}
