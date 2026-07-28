import { useState, useCallback } from 'react';
import { mapCommercialsFromApi } from '../utils/agreementWizardUtils';
import { mapDocumentsFromApi } from '../api/uploadApi';
import { createBlankAgreement, buildStateAfterClassificationReset } from '../utils/agreementWizardDefaults';
import { GEOGRAPHY_MODE } from '../constants/geographyMode';
import { isDataFeeIncomeType } from '../utils/incomeTypeUtils';

function resolveGeographyModeFromAgreement(agreement) {
  if (agreement?.geographyMode) {
    return agreement.geographyMode;
  }
  if (isDataFeeIncomeType([], agreement?.incomeTypeId, agreement?.incomeTypeName)) {
    return GEOGRAPHY_MODE.ALL;
  }
  return GEOGRAPHY_MODE.MIXED;
}

function mapPersistedAgreementFields(agreement, slabCount = null) {
  const commercials = mapCommercialsFromApi(agreement, slabCount);
  return {
    agreementName: agreement.agreementName ?? '',
    agreementGroupId: agreement.agreementGroupId ?? null,
    agreementGroupName: agreement.agreementGroupName ?? '',
    vendorIds: agreement.vendors?.map((v) => v.vendorId) ?? [],
    vendors: agreement.vendors?.map((v) => ({
      vendorId: v.vendorId,
      vendorName: v.vendorName,
    })) ?? [],
    productRules: mapProductRulesFromApi(agreement),
    agreement: {
      id: `agr-edit-${agreement.id}`,
      details: {
        incomeTypeId: agreement.incomeTypeId ?? null,
        incomeTypeName: agreement.incomeTypeName ?? null,
        agreementTypeId: agreement.agreementTypeId ?? null,
        startDate: agreement.startDate ?? null,
        expiryDate: agreement.expiryDate ?? null,
        notes: agreement.notes ?? '',
        geographyMode: resolveGeographyModeFromAgreement(agreement),
        partnerStates: Array.isArray(agreement.partnerStates) ? agreement.partnerStates : [],
        partnerCities: Array.isArray(agreement.partnerCities) ? agreement.partnerCities : [],
        documents: mapDocumentsFromApi(agreement.documents),
        adhocSubType: agreement.adhocSubType === 'CONSUMER_PRICE_OFF' || !agreement.adhocSubType
          ? 'QPS'
          : agreement.adhocSubType,
        quantityCap: agreement.quantityCap ?? '',
        invoiceVendorId: agreement.invoiceVendorId ?? null,
        payoutBufferDays: agreement.payoutBufferDays ?? '',
        leadTimeBasis: agreement.leadTimeBasis ?? null,
        invoiceGenerationLeadTime: agreement.invoiceGenerationLeadTime ?? '',
        calculationBasis: agreement.calculationBasis ?? 'VENDOR_INVOICE',
        paymentRealizationType: agreement.paymentRealizationType ?? 'DIRECT_PAYMENT_INVOICE',
      },
      asset: mapAssetFromApi(agreement),
      commercials,
    },
  };
}

export { createBlankAgreement } from '../utils/agreementWizardDefaults';

const INITIAL_STATE = {
  step: 0,
  agreementName: '',
  agreementGroupId: null,
  agreementGroupName: '',
  newAgreementGroupName: '',
  vendorIds: [],
  vendors: [],
  productRules: {
    manufacturers: [],
    divisionRules: [],
    productRules: [],
  },
  agreement: createBlankAgreement(),
  /** Edit/Renew only: nested commercial children held in memory until submit. */
  commercialData: {
    jbp: null,
    jbpBlueprint: null,
    storeMappings: null,
    jbpParseErrors: [],
    storeParseErrors: [],
  },
};

