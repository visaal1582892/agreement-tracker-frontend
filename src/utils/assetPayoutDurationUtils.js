import dayjs from 'dayjs';

/** Must match backend AssetPayoutDurationValidator — average Gregorian month length. */
export const ASSET_AVERAGE_DAYS_PER_MONTH = 30.44;

/**
 * Inclusive tenure days: expiry day counts.
 * @returns {number|null} null when dates missing/invalid or expiry before start
 */
export function computeInclusiveAgreementDays(startDate, expiryDate) {
  if (!startDate || !expiryDate) return null;
  const start = dayjs(startDate).startOf('day');
  const expiry = dayjs(expiryDate).startOf('day');
  if (!start.isValid() || !expiry.isValid()) return null;
  const exclusiveDays = expiry.diff(start, 'day');
  if (exclusiveDays < 0) return null;
  return exclusiveDays + 1;
}

/**
 * Ceiling months from inclusive day span: Math.ceil(days / 30.44).
 * @returns {number|null}
 */
export function computeMaxAllowedAssetPayoutMonths(startDate, expiryDate) {
  const days = computeInclusiveAgreementDays(startDate, expiryDate);
  if (days == null || days <= 0) return null;
  return Math.ceil(days / ASSET_AVERAGE_DAYS_PER_MONTH);
}

export function sumAssetPayoutPeriodMonths(periods = []) {
  return (periods ?? []).reduce((sum, period) => {
    const months = Number(period?.periodMonths);
    if (!Number.isFinite(months) || months <= 0) return sum;
    return sum + Math.trunc(months);
  }, 0);
}

/**
 * Evaluate Per-Store schedule vs agreement duration.
 * @returns {{ status: 'skip'|'ok'|'error'|'warn', sum: number, maxAllowedMonths: number|null, message: string|null }}
 */
export function evaluateAssetPayoutDuration({
  payoutMode,
  periods,
  startDate,
  expiryDate,
} = {}) {
  if (payoutMode !== 'PER_STORE') {
    return { status: 'skip', sum: 0, maxAllowedMonths: null, message: null };
  }

  const maxAllowedMonths = computeMaxAllowedAssetPayoutMonths(startDate, expiryDate);
  if (maxAllowedMonths == null) {
    return { status: 'skip', sum: 0, maxAllowedMonths: null, message: null };
  }

  const sum = sumAssetPayoutPeriodMonths(periods);
  if (sum <= 0) {
    return { status: 'skip', sum, maxAllowedMonths, message: null };
  }

  if (sum > maxAllowedMonths) {
    return {
      status: 'error',
      sum,
      maxAllowedMonths,
      message:
        `Error: You have scheduled ${sum} months, but the inclusive agreement duration `
        + `only allows a maximum of ${maxAllowedMonths} months.`,
    };
  }

  if (sum < maxAllowedMonths) {
    return {
      status: 'warn',
      sum,
      maxAllowedMonths,
      message:
        `Warning: You have only scheduled ${sum} months, which is less than the agreement's `
        + `total duration of ${maxAllowedMonths} months. Proceed if this is intentional.`,
    };
  }

  return { status: 'ok', sum, maxAllowedMonths, message: null };
}

/** True when Next/Submit must be hard-disabled for Asset Per-Store duration exceed. */
export function isAssetPayoutDurationBlocked(params) {
  return evaluateAssetPayoutDuration(params).status === 'error';
}
