import {
  Drawer, Box, Typography, IconButton, Divider, CircularProgress,
} from '@mui/material';
import { Close } from '@mui/icons-material';
import { BRAND } from '../../config/theme';

/**
 * A right-side slide-out panel for Create / Edit forms.
 *
 * Props:
 *   open     boolean
 *   onClose  () => void
 *   title    string
 *   width    number | string  (default 480)
 *   loading  boolean          (shows spinner instead of children)
 *   children ReactNode
 */
export default function SlidePanel({ open, onClose, title, width = 480, loading = false, children }) {
  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width,
          maxWidth: '95vw',
          display: 'flex',
          flexDirection: 'column',
          borderLeft: `1px solid ${BRAND.borderLight}`,
        },
      }}
    >
      {/* Header */}
      <Box
        sx={{
          px: 3,
          py: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
          borderBottom: `1px solid ${BRAND.borderLight}`,
          bgcolor: BRAND.bgGray,
        }}
      >
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          {title}
        </Typography>
        <IconButton size="small" onClick={onClose}>
          <Close fontSize="small" />
        </IconButton>
      </Box>

      {/* Body */}
      <Box sx={{ flex: 1, overflow: 'auto', px: 3, py: 3 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', pt: 6 }}>
            <CircularProgress />
          </Box>
        ) : (
          children
        )}
      </Box>
    </Drawer>
  );
}
