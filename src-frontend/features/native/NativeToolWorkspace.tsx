import React from 'react';
import { CircleDot, Database, Orbit, PanelsTopLeft, ScanSearch } from 'lucide-react';
import { AppShell } from '@/ui/shell/AppShell';
import { AppMenuBar } from '@/ui/shell/AppMenuBar';
import type { DockTab } from '@/ui/shell/DockPanel';
import type { NativeViewportSyncSource } from '@/services/nativeViewportBridge';
import { useViewportStore } from '@/state/stores/viewportStore';
import {
    getTauriAdapterManifest,
    listTauriIntegrationContracts,
} from '@/services/workspaceRegistryClient';
import {
    NATIVE_TOOL_MODULES,
    type NativeToolModuleConfig,
    type NativeToolModuleId,
    type NativeToolSection,
} from '@/config/nativeToolModules';
import { useRegisterSharedViewport } from '@/features/viewport/sharedViewportSession';

type NativeToolWorkspaceProps = {
    moduleId: NativeToolModuleId;
    sharedState?: {
        artifact?: Blob | null;
        materials?: unknown[];
        alphas?: unknown[];
        storage?: unknown[];
        status?: string;
    };
};

function SectionBlock({ section }: { section: NativeToolSection }) {
    return (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
            <div className="mb-2 text-[9px] font-black tracking-[0.18em] text-white/70">{section.title}</div>
            <div className="space-y-1">
                {section.lines.map((line) => (
                    <div key={line} className="text-[10px] leading-relaxed text-white/45">
                        {line}
                    </div>
                ))}
            </div>
        </div>
    );
}

function TabPanel({ sections }: { sections: NativeToolSection[] }) {
    return (
        <div className="space-y-3 p-3">
            {sections.map((section) => (
                <SectionBlock key={section.title} section={section} />
            ))}
        </div>
    );
}

function WorkspaceTopBar({
    module,
    sourceLabel,
    viewportStatus,
}: {
    module: NativeToolModuleConfig;
    sourceLabel: string;
    viewportStatus: string;
}) {
    return (
        <div className="flex h-11 items-center gap-3 border-b border-white/[0.06] bg-[#090b10]/95 px-3">
            <div className={`rounded-lg border px-2.5 py-1 text-[9px] font-black tracking-[0.22em] ${module.accent.bg} ${module.accent.border} ${module.accent.text}`}>
                {module.title}
            </div>
            <div className="text-[10px] text-white/35">{module.subtitle}</div>
            <div className="ml-auto flex items-center gap-2">
                <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-2 py-1 text-[9px] text-white/45">
                    {sourceLabel}
                </div>
                <div className={`rounded-lg border px-2 py-1 text-[9px] ${module.accent.border} ${module.accent.text}`}>
                    {viewportStatus}
                </div>
            </div>
        </div>
    );
}

function buildTabs(tabConfigs: NativeToolModuleConfig['leftTabs']): DockTab[] {
    return tabConfigs.map((tab) => ({
        id: tab.id,
        label: tab.label,
        icon: tab.icon,
        content: <TabPanel sections={tab.sections} />,
    }));
}

function buildSyncSource(module: NativeToolModuleConfig, artifact?: Blob | null): NativeViewportSyncSource {
    if (artifact) {
        return { kind: 'artifact-blob', blob: artifact };
    }
    return { kind: 'primitive', primitiveId: module.defaultPrimitive };
}

