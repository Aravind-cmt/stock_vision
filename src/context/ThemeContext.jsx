import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider = ({ children }) => {
  // Try to load saved theme, default to 'dark'
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('stockapp_theme') || 'dark';
  });

  useEffect(() => {
    // 1. Save to local storage
    localStorage.setItem('stockapp_theme', theme);
    // 2. Apply as data-theme attribute on the root html element
    //    so our global CSS variables can take effect.
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // List of all available themes
  const themes = [
    { id: 'dark', label: 'Dark Mode (Midnight)' },
    { id: 'light', label: 'Light Mode (Modern)' }
  ];

  return (
    <ThemeContext.Provider value={{ theme, setTheme, themes }}>
      {children}
    </ThemeContext.Provider>
  );
};
