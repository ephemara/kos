/**
 * NodeGraph - Node-based compositing graph system
 * 
 * Manages the node graph for compositing operations including
 * node creation, connection validation, and dependency-ordered evaluation.
 */

import * as THREE from 'three';

export type NodeId = string;
export type ConnectionId = string;
export type SocketType = 'image' | 'color' | 'number' | 'vector';

export interface NodeSocket {
  name: string;
  type: SocketType;
  value?: any;
}

export interface CompositeNode {
  id: NodeId;
  type: string;
  name: string;
  position: { x: number; y: number };
  inputs: NodeSocket[];
  outputs: NodeSocket[];
  parameters: Record<string, any>;
}

export interface NodeConnection {
  id: ConnectionId;
  fromNode: NodeId;
  fromSocket: string;
  toNode: NodeId;
  toSocket: string;
}

export type NodeType = 
  | 'input'           // Image input
  | 'output'          // Final output
  | 'mix'             // Blend two images
  | 'blur'            // Gaussian blur
  | 'sharpen'         // Sharpen
  | 'colorGrade'      // Color grading
  | 'levels'          // Levels adjustment
  | 'curves'          // Curves adjustment
  | 'hsl'             // Hue/Saturation/Lightness
  | 'glow'            // Glow effect
  | 'vignette'        // Vignette
  | 'chromatic'       // Chromatic aberration
  | 'distort'         // Distortion
  | 'transform'       // Transform (scale, rotate, translate)
  | 'mask'            // Masking
  | 'gradient'        // Gradient generator
  | 'noise'           // Noise generator
  | 'text'            // Text overlay
  | 'math';           // Math operations

/**
 * Node type definitions with their inputs, outputs, and default parameters
 */
const NODE_DEFINITIONS: Record<NodeType, {
  inputs: NodeSocket[];
  outputs: NodeSocket[];
  defaultParameters: Record<string, any>;
}> = {
  input: {
    inputs: [],
    outputs: [{ name: 'image', type: 'image' }],
    defaultParameters: { imagePath: '' },
  },
  output: {
    inputs: [{ name: 'image', type: 'image' }],
    outputs: [],
    defaultParameters: {},
  },
  mix: {
    inputs: [
      { name: 'image1', type: 'image' },
      { name: 'image2', type: 'image' },
      { name: 'factor', type: 'number', value: 0.5 },
    ],
    outputs: [{ name: 'image', type: 'image' }],
    defaultParameters: { blendMode: 'normal', factor: 0.5 },
  },
  blur: {
    inputs: [{ name: 'image', type: 'image' }],
    outputs: [{ name: 'image', type: 'image' }],
    defaultParameters: { radius: 5.0 },
  },
  sharpen: {
    inputs: [{ name: 'image', type: 'image' }],
    outputs: [{ name: 'image', type: 'image' }],
    defaultParameters: { strength: 1.0 },
  },
  colorGrade: {
    inputs: [{ name: 'image', type: 'image' }],
    outputs: [{ name: 'image', type: 'image' }],
    defaultParameters: {
      exposure: 0.0,
      contrast: 1.0,
      saturation: 1.0,
      temperature: 0.0,
      tint: 0.0,
    },
  },
  levels: {
    inputs: [{ name: 'image', type: 'image' }],
    outputs: [{ name: 'image', type: 'image' }],
    defaultParameters: {
      inputBlack: 0.0,
      inputWhite: 1.0,
      gamma: 1.0,
      outputBlack: 0.0,
      outputWhite: 1.0,
    },
  },
  curves: {
    inputs: [{ name: 'image', type: 'image' }],
    outputs: [{ name: 'image', type: 'image' }],
    defaultParameters: { curve: [] },
  },
  hsl: {
    inputs: [{ name: 'image', type: 'image' }],
    outputs: [{ name: 'image', type: 'image' }],
    defaultParameters: { hue: 0.0, saturation: 0.0, lightness: 0.0 },
  },
  glow: {
    inputs: [{ name: 'image', type: 'image' }],
    outputs: [{ name: 'image', type: 'image' }],
    defaultParameters: { threshold: 0.8, intensity: 1.0, radius: 10.0 },
  },
  vignette: {
    inputs: [{ name: 'image', type: 'image' }],
    outputs: [{ name: 'image', type: 'image' }],
    defaultParameters: { strength: 0.5, radius: 0.8 },
  },
  chromatic: {
    inputs: [{ name: 'image', type: 'image' }],
    outputs: [{ name: 'image', type: 'image' }],
    defaultParameters: { strength: 0.01 },
  },
  distort: {
    inputs: [{ name: 'image', type: 'image' }],
    outputs: [{ name: 'image', type: 'image' }],
    defaultParameters: { strength: 0.1, scale: 1.0 },
  },
  transform: {
    inputs: [{ name: 'image', type: 'image' }],
    outputs: [{ name: 'image', type: 'image' }],
    defaultParameters: {
      translateX: 0.0,
      translateY: 0.0,
      rotation: 0.0,
      scaleX: 1.0,
      scaleY: 1.0,
    },
  },
  mask: {
    inputs: [
      { name: 'image', type: 'image' },
      { name: 'mask', type: 'image' },
    ],
    outputs: [{ name: 'image', type: 'image' }],
    defaultParameters: { invert: false },
  },
  gradient: {
    inputs: [],
    outputs: [{ name: 'image', type: 'image' }],
    defaultParameters: {
      type: 'linear',
      color1: '#000000',
      color2: '#ffffff',
      angle: 0.0,
    },
  },
  noise: {
    inputs: [],
    outputs: [{ name: 'image', type: 'image' }],
    defaultParameters: { type: 'perlin', scale: 1.0, seed: 0 },
  },
  text: {
    inputs: [{ name: 'background', type: 'image' }],
    outputs: [{ name: 'image', type: 'image' }],
    defaultParameters: {
      text: 'Text',
      fontSize: 48,
      color: '#ffffff',
      x: 0.5,
      y: 0.5,
    },
  },
  math: {
    inputs: [
      { name: 'value1', type: 'number', value: 0 },
      { name: 'value2', type: 'number', value: 0 },
    ],
    outputs: [{ name: 'result', type: 'number' }],
    defaultParameters: { operation: 'add' },
  },
};

