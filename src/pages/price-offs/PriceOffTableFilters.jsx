import React from 'react';
import { Autocomplete, Box, CircularProgress, MenuItem, TableCell, TableContainer, TextField, Typography } from '@mui/material';
import {
  HORIZONTAL_SCROLL_CONTAINER_SX,
  HORIZONTAL_SCROLL_TABLE_SX,
  columnCellSx,
} from '../../components/ui/tableStandards';

export const STICKY_CHECKBOX_WIDTH = 68;

export const STICKY_CHECKBOX_CENTER_SX = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '100%',
  minHeight: '100%',
};

export const STICKY_CHECKBOX_HEADER_SX = {
  position: 'sticky',
  left: 0,
  zIndex: 6,
  width: STICKY_CHECKBOX_WIDTH,
  minWidth: STICKY_CHECKBOX_WIDTH,
  maxWidth: STICKY_CHECKBOX_WIDTH,
  boxSizing: 'border-box',
  p: 0,
  textAlign: 'center',
  verticalAlign: 'middle',
  overflow: 'visible',
  bgcolor: 'background.paper',
  borderRight: '1px solid',
  borderColor: 'divider',
};

export const STICKY_CHECKBOX_BODY_SX = {
  position: 'sticky',
  left: 0,
  bgcolor: 'background.paper',
  zIndex: 2,
  width: STICKY_CHECKBOX_WIDTH,
  minWidth: STICKY_CHECKBOX_WIDTH,
  maxWidth: STICKY_CHECKBOX_WIDTH,
  boxSizing: 'border-box',
  p: 0,
  textAlign: 'center',
  verticalAlign: 'middle',
  overflow: 'visible',
  borderRight: '1px solid',
  borderColor: 'divider',
};

export const TABLE_SCROLL_SX = {
  ...HORIZONTAL_SCROLL_CONTAINER_SX,
  maxHeight: 'calc(100vh - 320px)',
  minHeight: 220,
};

export const TABLE_WRAPPER_SX = {
  display: 'flex',
  flexDirection: 'column',
  width: '100%',
  overflow: 'hidden',
};

export const TABLE_BODY_OVERLAY_SX = {
  position: 'absolute',
  left: 0,
  right: 0,
  bottom: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  pointerEvents: 'none',
  color: 'text.secondary',
  zIndex: 1,
};

export const TABLE_LOADING_OVERLAY_SX = {
  ...TABLE_BODY_OVERLAY_SX,
  top: 0,
  bgcolor: 'background.paper',
};

export const TABLE_EMPTY_OVERLAY_SX = {
  ...TABLE_BODY_OVERLAY_SX,
  top: 92,
  bgcolor: 'transparent',
};

export const TABLE_PAGINATION_SX = {
  flexShrink: 0,
  borderTop: '1px solid',
  borderColor: 'divider',
  bgcolor: 'background.paper',
  '& .MuiTablePagination-toolbar': {
    justifyContent: 'flex-end',
    minHeight: 48,
    px: 2,
  },
};

export const TABLE_SX = HORIZONTAL_SCROLL_TABLE_SX;

export const HEADER_CELL_SX = {
  bgcolor: 'background.paper',
  verticalAlign: 'top',
  whiteSpace: 'nowrap',
  px: 1,
  py: 1,
  top: 0,
  zIndex: 2,
  overflow: 'hidden',
};

export const FILTER_HEADER_CELL_SX = {
  bgcolor: 'background.paper',
  verticalAlign: 'top',
  whiteSpace: 'normal',
  overflow: 'hidden',
  px: 1,
  py: 1,
  top: 0,
  zIndex: 2,
};

export function filterHeaderCellSx(width) {
  return {
    ...FILTER_HEADER_CELL_SX,
    ...columnCellSx(width),
  };
}

export function headerCellSx(width, { flex = false } = {}) {
  return {
    ...HEADER_CELL_SX,
    ...columnCellSx(width, { flex }),
  };
}

const DATA_CELL_BASE = {
  whiteSpace: 'nowrap',
  fontSize: '0.8rem',
  px: 1,
  overflow: 'hidden',
};

export function dataCellSx(width, { flex = false } = {}) {
  return {
    ...DATA_CELL_BASE,
    ...columnCellSx(width, { flex }),
  };
}

/** @deprecated use dataCellSx(width) — kept for gradual migration */
export const DATA_CELL_SX = DATA_CELL_BASE;

export function filterHeaderFlexCellSx(minWidth) {
  return {
    ...FILTER_HEADER_CELL_SX,
    ...columnCellSx(minWidth, { flex: true }),
  };
}

const FILTER_FIELD_SX = {
  width: '100%',
  minWidth: 0,
  '& .MuiInputBase-root': { fontSize: '0.72rem', minHeight: 30 },
};

export function StickyCheckboxCell({ header = false, children, onClick }) {
  return (
    <TableCell sx={header ? STICKY_CHECKBOX_HEADER_SX : STICKY_CHECKBOX_BODY_SX} onClick={onClick}>
      <Box sx={STICKY_CHECKBOX_CENTER_SX}>
        {children}
      </Box>
    </TableCell>
  );
}

export function HeaderLabel({ children }) {
  return (
    <Typography variant="caption" fontWeight={700} display="block" lineHeight={1.2}>
      {children}
    </Typography>
  );
}

export function HeaderFilterStack({ label, sortLabel, children }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, width: '100%', minWidth: 0 }}>
      {sortLabel || <HeaderLabel>{label}</HeaderLabel>}
      <Box sx={{ width: '100%', minWidth: 0 }}>{children}</Box>
    </Box>
  );
}

export function HeaderTextFilter({ placeholder, value, onChange }) {
  return (
    <TextField
      size="small"
      fullWidth
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      sx={FILTER_FIELD_SX}
    />
  );
}

export function HeaderSelectFilter({ value, onChange, options }) {
  return (
    <TextField
      select
      size="small"
      fullWidth
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      sx={FILTER_FIELD_SX}
    >
      {options.map((option) => (
        <MenuItem key={option.value || 'ALL'} value={option.value} sx={{ fontSize: '0.8rem' }}>
          {option.label}
        </MenuItem>
      ))}
    </TextField>
  );
}

export function HeaderMasterFilter({ options, value, onChange, placeholder = 'Search…' }) {
  const selected = options.find((option) => option.value === value) ?? null;
  return (
    <Autocomplete
      size="small"
      fullWidth
      options={options}
      value={selected}
      onChange={(_, option) => onChange(option?.value ?? '')}
      getOptionLabel={(option) => option.label}
      isOptionEqualToValue={(a, b) => a.value === b.value}
      renderInput={(params) => <TextField {...params} placeholder={placeholder} />}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      sx={FILTER_FIELD_SX}
    />
  );
}

export function PriceOffTableShell({ loading, empty, emptyMessage, pagination, children }) {
  return (
    <Box sx={TABLE_WRAPPER_SX}>
      <Box sx={{ position: 'relative', flex: 1, minHeight: 0 }}>
        <TableContainer sx={TABLE_SCROLL_SX}>
          {children}
        </TableContainer>
        {loading && (
          <Box sx={TABLE_LOADING_OVERLAY_SX}>
            <CircularProgress size={24} />
          </Box>
        )}
        {!loading && empty && (
          <Box sx={TABLE_EMPTY_OVERLAY_SX}>
            <Typography variant="body2">{emptyMessage}</Typography>
          </Box>
        )}
      </Box>
      {pagination}
    </Box>
  );
}
