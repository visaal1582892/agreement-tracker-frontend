import { Box, Typography } from '@mui/material';
import WizardInfoTooltip from './WizardInfoTooltip';

export default function WizardSectionTitle({
  title,
  info,
  variant = 'h6',
  fontWeight = 600,
  mb = 2,
  sx,
}) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, mb, ...sx }}>
      <Typography variant={variant} fontWeight={fontWeight}>
        {title}
      </Typography>
      <WizardInfoTooltip text={info} />
    </Box>
  );
}
