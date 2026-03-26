/**
 * Asset Manager
 * 
 * Core system for loading, managing, and hot-reloading assets.
 * Implements the Pixologic Asset Philosophy: zero hardcoded content.
 */

import type {
  Asset,
  AssetType,
  BrushAsset,
  AlphaAsset,
  MaterialAsset,
  HDRAsset,
  AssetLoadResult,
  AssetChangeEvent,
  AssetValidationResult,
  AssetManagerConfig,
} from './types';

/**
 * Event listener type for asset changes
 */
type AssetChangeListener = (event: AssetChangeEvent) => void;

/**
 * Asset Manager singleton class
 */
export class AssetManager {
  private brushes: Map<string, BrushAsset> = new Map();
  private alphas: Map<string, AlphaAsset> = new Map();
  private materials: Map<string, MaterialAsset> = new Map();
  private hdrs: Map<string, HDRAsset> = new Map();
  
  private listeners: Set<AssetChangeListener> = new Set();
  private watcherActive = false;
  
  private config: AssetManagerConfig = {
    directories: {
      brushes: 'assets/brushes',
      alphas: 'assets/alphas',
      materials: 'assets/materials',
      hdr: 'assets/hdr',
      thumbnails: 'assets/.thumbnails',
    },
    enableHotReload: true,
    generateThumbnails: true,
    thumbnailSize: 256,
    validateOnLoad: true,
  };

  /**
   * Initialize the asset manager and scan directories
   */
  async initialize(config?: Partial<AssetManagerConfig>): Promise<void> {
    if (config) {
      this.config = { ...this.config, ...config };
    }

    console.log('[AssetManager] Initializing...');
    const startTime = performance.now();

    // Scan all asset directories
    await Promise.all([
      this.scanDirectory(this.config.directories.brushes, 'brush'),
      this.scanDirectory(this.config.directories.alphas, 'alpha'),
      this.scanDirectory(this.config.directories.materials, 'material'),
      this.scanDirectory(this.config.directories.hdr, 'hdr'),
    ]);

    const loadTime = performance.now() - startTime;
    const totalAssets = this.brushes.size + this.alphas.size + this.materials.size + this.hdrs.size;
    
    console.log(`[AssetManager] Loaded ${totalAssets} assets in ${loadTime.toFixed(2)}ms`);
    console.log(`  - Brushes: ${this.brushes.size}`);
    console.log(`  - Alphas: ${this.alphas.size}`);
    console.log(`  - Materials: ${this.materials.size}`);
    console.log(`  - HDRs: ${this.hdrs.size}`);

    // Setup hot-reload watcher if enabled
    if (this.config.enableHotReload) {
      await this.setupWatcher();
    }
  }

  /**
   * Scan a directory for assets
   */
  private async scanDirectory(directory: string, assetType: AssetType): Promise<void> {
    try {
      // In a real implementation, this would use Tauri filesystem API
      // For now, we'll use a placeholder that loads from public directory
      const files = await this.listFiles(directory);
      
      for (const file of files) {
        // Skip hidden files and thumbnails
        if (file.startsWith('.') || file.startsWith('_')) {
          continue;
        }

        // Only load .ts, .js, and .json files
        if (!file.endsWith('.ts') && !file.endsWith('.js') && !file.endsWith('.json')) {
          continue;
        }

        const filePath = `${directory}/${file}`;
        await this.loadAsset(filePath, assetType);
      }
    } catch (error) {
      console.error(`[AssetManager] Failed to scan directory ${directory}:`, error);
    }
  }

  /**
   * List files in a directory (placeholder - would use Tauri in production)
   */
  private async listFiles(directory: string): Promise<string[]> {
    // This is a placeholder. In production, this would use:
    // await invoke('fs_read_dir', { path: directory })
    
    // For now, return empty array - assets will be loaded dynamically
    return [];
  }

