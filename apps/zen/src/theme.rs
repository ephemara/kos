use egui::{Color32, CornerRadius, Margin, Stroke};
use egui_dock::{OverlayType, Style as DockStyle};
use serde::Deserialize;
use std::fs;
use std::path::{Path, PathBuf};

const DEFAULT_THEME_SOURCE: &str = include_str!("../resources/theme.toml");

#[derive(Debug, Clone)]
pub struct ZenUiTheme {
    pub palette: ZenThemePalette,
    pub spacing: ZenThemeSpacing,
    pub rounding: ZenThemeRounding,
    pub dock: ZenThemeDock,
}

#[derive(Debug, Clone)]
pub struct ZenThemePalette {
    pub window_bg: Color32,
    pub panel_bg: Color32,
    pub panel_elevated_bg: Color32,
    pub panel_bg_alt: Color32,
    pub panel_header_bg: Color32,
    pub panel_header_accent: Color32,
    pub toolbar_bg: Color32,
    pub status_bg: Color32,
    pub overlay_bg: Color32,
    pub border_subtle: Color32,
    pub border_strong: Color32,
    pub text_primary: Color32,
    pub text_secondary: Color32,
    pub text_muted: Color32,
    pub accent: Color32,
    pub accent_soft: Color32,
    pub chip_bg: Color32,
    pub chip_active_bg: Color32,
    pub chip_outline: Color32,
    pub success: Color32,
    pub warning: Color32,
    pub danger: Color32,
    pub selection_fill: Color32,
    pub selection_stroke: Color32,
    pub viewport_outline: Color32,
    pub viewport_outline_hover: Color32,
    pub timeline_track: Color32,
    pub timeline_tick: Color32,
    pub timeline_clip: Color32,
}

#[derive(Debug, Clone)]
pub struct ZenThemeSpacing {
    pub item: [f32; 2],
    pub button_padding: [f32; 2],
    pub window_margin: f32,
    pub panel_margin: f32,
}

#[derive(Debug, Clone)]
pub struct ZenThemeRounding {
    pub panel: f32,
    pub viewport: f32,
    pub overlay: f32,
}

#[derive(Debug, Clone)]
pub struct ZenThemeDock {
    pub surface_border: Color32,
    pub tab_bar_bg: Color32,
    pub tab_bar_line: Color32,
    pub tab_active_bg: Color32,
    pub tab_inactive_bg: Color32,
    pub tab_hover_bg: Color32,
    pub tab_focused_bg: Color32,
    pub tab_text: Color32,
    pub tab_text_muted: Color32,
    pub tab_outline: Color32,
    pub tab_outline_hover: Color32,
    pub separator_idle: Color32,
    pub separator_hover: Color32,
    pub separator_drag: Color32,
    pub overlay_selection: Color32,
    pub overlay_button: Color32,
    pub overlay_button_border: Color32,
    pub tab_bar_height: f32,
    pub tab_rounding: f32,
    pub body_rounding: f32,
    pub separator_width: f32,
    pub separator_hit: f32,
    pub overlay_button_spacing: f32,
    pub overlay_button_max: f32,
}

impl ZenUiTheme {
    pub fn load(configured: &str) -> Result<Self, String> {
        for candidate in source_path_candidates(configured) {
            if candidate.exists() {
                let source = fs::read_to_string(&candidate).map_err(|err| {
                    format!(
                        "Failed to read Zen theme manifest '{}': {err}",
                        candidate.display()
                    )
                })?;
                return Self::parse(&source);
            }
        }
        Self::parse(DEFAULT_THEME_SOURCE)
    }

