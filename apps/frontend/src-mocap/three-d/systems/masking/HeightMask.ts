/**
 * HeightMask.ts
 * 
 * Height-based mask generation for world-space Y position masking.
 * Useful for masking based on elevation, creating gradient effects, etc.
 */

import * as THREE from 'three';
import { HeightMaskConfig } from './MaskTypes';

/**
 * Height mask generator
 * Creates masks based on world-space Y position
 */
export class HeightMask {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;

  constructor(renderer: THREE.WebGLRenderer) {
    this.renderer = renderer;
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }

  /**
   * Generate position map from mesh (world-space positions)
   */
  generatePositionMap(mesh: THREE.Mesh, resolution: number = 1024): THREE.Texture {
    const geometry = mesh.geometry;
    
    if (!geometry.attributes.position) {
      throw new Error('[HeightMask] Mesh must have position attribute');
    }

    // Create render target for position map
    const renderTarget = new THREE.WebGLRenderTarget(resolution, resolution, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.FloatType,
    });

    // Create position baking material
    const material = new THREE.ShaderMaterial({
      vertexShader: this.getPositionVertexShader(),
      fragmentShader: this.getPositionFragmentShader(),
    });

    // Render position to texture
    const tempMesh = new THREE.Mesh(geometry, material);
    tempMesh.position.copy(mesh.position);
    tempMesh.rotation.copy(mesh.rotation);
    tempMesh.scale.copy(mesh.scale);

    this.scene.add(tempMesh);

    const oldTarget = this.renderer.getRenderTarget();
    this.renderer.setRenderTarget(renderTarget);
    this.renderer.render(this.scene, this.camera);
    this.renderer.setRenderTarget(oldTarget);

    this.scene.remove(tempMesh);
    material.dispose();

