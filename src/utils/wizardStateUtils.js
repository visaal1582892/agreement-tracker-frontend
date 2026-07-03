export function hasSubsequentStepData(state) {
  if (!state) return false;
  const { agreement, vendorIds, productRules } = state;
  const details = agreement?.details ?? {};
  const asset = agreement?.asset ?? {};
  const commercials = agreement?.commercials ?? {};
  return Boolean(
    vendorIds?.length
    || productRules?.manufacturers?.length
    || productRules?.divisionRules?.length
    || productRules?.productRules?.length
    || details.documents?.length
    || details.invoiceVendorId
    || details.quantityCap
    || details.adhocSubType
    || asset?.assetType
    || asset?.storeCount
    || commercials?.commercialValue
    || commercials?.enableSlabIncentives,
  );
}

export function incomeTypeChangedFromBaseline(baselineIncomeTypeId, currentIncomeTypeId) {
  if (baselineIncomeTypeId == null || currentIncomeTypeId == null) return false;
  return String(baselineIncomeTypeId) !== String(currentIncomeTypeId);
}
