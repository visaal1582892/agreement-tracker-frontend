import { useEffect, useRef, useState } from 'react';
import { Box, Tooltip } from '@mui/material';

/**
 * Single-line text with ellipsis. Tooltip only when content overflows.
 */
export default function TruncatedText({ title, children, sx, ...props }) {
  const [tooltipEnabled, setTooltipEnabled] = useState(false);

  const handleMouseEnter = (e) => {
    if (e.target.scrollWidth > e.target.clientWidth) {
      setTooltipEnabled(true);
    } else {
      setTooltipEnabled(false);
    }
  };

  const content = (
    <Box
      component="span"
      onMouseEnter={handleMouseEnter}
      sx={{
        display: 'block',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        minWidth: 0,
        ...sx,
      }}
      {...props}
    >
      {children}
    </Box>
  );

  return (
    <Tooltip title={title || ''} arrow placement="top" disableHoverListener={!title || !tooltipEnabled}>
      {content}
    </Tooltip>
  );
}
