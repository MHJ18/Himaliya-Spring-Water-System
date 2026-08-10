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
  {
    id: 'monochrome',
    name: 'Monochrome',
    // Neutral greys only. The primary sits dark enough to clear 4.5:1 against
    // white for button and link text in light mode.
    description: 'Black and white with neutral grey accents',
    primary: '#3f3f46',
    primaryLight: '#a1a1aa',
    primaryDark: '#18181b',
    secondary: '#71717a',
    swatches: ['#18181b', '#a1a1aa', '#71717a'],
  },
];

// Interface font choices. Jakarta, Source Sans 3 and Barlow are already
// fetched by the font link in index.html; system and mono need no network at
// all, so switching between these never costs an extra request.
export const ADMIN_FONT_OPTIONS = [
  {
    id: 'jakarta',
    name: 'Plus Jakarta Sans',
    description: 'The default — geometric and friendly',
    stack: '"Plus Jakarta Sans", "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  },
  {
    id: 'system',
    name: 'System UI',
    description: 'Matches the operating system, loads instantly',
    stack: 'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  },
  {
    id: 'source',
    name: 'Source Sans 3',
    description: 'Neutral and highly legible at small sizes',
    stack: '"Source Sans 3", "Segoe UI", system-ui, sans-serif',
  },
  {
    id: 'condensed',
    name: 'Barlow Condensed',
    description: 'Narrow — fits more into dense tables',
    stack: '"Barlow Semi Condensed", "Arial Narrow", "Segoe UI", sans-serif',
  },
  {
    id: 'mono',
    name: 'Monospace',
    description: 'Fixed width, best for numeric records',
    stack: 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Courier New", monospace',
  },
];

// A deliberately small set of quiet workspace gradients. Backgrounds stay
// independent from the accent theme, so users can pair any of these with any
// button/chart colour without introducing another strong visual layer.
export const ADMIN_BACKGROUND_PALETTES = [
  // Light values carry a visible multi-stop gradient plus two radial accents.
  // Cards sit on `background.paper`, so a tinted page behind them reads as
  // depth rather than noise, and the tints stay light enough to keep dark
  // body text well past the 4.5:1 contrast floor.
  {
    id: 'sky',
    name: 'Sky mist',
    description: 'Blue gradient wash with a bright horizon',
    effect: 'none',
    swatches: ['#3d86e8', '#9cc6ff', '#e4efff'],
    light: 'radial-gradient(circle at 84% -10%, rgba(78, 150, 255, 0.42), transparent 32rem), radial-gradient(circle at 4% 104%, rgba(120, 190, 255, 0.32), transparent 30rem), linear-gradient(145deg, #eef5ff 0%, #dcebff 46%, #cbe0ff 100%)',
    dark: 'radial-gradient(circle at 84% -10%, rgba(78, 139, 222, 0.24), transparent 30rem), radial-gradient(circle at 4% 104%, rgba(52, 108, 190, 0.2), transparent 28rem), linear-gradient(145deg, #07111f 0%, #0b1728 52%, #081220 100%)',
  },
  {
    id: 'aqua',
    name: 'Aqua breeze',
    description: 'Teal-to-mint gradient with a cool finish',
    effect: 'none',
    swatches: ['#17a89a', '#7fdccf', '#dcf5f0'],
    light: 'radial-gradient(circle at 12% -8%, rgba(38, 199, 181, 0.4), transparent 31rem), radial-gradient(circle at 94% 104%, rgba(86, 205, 232, 0.3), transparent 29rem), linear-gradient(145deg, #e8faf6 0%, #d3f1eb 48%, #c9ecf4 100%)',
    dark: 'radial-gradient(circle at 12% -8%, rgba(45, 176, 162, 0.22), transparent 29rem), radial-gradient(circle at 94% 104%, rgba(48, 150, 180, 0.18), transparent 28rem), linear-gradient(145deg, #071410 0%, #081b1a 50%, #081621 100%)',
  },
  {
    id: 'lavender',
    name: 'Lavender haze',
    description: 'Violet into blue with a soft glow',
    effect: 'none',
    swatches: ['#7c5cf0', '#b9a6ff', '#e9e2ff'],
    light: 'radial-gradient(circle at 86% -10%, rgba(134, 104, 250, 0.38), transparent 31rem), radial-gradient(circle at 2% 104%, rgba(180, 150, 255, 0.32), transparent 29rem), linear-gradient(145deg, #f3eeff 0%, #e6dcff 48%, #d8e5ff 100%)',
    dark: 'radial-gradient(circle at 86% -10%, rgba(139, 119, 230, 0.24), transparent 29rem), radial-gradient(circle at 2% 104%, rgba(110, 92, 200, 0.2), transparent 28rem), linear-gradient(145deg, #100d1b 0%, #151329 50%, #0d1422 100%)',
  },
  // Multi-hue washes — three distinct colours blended in one gradient,
  // rather than the light-to-dark tint of a single hue used above.
  {
    id: 'aurora',
    name: 'Aurora',
    description: 'Teal, violet, and pink in one soft blend',
    effect: 'none',
    swatches: ['#14b8a6', '#8b5cf6', '#ec4899'],
    light: 'radial-gradient(circle at 10% -10%, rgba(20, 184, 166, 0.38), transparent 30rem), radial-gradient(circle at 50% 42%, rgba(139, 92, 246, 0.22), transparent 34rem), radial-gradient(circle at 94% 106%, rgba(236, 72, 153, 0.34), transparent 29rem), linear-gradient(150deg, #eafcf8 0%, #eee8ff 50%, #ffe7f3 100%)',
    dark: 'radial-gradient(circle at 10% -10%, rgba(20, 150, 140, 0.22), transparent 28rem), radial-gradient(circle at 50% 42%, rgba(120, 90, 220, 0.16), transparent 32rem), radial-gradient(circle at 94% 106%, rgba(200, 60, 130, 0.18), transparent 27rem), linear-gradient(150deg, #08120f 0%, #100e1c 50%, #190f16 100%)',
  },
  {
    id: 'citrus',
    name: 'Citrus dawn',
    description: 'Green, amber, and orange rising together',
    effect: 'none',
    swatches: ['#22c55e', '#eab308', '#f97316'],
    light: 'radial-gradient(circle at 8% -10%, rgba(34, 197, 94, 0.36), transparent 30rem), radial-gradient(circle at 50% 42%, rgba(234, 179, 8, 0.26), transparent 33rem), radial-gradient(circle at 96% 104%, rgba(249, 115, 22, 0.34), transparent 29rem), linear-gradient(150deg, #eafcef 0%, #fff8e1 50%, #fff0e0 100%)',
    dark: 'radial-gradient(circle at 8% -10%, rgba(34, 170, 90, 0.2), transparent 28rem), radial-gradient(circle at 50% 42%, rgba(200, 150, 10, 0.16), transparent 31rem), radial-gradient(circle at 96% 104%, rgba(220, 100, 20, 0.2), transparent 27rem), linear-gradient(150deg, #0a140c 0%, #171208 50%, #1a1008 100%)',
  },
  {
    id: 'meadow',
    name: 'Fresh meadow',
    description: 'Spring green rising into lime',
    effect: 'none',
    swatches: ['#3ba55d', '#8fd99a', '#dcf3dd'],
    light: 'radial-gradient(circle at 10% -10%, rgba(64, 190, 110, 0.4), transparent 31rem), radial-gradient(circle at 95% 104%, rgba(158, 220, 110, 0.34), transparent 29rem), linear-gradient(145deg, #eefaef 0%, #dcf2e0 48%, #e2f5d6 100%)',
    dark: 'radial-gradient(circle at 10% -10%, rgba(58, 160, 96, 0.24), transparent 29rem), radial-gradient(circle at 95% 104%, rgba(120, 176, 80, 0.18), transparent 28rem), linear-gradient(145deg, #08150d 0%, #0c1c12 50%, #0b1a0e 100%)',
  },
  {
    id: 'twilight',
    name: 'Deep twilight',
    description: 'Indigo and magenta for a rich desk',
    effect: 'none',
    swatches: ['#5b4bd6', '#a07af0', '#e0d9ff'],
    light: 'radial-gradient(circle at 92% -12%, rgba(120, 88, 240, 0.42), transparent 32rem), radial-gradient(circle at 0% 100%, rgba(228, 110, 200, 0.32), transparent 30rem), linear-gradient(150deg, #eeeaff 0%, #ded6ff 44%, #f0dcf6 100%)',
    dark: 'radial-gradient(circle at 92% -12%, rgba(108, 82, 220, 0.28), transparent 30rem), radial-gradient(circle at 0% 100%, rgba(190, 84, 168, 0.2), transparent 28rem), linear-gradient(150deg, #0d0a1c 0%, #150f2b 50%, #1a0f24 100%)',
  },
  {
    id: 'slate',
    name: 'Graphite',
    description: 'Neutral grey gradient, minimal and calm',
    effect: 'none',
    swatches: ['#5c6b7a', '#a8b6c4', '#e3e8ee'],
    light: 'radial-gradient(circle at 80% -10%, rgba(104, 128, 152, 0.28), transparent 31rem), radial-gradient(circle at 4% 104%, rgba(140, 160, 182, 0.24), transparent 29rem), linear-gradient(145deg, #f2f5f8 0%, #e4eaf0 48%, #dae2ea 100%)',
    dark: 'radial-gradient(circle at 80% -10%, rgba(96, 118, 142, 0.2), transparent 29rem), radial-gradient(circle at 4% 104%, rgba(70, 88, 108, 0.18), transparent 28rem), linear-gradient(145deg, #0d1014 0%, #141922 50%, #101419 100%)',
  },
];

export const DEFAULT_ADMIN_BACKGROUND = 'sky';

export function getAdminBackgroundPalette(value) {
  return ADMIN_BACKGROUND_PALETTES.find((palette) => palette.id === value)
    || ADMIN_BACKGROUND_PALETTES[0];
}

export const DEFAULT_ADMIN_FONT = 'jakarta';

export function getAdminFontStack(value) {
  const match = ADMIN_FONT_OPTIONS.find((option) => option.id === value);
  return (match || ADMIN_FONT_OPTIONS[0]).stack;
}

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
  fontFamily: DEFAULT_ADMIN_FONT,
  backgroundPalette: DEFAULT_ADMIN_BACKGROUND,
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
  // Notification delivery. These gate which events raise a device notification;
  // the in-app notification center always records everything regardless.
  pushNotificationsEnabled: true,
  notifyNewOrders: true,
  notifyDeliveryUpdates: true,
  notifyPayments: true,
  notifyLowStock: true,
  notifyOverdueInvoices: true,
  quietHoursEnabled: false,
  quietHoursStart: '22:00',
  quietHoursEnd: '07:00',
  // Regional formatting. Currency and dates used to be hard-coded to en-PK/PKR
  // in utils/formatters, which made the app unusable for any other market.
  currencyCode: 'PKR',
  regionLocale: 'en-PK',
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
