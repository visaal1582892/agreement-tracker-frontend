export const INCOME_TYPE_NAMES = {
  DATA_FEE: 'Data Fee',
  COMMERCIAL_CONTRACTS: 'Commercial Contracts',
  ASSET_RENTALS: 'Asset Rentals',
  AD_HOC_ACTIVITIES: 'Ad-Hoc Activities',
};

/** UI-only labels; API matching still uses INCOME_TYPE_NAMES */
export const INCOME_TYPE_DISPLAY_NAMES = {
  DATA_FEE: 'Data Fee',
  COMMERCIAL_CONTRACTS: 'Commercial Contacts',
  ASSET_RENTALS: 'Asset Rentals',
  AD_HOC_ACTIVITIES: 'Ad-Hoc Activities',
};

export function getIncomeTypeDisplayName(name) {
  return INCOME_TYPE_DISPLAY_NAMES[name] || name || '—';
}
