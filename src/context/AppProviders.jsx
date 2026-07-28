import React from 'react';
import { CustomerProvider } from './CustomerContext';
import { SalesProvider } from './SalesContext';
import { AnalyticsProvider } from './AnalyticsContext';
import { SettingsProvider } from './SettingsContext';
import { DeliveryProvider } from './DeliveryContext';

export default function AppProviders({ children }) {
  return (
    <SettingsProvider>
      <CustomerProvider>
        <DeliveryProvider>
          <SalesProvider>
            <AnalyticsProvider>{children}</AnalyticsProvider>
          </SalesProvider>
        </DeliveryProvider>
      </CustomerProvider>
    </SettingsProvider>
  );
}
