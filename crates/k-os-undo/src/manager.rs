//! Undo/Redo manager with memory-aware history management

use crate::action::UndoableAction;
use crate::error::{Result, UndoError};
use parking_lot::Mutex;
use std::sync::Arc;

/// Configuration for the undo manager
#[derive(Debug, Clone)]
pub struct UndoManagerConfig {
    /// Maximum memory usage in bytes (default: 500MB)
    pub max_memory_bytes: usize,
    /// Enable action merging for continuous operations (default: true)
    pub enable_merging: bool,
    /// Enable compression for large actions (default: true)
    pub enable_compression: bool,
    /// Compression threshold in bytes (default: 1MB)
    pub compression_threshold: usize,
}

impl Default for UndoManagerConfig {
    fn default() -> Self {
        Self {
            max_memory_bytes: 500 * 1024 * 1024, // 500MB
            enable_merging: true,
            enable_compression: true,
            compression_threshold: 1024 * 1024, // 1MB
        }
    }
}

/// Universal undo/redo manager
///
/// Manages a history of undoable actions with memory-aware limits,
/// action merging, and optional compression.
///
/// # Type Parameter
///
/// * `State` - The application state type that actions operate on
///
/// # Example
///
/// ```no_run
/// use k_os_undo::{UndoManager, UndoManagerConfig, UndoableAction};
///
/// struct MyState {
///     value: i32,
/// }
///
/// let config = UndoManagerConfig::default();
/// let mut manager = UndoManager::<MyState>::new(config);
///
/// // Execute an action
/// // let action = Box::new(MyAction::new());
/// // manager.execute(action, &mut state)?;
///
/// // Undo
/// // manager.undo(&mut state)?;
///
/// // Redo
/// // manager.redo(&mut state)?;
/// # Ok::<(), k_os_undo::error::UndoError>(())
/// ```
pub struct UndoManager<State> {
    undo_stack: Vec<Box<dyn UndoableAction<State>>>,
    redo_stack: Vec<Box<dyn UndoableAction<State>>>,
    current_memory: usize,
    config: UndoManagerConfig,
}

impl<State> UndoManager<State> {
    /// Create a new undo manager with default configuration
    pub fn new(config: UndoManagerConfig) -> Self {
        Self {
            undo_stack: Vec::new(),
            redo_stack: Vec::new(),
            current_memory: 0,
            config,
        }
    }

    /// Create a new undo manager with a specific memory limit in megabytes
    pub fn with_memory_limit(max_memory_mb: usize) -> Self {
        let config = UndoManagerConfig {
            max_memory_bytes: max_memory_mb * 1024 * 1024,
            ..Default::default()
        };
        Self::new(config)
    }

    /// Execute an action and add it to the undo stack
    ///
    /// This will:
    /// 1. Execute the action on the state
    /// 2. Clear the redo stack (since we're creating a new branch)
    /// 3. Try to merge with the previous action if possible
    /// 4. Add to undo stack
    /// 5. Trim history if memory limit is exceeded
    ///
    /// # Arguments
    ///
    /// * `action` - The action to execute
    /// * `state` - Mutable reference to the application state
    pub fn execute(
        &mut self,
        mut action: Box<dyn UndoableAction<State>>,
        state: &mut State,
    ) -> Result<()> {
        // Execute the action
        action.execute(state)?;

        // Clear redo stack (we're creating a new branch)
        self.clear_redo_stack();

        // Try to merge with previous action if enabled
        if self.config.enable_merging && !self.undo_stack.is_empty() {
            let last_idx = self.undo_stack.len() - 1;
            if let Some(last_action) = self.undo_stack.get_mut(last_idx) {
                if last_action.can_merge(action.as_any()) {
                    log::debug!("Merging actions: {}", action.description());
                    let old_size = last_action.memory_size();

                    // Merge by passing a reference to read data from
                    last_action.merge(action.as_ref())?;

                    let new_size = last_action.memory_size();

                    // Update memory tracking (action is dropped here, freeing its memory)
                    self.current_memory = self.current_memory.saturating_sub(old_size);
                    self.current_memory += new_size;
                    // Don't add action_size since we're not keeping the action

                    // Trim if needed
                    self.trim_history_if_needed();
                    return Ok(());
                }
            }
        }

        // Add to undo stack
        let action_size = action.memory_size();
        self.undo_stack.push(action);
        self.current_memory += action_size;

        log::debug!(
            "Action added to undo stack. Memory: {} / {} bytes",
            self.current_memory,
            self.config.max_memory_bytes
        );

        // Trim history if memory limit exceeded
        self.trim_history_if_needed();

        Ok(())
    }

