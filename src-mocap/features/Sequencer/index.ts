/**
 * Sequencer feature — public API
 */
export { SequencerTimeline } from './SequencerTimeline';
export { RecordSlot } from './RecordSlot';
export { useSequencer, createEmptySession } from './useSequencer';
export type {
    SequencerSession,
    SequencerTrack,
    SequencerKeyframe,
    PlaybackState,
    PlaybackStatus,
    RecordConfig,
    TrackKind,
    TrackStyle,
} from './types';
export { TRACK_STYLE_PRESETS, DEFAULT_RECORD_CONFIG } from './types';

export {
    sequencerBridgeBindings,
    sequencerBridgeBindingForAction,
    createEmptyTimelineBridgeState,
    type SequencerBridgeActionId,
    type SequencerBridgeBinding,
    type SequencerTimelineBridgeState,
    type SequencerBridgeEvent,
    type TimelineRuntimeRequest,
    type TimelineRuntimeEnvelope,
    type TimelineRuntimeOp,
} from './timelineBridge';
