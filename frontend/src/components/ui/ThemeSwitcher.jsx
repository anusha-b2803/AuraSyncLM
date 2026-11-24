import React from 'react';

import { useTheme } from '../../contexts/ThemeContext';
import { THEMES } from '../../utils/constants';


const ThemeSwitcher = () => {
    const { theme, setTheme } = useTheme();

    const toggleTheme = () => {
        const nextTheme = theme === THEMES.LIGHT ? THEMES.DARK : THEMES.LIGHT;
        setTheme(nextTheme);
    };

    const isDark = theme === THEMES.DARK || theme === THEMES.AMOLED;

    return (
        <button
            onClick={toggleTheme}
            className="flex items-center gap-2 px-3 py-2 glass border border-[var(--border-color)] rounded-lg text-sm font-medium"
            title={`Switch to ${isDark ? 'Light' : 'Dark'} Mode`}
        >
            <span className="text-lg">
                {isDark ? '☀️' : '🌙'}
            </span>
            <span className="text-xs text-[var(--text-secondary)]">
                {isDark ? 'Light' : 'Dark'}
            </span>
        </button>
    );
};

export default ThemeSwitcher;
