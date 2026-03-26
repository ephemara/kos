//! Layout - Flexbox-style layout configuration
//!
//! Layout hints that React uses for positioning.
//! Based on CSS Flexbox model.

use serde::{Deserialize, Serialize};
use ts_rs::TS;

/// Layout style configuration (Flexbox-based)
#[derive(Debug, Clone, Serialize, Deserialize, TS, Default)]
#[ts(export, export_to = "bindings/krue/")]
pub struct LayoutStyle {
    /// Width
    #[serde(default)]
    pub width: LayoutValue,
    
    /// Height
    #[serde(default)]
    pub height: LayoutValue,
    
    /// Minimum width
    #[serde(default)]
    pub min_width: Option<LayoutValue>,
    
    /// Maximum width
    #[serde(default)]
    pub max_width: Option<LayoutValue>,
    
    /// Minimum height
    #[serde(default)]
    pub min_height: Option<LayoutValue>,
    
    /// Maximum height
    #[serde(default)]
    pub max_height: Option<LayoutValue>,
    
    /// Flex direction
    #[serde(default)]
    pub flex_direction: FlexDirection,
    
    /// Flex grow factor
    #[serde(default)]
    pub flex_grow: f32,
    
    /// Flex shrink factor
    #[serde(default = "default_flex_shrink")]
    pub flex_shrink: f32,
    
    /// Gap between children
    #[serde(default)]
    pub gap: f32,
    
    /// Justify content (main axis)
    #[serde(default)]
    pub justify: JustifyContent,
    
    /// Align items (cross axis)
    #[serde(default)]
    pub align: AlignItems,
    
    /// Padding
    #[serde(default)]
    pub padding: EdgeInsets,
    
    /// Margin
    #[serde(default)]
    pub margin: EdgeInsets,
    
    /// Overflow behavior
    #[serde(default)]
    pub overflow: Overflow,
    
    /// Position type
    #[serde(default)]
    pub position: Position,
}

fn default_flex_shrink() -> f32 { 1.0 }

impl LayoutStyle {
    pub fn row() -> Self {
        Self { flex_direction: FlexDirection::Row, ..Default::default() }
    }
    
    pub fn column() -> Self {
        Self { flex_direction: FlexDirection::Column, ..Default::default() }
    }
    
    pub fn grow(mut self) -> Self {
        self.flex_grow = 1.0;
        self
    }
    
    pub fn gap(mut self, gap: f32) -> Self {
        self.gap = gap;
        self
    }
    
    pub fn padding(mut self, padding: f32) -> Self {
        self.padding = EdgeInsets::all(padding);
        self
    }
}

/// Layout dimension value
#[derive(Debug, Clone, Serialize, Deserialize, TS, Default)]
#[ts(export, export_to = "bindings/krue/")]
pub enum LayoutValue {
    /// Auto size
    #[default]
    Auto,
    /// Percentage of parent
    Percent(f32),
    /// Fixed pixels
    Pixels(f32),
    /// Fill available space
    Fill,
}

impl LayoutValue {
    pub fn px(v: f32) -> Self { Self::Pixels(v) }
    pub fn pct(v: f32) -> Self { Self::Percent(v) }
}

/// Flex direction
#[derive(Debug, Clone, Copy, Serialize, Deserialize, TS, Default)]
#[ts(export, export_to = "bindings/krue/")]
pub enum FlexDirection {
    #[default]
    Row,
    Column,
    RowReverse,
    ColumnReverse,
}

/// Justify content (main axis alignment)
#[derive(Debug, Clone, Copy, Serialize, Deserialize, TS, Default)]
#[ts(export, export_to = "bindings/krue/")]
pub enum JustifyContent {
    #[default]
    Start,
    Center,
    End,
    SpaceBetween,
    SpaceAround,
    SpaceEvenly,
}

/// Align items (cross axis alignment)
#[derive(Debug, Clone, Copy, Serialize, Deserialize, TS, Default)]
#[ts(export, export_to = "bindings/krue/")]
pub enum AlignItems {
    #[default]
    Stretch,
    Start,
    Center,
    End,
    Baseline,
}

/// Overflow behavior
#[derive(Debug, Clone, Copy, Serialize, Deserialize, TS, Default)]
#[ts(export, export_to = "bindings/krue/")]
pub enum Overflow {
    #[default]
    Visible,
    Hidden,
    Scroll,
    Auto,
}

/// Position type
#[derive(Debug, Clone, Copy, Serialize, Deserialize, TS, Default)]
#[ts(export, export_to = "bindings/krue/")]
pub enum Position {
    #[default]
    Relative,
    Absolute,
    Fixed,
}

/// Edge insets (padding/margin)
#[derive(Debug, Clone, Copy, Serialize, Deserialize, TS, Default)]
#[ts(export, export_to = "bindings/krue/")]
pub struct EdgeInsets {
    pub top: f32,
    pub right: f32,
    pub bottom: f32,
    pub left: f32,
}

impl EdgeInsets {
    pub fn all(value: f32) -> Self {
        Self { top: value, right: value, bottom: value, left: value }
    }
    
    pub fn xy(x: f32, y: f32) -> Self {
        Self { top: y, right: x, bottom: y, left: x }
    }
    
    pub fn new(top: f32, right: f32, bottom: f32, left: f32) -> Self {
        Self { top, right, bottom, left }
    }
}
