import { alpha } from '@mui/material/styles';

/**
 * Shared form styling for the admin pages.
 *
 * Compact inputs (42px) with a soft tinted fill that lifts to paper on
 * focus, and a two-layer focus ring (halo + crisp border) so focus is
 * obvious without relying on colour alone.
 */

export const FIELD_HEIGHT = 42;

export const modernFormSx = (theme) => {
  const primary = theme.palette.primary.main;
  const isDark = theme.palette.mode === 'dark';

  return {
    '& .MuiOutlinedInput-root': {
      minHeight: FIELD_HEIGHT,
      borderRadius: 1.5,
      backgroundColor: isDark
        ? alpha(theme.palette.common.white, 0.04)
        : alpha(theme.palette.primary.main, 0.035),
      transition: 'background-color 180ms ease, box-shadow 180ms ease',
      '& .MuiOutlinedInput-notchedOutline': {
        borderColor: alpha(theme.palette.divider, isDark ? 0.6 : 0.9),
        transition: 'border-color 180ms ease',
      },
      '&:hover:not(.Mui-disabled) .MuiOutlinedInput-notchedOutline': {
        borderColor: alpha(primary, 0.45),
      },
      '&.Mui-focused': {
        backgroundColor: theme.palette.background.paper,
        boxShadow: `0 0 0 4px ${alpha(primary, isDark ? 0.22 : 0.14)}`,
        '& .MuiOutlinedInput-notchedOutline': {
          borderWidth: 1.5,
          borderColor: primary,
        },
      },
      '&.Mui-error': {
        backgroundColor: alpha(theme.palette.error.main, isDark ? 0.1 : 0.045),
        '&.Mui-focused': {
          boxShadow: `0 0 0 4px ${alpha(theme.palette.error.main, 0.16)}`,
        },
      },
    },
    '& .MuiOutlinedInput-input, & .MuiSelect-select': {
      paddingTop: '9px',
      paddingBottom: '9px',
      fontSize: '0.87rem',
      fontWeight: 500,
      lineHeight: 1.45,
    },
    '& .MuiInputBase-multiline': {
      paddingTop: '5px',
      paddingBottom: '5px',
    },
    '& .MuiInputBase-input::placeholder': {
      color: theme.palette.text.secondary,
      fontSize: '0.8rem',
      fontWeight: 400,
      opacity: 0.6,
    },
    '& .MuiInputLabel-root': {
      fontSize: '0.85rem',
      fontWeight: 600,
      '&.Mui-focused': { fontWeight: 700 },
    },
    '& .MuiInputAdornment-root': {
      color: theme.palette.text.secondary,
      '& .MuiSvgIcon-root': { fontSize: 18 },
    },
    '& .Mui-focused .MuiInputAdornment-root': {
      color: primary,
    },
    '& .MuiFormHelperText-root': {
      marginLeft: '2px',
      marginTop: '6px',
      fontSize: '0.75rem',
      fontWeight: 500,
      lineHeight: 1.35,
    },
  };
};

/** Card surface for a form panel — soft depth, no heavy borders. */
export const modernPanelSx = (theme) => ({
  overflow: 'hidden',
  border: '1px solid',
  borderColor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.18 : 0.12),
  borderRadius: 2,
  backgroundColor: theme.palette.background.paper,
  boxShadow:
    theme.palette.mode === 'dark'
      ? '0 24px 64px rgba(0, 0, 0, .42)'
      : '0 22px 60px rgba(4, 18, 43, .1)',
});

/** Gradient header band used at the top of a form card. */
export const modernFormHeaderSx = (theme) => ({
  position: 'relative',
  overflow: 'hidden',
  px: { xs: 2.5, sm: 3 },
  py: { xs: 2.25, sm: 2.75 },
  color: theme.palette.common.white,
  background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
  '&::after': {
    position: 'absolute',
    top: -70,
    right: -40,
    width: 190,
    height: 190,
    background: `radial-gradient(circle, ${alpha(theme.palette.common.white, 0.22)}, transparent 68%)`,
    borderRadius: '50%',
    pointerEvents: 'none',
    content: '""',
  },
});

/** Small uppercase caption that groups a set of fields into a section. */
export const formSectionLabelSx = (theme) => ({
  display: 'block',
  mb: 1.25,
  color: theme.palette.text.secondary,
  fontSize: '0.68rem',
  fontWeight: 800,
  letterSpacing: '0.11em',
  textTransform: 'uppercase',
});

/** Primary submit button with the brand gradient. */
export const modernSubmitSx = (theme) => ({
  minHeight: 42,
  borderRadius: 1.5,
  fontSize: '0.88rem',
  fontWeight: 700,
  letterSpacing: '0.01em',
  textTransform: 'none',
  color: theme.palette.common.white,
  background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
  boxShadow: `0 6px 16px ${alpha(theme.palette.primary.main, 0.28)}`,
  transition: 'filter 180ms ease, box-shadow 180ms ease',
  '&:hover': {
    filter: 'brightness(1.07)',
    boxShadow: `0 8px 20px ${alpha(theme.palette.primary.main, 0.34)}`,
  },
  '&.Mui-disabled': {
    color: alpha(theme.palette.common.white, 0.8),
    background: alpha(theme.palette.primary.main, 0.42),
    boxShadow: 'none',
  },
});
