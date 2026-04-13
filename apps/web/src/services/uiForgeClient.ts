/**
 * uiForgeClient.ts
 * 
 * TypeScript service client for UI Forge Python backend.
 * Wraps JSON-RPC calls to Python sidecar with type-safe interfaces.
 * 
 * UI Forge is a procedural UI asset generation system that creates icons, brushes,
 * patterns, cursors, and overlays through data-driven templates.
 * 
 * Usage:
 *   import { uiForgeClient } from '@/services/uiForgeClient';
 *   const result = await uiForgeClient.generateAsset(templateData);
 */

import { invoke } from '@tauri-apps/api/core';
import type {
    Template,
    GenerationResult,
    ProgressInfo,
    BatchGenerateResult,
    ApprovePreviewResult,
    LibraryIndex,
    GeneratorInfo,
    PreviewStatus,
    TemplateListItem,
    AssetSearchResult,
    Statistics,
    RPCResponse,
} from './uiForge.types';

// ============================================================================
// Error Handling
// ============================================================================

export class UIForgeError extends Error {
    constructor(
        message: string,
        public readonly type: string,
        public readonly traceback?: string
    ) {
        super(message);
        this.name = 'UIForgeError';
    }
}

/**
 * Unwrap RPC response and throw on error
 */
function unwrapRPCResponse<T>(response: RPCResponse<T>): T {
    if (!response.success || response.data === null) {
        const error = response.error;
        if (error) {
            throw new UIForgeError(error.message, error.type, error.traceback);
        }
        throw new UIForgeError('Unknown RPC error', 'UnknownError');
    }
    return response.data;
}

// ============================================================================
// Check if Tauri is available
// ============================================================================

const isTauri = (): boolean => {
    return typeof window !== 'undefined' && '__TAURI__' in window;
};

// ============================================================================
// UI Forge Client
// ============================================================================