    /// Undo the last action
    ///
    /// # Arguments
    ///
    /// * `state` - Mutable reference to the application state
    pub fn undo(&mut self, state: &mut State) -> Result<()> {
        let mut action = self.undo_stack.pop().ok_or(UndoError::NothingToUndo)?;

        let action_size = action.memory_size();
        self.current_memory = self.current_memory.saturating_sub(action_size);

        // Undo the action
        action.undo(state)?;

        // Move to redo stack
        let redo_size = action.memory_size();
        self.redo_stack.push(action);
        self.current_memory += redo_size;

        log::debug!("Action undone. Memory: {} bytes", self.current_memory);

        Ok(())
    }

    /// Redo the last undone action
    ///
    /// # Arguments
    ///
    /// * `state` - Mutable reference to the application state
    pub fn redo(&mut self, state: &mut State) -> Result<()> {
        let mut action = self.redo_stack.pop().ok_or(UndoError::NothingToRedo)?;

        let action_size = action.memory_size();
        self.current_memory = self.current_memory.saturating_sub(action_size);

        // Redo the action
        action.redo(state)?;

        // Move back to undo stack
        let undo_size = action.memory_size();
        self.undo_stack.push(action);
        self.current_memory += undo_size;

        log::debug!("Action redone. Memory: {} bytes", self.current_memory);

        Ok(())
    }

    /// Clear all history (both undo and redo stacks)
    pub fn clear(&mut self) {
        self.undo_stack.clear();
        self.redo_stack.clear();
        self.current_memory = 0;
        log::debug!("Undo/redo history cleared");
    }

    /// Check if undo is available
    pub fn can_undo(&self) -> bool {
        !self.undo_stack.is_empty()
    }

    /// Check if redo is available
    pub fn can_redo(&self) -> bool {
        !self.redo_stack.is_empty()
    }

    /// Get the number of actions in the undo stack
    pub fn undo_count(&self) -> usize {
        self.undo_stack.len()
    }

    /// Get the number of actions in the redo stack
    pub fn redo_count(&self) -> usize {
        self.redo_stack.len()
    }

    /// Get current memory usage in bytes
    pub fn current_memory_bytes(&self) -> usize {
        self.current_memory
    }

    /// Get maximum memory limit in bytes
    pub fn max_memory_bytes(&self) -> usize {
        self.config.max_memory_bytes
    }

    /// Get memory usage as a percentage (0.0 to 1.0)
    pub fn memory_usage_percent(&self) -> f32 {
        if self.config.max_memory_bytes == 0 {
            0.0
        } else {
            self.current_memory as f32 / self.config.max_memory_bytes as f32
        }
    }

    /// Get the description of the next action to undo
    pub fn next_undo_description(&self) -> Option<String> {
        self.undo_stack.last().map(|a| a.description())
    }

    /// Get the description of the next action to redo
    pub fn next_redo_description(&self) -> Option<String> {
        self.redo_stack.last().map(|a| a.description())
    }

    /// Clear the redo stack
    fn clear_redo_stack(&mut self) {
        for action in self.redo_stack.drain(..) {
            self.current_memory = self.current_memory.saturating_sub(action.memory_size());
        }
    }

