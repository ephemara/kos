//! Property-based tests for k-os-undo using proptest
//!
//! These tests validate universal properties that should hold for any sequence
//! of actions, ensuring correctness across a wide range of inputs.

use k_os_undo::{Result, UndoManager, UndoManagerConfig, UndoableAction};
use proptest::prelude::*;
use std::any::Any;

// ============================================================================
// Test State and Actions
// ============================================================================

/// Simple test state for property testing
#[derive(Debug, Clone, PartialEq, Eq)]
struct TestState {
    value: i32,
    history: Vec<String>,
}

impl TestState {
    fn new() -> Self {
        Self {
            value: 0,
            history: Vec::new(),
        }
    }
}

/// Action that adds to the value
#[derive(Debug, Clone)]
struct AddAction {
    amount: i32,
}

impl UndoableAction<TestState> for AddAction {
    fn execute(&mut self, state: &mut TestState) -> Result<()> {
        // Use saturating addition to avoid overflow
        state.value = state.value.saturating_add(self.amount);
        state.history.push(format!("add {}", self.amount));
        Ok(())
    }

    fn undo(&mut self, state: &mut TestState) -> Result<()> {
        // Use saturating subtraction to avoid overflow
        state.value = state.value.saturating_sub(self.amount);
        state.history.push(format!("undo add {}", self.amount));
        Ok(())
    }

    fn redo(&mut self, state: &mut TestState) -> Result<()> {
        // Use saturating addition to avoid overflow
        state.value = state.value.saturating_add(self.amount);
        state.history.push(format!("redo add {}", self.amount));
        Ok(())
    }

    fn memory_size(&self) -> usize {
        std::mem::size_of::<Self>()
    }

    fn description(&self) -> String {
        format!("Add {}", self.amount)
    }

    fn as_any(&self) -> &dyn Any {
        self
    }
}

/// Action that multiplies the value
#[derive(Debug, Clone)]
struct MultiplyAction {
    factor: i32,
    old_value: i32,
}

impl UndoableAction<TestState> for MultiplyAction {
    fn execute(&mut self, state: &mut TestState) -> Result<()> {
        self.old_value = state.value;
        // Use saturating multiplication to avoid overflow
        state.value = state.value.saturating_mul(self.factor);
        state.history.push(format!("mul {}", self.factor));
        Ok(())
    }

    fn undo(&mut self, state: &mut TestState) -> Result<()> {
        state.value = self.old_value;
        state.history.push(format!("undo mul {}", self.factor));
        Ok(())
    }

    fn redo(&mut self, state: &mut TestState) -> Result<()> {
        // Use saturating multiplication to avoid overflow
        state.value = self.old_value.saturating_mul(self.factor);
        state.history.push(format!("redo mul {}", self.factor));
        Ok(())
    }

    fn memory_size(&self) -> usize {
        std::mem::size_of::<Self>()
    }

    fn description(&self) -> String {
        format!("Multiply by {}", self.factor)
    }

    fn as_any(&self) -> &dyn Any {
        self
    }
}

/// Mergeable action for testing action merging
#[derive(Debug, Clone)]
struct MergeableAddAction {
    amount: i32,
}

impl UndoableAction<TestState> for MergeableAddAction {
    fn execute(&mut self, state: &mut TestState) -> Result<()> {
        // Use saturating addition to avoid overflow
        state.value = state.value.saturating_add(self.amount);
        Ok(())
    }

    fn undo(&mut self, state: &mut TestState) -> Result<()> {
        // Use saturating subtraction to avoid overflow
        state.value = state.value.saturating_sub(self.amount);
        Ok(())
    }

    fn redo(&mut self, state: &mut TestState) -> Result<()> {
        // Use saturating addition to avoid overflow
        state.value = state.value.saturating_add(self.amount);
        Ok(())
    }

    fn memory_size(&self) -> usize {
        std::mem::size_of::<Self>()
    }

    fn can_merge(&self, other: &dyn Any) -> bool {
        other.downcast_ref::<MergeableAddAction>().is_some()
    }

    fn merge(&mut self, other: &dyn UndoableAction<TestState>) -> Result<()> {
        if let Some(other_action) = other.as_any().downcast_ref::<MergeableAddAction>() {
            // Use saturating addition to avoid overflow
            self.amount = self.amount.saturating_add(other_action.amount);
            Ok(())
        } else {
            Err(k_os_undo::UndoError::Other("Cannot merge".to_string()))
        }
    }

