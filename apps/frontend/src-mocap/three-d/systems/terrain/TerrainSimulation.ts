/**
 * TERRAIN SIMULATION SYSTEM
 * 
 * GPU-accelerated terrain simulation using WebGL render targets and compute shaders.
 * Extracted from Tecton feature for universal terrain simulation capabilities.
 * 
 * Features:
 * - Hydraulic erosion (water-based)
 * - Thermal erosion (heat diffusion)
 * - Magma flow (fluid advection)
 * - Tectonic effects (seismic shattering)
 * - Spatial warping
 * - Stratification (geological layering)
 * - Ping-pong render targets for iterative simulation
 * - History buffer for playback/recording
 * 
 * @module TerrainSimulation
 */

import * as THREE from 'three';
import {
  TerrainEffect
} from './TerrainTypes';

/**
 * Configuration for terrain simulation initialization
 */
export interface TerrainSimulationConfig {
  /** Heightmap resolution (width and height) */
  resolution: number;
  
  /** WebGL renderer instance */
  renderer: THREE.WebGLRenderer;
  
  /** Initial heightmap data (optional, will generate noise if not provided) */
  initialData?: Float32Array;
  
  /** Random seed for procedural generation */
  seed?: number;
}

/**
 * Simulation state for frame recording and playback
 */
export interface SimulationState {
  /** Current active effect being simulated */
  activeEffect: TerrainEffect;
  
  /** Simulation speed multiplier */
  simSpeed: number;
  
  /** Whether simulation is actively running */
  isSimulating: boolean;
  
  /** Whether recording frames to history */
  isRecording: boolean;
  
  /** Whether playing back recorded frames */
  isPlaying: boolean;
}

/**
 * GPU-accelerated terrain simulation system
 * 
 * Uses ping-pong render targets to perform iterative GPU compute operations
 * for realistic terrain erosion and geological effects.
 * 
 * @example
 * ```typescript
 * const simulation = new TerrainSimulation({
 *   resolution: 1024,
 *   renderer: myRenderer,
 *   seed: 12345
 * });
 * 
 * // Run hydraulic erosion
 * simulation.setActiveEffect(TerrainEffect.HYDRAULIC);
 * simulation.setSimulating(true);
 * simulation.step(); // Call in animation loop
 * 
 * // Get current heightmap
 * const heightmap = simulation.getCurrentHeightmap();
 * ```
 */
export class TerrainSimulation {
  // Core Three.js objects
  private renderer: THREE.WebGLRenderer;
  private simScene: THREE.Scene;
  private simCamera: THREE.OrthographicCamera;
  private simMaterial: THREE.ShaderMaterial;
  private simMesh: THREE.Mesh;
  
  // Render targets (ping-pong)
  private targetA: THREE.WebGLRenderTarget;
  private targetB: THREE.WebGLRenderTarget;
  
  // Configuration
  private resolution: number;
  private seed: number;
  
  // Simulation state
  private state: SimulationState;
  
  // History for recording/playback
  private historyBuffers: THREE.WebGLRenderTarget[] = [];
  private frameStats: number[] = [];
  private maxHistoryFrames: number = 500;
  
  // Optional fluid simulator for magma effects
  private fluidSimulator?: any; // FluidSimulator type
  
  /**
   * Create a new terrain simulation system
   */
  constructor(config: TerrainSimulationConfig) {
    this.renderer = config.renderer;
    this.resolution = config.resolution;
    this.seed = config.seed ?? Math.random() * 10000;
    
    // Initialize state
    this.state = {
      activeEffect: TerrainEffect.ZERO_POINT,
      simSpeed: 1.0,
      isSimulating: false,
      isRecording: false,
      isPlaying: false
    };
    
    // Create render targets
    const rtOptions = {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      type: THREE.FloatType,
      format: THREE.RGBAFormat
    };
    
    this.targetA = new THREE.WebGLRenderTarget(this.resolution, this.resolution, rtOptions);
    this.targetB = new THREE.WebGLRenderTarget(this.resolution, this.resolution, rtOptions);
    
    // Initialize simulation scene
    this.simScene = new THREE.Scene();
    this.simCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    
    // Create simulation material with physics shader
    this.simMaterial = this.createSimulationMaterial();
    
    // Create fullscreen quad for simulation
    const simGeometry = new THREE.PlaneGeometry(2, 2);
    this.simMesh = new THREE.Mesh(simGeometry, this.simMaterial);
    this.simScene.add(this.simMesh);
    
    // Initialize with data or noise
    if (config.initialData) {
      this.resetWithData(config.initialData);
    } else {
      this.reset();
    }
  }
  
