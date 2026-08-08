import React from 'react';
import {
  ThemeProvider,
  alpha,
  createTheme,
} from '@mui/material/styles';
import { CssBaseline } from '@mui/material';
import { useDispatch } from 'react-redux';
import { MotionConfig } from 'motion/react';
import { useSettings } from '../context/SettingsContext';
import { getAdminFontStack, getAdminThemePreset } from '../data/constants';
import { changeSidebarPosition, changeSidebarVisibility } from '../actions/navigation';

const coarsePointerTarget = {
  '@media (pointer: coarse)': {
    minHeight: 44,
  },
};

const buildTheme = (darkMode, compactMode, preset, fontStack) => {
  // The accent preset alone only recolours primary/secondary. A pure black and
  // white workspace also needs neutral surfaces, text and dividers, otherwise
  // the blue-tinted defaults leak a hue back in.
  const mono = preset.id === 'monochrome';
  const focusRing = alpha(preset.primary, darkMode ? 0.34 : 0.22);
  const softAccent = alpha(preset.primary, darkMode ? 0.12 : 0.07);
  const selectedAccent = alpha(preset.primary, darkMode ? 0.22 : 0.13);
  const borderAccent = alpha(preset.primary, darkMode ? 0.34 : 0.26);

  return createTheme({
    palette: {
      mode: darkMode ? 'dark' : 'light',
      primary: {
        main: preset.primary,
        light: preset.primaryLight,
        dark: preset.primaryDark,
        contrastText: '#ffffff',
      },
      secondary: {
        main: preset.secondary,
      },
      success: {
        main: '#168d68',
        light: '#50d5a7',
        dark: '#087052',
      },
      warning: {
        main: '#e79519',
      },
      error: {
        main: '#df4962',
        light: '#f27b8e',
        dark: '#b72843',
      },
      info: {
        main: preset.secondary,
      },
      background: darkMode
        ? { default: mono ? '#0b0b0d' : '#06121c', paper: mono ? '#151517' : '#0d202c' }
        : { default: mono ? '#f4f4f5' : '#edf5f7', paper: '#ffffff' },
      text: darkMode
        ? {
          primary: mono ? '#fafafa' : '#f3f8fc',
          secondary: mono ? '#a1a1aa' : '#9fb1c5',
        }
        : {
          primary: mono ? '#18181b' : '#10253a',
          secondary: mono ? '#52525b' : '#5d7085',
        },
      divider: mono
        ? (darkMode ? 'rgba(250, 250, 250, 0.14)' : 'rgba(24, 24, 27, 0.13)')
        : (darkMode ? 'rgba(168, 197, 222, 0.13)' : 'rgba(34, 74, 111, 0.12)'),
    },
    shape: {
      borderRadius: compactMode ? 13 : 16,
    },
    spacing: 8,
    typography: {
      fontFamily: fontStack,
      htmlFontSize: 16,
      fontSize: compactMode ? 12 : 13,
      h1: {
        fontSize: compactMode ? 'clamp(1.2rem, 1.8vw, 1.6rem)' : 'clamp(1.4rem, 2vw, 1.85rem)',
        fontWeight: 780,
        lineHeight: 1.15,
        letterSpacing: '-0.035em',
      },
      h2: {
        fontSize: compactMode ? 'clamp(1.05rem, 1.4vw, 1.28rem)' : 'clamp(1.18rem, 1.6vw, 1.45rem)',
        fontWeight: 760,
        lineHeight: 1.2,
        letterSpacing: '-0.025em',
      },
      h3: { fontSize: compactMode ? '1rem' : '1.08rem', fontWeight: 740, lineHeight: 1.25 },
      h4: { fontSize: compactMode ? '0.91rem' : '0.98rem', fontWeight: 730, lineHeight: 1.3 },
      h5: { fontSize: compactMode ? '0.84rem' : '0.9rem', fontWeight: 730, lineHeight: 1.35 },
      h6: { fontSize: compactMode ? '0.78rem' : '0.82rem', fontWeight: 730, lineHeight: 1.4 },
      subtitle1: { fontSize: compactMode ? '0.82rem' : '0.86rem', lineHeight: 1.45 },
      subtitle2: { fontSize: compactMode ? '0.76rem' : '0.8rem', lineHeight: 1.45 },
      body1: { fontSize: compactMode ? '0.84rem' : '0.875rem', lineHeight: compactMode ? 1.42 : 1.48 },
      body2: { fontSize: compactMode ? '0.77rem' : '0.8125rem', lineHeight: compactMode ? 1.42 : 1.46 },
      caption: { fontSize: compactMode ? '0.7rem' : '0.72rem', lineHeight: 1.42 },
      overline: {
        fontSize: compactMode ? '0.64rem' : '0.67rem',
        fontWeight: 820,
        lineHeight: 1.7,
        letterSpacing: '0.1em',
      },
      button: {
        fontSize: compactMode ? '0.72rem' : '0.76rem',
        fontWeight: 780,
        letterSpacing: 0,
        textTransform: 'none',
      },
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
            minHeight: compactMode ? 30 : 34,
            paddingInline: compactMode ? 10 : 12,
            border: '1px solid transparent',
            borderRadius: compactMode ? 9 : 11,
            fontWeight: 790,
            transition: 'transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease, background 160ms ease',
            ...coarsePointerTarget,
            '&:hover': {
              transform: 'translateY(-1px)',
            },
            '&:active': {
              transform: 'translateY(0) scale(.985)',
            },
            '&:focus-visible': {
              outline: `3px solid ${focusRing}`,
              outlineOffset: 2,
            },
            '@media (prefers-reduced-motion: reduce)': {
              transition: 'none',
            },
          },
          containedPrimary: {
            background: mono
              ? preset.primaryDark
              : `linear-gradient(120deg, ${preset.primaryDark} 0%, ${preset.primary} 58%, ${preset.primaryLight} 145%)`,
            boxShadow: `0 10px 24px ${alpha(preset.primaryDark, darkMode ? 0.3 : 0.22)}`,
            borderColor: alpha(preset.primaryLight, 0.18),
            '&:hover': {
              background: `linear-gradient(120deg, ${preset.primaryDark} -10%, ${preset.primary} 52%, ${preset.primaryLight} 135%)`,
              boxShadow: `0 14px 30px ${alpha(preset.primaryDark, darkMode ? 0.38 : 0.28)}`,
            },
            '&.Mui-disabled': {
              color: darkMode ? 'rgba(229, 248, 252, 0.42)' : 'rgba(255, 255, 255, 0.72)',
              background: darkMode ? 'rgba(109, 162, 174, 0.16)' : '#9bb4bb',
              borderColor: 'transparent',
            },
          },
          containedSuccess: {
            color: '#fff',
            background: 'linear-gradient(120deg, #087052, #159873 62%, #48cfa1 145%)',
            boxShadow: '0 10px 24px rgba(8, 112, 82, 0.22)',
            '&:hover': {
              background: 'linear-gradient(120deg, #075f46, #128667 62%, #41c599 145%)',
              boxShadow: '0 14px 30px rgba(8, 112, 82, 0.28)',
            },
          },
          containedError: {
            color: '#fff',
            background: 'linear-gradient(120deg, #a9233d, #dc3f5b 62%, #f27b8e 145%)',
            boxShadow: '0 10px 24px rgba(183, 40, 67, 0.22)',
            borderColor: 'rgba(255, 190, 201, .18)',
            '&:hover': {
              background: 'linear-gradient(120deg, #951b34, #cb334f 62%, #eb6b80 145%)',
              boxShadow: '0 14px 30px rgba(183, 40, 67, 0.3)',
            },
          },
          outlined: {
            color: darkMode ? preset.primaryLight : preset.primaryDark,
            background: darkMode ? alpha(preset.primary, 0.055) : alpha('#ffffff', 0.7),
            borderColor: borderAccent,
            boxShadow: darkMode ? 'none' : '0 6px 16px rgba(31, 66, 90, .045)',
            '&:hover': {
              borderColor: alpha(preset.primary, 0.5),
              background: softAccent,
            },
          },
          text: {
            color: darkMode ? preset.primaryLight : preset.primaryDark,
            '&:hover': {
              background: softAccent,
            },
          },
          sizeSmall: {
            minHeight: compactMode ? 28 : 30,
            paddingInline: compactMode ? 8 : 9,
            fontSize: compactMode ? '0.69rem' : '0.73rem',
            '@media (pointer: coarse)': {
              minHeight: 40,
            },
          },
        },
      },
      MuiIconButton: {
        styleOverrides: {
          root: {
            width: compactMode ? 30 : 34,
            height: compactMode ? 30 : 34,
            borderRadius: compactMode ? 8 : 10,
            transition: 'transform 160ms ease, color 160ms ease, background 160ms ease',
            '@media (pointer: coarse)': {
              width: 44,
              height: 44,
            },
            '&:hover': {
              color: darkMode ? preset.primaryLight : preset.primaryDark,
              background: softAccent,
              transform: 'translateY(-1px)',
            },
            '&:focus-visible': {
              outline: `3px solid ${focusRing}`,
              outlineOffset: 2,
            },
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          rounded: {
            borderRadius: compactMode ? 13 : 16,
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
            borderRadius: compactMode ? 14 : 17,
            boxShadow: darkMode
              ? '0 20px 55px rgba(0, 0, 0, 0.24)'
              : '0 18px 48px rgba(25, 85, 104, 0.09)',
          }),
        },
      },
      MuiCardHeader: {
        styleOverrides: {
          root: {
            padding: compactMode ? '10px 11px 6px' : '12px 12px 8px',
          },
          avatar: {
            marginRight: compactMode ? 8 : 10,
          },
          title: {
            fontWeight: 820,
            letterSpacing: '-0.018em',
          },
        },
      },
      MuiCardContent: {
        styleOverrides: {
          root: {
            padding: compactMode ? 10 : 12,
            '&:last-child': {
              paddingBottom: compactMode ? 10 : 12,
            },
          },
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
            minHeight: compactMode ? 32 : 36,
            borderRadius: compactMode ? 8 : 10,
            fontSize: compactMode ? '0.77rem' : '0.8125rem',
            // A recessed field reads as somewhere to type rather than a flat
            // outline: tinted surface, hairline inset, lift on focus.
            background: darkMode
              ? 'linear-gradient(180deg, rgba(2, 17, 29, .42), rgba(2, 17, 29, .24))'
              : 'linear-gradient(180deg, rgba(247, 250, 253, .95), rgba(255, 255, 255, .92))',
            boxShadow: darkMode
              ? 'inset 0 1px 2px rgba(0, 0, 0, .3)'
              : 'inset 0 1px 2px rgba(24, 51, 74, .06)',
            transition: 'box-shadow 180ms ease, background 180ms ease, border-color 180ms ease',
            ...coarsePointerTarget,
            '@media (pointer: coarse)': {
              minHeight: 46,
              fontSize: '16px',
            },
            '&:hover:not(.Mui-disabled):not(.Mui-focused) .MuiOutlinedInput-notchedOutline': {
              borderColor: alpha(preset.primary, darkMode ? 0.42 : 0.34),
            },
            '&.Mui-focused': {
              background: darkMode ? 'rgba(3, 22, 36, .55)' : '#fff',
              boxShadow: `0 0 0 3px ${alpha(preset.primary, darkMode ? 0.22 : 0.14)}, 0 1px 2px ${alpha(preset.primaryDark, 0.12)}`,
            },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderWidth: 1,
              borderColor: preset.primary,
            },
            '&.Mui-error.Mui-focused': {
              boxShadow: `0 0 0 3px ${alpha('#df4962', darkMode ? 0.24 : 0.16)}`,
            },
            '&.Mui-disabled': {
              background: darkMode ? 'rgba(2, 17, 29, .2)' : 'rgba(236, 241, 245, .7)',
              boxShadow: 'none',
            },
          },
          input: {
            padding: compactMode ? '6px 8px' : '7px 10px',
            '@media (pointer: coarse)': {
              padding: '11px 13px',
            },
          },
          notchedOutline: {
            borderColor: darkMode ? 'rgba(168, 197, 222, .16)' : 'rgba(34, 74, 111, .16)',
          },
        },
      },
      MuiInputLabel: {
        styleOverrides: {
          root: {
            fontSize: compactMode ? '0.77rem' : '0.8125rem',
            fontWeight: 650,
            '&.Mui-focused': {
              color: darkMode ? preset.primaryLight : preset.primaryDark,
              fontWeight: 750,
            },
          },
        },
      },
      MuiSelect: {
        styleOverrides: {
          icon: {
            transition: 'transform 180ms ease, color 180ms ease',
          },
          iconOpen: {
            color: darkMode ? preset.primaryLight : preset.primary,
          },
        },
      },
      MuiMenu: {
        styleOverrides: {
          paper: {
            marginTop: 4,
            border: `1px solid ${darkMode ? 'rgba(168,197,222,.14)' : 'rgba(34,74,111,.12)'}`,
            borderRadius: compactMode ? 10 : 12,
            boxShadow: darkMode
              ? '0 18px 44px rgba(0, 0, 0, .5)'
              : '0 18px 44px rgba(24, 51, 74, .16)',
          },
        },
      },
      MuiMenuItem: {
        styleOverrides: {
          root: {
            minHeight: compactMode ? 32 : 36,
            borderRadius: 8,
            marginInline: 4,
            fontSize: compactMode ? '0.77rem' : '0.8125rem',
            '&.Mui-selected': {
              background: softAccent,
              fontWeight: 700,
            },
          },
        },
      },
      MuiFormHelperText: {
        styleOverrides: {
          root: {
            marginTop: compactMode ? 3 : 4,
            fontSize: compactMode ? '0.68rem' : '0.7rem',
          },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: {
            padding: compactMode ? '6px 8px' : '7px 10px',
            fontSize: compactMode ? '0.75rem' : '0.78rem',
            borderColor: darkMode ? 'rgba(168, 197, 222, 0.1)' : 'rgba(34, 74, 111, 0.1)',
          },
          head: {
            fontWeight: 780,
            fontSize: compactMode ? '0.7rem' : '0.72rem',
            letterSpacing: '0.055em',
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
            backgroundColor: darkMode ? alpha(preset.primary, 0.055) : alpha(preset.primary, 0.045),
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            height: compactMode ? 23 : 25,
            borderRadius: 999,
            fontSize: compactMode ? '0.68rem' : '0.71rem',
            fontWeight: 770,
            '@media (pointer: coarse)': {
              minHeight: 28,
            },
          },
        },
      },
      MuiTabs: {
        styleOverrides: {
          root: {
            minHeight: compactMode ? 38 : 41,
          },
          indicator: {
            height: 3,
            borderRadius: '3px 3px 0 0',
            boxShadow: `0 0 12px ${alpha(preset.primary, 0.35)}`,
          },
        },
      },
      MuiTab: {
        styleOverrides: {
          root: {
            minHeight: compactMode ? 38 : 41,
            minWidth: 0,
            padding: compactMode ? '5px 8px' : '6px 10px',
            borderRadius: compactMode ? 8 : 10,
            fontSize: compactMode ? '0.7rem' : '0.73rem',
            '@media (pointer: coarse)': {
              minHeight: 44,
            },
            fontWeight: 760,
            textTransform: 'none',
            '&.Mui-selected': {
              color: darkMode ? preset.primaryLight : preset.primaryDark,
              background: softAccent,
            },
            '&:focus-visible': {
              outline: `3px solid ${focusRing}`,
              outlineOffset: -2,
            },
          },
        },
      },
      MuiToggleButton: {
        styleOverrides: {
          root: {
            minHeight: compactMode ? 32 : 36,
            padding: compactMode ? '5px 7px' : '6px 9px',
            color: 'inherit',
            borderColor: darkMode ? 'rgba(168,197,222,.16)' : 'rgba(34,74,111,.14)',
            borderRadius: `${compactMode ? 8 : 10}px !important`,
            fontSize: compactMode ? '0.7rem' : '0.73rem',
            fontWeight: 760,
            textTransform: 'none',
            ...coarsePointerTarget,
            '&.Mui-selected': {
              color: darkMode ? preset.primaryLight : preset.primaryDark,
              background: selectedAccent,
              borderColor: borderAccent,
              boxShadow: `inset 0 0 0 1px ${alpha(preset.primary, 0.1)}`,
            },
            '&.Mui-selected:hover': {
              background: alpha(preset.primary, darkMode ? 0.28 : 0.17),
            },
            '&:focus-visible': {
              zIndex: 1,
              outline: `3px solid ${focusRing}`,
              outlineOffset: 2,
            },
          },
        },
      },
      MuiSwitch: {
        styleOverrides: {
          switchBase: {
            '&.Mui-checked': {
              color: '#fff',
              '& + .MuiSwitch-track': {
                backgroundColor: preset.primary,
                opacity: 1,
              },
            },
            '&.Mui-focusVisible .MuiSwitch-thumb': {
              outline: `3px solid ${focusRing}`,
              outlineOffset: 2,
            },
          },
          track: {
            opacity: 1,
            backgroundColor: darkMode ? 'rgba(168,197,222,.24)' : 'rgba(34,74,111,.22)',
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            overflow: 'hidden',
            backgroundImage: darkMode
              ? `radial-gradient(circle at 100% 0%, ${alpha(preset.primary, 0.13)}, transparent 18rem)`
              : `radial-gradient(circle at 100% 0%, ${alpha(preset.primary, 0.09)}, transparent 18rem)`,
            border: `1px solid ${darkMode ? 'rgba(168,197,222,.16)' : 'rgba(34,74,111,.13)'}`,
            borderRadius: compactMode ? 17 : 20,
            boxShadow: darkMode
              ? '0 30px 90px rgba(0,0,0,.48)'
              : '0 30px 90px rgba(28,65,84,.22)',
            '@media (max-width: 600px)': {
              width: 'calc(100% - 20px)',
              maxWidth: 'none',
              maxHeight: 'calc(100dvh - 20px)',
              margin: 10,
              borderRadius: 16,
            },
          },
        },
      },
      MuiDialogTitle: {
        styleOverrides: {
          root: {
            padding: compactMode ? '14px 15px 8px' : '17px 18px 9px',
            fontWeight: 840,
            letterSpacing: '-0.025em',
          },
        },
      },
      MuiDialogContent: {
        styleOverrides: {
          root: {
            padding: compactMode ? '8px 15px 13px' : '10px 18px 16px',
          },
        },
      },
      MuiDialogActions: {
        styleOverrides: {
          root: {
            gap: 8,
            padding: compactMode ? '10px 15px 14px' : '12px 18px 17px',
            borderTop: `1px solid ${darkMode ? 'rgba(168,197,222,.1)' : 'rgba(34,74,111,.09)'}`,
            '@media (max-width: 600px)': {
              alignItems: 'stretch',
              flexDirection: 'column',
              padding: '10px 12px calc(12px + env(safe-area-inset-bottom, 0px))',
              '& > :not(style)': {
                width: '100%',
                margin: 0,
              },
            },
          },
        },
      },
      MuiAlert: {
        styleOverrides: {
          // Form feedback has to read as a distinct notification rather than
          // another line of body copy, so every severity gets a tinted
          // surface, a matching border and a leading accent bar instead of
          // MUI's very pale default wash.
          root: {
            position: 'relative',
            alignItems: 'flex-start',
            overflow: 'hidden',
            paddingBlock: compactMode ? 8 : 10,
            paddingInline: compactMode ? 12 : 14,
            paddingInlineStart: compactMode ? 16 : 18,
            border: '1px solid',
            borderRadius: compactMode ? 9 : 11,
            fontSize: compactMode ? '0.74rem' : '0.78rem',
            fontWeight: 650,
            lineHeight: 1.5,
            '&::before': {
              position: 'absolute',
              insetInlineStart: 0,
              insetBlock: 0,
              width: 4,
              content: '""',
              background: 'currentColor',
              opacity: 0.85,
            },
            '& .MuiAlert-icon': {
              paddingTop: 2,
              opacity: 1,
            },
            '& .MuiAlert-message': {
              minWidth: 0,
              paddingBlock: 0,
              overflowWrap: 'anywhere',
            },
          },
          standardError: {
            color: darkMode ? '#ffd7de' : '#8d1c33',
            backgroundColor: alpha('#df4962', darkMode ? 0.18 : 0.1),
            borderColor: alpha('#df4962', darkMode ? 0.42 : 0.3),
            '& .MuiAlert-icon': { color: darkMode ? '#ff8fa3' : '#c62a48' },
          },
          standardWarning: {
            color: darkMode ? '#ffe6bd' : '#7a4a06',
            backgroundColor: alpha('#e79519', darkMode ? 0.18 : 0.12),
            borderColor: alpha('#e79519', darkMode ? 0.42 : 0.32),
            '& .MuiAlert-icon': { color: darkMode ? '#ffbe5c' : '#b9740f' },
          },
          standardSuccess: {
            color: darkMode ? '#b6f5dc' : '#0a5b43',
            backgroundColor: alpha('#168d68', darkMode ? 0.2 : 0.1),
            borderColor: alpha('#168d68', darkMode ? 0.42 : 0.3),
            '& .MuiAlert-icon': { color: darkMode ? '#5fdcb0' : '#0f7a58' },
          },
          standardInfo: {
            color: darkMode ? '#dcf1ff' : preset.primaryDark,
            backgroundColor: alpha(preset.primary, darkMode ? 0.18 : 0.1),
            borderColor: alpha(preset.primary, darkMode ? 0.42 : 0.3),
            '& .MuiAlert-icon': { color: darkMode ? preset.primaryLight : preset.primary },
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
  });
};

export default function AppThemeProvider({ children }) {
  const { settings, resolvedDarkMode } = useSettings();
  const dispatch = useDispatch();
  const preset = getAdminThemePreset(settings.colorTheme);
  const fontStack = getAdminFontStack(settings.fontFamily);
  const theme = React.useMemo(
    () => buildTheme(resolvedDarkMode, Boolean(settings.compactMode), preset, fontStack),
    [fontStack, preset, resolvedDarkMode, settings.compactMode]
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
