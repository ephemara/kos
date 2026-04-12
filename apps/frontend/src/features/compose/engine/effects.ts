/**
 * EffectProcessor - GPU-accelerated effect implementations
 * 
 * Provides GPU-accelerated implementations of compositing effects
 * including blur, sharpen, color grading, levels, curves, HSL adjustments,
 * glow, vignette, chromatic aberration, distortion, and transform effects.
 * 
 * All effects use GPU shaders for real-time preview performance.
 */

import * as THREE from 'three';

export interface ColorGradeSettings {
  exposure: number;
  contrast: number;
  saturation: number;
  temperature: number;
  tint: number;
}

export interface LevelsSettings {
  inputBlack: number;
  inputWhite: number;
  gamma: number;
  outputBlack: number;
  outputWhite: number;
}

export interface HSLSettings {
  hue: number;
  saturation: number;
  lightness: number;
}

export interface TransformSettings {
  translateX: number;
  translateY: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
}

export class EffectProcessor {
  private renderer: THREE.WebGLRenderer;
  private renderTarget: THREE.WebGLRenderTarget;
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;
  private quad: THREE.Mesh;

  constructor(renderer: THREE.WebGLRenderer) {
    this.renderer = renderer;

    // Create render target for effect processing
    this.renderTarget = new THREE.WebGLRenderTarget(1024, 1024, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.FloatType,
    });

