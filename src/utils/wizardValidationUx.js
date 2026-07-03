export const WIZARD_FIELD_SCROLL_ORDER = [
  'supplyVendors',
  'assetCategory',
  'assetType',
  'adhocSubType',
  'products',
  'states',
  'storeCount',
  'quantityCap',
  'paymentRealization',
  'leadTimeBasis',
  'invoiceGenerationLeadTime',
  'payoutBufferDays',
  'calculationBasis',
  'invoiceVendor',
  'documents',
  'commercialComponent',
  'jbpStructure',
  'commercialValue',
  'flatBaselineFrequency',
  'flatPayout',
  'assetPayoutPeriods',
  'payoutPerStore',
  'storeMappings',
  'slabs',
];

export function getFirstWizardFieldErrorMessage(fieldErrors = {}) {
  for (const field of WIZARD_FIELD_SCROLL_ORDER) {
    if (fieldErrors[field]) return fieldErrors[field];
  }
  return 'Please complete required fields';
}

export function getCommercialStepErrorSnackbar(fieldErrors = {}) {
  if (fieldErrors.storeMappings?.startsWith('Reconciliation Lock')) {
    return { message: fieldErrors.storeMappings, variant: 'error' };
  }
  return { message: getFirstWizardFieldErrorMessage(fieldErrors), variant: 'warning' };
}

export function scrollToFirstWizardError(fieldErrors = {}, delayMs = 150) {
  setTimeout(() => {
    for (const field of WIZARD_FIELD_SCROLL_ORDER) {
      if (!fieldErrors[field]) continue;
      const el = document.querySelector(`[data-wizard-field="${field}"]`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
    }
    const fallback = document.querySelector('.has-error');
    if (fallback) {
      fallback.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, delayMs);
}
