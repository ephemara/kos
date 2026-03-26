import { describe, expect, it } from 'vitest';

import {
    buildAddKeyframeRequest,
    buildMoveKeyframeRequest,
    buildRemoveKeyframeRequest,
    sequencerBridgeBindingForAction,
    sequencerBridgeBindings,
} from './timelineBridge';

describe('timelineBridge', () => {
    it('exposes required sequencer action bindings', () => {
        const bindings = sequencerBridgeBindings();
        const actionIds = bindings.map(binding => binding.actionId).sort();
        expect(actionIds).toEqual([
            'sequencer-add-keyframe',
            'sequencer-move-keyframe',
            'sequencer-remove-keyframe',
        ]);
        expect(sequencerBridgeBindingForAction('sequencer-add-keyframe').operationId).toBe('upsert');
    });

    it('builds add/remove requests with engine-aligned envelope fields', () => {
        const add = buildAddKeyframeRequest({
            trackId: 'pose_main',
            sessionFrame: 12,
            timestampMs: 1_000,
            keyframe: {
                frame: 12,
                value: { x: 1 },
                ease: 'ease-in-out',
            },
        });

        expect(add.request.envelopes[0]).toEqual({
            track_id: 'pose_main',
            origin: 'sequencer-ui',
            requested_supermotion_mode_id: null,
            op: {
                type: 'upsert',
                sample: {
                    frame: 12,
                    value: { x: 1 },
                    interpolation: 'ease-in-out',
                },
            },
        });
        expect(add.event.event_source_id).toBe('sequencer-ui');

        const remove = buildRemoveKeyframeRequest({
            trackId: 'pose_main',
            sessionFrame: 20,
            timestampMs: 1_100,
            frame: 8,
        });

        expect(remove.request.envelopes[0].op).toEqual({ type: 'remove', frame: 8 });
    });

    it('builds move requests with explicit from/to frame payload', () => {
        const move = buildMoveKeyframeRequest({
            trackId: 'pose_main',
            sessionFrame: 22,
            timestampMs: 2_000,
            fromFrame: 10,
            toFrame: 18,
        });

        expect(move.request.envelopes[0].op).toEqual({
            type: 'move',
            from_frame: 10,
            to_frame: 18,
        });
    });
});
