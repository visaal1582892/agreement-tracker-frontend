import { fetchSlabs } from '../api/commercialApi';
import { mapDocumentsToApiPayload } from '../api/uploadApi';
import { fetchStoreMappings } from '../api/storeMappingApi';
import { formatLocalDateString } from './dateUtils';
import { isAdHocIncomeType, isAssetRentalIncomeType, isCommercialContractsIncomeType, isDataFeeIncomeType, resolveWizardIncomeContext } from './incomeTypeUtils';
import { GEOGRAPHY_MODE } from '../constants/geographyMode';
import { sanitizeAgreementPayload } from './incomeTypePayloadUtils';
import { buildApiProductRulesPayload } from './productScopeUtils';
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
import { evaluateAssetPayoutDuration } from './assetPayoutDurationUtils';
import dayjs from 'dayjs';

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
    storeCount: null,
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

export function buildAgreementDetailsPayload(agreement, { includeDocuments = false } = {}) {
  if (!agreement) {
    return { details: {}, commercials: {} };
  }
  const { details, commercials } = agreement;
  const scrubbedDetails = scrubSettlementLeadTimeFields(details ?? {});
  const isAssetRental = isAssetRentalIncomeType(
    [],
    scrubbedDetails.incomeTypeId,
    scrubbedDetails.incomeTypeName,
  );
  const detailsPayload = {
      incomeTypeId: scrubbedDetails.incomeTypeId || null,
      agreementTypeId: scrubbedDetails.agreementTypeId || null,
      startDate: formatLocalDateString(scrubbedDetails.startDate),
      expiryDate: formatLocalDateString(scrubbedDetails.expiryDate),
      notes: scrubbedDetails.notes || null,
      // Asset Rentals: storeIds define geography — scrub partner geo to avoid conflicting state.
      geographyMode: isAssetRental ? GEOGRAPHY_MODE.ALL : (scrubbedDetails.geographyMode || 'MIXED'),
      partnerStates: isAssetRental
        ? []
        : (Array.isArray(scrubbedDetails.partnerStates) ? scrubbedDetails.partnerStates : []),
      partnerCities: isAssetRental
        ? []
        : (Array.isArray(scrubbedDetails.partnerCities) ? scrubbedDetails.partnerCities : []),
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
  };
  if (includeDocuments) {
    detailsPayload.documents = mapDocumentsToApiPayload(scrubbedDetails.documents);
  }
  return {
    details: detailsPayload,
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
    agreementGroupId: state.agreementGroupId || null,
    newAgreementGroupName: state.newAgreementGroupName?.trim() || null,
    vendorIds: state.vendorIds ?? [],
    vendors: state.vendors ?? [],
    productRules: buildApiProductRulesPayload(state.productRules),
    agreements: [],
  };
}

