import React, { createContext, useContext, useEffect, useState } from 'react';
import { THEMES } from '../utils/constants';

const ThemeContext = createContext();

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within ThemeProvider');
    }
    return context;
};

export const ThemeProvider = ({ children }) => {
    const [theme, setTheme] = useState(THEMES.DARK);
    const [customBackground, setCustomBackground] = useState(null);
    const [blurIntensity, setBlurIntensity] = useState(10);
    const [backgroundOpacity, setBackgroundOpacity] = useState(0.85);
    const [autoContrast, setAutoContrast] = useState(false);

    useEffect(() => {
        // Apply theme to document
        document.documentElement.setAttribute('data-theme', theme);
    }, [theme]);

    useEffect(() => {
        // Apply custom background if set
        if (customBackground) {
            document.documentElement.style.setProperty('--custom-bg-image', `url(${customBackground})`);
            document.documentElement.style.setProperty('--custom-bg-blur', `${blurIntensity}px`);
            document.documentElement.style.setProperty('--custom-bg-opacity', backgroundOpacity);
        } else {
            document.documentElement.style.removeProperty('--custom-bg-image');
        }
    }, [customBackground, blurIntensity, backgroundOpacity]);

    const toggleTheme = () => {
        const themes = Object.values(THEMES);
        const currentIndex = themes.indexOf(theme);
        const nextIndex = (currentIndex + 1) % themes.length;
        setTheme(themes[nextIndex]);
    };

    const value = {
        theme,
        setTheme,
        toggleTheme,
        customBackground,
        setCustomBackground,
        blurIntensity,
        setBlurIntensity,
        backgroundOpacity,
        setBackgroundOpacity,
        autoContrast,
        setAutoContrast,
    };

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};
