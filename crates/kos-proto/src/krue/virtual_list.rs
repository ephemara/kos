//! Virtual List - Efficient rendering of large lists
//!
//! Virtualization configuration for rendering only visible items.

use serde::{Deserialize, Serialize};
use ts_rs::TS;

use super::node::UiNode;

/// Virtual list configuration for large datasets
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "bindings/krue/")]
pub struct VirtualListConfig {
    /// Binding path to total item count
    pub count_bind: String,
    
    /// Fixed height per item (required for virtual scroll)
    pub item_height: f32,
    
    /// Number of extra items to render above/below viewport (overscan)
    #[serde(default = "default_overscan")]
    pub overscan: usize,
    
    /// Template node for each item
    pub template: Box<UiNode>,
    
    /// Binding path for the visible items data
    pub items_bind: String,
    
    /// Optional: binding for scroll position
    #[serde(default)]
    pub scroll_bind: Option<String>,
}

fn default_overscan() -> usize { 5 }

impl VirtualListConfig {
    pub fn new(
        count_bind: impl Into<String>,
        items_bind: impl Into<String>,
        item_height: f32,
        template: UiNode,
    ) -> Self {
        Self {
            count_bind: count_bind.into(),
            items_bind: items_bind.into(),
            item_height,
            overscan: 5,
            template: Box::new(template),
            scroll_bind: None,
        }
    }
    
    pub fn with_overscan(mut self, overscan: usize) -> Self {
        self.overscan = overscan;
        self
    }
    
    pub fn with_scroll_bind(mut self, scroll_bind: impl Into<String>) -> Self {
        self.scroll_bind = Some(scroll_bind.into());
        self
    }
}

/// Virtual scroll report from React to Bevy
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "bindings/krue/")]
pub struct VirtualScrollReport {
    /// List node ID
    pub list_id: u64,
    
    /// First visible index
    pub start_index: usize,
    
    /// Last visible index (exclusive)
    pub end_index: usize,
    
    /// Scroll position (pixels from top)
    pub scroll_top: f32,
    
    /// Viewport height
    pub viewport_height: f32,
}

impl VirtualScrollReport {
    /// Calculate the visible range with overscan
    pub fn visible_range_with_overscan(&self, overscan: usize, total_count: usize) -> (usize, usize) {
        let start = self.start_index.saturating_sub(overscan);
        let end = (self.end_index + overscan).min(total_count);
        (start, end)
    }
}
