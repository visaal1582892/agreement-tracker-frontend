import { useEffect, useRef, useState } from 'react';
import { Box, Tooltip } from '@mui/material';

/**
 * Single-line text with ellipsis. Tooltip only when content overflows.
 */
export default function TruncatedText({ title, children, sx, ...props }) {
  const ref = useRef(null);
  const [overflow, setOverflow] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;

    const check = () => setOverflow(el.scrollWidth > el.clientWidth);
    check();

    const observer = new ResizeObserver(check);
    observer.observe(el);
    return () => observer.disconnect();
  }, [children, title]);

  const content = (
    <Box
      ref={ref}
      component="span"
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

  if (!title || !overflow) return content;

  return (
    <Tooltip title={title} arrow placement="top">
      {content}
    </Tooltip>
  );
}