    // Setup scene for fullscreen quad rendering
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    // Create fullscreen quad
    const geometry = new THREE.PlaneGeometry(2, 2);
    const material = new THREE.MeshBasicMaterial();
    this.quad = new THREE.Mesh(geometry, material);
    this.scene.add(this.quad);
  }

  /**
   * Apply Gaussian blur effect
   */
  async applyBlur(input: THREE.Texture, radius: number): Promise<THREE.Texture> {
    // Create blur shader material
    const blurMaterial = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: input },
        uRadius: { value: radius },
        uResolution: { value: new THREE.Vector2(input.image.width, input.image.height) },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float uRadius;
        uniform vec2 uResolution;
        varying vec2 vUv;

        void main() {
          vec2 texelSize = 1.0 / uResolution;
          vec4 color = vec4(0.0);
          float total = 0.0;

          for (float x = -4.0; x <= 4.0; x++) {
            for (float y = -4.0; y <= 4.0; y++) {
              vec2 offset = vec2(x, y) * texelSize * uRadius;
              float weight = exp(-(x*x + y*y) / (2.0 * uRadius * uRadius));
              color += texture2D(tDiffuse, vUv + offset) * weight;
              total += weight;
            }
          }

          gl_FragColor = color / total;
        }
      `,
    });

    return this.renderEffect(blurMaterial, input.image.width, input.image.height);
  }

  /**
   * Apply sharpen effect
   */
  async applySharpen(input: THREE.Texture, strength: number): Promise<THREE.Texture> {
    const sharpenMaterial = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: input },
        uStrength: { value: strength },
        uResolution: { value: new THREE.Vector2(input.image.width, input.image.height) },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float uStrength;
        uniform vec2 uResolution;
        varying vec2 vUv;

        void main() {
          vec2 texelSize = 1.0 / uResolution;
          vec4 center = texture2D(tDiffuse, vUv);
          vec4 blur = vec4(0.0);
          
          blur += texture2D(tDiffuse, vUv + vec2(-1, -1) * texelSize);
          blur += texture2D(tDiffuse, vUv + vec2( 0, -1) * texelSize);
          blur += texture2D(tDiffuse, vUv + vec2( 1, -1) * texelSize);
          blur += texture2D(tDiffuse, vUv + vec2(-1,  0) * texelSize);
          blur += texture2D(tDiffuse, vUv + vec2( 1,  0) * texelSize);
          blur += texture2D(tDiffuse, vUv + vec2(-1,  1) * texelSize);
          blur += texture2D(tDiffuse, vUv + vec2( 0,  1) * texelSize);
          blur += texture2D(tDiffuse, vUv + vec2( 1,  1) * texelSize);
          blur /= 8.0;

          gl_FragColor = center + (center - blur) * uStrength;
        }
      `,
    });

    return this.renderEffect(sharpenMaterial, input.image.width, input.image.height);
  }

  /**
   * Apply color grading effect
   */
  async applyColorGrade(input: THREE.Texture, settings: ColorGradeSettings): Promise<THREE.Texture> {
    const colorGradeMaterial = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: input },
        uExposure: { value: settings.exposure },
        uContrast: { value: settings.contrast },
        uSaturation: { value: settings.saturation },
        uTemperature: { value: settings.temperature },
        uTint: { value: settings.tint },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float uExposure;
        uniform float uContrast;
        uniform float uSaturation;
        uniform float uTemperature;
        uniform float uTint;
        varying vec2 vUv;

        vec3 rgb2hsv(vec3 c) {
          vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
          vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
          vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
          float d = q.x - min(q.w, q.y);
          float e = 1.0e-10;
          return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
        }

        vec3 hsv2rgb(vec3 c) {
          vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
          vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
          return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
        }

        void main() {
          vec4 color = texture2D(tDiffuse, vUv);

          // Exposure
          color.rgb *= pow(2.0, uExposure);

          // Contrast
          color.rgb = (color.rgb - 0.5) * uContrast + 0.5;

          // Saturation
          vec3 hsv = rgb2hsv(color.rgb);
          hsv.y *= uSaturation;
          color.rgb = hsv2rgb(hsv);

          // Temperature and tint
          color.r += uTemperature * 0.1;
          color.b -= uTemperature * 0.1;
          color.g += uTint * 0.1;

          gl_FragColor = color;
        }
      `,
    });

    return this.renderEffect(colorGradeMaterial, input.image.width, input.image.height);
  }

  /**
   * Apply levels adjustment
   */
  async applyLevels(input: THREE.Texture, settings: LevelsSettings): Promise<THREE.Texture> {
    const levelsMaterial = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: input },
        uInputBlack: { value: settings.inputBlack },
        uInputWhite: { value: settings.inputWhite },
        uGamma: { value: settings.gamma },
        uOutputBlack: { value: settings.outputBlack },
        uOutputWhite: { value: settings.outputWhite },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float uInputBlack;
        uniform float uInputWhite;
        uniform float uGamma;
        uniform float uOutputBlack;
        uniform float uOutputWhite;
        varying vec2 vUv;

        void main() {
          vec4 color = texture2D(tDiffuse, vUv);
          
          // Input levels
          color.rgb = (color.rgb - uInputBlack) / (uInputWhite - uInputBlack);
          color.rgb = clamp(color.rgb, 0.0, 1.0);
          
          // Gamma
          color.rgb = pow(color.rgb, vec3(1.0 / uGamma));
          
          // Output levels
          color.rgb = color.rgb * (uOutputWhite - uOutputBlack) + uOutputBlack;
          
          gl_FragColor = color;
        }
      `,
    });

    return this.renderEffect(levelsMaterial, input.image.width, input.image.height);
  }

  /**
   * Apply HSL adjustment
   */
  async applyHSL(input: THREE.Texture, settings: HSLSettings): Promise<THREE.Texture> {
    const hslMaterial = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: input },
        uHue: { value: settings.hue },
        uSaturation: { value: settings.saturation },
        uLightness: { value: settings.lightness },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float uHue;
        uniform float uSaturation;
        uniform float uLightness;
        varying vec2 vUv;

        vec3 rgb2hsl(vec3 c) {
          float maxC = max(max(c.r, c.g), c.b);
          float minC = min(min(c.r, c.g), c.b);
          float l = (maxC + minC) / 2.0;
          float h = 0.0;
          float s = 0.0;
          
          if (maxC != minC) {
            float d = maxC - minC;
            s = l > 0.5 ? d / (2.0 - maxC - minC) : d / (maxC + minC);
            
            if (maxC == c.r) {
              h = (c.g - c.b) / d + (c.g < c.b ? 6.0 : 0.0);
            } else if (maxC == c.g) {
              h = (c.b - c.r) / d + 2.0;
            } else {
              h = (c.r - c.g) / d + 4.0;
            }
            h /= 6.0;
          }
          
          return vec3(h, s, l);
        }

        vec3 hsl2rgb(vec3 c) {
          float h = c.x;
          float s = c.y;
          float l = c.z;
          
          float q = l < 0.5 ? l * (1.0 + s) : l + s - l * s;
          float p = 2.0 * l - q;
          
          float r = h + 1.0 / 3.0;
          float g = h;
          float b = h - 1.0 / 3.0;
          
          if (r < 0.0) r += 1.0;
          if (r > 1.0) r -= 1.0;
          if (g < 0.0) g += 1.0;
          if (g > 1.0) g -= 1.0;
          if (b < 0.0) b += 1.0;
          if (b > 1.0) b -= 1.0;
          
          if (r < 1.0 / 6.0) r = p + (q - p) * 6.0 * r;
          else if (r < 0.5) r = q;
          else if (r < 2.0 / 3.0) r = p + (q - p) * (2.0 / 3.0 - r) * 6.0;
          else r = p;
          
          if (g < 1.0 / 6.0) g = p + (q - p) * 6.0 * g;
          else if (g < 0.5) g = q;
          else if (g < 2.0 / 3.0) g = p + (q - p) * (2.0 / 3.0 - g) * 6.0;
          else g = p;
          
          if (b < 1.0 / 6.0) b = p + (q - p) * 6.0 * b;
          else if (b < 0.5) b = q;
          else if (b < 2.0 / 3.0) b = p + (q - p) * (2.0 / 3.0 - b) * 6.0;
          else b = p;
          
          return vec3(r, g, b);
        }

        void main() {
          vec4 color = texture2D(tDiffuse, vUv);
          vec3 hsl = rgb2hsl(color.rgb);
          
          hsl.x = fract(hsl.x + uHue);
          hsl.y = clamp(hsl.y + uSaturation, 0.0, 1.0);
          hsl.z = clamp(hsl.z + uLightness, 0.0, 1.0);
          
          color.rgb = hsl2rgb(hsl);
          gl_FragColor = color;
        }
      `,
    });

    return this.renderEffect(hslMaterial, input.image.width, input.image.height);
  }

  /**
   * Apply curves adjustment
   * Curve is an array of control points [x, y] where x and y are in range [0, 1]
   */
  async applyCurves(input: THREE.Texture, curve: number[][]): Promise<THREE.Texture> {
    // For simplicity, we'll use a basic curve implementation
    // In production, you'd want to use a proper spline interpolation
    const curvesMaterial = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: input },
        // For now, use a simple linear curve if no curve is provided
        uCurveStrength: { value: curve.length > 0 ? 1.0 : 0.0 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float uCurveStrength;
        varying vec2 vUv;

        // Simple S-curve for demonstration
        float applyCurve(float x) {
          // Smooth S-curve using smoothstep
          return smoothstep(0.0, 1.0, x);
        }

        void main() {
          vec4 color = texture2D(tDiffuse, vUv);
          
          if (uCurveStrength > 0.0) {
            color.r = applyCurve(color.r);
            color.g = applyCurve(color.g);
            color.b = applyCurve(color.b);
          }
          
          gl_FragColor = color;
        }
      `,
    });

    return this.renderEffect(curvesMaterial, input.image.width, input.image.height);
  }

  /**
   * Apply glow effect
   */
  async applyGlow(input: THREE.Texture, threshold: number, intensity: number): Promise<THREE.Texture> {
    const glowMaterial = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: input },
        uThreshold: { value: threshold },
        uIntensity: { value: intensity },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float uThreshold;
        uniform float uIntensity;
        varying vec2 vUv;

        void main() {
          vec4 color = texture2D(tDiffuse, vUv);
          float brightness = dot(color.rgb, vec3(0.299, 0.587, 0.114));
          
          if (brightness > uThreshold) {
            color.rgb += (color.rgb - uThreshold) * uIntensity;
          }

          gl_FragColor = color;
        }
      `,
    });

    return this.renderEffect(glowMaterial, input.image.width, input.image.height);
  }

  /**
   * Apply vignette effect
   */
  async applyVignette(input: THREE.Texture, strength: number, radius: number): Promise<THREE.Texture> {
    const vignetteMaterial = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: input },
        uStrength: { value: strength },
        uRadius: { value: radius },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float uStrength;
        uniform float uRadius;
        varying vec2 vUv;

        void main() {
          vec4 color = texture2D(tDiffuse, vUv);
          vec2 center = vec2(0.5, 0.5);
          float dist = distance(vUv, center);
          float vignette = smoothstep(uRadius, uRadius - 0.3, dist);
          color.rgb = mix(color.rgb * (1.0 - uStrength), color.rgb, vignette);
          gl_FragColor = color;
        }
      `,
    });

    return this.renderEffect(vignetteMaterial, input.image.width, input.image.height);
  }

  /**
   * Apply chromatic aberration effect
   */
  async applyChromaticAberration(input: THREE.Texture, strength: number): Promise<THREE.Texture> {
    const chromaticMaterial = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: input },
        uStrength: { value: strength },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float uStrength;
        varying vec2 vUv;

        void main() {
          vec2 center = vec2(0.5, 0.5);
          vec2 offset = (vUv - center) * uStrength;
          
          float r = texture2D(tDiffuse, vUv + offset).r;
          float g = texture2D(tDiffuse, vUv).g;
          float b = texture2D(tDiffuse, vUv - offset).b;
          float a = texture2D(tDiffuse, vUv).a;
          
          gl_FragColor = vec4(r, g, b, a);
        }
      `,
    });

    return this.renderEffect(chromaticMaterial, input.image.width, input.image.height);
  }

  /**
   * Apply distortion effect
   */
  async applyDistortion(input: THREE.Texture, strength: number, scale: number): Promise<THREE.Texture> {
    const distortionMaterial = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: input },
        uStrength: { value: strength },
        uScale: { value: scale },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float uStrength;
        uniform float uScale;
        varying vec2 vUv;

        // Simple noise function for distortion
        float noise(vec2 st) {
          return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
        }

        void main() {
          vec2 uv = vUv;
          vec2 center = vec2(0.5, 0.5);
          vec2 offset = uv - center;
          float dist = length(offset);
          
          // Apply barrel/pincushion distortion
          float distortion = 1.0 + uStrength * dist * dist;
          uv = center + offset * distortion;
          
          // Add noise-based distortion
          float noiseX = noise(uv * uScale) * 2.0 - 1.0;
          float noiseY = noise(uv * uScale + vec2(100.0, 100.0)) * 2.0 - 1.0;
          uv += vec2(noiseX, noiseY) * uStrength * 0.01;
          
          if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
            gl_FragColor = vec4(0.0);
          } else {
            gl_FragColor = texture2D(tDiffuse, uv);
          }
        }
      `,
    });

    return this.renderEffect(distortionMaterial, input.image.width, input.image.height);
  }

  /**
   * Apply transform effect (translate, rotate, scale)
   */
  async applyTransform(input: THREE.Texture, settings: TransformSettings): Promise<THREE.Texture> {
    const transformMaterial = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: input },
        uTranslate: { value: new THREE.Vector2(settings.translateX, settings.translateY) },
        uRotation: { value: settings.rotation },
        uScale: { value: new THREE.Vector2(settings.scaleX, settings.scaleY) },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform vec2 uTranslate;
        uniform float uRotation;
        uniform vec2 uScale;
        varying vec2 vUv;

        void main() {
          vec2 uv = vUv - 0.5;
          
          // Scale
          uv /= uScale;
          
          // Rotate
          float c = cos(uRotation);
          float s = sin(uRotation);
          mat2 rot = mat2(c, -s, s, c);
          uv = rot * uv;
          
          // Translate
          uv -= uTranslate;
          
          uv += 0.5;
          
          if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
            gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
          } else {
            gl_FragColor = texture2D(tDiffuse, uv);
          }
        }
      `,
    });

    return this.renderEffect(transformMaterial, input.image.width, input.image.height);
  }

  /**
   * Render an effect using a shader material
   */
  private renderEffect(material: THREE.ShaderMaterial, width: number, height: number): THREE.Texture {
    // Update render target size
    this.renderTarget.setSize(width, height);

    // Apply material to quad
    this.quad.material = material;

    // Render to target
    this.renderer.setRenderTarget(this.renderTarget);
    this.renderer.render(this.scene, this.camera);
    this.renderer.setRenderTarget(null);

    // Clean up material
    material.dispose();

    return this.renderTarget.texture;
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.renderTarget.dispose();
    this.quad.geometry.dispose();
    if (this.quad.material instanceof THREE.Material) {
      this.quad.material.dispose();
    }
  }
}
