import React from 'react';
import * as THREE from 'three';
import { nativeHostClient } from '@/services/nativeHostClient';
import { syncNativeViewportSource, type NativeViewportSyncSource } from '@/services/nativeViewportBridge';
import { gizmoClient, type NativeGizmoDrawData, type NativeGizmoMode, type NativeGizmoOrientation, type NativeGizmoResult, type NativeGizmoTransform } from '@/services/gizmoClient';
import { rendererClient } from '@/services/rendererClient';
import { BevyConnectionBadge, BevyTether } from '@/features/bevy';
import {
  clientToNdc,
  clientToOverlayPoint,
  ndcToOverlayPoint,
  useViewportOverlayCoordinates,
} from '@/features/viewport/overlayCoordinates';
import type { FrameStats, RenderMeshHandle, SelectionResult, ViewportHandle } from '@/services/viewportClient';
import { openKainAuthoringSession } from '@/kain';

function isViewportNotFoundError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return typeof error === 'string' && error.toLowerCase().includes('viewport not found');
  }
  return error.message.toLowerCase().includes('viewport not found');
}

export interface NativeViewportGizmoConfig {
  enabled: boolean;
  mode: NativeGizmoMode;
  orientation: NativeGizmoOrientation;
  snapping: boolean;
  targets: NativeGizmoTransform[];
  onTargetsChange?: (targets: NativeGizmoTransform[], result: NativeGizmoResult | null) => void;
}

export interface NativeViewportProps {
  className?: string;
  meshHandle?: number | null;
  onStatusChange?: (status: string) => void;
  onViewportHandleChange?: (viewport: ViewportHandle | null) => void;
  useSculptHandle?: boolean;
  syncSource?: NativeViewportSyncSource;
  captureInput?: boolean;
  hostInputMode?: 'none' | 'camera' | 'cursor' | 'camera+cursor';
  showDiagnostics?: boolean;
  onPointerNdcEvent?: (event: {
    kind: 'down' | 'move' | 'up';
    ndcX: number;
    ndcY: number;
    buttons: number;
    altKey: boolean;
    pressure: number;
  }) => void;
  onSelectionChange?: (selection: SelectionResult | null) => void;
  onStrokeStart?: (selection: SelectionResult) => void;
  onStrokeMove?: (selection: SelectionResult) => void;
  onStrokeEnd?: () => void;
  gizmo?: NativeViewportGizmoConfig;
}

