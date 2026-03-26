//! K_OS Universal Undo/Redo System
//!
//! Memory-aware undo/redo management with:
//! - Action execution, undo, and redo
//! - Memory-aware history management with automatic trimming
//! - Action merging for continuous operations (e.g., brush strokes)
//! - Compression support for large state changes
//! - Thread-safe design with Arc/Mutex support
//! - Generic over application state type
//!
//! # Example
//!
//! ```no_run
//! use k_os_undo::{UndoManager, UndoManagerConfig, UndoableAction};
//! use std::any::Any;
//!
//! // Define your application state
//! struct AppState {
//!     value: i32,
//! }
//!
//! // Define an undoable action
//! struct IncrementAction {
//!     amount: i32,
//! }
//!
//! impl UndoableAction<AppState> for IncrementAction {
//!     fn execute(&mut self, state: &mut AppState) -> k_os_undo::Result<()> {
//!         state.value += self.amount;
//!         Ok(())
//!     }
//!
//!     fn undo(&mut self, state: &mut AppState) -> k_os_undo::Result<()> {
//!         state.value -= self.amount;
//!         Ok(())
//!     }
//!
//!     fn memory_size(&self) -> usize {
//!         std::mem::size_of::<Self>()
//!     }
//!
//!     fn as_any(&self) -> &dyn Any {
//!         self
//!     }
//! }
//!
//! // Use the undo manager
//! let mut state = AppState { value: 0 };
//! let mut manager = UndoManager::new(UndoManagerConfig::default());
//!
//! // Execute an action
//! let action = Box::new(IncrementAction { amount: 5 });
//! manager.execute(action, &mut state).unwrap();
//! assert_eq!(state.value, 5);
//!
//! // Undo
//! manager.undo(&mut state).unwrap();
//! assert_eq!(state.value, 0);
//!
//! // Redo
//! manager.redo(&mut state).unwrap();
//! assert_eq!(state.value, 5);
//! ```
//!
//! # Action Merging
//!
//! Actions can be merged to reduce memory usage for continuous operations:
//!
//! ```no_run
//! use k_os_undo::{UndoableAction, Result};
//! use std::any::Any;
//!
//! struct BrushStrokeAction {
//!     points: Vec<(f32, f32)>,
//! }
//!
//! impl UndoableAction<AppState> for BrushStrokeAction {
//!     fn execute(&mut self, state: &mut AppState) -> Result<()> {
//!         // Apply brush stroke
//!         Ok(())
//!     }
//!
//!     fn undo(&mut self, state: &mut AppState) -> Result<()> {
//!         // Undo brush stroke
//!         Ok(())
//!     }
//!
//!     fn memory_size(&self) -> usize {
//!         std::mem::size_of::<Self>() + self.points.len() * std::mem::size_of::<(f32, f32)>()
//!     }
//!
//!     fn can_merge(&self, other: &dyn Any) -> bool {
//!         // Can merge with other brush strokes
//!         other.downcast_ref::<BrushStrokeAction>().is_some()
//!     }
//!
//!     fn merge(&mut self, other: &dyn UndoableAction<AppState>) -> Result<()> {
//!         if let Some(other) = other.as_any().downcast_ref::<BrushStrokeAction>() {
//!             self.points.extend(&other.points);
//!             Ok(())
//!         } else {
//!             Err(k_os_undo::UndoError::Other("Cannot merge".to_string()))
//!         }
//!     }
//!
//!     fn as_any(&self) -> &dyn Any {
//!         self
//!     }
//! }
//!
//! # struct AppState;
//! ```
//!
//! # Compression
//!
//! Large actions can implement `CompressibleAction` for automatic compression:
//!
//! ```no_run
//! use k_os_undo::{UndoableAction, CompressibleAction};
//! use serde::{Serialize, Deserialize};
//!
//! #[derive(Serialize, Deserialize)]
//! struct LargeStateAction {
//!     data: Vec<u8>,
//! }
//!
//! impl CompressibleAction for LargeStateAction {}
//!
//! // Compression/decompression is automatic
//! let action = LargeStateAction { data: vec![0; 1_000_000] };
//! let compressed = action.compress().unwrap();
//! let decompressed = LargeStateAction::decompress(&compressed).unwrap();
//! ```

pub mod action;
pub mod error;
pub mod manager;

pub use action::{CompressibleAction, UndoableAction};
pub use error::{Result, UndoError};
pub use manager::{SharedUndoManager, UndoManager, UndoManagerConfig};

#[cfg(test)]
mod tests {
    use super::*;
    use std::any::Any;

    #[derive(Debug)]
    struct TestState {
        value: i32,
    }

    struct TestAction {
        amount: i32,
    }

    impl UndoableAction<TestState> for TestAction {
        fn execute(&mut self, state: &mut TestState) -> Result<()> {
            state.value += self.amount;
            Ok(())
        }

        fn undo(&mut self, state: &mut TestState) -> Result<()> {
            state.value -= self.amount;
            Ok(())
        }

        fn memory_size(&self) -> usize {
            std::mem::size_of::<Self>()
        }

        fn as_any(&self) -> &dyn Any {
            self
        }
    }

    #[test]
    fn test_basic_workflow() {
        let mut state = TestState { value: 0 };
        let mut manager = UndoManager::new(UndoManagerConfig::default());

        // Execute
        manager
            .execute(Box::new(TestAction { amount: 10 }), &mut state)
            .unwrap();
        assert_eq!(state.value, 10);

        // Undo
        manager.undo(&mut state).unwrap();
        assert_eq!(state.value, 0);

        // Redo
        manager.redo(&mut state).unwrap();
        assert_eq!(state.value, 10);
    }

    #[test]
    fn test_memory_tracking() {
        let mut state = TestState { value: 0 };
        let mut manager = UndoManager::new(UndoManagerConfig::default());

        assert_eq!(manager.current_memory_bytes(), 0);

        manager
            .execute(Box::new(TestAction { amount: 5 }), &mut state)
            .unwrap();

        assert!(manager.current_memory_bytes() > 0);
        assert!(manager.memory_usage_percent() > 0.0);
    }
}
