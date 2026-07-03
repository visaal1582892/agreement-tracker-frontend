import { fetchSlabs } from '../api/commercialApi';
import { fetchStoreMappings } from '../api/storeMappingApi';
import { formatLocalDateString } from './dateUtils';
import { isAdHocIncomeType, isAssetRentalIncomeType, isCommercialContractsIncomeType, isDataFeeIncomeType, resolveWizardIncomeContext } from './incomeTypeUtils';
import { sanitizeAgreementPayload } from './incomeTypePayloadUtils';
import { CALCULATION_BASIS } from '../constants/calculationBasis';
import {
  deriveHybridFlags,
  PAYMENT_REALIZATION_TYPE,
  PAYOUT_FREQUENCY,
  resolveCommercialStructure,
  resolveFlatBaselineFrequency,
  resolveStructureType,
  STRUCTURE_TYPE,
  toCommercialStructure,
} from '../constants/commercialStructure';
import { LEAD_TIME_BASIS } from '../constants/leadTimeBasis';
import { getCommercialStepErrorSnackbar, getFirstWizardFieldErrorMessage } from './wizardValidationUx';

function validateParticipatingStoreCount(asset) {
  const raw = asset?.storeCount;
  if (raw === '' || raw == null) {
    return 'Number of participating stores is required';
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed <= 0) {
    return 'Enter a whole number greater than 0 for participating stores';
  }
  return null;
}

export function mapCommercialsFromApi(agreement, slabCount = null) {
  const jbpCommitted = Boolean(agreement.jbpCommitted);
  const structure = jbpCommitted
    ? 'SLAB'
    : (agreement.commercialStructure ?? 'FLAT');
  const structureType = resolveStructureType(structure);
  const enableFlatBaseline = structureType === STRUCTURE_TYPE.FLAT;
  const enableSlabIncentives = structureType === STRUCTURE_TYPE.SLABS;

  let commercialStructure = structure;
  if (slabCount === 0 && structureType === STRUCTURE_TYPE.SLABS && !jbpCommitted) {
    commercialStructure = 'FLAT';
  }

  return {
    commercialStructure,
    commercialValue: agreement.commercialValue ?? '',
    valueType: agreement.flatValueType ?? agreement.valueType ?? 'FIXED',
    flatValueType: agreement.flatValueType ?? agreement.valueType ?? 'FIXED',
    flatBaselineFrequency: agreement.flatBaselineFrequency
      || (agreement.adhocSubType === 'QPS' ? PAYOUT_FREQUENCY.ONE_TIME : PAYOUT_FREQUENCY.MONTHLY),
    enableFlatBaseline: resolveStructureType(commercialStructure) === STRUCTURE_TYPE.FLAT,
    enableSlabIncentives: resolveStructureType(commercialStructure) === STRUCTURE_TYPE.SLABS,
    calculationFormula: agreement.calculationFormula ?? '',
    selectedFrequencies: [],
    slabType: 'PURCHASE',
    slabCapUnit: 'RUPEES',
    jbpCommitted,
    financialYearStartMonth: agreement.financialYearStartMonth ?? 4,
  };
}

export function withCommercialsOverride(state, commercialsOverride) {
  if (!commercialsOverride) return state;
  return {
    ...state,
    agreement: {
      ...state.agreement,
      commercials: {
        ...state.agreement?.commercials,
        ...commercialsOverride,
      },
    },
  };
}

export async function fetchSlabCountForVersion(versionId) {
  if (!versionId) return null;
  try {
    const slabs = await fetchSlabs(versionId);
    return Array.isArray(slabs) ? slabs.length : 0;
  } catch {
    return null;
  }
}

