export {
    kainBridge,
    KAINBridge,
    KAIN_SOURCE_REGISTRY,
    KAIN_RUNTIME_REGISTRY,
    openKainAuthoringSession,
} from './bridge/KAINBridge';

export type {
    KAINTarget,
    KAINCompileResult,
    KAINRunResult,
    KAINSourceFile,
    KAINAuthoringSession,
    KAINScriptPlugin,
    KAINRuntimeKind,
    KAINHostKind,
    KAINRuntimeOutputFile,
    KAINRuntimeApp,
} from './bridge/KAINBridge';

export { useKAIN } from './hooks/useKAIN';
export type { UseKAINResult } from './hooks/useKAIN';

export {
    loadRuntimeRegistry,
    resolveRuntimeApp,
    resolveRuntimeOutput,
    resolvePreferredRuntimeOutput,
    resolveRuntimeOutputPath,
    resolvePreferredRuntimeOutputPath,
} from './runtime/resolver';

export { KAINRuntimeBrowser } from './runtime/KAINRuntimeBrowser';
export { KAINConsole } from './console/KAINConsole';
export { KAINConsole as KAINConsoleDefault } from './console/KAINConsole';
