/**
 * useSequencer — Core sequencer state hook
 *
 * Manages playback, track data, and recording state.
 * RAF-based playback loop. Fully data-driven — no hardcoded track logic.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import type {
    SequencerSession,
    SequencerTrack,
    SequencerKeyframe,
    PlaybackStatus,
    RecordConfig,
} from './types';
import { DEFAULT_RECORD_CONFIG } from './types';
import {
    buildAddKeyframeRequest,
    buildMoveKeyframeRequest,
    buildRemoveKeyframeRequest,
    createEmptyTimelineBridgeState,
    type SequencerBridgeActionId,
} from './timelineBridge';

// ─── Initial session factory ──────────────────────────────────────────────────

export function createEmptySession(name = 'New Session', fps = 30): SequencerSession {
    return {
        id: crypto.randomUUID(),
        name,
        fps,
        totalFrames: fps * 30, // 30 second default
        tracks: [],
        playback: {
            status: 'stopped',
            currentFrame: 0,
            loopIn: null,
            loopOut: null,
        },
        savedAt: null,
    };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useSequencer(initialSession?: SequencerSession) {
    const [session, setSession] = useState<SequencerSession>(
        initialSession ?? createEmptySession()
    );
    const [recordConfig, setRecordConfig] = useState<RecordConfig>(DEFAULT_RECORD_CONFIG);
    const [timelineBridgeState, setTimelineBridgeState] = useState(createEmptyTimelineBridgeState);

    const rafRef = useRef<number | null>(null);
    const lastTimeRef = useRef<number>(0);
    const frameRef = useRef<number>(session.playback.currentFrame);
    const timelineTimestampRef = useRef<number>(Date.now());

    // Keep ref in sync
    useEffect(() => {
        frameRef.current = session.playback.currentFrame;
    }, [session.playback.currentFrame]);

    const msPerFrame = 1000 / session.fps;

    const nextTimelineTimestamp = useCallback(() => {
        const now = Date.now();
        const next = Math.max(now, timelineTimestampRef.current + 1);
        timelineTimestampRef.current = next;
        return next;
    }, []);

    const pushBridgeRequest = useCallback((
        actionId: SequencerBridgeActionId,
        trackId: string,
        builder: (timestampMs: number) => ReturnType<typeof buildAddKeyframeRequest>,
    ) => {
        const timestampMs = nextTimelineTimestamp();
        const { request, event } = builder(timestampMs);
        setTimelineBridgeState(prev => ({
            ...prev,
            pendingRequests: [...prev.pendingRequests, request],
            emittedEvents: [...prev.emittedEvents, event],
            lastActionId: actionId,
            lastError: null,
        }));
    }, [nextTimelineTimestamp]);

    const setTimelineBridgeError = useCallback((message: string | null) => {
        setTimelineBridgeState(prev => ({
            ...prev,
            lastError: message,
        }));
    }, []);

    // ─── Playback loop ──────────────────────────────────────────────────────────

    const stopRaf = useCallback(() => {
        if (rafRef.current !== null) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
        }
    }, []);

    const tick = useCallback((now: number) => {
        if (!lastTimeRef.current) lastTimeRef.current = now;
        const elapsed = now - lastTimeRef.current;

        if (elapsed >= msPerFrame) {
            lastTimeRef.current = now - (elapsed % msPerFrame);

            setSession(prev => {
                const { currentFrame, loopIn, loopOut, status } = prev.playback;
                const loopEnd = loopOut ?? prev.totalFrames - 1;
                const loopStart = loopIn ?? 0;

                let next = currentFrame + 1;

                if (status === 'recording') {
                    // Recording: extend totalFrames to fit
                    const newTotal = Math.max(prev.totalFrames, next + 1);
                    return {
                        ...prev,
                        totalFrames: newTotal,
                        playback: { ...prev.playback, currentFrame: next },
                    };
                }

                if (next > loopEnd) {
                    if (loopIn !== null || loopOut !== null) {
                        next = loopStart;
                    } else {
                        // End of timeline — stop
                        return {
                            ...prev,
                            playback: { ...prev.playback, currentFrame: loopEnd, status: 'stopped' },
                        };
                    }
                }

                return {
                    ...prev,
                    playback: { ...prev.playback, currentFrame: next },
                };
            });
        }

        rafRef.current = requestAnimationFrame(tick);
    }, [msPerFrame]);

    // Start/stop RAF based on status
    useEffect(() => {
        const status = session.playback.status;
        if (status === 'playing' || status === 'recording') {
            lastTimeRef.current = 0;
            rafRef.current = requestAnimationFrame(tick);
        } else {
            stopRaf();
        }
        return stopRaf;
    }, [session.playback.status, tick, stopRaf]);

    // ─── Actions ────────────────────────────────────────────────────────────────

    const seek = useCallback((frame: number) => {
        setSession(prev => ({
            ...prev,
            playback: {
                ...prev.playback,
                currentFrame: Math.max(0, Math.min(frame, prev.totalFrames - 1)),
            },
        }));
    }, []);

    const setStatus = useCallback((status: PlaybackStatus) => {
        setSession(prev => ({ ...prev, playback: { ...prev.playback, status } }));
    }, []);

    const play = useCallback(() => setStatus('playing'), [setStatus]);
    const pause = useCallback(() => setStatus('paused'), [setStatus]);
    const stop = useCallback(() => {
        setSession(prev => ({
            ...prev,
            playback: { ...prev.playback, status: 'stopped', currentFrame: 0 },
        }));
    }, []);

    const startRecord = useCallback(() => {
        setSession(prev => ({
            ...prev,
            playback: { ...prev.playback, status: 'recording', currentFrame: 0 },
        }));
    }, []);

    const stopRecord = useCallback(() => setStatus('stopped'), [setStatus]);

    const setLoopIn = useCallback((frame: number | null) => {
        setSession(prev => ({
            ...prev,
            playback: { ...prev.playback, loopIn: frame },
        }));
    }, []);

    const setLoopOut = useCallback((frame: number | null) => {
        setSession(prev => ({
            ...prev,
            playback: { ...prev.playback, loopOut: frame },
        }));
    }, []);

    const setTotalFrames = useCallback((frames: number) => {
        setSession(prev => ({ ...prev, totalFrames: Math.max(1, frames) }));
    }, []);

    // ─── Track management ───────────────────────────────────────────────────────

    const addTrack = useCallback((track: SequencerTrack) => {
        setSession(prev => ({ ...prev, tracks: [...prev.tracks, track] }));
    }, []);

    const removeTrack = useCallback((id: string) => {
        setSession(prev => ({ ...prev, tracks: prev.tracks.filter(t => t.id !== id) }));
    }, []);

    const updateTrack = useCallback((id: string, patch: Partial<SequencerTrack>) => {
        setSession(prev => ({
            ...prev,
            tracks: prev.tracks.map(t => t.id === id ? { ...t, ...patch } : t),
        }));
    }, []);

    const addKeyframe = useCallback((trackId: string, kf: SequencerKeyframe) => {
        const normalizedKeyframe: SequencerKeyframe = {
            ...kf,
            ease: kf.ease ?? 'linear',
        };

        setSession(prev => ({
            ...prev,
            tracks: prev.tracks.map(t =>
                t.id === trackId
                    ? {
                        ...t,
                        keyframes: [
                            ...t.keyframes.filter(k => k.frame !== normalizedKeyframe.frame),
                            normalizedKeyframe,
                        ].sort((a, b) => a.frame - b.frame),
                    }
                    : t
            ),
        }));
        pushBridgeRequest(
            'sequencer-add-keyframe',
            trackId,
            timestampMs => buildAddKeyframeRequest({
                trackId,
                sessionFrame: frameRef.current,
                timestampMs,
                keyframe: normalizedKeyframe,
            })
        );
    }, [pushBridgeRequest]);

    const removeKeyframe = useCallback((trackId: string, frame: number) => {
        let removed = false;
        setSession(prev => ({
            ...prev,
            tracks: prev.tracks.map(t =>
                t.id === trackId
                    ? {
                        ...t,
                        keyframes: t.keyframes.filter(k => {
                            const keep = k.frame !== frame;
                            if (!keep) removed = true;
                            return keep;
                        }),
                    }
                    : t
            ),
        }));
        if (!removed) {
            setTimelineBridgeError(`removeKeyframe skipped: frame ${frame} was not found on track '${trackId}'.`);
            return;
        }
        pushBridgeRequest(
            'sequencer-remove-keyframe',
            trackId,
            timestampMs => buildRemoveKeyframeRequest({
                trackId,
                sessionFrame: frameRef.current,
                timestampMs,
                frame,
            })
        );
    }, [pushBridgeRequest, setTimelineBridgeError]);

    const moveKeyframe = useCallback((trackId: string, fromFrame: number, toFrame: number) => {
        if (fromFrame === toFrame) {
            return;
        }

        let didMove = false;
        let collision = false;
        setSession(prev => ({
            ...prev,
            tracks: prev.tracks.map(track => {
                if (track.id !== trackId) {
                    return track;
                }
                const source = track.keyframes.find(k => k.frame === fromFrame);
                if (!source) {
                    return track;
                }
                if (track.keyframes.some(k => k.frame === toFrame)) {
                    collision = true;
                    return track;
                }

                didMove = true;
                return {
                    ...track,
                    keyframes: [
                        ...track.keyframes.filter(k => k.frame !== fromFrame),
                        { ...source, frame: toFrame },
                    ].sort((a, b) => a.frame - b.frame),
                };
            }),
        }));

        if (collision) {
            setTimelineBridgeError(`moveKeyframe skipped: frame ${toFrame} already exists on track '${trackId}'.`);
            return;
        }
        if (!didMove) {
            setTimelineBridgeError(`moveKeyframe skipped: frame ${fromFrame} was not found on track '${trackId}'.`);
            return;
        }

        pushBridgeRequest(
            'sequencer-move-keyframe',
            trackId,
            timestampMs => buildMoveKeyframeRequest({
                trackId,
                sessionFrame: frameRef.current,
                timestampMs,
                fromFrame,
                toFrame,
            })
        );
    }, [pushBridgeRequest, setTimelineBridgeError]);

    const renameSession = useCallback((name: string) => {
        setSession(prev => ({ ...prev, name }));
    }, []);

    const loadSession = useCallback((s: SequencerSession) => {
        setSession(s);
        setTimelineBridgeState(createEmptyTimelineBridgeState());
    }, []);

    const acknowledgeTimelineRuntimeRequests = useCallback((count: number) => {
        if (!Number.isFinite(count) || count <= 0) {
            return;
        }
        setTimelineBridgeState(prev => ({
            ...prev,
            pendingRequests: prev.pendingRequests.slice(Math.floor(count)),
        }));
    }, []);

    const clearPendingTimelineRuntimeRequests = useCallback(() => {
        setTimelineBridgeState(prev => ({
            ...prev,
            pendingRequests: [],
        }));
    }, []);

    return {
        session,
        recordConfig,
        setRecordConfig,

        // Playback
        play,
        pause,
        stop,
        seek,
        startRecord,
        stopRecord,
        setLoopIn,
        setLoopOut,
        setTotalFrames,

        // Tracks
        addTrack,
        removeTrack,
        updateTrack,
        addKeyframe,
        removeKeyframe,
        moveKeyframe,
        timelineBridgeState,
        setTimelineBridgeError,
        acknowledgeTimelineRuntimeRequests,
        clearPendingTimelineRuntimeRequests,

        // Session
        renameSession,
        loadSession,
    };
}
