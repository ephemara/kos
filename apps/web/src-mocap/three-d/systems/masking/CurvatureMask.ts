/**
 * CurvatureMask.ts
 * 
 * Curvature-based mask generation for edge and cavity detection.
 * Analyzes surface curvature to create procedural masks.
 */

import * as THREE from 'three';
import { CurvatureMaskConfig } from './MaskTypes';

/**
 * Curvature mask generator
 * Detects edges (convex areas) and cavities (concave areas)
 */
export class CurvatureMask {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;

  constructor(renderer: THREE.WebGLRenderer) {
    this.renderer = renderer;
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }

  /**
   * Generate curvature map from mesh
   * Returns a texture with R=convex (edges), G=concave (cavities)
   */
  generateCurvatureMap(mesh: THREE.Mesh, resolution: number = 1024): THREE.Texture {
    const geometry = mesh.geometry;
    
    if (!geometry.attributes.position || !geometry.attributes.normal) {
      throw new Error('[CurvatureMask] Mesh must have position and normal attributes');
    }

    // Create render target for curvature map
    const renderTarget = new THREE.WebGLRenderTarget(resolution, resolution, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.FloatType,
    });

    // Create curvature calculation material
    const material = new THREE.ShaderMaterial({
      uniforms: {
        resolution: { value: new THREE.Vector2(resolution, resolution) },
      },
      vertexShader: this.getCurvatureVertexShader(),
      fragmentShader: this.getCurvatureFragmentShader(),
    });

    // Render curvature to texture
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
   * Generate edge mask (convex areas)
   */
  generateEdgeMask(
    mesh: THREE.Mesh,
    config: Partial<CurvatureMaskConfig> = {},
    resolution: number = 1024
  ): THREE.Texture {
    const curvatureMap = this.generateCurvatureMap(mesh, resolution);
    
    const fullConfig: CurvatureMaskConfig = {
      type: 'curvature',
      mode: 'edge',
      threshold: config.threshold ?? 0.5,
      strength: config.strength ?? 1.0,
      invert: config.invert ?? false,
      feather: config.feather ?? 0.1,
    };

    return this.applyMaskConfig(curvatureMap, fullConfig, resolution);
  }

  /**
   * Generate cavity mask (concave areas)
   */
  generateCavityMask(
    mesh: THREE.Mesh,
    config: Partial<CurvatureMaskConfig> = {},
    resolution: number = 1024
  ): THREE.Texture {
    const curvatureMap = this.generateCurvatureMap(mesh, resolution);
    
    const fullConfig: CurvatureMaskConfig = {
      type: 'curvature',
      mode: 'cavity',
      threshold: config.threshold ?? 0.5,
      strength: config.strength ?? 1.0,
      invert: config.invert ?? false,
      feather: config.feather ?? 0.1,
    };

    return this.applyMaskConfig(curvatureMap, fullConfig, resolution);
  }

