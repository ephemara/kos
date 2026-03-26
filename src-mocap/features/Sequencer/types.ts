/**
 * Sequencer Feature — Type Definitions
 *
 * Data-driven. All sequencer behaviour is described by these types.
 * Nothing hardcoded in component logic.
 */

// ─── Track Types (data-driven registry) ───────────────────────────────────────

/** Which data is being tracked on a sequencer track */
export type TrackKind =
    | 'pose'       // Joint positions from mocap engine
    | 'audio'      // Audio waveform (future)
    | 'marker'     // Named cue points
    | 'custom';    // User-defined float channel

/** Visual style for a track in the timeline */
export interface TrackStyle {
    color: string;    // CSS hex / hsl
    dimColor: string; // Dimmed/inactive variant
}

/** A single keyframe on a track */
export interface SequencerKeyframe {
    frame: number;
    /** The value stored at this keyframe — shape depends on TrackKind */
    value: unknown;
    /** Easing between this keyframe and the next */
    ease?: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'step';
}

/** One track in the sequencer */
export interface SequencerTrack {
    id: string;
    label: string;
    kind: TrackKind;
    style: TrackStyle;
    keyframes: SequencerKeyframe[];
    visible: boolean;
    locked: boolean;
    muted: boolean;
    /** Optional sub-tracks for collapsible groups */
    children?: SequencerTrack[];
    collapsed?: boolean;
}

// ─── Playback State ────────────────────────────────────────────────────────────

export type PlaybackStatus = 'stopped' | 'playing' | 'paused' | 'recording';

export interface PlaybackState {
    status: PlaybackStatus;
    currentFrame: number;
    /** Loop in and out points (null = no loop) */
    loopIn: number | null;
    loopOut: number | null;
}

// ─── Sequencer Session ─────────────────────────────────────────────────────────

/** The full state of a sequencer session — one per take */
export interface SequencerSession {
    id: string;
    name: string;
    fps: number;
    totalFrames: number;
    tracks: SequencerTrack[];
    playback: PlaybackState;
    /** Timestamp of last save */
    savedAt: number | null;
}

// ─── Record Config ─────────────────────────────────────────────────────────────

export interface RecordConfig {
    takeName: string;
    /** Pre-roll in frames before recording starts */
    preRoll: number;
    /** 0 = unlimited */
    maxDurationFrames: number;
    /** Auto-stop when max duration reached */
    autoStop: boolean;
    /** Overwrite existing take with same name */
    overwrite: boolean;
}

export const DEFAULT_RECORD_CONFIG: RecordConfig = {
    takeName: 'Take_001',
    preRoll: 0,
    maxDurationFrames: 0,
    autoStop: false,
    overwrite: false,
};

// ─── Track Style Presets (data-driven, not hardcoded per file) ─────────────────

export const TRACK_STYLE_PRESETS: Record<TrackKind, TrackStyle> = {
    pose: { color: '#00ffb4', dimColor: '#00ffb440' },
    audio: { color: '#f97316', dimColor: '#f9731640' },
    marker: { color: '#a855f7', dimColor: '#a855f740' },
    custom: { color: '#60a5fa', dimColor: '#60a5fa40' },
};
