use bevy_ecs::prelude::Resource;
use k_os_game_framework::{GameDataRegistryState, GamePipelineBootstrapState};
use std::collections::{BTreeMap, BTreeSet};

const DEFAULT_AI_REGISTRY_KIND: &str = "ai_agents";
const DEFAULT_TICK_TEMPLATE: &str = "{agent}:{phase}:tick-{tick}";
const DEFAULT_TICK_PHASES: [&str; 4] = ["sense", "plan", "act", "recover"];

#[derive(Debug, Clone, Default, PartialEq, Eq, Resource)]
pub struct GameAiRuntimeState {
    pub ready: bool,
    pub status: String,
    pub detail: String,
    pub registry_kind: String,
    pub registry_version: Option<String>,
    pub state_tree_ids: Vec<String>,
    pub blackboard_ids: Vec<String>,
    pub agent_ids: Vec<String>,
    pub state_tree_roots: BTreeMap<String, String>,
    pub blackboard_keys: BTreeMap<String, Vec<String>>,
    pub agent_state_trees: BTreeMap<String, String>,
    pub agent_blackboards: BTreeMap<String, String>,
    pub tick_phase_order: Vec<String>,
    pub default_blackboard_value_template: String,
    pub decision_overrides: BTreeMap<String, BTreeMap<String, String>>,
    pub issues: Vec<String>,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Resource)]
pub struct GameAiDecisionRuntimeState {
    pub ready: bool,
    pub status: String,
    pub detail: String,
    pub tick_index: u64,
    pub active_phase: String,
    pub agent_decisions: BTreeMap<String, String>,
    pub agent_active_nodes: BTreeMap<String, String>,
    pub blackboard_values: BTreeMap<String, BTreeMap<String, String>>,
    pub issues: Vec<String>,
}

pub fn derive_ai_runtime_state(
    bootstrap_state: Option<&GamePipelineBootstrapState>,
    registry_state: Option<&GameDataRegistryState>,
) -> GameAiRuntimeState {
    let mut state = GameAiRuntimeState {
        registry_kind: DEFAULT_AI_REGISTRY_KIND.to_string(),
        default_blackboard_value_template: DEFAULT_TICK_TEMPLATE.to_string(),
        tick_phase_order: default_tick_phases(),
        ..Default::default()
    };

    let Some(bootstrap_state) = bootstrap_state else {
        state.status = "pending".to_string();
        state.detail = "awaiting bootstrap state".to_string();
        return state;
    };

    if !bootstrap_state.enabled {
        state.status = "pending".to_string();
        state.detail = "pipeline disabled".to_string();
        return state;
    }

    let Some(registry_state) = registry_state else {
        state.status = "pending".to_string();
        state.detail = "awaiting registry cache".to_string();
        return state;
    };

    let Some(snapshot) = registry_state.loaded.get(DEFAULT_AI_REGISTRY_KIND) else {
        state.status = "degraded".to_string();
        state.detail = format!(
            "missing required '{}' registry in runtime cache",
            DEFAULT_AI_REGISTRY_KIND
        );
        state.issues = registry_state.errors.clone();
        state.issues.push(state.detail.clone());
        return state;
    };

    state.registry_version = Some(snapshot.version.clone());
    state.issues = registry_state.errors.clone();

    let document = match load_registry_document(&snapshot.asset_path) {
        Ok(document) => document,
        Err(error) => {
            state.status = "degraded".to_string();
            state.detail = "failed to parse ai registry".to_string();
            state.issues.push(error);
            return state;
        }
    };

    state.state_tree_roots = parse_state_trees(&document, &mut state.issues);
    state.blackboard_keys = parse_blackboards(&document, &mut state.issues);
    let agents = parse_agents(&document, &mut state.issues);

    for agent in &agents {
        if !state.state_tree_roots.contains_key(&agent.state_tree) {
            state.issues.push(format!(
                "agent '{}' references missing state_tree '{}'",
                agent.id, agent.state_tree
            ));
        }
        if !state.blackboard_keys.contains_key(&agent.blackboard) {
            state.issues.push(format!(
                "agent '{}' references missing blackboard '{}'",
                agent.id, agent.blackboard
            ));
        }
    }

    let tick_config = parse_runtime_tick_config(&document, &mut state.issues);
    state.tick_phase_order = tick_config.phase_order;
    state.default_blackboard_value_template = tick_config.default_blackboard_value_template;
    state.decision_overrides =
        parse_decision_overrides(&document, &state.tick_phase_order, &mut state.issues);

    state.state_tree_ids = state.state_tree_roots.keys().cloned().collect();
    state.blackboard_ids = state.blackboard_keys.keys().cloned().collect();
    state.agent_ids = agents.iter().map(|agent| agent.id.clone()).collect();
    state.agent_state_trees = agents
        .iter()
        .map(|agent| (agent.id.clone(), agent.state_tree.clone()))
        .collect();
    state.agent_blackboards = agents
        .iter()
        .map(|agent| (agent.id.clone(), agent.blackboard.clone()))
        .collect();

    state.ready = state.issues.is_empty();
    state.status = if state.ready {
        "ready".to_string()
    } else {
        "degraded".to_string()
    };
    state.detail = if state.ready {
        "ai agents projected from registry cache".to_string()
    } else {
        "ai registry invalid or incomplete".to_string()
    };
    state
}

