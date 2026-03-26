
import React from 'react';
import { useKernelApp } from './lib/hooks/useKernelApp';
import { useAppSettings } from './lib/hooks/useAppSettings';
import { ALL_MODULES, WORKFLOW, CATEGORY_CONFIG } from './config/appConfig';
import KernelLauncher, { LaunchConfig } from './components/KernelLauncher';
import BootSequence from './components/BootSequence';
import AssetBrowser from './components/AssetBrowser';
import QuickMenu from '@/ui/shell/QuickMenu';
import { KOSTopBar } from '@/ui/shell/KOSTopBar';
import { KOSTopBarDirect } from '@/ui/shell/KOSTopBarDirect';
import { useQuickMenuCommands } from '@/ui/shell/quickMenuRegistry';
import { useGlobalHotkeys } from '@/lib/hooks/useGlobalHotkeys';
import { KUniversal } from '@/features/universal/KUniversal';
import { SharedViewportSessionProvider } from '@/features/viewport/sharedViewportSession';
import * as Popover from '@radix-ui/react-popover';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Hexagon, HardDrive, Activity, Skull, X, Check, Settings,
    Power, Key, Gauge, Save, FolderOpen, Maximize, Minus, Square, Monitor, Cpu, Palette,
    Command, Zap, Database, LayoutGrid, PenTool, Layers, Grid, Copy, Video
} from 'lucide-react';

import { ThemeProvider, ThemeSelector, useTheme } from '@/systems/ui';
import { topBarThemes } from '@/systems/ui/topBarThemes';
import { topBarLayouts } from '@/systems/ui/topBarLayoutConfig';
import { listenMocapInterop } from '@/services/mocapInterop';

import { getCurrentWindow } from '@tauri-apps/api/window';
import { invoke } from '@tauri-apps/api/core';
import {
    spawnLegacyWindow as _spawnLegacyWindow,
    spawnMocapWindow as _spawnMocapWindow,
    spawnZenWindow as _spawnZenWindow,
} from '@/services/windowService';

// Note: Bevy has been removed. K_OS is now a pure React/Three.js + Rust WGPU application.

// Import large UI components inline for now (can be extracted later)
// SettingsModal and AssetBrowser are very large - keeping them here for now
// but the structure is now modular and ready for further extraction