function buildAssetPayload(asset) {
  if (!asset) return null;
  const assetCategory = asset.assetCategory || null;
  if (!assetCategory) return null;
  const assetType = asset.assetType?.trim();
  if (assetCategory !== 'ACTIVITY' && !assetType) return null;
  const payoutMode = asset.payoutMode || 'FLAT';
  const assetPayoutPeriods = payoutMode === 'PER_STORE'
    ? (asset.assetPayoutPeriods ?? [])
      .filter((period) => period.periodMonths !== '' && period.payoutPerStore !== '' && period.payoutPerStore != null)
      .map((period) => ({
        periodMonths: Number(period.periodMonths),
        payoutPerStore: period.payoutPerStore,
      }))
    : null;

  return {
    assetCategory,
    assetType: assetCategory === 'ACTIVITY' ? null : assetType,
    storeCount: asset.storeCount !== '' && asset.storeCount != null
      ? Number(asset.storeCount)
      : null,
    flatPayout: payoutMode === 'FLAT' && asset.flatPayout !== '' && asset.flatPayout != null
      ? asset.flatPayout
      : null,
    payoutPerStore: null,
    remarks: asset.remarks?.trim() || null,
    assetPayoutPeriods,
  };
}

function scrubSettlementLeadTimeFields(details = {}) {
  const paymentType = details.paymentRealizationType || PAYMENT_REALIZATION_TYPE.DIRECT_PAYMENT_INVOICE;
  const scrubbed = { ...details };

  if (paymentType === PAYMENT_REALIZATION_TYPE.INVOICE_DISCOUNT) {
    scrubbed.payoutBufferDays = null;
    scrubbed.leadTimeBasis = null;
    scrubbed.invoiceGenerationLeadTime = null;
    return scrubbed;
  }

  if (paymentType === PAYMENT_REALIZATION_TYPE.CREDIT_NOTE) {
    scrubbed.leadTimeBasis = null;
    scrubbed.invoiceGenerationLeadTime = null;
    return scrubbed;
  }

  if (paymentType === PAYMENT_REALIZATION_TYPE.DIRECT_PAYMENT_INVOICE) {
    if (scrubbed.leadTimeBasis === LEAD_TIME_BASIS.ACTIVITY_COMPLETION_DATE) {
      scrubbed.invoiceGenerationLeadTime = null;
    } else if (scrubbed.leadTimeBasis !== LEAD_TIME_BASIS.INVOICE_DATE) {
      scrubbed.invoiceGenerationLeadTime = null;
    }
  }

  return scrubbed;
}

export function buildAgreementDetailsPayload(agreement) {
  if (!agreement) {
    return { details: {}, commercials: {} };
  }
  const { details, commercials } = agreement;
  const scrubbedDetails = scrubSettlementLeadTimeFields(details ?? {});
  return {
    details: {
      incomeTypeId: scrubbedDetails.incomeTypeId || null,
      agreementTypeId: scrubbedDetails.agreementTypeId || null,
      startDate: formatLocalDateString(scrubbedDetails.startDate),
      expiryDate: formatLocalDateString(scrubbedDetails.expiryDate),
      notes: scrubbedDetails.notes || null,
      stateIds: scrubbedDetails.stateIds?.length ? scrubbedDetails.stateIds : [],
      adhocSubType: scrubbedDetails.adhocSubType || null,
      quantityCap: scrubbedDetails.quantityCap !== '' && scrubbedDetails.quantityCap != null
        ? scrubbedDetails.quantityCap
        : null,
      invoiceVendorId: scrubbedDetails.invoiceVendorId || null,
      payoutBufferDays: scrubbedDetails.payoutBufferDays !== '' && scrubbedDetails.payoutBufferDays != null
        ? Number(scrubbedDetails.payoutBufferDays)
        : null,
      leadTimeBasis: scrubbedDetails.leadTimeBasis || null,
      invoiceGenerationLeadTime: scrubbedDetails.invoiceGenerationLeadTime !== ''
        && scrubbedDetails.invoiceGenerationLeadTime != null
        ? Number(scrubbedDetails.invoiceGenerationLeadTime)
        : null,
      calculationBasis: scrubbedDetails.calculationBasis || CALCULATION_BASIS.VENDOR_INVOICE,
      paymentRealizationType: scrubbedDetails.paymentRealizationType || PAYMENT_REALIZATION_TYPE.DIRECT_PAYMENT_INVOICE,
    },
    commercials: (() => {
      const hybridFlags = deriveHybridFlags(commercials.commercialStructure);
      const enableFlatBaseline = commercials.enableFlatBaseline ?? hybridFlags.enableFlatBaseline;
      const enableSlabIncentives = commercials.enableSlabIncentives ?? hybridFlags.enableSlabIncentives;
      const commercialStructure = commercials.commercialStructure
        || resolveCommercialStructure(enableFlatBaseline, enableSlabIncentives);
      const structureType = resolveStructureType(commercialStructure);
      const isFlat = structureType === STRUCTURE_TYPE.FLAT;
      return {
        commercialStructure,
        commercialValue: isFlat ? (commercials.commercialValue || null) : null,
        flatValueType: commercials.flatValueType || commercials.valueType || null,
        flatBaselineFrequency: isFlat
          ? resolveFlatBaselineFrequency(commercials, { adhocSubType: scrubbedDetails.adhocSubType })
          : null,
        enableFlatBaseline,
        enableSlabIncentives,
        calculationFormula: commercials.calculationFormula || null,
        financialYearStartMonth: commercials.financialYearStartMonth ?? 4,
      };
    })(),
    asset: buildAssetPayload(agreement.asset),
  };
}

