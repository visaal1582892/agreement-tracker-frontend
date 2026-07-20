import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  Alert,
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Autocomplete,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Grid,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  alpha,
} from '@mui/material';
import {
  AccountBalanceWalletOutlined,
  BlockOutlined,
  CalculateOutlined,
  CheckCircleOutlined,
  ExpandMore,
  Inventory2Outlined,
  PaidOutlined,
  WarningAmberOutlined,
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import dayjs from 'dayjs';
import { BRAND } from '../../../config/theme';
import KpiCard from '../../../components/ui/KpiCard';
import { calculateCommercialPayouts, aggregatePurchases, extractApiErrorMessage } from '../../../api/commercialApi';
import {
  isAdHocIncomeType,
  isAssetRentalIncomeType,
  isCommercialContractsIncomeType,
  isDataFeeIncomeType,
} from '../../../utils/incomeTypeUtils';
import { GEOGRAPHY_MODE } from '../../../constants/geographyMode';
import { PAYOUT_FREQUENCY, resolveStructureType, STRUCTURE_TYPE } from '../../../constants/commercialStructure';
import { integrationApi } from '../../../api/integrationApi';
import { useDebounce } from '../../../hooks/useDebounce';
import { formatTimePeriodDisplay } from '../../../utils/timePeriodDisplayUtils';
import { toMuiTextFieldSlotProps } from '../../../utils/muiDomCompat';

const FILTER_OPTION_LIMIT = 50;
const FILTER_SEARCH_DEBOUNCE_MS = 300;
const LOCATION_SEARCH_MIN_CHARS = 2;
const MONTH_INITIALS = Object.freeze([
  '', 'J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D',
]);
const MONTH_ABBREVIATIONS = Object.freeze([
  '', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]);

const currencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
});

const numberFormatter = new Intl.NumberFormat('en-IN');

const PERIOD_GROUP_ORDER = ['YEARLY', 'HALF_YEARLY', 'QUARTERLY', 'MONTHLY', 'ONE_TIME'];
const PERIOD_GROUP_LABELS = {
  YEARLY: 'Yearly Payouts',
  HALF_YEARLY: 'Half-Yearly Payouts',
  QUARTERLY: 'Quarterly Payouts',
  MONTHLY: 'Monthly Payouts',
  ONE_TIME: 'One-Time Payouts',
  OTHER: 'Other Payouts',
};

function formatCurrency(value) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? currencyFormatter.format(numeric) : '—';
}

function formatNumber(value) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numberFormatter.format(numeric) : '—';
}

function formatPercent(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return '—';
  }
  return `${numeric.toLocaleString('en-IN', { maximumFractionDigits: 2 })}%`;
}

function isQualifierBelowRequired(item) {
  const required = Number(item?.qualifierRequiredPercent);
  const achieved = Number(item?.qualifierAchievedValue);
  if (!Number.isFinite(required) || !Number.isFinite(achieved)) {
    return false;
  }
  return required > achieved;
}

function isPayoutFailed(item) {
  if (!item) {
    return false;
  }
  if (item.qualifierMet === false) {
    return true;
  }
  const reason = item.statusReason;
  return reason === 'Target Missed'
    || reason === 'Qualifier Missed'
    || reason === 'Child Qualifier Missed';
}

const FAILED_MESSAGE_SX = {
  color: BRAND.red,
  fontWeight: 300,
};

function FilterAutocomplete({
  label,
  options,
  value,
  onChange,
  allLabel,
  disabled = false,
  locked = false,
  lockedLabel,
  emptyLabel = 'No data',
  /** When set, search is server-driven; client only limits rendered rows. */
  onSearch = null,
  loading = false,
  searchMinChars = 0,
  /** Hide option list until user types at least searchMinChars (or 1). */
  requireSearch = false,
}) {
  const [inputValue, setInputValue] = useState('');
  const debouncedInput = useDebounce(inputValue, FILTER_SEARCH_DEBOUNCE_MS);
  const remote = typeof onSearch === 'function';
  const onSearchRef = useRef(onSearch);
  const inputValueRef = useRef(inputValue);
  const effectiveMinChars = requireSearch
    ? Math.max(searchMinChars, 1)
    : searchMinChars;

  useEffect(() => {
    onSearchRef.current = onSearch;
  }, [onSearch]);

  useEffect(() => {
    inputValueRef.current = inputValue;
  }, [inputValue]);

  useEffect(() => {
    if (!remote) return undefined;
    const query = debouncedInput.trim();
    if (effectiveMinChars > 0 && query.length < effectiveMinChars) {
      onSearchRef.current('');
      return undefined;
    }
    onSearchRef.current(query);
    return undefined;
  }, [remote, debouncedInput, effectiveMinChars]);

  const selectedOptions = useMemo(() => {
    const byId = new Map(options.map((option) => [option.id, option]));
    return value
      .map((id) => byId.get(id) ?? { id, label: String(id) })
      .filter(Boolean);
  }, [options, value]);

  const filteredOptions = useMemo(() => {
    const query = debouncedInput.trim();
    if (requireSearch && query.length < effectiveMinChars) {
      return selectedOptions;
    }

    let matched = options;
    if (!remote) {
      const q = query.toLowerCase();
      matched = q
        ? options.filter((option) => String(option.label).toLowerCase().includes(q))
        : options;
    }
    const limited = matched.slice(0, FILTER_OPTION_LIMIT);
    const limitedIds = new Set(limited.map((option) => option.id));
    const selectedMissing = selectedOptions.filter((option) => !limitedIds.has(option.id));
    return [...selectedMissing, ...limited];
  }, [
    options,
    debouncedInput,
    selectedOptions,
    remote,
    requireSearch,
    effectiveMinChars,
  ]);

  const placeholder = locked
    ? (lockedLabel || allLabel)
    : (options.length === 0 && !remote && !requireSearch ? emptyLabel : allLabel);

  const isDisabled = disabled || locked || (!remote && !requireSearch && options.length === 0);

  return (
    <Autocomplete
      multiple
      size="small"
      fullWidth
      disabled={isDisabled}
      loading={loading}
      options={filteredOptions}
      value={selectedOptions}
      inputValue={inputValue}
      clearOnBlur={false}
      blurOnSelect={false}
      onInputChange={(_, next, reason) => {
        if (reason === 'reset') {
          return;
        }
        setInputValue(next);
      }}
      onChange={(_, selected) => {
        onChange(selected.map((option) => option.id));
        setInputValue(inputValueRef.current);
      }}
      getOptionLabel={(option) => option?.label ?? String(option?.id ?? '')}
      isOptionEqualToValue={(option, current) => option.id === current.id}
      filterOptions={(opts) => opts}
      disableCloseOnSelect
      noOptionsText={
        (remote || requireSearch) && inputValue.trim().length < effectiveMinChars
          ? `Type at least ${effectiveMinChars} character${effectiveMinChars === 1 ? '' : 's'} to search`
          : (loading ? 'Searching…' : emptyLabel)
      }
      renderOption={(props, option, { selected }) => {
        const { key, ...optionProps } = props;
        return (
          <li {...optionProps} key={key ?? option.id}>
            <Checkbox checked={selected} size="small" sx={{ mr: 1 }} />
            <Typography variant="body2" noWrap>{option.label}</Typography>
          </li>
        );
      }}
      renderTags={(tagValue, getTagProps) => {
        if (!tagValue.length) return null;
        if (tagValue.length <= 2) {
          return tagValue.map((option, index) => {
            const { key, ...tagProps } = getTagProps({ index });
            return (
              <Chip
                {...tagProps}
                key={key ?? option.id}
                size="small"
                label={option.label}
              />
            );
          });
        }
        const firstTag = getTagProps({ index: 0 });
        const { key: firstKey, ...firstTagProps } = firstTag;
        return [
          <Chip
            {...firstTagProps}
            key={firstKey ?? tagValue[0].id}
            size="small"
            label={tagValue[0].label}
          />,
          <Chip
            key="more"
            size="small"
            label={`+${tagValue.length - 1}`}
            sx={{ ml: 0.5 }}
          />,
        ];
      }}
      renderInput={(params) => (
        <TextField
          {...toMuiTextFieldSlotProps(params)}
          label={label}
          placeholder={selectedOptions.length ? undefined : placeholder}
        />
      )}
    />
  );
}

