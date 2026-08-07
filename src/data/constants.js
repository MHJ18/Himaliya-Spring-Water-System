export const DEFAULT_COUNTRY_CODE = '+92';

export const BOTTLE_TYPES = [
  'Small Bottle',
  'Medium Bottle',
  'Large Bottle',
  'Gallon',
];

export const BOTTLE_TYPE_LABELS = {
  Gallon: '19L Gallon',
};

export const FILTER_PERIODS = {
  DAILY: 'daily',
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
};

export const ADMIN_THEME_PRESETS = [
  {
    id: 'glacier',
    name: 'Glacier',
    description: 'Fresh aqua with a crisp blue edge',
    primary: '#078ead',
    primaryLight: '#63d7e8',
    primaryDark: '#05677f',
    secondary: '#405fd2',
    swatches: ['#078ead', '#63d7e8', '#405fd2'],
  },
  {
    id: 'ocean',
    name: 'Ocean',
    description: 'Confident blue with clear sky highlights',
    primary: '#2563eb',
    primaryLight: '#60a5fa',
    primaryDark: '#1d4ed8',
    secondary: '#0891b2',
    swatches: ['#1d4ed8', '#60a5fa', '#0891b2'],
  },
  {
    id: 'indigo',
    name: 'Indigo',
    description: 'Refined violet with a soft orchid accent',
    primary: '#6857d9',
    primaryLight: '#9b8cf2',
    primaryDark: '#4f3eb7',
    secondary: '#c0448f',
    swatches: ['#4f3eb7', '#9b8cf2', '#c0448f'],
  },
  {
    id: 'emerald',
    name: 'Emerald',
    description: 'Calm green with a modern teal finish',
    primary: '#0f8f6f',
    primaryLight: '#55d6ad',
    primaryDark: '#087052',
    secondary: '#0d87a5',
    swatches: ['#087052', '#55d6ad', '#0d87a5'],
  },
  {
    id: 'sunset',
    name: 'Sunset',
    description: 'Warm coral balanced by a rich berry tone',
    primary: '#dc643b',
    primaryLight: '#f5a06f',
    primaryDark: '#b74629',
    secondary: '#bd3f77',
    swatches: ['#b74629', '#f5a06f', '#bd3f77'],
  },
];

export const DEFAULT_ADMIN_THEME_PRESET = 'glacier';

export function getAdminThemePreset(value) {
  return ADMIN_THEME_PRESETS.find((preset) => preset.id === value) || ADMIN_THEME_PRESETS[0];
}

export const DEFAULT_SETTINGS = {
  darkMode: false,
  themeMode: 'light',
  colorTheme: DEFAULT_ADMIN_THEME_PRESET,
  // The regular workspace now uses the former information-dense scale.
  // Compact mode remains an explicit opt-in for an even tighter desktop view.
  compactMode: false,
  reduceMotion: false,
  highContrast: false,
  fontScale: 'default',
  surfaceStyle: 'soft',
  dashboardLayout: 'studio',
  language: 'en',
  headerColor: '#08090b',
  headerTextColor: '#f7f8fa',
  sidebarColor: '#111214',
  sidebarTextColor: '#e7e9ed',
  sidebarBrandTitle: 'Himaliya Spring',
  sidebarBrandSubtitle: 'Water operations',
  authAccentColor: '#078ead',
  authPanelColor: '#071d2a',
  authLayout: 'split',
  showLoginStats: true,
  showBreadcrumbs: true,
  stickyHeader: true,
  defaultPageSize: 10,
  showDashboardMap: true,
  sidebarPosition: 'left',
  sidebarVisibility: 'show',
  businessName: 'Himaliya Spring Water',
  businessPhone: '+92 300 0000000',
  businessEmail: '',
  businessAddress: 'Sialkot Cantt',
  serviceArea: 'Sialkot and surrounding areas',
  invoiceFooter: 'Thank you for choosing Himaliya Spring Water.',
  autoAcceptOrders: false,
  riderAssignmentMode: 'manual',
  defaultRiderId: '',
  adminOrderNotifications: true,
  requireDeliveryConfirmation: true,
  allowCustomerCancellation: true,
  riderLocationRefreshSeconds: 15,
  routeOptimization: true,
  riderStatusNotifications: true,
  requireBottleCollectionCount: true,
  autoAssignNearestRider: false,
  featureCustomerOrders: true,
  featureInvoices: true,
  featureRiderTracking: true,
  featureMessaging: true,
  featureInventory: true,
  featureAnalytics: true,
  invoiceDueDays: 7,
  lowStockThreshold: 20,
  orderCutoffTime: '18:00',
  bottleBranding: {
    Gallon: {
      label: 'Himaliya Spring',
      subtitle: 'Pure drinking water · 19L',
      bottleColor: '#8edff2',
      labelColor: '#063b52',
      textColor: '#ffffff',
      capColor: '#0767d8',
      bottleTone: 'ice',
      finish: 'gloss',
      labelShape: 'rounded',
      labelScale: 100,
    },
    'Large Bottle': {
      label: 'Himaliya Spring',
      subtitle: 'Pure drinking water · 1.5L',
      bottleColor: '#b9ecf5',
      labelColor: '#078ead',
      textColor: '#ffffff',
      capColor: '#078ead',
      bottleTone: 'aqua',
      finish: 'gloss',
      labelShape: 'rounded',
      labelScale: 92,
    },
  },
};
