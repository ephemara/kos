/**
 * KObjectRegistry.ts - Universal Object Identity System for K_OS
 * 
 * Provides stable, persistent IDs for all objects across K_OS apps.
 * Enables cross-app workflows, animation targeting, material binding, and more.
 * 
 * Key Features:
 * - Stable K_OS IDs (k_mesh_abc123) that persist across sessions
 * - Cross-app references (KRig animates mesh from KSculpt)
 * - Parent/child hierarchy tracking
 * - Material/animation binding by ID
 * - Query system for finding objects
 * 
 * Usage:
 * const registry = getKObjectRegistry();
 * const kId = registry.register({ type: 'mesh', name: 'Hero', createdBy: 'KSculpt' });
 * const obj = registry.get(kId);
 */

// ============================================================================
// TYPES
// ============================================================================

export type KObjectType =
    | 'mesh'
    | 'group'
    | 'light'
    | 'camera'
    | 'armature'
    | 'bone'
    | 'material'
    | 'texture'
    | 'animation'
    | 'layer';

export interface KObject {
    /** Stable K_OS ID: "k_mesh_abc123" */
    kId: string;

    /** Object type */
    type: KObjectType;

    /** Human-readable name */
    name: string;

    /** Which app created this object */
    createdBy: string;

    /** Creation timestamp */
    createdAt: number;

    /** Last modification timestamp */
    modifiedAt: number;

    /** Current THREE.js uuid binding (can change on reload) */
    threeUuid?: string;

    /** Parent object K_OS ID (for hierarchy) */
    parentKId?: string;

    /** Child object K_OS IDs */
    childKIds: string[];

    /** Associated layer K_OS ID */
    layerKId?: string;

    /** Bound material K_OS ID */
    materialKId?: string;

    /** Animation clips targeting this object */
    animationTargetedBy: string[];

    /** Tags for organization/filtering */
    tags: string[];

    /** Arbitrary metadata (app-specific) */
    metadata: Record<string, any>;

    /** Is this object currently loaded in the scene? */
    isLoaded: boolean;

    /** Soft delete flag */
    isDeleted: boolean;
}

export interface KObjectCreateOptions {
    type: KObjectType;
    name: string;
    createdBy: string;
    threeUuid?: string;
    parentKId?: string;
    layerKId?: string;
    materialKId?: string;
    tags?: string[];
    metadata?: Record<string, any>;
}

export interface KObjectQuery {
    type?: KObjectType | KObjectType[];
    createdBy?: string | string[];
    parentKId?: string;
    layerKId?: string;
    materialKId?: string;
    tags?: string[];
    isLoaded?: boolean;
    isDeleted?: boolean;
    nameContains?: string;
}

export type KObjectEventType =
    | 'register'
    | 'update'
    | 'delete'
    | 'restore'
    | 'bind'
    | 'unbind'
    | 'hierarchy-change';

export interface KObjectEvent {
    type: KObjectEventType;
    kId: string;
    object: KObject;
    previousState?: Partial<KObject>;
}

export type KObjectListener = (event: KObjectEvent) => void;

// ============================================================================
// ID GENERATION
// ============================================================================

function generateKId(type: KObjectType): string {
    // Format: k_{type}_{timestamp_base36}_{random}
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `k_${type}_${timestamp}${random}`;
}

// ============================================================================
// REGISTRY CLASS
// ============================================================================

class KObjectRegistry {
    private objects: Map<string, KObject> = new Map();
    private threeUuidIndex: Map<string, string> = new Map(); // THREE uuid -> kId
    private typeIndex: Map<KObjectType, Set<string>> = new Map();
    private appIndex: Map<string, Set<string>> = new Map(); // createdBy -> kIds
    private layerIndex: Map<string, Set<string>> = new Map(); // layerKId -> kIds
    private listeners: Set<KObjectListener> = new Set();

    constructor() {
        // Initialize type indexes
        const types: KObjectType[] = ['mesh', 'group', 'light', 'camera', 'armature', 'bone', 'material', 'texture', 'animation', 'layer'];
        types.forEach(t => this.typeIndex.set(t, new Set()));
    }

    // ========================================================================
    // REGISTRATION
    // ========================================================================

