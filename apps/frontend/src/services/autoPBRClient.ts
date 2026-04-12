// AutoPBR Service Client
// TypeScript wrapper for Tauri IPC calls to material system

import { invoke } from '@tauri-apps/api/core';
import type {
  MaterialHandle,
  MaterialCategory,
  Layer,
  AnimationData,
} from '@/features/material/kautopbr/types';

/**
 * Request type for creating a new material
 * Omits auto-generated fields from MaterialMetadata
 */
export interface MaterialMetadataRequest {
  name: string;
  description: string;
  tags: string[];
  author: string;
  category: MaterialCategory;
}

/**
 * Search result with relevance scoring
 */
export interface SearchResult {
  id: string;
  name: string;
  score: number;
}

/**
 * AutoPBR Service Client
 * 
 * Provides typed TypeScript wrapper around Tauri IPC commands for the material system.
 * All methods include error handling with user-friendly messages.
 * 
 * Validates: Requirements 9.1, 9.2, 9.4
 */
export class AutoPBRClient {
  /**
   * Create a new material with given metadata
   * 
   * @param metadata - Material metadata (name, description, tags, author, category)
   * @returns UUID of the created material
   * @throws Error with user-friendly message if creation fails
   * 
   * Validates: Requirements 9.1, 9.2
   */
  async createMaterial(metadata: MaterialMetadataRequest): Promise<string> {
    try {
      return await invoke<string>('create_material', { metadata });
    } catch (error) {
      throw new Error(`Failed to create material: ${error}`);
    }
  }

  /**
   * Load a material from a JSON file
   * 
   * @param path - File path to the material JSON file
   * @returns MaterialHandle containing the material ID and metadata
   * @throws Error with user-friendly message if loading fails
   * 
   * Validates: Requirements 9.1, 9.2
   */
  async loadMaterial(path: string): Promise<MaterialHandle> {
    try {
      return await invoke<MaterialHandle>('load_material', { path });
    } catch (error) {
      throw new Error(`Failed to load material from "${path}": ${error}`);
    }
  }

  /**
   * Save a material to a JSON file
   * 
   * @param id - UUID of the material to save
   * @param path - File path where the material should be saved
   * @returns Success message
   * @throws Error with user-friendly message if saving fails
   * 
   * Validates: Requirements 9.1, 9.2
   */
  async saveMaterial(id: string, path: string): Promise<string> {
    try {
      return await invoke<string>('save_material', { id, path });
    } catch (error) {
      throw new Error(`Failed to save material "${id}" to "${path}": ${error}`);
    }
  }

  /**
   * Delete a material from the system
   * 
   * @param id - UUID of the material to delete
   * @returns Success message
   * @throws Error with user-friendly message if deletion fails
   * 
   * Validates: Requirements 9.1, 9.2
   */
  async deleteMaterial(id: string): Promise<string> {
    try {
      return await invoke<string>('delete_material', { id });
    } catch (error) {
      throw new Error(`Failed to delete material "${id}": ${error}`);
    }
  }

  /**
   * Search materials by query string
   * 
   * Searches across material name, description, and tags using fuzzy matching.
   * Results are ranked by relevance score.
   * 
   * @param query - Search query string
   * @param category - Optional category filter
   * @returns List of search results with material IDs, names, and relevance scores
   * @throws Error with user-friendly message if search fails
   * 
   * Validates: Requirements 9.4, 9.5
   */
  async searchMaterials(query: string, category?: MaterialCategory): Promise<SearchResult[]> {
    try {
      return await invoke<SearchResult[]>('search_materials', { query, category });
    } catch (error) {
      throw new Error(`Failed to search materials with query "${query}": ${error}`);
    }
  }

  /**
   * Get material metadata by ID
   * 
   * @param id - UUID of the material
   * @returns MaterialHandle containing the material ID and metadata
   * @throws Error with user-friendly message if material not found
   */
  async getMaterial(id: string): Promise<MaterialHandle> {
    try {
      return await invoke<MaterialHandle>('get_material', { id });
    } catch (error) {
      throw new Error(`Failed to get material "${id}": ${error}`);
    }
  }