    pub fn parse(source: &str) -> Result<Self, String> {
        let parsed: ZenThemeFile = toml::from_str(source)
            .map_err(|err| format!("Failed to parse Zen theme manifest: {err}"))?;

        let window_bg = parse_color("window_bg", &parsed.palette.window_bg)?;
        let panel_bg = parse_color("panel_bg", &parsed.palette.panel_bg)?;
        let panel_bg_alt = parse_color("panel_bg_alt", &parsed.palette.panel_bg_alt)?;
        let toolbar_bg = parse_color("toolbar_bg", &parsed.palette.toolbar_bg)?;
        let status_bg = parse_color("status_bg", &parsed.palette.status_bg)?;
        let overlay_bg = parse_color("overlay_bg", &parsed.palette.overlay_bg)?;
        let border_subtle = parse_color("border_subtle", &parsed.palette.border_subtle)?;
        let border_strong = parse_color("border_strong", &parsed.palette.border_strong)?;
        let text_primary = parse_color("text_primary", &parsed.palette.text_primary)?;
        let text_secondary = parse_color("text_secondary", &parsed.palette.text_secondary)?;
        let text_muted = parse_color("text_muted", &parsed.palette.text_muted)?;
        let accent = parse_color("accent", &parsed.palette.accent)?;
        let accent_soft = parse_color("accent_soft", &parsed.palette.accent_soft)?;
        let warning = parse_color("warning", &parsed.palette.warning)?;
        let danger = parse_color("danger", &parsed.palette.danger)?;
        let selection_fill = parse_color("selection_fill", &parsed.palette.selection_fill)?;
        let selection_stroke = parse_color("selection_stroke", &parsed.palette.selection_stroke)?;
        let viewport_outline = parse_color("viewport_outline", &parsed.palette.viewport_outline)?;
        let viewport_outline_hover = parse_color(
            "viewport_outline_hover",
            &parsed.palette.viewport_outline_hover,
        )?;
        let timeline_track = parse_color("timeline_track", &parsed.palette.timeline_track)?;
        let timeline_tick = parse_color("timeline_tick", &parsed.palette.timeline_tick)?;
        let timeline_clip = parse_color("timeline_clip", &parsed.palette.timeline_clip)?;
        let panel_elevated_bg = parse_optional_color(
            "panel_elevated_bg",
            parsed.palette.panel_elevated_bg.as_deref(),
            panel_bg_alt,
        )?;
        let panel_header_bg = parse_optional_color(
            "panel_header_bg",
            parsed.palette.panel_header_bg.as_deref(),
            panel_elevated_bg,
        )?;
        let panel_header_accent = parse_optional_color(
            "panel_header_accent",
            parsed.palette.panel_header_accent.as_deref(),
            accent,
        )?;
        let chip_bg = parse_optional_color("chip_bg", parsed.palette.chip_bg.as_deref(), panel_bg)?;
        let chip_active_bg = parse_optional_color(
            "chip_active_bg",
            parsed.palette.chip_active_bg.as_deref(),
            panel_elevated_bg,
        )?;
        let chip_outline = parse_optional_color(
            "chip_outline",
            parsed.palette.chip_outline.as_deref(),
            border_subtle,
        )?;
        let success = parse_optional_color("success", parsed.palette.success.as_deref(), accent)?;

        Ok(Self {
            palette: ZenThemePalette {
                window_bg,
                panel_bg,
                panel_elevated_bg,
                panel_bg_alt,
                panel_header_bg,
                panel_header_accent,
                toolbar_bg,
                status_bg,
                overlay_bg,
                border_subtle,
                border_strong,
                text_primary,
                text_secondary,
                text_muted,
                accent,
                accent_soft,
                chip_bg,
                chip_active_bg,
                chip_outline,
                success,
                warning,
                danger,
                selection_fill,
                selection_stroke,
                viewport_outline,
                viewport_outline_hover,
                timeline_track,
                timeline_tick,
                timeline_clip,
            },
            spacing: ZenThemeSpacing {
                item: parsed.spacing.item,
                button_padding: parsed.spacing.button_padding,
                window_margin: parsed.spacing.window_margin.max(0.0),
                panel_margin: parsed.spacing.panel_margin.max(0.0),
            },
            rounding: ZenThemeRounding {
                panel: parsed.rounding.panel.max(0.0),
                viewport: parsed.rounding.viewport.max(0.0),
                overlay: parsed.rounding.overlay.max(0.0),
            },
            dock: ZenThemeDock {
                surface_border: parse_color("surface_border", &parsed.dock.surface_border)?,
                tab_bar_bg: parse_color("tab_bar_bg", &parsed.dock.tab_bar_bg)?,
                tab_bar_line: parse_color("tab_bar_line", &parsed.dock.tab_bar_line)?,
                tab_active_bg: parse_color("tab_active_bg", &parsed.dock.tab_active_bg)?,
                tab_inactive_bg: parse_color("tab_inactive_bg", &parsed.dock.tab_inactive_bg)?,
                tab_hover_bg: parse_color("tab_hover_bg", &parsed.dock.tab_hover_bg)?,
                tab_focused_bg: parse_color("tab_focused_bg", &parsed.dock.tab_focused_bg)?,
                tab_text: parse_color("tab_text", &parsed.dock.tab_text)?,
                tab_text_muted: parse_color("tab_text_muted", &parsed.dock.tab_text_muted)?,
                tab_outline: parse_color("tab_outline", &parsed.dock.tab_outline)?,
                tab_outline_hover: parse_color(
                    "tab_outline_hover",
                    &parsed.dock.tab_outline_hover,
                )?,
                separator_idle: parse_color("separator_idle", &parsed.dock.separator_idle)?,
                separator_hover: parse_color("separator_hover", &parsed.dock.separator_hover)?,
                separator_drag: parse_color("separator_drag", &parsed.dock.separator_drag)?,
                overlay_selection: parse_color(
                    "overlay_selection",
                    &parsed.dock.overlay_selection,
                )?,
                overlay_button: parse_color("overlay_button", &parsed.dock.overlay_button)?,
                overlay_button_border: parse_color(
                    "overlay_button_border",
                    &parsed.dock.overlay_button_border,
                )?,
                tab_bar_height: parsed.dock.tab_bar_height.clamp(22.0, 64.0),
                tab_rounding: parsed.dock.tab_rounding.clamp(0.0, 24.0),
                body_rounding: parsed.dock.body_rounding.clamp(0.0, 24.0),
                separator_width: parsed.dock.separator_width.clamp(1.0, 6.0),
                separator_hit: parsed.dock.separator_hit.clamp(1.0, 24.0),
                overlay_button_spacing: parsed.dock.overlay_button_spacing.clamp(2.0, 24.0),
                overlay_button_max: parsed.dock.overlay_button_max.clamp(32.0, 160.0),
            },
        })
    }

