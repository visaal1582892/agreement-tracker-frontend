import { useEffect, useState } from 'react';
import { Paper, Box, Typography, Collapse, IconButton } from '@mui/material';
import { ExpandMore } from '@mui/icons-material';
import { BRAND } from '../../config/theme';
import WizardInfoTooltip from './WizardInfoTooltip';

export default function CollapsibleSection({
  title,
  tooltipText,
  description,
  defaultExpanded = false,
  forceExpand = false,
  hasError = false,
  children,
  sx,
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const info = tooltipText ?? description;
  const showError = hasError || forceExpand;

  useEffect(() => {
    if (forceExpand) setExpanded(true);
  }, [forceExpand]);

  const toggle = () => setExpanded((prev) => !prev);

  return (
    <Paper
      elevation={0}
      sx={{
        p: 2.5,
        borderRadius: 2.5,
        border: `1px solid ${showError ? BRAND.red : BRAND.borderLight}`,
        bgcolor: BRAND.white,
        mb: 3,
        ...sx,
      }}
    >
      <Box
        role="button"
        tabIndex={0}
        onClick={toggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggle();
          }
        }}
        aria-expanded={expanded}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, flex: 1, minWidth: 0 }}>
          <Typography
            sx={{
              fontSize: '0.9375rem',
              fontWeight: 700,
              color: showError ? BRAND.red : BRAND.textPrimary,
            }}
          >
            {title}
          </Typography>
          <Box onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
            <WizardInfoTooltip text={info} iconSize={15} />
          </Box>
        </Box>
        <IconButton
          size="small"
          aria-hidden
          tabIndex={-1}
          sx={{
            color: showError ? BRAND.red : BRAND.textSecondary,
            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease',
            pointerEvents: 'none',
          }}
        >
          <ExpandMore fontSize="small" />
        </IconButton>
      </Box>

      <Collapse in={expanded} timeout="auto" unmountOnExit={false}>
        <Box sx={{ pt: 2 }}>{children}</Box>
      </Collapse>
    </Paper>
  );
}
