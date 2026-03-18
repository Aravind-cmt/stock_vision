import React from 'react';
import { useTheme } from '../context/ThemeContext';
import './ThemeSwitcher.css';

const ThemeSwitcher = () => {
  const { theme, setTheme, themes } = useTheme();

  return (
    <div className="theme-switcher">
      <select 
        value={theme} 
        onChange={(e) => setTheme(e.target.value)}
        className="theme-select"
        title="Change App Theme"
      >
        {themes.map((t) => (
          <option key={t.id} value={t.id}>
            {t.id === 'dark' ? '🌙' : '☀️'} {t.label}
          </option>
        ))}
      </select>
    </div>
  );
};

export default ThemeSwitcher;