    /**
     * Register a new object and get its K_OS ID
     */
    register(options: KObjectCreateOptions): string {
        const kId = generateKId(options.type);
        const now = Date.now();

        const obj: KObject = {
            kId,
            type: options.type,
            name: options.name,
            createdBy: options.createdBy,
            createdAt: now,
            modifiedAt: now,
            threeUuid: options.threeUuid,
            parentKId: options.parentKId,
            childKIds: [],
            layerKId: options.layerKId,
            materialKId: options.materialKId,
            animationTargetedBy: [],
            tags: options.tags || [],
            metadata: options.metadata || {},
            isLoaded: true,
            isDeleted: false
        };

        // Store in main map
        this.objects.set(kId, obj);

        // Update indexes
        if (options.threeUuid) {
            this.threeUuidIndex.set(options.threeUuid, kId);
        }
        this.typeIndex.get(options.type)?.add(kId);

        if (!this.appIndex.has(options.createdBy)) {
            this.appIndex.set(options.createdBy, new Set());
        }
        this.appIndex.get(options.createdBy)?.add(kId);

        if (options.layerKId) {
            if (!this.layerIndex.has(options.layerKId)) {
                this.layerIndex.set(options.layerKId, new Set());
            }
            this.layerIndex.get(options.layerKId)?.add(kId);
        }

        // Update parent's childKIds
        if (options.parentKId) {
            const parent = this.objects.get(options.parentKId);
            if (parent) {
                parent.childKIds.push(kId);
                parent.modifiedAt = now;
            }
        }

        this.emit({ type: 'register', kId, object: obj });

        return kId;
    }

    /**
     * Register an existing THREE.js object
     */
    registerThreeObject(
        threeObject: { uuid: string; name?: string },
        type: KObjectType,
        createdBy: string,
        options?: Partial<KObjectCreateOptions>
    ): string {
        // Check if already registered
        const existing = this.threeUuidIndex.get(threeObject.uuid);
        if (existing) return existing;

        return this.register({
            type,
            name: threeObject.name || `Untitled ${type}`,
            createdBy,
            threeUuid: threeObject.uuid,
            ...options
        });
    }

    // ========================================================================
    // RETRIEVAL
    // ========================================================================

    /**
     * Get object by K_OS ID
     */
    get(kId: string): KObject | undefined {
        return this.objects.get(kId);
    }

    /**
     * Get object by THREE.js uuid
     */
    getByThreeUuid(threeUuid: string): KObject | undefined {
        const kId = this.threeUuidIndex.get(threeUuid);
        return kId ? this.objects.get(kId) : undefined;
    }

    /**
     * Get K_OS ID from THREE.js uuid
     */
    getKIdFromThreeUuid(threeUuid: string): string | undefined {
        return this.threeUuidIndex.get(threeUuid);
    }

    /**
     * Check if an object exists
     */
    has(kId: string): boolean {
        return this.objects.has(kId);
    }

    /**
     * Get all objects of a type
     */
    getAllOfType(type: KObjectType): KObject[] {
        const kIds = this.typeIndex.get(type) || new Set();
        return Array.from(kIds)
            .map(kId => this.objects.get(kId)!)
            .filter(obj => obj && !obj.isDeleted);
    }

    /**
     * Get all objects created by an app
     */
    getAllByApp(appName: string): KObject[] {
        const kIds = this.appIndex.get(appName) || new Set();
        return Array.from(kIds)
            .map(kId => this.objects.get(kId)!)
            .filter(obj => obj && !obj.isDeleted);
    }

    /**
     * Get all objects in a layer
     */
    getAllInLayer(layerKId: string): KObject[] {
        const kIds = this.layerIndex.get(layerKId) || new Set();
        return Array.from(kIds)
            .map(kId => this.objects.get(kId)!)
            .filter(obj => obj && !obj.isDeleted);
    }

