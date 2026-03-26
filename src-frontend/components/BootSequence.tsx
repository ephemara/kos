/**
 * K_OS Boot Sequence — NEURAL IGNITION
 *
 * Cinematic space-station startup screen.
 * Pure atmosphere, zero filler.
 */

import React, { useEffect, useRef, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { Minus, Square, X } from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────

export type BootSequenceProps = {
    onComplete: () => void;
};

// ─── Helpers ───────────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

// Random hex string for data stream effect
function hexChunk(len = 8): string {
    return Array.from({ length: len }, () =>
        Math.floor(Math.random() * 16).toString(16).toUpperCase()
    ).join('');
}

// ─── Boot stages ───────────────────────────────────────────────────────────

const STAGES = [
    { id: 'mem', label: 'MEMORY', ms: 420 },
    { id: 'gpu', label: 'GPU', ms: 580 },
    { id: 'kernel', label: 'KERNEL', ms: 640 },
    { id: 'net', label: 'NETWORK', ms: 380 },
    { id: 'ready', label: 'ONLINE', ms: 300 },
];
const TOTAL_STAGES = STAGES.length;

// ─── Hex logo (SVG polygon, no external deps) ──────────────────────────────

const HEX_POINTS = '50,5 95,27.5 95,72.5 50,95 5,72.5 5,27.5';

// ─── Component ─────────────────────────────────────────────────────────────

const BootSequence: React.FC<BootSequenceProps> = ({ onComplete }) => {
    const [stageIdx, setStageIdx] = useState(-1);     // -1 = pre-start
    const [done, setDone] = useState(false);
    const [fadeOut, setFadeOut] = useState(false);

    // Data-stream overlay ticker
    const [streamA, setStreamA] = useState(() => hexChunk(28));
    const [streamB, setStreamB] = useState(() => hexChunk(24));

    const completedRef = useRef(false);
    const cancelRef = useRef(false);

    // ── Window controls ──────────────────────────────────────────────────
    const wmin = () => getCurrentWindow().minimize().catch(() => { });
    const wmax = async () => {
        const w = getCurrentWindow();
        (await w.isMaximized()) ? w.unmaximize().catch(() => { }) : w.maximize().catch(() => { });
    };
    const wclose = () => getCurrentWindow().close().catch(() => { });
    const wdrag = (e: React.MouseEvent) => {
        if ((e.target as HTMLElement).closest('button,[data-no-drag]')) return;
        getCurrentWindow().startDragging().catch(() => { });
    };

    // ── Keyboard shortcut: ESC ───────────────────────────────────────────
    useEffect(() => {
        const h = (e: KeyboardEvent) => {
            if (e.key === 'Escape') { e.preventDefault(); triggerComplete(); }
        };
        window.addEventListener('keydown', h);
        return () => window.removeEventListener('keydown', h);
    }, []);

    // ── Data stream ticker ───────────────────────────────────────────────
    useEffect(() => {
        if (done) return;
        const id = setInterval(() => {
            setStreamA(hexChunk(28));
            setStreamB(hexChunk(24));
        }, 80);
        return () => clearInterval(id);
    }, [done]);

    // ── Main boot sequence ───────────────────────────────────────────────
    useEffect(() => {
        const run = async () => {
            await sleep(600);           // dramatic pause before anything
            if (cancelRef.current) return;

            for (let i = 0; i < STAGES.length; i++) {
                if (cancelRef.current) return;
                setStageIdx(i);
                await sleep(STAGES[i].ms);
            }

            if (cancelRef.current) return;
            setDone(true);
            await sleep(900);           // hold "ONLINE" state
            if (cancelRef.current) return;
            triggerComplete();
        };
        run();
        return () => { cancelRef.current = true; };
    }, []);

    const triggerComplete = () => {
        if (completedRef.current) return;
        completedRef.current = true;
        cancelRef.current = true;
        setFadeOut(true);
        setTimeout(onComplete, 480);
    };

    const progress = stageIdx < 0 ? 0 : ((stageIdx + 1) / TOTAL_STAGES);

    return (
        <div
            className="fixed inset-0 overflow-hidden font-mono select-none"
            style={{
                background: '#000',
                opacity: fadeOut ? 0 : 1,
                transition: fadeOut ? 'opacity 0.48s cubic-bezier(0.4,0,1,1)' : 'none',
            }}
        >
            {/* ── Window chrome ─────────────────────────────────────────── */}
            <div
                className="absolute top-0 inset-x-0 h-10 z-50 flex items-center"
                onMouseDown={wdrag}
            >
                <div className="flex-1" />
                <div className="flex items-center gap-0.5 pr-2" data-no-drag>
                    {[
                        { icon: Minus, fn: wmin, hov: 'hover:bg-white/8 hover:text-white/70', sz: 12 },
                        { icon: Square, fn: wmax, hov: 'hover:bg-white/8 hover:text-white/70', sz: 9 },
                        { icon: X, fn: wclose, hov: 'hover:bg-red-500/20 hover:text-red-400', sz: 12 },
                    ].map(({ icon: Icon, fn, hov, sz }, i) => (
                        <button
                            key={i}
                            onClick={fn}
                            className={`w-8 h-8 flex items-center justify-center rounded-lg text-white/20 transition-all duration-150 ${hov}`}
                        >
                            <Icon size={sz} />
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Background grid ───────────────────────────────────────── */}
            <GridBackground />

            {/* ── Side data streams ─────────────────────────────────────── */}
            <DataColumn side="left" text={streamA} active={stageIdx >= 0} />
            <DataColumn side="right" text={streamB} active={stageIdx >= 0} />

            {/* ── Main content ──────────────────────────────────────────── */}
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-0" style={{ paddingTop: '2.5rem' }}>

                {/* Hex logo */}
                <HexLogo stageIdx={stageIdx} done={done} />

                {/* Wordmark */}
                <div
                    className="mt-8 text-center"
                    style={{
                        opacity: stageIdx >= 0 ? 1 : 0,
                        transform: stageIdx >= 0 ? 'translateY(0)' : 'translateY(10px)',
                        transition: 'opacity 0.6s ease, transform 0.6s ease',
                    }}
                >
                    <div
                        className="text-[42px] font-black tracking-[-0.04em] leading-none"
                        style={{
                            color: '#fff',
                            letterSpacing: '-0.02em',
                        }}
                    >
                        K_OS
                    </div>
                    <div
                        className="mt-1.5 text-[10px] tracking-[0.55em] text-white/30 uppercase"
                    >
                        Kernel Ignition Sequence
                    </div>
                </div>

                {/* Reactor bar */}
                <div className="mt-10 w-[420px]">
                    <ReactorBar stageIdx={stageIdx} done={done} />
                </div>

                {/* Status line */}
                <div className="mt-5 h-5 text-[10px] tracking-[0.3em] text-white/25">
                    {stageIdx >= 0 && stageIdx < STAGES.length && (
                        <span
                            key={stageIdx}
                            style={{ animation: 'kos-fade-in 0.2s ease' }}
                        >
                            {done ? (
                                <span className="text-[#00ffcc]/70">◈ SYSTEMS NOMINAL</span>
                            ) : (
                                <span>▸ INITIALIZING {STAGES[stageIdx]?.label}</span>
                            )}
                        </span>
                    )}
                </div>

                {/* ESC hint */}
                <div className="mt-16 text-[9px] text-white/15 tracking-widest">
                    ESC — SKIP
                </div>
            </div>

            {/* Global keyframe */}
            <style>{`
                @keyframes kos-fade-in {
                    from { opacity: 0; transform: translateY(4px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
                @keyframes kos-grid-drift {
                    0%   { transform: translateY(0); }
                    100% { transform: translateY(40px); }
                }
                @keyframes kos-hex-pulse {
                    0%,100% { filter: drop-shadow(0 0 6px rgba(0,255,204,0.4)); }
                    50%     { filter: drop-shadow(0 0 18px rgba(0,255,204,0.8)); }
                }
                @keyframes kos-ring-spin {
                    from { transform: rotate(0deg); }
                    to   { transform: rotate(360deg); }
                }
                @keyframes kos-ring-spin-r {
                    from { transform: rotate(0deg); }
                    to   { transform: rotate(-360deg); }
                }
                @keyframes kos-data-stream {
                    0%   { opacity: 0.0; }
                    20%  { opacity: 1.0; }
                    80%  { opacity: 1.0; }
                    100% { opacity: 0.0; }
                }
                @keyframes kos-segment-fill {
                    from { opacity: 0; transform: scaleX(0); }
                    to   { opacity: 1; transform: scaleX(1); }
                }
            `}</style>
        </div>
    );
};

// ─── Sub-components ────────────────────────────────────────────────────────

function GridBackground() {
    return (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {/* Radial vignette */}
            <div
                className="absolute inset-0"
                style={{
                    background: 'radial-gradient(ellipse 70% 60% at 50% 50%, transparent 0%, #000 85%)',
                }}
            />
            {/* Top accent line */}
            <div
                className="absolute inset-x-0 top-0 h-px"
                style={{ background: 'linear-gradient(90deg, transparent, rgba(0,255,204,0.25), transparent)' }}
            />
            {/* Bottom accent line */}
            <div
                className="absolute inset-x-0 bottom-0 h-px"
                style={{ background: 'linear-gradient(90deg, transparent, rgba(168,85,247,0.15), transparent)' }}
            />
            {/* Subtle grid */}
            <div
                className="absolute inset-0 opacity-[0.035]"
                style={{
                    backgroundImage: `
                        linear-gradient(rgba(0,255,204,1) 1px, transparent 1px),
                        linear-gradient(90deg, rgba(0,255,204,1) 1px, transparent 1px)
                    `,
                    backgroundSize: '40px 40px',
                    animation: 'kos-grid-drift 8s linear infinite',
                }}
            />
        </div>
    );
}

function DataColumn({ side, text, active }: { side: 'left' | 'right'; text: string; active: boolean }) {
    const isLeft = side === 'left';
    return (
        <div
            className="absolute top-0 bottom-0 flex flex-col justify-center gap-2 pointer-events-none"
            style={{
                [isLeft ? 'left' : 'right']: '2rem',
                width: '6rem',
                opacity: active ? 1 : 0,
                transition: 'opacity 0.5s ease',
            }}
        >
            {Array.from({ length: 18 }).map((_, i) => (
                <div
                    key={i}
                    className="text-[9px] font-mono"
                    style={{
                        color: 'rgba(0,255,204,0.12)',
                        textAlign: isLeft ? 'left' : 'right',
                        opacity: 0.4 + Math.sin(i * 0.8) * 0.3,
                    }}
                >
                    {hexChunk(isLeft ? 6 : 5)}
                </div>
            ))}
        </div>
    );
}

function HexLogo({ stageIdx, done }: { stageIdx: number; done: boolean }) {
    const active = stageIdx >= 0;
    return (
        <div className="relative flex items-center justify-center" style={{ width: 140, height: 140 }}>
            {/* Outer slow ring */}
            <svg
                width={140} height={140}
                className="absolute inset-0"
                style={{
                    opacity: active ? (done ? 1 : 0.5) : 0,
                    transition: 'opacity 0.6s ease',
                    animation: active ? 'kos-ring-spin 12s linear infinite' : 'none',
                    transformOrigin: '70px 70px',
                }}
            >
                <polygon
                    points="70,8 127,39 127,101 70,132 13,101 13,39"
                    fill="none"
                    stroke={done ? '#00ffcc' : 'rgba(0,255,204,0.25)'}
                    strokeWidth="0.8"
                    strokeDasharray="4 8"
                    style={{ transition: 'stroke 0.4s ease' }}
                />
            </svg>

            {/* Middle ring */}
            <svg
                width={110} height={110}
                className="absolute"
                style={{
                    left: 15, top: 15,
                    opacity: active ? (done ? 0.8 : 0.35) : 0,
                    transition: 'opacity 0.6s ease',
                    animation: active ? 'kos-ring-spin-r 8s linear infinite' : 'none',
                    transformOrigin: '55px 55px',
                }}
            >
                <polygon
                    points="55,6 101,30.5 101,79.5 55,104 9,79.5 9,30.5"
                    fill="none"
                    stroke={done ? '#00ffcc' : 'rgba(0,255,204,0.2)'}
                    strokeWidth="0.6"
                    strokeDasharray="2 12"
                    style={{ transition: 'stroke 0.4s ease' }}
                />
            </svg>

            {/* Core hex */}
            <svg
                width={80} height={80}
                className="absolute"
                style={{
                    left: 30, top: 30,
                    transform: active ? 'scale(1)' : 'scale(0.4)',
                    opacity: active ? 1 : 0,
                    transition: 'transform 0.7s cubic-bezier(0.34,1.56,0.64,1), opacity 0.5s ease',
                    animation: active ? (done ? 'kos-hex-pulse 2s ease-in-out infinite' : 'kos-hex-pulse 3s ease-in-out infinite') : 'none',
                }}
            >
                <defs>
                    <linearGradient id="hexGrad" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor={done ? '#00ffcc' : '#00e5b5'} stopOpacity="0.15" />
                        <stop offset="100%" stopColor={done ? '#7c3aed' : '#4f46e5'} stopOpacity="0.08" />
                    </linearGradient>
                </defs>
                <polygon
                    points={HEX_POINTS}
                    fill="url(#hexGrad)"
                    stroke={done ? '#00ffcc' : 'rgba(0,255,204,0.7)'}
                    strokeWidth="1.5"
                    style={{ transition: 'stroke 0.3s ease' }}
                />
                {/* Inner dot */}
                <circle
                    cx="50" cy="50" r="4"
                    fill={done ? '#00ffcc' : 'rgba(0,255,204,0.7)'}
                    style={{ transition: 'fill 0.3s ease' }}
                />
            </svg>
        </div>
    );
}

function ReactorBar({ stageIdx, done }: { stageIdx: number; done: boolean }) {
    return (
        <div>
            {/* Segment labels */}
            <div className="flex justify-between mb-2">
                {STAGES.map((s, i) => (
                    <span
                        key={s.id}
                        className="text-[8px] tracking-[0.2em]"
                        style={{
                            color: i <= stageIdx
                                ? (done && i === STAGES.length - 1 ? '#00ffcc' : 'rgba(0,255,204,0.5)')
                                : 'rgba(255,255,255,0.1)',
                            transition: 'color 0.3s ease',
                            fontVariantNumeric: 'tabular-nums',
                        }}
                    >
                        {s.label}
                    </span>
                ))}
            </div>

            {/* Bar track */}
            <div
                className="relative h-[3px] rounded-full overflow-hidden"
                style={{ background: 'rgba(255,255,255,0.05)' }}
            >
                {/* Fill */}
                <div
                    className="absolute inset-y-0 left-0 rounded-full"
                    style={{
                        width: stageIdx < 0 ? '0%' : `${((stageIdx + 1) / TOTAL_STAGES) * 100}%`,
                        background: done
                            ? 'linear-gradient(90deg, #00ffcc, #7c3aed)'
                            : 'linear-gradient(90deg, rgba(0,255,204,0.8), rgba(0,229,181,0.6))',
                        transition: 'width 0.35s cubic-bezier(0.4,0,0.2,1), background 0.5s ease',
                        boxShadow: done ? '0 0 12px rgba(0,255,204,0.6)' : '0 0 8px rgba(0,255,204,0.3)',
                    }}
                />
                {/* Glow pulse at tip */}
                {!done && stageIdx >= 0 && (
                    <div
                        className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full"
                        style={{
                            left: `calc(${((stageIdx + 1) / TOTAL_STAGES) * 100}% - 6px)`,
                            background: '#00ffcc',
                            boxShadow: '0 0 12px 4px rgba(0,255,204,0.5)',
                            opacity: 0.9,
                            transition: 'left 0.35s cubic-bezier(0.4,0,0.2,1)',
                        }}
                    />
                )}
            </div>

            {/* Segment dividers */}
            <div className="relative h-[3px] -mt-[3px] flex">
                {STAGES.map((_, i) => (
                    <div key={i} className="flex-1 border-r border-black/60 last:border-0" />
                ))}
            </div>

            {/* Tick marks */}
            <div className="flex justify-between mt-1.5">
                {STAGES.map((_, i) => (
                    <div
                        key={i}
                        className="w-px h-1.5"
                        style={{
                            background: i <= stageIdx ? 'rgba(0,255,204,0.4)' : 'rgba(255,255,255,0.07)',
                            transition: 'background 0.3s ease',
                        }}
                    />
                ))}
            </div>
        </div>
    );
}

export default BootSequence;
