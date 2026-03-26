//! Core action trait and utilities for undo/redo operations

use crate::error::Result;
use std::any::Any;

/// Trait for undoable actions
///
/// All actions that can be undone/redone must implement this trait.
/// Actions are responsible for:
/// - Executing the operation
/// - Undoing the operation (restoring previous state)
/// - Redoing the operation (reapplying the change)
/// - Reporting memory usage
/// - Determining if they can be merged with other actions
///
/// # Type Parameter
///
/// * `State` - The application state type that this action operates on
pub trait UndoableAction<State>: Send + Sync {
    /// Execute the action, modifying the state
    ///
    /// This is called when the action is first performed.
    ///
    /// # Arguments
    ///
    /// * `state` - Mutable reference to the application state
    fn execute(&mut self, state: &mut State) -> Result<()>;

    /// Undo the action, restoring the previous state
    ///
    /// This must restore the state to exactly what it was before execute() was called.
    ///
    /// # Arguments
    ///
    /// * `state` - Mutable reference to the application state
    fn undo(&mut self, state: &mut State) -> Result<()>;

    /// Redo the action, reapplying the change
    ///
    /// This must restore the state to exactly what it was after execute() was called.
    /// By default, this calls execute() again, but can be overridden for efficiency.
    ///
    /// # Arguments
    ///
    /// * `state` - Mutable reference to the application state
    fn redo(&mut self, state: &mut State) -> Result<()> {
        self.execute(state)
    }

    /// Get the memory size of this action in bytes
    ///
    /// This should include all heap-allocated data owned by the action.
    /// Used for memory-aware history management.
    fn memory_size(&self) -> usize;

    /// Check if this action can be merged with another action
    ///
    /// Actions can be merged if they represent continuous operations
    /// (e.g., consecutive brush strokes, continuous value changes).
    ///
    /// # Arguments
    ///
    /// * `other` - The other action to potentially merge with
    ///
    /// # Returns
    ///
    /// `true` if the actions can be merged, `false` otherwise
    fn can_merge(&self, other: &dyn Any) -> bool {
        let _ = other;
        false
    }

    /// Merge another action into this one
    ///
    /// This is only called if `can_merge()` returned true.
    /// The merged action should represent the combined effect of both actions.
    ///
    /// # Arguments
    ///
    /// * `other` - The other action to merge into this one (as a reference for reading data)
    fn merge(&mut self, other: &dyn UndoableAction<State>) -> Result<()> {
        let _ = other;
        Err(crate::error::UndoError::Other(
            "Merge not implemented".to_string(),
        ))
    }

    /// Get a human-readable description of this action
    ///
    /// Used for debugging and UI display.
    fn description(&self) -> String {
        "Undoable Action".to_string()
    }

    /// Convert to Any for downcasting
    fn as_any(&self) -> &dyn Any;
}

/// Helper trait for actions that support compression
///
/// Actions with large state data can implement this trait to enable
/// automatic compression when memory limits are approached.
pub trait CompressibleAction: serde::Serialize + for<'de> serde::Deserialize<'de> {
    /// Compress the action data
    fn compress(&self) -> Result<Vec<u8>> {
        use flate2::write::GzEncoder;
        use flate2::Compression;
        use std::io::Write;

        let serialized = bincode::serialize(self).map_err(|e| {
            crate::error::UndoError::SerializationFailed(format!("bincode error: {}", e))
        })?;

        let mut encoder = GzEncoder::new(Vec::new(), Compression::default());
        encoder.write_all(&serialized).map_err(|e| {
            crate::error::UndoError::CompressionFailed(format!("write error: {}", e))
        })?;

        encoder
            .finish()
            .map_err(|e| crate::error::UndoError::CompressionFailed(format!("finish error: {}", e)))
    }