    /// Trim history if memory limit is exceeded
    ///
    /// Removes oldest actions from the undo stack until memory usage
    /// is below the limit.
    fn trim_history_if_needed(&mut self) {
        while self.current_memory > self.config.max_memory_bytes && !self.undo_stack.is_empty() {
            if let Some(action) = self.undo_stack.first() {
                let size = action.memory_size();
                log::warn!(
                    "Memory limit exceeded ({} / {} bytes), removing oldest action: {}",
                    self.current_memory,
                    self.config.max_memory_bytes,
                    action.description()
                );
                self.undo_stack.remove(0);
                self.current_memory = self.current_memory.saturating_sub(size);
            }
        }
    }
}

/// Thread-safe wrapper around UndoManager
///
/// Allows sharing the undo manager across threads using Arc<Mutex<>>.
pub type SharedUndoManager<State> = Arc<Mutex<UndoManager<State>>>;

#[cfg(test)]
mod tests {
    use super::*;
    use std::any::Any;

    #[derive(Debug)]
    struct TestState {
        value: i32,
        operations: Vec<String>,
    }

    impl TestState {
        fn new() -> Self {
            Self {
                value: 0,
                operations: Vec::new(),
            }
        }
    }

    struct IncrementAction {
        amount: i32,
    }

    impl UndoableAction<TestState> for IncrementAction {
        fn execute(&mut self, state: &mut TestState) -> Result<()> {
            state.value += self.amount;
            state.operations.push(format!("exec +{}", self.amount));
            Ok(())
        }

        fn undo(&mut self, state: &mut TestState) -> Result<()> {
            state.value -= self.amount;
            state.operations.push(format!("undo +{}", self.amount));
            Ok(())
        }

        fn memory_size(&self) -> usize {
            std::mem::size_of::<Self>()
        }

        fn description(&self) -> String {
            format!("Increment by {}", self.amount)
        }

        fn as_any(&self) -> &dyn Any {
            self
        }
    }

    // Mergeable action for testing
    struct MergeableAction {
        value: i32,
    }

    impl UndoableAction<TestState> for MergeableAction {
        fn execute(&mut self, state: &mut TestState) -> Result<()> {
            state.value += self.value;
            Ok(())
        }

        fn undo(&mut self, state: &mut TestState) -> Result<()> {
            state.value -= self.value;
            Ok(())
        }

        fn memory_size(&self) -> usize {
            std::mem::size_of::<Self>()
        }

        fn can_merge(&self, other: &dyn Any) -> bool {
            other.downcast_ref::<MergeableAction>().is_some()
        }

        fn merge(&mut self, other: &dyn UndoableAction<TestState>) -> Result<()> {
            if let Some(other_action) = other.as_any().downcast_ref::<MergeableAction>() {
                self.value += other_action.value;
                Ok(())
            } else {
                Err(UndoError::Other("Cannot merge".to_string()))
            }
        }

        fn as_any(&self) -> &dyn Any {
            self
        }
    }

    // Large action for memory testing
    struct LargeAction {
        data: Vec<u8>,
    }

    impl UndoableAction<TestState> for LargeAction {
        fn execute(&mut self, state: &mut TestState) -> Result<()> {
            state.value += 1;
            Ok(())
        }

        fn undo(&mut self, state: &mut TestState) -> Result<()> {
            state.value -= 1;
            Ok(())
        }

        fn memory_size(&self) -> usize {
            std::mem::size_of::<Self>() + self.data.capacity()
        }

        fn as_any(&self) -> &dyn Any {
            self
        }
    }

    // === Execute/Undo/Redo Cycle Tests ===

    #[test]
    fn test_execute_undo_redo() {
        let mut state = TestState::new();
        let mut manager = UndoManager::new(UndoManagerConfig::default());

        // Execute action
        let action = Box::new(IncrementAction { amount: 5 });
        manager.execute(action, &mut state).unwrap();
        assert_eq!(state.value, 5);
        assert_eq!(manager.undo_count(), 1);
        assert_eq!(manager.redo_count(), 0);

        // Undo
        manager.undo(&mut state).unwrap();
        assert_eq!(state.value, 0);
        assert_eq!(manager.undo_count(), 0);
        assert_eq!(manager.redo_count(), 1);

        // Redo
        manager.redo(&mut state).unwrap();
        assert_eq!(state.value, 5);
        assert_eq!(manager.undo_count(), 1);
        assert_eq!(manager.redo_count(), 0);
    }

