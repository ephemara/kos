/**
 * K_OS GPU Core - Universal GPU Compute Frontend Layer
 * 
 * Provides app-agnostic access to:
 * - SVT (Sparse Virtual Texturing) for 16K+ textures
 * - SVT PBR (Multi-channel painting with 5 PBR channels)
 * - GPU Raycast (BVH-accelerated)
 * - GPU Spatial Grid
 * - GPU Filters (coming soon)
 * 
 * All apps can import from here for consistent GPU compute access.
 * 
 * @example
 * ```ts
 * // Basic SVT (single channel)
 * import { useSvt, SvtClient, svt } from '@/systems/svt';
 * 
 * // PBR SVT (5 channels with blend modes)
 * import { useSvtPbr, SvtPbrClient, svtPbr } from '@/systems/svt';
 * 
 * // PBR Hook usage
 * const { stroke, exportChannel } = useSvtPbr();
 * await stroke({
 *   centerUv: [0.5, 0.5],
 *   radius: 50,
 *   albedoColor: [1, 0, 0, 1],
 *   roughnessValue: 0.3,
 *   albedoEnabled: true,
 *   roughnessEnabled: true,
 * });
 * ```
 */

// ============================================================================
// SVT (Basic - Single Channel)
// ============================================================================

export { SvtClient, svt, createSvt } from './svtClient';
export type { SvtStats, Color4, UV } from './svtClient';
export { useSvt } from './useSvt';
export type { UseSvtOptions, UseSvtReturn } from './useSvt';

// ============================================================================
// SVT PBR (Multi-Channel - 5 PBR Channels)
// ============================================================================

export {
    SvtPbrClient,
    svtPbr,
    createSvtPbr,
    PbrChannelIndex,
    BlendModeIndex,
    getChannelDefaultColor,
} from './svtPbrClient';
export type {
    SvtPbrConfig,
    SvtPbrStats,
    PbrStrokeParams,
    PbrChannelName,
    BlendModeName,
} from './svtPbrClient';
export { useSvtPbr } from './useSvtPbr';
export type { UseSvtPbrOptions, UseSvtPbrReturn } from './useSvtPbr';

// SVT Texture Sync (GPU → Three.js)
export { SvtTextureSync, createTextureSync } from './SvtTextureSync';
export type { SvtTextureSyncConfig } from './SvtTextureSync';


// ============================================================================
// GPU Raycast (already in services/raycastClient.ts)
// ============================================================================
// TODO: Move gpuRaycastManager here for consistency

// ============================================================================
// GPU Spatial Grid (coming)
// ============================================================================
// TODO: Add spatialGridClient.ts when Tauri commands are ready

// ============================================================================
// GPU Filters (coming)
// ============================================================================
// TODO: Add filterClient.ts when pipelines/filters.rs is implemented
