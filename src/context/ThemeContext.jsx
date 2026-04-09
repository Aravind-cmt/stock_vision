import React, { createContext, useContext, useEffect } from 'react';

const ThemeContext = createContext();

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider = ({ children }) => {
  useEffect(() => {
    localStorage.setItem('stockapp_theme', 'dark');
    document.documentElement.setAttribute('data-theme', 'dark');
  }, []);

  return (
    <ThemeContext.Provider value={{ theme: 'dark', setTheme: () => {}, themes: [] }}>
      {children}
    </ThemeContext.Provider>
  );
};
