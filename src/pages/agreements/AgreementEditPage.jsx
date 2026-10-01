import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Box, CircularProgress, Alert, Dialog,
  DialogTitle, DialogContent, DialogActions, Button, TextField,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import dayjs from 'dayjs';
import axiosInstance from '../../api/axiosInstance';
import { ENDPOINTS } from '../../config/endpoints';
import { ROUTES } from '../../config/routes';
import { BRAND } from '../../config/theme';
import { submitAgreementGroupForApproval } from '../../api/agreementGroupApi';
import WizardLayout from '../../layouts/WizardLayout';
import { useAgreementWizard, mapProductRulesFromApi, mapPersistedAgreementFields } from '../../hooks/useAgreementWizard';
import { validateAgreementForSubmit } from '../../utils/agreementSubmitValidation';
import { isAssetPayoutDurationBlocked } from '../../utils/assetPayoutDurationUtils';
import { blurActiveElement } from '../../utils/muiDomCompat';
import {
  buildReapprovalBaseline,
  detectRequiresReapproval,
} from '../../utils/agreementReapprovalUtils';
import {
  buildSanitizedUpdateDraftPayload,
  buildRevisionSubmitPayload,
  fetchSlabCountForVersion,
  resolveHighestAccessibleStep,
  internalStepFromUrl,
  urlStepFromInternal,
  validateStep1Fields,
  collectFoundationalStepErrors,
  validateStep2LoopFields,
  validateAgreementDetailsStep,
  validateCommercialStructureStep,
  validateRenewDates,
  requiresNewCommercials,
  hasRequiredCommercialOverride,
  validateRevisionCommercialOverride,
  collectConfigurationStepErrors,
  collectCommercialStructureStepErrorsAsync,
  getAssetRentalUnmappedStatesWarning,
  withCommercialsOverride,
} from '../../utils/agreementWizardUtils';
import { isAssetRentalIncomeType } from '../../utils/incomeTypeUtils';
import {
  getCommercialStepErrorSnackbar,
  getFirstWizardFieldErrorMessage,
  scrollToFirstWizardError,
} from '../../utils/wizardValidationUx';
import {
  purgeAllCommercialStructureData,
} from '../../api/commercialApi';
import {
  buildAgreementEditPath,
  buildAgreementDetailPath,
  buildGroupWizardPath,
} from '../../utils/agreementNavigation';
import {
  getRememberedWizardStep,
  rememberWizardStep,
  resolveWizardStepForAgreement,
} from '../../utils/wizardStepPersistence';
import Step1Setup from './wizard/Step1Setup';
import ConfigurationStep from './wizard/ConfigurationStep';
import CommercialStructureStep from './wizard/CommercialStructureStep';
import Step5Review from './wizard/Step5Review';
import WizardErrorBoundary from '../../components/wizard/WizardErrorBoundary';
import { resolveStructureType, STRUCTURE_TYPE } from '../../constants/commercialStructure';
import { incomeTypeChangedFromBaseline, agreementTypeChangedFromBaseline } from '../../utils/wizardStateUtils';

function getAgreementPersistenceKey(agreement, fallbackId = null) {
  return agreement?.agreementId ?? agreement?.id ?? fallbackId;
}

function applyLoadedDraftStep({
  loaded,
  slabCount,
  searchParams,
  setSearchParams,
  restoreFromPersisted,
  setMaxReachableStep,
}) {
  const stepKey = getAgreementPersistenceKey(loaded);
  const resolvedStep = resolveWizardStepForAgreement(stepKey, {
    urlStepParam: searchParams.get('step'),
    isActiveAgreement: true,
  });
  restoreFromPersisted(loaded, { slabCount, step: resolvedStep });
  setMaxReachableStep((prev) => Math.max(prev, resolvedStep));
  if (stepKey) rememberWizardStep(stepKey, resolvedStep);
  if (!searchParams.get('step')) {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('step', String(urlStepFromInternal(resolvedStep)));
    setSearchParams(nextParams, { replace: true });
  }
  return resolvedStep;
}

