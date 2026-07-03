import { Box, Chip, Tooltip, Typography } from '@mui/material';

export default function TruncatedInlineList({
  items = [],
  maxVisible = 3,
  emptyLabel = '—',
}) {
  if (!items.length) {
    return <Typography variant="body2" fontWeight={500}>{emptyLabel}</Typography>;
  }

  const visible = items.slice(0, maxVisible);
  const hidden = items.slice(maxVisible);

  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, alignItems: 'center' }}>
      {visible.map((item) => (
        <Chip key={item} label={item} size="small" variant="outlined" />
      ))}
      {hidden.length > 0 && (
        <Tooltip
          title={(
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, py: 0.25 }}>
              {hidden.map((item) => (
                <Typography key={item} variant="caption">{item}</Typography>
              ))}
            </Box>
          )}
          arrow
          placement="top"
        >
          <Chip label={`+${hidden.length}`} size="small" sx={{ cursor: 'default' }} />
        </Tooltip>
      )}
    </Box>
  );
}
