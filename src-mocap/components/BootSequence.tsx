import React from 'react';
import { Terminal, Hexagon, ChevronRight, Settings, AlertTriangle, CheckCircle2 } from 'lucide-react';

export type BootSequenceProps = {
    hasApiKey: boolean;
    kernelStatus: string;
    kernelArtifactCount: number;
    kernelMaterialCount: number;
    kernelAlphaCount: number;
    onOpenSettings: () => void;
    onComplete: () => void;
    setKernelStatus: React.Dispatch<React.SetStateAction<string>>;
};

type BootStep = {
    id: string;
    label: string;
    accentClass: string;
    durationMs: number;
    run?: () => Promise<{ ok: boolean; detail?: string }>;
};

function sleep(ms: number) {
    return new Promise<void>((r) => setTimeout(r, ms));
}

function getWebglInfo(): { ok: boolean; detail: string; renderer?: string; vendor?: string } {
    try {
        const canvas = document.createElement('canvas');
        const gl = (canvas.getContext('webgl2') || canvas.getContext('webgl')) as WebGLRenderingContext | WebGL2RenderingContext | null;
        if (!gl) {
            return { ok: false, detail: 'WebGL unavailable' };
        }
        const dbg = gl.getExtension('WEBGL_debug_renderer_info') as any;
        const vendor = dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : 'Unknown';
        const renderer = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : 'Unknown';
        return { ok: true, detail: 'WebGL online', vendor, renderer };
    } catch {
        return { ok: false, detail: 'WebGL init error' };
    }
}