    #[test]
    fn test_multiple_undo_redo_cycles() {
        let mut state = TestState::new();
        let mut manager = UndoManager::new(UndoManagerConfig::default());

        // Execute action
        manager
            .execute(Box::new(IncrementAction { amount: 5 }), &mut state)
            .unwrap();

        // Multiple undo/redo cycles
        for _ in 0..5 {
            manager.undo(&mut state).unwrap();
            assert_eq!(state.value, 0);

            manager.redo(&mut state).unwrap();
            assert_eq!(state.value, 5);
        }
    }

    #[test]
    fn test_multiple_actions() {
        let mut state = TestState::new();
        let mut manager = UndoManager::new(UndoManagerConfig::default());

        // Execute multiple actions
        manager
            .execute(Box::new(IncrementAction { amount: 5 }), &mut state)
            .unwrap();
        manager
            .execute(Box::new(IncrementAction { amount: 3 }), &mut state)
            .unwrap();
        manager
            .execute(Box::new(IncrementAction { amount: 2 }), &mut state)
            .unwrap();

        assert_eq!(state.value, 10);
        assert_eq!(manager.undo_count(), 3);

        // Undo all
        manager.undo(&mut state).unwrap();
        assert_eq!(state.value, 8);
        manager.undo(&mut state).unwrap();
        assert_eq!(state.value, 5);
        manager.undo(&mut state).unwrap();
        assert_eq!(state.value, 0);

        assert_eq!(manager.undo_count(), 0);
        assert_eq!(manager.redo_count(), 3);
    }

    #[test]
    fn test_redo_stack_cleared_on_new_action() {
        let mut state = TestState::new();
        let config = UndoManagerConfig {
            enable_merging: false,
            ..Default::default()
        };
        let mut manager = UndoManager::new(config);

        // Execute and undo
        manager
            .execute(Box::new(IncrementAction { amount: 5 }), &mut state)
            .unwrap();
        manager.undo(&mut state).unwrap();
        assert_eq!(manager.redo_count(), 1);

        // Execute new action - should clear redo stack
        manager
            .execute(Box::new(IncrementAction { amount: 3 }), &mut state)
            .unwrap();
        assert_eq!(manager.redo_count(), 0);
        assert_eq!(state.value, 3);
    }

    #[test]
    fn test_undo_redo_preserves_state() {
        let mut state = TestState::new();
        let mut manager = UndoManager::new(UndoManagerConfig::default());

        // Execute multiple actions
        manager
            .execute(Box::new(IncrementAction { amount: 10 }), &mut state)
            .unwrap();
        manager
            .execute(Box::new(IncrementAction { amount: 20 }), &mut state)
            .unwrap();
        manager
            .execute(Box::new(IncrementAction { amount: 30 }), &mut state)
            .unwrap();

        let final_value = state.value;
        assert_eq!(final_value, 60);

        // Undo all then redo all - should return to same state
        manager.undo(&mut state).unwrap();
        manager.undo(&mut state).unwrap();
        manager.undo(&mut state).unwrap();
        assert_eq!(state.value, 0);

        manager.redo(&mut state).unwrap();
        manager.redo(&mut state).unwrap();
        manager.redo(&mut state).unwrap();
        assert_eq!(state.value, final_value);
    }

    #[test]
    fn test_empty_stack_operations() {
        let mut state = TestState::new();
        let mut manager = UndoManager::new(UndoManagerConfig::default());

        // Try undo on empty stack
        let result = manager.undo(&mut state);
        assert!(matches!(result, Err(UndoError::NothingToUndo)));

        // Try redo on empty stack
        let result = manager.redo(&mut state);
        assert!(matches!(result, Err(UndoError::NothingToRedo)));
    }

