/**
 * SmartMask.ts
 * 
 * Smart masking system for procedural mask generation.
 * Supports curvature, height, slope-based masking with GPU acceleration.
 */

import * as THREE from 'three';
import {
  MaskConfig,
  AnyMaskConfig,
  CombinedMaskConfig,
  MaskBlendMode,
  BakedMaskMaps,
  MaskGenerationParams,
  MaskGenerationResult,
} from './MaskTypes';
import { NormalMapBaker } from '../baking/NormalMapBaker';
import { CurvatureBaker } from '../baking/CurvatureBaker';

/**
 * Smart mask system for generating procedural masks
 */
export class SmartMaskSystem {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;
  private bakedMaps: Map<string, BakedMaskMaps> = new Map();
  
  // Baking system components
  private normalBaker: NormalMapBaker;
  private curvatureBaker: CurvatureBaker;

  constructor(renderer: THREE.WebGLRenderer) {
    this.renderer = renderer;
    
    // Setup orthographic scene for mask rendering
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    
    // Initialize bakers
    this.normalBaker = new NormalMapBaker(renderer);
    this.curvatureBaker = new CurvatureBaker(renderer);
  }

  /**
   * Bake required maps for mask generation
   */
  async bakeMaps(mesh: THREE.Mesh, resolution: number = 1024): Promise<BakedMaskMaps> {
    const startTime = performance.now();
    
    // Use the extracted baking system
    const [normalResult, curvatureResult] = await Promise.all([
      this.normalBaker.bake({
        mesh,
        resolution,
        tangentSpace: false,
      }),
      this.curvatureBaker.bake({
        mesh,
        resolution,
        sensitivity: 1.0,
        separateChannels: true,
      }),
    ]);
    
    const maps: BakedMaskMaps = {
      curvatureMap: curvatureResult.texture,
      normalMap: normalResult.texture,
      positionMap: this.bakePositionMap(mesh, resolution),
    };

    console.log(`[SmartMask] Baked maps in ${(performance.now() - startTime).toFixed(2)}ms`);
    
    // Cache the baked maps
    const meshId = (mesh as any).uuid || mesh.id.toString();
    this.bakedMaps.set(meshId, maps);
    
    return maps;
  }

  /**
   * Generate a procedural mask based on configuration
   */
  generateMask(params: MaskGenerationParams): MaskGenerationResult {
    const startTime = performance.now();
    const { mesh, config, bakedMaps, resolution = 1024 } = params;

    // Get or generate baked maps
    const meshId = (mesh as any).uuid || mesh.id.toString();
    const maps = bakedMaps || this.bakedMaps.get(meshId);
    
    if (!maps) {
      throw new Error('[SmartMask] No baked maps available. Call bakeMaps() first.');
    }

    // Generate mask texture based on config type
    let maskTexture: THREE.Texture;
    
    if ('masks' in config) {
      // Combined mask
      maskTexture = this.generateCombinedMask(config as CombinedMaskConfig, maps, resolution);
    } else {
      // Single mask
      maskTexture = this.generateSingleMask(config as AnyMaskConfig, maps, resolution);
    }

    const timeMs = performance.now() - startTime;
    console.log(`[SmartMask] Generated mask in ${timeMs.toFixed(2)}ms`);

    return {
      maskTexture,
      bakedMaps: maps,
      timeMs,
    };
  }

  /**
   * Generate a single mask
   */
  private generateSingleMask(
    config: AnyMaskConfig,
    maps: BakedMaskMaps,
    resolution: number
  ): THREE.Texture {
    const renderTarget = new THREE.WebGLRenderTarget(resolution, resolution, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.FloatType,
    });

    // Create shader material based on mask type
    const material = this.createMaskMaterial(config, maps);
    
    // Render mask to texture
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    this.scene.add(quad);
    
    const oldTarget = this.renderer.getRenderTarget();
    this.renderer.setRenderTarget(renderTarget);
    this.renderer.render(this.scene, this.camera);
    this.renderer.setRenderTarget(oldTarget);
    
    this.scene.remove(quad);
    quad.geometry.dispose();
    material.dispose();