  /**
   * Filter materials by category
   * 
   * @param category - Material category to filter by
   * @returns List of material IDs matching the category
   * @throws Error with user-friendly message if filtering fails
   * 
   * Validates: Requirements 9.5
   */
  async filterMaterialsByCategory(category: MaterialCategory): Promise<string[]> {
    try {
      return await invoke<string[]>('filter_materials_by_category', { category });
    } catch (error) {
      throw new Error(`Failed to filter materials by category "${category}": ${error}`);
    }
  }

  /**
   * List all materials in the system
   * 
   * @returns List of all material handles
   * @throws Error with user-friendly message if listing fails
   */
  async listMaterials(): Promise<MaterialHandle[]> {
    try {
      return await invoke<MaterialHandle[]>('list_materials');
    } catch (error) {
      throw new Error(`Failed to list materials: ${error}`);
    }
  }

  /**
   * Add a layer to a material
   * 
   * @param materialId - UUID of the material
   * @param layer - Layer data to add
   * @throws Error with user-friendly message if adding layer fails
   */
  async addLayer(materialId: string, layer: Layer): Promise<void> {
    try {
      await invoke('autopbr_add_layer', { materialId, layer });
    } catch (error) {
      throw new Error(`Failed to add layer to material "${materialId}": ${error}`);
    }
  }

  /**
   * Remove a layer from a material
   * 
   * @param materialId - UUID of the material
   * @param layerIndex - Index of the layer to remove
   * @throws Error with user-friendly message if removing layer fails
   */
  async removeLayer(materialId: string, layerIndex: number): Promise<void> {
    try {
      await invoke('autopbr_remove_layer', { materialId, layerIndex });
    } catch (error) {
      throw new Error(`Failed to remove layer ${layerIndex} from material "${materialId}": ${error}`);
    }
  }

  /**
   * Reorder layers in a material
   * 
   * @param materialId - UUID of the material
   * @param from - Source index
   * @param to - Destination index
   * @throws Error with user-friendly message if reordering fails
   */
  async reorderLayers(materialId: string, from: number, to: number): Promise<void> {
    try {
      await invoke('autopbr_reorder_layers', { materialId, from, to });
    } catch (error) {
      throw new Error(`Failed to reorder layers in material "${materialId}": ${error}`);
    }
  }

  /**
   * Set animation data for a material
   * 
   * @param materialId - UUID of the material
   * @param animation - Animation data to set
   * @throws Error with user-friendly message if setting animation fails
   */
  async setAnimation(materialId: string, animation: AnimationData): Promise<void> {
    try {
      await invoke('autopbr_set_animation', { materialId, animation });
    } catch (error) {
      throw new Error(`Failed to set animation for material "${materialId}": ${error}`);
    }
  }

  /**
   * Evaluate animation at a given time
   * 
   * Returns parameter values at the specified time, accounting for keyframe interpolation,
   * procedural expressions, and loop modes.
   * 
   * @param materialId - UUID of the material
   * @param time - Time in seconds to evaluate animation at
   * @returns Object mapping parameter names to their values at the given time
   * @throws Error with user-friendly message if evaluation fails
   * 
   * Validates: Requirements 5.5, 5.7
   */
  async evaluateAnimation(materialId: string, time: number): Promise<Record<string, number>> {
    try {
      return await invoke<Record<string, number>>('evaluate_animation', { materialId, time });
    } catch (error) {
      throw new Error(`Failed to evaluate animation for material "${materialId}" at time ${time}: ${error}`);
    }
  }

  // ============================================================================
  // ANIMATION PRESET METHODS
  // ============================================================================