pub fn derive_ai_decision_runtime_state(
    ai_state: &GameAiRuntimeState,
    previous: Option<&GameAiDecisionRuntimeState>,
) -> GameAiDecisionRuntimeState {
    let mut next = GameAiDecisionRuntimeState {
        issues: ai_state.issues.clone(),
        ..Default::default()
    };

    if ai_state.status == "pending" {
        next.status = "pending".to_string();
        next.detail = ai_state.detail.clone();
        return next;
    }

    if !ai_state.ready {
        next.status = "degraded".to_string();
        next.detail = "cannot tick ai decisions while ai runtime is degraded".to_string();
        return next;
    }

    let phases = if ai_state.tick_phase_order.is_empty() {
        default_tick_phases()
    } else {
        ai_state.tick_phase_order.clone()
    };
    let phase_count = phases.len();
    if phase_count == 0 {
        next.status = "degraded".to_string();
        next.detail = "no ai tick phases configured".to_string();
        next.issues.push("ai tick policy has no phases".to_string());
        return next;
    }

    next.tick_index = previous.map_or(1, |state| state.tick_index.saturating_add(1));
    let phase_index = ((next.tick_index - 1) as usize) % phase_count;
    next.active_phase = phases[phase_index].clone();

    for agent_id in &ai_state.agent_ids {
        let Some(state_tree_id) = ai_state.agent_state_trees.get(agent_id) else {
            next.issues
                .push(format!("agent '{}' missing state-tree binding", agent_id));
            continue;
        };
        let Some(blackboard_id) = ai_state.agent_blackboards.get(agent_id) else {
            next.issues
                .push(format!("agent '{}' missing blackboard binding", agent_id));
            continue;
        };
        let Some(root) = ai_state.state_tree_roots.get(state_tree_id) else {
            next.issues.push(format!(
                "agent '{}' state_tree '{}' missing root node",
                agent_id, state_tree_id
            ));
            continue;
        };
        let Some(keys) = ai_state.blackboard_keys.get(blackboard_id) else {
            next.issues.push(format!(
                "agent '{}' blackboard '{}' missing key contract",
                agent_id, blackboard_id
            ));
            continue;
        };

        let decision = ai_state
            .decision_overrides
            .get(agent_id)
            .and_then(|by_phase| by_phase.get(&next.active_phase))
            .cloned()
            .unwrap_or_else(|| format!("{}::{}", root, next.active_phase));
        let active_node = format!("{}::{}", root, next.active_phase);

        next.agent_decisions
            .insert(agent_id.clone(), decision.clone());
        next.agent_active_nodes
            .insert(agent_id.clone(), active_node.clone());

        let mut blackboard = BTreeMap::new();
        for key in keys {
            let value = format_blackboard_value(
                &ai_state.default_blackboard_value_template,
                agent_id,
                &next.active_phase,
                next.tick_index,
                &decision,
                key,
            );
            blackboard.insert(key.clone(), value);
        }
        next.blackboard_values
            .insert(blackboard_id.clone(), blackboard);
    }

    next.ready = next.issues.is_empty();
    next.status = if next.ready {
        "ready".to_string()
    } else {
        "degraded".to_string()
    };
    next.detail = if next.ready {
        format!(
            "ai decision tick {} computed for {} agents",
            next.tick_index,
            next.agent_decisions.len()
        )
    } else {
        "ai decision tick incomplete".to_string()
    };

    next
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct AiAgentSpec {
    id: String,
    state_tree: String,
    blackboard: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct RuntimeTickConfig {
    phase_order: Vec<String>,
    default_blackboard_value_template: String,
}

fn default_tick_phases() -> Vec<String> {
    DEFAULT_TICK_PHASES
        .iter()
        .map(|value| (*value).to_string())
        .collect()
}

fn load_registry_document(path: &str) -> Result<toml::value::Table, String> {
    let raw = std::fs::read_to_string(path)
        .map_err(|error| format!("failed to read registry '{}': {error}", path))?;
    let parsed = raw
        .parse::<toml::Value>()
        .map_err(|error| format!("failed to parse registry TOML '{}': {error}", path))?;
    parsed
        .as_table()
        .cloned()
        .ok_or_else(|| format!("registry '{}' did not parse as TOML table", path))
}

fn parse_state_trees(
    document: &toml::value::Table,
    issues: &mut Vec<String>,
) -> BTreeMap<String, String> {
    let mut roots_by_id = BTreeMap::new();
    let Some(entries) = document.get("state_trees").and_then(toml::Value::as_array) else {
        issues.push("missing required array 'state_trees'".to_string());
        return roots_by_id;
    };

    for (index, entry) in entries.iter().enumerate() {
        let Some(table) = entry.as_table() else {
            issues.push(format!("state_trees[{index}] is not a table"));
            continue;
        };
        let Some(id) = table.get("id").and_then(toml::Value::as_str) else {
            issues.push(format!("state_trees[{index}] missing 'id'"));
            continue;
        };
        let Some(root) = table.get("root").and_then(toml::Value::as_str) else {
            issues.push(format!("state_trees[{index}] missing 'root'"));
            continue;
        };
        if roots_by_id.contains_key(id) {
            issues.push(format!("duplicate state tree id '{}'", id));
            continue;
        }
        roots_by_id.insert(id.to_string(), root.to_string());
    }
    roots_by_id
}

fn parse_blackboards(
    document: &toml::value::Table,
    issues: &mut Vec<String>,
) -> BTreeMap<String, Vec<String>> {
    let mut keys_by_blackboard = BTreeMap::new();
    let Some(entries) = document.get("blackboards").and_then(toml::Value::as_table) else {
        issues.push("missing required table 'blackboards'".to_string());
        return keys_by_blackboard;
    };

    for (name, value) in entries {
        let id = format!("blackboards.{name}");
        let Some(table) = value.as_table() else {
            issues.push(format!("blackboards entry '{}' is not a table", name));
            continue;
        };
        let Some(keys) = table.get("keys").and_then(toml::Value::as_array) else {
            issues.push(format!("blackboards entry '{}' missing 'keys' array", name));
            continue;
        };

        let mut collected = Vec::new();
        let mut seen = BTreeSet::new();
        for (index, key_value) in keys.iter().enumerate() {
            let Some(key) = key_value.as_str() else {
                issues.push(format!(
                    "blackboards entry '{}' has non-string keys[{}]",
                    name, index
                ));
                continue;
            };
            if !seen.insert(key.to_string()) {
                issues.push(format!(
                    "blackboards entry '{}' duplicate key '{}'",
                    name, key
                ));
                continue;
            }
            collected.push(key.to_string());
        }
        keys_by_blackboard.insert(id, collected);
    }
    keys_by_blackboard
}

fn parse_agents(document: &toml::value::Table, issues: &mut Vec<String>) -> Vec<AiAgentSpec> {
    let Some(entries) = document.get("agents").and_then(toml::Value::as_array) else {
        issues.push("missing required array 'agents'".to_string());
        return Vec::new();
    };

    let mut agents = Vec::new();
    let mut seen_ids = BTreeMap::new();

    for (index, entry) in entries.iter().enumerate() {
        let Some(table) = entry.as_table() else {
            issues.push(format!("agents[{index}] is not a table"));
            continue;
        };

        let Some(id) = table.get("id").and_then(toml::Value::as_str) else {
            issues.push(format!("agents[{index}] missing 'id'"));
            continue;
        };

        if let Some(previous_index) = seen_ids.insert(id.to_string(), index) {
            issues.push(format!(
                "duplicate agent id '{}' at indices {} and {}",
                id, previous_index, index
            ));
            continue;
        }

        let Some(state_tree) = table.get("state_tree").and_then(toml::Value::as_str) else {
            issues.push(format!("agent '{}' missing 'state_tree'", id));
            continue;
        };
        let Some(blackboard) = table.get("blackboard").and_then(toml::Value::as_str) else {
            issues.push(format!("agent '{}' missing 'blackboard'", id));
            continue;
        };

        agents.push(AiAgentSpec {
            id: id.to_string(),
            state_tree: state_tree.to_string(),
            blackboard: blackboard.to_string(),
        });
    }

    agents
}

fn parse_runtime_tick_config(
    document: &toml::value::Table,
    issues: &mut Vec<String>,
) -> RuntimeTickConfig {
    let mut config = RuntimeTickConfig {
        phase_order: default_tick_phases(),
        default_blackboard_value_template: DEFAULT_TICK_TEMPLATE.to_string(),
    };

    let Some(tick_table) = document.get("runtime_tick").and_then(toml::Value::as_table) else {
        return config;
    };

    if let Some(phase_values) = tick_table.get("phase_order") {
        match phase_values.as_array() {
            Some(values) => {
                let mut phases = Vec::new();
                let mut seen = BTreeSet::new();
                for (index, value) in values.iter().enumerate() {
                    let Some(raw_phase) = value.as_str() else {
                        issues.push(format!(
                            "runtime_tick.phase_order[{}] is not a string",
                            index
                        ));
                        continue;
                    };
                    let phase = raw_phase.trim();
                    if phase.is_empty() {
                        issues.push(format!("runtime_tick.phase_order[{}] is empty", index));
                        continue;
                    }
                    if !seen.insert(phase.to_string()) {
                        issues.push(format!(
                            "runtime_tick.phase_order duplicate phase '{}'",
                            phase
                        ));
                        continue;
                    }
                    phases.push(phase.to_string());
                }
                if !phases.is_empty() {
                    config.phase_order = phases;
                }
            }
            None => issues.push("runtime_tick.phase_order is not an array".to_string()),
        }
    }

    if let Some(template_value) = tick_table.get("default_blackboard_value_template") {
        match template_value.as_str() {
            Some(template) => {
                let trimmed = template.trim();
                if trimmed.is_empty() {
                    issues.push(
                        "runtime_tick.default_blackboard_value_template cannot be empty"
                            .to_string(),
                    );
                } else {
                    config.default_blackboard_value_template = trimmed.to_string();
                }
            }
            None => issues
                .push("runtime_tick.default_blackboard_value_template is not a string".to_string()),
        }
    }

    config
}

fn parse_decision_overrides(
    document: &toml::value::Table,
    phases: &[String],
    issues: &mut Vec<String>,
) -> BTreeMap<String, BTreeMap<String, String>> {
    let mut overrides = BTreeMap::new();
    let Some(entries) = document
        .get("decision_overrides")
        .and_then(toml::Value::as_array)
    else {
        return overrides;
    };

    let allowed_phases: BTreeSet<&str> = phases.iter().map(String::as_str).collect();

    for (index, entry) in entries.iter().enumerate() {
        let Some(table) = entry.as_table() else {
            issues.push(format!("decision_overrides[{index}] is not a table"));
            continue;
        };

        let Some(agent_id) = table.get("agent").and_then(toml::Value::as_str) else {
            issues.push(format!("decision_overrides[{index}] missing 'agent'"));
            continue;
        };
        let Some(phase) = table.get("phase").and_then(toml::Value::as_str) else {
            issues.push(format!("decision_overrides[{index}] missing 'phase'"));
            continue;
        };
        let Some(decision) = table.get("decision").and_then(toml::Value::as_str) else {
            issues.push(format!("decision_overrides[{index}] missing 'decision'"));
            continue;
        };

        if !allowed_phases.contains(phase) {
            issues.push(format!(
                "decision_overrides[{index}] references unknown phase '{}'",
                phase
            ));
            continue;
        }

        let by_phase = overrides
            .entry(agent_id.trim().to_string())
            .or_insert_with(BTreeMap::new);
        if by_phase.contains_key(phase) {
            issues.push(format!(
                "decision_overrides duplicate for agent '{}' phase '{}'",
                agent_id, phase
            ));
            continue;
        }
        by_phase.insert(phase.to_string(), decision.trim().to_string());
    }

    overrides
}

fn format_blackboard_value(
    template: &str,
    agent: &str,
    phase: &str,
    tick: u64,
    decision: &str,
    key: &str,
) -> String {
    template
        .replace("{agent}", agent)
        .replace("{phase}", phase)
        .replace("{tick}", &tick.to_string())
        .replace("{decision}", decision)
        .replace("{key}", key)
}

#[cfg(test)]
mod tests {
    use super::*;
    use k_os_game_framework::{
        GameDataRegistryState, GamePipelineBootstrapState, RegistrySnapshot,
    };
    use std::collections::BTreeMap;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn write_temp_registry(name: &str, content: &str) -> String {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos();
        let path = std::env::temp_dir().join(format!("k_os_game_ai_{name}_{nonce}.toml"));
        std::fs::write(&path, content).expect("write temp ai registry");
        path.to_string_lossy().into_owned()
    }

    fn bootstrap_state(enabled: bool) -> GamePipelineBootstrapState {
        GamePipelineBootstrapState::new(enabled, "manifest".to_string(), "workspace".to_string())
    }

    fn registry_state(path: String) -> GameDataRegistryState {
        let mut state = GameDataRegistryState::default();
        state.loaded.insert(
            DEFAULT_AI_REGISTRY_KIND.to_string(),
            RegistrySnapshot {
                stage_id: "ai_agents_registry".to_string(),
                profile: "editor_preview".to_string(),
                merge_strategy: "replace".to_string(),
                asset_path: path,
                version: "1".to_string(),
                required_table_counts: BTreeMap::new(),
            },
        );
        state
    }

    #[test]
    fn derives_ready_ai_runtime_state_for_valid_registry() {
        let path = write_temp_registry(
            "valid",
            r#"
version = "1"
registry_kind = "ai_agents"

[runtime_tick]
phase_order = ["sense", "act"]
default_blackboard_value_template = "{agent}:{phase}:{key}:tick-{tick}"

[[state_trees]]
id = "hero.combat.default"
root = "selector.root"

[blackboards.hero]
keys = ["target_entity"]

[[agents]]
id = "hero.default"
state_tree = "hero.combat.default"
blackboard = "blackboards.hero"

[[decision_overrides]]
agent = "hero.default"
phase = "act"
decision = "hero.attack_primary_target"
"#,
        );

        let state =
            derive_ai_runtime_state(Some(&bootstrap_state(true)), Some(&registry_state(path)));
        assert!(state.ready);
        assert_eq!(state.status, "ready");
        assert_eq!(state.agent_ids, vec!["hero.default".to_string()]);
        assert_eq!(
            state.tick_phase_order,
            vec!["sense".to_string(), "act".to_string()]
        );
        assert_eq!(
            state
                .decision_overrides
                .get("hero.default")
                .and_then(|entries| entries.get("act"))
                .map(String::as_str),
            Some("hero.attack_primary_target")
        );
    }

    #[test]
    fn degrades_when_agent_references_missing_state_tree() {
        let path = write_temp_registry(
            "missing_tree",
            r#"
version = "1"
registry_kind = "ai_agents"

[[state_trees]]
id = "npc.vendor.idle"
root = "sequence.idle"

[blackboards.hero]
keys = ["target_entity"]

[[agents]]
id = "hero.default"
state_tree = "hero.combat.default"
blackboard = "blackboards.hero"
"#,
        );

        let state =
            derive_ai_runtime_state(Some(&bootstrap_state(true)), Some(&registry_state(path)));
        assert!(!state.ready);
        assert_eq!(state.status, "degraded");
        assert!(state
            .issues
            .iter()
            .any(|issue| issue.contains("missing state_tree 'hero.combat.default'")));
    }

    #[test]
    fn stays_pending_when_pipeline_disabled() {
        let state = derive_ai_runtime_state(Some(&bootstrap_state(false)), None);
        assert!(!state.ready);
        assert_eq!(state.status, "pending");
        assert_eq!(state.detail, "pipeline disabled");
    }

    #[test]
    fn ticks_decisions_with_phase_rotation_and_override() {
        let path = write_temp_registry(
            "tick_runtime",
            r#"
version = "1"
registry_kind = "ai_agents"

[runtime_tick]
phase_order = ["sense", "act", "recover"]
default_blackboard_value_template = "{agent}:{phase}:{decision}:{key}:tick-{tick}"

[[state_trees]]
id = "hero.combat.default"
root = "selector.combat_root"

[blackboards.hero]
keys = ["target_entity", "combat_state"]

[[agents]]
id = "hero.default"
state_tree = "hero.combat.default"
blackboard = "blackboards.hero"

[[decision_overrides]]
agent = "hero.default"
phase = "act"
decision = "hero.attack_primary_target"
"#,
        );

        let ai_state =
            derive_ai_runtime_state(Some(&bootstrap_state(true)), Some(&registry_state(path)));
        assert!(ai_state.ready);

        let tick1 = derive_ai_decision_runtime_state(&ai_state, None);
        assert!(tick1.ready);
        assert_eq!(tick1.tick_index, 1);
        assert_eq!(tick1.active_phase, "sense");
        assert_eq!(
            tick1
                .agent_decisions
                .get("hero.default")
                .map(String::as_str),
            Some("selector.combat_root::sense")
        );

        let tick2 = derive_ai_decision_runtime_state(&ai_state, Some(&tick1));
        assert!(tick2.ready);
        assert_eq!(tick2.tick_index, 2);
        assert_eq!(tick2.active_phase, "act");
        assert_eq!(
            tick2
                .agent_decisions
                .get("hero.default")
                .map(String::as_str),
            Some("hero.attack_primary_target")
        );
        let blackboard = tick2.blackboard_values.get("blackboards.hero").unwrap();
        assert_eq!(
            blackboard.get("combat_state").map(String::as_str),
            Some("hero.default:act:hero.attack_primary_target:combat_state:tick-2")
        );
    }

    #[test]
    fn degrades_tick_runtime_when_ai_state_not_ready() {
        let ai_state = GameAiRuntimeState {
            ready: false,
            status: "degraded".to_string(),
            detail: "invalid registry".to_string(),
            issues: vec!["missing required array 'agents'".to_string()],
            ..Default::default()
        };

        let tick = derive_ai_decision_runtime_state(&ai_state, None);
        assert!(!tick.ready);
        assert_eq!(tick.status, "degraded");
        assert!(tick
            .issues
            .iter()
            .any(|issue| issue.contains("missing required array 'agents'")));
    }
}
