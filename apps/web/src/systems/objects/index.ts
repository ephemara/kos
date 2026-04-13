/**
 * K_OS Object System
 * 
 * Universal object identity and management for K_OS.
 */

export {
    getKObjectRegistry,
    resetKObjectRegistry,
    useKObjectRegistry,
    type KObject,
    type KObjectType,
    type KObjectCreateOptions,
    type KObjectQuery,
    type KObjectEvent,
    type KObjectEventType,
    type KObjectListener
} from './KObjectRegistry';

export {
    registerObject3D,
    unregisterObject3D,
    getKIdFromObject,
    getKObjectFromObject,
    findObjectByKId,
    syncRegistryWithScene,
    prepareForGLTFExport,
    restoreFromGLTFImport
} from './meshRegistryBridge';