  /**
   * Load an asset from a file
   */
  private async loadAsset(filePath: string, assetType: AssetType): Promise<AssetLoadResult> {
    try {
      // In production, this would dynamically import the asset file
      // For TypeScript files: const module = await import(filePath);
      // For JSON files: const data = await fetch(filePath).then(r => r.json());
      
      // Placeholder for now
      console.log(`[AssetManager] Loading ${assetType} from ${filePath}`);
      
      return {
        success: false,
        error: 'Asset loading not yet implemented',
        filePath,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[AssetManager] Failed to load asset ${filePath}:`, errorMessage);
      
      return {
        success: false,
        error: errorMessage,
        filePath,
      };
    }
  }

  /**
   * Register an asset programmatically
   */
  registerAsset(asset: Asset): void {
    const registry = this.getRegistry(asset.type);
    registry.set(asset.id, asset as any);
    
    this.emitChange({
      type: 'added',
      assetType: asset.type,
      assetId: asset.id,
      asset,
    });
  }

  /**
   * Unregister an asset
   */
  unregisterAsset(assetType: AssetType, assetId: string): void {
    const registry = this.getRegistry(assetType);
    const existed = registry.delete(assetId);
    
    if (existed) {
      this.emitChange({
        type: 'removed',
        assetType,
        assetId,
      });
    }
  }

  /**
   * Get the appropriate registry for an asset type
   */
  private getRegistry(assetType: AssetType): Map<string, any> {
    switch (assetType) {
      case 'brush': return this.brushes;
      case 'alpha': return this.alphas;
      case 'material': return this.materials;
      case 'hdr': return this.hdrs;
    }
  }

  /**
   * Setup filesystem watcher for hot-reload
   */
  private async setupWatcher(): Promise<void> {
    if (this.watcherActive) {
      return;
    }

    // In production, this would use Tauri filesystem watcher:
    // await invoke('fs_watch', { paths: Object.values(this.config.directories) })
    
    console.log('[AssetManager] Hot-reload watcher enabled');
    this.watcherActive = true;
  }

  /**
   * Handle file change event (called by watcher)
   */
  async handleFileChange(filePath: string, changeType: 'added' | 'modified' | 'removed'): Promise<void> {
    // Determine asset type from path
    const assetType = this.getAssetTypeFromPath(filePath);
    if (!assetType) {
      return;
    }

    if (changeType === 'removed') {
      // Extract asset ID from file path
      const assetId = this.extractAssetIdFromPath(filePath);
      this.unregisterAsset(assetType, assetId);
    } else {
      // Reload the asset
      const result = await this.loadAsset(filePath, assetType);
      if (result.success && result.asset) {
        this.registerAsset(result.asset);
        
        this.emitChange({
          type: changeType === 'added' ? 'added' : 'modified',
          assetType,
          assetId: result.asset.id,
          asset: result.asset,
        });
      }
    }
  }

  /**
   * Determine asset type from file path
   */
  private getAssetTypeFromPath(filePath: string): AssetType | null {
    if (filePath.includes(this.config.directories.brushes)) return 'brush';
    if (filePath.includes(this.config.directories.alphas)) return 'alpha';
    if (filePath.includes(this.config.directories.materials)) return 'material';
    if (filePath.includes(this.config.directories.hdr)) return 'hdr';
    return null;
  }

  /**
   * Extract asset ID from file path
   */
  private extractAssetIdFromPath(filePath: string): string {
    const fileName = filePath.split('/').pop() || '';
    return fileName.replace(/\.(ts|js|json)$/, '');
  }

  /**
   * Validate an asset
   */
  validateAsset(asset: Asset): AssetValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic validation
    if (!asset.id) errors.push('Missing required field: id');
    if (!asset.name) errors.push('Missing required field: name');
    if (!asset.type) errors.push('Missing required field: type');

    // Type-specific validation
    switch (asset.type) {
      case 'brush':
        this.validateBrushAsset(asset, errors, warnings);
        break;
      case 'alpha':
        this.validateAlphaAsset(asset, errors, warnings);
        break;
      case 'material':
        this.validateMaterialAsset(asset, errors, warnings);
        break;
      case 'hdr':
        this.validateHDRAsset(asset, errors, warnings);
        break;
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  private validateBrushAsset(asset: BrushAsset, errors: string[], warnings: string[]): void {
    if (asset.size <= 0) errors.push('Brush size must be positive');
    if (asset.hardness < 0 || asset.hardness > 1) errors.push('Hardness must be between 0 and 1');
    if (asset.spacing < 0 || asset.spacing > 1) errors.push('Spacing must be between 0 and 1');
    if (asset.opacity < 0 || asset.opacity > 1) errors.push('Opacity must be between 0 and 1');
    if (asset.flow < 0 || asset.flow > 1) errors.push('Flow must be between 0 and 1');
  }

  private validateAlphaAsset(asset: AlphaAsset, errors: string[], warnings: string[]): void {
    if (!asset.filePath && !asset.embeddedData) {
      errors.push('Alpha asset must have either filePath or embeddedData');
    }
  }

  private validateMaterialAsset(asset: MaterialAsset, errors: string[], warnings: string[]): void {
    if (asset.metallic < 0 || asset.metallic > 1) errors.push('Metallic must be between 0 and 1');
    if (asset.roughness < 0 || asset.roughness > 1) errors.push('Roughness must be between 0 and 1');
  }

  private validateHDRAsset(asset: HDRAsset, errors: string[], warnings: string[]): void {
    if (!asset.filePath && !asset.embeddedData) {
      errors.push('HDR asset must have either filePath or embeddedData');
    }
  }

  // ===== Public API =====

  /**
   * Get all brushes
   */
  getAllBrushes(): BrushAsset[] {
    return Array.from(this.brushes.values());
  }

  /**
   * Get a specific brush by ID
   */
  getBrush(id: string): BrushAsset | undefined {
    return this.brushes.get(id);
  }

  /**
   * Get brushes by category
   */
  getBrushesByCategory(category: string): BrushAsset[] {
    return this.getAllBrushes().filter(b => b.category === category);
  }

  /**
   * Search brushes by query
   */
  searchBrushes(query: string): BrushAsset[] {
    const lowerQuery = query.toLowerCase();
    return this.getAllBrushes().filter(b =>
      b.name.toLowerCase().includes(lowerQuery) ||
      b.description?.toLowerCase().includes(lowerQuery) ||
      b.tags?.some(t => t.toLowerCase().includes(lowerQuery))
    );
  }

  /**
   * Get all alphas
   */
  getAllAlphas(): AlphaAsset[] {
    return Array.from(this.alphas.values());
  }

  /**
   * Get a specific alpha by ID
   */
  getAlpha(id: string): AlphaAsset | undefined {
    return this.alphas.get(id);
  }

  /**
   * Get all materials
   */
  getAllMaterials(): MaterialAsset[] {
    return Array.from(this.materials.values());
  }

  /**
   * Get a specific material by ID
   */
  getMaterial(id: string): MaterialAsset | undefined {
    return this.materials.get(id);
  }

  /**
   * Get materials by category
   */
  getMaterialsByCategory(category: string): MaterialAsset[] {
    return this.getAllMaterials().filter(m => m.category === category);
  }

  /**
   * Search materials by query
   */
  searchMaterials(query: string): MaterialAsset[] {
    const lowerQuery = query.toLowerCase();
    return this.getAllMaterials().filter(m =>
      m.name.toLowerCase().includes(lowerQuery) ||
      m.description?.toLowerCase().includes(lowerQuery) ||
      m.tags?.some(t => t.toLowerCase().includes(lowerQuery))
    );
  }

  /**
   * Get all HDR environments
   */
  getAllHDRs(): HDRAsset[] {
    return Array.from(this.hdrs.values());
  }

  /**
   * Get a specific HDR by ID
   */
  getHDR(id: string): HDRAsset | undefined {
    return this.hdrs.get(id);
  }

  /**
   * Subscribe to asset changes
   */
  subscribe(listener: AssetChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Emit asset change event
   */
  private emitChange(event: AssetChangeEvent): void {
    this.listeners.forEach(listener => listener(event));
  }

  /**
   * Get asset statistics
   */
  getStats() {
    return {
      brushes: this.brushes.size,
      alphas: this.alphas.size,
      materials: this.materials.size,
      hdrs: this.hdrs.size,
      total: this.brushes.size + this.alphas.size + this.materials.size + this.hdrs.size,
    };
  }
}

/**
 * Singleton instance
 */
export const assetManager = new AssetManager();
