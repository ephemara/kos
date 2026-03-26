import * as THREE from 'three';
import type { PBRMaps } from '../types';

export interface PBRMaterialParameters {
  roughness?: number;
  metallic?: number;
  normalStrength?: number;
  heightScale?: number;
  emissiveIntensity?: number;
  emissiveColor?: [number, number, number];
}

export interface PBRMaterialConfig {
  maps: PBRMaps;
  parameters?: PBRMaterialParameters;
}

/**
 * PBRMaterial - Wrapper for Three.js MeshStandardMaterial with full PBR map support
 * 
 * Implements Requirements:
 * - 8.3: Render materials using physically-based shading with Three.js
 * - 15.1: Real-time parameter updates (< 33ms latency)
 * 
 * Supports all PBR map types:
 * - Albedo (base color)
 * - Normal (surface detail)
 * - Roughness (surface smoothness)
 * - Metallic (metallic vs dielectric)
 * - AO (ambient occlusion)
 * - Height (displacement/parallax)
 * - Emissive (self-illumination)
 */
export class PBRMaterial {
  public material: THREE.MeshStandardMaterial;
  private textureLoader: THREE.TextureLoader;
  private loadedTextures: Map<string, THREE.Texture>;

  constructor(config: PBRMaterialConfig) {
    this.textureLoader = new THREE.TextureLoader();
    this.loadedTextures = new Map();

    // Create MeshStandardMaterial with PBR support
    this.material = new THREE.MeshStandardMaterial({
      roughness: config.parameters?.roughness ?? 0.5,
      metalness: config.parameters?.metallic ?? 0.0,
      emissiveIntensity: config.parameters?.emissiveIntensity ?? 0.0,
      normalScale: new THREE.Vector2(
        config.parameters?.normalStrength ?? 1.0,
        config.parameters?.normalStrength ?? 1.0
      ),
      // Enable features
      flatShading: false,
      side: THREE.FrontSide,
      transparent: false,
      depthWrite: true,
      depthTest: true,
    });

    // Set emissive color if provided
    if (config.parameters?.emissiveColor) {
      this.material.emissive = new THREE.Color(
        config.parameters.emissiveColor[0],
        config.parameters.emissiveColor[1],
        config.parameters.emissiveColor[2]
      );
    }

    // Load initial maps
    this.loadMaps(config.maps);
  }

  /**
   * Update material parameters in real-time
   * Must complete within 33ms (Requirement 15.1)
   */
  public updateParameters(params: Partial<PBRMaterialParameters>): void {
    if (params.roughness !== undefined) {
      this.material.roughness = params.roughness;
    }

    if (params.metallic !== undefined) {
      this.material.metalness = params.metallic;
    }

    if (params.normalStrength !== undefined) {
      this.material.normalScale.set(params.normalStrength, params.normalStrength);
    }

    if (params.heightScale !== undefined) {
      this.material.displacementScale = params.heightScale;
    }

    if (params.emissiveIntensity !== undefined) {
      this.material.emissiveIntensity = params.emissiveIntensity;
    }

    if (params.emissiveColor !== undefined) {
      this.material.emissive.setRGB(
        params.emissiveColor[0],
        params.emissiveColor[1],
        params.emissiveColor[2]
      );
    }
  }

  /**
   * Update PBR maps
   * Loads new textures and applies them to the material
   */
  public async updateMaps(maps: PBRMaps): Promise<void> {
    await this.loadMaps(maps);
  }

