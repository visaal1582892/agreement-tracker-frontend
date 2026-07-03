import { IconButton, Tooltip } from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

export default function WizardInfoTooltip({ text, iconSize = 16, placement = 'top' }) {
  if (!text) return null;

  return (
    <Tooltip title={text} arrow placement={placement}>
      <IconButton
        size="small"
        aria-label="More information"
        sx={{
          color: '#64748B',
          p: 0.25,
          ml: 0.25,
          '&:hover': { bgcolor: 'transparent', color: '#475569' },
        }}
      >
        <InfoOutlinedIcon sx={{ fontSize: iconSize }} />
      </IconButton>
    </Tooltip>
  );
}