    /**
     * Query objects with filters
     */
    query(q: KObjectQuery): KObject[] {
        let results = Array.from(this.objects.values());

        // Filter by deletion status
        if (q.isDeleted !== undefined) {
            results = results.filter(obj => obj.isDeleted === q.isDeleted);
        } else {
            // Default: exclude deleted
            results = results.filter(obj => !obj.isDeleted);
        }

        // Filter by loaded status
        if (q.isLoaded !== undefined) {
            results = results.filter(obj => obj.isLoaded === q.isLoaded);
        }

        // Filter by type
        if (q.type) {
            const types = Array.isArray(q.type) ? q.type : [q.type];
            results = results.filter(obj => types.includes(obj.type));
        }

        // Filter by createdBy
        if (q.createdBy) {
            const apps = Array.isArray(q.createdBy) ? q.createdBy : [q.createdBy];
            results = results.filter(obj => apps.includes(obj.createdBy));
        }

        // Filter by parent
        if (q.parentKId !== undefined) {
            results = results.filter(obj => obj.parentKId === q.parentKId);
        }

        // Filter by layer
        if (q.layerKId !== undefined) {
            results = results.filter(obj => obj.layerKId === q.layerKId);
        }

        // Filter by material
        if (q.materialKId !== undefined) {
            results = results.filter(obj => obj.materialKId === q.materialKId);
        }

        // Filter by tags
        if (q.tags && q.tags.length > 0) {
            results = results.filter(obj =>
                q.tags!.every(tag => obj.tags.includes(tag))
            );
        }

        // Filter by name
        if (q.nameContains) {
            const search = q.nameContains.toLowerCase();
            results = results.filter(obj =>
                obj.name.toLowerCase().includes(search)
            );
        }

        return results;
    }

    // ========================================================================
    // MODIFICATION
    // ========================================================================

    /**
     * Update object properties
     */
    update(kId: string, updates: Partial<Omit<KObject, 'kId' | 'type' | 'createdBy' | 'createdAt'>>): boolean {
        const obj = this.objects.get(kId);
        if (!obj) return false;

        const previousState = { ...obj };

        // Apply updates
        Object.assign(obj, updates, { modifiedAt: Date.now() });

        // Update THREE uuid index if changed
        if (updates.threeUuid !== undefined) {
            // Remove old binding
            if (previousState.threeUuid) {
                this.threeUuidIndex.delete(previousState.threeUuid);
            }
            // Add new binding
            if (updates.threeUuid) {
                this.threeUuidIndex.set(updates.threeUuid, kId);
            }
        }

        // Update layer index if changed
        if (updates.layerKId !== undefined && updates.layerKId !== previousState.layerKId) {
            // Remove from old layer
            if (previousState.layerKId) {
                this.layerIndex.get(previousState.layerKId)?.delete(kId);
            }
            // Add to new layer
            if (updates.layerKId) {
                if (!this.layerIndex.has(updates.layerKId)) {
                    this.layerIndex.set(updates.layerKId, new Set());
                }
                this.layerIndex.get(updates.layerKId)?.add(kId);
            }
        }

        this.emit({ type: 'update', kId, object: obj, previousState });

        return true;
    }

    /**
     * Update the THREE.js uuid binding (e.g., after mesh recreation)
     */
    updateThreeBinding(kId: string, newThreeUuid: string): boolean {
        return this.update(kId, { threeUuid: newThreeUuid });
    }

    /**
     * Rename an object
     */
    rename(kId: string, newName: string): boolean {
        return this.update(kId, { name: newName });
    }

    /**
     * Set parent (reparent)
     */
    setParent(kId: string, newParentKId: string | undefined): boolean {
        const obj = this.objects.get(kId);
        if (!obj) return false;

        const previousParentKId = obj.parentKId;

        // Remove from old parent's children
        if (previousParentKId) {
            const oldParent = this.objects.get(previousParentKId);
            if (oldParent) {
                oldParent.childKIds = oldParent.childKIds.filter(id => id !== kId);
                oldParent.modifiedAt = Date.now();
            }
        }

        // Add to new parent's children
        if (newParentKId) {
            const newParent = this.objects.get(newParentKId);
            if (newParent) {
                newParent.childKIds.push(kId);
                newParent.modifiedAt = Date.now();
            }
        }

        obj.parentKId = newParentKId;
        obj.modifiedAt = Date.now();

        this.emit({ type: 'hierarchy-change', kId, object: obj, previousState: { parentKId: previousParentKId } });

        return true;
    }

    /**
     * Assign to layer
     */
    assignToLayer(kId: string, layerKId: string | undefined): boolean {
        return this.update(kId, { layerKId });
    }

    /**
     * Bind material
     */
    bindMaterial(kId: string, materialKId: string | undefined): boolean {
        const obj = this.objects.get(kId);
        if (!obj) return false;

        const previousMaterialKId = obj.materialKId;
        obj.materialKId = materialKId;
        obj.modifiedAt = Date.now();

        this.emit({ type: 'bind', kId, object: obj, previousState: { materialKId: previousMaterialKId } });

        return true;
    }

