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

// Background palettes. `theme` keeps whatever the accent preset supplies; the
// rest override the page background only, so they compose with any accent.
// `effect` drives an optional animated overlay layer (see _dark-mode.scss).
export const ADMIN_BACKGROUND_PALETTES = [
  {
    id: 'theme',
    name: 'Match accent',
    description: 'Follow the accent palette',
    effect: 'none',
    swatches: ['#078ead', '#63d7e8', '#f4f8fb'],
  },
  {
    id: 'aurora',
    name: 'Aurora',
    description: 'Drifting colour bloom',
    effect: 'aurora',
    swatches: ['#7c5ac8', '#29c9e8', '#f6f4ff'],
    light: 'radial-gradient(circle at 12% 0%, rgba(124, 90, 200, 0.18), transparent 30rem), radial-gradient(circle at 88% 10%, rgba(41, 201, 232, 0.16), transparent 28rem), linear-gradient(140deg, #fbfaff 0%, #eef3ff 52%, #f2fbfd 100%)',
    dark: 'radial-gradient(circle at 12% 0%, rgba(124, 90, 200, 0.3), transparent 30rem), radial-gradient(circle at 88% 10%, rgba(41, 201, 232, 0.2), transparent 28rem), linear-gradient(140deg, #0a0a16 0%, #0d1428 52%, #07131c 100%)',
  },
  {
    id: 'mesh',
    name: 'Mesh',
    description: 'Soft four-point colour mesh',
    effect: 'mesh',
    swatches: ['#f5a06f', '#68a3ff', '#fff7f2'],
    light: 'radial-gradient(at 0% 0%, rgba(245, 160, 111, 0.2), transparent 45%), radial-gradient(at 100% 0%, rgba(104, 163, 255, 0.18), transparent 45%), radial-gradient(at 0% 100%, rgba(74, 203, 146, 0.14), transparent 45%), radial-gradient(at 100% 100%, rgba(170, 124, 243, 0.16), transparent 45%), #fdfbf9',
    dark: 'radial-gradient(at 0% 0%, rgba(245, 160, 111, 0.2), transparent 45%), radial-gradient(at 100% 0%, rgba(104, 163, 255, 0.2), transparent 45%), radial-gradient(at 0% 100%, rgba(74, 203, 146, 0.14), transparent 45%), radial-gradient(at 100% 100%, rgba(170, 124, 243, 0.18), transparent 45%), #0a0c12',
  },
  {
    id: 'dawn',
    name: 'Dawn',
    description: 'Warm horizon wash',
    effect: 'glow',
    swatches: ['#dc643b', '#bd3f77', '#fff6f1'],
    light: 'radial-gradient(circle at 50% -10%, rgba(220, 100, 59, 0.16), transparent 26rem), linear-gradient(180deg, #fff7f3 0%, #fdeee9 46%, #f7f2fb 100%)',
    dark: 'radial-gradient(circle at 50% -10%, rgba(220, 100, 59, 0.24), transparent 26rem), linear-gradient(180deg, #150c0a 0%, #170f16 46%, #0b0910 100%)',
  },
  {
    id: 'grid',
    name: 'Blueprint',
    description: 'Technical grid with a cool wash',
    effect: 'grid',
    swatches: ['#2563eb', '#0891b2', '#f2f6fc'],
    light: 'linear-gradient(rgba(37, 99, 235, 0.05) 1px, transparent 1px) 0 0 / 3rem 3rem, linear-gradient(90deg, rgba(37, 99, 235, 0.05) 1px, transparent 1px) 0 0 / 3rem 3rem, linear-gradient(150deg, #f6f9ff 0%, #eef4fb 100%)',
    dark: 'linear-gradient(rgba(96, 165, 250, 0.07) 1px, transparent 1px) 0 0 / 3rem 3rem, linear-gradient(90deg, rgba(96, 165, 250, 0.07) 1px, transparent 1px) 0 0 / 3rem 3rem, linear-gradient(150deg, #060c16 0%, #050a12 100%)',
  },
  {
    id: 'paper',
    name: 'Paper',
    description: 'Flat neutral, no colour cast',
    effect: 'none',
    swatches: ['#e4e4e7', '#a1a1aa', '#ffffff'],
    light: 'linear-gradient(180deg, #ffffff 0%, #f4f4f5 100%)',
    dark: 'linear-gradient(180deg, #0b0b0d 0%, #141416 100%)',
  },
  // Light-first palettes. Their dark values stay deliberately deep so the
  // option still behaves if someone switches the workspace to dark mode.
  {
    id: 'porcelain',
    name: 'Porcelain',
    description: 'Soft white with a cool edge',
    effect: 'none',
    swatches: ['#ffffff', '#f1f5f9', '#e2e8f0'],
    light: 'radial-gradient(circle at 20% 0%, rgba(148, 187, 233, 0.14), transparent 30rem), linear-gradient(165deg, #ffffff 0%, #f6f9fc 55%, #eef3f8 100%)',
    dark: 'linear-gradient(165deg, #0e1116 0%, #141922 100%)',
  },
  {
    id: 'cream',
    name: 'Warm cream',
    description: 'Soft paper warmth, easy on the eyes',
    effect: 'glow',
    swatches: ['#fdf8f0', '#f5e9d7', '#e8d5b7'],
    light: 'radial-gradient(circle at 78% 4%, rgba(230, 190, 138, 0.2), transparent 28rem), linear-gradient(165deg, #fffdf9 0%, #fbf4e9 52%, #f5ecdc 100%)',
    dark: 'linear-gradient(165deg, #171310 0%, #1e1813 100%)',
  },
  {
    id: 'mist',
    name: 'Light grey',
    description: 'Neutral grey with a gentle lift',
    effect: 'none',
    swatches: ['#fafafa', '#ededf0', '#dcdce1'],
    light: 'linear-gradient(165deg, #fcfcfd 0%, #f2f2f5 50%, #e8e8ed 100%)',
    dark: 'linear-gradient(165deg, #101012 0%, #17171a 100%)',
  },
  {
    id: 'sage',
    name: 'Sage',
    description: 'Pale green, calm and low contrast',
    effect: 'aurora',
    swatches: ['#f4f9f4', '#dcece0', '#c3ddcb'],
    light: 'radial-gradient(circle at 14% 2%, rgba(120, 180, 140, 0.16), transparent 28rem), linear-gradient(165deg, #fbfefb 0%, #f0f7f1 54%, #e6f0e8 100%)',
    dark: 'linear-gradient(165deg, #0d1310 0%, #121a15 100%)',
  },
  {
    id: 'blush',
    name: 'Blush',
    description: 'Warm pink-white, soft and bright',
    effect: 'glow',
    swatches: ['#fff7f7', '#fbe9e9', '#f3d5d5'],
    light: 'radial-gradient(circle at 82% 0%, rgba(232, 160, 170, 0.18), transparent 28rem), linear-gradient(165deg, #fffbfb 0%, #fdf1f2 52%, #f8e6e8 100%)',
    dark: 'linear-gradient(165deg, #170f11 0%, #1e1417 100%)',
  },
];

export const DEFAULT_ADMIN_BACKGROUND = 'theme';

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