    pub fn apply_to_style(&self, style: &mut egui::Style) {
        style.spacing.item_spacing = egui::vec2(self.spacing.item[0], self.spacing.item[1]);
        style.spacing.button_padding = egui::vec2(
            self.spacing.button_padding[0],
            self.spacing.button_padding[1],
        );
        style.spacing.window_margin = egui::Margin::same(self.spacing.window_margin as i8);
        style.visuals = egui::Visuals::dark();
        style.visuals.panel_fill = self.palette.window_bg;
        style.visuals.extreme_bg_color = self.palette.window_bg;
        style.visuals.faint_bg_color = self.palette.panel_elevated_bg;
        style.visuals.window_fill = self.palette.panel_bg;
        style.visuals.selection.bg_fill = self.palette.selection_fill;
        style.visuals.selection.stroke = egui::Stroke::new(1.0, self.palette.selection_stroke);
        style.visuals.hyperlink_color = self.palette.accent;
        style.visuals.widgets.noninteractive.bg_fill = self.palette.panel_header_bg;
        style.visuals.widgets.noninteractive.weak_bg_fill = self.palette.panel_elevated_bg;
        style.visuals.widgets.noninteractive.bg_stroke =
            egui::Stroke::new(1.0, self.palette.border_subtle);
        style.visuals.widgets.inactive.bg_fill = self.palette.panel_elevated_bg;
        style.visuals.widgets.inactive.weak_bg_fill = self.palette.panel_bg_alt;
        style.visuals.widgets.inactive.bg_stroke =
            egui::Stroke::new(1.0, self.palette.border_subtle);
        style.visuals.widgets.hovered.bg_fill = self.palette.chip_active_bg;
        style.visuals.widgets.hovered.weak_bg_fill = self.palette.chip_active_bg;
        style.visuals.widgets.hovered.bg_stroke =
            egui::Stroke::new(1.0, self.palette.border_strong);
        style.visuals.widgets.active.bg_fill = self.palette.accent_soft;
        style.visuals.widgets.active.weak_bg_fill = self.palette.accent_soft;
        style.visuals.widgets.active.bg_stroke =
            egui::Stroke::new(1.0, self.palette.selection_stroke);
    }

    pub fn surface_clear_color(&self) -> wgpu::Color {
        color32_to_wgpu(self.palette.window_bg)
    }