    /**
     * Add animation target reference
     */
    addAnimationTarget(meshKId: string, animationKId: string): boolean {
        const mesh = this.objects.get(meshKId);
        if (!mesh) return false;

        if (!mesh.animationTargetedBy.includes(animationKId)) {
            mesh.animationTargetedBy.push(animationKId);
            mesh.modifiedAt = Date.now();
        }

        return true;
    }

    /**
     * Remove animation target reference
     */
    removeAnimationTarget(meshKId: string, animationKId: string): boolean {
        const mesh = this.objects.get(meshKId);
        if (!mesh) return false;

        mesh.animationTargetedBy = mesh.animationTargetedBy.filter(id => id !== animationKId);
        mesh.modifiedAt = Date.now();

        return true;
    }

    /**
     * Add tags
     */
    addTags(kId: string, tags: string[]): boolean {
        const obj = this.objects.get(kId);
        if (!obj) return false;

        tags.forEach(tag => {
            if (!obj.tags.includes(tag)) {
                obj.tags.push(tag);
            }
        });
        obj.modifiedAt = Date.now();

        return true;
    }

    /**
     * Remove tags
     */
    removeTags(kId: string, tags: string[]): boolean {
        const obj = this.objects.get(kId);
        if (!obj) return false;

        obj.tags = obj.tags.filter(t => !tags.includes(t));
        obj.modifiedAt = Date.now();

        return true;
    }

    // ========================================================================
    // DELETION
    // ========================================================================

    /**
     * Soft delete (mark as deleted, keep in registry)
     */
    delete(kId: string): boolean {
        const obj = this.objects.get(kId);
        if (!obj) return false;

        obj.isDeleted = true;
        obj.isLoaded = false;
        obj.modifiedAt = Date.now();

        // Remove THREE binding
        if (obj.threeUuid) {
            this.threeUuidIndex.delete(obj.threeUuid);
        }

        this.emit({ type: 'delete', kId, object: obj });

        return true;
    }

    /**
     * Restore a soft-deleted object
     */
    restore(kId: string): boolean {
        const obj = this.objects.get(kId);
        if (!obj || !obj.isDeleted) return false;

        obj.isDeleted = false;
        obj.modifiedAt = Date.now();

        this.emit({ type: 'restore', kId, object: obj });

        return true;
    }

    /**
     * Hard delete (remove from registry entirely)
     */
    purge(kId: string): boolean {
        const obj = this.objects.get(kId);
        if (!obj) return false;

        // Remove from all indexes
        if (obj.threeUuid) {
            this.threeUuidIndex.delete(obj.threeUuid);
        }
        this.typeIndex.get(obj.type)?.delete(kId);
        this.appIndex.get(obj.createdBy)?.delete(kId);
        if (obj.layerKId) {
            this.layerIndex.get(obj.layerKId)?.delete(kId);
        }

        // Remove from parent's children
        if (obj.parentKId) {
            const parent = this.objects.get(obj.parentKId);
            if (parent) {
                parent.childKIds = parent.childKIds.filter(id => id !== kId);
            }
        }

        // Orphan children (or cascade delete?)
        obj.childKIds.forEach(childKId => {
            const child = this.objects.get(childKId);
            if (child) {
                child.parentKId = undefined;
            }
        });

        this.objects.delete(kId);

        return true;
    }

    /**
     * Unregister by THREE.js uuid (soft delete + unload)
     * Use when a mesh is removed from scene
     */
    unregisterByThreeUuid(threeUuid: string): boolean {
        const kId = this.threeUuidIndex.get(threeUuid);
        if (!kId) return false;

        console.log(`[KObjectRegistry] Unregistering by threeUuid: ${threeUuid} -> ${kId}`);
        return this.delete(kId);
    }

    // ========================================================================
    // LOAD/UNLOAD STATE
    // ========================================================================

    /**
     * Mark object as loaded (in scene)
     */
    markLoaded(kId: string, threeUuid?: string): boolean {
        const obj = this.objects.get(kId);
        if (!obj) return false;

        obj.isLoaded = true;
        if (threeUuid) {
            if (obj.threeUuid) {
                this.threeUuidIndex.delete(obj.threeUuid);
            }
            obj.threeUuid = threeUuid;
            this.threeUuidIndex.set(threeUuid, kId);
        }
        obj.modifiedAt = Date.now();

        return true;
    }

