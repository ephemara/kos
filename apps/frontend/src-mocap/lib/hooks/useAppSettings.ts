import React, { useState, useEffect } from 'react';
import { PerformanceSettings } from '@mocap/types/kernel';
import { checkApiKey, connectApi } from '@mocap/lib/utils/apiUtils';
import {
    TopBarLayoutStyle,
    getTopBarLayout,
    setTopBarLayout as saveTopBarLayout
} from '@mocap/shared/theme/topBarLayoutConfig';

export const useAppSettings = () => {
    const [activeModuleId, setActiveModuleId] = useState<string>('zen-mocap');
    // Unified launcher state - replaces separate bootSequence + showProjectSelector
    const [showLauncher, setShowLauncher] = useState(true);
    // Legacy states kept for backward compatibility
    const [visitedModules, setVisitedModules] = useState<Set<string>>(new Set());
    const [showProjectSelector, setShowProjectSelector] = useState(false);
    const [bootSequence, setBootSequence] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    const [hasApiKey, setHasApiKey] = useState(false);
    const [isProjectLoading, setIsProjectLoading] = useState(false);
    const [perfSettings, setPerfSettings] = useState<PerformanceSettings>({
        resolution: 1.0,
        shadows: true,
        postFX: true,
        antialiasing: true,
        mode: 'BALANCED'
    });
    // Viewport Mode: 'simple' = Three.js apps, 'advanced' = Bevy unified viewport
    const [viewportMode, setViewportMode] = useState<'simple' | 'advanced'>('simple');
    // EXPERIMENTAL: Top panel transition effect when switching Simple/Advanced modes
    // Default: false - disabled to fix blank screen issue on launch
    const [topPanelTransition, setTopPanelTransition] = useState<boolean>(false);

    // TOP BAR CONFIG
    const [topBarMode, setTopBarMode] = useState<'workflow' | 'app'>('workflow');
    const [topBarThemeId, setTopBarThemeId] = useState<string>('obsidian');
    // TOP BAR LAYOUT - 'direct' shows all apps, 'workflow' shows grouped dropdowns
    const [topBarLayout, setTopBarLayoutState] = useState<TopBarLayoutStyle>(() => getTopBarLayout());

    // Wrapper to persist layout changes
    const setTopBarLayout = (layout: TopBarLayoutStyle) => {
        setTopBarLayoutState(layout);
        saveTopBarLayout(layout);
    };

    useEffect(() => {
        checkApiKey().then(setHasApiKey);
    }, []);

    const switchModule = (id: string) => {
        setActiveModuleId(id);
        setVisitedModules(prev => {
            const next = new Set(prev);
            next.add(id);
            return next;
        });
        setTimeout(() => window.dispatchEvent(new Event('resize')), 50);
    };

    const handleKillTasks = (e: React.MouseEvent) => {
        e.stopPropagation();
        setVisitedModules(new Set([activeModuleId]));
    };

    const handleConnectApi = async () => {
        await connectApi();
        setHasApiKey(true);
    };

    const applyPerfPreset = (mode: 'ECO' | 'BALANCED' | 'ULTRA') => {
        if (mode === 'ECO') {
            setPerfSettings({
                resolution: 0.5,
                shadows: false,
                postFX: false,
                antialiasing: false,
                mode: 'ECO'
            });
        } else if (mode === 'BALANCED') {
            setPerfSettings({
                resolution: 1.0,
                shadows: true,
                postFX: true,
                antialiasing: true,
                mode: 'BALANCED'
            });
        } else if (mode === 'ULTRA') {
            setPerfSettings({
                resolution: 1.5,
                shadows: true,
                postFX: true,
                antialiasing: true,
                mode: 'ULTRA'
            });
        }
    };

    return {
        // State
        activeModuleId,
        showLauncher,
        bootSequence,
        showProjectSelector,
        isSettingsOpen,
        visitedModules,
        hasApiKey,
        isProjectLoading,
        perfSettings,
        viewportMode,
        topPanelTransition,
        topBarMode,
        topBarThemeId,
        topBarLayout,
        // Setters
        setActiveModuleId,
        setShowLauncher,
        setBootSequence,
        setShowProjectSelector,
        setIsSettingsOpen,
        setVisitedModules,
        setIsProjectLoading,
        setPerfSettings,
        setViewportMode,
        setTopPanelTransition,
        setTopBarMode,
        setTopBarThemeId,
        setTopBarLayout,
        // Actions
        switchModule,
        handleKillTasks,
        handleConnectApi,
        applyPerfPreset
    };
};