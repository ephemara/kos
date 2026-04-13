/**
 * SlopeMask.ts
 * 
 * Slope-based mask generation for surface orientation masking.
 * Analyzes surface normals to create masks based on slope direction and angle.
 */

import * as THREE from 'three';
import { SlopeMaskConfig } from './MaskTypes';

/**
 * Slope mask generator
 * Creates masks based on surface normal direction (up, down, horizontal)
 */
export class SlopeMask {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;

  constructor(renderer: THREE.WebGLRenderer) {
    this.renderer = renderer;
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }

  /**
   * Generate normal map from mesh (world-space normals)
   */
  generateNormalMap(mesh: THREE.Mesh, resolution: number = 1024): THREE.Texture {
    const geometry = mesh.geometry;
    
    if (!geometry.attributes.position || !geometry.attributes.normal) {
      throw new Error('[SlopeMask] Mesh must have position and normal attributes');
    }

    // Create render target for normal map
    const renderTarget = new THREE.WebGLRenderTarget(resolution, resolution, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.FloatType,
    });

    // Create normal baking material
    const material = new THREE.ShaderMaterial({
      vertexShader: this.getNormalVertexShader(),
      fragmentShader: this.getNormalFragmentShader(),
    });

    // Render normals to texture
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
   * Generate slope mask for upward-facing surfaces
   */
  generateUpMask(
    mesh: THREE.Mesh,
    config: Partial<SlopeMaskConfig> = {},
    resolution: number = 1024
  ): THREE.Texture {
    const normalMap = this.generateNormalMap(mesh, resolution);
    
    const fullConfig: SlopeMaskConfig = {
      type: 'slope',
      direction: 'up',
      angle: config.angle ?? 45,
      tolerance: config.tolerance ?? 15,
      strength: config.strength ?? 1.0,
      invert: config.invert ?? false,
      feather: config.feather ?? 0.1,
    };

    return this.applyMaskConfig(normalMap, fullConfig, resolution);
  }

  /**
   * Generate slope mask for downward-facing surfaces
   */
  generateDownMask(
    mesh: THREE.Mesh,
    config: Partial<SlopeMaskConfig> = {},
    resolution: number = 1024
  ): THREE.Texture {
    const normalMap = this.generateNormalMap(mesh, resolution);
    
    const fullConfig: SlopeMaskConfig = {
      type: 'slope',
      direction: 'down',
      angle: config.angle ?? 45,
      tolerance: config.tolerance ?? 15,
      strength: config.strength ?? 1.0,
      invert: config.invert ?? false,
      feather: config.feather ?? 0.1,
    };

    return this.applyMaskConfig(normalMap, fullConfig, resolution);
  }

  /**
   * Generate slope mask for horizontal surfaces
   */
  generateHorizontalMask(
    mesh: THREE.Mesh,
    config: Partial<SlopeMaskConfig> = {},
    resolution: number = 1024
  ): THREE.Texture {
    const normalMap = this.generateNormalMap(mesh, resolution);
    
    const fullConfig: SlopeMaskConfig = {
      type: 'slope',
      direction: 'horizontal',
      angle: config.angle ?? 90,
      tolerance: config.tolerance ?? 15,
      strength: config.strength ?? 1.0,
      invert: config.invert ?? false,
      feather: config.feather ?? 0.1,
    };

    return this.applyMaskConfig(normalMap, fullConfig, resolution);
  }

  /**
   * Generate slope mask with custom angle and direction
   */
  generateSlopeMask(
    mesh: THREE.Mesh,
    config: Partial<SlopeMaskConfig> = {},
    resolution: number = 1024
  ): THREE.Texture {
    const normalMap = this.generateNormalMap(mesh, resolution);
    
    const fullConfig: SlopeMaskConfig = {
      type: 'slope',
      direction: config.direction ?? 'up',
      angle: config.angle ?? 45,
      tolerance: config.tolerance ?? 15,
      strength: config.strength ?? 1.0,
      invert: config.invert ?? false,
      feather: config.feather ?? 0.1,
    };

    return this.applyMaskConfig(normalMap, fullConfig, resolution);
  }

