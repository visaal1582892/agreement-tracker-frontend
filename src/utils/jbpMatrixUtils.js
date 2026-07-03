import { PAYOUT_FREQUENCY, PAYOUT_FREQUENCY_OPTIONS } from '../constants/commercialStructure';

const JBP_FREQUENCY_OPTIONS = PAYOUT_FREQUENCY_OPTIONS.filter(
  (option) => option.value !== PAYOUT_FREQUENCY.ONE_TIME,
);

const FINANCIAL_YEAR_START_MONTH_OPTIONS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
];

const FREQUENCY_RANK = {
  [PAYOUT_FREQUENCY.YEARLY]: 4,
  [PAYOUT_FREQUENCY.HALF_YEARLY]: 3,
  [PAYOUT_FREQUENCY.QUARTERLY]: 2,
  [PAYOUT_FREQUENCY.MONTHLY]: 1,
};

export function resolveMasterFrequency(selectedFrequencies) {
  if (!selectedFrequencies.length) return null;
  return [...selectedFrequencies].sort((a, b) => (FREQUENCY_RANK[b] ?? 0) - (FREQUENCY_RANK[a] ?? 0))[0];
}

export function resolveChildFrequencies(selectedFrequencies, masterFrequency) {
  if (!masterFrequency) return [];
  const masterRank = FREQUENCY_RANK[masterFrequency] ?? 0;
  return selectedFrequencies
    .filter((freq) => (FREQUENCY_RANK[freq] ?? 0) < masterRank)
    .sort((a, b) => (FREQUENCY_RANK[b] ?? 0) - (FREQUENCY_RANK[a] ?? 0));
}

export function createJbpConfig(index = 1) {
  return {
    id: String(index),
    parentPeriodIds: [],
    slabCount: 1,
  };
}

export function mapConfigurationsFromApi(configurations) {
  if (!Array.isArray(configurations) || configurations.length === 0) return null;
  return configurations.map((config, index) => ({
    id: config.configId ?? String(index + 1),
    parentPeriodIds: config.parentPeriodIds ?? [],
    slabCount: config.slabCount ?? 1,
  }));
}

export function formatJbpNumber(value) {
  if (value == null || value === '') return '—';
  return Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export function jbpFrequencyLabel(value) {
  return JBP_FREQUENCY_OPTIONS.find((option) => option.value === value)?.label ?? value.replace(/_/g, ' ');
}

export function resolveFinancialYearStartMonth(commercials = {}) {
  const value = Number(commercials.financialYearStartMonth);
  if (Number.isInteger(value) && value >= 1 && value <= 12) {
    return value;
  }
  return 4;
}

export function resolveJbpReviewHeaders(sheet) {
  if (sheet?.master) {
    return {
      period: 'Period',
      parentPeriod: null,
      subPeriod: null,
      slabTier: 'Slab Tier',
      targetType: 'Target Type',
      target: 'Target',
      qualifierPercent: 'Qualifier %',
      payoutType: 'Payout Type',
      payout: 'Payout',
      maxPurchase: 'Max Purchase (Optional)',
      maxPayout: 'Max Payout (Optional)',
    };
  }
  return {
    period: null,
    parentPeriod: 'Parent Period',
    subPeriod: 'Sub Period',
    slabTier: 'Slab Tier',
    targetType: 'Target Type',
    target: 'Target',
    qualifierPercent: 'Qualifier %',
    payoutType: 'Payout Type (Optional)',
    payout: 'Payout (Optional)',
    maxPurchase: 'Max Purchase (Optional)',
    maxPayout: 'Max Payout (Optional)',
  };
}

export function flattenJbpReviewRows(sheet) {
  const highestParentTier = sheet?.master === true;
  return (sheet?.rows ?? []).map((row) => ({
    key: `${row.timePeriodId}-${row.jbpConfigurationId}-${row.slabTierNumber}`,
    parentPeriodDisplay: row.firstInParentGroup ? row.parentPeriodName : '',
    subPeriodName: row.subPeriodName ?? (sheet.master ? '' : '—'),
    periodName: sheet.master ? row.parentPeriodName : null,
    slabTier: row.slabTierLabel || `Slab ${row.slabTierNumber}`,
    targetType: highestParentTier ? 'ABSOLUTE' : (row.targetType ?? '—'),
    targetTypeLocked: highestParentTier,
    target: formatJbpNumber(row.target),
    qualifierPercent: formatJbpNumber(row.qualifierPercent),
    payoutType: row.payoutType ?? '—',
    payout: formatJbpNumber(row.payout),
    maxPurchase: formatJbpNumber(row.maxPurchase),
    maxPayout: formatJbpNumber(row.maxPayout),
    parentBold: row.firstInParentGroup,
  }));
}

export { JBP_FREQUENCY_OPTIONS, FINANCIAL_YEAR_START_MONTH_OPTIONS };