export function NativeViewport({
  meshHandle,
  className,
  onStatusChange,
  onViewportHandleChange,
  useSculptHandle = false,
  syncSource,
  captureInput = true,
  hostInputMode = 'none',
  showDiagnostics = true,
  onPointerNdcEvent,
  onSelectionChange,
  onStrokeStart,
  onStrokeMove,
  onStrokeEnd,
  gizmo,
}: NativeViewportProps) {
  const viewportRef = React.useRef<ViewportHandle | null>(null);
  const renderMeshRef = React.useRef<RenderMeshHandle | null>(null);
  const gizmoSessionRef = React.useRef<number | null>(null);
  const gizmoDraggingRef = React.useRef(false);
  const hostRef = React.useRef<HTMLDivElement>(null);
  const dragStateRef = React.useRef<{
    active: boolean;
    lastX: number;
    lastY: number;
    yaw: number;
    pitch: number;
    distance: number;
    target: [number, number, number];
  }>({
    active: false,
    lastX: 0,
    lastY: 0,
    yaw: 0,
    pitch: 0,
    distance: 4,
    target: [0, 0, 0],
  });
  const [available, setAvailable] = React.useState(false);
  const [stats, setStats] = React.useState<FrameStats | null>(null);
  const [status, setStatus] = React.useState('INITIALIZING');
  const [hover, setHover] = React.useState<string>('no-hit');
  const [bevyConnected, setBevyConnected] = React.useState(false);
  const [gizmoDrawData, setGizmoDrawData] = React.useState<NativeGizmoDrawData | null>(null);
  const [brushCursor, setBrushCursor] = React.useState<{
    visible: boolean;
    x: number;
    y: number;
  }>({ visible: false, x: 0, y: 0 });
  const strokeActiveRef = React.useRef(false);
  const onStatusChangeRef = React.useRef(onStatusChange);
  const onViewportHandleChangeRef = React.useRef(onViewportHandleChange);
  const hostInputModeRef = React.useRef(hostInputMode);
  const overlayRect = useViewportOverlayCoordinates(hostRef);

  React.useEffect(() => {
    onStatusChangeRef.current = onStatusChange;
  }, [onStatusChange]);

  React.useEffect(() => {
    onViewportHandleChangeRef.current = onViewportHandleChange;
  }, [onViewportHandleChange]);

  React.useEffect(() => {
    hostInputModeRef.current = hostInputMode;
  }, [hostInputMode]);

  const publishStatus = React.useCallback(
    (next: string) => {
      setStatus(next);
      onStatusChangeRef.current?.(next);
    },
    [],
  );

  React.useEffect(() => {
    let cancelled = false;

    const init = async () => {
      const tauriAvailable = await rendererClient.isAvailable();
      if (cancelled) return;
      setAvailable(tauriAvailable);

      if (!tauriAvailable) {
        publishStatus('NATIVE VIEWPORT UNAVAILABLE');
        return;
      }

      try {
        const viewport = await rendererClient.createViewport({
          width: 1280,
          height: 720,
          shadingMode: 'solid',
          backgroundColor: [0.06, 0.07, 0.1, 1.0],
          enableSelection: true,
          enableShadows: false,
          msaaSamples: 1,
          rendererMode: 'native',
        });

        if (cancelled || viewport == null) {
          return;
        }

        viewportRef.current = viewport;
        onViewportHandleChangeRef.current?.(viewport);
        publishStatus('NATIVE VIEWPORT READY');
      } catch (error) {
        console.error('[NativeViewport] Failed to create native viewport:', error);
        publishStatus('NATIVE VIEWPORT FAILED');
      }
    };

    void init();

    return () => {
      cancelled = true;
      const viewport = viewportRef.current;
      const gizmoSession = gizmoSessionRef.current;
      viewportRef.current = null;
      renderMeshRef.current = null;
      gizmoSessionRef.current = null;
      onViewportHandleChangeRef.current?.(null);
      if (gizmoSession != null) {
        void gizmoClient.disposeSession(gizmoSession);
      }
      if (viewport != null) {
        void rendererClient.disposeViewport(viewport);
      }
    };
  }, [publishStatus]);

  const pushCamera = React.useCallback(async () => {
    const viewport = viewportRef.current;
    if (viewport == null) return;
    const state = dragStateRef.current;
    const cosPitch = Math.cos(state.pitch);
    const sinPitch = Math.sin(state.pitch);
    const cosYaw = Math.cos(state.yaw);
    const sinYaw = Math.sin(state.yaw);
    const position: [number, number, number] = [
      state.target[0] + state.distance * cosPitch * sinYaw,
      state.target[1] + state.distance * sinPitch,
      state.target[2] + state.distance * cosPitch * cosYaw,
    ];
    await rendererClient.setCamera(viewport, {
      position,
      target: state.target,
      up: [0, 1, 0],
      fovDegrees: 55,
      near: 0.1,
      far: 100,
    });
    await rendererClient.requestRedraw(viewport);
    if (hostInputModeRef.current === 'camera' || hostInputModeRef.current === 'camera+cursor') {
      await nativeHostClient.cameraRotate(0, 0);
    }
  }, []);

  React.useEffect(() => {
    void pushCamera();
  }, [pushCamera]);

  const getGizmoCameraState = React.useCallback(() => {
    if (!overlayRect || overlayRect.width <= 0 || overlayRect.height <= 0) {
      return null;
    }

    const state = dragStateRef.current;
    const cosPitch = Math.cos(state.pitch);
    const sinPitch = Math.sin(state.pitch);
    const cosYaw = Math.cos(state.yaw);
    const sinYaw = Math.sin(state.yaw);
    const position = new THREE.Vector3(
      state.target[0] + state.distance * cosPitch * sinYaw,
      state.target[1] + state.distance * sinPitch,
      state.target[2] + state.distance * cosPitch * cosYaw,
    );

    const camera = new THREE.PerspectiveCamera(55, overlayRect.width / overlayRect.height, 0.1, 100);
    camera.position.copy(position);
    camera.up.set(0, 1, 0);
    camera.lookAt(new THREE.Vector3(...state.target));
    camera.updateMatrixWorld(true);
    camera.updateProjectionMatrix();

    return {
      viewMatrix: Array.from(camera.matrixWorldInverse.elements),
      projectionMatrix: Array.from(camera.projectionMatrix.elements),
      viewport: {
        min: [0, 0] as [number, number],
        max: [overlayRect.width, overlayRect.height] as [number, number],
        pixelsPerPoint: overlayRect.pixelsPerPoint,
      },
      rect: overlayRect,
    };
  }, [overlayRect]);

  React.useEffect(() => {
    let cancelled = false;

    const syncGizmoSession = async () => {
      if (!available || !gizmo?.enabled) {
        const existing = gizmoSessionRef.current;
        gizmoSessionRef.current = null;
        gizmoDraggingRef.current = false;
        setGizmoDrawData(null);
        if (existing != null) {
          await gizmoClient.disposeSession(existing);
        }
        return;
      }

      if (gizmoSessionRef.current == null) {
        const session = await gizmoClient.createSession();
        if (cancelled || session == null) return;
        gizmoSessionRef.current = session;
      }

      const cameraState = getGizmoCameraState();
      const session = gizmoSessionRef.current;
      if (!cameraState || session == null) return;

      const response = await gizmoClient.updateSession(session, {
        mode: gizmo.mode,
        orientation: gizmo.orientation,
        snapping: gizmo.snapping,
        viewMatrix: cameraState.viewMatrix,
        projectionMatrix: cameraState.projectionMatrix,
        viewport: cameraState.viewport,
        interaction: {
          cursorPos: [0, 0],
          hovered: false,
          dragStarted: false,
          dragging: false,
        },
        targets: gizmo.targets,
      });

      if (!cancelled && response) {
        setGizmoDrawData(response.drawData);
      }
    };

    void syncGizmoSession();

    return () => {
      cancelled = true;
    };
  }, [available, getGizmoCameraState, gizmo]);

  const processGizmoInteraction = React.useCallback(async (
    kind: 'down' | 'move' | 'up',
    event: React.PointerEvent<HTMLDivElement>,
  ): Promise<boolean> => {
    if (!gizmo?.enabled || gizmoSessionRef.current == null || gizmo.targets.length === 0 || event.altKey) {
      return false;
    }

    const cameraState = getGizmoCameraState();
    if (!cameraState) return false;

    const localX = event.clientX - cameraState.rect.left;
    const localY = event.clientY - cameraState.rect.top;
    const dragging = kind === 'down' ? true : kind === 'move' ? gizmoDraggingRef.current && (event.buttons & 1) !== 0 : false;
    const dragStarted = kind === 'down';
    const wasDragging = gizmoDraggingRef.current;

    const response = await gizmoClient.updateSession(gizmoSessionRef.current, {
      mode: gizmo.mode,
      orientation: gizmo.orientation,
      snapping: gizmo.snapping,
      viewMatrix: cameraState.viewMatrix,
      projectionMatrix: cameraState.projectionMatrix,
      viewport: cameraState.viewport,
      interaction: {
        cursorPos: [localX, localY],
        hovered: true,
        dragStarted,
        dragging,
      },
      targets: gizmo.targets,
    });

    if (!response) {
      return false;
    }

    setGizmoDrawData(response.drawData);

    if (kind === 'down') {
      gizmoDraggingRef.current = response.focused || response.result != null;
    } else if (kind === 'up') {
      gizmoDraggingRef.current = false;
    }

    if (response.result && response.targets.length > 0) {
      gizmo.onTargetsChange?.(response.targets, response.result);
    }

    return response.focused || response.result != null || wasDragging || gizmoDraggingRef.current;
  }, [getGizmoCameraState, gizmo]);

  React.useEffect(() => {
    let cancelled = false;

    const syncMesh = async () => {
      const viewport = viewportRef.current;
      if (viewport == null) return;

      const previous = renderMeshRef.current;
      if (previous != null) {
        try {
          await rendererClient.detachMesh(viewport, previous);
        } catch (error) {
          console.warn('[NativeViewport] Failed to detach previous render mesh:', error);
        }
        renderMeshRef.current = null;
      }

      if (meshHandle == null) {
        if (syncSource && syncSource.kind !== 'none') {
          await syncNativeViewportSource(viewport, syncSource);
          publishStatus('NATIVE VIEWPORT SYNCED SOURCE');
          return;
        }
        publishStatus('NATIVE VIEWPORT READY');
        return;
      }

      try {
        const renderMesh =
          syncSource && syncSource.kind !== 'none'
            ? await syncNativeViewportSource(viewport, syncSource)
            : useSculptHandle
              ? await rendererClient.syncSculptMesh(viewport, meshHandle)
              : await rendererClient.attachMesh(viewport, meshHandle);
        if (cancelled || renderMesh == null) return;
        renderMeshRef.current = renderMesh;
        await rendererClient.requestRedraw(viewport);
        publishStatus(`NATIVE VIEWPORT ATTACHED MESH ${meshHandle}`);
      } catch (error) {
        if (isViewportNotFoundError(error)) {
          return;
        }
        console.error('[NativeViewport] Failed to attach mesh:', error);
        publishStatus('NATIVE VIEWPORT ATTACH FAILED');
      }
    };

    void syncMesh();

    return () => {
      cancelled = true;
    };
  }, [meshHandle, publishStatus, syncSource, useSculptHandle]);

  React.useEffect(() => {
    let cancelled = false;
    const interval = window.setInterval(() => {
      const viewport = viewportRef.current;
      if (viewport == null) return;
      void rendererClient.getStats(viewport)
        .then((next) => {
          if (!cancelled && next) {
            setStats(next);
          }
        })
        .catch((error) => {
          if (!isViewportNotFoundError(error)) {
            console.warn('[NativeViewport] Failed to fetch stats:', error);
          }
        });
    }, 800);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  const resolvePointerCoordinates = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement> | React.MouseEvent<HTMLDivElement>) => {
      if (!overlayRect) {
        return null;
      }
      const overlay = clientToOverlayPoint(overlayRect, event.clientX, event.clientY);
      const ndc = clientToNdc(overlayRect, event.clientX, event.clientY);
      return { overlay, ndc };
    },
    [overlayRect],
  );

  const handlePointerDown = React.useCallback(async (event: React.PointerEvent<HTMLDivElement>) => {
    const coords = resolvePointerCoordinates(event);
    if (!coords) {
      return;
    }
    const ndcX = coords.ndc.x;
    const ndcY = coords.ndc.y;
    onPointerNdcEvent?.({
      kind: 'down',
      ndcX,
      ndcY,
      buttons: event.buttons,
      altKey: event.altKey,
      pressure: event.pressure || 1,
    });

    if (event.button === 0) {
      const gizmoConsumed = await processGizmoInteraction('down', event);
      if (gizmoConsumed) {
        return;
      }
    }

    if (event.button === 0 && !event.altKey) {
      strokeActiveRef.current = true;
      return;
    }
    dragStateRef.current.active = true;
    dragStateRef.current.lastX = event.clientX;
    dragStateRef.current.lastY = event.clientY;
  }, [onPointerNdcEvent, processGizmoInteraction, resolvePointerCoordinates]);

  const handlePointerUp = React.useCallback(async (event?: React.PointerEvent<HTMLDivElement>) => {
    if (event) {
      const coords = resolvePointerCoordinates(event);
      if (coords) {
        onPointerNdcEvent?.({
          kind: 'up',
          ndcX: coords.ndc.x,
          ndcY: coords.ndc.y,
          buttons: event.buttons,
          altKey: event.altKey,
          pressure: event.pressure || 1,
        });
      }

      await processGizmoInteraction('up', event);
    }
    dragStateRef.current.active = false;
    setBrushCursor((previous) => ({ ...previous, visible: false }));
    if (strokeActiveRef.current) {
      strokeActiveRef.current = false;
      onStrokeEnd?.();
    }
  }, [onPointerNdcEvent, onStrokeEnd, processGizmoInteraction, resolvePointerCoordinates]);

  const handlePointerMove = React.useCallback(
    async (event: React.PointerEvent<HTMLDivElement>) => {
      const viewport = viewportRef.current;
      if (viewport == null) return;

      const coords = resolvePointerCoordinates(event);
      if (!coords) {
        return;
      }
      const ndcX = coords.ndc.x;
      const ndcY = coords.ndc.y;
      onPointerNdcEvent?.({
        kind: 'move',
        ndcX,
        ndcY,
        buttons: event.buttons,
        altKey: event.altKey,
        pressure: event.pressure || 1,
      });

      const gizmoConsumed = await processGizmoInteraction('move', event);
      if (gizmoConsumed) {
        return;
      }

      if (dragStateRef.current.active) {
        const dx = event.clientX - dragStateRef.current.lastX;
        const dy = event.clientY - dragStateRef.current.lastY;
        dragStateRef.current.lastX = event.clientX;
        dragStateRef.current.lastY = event.clientY;
        dragStateRef.current.yaw += dx * 0.01;
        dragStateRef.current.pitch = Math.max(
          -1.45,
          Math.min(1.45, dragStateRef.current.pitch + dy * -0.01),
        );
        if (hostInputModeRef.current === 'camera' || hostInputModeRef.current === 'camera+cursor') {
          void nativeHostClient.cameraRotate(dx, dy);
        }
        await pushCamera();
        return;
      }

      if (hostInputModeRef.current === 'cursor' || hostInputModeRef.current === 'camera+cursor') {
        void nativeHostClient.cursor(ndcX, ndcY);
      }

      let selection: SelectionResult | null = null;
      try {
        selection = await rendererClient.requestSelection(viewport, ndcX, ndcY);
      } catch (error) {
        if (!isViewportNotFoundError(error)) {
          console.warn('[NativeViewport] Failed to request selection:', error);
        }
        return;
      }
      if (selection?.hit) {
        setHover(`hit face ${selection.faceIndex ?? '?'}`);
        onSelectionChange?.(selection);
        setBrushCursor({
          visible: true,
          x: coords.overlay.x,
          y: coords.overlay.y,
        });
        if (strokeActiveRef.current) {
          if (event.buttons & 1) {
            onStrokeMove?.(selection);
          }
        }
      } else {
        setHover('no-hit');
        onSelectionChange?.(selection);
        setBrushCursor((previous) => ({ ...previous, visible: false }));
      }
    },
    [onPointerNdcEvent, onSelectionChange, onStrokeMove, processGizmoInteraction, pushCamera, resolvePointerCoordinates],
  );

  const handleClick = React.useCallback(
    async (event: React.MouseEvent<HTMLDivElement>) => {
      if (event.button !== 0 || event.altKey) return;
      const viewport = viewportRef.current;
      if (viewport == null) return;
      const coords = resolvePointerCoordinates(event);
      if (!coords) {
        return;
      }
      const ndcX = coords.ndc.x;
      const ndcY = coords.ndc.y;
      let selection: SelectionResult | null = null;
      try {
        selection = await rendererClient.requestSelection(viewport, ndcX, ndcY);
      } catch (error) {
        if (!isViewportNotFoundError(error)) {
          console.warn('[NativeViewport] Failed to request click selection:', error);
        }
        return;
      }
      onSelectionChange?.(selection);
      if (selection?.hit && !gizmo?.enabled) {
        if (overlayRect) {
          const overlayPoint = ndcToOverlayPoint(overlayRect, { x: ndcX, y: ndcY });
          setBrushCursor({
            visible: true,
            x: overlayPoint.x,
            y: overlayPoint.y,
          });
        }
        onStrokeStart?.(selection);
      }
    },
    [gizmo?.enabled, onSelectionChange, onStrokeStart, overlayRect, resolvePointerCoordinates],
  );

  const handleWheel = React.useCallback(
    async (event: React.WheelEvent<HTMLDivElement>) => {
      event.preventDefault();
      if (hostInputMode === 'camera' || hostInputMode === 'camera+cursor') {
        void nativeHostClient.cameraZoom(event.deltaY);
      }
      dragStateRef.current.distance = Math.max(
        1.25,
        Math.min(25, dragStateRef.current.distance + event.deltaY * 0.01),
      );
      await pushCamera();
    },
    [pushCamera],
  );

  const handleOpenRendererKain = React.useCallback(() => {
    openKainAuthoringSession({
      path: 'crates/k-os-kain/domains/renderer/renderer_surface_pass.kn',
      target: 'spirv',
      domain: 'renderer',
      label: 'Native Renderer Surface Pass',
      description: 'Author native renderer GPU support logic in the crate-owned KAIN renderer domain.',
    });
  }, []);

  return (
    <div
      ref={hostRef}
      className={className}
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        background:
          'radial-gradient(circle at 20% 20%, rgba(56,189,248,0.14), transparent 30%), radial-gradient(circle at 80% 30%, rgba(249,115,22,0.12), transparent 28%), #06090d',
        border: '1px solid rgba(125,211,252,0.12)',
        pointerEvents: captureInput ? 'auto' : 'none',
      }}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onPointerMove={handlePointerMove}
      onWheel={handleWheel}
      onClick={handleClick}
    >
      <BevyTether
        viewportRef={hostRef}
        enabled={available}
        eguiOnly={false}
        debugPanel={false}
        onConnectionChange={setBevyConnected}
      />
      {gizmo?.enabled && gizmoDrawData && (
        <svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${overlayRect?.width || 1} ${overlayRect?.height || 1}`}
          style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
        >
          {Array.from({ length: Math.floor(gizmoDrawData.indices.length / 3) }).map((_, triangleIndex) => {
            const a = gizmoDrawData.indices[triangleIndex * 3];
            const b = gizmoDrawData.indices[triangleIndex * 3 + 1];
            const c = gizmoDrawData.indices[triangleIndex * 3 + 2];
            const vertices = [gizmoDrawData.vertices[a], gizmoDrawData.vertices[b], gizmoDrawData.vertices[c]];
            const color = gizmoDrawData.colors[a] ?? [1, 1, 1, 1];
            const fill = `rgba(${Math.round(color[0] * 255)}, ${Math.round(color[1] * 255)}, ${Math.round(color[2] * 255)}, ${color[3]})`;

            return (
              <polygon
                key={`${triangleIndex}-${a}-${b}-${c}`}
                points={vertices.map(([x, y]) => `${x},${y}`).join(' ')}
                fill={fill}
              />
            );
          })}
        </svg>
      )}
      {brushCursor.visible && (
        <div
          style={{
            position: 'absolute',
            left: brushCursor.x,
            top: brushCursor.y,
            width: 18,
            height: 18,
            borderRadius: '50%',
            border: '2px solid rgba(125, 211, 252, 0.9)',
            boxShadow: '0 0 0 1px rgba(3, 7, 18, 0.95), 0 0 20px rgba(56, 189, 248, 0.35)',
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none',
            zIndex: 25,
          }}
        />
      )}
      {showDiagnostics && (
        <div
          style={{
            position: 'absolute',
            top: 14,
            left: 14,
            zIndex: 30,
            minWidth: 280,
            padding: '18px 20px',
            borderRadius: 14,
            background: 'rgba(8, 12, 18, 0.72)',
            border: '1px solid rgba(125, 211, 252, 0.18)',
            boxShadow: '0 18px 60px rgba(0,0,0,0.35)',
            color: '#dbeafe',
            fontFamily: '"IBM Plex Mono", Consolas, monospace',
            fontSize: 12,
            lineHeight: 1.55,
            backdropFilter: 'blur(14px)',
          }}
        >
          <div style={{ color: '#7dd3fc', fontWeight: 700, marginBottom: 8 }}>
            NATIVE VIEWPORT SESSION
          </div>
          <div style={{ marginBottom: 8 }}>
            <BevyConnectionBadge connected={bevyConnected} />
          </div>
          <div>status: {status}</div>
          <div>tauri: {available ? 'online' : 'offline'}</div>
          <div>viewport: {viewportRef.current ?? 'pending'}</div>
          <div>mesh: {meshHandle ?? 'none'}</div>
          <div>draws: {stats?.drawCalls ?? 0}</div>
          <div>fps: {stats?.fps?.toFixed(1) ?? '0.0'}</div>
          <div>frame: {stats?.frameTimeMs?.toFixed(2) ?? '0.00'} ms</div>
          <div>mesh sync: {stats?.meshSyncTimeMs?.toFixed(2) ?? '0.00'} ms</div>
          <div>pick latency: {stats?.selectionLatencyMs?.toFixed(2) ?? '0.00'} ms</div>
          <div>gpu upload: {stats?.gpuUploadBytes ?? 0} B</div>
          <div>gpu memory: {stats?.gpuMemoryBytes ?? 0} B</div>
          <div>pick: {hover}</div>
          <button
            onClick={handleOpenRendererKain}
            style={{
              marginTop: 10,
              padding: '6px 10px',
              borderRadius: 8,
              border: '1px solid rgba(192,132,252,0.35)',
              background: 'rgba(168,85,247,0.14)',
              color: '#e9d5ff',
              cursor: 'pointer',
              fontFamily: '"IBM Plex Mono", Consolas, monospace',
              fontSize: 11,
            }}
          >
            KAIN RENDERER IDE
          </button>
        </div>
      )}
    </div>
  );
}
