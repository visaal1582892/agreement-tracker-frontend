import { useState } from 'react';
import { Box, Button, Popover, Typography, IconButton } from '@mui/material';
import { Clear } from '@mui/icons-material';
import { DateCalendar, PickerDay } from '@mui/x-date-pickers';
import { BRAND } from '../../config/theme';
import dayjs from 'dayjs';

function toIso(value) {
  return value?.isValid?.() ? value.format('YYYY-MM-DD') : '';
}

function CustomPickersDay(props) {
  const { day, from, to, ...other } = props;

  const isStart = from?.isValid() && day.isSame(from, 'day');
  const isEnd = to?.isValid() && day.isSame(to, 'day');
  const isSelected = isStart || isEnd;
  const isBetween = from?.isValid() && to?.isValid() && day.isAfter(from, 'day') && day.isBefore(to, 'day');

  return (
    <Box
      sx={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        ...(isBetween && {
          backgroundColor: `${BRAND.red}1A`,
        }),
        ...(isStart && to && !isEnd && {
          borderTopLeftRadius: '50%',
          borderBottomLeftRadius: '50%',
          backgroundColor: `${BRAND.red}1A`,
        }),
        ...(isEnd && from && !isStart && {
          borderTopRightRadius: '50%',
          borderBottomRightRadius: '50%',
          backgroundColor: `${BRAND.red}1A`,
        }),
      }}
    >
      <PickerDay
        {...other}
        day={day}
        selected={isSelected}
        sx={{
          ...(isSelected && {
            backgroundColor: `${BRAND.red} !important`,
            color: 'white',
          }),
          ...(isBetween && {
            backgroundColor: 'transparent !important',
            color: 'inherit',
          }),
        }}
      />
    </Box>
  );
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
            slots={{ day: CustomPickersDay }}
            slotProps={{
              day: { from, to },
            }}
          />
        </Box>
      </Popover>
    </>
  );
}
