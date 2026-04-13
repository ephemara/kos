import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Activity, SlidersHorizontal, BarChart3, Info } from 'lucide-react';
import { RetopoEngine } from './engine/retopoEngine';
import TopBar from './ui/TopBar';
import LeftPanel from './ui/LeftPanel';
import RightPanel from './ui/RightPanel';
import { AppShell } from '@/ui/shell/AppShell';
import { AppMenuBar } from '@/ui/shell/AppMenuBar';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { NativeViewportSyncSource } from '@/services/nativeViewportBridge';
import { useRegisterSharedViewport } from '@/features/viewport/sharedViewportSession';

export type RetopoMode = 'draw' | 'select' | 'move' | 'extrude' | 'loop';

interface KRetopoProps {
  sharedState?: any;
  onCommit?: (data: any) => void;
}

export default function KRetopo({ sharedState, onCommit }: KRetopoProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<RetopoEngine | null>(null);

  // UI State
  const [mode, setMode] = useState<RetopoMode>('draw');
  const [surfaceSnapping, setSurfaceSnapping] = useState(true);
  const [snapDistance, setSnapDistance] = useState(0.1);
  const [symmetryEnabled, setSymmetryEnabled] = useState(false);
  const [symmetryAxis, setSymmetryAxis] = useState<'x' | 'y' | 'z'>('x');
  const [status, setStatus] = useState('Ready');
  const [useNativeRenderer, setUseNativeRenderer] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem('kretopo.useNativeRenderer') === '1';
  });

  // Topology Stats
  const [stats, setStats] = useState({
    vertices: 0,
    edges: 0,
    faces: 0,
    quads: 0,
    tris: 0,
    ngons: 0,
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('kretopo.useNativeRenderer', useNativeRenderer ? '1' : '0');
  }, [useNativeRenderer]);

  // Initialize engine
  useEffect(() => {
    if (!canvasRef.current || useNativeRenderer) return;

    const engine = new RetopoEngine(canvasRef.current);
    engineRef.current = engine;

    engine.initialize();
    setStatus('Engine initialized');

    // Canvas resize observer for proper sizing
    const resizeObserver = new ResizeObserver(() => {
      if (canvasRef.current) {
        const w = canvasRef.current.clientWidth;
        const h = canvasRef.current.clientHeight;
        if (w > 0 && h > 0) {
          // RetopoEngine handleResize is private, trigger via window event
          window.dispatchEvent(new Event('resize'));
        }
      }
    });
    if (canvasRef.current) resizeObserver.observe(canvasRef.current);

    return () => {
      resizeObserver.disconnect();
      engine.dispose();
    };
  }, [useNativeRenderer]);

  // Load shared artifact as reference mesh
  useEffect(() => {
    if (!engineRef.current || !sharedState?.artifact || useNativeRenderer) return;

    setStatus('Loading reference mesh...');
    const url = URL.createObjectURL(sharedState.artifact);
    const loader = new GLTFLoader();
    loader.load(
      url,
      (gltf: any) => {
        URL.revokeObjectURL(url);
        let referenceMesh: any = null;
        gltf.scene.traverse((child: any) => {
          if (child.isMesh && !referenceMesh) {
            referenceMesh = child;
          }
        });
        if (referenceMesh && engineRef.current) {
          engineRef.current.setReferenceMesh(referenceMesh);
          setStatus('Reference mesh loaded');
        } else {
          setStatus('No mesh found in artifact');
        }
      },
      undefined,
      (err: any) => {
        URL.revokeObjectURL(url);
        console.error('[KRetopo] Failed to load reference:', err);
        setStatus('Failed to load reference mesh');
      }
    );
  }, [sharedState?.artifact, useNativeRenderer]);

  // Update engine settings
  useEffect(() => {
    if (!engineRef.current) return;
    engineRef.current.setMode(mode);
  }, [mode]);

  useEffect(() => {
    if (!engineRef.current) return;
    engineRef.current.enableSurfaceSnapping(surfaceSnapping);
    engineRef.current.setSnapDistance(snapDistance);
  }, [surfaceSnapping, snapDistance]);

  useEffect(() => {
    if (!engineRef.current) return;
    if (symmetryEnabled) {
      engineRef.current.enableSymmetry(symmetryAxis);
    } else {
      engineRef.current.disableSymmetry();
    }
  }, [symmetryEnabled, symmetryAxis]);

  // Handle export
  const handleExport = () => {
    if (!engineRef.current) return;
    const mesh = engineRef.current.exportMesh();
    if (mesh && onCommit) {
      onCommit({ mesh });
      setStatus('Mesh exported');
    }
  };

  // Handle auto-retopo
  const handleAutoRetopo = async (targetPolyCount: number) => {
    if (!engineRef.current) return;
    setStatus('Running auto-retopo...');
    try {
      await engineRef.current.autoRetopo(targetPolyCount);
      setStatus('Auto-retopo complete');
    } catch (error) {
      setStatus(`Auto-retopo failed: ${error}`);
    }
  };

  // Update stats periodically
  useEffect(() => {
    const interval = setInterval(() => {
      if (engineRef.current) {
        const newStats = engineRef.current.getTopologyStats();
        setStats(newStats);
      }
    }, 500);

    return () => clearInterval(interval);
  }, []);

  const leftTabs = useMemo(
    () => [
      {
        id: 'tools',
        label: 'Tools',
        icon: SlidersHorizontal,
        content: (
          <LeftPanel
            surfaceSnapping={surfaceSnapping}
            onSurfaceSnappingChange={setSurfaceSnapping}
            snapDistance={snapDistance}
            onSnapDistanceChange={setSnapDistance}
            symmetryEnabled={symmetryEnabled}
            onSymmetryEnabledChange={setSymmetryEnabled}
            symmetryAxis={symmetryAxis}
            onSymmetryAxisChange={setSymmetryAxis}
            onAutoRetopo={handleAutoRetopo}
          />
        ),
      },
    ],
    [surfaceSnapping, snapDistance, symmetryEnabled, symmetryAxis]
  );

  const rightTabs = useMemo(
    () => [
      {
        id: 'stats',
        label: 'Stats',
        icon: BarChart3,
        content: <RightPanel stats={stats} />,
      },
      {
        id: 'help',
        label: 'Guide',
        icon: Info,
        content: (
          <div className="p-4 text-[11px] text-zinc-400 space-y-2">
            <p className="text-zinc-200 text-xs font-semibold">Retopo Workflow</p>
            <p>1. Load your reference mesh in the scene input pipeline.</p>
            <p>2. Use Draw to place quads, then Move/Extrude for cleanup.</p>
            <p>3. Keep surface snapping enabled for projection accuracy.</p>
            <p>4. Export when quad ratio and manifold checks look clean.</p>
          </div>
        ),
      },
    ],
    [stats]
  );

  const nativeSyncSource = useMemo<NativeViewportSyncSource>(() => {
    if (sharedState?.artifact) {
      return { kind: 'artifact-blob', blob: sharedState.artifact };
    }
    return { kind: 'none' };
  }, [sharedState?.artifact]);

  const sharedViewportRequest = useMemo(() => {
    if (!useNativeRenderer) return null;
    return {
      ownerId: 'kretopo',
      meshHandle: null,
      syncSource: nativeSyncSource,
      captureInput: true,
      hostInputMode: 'camera' as const,
      showDiagnostics: false,
      onStatusChange: setStatus,
    };
  }, [nativeSyncSource, useNativeRenderer]);

  useRegisterSharedViewport(sharedViewportRequest);

  return (
    <AppShell
      layoutKey="kretopo"
      className="text-gray-300 font-mono select-none overflow-hidden bg-[#050505]"
      menuBar={
        <AppMenuBar
          menus={[
            {
              label: 'File',
              items: [
                {
                  label: useNativeRenderer ? 'Use Legacy Viewport' : 'Use Native Viewport',
                  onSelect: () => setUseNativeRenderer((prev) => !prev),
                },
                { label: 'Export Mesh', onSelect: handleExport, shortcut: 'Ctrl+S' },
              ],
            },
            {
              label: 'View',
              items: [
                {
                  label: surfaceSnapping ? 'Disable Surface Snapping' : 'Enable Surface Snapping',
                  onSelect: () => setSurfaceSnapping((v) => !v),
                },
                {
                  label: symmetryEnabled ? 'Disable Symmetry' : 'Enable Symmetry',
                  onSelect: () => setSymmetryEnabled((v) => !v),
                },
              ],
            },
            {
              label: 'Help',
              items: [{ label: 'Retopo Docs (WIP)', disabled: true }],
            },
          ]}
        />
      }
      topBar={
        <TopBar
          mode={mode}
          onModeChange={setMode}
          onExport={handleExport}
          status={status}
        />
      }
      left={{
        title: 'K-RETOPO',
        defaultSize: 22,
        minSize: 14,
        collapsedSize: 4,
        tabs: leftTabs,
      }}
      right={{
        title: 'INSPECT',
        defaultSize: 20,
        minSize: 14,
        collapsedSize: 4,
        tabs: rightTabs,
      }}
      centerTransparent={useNativeRenderer}
    >
      <div className={`relative h-full w-full cursor-crosshair overflow-hidden select-none ${useNativeRenderer ? 'bg-transparent pointer-events-none' : 'bg-[#090909]'}`}>
        {!useNativeRenderer && (
          <canvas
            ref={canvasRef}
            className="w-full h-full"
            style={{ cursor: 'crosshair' }}
          />
        )}
        <div className="absolute bottom-4 left-4 bg-black/70 backdrop-blur px-3 py-1 rounded text-[10px] text-gray-400 font-mono border border-gray-800 flex items-center gap-2 pointer-events-none z-30">
          <Activity
            size={12}
            className={status.toLowerCase().includes('failed') ? 'text-red-400' : 'text-orange-500'}
          />
          {status}
        </div>
      </div>
    </AppShell>
  );
}