    fn description(&self) -> String {
        format!("Mergeable Add {}", self.amount)
    }

    fn as_any(&self) -> &dyn Any {
        self
    }
}

/// Large action for memory testing
#[derive(Debug, Clone)]
struct LargeAction {
    data: Vec<u8>,
    amount: i32,
}

impl UndoableAction<TestState> for LargeAction {
    fn execute(&mut self, state: &mut TestState) -> Result<()> {
        // Use saturating addition to avoid overflow
        state.value = state.value.saturating_add(self.amount);
        Ok(())
    }

    fn undo(&mut self, state: &mut TestState) -> Result<()> {
        // Use saturating subtraction to avoid overflow
        state.value = state.value.saturating_sub(self.amount);
        Ok(())
    }

    fn memory_size(&self) -> usize {
        std::mem::size_of::<Self>() + self.data.capacity()
    }

    fn description(&self) -> String {
        format!("Large Action ({}KB)", self.data.len() / 1024)
    }

    fn as_any(&self) -> &dyn Any {
        self
    }
}

// ============================================================================
// Proptest Strategies
// ============================================================================

/// Enum wrapper for different action types (needed for proptest Debug requirement)
#[derive(Debug, Clone)]
enum TestAction {
    Add(AddAction),
    Multiply(MultiplyAction),
    MergeableAdd(MergeableAddAction),
    Large(LargeAction),
}

impl TestAction {
    fn into_boxed(self) -> Box<dyn UndoableAction<TestState>> {
        match self {
            TestAction::Add(a) => Box::new(a),
            TestAction::Multiply(a) => Box::new(a),
            TestAction::MergeableAdd(a) => Box::new(a),
            TestAction::Large(a) => Box::new(a),
        }
    }
}

/// Strategy for generating AddAction
fn add_action_strategy() -> impl Strategy<Value = TestAction> {
    (-100i32..=100i32).prop_map(|amount| TestAction::Add(AddAction { amount }))
}

/// Strategy for generating MultiplyAction
fn multiply_action_strategy() -> impl Strategy<Value = TestAction> {
    (-10i32..=10i32)
        .prop_filter("Avoid zero", |&x| x != 0)
        .prop_map(|factor| {
            TestAction::Multiply(MultiplyAction {
                factor,
                old_value: 0,
            })
        })
}

/// Strategy for generating MergeableAddAction
fn mergeable_action_strategy() -> impl Strategy<Value = TestAction> {
    (-50i32..=50i32).prop_map(|amount| TestAction::MergeableAdd(MergeableAddAction { amount }))
}

/// Strategy for generating LargeAction
fn large_action_strategy() -> impl Strategy<Value = TestAction> {
    (1usize..=100, -10i32..=10i32).prop_map(|(size_kb, amount)| {
        TestAction::Large(LargeAction {
            data: vec![0u8; size_kb * 1024],
            amount,
        })
    })
}

/// Strategy for generating mixed actions
fn mixed_action_strategy() -> impl Strategy<Value = TestAction> {
    prop_oneof![add_action_strategy(), multiply_action_strategy(),]
}

// ============================================================================
// Property 4: Undo/Redo Round-Trip Identity
// **Validates: Requirements 2.2, 2.3, 2.7**
// ============================================================================

