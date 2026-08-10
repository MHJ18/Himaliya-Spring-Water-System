import React from 'react';
import PropTypes from 'prop-types';
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Collapse,
  FormControl,
  FormHelperText,
  Grid,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  useMediaQuery,
} from '@mui/material';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import ContrastRoundedIcon from '@mui/icons-material/ContrastRounded';
import DashboardCustomizeRoundedIcon from '@mui/icons-material/DashboardCustomizeRounded';
import DarkModeRoundedIcon from '@mui/icons-material/DarkModeRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import FormatSizeRoundedIcon from '@mui/icons-material/FormatSizeRounded';
import TextFieldsRoundedIcon from '@mui/icons-material/TextFieldsRounded';
import LightModeRoundedIcon from '@mui/icons-material/LightModeRounded';
import MapRoundedIcon from '@mui/icons-material/MapRounded';
import MotionPhotosOffRoundedIcon from '@mui/icons-material/MotionPhotosOffRounded';
import PaletteOutlinedIcon from '@mui/icons-material/PaletteOutlined';
import SpaceDashboardRoundedIcon from '@mui/icons-material/SpaceDashboardRounded';
import SettingsBrightnessRoundedIcon from '@mui/icons-material/SettingsBrightnessRounded';
import TableRowsRoundedIcon from '@mui/icons-material/TableRowsRounded';
import TranslateRoundedIcon from '@mui/icons-material/TranslateRounded';
import ViewSidebarRoundedIcon from '@mui/icons-material/ViewSidebarRounded';
import BrandingWatermarkRoundedIcon from '@mui/icons-material/BrandingWatermarkRounded';
import LoginRoundedIcon from '@mui/icons-material/LoginRounded';
import { alpha } from '@mui/material/styles';
import { LayoutGroup, motion, useReducedMotion } from 'motion/react';
import PageShell from '../../components/PageShell/PageShell';
import { useSettings } from '../../context/SettingsContext';
import {
  ADMIN_BACKGROUND_PALETTES,
  ADMIN_FONT_OPTIONS,
  ADMIN_THEME_PRESETS,
  DEFAULT_ADMIN_BACKGROUND,
  DEFAULT_ADMIN_FONT,
  DEFAULT_ADMIN_THEME_PRESET,
  DEFAULT_SETTINGS,
} from '../../data/constants';
import './UtilityPages.css';

function InterfaceCard({
  id, title, subtitle, icon, children, mobile, expanded, onToggle,
}) {
  const contentId = `${id}-settings-content`;
  return (
    <Card className={`settings-card${mobile ? ' settings-card--accordion' : ''}`} sx={{ height: '100%' }}>
      <CardHeader
        component={mobile ? 'button' : 'div'}
        {...(mobile ? {
          type: 'button',
          onClick: onToggle,
          'aria-expanded': expanded,
          'aria-controls': contentId,
        } : {})}
        avatar={(
          <Box sx={(theme) => ({
            display: 'grid',
            width: 36,
            height: 36,
            placeItems: 'center',
            color: 'primary.main',
            bgcolor: alpha(theme.palette.primary.main, 0.11),
            border: '1px solid',
            borderColor: alpha(theme.palette.primary.main, 0.18),
            borderRadius: 2,
          })}
          >
            {icon}
          </Box>
        )}
        title={title}
        subheader={subtitle}
        titleTypographyProps={{ variant: 'h5', sx: { fontWeight: 600 } }}
        subheaderTypographyProps={{ variant: 'body2' }}
        action={mobile ? (
          <ExpandMoreRoundedIcon
            aria-hidden="true"
            sx={{
              color: 'text.secondary',
              transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 200ms ease',
            }}
          />
        ) : undefined}
        sx={{
          width: '100%',
          pb: mobile ? 2 : 1,
          color: 'inherit',
          textAlign: 'left',
          bgcolor: 'transparent',
          border: 0,
          cursor: mobile ? 'pointer' : 'default',
          '& .MuiCardHeader-action': {
            alignSelf: 'center',
            display: 'grid',
            minWidth: 44,
            minHeight: 44,
            m: 0,
            placeItems: 'center',
          },
        }}
      />
      <Collapse in={!mobile || expanded} timeout={220} unmountOnExit={mobile}>
        <CardContent id={contentId} sx={{ pt: 1 }}>{children}</CardContent>
      </Collapse>
    </Card>
  );
}