const BootSequence: React.FC<BootSequenceProps> = ({
    hasApiKey,
    kernelStatus,
    kernelArtifactCount,
    kernelMaterialCount,
    kernelAlphaCount,
    onOpenSettings,
    onComplete,
    setKernelStatus,
}) => {
    const [diagOpen, setDiagOpen] = React.useState(false);
    const [stepIndex, setStepIndex] = React.useState(0);
    const [stepResults, setStepResults] = React.useState<Record<string, { ok: boolean; detail?: string }>>({});
    const [webglInfo, setWebglInfo] = React.useState<{ ok: boolean; detail: string; renderer?: string; vendor?: string } | null>(null);
    const [done, setDone] = React.useState(false);

    const completedRef = React.useRef(false);
    const safeComplete = React.useCallback(() => {
        if (completedRef.current) return;
        completedRef.current = true;
        onComplete();
    }, [onComplete]);

    const steps = React.useMemo<BootStep[]>(() => {
        return [
            {
                id: 'post',
                label: 'POWER-ON SELF TEST',
                accentClass: 'text-[#00ffcc]',
                durationMs: 350,
                run: async () => ({ ok: true, detail: 'OK' }),
            },
            {
                id: 'gpu',
                label: 'GPU CONTEXT',
                accentClass: 'text-teal-400',
                durationMs: 650,
                run: async () => {
                    const info = getWebglInfo();
                    setWebglInfo(info);
                    return { ok: info.ok, detail: info.detail };
                },
            },
            {
                id: 'kernel',
                label: 'KERNEL LINK',
                accentClass: 'text-cyan-400',
                durationMs: 700,
                run: async () => {
                    setKernelStatus('KERNEL LINKED');
                    return { ok: true, detail: kernelStatus || 'OK' };
                },
            },
            {
                id: 'storage',
                label: 'STORAGE INDEX',
                accentClass: 'text-emerald-400',
                durationMs: 600,
                run: async () => {
                    const total = kernelArtifactCount + kernelMaterialCount + kernelAlphaCount;
                    return { ok: true, detail: `${total} objects indexed` };
                },
            },
            {
                id: 'uplink',
                label: 'API UPLINK',
                accentClass: 'text-violet-400',
                durationMs: 650,
                run: async () => {
                    return hasApiKey ? { ok: true, detail: 'Connected' } : { ok: false, detail: 'No key' };
                },
            },
            {
                id: 'modules',
                label: 'MODULE REGISTRY',
                accentClass: 'text-rose-400',
                durationMs: 500,
                run: async () => ({ ok: true, detail: 'Ready' }),
            },
        ];
    }, [hasApiKey, kernelAlphaCount, kernelArtifactCount, kernelMaterialCount, kernelStatus, setKernelStatus]);

    const totalSteps = steps.length;
    const progress = totalSteps ? Math.min(1, stepIndex / totalSteps) : 0;

    React.useEffect(() => {
        let cancelled = false;

        const run = async () => {
            for (let i = 0; i < steps.length; i++) {
                if (cancelled) return;
                setStepIndex(i);
                const step = steps[i];

                const t0 = performance.now();
                let result: { ok: boolean; detail?: string } = { ok: true };
                try {
                    result = step.run ? await step.run() : { ok: true };
                } catch (e: any) {
                    result = { ok: false, detail: e?.message ? String(e.message) : 'Error' };
                }

                if (cancelled) return;
                setStepResults((prev) => ({ ...prev, [step.id]: result }));

                const elapsed = performance.now() - t0;
                const remaining = step.durationMs - elapsed;
                if (remaining > 0) {
                    await sleep(remaining);
                }
            }

            if (cancelled) return;
            setDone(true);
            await sleep(250);
            if (cancelled) return;
            safeComplete();
        };

        run();
        return () => {
            cancelled = true;
        };
    }, [safeComplete, steps]);

    React.useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                safeComplete();
            }
            if (e.key.toLowerCase() === 'd') {
                setDiagOpen((v) => !v);
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [safeComplete]);

    const activeStep = steps[stepIndex];
    const showApiWarning = !hasApiKey;

    return (
        <div className="relative w-screen h-screen text-[#e0e0e0] font-mono overflow-hidden" style={{ backgroundColor: '#000000' }}>
            <div className="absolute inset-0 pointer-events-none opacity-80" style={{
                backgroundImage: 'radial-gradient(circle at 35% 35%, rgba(0,255,204,0.10), transparent 55%), radial-gradient(circle at 70% 60%, rgba(168,85,247,0.10), transparent 55%)',
            }} />
            <div className="absolute inset-0 pointer-events-none" style={{
                backgroundImage: 'linear-gradient(to bottom, rgba(255,255,255,0.06), transparent 15%, transparent 85%, rgba(0,255,204,0.06))',
            }} />
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#00ffcc]/30 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-purple-500/20 to-transparent" />

            <div className="absolute left-6 top-6 flex items-center gap-3">
                <div className="relative">
                    <div className="absolute inset-0 bg-[#00ffcc]/25 blur-xl" />
                    <Hexagon size={22} className="relative text-[#00ffcc] fill-[#00ffcc]/10" />
                </div>
                <div className="leading-none">
                    <div className="text-[12px] font-black tracking-[0.35em] text-white">K_OS</div>
                    <div className="text-[10px] text-gray-500 tracking-widest">SECURE BOOT</div>
                </div>
            </div>

            <div className="absolute right-6 top-6 flex items-center gap-2">
                <button
                    onClick={onOpenSettings}
                    className="h-9 px-3 rounded-md border border-white/10 bg-white/5 hover:bg-white/10 text-[11px] font-black tracking-wide text-gray-200 flex items-center gap-2"
                >
                    <Settings size={14} /> SETTINGS
                </button>
                <button
                    onClick={safeComplete}
                    className="h-9 px-3 rounded-md border border-white/10 bg-white/5 hover:bg-white/10 text-[11px] font-black tracking-wide text-gray-200 flex items-center gap-2"
                >
                    <ChevronRight size={14} /> SKIP
                </button>
            </div>

            <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-[860px] max-w-[92vw]">
                    <div className="rounded-2xl border border-white/10 bg-[#050505]/70 backdrop-blur-xl shadow-2xl overflow-hidden">
                        <div className="p-6 border-b border-white/10">
                            <div className="flex items-start justify-between gap-6">
                                <div className="min-w-0">
                                    <div className="flex items-center gap-3">
                                        <Terminal size={20} className="text-[#00ffcc]" />
                                        <div className="text-[12px] font-black tracking-[0.25em] text-white">BOOT SEQUENCE</div>
                                    </div>
                                    <div className="mt-2 text-[10px] text-gray-500 tracking-wider">
                                        {activeStep ? (
                                            <span>
                                                STAGE: <span className={activeStep.accentClass}>{activeStep.label}</span>
                                            </span>
                                        ) : (
                                            <span>STAGE: FINALIZING</span>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 shrink-0">
                                    <div className="text-[10px] text-gray-500 font-black tracking-widest">KERNEL</div>
                                    <div className="text-[10px] px-2 py-1 rounded bg-white/5 border border-white/10 text-gray-200 font-mono">
                                        {kernelStatus}
                                    </div>
                                    <div className={`w-2 h-2 rounded-full ${done ? 'bg-[#00ffcc]' : 'bg-white/20'} shadow-[0_0_12px_rgba(0,255,204,0.25)]`} />
                                </div>
                            </div>

                            <div className="mt-5">
                                <div className="h-2 rounded-full bg-white/5 border border-white/10 overflow-hidden">
                                    <div
                                        className="h-full bg-gradient-to-r from-[#00ffcc] via-teal-400 to-purple-500 transition-all duration-500"
                                        style={{ width: `${Math.round(progress * 100)}%` }}
                                    />
                                </div>
                                <div className="mt-2 flex items-center justify-between text-[10px] text-gray-500">
                                    <div className="font-black tracking-widest">{Math.round(progress * 100)}%</div>
                                    <div className="font-mono">ESC = SKIP • D = DIAGNOSTICS</div>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-12">
                            <div className="col-span-7 p-6 border-r border-white/10">
                                <div className="text-[10px] font-black tracking-[0.25em] text-gray-300 mb-3">PRE-FLIGHT</div>
                                <div className="space-y-2">
                                    {steps.map((s, idx) => {
                                        const res = stepResults[s.id];
                                        const isActive = idx === stepIndex;
                                        const isDone = idx < stepIndex || (idx === stepIndex && Boolean(res));
                                        const ok = res?.ok;

                                        return (
                                            <div
                                                key={s.id}
                                                className={
                                                    `flex items-center justify-between gap-3 rounded-lg border px-3 py-2 ` +
                                                    `${isActive ? 'bg-white/5 border-white/15' : 'bg-black/30 border-white/10'}`
                                                }
                                            >
                                                <div className="min-w-0 flex items-center gap-2">
                                                    <div className={`text-[10px] font-black tracking-widest ${s.accentClass}`}>{String(idx + 1).padStart(2, '0')}</div>
                                                    <div className="min-w-0">
                                                        <div className={`text-[11px] font-black tracking-wide ${isDone ? 'text-gray-100' : 'text-gray-500'}`}>{s.label}</div>
                                                        {res?.detail ? <div className="text-[10px] text-gray-600 truncate">{res.detail}</div> : null}
                                                    </div>
                                                </div>
                                                <div className="shrink-0">
                                                    {isActive && !res ? (
                                                        <div className="text-[10px] text-gray-500 font-black tracking-widest">…</div>
                                                    ) : ok === true ? (
                                                        <CheckCircle2 size={16} className="text-[#00ffcc]" />
                                                    ) : ok === false ? (
                                                        <AlertTriangle size={16} className="text-yellow-500" />
                                                    ) : (
                                                        <div className="w-4 h-4" />
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {showApiWarning ? (
                                    <div className="mt-4 rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-3">
                                        <div className="flex items-center gap-2 text-[11px] font-black tracking-wide text-yellow-200">
                                            <AlertTriangle size={14} /> API KEY NOT CONNECTED
                                        </div>
                                        <div className="mt-1 text-[10px] text-yellow-200/70">
                                            Continue anyway, or open Settings to uplink.
                                        </div>
                                    </div>
                                ) : null}
                            </div>

                            <div className="col-span-5 p-6">
                                <div className="flex items-center justify-between">
                                    <div className="text-[10px] font-black tracking-[0.25em] text-gray-300">SESSION</div>
                                    <button
                                        onClick={() => setDiagOpen((v) => !v)}
                                        className="text-[10px] font-black tracking-widest text-gray-500 hover:text-gray-200"
                                    >
                                        {diagOpen ? 'HIDE' : 'SHOW'} DIAGNOSTICS
                                    </button>
                                </div>

                                <div className="mt-3 grid grid-cols-3 gap-2">
                                    <div className="rounded-lg border border-white/10 bg-black/30 p-3">
                                        <div className="text-[10px] text-gray-500 font-black tracking-widest">ART</div>
                                        <div className="mt-1 text-[14px] font-black text-white">{kernelArtifactCount}</div>
                                    </div>
                                    <div className="rounded-lg border border-white/10 bg-black/30 p-3">
                                        <div className="text-[10px] text-gray-500 font-black tracking-widest">MAT</div>
                                        <div className="mt-1 text-[14px] font-black text-white">{kernelMaterialCount}</div>
                                    </div>
                                    <div className="rounded-lg border border-white/10 bg-black/30 p-3">
                                        <div className="text-[10px] text-gray-500 font-black tracking-widest">ALP</div>
                                        <div className="mt-1 text-[14px] font-black text-white">{kernelAlphaCount}</div>
                                    </div>
                                </div>

                                <div className="mt-3 rounded-xl border border-white/10 bg-black/30 p-3">
                                    <div className="text-[10px] text-gray-500 font-black tracking-widest">MODE</div>
                                    <div className="mt-1 flex items-center gap-2">
                                        <div className={`text-[11px] font-black tracking-wide ${hasApiKey ? 'text-[#00ffcc]' : 'text-gray-300'}`}>{hasApiKey ? 'API UPLINKED' : 'OFFLINE'}</div>
                                        <div className={`w-2 h-2 rounded-full ${hasApiKey ? 'bg-[#00ffcc]' : 'bg-white/20'}`} />
                                    </div>
                                </div>

                                {diagOpen ? (
                                    <div className="mt-3 rounded-xl border border-white/10 bg-[#050505] p-3">
                                        <div className="text-[10px] font-black tracking-[0.25em] text-gray-300">DIAGNOSTICS</div>
                                        <div className="mt-3 space-y-2 text-[10px] text-gray-400">
                                            <div className="flex items-center justify-between gap-3">
                                                <div className="text-gray-500">WEBGL</div>
                                                <div className={webglInfo?.ok ? 'text-[#00ffcc]' : 'text-yellow-500'}>{webglInfo?.detail ?? '…'}</div>
                                            </div>
                                            <div className="flex items-center justify-between gap-3">
                                                <div className="text-gray-500">VENDOR</div>
                                                <div className="text-gray-300 truncate max-w-[240px]">{webglInfo?.vendor ?? '—'}</div>
                                            </div>
                                            <div className="flex items-center justify-between gap-3">
                                                <div className="text-gray-500">RENDERER</div>
                                                <div className="text-gray-300 truncate max-w-[240px]">{webglInfo?.renderer ?? '—'}</div>
                                            </div>
                                            <div className="flex items-center justify-between gap-3">
                                                <div className="text-gray-500">RES</div>
                                                <div className="text-gray-300">{window.innerWidth}×{window.innerHeight}</div>
                                            </div>
                                            <div className="flex items-center justify-between gap-3">
                                                <div className="text-gray-500">UA</div>
                                                <div className="text-gray-300 truncate max-w-[240px]">{navigator.userAgent}</div>
                                            </div>
                                        </div>
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BootSequence;