export class NodeGraph {
  private nodes: Map<NodeId, CompositeNode>;
  private connections: Map<ConnectionId, NodeConnection>;
  private evaluationCache: Map<NodeId, THREE.Texture | null>;
  private renderer: THREE.WebGLRenderer | null;

  constructor(renderer?: THREE.WebGLRenderer) {
    this.nodes = new Map();
    this.connections = new Map();
    this.evaluationCache = new Map();
    this.renderer = renderer || null;
  }

  /**
   * Set the WebGL renderer for shader execution
   */
  setRenderer(renderer: THREE.WebGLRenderer): void {
    this.renderer = renderer;
  }

  /**
   * Add a node to the graph
   */
  addNode(type: string): NodeId {
    const definition = NODE_DEFINITIONS[type as NodeType];
    if (!definition) {
      throw new Error(`Unknown node type: ${type}`);
    }

    const id = `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const node: CompositeNode = {
      id,
      type,
      name: type.charAt(0).toUpperCase() + type.slice(1),
      position: { x: 0, y: 0 },
      inputs: JSON.parse(JSON.stringify(definition.inputs)),
      outputs: JSON.parse(JSON.stringify(definition.outputs)),
      parameters: { ...definition.defaultParameters },
    };

    this.nodes.set(id, node);
    console.log(`[NodeGraph] Added node: ${type} (${id})`);
    return id;
  }

  /**
   * Remove a node from the graph
   */
  removeNode(id: NodeId): void {
    // Remove all connections involving this node
    const connectionsToRemove: ConnectionId[] = [];
    this.connections.forEach((conn, connId) => {
      if (conn.fromNode === id || conn.toNode === id) {
        connectionsToRemove.push(connId);
      }
    });
    connectionsToRemove.forEach(connId => this.connections.delete(connId));

    // Remove the node
    this.nodes.delete(id);
    this.evaluationCache.delete(id);
    console.log(`[NodeGraph] Removed node: ${id}`);
  }

  /**
   * Connect two nodes
   */
  connectNodes(fromId: NodeId, toId: NodeId, fromSocket: string, toSocket: string): void {
    const fromNode = this.nodes.get(fromId);
    const toNode = this.nodes.get(toId);

    if (!fromNode || !toNode) {
      throw new Error('Invalid node IDs');
    }

    // Validate socket types
    const fromSocketDef = fromNode.outputs.find(s => s.name === fromSocket);
    const toSocketDef = toNode.inputs.find(s => s.name === toSocket);

    if (!fromSocketDef || !toSocketDef) {
      throw new Error('Invalid socket names');
    }

    if (fromSocketDef.type !== toSocketDef.type) {
      throw new Error(`Socket type mismatch: ${fromSocketDef.type} -> ${toSocketDef.type}`);
    }

    // Check for circular dependencies
    if (this.wouldCreateCycle(fromId, toId)) {
      throw new Error('Connection would create a circular dependency');
    }

    const connectionId = `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const connection: NodeConnection = {
      id: connectionId,
      fromNode: fromId,
      fromSocket,
      toNode: toId,
      toSocket,
    };

    this.connections.set(connectionId, connection);
    console.log(`[NodeGraph] Connected: ${fromId}.${fromSocket} -> ${toId}.${toSocket}`);
  }