function NativeViewportOverlay({
    module,
    sourceLabel,
    sharedState,
}: {
    module: NativeToolModuleConfig;
    sourceLabel: string;
    sharedState: NativeToolWorkspaceProps['sharedState'];
}) {
    const [tauriPackageCount, setTauriPackageCount] = React.useState<number | null>(null);
    const [topPackages, setTopPackages] = React.useState<
        Array<{ packageName: string; stabilityTier: string; entrypoint: string | null }>
    >([]);

    React.useEffect(() => {
        let isMounted = true;

        void Promise.all([
            getTauriAdapterManifest(),
            listTauriIntegrationContracts(),
        ]).then(([adapterManifest, contracts]) => {
            if (!isMounted) {
                return;
            }

            setTauriPackageCount(adapterManifest?.package_count ?? null);
            setTopPackages(
                contracts.slice(0, 4).map((contract) => ({
                    packageName: contract.package_name,
                    stabilityTier: contract.stability_tier,
                    entrypoint: contract.recommended_entrypoints[0] ?? null,
                })),
            );
        });

        return () => {
            isMounted = false;
        };
    }, []);

    const stats = [
        { label: 'ARTIFACTS', value: String(sharedState?.storage?.length ?? 0), icon: Database },
        { label: 'MATERIALS', value: String(sharedState?.materials?.length ?? 0), icon: Orbit },
        { label: 'ALPHAS', value: String(sharedState?.alphas?.length ?? 0), icon: ScanSearch },
    ];

    return (
        <div className="pointer-events-none relative h-full w-full bg-transparent">
            <div className="absolute left-5 top-5 flex flex-wrap gap-2">
                {module.centerBadges.map((badge) => (
                    <div
                        key={badge}
                        className={`rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.18em] ${module.accent.bg} ${module.accent.border} ${module.accent.text}`}
                    >
                        {badge}
                    </div>
                ))}
            </div>

            <div className="absolute right-5 top-5 w-[320px] rounded-2xl border border-white/[0.08] bg-black/45 p-4 backdrop-blur-md">
                <div className={`mb-2 text-[11px] font-black tracking-[0.18em] ${module.accent.text}`}>{module.title}</div>
                <div className="text-[10px] leading-relaxed text-white/55">
                    Fresh-start native workspace. This module is now an overlay shell over the universal viewport host.
                </div>
                <div className="mt-3 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-[9px] text-white/45">
                    {sourceLabel}
                </div>
            </div>

            <div className="absolute bottom-5 left-5 grid w-[420px] grid-cols-3 gap-2">
                {stats.map(({ label, value, icon: Icon }) => (
                    <div key={label} className="rounded-xl border border-white/[0.08] bg-black/45 px-3 py-2 backdrop-blur-md">
                        <div className="mb-1 flex items-center gap-2 text-[8px] font-black tracking-[0.18em] text-white/35">
                            <Icon size={11} />
                            {label}
                        </div>
                        <div className="text-[11px] font-black text-white/75">{value}</div>
                    </div>
                ))}
            </div>

            <div className="absolute bottom-5 right-5 w-[300px] rounded-2xl border border-white/[0.08] bg-black/45 p-4 backdrop-blur-md">
                <div className="mb-2 flex items-center gap-2 text-[9px] font-black tracking-[0.18em] text-white/55">
                    <PanelsTopLeft size={12} />
                    TAURI ADAPTER MANIFEST
                </div>
                <div className="mb-3 text-[10px] text-white/45">
                    {tauriPackageCount === null
                        ? 'Tauri registry unavailable. Falling back to static shell metadata.'
                        : `Live Tauri adapter manifest loaded with ${tauriPackageCount} integration-visible packages.`}
                </div>
                <div className="space-y-2">
                    {topPackages.length === 0 ? (
                        <div className="text-[10px] text-white/35">
                            Waiting for registry-backed package surface…
                        </div>
                    ) : (
                        topPackages.map((pkg) => (
                            <div
                                key={pkg.packageName}
                                className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2"
                            >
                                <div className="flex items-center justify-between gap-2 text-[10px] font-black text-white/75">
                                    <span>{pkg.packageName}</span>
                                    <span className="uppercase text-white/35">{pkg.stabilityTier}</span>
                                </div>
                                <div className="mt-1 text-[9px] text-white/40">
                                    {pkg.entrypoint ?? 'No recommended entrypoint yet'}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            <div className="absolute inset-0 flex items-center justify-center">
                <div className="rounded-full border border-white/[0.08] bg-black/35 px-5 py-3 backdrop-blur-sm">
                    <div className={`flex items-center gap-2 text-[10px] font-black tracking-[0.24em] ${module.accent.text}`}>
                        <CircleDot size={12} />
                        {sourceLabel}
                    </div>
                </div>
            </div>
        </div>
    );
}

export function NativeToolWorkspace({ moduleId, sharedState }: NativeToolWorkspaceProps) {
    const module = NATIVE_TOOL_MODULES[moduleId];
    const viewportStatus = useViewportStore((state) =>
        state.activeRequest?.ownerId === moduleId ? state.runtimeStatus : 'NATIVE VIEWPORT STAGED',
    );

    const syncSource = React.useMemo(
        () => buildSyncSource(module, sharedState?.artifact ?? null),
        [module, sharedState?.artifact],
    );

    const sharedViewportRequest = React.useMemo(
        () => ({
            ownerId: module.id,
            meshHandle: null,
            syncSource,
            captureInput: true,
            hostInputMode: 'camera' as const,
            showDiagnostics: false,
        }),
        [module.id, syncSource],
    );

    useRegisterSharedViewport(sharedViewportRequest);

    const sourceLabel = sharedState?.artifact
        ? 'SOURCE: KERNEL ARTIFACT'
        : `SOURCE: NATIVE ${module.defaultPrimitive.toUpperCase()}`;

    return (
        <AppShell
            layoutKey={`native-${module.id}`}
            className="bg-[#05070c] text-gray-200"
            centerTransparent
            menuBar={
                <AppMenuBar
                    menus={[
                        {
                            label: 'Viewport',
                            items: [
                                { label: 'Native Renderer Locked', disabled: true },
                                { label: sourceLabel, disabled: true },
                            ],
                        },
                        {
                            label: 'Module',
                            items: [{ label: `${module.title} Fresh Start`, disabled: true }],
                        },
                    ]}
                />
            }
            menuBarDefaultOpen={false}
            topBar={<WorkspaceTopBar module={module} sourceLabel={sourceLabel} viewportStatus={viewportStatus} />}
            left={{ title: module.title, defaultSize: 22, minSize: 14, collapsedSize: 4, tabs: buildTabs(module.leftTabs) }}
            right={{ title: 'PIPELINE', defaultSize: 22, minSize: 14, collapsedSize: 4, tabs: buildTabs(module.rightTabs) }}
            bottomTabs={buildTabs(module.bottomTabs)}
            bottomTitle="STATUS"
            bottomHeight={20}
        >
            <NativeViewportOverlay module={module} sourceLabel={sourceLabel} sharedState={sharedState} />
        </AppShell>
    );
}
