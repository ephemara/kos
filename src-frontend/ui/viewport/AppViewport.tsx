import React from 'react';
import { NativeViewport } from '@/features/viewport/NativeViewport';
import { viewportClient } from '@/services/viewportClient';
import { useSharedViewportSession } from '@/features/viewport/sharedViewportSession';

const isTauri = (): boolean =>
  typeof window !== 'undefined' && '__TAURI__' in window;

export function AppViewport() {
  const { request } = useSharedViewportSession();
  const [nativeAvailable, setNativeAvailable] = React.useState(false);
  const [checkedAvailability, setCheckedAvailability] = React.useState(false);

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
    if (!request?.onStatusChange || !checkedAvailability || nativeAvailable) {
      return;
    }
    request.onStatusChange('NATIVE VIEWPORT UNAVAILABLE');
  }, [checkedAvailability, nativeAvailable, request]);

  if (!request) {
    return null;
  }

  if (!checkedAvailability) {
    return <div className="w-full h-full bg-[#06090d]" />;
  }

  if (nativeAvailable) {
    return (
      <NativeViewport
        meshHandle={request.meshHandle}
        onStatusChange={request.onStatusChange}
        onViewportHandleChange={request.onViewportHandleChange}
        useSculptHandle={request.useSculptHandle}
        syncSource={request.syncSource}
        captureInput={request.captureInput}
        hostInputMode={request.hostInputMode}
        showDiagnostics={request.showDiagnostics}
        onPointerNdcEvent={request.onPointerNdcEvent}
        onSelectionChange={request.onSelectionChange}
        onStrokeStart={request.onStrokeStart}
        onStrokeMove={request.onStrokeMove}
        onStrokeEnd={request.onStrokeEnd}
        gizmo={request.gizmo}
      />
    );
  }

  return <div className="w-full h-full bg-[#06090d]" />;
}