function monthPayload(cursor) {
  return {
    month: cursor.month() + 1,
    year: cursor.year(),
  };
}

function iterateMonths(start, end, mapFn) {
  const results = [];
  let cursor = start;
  while (!cursor.isAfter(end)) {
    results.push(mapFn(cursor));
    cursor = cursor.add(1, 'month');
  }
  return results;
}

/** Calendar months capped to today — used for Data Fee / flat payout window. */
function buildElapsedMonthOptions(version) {
  if (!version?.startDate) {
    return [];
  }
  const start = dayjs(version.startDate).startOf('month');
  const currentMonth = dayjs().startOf('month');
  const rawEnd = version?.expiryDate ? dayjs(version.expiryDate).startOf('month') : currentMonth;
  const end = rawEnd.isAfter(currentMonth) ? currentMonth : rawEnd;
  return iterateMonths(start, end, (cursor) => ({
    id: cursor.format('YYYY-MM'),
    label: cursor.format('MMM YYYY'),
    year: cursor.year(),
    month: cursor.month() + 1,
    periodKey: cursor.year() * 100 + (cursor.month() + 1),
    months: [monthPayload(cursor)],
  }));
}

/** Full agreement calendar months (not capped to today) for CC payout + payable-summary. */
function buildAgreementMonthOptions(version) {
  if (!version?.startDate || !version?.expiryDate) {
    return [];
  }
  const start = dayjs(version.startDate).startOf('month');
  const end = dayjs(version.expiryDate).startOf('month');
  return iterateMonths(start, end, (cursor) => ({
    id: cursor.format('YYYY-MM'),
    label: cursor.format('MMM YYYY'),
    year: cursor.year(),
    month: cursor.month() + 1,
    periodKey: cursor.year() * 100 + (cursor.month() + 1),
    months: [monthPayload(cursor)],
  }));
}

function resolveFyStartMonth(version) {
  const value = Number(version?.financialYearStartMonth);
  return Number.isInteger(value) && value >= 1 && value <= 12 ? value : 4;
}

function alignToFinancialYearStart(cursor, fyStartMonth) {
  const candidate = dayjs(`${cursor.year()}-${String(fyStartMonth).padStart(2, '0')}-01`);
  if (cursor.isBefore(candidate, 'month')) {
    return candidate.subtract(1, 'year');
  }
  return candidate.startOf('month');
}

function monthsBetweenInclusive(start, end) {
  return iterateMonths(start, end, monthPayload);
}

function periodOverlapsContract(periodStart, periodEnd, contractStart, contractEnd) {
  return !periodEnd.isBefore(contractStart, 'month') && !periodStart.isAfter(contractEnd, 'month');
}

function formatInitialsName(months) {
  return months.map((entry) => MONTH_INITIALS[entry.month] || '').join('');
}

function formatMonthYearLabel(entry) {
  return `${MONTH_ABBREVIATIONS[entry.month]} ${entry.year}`;
}

function toPeriodOption(id, baseName, months, fyStartMonth) {
  const first = months[0];
  const label = formatTimePeriodDisplay(baseName, fyStartMonth, {
    calendarMonth: first?.month,
    calendarYear: first?.year,
  });
  return { id, label: label || baseName, months };
}

/**
 * Mirrors backend DynamicFinancialYearPeriodGenerator so Data Fee buckets match CC naming
 * (AMJ, JASO, … + FY suffix) and include every overlapping period in the contract window.
 */
function buildFrequencyPeriodOptions(version, frequency) {
  if (!version?.startDate || !version?.expiryDate) {
    return [];
  }
  const start = dayjs(version.startDate).startOf('month');
  const end = dayjs(version.expiryDate).startOf('month');
  if (end.isBefore(start)) {
    return [];
  }

  const resolvedFrequency = frequency || PAYOUT_FREQUENCY.MONTHLY;
  const fyStartMonth = resolveFyStartMonth(version);

  if (resolvedFrequency === PAYOUT_FREQUENCY.MONTHLY) {
    return iterateMonths(start, end, (cursor) => {
      const months = [monthPayload(cursor)];
      const baseName = formatMonthYearLabel(months[0]);
      return toPeriodOption(cursor.format('YYYY-MM'), baseName, months, fyStartMonth);
    });
  }

  if (resolvedFrequency === PAYOUT_FREQUENCY.ONE_TIME) {
    const months = monthsBetweenInclusive(start, end);
    return [toPeriodOption('ONE_TIME', 'ONE_TIME', months, fyStartMonth)];
  }

  if (resolvedFrequency === PAYOUT_FREQUENCY.YEARLY) {
    const options = [];
    let fyStart = alignToFinancialYearStart(start, fyStartMonth);
    while (!fyStart.isAfter(end, 'month')) {
      const fyEnd = fyStart.add(11, 'month');
      if (periodOverlapsContract(fyStart, fyEnd, start, end)) {
        const months = monthsBetweenInclusive(fyStart, fyEnd);
        const baseName = `${formatMonthYearLabel(months[0])} – ${formatMonthYearLabel(months[months.length - 1])}`;
        options.push(toPeriodOption(
          `YEARLY-${fyStart.format('YYYY-MM')}`,
          baseName,
          months,
          fyStartMonth,
        ));
      }
      fyStart = fyStart.add(12, 'month');
    }
    return options;
  }

  const monthsPerPeriod = resolvedFrequency === PAYOUT_FREQUENCY.QUARTERLY ? 3 : 6;
  const periodsPerFy = resolvedFrequency === PAYOUT_FREQUENCY.QUARTERLY ? 4 : 2;
  const options = [];
  let fyAnchor = alignToFinancialYearStart(start, fyStartMonth);

  while (!fyAnchor.isAfter(end, 'month')) {
    for (let index = 0; index < periodsPerFy; index += 1) {
      const periodStart = fyAnchor.add(index * monthsPerPeriod, 'month');
      const periodEnd = periodStart.add(monthsPerPeriod - 1, 'month');
      if (!periodOverlapsContract(periodStart, periodEnd, start, end)) {
        continue;
      }
      const months = monthsBetweenInclusive(periodStart, periodEnd);
      const baseName = formatInitialsName(months);
      options.push(toPeriodOption(
        `${resolvedFrequency}-${periodStart.format('YYYY-MM')}`,
        baseName,
        months,
        fyStartMonth,
      ));
    }
    fyAnchor = fyAnchor.add(12, 'month');
  }
  return options;
}

