/**
 * Weight Visualization - Gradient visualization for weight painting
 * 
 * Renders vertex weights as color gradients on the mesh surface.
 * Supports multiple visualization modes and customizable gradients.
 */

import * as THREE from 'three';
import { VertexGroup } from './weightEngine';

export type VisualizationMode = 'gradient' | 'solid' | 'wireframe' | 'none';

export interface GradientStop {
  position: number; // [0, 1]
  color: THREE.Color;
}

export class WeightVisualization {
  private mesh: THREE.Mesh | null = null;
  private mode: VisualizationMode = 'gradient';
  private gradient: GradientStop[] = [];
  private originalMaterial: THREE.Material | THREE.Material[] | null = null;
  private visualizationMaterial: THREE.ShaderMaterial | null = null;

  constructor() {
    this.initializeDefaultGradient();
    this.createVisualizationMaterial();
  }

  setMesh(mesh: THREE.Mesh): void {
    this.mesh = mesh;
    this.originalMaterial = mesh.material;
  }

  setMode(mode: VisualizationMode): void {
    this.mode = mode;
    this.updateVisualization();
  }

  getMode(): VisualizationMode {
    return this.mode;
  }

  setActiveGroup(groupId: string, group: VertexGroup): void {
    this.updateWeights(group);
  }

  /**
   * Update visualization with current weights
   */
  updateWeights(group: VertexGroup): void {
    if (!this.mesh || this.mode === 'none') return;

    const geometry = this.mesh.geometry;
    const vertexCount = geometry.attributes.position.count;

    // Create or update color attribute
    let colors = geometry.attributes.color;
    if (!colors) {
      colors = new THREE.BufferAttribute(new Float32Array(vertexCount * 3), 3);
      geometry.setAttribute('color', colors);
    }

    // Update colors based on weights
    const color = new THREE.Color();
    for (let i = 0; i < vertexCount; i++) {
      const weight = group.weights.get(i) || 0;
      this.getGradientColor(weight, color);
      colors.setXYZ(i, color.r, color.g, color.b);
    }

    colors.needsUpdate = true;

    // Apply visualization material
    this.applyVisualizationMaterial();
  }

  /**
   * Set custom gradient
   */
  setGradient(stops: GradientStop[]): void {
    this.gradient = stops.sort((a, b) => a.position - b.position);
    this.updateVisualization();
  }

  /**
   * Get gradient stops
   */
  getGradient(): GradientStop[] {
    return [...this.gradient];
  }

  /**
   * Initialize default blue-to-red gradient
   */
  private initializeDefaultGradient(): void {
    this.gradient = [
      { position: 0.0, color: new THREE.Color(0x0000ff) }, // Blue (no weight)
      { position: 0.25, color: new THREE.Color(0x00ffff) }, // Cyan
      { position: 0.5, color: new THREE.Color(0x00ff00) }, // Green
      { position: 0.75, color: new THREE.Color(0xffff00) }, // Yellow
      { position: 1.0, color: new THREE.Color(0xff0000) }, // Red (full weight)
    ];
  }

  /**
   * Get color from gradient at position
   */
  private getGradientColor(position: number, target: THREE.Color): void {
    position = Math.max(0, Math.min(1, position));

    // Find surrounding gradient stops
    let lowerStop = this.gradient[0];
    let upperStop = this.gradient[this.gradient.length - 1];

    for (let i = 0; i < this.gradient.length - 1; i++) {
      if (position >= this.gradient[i].position && position <= this.gradient[i + 1].position) {
        lowerStop = this.gradient[i];
        upperStop = this.gradient[i + 1];
        break;
      }
    }

    // Interpolate between stops
    const range = upperStop.position - lowerStop.position;
    const t = range > 0 ? (position - lowerStop.position) / range : 0;

    target.copy(lowerStop.color).lerp(upperStop.color, t);
  }

