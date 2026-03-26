// @ts-nocheck
/**
 * KAINConsole.tsx — KAINScript Live REPL & IDE Panel
 *
 * A VS Code-inspired terminal/editor for KAINScript inside K-OS.
 * Lives as a panel in the Universal Workspace or as a standalone app.
 *
 * Features:
 *   - Multi-target compilation (SPIR-V / WASM / TS / Rust / C++ / run)
 *   - Live output: stdout, stderr, compile errors with line numbers
 *   - Session history — all evals concatenated for context
 *   - Syntax highlighting (manual keywords, no heavy dep)
 *   - Source file browser (backend-native registry with frontend fallback)
 *   - Hot-reload: compile a brush → push to GPU pipeline
 *   - "Load as Plugin" — KAINScript → Plugin Matrix
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { kainBridge, type KAINTarget, type KAINSourceFile, type KAINAuthoringSession } from './KAINBridge';

// ─── KAIN keyword set for highlight ───────────────────────────────────────────

const KAIN_KEYWORDS = new Set([
    'fn', 'let', 'mut', 'var', 'return', 'if', 'else', 'match', 'for', 'while',
    'actor', 'on', 'shader', 'compute', 'fragment', 'vertex', 'struct', 'enum',
    'import', 'export', 'async', 'await', 'with', 'Pure', 'IO', 'comptime',
    'true', 'false', 'null', 'self', 'type', 'trait', 'impl',
    'Int', 'Float', 'Bool', 'String', 'Vec2', 'Vec3', 'Vec4', 'UVec3', 'UInt',
    'Array', 'Map', 'uniform', 'buffer', 'StorageBuffer', 'RWBuffer',
]);

function highlightKAIN(code: string): React.ReactNode[] {
    const lines = code.split('\n');
    return lines.map((line, li) => {
        const tokens: React.ReactNode[] = [];
        const re = /("(?:[^"\\]|\\.)*"|\/\/.*|[\w]+|[^\w\s]|\s+)/g;
        let m: RegExpExecArray | null;
        let k = 0;
        while ((m = re.exec(line)) !== null) {
            const tok = m[0];
            let color = '#c9d1d9';
            if (tok.startsWith('//')) color = '#6a737d';
            else if (tok.startsWith('"')) color = '#a5d6ff';
            else if (KAIN_KEYWORDS.has(tok)) color = '#ff7b72';
            else if (/^[0-9]+\.?[0-9]*$/.test(tok)) color = '#79c0ff';
            else if (/^[A-Z]/.test(tok)) color = '#ffa657';
            tokens.push(<span key={k++} style={{ color }}>{tok}</span>);
        }
        return (
            <div key={li} style={{ display: 'flex', minHeight: '1.4em' }}>
                <span style={{ color: '#484f58', minWidth: '2.8ch', textAlign: 'right', marginRight: '1ch', userSelect: 'none', fontSize: '0.75em', paddingTop: '1px' }}>
                    {li + 1}
                </span>
                <span>{tokens}</span>
            </div>
        );
    });
}

// ─── Target config ────────────────────────────────────────────────────────────

const TARGETS: { id: KAINTarget; label: string; color: string; description: string }[] = [
    { id: 'run', label: '▶ Run', color: '#3fb950', description: 'Execute immediately in KAIN interpreter' },
    { id: 'ts', label: '⬡ TS', color: '#3178c6', description: 'Compile to TypeScript (KAINScript → plugin)' },
    { id: 'wasm', label: '⬡ WASM', color: '#7c3aed', description: 'Compile to WebAssembly module' },
    { id: 'spirv', label: '◈ SPIR-V', color: '#f97316', description: 'Compile to GPU compute shader' },
    { id: 'rust', label: '🦀 Rust', color: '#ce422b', description: 'Transpile to Rust source' },
    { id: 'cpp', label: '⊕ C++', color: '#0ea5e9', description: 'Transpile to C++ source' },
];

// ─── Starter examples ─────────────────────────────────────────────────────────

const STARTER_EXAMPLES: { label: string; target: KAINTarget; code: string }[] = [
    {
        label: 'Hello KAINScript', target: 'run',
        code: `// Hello from KAINScript — runs in the KAIN interpreter
fn main() -> String:
    let name = "K-OS"
    let version = 2.0
    println("⚡ {name} v{version} — KAIN is live!")
    return "OK"

main()`,
    },
    {
        label: 'Actor (Erlang-style)', target: 'run',
        code: `// Actor-based concurrency — no shared mutable state
actor BrushEngine:
    var stroke_count: Int = 0
    var total_distance: Float = 0.0

    on Stroke(strength: Float, distance: Float):
        stroke_count = stroke_count + 1
        total_distance = total_distance + distance
        println("Stroke #{stroke_count}: strength={strength} dist={distance}")

    on Stats():
        println("Total strokes: {stroke_count}, distance: {total_distance}")`,
    },
    {
        label: 'Pure Function + Effects', target: 'ts',
        code: `// Effect tracking — Pure functions cannot perform I/O
fn lerp(a: Float, b: Float, t: Float) -> Float with Pure:
    return a + (b - a) * t

fn smoothstep(edge0: Float, edge1: Float, x: Float) -> Float with Pure:
    let t = clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)

// This compiles to TypeScript:
// export function lerp(a: number, b: number, t: number): number { ... }`,
    },
    {
        label: 'GPU Compute Brush', target: 'spirv',
        code: `// Custom sculpt brush — compiles to SPIR-V compute shader
shader compute my_push_brush(id: UVec3) -> Vec4:
    uniform positions: StorageBuffer<Vec4> @0
    uniform center:    Vec4 @5
    uniform radius:    Float @10
    uniform strength:  Float @11

    let pos      = positions[id.x].xyz
    let to_brush = pos - center.xyz
    let dist     = length(to_brush)

    if dist > radius:
        return vec4(0.0, 0.0, 0.0, 0.0)

    let falloff  = 1.0 - clamp(dist / radius, 0.0, 1.0)
    let push_dir = normalize(to_brush)
    let delta    = push_dir * strength * falloff

    let new_pos = pos + delta
    positions[id.x] = vec4(new_pos.x, new_pos.y, new_pos.z, 1.0)
    return vec4(new_pos.x, new_pos.y, new_pos.z, 1.0)`,
    },
    {
        label: 'WASM Math Module', target: 'wasm',
        code: `// Compiles to WASM — hot-loadable math module
fn perlin_noise(x: Float, y: Float, z: Float) -> Float with Pure:
    // Classic Perlin noise implementation
    let xi = floor(x) as Int
    let yi = floor(y) as Int
    let zi = floor(z) as Int
    let xf = x - floor(x)
    let yf = y - floor(y)
    let zf = z - floor(z)
    let u  = fade(xf)
    let v  = fade(yf)
    let w  = fade(zf)
    return lerp(u, lerp(v,
        lerp(w, grad(xi, yi, zi),       grad(xi, yi, zi+1)),
        lerp(w, grad(xi, yi+1, zi),     grad(xi, yi+1, zi+1))),
        lerp(v,
        lerp(w, grad(xi+1, yi, zi),     grad(xi+1, yi, zi+1)),
        lerp(w, grad(xi+1, yi+1, zi),   grad(xi+1, yi+1, zi+1))))

fn fade(t: Float) -> Float with Pure:
    return t * t * t * (t * (t * 6.0 - 15.0) + 10.0)

fn grad(x: Int, y: Int, z: Int) -> Float with Pure:
    let h = (x * 1031 + y * 1097 + z * 1049) % 16
    return h as Float / 16.0 - 0.5`,
    },
    {
        label: 'K-OS Plugin (KAINScript)', target: 'ts',
        code: `// A K-OS plugin written in KAINScript
// Compile to TypeScript → load via Plugin Matrix

struct BrushDef:
    id:       String
    label:    String
    strength: Float

fn create_manifest() -> Any:
    return {
        id: "kainscript-brush-plugin",
        name: "KAINScript Brush Plugin",
        version: "1.0.0",
        description: "Custom brush added via KAINScript",
    }

fn activate(api: Any) -> Void:
    println("KAINScript plugin activating...")
    let brush = BrushDef { id: "kn-push", label: "KN Push", strength: 0.5 }
    api.app.whenReady("ksculpt", fn(sculpt: Any):
        sculpt.addBrush(brush)
        println("⚡ KN Push brush registered!")
    )

fn deactivate() -> Void:
    println("KAINScript plugin deactivating.")

export manifest = create_manifest()
export activate = activate
export deactivate = deactivate`,
    },
];

// ─── Console entry type ───────────────────────────────────────────────────────

interface ConsoleEntry {
    id: number;
    type: 'input' | 'output' | 'error' | 'compile' | 'info';
    content: string;
    ts: number;
    target?: KAINTarget;
    durationMs?: number;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export const KAINConsole: React.FC<{ embedded?: boolean }> = ({ embedded = false }) => {
    const [source, setSource] = useState(STARTER_EXAMPLES[0].code);
    const [target, setTarget] = useState<KAINTarget>('run');
    const [entries, setEntries] = useState<ConsoleEntry[]>([{
        id: 0, type: 'info', ts: Date.now(),
        content: '⚡ KAINScript Console — K-OS Language Runtime\nType KAIN code and press Ctrl+Enter to run.\nUse the target selector to compile to SPIR-V, WASM, TypeScript, Rust, or C++.',
    }]);
    const [running, setRunning] = useState(false);
    const [activeView, setActiveView] = useState<'editor' | 'registry'>('editor');
    const [sourceFiles, setSourceFiles] = useState<KAINSourceFile[]>(() => kainBridge.listSources());
    const [selectedFile, setSelectedFile] = useState<KAINSourceFile | null>(null);
    const [rebuildResults, setRebuildResults] = useState<Map<string, boolean>>(new Map());
    const [dirty, setDirty] = useState(false);
    const [activeSessionLabel, setActiveSessionLabel] = useState('Scratch');

    const outputRef = useRef<HTMLDivElement>(null);
    const nextId = useRef(1);

    const addEntry = useCallback((entry: Omit<ConsoleEntry, 'id' | 'ts'>) => {
        setEntries(prev => [...prev, { ...entry, id: nextId.current++, ts: Date.now() }]);
    }, []);

    useEffect(() => {
        if (outputRef.current) {
            outputRef.current.scrollTop = outputRef.current.scrollHeight;
        }
    }, [entries]);

    useEffect(() => {
        let active = true;
        void kainBridge.listSourcesFromBackend().then((files) => {
            if (active) setSourceFiles(files);
        });
        return () => {
            active = false;
        };
    }, []);

    useEffect(() => {
        if (!selectedFile?.path) return;
        let active = true;
        void kainBridge.readSource(selectedFile.path)
            .then((content) => {
                if (!active) return;
                setSource(content);
                setTarget(selectedFile.target);
                setActiveSessionLabel(selectedFile.label);
                setDirty(false);
            })
            .catch((error) => {
                addEntry({ type: 'error', content: `✗ Failed to read ${selectedFile.path}\n${String(error)}` });
            });
        return () => {
            active = false;
        };
    }, [selectedFile, addEntry]);

    useEffect(() => {
        return kainBridge.onAuthoringSession((session: KAINAuthoringSession) => {
            setActiveView('editor');
            if (session.path) {
                const fromRegistry = sourceFiles.find((file) => file.path === session.path) ?? null;
                setSelectedFile(fromRegistry ?? {
                    path: session.path,
                    domain: session.domain ?? 'custom',
                    category: session.domain ?? 'custom',
                    label: session.label ?? session.path.split('/').pop() ?? 'Kain Source',
                    target: session.target ?? 'spirv',
                    description: session.description ?? 'KAIN authoring session',
                });
            } else {
                setSelectedFile(null);
                setSource(session.source ?? '');
                setTarget(session.target ?? 'spirv');
                setActiveSessionLabel(session.label ?? 'Scratch');
                setDirty(Boolean(session.source));
            }
        });
    }, [sourceFiles]);

    const execute = useCallback(async () => {
        if (!source.trim() || running) return;
        setRunning(true);

        addEntry({ type: 'input', content: source, target });

        const activeTarget = target;
        try {
            if (activeTarget === 'run') {
                const res = await kainBridge.run(source);
                addEntry({
                    type: res.success ? 'output' : 'error',
                    content: res.stdout || res.stderr || (res.success ? '(no output)' : 'Runtime error'),
                });
            } else {
                const res = await kainBridge.compile(source, activeTarget);
                addEntry({
                    type: res.success ? 'compile' : 'error',
                    content: res.success
                        ? `✓ Compiled to ${activeTarget.toUpperCase()} in ${res.durationMs.toFixed(0)}ms\n${res.output ?? ''}`
                        : `✗ Compile error:\n${res.errors ?? 'Unknown error'}`,
                    target: activeTarget,
                    durationMs: res.durationMs,
                });
            }
        } catch (err: any) {
            addEntry({ type: 'error', content: `⚠ ${String(err?.message ?? err)}` });
        }

        setRunning(false);
    }, [source, target, running, addEntry]);

    const loadExample = useCallback((ex: typeof STARTER_EXAMPLES[0]) => {
        setSource(ex.code);
        setTarget(ex.target);
    }, []);

    const rebuildFile = useCallback(async (file: KAINSourceFile) => {
        addEntry({ type: 'info', content: `⟳ Rebuilding ${file.label} (${file.target})...` });
        const res = await kainBridge.rebuildFile(file);
        setRebuildResults(prev => new Map(prev).set(file.path, res.success));
        addEntry({
            type: res.success ? 'compile' : 'error',
            content: res.success
                ? `✓ ${file.label} rebuilt in ${res.durationMs.toFixed(0)}ms${file.outputPath ? `\n  → ${file.outputPath}` : ''}`
                : `✗ ${file.label} failed:\n${res.errors}`,
            target: file.target,
            durationMs: res.durationMs,
        });
    }, [addEntry]);

    const saveSource = useCallback(async () => {
        if (!selectedFile?.path) {
            addEntry({ type: 'error', content: '✗ No KAIN source file selected for save.' });
            return;
        }

        try {
            await kainBridge.writeSource(selectedFile.path, source);
            setDirty(false);
            addEntry({ type: 'info', content: `✓ Saved ${selectedFile.label}` });
            const files = await kainBridge.listSourcesFromBackend();
            setSourceFiles(files);
        } catch (error) {
            addEntry({ type: 'error', content: `✗ Save failed for ${selectedFile.path}\n${String(error)}` });
        }
    }, [selectedFile, source, addEntry]);

    const compileCurrent = useCallback(async () => {
        if (selectedFile) {
            await saveSource();
            await rebuildFile({ ...selectedFile, target });
            return;
        }
        await execute();
    }, [selectedFile, saveSource, rebuildFile, target, execute]);

    const groupedFiles = useMemo(() => {
        const map = new Map<KAINSourceFile['domain'], KAINSourceFile[]>();
        for (const f of sourceFiles) {
            if (!map.has(f.domain)) map.set(f.domain, []);
            map.get(f.domain)!.push(f);
        }
        return map;
    }, [sourceFiles]);

    const domainColors: Record<KAINSourceFile['domain'], string> = {
        sculpt: '#f97316',
        physics: '#a855f7',
        fluid: '#3b82f6',
        mocap: '#10b981',
        plugin: '#eab308',
        custom: '#64748b',
    };

    const s = css;

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            height: embedded ? '100%' : '100vh',
            background: '#0d1117',
            fontFamily: '"JetBrains Mono", "Fira Code", monospace',
            fontSize: '12px',
            color: '#c9d1d9',
            overflow: 'hidden',
        }}>
            {/* ── Header ────────────────────────────────────────────────────── */}
            {!embedded && (
                <div style={{ padding: '10px 16px', borderBottom: '1px solid #21262d', display: 'flex', alignItems: 'center', gap: '12px', background: '#161b22' }}>
                    <span style={{ color: '#f97316', fontWeight: 700, letterSpacing: '0.05em', fontSize: '11px' }}>⚡ KAIN</span>
                    <span style={{ color: '#484f58', fontSize: '10px' }}>KAINScript Console v1.0</span>
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }}>
                        {(['editor', 'registry'] as const).map(v => (
                            <button key={v} onClick={() => setActiveView(v)} style={{
                                padding: '2px 8px', borderRadius: '4px', border: 'none', cursor: 'pointer',
                                background: activeView === v ? 'rgba(249,115,22,0.15)' : 'transparent',
                                color: activeView === v ? '#f97316' : '#484f58',
                                fontSize: '10px',
                                fontFamily: 'inherit',
                            }}>
                                {v === 'editor' ? '⎆ Editor' : '◈ KAIN Sources'}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {activeView === 'editor' ? (
                <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                    {/* ── Sidebar: examples ──────────────────────────────── */}
                    <div style={{ width: '180px', borderRight: '1px solid #21262d', overflowY: 'auto', padding: '8px 0', flexShrink: 0, background: '#0d1117' }}>
                        <div style={{ padding: '4px 8px 8px', color: '#484f58', fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Examples</div>
                        {STARTER_EXAMPLES.map((ex, i) => {
                            const tc = TARGETS.find(t => t.id === ex.target);
                            return (
                                <button key={i} onClick={() => loadExample(ex)} style={{
                                    display: 'flex', flexDirection: 'column', gap: '2px',
                                    width: '100%', textAlign: 'left',
                                    padding: '6px 10px', border: 'none', cursor: 'pointer',
                                    background: 'transparent', color: '#8b949e',
                                    fontSize: '10px', fontFamily: 'inherit',
                                    borderLeft: `2px solid transparent`,
                                    transition: 'all 0.1s',
                                }} onMouseEnter={e => (e.currentTarget.style.background = '#161b22')}
                                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                                    <span style={{ color: '#c9d1d9' }}>{ex.label}</span>
                                    <span style={{ color: tc?.color ?? '#484f58', fontSize: '9px' }}>{tc?.label}</span>
                                </button>
                            );
                        })}
                    </div>

                    {/* ── Main editor + output ───────────────────────────── */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                        {/* Target selector */}
                        <div style={{ padding: '6px 12px', borderBottom: '1px solid #21262d', display: 'flex', gap: '4px', alignItems: 'center', flexWrap: 'wrap' }}>
                            <span style={{ color: '#484f58', fontSize: '10px', marginRight: '4px' }}>TARGET:</span>
                            {TARGETS.map(t => (
                                <button key={t.id} onClick={() => setTarget(t.id)} title={t.description} style={{
                                    padding: '2px 8px', borderRadius: '3px', cursor: 'pointer',
                                    border: target === t.id ? `1px solid ${t.color}` : '1px solid #21262d',
                                    background: target === t.id ? `${t.color}22` : 'transparent',
                                    color: target === t.id ? t.color : '#484f58',
                                    fontSize: '10px', fontFamily: 'inherit',
                                }}>
                                    {t.label}
                                </button>
                            ))}
                            <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px', alignItems: 'center' }}>
                                <span style={{ color: '#484f58', fontSize: '9px' }}>Ctrl+Enter to run</span>
                                <button onClick={compileCurrent} disabled={running} style={{
                                    padding: '3px 12px', borderRadius: '3px', border: 'none', cursor: running ? 'wait' : 'pointer',
                                    background: running ? '#21262d' : '#238636',
                                    color: running ? '#484f58' : '#fff',
                                    fontSize: '10px', fontFamily: 'inherit', fontWeight: 600,
                                }}>
                                    {running ? '⟳ Running...' : selectedFile ? '⬡ Save + Compile' : target === 'run' ? '▶ Run' : '⬡ Compile'}
                                </button>
                                <button
                                    onClick={() => void saveSource()}
                                    disabled={!selectedFile || !dirty}
                                    style={{
                                        padding: '3px 12px',
                                        borderRadius: '3px',
                                        border: '1px solid #30363d',
                                        cursor: !selectedFile || !dirty ? 'default' : 'pointer',
                                        background: !selectedFile || !dirty ? '#0d1117' : '#161b22',
                                        color: !selectedFile || !dirty ? '#484f58' : '#c9d1d9',
                                        fontSize: '10px',
                                        fontFamily: 'inherit',
                                        fontWeight: 600,
                                    }}
                                >
                                    Save
                                </button>
                            </div>
                        </div>

                        {/* Editor */}
                        <div style={{ flex: '0 0 55%', position: 'relative', overflow: 'hidden', borderBottom: '1px solid #21262d' }}>
                            {/* Overlay highlight */}
                            <div style={{
                                position: 'absolute', inset: 0, padding: '12px 12px 12px 0',
                                pointerEvents: 'none', overflow: 'hidden', zIndex: 1,
                                whiteSpace: 'pre', lineHeight: '1.6em', paddingLeft: '0',
                            }}>
                                <div style={{ paddingLeft: '4ch' }}>
                                    {highlightKAIN(source)}
                                </div>
                            </div>
                            {/* Actual textarea */}
                            <textarea
                                value={source}
                                onChange={e => { setSource(e.target.value); setDirty(true); }}
                                onKeyDown={e => {
                                    if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); execute(); }
                                    if (e.key === 'Tab') {
                                        e.preventDefault();
                                        const s = e.currentTarget;
                                        const v = s.value, start = s.selectionStart, end = s.selectionEnd;
                                        s.value = v.substring(0, start) + '    ' + v.substring(end);
                                        s.selectionStart = s.selectionEnd = start + 4;
                                        setSource(s.value);
                                    }
                                }}
                                spellCheck={false}
                                style={{
                                    position: 'absolute', inset: 0,
                                    width: '100%', height: '100%',
                                    padding: '12px 12px 12px 4ch',
                                    background: 'transparent',
                                    color: 'transparent',
                                    caretColor: '#c9d1d9',
                                    border: 'none', outline: 'none', resize: 'none',
                                    fontFamily: 'inherit', fontSize: 'inherit',
                                    lineHeight: '1.6em',
                                    zIndex: 2,
                                    boxSizing: 'border-box',
                                }}
                            />
                        </div>

                        {/* Output */}
                        <div ref={outputRef} style={{
                            flex: 1, overflowY: 'auto', padding: '8px 12px',
                            display: 'flex', flexDirection: 'column', gap: '4px',
                        }}>
                            {entries.map(e => {
                                const colors: Record<ConsoleEntry['type'], string> = {
                                    input: '#484f58',
                                    output: '#3fb950',
                                    error: '#f85149',
                                    compile: '#58a6ff',
                                    info: '#f97316',
                                };
                                const prefixMap: Record<ConsoleEntry['type'], string> = {
                                    input: '›', output: '◈', error: '✗', compile: '⬡', info: '⚡',
                                };
                                return (
                                    <div key={e.id} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                                        <span style={{ color: colors[e.type], flexShrink: 0, fontSize: '11px' }}>{prefixMap[e.type]}</span>
                                        <pre style={{
                                            margin: 0, color: colors[e.type], fontFamily: 'inherit',
                                            fontSize: '11px', lineHeight: '1.5em', whiteSpace: 'pre-wrap',
                                            wordBreak: 'break-word', flex: 1,
                                            opacity: e.type === 'input' ? 0.4 : 1,
                                        }}>
                                            {e.type === 'input' ? `// [${e.target ?? 'run'}]\n${e.content}` : e.content}
                                        </pre>
                                        {e.durationMs && (
                                            <span style={{ color: '#484f58', fontSize: '9px', flexShrink: 0 }}>{e.durationMs.toFixed(0)}ms</span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            padding: '6px 12px',
                            borderTop: '1px solid #21262d',
                            color: '#6e7681',
                            fontSize: '10px',
                        }}>
                            <span>{activeSessionLabel}{selectedFile ? ` · ${selectedFile.path}` : ''}</span>
                            <span>{dirty ? 'modified' : 'saved'} · target {target}</span>
                        </div>
                    </div>
                </div>
            ) : (
                /* ── KAIN Source Registry view ─────────────────────────────── */
                <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
                    <div style={{ marginBottom: '12px', color: '#8b949e', fontSize: '11px' }}>
                        {sourceFiles.length} KAIN source files powering K-OS — click any to view / rebuild
                    </div>
                    {Array.from(groupedFiles.entries()).map(([domain, files]) => (
                        <div key={domain} style={{ marginBottom: '20px' }}>
                            <div style={{
                                fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase',
                                color: domainColors[domain], marginBottom: '8px', paddingBottom: '4px',
                                borderBottom: `1px solid ${domainColors[domain]}33`,
                            }}>
                                {domain} · {files.length} files
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '6px' }}>
                                {files.map(f => {
                                    const rebuilt = rebuildResults.get(f.path);
                                    const tc = TARGETS.find(t => t.id === f.target);
                                    const selected = selectedFile?.path === f.path;
                                    return (
                                        <div key={f.path} onClick={() => setSelectedFile(selected ? null : f)}
                                            style={{
                                                padding: '8px 12px', borderRadius: '6px', cursor: 'pointer',
                                                border: `1px solid ${selected ? domainColors[domain] : '#21262d'}`,
                                                background: selected ? `${domainColors[domain]}11` : '#161b22',
                                            }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                                                <span style={{ color: '#c9d1d9', fontWeight: 600, fontSize: '11px' }}>{f.label}</span>
                                                <span style={{ marginLeft: 'auto', color: tc?.color ?? '#484f58', fontSize: '9px' }}>{tc?.label}</span>
                                                {rebuilt !== undefined && (
                                                    <span style={{ color: rebuilt ? '#3fb950' : '#f85149', fontSize: '9px' }}>
                                                        {rebuilt ? '✓' : '✗'}
                                                    </span>
                                                )}
                                            </div>
                                            <div style={{ color: '#484f58', fontSize: '10px', marginBottom: '6px' }}>{f.description}</div>
                                            <div style={{ color: '#30363d', fontSize: '9px', fontFamily: 'inherit', wordBreak: 'break-all' }}>{f.path}</div>
                                            {selected && (
                                                <div style={{ marginTop: '8px', display: 'flex', gap: '6px' }}>
                                                    <button onClick={e => { e.stopPropagation(); rebuildFile(f); }} style={{
                                                        padding: '2px 8px', borderRadius: '3px', border: `1px solid ${tc?.color ?? '#484f58'}`,
                                                        background: 'transparent', color: tc?.color ?? '#484f58',
                                                        fontSize: '9px', fontFamily: 'inherit', cursor: 'pointer',
                                                    }}>
                                                        ⟳ Rebuild
                                                    </button>
                                                    <button onClick={e => {
                                                        e.stopPropagation();
                                                        setActiveView('editor');
                                                        setTarget(f.target);
                                                        setSource(`// ${f.label}\n// Source: ${f.path}\n// Target: ${f.target}\n\n// Load source via Tauri FS to edit here`);
                                                    }} style={{
                                                        padding: '2px 8px', borderRadius: '3px', border: '1px solid #21262d',
                                                        background: 'transparent', color: '#8b949e',
                                                        fontSize: '9px', fontFamily: 'inherit', cursor: 'pointer',
                                                    }}>
                                                        ⎆ Open in Editor
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const css = {}; // placeholder — using inline styles throughout
export default KAINConsole;
// @ts-nocheck