export function buildStep1CreatePayload(state) {
  return {
    companyId: state.companyId,
    companyAgreementGroupId: state.companyAgreementGroupId || null,
    newCompanyAgreementGroupName: state.newCompanyAgreementGroupName?.trim() || null,
    vendorIds: state.vendorIds ?? [],
    productRules: state.productRules ?? {},
    agreements: [],
  };
}

export function buildStep1UpdatePayload(state, { requiresReapproval = false } = {}) {
  const { details, commercials, asset } = buildAgreementDetailsPayload(state.agreement);
  const payload = {
    companyId: state.companyId,
    companyAgreementGroupId: state.companyAgreementGroupId || null,
    newCompanyAgreementGroupName: state.newCompanyAgreementGroupName?.trim() || null,
    vendorIds: state.vendorIds ?? [],
    productRules: state.productRules ?? {},
    details,
    commercials,
    asset,
  };
  if (requiresReapproval) {
    payload.requiresReapproval = true;
  }
  return payload;
}

export function buildSanitizedStep1UpdatePayload(state, options = {}) {
  const payload = buildStep1UpdatePayload(state, options);
  const { details } = state.agreement ?? {};
  const ctx = resolveWizardIncomeContext(state, options.sourceAgreement, options.incomeTypes ?? []);
  return sanitizeAgreementPayload(
    payload,
    ctx.incomeTypes,
    ctx.incomeTypeId,
    ctx.incomeTypeName,
  );
}

export function validateStep1Fields(state, enqueueSnackbar) {
  if (!state.companyId) {
    enqueueSnackbar('Company is required', { variant: 'warning' });
    return false;
  }
  if (!state.companyAgreementGroupId && !state.newCompanyAgreementGroupName?.trim()) {
    enqueueSnackbar('Select or enter a company agreement group', { variant: 'warning' });
    return false;
  }
  return validateFoundationalMetadata(state, enqueueSnackbar);
}

export function validateFoundationalMetadata(state, enqueueSnackbar) {
  const { details } = state.agreement ?? {};
  if (!details?.incomeTypeId) {
    enqueueSnackbar('Income type is required', { variant: 'warning' });
    return false;
  }
  if (!details?.agreementTypeId) {
    enqueueSnackbar('Agreement type is required', { variant: 'warning' });
    return false;
  }
  if (!details?.startDate) {
    enqueueSnackbar('Start date is required', { variant: 'warning' });
    return false;
  }
  if (!details?.expiryDate) {
    enqueueSnackbar('Expiry date is required', { variant: 'warning' });
    return false;
  }
  return true;
}

export function validateCommercialConfigurationStep(state, enqueueSnackbar, incomeTypes = [], sourceAgreement = null) {
  if (!validateFoundationalMetadata(state, enqueueSnackbar)) return false;

  const fieldErrors = collectConfigurationStepErrors(state, incomeTypes, sourceAgreement);
  if (Object.keys(fieldErrors).length === 0) return true;

  enqueueSnackbar(getFirstWizardFieldErrorMessage(fieldErrors), { variant: 'warning' });
  return false;
}