    #[test]
    fn test_single_action_undo_redo() {
        let mut state = TestState::new();
        let mut manager = UndoManager::new(UndoManagerConfig::default());

        manager
            .execute(Box::new(IncrementAction { amount: 7 }), &mut state)
            .unwrap();
        assert_eq!(state.value, 7);

        manager.undo(&mut state).unwrap();
        assert_eq!(state.value, 0);

        // Try undo again - should fail
        let result = manager.undo(&mut state);
        assert!(matches!(result, Err(UndoError::NothingToUndo)));

        manager.redo(&mut state).unwrap();
        assert_eq!(state.value, 7);

        // Try redo again - should fail
        let result = manager.redo(&mut state);
        assert!(matches!(result, Err(UndoError::NothingToRedo)));
    }

    // === Memory Limit Enforcement Tests ===

    #[test]
    fn test_memory_limit_enforcement() {
        let mut state = TestState::new();
        let config = UndoManagerConfig {
            max_memory_bytes: 100, // Very small limit
            enable_merging: false,
            ..Default::default()
        };
        let mut manager = UndoManager::new(config);

        // Execute many actions to exceed memory limit
        for i in 0..50 {
            manager
                .execute(Box::new(IncrementAction { amount: i }), &mut state)
                .unwrap();
        }

        // Should have trimmed old actions
        assert!(manager.undo_count() < 50);
        assert!(manager.current_memory_bytes() <= 100);
    }

    #[test]
    fn test_memory_tracking_accuracy() {
        let mut state = TestState::new();
        let mut manager = UndoManager::new(UndoManagerConfig::default());

        assert_eq!(manager.current_memory_bytes(), 0);

        // Execute action
        let action_size = std::mem::size_of::<IncrementAction>();
        manager
            .execute(Box::new(IncrementAction { amount: 5 }), &mut state)
            .unwrap();

        assert_eq!(manager.current_memory_bytes(), action_size);

        // Undo - memory should move to redo stack
        manager.undo(&mut state).unwrap();
        assert_eq!(manager.current_memory_bytes(), action_size);

        // Clear - memory should be zero
        manager.clear();
        assert_eq!(manager.current_memory_bytes(), 0);
    }

    #[test]
    fn test_memory_limit_with_large_actions() {
        let mut state = TestState::new();
        let config = UndoManagerConfig {
            max_memory_bytes: 500,
            enable_merging: false,
            ..Default::default()
        };
        let mut manager = UndoManager::new(config);

        // Add large actions
        for _ in 0..10 {
            manager
                .execute(Box::new(LargeAction { data: vec![0; 100] }), &mut state)
                .unwrap();
        }

        // Should have trimmed to stay under limit
        assert!(manager.current_memory_bytes() <= 500);
        assert!(manager.undo_count() < 10);
    }

    #[test]
    fn test_memory_usage_percent() {
        let mut state = TestState::new();
        let config = UndoManagerConfig {
            max_memory_bytes: 1000,
            ..Default::default()
        };
        let mut manager = UndoManager::new(config);

        assert_eq!(manager.memory_usage_percent(), 0.0);

        // Add actions to use ~50% memory
        let action_size = std::mem::size_of::<IncrementAction>();
        let num_actions = 500 / action_size;

        for i in 0..num_actions {
            manager
                .execute(Box::new(IncrementAction { amount: i as i32 }), &mut state)
                .unwrap();
        }

        let usage = manager.memory_usage_percent();
        assert!(usage > 0.0 && usage < 1.0);
    }

    #[test]
    fn test_memory_limit_zero() {
        let mut state = TestState::new();
        let config = UndoManagerConfig {
            max_memory_bytes: 0,
            enable_merging: false,
            ..Default::default()
        };
        let mut manager = UndoManager::new(config);

        // Should still work but trim immediately
        manager
            .execute(Box::new(IncrementAction { amount: 5 }), &mut state)
            .unwrap();

        // Should have trimmed immediately
        assert_eq!(manager.undo_count(), 0);
    }