function buildPeriodOptionsFromLineItems(lineItems) {
  const byId = new Map();
  (lineItems ?? []).forEach((item) => {
    const id = item.timePeriodId != null
      ? `tp-${item.timePeriodId}`
      : `label-${item.label}`;
    if (byId.has(id)) {
      return;
    }
    const months = (item.periodMonthKeys ?? []).map((key) => ({
      year: Math.floor(Number(key) / 100),
      month: Number(key) % 100,
    })).filter((entry) => entry.year > 0 && entry.month >= 1 && entry.month <= 12);
    byId.set(id, {
      id,
      label: item.label || id,
      months,
    });
  });
  return [...byId.values()];
}

function expandSelectedPeriodMonths(periodOptions, selectedPeriodIds) {
  const source = selectedPeriodIds.length
    ? periodOptions.filter((option) => selectedPeriodIds.includes(option.id))
    : periodOptions;
  const seen = new Set();
  const periods = [];
  source.forEach((option) => {
    (option.months ?? []).forEach((entry) => {
      const key = `${entry.year}-${entry.month}`;
      if (seen.has(key)) return;
      seen.add(key);
      periods.push({ month: entry.month, year: entry.year });
    });
  });
  return periods;
}

/** City-over-state precedence: drop parent states that already have a selected city. */
function applyCityOverStatePrecedence(stateCodes, cityCodes, cityOptions) {
  if (!cityCodes.length) {
    return { stateCodes, cityCodes };
  }
  const stateByCity = new Map(
    cityOptions
      .filter((city) => city.stateCode)
      .map((city) => [city.id, city.stateCode]),
  );
  const coveredStates = new Set(
    cityCodes.map((code) => stateByCity.get(code)).filter(Boolean),
  );
  return {
    stateCodes: stateCodes.filter((code) => !coveredStates.has(code)),
    cityCodes,
  };
}