function InterfaceToggle({
  label, description, checked, onChange, icon,
}) {
  return (
    <Box sx={(theme) => ({
      display: 'flex',
      minHeight: 58,
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 1.25,
      my: 0.6,
      p: 1,
      bgcolor: checked ? alpha(theme.palette.primary.main, 0.09) : 'action.hover',
      border: '1px solid',
      borderColor: checked ? alpha(theme.palette.primary.main, 0.28) : 'divider',
      borderRadius: 2.25,
    })}
    >
      <Stack direction="row" alignItems="center" spacing={1.25} sx={{ minWidth: 0 }}>
        <Box sx={{
          display: 'grid',
          width: 34,
          height: 34,
          flex: '0 0 34px',
          placeItems: 'center',
          color: checked ? 'primary.main' : 'text.secondary',
          bgcolor: 'action.selected',
          borderRadius: 1.75,
          '& svg': { fontSize: 18 },
        }}
        >
          {icon}
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="body2" fontWeight={550}>{label}</Typography>
          <Typography component="p" variant="caption" color="text.secondary">{description}</Typography>
        </Box>
      </Stack>
      <Switch
        checked={Boolean(checked)}
        onChange={onChange}
        inputProps={{ 'aria-label': label }}
      />
    </Box>
  );
}

function ThemePicker({ value, onChange }) {
  const reduceMotion = useReducedMotion();
  const selectedValue = ADMIN_THEME_PRESETS.some((preset) => preset.id === value)
    ? value
    : DEFAULT_ADMIN_THEME_PRESET;

  return (
    <LayoutGroup id="interface-theme-presets">
      <div className="settings-theme-grid" role="radiogroup" aria-label="Interface accent palette">
        {ADMIN_THEME_PRESETS.map((preset) => {
          const selected = preset.id === selectedValue;
          return (
            <motion.button
              key={preset.id}
              type="button"
              role="radio"
              aria-checked={selected}
              className={`settings-theme-card${selected ? ' is-selected' : ''}`}
              style={{
                '--settings-theme-accent': preset.primary,
                '--settings-theme-ring': alpha(preset.primary, 0.17),
              }}
              onClick={() => onChange(preset.id)}
              whileHover={reduceMotion ? undefined : { y: -2 }}
              whileTap={reduceMotion ? undefined : { scale: 0.985 }}
            >
              {selected && (
                <motion.span
                  className="settings-theme-card__selection"
                  layoutId="interface-theme-selection"
                />
              )}
              <span className="settings-theme-card__content">
                <span className="settings-theme-card__topline">
                  <span className="settings-theme-card__swatches" aria-hidden="true">
                    {preset.swatches.map((color) => <i key={color} style={{ background: color }} />)}
                  </span>
                  <span className="settings-theme-card__check" aria-hidden="true">
                    {selected && <CheckRoundedIcon fontSize="small" />}
                  </span>
                </span>
                <strong>{preset.name}</strong>
                <small>{preset.description}</small>
              </span>
            </motion.button>
          );
        })}
      </div>
    </LayoutGroup>
  );
}

