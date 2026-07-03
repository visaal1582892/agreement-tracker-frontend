import { useEffect, useState } from 'react';
import { Box, FormControl, Grid, InputBase, InputLabel, Typography } from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import { BRAND } from '../../config/theme';
import { formatLocalDateString } from '../../utils/dateUtils';

dayjs.extend(customParseFormat);

const DATE_FORMAT = 'DD/MM/YYYY';

const toDay = (d) => dayjs(d).startOf('day');

const parseTenureInput = (value) => {
  if (value === '' || value == null) return 0;
  const parsed = parseInt(String(value), 10);
  return Number.isNaN(parsed) || parsed < 0 ? 0 : parsed;
};

const hasAnyTenure = (years, months, days) =>
  parseTenureInput(years) > 0 || parseTenureInput(months) > 0 || parseTenureInput(days) > 0;

/** Decompose date span into whole years, remaining months, remaining days. */
export function calculateTenureFromDates(startDate, expiryDate) {
  const start = toDay(startDate);
  const expiry = toDay(expiryDate);
  if (!start.isValid() || !expiry.isValid() || !expiry.isAfter(start)) {
    return { years: 0, months: 0, days: 0 };
  }

  const years = expiry.diff(start, 'year');
  let anchor = start.add(years, 'year');

  const months = expiry.diff(anchor, 'month');
  anchor = anchor.add(months, 'month');

  const days = expiry.diff(anchor, 'day');

  return { years, months, days };
}

/** Add Y/M/D tenure to start date → expiry (exclusive span: expiry strictly after start). */
export function calculateExpiryFromTenure(startDate, tenureYears, tenureMonths, tenureDays) {
  const start = toDay(startDate);
  if (!start.isValid()) return null;

  const years = parseTenureInput(tenureYears);
  const months = parseTenureInput(tenureMonths);
  const days = parseTenureInput(tenureDays);

  if (years === 0 && months === 0 && days === 0) return null;

  const expiry = start.add(years, 'year').add(months, 'month').add(days, 'day');
  return expiry.isAfter(start) ? expiry : null;
}

export function formatTenureFromDates(startDate, expiryDate) {
  const { years, months, days } = calculateTenureFromDates(startDate, expiryDate);
  if (years === 0 && months === 0 && days === 0) return '';

  const parts = [];
  if (years > 0) parts.push(`${years} Year${years !== 1 ? 's' : ''}`);
  if (months > 0) parts.push(`${months} Month${months !== 1 ? 's' : ''}`);
  if (days > 0) parts.push(`${days} Day${days !== 1 ? 's' : ''}`);
  return parts.join(', ');
}

function tenureToFields({ years, months, days }) {
  return {
    tenureYears: years > 0 ? String(years) : '',
    tenureMonths: months > 0 ? String(months) : '',
    tenureDays: days > 0 ? String(days) : '',
  };
}

const TENURE_SEGMENTS = [
  { key: 'years', label: 'Years' },
  { key: 'months', label: 'Months' },
  { key: 'days', label: 'Days' },
];

const unifiedTenureWrapperSx = {
  display: 'flex',
  alignItems: 'stretch',
  height: 40,
  border: `1px solid ${BRAND.borderLight}`,
  borderRadius: '4px',
  bgcolor: BRAND.white,
  overflow: 'hidden',
  transition: 'border-color 0.15s ease',
  '&:hover': {
    borderColor: '#94A3B8',
  },
  '&:focus-within': {
    borderColor: BRAND.red,
    borderWidth: 2,
  },
};

const tenureSegmentSx = {
  flex: 1,
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  px: 0.5,
  borderLeft: `1px solid ${BRAND.borderLight}`,
  '&:first-of-type': {
    borderLeft: 'none',
  },
};

const tenureInputSx = {
  width: '100%',
  fontSize: '0.875rem',
  fontWeight: 500,
  textAlign: 'center',
  lineHeight: 1.2,
  '& input': {
    textAlign: 'center',
    p: 0,
    MozAppearance: 'textfield',
  },
  '& input::-webkit-outer-spin-button, & input::-webkit-inner-spin-button': {
    WebkitAppearance: 'none',
    margin: 0,
  },
};

const datePickerSlotProps = {
  textField: {
    fullWidth: true,
    size: 'small',
  },
};

