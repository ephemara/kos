import React from 'react';
import { NativeViewport } from '@/features/viewport/NativeViewport';
import type { FrameStats, RenderMeshHandle, SelectionResult, ViewportHandle } from '@/services/viewportClient';
import { viewportClient } from '@/services/viewportClient';
import { useSharedViewportSession } from '@/features/viewport/sharedViewportSession';
import { useViewportStore } from '@/state/stores/viewportStore';

const isTauri = (): boolean =>
  typeof window !== 'undefined' && '__TAURI__' in window;

export function AppViewport() {
  const { request } = useSharedViewportSession();
  const [nativeAvailable, setNativeAvailable] = React.useState(false);
  const [checkedAvailability, setCheckedAvailability] = React.useState(false);
  const setNativeAvailability = useViewportStore((state) => state.setNativeAvailability);
  const setRuntimeStatus = useViewportStore((state) => state.setRuntimeStatus);
  const setViewportHandle = useViewportStore((state) => state.setViewportHandle);
  const setRenderMeshHandle = useViewportStore((state) => state.setRenderMeshHandle);
  const setFrameStats = useViewportStore((state) => state.setFrameStats);
  const setSelection = useViewportStore((state) => state.setSelection);

  React.useEffect(() => {
    let cancelled = false;

    const probe = async () => {
      if (!isTauri()) {
        if (!cancelled) {
          setNativeAvailable(false);
          setCheckedAvailability(true);
        }
        return;
      }

      const available = await viewportClient.isAvailable();
      if (!cancelled) {
        setNativeAvailable(available);
        setCheckedAvailability(true);
      }
    };

    void probe();

    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    if (!checkedAvailability) {
      return;
    }
    setNativeAvailability(nativeAvailable, true);
    if (!nativeAvailable) {
      setRuntimeStatus('NATIVE VIEWPORT UNAVAILABLE');
      request?.onStatusChange?.('NATIVE VIEWPORT UNAVAILABLE');
    }
  }, [checkedAvailability, nativeAvailable, request, setNativeAvailability, setRuntimeStatus]);

  const instrumentedRequest = React.useMemo(() => {
    if (!request) {
      return null;
    }

    return {
      ...request,
      onStatusChange: (status: string) => {
        setRuntimeStatus(status);
        request.onStatusChange?.(status);
      },
      onViewportHandleChange: (viewport: ViewportHandle | null) => {
        setViewportHandle(viewport);
        if (viewport == null) {
          setRenderMeshHandle(null);
          setFrameStats(null);
          setSelection(null);
        }
        request.onViewportHandleChange?.(viewport);
      },
      onRenderMeshHandleChange: (renderMeshHandle: RenderMeshHandle | null) => {
        setRenderMeshHandle(renderMeshHandle);
        request.onRenderMeshHandleChange?.(renderMeshHandle);
      },
      onStatsChange: (stats: FrameStats | null) => {
        setFrameStats(stats);
        request.onStatsChange?.(stats);
      },
      onSelectionChange: (selection: SelectionResult | null) => {
        setSelection(selection);
        request.onSelectionChange?.(selection);
      },
    };
  }, [
    request,
    setFrameStats,
    setRenderMeshHandle,
    setRuntimeStatus,
    setSelection,
    setViewportHandle,
  ]);

  if (!instrumentedRequest) {
    return null;
  }

  if (!checkedAvailability) {
    return <div className="w-full h-full bg-[#06090d]" />;
  }

  if (nativeAvailable) {
    return (
      <NativeViewport
        meshHandle={instrumentedRequest.meshHandle}
        onStatusChange={instrumentedRequest.onStatusChange}
        onViewportHandleChange={instrumentedRequest.onViewportHandleChange}
        onRenderMeshHandleChange={instrumentedRequest.onRenderMeshHandleChange}
        onStatsChange={instrumentedRequest.onStatsChange}
        useSculptHandle={instrumentedRequest.useSculptHandle}
        syncSource={instrumentedRequest.syncSource}
        captureInput={instrumentedRequest.captureInput}
        hostInputMode={instrumentedRequest.hostInputMode}
        showDiagnostics={instrumentedRequest.showDiagnostics}
        onPointerNdcEvent={instrumentedRequest.onPointerNdcEvent}
        onSelectionChange={instrumentedRequest.onSelectionChange}
        onStrokeStart={instrumentedRequest.onStrokeStart}
        onStrokeMove={instrumentedRequest.onStrokeMove}
        onStrokeEnd={instrumentedRequest.onStrokeEnd}
        gizmo={instrumentedRequest.gizmo}
      />
    );
  }

  return <div className="w-full h-full bg-[#06090d]" />;
}