  /**
   * List all available animation presets
   * 
   * Returns a sorted list of preset names loaded from the config directory.
   * Presets are automatically loaded on startup and hot-reloaded when files change.
   * 
   * @returns List of preset names sorted alphabetically
   * @throws Error with user-friendly message if listing fails
   * 
   * Validates: Requirements 14.2, 18.2
   */
  async listAnimationPresets(): Promise<string[]> {
    try {
      return await invoke<string[]>('list_animation_presets');
    } catch (error) {
      throw new Error(`Failed to list animation presets: ${error}`);
    }
  }

  /**
   * Get an animation preset by name
   * 
   * Returns the complete preset including metadata (name, description, category, tags, author, version)
   * and animation data (duration, loop mode, tracks).
   * 
   * @param name - Name of the preset to retrieve
   * @returns Animation preset with all metadata and animation data
   * @throws Error with user-friendly message if preset not found
   * 
   * Validates: Requirements 14.2, 14.8
   */
  async getAnimationPreset(name: string): Promise<any> {
    try {
      return await invoke<any>('get_animation_preset', { name });
    } catch (error) {
      throw new Error(`Failed to get animation preset "${name}": ${error}`);
    }
  }

  /**
   * Apply an animation preset to a material
   * 
   * Loads the preset by name and applies its animation data to the material.
   * Replaces any existing animation on the material.
   * 
   * @param materialId - UUID of the material to apply preset to
   * @param presetName - Name of the preset to apply
   * @returns Success message
   * @throws Error with user-friendly message if application fails
   * 
   * Validates: Requirements 14.2, 14.4, 14.7
   */
  async applyAnimationPreset(materialId: string, presetName: string): Promise<string> {
    try {
      return await invoke<string>('apply_animation_preset', { materialId, presetName });
    } catch (error) {
      throw new Error(`Failed to apply preset "${presetName}" to material "${materialId}": ${error}`);
    }
  }

  /**
   * Search animation presets by name or tags
   * 
   * Performs case-insensitive search across preset names and tags.
   * Useful for finding presets by keywords like "glow", "water", "fire", etc.
   * 
   * @param query - Search query (case-insensitive)
   * @returns List of preset names matching the query
   * @throws Error with user-friendly message if search fails
   * 
   * Validates: Requirements 14.9
   */
  async searchAnimationPresets(query: string): Promise<string[]> {
    try {
      return await invoke<string[]>('search_animation_presets', { query });
    } catch (error) {
      throw new Error(`Failed to search animation presets with query "${query}": ${error}`);
    }
  }

  /**
   * List animation presets filtered by category
   * 
   * Returns presets matching the specified category (e.g., "Sci-Fi", "Organic", "Effects").
   * Categories are defined in the animation preset schema.
   * 
   * @param category - Category to filter by
   * @returns List of preset names in the specified category
   * @throws Error with user-friendly message if filtering fails
   * 
   * Validates: Requirements 14.3, 14.9
   */
  async listAnimationPresetsByCategory(category: string): Promise<string[]> {
    try {
      return await invoke<string[]>('list_animation_presets_by_category', { category });
    } catch (error) {
      throw new Error(`Failed to list animation presets for category "${category}": ${error}`);
    }
  }
  // ============================================================================
  // AI/ML INTEGRATION METHODS
  // ============================================================================

  /**
   * Upscale a texture using AI (Real-ESRGAN)
   * 
   * Uses Real-ESRGAN neural network for high-quality texture upscaling.
   * Preserves detail better than traditional interpolation methods.
   * 
   * @param imageBase64 - Base64-encoded input image (PNG/JPEG)
   * @param scaleFactor - Upscaling factor (2, 4, or 8)
   * @returns Base64-encoded upscaled image (PNG)
   * @throws Error with user-friendly message if upscaling fails
   * 
   * Validates: Requirements 11.1, 11.2
   */
  async aiUpscaleTexture(imageBase64: string, scaleFactor: 2 | 4 | 8): Promise<string> {
    try {
      return await invoke<string>('ai_upscale_texture', { imageBase64, scaleFactor });
    } catch (error) {
      throw new Error(`Failed to upscale texture (${scaleFactor}x): ${error}`);
    }
  }

