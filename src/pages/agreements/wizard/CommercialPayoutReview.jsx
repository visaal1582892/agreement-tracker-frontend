import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  Alert,
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  FormControl,
  Grid,
  InputLabel,
  ListItemText,
  MenuItem,
  OutlinedInput,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
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
import axiosInstance from '../../../api/axiosInstance';
import { ENDPOINTS } from '../../../config/endpoints';
import { BRAND } from '../../../config/theme';
import KpiCard from '../../../components/ui/KpiCard';
import { calculateCommercialPayouts, aggregatePurchases, extractApiErrorMessage } from '../../../api/commercialApi';
import { isCommercialContractsIncomeType, isDataFeeIncomeType } from '../../../utils/incomeTypeUtils';
import { GEOGRAPHY_MODE } from '../../../constants/geographyMode';
import { integrationApi } from '../../../api/integrationApi';

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

function FilterMultiSelect({ label, options, value, onChange, allLabel, disabled }) {
  const labelById = useMemo(
    () => new Map(options.map((option) => [option.id, option.label])),
    [options],
  );

  const selectedLabels = useMemo(
    () => value.map((id) => labelById.get(id) ?? String(id)),
    [value, labelById],
  );

  const displayText = useMemo(() => {
    if (!selectedLabels.length) return allLabel;
    if (selectedLabels.length <= 2) return selectedLabels.join(', ');
    const rest = selectedLabels.length - 2;
    return `${selectedLabels[0]}, ${selectedLabels[1]} (+${rest})`;
  }, [selectedLabels, allLabel]);

  const tooltipTitle = selectedLabels.length ? selectedLabels.join(', ') : allLabel;

  return (
    <FormControl fullWidth size="small" disabled={disabled}>
      <InputLabel>{label}</InputLabel>
      <Tooltip title={tooltipTitle} placement="top" enterDelay={400}>
        <Select
          multiple
          value={value}
          onChange={(event) => onChange(event.target.value)}
          input={<OutlinedInput label={label} />}
          renderValue={() => (
            <Typography
              variant="body2"
              noWrap
              color={selectedLabels.length ? 'text.primary' : 'text.secondary'}
              sx={{ maxWidth: '100%' }}
            >
              {displayText}
            </Typography>
          )}
          MenuProps={{ PaperProps: { style: { maxHeight: 320 } } }}
        >
          {options.map((option) => (
            <MenuItem key={option.id} value={option.id}>
              <Checkbox checked={value.includes(option.id)} size="small" />
              <ListItemText primary={option.label} />
            </MenuItem>
          ))}
        </Select>
      </Tooltip>
    </FormControl>
  );
}

function buildPeriodOptions(version) {
  if (!version?.startDate) {
    return [];
  }
  const start = dayjs(version.startDate).startOf('month');
  const currentMonth = dayjs().startOf('month');
  const rawEnd = version?.expiryDate ? dayjs(version.expiryDate).startOf('month') : currentMonth;
  const end = rawEnd.isAfter(currentMonth) ? currentMonth : rawEnd;

  const options = [];
  let cursor = start;
  while (!cursor.isAfter(end)) {
    options.push({
      id: cursor.format('YYYY-MM'),
      label: cursor.format('MMM YYYY'),
      year: cursor.year(),
      month: cursor.month() + 1,
      periodKey: cursor.year() * 100 + (cursor.month() + 1),
    });
    cursor = cursor.add(1, 'month');
  }
  return options;
}

