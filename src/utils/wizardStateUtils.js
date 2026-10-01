export function hasSubsequentStepData(state) {
  if (!state) return false;
  const { agreement, vendorIds, productRules } = state;
  const details = agreement?.details ?? {};
  const asset = agreement?.asset ?? {};
  const commercials = agreement?.commercials ?? {};
  const hasCombinations = Array.isArray(productRules?.combinations) && productRules.combinations.some(
    (c) => c?.manufacturerId || (c?.divisionRules?.length ?? 0) > 0 || (c?.productRules?.length ?? 0) > 0
  );
  return Boolean(
    vendorIds?.length
    || hasCombinations
    || productRules?.manufacturers?.length
    || productRules?.divisionRules?.length
    || productRules?.productRules?.length
    || details.documents?.length
    || details.invoiceVendorId
    || details.quantityCap
    || details.adhocSubType
    || asset?.assetType
    || asset?.assetCategory
    || commercials?.commercialValue
    || commercials?.enableSlabIncentives,
  );
}

export function incomeTypeChangedFromBaseline(baselineIncomeTypeId, currentIncomeTypeId) {
  if (baselineIncomeTypeId == null || currentIncomeTypeId == null) return false;
  return String(baselineIncomeTypeId) !== String(currentIncomeTypeId);
}

export function agreementTypeChangedFromBaseline(baselineAgreementTypeId, currentAgreementTypeId) {
  if (baselineAgreementTypeId == null || currentAgreementTypeId == null) return false;
  return String(baselineAgreementTypeId) !== String(currentAgreementTypeId);
}