export default function App() {
    const kernel = useKernelApp();
    const settings = useAppSettings();

    const [quickMenuOpen, setQuickMenuOpen] = React.useState(false);
    const registeredQuickMenuCommands = useQuickMenuCommands();

    // ── Universal Workspace mode ───────────────────────────────────────────
    const [universalMode, setUniversalMode] = React.useState(false);
    const openMocapWindow = React.useCallback(async () => {
        try {
            await _spawnMocapWindow();
        } catch (err) {
            console.error('[K_OS] Failed to open ZenMocap window:', err);
        }
    }, []);
    const quickMenuEnabled = !settings.showLauncher;

    useGlobalHotkeys(
        React.useMemo(
            () => ({
                'ctrl+k,command+k': (e) => {
                    e.preventDefault();
                    setQuickMenuOpen(true);
                },
            }),
            []
        ),
        quickMenuEnabled
    );

    const baseQuickMenuCommands = React.useMemo(() => {
        const appCommands = ALL_MODULES.map((m: any) => ({
            id: `app:${m.id}`,
            label: m.name,
            description: 'Open app',
            icon: m.icon,
            keywords: [m.id, m.name],
            category: 'Apps',
            action: () => settings.switchModule(m.id),
        }));

        const coreCommands = [
            {
                id: 'core:open-settings',
                label: 'Open Settings',
                description: 'Configure K_OS, performance, and uplinks',
                icon: Settings,
                keywords: ['preferences', 'config'],
                category: 'Core',
                shortcut: 'Ctrl/Cmd + ,',
                action: () => settings.setIsSettingsOpen(true),
            },
            {
                id: 'core:open-asset-browser',
                label: 'Open Asset Browser',
                description: 'Browse artifacts, materials, and alphas',
                icon: HardDrive,
                keywords: ['library', 'assets', 'content'],
                category: 'Core',
                action: () => kernel.setIsAssetBrowserOpen(true),
            },
            {
                id: 'core:open-mocap',
                label: 'Open ZenMocap Window',
                description: 'Launch isolated mocap app workspace',
                icon: Video,
                keywords: ['mocap', 'capture', 'zen'],
                category: 'Core',
                action: () => openMocapWindow(),
            },
        ];

        return [...coreCommands, ...appCommands];
    }, [kernel, settings, openMocapWindow]);

    const quickMenuCommands = React.useMemo(() => {
        return [...baseQuickMenuCommands, ...registeredQuickMenuCommands];
    }, [baseQuickMenuCommands, registeredQuickMenuCommands]);

    React.useEffect(() => {
        let unlistenTakeSaved: (() => void) | undefined;
        let unlistenSessionState: (() => void) | undefined;

        void listenMocapInterop('take-saved', (payload) => {
            window.dispatchEvent(new CustomEvent('kos:mocap:take-saved', { detail: payload }));
        }).then((fn) => {
            unlistenTakeSaved = fn;
        });

        void listenMocapInterop('session-state', (payload) => {
            window.dispatchEvent(new CustomEvent('kos:mocap:session-state', { detail: payload }));
        }).then((fn) => {
            unlistenSessionState = fn;
        });

        return () => {
            unlistenTakeSaved?.();
            unlistenSessionState?.();
        };
    }, []);

    // Handle launcher completion
    const handleLaunchComplete = React.useCallback((config: LaunchConfig) => {
        // ZenMocap mode — spawn dedicated window and stay on launcher
        if (config.viewportMode === 'mocap') {
            void openMocapWindow();
            settings.setShowLauncher(false);
            return;
        }

        if (config.viewportMode === 'legacy') {
            void (async () => {
                try {
                    await _spawnLegacyWindow();
                    await getCurrentWindow().close();
                } catch (err) {
                    console.error('[K_OS] Failed to launch legacy K_OS from launcher:', err);
                }
            })();
            return;
        }

        if (config.viewportMode === 'zen') {
            void (async () => {
                try {
                    await _spawnZenWindow();
                    await getCurrentWindow().close();
                } catch (err) {
                    console.error('[K_OS] Failed to launch Zen from launcher:', err);
                }
            })();
            return;
        }

        // Universal Workspace mode
        if (config.viewportMode === 'universal') {
            setUniversalMode(true);
        } else {
            setUniversalMode(false);
            settings.setViewportMode('simple');
        }

        // Handle project type
        if (config.projectType === 'new') {
            kernel.handleNewProject();
        } else if (config.projectType === 'load' && config.projectFile) {
            kernel.handleLoadProject(config.projectFile);
        }

        // Close launcher and show main app
        settings.setShowLauncher(false);
    }, [kernel, settings, openMocapWindow]);

    // ── Boot gate ───────────────────────────────────────────────────────────
    const [bootDone, setBootDone] = React.useState(false);

    // Show unified launcher (replaces separate boot + project selector)
    if (settings.showLauncher) {
        if (!bootDone) {
            return <BootSequence onComplete={() => setBootDone(true)} />;
        }
        return (
            <KernelLauncher
                hasApiKey={settings.hasApiKey}
                kernelStatus={kernel.kernelStatus}
                kernelArtifactCount={kernel.kernelArtifacts.length}
                kernelMaterialCount={kernel.kernelMaterials.length}
                kernelAlphaCount={kernel.kernelAlphas.length}
                onOpenSettings={() => settings.setIsSettingsOpen(true)}
                onComplete={handleLaunchComplete}
            />
        );
    }

    const BridgeProps = {
        sharedState: {
            artifact: kernel.getActiveArtifactBlob(),
            materials: kernel.kernelMaterials,
            alphas: kernel.kernelAlphas,
            status: kernel.kernelStatus,
            storage: kernel.kernelArtifacts
        },
        onCommit: kernel.handleCommitToKernel,
        onMaterialCommit: kernel.handleMaterialCommit,
        onAlphaCommit: kernel.handleAlphaCommit,
        performance: settings.perfSettings,
        tempImage: kernel.tempImage,
        setTempImage: kernel.setTempImage,
        switchModule: settings.switchModule
    };

    // Legacy handlers kept for settings modal "Switch Project" button
    const handleNewProject = () => {
        kernel.handleNewProject();
        settings.setShowLauncher(false);
    };

    const handleLoadProject = async (file: File) => {
        settings.setIsProjectLoading(true);
        const success = await kernel.handleLoadProject(file);
        settings.setIsProjectLoading(false);
        if (success) {
            settings.setShowLauncher(false);
        }
    };

    const categorizedArtifacts = () => {
        const groups: Record<string, typeof kernel.kernelArtifacts> = {};
        kernel.kernelArtifacts.forEach(art => {
            const cat = CATEGORY_CONFIG[art.source] ? art.source : 'IMPORT';
            if (!groups[cat]) groups[cat] = [];
            groups[cat].push(art);
        });
        return groups;
    };

    const HypervisorCategory = ({
        groupIndex,
        shortLabel,
    }: {
        groupIndex: number;
        shortLabel: string;
    }) => {
        const group = WORKFLOW[groupIndex];
        if (!group) return null;

        const active = group.modules.some((m) => m.id === settings.activeModuleId);
        const activeName = group.modules.find((m) => m.id === settings.activeModuleId)?.name?.replace('K-', '') ?? '';

        return (
            <Popover.Root>
                <Popover.Trigger asChild>
                    <button
                        className={
                            `h-9 px-4 rounded-xl border transition-all duration-500 relative group overflow-hidden ` +
                            `${active ? 'bg-white/10 border-white/20 text-white shadow-[0_0_20px_rgba(255,255,255,0.05)]' : 'bg-white/5 border-white/5 text-white/40 hover:text-white/80 hover:border-white/20 hover:bg-white/10'}`
                        }
                        title={group.label}
                    >
                        {active && (
                            <motion.div
                                layoutId="cat-active-glow"
                                className="absolute inset-0 bg-gradient-to-tr from-white/5 to-transparent opacity-50"
                            />
                        )}
                        <span className="flex items-center gap-2 relative z-10 transition-transform duration-500 group-hover:scale-105">
                            <span className={`text-[10px] font-black tracking-[0.2em] transition-colors duration-500 ${active ? group.color : 'text-inherit'}`}>{shortLabel}</span>
                            {activeName ? (
                                <span className="text-[10px] font-bold tracking-wider text-white opacity-60">{activeName}</span>
                            ) : null}
                        </span>
                        {active && (
                            <motion.div
                                className="absolute bottom-0 inset-x-3 h-[2px] bg-current opacity-50 overflow-hidden"
                                layoutId="cat-underline"
                            />
                        )}
                    </button>
                </Popover.Trigger>

                <Popover.Portal>
                    <Popover.Content
                        sideOffset={10}
                        align="start"
                        className="z-[200] w-[340px] rounded-xl border border-white/10 bg-[#0b0b0b] p-2 shadow-2xl"
                    >
                        <div className="px-2 py-2">
                            <div className="flex items-center justify-between">
                                <div className={`text-[10px] font-black tracking-[0.25em] ${group.color}`}>{group.label}</div>
                                <div className="text-[10px] font-mono text-gray-500">{group.modules.length}</div>
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2 p-2">
                            {group.modules.map((mod) => {
                                const selected = settings.activeModuleId === mod.id;
                                const Icon = mod.icon as any;

                                return (
                                    <button
                                        key={mod.id}
                                        onClick={() => settings.switchModule(mod.id)}
                                        className={
                                            `h-12 rounded-lg border px-2 text-left transition-all ` +
                                            `${selected ? 'bg-white/10 border-white/20' : 'bg-[#070707] border-[#222] hover:border-[#333] hover:bg-white/5'}`
                                        }
                                    >
                                        <div className="flex items-center gap-2">
                                            {Icon ? <Icon size={14} className={selected ? group.color : 'text-gray-500'} /> : null}
                                            <div className="min-w-0">
                                                <div className={`text-[10px] font-black tracking-wider ${selected ? group.color : 'text-gray-300'}`}>
                                                    {mod.name.replace('K-', '')}
                                                </div>
                                                <div className="text-[9px] text-gray-600 truncate">{mod.id}</div>
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>

                        <Popover.Arrow className="fill-[#0b0b0b]" />
                    </Popover.Content>
                </Popover.Portal>
            </Popover.Root>
        );
    };





    return (
        <SharedViewportSessionProvider>
            <ThemeProvider appId={settings.activeModuleId || 'default'}>
                {/* Main app container - now uses theme CSS variables */}
                <div className="w-screen h-screen text-[color:var(--kos-text-primary)] overflow-hidden flex flex-col relative bg-[color:var(--kos-surface-primary)] kos-theme-transition">

                {/* ProjectSelector removed - replaced by unified KernelLauncher */}

                {/* K-OS TOP BAR - Layout-based rendering */}
                {settings.topBarLayout === 'direct' ? (
                    /* NEW: Direct Access Layout - All apps visible */
                    <KOSTopBarDirect
                        theme={topBarThemes.find(t => t.id === settings.topBarThemeId) || topBarThemes[0]}
                        activeModuleId={settings.activeModuleId}
                        onModuleSwitch={settings.switchModule}
                        onSettingsOpen={() => settings.setIsSettingsOpen(true)}
                        onKernelOpen={kernel.openAssetBrowser}
                        onSearchOpen={() => setQuickMenuOpen(true)}
                        kernelCount={kernel.kernelArtifacts.length}
                        kernelStatus={kernel.kernelStatus}
                    />
                ) : (
                    /* LEGACY: Workflow Layout - Grouped with dropdowns */
                    <KOSTopBar
                        viewportMode={'simple'}
                        setViewportMode={() => { }}
                        onSettingsOpen={() => settings.setIsSettingsOpen(true)}
                        onKernelOpen={kernel.openAssetBrowser}
                        kernelCount={kernel.kernelArtifacts.length}
                        kernelStatus={kernel.kernelStatus}
                        mode={settings.topBarMode}
                        themeId={settings.topBarThemeId}
                    >
                        {settings.topBarMode === 'workflow' ? (
                            <>
                                {/* LEFT GROUP: CREATION */}
                                <div className="flex items-center gap-2 p-1 bg-black/20 backdrop-blur-md rounded-full border border-white/5">
                                    <div className="flex items-center px-1">
                                        <HypervisorCategory groupIndex={0} shortLabel="MODEL" />
                                    </div>
                                    <div className="flex items-center px-1">
                                        <HypervisorCategory groupIndex={1} shortLabel="UV" />
                                    </div>
                                    <div className="flex items-center px-1">
                                        <HypervisorCategory groupIndex={2} shortLabel="SURF" />
                                    </div>
                                </div>

                                {/* RIGHT GROUP: SIMULATION */}
                                <div className="flex items-center gap-2 p-1 bg-black/20 backdrop-blur-md rounded-full border border-white/5">
                                    <div className="flex items-center px-1">
                                        <HypervisorCategory groupIndex={3} shortLabel="ANIM" />
                                    </div>
                                    <div className="flex items-center px-1">
                                        <HypervisorCategory groupIndex={5} shortLabel="SIM" />
                                    </div>
                                    <div className="flex items-center px-1">
                                        <HypervisorCategory groupIndex={4} shortLabel="RENDER" />
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="flex items-center gap-1.5 p-1.5 bg-black/30 backdrop-blur-xl rounded-2xl border border-white/5 shadow-inner max-w-full overflow-x-auto no-scrollbar">
                                {ALL_MODULES.map((mod) => {
                                    const active = mod.id === settings.activeModuleId;
                                    const Icon = mod.icon as any;
                                    return (
                                        <motion.button
                                            key={mod.id}
                                            onClick={() => settings.switchModule(mod.id)}
                                            className={`
                                                relative flex items-center gap-2 px-3 h-10 rounded-xl transition-all duration-300 group
                                                ${active ? 'bg-white/5 text-white' : 'text-white/30 hover:text-white/70 hover:bg-white/5'}
                                            `}
                                            whileHover={{ y: -2 }}
                                            whileTap={{ scale: 0.96 }}
                                        >
                                            {active && (
                                                <motion.div
                                                    layoutId="active-pill"
                                                    className="absolute inset-0 bg-white/5 rounded-xl border border-white/10"
                                                    transition={{ type: "spring", bounce: 0.3, duration: 0.6 }}
                                                />
                                            )}
                                            <div className="relative">
                                                <Icon size={16} className={`relative z-10 transition-colors duration-300 ${active ? 'text-[color:var(--kos-accent-primary)]' : 'group-hover:text-white'}`} />
                                                {active && (
                                                    <motion.div
                                                        className="absolute inset-0 blur-md opacity-50"
                                                        style={{ background: 'var(--kos-accent-primary)' }}
                                                        layoutId="icon-glow"
                                                    />
                                                )}
                                            </div>
                                            <span className={`relative z-10 text-[10px] font-black tracking-[0.2em] transition-all duration-300 ${active ? 'opacity-100 max-w-[100px]' : 'opacity-0 max-w-0 group-hover:opacity-100 group-hover:max-w-[100px] overflow-hidden'}`}>
                                                {mod.name.replace('K-', '')}
                                            </span>
                                            {active && (
                                                <motion.div
                                                    className="absolute -bottom-1.5 inset-x-4 h-[3px] bg-[color:var(--kos-accent-primary)] rounded-full"
                                                    layoutId="active-bar"
                                                    transition={{ type: "spring", bounce: 0.4, duration: 0.8 }}
                                                />
                                            )}
                                        </motion.button>
                                    );
                                })}
                            </div>
                        )}

                        {/* ⚡ Universal Workspace quick-access button */}
                        <motion.button
                            onClick={() => setUniversalMode(v => !v)}
                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[9px] font-mono font-bold
                                        border transition-all duration-200 ml-4 ${universalMode
                                    ? 'bg-orange-500/20 border-orange-500/50 text-orange-300 shadow-[0_0_8px_rgba(251,146,60,0.3)]'
                                    : 'bg-white/[0.03] border-white/[0.08] text-white/40 hover:text-orange-300 hover:border-orange-500/30'
                                }`}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.97 }}
                            title="Toggle Universal Workspace (Blender-style multi-panel)"
                        >
                            <Zap size={10} />
                            UNIVERSAL
                        </motion.button>
                        <motion.button
                            onClick={() => void openMocapWindow()}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[9px] font-mono font-bold
                                        border transition-all duration-200 ml-2 bg-cyan-500/10 border-cyan-500/30 text-cyan-300
                                        hover:bg-cyan-500/20 hover:border-cyan-400/50"
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.97 }}
                            title="Open ZenMocap dedicated window"
                        >
                            <Video size={10} />
                            MOCAP
                        </motion.button>
                    </KOSTopBar>
                )}
                {/* MODULE VIEWPORT — animated transition on tool switch */}
                {/* UNIVERSAL WORKSPACE — full takeover when universalMode is active */}
                <AnimatePresence>
                    {universalMode && (
                        <motion.div
                            key="universal"
                            className="absolute inset-0 z-[60]"
                            initial={{ opacity: 0, scale: 0.98 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.98 }}
                            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                        >
                            <KUniversal
                                sharedState={BridgeProps.sharedState}
                                bridgeProps={BridgeProps}
                                onExit={() => setUniversalMode(false)}
                            />
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* SETTINGS MODAL - Keeping inline for now due to size */}
                {settings.isSettingsOpen && (
                    <div className="absolute inset-0 z-[100] bg-black/60 backdrop-blur-xl flex items-center justify-center animate-in fade-in duration-200">
                        <div className="w-[550px] bg-[#0a0a0a] border border-[#333] rounded-2xl shadow-2xl overflow-hidden relative">
                            <button onClick={() => settings.setIsSettingsOpen(false)} className="absolute top-4 right-4 text-gray-500 hover:text-white"><X size={20} /></button>

                            <div className="p-6 border-b border-[#222] bg-gradient-to-r from-[#0a0a0a] to-[#111]">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="p-2 rounded-lg bg-[#00ffcc]/10 border border-[#00ffcc]/30">
                                        <Settings size={24} className="text-[#00ffcc]" />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-black text-white tracking-widest">KIPP ENGINE CONFIG</h2>
                                        <p className="text-[10px] text-gray-500 font-mono">v9.0.2 // SECURE HYPERVISOR</p>
                                    </div>
                                </div>
                            </div>

                            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                                {/* API CONFIG */}
                                <div className="flex items-center justify-between p-4 bg-[#111] rounded-xl border border-[#222]">
                                    <div className="flex items-center gap-4">
                                        <div className={`p-3 rounded-full ${settings.hasApiKey ? 'bg-purple-500/20 text-purple-400' : 'bg-gray-800 text-gray-500'}`}>
                                            <Key size={20} />
                                        </div>
                                        <div>
                                            <div className="text-sm font-bold text-gray-200">API UPLINK</div>
                                            <div className="text-[10px] text-gray-500 mt-0.5">{settings.hasApiKey ? "SECURE CONNECTION ACTIVE" : "DISCONNECTED"}</div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={settings.handleConnectApi}
                                        className={`px-4 py-2 rounded text-[10px] font-bold border transition-all ${settings.hasApiKey ? 'bg-purple-900/20 border-purple-500 text-purple-400' : 'bg-gray-800 border-gray-600 text-gray-400 hover:text-white'}`}
                                    >
                                        {settings.hasApiKey ? "CONNECTED" : "CONNECT KEY"}
                                    </button>
                                </div>

                                {/* PERFORMANCE TUNING */}
                                <div className="p-4 bg-[#111] rounded-xl border border-[#222] space-y-4">
                                    <div className="flex items-center gap-4 border-b border-[#222] pb-3 mb-2">
                                        <div className={`p-3 rounded-full bg-blue-500/20 text-blue-400`}>
                                            <Gauge size={20} />
                                        </div>
                                        <div>
                                            <div className="text-sm font-bold text-gray-200">HYPERVISOR PERFORMANCE</div>
                                            <div className="text-[10px] text-gray-500 mt-0.5">Optimize engine throughput vs fidelity</div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-3 gap-2">
                                        {['ECO', 'BALANCED', 'ULTRA'].map((m) => (
                                            <button
                                                key={m}
                                                onClick={() => settings.applyPerfPreset(m as any)}
                                                className={`py-2 text-[10px] font-bold border rounded transition-all ${settings.perfSettings.mode === m ? 'bg-blue-600 text-white border-blue-500' : 'bg-[#1a1a1a] border-[#333] text-gray-500 hover:text-white'}`}
                                            >
                                                {m}
                                            </button>
                                        ))}
                                    </div>

                                    <div className="space-y-3">
                                        <div className="space-y-1">
                                            <div className="flex justify-between text-[10px] text-gray-400 font-bold">
                                                <span>RESOLUTION SCALE</span>
                                                <span className="text-blue-400">{settings.perfSettings.resolution.toFixed(2)}x</span>
                                            </div>
                                            <input
                                                type="range" min="0.25" max="2.0" step="0.25"
                                                value={settings.perfSettings.resolution}
                                                onChange={(e) => settings.setPerfSettings({ ...settings.perfSettings, resolution: parseFloat(e.target.value), mode: 'CUSTOM' })}
                                                className="w-full h-1 bg-[#222] rounded-lg appearance-none accent-blue-500"
                                            />
                                        </div>

                                        <div className="grid grid-cols-2 gap-2">
                                            <button onClick={() => settings.setPerfSettings({ ...settings.perfSettings, shadows: !settings.perfSettings.shadows, mode: 'CUSTOM' })} className={`py-2 px-3 rounded text-[9px] font-bold border flex justify-between items-center transition-all ${settings.perfSettings.shadows ? 'bg-blue-900/20 border-blue-500 text-blue-400' : 'bg-[#1a1a1a] border-[#333] text-gray-500'}`}>
                                                SHADOWS {settings.perfSettings.shadows ? <Check size={12} /> : <X size={12} />}
                                            </button>
                                            <button onClick={() => settings.setPerfSettings({ ...settings.perfSettings, postFX: !settings.perfSettings.postFX, mode: 'CUSTOM' })} className={`py-2 px-3 rounded text-[9px] font-bold border flex justify-between items-center transition-all ${settings.perfSettings.postFX ? 'bg-blue-900/20 border-blue-500 text-blue-400' : 'bg-[#1a1a1a] border-[#333] text-gray-500'}`}>
                                                POST-FX {settings.perfSettings.postFX ? <Check size={12} /> : <X size={12} />}
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* HEADER CONFIGURATION */}
                                <div className="p-4 bg-[#111] rounded-xl border border-[#222] space-y-4">
                                    <div className="flex items-center gap-4 border-b border-[#222] pb-3 mb-2">
                                        <div className={`p-3 rounded-full bg-orange-500/20 text-orange-400`}>
                                            <LayoutGrid size={20} />
                                        </div>
                                        <div>
                                            <div className="text-sm font-bold text-gray-200">HEADER CONFIGURATION</div>
                                            <div className="text-[10px] text-gray-500 mt-0.5">Customize shell layout and aesthetics</div>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        {/* TOP BAR LAYOUT STYLE - NEW */}
                                        <div className="space-y-2">
                                            <div className="text-[10px] font-bold text-gray-400">LAYOUT STYLE</div>
                                            <div className="grid grid-cols-2 gap-2">
                                                {topBarLayouts.map((layout) => (
                                                    <button
                                                        key={layout.id}
                                                        onClick={() => settings.setTopBarLayout(layout.id)}
                                                        className={`p-3 rounded-xl border text-left transition-all relative overflow-hidden group ${settings.topBarLayout === layout.id
                                                            ? 'border-cyan-500/50 bg-cyan-500/10'
                                                            : 'border-[#222] bg-[#0a0a0a] hover:border-[#333]'
                                                            }`}
                                                    >
                                                        <div className="flex items-center gap-2 mb-1">
                                                            {layout.id === 'direct' ? (
                                                                <LayoutGrid size={14} className={settings.topBarLayout === layout.id ? 'text-cyan-400' : 'text-gray-500'} />
                                                            ) : (
                                                                <Layers size={14} className={settings.topBarLayout === layout.id ? 'text-cyan-400' : 'text-gray-500'} />
                                                            )}
                                                            <span className={`text-[10px] font-black ${settings.topBarLayout === layout.id ? 'text-cyan-400' : 'text-white'}`}>
                                                                {layout.name.toUpperCase()}
                                                            </span>
                                                        </div>
                                                        <div className="text-[8px] text-gray-600 group-hover:text-gray-400 transition-colors leading-tight">
                                                            {layout.description}
                                                        </div>
                                                        {settings.topBarLayout === layout.id && (
                                                            <div className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-cyan-500 shadow-[0_0_8px_#06b6d4]" />
                                                        )}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Only show workflow sub-options when using workflow layout */}
                                        {settings.topBarLayout === 'workflow' && (
                                            <div className="flex items-center justify-between p-2 bg-[#0a0a0a] rounded-lg border border-[#222]">
                                                <div className="text-[10px] font-bold text-gray-400">NAVIGATION MODE</div>
                                                <div className="flex bg-[#0a0a0a] rounded-lg p-1 border border-[#222]">
                                                    <button
                                                        onClick={() => settings.setTopBarMode('workflow')}
                                                        className={`px-3 py-1.5 rounded-md text-[9px] font-black transition-all ${settings.topBarMode === 'workflow' ? 'bg-[#222] text-white' : 'text-gray-600 hover:text-gray-400'}`}
                                                    >
                                                        WORKFLOW
                                                    </button>
                                                    <button
                                                        onClick={() => settings.setTopBarMode('app')}
                                                        className={`px-3 py-1.5 rounded-md text-[9px] font-black transition-all ${settings.topBarMode === 'app' ? 'bg-orange-500 text-white' : 'text-gray-600 hover:text-gray-400'}`}
                                                    >
                                                        APP-CENTRIC
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        <div className="space-y-2">
                                            <div className="text-[10px] font-bold text-gray-400">HEADER THEME</div>
                                            <div className="grid grid-cols-2 gap-2">
                                                {topBarThemes.map((t) => (
                                                    <button
                                                        key={t.id}
                                                        onClick={() => settings.setTopBarThemeId(t.id)}
                                                        className={`p-3 rounded-xl border text-left transition-all relative overflow-hidden group ${settings.topBarThemeId === t.id ? 'border-orange-500/50 bg-orange-500/5' : 'border-[#222] bg-[#0a0a0a] hover:border-[#333]'}`}
                                                    >
                                                        <div className="text-[10px] font-black text-white">{t.name.toUpperCase()}</div>
                                                        <div className="text-[8px] text-gray-600 group-hover:text-gray-400 transition-colors">{t.description}</div>
                                                        {settings.topBarThemeId === t.id && (
                                                            <div className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-orange-500 shadow-[0_0_8px_#f97316]" />
                                                        )}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* EXPERIMENTAL: TOP PANEL TRANSITION - Easy to remove: delete this block */}
                                <div className="flex items-center justify-between p-4 bg-[#111] rounded-xl border border-[#222] border-dashed opacity-70 hover:opacity-100 transition-opacity">
                                    <div className="flex items-center gap-4">
                                        <div className={`p-3 rounded-full ${settings.topPanelTransition ? 'bg-purple-500/20 text-purple-400' : 'bg-gray-800 text-gray-500'}`}>
                                            <Activity size={20} />
                                        </div>
                                        <div>
                                            <div className="text-sm font-bold text-gray-200">TOP PANEL TRANSITION</div>
                                            <div className="text-[10px] text-gray-500 mt-0.5">Experimental: Animate header when switching modes</div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => settings.setTopPanelTransition(!settings.topPanelTransition)}
                                        className={`w-12 h-6 rounded-full p-1 transition-all ${settings.topPanelTransition ? 'bg-purple-500' : 'bg-[#333]'}`}
                                    >
                                        <div className={`w-4 h-4 bg-black rounded-full shadow transition-transform ${settings.topPanelTransition ? 'translate-x-6' : 'translate-x-0'}`} />
                                    </button>
                                </div>

                                {/* THEME SELECTOR */}
                                <div className="p-4 bg-[#111] rounded-xl border border-[#222] space-y-4">
                                    <div className="flex items-center gap-4 border-b border-[#222] pb-3 mb-2">
                                        <div className="p-3 rounded-full bg-violet-500/20 text-violet-400">
                                            <Palette size={20} />
                                        </div>
                                        <div>
                                            <div className="text-sm font-bold text-gray-200">UI THEME</div>
                                            <div className="text-[10px] text-gray-500 mt-0.5">Customize the visual style of K_OS apps</div>
                                        </div>
                                    </div>
                                    <ThemeSelector mode="global" />
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        onClick={kernel.handleSaveProject}
                                        className="p-3 bg-[#111] hover:bg-[#222] rounded-lg border border-[#222] flex items-center justify-center gap-2 transition-all hover:border-[#00ffcc]/50 group"
                                    >
                                        <Save size={16} className="text-gray-400 group-hover:text-[#00ffcc]" />
                                        <span className="text-xs font-bold text-gray-300 group-hover:text-white">SAVE PROJECT</span>
                                    </button>

                                    <button
                                        onClick={() => { settings.setShowLauncher(true); settings.setIsSettingsOpen(false); }}
                                        className="p-3 bg-[#111] hover:bg-[#222] rounded-lg border border-[#222] flex items-center justify-center gap-2 transition-all hover:border-purple-500/50 group"
                                    >
                                        <FolderOpen size={16} className="text-gray-400 group-hover:text-purple-400" />
                                        <span className="text-xs font-bold text-gray-300 group-hover:text-white">SWITCH PROJECT</span>
                                    </button>
                                </div>

                                <div className="text-[9px] text-gray-600 text-center font-mono pt-4 border-t border-[#222]">
                                    kipp engine // 0.5 alpha
                                </div>
                            </div>
                        </div>
                    </div>
                )
                }

                <AssetBrowser
                    isOpen={kernel.isAssetBrowserOpen}
                    browserTab={kernel.browserTab}
                    artifacts={kernel.kernelArtifacts}
                    materials={kernel.kernelMaterials}
                    alphas={kernel.kernelAlphas}
                    selectedArtifactIds={kernel.selectedArtifactIds}
                    activeArtifactId={kernel.activeArtifactId}
                    previewArtifactId={kernel.previewArtifactId}
                    isImporting={kernel.isImporting}
                    isMerging={kernel.isMerging}
                    openFolders={kernel.openFolders}
                    onClose={() => kernel.setIsAssetBrowserOpen(false)}
                    onTabChange={kernel.setBrowserTab}
                    onToggleFolder={(cat) => kernel.setOpenFolders(prev => ({ ...prev, [cat]: !prev[cat] }))}
                    onArtifactClick={kernel.setPreviewArtifactId}
                    onArtifactSelect={kernel.toggleArtifactSelection}
                    onArtifactWeld={kernel.toggleArtifactWeld}
                    onArtifactDownload={kernel.handleDownloadArtifact}
                    onArtifactDelete={kernel.handleDeleteArtifact}
                    onMountArtifact={kernel.setActiveArtifactId}
                    onUnmountArtifact={() => kernel.setActiveArtifactId(null)}
                    onDeselectAll={() => kernel.setSelectedArtifactIds([])}
                    onMerge={kernel.handleMergeArtifacts}
                    onImport={kernel.processFileImport}
                    onAlphaImport={kernel.processAlphaImport}
                    onSketchfabImport={kernel.handleSketchfabImport}
                    onMaterialDelete={kernel.handleDeleteMaterial}
                    onAlphaDelete={kernel.handleDeleteAlpha}
                    sketchfabToken={kernel.sketchfabToken}
                    onUpdateSketchfabToken={kernel.updateSketchfabToken}
                />

                <QuickMenu
                    open={quickMenuOpen}
                    onOpenChange={setQuickMenuOpen}
                    commands={quickMenuCommands as any}
                />

                {/* ACTIVE LOGIC LAYER */}
                <main className="flex-1 relative bg-transparent overflow-hidden">
                    {ALL_MODULES.map(mod => {
                        const isActive = mod.id === settings.activeModuleId;

                        // Simple mount logic: only render the active module
                        // KObjectRegistry now handles persistent object state across app switches
                        if (!isActive) return null;

                        let Component: React.ElementType = mod.component as React.ElementType;

                        return (
                            <div
                                key={mod.id}
                                className="absolute inset-0 w-full h-full"
                            >
                                <Component {...BridgeProps} performance={settings.perfSettings} />
                            </div>
                        );
                    })}
                </main>

                {/* GLOBAL CONTENT BROWSER */}
                <GlobalContentBrowserBridge kernel={kernel} settings={settings} />
                </div>
            </ThemeProvider>
        </SharedViewportSessionProvider>
    );
}

// Extract bridge to keep main App clean/performant
import KContentBrowser from '@/ui/KContentBrowser/KContentBrowser';
import { useContentBrowser } from '@/ui/KContentBrowser/useContentBrowser';
import { KObject, kObjectRegistry } from '@/systems/objects/KObjectRegistry';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import * as THREE from 'three';

function GlobalContentBrowserBridge({ kernel, settings }: { kernel: any, settings: any }) {
    const { isOpen, close, toggle } = useContentBrowser();

    const handleOpenInApp = (appId: string, item: any) => {
        // Switch Module
        settings.setActiveModuleId(appId);

        // TODO: Signal the app to load this item?
        // For now, user can drag-drop once in the app, or we can add a 'pendingLoad' state later.

        close();
    };

    const handleDelete = (item: any) => {
        // Handle both scene objects (KObject) and storage artifacts
        if (item.kId) {
            // Scene object - just log for now (could remove from registry)
            console.log('Delete scene object:', item.kId);
        } else if (item.type === 'MESH' || item.id) {
            kernel.handleDeleteArtifact(item.id, { stopPropagation: () => { } });
        } else if (item.type === 'MAT') {
            kernel.handleDeleteMaterial(item.id);
        } else if (item.type === 'ALPHA') {
            kernel.handleDeleteAlpha(item.id);
        }
    };

    /**
     * Delete a scene object - removes from scene and unregisters from KObjectRegistry
     */
    const handleDeleteSceneObject = React.useCallback((kObject: KObject) => {
        console.log('[DeleteSceneObject] Deleting:', kObject.kId, kObject.name);

        // Broadcast delete event so the owning app can clean up the THREE.js mesh
        const event = new CustomEvent('kos-delete-scene-object', {
            detail: {
                kId: kObject.kId,
                threeUuid: kObject.threeUuid,
                name: kObject.name
            }
        });
        window.dispatchEvent(event);

        // Unregister from KObjectRegistry (soft delete)
        kObjectRegistry.delete(kObject.kId);

        kernel.setKernelStatus(`DELETED: ${kObject.name}`);
    }, [kernel]);

    /**
     * Save a scene object (from KObjectRegistry) to persistent storage.
     * Exports the THREE.js mesh as GLB and commits to kernel artifacts.
     */
    const handleSaveToStorage = React.useCallback(async (kObject: KObject) => {
        if (!kObject.threeUuid) {
            console.error('[SaveToStorage] No THREE uuid for object:', kObject.kId);
            return;
        }

        // Find the THREE.js object by uuid
        // This requires access to the active scene - we'll use window.kObjectRegistry approach
        // The actual mesh reference needs to come from the app that owns it

        // For now, we'll use a global scene traversal approach
        // In production, apps should expose their scenes or we use a scene registry

        try {
            kernel.setKernelStatus('SAVING TO STORAGE...');

            // Use a simple approach: broadcast a custom event that apps can listen to
            const event = new CustomEvent('kos-save-to-storage', {
                detail: {
                    kId: kObject.kId,
                    threeUuid: kObject.threeUuid,
                    name: kObject.name,
                    callback: async (mesh: THREE.Mesh) => {
                        if (!mesh) {
                            kernel.setKernelStatus('SAVE FAILED - MESH NOT FOUND');
                            return;
                        }

                        const exporter = new GLTFExporter();
                        exporter.parse(
                            mesh,
                            (gltf) => {
                                const blob = new Blob([gltf as ArrayBuffer], { type: 'application/octet-stream' });
                                kernel.handleCommitToKernel(blob, kObject.createdBy || 'KScene');
                                kernel.setKernelStatus(`SAVED: ${kObject.name}`);
                            },
                            (error) => {
                                console.error('[SaveToStorage] Export error:', error);
                                kernel.setKernelStatus('SAVE FAILED');
                            },
                            { binary: true }
                        );
                    }
                }
            });
            window.dispatchEvent(event);

        } catch (error) {
            console.error('[SaveToStorage] Error:', error);
            kernel.setKernelStatus('SAVE FAILED');
        }
    }, [kernel]);

    // Inject standard primitives when in advanced mode
    const displayArtifacts = React.useMemo(() => {
        return kernel.kernelArtifacts;
    }, [kernel.kernelArtifacts]);

    return (
        <KContentBrowser
            isOpen={isOpen}
            onClose={close}
            onDropAsset={(item: any) => {
                console.log("Double Clicked Asset:", item);
            }}
            onImport={kernel.processFileImport}
            onSaveToStorage={handleSaveToStorage}
            onDeleteSceneObject={handleDeleteSceneObject}
            artifacts={displayArtifacts}
            materials={kernel.kernelMaterials}
            alphas={kernel.kernelAlphas}
            onOpenInApp={handleOpenInApp}
            onDelete={handleDelete}
        />
    );
}
