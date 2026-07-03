import { createTheme, alpha } from '@mui/material/styles';

export const BRAND = {
  red: '#C2181D',
  redLight: '#E53935',
  redDark: '#8B0000',
  redGradient: 'linear-gradient(135deg, #C2181D 0%, #8B0000 100%)',
  green: '#32A94C',
  greenLight: '#3DBF5A',
  greenDark: '#27913A',
  white: '#FFFFFF',
  bgGray: '#F0F2F5',
  bgCard: '#FFFFFF',
  sidebar: '#C2181D',
  sidebarHover: 'rgba(255,255,255,0.09)',
  sidebarActive: 'rgba(255,255,255,0.16)',
  textPrimary: '#0F172A',
  textSecondary: '#64748B',
  borderLight: '#E2E8F0',
  shadow: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)',
  shadowMd: '0 4px 16px rgba(0,0,0,0.10)',
  shadowLg: '0 10px 40px rgba(0,0,0,0.12)',
};

const theme = createTheme({
  palette: {
    primary: {
      main: BRAND.red,
      light: BRAND.redLight,
      dark: BRAND.redDark,
      contrastText: BRAND.white,
    },
    success: {
      main: BRAND.green,
      light: BRAND.greenLight,
      contrastText: BRAND.white,
    },
    warning: {
      main: '#D97706',
      light: '#F59E0B',
      contrastText: BRAND.white,
    },
    info: {
      main: '#0369A1',
      light: '#0EA5E9',
      contrastText: BRAND.white,
    },
    background: {
      default: BRAND.bgGray,
      paper: BRAND.white,
    },
    text: {
      primary: BRAND.textPrimary,
      secondary: BRAND.textSecondary,
    },
    divider: BRAND.borderLight,
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h4: { fontWeight: 700, letterSpacing: '-0.5px' },
    h5: { fontWeight: 700, letterSpacing: '-0.3px' },
    h6: { fontWeight: 600 },
    subtitle1: { fontWeight: 600 },
    subtitle2: { fontWeight: 600 },
    button: { fontWeight: 600, textTransform: 'none' },
  },
  shape: { borderRadius: 10 },
  shadows: [
    'none',
    BRAND.shadow,
    BRAND.shadow,
    BRAND.shadowMd,
    BRAND.shadowMd,
    BRAND.shadowMd,
    BRAND.shadowMd,
    BRAND.shadowMd,
    BRAND.shadowMd,
    BRAND.shadowLg,
    BRAND.shadowLg,
    BRAND.shadowLg,
    BRAND.shadowLg,
    BRAND.shadowLg,
    BRAND.shadowLg,
    BRAND.shadowLg,
    BRAND.shadowLg,
    BRAND.shadowLg,
    BRAND.shadowLg,
    BRAND.shadowLg,
    BRAND.shadowLg,
    BRAND.shadowLg,
    BRAND.shadowLg,
    BRAND.shadowLg,
    BRAND.shadowLg,
  ],
  components: {
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          borderRadius: 14,
          border: `1px solid ${BRAND.borderLight}`,
          transition: 'box-shadow 0.2s ease, transform 0.2s ease',
          '&:hover': { boxShadow: BRAND.shadowMd },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 14,
          border: `1px solid ${BRAND.borderLight}`,
          boxShadow: 'none',
        },
        elevation1: { boxShadow: BRAND.shadow },
        elevation2: { boxShadow: BRAND.shadow },
        elevation3: { boxShadow: BRAND.shadowMd },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          textTransform: 'none',
          fontWeight: 600,
          px: 2.5,
          py: 1,
          transition: 'all 0.2s ease',
        },
        containedPrimary: {
          background: BRAND.redGradient,
          boxShadow: `0 2px 8px ${alpha(BRAND.red, 0.35)}`,
          '&:hover': {
            background: BRAND.redGradient,
            boxShadow: `0 4px 16px ${alpha(BRAND.red, 0.45)}`,
            transform: 'translateY(-1px)',
          },
        },
        outlinedPrimary: {
          borderColor: alpha(BRAND.red, 0.5),
          '&:hover': { borderColor: BRAND.red, bgcolor: alpha(BRAND.red, 0.04) },
        },
        sizeLarge: { px: 3, py: 1.4, fontSize: '0.95rem' },
      },
    },
    MuiTextField: {
      defaultProps: { size: 'small' },
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 8,
            '& fieldset': { borderColor: BRAND.borderLight },
            '&:hover fieldset': { borderColor: '#94A3B8' },
            '&.Mui-focused fieldset': { borderColor: BRAND.red, borderWidth: 2 },
          },
        },
      },
    },
    MuiSelect: {
      styleOverrides: {
        outlined: { borderRadius: 8 },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 600,
          borderRadius: 6,
          fontSize: '0.75rem',
        },
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          '& .MuiTableCell-head': {
            backgroundColor: BRAND.bgGray,
            fontWeight: 600,
            color: BRAND.textSecondary,
            fontSize: '0.75rem',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            borderBottom: `2px solid ${BRAND.borderLight}`,
          },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderColor: BRAND.borderLight,
          padding: '12px 16px',
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          '&:hover': { backgroundColor: alpha(BRAND.red, 0.02) },
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          borderRadius: 0,
          border: 'none',
          boxShadow: 'none',
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          transition: 'all 0.15s ease',
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 16,
          border: 'none',
        },
      },
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: {
          fontSize: '1.1rem',
          fontWeight: 700,
          paddingBottom: 8,
        },
      },
    },
    MuiAccordion: {
      styleOverrides: {
        root: {
          borderRadius: '10px !important',
          '&:before': { display: 'none' },
          border: `1px solid ${BRAND.borderLight}`,
          '&.Mui-expanded': { boxShadow: BRAND.shadowMd },
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: BRAND.textPrimary,
          fontSize: '0.78rem',
          borderRadius: 6,
        },
      },
    },
  },
});

export default theme;