export default function AgreementEditPage() {
  const { agreementVersionId: agreementId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const hydratedRef = useRef(false);
  const persistedSlabCountRef = useRef(null);

  const {
    state,
    updateFields,
    updateProductRules,
    updateAgreementDetails,
    updateAgreementAsset,
    updateAgreementCommercials,
    updateCommercialData,
    reset,
    hydrateFromEdit,
    restoreFromPersisted,
    resetVariableFieldsForAnother,
    resetAfterIncomeTypeChange,
    resetForCreateAnother,
    updateStep,
  } = useAgreementWizard();

  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const [maxReachableStep, setMaxReachableStep] = useState(0);
  const [pendingStepIndex, setPendingStepIndex] = useState(null);
  const [isNavWarningOpen, setIsNavWarningOpen] = useState(false);
  const [sourceAgreement, setSourceAgreement] = useState(null);
  const [draftAgreementId, setDraftAgreementId] = useState(null);
  const [versionSourceId, setVersionSourceId] = useState(null);
  const [parentAgreementId, setParentAgreementId] = useState(null);
  const [baseVersionNumber, setBaseVersionNumber] = useState(null);
  const [isRenewMode, setIsRenewMode] = useState(false);
  const [activeAgreementVersion, setActiveAgreementVersion] = useState(null);

  const [reapprovalBaseline, setReapprovalBaseline] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [savingDraft, setSavingDraft] = useState(false);
  const [savingLoop, setSavingLoop] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitModalOpen, setSubmitModalOpen] = useState(false);
  const [revisionComments, setRevisionComments] = useState('');
  const [submitError, setSubmitError] = useState(null);
  const [configurationFieldErrors, setConfigurationFieldErrors] = useState({});
  const [commercialFieldErrors, setCommercialFieldErrors] = useState({});
  const [foundationalFieldErrors, setFoundationalFieldErrors] = useState({});
  /** Incremented after each draft save to reset Step2Products and clear stale combinations. */
  const [step2Key, setStep2Key] = useState(0);
  const [baselineIncomeTypeId, setBaselineIncomeTypeId] = useState(null);
  const [baselineAgreementTypeId, setBaselineAgreementTypeId] = useState(null);

  const isFreshDraftWizard = sourceAgreement?.approvalStatus === 'DRAFT' && !versionSourceId;
  const isRevisionWizard = Boolean(versionSourceId) && !isFreshDraftWizard;

  useEffect(() => {
    if (sourceAgreement?.incomeTypeId != null) {
      setBaselineIncomeTypeId(sourceAgreement.incomeTypeId);
    }
    if (sourceAgreement?.agreementTypeId != null) {
      setBaselineAgreementTypeId(sourceAgreement.agreementTypeId);
    }
  }, [sourceAgreement?.id, sourceAgreement?.incomeTypeId, sourceAgreement?.agreementTypeId]);

  const getBlendedStateForStep = useCallback((stepToSave, currentState, sourceData, isSanitized) => {
    if (isSanitized || !sourceData) return currentState;
    const sourceState = mapPersistedAgreementFields(sourceData, persistedSlabCountRef.current);
    
    if (stepToSave === 0) {
      return {
        ...sourceState,
        revisionType: currentState.revisionType,
        agreementName: currentState.agreementName,
        agreement: {
          ...sourceState.agreement,
          details: {
            ...sourceState.agreement.details,
            incomeTypeId: currentState.agreement.details.incomeTypeId,
            incomeTypeName: currentState.agreement.details.incomeTypeName,
            agreementTypeId: currentState.agreement.details.agreementTypeId,
            startDate: currentState.agreement.details.startDate,
            expiryDate: currentState.agreement.details.expiryDate,
            notes: currentState.agreement.details.notes,
          }
        }
      };
    }
    if (stepToSave === 1) {
      return {
        ...sourceState,
        agreementGroupId: currentState.agreementGroupId,
        agreementGroupName: currentState.agreementGroupName,
        newAgreementGroupName: currentState.newAgreementGroupName,
        vendorIds: currentState.vendorIds,
        vendors: currentState.vendors,
        productRules: currentState.productRules,
        agreement: {
          ...sourceState.agreement,
          details: {
            ...sourceState.agreement.details,
            geographyMode: currentState.agreement.details.geographyMode,
            partnerStates: currentState.agreement.details.partnerStates,
            partnerCities: currentState.agreement.details.partnerCities,
            locations: currentState.agreement.details.locations,
            documents: currentState.agreement.details.documents,
            adhocSubType: currentState.agreement.details.adhocSubType,
            quantityCap: currentState.agreement.details.quantityCap,
            invoiceVendorId: currentState.agreement.details.invoiceVendorId,
            payoutBufferDays: currentState.agreement.details.payoutBufferDays,
            leadTimeBasis: currentState.agreement.details.leadTimeBasis,
            invoiceGenerationLeadTime: currentState.agreement.details.invoiceGenerationLeadTime,
            calculationBasis: currentState.agreement.details.calculationBasis,
            paymentRealizationType: currentState.agreement.details.paymentRealizationType,
          },
          asset: currentState.agreement.asset,
        }
      };
    }
    if (stepToSave === 2) {
      return {
        ...sourceState,
        commercialData: currentState.commercialData,
        agreement: {
          ...sourceState.agreement,
          commercials: currentState.agreement.commercials,
          asset: currentState.agreement.asset,
        }
      };
    }
    return currentState;
  }, []);

  const maybeSanitizeClassificationChange = useCallback(() => {
    const currentIncome = state.agreement?.details?.incomeTypeId;
    const currentAgreementType = state.agreement?.details?.agreementTypeId;
    const incomeChanged = incomeTypeChangedFromBaseline(baselineIncomeTypeId, currentIncome);
    const agreementTypeChanged = agreementTypeChangedFromBaseline(baselineAgreementTypeId, currentAgreementType);
    if (!incomeChanged && !agreementTypeChanged) return null;

    const nextState = resetAfterIncomeTypeChange(state);
    const message = incomeChanged && agreementTypeChanged
      ? 'Income Type and Agreement Type changed. Downstream configurations have been reset.'
      : incomeChanged
        ? 'Income Type changed. Downstream configurations have been reset.'
        : 'Agreement Type changed. Downstream configurations have been reset.';
    enqueueSnackbar(message, { variant: 'warning' });
    return nextState;
  }, [
    baselineAgreementTypeId,
    baselineIncomeTypeId,
    state,
    resetAfterIncomeTypeChange,
    enqueueSnackbar,
  ]);

  // Clear stale Excel memory as soon as Income/Agreement Type drifts from baseline.
  useEffect(() => {
    if (!isRevisionWizard) return;
    const currentIncome = state.agreement?.details?.incomeTypeId;
    const currentAgreementType = state.agreement?.details?.agreementTypeId;
    if (baselineIncomeTypeId == null && baselineAgreementTypeId == null) return;
    const incomeChanged = incomeTypeChangedFromBaseline(baselineIncomeTypeId, currentIncome);
    const agreementTypeChanged = baselineAgreementTypeId != null
      && String(baselineAgreementTypeId) !== String(currentAgreementType ?? '');
    if (!incomeChanged && !agreementTypeChanged) return;
    updateCommercialData({
      jbp: null,
      jbpBlueprint: null,
      storeMappings: null,
      jbpParseErrors: [],
      storeParseErrors: [],
    });
  }, [
    isRevisionWizard,
    baselineIncomeTypeId,
    baselineAgreementTypeId,
    state.agreement?.details?.incomeTypeId,
    state.agreement?.details?.agreementTypeId,
    updateCommercialData,
  ]);

  useEffect(() => {
    setMaxReachableStep((prev) => Math.max(prev, state.step));
  }, [state.step]);

  useEffect(() => {
    if (!agreementId || hydratedRef.current) return;
    const load = async () => {
      try {
        const { data: loaded } = await axiosInstance.get(ENDPOINTS.AGREEMENT_VERSION_BY_ID(agreementId));

        if (loaded.approvalStatus !== 'DRAFT' && loaded.approvalStatus !== 'PENDING_APPROVAL') {
          setLoadError('Cannot edit an approved version directly. Please use the detail page to initiate an edit.');
          return;
        }

        const isRenew = loaded.revisionType === 'RENEWAL';
        setIsRenewMode(isRenew);

        const structure = loaded.commercialStructure;
        const slabCount = resolveStructureType(structure) === 'SLABS'
          ? await fetchSlabCountForVersion(loaded.id)
          : null;
        persistedSlabCountRef.current = slabCount;
        setSourceAgreement(loaded);
        setDraftAgreementId(loaded.id);
        setParentAgreementId(loaded.agreementId);

        // Fetch reapproval baseline if needed
        let baseline = null;
        if (loaded.versionNumber > 1) {
          try {
            const { data: versions } = await axiosInstance.get(ENDPOINTS.AGREEMENT_VERSIONS(loaded.agreementId));
            const approvedVersions = versions
              .filter((v) => v.approvalStatus === 'APPROVED')
              .sort((a, b) => b.versionNumber - a.versionNumber);
            const latestApproved = approvedVersions[0];
            if (latestApproved) {
              setVersionSourceId(latestApproved.id);
              setBaseVersionNumber(latestApproved.versionNumber);
              
              const { data: approvedFull } = await axiosInstance.get(ENDPOINTS.AGREEMENT_VERSION_BY_ID(latestApproved.id));
              setActiveAgreementVersion(approvedFull);
              baseline = buildReapprovalBaseline(
                approvedFull,
                approvedFull.vendors?.map((vendor) => vendor.vendorId),
                {
                  manufacturers: approvedFull.manufacturers?.map((m) => m.id) ?? approvedFull.manufacturerIds ?? [],
                  divisionRules: approvedFull.divisionRules ?? [],
                  productRules: approvedFull.productRules ?? [],
                },
              );
            }
          } catch (err) {
            console.error('Failed to load baseline', err);
          }
        }
        setReapprovalBaseline(baseline);

        applyLoadedDraftStep({
          loaded,
          slabCount,
          searchParams,
          setSearchParams,
          restoreFromPersisted,
          setMaxReachableStep,
        });
        hydratedRef.current = true;
      } catch (err) {
        const msg = err.response?.data?.message || 'Failed to load agreement for editing';
        setLoadError(msg);
        enqueueSnackbar(msg, { variant: 'error' });
      }
    };
    load();
  }, [agreementId, hydrateFromEdit, restoreFromPersisted, searchParams, setSearchParams, enqueueSnackbar]);

  const getAgreementStepKey = useCallback((agreement = sourceAgreement) => (
    agreement?.agreementId ?? agreement?.id ?? agreementId
  ), [agreementId, sourceAgreement]);

  const applyWizardStep = useCallback((internalStep, id = draftAgreementId ?? versionSourceId ?? agreementId) => {
    if (!id || internalStep == null) return;
    const stepKey = getAgreementStepKey(sourceAgreement);
    updateStep(internalStep);
    if (stepKey) rememberWizardStep(stepKey, internalStep);
    setMaxReachableStep((prev) => Math.max(prev, internalStep));
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('step', String(urlStepFromInternal(internalStep)));
    if (isRenewMode) nextParams.set('mode', 'renew');
    setSearchParams(nextParams, { replace: true });
  }, [
    agreementId,
    draftAgreementId,
    getAgreementStepKey,
    isRenewMode,
    searchParams,
    setSearchParams,
    sourceAgreement,
    updateStep,
    versionSourceId,
  ]);

  const syncStepToUrl = useCallback((internalStep, id = draftAgreementId ?? versionSourceId ?? agreementId) => {
    applyWizardStep(internalStep, id);
  }, [applyWizardStep, agreementId, draftAgreementId, versionSourceId]);

  const urlStepParam = searchParams.get('step');

  useEffect(() => {
    if (!sourceAgreement) return;
    const requested = urlStepParam != null && urlStepParam !== ''
      ? internalStepFromUrl(urlStepParam)
      : null;
    if (requested == null) return;

    // Skip if step was already synced during hydration (avoids flash of Step 0 on refresh)
    if (stateRef.current.step === requested) return;

    if (!isFreshDraftWizard) {
      const clamped = Math.min(requested, maxReachableStep);
      if (clamped !== requested) {
        applyWizardStep(clamped);
        return;
      }
      if (stateRef.current.step !== clamped) {
        updateStep(clamped);
      }
      return;
    }

    const currentState = stateRef.current;
    const maxAccessible = Math.max(
      resolveHighestAccessibleStep(currentState, sourceAgreement),
      maxReachableStep,
    );
    const clamped = Math.min(requested, maxAccessible);

    if (clamped !== requested) {
      applyWizardStep(clamped);
      return;
    }
    if (currentState.step !== clamped) {
      updateStep(clamped);
      const stepKey = getAgreementStepKey(sourceAgreement);
      if (stepKey) rememberWizardStep(stepKey, clamped);
    }
  }, [
    urlStepParam,
    sourceAgreement?.id,
    sourceAgreement?.commercialStructure,
    isFreshDraftWizard,
    maxReachableStep,
    applyWizardStep,
    getAgreementStepKey,
    updateStep,
  ]);

  useEffect(() => {
    if (state.step !== 0) setFoundationalFieldErrors({});
  }, [state.step]);

  useEffect(() => {
    if (state.step !== 1) setConfigurationFieldErrors({});
  }, [state.step]);

  useEffect(() => {
    if (state.step !== 2) setCommercialFieldErrors({});
  }, [state.step]);

  const clearFoundationalFieldError = useCallback((field) => {
    setFoundationalFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  const clearConfigurationFieldError = useCallback((field) => {
    setConfigurationFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  const buildUpdatePayload = useCallback(({ requiresReapproval: forceReapproval, includeDocuments = false } = {}) => {
    const requiresReapproval = forceReapproval ?? (
      !draftAgreementId && (versionSourceId != null || detectRequiresReapproval(reapprovalBaseline, state))
    );
    return buildSanitizedUpdateDraftPayload(state, { requiresReapproval, sourceAgreement, includeDocuments });
  }, [state, reapprovalBaseline, draftAgreementId, versionSourceId, sourceAgreement]);

  const handleDraftVersionCreated = useCallback((data) => {
    setDraftAgreementId(data.id);
    setSourceAgreement(data);
    navigate(buildAgreementEditPath(data.id, { step: urlStepFromInternal(state.step) }), { replace: true });
  }, [navigate, state.step]);

  const persistDraft = async ({
    validateStep1 = false,
    validateStep2 = false,
    validateCommercialStructure = false,
    stateOverride = null,
  } = {}) => {
    const effectiveState = stateOverride ?? state;
    const includeDocuments = validateStep2 || validateCommercialStructure;
    const payload = stateOverride
      ? buildSanitizedUpdateDraftPayload(effectiveState, {
        requiresReapproval: !draftAgreementId && (versionSourceId != null || detectRequiresReapproval(reapprovalBaseline, effectiveState)),
        sourceAgreement,
        includeDocuments,
      })
      : buildUpdatePayload({ includeDocuments });
    if (!draftAgreementId) {
      throw new Error('draftAgreementId is missing. The wizard must act purely as an editor for an existing draft.');
    }
    const { data } = await axiosInstance.put(
      ENDPOINTS.AGREEMENT_VERSION_UPDATE(draftAgreementId),
      payload,
      { params: { validateStep1, validateStep2, validateCommercialStructure } },
    );
    setSourceAgreement(data);
    if (data.agreementName) {
      updateFields({ agreementName: data.agreementName });
    }
    // Re-hydrate productRules from server response to clear stale frontend state
    updateProductRules(mapProductRulesFromApi(data));
    setStep2Key((k) => k + 1);
    return data;
  };

  const handleSetupNext = async () => {
    if (!validateStep1Fields(state, enqueueSnackbar)) return;
    const resetState = maybeSanitizeClassificationChange();
    const effectiveState = resetState ?? state;
    const blendedState = getBlendedStateForStep(0, effectiveState, sourceAgreement, Boolean(resetState));
    setSavingDraft(true);
    try {
      await persistDraft({
        validateStep1: true,
        stateOverride: blendedState,
      });
      enqueueSnackbar('Foundational setup saved', { variant: 'success' });
      setBaselineIncomeTypeId(effectiveState.agreement?.details?.incomeTypeId);
      setBaselineAgreementTypeId(effectiveState.agreement?.details?.agreementTypeId);
      syncStepToUrl(1);
    } catch (err) {
      enqueueSnackbar(err.response?.data?.message || 'Complete required step 1 fields', { variant: 'error' });
    } finally {
      setSavingDraft(false);
    }
  };

  const handleSaveAndClose = async () => {
    if (!validateAgreementDetailsStep(state, enqueueSnackbar, [], sourceAgreement)) return;
    setSavingDraft(true);
    try {
      const blendedState = getBlendedStateForStep(1, state, sourceAgreement, false);
      await persistDraft({ validateStep2: true, stateOverride: blendedState });
      enqueueSnackbar('Agreement saved', { variant: 'success' });
      navigate(sourceAgreement?.agreementId
        ? buildAgreementDetailPath(sourceAgreement.agreementId)
        : ROUTES.AGREEMENTS);
    } catch (err) {
      enqueueSnackbar(err.response?.data?.message || 'Failed to save agreement', { variant: 'error' });
    } finally {
      setSavingDraft(false);
    }
  };

  const handleSaveAndCreateAnother = async () => {
    if (resolveHighestAccessibleStep(state, sourceAgreement) !== 3) {
      enqueueSnackbar('Complete Foundational Setup, Configuration, and Commercial Structure before creating another agreement.', {
        variant: 'warning',
      });
      return;
    }
    if (!validateAgreementDetailsStep(state, enqueueSnackbar, [], sourceAgreement)) return;
    setSavingLoop(true);
    try {
      const blendedState = getBlendedStateForStep(1, state, sourceAgreement, false);
      await persistDraft({ validateStep2: true, stateOverride: blendedState });
      const oldKey = getAgreementPersistenceKey(sourceAgreement, draftAgreementId);
      if (oldKey) {
        rememberWizardStep(oldKey, state.step);
      }
      const { data } = await axiosInstance.post(ENDPOINTS.AGREEMENTS, {
        agreementGroupId: state.agreementGroupId,
        vendorIds: [],
        productRules: { manufacturers: [], divisionRules: [], productRules: [] },
        agreements: [],
      });
      const newDraft = data.agreements?.[0];
      const newAgreementId = newDraft?.agreementId ?? data.primaryAgreementId;
      if (!newDraft?.id || !newAgreementId) {
        throw new Error('No draft agreement returned from server');
      }

      const newKey = getAgreementPersistenceKey(newDraft, newAgreementId);
      rememberWizardStep(newKey, 0);
      setMaxReachableStep(0);

      if (state.agreementGroupId) {
        navigate(
          buildGroupWizardPath(state.agreementGroupId, newAgreementId, { step: urlStepFromInternal(0) }),
          { replace: true },
        );
      } else {
        hydratedRef.current = false;
        navigate(buildAgreementEditPath(newDraft.id, { step: urlStepFromInternal(0) }), { replace: true });
      }
      enqueueSnackbar('Agreement saved — configure another', { variant: 'success' });
    } catch (err) {
      enqueueSnackbar(err.response?.data?.message || 'Failed to save and create another', { variant: 'error' });
    } finally {
      setSavingLoop(false);
    }
  };

  const discardUnsavedWizardStep = useCallback((targetStep) => {
    if (sourceAgreement) {
      restoreFromPersisted(sourceAgreement, {
        slabCount: persistedSlabCountRef.current,
        step: targetStep,
      });
    } else {
      updateStep(targetStep);
    }
    setConfigurationFieldErrors({});
    setCommercialFieldErrors({});
  }, [updateStep, sourceAgreement, restoreFromPersisted]);

  const handleStepClick = (stepIndex) => {
    if (stepIndex < state.step) {
      setPendingStepIndex(stepIndex);
      setIsNavWarningOpen(true);
      return;
    }

    const maxAccessible = resolveHighestAccessibleStep(state, sourceAgreement);

    if (state.step === 0 && stepIndex > 0) {
      if (!validateStep1Fields(state, enqueueSnackbar)) return;
      maybeSanitizeClassificationChange();
    }

    const target = Math.min(stepIndex, maxAccessible);
    if (target < stepIndex) {
      enqueueSnackbar('Complete earlier steps before continuing', { variant: 'warning' });
    }
    syncStepToUrl(target);
  };

  const handleDetailsNext = async () => {
    const fieldErrors = collectConfigurationStepErrors(state, [], sourceAgreement);
    if (Object.keys(fieldErrors).length > 0) {
      enqueueSnackbar(getFirstWizardFieldErrorMessage(fieldErrors), { variant: 'warning' });
      setConfigurationFieldErrors(fieldErrors);
      scrollToFirstWizardError(fieldErrors);
      return;
    }
    setConfigurationFieldErrors({});
    setSavingDraft(true);
    try {
      const blendedState = getBlendedStateForStep(1, state, sourceAgreement, false);
      await persistDraft({ validateStep2: true, stateOverride: blendedState });
      enqueueSnackbar('Contract details saved', { variant: 'success' });
      syncStepToUrl(2);
    } catch (err) {
      enqueueSnackbar(err.response?.data?.message || 'Complete required contract details', { variant: 'error' });
    } finally {
      setSavingDraft(false);
    }
  };

  const handleCommercialsNext = async ({ commercialsOverride } = {}) => {
    const effectiveState = withCommercialsOverride(state, commercialsOverride);
    if (commercialsOverride) {
      updateAgreementCommercials(commercialsOverride);
    }
    let incomeTypes = [];
    try {
      const { data } = await axiosInstance.get(ENDPOINTS.INCOME_TYPES);
      incomeTypes = data || [];
    } catch (e) {
      console.warn('Failed to load income types for validation');
    }
    const fieldErrors = await collectCommercialStructureStepErrorsAsync(
      effectiveState,
      incomeTypes,
      sourceAgreement,
      draftAgreementId,
    );
    if (Object.keys(fieldErrors).length > 0) {
      const { message, variant } = getCommercialStepErrorSnackbar(fieldErrors);
      enqueueSnackbar(message, { variant });
      setCommercialFieldErrors(fieldErrors);
      scrollToFirstWizardError(fieldErrors);
      return;
    }
    setCommercialFieldErrors({});
    setSavingDraft(true);
    try {
      const structureType = resolveStructureType(effectiveState.agreement?.commercials?.commercialStructure);
      if (structureType === STRUCTURE_TYPE.FLAT && draftAgreementId) {
        await purgeAllCommercialStructureData(draftAgreementId);
      }
      const blendedState = getBlendedStateForStep(2, effectiveState, sourceAgreement, false);
      await persistDraft({ validateCommercialStructure: true, stateOverride: blendedState });
      const incomeTypeId = state.agreement?.details?.incomeTypeId ?? sourceAgreement?.incomeTypeId;
      const incomeTypeName = state.agreement?.details?.incomeTypeName ?? sourceAgreement?.incomeTypeName;
      if (isAssetRentalIncomeType([], incomeTypeId, incomeTypeName)) {
        const partnerStates = state.agreement?.details?.partnerStates
          ?? sourceAgreement?.partnerStates
          ?? [];
        const softWarning = await getAssetRentalUnmappedStatesWarning(
          draftAgreementId,
          partnerStates,
          sourceAgreement,
        );
        if (softWarning) {
          enqueueSnackbar(softWarning, { variant: 'info' });
        }
      }
      enqueueSnackbar('Commercial structure saved', { variant: 'success' });
      updateCommercialData({ storeMappings: null, storeParseErrors: [] });
      syncStepToUrl(3);
    } catch (err) {
      enqueueSnackbar(err.response?.data?.message || 'Complete required commercial fields', { variant: 'error' });
    } finally {
      setSavingDraft(false);
    }
  };

  const handleFinishAndExit = async () => {
    setSavingDraft(true);
    try {
      const saved = await persistDraft();
      enqueueSnackbar('Agreement saved', { variant: 'success' });
      if (saved?.agreementId) {
        navigate(buildAgreementDetailPath(saved.agreementId));
      } else {
        navigate(ROUTES.AGREEMENTS);
      }
    } catch (err) {
      enqueueSnackbar(err.response?.data?.message || 'Failed to save agreement', { variant: 'error' });
    } finally {
      setSavingDraft(false);
    }
  };

  const handleRevisionNext = async () => {
    if (state.step === 0) {
      const renewOptions = {
        renew: isRenewMode,
        sourceExpiryDate: activeAgreementVersion?.expiryDate,
      };
      const stepErrors = collectFoundationalStepErrors(state, renewOptions);
      setFoundationalFieldErrors(stepErrors);
      if (!validateStep1Fields(state, enqueueSnackbar, renewOptions)) return;
      const resetState = maybeSanitizeClassificationChange();
      const effectiveState = resetState ?? state;
      const blendedState = getBlendedStateForStep(0, effectiveState, sourceAgreement, Boolean(resetState));
      setSavingDraft(true);
      try {
        await persistDraft({
          validateStep1: true,
          stateOverride: blendedState,
        });
        enqueueSnackbar('Foundational setup saved', { variant: 'success' });
        setBaselineIncomeTypeId(effectiveState.agreement?.details?.incomeTypeId);
        setBaselineAgreementTypeId(effectiveState.agreement?.details?.agreementTypeId);
        setFoundationalFieldErrors({});
        syncStepToUrl(1);
      } catch (err) {
        enqueueSnackbar(err.response?.data?.message || 'Complete required step 1 fields', { variant: 'error' });
      } finally {
        setSavingDraft(false);
      }
      return;
    }
    if (state.step === 1) {
      const fieldErrors = collectConfigurationStepErrors(state, [], sourceAgreement);
      if (Object.keys(fieldErrors).length > 0) {
        enqueueSnackbar(getFirstWizardFieldErrorMessage(fieldErrors), { variant: 'warning' });
        setConfigurationFieldErrors(fieldErrors);
        scrollToFirstWizardError(fieldErrors);
        return;
      }
      setConfigurationFieldErrors({});
      setSavingDraft(true);
      try {
        const blendedState = getBlendedStateForStep(1, state, sourceAgreement, false);
        await persistDraft({ validateStep2: true, stateOverride: blendedState });
        enqueueSnackbar('Contract details saved', { variant: 'success' });
        syncStepToUrl(2);
      } catch (err) {
        enqueueSnackbar(err.response?.data?.message || 'Complete required contract details', { variant: 'error' });
      } finally {
        setSavingDraft(false);
      }
      return;
    }
    if (state.step === 2) {
      // Phase 2: header validation + optional in-memory commercialData.
      // Child Excel data validated by parse APIs; source deep-copy covers missing subtrees.
      if (!await validateCommercialStructureStep(
        state,
        enqueueSnackbar,
        [],
        sourceAgreement,
        isRevisionWizard ? null : versionSourceId,
      )) return;
      if (isRevisionWizard && state.commercialData?.jbpParseErrors?.length) {
        enqueueSnackbar('Fix JBP parse errors before continuing', { variant: 'warning' });
        return;
      }
      if (isRevisionWizard && state.commercialData?.storeParseErrors?.length) {
        enqueueSnackbar('Fix store mapping parse errors before continuing', { variant: 'warning' });
        return;
      }
      if (!validateRevisionCommercialOverride(state, enqueueSnackbar, {
        isRenewMode,
        sourceAgreement,
      })) return;
      setCommercialFieldErrors({});
      setSavingDraft(true);
      try {
        const structureType = resolveStructureType(state.agreement?.commercials?.commercialStructure);
        if (structureType === STRUCTURE_TYPE.FLAT && draftAgreementId) {
          await purgeAllCommercialStructureData(draftAgreementId);
        }
        const blendedState = getBlendedStateForStep(2, state, sourceAgreement, false);
        await persistDraft({ validateCommercialStructure: true, stateOverride: blendedState });
        const incomeTypeId = state.agreement?.details?.incomeTypeId ?? sourceAgreement?.incomeTypeId;
        const incomeTypeName = state.agreement?.details?.incomeTypeName ?? sourceAgreement?.incomeTypeName;
        if (isAssetRentalIncomeType([], incomeTypeId, incomeTypeName)) {
          const partnerStates = state.agreement?.details?.partnerStates
            ?? sourceAgreement?.partnerStates
            ?? [];
          const softWarning = await getAssetRentalUnmappedStatesWarning(
            draftAgreementId,
            partnerStates,
            sourceAgreement,
          );
          if (softWarning) {
            enqueueSnackbar(softWarning, { variant: 'info' });
          }
        }
        enqueueSnackbar('Commercial structure saved', { variant: 'success' });
        updateCommercialData({ storeMappings: null, storeParseErrors: [] });
        syncStepToUrl(3);
      } catch (err) {
        enqueueSnackbar(err.response?.data?.message || 'Complete required commercial fields', { variant: 'error' });
      } finally {
        setSavingDraft(false);
      }
      return;
    }
    syncStepToUrl(state.step + 1);
  };

  const handleBack = () => {
    if (state.step === 0) return;
    const previousStep = state.step - 1;
    if (isRevisionWizard) {
      updateStep(previousStep);
      const nextParams = new URLSearchParams(searchParams);
      nextParams.set('step', String(urlStepFromInternal(previousStep)));
      if (isRenewMode) nextParams.set('mode', 'renew');
      setSearchParams(nextParams, { replace: true });
      return;
    }
    discardUnsavedWizardStep(previousStep);
    if (draftAgreementId) {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.set('step', String(urlStepFromInternal(previousStep)));
      setSearchParams(nextParams, { replace: true });
    }
  };

  const assetPayoutDurationBlocked = isAssetPayoutDurationBlocked({
    payoutMode: state.agreement?.asset?.payoutMode,
    periods: state.agreement?.asset?.assetPayoutPeriods,
    startDate: state.agreement?.details?.startDate ?? sourceAgreement?.startDate,
    expiryDate: state.agreement?.details?.expiryDate ?? sourceAgreement?.expiryDate,
  });

  const handleSubmitForApproval = async () => {
    if (assetPayoutDurationBlocked) {
      enqueueSnackbar(
        'Fix Asset payout schedule duration before submitting',
        { variant: 'error' },
      );
      return;
    }
    if (isRevisionWizard) {
      if (!validateAgreementForSubmit(state, enqueueSnackbar)) return;
      if (state.commercialData?.jbpParseErrors?.length) {
        enqueueSnackbar('Fix JBP parse errors before submitting', { variant: 'warning' });
        return;
      }
      if (state.commercialData?.storeParseErrors?.length) {
        enqueueSnackbar('Fix store mapping parse errors before submitting', { variant: 'warning' });
        return;
      }
      if (!validateRevisionCommercialOverride(state, enqueueSnackbar, {
        isRenewMode,
        sourceAgreement,
      })) return;
      setSubmitError(null);
      blurActiveElement();
      setSubmitModalOpen(true);
      return;
    }

    if (isFreshDraftWizard) {
      const groupId = state.agreementGroupId;
      if (!groupId) {
        enqueueSnackbar('Agreement group is required for bulk submit', { variant: 'warning' });
        return;
      }

      setSubmitting(true);
      try {
        if (state.step >= 1) {
          if (!validateStep2LoopFields(state, enqueueSnackbar)) {
            setSubmitting(false);
            return;
          }
          await persistDraft({ validateStep2: true });
        } else {
          await persistDraft();
        }

        const result = await submitAgreementGroupForApproval(groupId);
        enqueueSnackbar(
          `Submitted ${result.submittedCount} agreement(s) for approval`,
          { variant: 'success' },
        );
        reset();
        navigate(ROUTES.AGREEMENTS);
      } catch (err) {
        enqueueSnackbar(
          err.response?.data?.message || err.message || 'Bulk submit failed',
          { variant: 'error' },
        );
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (!validateAgreementForSubmit(state, enqueueSnackbar)) return;
    setSubmitting(true);
    try {
      const saved = await persistDraft();
      const targetId = saved?.id ?? draftAgreementId;
      await axiosInstance.put(ENDPOINTS.AGREEMENT_VERSION_SUBMIT(targetId));
      enqueueSnackbar('Agreement submitted for approval', { variant: 'success' });
      reset();
      navigate(saved?.agreementId
        ? buildAgreementDetailPath(saved.agreementId)
        : ROUTES.AGREEMENTS);
    } catch (err) {
      enqueueSnackbar(err.response?.data?.message || 'Failed to submit agreement', { variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitConfirm = async () => {
    if (!revisionComments.trim() || submitting) return;
    setSubmitError(null);
    if (isRenewMode && !validateRenewDates(state, enqueueSnackbar, activeAgreementVersion?.expiryDate)) {
      return;
    }
    setSubmitting(true);
    try {
      if (isRevisionWizard && !draftAgreementId) {
        if (baseVersionNumber == null || !parentAgreementId) {
          throw new Error('Missing base version for revision submit');
        }
        const payload = buildRevisionSubmitPayload(state, {
          baseVersionNumber,
          comments: revisionComments,
          sourceAgreement,
        });
        const endpoint = isRenewMode
          ? ENDPOINTS.AGREEMENT_RENEW_SUBMIT(parentAgreementId)
          : ENDPOINTS.AGREEMENT_EDIT_SUBMIT(parentAgreementId);
        const { data } = await axiosInstance.post(endpoint, payload);
        setSubmitModalOpen(false);
        setRevisionComments('');
        setSubmitError(null);
        enqueueSnackbar(
          'Agreement version successfully submitted for approval',
          { variant: 'success' },
        );
        reset();
        navigate(buildAgreementDetailPath(data.agreementId ?? parentAgreementId));
        return;
      }

      const data = await persistDraft();
      const targetId = data.id ?? draftAgreementId;
      
      let submitEndpoint = ENDPOINTS.AGREEMENT_VERSION_SUBMIT_EDIT(targetId);
      if (data.revisionType === 'RENEWAL') {
        submitEndpoint = ENDPOINTS.AGREEMENT_VERSION_SUBMIT_RENEW(targetId);
      } else if (data.revisionType === 'REVISION') {
        submitEndpoint = ENDPOINTS.AGREEMENT_VERSION_SUBMIT_REVISE(targetId);
      }

      await axiosInstance.put(submitEndpoint, {
        comments: revisionComments.trim(),
      });
      setSubmitModalOpen(false);
      setRevisionComments('');
      enqueueSnackbar(`Version V${data.versionNumber} submitted for approval`, { variant: 'success' });
      reset();
      navigate(buildAgreementDetailPath(data.agreementId));
    } catch (err) {
      const status = err.response?.status;
      const apiMessage = err.response?.data?.message;
      let message;
      if (status === 409) {
        message = 'Conflict: Another user has already updated this agreement. '
          + 'Please copy any needed data and refresh the page to see the latest version.';
      } else {
        message = apiMessage || err.message || 'Failed to submit edited version';
      }
      setSubmitError(message);
      enqueueSnackbar(message, {
        variant: 'error',
        persist: status === 409,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelWizard = () => {
    reset();
    navigate(ROUTES.AGREEMENTS);
  };

  const footerMode = (() => {
    if (isRevisionWizard) {
      if (state.step === 3) return 'review';
      return 'revision';
    }
    if (state.step === 0) return 'setup';
    if (state.step === 1) return 'details';
    if (state.step === 2) return 'commercials';
    return 'review';
  })();

  const agreementTabLabel = state.agreementName
    || sourceAgreement?.agreementName
    || 'New Agreement';

  const submitButtonLabel = isFreshDraftWizard ? 'Submit & Exit' : 'Submit for Approval';

  const needsNewCommercials = isRevisionWizard
    && requiresNewCommercials(isRenewMode, state, sourceAgreement);
  const commercialOverrideReady = hasRequiredCommercialOverride(state, sourceAgreement);
  const commercialGateBlocked = needsNewCommercials && !commercialOverrideReady;
  const wizardActionBlocked = commercialGateBlocked || assetPayoutDurationBlocked;

  const STEP_COMPONENTS = [
    <Step1Setup
      state={state}
      updateFields={updateFields}
      updateAgreementDetails={updateAgreementDetails}
      groupFieldsLocked={Boolean(draftAgreementId) || isRevisionWizard}
      identityLocked={isRenewMode}
      incomeTypeLocked={isRevisionWizard}
      datesLocked={state.revisionType === 'EDIT'}
      minStartDate={isRenewMode && activeAgreementVersion?.expiryDate
        ? dayjs(activeAgreementVersion.expiryDate).add(1, 'day').format('YYYY-MM-DD')
        : null}
      fieldErrors={foundationalFieldErrors}
      onClearFieldError={clearFoundationalFieldError}
    />,
    <ConfigurationStep
      state={state}
      agreement={state.agreement}
      onUpdateDetails={updateAgreementDetails}
      onUpdateAsset={updateAgreementAsset}
      onUpdateCommercials={updateAgreementCommercials}
      updateProductRules={updateProductRules}
      updateFields={updateFields}
      fieldErrors={configurationFieldErrors}
      onClearFieldError={clearConfigurationFieldError}
      vendorsLocked={isRenewMode}
      step2Key={step2Key}
    />,
    <CommercialStructureStep
      agreement={state.agreement}
      onUpdateCommercials={updateAgreementCommercials}
      onUpdateAsset={updateAgreementAsset}
      serverAgreementId={draftAgreementId}
      sourceAgreement={sourceAgreement}
      onCommercialsAdvance={isFreshDraftWizard ? handleCommercialsNext : handleRevisionNext}
      fieldErrors={commercialFieldErrors}
      revisionMode={isRevisionWizard}
      sourceVersionId={versionSourceId}
      commercialData={state.commercialData}
      onUpdateCommercialData={updateCommercialData}
      requiresNewCommercials={needsNewCommercials}
    />,
    <Step5Review
      state={state}
      serverAgreementId={draftAgreementId}
      sourceAgreement={sourceAgreement}
      revisionMode={isRevisionWizard}
    />,
  ];

  if (loadError) {
    return <Alert severity="error" sx={{ m: 3 }}>{loadError}</Alert>;
  }

  if (!sourceAgreement) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  const canSaveAndCreateAnother = resolveHighestAccessibleStep(state, sourceAgreement) === 3;

  return (
    <WizardErrorBoundary>
      <Box sx={{ display: 'flex', flexDirection: 'column' }}>
        <WizardLayout
          activeStep={state.step}
          maxReachableStep={maxReachableStep}
          onStepClick={handleStepClick}
          agreementTabLabel={agreementTabLabel}
          submitButtonLabel={submitButtonLabel}
          footerMode={footerMode}
          onNext={isFreshDraftWizard ? handleSetupNext : handleRevisionNext}
          onBack={handleBack}
          onCancel={handleCancelWizard}
          onSaveAndCreateAnother={isFreshDraftWizard && state.step === 3 ? handleSaveAndCreateAnother : undefined}
          saveAndCreateAnotherDisabled={!canSaveAndCreateAnother}
          saveAndCreateAnotherDisabledReason="Complete steps 1–3 (foundational data) before creating another agreement."
          onDetailsNext={isFreshDraftWizard ? handleDetailsNext : undefined}
          onCommercialsNext={isFreshDraftWizard ? handleCommercialsNext : undefined}
          onFinishAndExit={isRevisionWizard ? undefined : handleFinishAndExit}
          onSubmitForApproval={handleSubmitForApproval}
          isSavingDraft={savingDraft}
          isSavingLoop={savingLoop}
          isSubmitting={submitting}
          nextDisabled={(state.step === 2 && commercialGateBlocked) || assetPayoutDurationBlocked}
          submitDisabled={wizardActionBlocked}
        >
          {STEP_COMPONENTS[state.step]}
        </WizardLayout>

        <Dialog open={isNavWarningOpen} onClose={() => { setIsNavWarningOpen(false); setPendingStepIndex(null); }}>
          <DialogTitle>Unsaved Changes</DialogTitle>
          <DialogContent>
            Any unsaved changes on the current step will be lost. Do you wish to proceed?
          </DialogContent>
          <DialogActions>
            <Button onClick={() => { setIsNavWarningOpen(false); setPendingStepIndex(null); }} color="inherit">Cancel</Button>
            <Button onClick={() => {
              if (pendingStepIndex !== null && pendingStepIndex <= maxReachableStep) {
                discardUnsavedWizardStep(pendingStepIndex);
                syncStepToUrl(pendingStepIndex);
              }
              setIsNavWarningOpen(false);
              setPendingStepIndex(null);
            }} variant="contained" color="primary">Proceed</Button>
          </DialogActions>
        </Dialog>

        <Dialog
          open={submitModalOpen}
          onClose={() => {
            if (submitting) return;
            setSubmitModalOpen(false);
            setSubmitError(null);
          }}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle fontWeight={700}>Submit for Approval</DialogTitle>
          <DialogContent>
            <Alert severity="info" sx={{ mb: 2, mt: 1 }}>
              {isRenewMode
                ? 'Explain why this renewal is being submitted. Approvers will see your reason in the timeline.'
                : 'Explain why this edit or revision is being submitted. Approvers will see your reason in the timeline.'}
            </Alert>
            {submitError && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {submitError}
              </Alert>
            )}
            <TextField
              label={isRenewMode ? 'Reason for Renewal *' : 'Reason for Edit / Revision *'}
              multiline
              rows={4}
              fullWidth
              value={revisionComments}
              onChange={(e) => setRevisionComments(e.target.value)}
              placeholder="Describe what changed and why…"
              disabled={submitting}
            />
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button
              onClick={() => {
                if (submitting) return;
                setSubmitModalOpen(false);
                setSubmitError(null);
              }}
              variant="outlined"
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmitConfirm}
              variant="contained"
              sx={{ bgcolor: BRAND.red }}
              disabled={!revisionComments.trim() || submitting}
              startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : null}
            >
              {submitting ? 'Submitting…' : 'Confirm Submit'}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </WizardErrorBoundary>
  );
}
