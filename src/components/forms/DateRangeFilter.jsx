import { useState } from 'react';
import { Box, Button, Popover, Typography, IconButton } from '@mui/material';
import { Clear } from '@mui/icons-material';
import { DateCalendar } from '@mui/x-date-pickers/DateCalendar';
import dayjs from 'dayjs';

function toIso(value) {
  return value?.isValid?.() ? value.format('YYYY-MM-DD') : '';
}

export default function DateRangeFilter({
  fromKey,
  toKey,
  filters,
  onFilterChange,
  label = 'Date range',
}) {
  const [anchor, setAnchor] = useState(null);
  const [selectingEnd, setSelectingEnd] = useState(false);

  const from = filters[fromKey] ? dayjs(filters[fromKey]) : null;
  const to = filters[toKey] ? dayjs(filters[toKey]) : null;

  const display = (() => {
    if (from?.isValid() && to?.isValid()) {
      return `${from.format('DD MMM YYYY')} – ${to.format('DD MMM YYYY')}`;
    }
    if (from?.isValid()) return `From ${from.format('DD MMM YYYY')}`;
    if (to?.isValid()) return `Until ${to.format('DD MMM YYYY')}`;
    return label;
  })();

  const handleDaySelect = (value) => {
    if (!value?.isValid()) return;

    if (!selectingEnd) {
      onFilterChange(fromKey, toIso(value));
      if (to?.isValid() && value.isAfter(to, 'day')) {
        onFilterChange(toKey, '');
      }
      setSelectingEnd(true);
      return;
    }

    const start = from?.isValid() ? from : value;
    if (value.isBefore(start, 'day')) {
      onFilterChange(fromKey, toIso(value));
      onFilterChange(toKey, toIso(start));
    } else {
      onFilterChange(fromKey, toIso(start));
      onFilterChange(toKey, toIso(value));
    }
    setSelectingEnd(false);
    setAnchor(null);
  };

  const handleClear = (event) => {
    event.stopPropagation();
    onFilterChange(fromKey, '');
    onFilterChange(toKey, '');
    setSelectingEnd(false);
  };

  const openPicker = (event) => {
    setAnchor(event.currentTarget);
    setSelectingEnd(Boolean(from?.isValid()));
  };

  return (
    <>
      <Button
        size="small"
        variant="outlined"
        onClick={openPicker}
        sx={{
          fontSize: '0.72rem',
          textTransform: 'none',
          width: '100%',
          justifyContent: 'space-between',
          px: 1,
          color: 'text.secondary',
          borderColor: '#E2E8F0',
        }}
      >
        <Typography variant="caption" noWrap sx={{ textAlign: 'left', flex: 1 }}>
          {display}
        </Typography>
        {(from || to) && (
          <IconButton size="small" onClick={handleClear} sx={{ ml: 0.5, p: 0.25 }}>
            <Clear sx={{ fontSize: 14 }} />
          </IconButton>
        )}
      </Button>
      <Popover
        open={Boolean(anchor)}
        anchorEl={anchor}
        onClose={() => {
          setAnchor(null);
          setSelectingEnd(false);
        }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Box sx={{ p: 1.5, minWidth: 280 }}>
          <Typography variant="caption" color="text.secondary" sx={{ px: 1, display: 'block', mb: 0.5 }}>
            {selectingEnd ? 'Select end date' : 'Select start date'}
          </Typography>
          <DateCalendar
            value={selectingEnd ? (to?.isValid() ? to : null) : (from?.isValid() ? from : null)}
            onChange={handleDaySelect}
          />
        </Box>
      </Popover>
    </>
  );
}
