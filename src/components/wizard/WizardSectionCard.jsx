import { Paper, Typography, Box } from '@mui/material';
import { BRAND } from '../../config/theme';
import WizardInfoTooltip from './WizardInfoTooltip';

export default function WizardSectionCard({
  title,
  description,
  children,
  sx,
}) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 2.5,
        borderRadius: 2.5,
        border: `1px solid ${BRAND.borderLight}`,
        bgcolor: BRAND.white,
        mb: 3,
        ...sx,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, mb: 2 }}>
        <Typography sx={{ fontSize: '0.9375rem', fontWeight: 700, color: BRAND.textPrimary }}>
          {title}
        </Typography>
        <WizardInfoTooltip text={description} iconSize={15} />
      </Box>
      <Box>{children}</Box>
    </Paper>
  );
}