export function buildStep1UpdatePayload(state, { requiresReapproval = false, includeDocuments = false } = {}) {
  const { details, commercials, asset } = buildAgreementDetailsPayload(state.agreement, { includeDocuments });
  const payload = {
    agreementGroupId: state.agreementGroupId || null,
    newAgreementGroupName: state.newAgreementGroupName?.trim() || null,
    vendorIds: state.vendorIds ?? [],
    vendors: state.vendors ?? [],
    productRules: buildApiProductRulesPayload(state.productRules),
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
  const includeDocuments = Boolean(options.includeDocuments);
  const payload = buildStep1UpdatePayload(state, { ...options, includeDocuments });
  const { details } = state.agreement ?? {};
  const ctx = resolveWizardIncomeContext(state, options.sourceAgreement, options.incomeTypes ?? []);
  return sanitizeAgreementPayload(
    payload,
    ctx.incomeTypes,
    ctx.incomeTypeId,
    ctx.incomeTypeName,
  );
}

/** Payload for one-shot edit-submit / renew-submit (no DRAFT). */
export function buildRevisionSubmitPayload(state, {
  baseVersionNumber,
  comments,
  sourceAgreement = null,
  incomeTypes = [],
} = {}) {
  const sanitized = buildSanitizedStep1UpdatePayload(state, {
    includeDocuments: true,
    sourceAgreement,
    incomeTypes,
  });
  const commercialData = buildCommercialDataSubmitPayload(
    state.commercialData,
    sanitized.commercials ?? state.agreement?.commercials ?? {},
  );
  return {
    baseVersionNumber,
    comments: comments?.trim() || '',
    agreementName: state.agreementName || null,
    vendorIds: sanitized.vendorIds,
    vendors: sanitized.vendors,
    productRules: sanitized.productRules,
    details: sanitized.details,
    commercials: sanitized.commercials,
    asset: sanitized.asset,
    commercialData,
  };
}

function buildCommercialDataSubmitPayload(commercialData, commercials = {}) {
  if (!commercialData) {
    return null;
  }
  const structureType = resolveStructureType(commercials.commercialStructure);
  const hasStoreMappingsField = Array.isArray(commercialData.storeMappings);
  const mappedStores = hasStoreMappingsField
    ? commercialData.storeMappings.map((s) => ({
      storeId: s.storeId,
      storeCode: s.storeCode ?? null,
      storeName: s.storeName ?? null,
      stateId: s.stateId ?? null,
      stateName: s.stateName ?? null,
    }))
    : null;

  // FLAT revisions must not carry leftover JBP memory into submit.
  if (structureType === STRUCTURE_TYPE.FLAT) {
    if (!hasStoreMappingsField) {
      return null;
    }
    return {
      slabs: null,
      jbp: null,
      jbpBlueprint: null,
      // Preserve [] — explicit empty upload is not the same as null (deep-copy).
      storeMappings: mappedStores,
    };
  }
  const hasJbp = commercialData.jbp?.sheets?.length > 0;
  const hasBlueprint = commercialData.jbpBlueprint?.configurations?.length > 0;
  if (!hasJbp && !hasStoreMappingsField && !hasBlueprint) {
    return null;
  }
  return {
    slabs: null,
    jbp: hasJbp ? commercialData.jbp : null,
    storeMappings: mappedStores,
    jbpBlueprint: hasBlueprint ? commercialData.jbpBlueprint : null,
  };
}

/** True when renew, or edit with start/expiry changed vs source. */
export function isRevisionDateChange(isRenewMode, details, sourceAgreement) {
  if (isRenewMode) return true;
  if (!sourceAgreement) return false;
  const start = details?.startDate ?? null;
  const expiry = details?.expiryDate ?? null;
  const sourceStart = sourceAgreement.startDate ?? null;
  const sourceExpiry = sourceAgreement.expiryDate ?? null;
  return String(start || '') !== String(sourceStart || '')
    || String(expiry || '') !== String(sourceExpiry || '');
}

/** Excel-driven structures only: Asset stores, or Commercial Contracts SLAB/JBP. FLAT skipped. */
export function requiresExcelCommercialOverride(state, sourceAgreement = null) {
  const ctx = resolveWizardIncomeContext(state, sourceAgreement, []);
  if (isAssetRentalIncomeType(ctx.incomeTypes, ctx.incomeTypeId, ctx.incomeTypeName)) {
    return true;
  }
  if (isCommercialContractsIncomeType(ctx.incomeTypes, ctx.incomeTypeId, ctx.incomeTypeName)) {
    const structure = state.agreement?.commercials?.commercialStructure
      ?? sourceAgreement?.commercialStructure
      ?? null;
    return resolveStructureType(structure) === STRUCTURE_TYPE.SLABS;
  }
  return false;
}

export function requiresNewCommercials(isRenewMode, state, sourceAgreement = null) {
  if (!isRevisionDateChange(isRenewMode, state?.agreement?.details, sourceAgreement)) {
    return false;
  }
  return requiresExcelCommercialOverride(state, sourceAgreement);
}

/** Structure-specific: JBP/slabs for CC SLAB; storeMappings for Asset. */
export function hasRequiredCommercialOverride(state, sourceAgreement = null) {
  const ctx = resolveWizardIncomeContext(state, sourceAgreement, []);
  const data = state?.commercialData;
  if (isAssetRentalIncomeType(ctx.incomeTypes, ctx.incomeTypeId, ctx.incomeTypeName)) {
    // Array (including []) = explicit override; null/undefined = deep-copy.
    return Array.isArray(data?.storeMappings);
  }
  if (isCommercialContractsIncomeType(ctx.incomeTypes, ctx.incomeTypeId, ctx.incomeTypeName)) {
    const hasJbp = Array.isArray(data?.jbp?.sheets) && data.jbp.sheets.length > 0;
    const hasBlueprint = Array.isArray(data?.jbpBlueprint?.configurations)
      && data.jbpBlueprint.configurations.length > 0;
    const hasSlabs = Array.isArray(data?.slabs) && data.slabs.length > 0;
    return (hasJbp && hasBlueprint) || hasSlabs;
  }
  return true;
}

export function validateRevisionCommercialOverride(state, enqueueSnackbar, {
  isRenewMode = false,
  sourceAgreement = null,
} = {}) {
  if (!requiresNewCommercials(isRenewMode, state, sourceAgreement)) {
    return true;
  }
  if (hasRequiredCommercialOverride(state, sourceAgreement)) {
    return true;
  }
  enqueueSnackbar(
    'Because the agreement dates have changed, you must upload a new commercial structure for this period.',
    { variant: 'warning' },
  );
  return false;
}

export function validateStep1Fields(state, enqueueSnackbar, {
  renew = false,
  sourceExpiryDate = null,
} = {}) {
  const fieldErrors = collectFoundationalStepErrors(state, { renew, sourceExpiryDate });
  if (Object.keys(fieldErrors).length === 0) return true;
  const firstMessage = Object.values(fieldErrors).find(Boolean);
  if (firstMessage) {
    enqueueSnackbar(firstMessage, { variant: 'warning' });
  }
  return false;
}

/** Field-level errors for Foundational Setup (group, classification, dates). */
export function collectFoundationalStepErrors(state, {
  renew = false,
  sourceExpiryDate = null,
} = {}) {
  const fieldErrors = {};
  if (!state.agreementGroupId && !state.newAgreementGroupName?.trim()) {
    fieldErrors.agreementGroup = 'Select or enter an agreement group';
  }
  const { details } = state.agreement ?? {};
  if (!details?.incomeTypeId) {
    fieldErrors.incomeTypeId = 'Income type is required';
  }
  if (!details?.agreementTypeId) {
    fieldErrors.agreementTypeId = 'Agreement type is required';
  }
  if (!details?.startDate) {
    fieldErrors.startDate = 'Start date is required';
  }
  if (!details?.expiryDate) {
    fieldErrors.expiryDate = 'Expiry date is required';
  }

  if (renew && details?.startDate) {
    if (!sourceExpiryDate) {
      fieldErrors.startDate = 'Source agreement expiry date is required for renewal';
    } else {
      const start = dayjs(details.startDate).startOf('day');
      const minStart = dayjs(sourceExpiryDate).startOf('day').add(1, 'day');
      if (!start.isValid() || !minStart.isValid()) {
        fieldErrors.startDate = 'Invalid renewal dates';
      } else if (start.isBefore(minStart)) {
        fieldErrors.startDate =
          `Start date must be on or after ${minStart.format('DD MMM YYYY')} (day after previous expiry)`;
      }
    }
  }

  if (details?.startDate && details?.expiryDate) {
    const start = dayjs(details.startDate).startOf('day');
    const expiry = dayjs(details.expiryDate).startOf('day');
    if (start.isValid() && expiry.isValid() && !expiry.isAfter(start)) {
      fieldErrors.expiryDate = 'Expiry date must be after start date';
    }
  }

  return fieldErrors;
}

/** Renew: startDate must be strictly after source expiry (floor = expiry + 1 day). */
export function validateRenewDates(state, enqueueSnackbar, sourceExpiryDate) {
  const fieldErrors = collectFoundationalStepErrors(state, {
    renew: true,
    sourceExpiryDate,
  });
  const message = fieldErrors.startDate || fieldErrors.expiryDate;
  if (!message) return true;
  enqueueSnackbar(message, { variant: 'warning' });
  return false;
}

export function validateFoundationalMetadata(state, enqueueSnackbar) {
  const fieldErrors = collectFoundationalStepErrors(state, { renew: false });
  const message = Object.values(fieldErrors).find(Boolean);
  if (!message) return true;
  enqueueSnackbar(message, { variant: 'warning' });
  return false;
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

function hasPartnerLocation(details) {
  if (details?.geographyMode === GEOGRAPHY_MODE.ALL) return true;
  const states = Array.isArray(details?.partnerStates) ? details.partnerStates : [];
  const cities = Array.isArray(details?.partnerCities) ? details.partnerCities : [];
  if (!states.length && !cities.length) return false;
  const wholeStateCodes = new Set(states.map((s) => s?.code).filter(Boolean));
  return !cities.some((c) => c?.stateCode && wholeStateCodes.has(c.stateCode));
}

function applyPartnerLocationFieldErrors(fieldErrors, details, incomeLabel) {
  if (details?.geographyMode === GEOGRAPHY_MODE.ALL) return;
  const states = Array.isArray(details?.partnerStates) ? details.partnerStates : [];
  const cities = Array.isArray(details?.partnerCities) ? details.partnerCities : [];
  if (!states.length && !cities.length) {
    fieldErrors.partnerState = `Select at least one state or city for ${incomeLabel}`;
    return;
  }
  const wholeStateCodes = new Set(states.map((s) => s?.code).filter(Boolean));
  const conflict = cities.find((c) => c?.stateCode && wholeStateCodes.has(c.stateCode));
  if (conflict) {
    fieldErrors.partnerCity = `Cannot select both whole state and cities for ${conflict.stateName || conflict.stateCode}`;
  }
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

  if (!isAssetRental) {
    const documents = details.documents ?? [];
    const uploadsInProgress = documents.some((doc) => doc.uploadStatus === 'uploading');
    const uploadedDocuments = documents.filter((doc) => doc.fileUrl && doc.uploadStatus !== 'error');
    if (uploadsInProgress) {
      fieldErrors.documents = 'Wait for document uploads to finish';
    } else if (!uploadedDocuments.length) {
      fieldErrors.documents = 'At least one document is required';
    }
  }

  if (isAssetRental) {
    if (!asset?.assetCategory) {
      fieldErrors.assetCategory = 'Asset category is required for Asset Rentals';
    }
    if (asset?.assetCategory !== 'ACTIVITY' && !asset?.assetType?.trim()) {
      fieldErrors.assetType = 'Asset type is required for Asset Rentals';
    }
    Object.assign(fieldErrors, collectSettlementRoutingFieldErrors(details, true));
    return fieldErrors;
  }

  if (isDataFee) {
    applyPartnerLocationFieldErrors(fieldErrors, details, 'Data Fee');
  }

  const isCommercialContracts = isCommercialContractsIncomeType(
    ctx.incomeTypes,
    ctx.incomeTypeId,
    ctx.incomeTypeName,
  );
  if (isCommercialContracts) {
    applyPartnerLocationFieldErrors(fieldErrors, details, 'Commercial Contracts');
  }

  if (isAdHoc) {
    if (!productRules?.manufacturers?.length) {
      fieldErrors.products = 'Select at least one manufacturer';
    }
    Object.assign(fieldErrors, collectSettlementRoutingFieldErrors(details, false));
    return fieldErrors;
  }

  if (!productRules?.manufacturers?.length) {
    fieldErrors.products = 'Select at least one manufacturer';
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

export async function getAssetRentalUnmappedStatesWarning(
  agreementVersionId,
  partnerStates,
  sourceAgreement = null,
) {
  const states = (Array.isArray(partnerStates) && partnerStates.length
    ? partnerStates
    : (sourceAgreement?.partnerStates ?? []))
    .map((s) => s?.name)
    .filter(Boolean);
  if (!agreementVersionId || !states.length) {
    return null;
  }

  try {
    const mappedStores = await fetchStoreMappings(agreementVersionId);
    const mappedStateNames = new Set(
      (mappedStores ?? []).map((store) => store.stateName).filter(Boolean),
    );
    const unmapped = states.filter((name) => !mappedStateNames.has(name));
    if (!unmapped.length) {
      return null;
    }
    return `Advancing to Review. Note: No retail outlets were mapped for [${unmapped.join(', ')}].`;
  } catch {
    return null;
  }
}

function requireMappedStores(actualMappedCount) {
  const fieldErrors = {};
  if (actualMappedCount === 0) {
    fieldErrors.storeMappings = 'Upload at least one mapped store';
  }
  return fieldErrors;
}

/**
 * Validate Asset store mappings — mapped store list is the sole store-count source of truth.
 * When memoryStoreMappings is an array (revision upload), validate that list.
 * When sourceStoreMappings is provided (Edit/Renew keep-source), count those without requiring a draft.
 * Otherwise fetch mappings from the agreement version (create draft / deep-copy path).
 */
export async function validateAssetRentalStoreMappings(
  agreementVersionId,
  _expectedStoreCount = 0,
  memoryStoreMappings = undefined,
  sourceStoreMappings = undefined,
) {
  if (Array.isArray(memoryStoreMappings)) {
    return requireMappedStores(memoryStoreMappings.length);
  }

  if (Array.isArray(sourceStoreMappings)) {
    return requireMappedStores(sourceStoreMappings.length);
  }

  const fieldErrors = {};
  if (!agreementVersionId) {
    fieldErrors.storeMappings = 'Save contract details before uploading stores';
    return fieldErrors;
  }

  try {
    const mappedStores = await fetchStoreMappings(agreementVersionId);
    const actualMappedCount = Array.isArray(mappedStores) ? mappedStores.length : 0;
    return requireMappedStores(actualMappedCount);
  } catch (err) {
    console.error('Unable to validate mapped stores', err);
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
      } else {
        const durationEval = evaluateAssetPayoutDuration({
          payoutMode: 'PER_STORE',
          periods: asset.assetPayoutPeriods,
          startDate: agreement.details?.startDate ?? sourceAgreement?.startDate,
          expiryDate: agreement.details?.expiryDate ?? sourceAgreement?.expiryDate,
        });
        if (durationEval.status === 'error') {
          fieldErrors.assetPayoutPeriods = durationEval.message;
        }
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
    const memoryMappings = state.commercialData?.storeMappings;
    const sourceMappings = Array.isArray(sourceAgreement?.storeMappings)
      ? sourceAgreement.storeMappings
      : undefined;
    const storeErrors = await validateAssetRentalStoreMappings(
      versionId,
      0,
      Array.isArray(memoryMappings) ? memoryMappings : undefined,
      // Edit/Renew with no override: trust embedded source stores (kept on submit).
      Array.isArray(memoryMappings) ? undefined : sourceMappings,
    );
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
  const { asset } = agreement ?? {};
  if (!asset?.assetCategory) {
    enqueueSnackbar('Asset category is required for Asset Rentals', { variant: 'warning' });
    return false;
  }
  if (asset?.assetCategory !== 'ACTIVITY' && !asset?.assetType?.trim()) {
    enqueueSnackbar('Asset type is required for Asset Rentals', { variant: 'warning' });
    return false;
  }
  return true;
}

function validateAssetRentalPayoutFields(agreement, enqueueSnackbar, sourceAgreement = null) {
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
    const durationEval = evaluateAssetPayoutDuration({
      payoutMode: 'PER_STORE',
      periods: asset.assetPayoutPeriods,
      startDate: agreement?.details?.startDate ?? sourceAgreement?.startDate,
      expiryDate: agreement?.details?.expiryDate ?? sourceAgreement?.expiryDate,
    });
    if (durationEval.status === 'error') {
      enqueueSnackbar(durationEval.message, { variant: 'error' });
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
  if (!skipDocuments) {
    const documents = details?.documents ?? [];
    const uploadsInProgress = documents.some((doc) => doc.uploadStatus === 'uploading');
    const uploadedDocuments = documents.filter((doc) => doc.fileUrl && doc.uploadStatus !== 'error');
    if (uploadsInProgress) {
      enqueueSnackbar('Wait for document uploads to finish', { variant: 'warning' });
      return false;
    }
    if (!uploadedDocuments.length) {
      enqueueSnackbar('At least one document is required', { variant: 'warning' });
      return false;
    }
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
    geographyMode: agreement.geographyMode ?? agreement.details?.geographyMode ?? 'MIXED',
    partnerStates: agreement.partnerStates ?? agreement.details?.partnerStates ?? [],
    partnerCities: agreement.partnerCities ?? agreement.details?.partnerCities ?? [],
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
  // Slab rows need async API checks on Next. Sync gate only blocks review until
  // structure is persisted as SLAB — otherwise URL clamp undoes a successful Next.
  if (base.enableSlab) {
    return resolveStructureType(sourceAgreement?.commercialStructure) === STRUCTURE_TYPE.SLABS;
  }
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
