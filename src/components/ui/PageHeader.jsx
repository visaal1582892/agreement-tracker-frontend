import { Box, Typography, Button, Breadcrumbs, Link as MuiLink } from '@mui/material';
import { Add, NavigateNext } from '@mui/icons-material';
import { BRAND } from '../../config/theme';

export default function PageHeader({ title, subtitle, action, actionLabel = 'New', onAction, breadcrumbs }) {
  return (
    <Box sx={{ mb: 3 }}>
      {breadcrumbs && (
        <Breadcrumbs separator={<NavigateNext fontSize="small" />} sx={{ mb: 1 }}>
          {breadcrumbs.map((crumb, i) => (
            i < breadcrumbs.length - 1 ? (
              <MuiLink key={crumb.label} href={crumb.path} underline="hover" sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>
                {crumb.label}
              </MuiLink>
            ) : (
              <Typography key={crumb.label} sx={{ fontSize: '0.8rem', color: 'text.primary', fontWeight: 500 }}>
                {crumb.label}
              </Typography>
            )
          ))}
        </Breadcrumbs>
      )}

      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="h5" sx={{ color: BRAND.textPrimary, lineHeight: 1.2 }}>
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.4 }}>
              {subtitle}
            </Typography>
          )}
        </Box>
        {(action || onAction) && (
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={onAction || action}
            sx={{ px: 2.5, py: 1, borderRadius: 2, whiteSpace: 'nowrap' }}
          >
            {actionLabel}
          </Button>
        )}
      </Box>
    </Box>
  );
}
