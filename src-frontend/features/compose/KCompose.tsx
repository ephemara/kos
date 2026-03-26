/**
 * KCompose - Node-Based Compositing Tool
 * 
 * Professional compositing tool for combining renders, textures, and effects
 * using a node-based workflow. Supports real-time preview, HDR workflows,
 * and GPU-accelerated processing.
 * 
 * Features:
 * - Node-based compositing graph
 * - Real-time preview with GPU acceleration
 * - Layer-based workflow with blend modes
 * - Color grading and effects library
 * - HDR support (EXR format)
 * - Multiple export formats (PNG, EXR, TIFF)
 */

import React, { useEffect, useRef, useState } from 'react';
import { ComposeEngine, type ExportSettings } from './engine/composeEngine';
import { TopBar } from './ui/TopBar';
import { NodeEditor } from './ui/NodeEditor';
import { LayerPanel } from './ui/LayerPanel';
import { PropertiesPanel } from './ui/PropertiesPanel';

export const KCompose: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<ComposeEngine | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);

  useEffect(() => {
    if (!canvasRef.current) return;

    // Initialize compose engine
    const engine = new ComposeEngine(canvasRef.current);
    engineRef.current = engine;

    // Start render loop
    engine.start();

    console.log('[KCompose] Engine initialized');

    return () => {
      engine.dispose();
      console.log('[KCompose] Engine disposed');
    };
  }, []);

  const handleEvaluate = async () => {
    if (!engineRef.current) return;
    
    setIsEvaluating(true);
    try {
      await engineRef.current.evaluateGraph();
      console.log('[KCompose] Graph evaluated successfully');
    } catch (error) {
      console.error('[KCompose] Graph evaluation failed:', error);
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleExport = async (settings: ExportSettings) => {
    if (!engineRef.current) return;
    
    try {
      await engineRef.current.exportCompositeAdvanced(settings);
      console.log(`[KCompose] Exported as ${settings.format} with settings:`, settings);
    } catch (error) {
      console.error('[KCompose] Export failed:', error);
    }
  };

  return (
    <div className="kcompose-container" style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100vh',
      background: '#1a1a1a'
    }}>
      {/* Top toolbar */}
      <TopBar 
        engine={engineRef.current}
        onEvaluate={handleEvaluate}
        onExport={handleExport}
        isEvaluating={isEvaluating}
      />

      {/* Main content area */}
      <div style={{ 
        display: 'flex', 
        flex: 1, 
        overflow: 'hidden' 
      }}>
        {/* Left panel - Layer stack */}
        <LayerPanel 
          engine={engineRef.current}
        />

        {/* Center - Node editor and preview */}
        <div style={{ 
          flex: 1, 
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          background: '#2a2a2a'
        }}>
          {/* Node graph editor */}
          <div style={{ flex: 1, minHeight: 0 }}>
            <NodeEditor 
              engine={engineRef.current}
              selectedNodeId={selectedNodeId}
              onNodeSelect={setSelectedNodeId}
            />
          </div>

          {/* Preview viewport */}
          <div style={{ 
            height: '300px',
            borderTop: '1px solid #444',
            position: 'relative'
          }}>
            <canvas
              ref={canvasRef}
              style={{
                width: '100%',
                height: '100%',
                display: 'block'
              }}
            />
          </div>
        </div>

        {/* Right panel - Node properties */}
        <PropertiesPanel 
          engine={engineRef.current}
          selectedNodeId={selectedNodeId}
        />
      </div>
    </div>
  );
};

export default KCompose;