  /**
   * Disconnect nodes
   */
  disconnectNodes(connectionId: ConnectionId): void {
    this.connections.delete(connectionId);
    console.log(`[NodeGraph] Disconnected: ${connectionId}`);
  }

  /**
   * Check if connecting two nodes would create a cycle
   */
  private wouldCreateCycle(fromId: NodeId, toId: NodeId): boolean {
    const visited = new Set<NodeId>();
    const stack = [toId];

    while (stack.length > 0) {
      const current = stack.pop()!;
      if (current === fromId) return true;
      if (visited.has(current)) continue;
      visited.add(current);

      // Find all nodes that current connects to
      this.connections.forEach(conn => {
        if (conn.fromNode === current) {
          stack.push(conn.toNode);
        }
      });
    }

    return false;
  }

  /**
   * Get all nodes
   */
  getNodes(): CompositeNode[] {
    return Array.from(this.nodes.values());
  }

  /**
   * Get all connections
   */
  getConnections(): NodeConnection[] {
    return Array.from(this.connections.values());
  }

  /**
   * Get a specific node
   */
  getNode(id: NodeId): CompositeNode | undefined {
    return this.nodes.get(id);
  }

  /**
   * Update node parameters
   */
  updateNodeParameters(id: NodeId, parameters: Record<string, any>): void {
    const node = this.nodes.get(id);
    if (node) {
      node.parameters = { ...node.parameters, ...parameters };
      this.evaluationCache.delete(id); // Invalidate cache
    }
  }

  /**
   * Evaluate the graph in dependency order
   */
  async evaluate(): Promise<THREE.Texture | null> {
    // Find the output node
    const outputNode = Array.from(this.nodes.values()).find(n => n.type === 'output');
    if (!outputNode) {
      throw new Error('No output node found');
    }

    // Clear evaluation cache
    this.evaluationCache.clear();

    // Evaluate the output node (which will recursively evaluate dependencies)
    return this.evaluateNode(outputNode.id);
  }

  /**
   * Evaluate a specific node
   */
  async evaluateNode(id: NodeId): Promise<THREE.Texture | null> {
    // Check cache
    if (this.evaluationCache.has(id)) {
      return this.evaluationCache.get(id) || null;
    }

    const node = this.nodes.get(id);
    if (!node) {
      throw new Error(`Node not found: ${id}`);
    }

    // Evaluate input nodes first
    const inputValues: Record<string, any> = {};
    for (const input of node.inputs) {
      const connection = Array.from(this.connections.values()).find(
        c => c.toNode === id && c.toSocket === input.name
      );

      if (connection) {
        inputValues[input.name] = await this.evaluateNode(connection.fromNode);
      } else {
        inputValues[input.name] = input.value;
      }
    }

    // Execute node operation
    const result = await this.executeNode(node, inputValues);

    // Cache result
    this.evaluationCache.set(id, result);

    return result;
  }