export function mapProductRulesFromApi(agreement) {
  if (!agreement) {
    return {
      manufacturers: [],
      manufacturerOptions: [],
      divisionRules: [],
      productRules: [],
      computedProductPreview: [],
      productScopeComputeStatus: null,
      productScopeComputeError: null,
    };
  }

  let rawMfrs = agreement.manufacturers;
  if (!Array.isArray(rawMfrs) || rawMfrs.length === 0) {
    rawMfrs = agreement.manufacturerIds ?? [];
  }
  if ((!Array.isArray(rawMfrs) || rawMfrs.length === 0) && Array.isArray(agreement.products)) {
    const derivedFromProducts = agreement.products
      .filter((p) => p && (p.manufacturerId || p.manufacturerName))
      .map((p) => ({
        id: p.manufacturerId || p.id,
        manufacturerName: p.manufacturerName || '',
      }));
    if (derivedFromProducts.length > 0) {
      const seen = new Set();
      rawMfrs = derivedFromProducts.filter((m) => {
        if (!m.id || seen.has(m.id)) return false;
        seen.add(m.id);
        return true;
      });
    }
  }
  if (!Array.isArray(rawMfrs)) {
    rawMfrs = [];
  }

  const manufacturers = rawMfrs
    .map((m) => (typeof m === 'object' && m !== null ? (m.id ?? m.manufacturerId) : m))
    .filter((id) => id != null);

  const manufacturerOptions = rawMfrs
    .map((m) => {
      if (typeof m === 'object' && m !== null) {
        return {
          id: m.id ?? m.manufacturerId,
          manufacturerName: m.manufacturerName || m.name || '',
        };
      }
      return {
        id: m,
        manufacturerName: '',
      };
    })
    .filter((m) => m.id != null);

  return {
    manufacturers,
    manufacturerOptions,
    divisionRules: (agreement.divisionRules ?? []).map((r) => ({
      id: r.id ?? r.divisionId,
      ruleType: r.ruleType,
      name: r.name ?? r.divisionName ?? '',
    })),
    productRules: (agreement.productRules ?? []).map((r) => ({
      id: r.id ?? r.productId,
      ruleType: r.ruleType,
      name: r.name ?? r.productName ?? '',
    })),
    computedProductPreview: (agreement.products ?? []).map((product) => ({
      productId: product.productId ?? product.id,
      productName: product.productName,
      divisionName: product.divisionName,
    })),
    productScopeComputeStatus: agreement.productScopeComputeStatus ?? null,
    productScopeComputeError: agreement.productScopeComputeError ?? null,
  };
}

function mapAssetFromApi(agreement) {
  const asset = agreement?.asset;
  const apiPeriods = agreement?.assetPayoutPeriods ?? [];
  if (!asset) {
    return {
      assetCategory: 'PHYSICAL_ASSET',
      assetType: '',
      storeCount: '',
      payoutMode: 'FLAT',
      flatPayout: '',
      payoutPerStore: '',
      assetPayoutPeriods: [],
      remarks: '',
    };
  }

  const mappedPeriods = apiPeriods.length > 0
    ? apiPeriods.map((period) => ({
      periodMonths: period.periodMonths ?? '',
      payoutPerStore: period.payoutPerStore ?? '',
    }))
    : (asset.payoutPerStore != null && asset.payoutPerStore !== ''
      ? [{ periodMonths: 1, payoutPerStore: asset.payoutPerStore }]
      : []);

  const hasFlat = asset.flatPayout != null && asset.flatPayout !== '';
  const hasSchedule = mappedPeriods.length > 0;
  const payoutMode = hasFlat
    ? 'FLAT'
    : hasSchedule
      ? 'PER_STORE'
      : (asset.payoutMode || 'FLAT');

  return {
    assetCategory: asset.assetCategory ?? 'PHYSICAL_ASSET',
    assetType: asset.assetType ?? '',
    storeCount: asset.storeCount ?? '',
    payoutMode,
    flatPayout: asset.flatPayout ?? '',
    payoutPerStore: '',
    assetPayoutPeriods: payoutMode === 'PER_STORE' && mappedPeriods.length === 0
      ? [{ periodMonths: '', payoutPerStore: '' }]
      : mappedPeriods,
    remarks: asset.remarks ?? '',
  };
}

