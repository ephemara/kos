// TypeScript types for KAutoPBR material system
// Mirrors Rust data structures for type safety across IPC boundary

export type MaterialCategory = 
  | 'Metal'
  | 'Wood'
  | 'Stone'
  | 'Fabric'
  | 'Plastic'
  | 'Organic'
  | 'SciFi'
  | 'Fantasy';

export interface MaterialMetadata {
  name: string;
  description: string;
  tags: string[];
  author: string;
  createdAt: string; // ISO 8601 datetime
  modifiedAt: string; // ISO 8601 datetime
  version: number;
  category: MaterialCategory;
}

export interface MaterialHandle {
  id: string; // UUID
  metadata: MaterialMetadata;
  layers: Layer[];
  animation?: AnimationData;
  variants: string[]; // UUIDs
  baseMaterial?: string; // UUID
}

export interface Layer {
  id: string; // UUID
  name: string;
  maps: PBRMaps;
  opacity: number;
  blendMode: BlendMode;
  mask?: Mask;
  visible: boolean;
  locked: boolean;
}

export interface PBRMaps {
  albedo?: TextureHandle;
  normal?: TextureHandle;
  roughness?: TextureHandle;
  metallic?: TextureHandle;
  ao?: TextureHandle;
  height?: TextureHandle;
  emissive?: TextureHandle;
}

export interface PBRMaterialProps {
  albedoColor?: string;
  roughnessValue?: number;
  metallicValue?: number;
  emissiveIntensity?: number;
  emissiveColor?: string;
  normalStrength?: number;
}

export interface TextureHandle {
  path: string;
  width: number;
  height: number;
}

export type BlendMode =
  | 'Normal'
  | 'Multiply'
  | 'Screen'
  | 'Overlay'
  | 'Add'
  | 'Subtract'
  | 'Divide'
  | 'Difference'
  | 'Darken'
  | 'Lighten';

export interface Mask {
  texture: TextureHandle;
  invert: boolean;
}

export interface AnimationData {
  duration: number;
  loopMode: LoopMode;
  tracks: AnimationTrack[];
}

export type LoopMode = 'Once' | 'Loop' | 'PingPong';

export interface AnimationTrack {
  parameter: AnimationParameter;
  animationType: AnimationType;
}

export type AnimationParameter =
  | 'AlbedoColor'
  | 'AlbedoRed'
  | 'AlbedoGreen'
  | 'AlbedoBlue'
  | 'Roughness'
  | 'Metallic'
  | 'EmissiveIntensity'
  | 'EmissiveColor'
  | 'HeightOffset'
  | 'NormalStrength'
  | 'UVOffsetX'
  | 'UVOffsetY';

export type AnimationType =
  | { Keyframe: KeyframeAnimation }
  | { Procedural: ProceduralAnimation }
  | { Physics: PhysicsAnimation };

export interface KeyframeAnimation {
  keyframes: Keyframe[];
  interpolation: InterpolationType;
}

export interface Keyframe {
  time: number;
  value: number;
  tangentIn?: Vec2;
  tangentOut?: Vec2;
}

export interface Vec2 {
  x: number;
  y: number;
}

export type InterpolationType =
  | 'Linear'
  | 'EaseIn'
  | 'EaseOut'
  | 'EaseInOut'
  | 'Bezier';

export interface ProceduralAnimation {
  expression: string;
}

export interface PhysicsAnimation {
  simulationType: SimulationType;
}

export type SimulationType =
  | 'RustSpreading'
  | 'MossGrowth'
  | 'Erosion'
  | 'Weathering'
  | 'Cracking'
  | 'Melting';
