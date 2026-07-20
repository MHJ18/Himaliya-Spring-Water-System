import React from 'react';
import { IconButton, Tooltip } from '@mui/material';
import DarkModeRoundedIcon from '@mui/icons-material/DarkModeRounded';
import LightModeRoundedIcon from '@mui/icons-material/LightModeRounded';
import { useSettings } from '../../context/SettingsContext';

export default function DarkModeToggle() {
  const { settings, toggleDarkMode } = useSettings();
  const isDark = settings.themeMode === 'dark' || settings.darkMode;

  return (
    <Tooltip title={isDark ? 'Use light theme' : 'Use dark theme'}>
      <IconButton
        color="inherit"
        onClick={toggleDarkMode}
        aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
        size="small"
      >
        {isDark
          ? <LightModeRoundedIcon fontSize="small" />
          : <DarkModeRoundedIcon fontSize="small" />}
      </IconButton>
    </Tooltip>
  );
}
