/**
 * K_OS UI Theme System
 * 
 * Multi-style theming with per-app configuration.
 */

export {
    ThemeProvider,
    useTheme,
    useThemeSafe,
    useThemeTokens,
    GlassPanel
} from './ThemeProvider';

export {
    type ThemeStyle,
    type ThemeTokens,
    themeRegistry,
    themeNames,
    themeDescriptions,
    themeToCssVars,
    classicTheme,
    glassTheme,
    neonTheme,
    minimalTheme
} from './theme';

export {
    defaultAppThemes,
    getAppTheme,
    setAppTheme,
    setGlobalTheme,
    getGlobalTheme,
    clearThemeOverrides,
    getAllThemeOverrides,
    THEME_STORAGE_KEY,
    GLOBAL_THEME_KEY
} from './appThemeConfig';

export {
    ThemeSelector,
    ThemeToggle
} from './ThemeSelector';

export {
    type TopBarLayoutStyle,
    type TopBarLayoutDefinition,
    topBarLayouts,
    getTopBarLayout,
    setTopBarLayout,
    getLayoutDefinition,
    TOPBAR_LAYOUT_KEY,
    DEFAULT_TOPBAR_LAYOUT
} from './topBarLayoutConfig';

export {
    type TopBarTheme,
    topBarThemes
} from './topBarThemes';