    pub fn dock_style(&self, egui_style: &egui::Style) -> DockStyle {
        let mut style = DockStyle::from_egui(egui_style);
        style.main_surface_border_stroke = Stroke::new(1.0, self.dock.surface_border);
        style.main_surface_border_rounding = corner_radius(self.rounding.panel);

        style.separator.width = self.dock.separator_width;
        style.separator.extra_interact_width = self.dock.separator_hit;
        style.separator.color_idle = self.dock.separator_idle;
        style.separator.color_hovered = self.dock.separator_hover;
        style.separator.color_dragged = self.dock.separator_drag;

        style.tab_bar.bg_fill = self.dock.tab_bar_bg;
        style.tab_bar.height = self.dock.tab_bar_height;
        style.tab_bar.inner_margin = Margin::same(self.spacing.panel_margin as i8);
        style.tab_bar.corner_radius = CornerRadius {
            nw: corner_radius(self.dock.tab_rounding).nw,
            ne: corner_radius(self.dock.tab_rounding).ne,
            sw: 0,
            se: 0,
        };
        style.tab_bar.hline_color = self.dock.tab_bar_line;
        style.tab_bar.fill_tab_bar = true;

        style.tab.active.bg_fill = self.dock.tab_active_bg;
        style.tab.active.outline_color = self.dock.tab_outline;
        style.tab.active.text_color = self.dock.tab_text;
        style.tab.active.corner_radius = corner_radius(self.dock.tab_rounding);

        style.tab.inactive.bg_fill = self.dock.tab_inactive_bg;
        style.tab.inactive.outline_color = self.dock.tab_outline;
        style.tab.inactive.text_color = self.dock.tab_text_muted;
        style.tab.inactive.corner_radius = corner_radius(self.dock.tab_rounding);

        style.tab.hovered.bg_fill = self.dock.tab_hover_bg;
        style.tab.hovered.outline_color = self.dock.tab_outline_hover;
        style.tab.hovered.text_color = self.dock.tab_text;
        style.tab.hovered.corner_radius = corner_radius(self.dock.tab_rounding);

        style.tab.focused.bg_fill = self.dock.tab_focused_bg;
        style.tab.focused.outline_color = self.dock.tab_outline_hover;
        style.tab.focused.text_color = self.dock.tab_text;
        style.tab.focused.corner_radius = corner_radius(self.dock.tab_rounding);

        style.tab.active_with_kb_focus = style.tab.focused.clone();
        style.tab.inactive_with_kb_focus = style.tab.hovered.clone();
        style.tab.focused_with_kb_focus = style.tab.focused.clone();
        style.tab.spacing = 4.0;
        style.tab.hline_below_active_tab_name = false;
        style.tab.minimum_width = Some(96.0);
        style.tab.tab_body.bg_fill = self.palette.panel_bg;
        style.tab.tab_body.stroke = Stroke::new(1.0, self.dock.surface_border);
        style.tab.tab_body.corner_radius = corner_radius(self.dock.body_rounding);
        style.tab.tab_body.inner_margin = Margin::same(self.spacing.panel_margin as i8);

        style.overlay.selection_color = self.dock.overlay_selection;
        style.overlay.button_spacing = self.dock.overlay_button_spacing;
        style.overlay.max_button_size = self.dock.overlay_button_max;
        style.overlay.button_color = self.dock.overlay_button;
        style.overlay.button_border_stroke = Stroke::new(1.0, self.dock.overlay_button_border);
        style.overlay.overlay_type = OverlayType::Widgets;

        style
    }
}

#[derive(Debug, Deserialize)]
struct ZenThemeFile {
    palette: ZenThemePaletteFile,
    spacing: ZenThemeSpacingFile,
    rounding: ZenThemeRoundingFile,
    dock: ZenThemeDockFile,
}

#[derive(Debug, Deserialize)]
struct ZenThemePaletteFile {
    window_bg: String,
    panel_bg: String,
    panel_elevated_bg: Option<String>,
    panel_bg_alt: String,
    panel_header_bg: Option<String>,
    panel_header_accent: Option<String>,
    toolbar_bg: String,
    status_bg: String,
    overlay_bg: String,
    border_subtle: String,
    border_strong: String,
    text_primary: String,
    text_secondary: String,
    text_muted: String,
    accent: String,
    accent_soft: String,
    chip_bg: Option<String>,
    chip_active_bg: Option<String>,
    chip_outline: Option<String>,
    success: Option<String>,
    warning: String,
    danger: String,
    selection_fill: String,
    selection_stroke: String,
    viewport_outline: String,
    viewport_outline_hover: String,
    timeline_track: String,
    timeline_tick: String,
    timeline_clip: String,
}

