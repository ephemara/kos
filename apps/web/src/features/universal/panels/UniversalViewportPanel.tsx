import React from 'react';
import { Activity, AlertTriangle, Box, MousePointerClick, RefreshCw, type LucideIcon } from 'lucide-react';
import type { NativeViewportSyncSource } from '@/services/nativeViewportBridge';
import { useRegisterSharedViewport } from '@/features/viewport/sharedViewportSession';
import { useViewportStore } from '@/state/stores/viewportStore';
import {
  UNIVERSAL_DEFAULT_PRIMITIVE_ID,
  UNIVERSAL_VIEWPORT_OWNER_ID,
} from '../universalAppSurface';

type UniversalViewportPanelProps = {
  panelId: string;
  sharedState: {
    artifact?: Blob | null;
    status?: string;
    storage?: unknown[];
  };
};

export function UniversalViewportPanel({ panelId, sharedState }: UniversalViewportPanelProps) {
  const runtimePhase = useViewportStore((state) => state.runtimePhase);
  const runtimeStatus = useViewportStore((state) => state.runtimeStatus);
  const nativeAvailabilityChecked = useViewportStore((state) => state.nativeAvailabilityChecked);
  const nativeAvailable = useViewportStore((state) => state.nativeAvailable);
  const activeRequest = useViewportStore((state) => state.activeRequest);
  const frameStats = useViewportStore((state) => state.frameStats);
  const selection = useViewportStore((state) => state.selection);

  const syncSource = React.useMemo<NativeViewportSyncSource>(() => {
    if (sharedState?.artifact) {
      return { kind: 'artifact-blob', blob: sharedState.artifact };
    }

    return { kind: 'primitive', primitiveId: UNIVERSAL_DEFAULT_PRIMITIVE_ID };
  }, [sharedState?.artifact]);

  const sharedViewportRequest = React.useMemo(
    () => ({
      ownerId: UNIVERSAL_VIEWPORT_OWNER_ID,
      meshHandle: null,
      syncSource,
      captureInput: true,
      hostInputMode: 'camera' as const,
      showDiagnostics: false,
    }),
    [syncSource],
  );

  useRegisterSharedViewport(sharedViewportRequest);

  const sourceLabel = syncSource.kind === 'artifact-blob'
    ? 'SOURCE: KERNEL ARTIFACT'
    : `SOURCE: ${UNIVERSAL_DEFAULT_PRIMITIVE_ID.toUpperCase()} PREVIEW`;

  const showDiagnostics = !nativeAvailabilityChecked
    || !nativeAvailable
    || runtimePhase === 'failed'
    || runtimePhase === 'unavailable';

  const statusToneClass = showDiagnostics
    ? 'border-amber-500/30 bg-amber-500/10 text-amber-200'
    : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200';

  const diagnosticsCopy = !nativeAvailabilityChecked
    ? 'Probing the native viewport bridge.'
    : !nativeAvailable
      ? 'Universal viewport needs the desktop shell. Open this workspace through Tauri to attach the renderer.'
      : runtimePhase === 'failed'
        ? 'The renderer bridge attached but the viewport session failed. Check the desktop logs and restart the session.'
        : 'The native viewport is unavailable on this runtime.';

  return (
    <div className="relative h-full w-full overflow-hidden bg-transparent pointer-events-none">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_58%)] opacity-70" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,7,12,0.08),rgba(5,7,12,0.32))]" />

      <div className="absolute left-4 top-4 flex flex-wrap gap-2">
        <div className="rounded-full border border-white/10 bg-black/35 px-3 py-1 text-[9px] font-black tracking-[0.18em] text-white/75 backdrop-blur-md">
          UNIVERSAL VIEWPORT
        </div>
        <div className="rounded-full border border-sky-400/20 bg-sky-500/10 px-3 py-1 text-[9px] font-black tracking-[0.18em] text-sky-200 backdrop-blur-md">
          {sourceLabel}
        </div>
      </div>

      <div className="absolute right-4 top-4 w-[280px] rounded-2xl border border-white/10 bg-black/45 p-4 backdrop-blur-md">
        <div className="mb-2 flex items-center gap-2 text-[10px] font-black tracking-[0.18em] text-white/65">
          <Activity size={12} />
          RUNTIME
        </div>
        <div className={`inline-flex rounded-full border px-2.5 py-1 text-[9px] font-black tracking-[0.18em] ${statusToneClass}`}>
          {runtimeStatus}
        </div>
        <div className="mt-3 text-[10px] leading-relaxed text-white/50">
          {activeRequest?.ownerId === UNIVERSAL_VIEWPORT_OWNER_ID
            ? 'Universal owns the shared native viewport session.'
            : 'Waiting for the Universal viewport request to become active.'}
        </div>
        <div className="mt-2 text-[10px] text-white/35">
          PANEL: {panelId.slice(0, 8).toUpperCase()}
        </div>
      </div>

      <div className="absolute bottom-4 left-4 flex gap-2">
        <HudCard
          icon={RefreshCw}
          label="PHASE"
          value={runtimePhase.toUpperCase()}
        />
        <HudCard
          icon={Box}
          label="ARTIFACTS"
          value={String(sharedState?.storage?.length ?? 0)}
        />
      </div>

      <div className="absolute bottom-4 right-4 flex gap-2">
        <HudCard
          icon={Activity}
          label="FRAME"
          value={frameStats ? `${Math.round(frameStats.frameTimeMs)}ms` : 'WAITING'}
        />
        <HudCard
          icon={MousePointerClick}
          label="SELECTION"
          value={selection?.meshHandle != null ? String(selection.meshHandle) : 'NONE'}
        />
      </div>

      {showDiagnostics && (
        <div className="absolute inset-0 flex items-center justify-center px-6">
          <div className="w-full max-w-[480px] rounded-3xl border border-amber-500/20 bg-[#090b10]/82 p-6 text-center backdrop-blur-xl">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-500/30 bg-amber-500/12 text-amber-200">
              <AlertTriangle size={24} />
            </div>
            <div className="text-[11px] font-black tracking-[0.22em] text-amber-100">
              NATIVE VIEWPORT DIAGNOSTICS
            </div>
            <div className="mt-3 text-[11px] leading-relaxed text-white/55">
              {diagnosticsCopy}
            </div>
            <div className="mt-4 rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-left text-[10px] text-white/45">
              <div>STATUS: {runtimeStatus}</div>
              <div>PHASE: {runtimePhase.toUpperCase()}</div>
              <div>REQUEST: {activeRequest?.ownerId ?? 'NONE'}</div>
              <div>KERNEL: {sharedState?.status ?? 'IDLE'}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function HudCard({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/45 px-3 py-2 backdrop-blur-md">
      <div className="mb-1 flex items-center gap-2 text-[8px] font-black tracking-[0.18em] text-white/35">
        <Icon size={11} />
        {label}
      </div>
      <div className="text-[11px] font-black text-white/75">
        {value}
      </div>
    </div>
  );
}
