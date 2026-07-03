import { resolveStructureType, resolveFlatBaselineFrequency, PAYOUT_FREQUENCY } from '../constants/commercialStructure';
import { isAdHocIncomeType, isAssetRentalIncomeType, isCommercialContractsIncomeType } from './incomeTypeUtils';
import { ADHOC_SUB_TYPES } from '../constants/adhocSubTypes';

const BLANK_ASSET = {
  assetCategory: 'PHYSICAL_ASSET',
  assetType: '',
  storeCount: '',
  payoutMode: 'FLAT',
  flatPayout: '',
  payoutPerStore: '',
  assetPayoutPeriods: [],
  remarks: '',
};

export function resolveIncomeTypeProfile(incomeTypes, incomeTypeId, incomeTypeName = null) {
  if (isAssetRentalIncomeType(incomeTypes, incomeTypeId, incomeTypeName)) return 'ASSET_RENTAL';
  if (isCommercialContractsIncomeType(incomeTypes, incomeTypeId, incomeTypeName)) return 'COMMERCIAL_CONTRACTS';
  if (isAdHocIncomeType(incomeTypes, incomeTypeId, incomeTypeName)) return 'AD_HOC';
  return 'STANDARD';
}

export function buildIncomeTypeSwitchUpdates(incomeTypes, previousDetails, nextDetails) {
  const prevId = previousDetails?.incomeTypeId;
  const nextId = nextDetails?.incomeTypeId;
  if (prevId == null || String(prevId) === String(nextId)) {
    return null;
  }

  const prevProfile = resolveIncomeTypeProfile(
    incomeTypes,
    previousDetails.incomeTypeId,
    previousDetails.incomeTypeName,
  );
  const nextProfile = resolveIncomeTypeProfile(
    incomeTypes,
    nextDetails.incomeTypeId,
    nextDetails.incomeTypeName,
  );

  const updates = {
    details: {},
    resetAsset: false,
    resetCommercials: false,
    clearProductRules: false,
  };

  if (nextProfile !== 'AD_HOC') {
    updates.details.adhocSubType = null;
    updates.details.quantityCap = '';
  }
  if (nextProfile !== 'ASSET_RENTAL') {
    updates.resetAsset = true;
  }
  if (nextProfile === 'ASSET_RENTAL') {
    updates.clearProductRules = true;
  }
  if (prevProfile !== nextProfile) {
    updates.details.stateIds = [];
  }
  if (nextProfile === 'AD_HOC' || prevProfile === 'AD_HOC') {
    updates.resetCommercials = true;
  }
  if (nextProfile === 'AD_HOC') {
    updates.details.adhocSubType = ADHOC_SUB_TYPES.QPS;
    updates.details.quantityCap = '';
  }

  return updates;
}

export function sanitizeAgreementPayload(payload, incomeTypes, incomeTypeId, incomeTypeName = null) {
  const profile = resolveIncomeTypeProfile(incomeTypes, incomeTypeId, incomeTypeName);
  const sanitized = {
    ...payload,
    details: payload.details ? { ...payload.details } : {},
    commercials: payload.commercials ? { ...payload.commercials } : {},
  };

  if (profile === 'ASSET_RENTAL') {
    sanitized.productRules = { manufacturers: [], divisionRules: [], productRules: [] };
    sanitized.details.adhocSubType = null;
    sanitized.details.quantityCap = null;
    sanitized.details.calculationBasis = null;
    sanitized.commercials = {
      commercialStructure: null,
      commercialValue: null,
      flatValueType: null,
      flatBaselineFrequency: null,
      enableFlatBaseline: false,
      enableSlabIncentives: false,
      calculationFormula: null,
    };
    if (sanitized.asset?.assetCategory === 'ACTIVITY') {
      sanitized.asset.assetType = null;
    } else if (!sanitized.asset?.assetType?.trim()) {
      sanitized.asset = null;
    }
  } else if (profile === 'COMMERCIAL_CONTRACTS') {
    const structureType = resolveStructureType(sanitized.commercials.commercialStructure);
    const useSlabs = structureType === 'SLABS' || sanitized.commercials.jbpCommitted;
    if (useSlabs) {
      sanitized.commercials.commercialStructure = 'SLAB';
      sanitized.commercials.enableFlatBaseline = false;
      sanitized.commercials.enableSlabIncentives = true;
      sanitized.commercials.commercialValue = null;
      sanitized.commercials.flatValueType = null;
      sanitized.commercials.flatBaselineFrequency = null;
    } else {
      sanitized.commercials.commercialStructure = 'FLAT';
      sanitized.commercials.enableFlatBaseline = true;
      sanitized.commercials.enableSlabIncentives = false;
      sanitized.commercials.flatBaselineFrequency = resolveFlatBaselineFrequency(
        sanitized.commercials,
        { adhocSubType: sanitized.details.adhocSubType },
      );
    }
  } else {
    sanitized.asset = null;
    if (profile !== 'AD_HOC') {
      sanitized.details.adhocSubType = null;
      sanitized.details.quantityCap = null;
    } else {
      sanitized.details.adhocSubType = ADHOC_SUB_TYPES.QPS;
      sanitized.details.quantityCap = null;
    }

    const structureType = resolveStructureType(sanitized.commercials.commercialStructure);
    sanitized.commercials.enableFlatBaseline = structureType === 'FLAT';
    sanitized.commercials.enableSlabIncentives = structureType === 'SLABS';
    sanitized.commercials.commercialStructure = structureType === 'SLABS' ? 'SLAB' : 'FLAT';
    if (structureType === 'FLAT') {
      sanitized.commercials.flatBaselineFrequency = resolveFlatBaselineFrequency(
        sanitized.commercials,
        { adhocSubType: sanitized.details.adhocSubType },
      );
    } else {
      sanitized.commercials.flatBaselineFrequency = null;
      sanitized.commercials.commercialValue = null;
    }
  }

  return sanitized;
}

export { BLANK_ASSET };
