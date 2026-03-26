/**
 * KWeight - Weight Painting Tool
 * 
 * Professional weight painting tool for vertex group management and skeletal animation.
 * Features brush-based painting, weight visualization, smoothing, normalization, and transfer.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import { WeightEngine, VertexGroup, WeightPaintSettings } from './engine/weightEngine';
import { VisualizationMode } from './engine/visualization';
import { TransferSettings } from './engine/transfer';
import TopBar from './ui/TopBar';
import LeftPanel from './ui/LeftPanel';
import RightPanel from './ui/RightPanel';

interface KWeightProps {
  initialMesh?: THREE.Mesh;
}

const KWeight: React.FC<KWeightProps> = ({ initialMesh }) => {
  const [engine] = useState(() => new WeightEngine());
  const [mesh, setMesh] = useState<THREE.Mesh | null>(initialMesh || null);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [vertexGroups, setVertexGroups] = useState<VertexGroup[]>([]);
  const [paintSettings, setPaintSettings] = useState<WeightPaintSettings>(engine.getPaintSettings());
  const [visualizationMode, setVisualizationMode] = useState<VisualizationMode>('gradient');
  const [isPainting, setIsPainting] = useState(false);
  const [showBrushCursor, setShowBrushCursor] = useState(false);
  const [hoverInfo, setHoverInfo] = useState<{ position: { x: number; y: number }; weight: number; vertexIndex: number } | null>(null);

  // Initialize engine with mesh
  useEffect(() => {
    if (mesh) {
      engine.setMesh(mesh);
    }
  }, [mesh, engine]);

  // Update vertex groups list
  const updateVertexGroups = useCallback(() => {
    setVertexGroups(engine.getAllVertexGroups());
  }, [engine]);

  // Vertex Group Management
  const handleCreateGroup = useCallback((name: string) => {
    const id = engine.createVertexGroup(name);
    updateVertexGroups();
    setActiveGroupId(id);
    engine.setActiveGroup(id);
  }, [engine, updateVertexGroups]);

  const handleDeleteGroup = useCallback((groupId: string) => {
    engine.deleteVertexGroup(groupId);
    updateVertexGroups();
    if (activeGroupId === groupId) {
      setActiveGroupId(null);
      engine.setActiveGroup(null);
    }
  }, [engine, activeGroupId, updateVertexGroups]);

  const handleRenameGroup = useCallback((groupId: string, newName: string) => {
    engine.renameVertexGroup(groupId, newName);
    updateVertexGroups();
  }, [engine, updateVertexGroups]);

  const handleSelectGroup = useCallback((groupId: string | null) => {
    setActiveGroupId(groupId);
    engine.setActiveGroup(groupId);
  }, [engine]);

  // Paint Settings
  const handlePaintSettingsChange = useCallback((settings: Partial<WeightPaintSettings>) => {
    const newSettings = { ...paintSettings, ...settings };
    setPaintSettings(newSettings);
    engine.setPaintSettings(newSettings);
  }, [engine, paintSettings]);

  // Visualization
  const handleVisualizationModeChange = useCallback((mode: VisualizationMode) => {
    setVisualizationMode(mode);
    engine.setVisualizationMode(mode);
  }, [engine]);

  // Weight Operations
  const handleSmoothWeights = useCallback((iterations: number = 1) => {
    if (!activeGroupId) return;
    const selectedVertices = Array.from(engine.getSelectedVertices());
    if (selectedVertices.length === 0) {
      // Smooth all vertices if none selected
      const geometry = mesh?.geometry;
      if (geometry) {
        const vertexCount = geometry.attributes.position.count;
        const allVertices = Array.from({ length: vertexCount }, (_, i) => i);
        engine.smoothWeights(activeGroupId, allVertices, iterations);
      }
    } else {
      engine.smoothWeights(activeGroupId, selectedVertices, iterations);
    }
    engine.updateVisualization();
  }, [engine, activeGroupId, mesh]);

  const handleNormalizeWeights = useCallback(() => {
    engine.normalizeAllWeights();
    engine.updateVisualization();
  }, [engine]);

  // Selection
  const handleSelectByWeight = useCallback((min: number, max: number) => {
    if (!activeGroupId) return;
    engine.selectVerticesByWeight(activeGroupId, min, max);
  }, [engine, activeGroupId]);

  const handleSelectByGroup = useCallback((groupId: string) => {
    engine.selectVerticesByGroup(groupId);
  }, [engine]);

  const handleClearSelection = useCallback(() => {
    engine.clearSelection();
  }, [engine]);

  // Undo/Redo
  const handleUndo = useCallback(() => {
    engine.undo();
  }, [engine]);

  const handleRedo = useCallback(() => {
    engine.redo();
  }, [engine]);

  // Import/Export
  const handleExportWeights = useCallback(() => {
    const data = engine.exportWeights();
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'weights.json';
    a.click();
    URL.revokeObjectURL(url);
  }, [engine]);

  const handleImportWeights = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        engine.importWeights(data);
        updateVertexGroups();
      } catch (error) {
        console.error('Failed to import weights:', error);
      }
    };
    reader.readAsText(file);
  }, [engine, updateVertexGroups]);

  // Cleanup
  useEffect(() => {
    return () => {
      engine.dispose();
    };
  }, [engine]);

  return (
    <div className="flex h-screen w-screen bg-gray-900 text-white">
      {/* Left Panel - Brush Settings */}
      <LeftPanel
        paintSettings={paintSettings}
        onPaintSettingsChange={handlePaintSettingsChange}
        onSmoothWeights={handleSmoothWeights}
        onNormalizeWeights={handleNormalizeWeights}
        visualizationMode={visualizationMode}
        onVisualizationModeChange={handleVisualizationModeChange}
      />

      {/* Center - 3D Viewport */}
      <div className="flex-1 flex flex-col">
        <TopBar
          activeGroupId={activeGroupId}
          canUndo={engine.canUndo()}
          canRedo={engine.canRedo()}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onExportWeights={handleExportWeights}
          onImportWeights={handleImportWeights}
        />

        <div className="flex-1 relative">
          {/* Weight Value Tooltip */}
          {hoverInfo && (
            <div
              className="absolute z-50 pointer-events-none bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm shadow-lg"
              style={{
                left: `${hoverInfo.position.x + 15}px`,
                top: `${hoverInfo.position.y + 15}px`,
              }}
            >
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="text-gray-400">Vertex:</span>
                  <span className="font-mono text-white">{hoverInfo.vertexIndex}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-400">Weight:</span>
                  <span className="font-mono text-white">{hoverInfo.weight.toFixed(3)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div
                    className="w-12 h-3 rounded"
                    style={{
                      background: `linear-gradient(to right, #0000ff ${hoverInfo.weight * 100}%, #333 ${hoverInfo.weight * 100}%)`,
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          <Canvas>
            <PerspectiveCamera makeDefault position={[0, 0, 5]} />
            <OrbitControls />
            
            <ambientLight intensity={0.5} />
            <directionalLight position={[10, 10, 5]} intensity={0.8} />
            <directionalLight position={[-10, -10, -5]} intensity={0.3} />

            <WeightViewport
              engine={engine}
              mesh={mesh}
              isPainting={isPainting}
              setIsPainting={setIsPainting}
              showBrushCursor={showBrushCursor}
              setShowBrushCursor={setShowBrushCursor}
              onHoverVertex={setHoverInfo}
            />

            <gridHelper args={[10, 10]} />
            <axesHelper args={[1]} />
          </Canvas>
        </div>
      </div>

      {/* Right Panel - Vertex Groups */}
      <RightPanel
        vertexGroups={vertexGroups}
        activeGroupId={activeGroupId}
        onCreateGroup={handleCreateGroup}
        onDeleteGroup={handleDeleteGroup}
        onRenameGroup={handleRenameGroup}
        onSelectGroup={handleSelectGroup}
        onSelectByWeight={handleSelectByWeight}
        onSelectByGroup={handleSelectByGroup}
        onClearSelection={handleClearSelection}
      />
    </div>
  );
};

interface WeightViewportProps {
  engine: WeightEngine;
  mesh: THREE.Mesh | null;
  isPainting: boolean;
  setIsPainting: (painting: boolean) => void;
  showBrushCursor: boolean;
  setShowBrushCursor: (show: boolean) => void;
  onHoverVertex: (info: { position: { x: number; y: number }; weight: number; vertexIndex: number } | null) => void;
}

const WeightViewport: React.FC<WeightViewportProps> = ({
  engine,
  mesh,
  isPainting,
  setIsPainting,
  showBrushCursor,
  setShowBrushCursor,
  onHoverVertex,
}) => {
  const { camera, gl, raycaster, mouse } = useThree();
  const brushCursorRef = useRef<THREE.Mesh | null>(null);
  const lastPaintPosition = useRef<THREE.Vector3 | null>(null);

  // Update camera position for visualization lighting each frame
  useFrame(() => {
    // Update visualization shader with camera position for proper specular highlights
    engine.updateVisualizationCamera(camera);
  });

  // Handle mouse events
  useEffect(() => {
    const canvas = gl.domElement;

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 0) { // Left click
        setIsPainting(true);
        lastPaintPosition.current = null;
      }
    };

    const handleMouseUp = () => {
      setIsPainting(false);
      lastPaintPosition.current = null;
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!mesh) return;

      // Update mouse coordinates
      const rect = canvas.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      // Raycast to find surface position
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObject(mesh, false);

      if (intersects.length > 0) {
        const intersection = intersects[0];
        const point = intersection.point;
        setShowBrushCursor(true);

        // Update brush cursor position
        if (brushCursorRef.current) {
          brushCursorRef.current.position.copy(point);
          brushCursorRef.current.lookAt(camera.position);
        }

        // Get closest vertex for hover info
        if (intersection.face) {
          const geometry = mesh.geometry;
          const positionAttribute = geometry.attributes.position;
          
          // Get the three vertices of the intersected face
          const faceVertices = [
            intersection.face.a,
            intersection.face.b,
            intersection.face.c,
          ];

          // Find the closest vertex to the intersection point
          let closestVertex = faceVertices[0];
          let minDistance = Infinity;

          const vertexPos = new THREE.Vector3();
          for (const vertexIndex of faceVertices) {
            vertexPos.fromBufferAttribute(positionAttribute, vertexIndex);
            vertexPos.applyMatrix4(mesh.matrixWorld);
            const distance = point.distanceTo(vertexPos);
            if (distance < minDistance) {
              minDistance = distance;
              closestVertex = vertexIndex;
            }
          }

          // Get weight value for the closest vertex
          const activeGroup = engine.getActiveGroup();
          if (activeGroup) {
            const weight = activeGroup.weights.get(closestVertex) ?? 0;
            onHoverVertex({
              position: { x: e.clientX, y: e.clientY },
              weight,
              vertexIndex: closestVertex,
            });
          } else {
            onHoverVertex(null);
          }
        }

        // Paint if mouse is down
        if (isPainting) {
          engine.paintWeights(point, camera);
          lastPaintPosition.current = point.clone();
        }
      } else {
        setShowBrushCursor(false);
        onHoverVertex(null);
      }
    };

    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseleave', () => {
      setShowBrushCursor(false);
      setIsPainting(false);
      onHoverVertex(null);
    });

    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('mousemove', handleMouseMove);
    };
  }, [engine, mesh, camera, gl, raycaster, mouse, isPainting, setIsPainting, setShowBrushCursor]);

  // Render mesh
  return (
    <>
      {mesh && <primitive object={mesh} />}
      
      {showBrushCursor && (
        <mesh ref={brushCursorRef}>
          <ringGeometry args={[engine.getPaintSettings().radius * 0.95, engine.getPaintSettings().radius, 32]} />
          <meshBasicMaterial
            color={0xffffff}
            side={THREE.DoubleSide}
            transparent
            opacity={0.5}
            depthTest={false}
          />
        </mesh>
      )}
    </>
  );
};

export default KWeight;