  /**
   * Apply mask configuration to curvature map
   */
  private applyMaskConfig(
    curvatureMap: THREE.Texture,
    config: CurvatureMaskConfig,
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
        curvatureMap: { value: curvatureMap },
        mode: { value: config.mode === 'edge' ? 0 : 1 },
        threshold: { value: config.threshold },
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
          
          // Apply threshold with feathering
          float mask = smoothstep(threshold - feather, threshold + feather, value);
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
   * Curvature calculation vertex shader
   */
  private getCurvatureVertexShader(): string {
    return `
      varying vec3 vNormal;
      varying vec3 vPosition;
      varying vec2 vUv;

      void main() {
        vNormal = normalize(normalMatrix * normal);
        vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;
  }

  /**
   * Curvature calculation fragment shader
   * Computes curvature using normal derivatives
   */
  private getCurvatureFragmentShader(): string {
    return `
      uniform vec2 resolution;
      varying vec3 vNormal;
      varying vec3 vPosition;
      varying vec2 vUv;

      void main() {
        // Calculate screen-space derivatives of normal
        vec3 dNdx = dFdx(vNormal);
        vec3 dNdy = dFdy(vNormal);
        
        // Curvature magnitude
        float curvature = length(dNdx) + length(dNdy);
        
        // Separate convex (edges) and concave (cavities)
        // Using dot product with view direction
        vec3 viewDir = normalize(-vPosition);
        float facing = dot(vNormal, viewDir);
        
        // Convex areas face towards camera more
        float convex = curvature * smoothstep(0.0, 1.0, facing);
        
        // Concave areas face away from camera
        float concave = curvature * smoothstep(0.0, 1.0, 1.0 - facing);
        
        // Normalize to 0-1 range
        convex = clamp(convex * 2.0, 0.0, 1.0);
        concave = clamp(concave * 2.0, 0.0, 1.0);
        
        // R = convex (edges), G = concave (cavities)
        gl_FragColor = vec4(convex, concave, 0.0, 1.0);
      }
    `;
  }

  /**
   * Calculate curvature from geometry (CPU fallback)
   * Useful for vertex-based masking
   */
  calculateVertexCurvature(geometry: THREE.BufferGeometry): Float32Array {
    const positions = geometry.attributes.position;
    const normals = geometry.attributes.normal;
    
    if (!positions || !normals) {
      throw new Error('[CurvatureMask] Geometry must have position and normal attributes');
    }

    const vertexCount = positions.count;
    const curvature = new Float32Array(vertexCount * 2); // [convex, concave] per vertex

    // Build vertex neighbor map
    const neighbors = this.buildNeighborMap(geometry);

    // Calculate curvature for each vertex
    for (let i = 0; i < vertexCount; i++) {
      const normal = new THREE.Vector3(
        normals.getX(i),
        normals.getY(i),
        normals.getZ(i)
      );

      const neighborIndices = neighbors.get(i) || [];
      if (neighborIndices.length === 0) continue;

      // Average normal difference with neighbors
      let normalDiff = 0;
      for (const neighborIdx of neighborIndices) {
        const neighborNormal = new THREE.Vector3(
          normals.getX(neighborIdx),
          normals.getY(neighborIdx),
          normals.getZ(neighborIdx)
        );
        normalDiff += normal.angleTo(neighborNormal);
      }
      normalDiff /= neighborIndices.length;

      // Classify as convex or concave based on normal direction
      const avgNeighborNormal = new THREE.Vector3();
      for (const neighborIdx of neighborIndices) {
        avgNeighborNormal.add(
          new THREE.Vector3(
            normals.getX(neighborIdx),
            normals.getY(neighborIdx),
            normals.getZ(neighborIdx)
          )
        );
      }
      avgNeighborNormal.divideScalar(neighborIndices.length);

      const isConvex = normal.dot(avgNeighborNormal) < 1.0;

      curvature[i * 2] = isConvex ? normalDiff : 0; // convex
      curvature[i * 2 + 1] = !isConvex ? normalDiff : 0; // concave
    }

    return curvature;
  }

  /**
   * Build vertex neighbor map from geometry
   */
  private buildNeighborMap(geometry: THREE.BufferGeometry): Map<number, number[]> {
    const neighbors = new Map<number, number[]>();
    const index = geometry.index;

    if (!index) {
      throw new Error('[CurvatureMask] Geometry must be indexed');
    }

    // Build neighbor map from triangles
    for (let i = 0; i < index.count; i += 3) {
      const a = index.getX(i);
      const b = index.getX(i + 1);
      const c = index.getX(i + 2);

      // Add neighbors
      this.addNeighbor(neighbors, a, b);
      this.addNeighbor(neighbors, a, c);
      this.addNeighbor(neighbors, b, a);
      this.addNeighbor(neighbors, b, c);
      this.addNeighbor(neighbors, c, a);
      this.addNeighbor(neighbors, c, b);
    }

    return neighbors;
  }

  /**
   * Add neighbor to map
   */
  private addNeighbor(map: Map<number, number[]>, vertex: number, neighbor: number): void {
    if (!map.has(vertex)) {
      map.set(vertex, []);
    }
    const neighbors = map.get(vertex)!;
    if (!neighbors.includes(neighbor)) {
      neighbors.push(neighbor);
    }
  }
}
