const SCALE = 4;

function round(value) {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** SCALE;
  return Math.round(value * factor) / factor;
}

const roundToTwo = (num) => {
  if (num == null) return null;
  return Number(Math.round(num + "e+2") + "e-2");
};

function parseNumber(value) {
  if (value === '' || value == null) return null;
  const numeric = Number(value);
  return Number.isNaN(numeric) ? null : numeric;
}

function resolveDiscountTypeKey(discountType, discountTypeLabel) {
  if (discountType) return discountType;
  if (!discountTypeLabel) return '';
  return discountTypeLabel.trim().toUpperCase().replace(/ /g, '_');
}

export function sumLocationAllocations(allocations = {}) {
  return Object.values(allocations).reduce((total, rawQty) => {
    const qty = parseNumber(rawQty);
    return total + (qty != null && qty > 0 ? qty : 0);
  }, 0);
}

export function calculateDurationMonths(startDate, endDate) {
  if (!startDate || !endDate) return 1;
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 1;
  let months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  if (end.getDate() > start.getDate()) {
    months += 1;
  }
  return Math.max(1, months);
}

export function calculateCreditNote({
  totalQty,
  baseOffer,
  mrp,
  discountType,
  discountTypeLabel,
}) {
  const qty = parseNumber(totalQty) ?? 0;
  const offer = parseNumber(baseOffer);
  if (!qty || offer == null || offer === 0) return 0;

  const type = resolveDiscountTypeKey(discountType, discountTypeLabel);
  if (type.includes('VAL')) {
    return round(offer * qty);
  }
  if (type.includes('PERCENT') || type.includes('%')) {
    const mrpValue = parseNumber(mrp);
    if (mrpValue == null || mrpValue <= 0) return 0;
    return round((mrpValue * offer / 100) * qty);
  }
  return 0;
}

/**
 * Final margin fraction (same as backend PriceOffCalculationUtil / Excel):
 * baseMargin = (MRP - CP) / MRP
 * Disc_%: baseMargin - (medplusContribution / 100)
 * Disc_Val: baseMargin - (medplusContribution / MRP)
 * medplusContribution = Column K (Medplus price-off; Base Offer excluded).
 */
export function calculateFinalMarginPercent({
  discountType,
  discountTypeLabel,
  cp,
  mrp,
  medplusContribution,
}) {
  const cpValue = parseNumber(cp);
  const mrpValue = parseNumber(mrp);
  if (cpValue == null || mrpValue == null || mrpValue <= 0) {
    return null;
  }

  const discount = parseNumber(medplusContribution) ?? 0;
  const baseMargin = ((mrpValue - cpValue) / mrpValue) * 100;
  const type = resolveDiscountTypeKey(discountType, discountTypeLabel);

  if (type.includes('PERCENT') || type.includes('%') || discountType === 'DISC_PERCENT') {
    return round(baseMargin - discount);
  }
  if (type.includes('VAL') || discountType === 'DISC_VAL') {
    return round(baseMargin - (discount / mrpValue) * 100);
  }
  return round(baseMargin);
}

export function calculateDerivedFields({
  discountType,
  discountTypeLabel,
  cp,
  mrp,
  baseOffer,
  medplusContribution,
  allocations,
  startDate,
  endDate,
}) {
  const totalQty = sumLocationAllocations(allocations);
  const cpValue = parseNumber(cp);
  const mrpValue = parseNumber(mrp);
  const baseOfferValue = parseNumber(baseOffer) ?? 0;
  const medplusValue = parseNumber(medplusContribution) ?? 0;

  const creditNote = calculateCreditNote({
    totalQty,
    baseOffer: baseOfferValue,
    mrp: mrpValue,
    discountType,
    discountTypeLabel,
  });

  if (cpValue == null || cpValue <= 0 || mrpValue == null || mrpValue <= 0) {
    return {
      totalQty,
      creditNote,
      durationMonths: calculateDurationMonths(startDate, endDate),
      marginPercent: null,
      finalOffer: null,
      percentOff: null,
      finalMarginPercent: null,
      isNegativeMargin: false,
    };
  }

  if (baseOfferValue < 0 || medplusValue < 0) {
    return {
      totalQty,
      creditNote,
      durationMonths: calculateDurationMonths(startDate, endDate),
      marginPercent: null,
      finalOffer: null,
      percentOff: null,
      finalMarginPercent: null,
      isNegativeMargin: true,
    };
  }

  const marginPercent = round(((mrpValue - cpValue) / mrpValue) * 100);
  const finalOffer = round(baseOfferValue + medplusValue);

  let percentOff;
  if (discountType === 'DISC_PERCENT') {
    percentOff = round(finalOffer);
  } else {
    percentOff = round((finalOffer / mrpValue) * 100);
  }

  const finalMarginPercent = calculateFinalMarginPercent({
    discountType,
    discountTypeLabel,
    cp: cpValue,
    mrp: mrpValue,
    medplusContribution: medplusValue,
  });

  return {
    totalQty,
    creditNote: roundToTwo(creditNote),
    durationMonths: calculateDurationMonths(startDate, endDate),
    marginPercent: roundToTwo(marginPercent),
    finalOffer: roundToTwo(finalOffer),
    percentOff: roundToTwo(percentOff),
    finalMarginPercent: roundToTwo(finalMarginPercent),
    isNegativeMargin: finalMarginPercent != null && finalMarginPercent < 0,
  };
}