    #[test]
    fn test_memory_tracking_after_undo_redo() {
        let mut state = TestState::new();
        let mut manager = UndoManager::new(UndoManagerConfig::default());

        let action_size = std::mem::size_of::<IncrementAction>();

        // Execute
        manager
            .execute(Box::new(IncrementAction { amount: 5 }), &mut state)
            .unwrap();
        assert_eq!(manager.current_memory_bytes(), action_size);

        // Undo - memory stays same (moved to redo stack)
        manager.undo(&mut state).unwrap();
        assert_eq!(manager.current_memory_bytes(), action_size);

        // Redo - memory stays same (moved back to undo stack)
        manager.redo(&mut state).unwrap();
        assert_eq!(manager.current_memory_bytes(), action_size);
    }

    // === Action Merging Tests ===

    #[test]
    fn test_action_merging_enabled() {
        let mut state = TestState::new();
        let config = UndoManagerConfig {
            enable_merging: true,
            ..Default::default()
        };
        let mut manager = UndoManager::new(config);

        // Execute mergeable actions
        manager
            .execute(Box::new(MergeableAction { value: 5 }), &mut state)
            .unwrap();
        manager
            .execute(Box::new(MergeableAction { value: 3 }), &mut state)
            .unwrap();
        manager
            .execute(Box::new(MergeableAction { value: 2 }), &mut state)
            .unwrap();

        assert_eq!(state.value, 10);
        // Should have merged into 1 action
        assert_eq!(manager.undo_count(), 1);

        // Undo should remove all merged changes
        manager.undo(&mut state).unwrap();
        assert_eq!(state.value, 0);

        // Redo should restore all merged changes
        manager.redo(&mut state).unwrap();
        assert_eq!(state.value, 10);
    }

    #[test]
    fn test_action_merging_disabled() {
        let mut state = TestState::new();
        let config = UndoManagerConfig {
            enable_merging: false,
            ..Default::default()
        };
        let mut manager = UndoManager::new(config);

        // Execute mergeable actions
        manager
            .execute(Box::new(MergeableAction { value: 5 }), &mut state)
            .unwrap();
        manager
            .execute(Box::new(MergeableAction { value: 3 }), &mut state)
            .unwrap();
        manager
            .execute(Box::new(MergeableAction { value: 2 }), &mut state)
            .unwrap();

        assert_eq!(state.value, 10);
        // Should NOT have merged
        assert_eq!(manager.undo_count(), 3);
    }

    #[test]
    fn test_non_mergeable_actions_not_merged() {
        let mut state = TestState::new();
        let config = UndoManagerConfig {
            enable_merging: true,
            ..Default::default()
        };
        let mut manager = UndoManager::new(config);

        // Execute non-mergeable actions
        manager
            .execute(Box::new(IncrementAction { amount: 5 }), &mut state)
            .unwrap();
        manager
            .execute(Box::new(IncrementAction { amount: 3 }), &mut state)
            .unwrap();

        // Should NOT have merged (IncrementAction doesn't implement merging)
        assert_eq!(manager.undo_count(), 2);
    }

    #[test]
    fn test_merging_updates_memory_correctly() {
        let mut state = TestState::new();
        let config = UndoManagerConfig {
            enable_merging: true,
            ..Default::default()
        };
        let mut manager = UndoManager::new(config);

        let action_size = std::mem::size_of::<MergeableAction>();

        // Execute first action
        manager
            .execute(Box::new(MergeableAction { value: 5 }), &mut state)
            .unwrap();
        assert_eq!(manager.current_memory_bytes(), action_size);

        // Execute second action - should merge
        manager
            .execute(Box::new(MergeableAction { value: 3 }), &mut state)
            .unwrap();

        // Memory should still be for one action (merged)
        assert_eq!(manager.current_memory_bytes(), action_size);
        assert_eq!(manager.undo_count(), 1);
    }

