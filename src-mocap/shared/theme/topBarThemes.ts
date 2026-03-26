/**
 * K_OS Top Bar Theme System
 * 
 * Defines visual styles for the shell header.
 */

export interface TopBarTheme {
    id: string;
    name: string;
    description: string;
    styles: {
        background: string;
        borderBottom: string;
        height: string;
        logoColor: string;
        textColor: string;
        accentColor: string;
        glowOpacity: number;
        buttonPadding: string;
        buttonRadius: string;
        buttonBg: string;
        buttonBorder: string;
        buttonHoverBg: string;
        buttonActiveBg: string;
        blur: string;
    };
}

export const topBarThemes: TopBarTheme[] = [
    {
        id: 'obsidian',
        name: 'Obsidian',
        description: 'Deep black with subtle highlights',
        styles: {
            background: 'rgba(5, 5, 5, 0.95)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
            height: '56px',
            logoColor: '#00ffcc',
            textColor: 'rgba(255, 255, 255, 0.9)',
            accentColor: '#00ffcc',
            glowOpacity: 0.1,
            buttonPadding: '0 12px',
            buttonRadius: '9999px',
            buttonBg: 'rgba(255, 255, 255, 0.03)',
            buttonBorder: '1px solid rgba(255, 255, 255, 0.05)',
            buttonHoverBg: 'rgba(255, 255, 255, 0.08)',
            buttonActiveBg: 'rgba(255, 255, 255, 0.12)',
            blur: '24px',
        }
    },
    {
        id: 'glass',
        name: 'Frost Glass',
        description: 'Highly transparent with heavy blur',
        styles: {
            background: 'rgba(15, 15, 25, 0.6)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            height: '64px',
            logoColor: '#a78bfa',
            textColor: 'white',
            accentColor: '#a78bfa',
            glowOpacity: 0.2,
            buttonPadding: '0 16px',
            buttonRadius: '12px',
            buttonBg: 'rgba(255, 255, 255, 0.05)',
            buttonBorder: '1px solid rgba(255, 255, 255, 0.08)',
            buttonHoverBg: 'rgba(255, 255, 255, 0.12)',
            buttonActiveBg: 'rgba(255, 255, 255, 0.2)',
            blur: '40px',
        }
    },
    {
        id: 'cyber',
        name: 'Cyberpunk',
        description: 'High contrast with neon accents',
        styles: {
            background: 'rgba(5, 5, 10, 0.98)',
            borderBottom: '2px solid #00ff88',
            height: '52px',
            logoColor: '#00ff88',
            textColor: '#00ff88',
            accentColor: '#ff0080',
            glowOpacity: 0.4,
            buttonPadding: '0 10px',
            buttonRadius: '2px',
            buttonBg: 'rgba(0, 255, 136, 0.05)',
            buttonBorder: '1px solid rgba(0, 255, 136, 0.2)',
            buttonHoverBg: 'rgba(0, 255, 136, 0.15)',
            buttonActiveBg: 'rgba(0, 255, 136, 0.25)',
            blur: '0',
        }
    },
    {
        id: 'aurora',
        name: 'Aurora',
        description: 'Vibrant gradients and fluid shapes',
        styles: {
            background: 'rgba(10, 10, 12, 0.8)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.03)',
            height: '60px',
            logoColor: '#38bdf8',
            textColor: 'white',
            accentColor: '#818cf8',
            glowOpacity: 0.3,
            buttonPadding: '0 14px',
            buttonRadius: '16px',
            buttonBg: 'rgba(255, 255, 255, 0.02)',
            buttonBorder: '1px solid rgba(255, 255, 255, 0.05)',
            buttonHoverBg: 'rgba(255, 255, 255, 0.05)',
            buttonActiveBg: 'rgba(255, 255, 255, 0.1)',
            blur: '32px',
        }
    }
];