#[derive(Debug, Deserialize)]
struct ZenThemeSpacingFile {
    item: [f32; 2],
    button_padding: [f32; 2],
    window_margin: f32,
    panel_margin: f32,
}

#[derive(Debug, Deserialize)]
struct ZenThemeRoundingFile {
    panel: f32,
    viewport: f32,
    overlay: f32,
}

#[derive(Debug, Deserialize)]
struct ZenThemeDockFile {
    surface_border: String,
    tab_bar_bg: String,
    tab_bar_line: String,
    tab_active_bg: String,
    tab_inactive_bg: String,
    tab_hover_bg: String,
    tab_focused_bg: String,
    tab_text: String,
    tab_text_muted: String,
    tab_outline: String,
    tab_outline_hover: String,
    separator_idle: String,
    separator_hover: String,
    separator_drag: String,
    overlay_selection: String,
    overlay_button: String,
    overlay_button_border: String,
    tab_bar_height: f32,
    tab_rounding: f32,
    body_rounding: f32,
    separator_width: f32,
    separator_hit: f32,
    overlay_button_spacing: f32,
    overlay_button_max: f32,
}

fn parse_color(label: &str, raw: &str) -> Result<Color32, String> {
    let value = raw.trim().trim_start_matches('#');
    match value.len() {
        6 => {
            let r = parse_hex_u8(&value[0..2], label)?;
            let g = parse_hex_u8(&value[2..4], label)?;
            let b = parse_hex_u8(&value[4..6], label)?;
            Ok(Color32::from_rgb(r, g, b))
        }
        8 => {
            let r = parse_hex_u8(&value[0..2], label)?;
            let g = parse_hex_u8(&value[2..4], label)?;
            let b = parse_hex_u8(&value[4..6], label)?;
            let a = parse_hex_u8(&value[6..8], label)?;
            Ok(Color32::from_rgba_unmultiplied(r, g, b, a))
        }
        _ => Err(format!(
            "Zen theme color '{label}' must be #RRGGBB or #RRGGBBAA, got '{raw}'"
        )),
    }
}

fn parse_hex_u8(value: &str, label: &str) -> Result<u8, String> {
    u8::from_str_radix(value, 16).map_err(|err| {
        format!("Invalid hex component '{value}' in Zen theme color '{label}': {err}")
    })
}

fn parse_optional_color(
    label: &str,
    raw: Option<&str>,
    fallback: Color32,
) -> Result<Color32, String> {
    raw.map(|value| parse_color(label, value))
        .transpose()
        .map(|parsed| parsed.unwrap_or(fallback))
}

fn color32_to_wgpu(color: Color32) -> wgpu::Color {
    wgpu::Color {
        r: color.r() as f64 / 255.0,
        g: color.g() as f64 / 255.0,
        b: color.b() as f64 / 255.0,
        a: color.a() as f64 / 255.0,
    }
}

pub fn resolve_source_path(configured: &str) -> Option<PathBuf> {
    source_path_candidates(configured)
        .into_iter()
        .find(|candidate| candidate.exists())
}

fn source_path_candidates(configured: &str) -> Vec<PathBuf> {
    let configured_path = PathBuf::from(configured);
    if configured_path.is_absolute() {
        return vec![configured_path];
    }

    let mut candidates = Vec::new();
    if let Ok(current_exe) = std::env::current_exe() {
        if let Some(parent) = current_exe.parent() {
            candidates.push(parent.join(&configured_path));
            candidates.push(
                parent
                    .join("zen")
                    .join(file_name_or_original(&configured_path)),
            );
        }
    }
    candidates.push(k_os_kain::workspace_root().join(&configured_path));
    candidates
}

fn file_name_or_original(path: &Path) -> PathBuf {
    path.file_name()
        .map(PathBuf::from)
        .unwrap_or_else(|| path.to_path_buf())
}

fn corner_radius(value: f32) -> CornerRadius {
    CornerRadius::same(value.round().clamp(0.0, 255.0) as u8)
}