    /**
     * Mark object as unloaded (removed from scene but tracking)
     */
    markUnloaded(kId: string): boolean {
        const obj = this.objects.get(kId);
        if (!obj) return false;

        obj.isLoaded = false;
        if (obj.threeUuid) {
            this.threeUuidIndex.delete(obj.threeUuid);
            obj.threeUuid = undefined;
        }
        obj.modifiedAt = Date.now();

        return true;
    }

    // ========================================================================
    // EVENTS
    // ========================================================================

    /**
     * Subscribe to registry events
     */
    subscribe(listener: KObjectListener): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    private emit(event: KObjectEvent): void {
        this.listeners.forEach(listener => {
            try {
                listener(event);
            } catch (e) {
                console.error('[KObjectRegistry] Listener error:', e);
            }
        });
    }

    // ========================================================================
    // SERIALIZATION
    // ========================================================================

    /**
     * Export registry to JSON (for save)
     */
    toJSON(): Record<string, KObject> {
        const data: Record<string, KObject> = {};
        this.objects.forEach((obj, kId) => {
            data[kId] = { ...obj };
        });
        return data;
    }

    /**
     * Import registry from JSON (for load)
     */
    fromJSON(data: Record<string, KObject>): void {
        // Clear existing
        this.objects.clear();
        this.threeUuidIndex.clear();
        this.typeIndex.forEach(set => set.clear());
        this.appIndex.clear();
        this.layerIndex.clear();

        // Import
        Object.entries(data).forEach(([kId, obj]) => {
            this.objects.set(kId, { ...obj, isLoaded: false }); // Mark as unloaded until bound

            this.typeIndex.get(obj.type)?.add(kId);

            if (!this.appIndex.has(obj.createdBy)) {
                this.appIndex.set(obj.createdBy, new Set());
            }
            this.appIndex.get(obj.createdBy)?.add(kId);

            if (obj.layerKId) {
                if (!this.layerIndex.has(obj.layerKId)) {
                    this.layerIndex.set(obj.layerKId, new Set());
                }
                this.layerIndex.get(obj.layerKId)?.add(kId);
            }
        });
    }

    /**
     * Get stats
     */
    getStats(): { total: number; byType: Record<string, number>; byApp: Record<string, number>; loaded: number; deleted: number } {
        const byType: Record<string, number> = {};
        const byApp: Record<string, number> = {};
        let loaded = 0;
        let deleted = 0;

        this.objects.forEach(obj => {
            byType[obj.type] = (byType[obj.type] || 0) + 1;
            byApp[obj.createdBy] = (byApp[obj.createdBy] || 0) + 1;
            if (obj.isLoaded) loaded++;
            if (obj.isDeleted) deleted++;
        });

        return { total: this.objects.size, byType, byApp, loaded, deleted };
    }

    /**
     * Clear all objects
     */
    clear(): void {
        this.objects.clear();
        this.threeUuidIndex.clear();
        this.typeIndex.forEach(set => set.clear());
        this.appIndex.clear();
        this.layerIndex.clear();
    }
}

// ============================================================================
// SINGLETON
// ============================================================================

let registryInstance: KObjectRegistry | null = null;

/**
 * Get the global K_OS Object Registry
 */
export function getKObjectRegistry(): KObjectRegistry {
    if (!registryInstance) {
        registryInstance = new KObjectRegistry();

        // Expose to window for debugging
        if (typeof window !== 'undefined') {
            (window as any).kObjectRegistry = registryInstance;
        }
    }
    return registryInstance;
}

// Export singleton for direct import
export const kObjectRegistry = getKObjectRegistry();

/**
 * Reset the registry (for testing)
 */
export function resetKObjectRegistry(): void {
    registryInstance?.clear();
    registryInstance = null;
}

// ============================================================================
// REACT HOOK
// ============================================================================

import { useSyncExternalStore, useCallback } from 'react';

/**
 * React hook to use the K_OS Object Registry
 */
export function useKObjectRegistry() {
    const registry = getKObjectRegistry();

    // Subscribe to changes
    const subscribe = useCallback((callback: () => void) => {
        return registry.subscribe(() => callback());
    }, [registry]);

    // Get snapshot (stats for now, could be more specific)
    const getSnapshot = useCallback(() => {
        return registry.getStats();
    }, [registry]);

    useSyncExternalStore(subscribe, getSnapshot);

    return registry;
}

export default KObjectRegistry;