export default function DateRangeFields({ startDate, expiryDate, onChange, disabled = false }) {
  const [tenureYears, setTenureYears] = useState('');
  const [tenureMonths, setTenureMonths] = useState('');
  const [tenureDays, setTenureDays] = useState('');

  const tenureValues = { years: tenureYears, months: tenureMonths, days: tenureDays };

  const emit = (patch) => {
    onChange({
      startDate: patch.startDate !== undefined ? patch.startDate : (startDate ?? null),
      expiryDate: patch.expiryDate !== undefined ? patch.expiryDate : (expiryDate ?? null),
    });
  };

  const toLocalDate = (d) => {
    if (!d) return null;
    const parsed = dayjs.isDayjs(d) ? d : dayjs(d);
    return parsed.isValid() ? formatLocalDateString(parsed) : null;
  };

  const applyTenureFields = (fields) => {
    setTenureYears(fields.tenureYears ?? '');
    setTenureMonths(fields.tenureMonths ?? '');
    setTenureDays(fields.tenureDays ?? '');
  };

  const syncTenureFromDates = (nextStart, nextExpiry) => {
    if (nextStart && nextExpiry) {
      applyTenureFields(tenureToFields(calculateTenureFromDates(nextStart, nextExpiry)));
      return;
    }
    applyTenureFields({ tenureYears: '', tenureMonths: '', tenureDays: '' });
  };

  // Edit-mode rehydration + keep tenure in sync when dates change externally.
  useEffect(() => {
    syncTenureFromDates(startDate, expiryDate);
  }, [startDate, expiryDate]);

  const computeExpiryDate = (nextStartDate, years, months, days) => {
    const nextExpiry = calculateExpiryFromTenure(nextStartDate, years, months, days);
    return nextExpiry ? toLocalDate(nextExpiry) : null;
  };

  const handleStartChange = (date) => {
    const nextStart = date ? date.startOf('day') : null;
    if (!nextStart?.isValid()) {
      applyTenureFields({ tenureYears: '', tenureMonths: '', tenureDays: '' });
      emit({ startDate: null, expiryDate: null });
      return;
    }

    const nextStartDate = toLocalDate(nextStart);

    if (hasAnyTenure(tenureYears, tenureMonths, tenureDays)) {
      emit({
        startDate: nextStartDate,
        expiryDate: computeExpiryDate(nextStartDate, tenureYears, tenureMonths, tenureDays),
      });
      return;
    }

    if (expiryDate) {
      if (!toDay(expiryDate).isAfter(nextStart)) {
        applyTenureFields({ tenureYears: '', tenureMonths: '', tenureDays: '' });
        emit({ startDate: nextStartDate, expiryDate: null });
        return;
      }
      emit({ startDate: nextStartDate });
      return;
    }

    emit({ startDate: nextStartDate });
  };

  const handleTenureChange = (field, rawValue) => {
    const sanitized = rawValue === '' ? '' : String(Math.max(0, parseTenureInput(rawValue)));

    const nextYears = field === 'years' ? sanitized : tenureYears;
    const nextMonths = field === 'months' ? sanitized : tenureMonths;
    const nextDays = field === 'days' ? sanitized : tenureDays;

    if (field === 'years') setTenureYears(sanitized);
    if (field === 'months') setTenureMonths(sanitized);
    if (field === 'days') setTenureDays(sanitized);

    if (!startDate) return;

    if (!hasAnyTenure(nextYears, nextMonths, nextDays)) {
      emit({ expiryDate: null });
      return;
    }

    emit({ expiryDate: computeExpiryDate(startDate, nextYears, nextMonths, nextDays) });
  };

  const handleExpiryChange = (date) => {
    const nextExpiry = date ? date.startOf('day') : null;
    if (!nextExpiry?.isValid()) {
      applyTenureFields({ tenureYears: '', tenureMonths: '', tenureDays: '' });
      emit({ expiryDate: null });
      return;
    }

    if (startDate && !nextExpiry.isAfter(toDay(startDate))) {
      return;
    }

    emit({ expiryDate: toLocalDate(nextExpiry) });
  };

  return (
    <Grid container spacing={2.5} sx={{ alignItems: 'flex-end' }}>
      <Grid size={{ xs: 12, md: 4 }}>
        <DatePicker
          label="Start Date *"
          format={DATE_FORMAT}
          value={startDate ? dayjs(startDate) : null}
          onChange={handleStartChange}
          disabled={disabled}
          slotProps={datePickerSlotProps}
        />
      </Grid>

      <Grid size={{ xs: 12, md: 4 }}>
        <FormControl fullWidth size="small" variant="outlined">
          <InputLabel
            shrink
            sx={{
              px: 0.5,
              bgcolor: BRAND.white,
              color: BRAND.textSecondary,
              fontWeight: 600,
              fontSize: '0.75rem',
            }}
          >
            Tenure
          </InputLabel>
          <Box sx={unifiedTenureWrapperSx}>
            {TENURE_SEGMENTS.map(({ key, label }) => (
              <Box key={key} sx={tenureSegmentSx}>
                <InputBase
                  type="number"
                  value={tenureValues[key]}
                  onChange={(e) => handleTenureChange(key, e.target.value)}
                  placeholder="0"
                  disabled={disabled}
                  slotProps={{ input: { min: 0, 'aria-label': label } }}
                  sx={tenureInputSx}
                />
                <Typography
                  variant="caption"
                  sx={{
                    fontSize: '0.625rem',
                    lineHeight: 1,
                    color: BRAND.textSecondary,
                    userSelect: 'none',
                  }}
                >
                  {label}
                </Typography>
              </Box>
            ))}
          </Box>
        </FormControl>
      </Grid>

      <Grid size={{ xs: 12, md: 4 }}>
        <DatePicker
          label="Expiry Date *"
          format={DATE_FORMAT}
          value={expiryDate ? dayjs(expiryDate) : null}
          onChange={handleExpiryChange}
          minDate={startDate ? toDay(startDate).add(1, 'day') : undefined}
          disabled={disabled}
          slotProps={datePickerSlotProps}
        />
      </Grid>
    </Grid>
  );
}