  /**
   * Create shader material for visualization
   * GPU-accelerated gradient visualization with PBR-style lighting
   */
  private createVisualizationMaterial(): void {
    this.visualizationMaterial = new THREE.ShaderMaterial({
      vertexShader: `
        // Vertex attributes
        attribute vec3 position;
        attribute vec3 normal;
        attribute vec3 color;
        
        // Uniforms
        uniform mat4 modelViewMatrix;
        uniform mat4 projectionMatrix;
        uniform mat3 normalMatrix;
        uniform mat4 modelMatrix;
        
        // Varyings
        varying vec3 vColor;
        varying vec3 vNormal;
        varying vec3 vWorldNormal;
        varying vec3 vViewPosition;
        varying vec3 vWorldPosition;
        varying float vWeight;

        void main() {
          // Pass weight as grayscale intensity
          vWeight = (color.r + color.g + color.b) / 3.0;
          vColor = color;
          
          // Transform normal to view space for lighting
          vNormal = normalize(normalMatrix * normal);
          
          // World space normal for advanced lighting
          vWorldNormal = normalize(mat3(modelMatrix) * normal);
          
          // Calculate view space position
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          vViewPosition = -mvPosition.xyz;
          
          // World space position
          vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
          
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        precision highp float;
        
        // Uniforms
        uniform float opacity;
        uniform bool useShading;
        uniform bool useAdvancedLighting;
        uniform vec3 lightDirection;
        uniform vec3 lightColor;
        uniform float ambientIntensity;
        uniform float diffuseIntensity;
        uniform float specularIntensity;
        uniform float shininess;
        uniform vec3 cameraPosition;
        
        // Varyings
        varying vec3 vColor;
        varying vec3 vNormal;
        varying vec3 vWorldNormal;
        varying vec3 vViewPosition;
        varying vec3 vWorldPosition;
        varying float vWeight;

        // Fresnel effect for edge highlighting
        float fresnel(vec3 viewDir, vec3 normal, float power) {
          return pow(1.0 - max(0.0, dot(viewDir, normal)), power);
        }

        // Blinn-Phong specular
        float blinnPhongSpecular(vec3 lightDir, vec3 viewDir, vec3 normal, float shininess) {
          vec3 halfDir = normalize(lightDir + viewDir);
          return pow(max(0.0, dot(normal, halfDir)), shininess);
        }

        void main() {
          vec3 finalColor = vColor;
          
          if (useShading) {
            vec3 normal = normalize(vNormal);
            vec3 viewDir = normalize(vViewPosition);
            
            if (useAdvancedLighting) {
              // Advanced PBR-style lighting
              vec3 worldNormal = normalize(vWorldNormal);
              vec3 worldViewDir = normalize(cameraPosition - vWorldPosition);
              vec3 lightDir = normalize(lightDirection);
              
              // Ambient
              vec3 ambient = finalColor * ambientIntensity;
              
              // Diffuse (Lambert)
              float diffuse = max(dot(worldNormal, lightDir), 0.0);
              vec3 diffuseColor = finalColor * lightColor * diffuse * diffuseIntensity;
              
              // Specular (Blinn-Phong)
              float spec = blinnPhongSpecular(lightDir, worldViewDir, worldNormal, shininess);
              vec3 specularColor = lightColor * spec * specularIntensity;
              
              // Fresnel rim lighting for better depth perception
              float rim = fresnel(worldViewDir, worldNormal, 3.0);
              vec3 rimColor = vec3(0.2) * rim * 0.3;
              
              // Combine lighting components
              finalColor = ambient + diffuseColor + specularColor + rimColor;
              
              // Subtle ambient occlusion approximation based on weight
              // Lower weights (blue) get slightly darker in crevices
              float ao = mix(0.8, 1.0, vWeight);
              finalColor *= ao;
              
            } else {
              // Simple directional lighting
              vec3 lightDir = normalize(vec3(0.5, 1.0, 0.5));
              float diffuse = max(dot(normal, lightDir), 0.0);
              
              // Add subtle back lighting
              vec3 backLightDir = normalize(vec3(-0.5, -0.3, -0.5));
              float backLight = max(dot(normal, backLightDir), 0.0) * 0.3;
              
              float ambient = ambientIntensity;
              float lighting = ambient + diffuse * diffuseIntensity + backLight;
              
              finalColor *= lighting;
            }
            
            // Ensure colors don't get too dark
            finalColor = max(finalColor, vec3(0.05));
          }
          
          // Gamma correction for better color perception
          finalColor = pow(finalColor, vec3(1.0 / 2.2));
          
          gl_FragColor = vec4(finalColor, opacity);
        }
      `,
      uniforms: {
        opacity: { value: 1.0 },
        useShading: { value: true },
        useAdvancedLighting: { value: true },
        lightDirection: { value: new THREE.Vector3(0.5, 1.0, 0.5).normalize() },
        lightColor: { value: new THREE.Vector3(1.0, 1.0, 1.0) },
        ambientIntensity: { value: 0.3 },
        diffuseIntensity: { value: 0.7 },
        specularIntensity: { value: 0.2 },
        shininess: { value: 32.0 },
        cameraPosition: { value: new THREE.Vector3() },
      },
      vertexColors: true,
      transparent: false,
      side: THREE.DoubleSide,
      depthWrite: true,
      depthTest: true,
    });
  }

