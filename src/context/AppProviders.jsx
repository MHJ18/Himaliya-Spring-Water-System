import React from 'react';
import { CustomerProvider } from './CustomerContext';
import { SalesProvider } from './SalesContext';
import { AnalyticsProvider } from './AnalyticsContext';
import { SettingsProvider } from './SettingsContext';

export default function AppProviders({ children }) {
  return (
    <SettingsProvider>
      <CustomerProvider>
        <SalesProvider>
          <AnalyticsProvider>{children}</AnalyticsProvider>
        </SalesProvider>
      </CustomerProvider>
    </SettingsProvider>
  );
}
