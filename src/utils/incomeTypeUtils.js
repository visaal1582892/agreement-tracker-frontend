import { INCOME_TYPE_NAMES } from '../constants/incomeTypeNames';

export function resolveIncomeTypeName(incomeTypes, incomeTypeId, incomeTypeName = null) {
  if (incomeTypeName) return incomeTypeName;
  if (!incomeTypeId || !incomeTypes?.length) return null;
  const match = incomeTypes.find(
    (type) => type.id === incomeTypeId || String(type.id) === String(incomeTypeId),
  );
  return match?.name ?? null;
}

/** Merge wizard state + hydrated API row for income-type checks. */
export function resolveWizardIncomeContext(state, sourceAgreement = null, incomeTypes = []) {
  const details = state?.agreement?.details ?? {};
  return {
    incomeTypes,
    incomeTypeId: details.incomeTypeId ?? sourceAgreement?.incomeTypeId ?? null,
    incomeTypeName: details.incomeTypeName ?? sourceAgreement?.incomeTypeName ?? null,
  };
}

export function isAssetRentalIncomeType(incomeTypes, incomeTypeId, incomeTypeName = null) {
  const name = resolveIncomeTypeName(incomeTypes, incomeTypeId, incomeTypeName);
  return name === INCOME_TYPE_NAMES.ASSET_RENTALS;
}

export function isAdHocIncomeType(incomeTypes, incomeTypeId, incomeTypeName = null) {
  return resolveIncomeTypeName(incomeTypes, incomeTypeId, incomeTypeName) === INCOME_TYPE_NAMES.AD_HOC_ACTIVITIES;
}

export function isCommercialContractsIncomeType(incomeTypes, incomeTypeId, incomeTypeName = null) {
  return resolveIncomeTypeName(incomeTypes, incomeTypeId, incomeTypeName) === INCOME_TYPE_NAMES.COMMERCIAL_CONTRACTS;
}

export function isDataFeeIncomeType(incomeTypes, incomeTypeId, incomeTypeName = null) {
  return resolveIncomeTypeName(incomeTypes, incomeTypeId, incomeTypeName) === INCOME_TYPE_NAMES.DATA_FEE;
}
