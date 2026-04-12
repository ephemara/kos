/**
 * KBake - Professional Texture Baking Tool
 * 
 * GPU-accelerated texture baking for transferring surface details from high-poly
 * to low-poly meshes. Supports multiple map types including normal maps, ambient
 * occlusion, curvature, thickness, position, and material ID maps.
 * 
 * Features:
 * - GPU ray tracing for fast baking
 * - Multiple map types (normal, AO, curvature, thickness, position, ID)
 * - Cage-based baking with auto-generation
 * - Real-time preview
 * - Batch baking
 * - Multi-resolution output
 */

import React, { useEffect, useRef, useState } from 'react';
import { BakeEngine, type MapType } from './engine/bakeEngine';
import { TopBar } from './ui/TopBar';
import { LeftPanel } from './ui/LeftPanel';
import { RightPanel } from './ui/RightPanel';
import { ProgressOverlay } from './ui/ProgressOverlay';

export const KBake: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<BakeEngine | null>(null);
  const [selectedMaps, setSelectedMaps] = useState<Set<MapType>>(new Set(['normal', 'ao']));
  const [isBaking, setIsBaking] = useState(false);
  const [bakeProgress, setBakeProgress] = useState<{
    currentMap: MapType | null;
    current: number;
    total: number;
  }>({ currentMap: null, current: 0, total: 0 });

  useEffect(() => {
    if (!canvasRef.current) return;

    // Initialize bake engine
    const engine = new BakeEngine(canvasRef.current);
    engineRef.current = engine;

    // Start render loop
    engine.start();

    console.log('[KBake] Engine initialized');

    return () => {
      engine.dispose();
      console.log('[KBake] Engine disposed');
    };
  }, []);

  const handleBakeStart = () => {
    setIsBaking(true);
    setBakeProgress({ currentMap: null, current: 0, total: 0 });
    console.log('[KBake] Baking started');
  };

  const handleBakeComplete = () => {
    setIsBaking(false);
    setBakeProgress({ currentMap: null, current: 0, total: 0 });
    console.log('[KBake] Baking completed');
  };

  const handleBakeProgress = (mapType: MapType, current: number, total: number) => {
    setBakeProgress({ currentMap: mapType, current, total });
  };

  const handleHighPolyVisibilityChange = (visible: boolean) => {
    engineRef.current?.setHighPolyVisible(visible);
  };

  const handleLowPolyVisibilityChange = (visible: boolean) => {
    engineRef.current?.setLowPolyVisible(visible);
  };

  return (
    <div className="kbake-container" style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100vh',
      background: '#1a1a1a'
    }}>
      {/* Top toolbar */}
      <TopBar 
        engine={engineRef.current}
        onHighPolyVisibilityChange={handleHighPolyVisibilityChange}
        onLowPolyVisibilityChange={handleLowPolyVisibilityChange}
      />

      {/* Main content area */}
      <div style={{ 
        display: 'flex', 
        flex: 1, 
        overflow: 'hidden' 
      }}>
        {/* Left panel - Map type selector */}
        <LeftPanel 
          engine={engineRef.current}
          selectedMaps={selectedMaps}
          onSelectedMapsChange={setSelectedMaps}
          onBakeStart={handleBakeStart}
          onBakeComplete={handleBakeComplete}
          onBakeProgress={handleBakeProgress}
        />

        {/* Center viewport */}
        <div style={{ 
          flex: 1, 
          position: 'relative',
          background: '#2a2a2a'
        }}>
          <canvas
            ref={canvasRef}
            style={{
              width: '100%',
              height: '100%',
              display: 'block'
            }}
          />

          {/* Progress Overlay */}
          <ProgressOverlay
            visible={isBaking}
            currentMap={bakeProgress.currentMap}
            current={bakeProgress.current}
            total={bakeProgress.total}
          />
        </div>

        {/* Right panel - Settings and preview */}
        <RightPanel 
          engine={engineRef.current}
          onBakeStart={handleBakeStart}
          onBakeComplete={handleBakeComplete}
        />
      </div>
    </div>
  );
};

export default KBake;
