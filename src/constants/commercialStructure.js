export const PAYOUT_FREQUENCY = {
  ONE_TIME: 'ONE_TIME',
  MONTHLY: 'MONTHLY',
  QUARTERLY: 'QUARTERLY',
  HALF_YEARLY: 'HALF_YEARLY',
  YEARLY: 'YEARLY',
};

export const PAYOUT_FREQUENCY_OPTIONS = [
  { value: PAYOUT_FREQUENCY.MONTHLY, label: 'Monthly' },
  { value: PAYOUT_FREQUENCY.QUARTERLY, label: 'Quarterly' },
  { value: PAYOUT_FREQUENCY.HALF_YEARLY, label: 'Semi-Annual' },
  { value: PAYOUT_FREQUENCY.YEARLY, label: 'Annual' },
  { value: PAYOUT_FREQUENCY.ONE_TIME, label: 'One-Time' },
];

export const PAYMENT_REALIZATION_TYPE = {
  DIRECT_PAYMENT_INVOICE: 'DIRECT_PAYMENT_INVOICE',
  CREDIT_NOTE: 'CREDIT_NOTE',
  INVOICE_DISCOUNT: 'INVOICE_DISCOUNT',
};

export const PAYMENT_REALIZATION_OPTIONS = [
  { value: PAYMENT_REALIZATION_TYPE.DIRECT_PAYMENT_INVOICE, label: 'Invoice' },
  { value: PAYMENT_REALIZATION_TYPE.CREDIT_NOTE, label: 'Credit Note' },
  { value: PAYMENT_REALIZATION_TYPE.INVOICE_DISCOUNT, label: 'On Invoice Discount' },
];

export const STRUCTURE_TYPE = {
  FLAT: 'FLAT',
  SLABS: 'SLABS',
  LEGACY_HYBRID: 'LEGACY_HYBRID',
};

/** @deprecated Hybrid model removed — use resolveStructureType */
export function resolveCommercialStructure(enableFlatBaseline, enableSlabIncentives) {
  if (enableFlatBaseline && enableSlabIncentives) return 'HYBRID';
  if (enableFlatBaseline) return 'FLAT';
  if (enableSlabIncentives) return 'SLAB';
  return null;
}

/** @deprecated Hybrid model removed — use resolveStructureType */
export function deriveHybridFlags(commercialStructure) {
  const structureType = resolveStructureType(commercialStructure);
  return {
    enableFlatBaseline: structureType === STRUCTURE_TYPE.FLAT,
    enableSlabIncentives: structureType === STRUCTURE_TYPE.SLABS,
  };
}

export function resolveStructureType(commercialStructure) {
  if (commercialStructure === 'SLAB') return STRUCTURE_TYPE.SLABS;
  if (commercialStructure === 'FLAT') return STRUCTURE_TYPE.FLAT;
  if (commercialStructure === 'HYBRID') return STRUCTURE_TYPE.LEGACY_HYBRID;
  return STRUCTURE_TYPE.FLAT;
}

export function toCommercialStructure(structureType) {
  if (structureType === STRUCTURE_TYPE.SLABS) return 'SLAB';
  return 'FLAT';
}

export function structureTypeToRadioValue(structureType) {
  if (structureType === STRUCTURE_TYPE.SLABS) return 'SLABS';
  if (structureType === STRUCTURE_TYPE.FLAT) return 'FLAT';
  return '';
}

export function resolveFlatBaselineFrequency(
  commercials = {},
  { adhocSubType = null, lockOneTime = false } = {},
) {
  if (commercials.flatBaselineFrequency) {
    return commercials.flatBaselineFrequency;
  }
  if (lockOneTime || adhocSubType === 'QPS') {
    return PAYOUT_FREQUENCY.ONE_TIME;
  }
  return PAYOUT_FREQUENCY.MONTHLY;
}
