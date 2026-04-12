use serde::Deserialize;
use std::collections::{BTreeMap, HashMap, HashSet};
use std::fs;
use std::path::PathBuf;
use winit::event::MouseButton;
use winit::keyboard::KeyCode;

const DEFAULT_INPUT_BINDINGS: &str = include_str!("../resources/input_bindings.toml");

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum Action {
    MoveForward,
    MoveBackward,
    MoveLeft,
    MoveRight,
    MoveUp,
    MoveDown,
    Boost,
    LookModifier,
    FocusSelection,
    FrameScene,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum InputTrigger {
    Key(KeyCode),
    Mouse(MouseButton),
}

#[derive(Debug, Clone, Copy)]
pub struct CameraBindings {
    pub move_speed: f32,
    pub boost_multiplier: f32,
    pub look_sensitivity: f32,
}

#[derive(Debug, Clone)]
pub struct InputBindings {
    pub camera: CameraBindings,
    pub actions: HashMap<Action, Vec<InputTrigger>>,
}

#[derive(Debug, Default)]
pub struct InputState {
    pressed_keys: HashSet<KeyCode>,
    pressed_mouse: HashSet<MouseButton>,
}

impl InputState {
    pub fn set_key(&mut self, code: KeyCode, pressed: bool) {
        if pressed {
            self.pressed_keys.insert(code);
        } else {
            self.pressed_keys.remove(&code);
        }
    }

    pub fn set_mouse(&mut self, button: MouseButton, pressed: bool) {
        if pressed {
            self.pressed_mouse.insert(button);
        } else {
            self.pressed_mouse.remove(&button);
        }
    }

    pub fn clear(&mut self) {
        self.pressed_keys.clear();
        self.pressed_mouse.clear();
    }

    pub fn is_action_active(&self, bindings: &InputBindings, action: Action) -> bool {
        bindings
            .actions
            .get(&action)
            .into_iter()
            .flatten()
            .any(|trigger| match trigger {
                InputTrigger::Key(code) => self.pressed_keys.contains(code),
                InputTrigger::Mouse(button) => self.pressed_mouse.contains(button),
            })
    }
}

impl InputBindings {
    pub fn load() -> Result<Self, String> {
        let source = load_input_manifest_source()?;
        parse_bindings(&source)
    }

    pub fn trigger_matches_action(&self, action: Action, trigger: InputTrigger) -> bool {
        self.actions
            .get(&action)
            .map(|triggers| triggers.contains(&trigger))
            .unwrap_or(false)
    }
}

#[derive(Debug, Deserialize)]
struct InputBindingsFile {
    camera: CameraBindingsFile,
    actions: BTreeMap<String, ActionBindingFile>,
}

#[derive(Debug, Deserialize)]
struct CameraBindingsFile {
    move_speed: f32,
    boost_multiplier: f32,
    look_sensitivity: f32,
}

#[derive(Debug, Deserialize)]
struct ActionBindingFile {
    keys: Vec<String>,
}

fn load_input_manifest_source() -> Result<String, String> {
    if let Ok(explicit_path) = std::env::var("ZEN_INPUT_BINDINGS_PATH") {
        let path = PathBuf::from(explicit_path);
        return fs::read_to_string(&path).map_err(|err| {
            format!(
                "Failed to read ZEN_INPUT_BINDINGS_PATH '{}': {err}",
                path.display()
            )
        });
    }

    let mut candidates = Vec::new();
    if let Ok(current_exe) = std::env::current_exe() {
        if let Some(parent) = current_exe.parent() {
            candidates.push(parent.join("zen").join("input_bindings.toml"));
            candidates.push(parent.join("input_bindings.toml"));
        }
    }
    candidates.push(
        k_os_kain::workspace_root()
            .join("crates")
            .join("zen")
            .join("resources")
            .join("input_bindings.toml"),
    );

    for candidate in candidates {
        if candidate.exists() {
            return fs::read_to_string(&candidate)
                .map_err(|err| format!("Failed to read '{}': {err}", candidate.display()));
        }
    }

    Ok(DEFAULT_INPUT_BINDINGS.to_string())
}

fn parse_bindings(source: &str) -> Result<InputBindings, String> {
    let parsed: InputBindingsFile = toml::from_str(source)
        .map_err(|err| format!("Failed to parse Zen input bindings manifest: {err}"))?;

    let mut actions = HashMap::new();
    for (name, binding) in parsed.actions {
        let action = parse_action_name(&name)?;
        let triggers = binding
            .keys
            .iter()
            .map(|key| parse_trigger(key))
            .collect::<Result<Vec<_>, _>>()?;
        actions.insert(action, triggers);
    }

    Ok(InputBindings {
        camera: CameraBindings {
            move_speed: parsed.camera.move_speed.max(0.1),
            boost_multiplier: parsed.camera.boost_multiplier.max(1.0),
            look_sensitivity: parsed.camera.look_sensitivity.max(0.0001),
        },
        actions,
    })
}

fn parse_action_name(name: &str) -> Result<Action, String> {
    match name {
        "move_forward" => Ok(Action::MoveForward),
        "move_backward" => Ok(Action::MoveBackward),
        "move_left" => Ok(Action::MoveLeft),
        "move_right" => Ok(Action::MoveRight),
        "move_up" => Ok(Action::MoveUp),
        "move_down" => Ok(Action::MoveDown),
        "boost" => Ok(Action::Boost),
        "look_modifier" => Ok(Action::LookModifier),
        "focus_selection" => Ok(Action::FocusSelection),
        "frame_scene" => Ok(Action::FrameScene),
        other => Err(format!("Unsupported Zen input action '{other}'")),
    }
}

fn parse_trigger(value: &str) -> Result<InputTrigger, String> {
    Ok(match value {
        "MouseLeft" => InputTrigger::Mouse(MouseButton::Left),
        "MouseRight" => InputTrigger::Mouse(MouseButton::Right),
        "MouseMiddle" => InputTrigger::Mouse(MouseButton::Middle),
        "KeyW" => InputTrigger::Key(KeyCode::KeyW),
        "KeyA" => InputTrigger::Key(KeyCode::KeyA),
        "KeyS" => InputTrigger::Key(KeyCode::KeyS),
        "KeyD" => InputTrigger::Key(KeyCode::KeyD),
        "KeyQ" => InputTrigger::Key(KeyCode::KeyQ),
        "KeyE" => InputTrigger::Key(KeyCode::KeyE),
        "KeyF" => InputTrigger::Key(KeyCode::KeyF),
        "KeyH" => InputTrigger::Key(KeyCode::KeyH),
        "Space" => InputTrigger::Key(KeyCode::Space),
        "ShiftLeft" => InputTrigger::Key(KeyCode::ShiftLeft),
        "ShiftRight" => InputTrigger::Key(KeyCode::ShiftRight),
        "ControlLeft" => InputTrigger::Key(KeyCode::ControlLeft),
        "ControlRight" => InputTrigger::Key(KeyCode::ControlRight),
        "ArrowUp" => InputTrigger::Key(KeyCode::ArrowUp),
        "ArrowDown" => InputTrigger::Key(KeyCode::ArrowDown),
        "ArrowLeft" => InputTrigger::Key(KeyCode::ArrowLeft),
        "ArrowRight" => InputTrigger::Key(KeyCode::ArrowRight),
        other => return Err(format!("Unsupported Zen input trigger '{other}'")),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_default_manifest() {
        let bindings =
            parse_bindings(DEFAULT_INPUT_BINDINGS).expect("default bindings should parse");
        assert!(bindings.actions.contains_key(&Action::MoveForward));
        assert!(bindings.actions.contains_key(&Action::LookModifier));
        assert!(bindings.actions.contains_key(&Action::FocusSelection));
        assert!(bindings.camera.move_speed > 0.0);
    }
}
