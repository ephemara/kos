use zen_core::{
    command_label, ZenCommand, ZenCommandEnvelope, ZenEvent, ZenPlayMode, ZenTransactionId,
};
use zen_scene::{SelectedObjectDetails, ZenScene};

#[derive(Debug)]
pub struct ZenRuntimeSession {
    play_mode: ZenPlayMode,
    command_history: Vec<ZenCommandEnvelope>,
    recent_events: Vec<ZenEvent>,
}

#[derive(Debug, Default)]
pub struct ZenDispatchResult {
    pub scene_dirty: bool,
    pub events: Vec<ZenEvent>,
}

impl ZenRuntimeSession {
    pub fn new() -> Self {
        Self {
            play_mode: ZenPlayMode::Edit,
            command_history: Vec::new(),
            recent_events: Vec::new(),
        }
    }

    pub fn play_mode(&self) -> ZenPlayMode {
        self.play_mode
    }

    pub fn command_history(&self) -> &[ZenCommandEnvelope] {
        &self.command_history
    }

    pub fn recent_events(&self) -> &[ZenEvent] {
        &self.recent_events
    }

    pub fn dispatch(
        &mut self,
        scene: &mut ZenScene,
        envelope: ZenCommandEnvelope,
    ) -> Result<ZenDispatchResult, String> {
        let transaction_id = envelope.transaction_id;
        let mut result = ZenDispatchResult::default();
        match &envelope.command {
            ZenCommand::ShellReload => {
                push_event(
                    &mut result,
                    ZenEvent::ShellReloadRequested { transaction_id },
                );
            }
            ZenCommand::FabricRunIntent { intent_id } => {
                push_event(
                    &mut result,
                    ZenEvent::FabricIntentRequested {
                        transaction_id,
                        intent_id: intent_id.clone(),
                    },
                );
            }
            ZenCommand::SceneSpawnWorkspaceBox => {
                if scene.spawn_workspace_box() {
                    mark_scene_changed(
                        &mut result,
                        transaction_id,
                        "spawned workspace box",
                        scene.selected_details().as_ref(),
                    );
                }
            }
            ZenCommand::SceneSelectRelative { step } => {
                if scene.select_next(*step) {
                    mark_scene_changed(
                        &mut result,
                        transaction_id,
                        command_label(&envelope.command),
                        scene.selected_details().as_ref(),
                    );
                }
            }
            ZenCommand::SceneClearSelection => {
                if scene.clear_selection() {
                    mark_scene_changed(&mut result, transaction_id, "cleared selection", None);
                }
            }
            ZenCommand::SceneRenameSelection { name } => {
                if scene.rename_selected(name.clone())? {
                    mark_scene_changed(
                        &mut result,
                        transaction_id,
                        "renamed selection",
                        scene.selected_details().as_ref(),
                    );
                }
            }
            ZenCommand::SceneSetSelectedTranslation { translation } => {
                if scene.set_selected_translation(*translation)? {
                    mark_scene_changed(
                        &mut result,
                        transaction_id,
                        "translated selection",
                        scene.selected_details().as_ref(),
                    );
                }
            }
            ZenCommand::SceneSetSelectedScale { scale } => {
                if scene.set_selected_scale(*scale)? {
                    mark_scene_changed(
                        &mut result,
                        transaction_id,
                        "scaled selection",
                        scene.selected_details().as_ref(),
                    );
                }
            }
            ZenCommand::CameraFocusSelection => {
                push_event(
                    &mut result,
                    ZenEvent::CameraFocusRequested { transaction_id },
                );
            }
            ZenCommand::CameraFrameScene => {
                push_event(
                    &mut result,
                    ZenEvent::CameraFrameRequested { transaction_id },
                );
            }
            ZenCommand::RuntimeSetPlayMode { mode } => {
                if self.play_mode != *mode {
                    self.play_mode = *mode;
                    push_event(
                        &mut result,
                        ZenEvent::PlayModeChanged {
                            transaction_id,
                            mode: *mode,
                        },
                    );
                }
            }
        }

        self.command_history.push(envelope);
        self.recent_events = result.events.clone();
        Ok(result)
    }
}

impl Default for ZenRuntimeSession {
    fn default() -> Self {
        Self::new()
    }
}

fn push_event(result: &mut ZenDispatchResult, event: ZenEvent) {
    result.events.push(event);
}

fn mark_scene_changed(
    result: &mut ZenDispatchResult,
    transaction_id: ZenTransactionId,
    reason: &str,
    selected: Option<&SelectedObjectDetails>,
) {
    result.scene_dirty = true;
    result.events.push(ZenEvent::SceneChanged {
        transaction_id,
        reason: reason.to_string(),
    });
    result.events.push(ZenEvent::SelectionChanged {
        transaction_id,
        selected_handle: selected.map(|details| details.summary.handle.raw()),
    });
}

#[cfg(test)]
mod tests {
    use super::*;
    use zen_core::{ZenCommandSource, ZenTransactionId};

    #[test]
    fn runtime_session_updates_play_mode() {
        let mut runtime = ZenRuntimeSession::new();
        let mut scene = ZenScene::new_default();
        let result = runtime
            .dispatch(
                &mut scene,
                ZenCommandEnvelope::new(
                    ZenTransactionId::new(7),
                    ZenCommandSource::Runtime("test".to_string()),
                    ZenCommand::RuntimeSetPlayMode {
                        mode: ZenPlayMode::Play,
                    },
                ),
            )
            .expect("runtime command should dispatch");
        assert_eq!(runtime.play_mode(), ZenPlayMode::Play);
        assert!(matches!(
            result.events.first(),
            Some(ZenEvent::PlayModeChanged {
                mode: ZenPlayMode::Play,
                ..
            })
        ));
    }
}
