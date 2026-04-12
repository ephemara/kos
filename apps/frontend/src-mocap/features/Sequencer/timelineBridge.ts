import type { SequencerKeyframe } from './types';

export type SequencerBridgeActionId =
    | 'sequencer-add-keyframe'
    | 'sequencer-remove-keyframe'
    | 'sequencer-move-keyframe';

export interface SequencerBridgeBinding {
    actionId: SequencerBridgeActionId;
    originId: 'sequencer-ui';
    operationId: 'upsert' | 'remove' | 'move';
    eventSourceId: 'sequencer-ui';
}

const REQUIRED_ACTION_IDS: SequencerBridgeActionId[] = [
    'sequencer-add-keyframe',
    'sequencer-remove-keyframe',
    'sequencer-move-keyframe',
];

const BRIDGE_BINDINGS: SequencerBridgeBinding[] = [
    {
        actionId: 'sequencer-add-keyframe',
        originId: 'sequencer-ui',
        operationId: 'upsert',
        eventSourceId: 'sequencer-ui',
    },
    {
        actionId: 'sequencer-remove-keyframe',
        originId: 'sequencer-ui',
        operationId: 'remove',
        eventSourceId: 'sequencer-ui',
    },
    {
        actionId: 'sequencer-move-keyframe',
        originId: 'sequencer-ui',
        operationId: 'move',
        eventSourceId: 'sequencer-ui',
    },
];

const BINDINGS_BY_ACTION_ID = new Map(
    BRIDGE_BINDINGS.map(binding => [binding.actionId, binding])
);

function validateBridgeBindings(): void {
    if (BRIDGE_BINDINGS.length === 0) {
        throw new Error('Sequencer bridge bindings must not be empty.');
    }

    for (const actionId of REQUIRED_ACTION_IDS) {
        if (!BINDINGS_BY_ACTION_ID.has(actionId)) {
            throw new Error(`Missing required sequencer bridge binding: ${actionId}`);
        }
    }

    if (BINDINGS_BY_ACTION_ID.size !== BRIDGE_BINDINGS.length) {
        throw new Error('Sequencer bridge bindings contain duplicate action IDs.');
    }
}

validateBridgeBindings();

export function sequencerBridgeBindings(): SequencerBridgeBinding[] {
    return [...BRIDGE_BINDINGS];
}

export function sequencerBridgeBindingForAction(
    actionId: SequencerBridgeActionId
): SequencerBridgeBinding {
    const binding = BINDINGS_BY_ACTION_ID.get(actionId);
    if (!binding) {
        throw new Error(`Unknown sequencer bridge action: ${actionId}`);
    }
    return binding;
}

export type TimelineInterpolation =
    | 'linear'
    | 'ease-in'
    | 'ease-out'
    | 'ease-in-out'
    | 'step';

export type TimelineRuntimeOp =
    | {
        type: 'upsert';
        sample: {
            frame: number;
            value: unknown;
            interpolation: TimelineInterpolation;
        };
    }
    | {
        type: 'remove';
        frame: number;
    }
    | {
        type: 'move';
        from_frame: number;
        to_frame: number;
    };

export interface TimelineRuntimeEnvelope {
    track_id: string;
    origin: SequencerBridgeBinding['originId'];
    op: TimelineRuntimeOp;
    requested_supermotion_mode_id: number | null;
}

export interface TimelineRuntimeRequest {
    session_frame: number;
    timestamp_ms: number;
    envelopes: TimelineRuntimeEnvelope[];
}

export interface SequencerBridgeEvent {
    action_id: SequencerBridgeActionId;
    track_id: string;
    event_source_id: SequencerBridgeBinding['eventSourceId'];
    timestamp_ms: number;
    request: TimelineRuntimeRequest;
}

export interface SequencerTimelineBridgeState {
    pendingRequests: TimelineRuntimeRequest[];
    emittedEvents: SequencerBridgeEvent[];
    lastActionId: SequencerBridgeActionId | null;
    lastError: string | null;
}

export function createEmptyTimelineBridgeState(): SequencerTimelineBridgeState {
    return {
        pendingRequests: [],
        emittedEvents: [],
        lastActionId: null,
        lastError: null,
    };
}

function interpolationFromKeyframe(keyframe: SequencerKeyframe): TimelineInterpolation {
    return keyframe.ease ?? 'linear';
}

export function buildSequencerRuntimeRequest(input: {
    actionId: SequencerBridgeActionId;
    trackId: string;
    sessionFrame: number;
    timestampMs: number;
    op: TimelineRuntimeOp;
}): { request: TimelineRuntimeRequest; event: SequencerBridgeEvent } {
    const binding = sequencerBridgeBindingForAction(input.actionId);
    const request: TimelineRuntimeRequest = {
        session_frame: input.sessionFrame,
        timestamp_ms: input.timestampMs,
        envelopes: [
            {
                track_id: input.trackId,
                origin: binding.originId,
                op: input.op,
                requested_supermotion_mode_id: null,
            },
        ],
    };

    return {
        request,
        event: {
            action_id: input.actionId,
            track_id: input.trackId,
            event_source_id: binding.eventSourceId,
            timestamp_ms: input.timestampMs,
            request,
        },
    };
}

export function buildAddKeyframeRequest(input: {
    trackId: string;
    sessionFrame: number;
    timestampMs: number;
    keyframe: SequencerKeyframe;
}): { request: TimelineRuntimeRequest; event: SequencerBridgeEvent } {
    return buildSequencerRuntimeRequest({
        actionId: 'sequencer-add-keyframe',
        trackId: input.trackId,
        sessionFrame: input.sessionFrame,
        timestampMs: input.timestampMs,
        op: {
            type: 'upsert',
            sample: {
                frame: input.keyframe.frame,
                value: input.keyframe.value,
                interpolation: interpolationFromKeyframe(input.keyframe),
            },
        },
    });
}

export function buildRemoveKeyframeRequest(input: {
    trackId: string;
    sessionFrame: number;
    timestampMs: number;
    frame: number;
}): { request: TimelineRuntimeRequest; event: SequencerBridgeEvent } {
    return buildSequencerRuntimeRequest({
        actionId: 'sequencer-remove-keyframe',
        trackId: input.trackId,
        sessionFrame: input.sessionFrame,
        timestampMs: input.timestampMs,
        op: {
            type: 'remove',
            frame: input.frame,
        },
    });
}

export function buildMoveKeyframeRequest(input: {
    trackId: string;
    sessionFrame: number;
    timestampMs: number;
    fromFrame: number;
    toFrame: number;
}): { request: TimelineRuntimeRequest; event: SequencerBridgeEvent } {
    return buildSequencerRuntimeRequest({
        actionId: 'sequencer-move-keyframe',
        trackId: input.trackId,
        sessionFrame: input.sessionFrame,
        timestampMs: input.timestampMs,
        op: {
            type: 'move',
            from_frame: input.fromFrame,
            to_frame: input.toFrame,
        },
    });
}