proptest! {
    /// **Validates: Requirements 2.2, 2.3, 2.7**
    ///
    /// Property: For any sequence of actions, executing them, then undoing all,
    /// then redoing all should return to the same state.
    ///
    /// This validates:
    /// - Undo correctly restores previous state (Req 2.2)
    /// - Redo correctly restores next state (Req 2.3)
    /// - Undo/redo cycle preserves exact state (Req 2.7)
    #[test]
    fn prop_undo_redo_round_trip_identity(
        actions in prop::collection::vec(mixed_action_strategy(), 1..20)
    ) {
        let mut state = TestState::new();
        let config = UndoManagerConfig {
            enable_merging: false, // Disable merging for this test
            max_memory_bytes: 10 * 1024 * 1024, // 10MB - enough for test
            ..Default::default()
        };
        let mut manager = UndoManager::new(config);

        // Execute all actions
        for action in actions {
            manager.execute(action.into_boxed(), &mut state).unwrap();
        }

        let state_after_execute = state.clone();
        let undo_count = manager.undo_count();

        // Undo all actions
        for _ in 0..undo_count {
            manager.undo(&mut state).unwrap();
        }

        let state_after_undo = state.clone();
        prop_assert_eq!(state_after_undo.value, 0, "State should return to initial value after undoing all");

        // Redo all actions
        for _ in 0..undo_count {
            manager.redo(&mut state).unwrap();
        }

        // State should be identical to state after initial execution
        prop_assert_eq!(
            state.value,
            state_after_execute.value,
            "Undo/redo cycle should return to exact same state"
        );
    }

    /// **Validates: Requirements 2.2, 2.3, 2.7**
    ///
    /// Property: execute(A) -> undo(A) -> redo(A) should equal execute(A)
    ///
    /// This validates that a single action's undo/redo cycle is identity.
    #[test]
    fn prop_single_action_undo_redo_identity(
        action_seed in (-100i32..=100i32)
    ) {
        let mut state = TestState::new();
        let mut manager = UndoManager::new(UndoManagerConfig::default());

        // Execute action
        let action = Box::new(AddAction { amount: action_seed });
        manager.execute(action, &mut state).unwrap();
        let state_after_execute = state.clone();

        // Undo
        manager.undo(&mut state).unwrap();
        prop_assert_eq!(state.value, 0, "Undo should restore initial state");

        // Redo
        manager.redo(&mut state).unwrap();
        prop_assert_eq!(
            state.value,
            state_after_execute.value,
            "Redo should restore executed state"
        );
    }

    /// **Validates: Requirements 2.2, 2.3, 2.7**
    ///
    /// Property: Multiple undo/redo cycles should always return to the same state
    #[test]
    fn prop_multiple_undo_redo_cycles(
        actions in prop::collection::vec(add_action_strategy(), 1..10),
        num_cycles in 1usize..5
    ) {
        let mut state = TestState::new();
        let config = UndoManagerConfig {
            enable_merging: false,
            ..Default::default()
        };
        let mut manager = UndoManager::new(config);

        // Execute all actions
        for action in actions {
            manager.execute(action.into_boxed(), &mut state).unwrap();
        }

        let final_state = state.clone();
        let undo_count = manager.undo_count();

        // Perform multiple undo/redo cycles
        for _ in 0..num_cycles {
            // Undo all
            for _ in 0..undo_count {
                manager.undo(&mut state).unwrap();
            }
            prop_assert_eq!(state.value, 0, "Should return to initial state");

            // Redo all
            for _ in 0..undo_count {
                manager.redo(&mut state).unwrap();
            }
            prop_assert_eq!(
                state.value,
                final_state.value,
                "Should return to final state after each cycle"
            );
        }
    }

    /// **Validates: Requirements 2.2, 2.3, 2.7**
    ///
    /// Property: Partial undo/redo sequences should maintain consistency
    #[test]
    fn prop_partial_undo_redo_consistency(
        actions in prop::collection::vec(mixed_action_strategy(), 3..15),
        undo_steps in 1usize..10
    ) {
        let mut state = TestState::new();
        let config = UndoManagerConfig {
            enable_merging: false,
            ..Default::default()
        };
        let mut manager = UndoManager::new(config);

        // Execute all actions and record intermediate states
        let mut states = vec![state.clone()];
        for action in actions {
            manager.execute(action.into_boxed(), &mut state).unwrap();
            states.push(state.clone());
        }

        let total_actions = manager.undo_count();
        let actual_undo_steps = undo_steps.min(total_actions);

        // Undo some actions
        for _ in 0..actual_undo_steps {
            manager.undo(&mut state).unwrap();
        }

        let expected_state_idx = total_actions - actual_undo_steps;
        prop_assert_eq!(
            state.value,
            states[expected_state_idx].value,
            "Partial undo should match recorded intermediate state"
        );

        // Redo the same number of actions
        for _ in 0..actual_undo_steps {
            manager.redo(&mut state).unwrap();
        }

        prop_assert_eq!(
            state.value,
            states[total_actions].value,
            "Partial redo should restore to final state"
        );
    }
}

// ============================================================================
// Property 5: Undo Stack Memory Invariant
// **Validates: Requirements 2.4, 2.6**
// ============================================================================

