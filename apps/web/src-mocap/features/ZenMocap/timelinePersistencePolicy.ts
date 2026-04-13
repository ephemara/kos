import type { TimelineRuntimeTakeCommitOptions } from './MocapService';

type TimelineMergeStrategy = NonNullable<TimelineRuntimeTakeCommitOptions['merge_strategy']>;

export interface TimelineRuntimePersistencePolicy {
  policy_id: string;
  ack_commit: {
    enabled: boolean;
    merge_strategy: TimelineMergeStrategy;
  };
  close_take_commit: {
    enabled: boolean;
    merge_strategy: TimelineMergeStrategy;
    clear_runtime_state_after_commit: boolean;
  };
  session_take_path: {
    retain_on_take_close: boolean;
    clear_on_take_delete: boolean;
    rebind_on_take_rename: boolean;
  };
}

const DEFAULT_TIMELINE_RUNTIME_PERSISTENCE_POLICY: TimelineRuntimePersistencePolicy = {
  policy_id: 'timeline-runtime-persistence-v1',
  ack_commit: {
    enabled: true,
    merge_strategy: 'replace',
  },
  close_take_commit: {
    enabled: true,
    merge_strategy: 'replace',
    clear_runtime_state_after_commit: true,
  },
  session_take_path: {
    retain_on_take_close: true,
    clear_on_take_delete: true,
    rebind_on_take_rename: true,
  },
};

function validatePolicy(policy: TimelineRuntimePersistencePolicy): TimelineRuntimePersistencePolicy {
  if (!policy.policy_id.trim()) {
    throw new Error('timeline persistence policy_id must be a non-empty string');
  }
  const mergeStrategies: TimelineMergeStrategy[] = ['append_unique', 'replace'];
  if (!mergeStrategies.includes(policy.ack_commit.merge_strategy)) {
    throw new Error(`unsupported ack merge strategy '${policy.ack_commit.merge_strategy}'`);
  }
  if (!mergeStrategies.includes(policy.close_take_commit.merge_strategy)) {
    throw new Error(
      `unsupported close merge strategy '${policy.close_take_commit.merge_strategy}'`
    );
  }
  return policy;
}

export const TIMELINE_RUNTIME_PERSISTENCE_POLICY = validatePolicy(
  DEFAULT_TIMELINE_RUNTIME_PERSISTENCE_POLICY
);