function collectSettlementRoutingFieldErrors(details, isAssetRental) {
  const errors = {};
  if (!details?.paymentRealizationType) {
    errors.paymentRealization = 'Payment realization type is required';
  }
  if (!isAssetRental && !details?.calculationBasis) {
    errors.calculationBasis = 'Calculation basis is required';
  }

  const paymentType = details?.paymentRealizationType;
  if (paymentType === PAYMENT_REALIZATION_TYPE.CREDIT_NOTE) {
    if (details.payoutBufferDays === '' || details.payoutBufferDays == null) {
      errors.payoutBufferDays = 'Payout lead time is required';
    }
  } else if (paymentType === PAYMENT_REALIZATION_TYPE.DIRECT_PAYMENT_INVOICE) {
    if (!details?.leadTimeBasis) {
      errors.leadTimeBasis = 'Lead time basis is required';
    } else if (details.leadTimeBasis === LEAD_TIME_BASIS.ACTIVITY_COMPLETION_DATE) {
      if (details.payoutBufferDays === '' || details.payoutBufferDays == null) {
        errors.payoutBufferDays = 'Payout lead time is required';
      }
    } else if (details.leadTimeBasis === LEAD_TIME_BASIS.INVOICE_DATE) {
      if (details.invoiceGenerationLeadTime === '' || details.invoiceGenerationLeadTime == null) {
        errors.invoiceGenerationLeadTime = 'Invoice generation lead time is required';
      }
      if (details.payoutBufferDays === '' || details.payoutBufferDays == null) {
        errors.payoutBufferDays = 'Payout lead time is required';
      }
    }
  }

  return errors;
}

export function collectConfigurationStepErrors(state, incomeTypes = [], sourceAgreement = null) {
  const fieldErrors = {};
  const ctx = resolveWizardIncomeContext(state, sourceAgreement, incomeTypes);
  const { agreement, productRules } = state;
  const details = agreement?.details ?? {};
  const asset = agreement?.asset ?? {};
  const isAssetRental = isAssetRentalIncomeType(
    ctx.incomeTypes,
    ctx.incomeTypeId,
    ctx.incomeTypeName,
  );
  const isAdHoc = isAdHocIncomeType(
    ctx.incomeTypes,
    ctx.incomeTypeId,
    ctx.incomeTypeName,
  );
  const isDataFee = isDataFeeIncomeType(
    ctx.incomeTypes,
    ctx.incomeTypeId,
    ctx.incomeTypeName,
  );

  if (!isAssetRental && !state.vendorIds?.length) {
    fieldErrors.supplyVendors = 'Select at least one supply vendor';
  }

  if (!isAssetRental && !details.documents?.length) {
    fieldErrors.documents = 'At least one document is required';
  }

  if (isAssetRental) {
    if (!asset?.assetCategory) {
      fieldErrors.assetCategory = 'Asset category is required for Asset Rentals';
    }
    if (asset?.assetCategory !== 'ACTIVITY' && !asset?.assetType?.trim()) {
      fieldErrors.assetType = 'Asset type is required for Asset Rentals';
    }
    if (!details.stateIds?.length) {
      fieldErrors.states = 'Select at least one state for Asset Rentals';
    }
    const storeCountError = validateParticipatingStoreCount(asset);
    if (storeCountError) {
      fieldErrors.storeCount = storeCountError;
    }
    Object.assign(fieldErrors, collectSettlementRoutingFieldErrors(details, true));
    return fieldErrors;
  }

  if (isDataFee && !details.stateIds?.length) {
    fieldErrors.states = 'Select at least one state for Data Fee';
  }

  if (isAdHoc) {
    if (!productRules?.productRules?.length) {
      fieldErrors.products = 'Select at least one product';
    }
    Object.assign(fieldErrors, collectSettlementRoutingFieldErrors(details, false));
    return fieldErrors;
  }

  if (!productRules?.productRules?.length) {
    fieldErrors.products = 'Select at least one product';
  }
  Object.assign(fieldErrors, collectSettlementRoutingFieldErrors(details, false));
  return fieldErrors;
}

