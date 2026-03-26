//! Integration tests for k-os-undo

use k_os_undo::{Result, UndoError, UndoManager, UndoManagerConfig, UndoableAction};
use std::any::Any;

// Test state representing a simple document
#[derive(Debug, Clone, PartialEq)]
struct Document {
    text: String,
    cursor: usize,
}

impl Document {
    fn new() -> Self {
        Self {
            text: String::new(),
            cursor: 0,
        }
    }
}

// Insert text action
struct InsertTextAction {
    position: usize,
    text: String,
}

impl UndoableAction<Document> for InsertTextAction {
    fn execute(&mut self, state: &mut Document) -> Result<()> {
        state.text.insert_str(self.position, &self.text);
        state.cursor = self.position + self.text.len();
        Ok(())
    }

    fn undo(&mut self, state: &mut Document) -> Result<()> {
        let end = self.position + self.text.len();
        state.text.drain(self.position..end);
        state.cursor = self.position;
        Ok(())
    }

    fn memory_size(&self) -> usize {
        std::mem::size_of::<Self>() + self.text.capacity()
    }

    fn description(&self) -> String {
        format!("Insert '{}' at {}", self.text, self.position)
    }

    fn can_merge(&self, other: &dyn Any) -> bool {
        if let Some(other) = other.downcast_ref::<InsertTextAction>() {
            // Can merge if inserting at consecutive positions
            other.position == self.position + self.text.len()
        } else {
            false
        }
    }

    fn merge(&mut self, other: &dyn UndoableAction<Document>) -> Result<()> {
        if let Some(other_action) = other.as_any().downcast_ref::<InsertTextAction>() {
            self.text.push_str(&other_action.text);
            Ok(())
        } else {
            Err(UndoError::Other("Cannot merge".to_string()))
        }
    }

    fn as_any(&self) -> &dyn Any {
        self
    }
}

// Delete text action
struct DeleteTextAction {
    position: usize,
    deleted_text: String,
}

impl UndoableAction<Document> for DeleteTextAction {
    fn execute(&mut self, state: &mut Document) -> Result<()> {
        if self.position < state.text.len() {
            self.deleted_text = state.text.chars().nth(self.position).unwrap().to_string();
            state.text.remove(self.position);
            state.cursor = self.position;
        }
        Ok(())
    }

    fn undo(&mut self, state: &mut Document) -> Result<()> {
        state.text.insert_str(self.position, &self.deleted_text);
        state.cursor = self.position + self.deleted_text.len();
        Ok(())
    }

    fn memory_size(&self) -> usize {
        std::mem::size_of::<Self>() + self.deleted_text.capacity()
    }

    fn description(&self) -> String {
        format!("Delete at {}", self.position)
    }

    fn as_any(&self) -> &dyn Any {
        self
    }
}

#[test]
fn test_document_editing_workflow() {
    let mut doc = Document::new();
    let config = UndoManagerConfig {
        enable_merging: false, // Disable merging for this test
        ..Default::default()
    };
    let mut manager = UndoManager::new(config);

    // Type "Hello"
    manager
        .execute(
            Box::new(InsertTextAction {
                position: 0,
                text: "Hello".to_string(),
            }),
            &mut doc,
        )
        .unwrap();
    assert_eq!(doc.text, "Hello");

    // Type " World"
    manager
        .execute(
            Box::new(InsertTextAction {
                position: 5,
                text: " World".to_string(),
            }),
            &mut doc,
        )
        .unwrap();
    assert_eq!(doc.text, "Hello World");

    // Undo last insert
    manager.undo(&mut doc).unwrap();
    assert_eq!(doc.text, "Hello");

    // Undo first insert
    manager.undo(&mut doc).unwrap();
    assert_eq!(doc.text, "");

    // Redo both
    manager.redo(&mut doc).unwrap();
    assert_eq!(doc.text, "Hello");
    manager.redo(&mut doc).unwrap();
    assert_eq!(doc.text, "Hello World");
}

#[test]
fn test_action_merging() {
    let mut doc = Document::new();
    let config = UndoManagerConfig {
        enable_merging: true,
        ..Default::default()
    };
    let mut manager = UndoManager::new(config);

    // Type "H", "e", "l", "l", "o" - should merge into one action
    for (i, ch) in "Hello".chars().enumerate() {
        manager
            .execute(
                Box::new(InsertTextAction {
                    position: i,
                    text: ch.to_string(),
                }),
                &mut doc,
            )
            .unwrap();
    }

    assert_eq!(doc.text, "Hello");
    // Should have merged into 1 action
    assert_eq!(manager.undo_count(), 1);

    // Undo should remove all text
    manager.undo(&mut doc).unwrap();
    assert_eq!(doc.text, "");

    // Redo should restore all text
    manager.redo(&mut doc).unwrap();
    assert_eq!(doc.text, "Hello");
}

#[test]
fn test_delete_and_undo() {
    let mut doc = Document::new();
    let mut manager = UndoManager::new(UndoManagerConfig::default());

    // Insert text
    manager
        .execute(
            Box::new(InsertTextAction {
                position: 0,
                text: "Hello".to_string(),
            }),
            &mut doc,
        )
        .unwrap();

    // Delete first character
    manager
        .execute(
            Box::new(DeleteTextAction {
                position: 0,
                deleted_text: String::new(),
            }),
            &mut doc,
        )
        .unwrap();
    assert_eq!(doc.text, "ello");

    // Undo delete
    manager.undo(&mut doc).unwrap();
    assert_eq!(doc.text, "Hello");

    // Undo insert
    manager.undo(&mut doc).unwrap();
    assert_eq!(doc.text, "");
}

