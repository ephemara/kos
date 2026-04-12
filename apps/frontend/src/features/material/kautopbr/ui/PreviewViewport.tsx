import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, PerspectiveCamera } from '@react-three/drei';
import { Suspense, useState, useCallback, useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/primitives/Select';
import { 
  loadLightingPresets, 
  getDefaultPresets,
  type LightingPresetConfig,
  type LightingPresetMap 
} from '../config/lightingPresets';

// Preview shape types
export type PreviewShape = 'sphere' | 'cube' | 'cylinder' | 'plane' | 'torus';

interface PreviewShapeProps {
  shape: PreviewShape;
  material: THREE.Material;
}

function PreviewShape({ shape, material }: PreviewShapeProps) {
  const geometry = useMemo(() => {
    switch (shape) {
      case 'sphere':
        return new THREE.SphereGeometry(1, 64, 64);
      case 'cube':
        return new THREE.BoxGeometry(1, 1, 1, 32, 32, 32);
      case 'cylinder':
        return new THREE.CylinderGeometry(0.5, 0.5, 2, 64);
      case 'plane':
        return new THREE.PlaneGeometry(2, 2, 64, 64);
      case 'torus':
        return new THREE.TorusGeometry(0.7, 0.3, 64, 128);
      default:
        return new THREE.SphereGeometry(1, 64, 64);
    }
  }, [shape]);

  return <mesh geometry={geometry} material={material} />;
}

interface SceneLightsProps {
  config: LightingPresetConfig;
}

function SceneLights({ config }: SceneLightsProps) {
  return (
    <>
      {config.lights?.map((light, index) => {
        const color = new THREE.Color(light.color);
        
        if (light.type === 'directional' && light.position) {
          return (
            <directionalLight
              key={`dir-${index}`}
              position={light.position}
              intensity={light.intensity}
              color={color}
              castShadow={light.castShadow}
            />
          );
        }
        
        if (light.type === 'point' && light.position) {
          return (
            <pointLight
              key={`point-${index}`}
              position={light.position}
              intensity={light.intensity}
              color={color}
              castShadow={light.castShadow}
            />
          );
        }
        
        if (light.type === 'ambient') {
          return (
            <ambientLight
              key={`ambient-${index}`}
              intensity={light.intensity}
              color={color}
            />
          );
        }
        
        return null;
      })}
    </>
  );
}

export interface PBRMaterialProps {
  albedo?: THREE.Texture | null;
  normal?: THREE.Texture | null;
  roughness?: THREE.Texture | null;
  metallic?: THREE.Texture | null;
  ao?: THREE.Texture | null;
  height?: THREE.Texture | null;
  emissive?: THREE.Texture | null;
  albedoColor?: string;
  roughnessValue?: number;
  metallicValue?: number;
  emissiveIntensity?: number;
  emissiveColor?: string;
  normalStrength?: number;
}

export interface PreviewViewportProps {
  shape?: PreviewShape;
  lightingPreset?: string;
  materialProps?: PBRMaterialProps;
  onLightingChange?: (preset: string) => void;
  onShapeChange?: (shape: PreviewShape) => void;
  customHDR?: string;
}

export function PreviewViewport({
  shape = 'sphere',
  lightingPreset = 'studio',
  materialProps = {},
  onLightingChange,
  onShapeChange,
  customHDR,
}: PreviewViewportProps) {
  const [currentShape, setCurrentShape] = useState<PreviewShape>(shape);
  const [currentLighting, setCurrentLighting] = useState<string>(lightingPreset);
  const [updateTimestamp, setUpdateTimestamp] = useState(Date.now());
  const [presets, setPresets] = useState<LightingPresetMap>(getDefaultPresets());
  const [presetKeys, setPresetKeys] = useState<string[]>(Object.keys(getDefaultPresets()));

  // Load lighting presets from config on mount
  useEffect(() => {
    loadLightingPresets().then((loadedPresets) => {
      setPresets(loadedPresets);
      setPresetKeys(Object.keys(loadedPresets));
    });
  }, []);

  // Create PBR material with all maps
  const material = useMemo(() => {
    const mat = new THREE.MeshStandardMaterial({
      color: materialProps.albedoColor || '#ffffff',
      roughness: materialProps.roughnessValue ?? 0.5,
      metalness: materialProps.metallicValue ?? 0.0,
      emissive: new THREE.Color(materialProps.emissiveColor || '#000000'),
      emissiveIntensity: materialProps.emissiveIntensity ?? 0.0,
    });

    // Apply texture maps
    if (materialProps.albedo) {
      mat.map = materialProps.albedo;
    }
    
    if (materialProps.normal) {
      mat.normalMap = materialProps.normal;
      mat.normalScale = new THREE.Vector2(
        materialProps.normalStrength ?? 1.0,
        materialProps.normalStrength ?? 1.0
      );
    }
    
    if (materialProps.roughness) {
      mat.roughnessMap = materialProps.roughness;
    }
    
    if (materialProps.metallic) {
      mat.metalnessMap = materialProps.metallic;
    }
    
    if (materialProps.ao) {
      mat.aoMap = materialProps.ao;
      mat.aoMapIntensity = 1.0;
    }
    
    if (materialProps.height) {
      mat.displacementMap = materialProps.height;
      mat.displacementScale = 0.1;
    }
    
    if (materialProps.emissive) {
      mat.emissiveMap = materialProps.emissive;
    }

    mat.needsUpdate = true;
    return mat;
  }, [materialProps]);

  const lightingConfig = useMemo(() => {
    return presets[currentLighting] || presets['studio'];
  }, [currentLighting, presets]);

  const handleLightingChange = useCallback((preset: string) => {
    const startTime = performance.now();
    setCurrentLighting(preset);
    setUpdateTimestamp(Date.now());
    
    // Measure update latency for requirement 8.10 (< 100ms)
    requestAnimationFrame(() => {
      const endTime = performance.now();
      const latency = endTime - startTime;
      if (latency > 100) {
        console.warn(`Lighting update latency: ${latency.toFixed(2)}ms (exceeds 100ms requirement)`);
      }
    });
    
    onLightingChange?.(preset);
  }, [onLightingChange]);

  const handleShapeChange = useCallback((newShape: PreviewShape) => {
    setCurrentShape(newShape);
    onShapeChange?.(newShape);
  }, [onShapeChange]);

  return (
    <div className="relative w-full h-full bg-gray-900">
      {/* Controls */}
      <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
        <div className="bg-gray-800/90 backdrop-blur-sm rounded-lg p-3 shadow-lg">
          <label className="text-xs text-gray-300 mb-2 block">Shape</label>
          <Select value={currentShape} onValueChange={(v) => handleShapeChange(v as PreviewShape)}>
            <SelectTrigger className="w-32 bg-gray-700 border-gray-600">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="sphere">Sphere</SelectItem>
              <SelectItem value="cube">Cube</SelectItem>
              <SelectItem value="cylinder">Cylinder</SelectItem>
              <SelectItem value="plane">Plane</SelectItem>
              <SelectItem value="torus">Torus</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="bg-gray-800/90 backdrop-blur-sm rounded-lg p-3 shadow-lg">
          <label className="text-xs text-gray-300 mb-2 block">Lighting</label>
          <Select value={currentLighting} onValueChange={handleLightingChange}>
            <SelectTrigger className="w-32 bg-gray-700 border-gray-600">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {presetKeys.map((key) => (
                <SelectItem key={key} value={key}>
                  {presets[key].name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* 3D Canvas */}
      <Canvas
        key={updateTimestamp}
        shadows
        dpr={[1, 2]}
        gl={{ 
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.0,
        }}
      >
        <PerspectiveCamera makeDefault position={[0, 0, 3]} fov={50} />
        
        <Suspense fallback={null}>
          {/* HDR Environment for image-based lighting */}
          {lightingConfig.useHDR && (customHDR || lightingConfig.hdrPath) ? (
            <Environment files={customHDR || lightingConfig.hdrPath} background />
          ) : (
            <>
              <color attach="background" args={[lightingConfig.background || '#000000']} />
              <SceneLights config={lightingConfig} />
            </>
          )}
          
          {/* Preview mesh with PBR material */}
          <PreviewShape shape={currentShape} material={material} />
        </Suspense>

        {/* Camera controls */}
        <OrbitControls
          enablePan
          enableZoom
          enableRotate
          minDistance={1}
          maxDistance={10}
          makeDefault
        />
      </Canvas>

      {/* Info overlay */}
      <div className="absolute bottom-4 right-4 bg-gray-800/90 backdrop-blur-sm rounded-lg p-2 text-xs text-gray-300">
        <div>Shape: {currentShape}</div>
        <div>Lighting: {lightingConfig.name}</div>
      </div>
    </div>
  );
}