function resolveCommercialEnableFlags(commercials = {}) {
  const structureType = resolveStructureType(commercials.commercialStructure);
  if (structureType === STRUCTURE_TYPE.LEGACY_HYBRID) {
    return { enableFlat: false, enableSlab: false, legacyHybrid: true };
  }
  return {
    enableFlat: structureType === STRUCTURE_TYPE.FLAT,
    enableSlab: structureType === STRUCTURE_TYPE.SLABS,
    legacyHybrid: false,
  };
}

function resolveSelectedStateNames(selectedStateIds, sourceAgreement) {
  return (selectedStateIds ?? []).map((stateId) => {
    const fromVersion = sourceAgreement?.states?.find(
      (state) => Number(state.id) === Number(stateId),
    )?.stateName;
    return fromVersion || `State ${stateId}`;
  });
}

export async function getAssetRentalUnmappedStatesWarning(
  agreementVersionId,
  selectedStateIds,
  sourceAgreement = null,
) {
  if (!agreementVersionId || !selectedStateIds?.length) {
    return null;
  }

  try {
    const mappedStores = await fetchStoreMappings(agreementVersionId);
    const mappedStateNames = new Set(
      (mappedStores ?? []).map((store) => store.stateName).filter(Boolean),
    );
    const selectedStateNames = resolveSelectedStateNames(selectedStateIds, sourceAgreement);
    const unmappedStates = selectedStateNames.filter((name) => !mappedStateNames.has(name));
    if (unmappedStates.length === 0) {
      return null;
    }
    return `Advancing to Review. Note: No retail outlets were mapped for [${unmappedStates.join(', ')}].`;
  } catch {
    return null;
  }
}

export async function validateAssetRentalStoreMappings(
  agreementVersionId,
  expectedStoreCount = 0,
) {
  const fieldErrors = {};
  if (!agreementVersionId) {
    fieldErrors.storeMappings = 'Save contract details before uploading stores';
    return fieldErrors;
  }

  try {
    const mappedStores = await fetchStoreMappings(agreementVersionId);
    const actualMappedCount = Array.isArray(mappedStores) ? mappedStores.length : 0;
    const expected = Number(expectedStoreCount);

    if (!Number.isInteger(expected) || expected <= 0) {
      if (actualMappedCount === 0) {
        fieldErrors.storeMappings = 'Upload at least one mapped store';
      }
      return fieldErrors;
    }

    if (expected !== actualMappedCount) {
      const diff = Math.abs(expected - actualMappedCount);
      const status = actualMappedCount < expected
        ? `missing ${diff} store(s)`
        : `${diff} store(s) in excess`;
      fieldErrors.storeMappings = `Reconciliation Lock: Step 2 scope mandates exactly ${expected} stores, but you have mapped ${actualMappedCount} (${status}).`;
    }
  } catch {
    fieldErrors.storeMappings = 'Unable to validate mapped stores';
  }
  return fieldErrors;
}

