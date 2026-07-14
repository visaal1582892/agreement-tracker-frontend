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
};

export function mapProductRulesFromApi(agreement) {
  return {
    manufacturers: agreement.manufacturers?.map((m) => m.id) ?? agreement.manufacturerIds ?? [],
    manufacturerOptions: agreement.manufacturers?.map((m) => ({
      id: m.id,
      manufacturerName: m.name,
    })) ?? [],
    divisionRules: agreement.divisionRules?.map((r) => ({
      id: r.id,
      ruleType: r.ruleType,
      name: r.name,
    })) ?? [],
    productRules: agreement.productRules?.map((r) => ({
      id: r.id,
      ruleType: r.ruleType,
      name: r.name,
    })) ?? [],
    computedProductPreview: agreement.products?.map((product) => ({
      productId: product.productId,
      productName: product.productName,
      divisionName: product.divisionName,
    })) ?? [],
    productScopeComputeStatus: agreement.productScopeComputeStatus,
    productScopeComputeError: agreement.productScopeComputeError,
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
    setState({
      step: 0,
      newAgreementGroupName: '',
      ...mapPersistedAgreementFields(agreement, options.slabCount),
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