  /**
   * Execute a node's operation
   */
  private async executeNode(
    node: CompositeNode,
    inputs: Record<string, any>
  ): Promise<THREE.Texture | null> {
    console.log(`[NodeGraph] Executing node: ${node.type} (${node.id})`);

    switch (node.type) {
      case 'input':
        return this.executeInputNode(node);
      
      case 'output':
        return inputs.image || null;
      
      case 'mix':
        return this.executeMixNode(node, inputs);
      
      case 'blur':
        return this.executeBlurNode(node, inputs);
      
      case 'sharpen':
        return this.executeSharpenNode(node, inputs);
      
      case 'colorGrade':
        return this.executeColorGradeNode(node, inputs);
      
      case 'levels':
        return this.executeLevelsNode(node, inputs);
      
      case 'hsl':
        return this.executeHSLNode(node, inputs);
      
      case 'glow':
        return this.executeGlowNode(node, inputs);
      
      case 'vignette':
        return this.executeVignetteNode(node, inputs);
      
      case 'chromatic':
        return this.executeChromaticNode(node, inputs);
      
      case 'transform':
        return this.executeTransformNode(node, inputs);
      
      case 'mask':
        return this.executeMaskNode(node, inputs);
      
      case 'gradient':
        return this.executeGradientNode(node);
      
      case 'noise':
        return this.executeNoiseNode(node);
      
      default:
        console.warn(`[NodeGraph] Unimplemented node type: ${node.type}`);
        return inputs.image || null;
    }
  }

  // Node execution implementations
  private executeInputNode(node: CompositeNode): THREE.Texture | null {
    // Input nodes should have their texture set externally
    // For now, return a placeholder texture
    return null;
  }

  private executeMixNode(node: CompositeNode, inputs: Record<string, any>): THREE.Texture | null {
    const image1 = inputs.image1;
    const image2 = inputs.image2;
    const factor = inputs.factor ?? node.parameters.factor ?? 0.5;

    if (!image1 || !image2) return image1 || image2 || null;

    // Create a simple mix shader
    const width = Math.max(image1.image?.width || 512, image2.image?.width || 512);
    const height = Math.max(image1.image?.height || 512, image2.image?.height || 512);

    return this.createShaderTexture(width, height, {
      tImage1: { value: image1 },
      tImage2: { value: image2 },
      uFactor: { value: factor },
    }, `
      uniform sampler2D tImage1;
      uniform sampler2D tImage2;
      uniform float uFactor;
      varying vec2 vUv;

      void main() {
        vec4 color1 = texture2D(tImage1, vUv);
        vec4 color2 = texture2D(tImage2, vUv);
        gl_FragColor = mix(color1, color2, uFactor);
      }
    `);
  }

  private executeBlurNode(node: CompositeNode, inputs: Record<string, any>): THREE.Texture | null {
    const image = inputs.image;
    if (!image) return null;

    const radius = node.parameters.radius ?? 5.0;
    const width = image.image?.width || 512;
    const height = image.image?.height || 512;

    return this.createShaderTexture(width, height, {
      tDiffuse: { value: image },
      uRadius: { value: radius },
      uResolution: { value: new THREE.Vector2(width, height) },
    }, `
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
    `);
  }

  private executeSharpenNode(node: CompositeNode, inputs: Record<string, any>): THREE.Texture | null {
    const image = inputs.image;
    if (!image) return null;

    const strength = node.parameters.strength ?? 1.0;
    const width = image.image?.width || 512;
    const height = image.image?.height || 512;

    return this.createShaderTexture(width, height, {
      tDiffuse: { value: image },
      uStrength: { value: strength },
      uResolution: { value: new THREE.Vector2(width, height) },
    }, `
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
    `);
  }

  private executeColorGradeNode(node: CompositeNode, inputs: Record<string, any>): THREE.Texture | null {
    const image = inputs.image;
    if (!image) return null;

    const width = image.image?.width || 512;
    const height = image.image?.height || 512;

    return this.createShaderTexture(width, height, {
      tDiffuse: { value: image },
      uExposure: { value: node.parameters.exposure ?? 0.0 },
      uContrast: { value: node.parameters.contrast ?? 1.0 },
      uSaturation: { value: node.parameters.saturation ?? 1.0 },
      uTemperature: { value: node.parameters.temperature ?? 0.0 },
      uTint: { value: node.parameters.tint ?? 0.0 },
    }, `
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
    `);
  }