export function collectCommercialStructureStepErrors(state, incomeTypes = [], sourceAgreement = null) {
  const fieldErrors = {};
  const ctx = resolveWizardIncomeContext(state, sourceAgreement, incomeTypes);
  const isAssetRental = isAssetRentalIncomeType(
    ctx.incomeTypes,
    ctx.incomeTypeId,
    ctx.incomeTypeName,
  );
  const agreement = state.agreement ?? {};
  const asset = agreement.asset ?? {};
  const commercials = agreement.commercials ?? {};

  if (isAssetRental) {
    if (asset?.payoutMode === 'PER_STORE') {
      const validPeriods = (asset.assetPayoutPeriods ?? []).filter(
        (period) => period.periodMonths && Number(period.periodMonths) > 0
          && period.payoutPerStore && Number(period.payoutPerStore) > 0,
      );
      if (validPeriods.length === 0) {
        fieldErrors.assetPayoutPeriods = 'Add at least one payout period row';
      }
    } else if (!asset?.flatPayout || Number(asset.flatPayout) <= 0) {
      fieldErrors.flatPayout = 'Enter flat payout amount';
    }
    return fieldErrors;
  }

  const isCommercialContracts = isCommercialContractsIncomeType(
    ctx.incomeTypes,
    ctx.incomeTypeId,
    ctx.incomeTypeName,
  );

  if (isCommercialContracts) {
    const structureType = resolveStructureType(commercials.commercialStructure);
    if (structureType === STRUCTURE_TYPE.FLAT) {
      const flatBaselineFrequency = resolveFlatBaselineFrequency(commercials, {
        adhocSubType: state.agreement?.details?.adhocSubType,
      });
      if (!commercials.commercialValue) {
        fieldErrors.commercialValue = 'Flat baseline value is required';
      }
      if (!flatBaselineFrequency) {
        fieldErrors.flatBaselineFrequency = 'Flat baseline frequency is required';
      }
    } else if (!commercials.jbpCommitted) {
      fieldErrors.jbpStructure = 'Confirm JBP structure before advancing';
    }
    return fieldErrors;
  }

  const { enableFlat, enableSlab, legacyHybrid } = resolveCommercialEnableFlags(commercials);

  if (legacyHybrid) {
    fieldErrors.commercialComponent = 'Select Flat Payout or Slab-Based Incentive to replace legacy hybrid structure';
    return fieldErrors;
  }

  if (!enableFlat && !enableSlab) {
    fieldErrors.commercialComponent = 'Select Flat Payout or Slab-Based Incentive';
  }
  if (enableFlat) {
    if (!commercials.commercialValue) {
      fieldErrors.commercialValue = 'Flat baseline value is required';
    }
    if (!resolveFlatBaselineFrequency(commercials, { adhocSubType: state.agreement?.details?.adhocSubType })) {
      fieldErrors.flatBaselineFrequency = 'Flat baseline frequency is required';
    }
  }
  return fieldErrors;
}

export async function collectCommercialStructureStepErrorsAsync(
  state,
  incomeTypes = [],
  sourceAgreement = null,
  serverAgreementId = null,
) {
  const fieldErrors = collectCommercialStructureStepErrors(state, incomeTypes, sourceAgreement);
  const ctx = resolveWizardIncomeContext(state, sourceAgreement, incomeTypes);
  const isAssetRental = isAssetRentalIncomeType(
    ctx.incomeTypes,
    ctx.incomeTypeId,
    ctx.incomeTypeName,
  );
  if (isAssetRental) {
    const versionId = serverAgreementId ?? sourceAgreement?.id;
    const expectedStoreCount = Number(state.agreement?.asset?.storeCount ?? 0);
    const storeErrors = await validateAssetRentalStoreMappings(versionId, expectedStoreCount);
    Object.assign(fieldErrors, storeErrors);
    return fieldErrors;
  }

  const isCommercialContracts = isCommercialContractsIncomeType(
    ctx.incomeTypes,
    ctx.incomeTypeId,
    ctx.incomeTypeName,
  );
  if (isCommercialContracts) {
    return fieldErrors;
  }

  const { enableSlab } = resolveCommercialEnableFlags(state.agreement?.commercials ?? {});
  if (!enableSlab || fieldErrors.commercialComponent) return fieldErrors;

  const versionId = serverAgreementId ?? sourceAgreement?.id;
  if (!versionId) {
    fieldErrors.slabs = 'Please add at least one slab row, or switch to Flat Baseline Payout.';
    return fieldErrors;
  }

  try {
    const slabs = await fetchSlabs(versionId);
    if (!Array.isArray(slabs) || slabs.length === 0) {
      fieldErrors.slabs = 'Please add at least one slab row, or switch to Flat Baseline Payout.';
    }
  } catch {
    fieldErrors.slabs = 'Unable to validate slab incentives';
  }
  return fieldErrors;
}