proptest! {
    /// **Validates: Requirements 2.4, 2.6**
    ///
    /// Property: current_memory <= max_memory at all times
    ///
    /// This validates that memory limits are enforced (Req 2.4) and
    /// memory tracking is accurate (Req 2.6).
    #[test]
    fn prop_memory_never_exceeds_limit(
        actions in prop::collection::vec(large_action_strategy(), 5..30),
        max_memory_kb in 50usize..500
    ) {
        let mut state = TestState::new();
        let config = UndoManagerConfig {
            max_memory_bytes: max_memory_kb * 1024,
            enable_merging: false,
            ..Default::default()
        };
        let mut manager = UndoManager::new(config);

        // Execute actions and verify memory limit is never exceeded
        for action in actions {
            manager.execute(action.into_boxed(), &mut state).unwrap();

            prop_assert!(
                manager.current_memory_bytes() <= manager.max_memory_bytes(),
                "Memory usage ({} bytes) exceeded limit ({} bytes)",
                manager.current_memory_bytes(),
                manager.max_memory_bytes()
            );
        }
    }

    /// **Validates: Requirements 2.4, 2.6**
    ///
    /// Property: When memory limit is exceeded, oldest actions are removed
    #[test]
    fn prop_oldest_actions_removed_on_memory_limit(
        num_actions in 10usize..50
    ) {
        let mut state = TestState::new();
        let action_size = std::mem::size_of::<AddAction>();
        let max_actions = 5;
        let config = UndoManagerConfig {
            max_memory_bytes: max_actions * action_size,
            enable_merging: false,
            ..Default::default()
        };
        let mut manager = UndoManager::new(config);

        // Execute more actions than the limit allows
        for i in 0..num_actions {
            manager.execute(Box::new(AddAction { amount: i as i32 }), &mut state).unwrap();
        }

        // Should have trimmed to stay within limit
        prop_assert!(
            manager.undo_count() <= max_actions,
            "Undo count ({}) should not exceed max actions ({})",
            manager.undo_count(),
            max_actions
        );

        prop_assert!(
            manager.current_memory_bytes() <= manager.max_memory_bytes(),
            "Memory should be within limit"
        );
    }

    /// **Validates: Requirements 2.4, 2.6**
    ///
    /// Property: Memory tracking is accurate (sum of action sizes = current_memory)
    #[test]
    fn prop_memory_tracking_accuracy(
        actions in prop::collection::vec(add_action_strategy(), 1..20)
    ) {
        let mut state = TestState::new();
        let config = UndoManagerConfig {
            max_memory_bytes: 10 * 1024 * 1024, // Large enough to not trigger trimming
            enable_merging: false,
            ..Default::default()
        };
        let mut manager = UndoManager::new(config);

        let action_size = std::mem::size_of::<AddAction>();
        let mut expected_memory = 0;

        // Execute actions and track expected memory
        for action in actions {
            manager.execute(action.into_boxed(), &mut state).unwrap();
            expected_memory += action_size;

            prop_assert_eq!(
                manager.current_memory_bytes(),
                expected_memory,
                "Memory tracking should be accurate"
            );
        }

        // Undo all and verify memory is still tracked correctly
        let undo_count = manager.undo_count();
        for _ in 0..undo_count {
            manager.undo(&mut state).unwrap();
            // Memory stays the same (moved to redo stack)
            prop_assert_eq!(
                manager.current_memory_bytes(),
                expected_memory,
                "Memory should remain constant during undo (moved to redo stack)"
            );
        }

        // Clear and verify memory is zero
        manager.clear();
        prop_assert_eq!(
            manager.current_memory_bytes(),
            0,
            "Memory should be zero after clear"
        );
    }

    /// **Validates: Requirements 2.4, 2.6**
    ///
    /// Property: Memory usage percentage is accurate
    #[test]
    fn prop_memory_usage_percentage_accuracy(
        num_actions in 1usize..20,
        max_memory_kb in 10usize..100
    ) {
        let mut state = TestState::new();
        let config = UndoManagerConfig {
            max_memory_bytes: max_memory_kb * 1024,
            enable_merging: false,
            ..Default::default()
        };
        let mut manager = UndoManager::new(config);

        // Execute actions
        for i in 0..num_actions {
            manager.execute(Box::new(AddAction { amount: i as i32 }), &mut state).unwrap();
        }

        let current = manager.current_memory_bytes();
        let max = manager.max_memory_bytes();
        let expected_percent = if max == 0 {
            0.0
        } else {
            current as f32 / max as f32
        };

        let actual_percent = manager.memory_usage_percent();

        prop_assert!(
            (actual_percent - expected_percent).abs() < 0.001,
            "Memory usage percentage should be accurate: expected {}, got {}",
            expected_percent,
            actual_percent
        );

        prop_assert!(
            actual_percent >= 0.0 && actual_percent <= 1.0,
            "Memory usage percentage should be between 0.0 and 1.0"
        );
    }

    /// **Validates: Requirements 2.4, 2.6**
    ///
    /// Property: Memory limit of zero should trim immediately
    #[test]
    fn prop_zero_memory_limit_trims_immediately(
        actions in prop::collection::vec(add_action_strategy(), 1..10)
    ) {
        let mut state = TestState::new();
        let config = UndoManagerConfig {
            max_memory_bytes: 0,
            enable_merging: false,
            ..Default::default()
        };
        let mut manager = UndoManager::new(config);

        // Execute actions
        for action in actions {
            manager.execute(action.into_boxed(), &mut state).unwrap();

            // Should have trimmed immediately
            prop_assert_eq!(
                manager.undo_count(),
                0,
                "With zero memory limit, undo stack should always be empty"
            );
        }
    }
}

