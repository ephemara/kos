use serde::{Deserialize, Serialize};
use std::collections::VecDeque;
use std::sync::atomic::{AtomicU64, Ordering};

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct ZenTransactionId(u64);

impl ZenTransactionId {
    pub fn new(raw: u64) -> Self {
        Self(raw)
    }

    pub fn raw(self) -> u64 {
        self.0
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum ZenCommandSource {
    HostAction(String),
    KainModule(String),
    ViewportHotkey(String),
    Editor(String),
    Runtime(String),
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum ZenPlayMode {
    Edit,
    Simulate,
    Play,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub enum ZenCommand {
    ShellReload,
    SceneSpawnWorkspaceBox,
    SceneSelectRelative { step: isize },
    SceneClearSelection,
    SceneRenameSelection { name: String },
    SceneSetSelectedTranslation { translation: [f32; 3] },
    SceneSetSelectedScale { scale: [f32; 3] },
    CameraFocusSelection,
    CameraFrameScene,
    RuntimeSetPlayMode { mode: ZenPlayMode },
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct ZenCommandEnvelope {
    pub transaction_id: ZenTransactionId,
    pub source: ZenCommandSource,
    pub command: ZenCommand,
}

impl ZenCommandEnvelope {
    pub fn new(
        transaction_id: ZenTransactionId,
        source: ZenCommandSource,
        command: ZenCommand,
    ) -> Self {
        Self {
            transaction_id,
            source,
            command,
        }
    }
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub enum ZenEvent {
    SceneChanged {
        transaction_id: ZenTransactionId,
        reason: String,
    },
    SelectionChanged {
        transaction_id: ZenTransactionId,
        selected_handle: Option<u64>,
    },
    ShellReloadRequested {
        transaction_id: ZenTransactionId,
    },
    CameraFocusRequested {
        transaction_id: ZenTransactionId,
    },
    CameraFrameRequested {
        transaction_id: ZenTransactionId,
    },
    PlayModeChanged {
        transaction_id: ZenTransactionId,
        mode: ZenPlayMode,
    },
}

#[derive(Debug, Default)]
pub struct ZenCommandBus {
    next_transaction: AtomicU64,
    queue: VecDeque<ZenCommandEnvelope>,
}

impl ZenCommandBus {
    pub fn enqueue(&mut self, source: ZenCommandSource, command: ZenCommand) -> ZenTransactionId {
        let transaction_id =
            ZenTransactionId::new(self.next_transaction.fetch_add(1, Ordering::Relaxed) + 1);
        self.queue
            .push_back(ZenCommandEnvelope::new(transaction_id, source, command));
        transaction_id
    }

    pub fn pop_front(&mut self) -> Option<ZenCommandEnvelope> {
        self.queue.pop_front()
    }

    pub fn is_empty(&self) -> bool {
        self.queue.is_empty()
    }
}

pub fn command_label(command: &ZenCommand) -> &'static str {
    match command {
        ZenCommand::ShellReload => "reload shell",
        ZenCommand::SceneSpawnWorkspaceBox => "spawn workspace box",
        ZenCommand::SceneSelectRelative { step } if *step >= 0 => "select next object",
        ZenCommand::SceneSelectRelative { .. } => "select previous object",
        ZenCommand::SceneClearSelection => "clear selection",
        ZenCommand::SceneRenameSelection { .. } => "rename selection",
        ZenCommand::SceneSetSelectedTranslation { .. } => "translate selection",
        ZenCommand::SceneSetSelectedScale { .. } => "scale selection",
        ZenCommand::CameraFocusSelection => "focus selection",
        ZenCommand::CameraFrameScene => "frame scene",
        ZenCommand::RuntimeSetPlayMode {
            mode: ZenPlayMode::Edit,
        } => "switch to edit mode",
        ZenCommand::RuntimeSetPlayMode {
            mode: ZenPlayMode::Simulate,
        } => "switch to simulate mode",
        ZenCommand::RuntimeSetPlayMode {
            mode: ZenPlayMode::Play,
        } => "switch to play mode",
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn command_bus_assigns_transaction_ids() {
        let mut bus = ZenCommandBus::default();
        let first = bus.enqueue(
            ZenCommandSource::HostAction("scene.spawn_box".to_string()),
            ZenCommand::SceneSpawnWorkspaceBox,
        );
        let second = bus.enqueue(
            ZenCommandSource::ViewportHotkey("KeyF".to_string()),
            ZenCommand::CameraFocusSelection,
        );
        assert_eq!(first.raw(), 1);
        assert_eq!(second.raw(), 2);
        assert!(!bus.is_empty());
        assert!(matches!(
            bus.pop_front().map(|item| item.command),
            Some(ZenCommand::SceneSpawnWorkspaceBox)
        ));
    }
}
