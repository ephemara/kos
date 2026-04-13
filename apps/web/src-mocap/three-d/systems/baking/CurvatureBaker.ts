/**
 * CurvatureBaker.ts
 * 
 * Real-time curvature map baking for meshes.
 * Detects convex (edges) and concave (cavities) areas.
 */

import * as THREE from 'three';
import {
  CurvatureMapBakingParams,
  BakingResult,
  BakingOptions,
} from './BakingTypes';

/**
 * Curvature map baker for detecting edges and cavities
 */
export class CurvatureBaker {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;

  constructor(renderer: THREE.WebGLRenderer) {
    this.renderer = renderer;
    
    // Setup orthographic scene for baking
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }

  /**
   * Bake a curvature map from a mesh
   */
  async bake(
    params: CurvatureMapBakingParams,
    options?: BakingOptions
  ): Promise<BakingResult> {
    const startTime = performance.now();
    
    options?.onProgress?.({
      step: 'Analyzing geometry',
      progress: 0,
    });

    const { mesh, resolution, sensitivity, separateChannels, blurRadius = 0 } = params;

    // Step 1: Bake normal map
    options?.onProgress?.({
      step: 'Baking normals',
      progress: 25,
    });

    const normalMap = this.bakeNormalMap(mesh, resolution);

    // Step 2: Compute curvature from normal derivatives
    options?.onProgress?.({
      step: 'Computing curvature',
      progress: 50,
    });

    const curvatureMap = this.computeCurvature(normalMap, resolution, sensitivity, separateChannels);

    // Step 3: Optional blur for smoothing
    if (blurRadius > 0) {
      options?.onProgress?.({
        step: 'Smoothing',
        progress: 75,
      });
      
      this.applyBlur(curvatureMap, blurRadius);
    }

    // Cleanup
    normalMap.dispose();

    options?.onProgress?.({
      step: 'Finalizing',
      progress: 100,
    });

    const timeMs = performance.now() - startTime;

    return {
      texture: curvatureMap,
      mapType: 'curvature',
      resolution,
      timeMs,
      metadata: {
        quality: 'production',
        gpuAccelerated: true,
      },
    };
  }

  /**
   * Bake normal map for curvature computation
   */
  private bakeNormalMap(mesh: THREE.Mesh, resolution: number): THREE.Texture {
    const renderTarget = new THREE.WebGLRenderTarget(resolution, resolution, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.FloatType,
    });

    const material = new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vNormal;
        varying vec2 vUv;

        void main() {
          vNormal = normalize(normalMatrix * normal);
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        varying vec2 vUv;

        void main() {
          vec3 normal = normalize(vNormal);
          vec3 encoded = normal * 0.5 + 0.5;
          gl_FragColor = vec4(encoded, 1.0);
        }
      `,
    });

    const bakingMesh = new THREE.Mesh(mesh.geometry, material);
    bakingMesh.position.copy(mesh.position);
    bakingMesh.rotation.copy(mesh.rotation);
    bakingMesh.scale.copy(mesh.scale);
    
    this.scene.add(bakingMesh);

    const oldTarget = this.renderer.getRenderTarget();
    this.renderer.setRenderTarget(renderTarget);
    this.renderer.render(this.scene, this.camera);
    this.renderer.setRenderTarget(oldTarget);

    this.scene.remove(bakingMesh);
    material.dispose();

    return renderTarget.texture;
  }

  /**
   * Compute curvature from normal map using Sobel operator
   */
  private computeCurvature(
    normalMap: THREE.Texture,
    resolution: number,
    sensitivity: number,
    separateChannels: boolean
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
        resolution: { value: new THREE.Vector2(resolution, resolution) },
        sensitivity: { value: sensitivity },
        separateChannels: { value: separateChannels },
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
        uniform vec2 resolution;
        uniform float sensitivity;
        uniform bool separateChannels;
        varying vec2 vUv;

        // Sobel operator for edge detection
        vec3 sobel(sampler2D tex, vec2 uv, vec2 texelSize) {
          vec3 n00 = texture2D(tex, uv + vec2(-texelSize.x, -texelSize.y)).xyz;
          vec3 n10 = texture2D(tex, uv + vec2(0.0, -texelSize.y)).xyz;
          vec3 n20 = texture2D(tex, uv + vec2(texelSize.x, -texelSize.y)).xyz;
          
          vec3 n01 = texture2D(tex, uv + vec2(-texelSize.x, 0.0)).xyz;
          vec3 n21 = texture2D(tex, uv + vec2(texelSize.x, 0.0)).xyz;
          
          vec3 n02 = texture2D(tex, uv + vec2(-texelSize.x, texelSize.y)).xyz;
          vec3 n12 = texture2D(tex, uv + vec2(0.0, texelSize.y)).xyz;
          vec3 n22 = texture2D(tex, uv + vec2(texelSize.x, texelSize.y)).xyz;
          
          // Sobel X
          vec3 sobelX = n00 + 2.0 * n01 + n02 - n20 - 2.0 * n21 - n22;
          
          // Sobel Y
          vec3 sobelY = n00 + 2.0 * n10 + n20 - n02 - 2.0 * n12 - n22;
          
          return sqrt(sobelX * sobelX + sobelY * sobelY);
        }

        void main() {
          vec2 texelSize = 1.0 / resolution;
          
          // Compute gradient magnitude
          vec3 gradient = sobel(normalMap, vUv, texelSize);
          float curvature = length(gradient) * sensitivity;
          
          if (separateChannels) {
            // Separate convex (R) and concave (G) curvature
            vec3 center = texture2D(normalMap, vUv).xyz * 2.0 - 1.0;
            
            // Sample neighbors
            vec3 right = texture2D(normalMap, vUv + vec2(texelSize.x, 0.0)).xyz * 2.0 - 1.0;
            vec3 left = texture2D(normalMap, vUv - vec2(texelSize.x, 0.0)).xyz * 2.0 - 1.0;
            vec3 up = texture2D(normalMap, vUv + vec2(0.0, texelSize.y)).xyz * 2.0 - 1.0;
            vec3 down = texture2D(normalMap, vUv - vec2(0.0, texelSize.y)).xyz * 2.0 - 1.0;
            
            // Compute divergence (positive = convex, negative = concave)
            float divergence = dot(right - left, vec3(1.0, 0.0, 0.0)) +
                              dot(up - down, vec3(0.0, 1.0, 0.0));
            
            float convex = max(divergence, 0.0) * curvature;
            float concave = max(-divergence, 0.0) * curvature;
            
            gl_FragColor = vec4(convex, concave, 0.0, 1.0);
          } else {
            // Combined curvature in all channels
            gl_FragColor = vec4(curvature, curvature, curvature, 1.0);
          }
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
   * Apply Gaussian blur for smoothing
   */
  private applyBlur(texture: THREE.Texture, radius: number): void {
    // TODO: Implement Gaussian blur
    // For now, this is a placeholder
    console.log(`[CurvatureBaker] Blur with radius ${radius} not yet implemented`);
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.scene.clear();
  }
}