  /**
   * Denoise a texture using AI (NAFNet)
   * 
   * Uses NAFNet neural network for intelligent noise reduction.
   * Preserves texture detail while reducing noise artifacts.
   * 
   * @param imageBase64 - Base64-encoded input image
   * @param strength - Denoising strength (0.0-1.0), default 0.5
   * @returns Base64-encoded denoised image (PNG)
   * @throws Error with user-friendly message if denoising fails
   * 
   * Validates: Requirements 11.4, 11.5
   */
  async aiDenoiseTexture(imageBase64: string, strength: number = 0.5): Promise<string> {
    try {
      return await invoke<string>('ai_denoise_texture', { imageBase64, strength });
    } catch (error) {
      throw new Error(`Failed to denoise texture: ${error}`);
    }
  }

  /**
   * Identify material type using AI (CLIP)
   * 
   * Uses CLIP vision model to classify material type from texture image.
   * Returns category and confidence score.
   * 
   * @param imageBase64 - Base64-encoded input image
   * @returns Object with category (string) and confidence (0.0-1.0)
   * @throws Error with user-friendly message if identification fails
   * 
   * Validates: Requirements 11.6, 11.7, 11.8
   */
  async aiIdentifyMaterial(imageBase64: string): Promise<{ category: string; confidence: number }> {
    try {
      return await invoke<{ category: string; confidence: number }>('ai_identify_material', { imageBase64 });
    } catch (error) {
      throw new Error(`Failed to identify material: ${error}`);
    }
  }

  /**
   * Make texture seamless using AI inpainting (Stable Diffusion)
   * 
   * Uses Stable Diffusion inpainting to blend texture edges seamlessly.
   * Automatically detects edge discontinuities and inpaints them.
   * Retries up to 3 times if validation fails.
   * 
   * @param imageBase64 - Base64-encoded input image
   * @param strength - Inpainting strength (0.0-1.0), default 0.8
   * @returns Base64-encoded seamless texture (PNG)
   * @throws Error with user-friendly message if tiling fails
   * 
   * Validates: Requirements 4.1, 4.2, 4.3, 4.7, 4.9
   */
  async aiMakeSeamless(imageBase64: string, strength: number = 0.8): Promise<string> {
    try {
      return await invoke<string>('ai_make_seamless', { imageBase64, strength });
    } catch (error) {
      throw new Error(`Failed to make texture seamless: ${error}`);
    }
  }

  /**
   * Correct perspective distortion in texture using AI
   * 
   * Detects perspective distortion using Hough transform and corrects it.
   * Useful for textures captured from photos at an angle.
   * 
   * @param imageBase64 - Base64-encoded input image
   * @returns Base64-encoded corrected image (PNG)
   * @throws Error with user-friendly message if correction fails
   * 
   * Validates: Requirements 4.5
   */
  async aiCorrectPerspective(imageBase64: string): Promise<string> {
    try {
      return await invoke<string>('ai_correct_perspective', { imageBase64 });
    } catch (error) {
      throw new Error(`Failed to correct perspective: ${error}`);
    }
  }

  /**
   * Remove fold artifacts from fabric textures using AI
   * 
   * Detects and removes fold/wrinkle artifacts from fabric textures.
   * Uses Stable Diffusion inpainting to smooth out folds.
   * 
   * @param imageBase64 - Base64-encoded input image
   * @returns Base64-encoded fold-free image (PNG)
   * @throws Error with user-friendly message if fold removal fails
   * 
   * Validates: Requirements 4.4
   */
  async aiRemoveFolds(imageBase64: string): Promise<string> {
    try {
      return await invoke<string>('ai_remove_folds', { imageBase64 });
    } catch (error) {
      throw new Error(`Failed to remove folds: ${error}`);
    }
  }
}

// Singleton instance
export const autoPBRClient = new AutoPBRClient();