  /**
   * Apply visualization material to mesh
   * Supports gradient, solid, wireframe, and none modes
   */
  private applyVisualizationMaterial(): void {
    if (!this.mesh || !this.visualizationMaterial) return;

    switch (this.mode) {
      case 'gradient':
        // Full gradient with advanced lighting
        this.mesh.material = this.visualizationMaterial;
        this.visualizationMaterial.uniforms.useShading.value = true;
        this.visualizationMaterial.uniforms.useAdvancedLighting.value = true;
        this.visualizationMaterial.uniforms.opacity.value = 1.0;
        this.visualizationMaterial.wireframe = false;
        this.visualizationMaterial.transparent = false;
        break;

      case 'solid':
        // Flat shaded gradient (no lighting)
        this.mesh.material = this.visualizationMaterial;
        this.visualizationMaterial.uniforms.useShading.value = false;
        this.visualizationMaterial.uniforms.useAdvancedLighting.value = false;
        this.visualizationMaterial.uniforms.opacity.value = 1.0;
        this.visualizationMaterial.wireframe = false;
        this.visualizationMaterial.transparent = false;
        break;

      case 'wireframe':
        // Wireframe with gradient colors
        this.mesh.material = this.visualizationMaterial;
        this.visualizationMaterial.uniforms.useShading.value = false;
        this.visualizationMaterial.uniforms.useAdvancedLighting.value = false;
        this.visualizationMaterial.uniforms.opacity.value = 1.0;
        this.visualizationMaterial.wireframe = true;
        this.visualizationMaterial.transparent = false;
        break;

      case 'none':
        // Restore original material
        if (this.originalMaterial) {
          this.mesh.material = this.originalMaterial;
        }
        break;
    }
  }

  /**
   * Update visualization (refresh current state)
   */
  private updateVisualization(): void {
    if (!this.mesh) return;
    
    const geometry = this.mesh.geometry;
    const colors = geometry.attributes.color;
    
    if (colors) {
      colors.needsUpdate = true;
    }
    
    this.applyVisualizationMaterial();
  }

  /**
   * Update camera position for proper lighting calculations
   * Should be called each frame for accurate specular highlights
   */
  updateCameraPosition(camera: THREE.Camera): void {
    if (!this.visualizationMaterial) return;
    
    const cameraPos = new THREE.Vector3();
    camera.getWorldPosition(cameraPos);
    this.visualizationMaterial.uniforms.cameraPosition.value.copy(cameraPos);
  }

  /**
   * Set lighting parameters for advanced visualization
   */
  setLightingParams(params: {
    lightDirection?: THREE.Vector3;
    lightColor?: THREE.Color;
    ambientIntensity?: number;
    diffuseIntensity?: number;
    specularIntensity?: number;
    shininess?: number;
  }): void {
    if (!this.visualizationMaterial) return;

    if (params.lightDirection) {
      this.visualizationMaterial.uniforms.lightDirection.value.copy(params.lightDirection).normalize();
    }
    if (params.lightColor) {
      this.visualizationMaterial.uniforms.lightColor.value.set(
        params.lightColor.r,
        params.lightColor.g,
        params.lightColor.b
      );
    }
    if (params.ambientIntensity !== undefined) {
      this.visualizationMaterial.uniforms.ambientIntensity.value = params.ambientIntensity;
    }
    if (params.diffuseIntensity !== undefined) {
      this.visualizationMaterial.uniforms.diffuseIntensity.value = params.diffuseIntensity;
    }
    if (params.specularIntensity !== undefined) {
      this.visualizationMaterial.uniforms.specularIntensity.value = params.specularIntensity;
    }
    if (params.shininess !== undefined) {
      this.visualizationMaterial.uniforms.shininess.value = params.shininess;
    }
  }