/** Full agreement calendar months (not capped to today) for payable-summary filters. */
function buildAgreementMonthOptions(version) {
  if (!version?.startDate || !version?.expiryDate) {
    return [];
  }
  const start = dayjs(version.startDate).startOf('month');
  const end = dayjs(version.expiryDate).startOf('month');
  const options = [];
  let cursor = start;
  while (!cursor.isAfter(end)) {
    options.push({
      id: cursor.format('YYYY-MM'),
      label: cursor.format('MMM YYYY'),
      year: cursor.year(),
      month: cursor.month() + 1,
      periodKey: cursor.year() * 100 + (cursor.month() + 1),
    });
    cursor = cursor.add(1, 'month');
  }
  return options;
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

function PayoutBreakdownTable({ items }) {
  return (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Period</TableCell>
            <TableCell align="right">Raw Qty</TableCell>
            <TableCell align="right">Raw Net Value</TableCell>
            <TableCell>Slab / Target Achieved</TableCell>
            <TableCell align="right">Qualifier Req.</TableCell>
            <TableCell align="right">Qualifier Achieved</TableCell>
            <TableCell align="right">Final Payout</TableCell>
            <TableCell>Status</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {items.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} align="center" sx={{ py: 5 }}>
                <Typography variant="body2" color="text.secondary">
                  No payout line items for the selected filters.
                </Typography>
              </TableCell>
            </TableRow>
          ) : (
            items.map((item, index) => {
              const qualifierBelowRequired = isQualifierBelowRequired(item);
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
  const isUnrestrictedGeo = isDataFeeVersion || version?.geographyMode === GEOGRAPHY_MODE.ALL;

  const [stateOptions, setStateOptions] = useState([]);
  const [cityOptions, setCityOptions] = useState([]);
  const [geoReady, setGeoReady] = useState(false);
  const [selectedPeriods, setSelectedPeriods] = useState(null);
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

  const periodOptions = useMemo(() => buildPeriodOptions(version), [
    version?.id,
    version?.startDate,
    version?.expiryDate,
  ]);
  const agreementMonthOptions = useMemo(() => buildAgreementMonthOptions(version), [
    version?.id,
    version?.startDate,
    version?.expiryDate,
  ]);
  const allPeriodIds = useMemo(
    () => periodOptions.map((option) => option.id),
    [periodOptions],
  );
  /** CC: no period picker — calc uses full contract calendar (start→expiry), not capped to today. */
  const allAgreementPeriodIds = useMemo(
    () => agreementMonthOptions.map((option) => option.id),
    [agreementMonthOptions],
  );
  const effectivePeriods = isCommercialContractsVersion
    ? allAgreementPeriodIds
    : (selectedPeriods ?? allPeriodIds);

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

  const stateSelectOptions = useMemo(
    () => stateOptions.map((state) => ({
      id: state.stateCode || state.code,
      label: (state.stateName || state.name)
        ? `${state.stateName || state.name} (${state.stateCode || state.code})`
        : (state.stateCode || state.code),
    })).filter((opt) => opt.id),
    [stateOptions],
  );

  const citySelectOptions = useMemo(
    () => cityOptions.map((city) => ({
      id: city.code || city.cityCode,
      label: city.stateCode
        ? `${city.name || city.cityName} (${city.code || city.cityCode}) · ${city.stateName || city.stateCode}`
        : `${city.name || city.cityName || ''} (${city.code || city.cityCode})`,
    })).filter((opt) => opt.id),
    [cityOptions],
  );

  useEffect(() => {
    let cancelled = false;
    setGeoReady(false);
    autoCalcKeyRef.current = null;
    setResult(null);
    setExploratoryAggregation(null);

    const loadScopedOptions = () => {
      const states = Array.isArray(version?.partnerStates) ? version.partnerStates : [];
      const cities = Array.isArray(version?.partnerCities) ? version.partnerCities : [];
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
      if (!cancelled) setGeoReady(true);
    };

    const loadUnrestrictedOptions = async () => {
      try {
        const { data: statesData } = await axiosInstance.get(ENDPOINTS.STATES);
        const states = Array.isArray(statesData)
          ? statesData.filter((state) => state.stateCode)
          : [];
        if (cancelled) return;
        setStateOptions(states);

        const cityResults = await Promise.all(
          states.map(async (state) => {
            try {
              const { data } = await integrationApi.searchCities(state.stateCode, '');
              return (Array.isArray(data) ? data : []).map((city) => ({
                code: city.code,
                name: city.name,
                stateCode: state.stateCode,
                stateName: state.stateName,
              }));
            } catch {
              return [];
            }
          }),
        );
        if (cancelled) return;
        const merged = [];
        const seen = new Set();
        cityResults.flat().forEach((city) => {
          if (!city?.code || seen.has(city.code)) return;
          seen.add(city.code);
          merged.push(city);
        });
        setCityOptions(merged);
      } catch {
        if (!cancelled) {
          setStateOptions([]);
          setCityOptions([]);
        }
      } finally {
        if (!cancelled) setGeoReady(true);
      }
    };

    if (isUnrestrictedGeo) {
      loadUnrestrictedOptions();
    } else {
      loadScopedOptions();
    }

    return () => { cancelled = true; };
  }, [isUnrestrictedGeo, version?.partnerStates, version?.partnerCities, version?.id]);

  // Auto-select full agreement scope once options are ready.
  useEffect(() => {
    if (!geoReady) return;
    setSelectedProductIds(productOptions.map((o) => o.id));
    setSelectedSupplierIds(supplierOptions.map((o) => o.id));
    if (isUnrestrictedGeo) {
      // Nationwide default — empty geo = no filter (Data Fee / ALL).
      setSelectedStateCodes([]);
      setSelectedCityCodes([]);
    } else {
      setSelectedStateCodes(stateSelectOptions.map((o) => o.id));
      setSelectedCityCodes(citySelectOptions.map((o) => o.id));
    }
    if (!isCommercialContractsVersion) {
      setSelectedPeriods(allPeriodIds);
    }
  }, [
    geoReady,
    productOptions,
    supplierOptions,
    stateSelectOptions,
    citySelectOptions,
    isUnrestrictedGeo,
    isCommercialContractsVersion,
    allPeriodIds,
  ]);

  const resolvePeriodsPayload = useCallback(() => {
    const sourceOptions = isCommercialContractsVersion ? agreementMonthOptions : periodOptions;
    const selectedIds = isCommercialContractsVersion ? allAgreementPeriodIds : effectivePeriods;
    return selectedIds
      .map((id) => sourceOptions.find((option) => option.id === id))
      .filter(Boolean)
      .map((option) => ({ month: option.month, year: option.year }));
  }, [
    isCommercialContractsVersion,
    agreementMonthOptions,
    periodOptions,
    allAgreementPeriodIds,
    effectivePeriods,
  ]);

  const handleCalculate = useCallback(async () => {
    if (!agreementVersionId) return;
    const periods = resolvePeriodsPayload();
    if (!periods.length) {
      enqueueSnackbar('No calculable periods available for this agreement.', { variant: 'warning' });
      return;
    }

    // Final payout: always full agreement scope (ignore UI filter deselections).
    const payoutRequest = {
      periods,
      productIds: null,
      supplierIds: null,
      stateCodes: null,
      cityCodes: null,
    };
    // Exploratory purchase KPIs: respect UI filters.
    const explorRequest = {
      periods,
      productIds: selectedProductIds.length ? selectedProductIds : null,
      supplierIds: selectedSupplierIds.length ? selectedSupplierIds : null,
      stateCodes: selectedStateCodes.length ? selectedStateCodes : null,
      cityCodes: selectedCityCodes.length ? selectedCityCodes : null,
    };

    setCalculating(true);
    try {
      const [payoutData, explorData] = await Promise.all([
        calculateCommercialPayouts(agreementVersionId, payoutRequest),
        aggregatePurchases(agreementVersionId, explorRequest),
      ]);
      setResult(payoutData);
      setExploratoryAggregation(explorData);
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
    resolvePeriodsPayload,
    selectedProductIds,
    selectedSupplierIds,
    selectedStateCodes,
    selectedCityCodes,
  ]);

  // Auto-calculate once after geo + selections initialized for this version.
  useEffect(() => {
    if (!geoReady || !agreementVersionId || !effectivePeriods.length) return;
    const key = `${agreementVersionId}:${effectivePeriods.length}:${productOptions.length}:${supplierOptions.length}`;
    if (autoCalcKeyRef.current === key) return;
    autoCalcKeyRef.current = key;
    handleCalculate();
  }, [
    geoReady,
    agreementVersionId,
    effectivePeriods.length,
    productOptions.length,
    supplierOptions.length,
    handleCalculate,
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

  if (!agreementVersionId) {
    return null;
  }

  return (
    <Box>
      <Paper elevation={0} sx={{ p: 2, borderRadius: 2, border: '1px solid', borderColor: 'divider', mb: 2 }}>
        <Typography fontWeight={600} sx={{ mb: 1.5 }}>Calculation Filters</Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
          Product / supplier / location filters explore purchase KPIs only. Final payout table always uses full agreement scope.
        </Typography>
        {periodOptions.length === 0 && !isCommercialContractsVersion ? (
          <Alert severity="info">
            No calculable periods available. The contract has no elapsed months up to the current date.
          </Alert>
        ) : isCommercialContractsVersion && agreementMonthOptions.length === 0 ? (
          <Alert severity="info">
            No contract months available. Set start and expiry dates on the agreement.
          </Alert>
        ) : (
          <Grid container spacing={2} alignItems="flex-start">
            {!isCommercialContractsVersion && (
              <Grid size={{ xs: 12, md: 3 }}>
                <FilterMultiSelect
                  label="Periods"
                  options={periodOptions}
                  value={effectivePeriods}
                  onChange={setSelectedPeriods}
                  allLabel="Select periods"
                />
              </Grid>
            )}
            <Grid size={{ xs: 12, md: isCommercialContractsVersion ? 4 : 3 }}>
              <FilterMultiSelect
                label="Products"
                options={productOptions}
                value={selectedProductIds}
                onChange={setSelectedProductIds}
                allLabel="All products"
                disabled={productOptions.length === 0}
              />
            </Grid>
            <Grid size={{ xs: 12, md: isCommercialContractsVersion ? 4 : 3 }}>
              <FilterMultiSelect
                label="Suppliers"
                options={supplierOptions}
                value={selectedSupplierIds}
                onChange={setSelectedSupplierIds}
                allLabel="All suppliers"
                disabled={supplierOptions.length === 0}
              />
            </Grid>
            <Grid size={{ xs: 12, md: isCommercialContractsVersion ? 4 : 3 }}>
              <FilterMultiSelect
                label="States"
                options={stateSelectOptions}
                value={selectedStateCodes}
                onChange={setSelectedStateCodes}
                allLabel={isUnrestrictedGeo ? 'All states (nationwide)' : 'Agreement states'}
                disabled={stateSelectOptions.length === 0}
              />
            </Grid>
            <Grid size={{ xs: 12, md: isCommercialContractsVersion ? 4 : 3 }}>
              <FilterMultiSelect
                label="Cities"
                options={citySelectOptions}
                value={selectedCityCodes}
                onChange={setSelectedCityCodes}
                allLabel={isUnrestrictedGeo ? 'All cities (nationwide)' : 'Agreement cities'}
                disabled={citySelectOptions.length === 0}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <Button
                variant="contained"
                color="primary"
                startIcon={calculating
                  ? <CircularProgress size={18} color="inherit" />
                  : <CalculateOutlined />}
                onClick={handleCalculate}
                disabled={calculating || !effectivePeriods.length}
              >
                {calculating ? 'Calculating…' : 'Calculate Payout'}
              </Button>
            </Grid>
          </Grid>
        )}
      </Paper>

      {result && (
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

          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
            {result.incomeType && <Chip label={`Income: ${result.incomeType}`} size="small" />}
            {result.commercialStructure && (
              <Chip label={`Structure: ${result.commercialStructure}`} size="small" variant="outlined" />
            )}
          </Box>

          {(result.notes ?? []).map((note, index) => (
            <Alert key={index} severity="info" sx={{ mb: 1 }}>{note}</Alert>
          ))}

          <Paper elevation={0} sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', mt: 1 }}>
            <Typography fontWeight={600} sx={{ p: 2, pb: 1 }}>Payout Breakdown</Typography>
            {lineItems.length === 0 ? (
              <Box sx={{ px: 2, pb: 3 }}>
                <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 5 }}>
                  No payout line items for the selected filters.
                </Typography>
              </Box>
            ) : groupedLineItems.length === 1 ? (
              <PayoutBreakdownTable items={groupedLineItems[0].items} />
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
                    <PayoutBreakdownTable items={group.items} />
                  </AccordionDetails>
                </Accordion>
              ))
            )}
          </Paper>

          {isCommercialContracts && (
            <Paper elevation={0} sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', mt: 2 }}>
              <Typography fontWeight={600} sx={{ p: 2, pb: 1 }}>Payable Periods</Typography>
              <Box sx={{ px: 2, pb: 2 }}>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <FilterMultiSelect
                      label="Year"
                      options={summaryYearOptions}
                      value={summaryYears}
                      onChange={setSummaryYears}
                      allLabel="All years"
                      disabled={summaryYearOptions.length === 0}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <FilterMultiSelect
                      label="Month"
                      options={summaryMonthOptions}
                      value={summaryMonths}
                      onChange={setSummaryMonths}
                      allLabel="All months"
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
