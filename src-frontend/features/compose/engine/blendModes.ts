/**
 * BlendModeShader - GPU-accelerated blend mode implementations
 * 
 * Provides shader-based implementations of various blend modes
 * for real-time compositing operations.
 */

import * as THREE from 'three';

export type BlendMode = 
  | 'normal'
  | 'multiply'
  | 'screen'
  | 'overlay'
  | 'add'
  | 'subtract'
  | 'divide'
  | 'difference'
  | 'darken'
  | 'lighten'
  | 'colorDodge'
  | 'colorBurn'
  | 'hardLight'
  | 'softLight'
  | 'exclusion';

export class BlendModeShader {
  private materials: Map<BlendMode, THREE.ShaderMaterial>;

  constructor() {
    this.materials = new Map();
  }

  /**
   * Get or create a blend mode shader material
   */
  getMaterial(mode: BlendMode): THREE.ShaderMaterial {
    if (this.materials.has(mode)) {
      return this.materials.get(mode)!;
    }

    const material = this.createBlendMaterial(mode);
    this.materials.set(mode, material);
    return material;
  }

  /**
   * Create a shader material for a specific blend mode
   */
  private createBlendMaterial(mode: BlendMode): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
      uniforms: {
        tBase: { value: null },
        tBlend: { value: null },
        uOpacity: { value: 1.0 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: this.getBlendFragmentShader(mode),
      transparent: true,
    });
  }

  /**
   * Get the fragment shader code for a blend mode
   */
  private getBlendFragmentShader(mode: BlendMode): string {
    const blendFunction = this.getBlendFunction(mode);

    return `
      uniform sampler2D tBase;
      uniform sampler2D tBlend;
      uniform float uOpacity;
      varying vec2 vUv;

      ${blendFunction}

      void main() {
        vec4 base = texture2D(tBase, vUv);
        vec4 blend = texture2D(tBlend, vUv);
        
        vec3 blended = blendMode(base.rgb, blend.rgb);
        vec3 result = mix(base.rgb, blended, blend.a * uOpacity);
        
        gl_FragColor = vec4(result, base.a);
      }
    `;
  }

  /**
   * Get the blend function GLSL code for a specific mode
   */
  private getBlendFunction(mode: BlendMode): string {
    switch (mode) {
      case 'normal':
        return `
          vec3 blendMode(vec3 base, vec3 blend) {
            return blend;
          }
        `;

      case 'multiply':
        return `
          vec3 blendMode(vec3 base, vec3 blend) {
            return base * blend;
          }
        `;

      case 'screen':
        return `
          vec3 blendMode(vec3 base, vec3 blend) {
            return 1.0 - (1.0 - base) * (1.0 - blend);
          }
        `;

      case 'overlay':
        return `
          vec3 blendMode(vec3 base, vec3 blend) {
            vec3 result;
            result.r = base.r < 0.5 ? 2.0 * base.r * blend.r : 1.0 - 2.0 * (1.0 - base.r) * (1.0 - blend.r);
            result.g = base.g < 0.5 ? 2.0 * base.g * blend.g : 1.0 - 2.0 * (1.0 - base.g) * (1.0 - blend.g);
            result.b = base.b < 0.5 ? 2.0 * base.b * blend.b : 1.0 - 2.0 * (1.0 - base.b) * (1.0 - blend.b);
            return result;
          }
        `;

      case 'add':
        return `
          vec3 blendMode(vec3 base, vec3 blend) {
            return min(base + blend, 1.0);
          }
        `;

      case 'subtract':
        return `
          vec3 blendMode(vec3 base, vec3 blend) {
            return max(base - blend, 0.0);
          }
        `;

      case 'divide':
        return `
          vec3 blendMode(vec3 base, vec3 blend) {
            return base / (blend + 0.001);
          }
        `;

      case 'difference':
        return `
          vec3 blendMode(vec3 base, vec3 blend) {
            return abs(base - blend);
          }
        `;

      case 'darken':
        return `
          vec3 blendMode(vec3 base, vec3 blend) {
            return min(base, blend);
          }
        `;

      case 'lighten':
        return `
          vec3 blendMode(vec3 base, vec3 blend) {
            return max(base, blend);
          }
        `;

      case 'colorDodge':
        return `
          vec3 blendMode(vec3 base, vec3 blend) {
            return base / (1.0 - blend + 0.001);
          }
        `;

      case 'colorBurn':
        return `
          vec3 blendMode(vec3 base, vec3 blend) {
            return 1.0 - (1.0 - base) / (blend + 0.001);
          }
        `;

      case 'hardLight':
        return `
          vec3 blendMode(vec3 base, vec3 blend) {
            vec3 result;
            result.r = blend.r < 0.5 ? 2.0 * base.r * blend.r : 1.0 - 2.0 * (1.0 - base.r) * (1.0 - blend.r);
            result.g = blend.g < 0.5 ? 2.0 * base.g * blend.g : 1.0 - 2.0 * (1.0 - base.g) * (1.0 - blend.g);
            result.b = blend.b < 0.5 ? 2.0 * base.b * blend.b : 1.0 - 2.0 * (1.0 - base.b) * (1.0 - blend.b);
            return result;
          }
        `;

      case 'softLight':
        return `
          vec3 blendMode(vec3 base, vec3 blend) {
            vec3 result;
            result.r = blend.r < 0.5 ? 2.0 * base.r * blend.r + base.r * base.r * (1.0 - 2.0 * blend.r) : 
                       sqrt(base.r) * (2.0 * blend.r - 1.0) + 2.0 * base.r * (1.0 - blend.r);
            result.g = blend.g < 0.5 ? 2.0 * base.g * blend.g + base.g * base.g * (1.0 - 2.0 * blend.g) : 
                       sqrt(base.g) * (2.0 * blend.g - 1.0) + 2.0 * base.g * (1.0 - blend.g);
            result.b = blend.b < 0.5 ? 2.0 * base.b * blend.b + base.b * base.b * (1.0 - 2.0 * blend.b) : 
                       sqrt(base.b) * (2.0 * blend.b - 1.0) + 2.0 * base.b * (1.0 - blend.b);
            return result;
          }
        `;

      case 'exclusion':
        return `
          vec3 blendMode(vec3 base, vec3 blend) {
            return base + blend - 2.0 * base * blend;
          }
        `;

      default:
        return `
          vec3 blendMode(vec3 base, vec3 blend) {
            return blend;
          }
        `;
    }
  }

  /**
   * Apply a blend mode to two textures
   */
  blend(
    renderer: THREE.WebGLRenderer,
    base: THREE.Texture,
    blend: THREE.Texture,
    mode: BlendMode,
    opacity: number = 1.0
  ): THREE.Texture {
    const material = this.getMaterial(mode);
    material.uniforms.tBase.value = base;
    material.uniforms.tBlend.value = blend;
    material.uniforms.uOpacity.value = opacity;

    // Create render target
    const width = Math.max(base.image?.width || 512, blend.image?.width || 512);
    const height = Math.max(base.image?.height || 512, blend.image?.height || 512);
    
    const renderTarget = new THREE.WebGLRenderTarget(width, height, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.FloatType,
    });

    // Render
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const geometry = new THREE.PlaneGeometry(2, 2);
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    const currentRenderTarget = renderer.getRenderTarget();
    renderer.setRenderTarget(renderTarget);
    renderer.render(scene, camera);
    renderer.setRenderTarget(currentRenderTarget);

    // Clean up
    geometry.dispose();

    return renderTarget.texture;
  }

  /**
   * Dispose of all materials
   */
  dispose(): void {
    this.materials.forEach(material => material.dispose());
    this.materials.clear();
  }
}