  /**
   * Set opacity for transparent visualization
   */
  setOpacity(opacity: number): void {
    if (!this.visualizationMaterial) return;
    
    opacity = Math.max(0, Math.min(1, opacity));
    this.visualizationMaterial.uniforms.opacity.value = opacity;
    this.visualizationMaterial.transparent = opacity < 1.0;
  }

  /**
   * Get current lighting parameters
   */
  getLightingParams(): {
    lightDirection: THREE.Vector3;
    lightColor: THREE.Vector3;
    ambientIntensity: number;
    diffuseIntensity: number;
    specularIntensity: number;
    shininess: number;
  } {
    if (!this.visualizationMaterial) {
      return {
        lightDirection: new THREE.Vector3(0.5, 1.0, 0.5).normalize(),
        lightColor: new THREE.Vector3(1, 1, 1),
        ambientIntensity: 0.3,
        diffuseIntensity: 0.7,
        specularIntensity: 0.2,
        shininess: 32.0,
      };
    }

    return {
      lightDirection: this.visualizationMaterial.uniforms.lightDirection.value.clone(),
      lightColor: this.visualizationMaterial.uniforms.lightColor.value.clone(),
      ambientIntensity: this.visualizationMaterial.uniforms.ambientIntensity.value,
      diffuseIntensity: this.visualizationMaterial.uniforms.diffuseIntensity.value,
      specularIntensity: this.visualizationMaterial.uniforms.specularIntensity.value,
      shininess: this.visualizationMaterial.uniforms.shininess.value,
    };
  }

  /**
   * Clear visualization
   */
  clear(): void {
    if (!this.mesh) return;

    if (this.originalMaterial) {
      this.mesh.material = this.originalMaterial;
    }

    const geometry = this.mesh.geometry;
    if (geometry.attributes.color) {
      geometry.deleteAttribute('color');
    }
  }

  /**
   * Create preset gradients
   */
  static createPresetGradient(preset: 'blueRed' | 'grayscale' | 'rainbow' | 'heatmap'): GradientStop[] {
    switch (preset) {
      case 'blueRed':
        return [
          { position: 0.0, color: new THREE.Color(0x0000ff) },
          { position: 0.25, color: new THREE.Color(0x00ffff) },
          { position: 0.5, color: new THREE.Color(0x00ff00) },
          { position: 0.75, color: new THREE.Color(0xffff00) },
          { position: 1.0, color: new THREE.Color(0xff0000) },
        ];

      case 'grayscale':
        return [
          { position: 0.0, color: new THREE.Color(0x000000) },
          { position: 1.0, color: new THREE.Color(0xffffff) },
        ];

      case 'rainbow':
        return [
          { position: 0.0, color: new THREE.Color(0xff0000) },
          { position: 0.2, color: new THREE.Color(0xff7f00) },
          { position: 0.4, color: new THREE.Color(0xffff00) },
          { position: 0.6, color: new THREE.Color(0x00ff00) },
          { position: 0.8, color: new THREE.Color(0x0000ff) },
          { position: 1.0, color: new THREE.Color(0x8b00ff) },
        ];

      case 'heatmap':
        return [
          { position: 0.0, color: new THREE.Color(0x000000) },
          { position: 0.25, color: new THREE.Color(0x0000ff) },
          { position: 0.5, color: new THREE.Color(0xff0000) },
          { position: 0.75, color: new THREE.Color(0xffff00) },
          { position: 1.0, color: new THREE.Color(0xffffff) },
        ];

      default:
        return WeightVisualization.createPresetGradient('blueRed');
    }
  }

  dispose(): void {
    if (this.visualizationMaterial) {
      this.visualizationMaterial.dispose();
    }
    this.mesh = null;
    this.originalMaterial = null;
  }
}
