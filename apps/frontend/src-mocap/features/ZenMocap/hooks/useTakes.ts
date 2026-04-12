/**
 * useTakes
 *
 * Manages the takes library for the content browser TAKES tab.
 *
 * - Calls `mocap_list_takes` on mount and whenever `mocap://take_saved` fires.
 * - Exposes `openTake` → loads full AnimationTake and passes it to the timeline.
 * - Exposes `deleteTake` → removes from disk, refreshes list.
 * - No polling — purely event-driven via the Tauri broadcast channel.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { mocapService } from '../MocapService';
import type { TakeSummary, AnimationTake } from '../types';
import { publishMocapInterop } from '@mocap/shared/services/mocapInterop';
import { TIMELINE_RUNTIME_PERSISTENCE_POLICY } from '../timelinePersistencePolicy';

export interface UseTakesResult {
    takes: TakeSummary[];
    isLoading: boolean;
    activeTake: AnimationTake | null;
    activeTakePath: string | null;
    timelineCommitTakePath: string | null;
    openTake: (take: TakeSummary) => Promise<void>;
    closeTake: () => void;
    deleteTake: (take: TakeSummary) => Promise<void>;
    renameTake: (take: TakeSummary, newName: string) => Promise<void>;
    refresh: () => Promise<void>;
}

export function useTakes(): UseTakesResult {
    const [takes, setTakes] = useState<TakeSummary[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [activeTake, setActiveTake] = useState<AnimationTake | null>(null);
    const [activeTakePath, setActiveTakePath] = useState<string | null>(null);
    const [timelineCommitTakePath, setTimelineCommitTakePath] = useState<string | null>(null);
    const unlistenRef = useRef<UnlistenFn | null>(null);

    // ─── Fetch list from Rust ────────────────────────────────────────────────────

    const refresh = useCallback(async () => {
        setIsLoading(true);
        try {
            const list = await mocapService.listTakes();
            setTakes(list);
        } catch (e) {
            console.error('[useTakes] Failed to list takes:', e);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // ─── Mount: initial load + subscribe to TakeSaved events ────────────────────

    useEffect(() => {
        refresh();

        // Auto-refresh whenever the recording pipeline saves a new take
        let active = true;
        listen<{ name: string; path: string; frame_count: number }>(
            'mocap://take_saved',
            (event) => {
                if (active) refresh();
                void publishMocapInterop('take-saved', {
                    source: 'zen-mocap',
                    name: event.payload.name,
                    path: event.payload.path,
                    frameCount: event.payload.frame_count,
                    timestampMs: Date.now(),
                }).catch(() => {});
            }
        ).then(fn => {
            unlistenRef.current = fn;
        });

        return () => {
            active = false;
            unlistenRef.current?.();
        };
    }, [refresh]);

    // ─── Actions ─────────────────────────────────────────────────────────────────

    const openTake = useCallback(async (take: TakeSummary) => {
        setIsLoading(true);
        try {
            const full = await mocapService.loadTake(take.path);
            try {
                await mocapService.hydrateTimelineRuntimeFromTake(take.path);
                await mocapService.setTimelineRuntimeActiveTake(take.path);
            } catch (hydrateError) {
                console.warn('[useTakes] Failed to hydrate timeline runtime state from take:', hydrateError);
            }
            setActiveTake(full);
            setActiveTakePath(take.path);
            setTimelineCommitTakePath(take.path);
        } catch (e) {
            console.error('[useTakes] Failed to load take:', e);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const closeTake = useCallback(() => {
        setActiveTake(null);
        const path = activeTakePath;
        setActiveTakePath(null);
        if (!TIMELINE_RUNTIME_PERSISTENCE_POLICY.session_take_path.retain_on_take_close) {
            setTimelineCommitTakePath(null);
        }
        if (path) {
            const closeTakePolicy = TIMELINE_RUNTIME_PERSISTENCE_POLICY.close_take_commit;
            if (!closeTakePolicy.enabled) {
                if (!TIMELINE_RUNTIME_PERSISTENCE_POLICY.session_take_path.retain_on_take_close) {
                    void mocapService.setTimelineRuntimeActiveTake(null).catch(() => {});
                }
                return;
            }
            void mocapService
                .commitTimelineRuntimeToActiveTake({
                    clear_runtime_state_after_commit: closeTakePolicy.clear_runtime_state_after_commit,
                    merge_strategy: closeTakePolicy.merge_strategy,
                })
                .then(() => {
                    if (!TIMELINE_RUNTIME_PERSISTENCE_POLICY.session_take_path.retain_on_take_close) {
                        void mocapService.setTimelineRuntimeActiveTake(null).catch(() => {});
                    }
                })
                .catch(error => {
                    console.warn('[useTakes] Failed to persist timeline runtime events into take:', error);
                });
            return;
        }
        void mocapService.resetTimelineRuntimeState().catch(error => {
            console.warn('[useTakes] Failed to reset timeline runtime state after closing take:', error);
        });
    }, [activeTakePath]);

    const deleteTake = useCallback(async (take: TakeSummary) => {
        try {
            await mocapService.deleteTake(take.path);
            // If the deleted take is active, close it
            setActiveTake(prev => {
                if (prev?.id === take.id) {
                    setActiveTakePath(null);
                    void mocapService.setTimelineRuntimeActiveTake(null).catch(() => {});
                    return null;
                }
                return prev;
            });
            // Refresh list optimistically — remove immediately, server will confirm
            setTakes(prev => prev.filter(t => t.id !== take.id));
            if (
                TIMELINE_RUNTIME_PERSISTENCE_POLICY.session_take_path.clear_on_take_delete
                && timelineCommitTakePath === take.path
            ) {
                setTimelineCommitTakePath(null);
            }
        } catch (e) {
            console.error('[useTakes] Failed to delete take:', e);
        }
    }, [timelineCommitTakePath]);

    const renameTake = useCallback(async (take: TakeSummary, newName: string) => {
        try {
            const newPath = await mocapService.renameTake(take.path, newName);
            if (activeTake?.id === take.id) {
                setActiveTakePath(newPath);
                await mocapService.setTimelineRuntimeActiveTake(newPath);
            }
            if (
                TIMELINE_RUNTIME_PERSISTENCE_POLICY.session_take_path.rebind_on_take_rename
                && timelineCommitTakePath === take.path
            ) {
                setTimelineCommitTakePath(newPath);
                await mocapService.setTimelineRuntimeActiveTake(newPath);
            }
            setTakes(prev => prev.map(t =>
                t.id === take.id ? { ...t, name: newName, path: newPath } : t
            ));
        } catch (e) {
            console.error('[useTakes] Failed to rename take:', e);
        }
    }, [activeTake?.id, timelineCommitTakePath]);

    return {
        takes,
        isLoading,
        activeTake,
        activeTakePath,
        timelineCommitTakePath,
        openTake,
        closeTake,
        deleteTake,
        renameTake,
        refresh,
    };
}