  /**
   * Load all PBR maps from texture handles
   * Supports all map types: albedo, normal, roughness, metallic, AO, height, emissive
   */
  private async loadMaps(maps: PBRMaps): Promise<void> {
    const loadPromises: Promise<void>[] = [];

    // Albedo (base color) map
    if (maps.albedo) {
      loadPromises.push(
        this.loadTexture(maps.albedo.path, 'albedo').then((texture) => {
          if (texture) {
            texture.colorSpace = THREE.SRGBColorSpace;
            this.material.map = texture;
          }
        })
      );
    } else {
      this.material.map = null;
    }

    // Normal map
    if (maps.normal) {
      loadPromises.push(
        this.loadTexture(maps.normal.path, 'normal').then((texture) => {
          if (texture) {
            texture.colorSpace = THREE.LinearSRGBColorSpace;
            this.material.normalMap = texture;
          }
        })
      );
    } else {
      this.material.normalMap = null;
    }

    // Roughness map
    if (maps.roughness) {
      loadPromises.push(
        this.loadTexture(maps.roughness.path, 'roughness').then((texture) => {
          if (texture) {
            texture.colorSpace = THREE.LinearSRGBColorSpace;
            this.material.roughnessMap = texture;
          }
        })
      );
    } else {
      this.material.roughnessMap = null;
    }

    // Metallic map
    if (maps.metallic) {
      loadPromises.push(
        this.loadTexture(maps.metallic.path, 'metallic').then((texture) => {
          if (texture) {
            texture.colorSpace = THREE.LinearSRGBColorSpace;
            this.material.metalnessMap = texture;
          }
        })
      );
    } else {
      this.material.metalnessMap = null;
    }

    // Ambient Occlusion map
    if (maps.ao) {
      loadPromises.push(
        this.loadTexture(maps.ao.path, 'ao').then((texture) => {
          if (texture) {
            texture.colorSpace = THREE.LinearSRGBColorSpace;
            this.material.aoMap = texture;
            this.material.aoMapIntensity = 1.0;
          }
        })
      );
    } else {
      this.material.aoMap = null;
    }

    // Height (displacement) map
    if (maps.height) {
      loadPromises.push(
        this.loadTexture(maps.height.path, 'height').then((texture) => {
          if (texture) {
            texture.colorSpace = THREE.LinearSRGBColorSpace;
            this.material.displacementMap = texture;
            this.material.displacementScale = this.material.displacementScale || 0.1;
          }
        })
      );
    } else {
      this.material.displacementMap = null;
    }

    // Emissive map
    if (maps.emissive) {
      loadPromises.push(
        this.loadTexture(maps.emissive.path, 'emissive').then((texture) => {
          if (texture) {
            texture.colorSpace = THREE.SRGBColorSpace;
            this.material.emissiveMap = texture;
          }
        })
      );
    } else {
      this.material.emissiveMap = null;
    }

    // Wait for all textures to load
    await Promise.all(loadPromises);

    // Mark material for update
    this.material.needsUpdate = true;
  }

  /**
   * Load a texture from path with caching
   * Returns cached texture if already loaded
   */
  private async loadTexture(path: string, type: string): Promise<THREE.Texture | null> {
    // Check cache first
    const cacheKey = `${type}:${path}`;
    if (this.loadedTextures.has(cacheKey)) {
      return this.loadedTextures.get(cacheKey)!;
    }

    try {
      const texture = await this.textureLoader.loadAsync(path);
      
      // Configure texture settings for PBR
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.anisotropy = 16; // Max anisotropic filtering for quality
      
      // Use mipmaps for better performance and quality
      texture.generateMipmaps = true;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.magFilter = THREE.LinearFilter;

      // Cache the texture
      this.loadedTextures.set(cacheKey, texture);

      return texture;
    } catch (error) {
      console.error(`Failed to load texture: ${path}`, error);
      return null;
    }
  }

  /**
   * Dispose of material and all loaded textures
   * Call this when the material is no longer needed
   */
  public dispose(): void {
    // Dispose material
    this.material.dispose();

    // Dispose all loaded textures
    for (const texture of this.loadedTextures.values()) {
      texture.dispose();
    }

    this.loadedTextures.clear();
  }

  /**
   * Get material statistics for debugging
   * Implements Requirement 8.11: Display material statistics
   */
  public getStatistics(): {
    textureCount: number;
    memoryEstimate: number; // in MB
    hasAlbedo: boolean;
    hasNormal: boolean;
    hasRoughness: boolean;
    hasMetallic: boolean;
    hasAO: boolean;
    hasHeight: boolean;
    hasEmissive: boolean;
  } {
    let memoryEstimate = 0;

    // Estimate memory usage (rough calculation)
    for (const texture of this.loadedTextures.values()) {
      const image = texture.image as HTMLImageElement;
      if (image) {
        const width = image.width || 1024;
        const height = image.height || 1024;
        const bytesPerPixel = 4; // RGBA
        const mipmapMultiplier = 1.33; // Mipmaps add ~33% overhead
        memoryEstimate += (width * height * bytesPerPixel * mipmapMultiplier) / (1024 * 1024);
      }
    }

    return {
      textureCount: this.loadedTextures.size,
      memoryEstimate: Math.round(memoryEstimate * 100) / 100,
      hasAlbedo: this.material.map !== null,
      hasNormal: this.material.normalMap !== null,
      hasRoughness: this.material.roughnessMap !== null,
      hasMetallic: this.material.metalnessMap !== null,
      hasAO: this.material.aoMap !== null,
      hasHeight: this.material.displacementMap !== null,
      hasEmissive: this.material.emissiveMap !== null,
    };
  }
}