function AssetPayoutBreakdown({ breakdown }) {
  if (!breakdown) return null;
  const mode = breakdown.mode;
  const periods = Array.isArray(breakdown.periods) ? breakdown.periods : [];

  return (
    <Paper elevation={0} sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', mt: 1 }}>
      <Typography fontWeight={600} sx={{ p: 2, pb: 1 }}>
        {breakdown.title || (mode === 'FLAT' ? 'Flat One-Time Payout' : 'Payment Per Store')}
      </Typography>
      <Box sx={{ px: 2, pb: 2 }}>
        {mode === 'FLAT' ? (
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 4 }}>
              <KpiCard
                title="Flat One-Time Payout"
                value={formatCurrency(breakdown.flatPayout ?? breakdown.totalPayout)}
                icon={<AccountBalanceWalletOutlined />}
                color={BRAND.green}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <KpiCard
                title="Mapped Stores"
                value={formatNumber(breakdown.mappedStores)}
                icon={<Inventory2Outlined />}
                color="#0369A1"
              />
            </Grid>
          </Grid>
        ) : (
          <>
            <Grid container spacing={2} sx={{ mb: 2 }}>
              <Grid size={{ xs: 12, md: 4 }}>
                <KpiCard
                  title="Mapped Stores"
                  value={formatNumber(breakdown.mappedStores)}
                  icon={<Inventory2Outlined />}
                  color="#0369A1"
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <KpiCard
                  title="Active Months"
                  value={formatNumber(breakdown.activeMonths)}
                  icon={<PaidOutlined />}
                  color="#B45309"
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <KpiCard
                  title="Total Calculated Payout"
                  value={formatCurrency(breakdown.totalPayout)}
                  icon={<AccountBalanceWalletOutlined />}
                  color={BRAND.green}
                />
              </Grid>
            </Grid>
            {periods.length > 0 && (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Period Months</TableCell>
                      <TableCell align="right">Rate / Store / Month</TableCell>
                      <TableCell align="right">Total Payout Per Store</TableCell>
                      <TableCell align="right">Aggregated Payout</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {periods.map((row, index) => {
                      const months = Number(row.periodMonths) || 0;
                      const rate = Number(row.payoutPerStore) || 0;
                      const totalPerStore = row.totalPayoutPerStore != null
                        ? Number(row.totalPayoutPerStore)
                        : rate * months;
                      const aggregated = row.aggregatedPayout != null
                        ? Number(row.aggregatedPayout)
                        : Number(row.rowPayout ?? 0);
                      return (
                        <TableRow key={`${row.periodMonths}-${index}`}>
                          <TableCell>{formatNumber(months)}</TableCell>
                          <TableCell align="right">{formatCurrency(rate)}</TableCell>
                          <TableCell align="right">{formatCurrency(totalPerStore)}</TableCell>
                          <TableCell align="right">{formatCurrency(aggregated)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </>
        )}
      </Box>
    </Paper>
  );
}

function AdHocPayoutBreakdown({ breakdown }) {
  if (!breakdown) return null;
  const slab = breakdown.applicableSlab;
  const slabLabel = slab
    ? `${formatCurrency(slab.minCap)} – ${formatCurrency(slab.maxCap)}`
    : 'None (below minimum)';

  return (
    <Paper elevation={0} sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', mt: 1 }}>
      <Typography fontWeight={600} sx={{ p: 2, pb: 1 }}>
        {breakdown.title || 'Ad-Hoc Slab Payout'}
      </Typography>
      <Grid container spacing={2} sx={{ px: 2, pb: 2 }}>
        <Grid size={{ xs: 12, md: 4 }}>
          <KpiCard
            title="Total Actual Purchase"
            value={formatCurrency(breakdown.totalActualPurchase)}
            icon={<PaidOutlined />}
            color={BRAND.red}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <KpiCard
            title="Applicable Slab"
            value={slabLabel}
            icon={<Inventory2Outlined />}
            color="#0369A1"
          />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <KpiCard
            title="Eligible Purchase (Capped)"
            value={formatCurrency(breakdown.eligiblePurchase)}
            icon={<WarningAmberOutlined />}
            color="#B45309"
            subtitle={breakdown.capped ? 'Capped at max_cap' : undefined}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <KpiCard
            title="Applied Percentage"
            value={formatPercent(breakdown.appliedPercentage)}
            icon={<PaidOutlined />}
            color="#0E7490"
          />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <KpiCard
            title="Final Ad-Hoc Payout"
            value={formatCurrency(breakdown.totalPayout)}
            icon={<AccountBalanceWalletOutlined />}
            color={BRAND.green}
          />
        </Grid>
      </Grid>
    </Paper>
  );
}

function groupLineItemsByPeriodType(lineItems) {
  const groups = new Map();
  lineItems.forEach((item) => {
    const key = item.periodFrequency || 'OTHER';
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(item);
  });

  const orderedKeys = [
    ...PERIOD_GROUP_ORDER.filter((key) => groups.has(key)),
    ...[...groups.keys()].filter((key) => !PERIOD_GROUP_ORDER.includes(key)),
  ];

  return orderedKeys.map((key) => ({
    key,
    label: PERIOD_GROUP_LABELS[key] || PERIOD_GROUP_LABELS.OTHER,
    items: groups.get(key) ?? [],
  }));
}

function StatusChips({ qualifierMet, capped, statusReason }) {
  if (statusReason === 'Child Qualifier Missed') {
    return (
      <Chip
        icon={<BlockOutlined sx={{ fontSize: 16 }} />}
        label="Failed: Child Qualifier Unmet"
        size="small"
        color="error"
        variant="outlined"
      />
    );
  }
  if (!qualifierMet) {
    const label = statusReason === 'Target Missed'
      ? 'Target not met'
      : statusReason === 'Qualifier Missed'
        ? 'Qualifier not met'
        : statusReason || 'Qualifier not met';
    return (
      <Chip
        icon={<BlockOutlined sx={{ fontSize: 16 }} />}
        label={label}
        size="small"
        color="error"
        variant="outlined"
      />
    );
  }
  if (capped) {
    return (
      <Chip
        icon={<WarningAmberOutlined sx={{ fontSize: 16 }} />}
        label="Capped"
        size="small"
        color="warning"
        variant="outlined"
      />
    );
  }
  return (
    <Chip
      icon={<CheckCircleOutlined sx={{ fontSize: 16 }} />}
      label="Payable"
      size="small"
      color="success"
      variant="outlined"
    />
  );
}

function PayoutBreakdownTable({ items, showQualifierColumns = false }) {
  const columnCount = showQualifierColumns ? 8 : 6;
  return (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Period</TableCell>
            <TableCell align="right">Raw Qty</TableCell>
            <TableCell align="right">Raw Net Value</TableCell>
            <TableCell>Slab / Target Achieved</TableCell>
            {showQualifierColumns && (
              <>
                <TableCell align="right">Qualifier Req.</TableCell>
                <TableCell align="right">Qualifier Achieved</TableCell>
              </>
            )}
            <TableCell align="right">Final Payout</TableCell>
            <TableCell>Status</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {items.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columnCount} align="center" sx={{ py: 5 }}>
                <Typography variant="body2" color="text.secondary">
                  No payout line items for the selected filters.
                </Typography>
              </TableCell>
            </TableRow>
          ) : (
            items.map((item, index) => {
              const qualifierBelowRequired = showQualifierColumns && isQualifierBelowRequired(item);
              const payoutFailed = isPayoutFailed(item);
              return (
                <TableRow
                  key={`${item.timePeriodId ?? item.label}-${index}`}
                  sx={payoutFailed ? { backgroundColor: alpha(BRAND.red, 0.05) } : undefined}
                >
                  <TableCell>
                    <Typography variant="body2" fontWeight={600}>{item.label}</Typography>
                  </TableCell>
                  <TableCell align="right">{formatNumber(item.basisNetQty)}</TableCell>
                  <TableCell align="right">{formatCurrency(item.basisNetValue)}</TableCell>
                  <TableCell>
                    {item.slabTier != null && (
                      <Typography variant="body2" fontWeight={600}>Tier {item.slabTier}</Typography>
                    )}
                    {item.detail && (
                      <Typography
                        variant="caption"
                        sx={{
                          display: 'block',
                          ...(payoutFailed
                            ? FAILED_MESSAGE_SX
                            : { color: 'text.secondary', fontWeight: 300 }),
                        }}
                      >
                        {item.detail}
                      </Typography>
                    )}
                  </TableCell>
                  {showQualifierColumns && (
                    <>
                      <TableCell align="right">
                        <Typography
                          variant="body2"
                          sx={qualifierBelowRequired
                            ? FAILED_MESSAGE_SX
                            : { fontWeight: 300 }}
                        >
                          {formatPercent(item.qualifierRequiredPercent)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography
                          variant="body2"
                          sx={qualifierBelowRequired
                            ? FAILED_MESSAGE_SX
                            : { fontWeight: 300 }}
                        >
                          {formatPercent(item.qualifierAchievedValue)}
                        </Typography>
                      </TableCell>
                    </>
                  )}
                  <TableCell align="right">
                    <Typography variant="body2" fontWeight={700}>{formatCurrency(item.payout)}</Typography>
                  </TableCell>
                  <TableCell>
                    <StatusChips
                      qualifierMet={item.qualifierMet}
                      capped={item.capped}
                      statusReason={item.statusReason}
                    />
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function PayableSummaryTable({ items }) {
  return (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Period</TableCell>
            <TableCell>Type</TableCell>
            <TableCell align="right">Payout</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {items.length === 0 ? (
            <TableRow>
              <TableCell colSpan={3} align="center" sx={{ py: 4 }}>
                <Typography variant="body2" color="text.secondary">
                  No payable periods match the selected year/month filters.
                </Typography>
              </TableCell>
            </TableRow>
          ) : (
            items.map((item, index) => (
              <TableRow key={`payable-${item.timePeriodId ?? item.label}-${index}`}>
                <TableCell>
                  <Typography variant="body2" fontWeight={600}>{item.label}</Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" color="text.secondary">
                    {PERIOD_GROUP_LABELS[item.periodFrequency] || item.periodFrequency || '—'}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  <Typography variant="body2" fontWeight={700}>{formatCurrency(item.payout)}</Typography>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

export default function CommercialPayoutReview({ agreementVersionId, version }) {
  const { enqueueSnackbar } = useSnackbar();

  const isCommercialContractsVersion = isCommercialContractsIncomeType(
    [],
    version?.incomeTypeId,
    version?.incomeTypeName,
  );
  const isDataFeeVersion = isDataFeeIncomeType(
    [],
    version?.incomeTypeId,
    version?.incomeTypeName,
  );
  const isAssetVersion = isAssetRentalIncomeType(
    [],
    version?.incomeTypeId,
    version?.incomeTypeName,
  );
  const isAdHocVersion = isAdHocIncomeType(
    [],
    version?.incomeTypeId,
    version?.incomeTypeName,
  );
  const isUnrestrictedGeo = isDataFeeVersion
    || isAssetVersion
    || version?.geographyMode === GEOGRAPHY_MODE.ALL;
  const structureType = resolveStructureType(version?.commercialStructure);
  const isFlatStructure = structureType === STRUCTURE_TYPE.FLAT;
  const usesFrequencyPeriodBuckets = isDataFeeVersion || (isCommercialContractsVersion && isFlatStructure);
  const flatFrequency = version?.flatBaselineFrequency || PAYOUT_FREQUENCY.MONTHLY;

  const [stateOptions, setStateOptions] = useState([]);
  const [cityOptions, setCityOptions] = useState([]);
  const [statesLoading, setStatesLoading] = useState(false);
  const [citiesLoading, setCitiesLoading] = useState(false);
  const [geoReady, setGeoReady] = useState(false);
  const [selectedPeriods, setSelectedPeriods] = useState([]);
  const [selectedProductIds, setSelectedProductIds] = useState([]);
  const [selectedSupplierIds, setSelectedSupplierIds] = useState([]);
  const [selectedStateCodes, setSelectedStateCodes] = useState([]);
  const [selectedCityCodes, setSelectedCityCodes] = useState([]);
  const [summaryYears, setSummaryYears] = useState([]);
  const [summaryMonths, setSummaryMonths] = useState([]);
  const [calculating, setCalculating] = useState(false);
  const [result, setResult] = useState(null);
  const [exploratoryAggregation, setExploratoryAggregation] = useState(null);
  const autoCalcKeyRef = useRef(null);
  const citySearchQueryRef = useRef('');
  const [selectedStateMeta, setSelectedStateMeta] = useState(() => new Map());
  const [selectedCityMeta, setSelectedCityMeta] = useState(() => new Map());

  const agreementMonthOptions = useMemo(() => buildAgreementMonthOptions(version), [
    version?.id,
    version?.startDate,
    version?.expiryDate,
  ]);

  const frequencyPeriodOptions = useMemo(
    () => buildFrequencyPeriodOptions(version, flatFrequency),
    [
      version?.id,
      version?.startDate,
      version?.expiryDate,
      version?.financialYearStartMonth,
      flatFrequency,
    ],
  );

  const lineItemPeriodOptions = useMemo(
    () => buildPeriodOptionsFromLineItems(result?.lineItems),
    [result?.lineItems],
  );

  /** Exploratory period filter options. */
  const periodFilterOptions = useMemo(() => {
    if (usesFrequencyPeriodBuckets) {
      return frequencyPeriodOptions;
    }
    // CC SLAB/HYBRID: populate from payout lineItems after initial calc (Gap B1).
    return lineItemPeriodOptions;
  }, [usesFrequencyPeriodBuckets, frequencyPeriodOptions, lineItemPeriodOptions]);

  /** Full calendar months for default (unfiltered) calculate payload. */
  const fullPayoutPeriods = useMemo(() => {
    if (usesFrequencyPeriodBuckets && frequencyPeriodOptions.length) {
      return expandSelectedPeriodMonths(frequencyPeriodOptions, []);
    }
    const source = isCommercialContractsVersion
      ? agreementMonthOptions
      : buildElapsedMonthOptions(version);
    return source.map((option) => ({ month: option.month, year: option.year }));
  }, [
    usesFrequencyPeriodBuckets,
    frequencyPeriodOptions,
    isCommercialContractsVersion,
    agreementMonthOptions,
    version?.id,
    version?.startDate,
    version?.expiryDate,
  ]);

  const summaryYearOptions = useMemo(() => {
    const years = [...new Set(agreementMonthOptions.map((option) => option.year))].sort((a, b) => a - b);
    return years.map((year) => ({ id: year, label: String(year) }));
  }, [agreementMonthOptions]);

  const summaryMonthOptions = useMemo(() => {
    const months = agreementMonthOptions.filter((option) => (
      summaryYears.length === 0 || summaryYears.includes(option.year)
    ));
    const unique = new Map();
    months.forEach((option) => {
      if (!unique.has(option.month)) {
        unique.set(option.month, {
          id: option.month,
          label: dayjs().month(option.month - 1).format('MMM'),
        });
      }
    });
    return [...unique.values()].sort((a, b) => a.id - b.id);
  }, [agreementMonthOptions, summaryYears]);

  const productOptions = useMemo(
    () => (version?.products ?? []).map((product) => ({
      id: product.productId,
      label: product.productName
        ? `${product.productName} (${product.productId})`
        : product.productId,
    })),
    [version?.products],
  );

  const supplierOptions = useMemo(
    () => (version?.vendors ?? []).map((vendor) => ({
      id: vendor.vendorId,
      label: vendor.vendorName ? `${vendor.vendorName} (${vendor.vendorId})` : String(vendor.vendorId),
    })),
    [version?.vendors],
  );

  const stateSelectOptions = useMemo(() => {
    const fromApi = stateOptions.map((state) => ({
      id: state.stateCode || state.code,
      label: (state.stateName || state.name)
        ? `${state.stateName || state.name} (${state.stateCode || state.code})`
        : (state.stateCode || state.code),
      stateCode: state.stateCode || state.code,
      stateName: state.stateName || state.name,
    })).filter((opt) => opt.id);

    if (!isUnrestrictedGeo) {
      return fromApi;
    }

    // Keep selected states visible after search results change.
    const byId = new Map(fromApi.map((opt) => [opt.id, opt]));
    selectedStateCodes.forEach((code) => {
      if (byId.has(code)) return;
      const meta = selectedStateMeta.get(code);
      byId.set(code, meta ?? { id: code, label: code, stateCode: code });
    });
    return [...byId.values()];
  }, [stateOptions, isUnrestrictedGeo, selectedStateCodes, selectedStateMeta]);

  const citySelectOptions = useMemo(() => {
    const mapped = cityOptions.map((city) => ({
      id: city.code || city.cityCode,
      label: city.stateCode
        ? `${city.name || city.cityName} (${city.code || city.cityCode}) · ${city.stateName || city.stateCode}`
        : `${city.name || city.cityName || ''} (${city.code || city.cityCode})`,
      stateCode: city.stateCode || null,
    })).filter((opt) => opt.id);

    if (!isUnrestrictedGeo) {
      return mapped;
    }

    const byId = new Map(mapped.map((opt) => [opt.id, opt]));
    selectedCityCodes.forEach((code) => {
      if (byId.has(code)) return;
      const meta = selectedCityMeta.get(code);
      byId.set(code, meta ?? { id: code, label: code, stateCode: null });
    });

    if (!selectedStateCodes.length) {
      return [...byId.values()].filter((city) => selectedCityCodes.includes(city.id));
    }
    const selected = new Set(selectedStateCodes);
    return [...byId.values()].filter((city) => (
      selectedCityCodes.includes(city.id) || selected.has(city.stateCode)
    ));
  }, [cityOptions, isUnrestrictedGeo, selectedStateCodes, selectedCityCodes, selectedCityMeta]);

  const cityDisabledByDependency = isUnrestrictedGeo && selectedStateCodes.length === 0;

  // CC: scoped agreement locations. Data Fee / ALL: integration APIs (no master preload).
  useEffect(() => {
    let cancelled = false;
    autoCalcKeyRef.current = null;

    if (isUnrestrictedGeo) {
      // States/cities come from integration search APIs on demand — no preload.
      queueMicrotask(() => {
        if (cancelled) return;
        setStateOptions([]);
        setCityOptions([]);
        setGeoReady(true);
      });
      return () => { cancelled = true; };
    }

    const states = Array.isArray(version?.partnerStates) ? version.partnerStates : [];
    const cities = Array.isArray(version?.partnerCities) ? version.partnerCities : [];
    queueMicrotask(() => {
      if (cancelled) return;
      setStateOptions(states.map((s) => ({
        stateCode: s.code,
        stateName: s.name,
      })).filter((s) => s.stateCode));
      setCityOptions(cities.map((c) => ({
        code: c.code,
        name: c.name,
        stateCode: c.stateCode,
        stateName: c.stateName,
      })).filter((c) => c.code));
      setGeoReady(true);
    });

    return () => { cancelled = true; };
  }, [isUnrestrictedGeo, version?.partnerStates, version?.partnerCities, version?.id]);

  const handleStateSearch = useCallback(async (query) => {
    if (!isUnrestrictedGeo) return;
    const q = (query ?? '').trim();
    if (q.length < LOCATION_SEARCH_MIN_CHARS) {
      setStateOptions([]);
      setStatesLoading(false);
      return;
    }
    setStatesLoading(true);
    try {
      const { data } = await integrationApi.searchStates(q);
      setStateOptions(
        (Array.isArray(data) ? data : [])
          .filter((state) => state?.code)
          .map((state) => ({
            stateCode: state.code,
            stateName: state.name,
          })),
      );
    } catch {
      setStateOptions([]);
    } finally {
      setStatesLoading(false);
    }
  }, [isUnrestrictedGeo]);

  const loadCitiesForSelectedStates = useCallback(async (stateCodes, query = '') => {
    if (!isUnrestrictedGeo || !stateCodes.length) {
      setCityOptions([]);
      return;
    }
    setCitiesLoading(true);
    try {
      const stateNameByCode = new Map(
        [...selectedStateMeta.entries()].map(([code, meta]) => [
          code,
          meta.stateName || meta.label || code,
        ]),
      );

      const q = (query ?? '').trim();
      const cityResults = await Promise.all(
        stateCodes.map(async (stateCode) => {
          try {
            const { data } = await integrationApi.searchCities(stateCode, q);
            return (Array.isArray(data) ? data : [])
              .filter((city) => city?.code)
              .map((city) => ({
                code: city.code,
                name: city.name,
                stateCode,
                stateName: stateNameByCode.get(stateCode) || stateCode,
              }));
          } catch {
            return [];
          }
        }),
      );
      const merged = [];
      const seen = new Set();
      cityResults.flat().forEach((city) => {
        if (!city?.code || seen.has(city.code)) return;
        seen.add(city.code);
        merged.push(city);
      });
      setCityOptions(merged);
    } catch {
      setCityOptions([]);
    } finally {
      setCitiesLoading(false);
    }
  }, [isUnrestrictedGeo, selectedStateMeta]);

  // Data Fee: load cities from integration API when states change.
  useEffect(() => {
    if (!isUnrestrictedGeo) return undefined;
    if (!selectedStateCodes.length) {
      return undefined;
    }
    loadCitiesForSelectedStates(selectedStateCodes, citySearchQueryRef.current);
    return undefined;
  }, [isUnrestrictedGeo, selectedStateCodes, loadCitiesForSelectedStates]);

  const handleCitySearch = useCallback((query) => {
    if (!isUnrestrictedGeo || !selectedStateCodes.length) return;
    citySearchQueryRef.current = query ?? '';
    loadCitiesForSelectedStates(selectedStateCodes, query);
  }, [isUnrestrictedGeo, selectedStateCodes, loadCitiesForSelectedStates]);

  const handleStateSelectionChange = useCallback((nextCodes) => {
    const optionById = new Map(stateSelectOptions.map((opt) => [opt.id, opt]));
    setSelectedStateMeta((prev) => {
      const next = new Map();
      nextCodes.forEach((code) => {
        const option = optionById.get(code) || prev.get(code);
        if (option) next.set(code, option);
      });
      return next;
    });
    setSelectedStateCodes(nextCodes);
    if (nextCodes.length === 0) {
      setSelectedCityCodes([]);
      setSelectedCityMeta(new Map());
      setCityOptions([]);
      citySearchQueryRef.current = '';
      return;
    }
    setSelectedCityMeta((prevMeta) => {
      const nextMeta = new Map();
      prevMeta.forEach((meta, code) => {
        if (meta?.stateCode && nextCodes.includes(meta.stateCode)) {
          nextMeta.set(code, meta);
        }
      });
      setSelectedCityCodes((prevCodes) => prevCodes.filter((code) => nextMeta.has(code)));
      return nextMeta;
    });
  }, [stateSelectOptions]);

  const handleCitySelectionChange = useCallback((nextCodes) => {
    const optionById = new Map(citySelectOptions.map((opt) => [opt.id, opt]));
    setSelectedCityMeta((prev) => {
      const next = new Map();
      nextCodes.forEach((code) => {
        const option = optionById.get(code) || prev.get(code);
        if (option) next.set(code, option);
      });
      return next;
    });
    setSelectedCityCodes(nextCodes);
  }, [citySelectOptions]);

  const handleCalculate = useCallback(async (filterOverrides = null) => {
    if (!agreementVersionId) return;
    if (!isAssetVersion && !fullPayoutPeriods.length) {
      enqueueSnackbar('No calculable periods available for this agreement.', { variant: 'warning' });
      return;
    }

    const activePeriods = filterOverrides?.periods ?? selectedPeriods;
    const activeProductIds = filterOverrides?.productIds ?? selectedProductIds;
    const activeSupplierIds = filterOverrides?.supplierIds ?? selectedSupplierIds;
    const activeStateCodes = filterOverrides?.stateCodes ?? selectedStateCodes;
    const activeCityCodes = filterOverrides?.cityCodes ?? selectedCityCodes;

    const explorPeriods = expandSelectedPeriodMonths(periodFilterOptions, activePeriods);
    const periodPayload = isAssetVersion
      ? null
      : (explorPeriods.length ? explorPeriods : fullPayoutPeriods);

    const geo = applyCityOverStatePrecedence(
      activeStateCodes,
      activeCityCodes,
      citySelectOptions,
    );

    // Empty filter arrays = full agreement scope. Non-empty filters apply to BOTH
    // purchase KPIs and payout calculation so empty geo slices show zero payout.
    const scopedRequest = {
      periods: periodPayload,
      productIds: !isAssetVersion && activeProductIds.length ? activeProductIds : null,
      supplierIds: !isAssetVersion && activeSupplierIds.length ? activeSupplierIds : null,
      stateCodes: !isAssetVersion && geo.stateCodes.length ? geo.stateCodes : null,
      cityCodes: !isAssetVersion && geo.cityCodes.length ? geo.cityCodes : null,
    };

    setCalculating(true);
    try {
      if (isAssetVersion) {
        const payoutData = await calculateCommercialPayouts(agreementVersionId, scopedRequest);
        setResult(payoutData);
        setExploratoryAggregation(null);
      } else {
        const [payoutData, explorData] = await Promise.all([
          calculateCommercialPayouts(agreementVersionId, scopedRequest),
          aggregatePurchases(agreementVersionId, scopedRequest),
        ]);
        setResult(payoutData);
        setExploratoryAggregation(explorData);
      }
      setSummaryYears([]);
      setSummaryMonths([]);
    } catch (err) {
      setResult(null);
      setExploratoryAggregation(null);
      enqueueSnackbar(
        await extractApiErrorMessage(err, 'Failed to calculate commercial payouts'),
        { variant: 'error' },
      );
    } finally {
      setCalculating(false);
    }
  }, [
    agreementVersionId,
    enqueueSnackbar,
    fullPayoutPeriods,
    periodFilterOptions,
    selectedPeriods,
    selectedProductIds,
    selectedSupplierIds,
    selectedStateCodes,
    selectedCityCodes,
    citySelectOptions,
    isAssetVersion,
  ]);

  const handleClearFilters = useCallback(() => {
    const nextPeriods = [];
    const nextProducts = [];
    const nextSuppliers = [];
    const nextStates = [];
    const nextCities = [];
    setSelectedPeriods(nextPeriods);
    setSelectedProductIds(nextProducts);
    setSelectedSupplierIds(nextSuppliers);
    setSelectedStateCodes(nextStates);
    setSelectedCityCodes(nextCities);
    setSelectedStateMeta(new Map());
    setSelectedCityMeta(new Map());
    handleCalculate({
      periods: nextPeriods,
      productIds: nextProducts,
      supplierIds: nextSuppliers,
      stateCodes: nextStates,
      cityCodes: nextCities,
    });
  }, [handleCalculate]);

  // Auto-calculate once after geo ready for this version (empty filters = full scope).
  useEffect(() => {
    if (!geoReady || !agreementVersionId) return;
    if (!isAssetVersion && !fullPayoutPeriods.length) return;
    const key = `${agreementVersionId}:${isAssetVersion ? 'asset' : fullPayoutPeriods.length}`;
    if (autoCalcKeyRef.current === key) return;
    autoCalcKeyRef.current = key;
    handleCalculate();
  }, [
    geoReady,
    agreementVersionId,
    fullPayoutPeriods.length,
    handleCalculate,
    isAssetVersion,
  ]);

  const lineItems = result?.lineItems ?? [];
  const rawAggregation = exploratoryAggregation;
  const isCommercialContracts = isCommercialContractsVersion
    || result?.incomeType === 'Commercial Contracts';
  const groupedLineItems = useMemo(() => groupLineItemsByPeriodType(lineItems), [lineItems]);

  const payableItems = useMemo(() => {
    const withPayout = lineItems.filter((item) => Number(item.payout) > 0);
    if (!summaryYears.length && !summaryMonths.length) {
      return withPayout;
    }

    const selectedKeys = new Set(
      agreementMonthOptions
        .filter((option) => (
          (summaryYears.length === 0 || summaryYears.includes(option.year))
          && (summaryMonths.length === 0 || summaryMonths.includes(option.month))
        ))
        .map((option) => option.periodKey),
    );

    return withPayout.filter((item) => {
      const keys = item.periodMonthKeys ?? [];
      if (!keys.length) {
        return true;
      }
      return keys.some((key) => selectedKeys.has(key));
    });
  }, [lineItems, summaryYears, summaryMonths, agreementMonthOptions]);

  const payableTotal = useMemo(
    () => payableItems.reduce((sum, item) => sum + Number(item.payout || 0), 0),
    [payableItems],
  );

  const noPeriodOptions = usesFrequencyPeriodBuckets
    ? frequencyPeriodOptions.length === 0
    : (isCommercialContractsVersion && agreementMonthOptions.length === 0);

  if (!agreementVersionId) {
    return null;
  }

  const hasActiveFilters = (
    selectedPeriods.length > 0
    || selectedProductIds.length > 0
    || selectedSupplierIds.length > 0
    || selectedStateCodes.length > 0
    || selectedCityCodes.length > 0
  );

  const filteredPurchaseEmpty = Boolean(
    result
    && hasActiveFilters
    && Number(rawAggregation?.totalNetQty ?? 0) === 0
    && Number(rawAggregation?.totalNetValue ?? 0) === 0,
  );

  return (
    <Box>
      <Paper elevation={0} sx={{ p: 2, borderRadius: 2, border: '1px solid', borderColor: 'divider', mb: 2 }}>
        <Typography fontWeight={600} sx={{ mb: 1.5 }}>Calculation Filters</Typography>
        {isAssetVersion ? (
          <>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
              Asset Rentals use mapped stores and the configured payout schedule.
              Product, supplier, and geography filters are not applicable.
            </Typography>
            <Button
              variant="contained"
              color="primary"
              startIcon={calculating
                ? <CircularProgress size={18} color="inherit" />
                : <CalculateOutlined />}
              onClick={handleCalculate}
              disabled={calculating}
            >
              {calculating ? 'Calculating…' : 'Calculate Payout'}
            </Button>
          </>
        ) : (
          <>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
              Empty filters = full agreement scope. Selected filters apply to purchase KPIs and payout calculation.
              Type to search products, suppliers, and locations — nothing pre-selected.
            </Typography>
            {noPeriodOptions && !isCommercialContractsVersion ? (
              <Alert severity="info">
                No calculable periods available. Set start and expiry dates on the agreement.
              </Alert>
            ) : isCommercialContractsVersion && agreementMonthOptions.length === 0 ? (
              <Alert severity="info">
                No contract months available. Set start and expiry dates on the agreement.
              </Alert>
            ) : (
              <Grid container spacing={2} alignItems="flex-start">
                <Grid size={{ xs: 12, md: 4 }}>
                  <FilterAutocomplete
                    label="Periods"
                    options={periodFilterOptions}
                    value={selectedPeriods}
                    onChange={setSelectedPeriods}
                    allLabel="All periods"
                    emptyLabel={
                      usesFrequencyPeriodBuckets
                        ? 'No periods available'
                        : (result ? 'No periods in payout result' : 'Periods load after first calculation')
                    }
                    disabled={periodFilterOptions.length === 0}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <FilterAutocomplete
                    label="Products"
                    options={productOptions}
                    value={selectedProductIds}
                    onChange={setSelectedProductIds}
                    allLabel="Type to search products"
                    emptyLabel="No matching products"
                    requireSearch
                    searchMinChars={1}
                    disabled={productOptions.length === 0}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <FilterAutocomplete
                    label="Suppliers"
                    options={supplierOptions}
                    value={selectedSupplierIds}
                    onChange={setSelectedSupplierIds}
                    allLabel="Type to search suppliers"
                    emptyLabel="No matching suppliers"
                    requireSearch
                    searchMinChars={1}
                    disabled={supplierOptions.length === 0}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <FilterAutocomplete
                    label="States"
                    options={stateSelectOptions}
                    value={selectedStateCodes}
                    onChange={handleStateSelectionChange}
                    allLabel={isUnrestrictedGeo ? 'Search states…' : 'Type to search states'}
                    emptyLabel={isUnrestrictedGeo ? 'Type to search states' : 'No matching states'}
                    onSearch={isUnrestrictedGeo ? handleStateSearch : null}
                    loading={statesLoading}
                    searchMinChars={isUnrestrictedGeo ? LOCATION_SEARCH_MIN_CHARS : 1}
                    requireSearch={!isUnrestrictedGeo}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <FilterAutocomplete
                    label="Cities"
                    options={citySelectOptions}
                    value={selectedCityCodes}
                    onChange={handleCitySelectionChange}
                    allLabel={
                      cityDisabledByDependency
                        ? 'Select a state first'
                        : (isUnrestrictedGeo ? 'Search cities in selected states…' : 'Type to search cities')
                    }
                    emptyLabel={citiesLoading ? 'Loading cities…' : 'No matching cities'}
                    disabled={cityDisabledByDependency}
                    onSearch={isUnrestrictedGeo && !cityDisabledByDependency ? handleCitySearch : null}
                    loading={citiesLoading}
                    searchMinChars={isUnrestrictedGeo ? 0 : 1}
                    requireSearch={!isUnrestrictedGeo}
                  />
                </Grid>
                <Grid size={{ xs: 12 }} sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                  <Button
                    variant="contained"
                    color="primary"
                    startIcon={calculating
                      ? <CircularProgress size={18} color="inherit" />
                      : <CalculateOutlined />}
                    onClick={handleCalculate}
                    disabled={calculating || !fullPayoutPeriods.length}
                  >
                    {calculating ? 'Calculating…' : 'Calculate Payout'}
                  </Button>
                  <Button
                    variant="text"
                    color="inherit"
                    onClick={handleClearFilters}
                    disabled={calculating || !fullPayoutPeriods.length}
                  >
                    Clear Filters
                  </Button>
                </Grid>
              </Grid>
            )}
          </>
        )}
      </Paper>

      {result && (
        <>
          {filteredPurchaseEmpty && !isAssetVersion && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              No purchase data matches the selected filters (including location). Payable amount is zero for this slice.
              Clear filters to see the full agreement scope.
            </Alert>
          )}

          {isAssetVersion ? (
            <AssetPayoutBreakdown breakdown={result.breakdown} />
          ) : isAdHocVersion && result.breakdown?.mode === 'RUPEES_SLAB' ? (
            <>
              <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid size={{ xs: 12, md: 4 }}>
                  <KpiCard
                    title="Total Raw Net Value"
                    value={formatCurrency(rawAggregation?.totalNetValue)}
                    icon={<PaidOutlined />}
                    color={BRAND.red}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <KpiCard
                    title="Total Raw Net Qty"
                    value={formatNumber(rawAggregation?.totalNetQty)}
                    icon={<Inventory2Outlined />}
                    color="#0369A1"
                    subtitle={rawAggregation?.dateColumnUsed
                      ? `Filtered on ${rawAggregation.dateColumnUsed}`
                      : undefined}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <KpiCard
                    title="Calculated Payable Amount"
                    value={formatCurrency(result.totalPayout)}
                    icon={<AccountBalanceWalletOutlined />}
                    color={BRAND.green}
                    subtitle={`${result.lineItemCount} line item(s)`}
                  />
                </Grid>
              </Grid>
              <AdHocPayoutBreakdown breakdown={result.breakdown} />
            </>
          ) : (
            <Grid container spacing={2} sx={{ mb: 2 }}>
              <Grid size={{ xs: 12, md: 4 }}>
                <KpiCard
                  title="Total Raw Net Value"
                  value={formatCurrency(rawAggregation?.totalNetValue)}
                  icon={<PaidOutlined />}
                  color={BRAND.red}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <KpiCard
                  title="Total Raw Net Qty"
                  value={formatNumber(rawAggregation?.totalNetQty)}
                  icon={<Inventory2Outlined />}
                  color="#0369A1"
                  subtitle={rawAggregation?.dateColumnUsed
                    ? `Filtered on ${rawAggregation.dateColumnUsed}`
                    : undefined}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <KpiCard
                  title="Calculated Payable Amount"
                  value={formatCurrency(result.totalPayout)}
                  icon={<AccountBalanceWalletOutlined />}
                  color={BRAND.green}
                  subtitle={`${result.lineItemCount} line item(s)`}
                />
              </Grid>
            </Grid>
          )}

          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2, mt: 2 }}>
            {result.incomeType && <Chip label={`Income: ${result.incomeType}`} size="small" />}
            {result.commercialStructure && (
              <Chip label={`Structure: ${result.commercialStructure}`} size="small" variant="outlined" />
            )}
          </Box>

          {(result.notes ?? []).map((note, index) => (
            <Alert key={index} severity="info" sx={{ mb: 1 }}>{note}</Alert>
          ))}

          {!isAssetVersion && !(isAdHocVersion && result.breakdown?.mode === 'RUPEES_SLAB') && (
            <Paper elevation={0} sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', mt: 1 }}>
              <Typography fontWeight={600} sx={{ p: 2, pb: 1 }}>Payout Breakdown</Typography>
              {lineItems.length === 0 ? (
                <Box sx={{ px: 2, pb: 3 }}>
                  <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 5 }}>
                    No payout line items for the selected filters.
                  </Typography>
                </Box>
              ) : groupedLineItems.length === 1 ? (
                <PayoutBreakdownTable
                  items={groupedLineItems[0].items}
                  showQualifierColumns={isCommercialContracts}
                />
              ) : (
                groupedLineItems.map((group) => (
                  <Accordion
                    key={group.key}
                    defaultExpanded
                    disableGutters
                    elevation={0}
                    sx={{
                      '&:before': { display: 'none' },
                      borderTop: '1px solid',
                      borderColor: 'divider',
                    }}
                  >
                    <AccordionSummary expandIcon={<ExpandMore />}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                        <Typography fontWeight={600}>{group.label}</Typography>
                        <Chip label={`${group.items.length} item(s)`} size="small" variant="outlined" />
                      </Box>
                    </AccordionSummary>
                    <AccordionDetails sx={{ p: 0 }}>
                      <PayoutBreakdownTable
                        items={group.items}
                        showQualifierColumns={isCommercialContracts}
                      />
                    </AccordionDetails>
                  </Accordion>
                ))
              )}
            </Paper>
          )}

          {isCommercialContracts && (
            <Paper elevation={0} sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', mt: 2 }}>
              <Typography fontWeight={600} sx={{ p: 2, pb: 1 }}>Payable Periods</Typography>
              <Box sx={{ px: 2, pb: 2 }}>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <FilterAutocomplete
                      label="Year"
                      options={summaryYearOptions}
                      value={summaryYears}
                      onChange={setSummaryYears}
                      allLabel="All years"
                      emptyLabel="No years available"
                      disabled={summaryYearOptions.length === 0}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <FilterAutocomplete
                      label="Month"
                      options={summaryMonthOptions}
                      value={summaryMonths}
                      onChange={setSummaryMonths}
                      allLabel="All months"
                      emptyLabel="No months available"
                      disabled={summaryMonthOptions.length === 0}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 4 }} sx={{ display: 'flex', alignItems: 'center' }}>
                    <Typography variant="body2" color="text.secondary">
                      Showing {payableItems.length} payable period(s) · Total {formatCurrency(payableTotal)}
                    </Typography>
                  </Grid>
                </Grid>
              </Box>
              <PayableSummaryTable items={payableItems} />
            </Paper>
          )}
        </>
      )}
    </Box>
  );
}
