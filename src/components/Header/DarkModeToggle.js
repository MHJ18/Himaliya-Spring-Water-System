import React from 'react';
import { NavItem, NavLink } from 'reactstrap';
import { Moon, Sun } from 'lucide-react';
import { useSettings } from '../../context/SettingsContext';
import s from './Header.module.scss';

export default function DarkModeToggle() {
  const { settings, toggleDarkMode } = useSettings();
  return (
    <NavItem>
      <NavLink
        className={`${s.navItem} ${s.iconLink} text-white`}
        href="#"
        onClick={(e) => { e.preventDefault(); toggleDarkMode(); }}
        title={settings.darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
        aria-label={settings.darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {settings.darkMode
          ? <Sun className={s.headerIcon} aria-hidden="true" />
          : <Moon className={s.headerIcon} aria-hidden="true" />}
      </NavLink>
    </NavItem>
  );
}
