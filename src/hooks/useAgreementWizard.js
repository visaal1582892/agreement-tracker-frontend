import { useState, useCallback } from 'react';
import { mapCommercialsFromApi } from '../utils/agreementWizardUtils';
import { mapDocumentsFromApi } from '../api/uploadApi';
import { createBlankAgreement, buildStateAfterClassificationReset } from '../utils/agreementWizardDefaults';
import { GEOGRAPHY_MODE } from '../constants/geographyMode';
import { isDataFeeIncomeType } from '../utils/incomeTypeUtils';

import {
  resolveGeographyModeFromAgreement,
  mapPersistedAgreementFields,
  mapProductRulesFromApi,
  mapAssetFromApi
} from '../utils/agreementPayloadMappers';

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
    combinations: [],
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

export { mapProductRulesFromApi, mapPersistedAgreementFields };

export function useAgreementWizard() {
  const [state, setState] = useState(() => {
    const queryParams = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
    const stepParam = queryParams.get('step');
    return {
      ...INITIAL_STATE,
      step: stepParam ? parseInt(stepParam, 10) : INITIAL_STATE.step,
    };
  });

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
      ...prev,
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
        state: v.state,
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