    return renderTarget.texture;
  }

  /**
   * Generate height mask with min/max range
   */
  generateHeightMask(
    mesh: THREE.Mesh,
    config: Partial<HeightMaskConfig> = {},
    resolution: number = 1024
  ): THREE.Texture {
    const positionMap = this.generatePositionMap(mesh, resolution);
    
    // Calculate mesh bounds if not provided
    const bounds = this.calculateMeshBounds(mesh);
    
    const fullConfig: HeightMaskConfig = {
      type: 'height',
      minHeight: config.minHeight ?? bounds.min.y,
      maxHeight: config.maxHeight ?? bounds.max.y,
      falloff: config.falloff ?? 0.1,
      strength: config.strength ?? 1.0,
      invert: config.invert ?? false,
      feather: config.feather ?? 0.1,
    };

    return this.applyMaskConfig(positionMap, fullConfig, resolution);
  }

  /**
   * Generate height gradient mask (smooth transition from bottom to top)
   */
  generateGradientMask(
    mesh: THREE.Mesh,
    config: Partial<HeightMaskConfig> = {},
    resolution: number = 1024
  ): THREE.Texture {
    const positionMap = this.generatePositionMap(mesh, resolution);
    const bounds = this.calculateMeshBounds(mesh);
    
    const fullConfig: HeightMaskConfig = {
      type: 'height',
      minHeight: config.minHeight ?? bounds.min.y,
      maxHeight: config.maxHeight ?? bounds.max.y,
      falloff: config.falloff ?? (bounds.max.y - bounds.min.y) * 0.5, // Smooth gradient
      strength: config.strength ?? 1.0,
      invert: config.invert ?? false,
      feather: config.feather ?? 0.0,
    };

    return this.applyMaskConfig(positionMap, fullConfig, resolution);
  }

  /**
   * Generate height band mask (mask a specific height range)
   */
  generateBandMask(
    mesh: THREE.Mesh,
    centerHeight: number,
    bandWidth: number,
    config: Partial<HeightMaskConfig> = {},
    resolution: number = 1024
  ): THREE.Texture {
    const positionMap = this.generatePositionMap(mesh, resolution);
    
    const fullConfig: HeightMaskConfig = {
      type: 'height',
      minHeight: centerHeight - bandWidth / 2,
      maxHeight: centerHeight + bandWidth / 2,
      falloff: config.falloff ?? bandWidth * 0.2,
      strength: config.strength ?? 1.0,
      invert: config.invert ?? false,
      feather: config.feather ?? 0.1,
    };

    return this.applyMaskConfig(positionMap, fullConfig, resolution);
  }

  /**
   * Apply mask configuration to position map
   */
  private applyMaskConfig(
    positionMap: THREE.Texture,
    config: HeightMaskConfig,
    resolution: number
  ): THREE.Texture {
    const renderTarget = new THREE.WebGLRenderTarget(resolution, resolution, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.FloatType,
    });

    const material = new THREE.ShaderMaterial({
      uniforms: {
        positionMap: { value: positionMap },
        minHeight: { value: config.minHeight },
        maxHeight: { value: config.maxHeight },
        falloff: { value: config.falloff },
        strength: { value: config.strength },
        invert: { value: config.invert },
        feather: { value: config.feather },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
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
          
          // Create mask with smooth falloff at boundaries
          float maskMin = smoothstep(minHeight - falloff, minHeight + falloff, height);
          float maskMax = 1.0 - smoothstep(maxHeight - falloff, maxHeight + falloff, height);
          
          float mask = maskMin * maskMax;
          mask *= strength;
          
          if (invert) {
            mask = 1.0 - mask;
          }
          
          gl_FragColor = vec4(mask, mask, mask, 1.0);
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

    return renderTarget.texture;
  }

  /**
   * Position baking vertex shader
   */
  private getPositionVertexShader(): string {
    return `
      varying vec3 vWorldPosition;
      varying vec2 vUv;

      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;
  }

  /**
   * Position baking fragment shader
   */
  private getPositionFragmentShader(): string {
    return `
      varying vec3 vWorldPosition;
      varying vec2 vUv;

      void main() {
        // Store world position in RGB channels
        gl_FragColor = vec4(vWorldPosition, 1.0);
      }
    `;
  }

  /**
   * Calculate mesh bounding box in world space
   */
  private calculateMeshBounds(mesh: THREE.Mesh): { min: THREE.Vector3; max: THREE.Vector3 } {
    const geometry = mesh.geometry;
    
    if (!geometry.boundingBox) {
      geometry.computeBoundingBox();
    }

    const boundingBox = geometry.boundingBox!;
    const min = boundingBox.min.clone().applyMatrix4(mesh.matrixWorld);
    const max = boundingBox.max.clone().applyMatrix4(mesh.matrixWorld);

    return { min, max };
  }

  /**
   * Calculate vertex heights (CPU fallback)
   * Useful for vertex-based masking
   */
  calculateVertexHeights(mesh: THREE.Mesh): Float32Array {
    const geometry = mesh.geometry;
    const positions = geometry.attributes.position;
    
    if (!positions) {
      throw new Error('[HeightMask] Geometry must have position attribute');
    }

    const vertexCount = positions.count;
    const heights = new Float32Array(vertexCount);
    const worldMatrix = mesh.matrixWorld;

    // Calculate world-space height for each vertex
    const vertex = new THREE.Vector3();
    for (let i = 0; i < vertexCount; i++) {
      vertex.set(
        positions.getX(i),
        positions.getY(i),
        positions.getZ(i)
      );
      vertex.applyMatrix4(worldMatrix);
      heights[i] = vertex.y;
    }

    return heights;
  }

  /**
   * Apply height mask to vertex colors (CPU fallback)
   */
  applyHeightMaskToVertexColors(
    mesh: THREE.Mesh,
    config: HeightMaskConfig
  ): void {
    const geometry = mesh.geometry;
    const heights = this.calculateVertexHeights(mesh);
    
    // Create or get vertex color attribute
    let colors = geometry.attributes.color;
    if (!colors) {
      const colorArray = new Float32Array(heights.length * 3);
      colors = new THREE.BufferAttribute(colorArray, 3);
      geometry.setAttribute('color', colors);
    }

    // Apply mask to vertex colors
    for (let i = 0; i < heights.length; i++) {
      const height = heights[i];
      
      // Calculate mask value
      let mask = 0;
      if (height >= config.minHeight && height <= config.maxHeight) {
        const maskMin = this.smoothstep(
          config.minHeight - config.falloff,
          config.minHeight + config.falloff,
          height
        );
        const maskMax = 1.0 - this.smoothstep(
          config.maxHeight - config.falloff,
          config.maxHeight + config.falloff,
          height
        );
        mask = maskMin * maskMax * config.strength;
      }

      if (config.invert) {
        mask = 1.0 - mask;
      }

      // Set vertex color
      colors.setXYZ(i, mask, mask, mask);
    }

    colors.needsUpdate = true;
  }

  /**
   * Smoothstep function (CPU implementation)
   */
  private smoothstep(edge0: number, edge1: number, x: number): number {
    const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
  }
}