// Each card previews the real gradient it applies, so the swatch is a sample
// rather than a decorative chip.
function BackgroundPicker({ value, onChange, darkMode }) {
  const reduceMotion = useReducedMotion();
  const selectedValue = ADMIN_BACKGROUND_PALETTES.some((palette) => palette.id === value)
    ? value
    : DEFAULT_ADMIN_BACKGROUND;

  return (
    <LayoutGroup id="interface-background-palettes">
      <div className="settings-theme-grid" role="radiogroup" aria-label="Page background">
        {ADMIN_BACKGROUND_PALETTES.map((palette) => {
          const selected = palette.id === selectedValue;
          return (
            <motion.button
              key={palette.id}
              type="button"
              role="radio"
              aria-checked={selected}
              className={`settings-theme-card${selected ? ' is-selected' : ''}`}
              style={{
                '--settings-theme-accent': palette.swatches[0],
                '--settings-theme-ring': alpha(palette.swatches[0], 0.17),
              }}
              onClick={() => onChange(palette.id)}
              whileHover={reduceMotion ? undefined : { y: -2 }}
              whileTap={reduceMotion ? undefined : { scale: 0.985 }}
            >
              {selected && (
                <motion.span
                  className="settings-theme-card__selection"
                  layoutId="interface-background-selection"
                />
              )}
              <span className="settings-theme-card__content">
                <span
                  className="settings-background-card__preview"
                  aria-hidden="true"
                  style={{ background: darkMode ? palette.dark : palette.light }}
                />
                <strong>{palette.name}</strong>
                <small>{palette.description}</small>
              </span>
            </motion.button>
          );
        })}
      </div>
    </LayoutGroup>
  );
}

BackgroundPicker.propTypes = {
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  darkMode: PropTypes.bool,
};
BackgroundPicker.defaultProps = { value: DEFAULT_ADMIN_BACKGROUND, darkMode: false };

const SIDEBAR_PALETTES = [
  { id: 'midnight', name: 'Midnight', description: 'Deep black with soft white text', values: { sidebarColor: '#111214', sidebarTextColor: '#e7e9ed' } },
  { id: 'navy', name: 'Navy', description: 'Classic business blue', values: { sidebarColor: '#0d1b2a', sidebarTextColor: '#f4f7fb' } },
  { id: 'slate', name: 'Slate', description: 'Neutral and understated', values: { sidebarColor: '#1e293b', sidebarTextColor: '#f8fafc' } },
  { id: 'forest', name: 'Forest', description: 'Calm green workspace', values: { sidebarColor: '#12372a', sidebarTextColor: '#effcf5' } },
];

const HEADER_PALETTES = [
  { id: 'onyx', name: 'Onyx', description: 'Focused dark header', values: { headerColor: '#08090b', headerTextColor: '#f7f8fa' } },
  { id: 'ocean', name: 'Ocean', description: 'Strong professional blue', values: { headerColor: '#0b4f6c', headerTextColor: '#f5fbff' } },
  { id: 'indigo', name: 'Indigo', description: 'Modern violet navigation', values: { headerColor: '#312e81', headerTextColor: '#f5f3ff' } },
  { id: 'light', name: 'Cloud', description: 'Bright low-contrast surface', values: { headerColor: '#f8fafc', headerTextColor: '#172033' } },
];

const AUTH_PALETTES = [
  { id: 'glacier', name: 'Glacier', description: 'Aqua on deep navy', values: { authAccentColor: '#078ead', authPanelColor: '#071d2a' } },
  { id: 'blue', name: 'Business blue', description: 'Trusted and familiar', values: { authAccentColor: '#2563eb', authPanelColor: '#0f1f3d' } },
  { id: 'emerald', name: 'Emerald', description: 'Fresh and confident', values: { authAccentColor: '#0f9f77', authPanelColor: '#08251f' } },
  { id: 'violet', name: 'Violet', description: 'Premium modern contrast', values: { authAccentColor: '#7c62ff', authPanelColor: '#171332' } },
  { id: 'coral', name: 'Coral', description: 'Warm and welcoming', values: { authAccentColor: '#e66845', authPanelColor: '#321813' } },
];

function selectedFixedPalette(options, settings) {
  const match = options.find((option) => (
    Object.entries(option.values).every(([key, value]) => settings[key] === value)
  ));
  return match ? match.id : '';
}

