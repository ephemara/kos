use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ZenRenderProfile {
    pub name: String,
    pub viewport_passes: Vec<ZenRenderPass>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ZenRenderPass {
    pub key: String,
    pub enabled: bool,
    pub shader_domain: String,
}

impl Default for ZenRenderProfile {
    fn default() -> Self {
        Self {
            name: "Zen Universal Viewport".to_string(),
            viewport_passes: vec![
                ZenRenderPass {
                    key: "shadow_map".to_string(),
                    enabled: true,
                    shader_domain: "renderer.shadow".to_string(),
                },
                ZenRenderPass {
                    key: "forward_lighting".to_string(),
                    enabled: true,
                    shader_domain: "renderer.forward".to_string(),
                },
                ZenRenderPass {
                    key: "kain_post".to_string(),
                    enabled: false,
                    shader_domain: "renderer_zen_atmosphere".to_string(),
                },
            ],
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_render_profile_has_forward_pass() {
        let profile = ZenRenderProfile::default();
        assert!(profile
            .viewport_passes
            .iter()
            .any(|pass| pass.key == "forward_lighting"));
    }
}