    return renderTarget.texture;
  }

  /**
   * Generate a combined mask from multiple masks
   */
  private generateCombinedMask(
    config: CombinedMaskConfig,
    maps: BakedMaskMaps,
    resolution: number
  ): THREE.Texture {
    // Generate individual masks
    const maskTextures = config.masks.map(maskConfig =>
      this.generateSingleMask(maskConfig, maps, resolution)
    );

    // Combine masks using blend mode
    const combinedTexture = this.combineMasks(maskTextures, config.blendMode, config.strength, resolution);

    // Cleanup individual mask textures
    maskTextures.forEach(tex => tex.dispose());

    return combinedTexture;
  }

  /**
   * Combine multiple mask textures using a blend operation
   */
  combineMasks(
    masks: THREE.Texture[],
    operation: MaskBlendMode,
    strength: number = 1.0,
    resolution: number = 1024
  ): THREE.Texture {
    if (masks.length === 0) {
      throw new Error('[SmartMask] No masks to combine');
    }

    if (masks.length === 1) {
      return masks[0];
    }

    const renderTarget = new THREE.WebGLRenderTarget(resolution, resolution, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.FloatType,
    });

    // Create blend shader
    const material = new THREE.ShaderMaterial({
      uniforms: {
        mask1: { value: masks[0] },
        mask2: { value: masks[1] },
        operation: { value: this.getBlendModeValue(operation) },
        strength: { value: strength },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D mask1;
        uniform sampler2D mask2;
        uniform int operation;
        uniform float strength;
        varying vec2 vUv;

        void main() {
          float m1 = texture2D(mask1, vUv).r;
          float m2 = texture2D(mask2, vUv).r;
          float result = m1;

          if (operation == 0) {
            // Add
            result = clamp(m1 + m2, 0.0, 1.0);
          } else if (operation == 1) {
            // Multiply
            result = m1 * m2;
          } else if (operation == 2) {
            // Subtract
            result = clamp(m1 - m2, 0.0, 1.0);
          } else if (operation == 3) {
            // Screen
            result = 1.0 - (1.0 - m1) * (1.0 - m2);
          } else if (operation == 4) {
            // Overlay
            result = m1 < 0.5 ? 2.0 * m1 * m2 : 1.0 - 2.0 * (1.0 - m1) * (1.0 - m2);
          } else if (operation == 5) {
            // Min
            result = min(m1, m2);
          } else if (operation == 6) {
            // Max
            result = max(m1, m2);
          }

          result = mix(m1, result, strength);
          gl_FragColor = vec4(result, result, result, 1.0);
        }
      `,
    });

    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    this.scene.add(quad);

    const oldTarget = this.renderer.getRenderTarget();
    this.renderer.setRenderTarget(renderTarget);
    this.renderer.render(this.scene, this.camera);
    this.renderer.setRenderTarget(oldTarget);

    this.scene.remove(quad);
    quad.geometry.dispose();
    material.dispose();

    // If more than 2 masks, recursively combine
    if (masks.length > 2) {
      const remaining = masks.slice(2);
      return this.combineMasks([renderTarget.texture, ...remaining], operation, strength, resolution);
    }

    return renderTarget.texture;
  }

  /**
   * Create shader material for mask generation
   */
  private createMaskMaterial(config: AnyMaskConfig, maps: BakedMaskMaps): THREE.ShaderMaterial {
    const uniforms: Record<string, { value: any }> = {
      strength: { value: config.strength },
      invert: { value: config.invert },
      feather: { value: config.feather },
    };

    let fragmentShader = '';

    switch (config.type) {
      case 'curvature':
        uniforms.curvatureMap = { value: maps.curvatureMap };
        uniforms.mode = { value: config.mode === 'edge' ? 0 : 1 };
        uniforms.threshold = { value: config.threshold };
        fragmentShader = this.getCurvatureMaskShader();
        break;

      case 'height':
        uniforms.positionMap = { value: maps.positionMap };
        uniforms.minHeight = { value: config.minHeight };
        uniforms.maxHeight = { value: config.maxHeight };
        uniforms.falloff = { value: config.falloff };
        fragmentShader = this.getHeightMaskShader();
        break;

      case 'slope':
        uniforms.normalMap = { value: maps.normalMap };
        uniforms.direction = { value: this.getSlopeDirectionValue(config.direction) };
        uniforms.angle = { value: (config.angle * Math.PI) / 180 };
        uniforms.tolerance = { value: config.tolerance };
        fragmentShader = this.getSlopeMaskShader();
        break;

      case 'custom':
        if (typeof config.generator === 'string') {
          fragmentShader = config.generator;
          if (config.uniforms) {
            Object.assign(uniforms, config.uniforms);
          }
        } else {
          throw new Error('[SmartMask] Function-based custom masks not yet supported');
        }
        break;
    }

    return new THREE.ShaderMaterial({
      uniforms,
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader,
    });
  }

  /**
   * Bake curvature map (R=convex/edges, G=concave/cavities)
   * @deprecated Use CurvatureBaker directly
   */
  private bakeCurvatureMap(mesh: THREE.Mesh, resolution: number): THREE.Texture {
    console.warn('[SmartMask] bakeCurvatureMap is deprecated, use CurvatureBaker');
    // Placeholder for backward compatibility
    const data = new Float32Array(resolution * resolution * 4);
    const texture = new THREE.DataTexture(data, resolution, resolution, THREE.RGBAFormat, THREE.FloatType);
    texture.needsUpdate = true;
    return texture;
  }

  /**
   * Bake normal map (world-space normals)
   * @deprecated Use NormalMapBaker directly
   */
  private bakeNormalMap(mesh: THREE.Mesh, resolution: number): THREE.Texture {
    console.warn('[SmartMask] bakeNormalMap is deprecated, use NormalMapBaker');
    // Placeholder for backward compatibility
    const data = new Float32Array(resolution * resolution * 4);
    const texture = new THREE.DataTexture(data, resolution, resolution, THREE.RGBAFormat, THREE.FloatType);
    texture.needsUpdate = true;
    return texture;
  }

  /**
   * Bake position map (world-space positions)
   */
  private bakePositionMap(mesh: THREE.Mesh, resolution: number): THREE.Texture {
    // TODO: Implement position map baking
    const data = new Float32Array(resolution * resolution * 4);
    const texture = new THREE.DataTexture(data, resolution, resolution, THREE.RGBAFormat, THREE.FloatType);
    texture.needsUpdate = true;
    return texture;
  }

  /**
   * Get curvature mask shader
   */
  private getCurvatureMaskShader(): string {
    return `
      uniform sampler2D curvatureMap;
      uniform int mode;
      uniform float threshold;
      uniform float strength;
      uniform bool invert;
      uniform float feather;
      varying vec2 vUv;

      void main() {
        vec4 curv = texture2D(curvatureMap, vUv);
        float value = mode == 0 ? curv.r : curv.g; // edge or cavity
        
        float mask = smoothstep(threshold - feather, threshold + feather, value);
        mask *= strength;
        
        if (invert) {
          mask = 1.0 - mask;
        }
        
        gl_FragColor = vec4(mask, mask, mask, 1.0);
      }
    `;
  }

  /**
   * Get height mask shader
   */
  private getHeightMaskShader(): string {
    return `
      uniform sampler2D positionMap;
      uniform float minHeight;
      uniform float maxHeight;
      uniform float falloff;
      uniform float strength;
      uniform bool invert;
      uniform float feather;
      varying vec2 vUv;

      void main() {
        vec3 pos = texture2D(positionMap, vUv).xyz;
        float height = pos.y;
        
        float mask = smoothstep(minHeight - falloff, minHeight + falloff, height) *
                     (1.0 - smoothstep(maxHeight - falloff, maxHeight + falloff, height));
        
        mask *= strength;
        
        if (invert) {
          mask = 1.0 - mask;
        }
        
        gl_FragColor = vec4(mask, mask, mask, 1.0);
      }
    `;
  }

  /**
   * Get slope mask shader
   */
  private getSlopeMaskShader(): string {
    return `
      uniform sampler2D normalMap;
      uniform int direction;
      uniform float angle;
      uniform float tolerance;
      uniform float strength;
      uniform bool invert;
      uniform float feather;
      varying vec2 vUv;

      void main() {
        vec3 normal = texture2D(normalMap, vUv).xyz * 2.0 - 1.0;
        float slope = 0.0;
        
        if (direction == 0) {
          // Up
          slope = normal.y;
        } else if (direction == 1) {
          // Down
          slope = -normal.y;
        } else {
          // Horizontal
          slope = 1.0 - abs(normal.y);
        }
        
        float mask = smoothstep(angle - tolerance, angle + tolerance, slope);
        mask *= strength;
        
        if (invert) {
          mask = 1.0 - mask;
        }
        
        gl_FragColor = vec4(mask, mask, mask, 1.0);
      }
    `;
  }

  /**
   * Get blend mode numeric value
   */
  private getBlendModeValue(mode: MaskBlendMode): number {
    const modes: Record<MaskBlendMode, number> = {
      add: 0,
      multiply: 1,
      subtract: 2,
      screen: 3,
      overlay: 4,
      min: 5,
      max: 6,
    };
    return modes[mode];
  }

  /**
   * Get slope direction numeric value
   */
  private getSlopeDirectionValue(direction: 'up' | 'down' | 'horizontal'): number {
    const directions: Record<string, number> = {
      up: 0,
      down: 1,
      horizontal: 2,
    };
    return directions[direction];
  }

  /**
   * Dispose of cached resources
   */
  dispose(): void {
    this.bakedMaps.forEach(maps => {
      maps.curvatureMap?.dispose();
      maps.normalMap?.dispose();
      maps.positionMap?.dispose();
      maps.aoMap?.dispose();
    });
    this.bakedMaps.clear();
    
    // Dispose bakers
    this.normalBaker.dispose();
    this.curvatureBaker.dispose();
  }
}