function FixedPalettePicker({
  label, options, selected, onSelect,
}) {
  return (
    <div className="settings-fixed-palette" role="radiogroup" aria-label={label}>
      {options.map((option) => {
        const checked = option.id === selected;
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={checked}
            className={`settings-fixed-palette__option${checked ? ' is-selected' : ''}`}
            onClick={() => onSelect(option.values)}
          >
            <span className="settings-fixed-palette__swatches" aria-hidden="true">
              {Object.values(option.values).map((color) => (
                <i key={color} style={{ backgroundColor: color }} />
              ))}
            </span>
            <span className="settings-fixed-palette__copy">
              <strong>{option.name}</strong>
              <small>{option.description}</small>
            </span>
            <span className="settings-fixed-palette__check" aria-hidden="true">
              {checked && <CheckRoundedIcon fontSize="small" />}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function DashboardChoice({
  value, selected, title, description, onSelect,
}) {
  return (
    <button
      type="button"
      className={`interface-dashboard-choice${selected ? ' is-selected' : ''}`}
      onClick={() => onSelect(value)}
      aria-pressed={selected}
    >
      <span className={`interface-dashboard-preview is-${value}`} aria-hidden="true">
        <i /><i /><i /><i /><i />
      </span>
      <span>
        <strong>{title}</strong>
        <small>{description}</small>
      </span>
      <CheckRoundedIcon className="interface-dashboard-check" />
    </button>
  );
}

export default function UiSettings() {
  const { settings, resolvedDarkMode, updateSettings } = useSettings();
  const mobile = useMediaQuery((theme) => theme.breakpoints.down('sm'), { noSsr: true });
  // Keep one card open so the page never renders as empty headers.
  const [openMobileCard, setOpenMobileCard] = React.useState('theme');
  const update = (partial) => updateSettings(partial);
  const cardProps = (id) => ({
    id,
    mobile,
    expanded: openMobileCard === id,
    onToggle: () => setOpenMobileCard((current) => (current === id ? null : id)),
  });
  const customizationKeys = [
    'colorTheme', 'dashboardLayout', 'headerColor', 'sidebarColor',
    'sidebarBrandTitle', 'authAccentColor', 'fontScale', 'surfaceStyle',
  ];
  const changedSettings = customizationKeys.filter((key) => (
    JSON.stringify(settings[key]) !== JSON.stringify(DEFAULT_SETTINGS[key])
  )).length;
  const customizationProgress = Math.round((changedSettings / customizationKeys.length) * 100);

  return (
    <PageShell
      title="Interface settings"
      subtitle="Control appearance, navigation, accessibility, language, and dashboard layout"
    >
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Card className="interface-impact-card" sx={{ display: { xs: 'none', md: 'block' } }}>
            <CardContent>
              <Stack
                direction={{ xs: 'column', md: 'row' }}
                alignItems={{ xs: 'stretch', md: 'center' }}
                justifyContent="space-between"
                spacing={2}
              >
                <Box>
                  <Typography variant="overline" color="primary.main">Shared component impact</Typography>
                  <Typography variant="h5">Your interface customization path</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Changes flow through the shell, tables, forms, authentication, and accessibility layer.
                  </Typography>
                </Box>
                <Typography variant="h4" fontWeight={900} color="primary.main">
                  {customizationProgress}%
                </Typography>
              </Stack>
              <LinearProgress variant="determinate" value={customizationProgress} sx={{ mt: 2, height: 7, borderRadius: 999 }} />
              <div className="interface-impact-steps" aria-label="Customization impact sequence">
                {['Theme', 'App shell', 'Forms & tables', 'Accessibility'].map((label, index) => (
                  <span key={label} className={customizationProgress >= ((index + 1) * 25) ? 'is-complete' : ''}>
                    <i>{index + 1}</i>{label}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} xl={7}>
          <InterfaceCard
            {...cardProps('theme')}
            title="Theme and palette"
            subtitle="Choose a comfortable visual foundation for the entire admin app"
            icon={<PaletteOutlinedIcon />}
          >
            <Typography variant="overline" color="text.secondary">Appearance mode</Typography>
            <ToggleButtonGroup
              exclusive
              fullWidth
              value={settings.themeMode || (settings.darkMode ? 'dark' : 'light')}
              onChange={(event, value) => value && update({
                themeMode: value,
                darkMode: value === 'dark',
              })}
              sx={{
                mt: 0.5,
                mb: 2.5,
                '& .MuiToggleButton-root': {
                  minWidth: 0,
                  minHeight: 44,
                  px: { xs: 0.5, sm: 1.5 },
                },
                '& .MuiToggleButton-root .MuiSvgIcon-root': {
                  display: { xs: 'none', sm: 'inline-block' },
                  mr: { xs: 0, sm: 1 },
                },
              }}
            >
              <ToggleButton value="light"><LightModeRoundedIcon sx={{ mr: 1 }} />Light</ToggleButton>
              <ToggleButton value="dark"><DarkModeRoundedIcon sx={{ mr: 1 }} />Dark</ToggleButton>
              <ToggleButton value="system"><SettingsBrightnessRoundedIcon sx={{ mr: 1 }} />System</ToggleButton>
            </ToggleButtonGroup>
            <Typography variant="overline" color="text.secondary">Accent palette</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.25 }}>
              The selected palette also updates dashboard highlights, table headers, buttons, and charts.
            </Typography>
            <ThemePicker
              value={settings.colorTheme}
              onChange={(colorTheme) => update({ colorTheme })}
            />

            <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mt: 2.5 }}>
              Background
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.25 }}>
              Choose a soft gradient wash, including bold multi-colour options. Dark mode uses a matching deep version.
            </Typography>
            <BackgroundPicker
              value={settings.backgroundPalette}
              darkMode={resolvedDarkMode}
              onChange={(backgroundPalette) => update({ backgroundPalette })}
            />
          </InterfaceCard>
        </Grid>

        <Grid item xs={12} xl={5}>
          <InterfaceCard
            {...cardProps('dashboard')}
            title="Dashboard experience"
            subtitle="Switch between the new operations view and the previous dashboard"
            icon={<DashboardCustomizeRoundedIcon />}
          >
            <div className="interface-dashboard-options">
              <DashboardChoice
                value="studio"
                selected={settings.dashboardLayout !== 'classic'}
                title="Studio dashboard"
                description="Dense bento layout with sales, collections, bottle mix, and delivery queue."
                onSelect={(dashboardLayout) => update({ dashboardLayout })}
              />
              <DashboardChoice
                value="classic"
                selected={settings.dashboardLayout === 'classic'}
                title="Classic dashboard"
                description="The previous card, map, chart, and recent-sales layout."
                onSelect={(dashboardLayout) => update({ dashboardLayout })}
              />
            </div>
            <InterfaceToggle
              label="Show customer coverage map"
              description="Controls the map on the Classic dashboard."
              checked={settings.showDashboardMap !== false}
              onChange={(event) => update({ showDashboardMap: event.target.checked })}
              icon={<MapRoundedIcon />}
            />
          </InterfaceCard>
        </Grid>

        <Grid item xs={12} lg={6}>
          <InterfaceCard
            {...cardProps('navigation')}
            title="Navigation and content"
            subtitle="Adapt the workspace structure to the way your team works"
            icon={<ViewSidebarRoundedIcon />}
          >
            <Grid container spacing={2} sx={{ mb: 1 }}>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel id="ui-sidebar-position-label">Sidebar position</InputLabel>
                  <Select
                    labelId="ui-sidebar-position-label"
                    label="Sidebar position"
                    value={settings.sidebarPosition || 'left'}
                    onChange={(event) => update({ sidebarPosition: event.target.value })}
                  >
                    <MenuItem value="left">Left side</MenuItem>
                    <MenuItem value="right">Right side</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel id="ui-sidebar-visibility-label">Sidebar visibility</InputLabel>
                  <Select
                    labelId="ui-sidebar-visibility-label"
                    label="Sidebar visibility"
                    value={settings.sidebarVisibility || 'show'}
                    onChange={(event) => update({ sidebarVisibility: event.target.value })}
                  >
                    <MenuItem value="show">Always show</MenuItem>
                    <MenuItem value="hide">Hide on desktop</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
            <InterfaceToggle
              label="Sticky header"
              description="Keep search, language, messages, and account controls available while scrolling."
              checked={settings.stickyHeader !== false}
              onChange={(event) => update({ stickyHeader: event.target.checked })}
              icon={<SpaceDashboardRoundedIcon />}
            />
            <InterfaceToggle
              label="Show breadcrumbs"
              description="Display the current workspace location above each page."
              checked={settings.showBreadcrumbs !== false}
              onChange={(event) => update({ showBreadcrumbs: event.target.checked })}
              icon={<TableRowsRoundedIcon />}
            />
          </InterfaceCard>
        </Grid>

        <Grid item xs={12} lg={6}>
          <InterfaceCard
            {...cardProps('accessibility')}
            title="Density and accessibility"
            subtitle="Tune reading comfort, motion, and surface contrast"
            icon={<ContrastRoundedIcon />}
          >
            <Grid container spacing={2} sx={{ mb: 1 }}>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel id="ui-font-size-label">Text size</InputLabel>
                  <Select
                    labelId="ui-font-size-label"
                    label="Text size"
                    value={settings.fontScale || 'default'}
                    onChange={(event) => update({ fontScale: event.target.value })}
                    startAdornment={<FormatSizeRoundedIcon sx={{ mr: 1, color: 'text.secondary' }} />}
                  >
                    <MenuItem value="small">Small</MenuItem>
                    <MenuItem value="default">Default</MenuItem>
                    <MenuItem value="large">Large</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel id="ui-font-family-label">Font family</InputLabel>
                  <Select
                    labelId="ui-font-family-label"
                    label="Font family"
                    value={settings.fontFamily || DEFAULT_ADMIN_FONT}
                    onChange={(event) => update({ fontFamily: event.target.value })}
                    startAdornment={<TextFieldsRoundedIcon sx={{ mr: 1, color: 'text.secondary' }} />}
                  >
                    {ADMIN_FONT_OPTIONS.map((option) => (
                      <MenuItem key={option.id} value={option.id} sx={{ fontFamily: option.stack }}>
                        {option.name}
                      </MenuItem>
                    ))}
                  </Select>
                  <FormHelperText>
                    {(ADMIN_FONT_OPTIONS.find((option) => option.id === (settings.fontFamily || DEFAULT_ADMIN_FONT)) || {}).description}
                  </FormHelperText>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel id="ui-surface-style-label">Card style</InputLabel>
                  <Select
                    labelId="ui-surface-style-label"
                    label="Card style"
                    value={settings.surfaceStyle || 'soft'}
                    onChange={(event) => update({ surfaceStyle: event.target.value })}
                  >
                    <MenuItem value="soft">Soft</MenuItem>
                    <MenuItem value="outlined">Outlined</MenuItem>
                    <MenuItem value="elevated">Elevated</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
            <InterfaceToggle
              label="Compact workspace"
              description="Use the extra-small desktop scale to fit even more cards, controls, and table rows."
              checked={Boolean(settings.compactMode)}
              onChange={(event) => update({ compactMode: event.target.checked })}
              icon={<TableRowsRoundedIcon />}
            />
            <InterfaceToggle
              label="Reduce animations"
              description="Use calm fades instead of movement-heavy transitions."
              checked={Boolean(settings.reduceMotion)}
              onChange={(event) => update({ reduceMotion: event.target.checked })}
              icon={<MotionPhotosOffRoundedIcon />}
            />
            <InterfaceToggle
              label="High contrast"
              description="Strengthen muted text, borders, and form guidance."
              checked={Boolean(settings.highContrast)}
              onChange={(event) => update({ highContrast: event.target.checked })}
              icon={<ContrastRoundedIcon />}
            />
          </InterfaceCard>
        </Grid>

        <Grid item xs={12} lg={6}>
          <InterfaceCard
            {...cardProps('app-shell')}
            title="App shell and company title"
            subtitle="Brand the shared sidebar and header used across every admin route"
            icon={<BrandingWatermarkRoundedIcon />}
          >
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Sidebar company title"
                  value={settings.sidebarBrandTitle || ''}
                  onChange={(event) => update({ sidebarBrandTitle: event.target.value })}
                  placeholder="Himaliya Spring"
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Sidebar subtitle"
                  value={settings.sidebarBrandSubtitle || ''}
                  onChange={(event) => update({ sidebarBrandSubtitle: event.target.value })}
                  placeholder="Water operations"
                  fullWidth
                />
              </Grid>
              <Grid item xs={12}>
                <Typography variant="overline" color="text.secondary">Sidebar palette</Typography>
                <FixedPalettePicker
                  label="Sidebar palette"
                  options={SIDEBAR_PALETTES}
                  selected={selectedFixedPalette(SIDEBAR_PALETTES, settings)}
                  onSelect={update}
                />
              </Grid>
              <Grid item xs={12}>
                <Typography variant="overline" color="text.secondary">Header palette</Typography>
                <FixedPalettePicker
                  label="Header palette"
                  options={HEADER_PALETTES}
                  selected={selectedFixedPalette(HEADER_PALETTES, settings)}
                  onSelect={update}
                />
              </Grid>
            </Grid>
          </InterfaceCard>
        </Grid>

        <Grid item xs={12} lg={6}>
          <InterfaceCard
            {...cardProps('authentication')}
            title="Sign-in and sign-up experience"
            subtitle="Control the customer account forms shown outside the admin workspace"
            icon={<LoginRoundedIcon />}
          >
            <Grid container spacing={2} sx={{ mb: 1 }}>
              <Grid item xs={12}>
                <Typography variant="overline" color="text.secondary">Authentication palette</Typography>
                <FixedPalettePicker
                  label="Authentication palette"
                  options={AUTH_PALETTES}
                  selected={selectedFixedPalette(AUTH_PALETTES, settings)}
                  onSelect={update}
                />
              </Grid>
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel id="auth-layout-label">Form layout</InputLabel>
                  <Select
                    labelId="auth-layout-label"
                    label="Form layout"
                    value={settings.authLayout || 'split'}
                    onChange={(event) => update({ authLayout: event.target.value })}
                  >
                    <MenuItem value="split">Business split panel</MenuItem>
                    <MenuItem value="compact">Compact centered form</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
            <InterfaceToggle
              label="Show account benefits"
              description="Display the delivery, invoice, and support highlights next to account forms."
              checked={settings.showLoginStats !== false}
              onChange={(event) => update({ showLoginStats: event.target.checked })}
              icon={<DashboardCustomizeRoundedIcon />}
            />
          </InterfaceCard>
        </Grid>

        <Grid item xs={12}>
          <InterfaceCard
            {...cardProps('language')}
            title="Language"
            subtitle="Set the admin workspace language; the same choice is available in the header"
            icon={<TranslateRoundedIcon />}
          >
            <ToggleButtonGroup
              exclusive
              fullWidth={mobile}
              value={settings.language === 'ur' ? 'ur' : 'en'}
              onChange={(event, language) => language && update({
                language,
                sidebarPosition: language === 'ur' ? 'right' : 'left',
              })}
              aria-label="Admin language"
              sx={{ '& .MuiToggleButton-root': { minHeight: 44 } }}
            >
              <ToggleButton value="en">English</ToggleButton>
              <ToggleButton value="ur">اردو</ToggleButton>
            </ToggleButtonGroup>
          </InterfaceCard>
        </Grid>
      </Grid>
    </PageShell>
  );
}
