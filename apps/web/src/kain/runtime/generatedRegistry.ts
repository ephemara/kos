import {
    GENERATED_RUNTIME_APPS,
    type GeneratedRuntimeAppMeta,
    type GeneratedRuntimeOutputMeta,
} from '../../../../../crates/k-os-kain/generated/ts/runtime_registry.ts';
import type { KAINRuntimeApp, KAINRuntimeOutputFile } from '../bridge/KAINBridge';

function mapGeneratedRuntimeOutput(output: GeneratedRuntimeOutputMeta): KAINRuntimeOutputFile {
    return {
        target: output.target,
        path: output.path,
    };
}

function mapGeneratedRuntimeKind(
    runtimeKind: GeneratedRuntimeAppMeta['runtimeKind'],
): KAINRuntimeApp['runtimeKind'] {
    return runtimeKind === 'viewport3d_app' ? 'viewport_3d_app' : runtimeKind;
}

function mapGeneratedHostKind(
    hostKind: GeneratedRuntimeAppMeta['hostKind'],
): KAINRuntimeApp['hostKind'] {
    return hostKind === 'ue5' ? 'ue_5' : hostKind;
}

function mapGeneratedRuntimeApp(app: GeneratedRuntimeAppMeta): KAINRuntimeApp {
    return {
        id: app.id,
        label: app.label,
        sourcePath: app.sourcePath,
        runtimeKind: mapGeneratedRuntimeKind(app.runtimeKind),
        hostKind: mapGeneratedHostKind(app.hostKind),
        namespace: app.namespace,
        outputs: app.outputs.map(mapGeneratedRuntimeOutput),
    };
}

export const GENERATED_KAIN_RUNTIME_REGISTRY: KAINRuntimeApp[] = GENERATED_RUNTIME_APPS.map(mapGeneratedRuntimeApp);
