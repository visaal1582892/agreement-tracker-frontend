import { useState, useCallback } from 'react';
import { mapCommercialsFromApi } from '../utils/agreementWizardUtils';
import { BLANK_ASSET } from '../utils/incomeTypePayloadUtils';

export function createBlankAgreement() {
  return {
    id: `agr-${Date.now()}`,
    details: {
      incomeTypeId: null,
      incomeTypeName: null,
      agreementTypeId: null,
      startDate: null,
      expiryDate: null,
      notes: '',
      stateIds: [],
      documents: [],
      adhocSubType: null,
      quantityCap: '',
      invoiceVendorId: null,
      payoutBufferDays: '',
      leadTimeBasis: null,
      invoiceGenerationLeadTime: '',
      calculationBasis: 'VENDOR_INVOICE',
      paymentRealizationType: 'DIRECT_PAYMENT_INVOICE',
    },
    asset: {
      assetCategory: 'PHYSICAL_ASSET',
      assetType: '',
      storeCount: '',
      payoutMode: 'FLAT',
      flatPayout: '',
      payoutPerStore: '',
      assetPayoutPeriods: [],
      remarks: '',
    },
    commercials: {
      commercialStructure: 'FLAT',
      commercialValue: '',
      valueType: 'FIXED',
      flatValueType: 'FIXED',
      flatBaselineFrequency: 'MONTHLY',
      enableFlatBaseline: true,
      enableSlabIncentives: false,
      calculationFormula: '',
      selectedFrequencies: [],
      slabType: 'PURCHASE',
      slabCapUnit: 'RUPEES',
      jbpCommitted: false,
      financialYearStartMonth: 4,
    },
  };
}

const INITIAL_STATE = {
  step: 0,
  agreementName: '',
  companyId: null,
  companyName: '',
  companyAgreementGroupId: null,
  companyAgreementGroupName: '',
  newCompanyAgreementGroupName: '',
  vendorIds: [],
  productRules: {
    manufacturers: [],
    divisionRules: [],
    productRules: [],
  },
  agreement: createBlankAgreement(),
};

function mapProductRulesFromApi(agreement) {
  return {
    manufacturers: agreement.manufacturerIds ?? [],
    divisionRules: agreement.divisionRules?.map((r) => ({ id: r.id, ruleType: r.ruleType })) ?? [],
    productRules: agreement.productRules?.map((r) => ({ id: r.id, ruleType: r.ruleType })) ?? [],
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

  const resetAfterIncomeTypeChange = useCallback(() => {
    setState((prev) => {
      const blank = createBlankAgreement();
      const preservedDetails = prev.agreement?.details ?? {};
      return {
        ...prev,
        agreementName: '',
        vendorIds: [],
        productRules: {
          manufacturers: [],
          divisionRules: [],
          productRules: [],
        },
        agreement: {
          id: prev.agreement?.id ?? blank.id,
          details: {
            ...blank.details,
            incomeTypeId: preservedDetails.incomeTypeId ?? null,
            incomeTypeName: preservedDetails.incomeTypeName ?? null,
            agreementTypeId: preservedDetails.agreementTypeId ?? null,
            startDate: preservedDetails.startDate ?? null,
            expiryDate: preservedDetails.expiryDate ?? null,
            notes: preservedDetails.notes ?? '',
            stateIds: [],
            documents: [],
            adhocSubType: null,
            quantityCap: '',
            invoiceVendorId: null,
            payoutBufferDays: '',
            calculationBasis: 'VENDOR_INVOICE',
            paymentRealizationType: 'DIRECT_PAYMENT_INVOICE',
          },
          asset: { ...BLANK_ASSET },
          commercials: { ...blank.commercials },
        },
      };
    });
  }, []);

  const resetForCreateAnother = useCallback(() => {
    setState((prev) => ({
      ...prev,
      step: 0,
      agreementName: '',
      companyId: prev.companyId,
      companyName: prev.companyName,
      companyAgreementGroupId: prev.companyAgreementGroupId,
      companyAgreementGroupName: prev.companyAgreementGroupName,
      newCompanyAgreementGroupName: prev.newCompanyAgreementGroupName,
      vendorIds: [],
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
    const commercials = mapCommercialsFromApi(agreement, options.slabCount);
    setState({
      step: 0,
      agreementName: agreement.agreementName ?? '',
      companyId: agreement.companyId ?? null,
      companyName: agreement.companyName ?? '',
      companyAgreementGroupId: agreement.companyAgreementGroupId ?? null,
      companyAgreementGroupName: agreement.companyAgreementGroupName ?? '',
      newCompanyAgreementGroupName: '',
      vendorIds: agreement.vendors?.map((v) => v.vendorId) ?? [],
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
          stateIds: agreement.stateIds ?? agreement.states?.map((s) => s.id) ?? [],
          documents: [],
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
    });
  }, []);

  const applyCloneResponse = useCallback((cloned) => {
    if (!cloned) return;
    setState((prev) => ({
      ...prev,
      step: 0,
      agreementName: '',
      companyId: cloned.companyId ?? null,
      companyName: cloned.companyName ?? '',
      companyAgreementGroupId: cloned.companyAgreementGroupId ?? prev.companyAgreementGroupId,
      companyAgreementGroupName: cloned.companyAgreementGroupName ?? prev.companyAgreementGroupName,
      vendorIds: cloned.vendors?.map((v) => v.vendorId) ?? [],
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
    applyCloneResponse,
  };
}