// ============================================================================
// Property 6: Action Merging Reduces History
// **Validates: Requirement 2.5**
// ============================================================================

proptest! {
    /// **Validates: Requirement 2.5**
    ///
    /// Property: When consecutive mergeable actions are executed,
    /// history size should be less than number of actions
    #[test]
    fn prop_merging_reduces_history_size(
        actions in prop::collection::vec(mergeable_action_strategy(), 2..20)
    ) {
        let mut state = TestState::new();
        let config = UndoManagerConfig {
            enable_merging: true,
            ..Default::default()
        };
        let mut manager = UndoManager::new(config);

        let num_actions = actions.len();

        // Execute all mergeable actions
        for action in actions {
            manager.execute(action.into_boxed(), &mut state).unwrap();
        }

        // History size should be less than number of actions (merged into 1)
        prop_assert!(
            manager.undo_count() < num_actions,
            "History size ({}) should be less than number of actions ({})",
            manager.undo_count(),
            num_actions
        );

        // Should have merged into exactly 1 action
        prop_assert_eq!(
            manager.undo_count(),
            1,
            "All consecutive mergeable actions should merge into 1"
        );
    }

    /// **Validates: Requirement 2.5**
    ///
    /// Property: Merged action memory size should be <= sum of individual action sizes
    #[test]
    fn prop_merged_action_memory_efficient(
        actions in prop::collection::vec(mergeable_action_strategy(), 2..10)
    ) {
        let mut state = TestState::new();
        let config = UndoManagerConfig {
            enable_merging: true,
            ..Default::default()
        };
        let mut manager = UndoManager::new(config);

        let action_size = std::mem::size_of::<MergeableAddAction>();
        let total_individual_size = actions.len() * action_size;

        // Execute all mergeable actions
        for action in actions {
            manager.execute(action.into_boxed(), &mut state).unwrap();
        }

        // Merged action memory should be <= sum of individual sizes
        prop_assert!(
            manager.current_memory_bytes() <= total_individual_size,
            "Merged action memory ({} bytes) should be <= sum of individual sizes ({} bytes)",
            manager.current_memory_bytes(),
            total_individual_size
        );
    }

    /// **Validates: Requirement 2.5**
    ///
    /// Property: Undo of merged action should undo all merged operations
    #[test]
    fn prop_undo_merged_action_undoes_all(
        amounts in prop::collection::vec(-50i32..=50i32, 2..15)
    ) {
        let mut state = TestState::new();
        let config = UndoManagerConfig {
            enable_merging: true,
            ..Default::default()
        };
        let mut manager = UndoManager::new(config);

        let total_amount: i32 = amounts.iter().sum();

        // Execute all mergeable actions
        for amount in amounts {
            manager.execute(Box::new(MergeableAddAction { amount }), &mut state).unwrap();
        }

        prop_assert_eq!(state.value, total_amount, "State should reflect sum of all actions");
        prop_assert_eq!(manager.undo_count(), 1, "Should have merged into 1 action");

        // Undo the merged action
        manager.undo(&mut state).unwrap();

        // Should undo all merged operations
        prop_assert_eq!(
            state.value,
            0,
            "Undoing merged action should undo all merged operations"
        );
    }

    /// **Validates: Requirement 2.5**
    ///
    /// Property: Non-mergeable actions should not be merged
    #[test]
    fn prop_non_mergeable_actions_not_merged(
        actions in prop::collection::vec(add_action_strategy(), 2..10)
    ) {
        let mut state = TestState::new();
        let config = UndoManagerConfig {
            enable_merging: true, // Merging enabled but actions don't support it
            ..Default::default()
        };
        let mut manager = UndoManager::new(config);

        let num_actions = actions.len();

        // Execute all non-mergeable actions
        for action in actions {
            manager.execute(action.into_boxed(), &mut state).unwrap();
        }

        // History size should equal number of actions (not merged)
        prop_assert_eq!(
            manager.undo_count(),
            num_actions,
            "Non-mergeable actions should not be merged"
        );
    }

    /// **Validates: Requirement 2.5**
    ///
    /// Property: Merging disabled should prevent merging
    #[test]
    fn prop_merging_disabled_prevents_merge(
        actions in prop::collection::vec(mergeable_action_strategy(), 2..10)
    ) {
        let mut state = TestState::new();
        let config = UndoManagerConfig {
            enable_merging: false, // Explicitly disabled
            ..Default::default()
        };
        let mut manager = UndoManager::new(config);

        let num_actions = actions.len();

        // Execute all mergeable actions
        for action in actions {
            manager.execute(action.into_boxed(), &mut state).unwrap();
        }

        // History size should equal number of actions (merging disabled)
        prop_assert_eq!(
            manager.undo_count(),
            num_actions,
            "With merging disabled, actions should not be merged"
        );
    }

    /// **Validates: Requirement 2.5**
    ///
    /// Property: Mixed mergeable and non-mergeable actions
    #[test]
    fn prop_mixed_actions_partial_merging(
        num_mergeable in 2usize..10,
        num_non_mergeable in 1usize..5
    ) {
        let mut state = TestState::new();
        let config = UndoManagerConfig {
            enable_merging: true,
            ..Default::default()
        };
        let mut manager = UndoManager::new(config);

        // Execute mergeable actions
        for i in 0..num_mergeable {
            manager.execute(
                Box::new(MergeableAddAction { amount: i as i32 }),
                &mut state
            ).unwrap();
        }

        // Execute non-mergeable action (breaks merge chain)
        for i in 0..num_non_mergeable {
            manager.execute(
                Box::new(AddAction { amount: i as i32 }),
                &mut state
            ).unwrap();
        }

        // Should have: 1 merged action + num_non_mergeable actions
        let expected_count = 1 + num_non_mergeable;
        prop_assert_eq!(
            manager.undo_count(),
            expected_count,
            "Should have 1 merged action + {} non-mergeable actions",
            num_non_mergeable
        );
    }
}

