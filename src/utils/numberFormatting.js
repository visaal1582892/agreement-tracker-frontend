const currencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
});

export function formatAssetMoney(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? currencyFormatter.format(numeric) : '—';
}

export function formatCommercialValue(value, valueType) {
  if (value === null || value === undefined || value === '') return '—';
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return value;

  if (valueType === 'PERCENTAGE') {
    return `${numeric}%`;
  }
  return currencyFormatter.format(numeric);
}