  private executeLevelsNode(node: CompositeNode, inputs: Record<string, any>): THREE.Texture | null {
    const image = inputs.image;
    if (!image) return null;

    const width = image.image?.width || 512;
    const height = image.image?.height || 512;

    return this.createShaderTexture(width, height, {
      tDiffuse: { value: image },
      uInputBlack: { value: node.parameters.inputBlack ?? 0.0 },
      uInputWhite: { value: node.parameters.inputWhite ?? 1.0 },
      uGamma: { value: node.parameters.gamma ?? 1.0 },
      uOutputBlack: { value: node.parameters.outputBlack ?? 0.0 },
      uOutputWhite: { value: node.parameters.outputWhite ?? 1.0 },
    }, `
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
    `);
  }

  private executeHSLNode(node: CompositeNode, inputs: Record<string, any>): THREE.Texture | null {
    const image = inputs.image;
    if (!image) return null;

    const width = image.image?.width || 512;
    const height = image.image?.height || 512;

    return this.createShaderTexture(width, height, {
      tDiffuse: { value: image },
      uHue: { value: node.parameters.hue ?? 0.0 },
      uSaturation: { value: node.parameters.saturation ?? 0.0 },
      uLightness: { value: node.parameters.lightness ?? 0.0 },
    }, `
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
    `);
  }

  private executeGlowNode(node: CompositeNode, inputs: Record<string, any>): THREE.Texture | null {
    const image = inputs.image;
    if (!image) return null;

    const width = image.image?.width || 512;
    const height = image.image?.height || 512;

    return this.createShaderTexture(width, height, {
      tDiffuse: { value: image },
      uThreshold: { value: node.parameters.threshold ?? 0.8 },
      uIntensity: { value: node.parameters.intensity ?? 1.0 },
    }, `
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
    `);
  }

  private executeVignetteNode(node: CompositeNode, inputs: Record<string, any>): THREE.Texture | null {
    const image = inputs.image;
    if (!image) return null;

    const width = image.image?.width || 512;
    const height = image.image?.height || 512;

    return this.createShaderTexture(width, height, {
      tDiffuse: { value: image },
      uStrength: { value: node.parameters.strength ?? 0.5 },
      uRadius: { value: node.parameters.radius ?? 0.8 },
    }, `
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
    `);
  }

  private executeChromaticNode(node: CompositeNode, inputs: Record<string, any>): THREE.Texture | null {
    const image = inputs.image;
    if (!image) return null;

    const width = image.image?.width || 512;
    const height = image.image?.height || 512;

    return this.createShaderTexture(width, height, {
      tDiffuse: { value: image },
      uStrength: { value: node.parameters.strength ?? 0.01 },
    }, `
      uniform sampler2D tDiffuse;
      uniform float uStrength;
      varying vec2 vUv;

      void main() {
        vec2 center = vec2(0.5, 0.5);
        vec2 offset = (vUv - center) * uStrength;
        
        float r = texture2D(tDiffuse, vUv + offset).r;
        float g = texture2D(tDiffuse, vUv).g;
        float b = texture2D(tDiffuse, vUv - offset).b;
        
        gl_FragColor = vec4(r, g, b, 1.0);
      }
    `);
  }

  private executeTransformNode(node: CompositeNode, inputs: Record<string, any>): THREE.Texture | null {
    const image = inputs.image;
    if (!image) return null;

    const width = image.image?.width || 512;
    const height = image.image?.height || 512;

    return this.createShaderTexture(width, height, {
      tDiffuse: { value: image },
      uTranslate: { value: new THREE.Vector2(
        node.parameters.translateX ?? 0.0,
        node.parameters.translateY ?? 0.0
      )},
      uRotation: { value: node.parameters.rotation ?? 0.0 },
      uScale: { value: new THREE.Vector2(
        node.parameters.scaleX ?? 1.0,
        node.parameters.scaleY ?? 1.0
      )},
    }, `
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
          gl_FragColor = vec4(0.0);
        } else {
          gl_FragColor = texture2D(tDiffuse, uv);
        }
      }
    `);
  }