  /**
   * Apply mask configuration to normal map
   */
  private applyMaskConfig(
    normalMap: THREE.Texture,
    config: SlopeMaskConfig,
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
        normalMap: { value: normalMap },
        direction: { value: this.getSlopeDirectionValue(config.direction) },
        angle: { value: (config.angle * Math.PI) / 180 }, // Convert to radians
        tolerance: { value: (config.tolerance * Math.PI) / 180 }, // Convert to radians
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
        uniform sampler2D normalMap;
        uniform int direction;
        uniform float angle;
        uniform float tolerance;
        uniform float strength;
        uniform bool invert;
        uniform float feather;
        varying vec2 vUv;

        void main() {
          // Read world-space normal from map
          vec3 normal = texture2D(normalMap, vUv).xyz * 2.0 - 1.0;
          normal = normalize(normal);
          
          float slope = 0.0;
          
          if (direction == 0) {
            // Up: measure alignment with +Y axis
            slope = normal.y;
          } else if (direction == 1) {
            // Down: measure alignment with -Y axis
            slope = -normal.y;
          } else {
            // Horizontal: measure perpendicularity to Y axis
            slope = 1.0 - abs(normal.y);
          }
          
          // Convert slope to angle (0 to PI/2)
          float surfaceAngle = acos(clamp(slope, -1.0, 1.0));
          
          // Create mask based on angle threshold with tolerance
          float mask = 1.0 - smoothstep(
            angle - tolerance - feather,
            angle - tolerance + feather,
            surfaceAngle
          );
          
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
   * Normal baking vertex shader
   */
  private getNormalVertexShader(): string {
    return `
      varying vec3 vWorldNormal;
      varying vec2 vUv;

      void main() {
        // Transform normal to world space
        vec3 worldNormal = normalize(mat3(modelMatrix) * normal);
        vWorldNormal = worldNormal;
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;
  }

  /**
   * Normal baking fragment shader
   */
  private getNormalFragmentShader(): string {
    return `
      varying vec3 vWorldNormal;
      varying vec2 vUv;

      void main() {
        // Store world-space normal in RGB channels (normalized to 0-1)
        vec3 normal = normalize(vWorldNormal);
        gl_FragColor = vec4(normal * 0.5 + 0.5, 1.0);
      }
    `;
  }

  /**
   * Get slope direction numeric value for shader
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
   * Calculate vertex slopes (CPU fallback)
   * Returns slope values for each vertex based on normal direction
   */
  calculateVertexSlopes(
    mesh: THREE.Mesh,
    direction: 'up' | 'down' | 'horizontal' = 'up'
  ): Float32Array {
    const geometry = mesh.geometry;
    const normals = geometry.attributes.normal;
    
    if (!normals) {
      throw new Error('[SlopeMask] Geometry must have normal attribute');
    }

    const vertexCount = normals.count;
    const slopes = new Float32Array(vertexCount);
    const worldMatrix = mesh.matrixWorld;
    const normalMatrix = new THREE.Matrix3().getNormalMatrix(worldMatrix);

    // Calculate slope for each vertex
    const normal = new THREE.Vector3();
    for (let i = 0; i < vertexCount; i++) {
      normal.set(
        normals.getX(i),
        normals.getY(i),
        normals.getZ(i)
      );
      
      // Transform to world space
      normal.applyMatrix3(normalMatrix).normalize();

      // Calculate slope based on direction
      let slope = 0;
      if (direction === 'up') {
        slope = normal.y; // Alignment with +Y
      } else if (direction === 'down') {
        slope = -normal.y; // Alignment with -Y
      } else {
        slope = 1.0 - Math.abs(normal.y); // Perpendicularity to Y
      }

      slopes[i] = Math.max(0, Math.min(1, slope));
    }

    return slopes;
  }

  /**
   * Apply slope mask to vertex colors (CPU fallback)
   */
  applySlopeMaskToVertexColors(
    mesh: THREE.Mesh,
    config: SlopeMaskConfig
  ): void {
    const geometry = mesh.geometry;
    const slopes = this.calculateVertexSlopes(mesh, config.direction);
    
    // Create or get vertex color attribute
    let colors = geometry.attributes.color;
    if (!colors) {
      const colorArray = new Float32Array(slopes.length * 3);
      colors = new THREE.BufferAttribute(colorArray, 3);
      geometry.setAttribute('color', colors);
    }

    // Convert angle and tolerance to radians
    const angleRad = (config.angle * Math.PI) / 180;
    const toleranceRad = (config.tolerance * Math.PI) / 180;

    // Apply mask to vertex colors
    for (let i = 0; i < slopes.length; i++) {
      const slope = slopes[i];
      
      // Convert slope to angle
      const surfaceAngle = Math.acos(Math.max(-1, Math.min(1, slope)));
      
      // Calculate mask value with smoothstep
      let mask = 0;
      if (surfaceAngle <= angleRad + toleranceRad) {
        mask = 1.0 - this.smoothstep(
          angleRad - toleranceRad,
          angleRad + toleranceRad,
          surfaceAngle
        );
        mask *= config.strength;
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
   * Get slope statistics for mesh
   * Useful for determining appropriate angle thresholds
   */
  getSlopeStatistics(mesh: THREE.Mesh): {
    minSlope: number;
    maxSlope: number;
    avgSlope: number;
    upFacingPercent: number;
    downFacingPercent: number;
    horizontalPercent: number;
  } {
    const geometry = mesh.geometry;
    const normals = geometry.attributes.normal;
    
    if (!normals) {
      throw new Error('[SlopeMask] Geometry must have normal attribute');
    }

    const vertexCount = normals.count;
    const worldMatrix = mesh.matrixWorld;
    const normalMatrix = new THREE.Matrix3().getNormalMatrix(worldMatrix);

    let minSlope = 1;
    let maxSlope = -1;
    let sumSlope = 0;
    let upCount = 0;
    let downCount = 0;
    let horizontalCount = 0;

    const normal = new THREE.Vector3();
    for (let i = 0; i < vertexCount; i++) {
      normal.set(
        normals.getX(i),
        normals.getY(i),
        normals.getZ(i)
      );
      
      normal.applyMatrix3(normalMatrix).normalize();
      const slope = normal.y;

      minSlope = Math.min(minSlope, slope);
      maxSlope = Math.max(maxSlope, slope);
      sumSlope += slope;

      // Classify direction (using 30-degree threshold)
      const angle = Math.acos(Math.abs(slope));
      if (slope > 0.5) {
        upCount++;
      } else if (slope < -0.5) {
        downCount++;
      } else {
        horizontalCount++;
      }
    }

    return {
      minSlope,
      maxSlope,
      avgSlope: sumSlope / vertexCount,
      upFacingPercent: (upCount / vertexCount) * 100,
      downFacingPercent: (downCount / vertexCount) * 100,
      horizontalPercent: (horizontalCount / vertexCount) * 100,
    };
  }

  /**
   * Smoothstep function (CPU implementation)
   */
  private smoothstep(edge0: number, edge1: number, x: number): number {
    const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
  }
}
