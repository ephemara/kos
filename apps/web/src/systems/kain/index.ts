/**
 * index.ts — K-OS KAIN System Barrel
 *
 * Everything related to the KAIN language inside K-OS.
 * Import from here throughout the frontend:
 *
 *   import { kainBridge, KAINConsole, openKainAuthoringSession, useKAIN } from '@/systems/kain';
 */

export {
    kainBridge,
    KAINBridge,
    KAIN_SOURCE_REGISTRY,
    KAIN_RUNTIME_REGISTRY,
    openKainAuthoringSession,
    useKAIN,
    KAINConsole,
    KAINConsoleDefault,
    KAINRuntimeBrowser,
} from '../../kain';

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
    UseKAINResult,
} from '../../kain';