export const uiForgeClient = {
    /**
     * Check if UI Forge Python backend is available
     */
    isAvailable: (): boolean => {
        return isTauri();
    },

    /**
     * Generate a single asset from template data.
     * 
     * @param templateData - Complete template configuration
     * @returns Generation result with output paths and metadata
     * 
     * @example
     * ```typescript
     * const result = await uiForgeClient.generateAsset({
     *   name: "Sculpt Clay Icon",
     *   description: "Clay sculpting tool icon",
     *   generator_type: GeneratorType.ICON,
     *   category: "toolbar",
     *   dimensions: { width: 64, height: 64 },
     *   output_formats: [OutputFormat.PNG, OutputFormat.SVG],
     *   params: {
     *     layers: [
     *       {
     *         type: "circle",
     *         geometry: { cx: 32, cy: 32, r: 24 },
     *         fill: { type: "solid", colors: ["#2563eb"] }
     *       }
     *     ]
     *   }
     * });
     * ```
     */
    generateAsset: async (templateData: Template): Promise<GenerationResult> => {
        if (!isTauri()) {
            throw new UIForgeError('Tauri not available', 'TauriUnavailable');
        }

        try {
            const response = await invoke<RPCResponse<GenerationResult>>(
                'python_rpc',
                {
                    method: 'ui_forge.generate_asset',
                    params: { template_data: templateData },
                }
            );
            return unwrapRPCResponse(response);
        } catch (error) {
            console.error('[uiForgeClient] generateAsset failed:', error);
            throw error;
        }
    },

    /**
     * Generate multiple assets in batch with parallel processing.
     * 
     * @param templatePaths - Array of paths to template files
     * @param parallel - Use multiprocessing for parallel generation (default: true)
     * @param maxWorkers - Maximum worker processes (defaults to CPU count)
     * @returns Batch information with batch ID for progress tracking
     * 
     * @example
     * ```typescript
     * const batch = await uiForgeClient.batchGenerate([
     *   'templates/icons/sculpt-clay.yaml',
     *   'templates/icons/sculpt-smooth.yaml',
     *   'templates/icons/sculpt-grab.yaml',
     * ]);
     * console.log(`Batch ${batch.batch_id}: ${batch.successful}/${batch.total} successful`);
     * ```
     */
    batchGenerate: async (
        templatePaths: string[],
        parallel: boolean = true,
        maxWorkers?: number
    ): Promise<BatchGenerateResult> => {
        if (!isTauri()) {
            throw new UIForgeError('Tauri not available', 'TauriUnavailable');
        }

        try {
            const response = await invoke<RPCResponse<BatchGenerateResult>>(
                'python_rpc',
                {
                    method: 'ui_forge.batch_generate',
                    params: {
                        template_paths: templatePaths,
                        parallel,
                        max_workers: maxWorkers,
                    },
                }
            );
            return unwrapRPCResponse(response);
        } catch (error) {
            console.error('[uiForgeClient] batchGenerate failed:', error);
            throw error;
        }
    },

    /**
     * Get progress information for a batch generation operation.
     * 
     * @param batchId - Batch ID returned by batchGenerate
     * @returns Progress information with completion percentage
     * 
     * @example
     * ```typescript
     * const progress = await uiForgeClient.getProgress(batchId);
     * console.log(`Progress: ${progress.percent_complete}%`);
     * console.log(`Completed: ${progress.completed}/${progress.total}`);
     * ```
     */
    getProgress: async (batchId: string): Promise<ProgressInfo> => {
        if (!isTauri()) {
            throw new UIForgeError('Tauri not available', 'TauriUnavailable');
        }

        try {
            const response = await invoke<RPCResponse<ProgressInfo>>(
                'python_rpc',
                {
                    method: 'ui_forge.get_progress',
                    params: { batch_id: batchId },
                }
            );
            return unwrapRPCResponse(response);
        } catch (error) {
            console.error('[uiForgeClient] getProgress failed:', error);
            throw error;
        }
    },

    /**
     * List available templates, optionally filtered by category.
     * 
     * @param category - Optional category filter (e.g., 'icons', 'brushes')
     * @returns Array of template summaries
     * 
     * @example
     * ```typescript
     * const iconTemplates = await uiForgeClient.listTemplates('icons');
     * const allTemplates = await uiForgeClient.listTemplates();
     * ```
     */
    listTemplates: async (category?: string): Promise<TemplateListItem[]> => {
        if (!isTauri()) {
            throw new UIForgeError('Tauri not available', 'TauriUnavailable');
        }

        try {
            const response = await invoke<RPCResponse<TemplateListItem[]>>(
                'python_rpc',
                {
                    method: 'ui_forge.list_templates',
                    params: { category },
                }
            );
            return unwrapRPCResponse(response);
        } catch (error) {
            console.error('[uiForgeClient] listTemplates failed:', error);
            throw error;
        }
    },

    /**
     * Approve preview assets and optionally move to production library.
     * 
     * @param assetIds - Array of asset IDs to approve
     * @param previewId - Optional preview batch ID (searches all if omitted)
     * @param moveToLibrary - If true, move approved assets to library (default: true)
     * @returns Approval results with library asset IDs
     * 
     * @example
     * ```typescript
     * const result = await uiForgeClient.approvePreview(
     *   ['asset-123', 'asset-456'],
     *   'preview-abc',
     *   true
     * );
     * console.log(`Approved ${result.approved} assets, moved ${result.moved_to_library} to library`);
     * ```
     */
    approvePreview: async (
        assetIds: string[],
        previewId?: string,
        moveToLibrary: boolean = true
    ): Promise<ApprovePreviewResult> => {
        if (!isTauri()) {
            throw new UIForgeError('Tauri not available', 'TauriUnavailable');
        }

        try {
            const response = await invoke<RPCResponse<ApprovePreviewResult>>(
                'python_rpc',
                {
                    method: 'ui_forge.approve_preview',
                    params: {
                        asset_ids: assetIds,
                        preview_id: previewId,
                        move_to_library: moveToLibrary,
                    },
                }
            );
            return unwrapRPCResponse(response);
        } catch (error) {
            console.error('[uiForgeClient] approvePreview failed:', error);
            throw error;
        }
    },

    /**
     * Get the complete library index with all assets and metadata.
     * 
     * @returns Library index with categories, assets, and theme groups
     * 
     * @example
     * ```typescript
     * const index = await uiForgeClient.getLibraryIndex();
     * console.log(`Total assets: ${index.total_assets}`);
     * console.log(`Categories:`, Object.keys(index.categories));
     * ```
     */
    getLibraryIndex: async (): Promise<LibraryIndex> => {
        if (!isTauri()) {
            throw new UIForgeError('Tauri not available', 'TauriUnavailable');
        }

        try {
            const response = await invoke<RPCResponse<LibraryIndex>>(
                'python_rpc',
                {
                    method: 'ui_forge.get_library_index',
                    params: {},
                }
            );
            return unwrapRPCResponse(response);
        } catch (error) {
            console.error('[uiForgeClient] getLibraryIndex failed:', error);
            throw error;
        }
    },

    /**
     * Hot-reload a generator module without restarting the Python sidecar.
     * 
     * @param generatorType - Generator type to reload (e.g., 'icon', 'brush')
     * @returns Reload status
     * 
     * @example
     * ```typescript
     * await uiForgeClient.reloadGenerator('icon');
     * console.log('Icon generator reloaded successfully');
     * ```
     */
    reloadGenerator: async (generatorType: string): Promise<{
        status: string;
        generator: string;
        message: string;
    }> => {
        if (!isTauri()) {
            throw new UIForgeError('Tauri not available', 'TauriUnavailable');
        }

        try {
            const response = await invoke<RPCResponse<{
                status: string;
                generator: string;
                message: string;
            }>>(
                'python_rpc',
                {
                    method: 'ui_forge.reload_generator',
                    params: { generator_type: generatorType },
                }
            );
            return unwrapRPCResponse(response);
        } catch (error) {
            console.error('[uiForgeClient] reloadGenerator failed:', error);
            throw error;
        }
    },

    /**
     * Get status information for a preview batch.
     * 
     * @param previewId - Preview batch ID
     * @returns Preview status with asset counts
     * 
     * @example
     * ```typescript
     * const status = await uiForgeClient.getPreviewStatus('preview-abc');
     * console.log(`Pending: ${status.pending}, Approved: ${status.approved}`);
     * ```
     */
    getPreviewStatus: async (previewId: string): Promise<PreviewStatus> => {
        if (!isTauri()) {
            throw new UIForgeError('Tauri not available', 'TauriUnavailable');
        }

        try {
            const response = await invoke<RPCResponse<PreviewStatus>>(
                'python_rpc',
                {
                    method: 'ui_forge.get_preview_status',
                    params: { preview_id: previewId },
                }
            );
            return unwrapRPCResponse(response);
        } catch (error) {
            console.error('[uiForgeClient] getPreviewStatus failed:', error);
            throw error;
        }
    },

    /**
     * List all available generators with metadata.
     * 
     * @returns Array of generator information
     * 
     * @example
     * ```typescript
     * const generators = await uiForgeClient.listGenerators();
     * generators.forEach(gen => {
     *   console.log(`${gen.generator_type}: ${gen.class_name}`);
     * });
     * ```
     */
    listGenerators: async (): Promise<GeneratorInfo[]> => {
        if (!isTauri()) {
            throw new UIForgeError('Tauri not available', 'TauriUnavailable');
        }

        try {
            const response = await invoke<RPCResponse<GeneratorInfo[]>>(
                'python_rpc',
                {
                    method: 'ui_forge.list_generators',
                    params: {},
                }
            );
            return unwrapRPCResponse(response);
        } catch (error) {
            console.error('[uiForgeClient] listGenerators failed:', error);
            throw error;
        }
    },

    /**
     * Search library assets with filters.
     * 
     * @param options - Search filters
     * @returns Array of matching asset metadata
     * 
     * @example
     * ```typescript
     * const results = await uiForgeClient.searchLibrary({
     *   query: 'sculpt',
     *   category: 'icons',
     *   tags: ['toolbar'],
     *   minResolution: 64,
     * });
     * ```
     */
    searchLibrary: async (options: {
        query?: string;
        category?: string;
        tags?: string[];
        themeVariant?: string;
        minResolution?: number;
        maxResolution?: number;
    }): Promise<AssetSearchResult[]> => {
        if (!isTauri()) {
            throw new UIForgeError('Tauri not available', 'TauriUnavailable');
        }

        try {
            const response = await invoke<RPCResponse<AssetSearchResult[]>>(
                'python_rpc',
                {
                    method: 'ui_forge.search_library',
                    params: {
                        query: options.query,
                        category: options.category,
                        tags: options.tags,
                        theme_variant: options.themeVariant,
                        min_resolution: options.minResolution,
                        max_resolution: options.maxResolution,
                    },
                }
            );
            return unwrapRPCResponse(response);
        } catch (error) {
            console.error('[uiForgeClient] searchLibrary failed:', error);
            throw error;
        }
    },

    /**
     * Get comprehensive statistics about the UI Forge system.
     * 
     * @returns Statistics for engine, library, and generators
     * 
     * @example
     * ```typescript
     * const stats = await uiForgeClient.getStatistics();
     * console.log(`Generators: ${stats.generators}`);
     * console.log('Engine stats:', stats.engine);
     * console.log('Library stats:', stats.library);
     * ```
     */
    getStatistics: async (): Promise<Statistics> => {
        if (!isTauri()) {
            throw new UIForgeError('Tauri not available', 'TauriUnavailable');
        }

        try {
            const response = await invoke<RPCResponse<Statistics>>(
                'python_rpc',
                {
                    method: 'ui_forge.get_statistics',
                    params: {},
                }
            );
            return unwrapRPCResponse(response);
        } catch (error) {
            console.error('[uiForgeClient] getStatistics failed:', error);
            throw error;
        }
    },
};

// ============================================================================
// Re-export types for convenience
// ============================================================================

export * from './uiForge.types';

// ============================================================================
// Default export
// ============================================================================

export default uiForgeClient;
