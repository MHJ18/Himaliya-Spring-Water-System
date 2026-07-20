import React from 'react';
import { ThemeProvider, createTheme, responsiveFontSizes } from '@mui/material/styles';
import { CssBaseline, useMediaQuery } from '@mui/material';
import { useDispatch } from 'react-redux';
import { MotionConfig } from 'framer-motion';
import { useSettings } from '../context/SettingsContext';
import { changeSidebarPosition, changeSidebarVisibility } from '../actions/navigation';

const buildTheme = (darkMode, compactMode) => responsiveFontSizes(createTheme({
  palette: {
    mode: darkMode ? 'dark' : 'light',
    primary: {
      main: '#078ead',
      light: '#6addec',
      dark: '#05677f',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#405fd2',
    },
    success: {
      main: '#20b486',
    },
    warning: {
      main: '#f5a524',
    },
    error: {
      main: '#ef5b72',
    },
    background: darkMode
      ? { default: '#06121c', paper: '#0d202c' }
      : { default: '#edf5f7', paper: '#ffffff' },
    text: darkMode
      ? { primary: '#f3f8fc', secondary: '#9fb1c5' }
      : { primary: '#10253a', secondary: '#5d7085' },
    divider: darkMode ? 'rgba(168, 197, 222, 0.13)' : 'rgba(34, 74, 111, 0.12)',
  },
  shape: {
    borderRadius: 16,
  },
  spacing: 8,
  typography: {
    fontFamily: '"Plus Jakarta Sans", "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    htmlFontSize: 16,
    fontSize: 14,
    h1: { fontSize: 'clamp(1.65rem, 2.2vw, 2.25rem)', fontWeight: 750, lineHeight: 1.15 },
    h2: { fontSize: 'clamp(1.35rem, 1.8vw, 1.75rem)', fontWeight: 720, lineHeight: 1.2 },
    h3: { fontSize: '1.25rem', fontWeight: 700, lineHeight: 1.25 },
    h4: { fontSize: '1.1rem', fontWeight: 700, lineHeight: 1.3 },
    h5: { fontSize: '1rem', fontWeight: 700, lineHeight: 1.35 },
    h6: { fontSize: '0.9rem', fontWeight: 700, lineHeight: 1.4 },
    body1: { fontSize: compactMode ? '0.875rem' : '0.9375rem', lineHeight: 1.55 },
    body2: { fontSize: compactMode ? '0.8125rem' : '0.875rem', lineHeight: 1.5 },
    button: { fontWeight: 700, letterSpacing: 0, textTransform: 'none' },
  },
  components: {
    MuiButtonBase: {
      defaultProps: {
        disableRipple: false,
      },
      styleOverrides: {
        root: {
          touchAction: 'manipulation',
        },
      },
    },
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
      styleOverrides: {
        root: {
          minHeight: 44,
          paddingInline: 20,
          borderRadius: 999,
          fontWeight: 780,
          transition: 'transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease, background 160ms ease',
          '&:hover': {
            transform: 'translateY(-1px)',
          },
          '&:active': {
            transform: 'translateY(0)',
          },
          '&:focus-visible': {
            outline: '3px solid rgba(8, 160, 190, 0.22)',
            outlineOffset: 2,
          },
          '@media (prefers-reduced-motion: reduce)': {
            transition: 'none',
          },
        },
        containedPrimary: {
          background: 'linear-gradient(110deg, #076f8d 0%, #08a8bc 100%)',
          boxShadow: '0 12px 28px rgba(6, 130, 155, 0.2)',
          border: '1px solid rgba(136, 232, 244, 0.16)',
          '&:hover': {
            background: 'linear-gradient(110deg, #086a84 0%, #079db1 100%)',
            boxShadow: '0 16px 34px rgba(6, 130, 155, 0.27)',
          },
          '&.Mui-disabled': {
            color: darkMode ? 'rgba(229, 248, 252, 0.45)' : 'rgba(255, 255, 255, 0.66)',
            background: darkMode ? 'rgba(109, 162, 174, 0.18)' : '#9ebdc4',
          },
        },
        containedSuccess: {
          color: '#fff',
          background: 'linear-gradient(110deg, #087859, #18a67d)',
          boxShadow: '0 11px 25px rgba(20, 151, 111, 0.18)',
          '&:hover': {
            background: 'linear-gradient(110deg, #076d51, #139671)',
            boxShadow: '0 15px 31px rgba(20, 151, 111, 0.24)',
          },
        },
        outlined: {
          borderWidth: 1,
          '&:hover': {
            borderWidth: 1,
            background: darkMode ? 'rgba(95, 208, 224, 0.08)' : 'rgba(7, 142, 173, 0.06)',
          },
        },
        sizeSmall: {
          minHeight: 36,
          paddingInline: 14,
          fontSize: '0.76rem',
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          width: 44,
          height: 44,
          borderRadius: 14,
          transition: 'transform 160ms ease, background 160ms ease',
          '&:hover': {
            transform: 'translateY(-1px)',
          },
          '&:focus-visible': {
            outline: '3px solid rgba(8, 160, 190, 0.2)',
            outlineOffset: 2,
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        rounded: {
          borderRadius: 20,
        },
      },
    },
    MuiCard: {
      defaultProps: {
        elevation: 0,
      },
      styleOverrides: {
        root: ({ theme }) => ({
          border: `1px solid ${theme.palette.divider}`,
          backgroundImage: 'none',
          borderRadius: 22,
          boxShadow: darkMode
            ? '0 20px 55px rgba(0, 0, 0, 0.24)'
            : '0 18px 48px rgba(25, 85, 104, 0.09)',
        }),
      },
    },
    MuiTextField: {
      defaultProps: {
        size: compactMode ? 'small' : 'medium',
        variant: 'outlined',
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          minHeight: 46,
          borderRadius: 14,
          transition: 'box-shadow 160ms ease, background 160ms ease',
          '&.Mui-focused': {
            boxShadow: '0 0 0 4px rgba(8, 160, 190, 0.09)',
          },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          padding: compactMode ? '9px 12px' : '13px 16px',
          borderColor: darkMode ? 'rgba(168, 197, 222, 0.1)' : 'rgba(34, 74, 111, 0.1)',
        },
        head: {
          fontWeight: 750,
          fontSize: '0.68rem',
          letterSpacing: '0.055em',
          textTransform: 'uppercase',
          whiteSpace: 'nowrap',
          backgroundColor: darkMode ? 'rgba(103, 190, 208, 0.055)' : '#f1f8f9',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 999,
          fontWeight: 750,
        },
      },
    },
    MuiCardHeader: {
      styleOverrides: {
        root: {
          padding: '20px 20px 15px',
        },
        title: {
          fontWeight: 800,
          letterSpacing: '-0.015em',
        },
      },
    },
    MuiTooltip: {
      defaultProps: {
        arrow: true,
        enterDelay: 450,
      },
    },
  },
}));

export default function AppThemeProvider({ children }) {
  const { settings } = useSettings();
  const dispatch = useDispatch();
  const prefersDark = useMediaQuery('(prefers-color-scheme: dark)');
  const modePreference = settings.themeMode || (settings.darkMode ? 'dark' : 'light');
  const darkMode = modePreference === 'system' ? prefersDark : modePreference === 'dark';
  const theme = React.useMemo(
    () => buildTheme(darkMode, Boolean(settings.compactMode)),
    [darkMode, settings.compactMode]
  );

  React.useEffect(() => {
    dispatch(changeSidebarPosition(settings.sidebarPosition || 'left'));
    dispatch(changeSidebarVisibility(settings.sidebarVisibility || 'show'));
  }, [dispatch, settings.sidebarPosition, settings.sidebarVisibility]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <MotionConfig reducedMotion={settings.reduceMotion ? 'always' : 'user'}>
        {children}
      </MotionConfig>
    </ThemeProvider>
  );
}