#[test]
fn test_memory_limit_enforcement() {
    let mut doc = Document::new();
    let config = UndoManagerConfig {
        max_memory_bytes: 200, // Very small limit
        enable_merging: false,
        ..Default::default()
    };
    let mut manager = UndoManager::new(config);

    // Execute many actions to exceed memory limit
    for i in 0..50 {
        manager
            .execute(
                Box::new(InsertTextAction {
                    position: doc.text.len(),
                    text: format!("{}", i),
                }),
                &mut doc,
            )
            .unwrap();
    }

    // Should have trimmed old actions
    assert!(manager.undo_count() < 50);
    assert!(manager.current_memory_bytes() <= 200);
}

#[test]
fn test_redo_cleared_on_new_action() {
    let mut doc = Document::new();
    let config = UndoManagerConfig {
        enable_merging: false, // Disable merging for this test
        ..Default::default()
    };
    let mut manager = UndoManager::new(config);

    // Execute two actions
    manager
        .execute(
            Box::new(InsertTextAction {
                position: 0,
                text: "Hello".to_string(),
            }),
            &mut doc,
        )
        .unwrap();
    manager
        .execute(
            Box::new(InsertTextAction {
                position: 5,
                text: " World".to_string(),
            }),
            &mut doc,
        )
        .unwrap();

    // Undo one
    manager.undo(&mut doc).unwrap();
    assert_eq!(manager.redo_count(), 1);

    // Execute new action - should clear redo stack
    manager
        .execute(
            Box::new(InsertTextAction {
                position: 5,
                text: "!".to_string(),
            }),
            &mut doc,
        )
        .unwrap();
    assert_eq!(manager.redo_count(), 0);
    assert_eq!(doc.text, "Hello!");
}

#[test]
fn test_nothing_to_undo_error() {
    let mut doc = Document::new();
    let mut manager = UndoManager::new(UndoManagerConfig::default());

    let result = manager.undo(&mut doc);
    assert!(matches!(result, Err(UndoError::NothingToUndo)));
}

#[test]
fn test_nothing_to_redo_error() {
    let mut doc = Document::new();
    let mut manager = UndoManager::new(UndoManagerConfig::default());

    let result = manager.redo(&mut doc);
    assert!(matches!(result, Err(UndoError::NothingToRedo)));
}

#[test]
fn test_clear_history() {
    let mut doc = Document::new();
    let mut manager = UndoManager::new(UndoManagerConfig::default());

    // Execute actions
    manager
        .execute(
            Box::new(InsertTextAction {
                position: 0,
                text: "Hello".to_string(),
            }),
            &mut doc,
        )
        .unwrap();
    manager.undo(&mut doc).unwrap();

    assert!(manager.can_redo());
    assert_eq!(manager.undo_count(), 0);
    assert_eq!(manager.redo_count(), 1);

    // Clear
    manager.clear();
    assert!(!manager.can_undo());
    assert!(!manager.can_redo());
    assert_eq!(manager.current_memory_bytes(), 0);
}

#[test]
fn test_action_descriptions() {
    let mut doc = Document::new();
    let mut manager = UndoManager::new(UndoManagerConfig::default());

    manager
        .execute(
            Box::new(InsertTextAction {
                position: 0,
                text: "Hello".to_string(),
            }),
            &mut doc,
        )
        .unwrap();

    let desc = manager.next_undo_description();
    assert!(desc.is_some());
    let desc_str = desc.unwrap();
    assert!(desc_str.contains("Insert"));
    assert!(desc_str.contains("Hello"));
}

#[test]
fn test_memory_usage_tracking() {
    let mut doc = Document::new();
    let mut manager = UndoManager::new(UndoManagerConfig::default());

    assert_eq!(manager.current_memory_bytes(), 0);
    assert_eq!(manager.memory_usage_percent(), 0.0);

    manager
        .execute(
            Box::new(InsertTextAction {
                position: 0,
                text: "Hello".to_string(),
            }),
            &mut doc,
        )
        .unwrap();

    assert!(manager.current_memory_bytes() > 0);
    assert!(manager.memory_usage_percent() > 0.0);
    assert!(manager.memory_usage_percent() < 1.0);
}

#[test]
fn test_complex_editing_sequence() {
    let mut doc = Document::new();
    let config = UndoManagerConfig {
        enable_merging: false, // Disable merging for this test
        ..Default::default()
    };
    let mut manager = UndoManager::new(config);

    // Build "Hello World!" through multiple operations
    manager
        .execute(
            Box::new(InsertTextAction {
                position: 0,
                text: "Hello".to_string(),
            }),
            &mut doc,
        )
        .unwrap();
    manager
        .execute(
            Box::new(InsertTextAction {
                position: 5,
                text: " ".to_string(),
            }),
            &mut doc,
        )
        .unwrap();
    manager
        .execute(
            Box::new(InsertTextAction {
                position: 6,
                text: "World".to_string(),
            }),
            &mut doc,
        )
        .unwrap();
    manager
        .execute(
            Box::new(InsertTextAction {
                position: 11,
                text: "!".to_string(),
            }),
            &mut doc,
        )
        .unwrap();

    assert_eq!(doc.text, "Hello World!");
    assert_eq!(manager.undo_count(), 4);

    // Undo all
    for _ in 0..4 {
        manager.undo(&mut doc).unwrap();
    }
    assert_eq!(doc.text, "");

    // Redo all
    for _ in 0..4 {
        manager.redo(&mut doc).unwrap();
    }
    assert_eq!(doc.text, "Hello World!");
}