// ============================================================================
// Additional Edge Case Tests
// ============================================================================

#[test]
fn test_empty_action_sequence() {
    let mut state = TestState::new();
    let mut manager = UndoManager::new(UndoManagerConfig::default());

    // No actions executed
    assert_eq!(manager.undo_count(), 0);
    assert_eq!(manager.redo_count(), 0);
    assert_eq!(manager.current_memory_bytes(), 0);
    assert_eq!(manager.memory_usage_percent(), 0.0);

    // Undo/redo should fail gracefully
    assert!(manager.undo(&mut state).is_err());
    assert!(manager.redo(&mut state).is_err());
}

#[test]
fn test_single_action_properties() {
    let mut state = TestState::new();
    let mut manager = UndoManager::new(UndoManagerConfig::default());

    manager
        .execute(Box::new(AddAction { amount: 42 }), &mut state)
        .unwrap();

    assert_eq!(state.value, 42);
    assert_eq!(manager.undo_count(), 1);

    manager.undo(&mut state).unwrap();
    assert_eq!(state.value, 0);

    manager.redo(&mut state).unwrap();
    assert_eq!(state.value, 42);
}

#[test]
fn test_memory_limit_with_exact_fit() {
    let mut state = TestState::new();
    let action_size = std::mem::size_of::<AddAction>();
    let config = UndoManagerConfig {
        max_memory_bytes: action_size * 3, // Exactly 3 actions
        enable_merging: false,
        ..Default::default()
    };
    let mut manager = UndoManager::new(config);

    // Add exactly 3 actions
    for i in 0..3 {
        manager
            .execute(Box::new(AddAction { amount: i }), &mut state)
            .unwrap();
    }

    assert_eq!(manager.undo_count(), 3);
    assert!(manager.current_memory_bytes() <= manager.max_memory_bytes());

    // Add one more - should trim oldest
    manager
        .execute(Box::new(AddAction { amount: 4 }), &mut state)
        .unwrap();

    assert_eq!(manager.undo_count(), 3);
    assert!(manager.current_memory_bytes() <= manager.max_memory_bytes());
}