    #[test]
    fn test_merging_with_different_action_types() {
        let mut state = TestState::new();
        let config = UndoManagerConfig {
            enable_merging: true,
            ..Default::default()
        };
        let mut manager = UndoManager::new(config);

        // Execute mergeable action
        manager
            .execute(Box::new(MergeableAction { value: 5 }), &mut state)
            .unwrap();

        // Execute different type - should NOT merge
        manager
            .execute(Box::new(IncrementAction { amount: 3 }), &mut state)
            .unwrap();

        assert_eq!(manager.undo_count(), 2);
    }

    // === Additional Manager Tests ===

    #[test]
    fn test_can_undo_redo() {
        let mut state = TestState::new();
        let mut manager = UndoManager::new(UndoManagerConfig::default());

        assert!(!manager.can_undo());
        assert!(!manager.can_redo());

        manager
            .execute(Box::new(IncrementAction { amount: 5 }), &mut state)
            .unwrap();
        assert!(manager.can_undo());
        assert!(!manager.can_redo());

        manager.undo(&mut state).unwrap();
        assert!(!manager.can_undo());
        assert!(manager.can_redo());
    }

    #[test]
    fn test_clear() {
        let mut state = TestState::new();
        let mut manager = UndoManager::new(UndoManagerConfig::default());

        manager
            .execute(Box::new(IncrementAction { amount: 5 }), &mut state)
            .unwrap();
        manager.undo(&mut state).unwrap();

        assert!(manager.can_redo());
        manager.clear();
        assert!(!manager.can_undo());
        assert!(!manager.can_redo());
        assert_eq!(manager.current_memory_bytes(), 0);
    }

    #[test]
    fn test_action_descriptions() {
        let mut state = TestState::new();
        let mut manager = UndoManager::new(UndoManagerConfig::default());

        manager
            .execute(Box::new(IncrementAction { amount: 5 }), &mut state)
            .unwrap();

        let desc = manager.next_undo_description();
        assert!(desc.is_some());
        assert_eq!(desc.unwrap(), "Increment by 5");

        manager.undo(&mut state).unwrap();
        let desc = manager.next_redo_description();
        assert!(desc.is_some());
        assert_eq!(desc.unwrap(), "Increment by 5");
    }

    #[test]
    fn test_with_memory_limit_constructor() {
        let manager = UndoManager::<TestState>::with_memory_limit(100);
        assert_eq!(manager.max_memory_bytes(), 100 * 1024 * 1024);
    }

    #[test]
    fn test_undo_count_redo_count() {
        let mut state = TestState::new();
        let mut manager = UndoManager::new(UndoManagerConfig::default());

        assert_eq!(manager.undo_count(), 0);
        assert_eq!(manager.redo_count(), 0);

        manager
            .execute(Box::new(IncrementAction { amount: 5 }), &mut state)
            .unwrap();
        assert_eq!(manager.undo_count(), 1);
        assert_eq!(manager.redo_count(), 0);

        manager.undo(&mut state).unwrap();
        assert_eq!(manager.undo_count(), 0);
        assert_eq!(manager.redo_count(), 1);
    }

    #[test]
    fn test_max_memory_bytes() {
        let config = UndoManagerConfig {
            max_memory_bytes: 12345,
            ..Default::default()
        };
        let manager = UndoManager::<TestState>::new(config);
        assert_eq!(manager.max_memory_bytes(), 12345);
    }

    #[test]
    fn test_operations_tracking() {
        let mut state = TestState::new();
        let mut manager = UndoManager::new(UndoManagerConfig::default());

        manager
            .execute(Box::new(IncrementAction { amount: 5 }), &mut state)
            .unwrap();
        assert_eq!(state.operations, vec!["exec +5"]);

        manager.undo(&mut state).unwrap();
        assert_eq!(state.operations, vec!["exec +5", "undo +5"]);

        manager.redo(&mut state).unwrap();
        assert_eq!(state.operations, vec!["exec +5", "undo +5", "exec +5"]);
    }
}