export function useAgreementWizard() {
  const [state, setState] = useState(INITIAL_STATE);

  const updateStep = useCallback((step) => {
    setState((prev) => ({ ...prev, step }));
  }, []);

  const updateFields = useCallback((fields) => {
    setState((prev) => ({ ...prev, ...fields }));
  }, []);

  const updateProductRules = useCallback((patch) => {
    setState((prev) => ({
      ...prev,
      productRules: { ...prev.productRules, ...patch },
    }));
  }, []);

  const updateAgreementDetails = useCallback((patch) => {
    setState((prev) => ({
      ...prev,
      agreement: {
        ...prev.agreement,
        details: { ...prev.agreement.details, ...patch },
      },
    }));
  }, []);

  const updateAgreementCommercials = useCallback((patch) => {
    setState((prev) => ({
      ...prev,
      agreement: {
        ...prev.agreement,
        commercials: { ...prev.agreement.commercials, ...patch },
      },
    }));
  }, []);

  const updateAgreementAsset = useCallback((patch) => {
    setState((prev) => ({
      ...prev,
      agreement: {
        ...prev.agreement,
        asset: { ...prev.agreement.asset, ...patch },
      },
    }));
  }, []);

  const updateCommercialData = useCallback((patch) => {
    setState((prev) => ({
      ...prev,
      commercialData: {
        ...(prev.commercialData ?? INITIAL_STATE.commercialData),
        ...patch,
      },
    }));
  }, []);

  const nextStep = useCallback(() => {
    setState((prev) => ({ ...prev, step: Math.min(prev.step + 1, 3) }));
  }, []);

  const prevStep = useCallback(() => {
    setState((prev) => ({ ...prev, step: Math.max(prev.step - 1, 0) }));
  }, []);

  const reset = useCallback(() => setState({
    ...INITIAL_STATE,
    agreement: createBlankAgreement(),
  }), []);

  const clearStep2Fields = useCallback(() => {
    setState((prev) => ({
      ...prev,
      agreementName: '',
      agreement: createBlankAgreement(),
    }));
  }, []);

  const resetAfterIncomeTypeChange = useCallback((baseState = null) => {
    let nextState = null;
    setState((prev) => {
      nextState = buildStateAfterClassificationReset(baseState ?? prev);
      return nextState;
    });
    return nextState;
  }, []);

  const resetForCreateAnother = useCallback(() => {
    setState((prev) => ({
      ...prev,
      step: 0,
      agreementName: '',
      agreementGroupId: prev.agreementGroupId,
      agreementGroupName: prev.agreementGroupName,
      newAgreementGroupName: prev.newAgreementGroupName,
      vendorIds: [],
      vendors: [],
      productRules: {
        manufacturers: [],
        divisionRules: [],
        productRules: [],
      },
      agreement: createBlankAgreement(),
    }));
  }, []);

  const resetVariableFieldsForAnother = useCallback(() => {
    resetForCreateAnother();
  }, [resetForCreateAnother]);

  const hydrateFromEdit = useCallback((agreement, options = {}) => {
    if (!agreement) return;
    const mapped = mapPersistedAgreementFields(agreement, options.slabCount);
    if (options.renew) {
      // Renew: force blank dates — user must enter new term (start > source expiry).
      mapped.agreement = {
        ...mapped.agreement,
        details: {
          ...mapped.agreement.details,
          startDate: null,
          expiryDate: null,
        },
      };
    }
    setState({
      step: options.step ?? 0,
      newAgreementGroupName: '',
      ...mapped,
      commercialData: {
        jbp: null,
        jbpBlueprint: null,
        storeMappings: null,
        jbpParseErrors: [],
        storeParseErrors: [],
      },
    });
  }, []);

  const restoreFromPersisted = useCallback((agreement, options = {}) => {
    if (!agreement) return;
    const { step = 0, slabCount = null } = options;
    const mapped = mapPersistedAgreementFields(agreement, slabCount);
    setState((prev) => ({
      ...mapped,
      step,
      newAgreementGroupName: prev.newAgreementGroupName ?? '',
      agreement: {
        ...mapped.agreement,
        id: prev.agreement?.id ?? mapped.agreement.id,
      },
    }));
  }, []);

  const applyCloneResponse = useCallback((cloned) => {
    if (!cloned) return;
    setState((prev) => ({
      ...prev,
      step: 0,
      agreementName: '',
      agreementGroupId: cloned.agreementGroupId ?? prev.agreementGroupId,
      agreementGroupName: cloned.agreementGroupName ?? prev.agreementGroupName,
      vendorIds: cloned.vendors?.map((v) => v.vendorId) ?? [],
      vendors: cloned.vendors?.map((v) => ({
        vendorId: v.vendorId,
        vendorName: v.vendorName,
      })) ?? [],
      productRules: mapProductRulesFromApi(cloned),
      agreement: createBlankAgreement(),
    }));
  }, []);

  return {
    state,
    updateStep,
    updateFields,
    updateProductRules,
    updateAgreementDetails,
    updateAgreementAsset,
    updateAgreementCommercials,
    updateCommercialData,
    nextStep,
    prevStep,
    reset,
    clearStep2Fields,
    resetVariableFieldsForAnother,
    resetAfterIncomeTypeChange,
    resetForCreateAnother,
    hydrateFromEdit,
    restoreFromPersisted,
    applyCloneResponse,
  };
}