function validateSettlementRoutingFields(details, isAssetRental, enqueueSnackbar) {
  if (!details?.paymentRealizationType) {
    enqueueSnackbar('Payment realization type is required', { variant: 'warning' });
    return false;
  }
  if (!isAssetRental && !details?.calculationBasis) {
    enqueueSnackbar('Calculation basis is required', { variant: 'warning' });
    return false;
  }

  const paymentType = details.paymentRealizationType;
  if (paymentType === PAYMENT_REALIZATION_TYPE.CREDIT_NOTE
    && (details.payoutBufferDays === '' || details.payoutBufferDays == null)) {
    enqueueSnackbar('Payout lead time is required for Credit Note', { variant: 'warning' });
    return false;
  }
  if (paymentType === PAYMENT_REALIZATION_TYPE.DIRECT_PAYMENT_INVOICE) {
    if (!details.leadTimeBasis) {
      enqueueSnackbar('Lead time basis is required for Invoice', { variant: 'warning' });
      return false;
    }
    if (details.leadTimeBasis === LEAD_TIME_BASIS.ACTIVITY_COMPLETION_DATE
      && (details.payoutBufferDays === '' || details.payoutBufferDays == null)) {
      enqueueSnackbar('Payout lead time is required', { variant: 'warning' });
      return false;
    }
    if (details.leadTimeBasis === LEAD_TIME_BASIS.INVOICE_DATE) {
      if (details.invoiceGenerationLeadTime === '' || details.invoiceGenerationLeadTime == null) {
        enqueueSnackbar('Invoice generation lead time is required', { variant: 'warning' });
        return false;
      }
      if (details.payoutBufferDays === '' || details.payoutBufferDays == null) {
        enqueueSnackbar('Payout lead time is required', { variant: 'warning' });
        return false;
      }
    }
  }
  return true;
}

function validateAssetRentalConfigurationFields(agreement, enqueueSnackbar) {
  const { asset, details } = agreement ?? {};
  if (!asset?.assetCategory) {
    enqueueSnackbar('Asset category is required for Asset Rentals', { variant: 'warning' });
    return false;
  }
  if (asset?.assetCategory !== 'ACTIVITY' && !asset?.assetType?.trim()) {
    enqueueSnackbar('Asset type is required for Asset Rentals', { variant: 'warning' });
    return false;
  }
  if (!details?.stateIds?.length) {
    enqueueSnackbar('Select at least one state for Asset Rentals', { variant: 'warning' });
    return false;
  }
  const storeCountError = validateParticipatingStoreCount(asset);
  if (storeCountError) {
    enqueueSnackbar(storeCountError, { variant: 'warning' });
    return false;
  }
  return true;
}

function validateAssetRentalPayoutFields(agreement, enqueueSnackbar) {
  const { asset } = agreement ?? {};
  if (asset?.payoutMode === 'PER_STORE') {
    const validPeriods = (asset.assetPayoutPeriods ?? []).filter(
      (period) => period.periodMonths && Number(period.periodMonths) > 0
        && period.payoutPerStore && Number(period.payoutPerStore) > 0,
    );
    if (validPeriods.length === 0) {
      enqueueSnackbar('Add at least one payout period row', { variant: 'warning' });
      return false;
    }
  } else if (!asset?.flatPayout || Number(asset.flatPayout) <= 0) {
    enqueueSnackbar('Enter flat payout amount', { variant: 'warning' });
    return false;
  }
  return true;
}

export function validateConfigurationStep(state, incomeTypes, enqueueSnackbar) {
  return validateCommercialConfigurationStep(state, enqueueSnackbar, incomeTypes);
}

export function validateContractDetailsFields(details, enqueueSnackbar, { skipDocuments = false, skipFoundational = false } = {}) {
  if (!skipFoundational) {
    if (!details?.incomeTypeId) {
      enqueueSnackbar('Select income type before saving contract details', { variant: 'warning' });
      return false;
    }
    if (!details?.agreementTypeId) {
      enqueueSnackbar('Select agreement type before saving contract details', { variant: 'warning' });
      return false;
    }
    if (!details?.startDate || !details?.expiryDate) {
      enqueueSnackbar('Start and expiry dates are required before saving contract details', { variant: 'warning' });
      return false;
    }
  }
  if (!skipDocuments && !details?.documents?.length) {
    enqueueSnackbar('At least one document is required', { variant: 'warning' });
    return false;
  }
  return true;
}

export function hasPersistedContractDetails(agreement) {
  if (!agreement) return false;
  const incomeTypeId = agreement.incomeTypeId ?? agreement.details?.incomeTypeId;
  const agreementTypeId = agreement.agreementTypeId ?? agreement.details?.agreementTypeId;
  const startDate = agreement.startDate ?? agreement.details?.startDate;
  const expiryDate = agreement.expiryDate ?? agreement.details?.expiryDate;
  return !!(incomeTypeId && agreementTypeId && startDate && expiryDate);
}