  private executeMaskNode(node: CompositeNode, inputs: Record<string, any>): THREE.Texture | null {
    const image = inputs.image;
    const mask = inputs.mask;
    if (!image || !mask) return image || null;

    const width = image.image?.width || 512;
    const height = image.image?.height || 512;

    return this.createShaderTexture(width, height, {
      tDiffuse: { value: image },
      tMask: { value: mask },
      uInvert: { value: node.parameters.invert ? 1.0 : 0.0 },
    }, `
      uniform sampler2D tDiffuse;
      uniform sampler2D tMask;
      uniform float uInvert;
      varying vec2 vUv;

      void main() {
        vec4 color = texture2D(tDiffuse, vUv);
        float maskValue = texture2D(tMask, vUv).r;
        
        if (uInvert > 0.5) {
          maskValue = 1.0 - maskValue;
        }
        
        color.a *= maskValue;
        gl_FragColor = color;
      }
    `);
  }

  private executeGradientNode(node: CompositeNode): THREE.Texture | null {
    const width = 512;
    const height = 512;

    const color1 = new THREE.Color(node.parameters.color1 ?? '#000000');
    const color2 = new THREE.Color(node.parameters.color2 ?? '#ffffff');
    const angle = node.parameters.angle ?? 0.0;

    return this.createShaderTexture(width, height, {
      uColor1: { value: color1 },
      uColor2: { value: color2 },
      uAngle: { value: angle },
    }, `
      uniform vec3 uColor1;
      uniform vec3 uColor2;
      uniform float uAngle;
      varying vec2 vUv;

      void main() {
        vec2 uv = vUv - 0.5;
        float c = cos(uAngle);
        float s = sin(uAngle);
        mat2 rot = mat2(c, -s, s, c);
        uv = rot * uv;
        float t = uv.x + 0.5;
        vec3 color = mix(uColor1, uColor2, t);
        gl_FragColor = vec4(color, 1.0);
      }
    `);
  }

  private executeNoiseNode(node: CompositeNode): THREE.Texture | null {
    const width = 512;
    const height = 512;

    return this.createShaderTexture(width, height, {
      uScale: { value: node.parameters.scale ?? 1.0 },
      uSeed: { value: node.parameters.seed ?? 0.0 },
    }, `
      uniform float uScale;
      uniform float uSeed;
      varying vec2 vUv;

      float random(vec2 st) {
        return fract(sin(dot(st.xy, vec2(12.9898, 78.233)) + uSeed) * 43758.5453123);
      }

      void main() {
        vec2 st = vUv * uScale;
        float noise = random(floor(st));
        gl_FragColor = vec4(vec3(noise), 1.0);
      }
    `);
  }

  /**
   * Helper to create a texture from a shader
   */
  private createShaderTexture(
    width: number,
    height: number,
    uniforms: Record<string, { value: any }>,
    fragmentShader: string
  ): THREE.Texture {
    if (!this.renderer) {
      console.error('[NodeGraph] No renderer available for shader execution');
      // Return a placeholder texture
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      return new THREE.CanvasTexture(canvas);
    }

    // Create render target
    const renderTarget = new THREE.WebGLRenderTarget(width, height, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.FloatType,
    });

    // Create shader material
    const material = new THREE.ShaderMaterial({
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

    // Create scene and camera for rendering
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const geometry = new THREE.PlaneGeometry(2, 2);
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    // Render to texture
    const currentRenderTarget = this.renderer.getRenderTarget();
    this.renderer.setRenderTarget(renderTarget);
    this.renderer.render(scene, camera);
    this.renderer.setRenderTarget(currentRenderTarget);

    // Clean up
    geometry.dispose();
    material.dispose();

    return renderTarget.texture;
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.evaluationCache.forEach(texture => {
      if (texture) texture.dispose();
    });
    this.evaluationCache.clear();
    this.nodes.clear();
    this.connections.clear();
  }
}