  /**
   * Create the simulation shader material
   */
  private createSimulationMaterial(): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
      uniforms: {
        heightMap: { value: null },
        velocityMap: { value: null }, // For fluid-based effects
        mousePos: { value: new THREE.Vector2(-1, -1) },
        brushSize: { value: 0.15 },
        brushStrength: { value: 0.5 },
        time: { value: 0 },
        activeEffect: { value: TerrainEffect.ZERO_POINT },
        simSpeed: { value: 1.0 },
        doReset: { value: false },
        isSimulating: { value: false },
        blending: { value: false },
        blendFactor: { value: 0 },
        blendTargetA: { value: null },
        blendTargetB: { value: null },
        seed: { value: this.seed },
        res: { value: new THREE.Vector2(this.resolution, this.resolution) }
      },
      vertexShader: this.getSimulationVertexShader(),
      fragmentShader: this.getSimulationFragmentShader()
    });
  }
  
  /**
   * Get simulation vertex shader
   */
  private getSimulationVertexShader(): string {
    return `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position, 1.0);
      }
    `;
  }
  
  /**
   * Get simulation fragment shader with all physics effects
   */
  private getSimulationFragmentShader(): string {
    return `
      uniform sampler2D heightMap;
      uniform sampler2D velocityMap;
      
      uniform vec2 mousePos;
      uniform float brushSize;
      uniform float brushStrength;
      uniform float time;
      uniform int activeEffect;
      uniform float simSpeed;
      uniform bool doReset;
      uniform bool isSimulating;
      uniform bool blending;
      uniform float blendFactor;
      uniform sampler2D blendTargetA;
      uniform sampler2D blendTargetB;
      uniform vec2 res;
      uniform float seed;
      
      varying vec2 vUv;

      // Simplex Noise
      vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
      vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
      vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }
      
      float snoise(vec2 v) {
        const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
        vec2 i  = floor(v + dot(v, C.yy));
        vec2 x0 = v - i + dot(i, C.xx);
        vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
        vec4 x12 = x0.xyxy + C.xxzz;
        x12.xy -= i1;
        i = mod289(i);
        vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
        vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
        m = m*m;
        m = m*m;
        vec3 x = 2.0 * fract(p * C.www) - 1.0;
        vec3 h = abs(x) - 0.5;
        vec3 ox = floor(x + 0.5);
        vec3 a0 = x - ox;
        m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
        vec3 g;
        g.x  = a0.x  * x0.x  + h.x  * x0.y;
        g.yz = a0.yz * x12.xz + h.yz * x12.yw;
        return 130.0 * dot(m, g);
      }

      void main() {
        // Handle blending between two heightmaps
        if (blending) {
          float hA = texture2D(blendTargetA, vUv).r;
          float hB = texture2D(blendTargetB, vUv).r;
          float h = mix(hA, hB, blendFactor);
          gl_FragColor = vec4(h, 0.0, 0.0, 1.0);
          return;
        }

        // Handle reset with procedural noise
        if (doReset) {
          float n = snoise(vUv * 3.0 + seed) * 0.3 + 0.3;
          n += snoise(vUv * 10.0 + seed) * 0.05;
          gl_FragColor = vec4(n, 0.0, 0.0, 1.0);
          return;
        }

        vec4 data = texture2D(heightMap, vUv);
        float h = data.r;

        if (isSimulating) {
          vec2 uv = vUv;
          float texel = 1.0 / res.x;
          
          // MAGMA FLOW (Fluid Advection) - Effect 6
          if (activeEffect == 6) {
            vec2 vel = texture2D(velocityMap, uv).xy;
            vec2 coord = uv - (vel * 0.005 * simSpeed);
            h = texture2D(heightMap, coord).r;
            h += snoise(uv * 50.0 + time) * 0.001 * simSpeed;
          }

          // WARP (Spatial Distortion) - Effect 3
          else if (activeEffect == 3) {
            float n = snoise(uv * 8.0 + time * 0.1);
            uv += vec2(n, n) * 0.001 * brushStrength * simSpeed;
            h = texture2D(heightMap, uv).r;
          }
          
          // HYDRO-THERMAL VENTS (Deposition) - Effect 7
          else if (activeEffect == 7) {
            vec2 vel = texture2D(velocityMap, uv).xy;
            float speed = length(vel);
            if (speed > 0.1) {
              h += 0.005 * speed * simSpeed;
            }
            h -= 0.0005 * simSpeed;
          }

          // Sample neighbors for diffusion-based effects
          float hL = texture2D(heightMap, uv + vec2(-texel, 0.0)).r;
          float hR = texture2D(heightMap, uv + vec2(texel, 0.0)).r;
          float hU = texture2D(heightMap, uv + vec2(0.0, texel)).r;
          float hD = texture2D(heightMap, uv + vec2(0.0, -texel)).r;
          
          float delta = 0.0;

          // THERMAL EROSION (Heat Diffusion) - Effect 1
          if (activeEffect == 1) {
            float diff = (hL + hR + hU + hD) * 0.25 - h;
            if (abs(diff) > 0.001) {
              delta += diff * simSpeed * 0.5;
            }
          }

          // HYDRAULIC EROSION (Water-based) - Effect 2
          if (activeEffect == 2) {
            float minH = min(min(hL, hR), min(hU, hD));
            float diff = h - minH;
            
            if (diff > 0.0) {
              // Erode peaks
              delta -= diff * 0.2 * simSpeed;
            } else {
              // Deposit sediment
              delta += 0.001 * simSpeed;
            }
          }
          
          // TECTONIC (Seismic Shattering) - Effect 4
          if (activeEffect == 4) {
            float crack = abs(snoise(uv * 20.0));
            if (crack < 0.05) {
              delta -= 0.02 * simSpeed;
            }
            if (crack > 0.9) {
              delta += 0.01 * simSpeed;
            }
          }

          // STRATA (Geological Layering) - Effect 5
          if (activeEffect == 5) {
            float steps = 15.0;
            float target = floor(h * steps) / steps;
            delta += (target - h) * simSpeed * 0.1;
          }
          
          // Stability clamp
          delta = clamp(delta, -0.05, 0.05);
          h += delta;
        }

        gl_FragColor = vec4(clamp(h, 0.0, 1.0), 0.0, 0.0, 1.0);
      }
    `;
  }
  
  /**
   * Reset simulation with procedural noise
   */
  public reset(): void {
    this.simMaterial.uniforms.doReset.value = true;
    this.step();
    this.simMaterial.uniforms.doReset.value = false;
    this.clearHistory();
  }
  
  /**
   * Reset simulation with custom heightmap data
   */
  public resetWithData(data: Float32Array): void {
    const texture = new THREE.DataTexture(
      data as unknown as BufferSource,
      this.resolution,
      this.resolution,
      THREE.RGBAFormat,
      THREE.FloatType
    );
    texture.needsUpdate = true;
    
    this.simMaterial.uniforms.heightMap.value = texture;
    this.renderer.setRenderTarget(this.targetA);
    this.renderer.render(this.simScene, this.simCamera);
    this.renderer.setRenderTarget(null);
    
    this.clearHistory();
  }
  
  /**
   * Perform one simulation step (call in animation loop)
   */
  public step(): void {
    // Update time uniform
    this.simMaterial.uniforms.time.value += 0.01;
    
    // Update state uniforms
    this.simMaterial.uniforms.isSimulating.value = this.state.isSimulating;
    this.simMaterial.uniforms.activeEffect.value = this.state.activeEffect;
    this.simMaterial.uniforms.simSpeed.value = this.state.simSpeed;
    
    // Ping-pong render targets
    const source = this.targetA;
    const dest = this.targetB;
    
    this.simMaterial.uniforms.heightMap.value = source.texture;
    this.renderer.setRenderTarget(dest);
    this.renderer.render(this.simScene, this.simCamera);
    this.renderer.setRenderTarget(null);
    
    // Swap targets
    this.targetA = dest;
    this.targetB = source;
    
    // Record frame if recording
    if (this.state.isRecording) {
      this.recordFrame();
    }
  }
  
  /**
   * Record current frame to history buffer
   */
  private recordFrame(): void {
    const snapshot = new THREE.WebGLRenderTarget(
      this.resolution,
      this.resolution,
      {
        minFilter: THREE.NearestFilter,
        magFilter: THREE.NearestFilter,
        type: THREE.FloatType,
        format: THREE.RGBAFormat
      }
    );
    
    this.simMaterial.uniforms.heightMap.value = this.targetA.texture;
    this.renderer.setRenderTarget(snapshot);
    this.renderer.render(this.simScene, this.simCamera);
    this.renderer.setRenderTarget(null);
    
    this.historyBuffers.push(snapshot);
    
    // Store effect intensity for visualization
    const intensity = this.state.activeEffect > 0 
      ? this.state.activeEffect / 5.0 
      : 0.05;
    this.frameStats.push(intensity);
    
    // Limit history size
    if (this.historyBuffers.length > this.maxHistoryFrames) {
      const old = this.historyBuffers.shift();
      old?.dispose();
      this.frameStats.shift();
    }
  }
  
  /**
   * Clear history buffers
   */
  public clearHistory(): void {
    this.historyBuffers.forEach(buffer => buffer.dispose());
    this.historyBuffers = [];
    this.frameStats = [];
  }
  
  /**
   * Get current heightmap texture
   */
  public getCurrentHeightmap(): THREE.Texture {
    return this.targetA.texture;
  }
  
  /**
   * Get heightmap at specific history frame
   */
  public getHistoryFrame(index: number): THREE.Texture | null {
    if (index >= 0 && index < this.historyBuffers.length) {
      return this.historyBuffers[index].texture;
    }
    return null;
  }
  
  /**
   * Get number of recorded frames
   */
  public getHistoryLength(): number {
    return this.historyBuffers.length;
  }
  
  /**
   * Get frame statistics for visualization
   */
  public getFrameStats(): number[] {
    return [...this.frameStats];
  }
  
  /**
   * Set active terrain effect
   */
  public setActiveEffect(effect: TerrainEffect): void {
    this.state.activeEffect = effect;
  }
  
  /**
   * Get current active effect
   */
  public getActiveEffect(): TerrainEffect {
    return this.state.activeEffect;
  }
  
  /**
   * Set simulation speed multiplier
   */
  public setSimSpeed(speed: number): void {
    this.state.simSpeed = speed;
  }
  
  /**
   * Enable/disable simulation
   */
  public setSimulating(simulating: boolean): void {
    this.state.isSimulating = simulating;
  }
  
  /**
   * Check if simulation is active
   */
  public isSimulating(): boolean {
    return this.state.isSimulating;
  }
  
  /**
   * Start recording frames
   */
  public startRecording(): void {
    this.state.isRecording = true;
  }
  
  /**
   * Stop recording frames
   */
  public stopRecording(): void {
    this.state.isRecording = false;
  }
  
  /**
   * Check if recording
   */
  public isRecording(): boolean {
    return this.state.isRecording;
  }
  
  /**
   * Set maximum history frames
   */
  public setMaxHistoryFrames(max: number): void {
    this.maxHistoryFrames = max;
  }
  
  /**
   * Blend between two heightmaps
   */
  public blendHeightmaps(
    textureA: THREE.Texture,
    textureB: THREE.Texture,
    factor: number
  ): void {
    this.simMaterial.uniforms.blending.value = true;
    this.simMaterial.uniforms.blendTargetA.value = textureA;
    this.simMaterial.uniforms.blendTargetB.value = textureB;
    this.simMaterial.uniforms.blendFactor.value = factor;
    
    this.step();
    
    this.simMaterial.uniforms.blending.value = false;
  }
  
  /**
   * Set fluid simulator for magma effects
   */
  public setFluidSimulator(fluidSim: any): void {
    this.fluidSimulator = fluidSim;
    if (fluidSim && fluidSim.velocity) {
      this.simMaterial.uniforms.velocityMap.value = fluidSim.velocity.read.texture;
    }
  }
  
  /**
   * Update fluid simulation (call before step if using magma effects)
   */
  public updateFluidSimulation(deltaTime: number = 0.016, dissipation: number = 0.98): void {
    if (this.fluidSimulator) {
      // Add random splats for magma effect (effect 6 in shader is magma/fluid advection)
      if (this.state.activeEffect === 6) {
        this.fluidSimulator.splat(
          new THREE.Vector2(Math.random(), Math.random()),
          new THREE.Vector2((Math.random() - 0.5) * 5, (Math.random() - 0.5) * 5),
          new THREE.Vector3(1, 0.2, 0),
          0.05
        );
      }
      
      this.fluidSimulator.update(deltaTime, dissipation);
      this.simMaterial.uniforms.velocityMap.value = this.fluidSimulator.velocity.read.texture;
    }
  }
  
  /**
   * Read heightmap data back to CPU (expensive operation)
   */
  public async readHeightmapData(): Promise<Float32Array> {
    const buffer = new Float32Array(this.resolution * this.resolution * 4);
    
    this.renderer.setRenderTarget(this.targetA);
    this.renderer.readRenderTargetPixels(
      this.targetA,
      0,
      0,
      this.resolution,
      this.resolution,
      buffer as unknown as BufferSource
    );
    this.renderer.setRenderTarget(null);
    
    return buffer;
  }
  
  /**
   * Dispose of all GPU resources
   */
  public dispose(): void {
    this.targetA.dispose();
    this.targetB.dispose();
    this.simMaterial.dispose();
    this.simMesh.geometry.dispose();
    this.clearHistory();
    
    if (this.fluidSimulator) {
      this.fluidSimulator.dispose();
    }
  }
}
