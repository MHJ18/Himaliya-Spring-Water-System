import React from 'react';
import { useSettings } from '../../context/SettingsContext';
import ClassicDashboard from './ClassicDashboard';
import DashboardStudio from './DashboardStudio';

export default function Dashboard() {
  const { settings } = useSettings();
  return settings.dashboardLayout === 'classic'
    ? <ClassicDashboard />
    : <DashboardStudio />;
}
