import React, { useState, useRef } from 'react';
import {
    Grid, Sliders, Palette, Video, Activity,
} from 'lucide-react';

import { AppShell } from '@mocap/shared/shell/AppShell';
import { DockTab } from '@mocap/shared/shell/DockPanel';
import TopBar from './ui/TopBar';
import { LibraryTab, SimulationTab } from './ui/LeftPanel';
import { OpticsTab, ExportTab } from './ui/RightPanel';
import KQuantumEngine from './KQuantumEngine';
import { AppMenuBar } from '@mocap/shared/shell/AppMenuBar';

export default function KQuantum() {
    // --- STATE ---
    const [appMode, setAppMode] = useState<'QUANTUM' | 'CHRONOS'>('QUANTUM');
    const [isPlaying, setIsPlaying] = useState(true);
    const [status, setStatus] = useState("K-QUANTUM: READY");

    // Sim Params - CORE
    const [simRes, setSimRes] = useState(256);
    const [mode, setMode] = useState(0); // 0 = Zero-Point
    const [speed, setSpeed] = useState(1.0);
    const [chaos, setChaos] = useState(1.0);
    const [damping, setDamping] = useState(0.96);
    const [highFidelity, setHighFidelity] = useState(false);
    const [fluidSimEnabled, setFluidSimEnabled] = useState(false);

    // Sim Params - PARTICLE LIFE
    const [particleLifeEnabled, setParticleLifeEnabled] = useState(false); // OFF = immortal particles
    const [lifeDecayRate, setLifeDecayRate] = useState(0.005);
    const [respawnBounds, setRespawnBounds] = useState(100.0);

    // Sim Params - FORCES
    const [forceMultiplier, setForceMultiplier] = useState(1.0);
    const [curlStrength, setCurlStrength] = useState(1.0);
    const [centerPull, setCenterPull] = useState(0.0); // 0 = no center gravity
    const [maxVelocity, setMaxVelocity] = useState(50.0);

    // Debug
    const [showDebug, setShowDebug] = useState(false);


    // Modifiers
    const [activeModifiers, setActiveModifiers] = useState<string[]>([]);
    const [modParams, setModParams] = useState<any>({});

    // Optics
    const [colorHex, setColorHex] = useState("#00ffcc");
    const [color2Hex, setColor2Hex] = useState("#ff00cc");
    const [colorMode, setColorMode] = useState(0);
    const [pointSize, setPointSize] = useState(1.0);
    const [opacity, setOpacity] = useState(0.8);
    const [gradientStrength, setGradientStrength] = useState(1.0);
    const [aberration, setAberration] = useState(1.0);
    const [decay, setDecay] = useState(0.90);
    const [distortion, setDistortion] = useState(0.0);
    const [bloomIntensity, setBloomIntensity] = useState(1.5);
    const [bloomThreshold, setBloomThreshold] = useState(0.3);
    const [currentPalette, setCurrentPalette] = useState('COSMIC');

    // Audio
    const [audioSensitivity, setAudioSensitivity] = useState({ bass: 1.0, high: 1.0, vol: 0.5 });

    // Export
    const [recResolution, setRecResolution] = useState('WINDOW');
    const [isRecording, setIsRecording] = useState(false);

    // Refs
    const engineRef = useRef<any>(null);

    // --- ACTIONS ---
    const handleAudioUpload = (e: any) => {
        // Basic stub - implementation would go here or be passed to engine
        setStatus("AUDIO LOADED");
    };

    const handleReset = () => {
        setMode(0);
        setSpeed(1.0);
        setChaos(1.0);
        setDamping(0.96);
        setActiveModifiers([]);
        setStatus("SIMULATION RESET");
    };

    const exportGLB = () => {
        if (!engineRef.current) return;
        // Logic would be here, utilizing engineRef
        setStatus("EXPORTING GLB...");
        setTimeout(() => setStatus("GLB EXPORTED"), 1000);
    };

    const exportOBJ = () => {
        if (!engineRef.current) return;
        setStatus("EXPORTING OBJ...");
        setTimeout(() => setStatus("OBJ EXPORTED"), 1000);
    };

    const toggleRecording = () => {
        setIsRecording(!isRecording);
        setStatus(isRecording ? "RECORDING STOPPED" : "RECORDING STARTED");
    };

    // --- TABS CONFIG ---
    const leftTabs: DockTab[] = [
        {
            id: 'library',
            label: 'LIBRARY',
            icon: Grid,
            content: <LibraryTab currentMode={mode} setMode={setMode} />
        },
        {
            id: 'sim',
            label: 'SIMULATION',
            icon: Sliders,
            content: <SimulationTab
                simRes={simRes} setSimRes={setSimRes}
                speed={speed} setSpeed={setSpeed}
                chaos={chaos} setChaos={setChaos}
                damping={damping} setDamping={setDamping}
                fluidSimEnabled={fluidSimEnabled} setFluidSimEnabled={setFluidSimEnabled}
                // Particle Life
                particleLifeEnabled={particleLifeEnabled} setParticleLifeEnabled={setParticleLifeEnabled}
                lifeDecayRate={lifeDecayRate} setLifeDecayRate={setLifeDecayRate}
                respawnBounds={respawnBounds} setRespawnBounds={setRespawnBounds}
                // Forces
                forceMultiplier={forceMultiplier} setForceMultiplier={setForceMultiplier}
                curlStrength={curlStrength} setCurlStrength={setCurlStrength}
                centerPull={centerPull} setCenterPull={setCenterPull}
                maxVelocity={maxVelocity} setMaxVelocity={setMaxVelocity}
                // Modifiers
                activeModifiers={activeModifiers} setActiveModifiers={setActiveModifiers}
                modParams={modParams} setModParams={setModParams}
                audioSensitivity={audioSensitivity} setAudioSensitivity={setAudioSensitivity}
                handleAudioUpload={handleAudioUpload}
            />
        }
    ];

    const rightTabs: DockTab[] = [
        {
            id: 'optics',
            label: 'OPTICS',
            icon: Palette,
            content: <OpticsTab
                colorHex={colorHex} setColorHex={setColorHex}
                color2Hex={color2Hex} setColor2Hex={setColor2Hex}
                colorMode={colorMode} setColorMode={setColorMode}
                pointSize={pointSize} setPointSize={setPointSize}
                opacity={opacity} setOpacity={setOpacity}
                gradientStrength={gradientStrength} setGradientStrength={setGradientStrength}
                aberration={aberration} setAberration={setAberration}
                decay={decay} setDecay={setDecay}
                distortion={distortion} setDistortion={setDistortion}
                highFidelity={highFidelity} setHighFidelity={setHighFidelity}
                bloomIntensity={bloomIntensity} setBloomIntensity={setBloomIntensity}
                bloomThreshold={bloomThreshold} setBloomThreshold={setBloomThreshold}
                currentPalette={currentPalette} setCurrentPalette={setCurrentPalette}
            />
        },
        {
            id: 'export',
            label: 'EXPORT',
            icon: Video,
            content: <ExportTab
                appMode={appMode}
                isRecording={isRecording} toggleRecording={toggleRecording}
                exportGLB={exportGLB} exportOBJ={exportOBJ}
                recResolution={recResolution} setRecResolution={setRecResolution}
                status={status}
            />
        }
    ];

    // --- RENDER ---
    return (
        <AppShell
            menuBar={<AppMenuBar />}
            topBar={
                <TopBar
                    appMode={appMode} setAppMode={setAppMode}
                    isPlaying={isPlaying} togglePlay={() => setIsPlaying(!isPlaying)}
                    handleReset={handleReset}
                    highFidelity={highFidelity} setHighFidelity={setHighFidelity}
                />
            }
            left={{ tabs: leftTabs, defaultSize: 20, defaultTabId: 'library' }}
            right={{ tabs: rightTabs, defaultSize: 20, defaultTabId: 'optics' }}
            bottom={undefined}
            bottomHeight={0}
        >
            <div className="relative w-full h-full bg-black">
                <KQuantumEngine
                    simRes={simRes} // Use the state!
                    mode={mode}
                    speed={speed}
                    chaos={chaos}
                    damping={damping}
                    pointSize={pointSize}
                    opacity={opacity}
                    colorHex={colorHex}
                    color2Hex={color2Hex}
                    colorMode={colorMode}
                    gradientStrength={gradientStrength}
                    highFidelity={highFidelity}
                    autoOrbit={!isPlaying} // Example logic: auto-orbit when paused? Or separate state.
                    aberration={aberration}
                    distortion={distortion}
                    decay={decay}
                    activeModifiers={activeModifiers}
                    modParams={modParams}
                    userScript=""
                    isScriptActive={false}
                    audioBass={0}
                    audioHigh={0}
                    audioLevel={0}
                    fluidSimEnabled={fluidSimEnabled}
                    // New physics params
                    particleLifeEnabled={particleLifeEnabled}
                    lifeDecayRate={lifeDecayRate}
                    respawnBounds={respawnBounds}
                    forceMultiplier={forceMultiplier}
                    curlStrength={curlStrength}
                    centerPull={centerPull}
                    maxVelocity={maxVelocity}
                    engineRef={engineRef}
                />

                {/* Overlay Status */}
                <div className="absolute bottom-4 left-4 text-[10px] font-mono text-blue-500/50 pointer-events-none">
                    {status} :: RES:{simRes} :: MODE:{mode}
                </div>
            </div>
        </AppShell>
    );
}