export function buildContractDetailsSnapshot(agreement) {
  if (!agreement) return null;
  return {
    incomeTypeId: agreement.incomeTypeId ?? agreement.details?.incomeTypeId ?? null,
    agreementTypeId: agreement.agreementTypeId ?? agreement.details?.agreementTypeId ?? null,
    startDate: agreement.startDate ?? agreement.details?.startDate ?? null,
    expiryDate: agreement.expiryDate ?? agreement.details?.expiryDate ?? null,
    notes: agreement.notes ?? agreement.details?.notes ?? '',
    stateIds: agreement.stateIds ?? agreement.details?.stateIds ?? [],
  };
}

export function validateAgreementDetailsStep(state, enqueueSnackbar, incomeTypes = [], sourceAgreement = null) {
  return validateCommercialConfigurationStep(state, enqueueSnackbar, incomeTypes, sourceAgreement);
}

export function validateCommercialStructureStepSync(
  state,
  enqueueSnackbar,
  incomeTypes = [],
  sourceAgreement = null,
) {
  const base = validateCommercialStructureBase(state, enqueueSnackbar, incomeTypes, sourceAgreement);
  if (!base.ok) return false;
  const ctx = resolveWizardIncomeContext(state, sourceAgreement, incomeTypes);
  if (isCommercialContractsIncomeType(ctx.incomeTypes, ctx.incomeTypeId, ctx.incomeTypeName)) {
    return true;
  }
  if (base.enableSlab) return false;
  return true;
}

function validateCommercialStructureBase(
  state,
  enqueueSnackbar,
  incomeTypes = [],
  sourceAgreement = null,
) {
  const fieldErrors = collectCommercialStructureStepErrors(state, incomeTypes, sourceAgreement);
  const { enableSlab } = resolveCommercialEnableFlags(state.agreement?.commercials ?? {});

  if (Object.keys(fieldErrors).length > 0) {
    enqueueSnackbar(getFirstWizardFieldErrorMessage(fieldErrors), { variant: 'warning' });
    return { ok: false, enableSlab };
  }
  return { ok: true, enableSlab };
}

export function resolveHighestAccessibleStep(state, sourceAgreement = null, incomeTypes = []) {
  const noop = () => {};
  if (!validateStep1Fields(state, noop)) return 0;
  if (!validateCommercialConfigurationStep(state, noop, incomeTypes, sourceAgreement)) return 1;
  if (!validateCommercialStructureStepSync(state, noop, incomeTypes, sourceAgreement)) return 2;
  return 3;
}

export async function validateCommercialStructureStep(
  state,
  enqueueSnackbar,
  incomeTypes = [],
  sourceAgreement = null,
  serverAgreementId = null,
) {
  const fieldErrors = await collectCommercialStructureStepErrorsAsync(
    state,
    incomeTypes,
    sourceAgreement,
    serverAgreementId,
  );
  if (Object.keys(fieldErrors).length === 0) return true;
  const { message, variant } = getCommercialStepErrorSnackbar(fieldErrors);
  enqueueSnackbar(message, { variant });
  return false;
}

export async function validateCurrentAgreementDetails(
  state,
  enqueueSnackbar,
  incomeTypes = [],
  sourceAgreement = null,
  serverAgreementId = null,
) {
  if (!validateAgreementDetailsStep(state, enqueueSnackbar, incomeTypes, sourceAgreement)) return false;
  return validateCommercialStructureStep(
    state,
    enqueueSnackbar,
    incomeTypes,
    sourceAgreement,
    serverAgreementId,
  );
}

export function validateStep2LoopFields(state, enqueueSnackbar) {
  return validateFoundationalMetadata(state, enqueueSnackbar);
}

export function internalStepFromUrl(urlStep) {
  const parsed = Number.parseInt(urlStep, 10);
  if (Number.isNaN(parsed) || parsed < 1 || parsed > 4) return null;
  return parsed - 1;
}

export function urlStepFromInternal(internalStep) {
  return internalStep + 1;
}
