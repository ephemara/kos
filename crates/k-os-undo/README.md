# k-os-undo

Universal undo/redo system for K_OS DCC Suite with memory-aware history management, action merging, and compression support.

## Features

- **Memory-Aware History**: Automatically trims old actions when memory limit is exceeded
- **Action Merging**: Merge continuous operations (e.g., brush strokes) to reduce memory usage
- **Compression Support**: Optional compression for large state changes
- **Thread-Safe**: Use `SharedUndoManager` for multi-threaded scenarios
- **Generic Design**: Works with any application state type
- **Type-Safe**: Full Rust type safety with trait-based design

## Usage

### Basic Example

```rust
use k_os_undo::{UndoManager, UndoManagerConfig, UndoableAction};
use std::any::Any;

// Define your application state
struct AppState {
    value: i32,
}

// Define an undoable action
struct IncrementAction {
    amount: i32,
}

impl UndoableAction<AppState> for IncrementAction {
    fn execute(&mut self, state: &mut AppState) -> k_os_undo::Result<()> {
        state.value += self.amount;
        Ok(())
    }

    fn undo(&mut self, state: &mut AppState) -> k_os_undo::Result<()> {
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

// Use the undo manager
let mut state = AppState { value: 0 };
let mut manager = UndoManager::new(UndoManagerConfig::default());

// Execute an action
manager.execute(Box::new(IncrementAction { amount: 5 }), &mut state)?;
assert_eq!(state.value, 5);

// Undo
manager.undo(&mut state)?;
assert_eq!(state.value, 0);

// Redo
manager.redo(&mut state)?;
assert_eq!(state.value, 5);
```

### Action Merging

Actions can be merged to reduce memory usage for continuous operations:

```rust
impl UndoableAction<AppState> for BrushStrokeAction {
    fn can_merge(&self, other: &dyn Any) -> bool {
        other.downcast_ref::<BrushStrokeAction>().is_some()
    }

    fn merge(&mut self, other: Box<dyn UndoableAction<AppState>>) -> Result<()> {
        if let Ok(other) = other.downcast::<BrushStrokeAction>() {
            self.points.extend(other.points);
            Ok(())
        } else {
            Err(UndoError::Other("Cannot merge".to_string()))
        }
    }
}
```

### Compression

Large actions can implement `CompressibleAction` for automatic compression:

```rust
use k_os_undo::CompressibleAction;
use serde::{Serialize, Deserialize};

#[derive(Serialize, Deserialize)]
struct LargeStateAction {
    data: Vec<u8>,
}

impl CompressibleAction for LargeStateAction {}

// Compression/decompression is automatic
let action = LargeStateAction { data: vec![0; 1_000_000] };
let compressed = action.compress()?;
let decompressed = LargeStateAction::decompress(&compressed)?;
```

### Configuration

```rust
let config = UndoManagerConfig {
    max_memory_bytes: 500 * 1024 * 1024, // 500MB
    enable_merging: true,
    enable_compression: true,
    compression_threshold: 1024 * 1024, // 1MB
};

let manager = UndoManager::new(config);
```

### Thread-Safe Usage

```rust
use k_os_undo::SharedUndoManager;
use std::sync::Arc;
use parking_lot::Mutex;

let manager: SharedUndoManager<AppState> = Arc::new(Mutex::new(
    UndoManager::new(UndoManagerConfig::default())
));

// Use from multiple threads
let manager_clone = manager.clone();
std::thread::spawn(move || {
    let mut manager = manager_clone.lock();
    // Use manager...
});
```

## Architecture

### UndoableAction Trait

All actions must implement the `UndoableAction` trait:

```rust
pub trait UndoableAction<State>: Send + Sync {
    fn execute(&mut self, state: &mut State) -> Result<()>;
    fn undo(&mut self, state: &mut State) -> Result<()>;
    fn redo(&mut self, state: &mut State) -> Result<()>;
    fn memory_size(&self) -> usize;
    fn can_merge(&self, other: &dyn Any) -> bool;
    fn merge(&mut self, other: Box<dyn UndoableAction<State>>) -> Result<()>;
    fn description(&self) -> String;
    fn as_any(&self) -> &dyn Any;
}
```

### Memory Management

The undo manager tracks memory usage and automatically trims old actions when the limit is exceeded:

1. Each action reports its memory size via `memory_size()`
2. Total memory is tracked as actions are added/removed
3. When limit is exceeded, oldest actions are removed from the undo stack
4. Memory usage can be queried via `current_memory_bytes()` and `memory_usage_percent()`

### Action Merging

When enabled, consecutive actions that can be merged are combined:

1. New action is executed
2. Manager checks if it can merge with the last action via `can_merge()`
3. If yes, `merge()` is called to combine them
4. Memory tracking is updated accordingly

This is useful for continuous operations like:
- Brush strokes in painting
- Continuous value changes in sliders
- Text input character by character

## Performance

- **Memory Overhead**: Minimal - only stores action data and small metadata
- **Execution Speed**: O(1) for execute/undo/redo operations
- **Memory Trimming**: O(n) where n is number of actions to remove (rare)
- **Action Merging**: O(1) when merging is possible

## Requirements

This crate satisfies the following K_OS requirements:

- **Requirement 2.1**: Execute actions and add to undo stack, clear redo stack
- **Requirement 2.2**: Undo restores previous state
- **Requirement 2.3**: Redo restores next state
- **Requirement 2.4**: Remove oldest actions when memory limit exceeded
- **Requirement 2.5**: Merge consecutive actions when possible
- **Requirement 2.6**: Maintain memory usage invariant
- **Requirement 2.7**: Undo/redo round-trip returns to exact same state

## License

Part of the K_OS DCC Suite project.