    /// Decompress the action data
    fn decompress(data: &[u8]) -> Result<Self>
    where
        Self: Sized,
    {
        use flate2::read::GzDecoder;
        use std::io::Read;

        let mut decoder = GzDecoder::new(data);
        let mut decompressed = Vec::new();
        decoder.read_to_end(&mut decompressed).map_err(|e| {
            crate::error::UndoError::DecompressionFailed(format!("read error: {}", e))
        })?;

        bincode::deserialize(&decompressed).map_err(|e| {
            crate::error::UndoError::DeserializationFailed(format!("bincode error: {}", e))
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[derive(Debug)]
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

    struct IncrementAction {
        amount: i32,
    }

    impl UndoableAction<TestState> for IncrementAction {
        fn execute(&mut self, state: &mut TestState) -> Result<()> {
            state.value += self.amount;
            state.history.push(format!("execute +{}", self.amount));
            Ok(())
        }

        fn undo(&mut self, state: &mut TestState) -> Result<()> {
            state.value -= self.amount;
            state.history.push(format!("undo +{}", self.amount));
            Ok(())
        }

        fn memory_size(&self) -> usize {
            std::mem::size_of::<Self>()
        }

        fn as_any(&self) -> &dyn Any {
            self
        }
    }

    struct SetValueAction {
        old_value: i32,
        new_value: i32,
    }

    impl UndoableAction<TestState> for SetValueAction {
        fn execute(&mut self, state: &mut TestState) -> Result<()> {
            self.old_value = state.value;
            state.value = self.new_value;
            Ok(())
        }

        fn undo(&mut self, state: &mut TestState) -> Result<()> {
            state.value = self.old_value;
            Ok(())
        }

        fn memory_size(&self) -> usize {
            std::mem::size_of::<Self>()
        }

        fn as_any(&self) -> &dyn Any {
            self
        }
    }

    // Mergeable action for testing action merging
    struct AddToHistoryAction {
        message: String,
    }

    impl UndoableAction<TestState> for AddToHistoryAction {
        fn execute(&mut self, state: &mut TestState) -> Result<()> {
            state.history.push(self.message.clone());
            Ok(())
        }

        fn undo(&mut self, state: &mut TestState) -> Result<()> {
            state.history.pop();
            Ok(())
        }

        fn memory_size(&self) -> usize {
            std::mem::size_of::<Self>() + self.message.capacity()
        }

        fn can_merge(&self, other: &dyn Any) -> bool {
            other.downcast_ref::<AddToHistoryAction>().is_some()
        }

        fn merge(&mut self, other: &dyn UndoableAction<TestState>) -> Result<()> {
            if let Some(other_action) = other.as_any().downcast_ref::<AddToHistoryAction>() {
                self.message.push_str(" + ");
                self.message.push_str(&other_action.message);
                Ok(())
            } else {
                Err(crate::error::UndoError::Other("Cannot merge".to_string()))
            }
        }

        fn as_any(&self) -> &dyn Any {
            self
        }
    }

    #[test]
    fn test_action_execute_undo() {
        let mut state = TestState::new();
        let mut action = IncrementAction { amount: 5 };

        action.execute(&mut state).unwrap();
        assert_eq!(state.value, 5);
        assert_eq!(state.history.len(), 1);

        action.undo(&mut state).unwrap();
        assert_eq!(state.value, 0);
        assert_eq!(state.history.len(), 2);
    }

    #[test]
    fn test_action_redo() {
        let mut state = TestState::new();
        let mut action = IncrementAction { amount: 5 };

        action.execute(&mut state).unwrap();
        action.undo(&mut state).unwrap();
        action.redo(&mut state).unwrap();
        assert_eq!(state.value, 5);
    }

    #[test]
    fn test_action_redo_default_implementation() {
        // Test that default redo() calls execute()
        let mut state = TestState::new();
        let mut action = IncrementAction { amount: 7 };

        action.execute(&mut state).unwrap();
        assert_eq!(state.value, 7);

        action.undo(&mut state).unwrap();
        assert_eq!(state.value, 0);

        // Redo should call execute again
        action.redo(&mut state).unwrap();
        assert_eq!(state.value, 7);
    }

    #[test]
    fn test_action_memory_size() {
        let action = IncrementAction { amount: 5 };
        assert_eq!(action.memory_size(), std::mem::size_of::<IncrementAction>());
    }

    #[test]
    fn test_action_description_default() {
        let action = IncrementAction { amount: 5 };
        assert_eq!(action.description(), "Undoable Action");
    }

    #[test]
    fn test_action_can_merge_default() {
        let action1 = IncrementAction { amount: 5 };
        let action2 = IncrementAction { amount: 3 };

        // Default implementation returns false
        assert!(!action1.can_merge(&action2 as &dyn Any));
    }

    #[test]
    fn test_action_merge_not_implemented() {
        let mut action1 = IncrementAction { amount: 5 };
        let action2 = IncrementAction { amount: 3 };

        // Default implementation returns error
        let result = action1.merge(&action2);
        assert!(result.is_err());
    }

    #[test]
    fn test_mergeable_action_can_merge() {
        let action1 = AddToHistoryAction {
            message: "first".to_string(),
        };
        let action2 = AddToHistoryAction {
            message: "second".to_string(),
        };

        assert!(action1.can_merge(&action2 as &dyn Any));
    }

    #[test]
    fn test_mergeable_action_merge() {
        let mut state = TestState::new();
        let mut action1 = AddToHistoryAction {
            message: "first".to_string(),
        };
        let action2 = AddToHistoryAction {
            message: "second".to_string(),
        };

        action1.execute(&mut state).unwrap();
        assert_eq!(state.history, vec!["first"]);

        action1.merge(&action2).unwrap();
        assert_eq!(action1.message, "first + second");
    }

    #[test]
    fn test_set_value_action_stores_old_value() {
        let mut state = TestState::new();
        state.value = 10;

        let mut action = SetValueAction {
            old_value: 0,
            new_value: 20,
        };

        action.execute(&mut state).unwrap();
        assert_eq!(state.value, 20);
        assert_eq!(action.old_value, 10); // Should have stored old value

        action.undo(&mut state).unwrap();
        assert_eq!(state.value, 10); // Should restore old value
    }

    #[test]
    fn test_multiple_execute_undo_cycles() {
        let mut state = TestState::new();
        let mut action = IncrementAction { amount: 5 };

        // Execute -> Undo -> Execute -> Undo
        for _ in 0..3 {
            action.execute(&mut state).unwrap();
            assert_eq!(state.value, 5);

            action.undo(&mut state).unwrap();
            assert_eq!(state.value, 0);
        }
    }

    #[test]
    fn test_action_with_negative_amount() {
        let mut state = TestState::new();
        let mut action = IncrementAction { amount: -5 };

        action.execute(&mut state).unwrap();
        assert_eq!(state.value, -5);

        action.undo(&mut state).unwrap();
        assert_eq!(state.value, 0);
    }

    // Compression tests
    #[cfg(feature = "compression")]
    mod compression_tests {
        use super::*;
        use serde::{Deserialize, Serialize};

        #[derive(Serialize, Deserialize, Debug, PartialEq)]
        struct CompressibleTestAction {
            data: Vec<u8>,
        }

        impl CompressibleAction for CompressibleTestAction {}

        #[test]
        fn test_compress_decompress() {
            let action = CompressibleTestAction {
                data: vec![1, 2, 3, 4, 5],
            };

            let compressed = action.compress().unwrap();
            let decompressed = CompressibleTestAction::decompress(&compressed).unwrap();

            assert_eq!(action.data, decompressed.data);
        }

        #[test]
        fn test_compress_large_data() {
            let action = CompressibleTestAction {
                data: vec![0; 10_000],
            };

            let compressed = action.compress().unwrap();

            // Compressed size should be much smaller
            assert!(compressed.len() < action.data.len());

            let decompressed = CompressibleTestAction::decompress(&compressed).unwrap();
            assert_eq!(action.data, decompressed.data);
        }

        #[test]
        fn test_decompress_invalid_data() {
            let invalid_data = vec![1, 2, 3, 4, 5];
            let result = CompressibleTestAction::decompress(&invalid_data);
            assert!(result.is_err());
        }
    }
}
