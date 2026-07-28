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
import { useAgreementWizard } from '../../hooks/useAgreementWizard';
import { validateAgreementForSubmit } from '../../utils/agreementSubmitValidation';
import { isAssetPayoutDurationBlocked } from '../../utils/assetPayoutDurationUtils';
import { blurActiveElement } from '../../utils/muiDomCompat';
import {
  buildReapprovalBaseline,
  detectRequiresReapproval,
} from '../../utils/agreementReapprovalUtils';
import {
  buildSanitizedStep1UpdatePayload,
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
        const renewMode = searchParams.get('mode') === 'renew';
        setIsRenewMode(renewMode);

        const { data: loaded } = await axiosInstance.get(ENDPOINTS.AGREEMENT_VERSION_BY_ID(agreementId));

        // Create-flow drafts still use step-wise DB saves.
        if (loaded.approvalStatus === 'DRAFT' && !renewMode) {
          const structure = loaded.commercialStructure;
          const slabCount = resolveStructureType(structure) === 'SLABS'
            ? await fetchSlabCountForVersion(loaded.id)
            : null;
          persistedSlabCountRef.current = slabCount;
          setSourceAgreement(loaded);
          setDraftAgreementId(loaded.id);
          setParentAgreementId(loaded.agreementId);
          applyLoadedDraftStep({
            loaded,
            slabCount,
            searchParams,
            setSearchParams,
            restoreFromPersisted,
            setMaxReachableStep,
          });
          hydratedRef.current = true;
          return;
        }

        const { data: versions } = await axiosInstance.get(
          ENDPOINTS.AGREEMENT_VERSIONS(loaded.agreementId),
        );

        const pending = versions.find((v) => v.approvalStatus === 'PENDING_APPROVAL');
        if (pending) {
          setLoadError(
            'Cannot edit or renew while a version is pending approval. Wait for the review to complete.',
          );
          return;
        }

        const approvedVersions = versions
          .filter((v) => v.approvalStatus === 'APPROVED')
          .sort((a, b) => b.versionNumber - a.versionNumber);
        const nonDraftVersions = versions
          .filter((v) => v.approvalStatus !== 'DRAFT')
          .sort((a, b) => b.versionNumber - a.versionNumber);
        const latestNonDraft = nonDraftVersions[0] ?? null;
        const latestApproved = approvedVersions[0] ?? null;

        let hydrateSource = null;
        if (
          loaded.approvalStatus === 'REJECTED'
          && latestNonDraft
          && loaded.id === latestNonDraft.id
          && !renewMode
        ) {
          hydrateSource = loaded;
        } else if (latestApproved) {
          if (latestApproved.id === loaded.id) {
            hydrateSource = loaded;
          } else {
            const { data: approvedFull } = await axiosInstance.get(
              ENDPOINTS.AGREEMENT_VERSION_BY_ID(latestApproved.id),
            );
            hydrateSource = approvedFull;
          }
        }

        if (!hydrateSource) {
          setLoadError('No approved (or revisable) version available to edit or renew.');
          return;
        }

        if (renewMode && hydrateSource.approvalStatus !== 'APPROVED') {
          setLoadError('Only an approved agreement can be renewed.');
          return;
        }

        const structure = hydrateSource.commercialStructure;
        const slabCount = resolveStructureType(structure) === 'SLABS'
          ? await fetchSlabCountForVersion(hydrateSource.id)
          : null;
        persistedSlabCountRef.current = slabCount;

        setSourceAgreement(hydrateSource);
        setVersionSourceId(hydrateSource.id);
        setParentAgreementId(hydrateSource.agreementId);
        setBaseVersionNumber(hydrateSource.versionNumber);
        setDraftAgreementId(null);
        setReapprovalBaseline(buildReapprovalBaseline(
          hydrateSource,
          hydrateSource.vendors?.map((vendor) => vendor.vendorId),
          {
            manufacturers: hydrateSource.manufacturers?.map((m) => m.id) ?? hydrateSource.manufacturerIds ?? [],
            divisionRules: hydrateSource.divisionRules ?? [],
            productRules: hydrateSource.productRules ?? [],
          },
        ));

        // Renew lands on Foundational Setup (internal 0) where dates live.
        const startStep = 0;
        hydrateFromEdit(hydrateSource, { slabCount, renew: renewMode, step: startStep });
        setMaxReachableStep(startStep);
        const nextParams = new URLSearchParams(searchParams);
        nextParams.set('step', String(urlStepFromInternal(startStep)));
        if (renewMode) nextParams.set('mode', 'renew');
        setSearchParams(nextParams, { replace: true });
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
    return buildSanitizedStep1UpdatePayload(state, { requiresReapproval, sourceAgreement, includeDocuments });
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
      ? buildSanitizedStep1UpdatePayload(effectiveState, {
        requiresReapproval: !draftAgreementId && (versionSourceId != null || detectRequiresReapproval(reapprovalBaseline, effectiveState)),
        sourceAgreement,
        includeDocuments,
      })
      : buildUpdatePayload({ includeDocuments });
    if (draftAgreementId) {
      const { data } = await axiosInstance.put(
        ENDPOINTS.AGREEMENT_VERSION_UPDATE(draftAgreementId),
        payload,
        { params: { validateStep1, validateStep2, validateCommercialStructure } },
      );
      setSourceAgreement(data);
      if (data.agreementName) {
        updateFields({ agreementName: data.agreementName });
      }
      return data;
    }
    const sourceId = versionSourceId ?? sourceAgreement?.id;
    const { data } = await axiosInstance.post(ENDPOINTS.AGREEMENT_VERSION_CREATE_EDIT(sourceId), payload);
    setDraftAgreementId(data.id);
    setSourceAgreement(data);
    if (data.agreementName) {
      updateFields({ agreementName: data.agreementName });
    }
    navigate(buildAgreementEditPath(data.id, { step: urlStepFromInternal(state.step) }), { replace: true });
    if (validateStep1) {
      const { data: updated } = await axiosInstance.put(
        ENDPOINTS.AGREEMENT_VERSION_UPDATE(data.id),
        payload,
        { params: { validateStep1: true, validateStep2: false } },
      );
      setSourceAgreement(updated);
      if (updated.agreementName) {
        updateFields({ agreementName: updated.agreementName });
      }
      return updated;
    }
    return data;
  };

  const handleSetupNext = async () => {
    if (!validateStep1Fields(state, enqueueSnackbar)) return;
    const resetState = maybeSanitizeClassificationChange();
    const effectiveState = resetState ?? state;
    setSavingDraft(true);
    try {
      await persistDraft({
        validateStep1: true,
        stateOverride: resetState ?? undefined,
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
      await persistDraft({ validateStep2: true });
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
      await persistDraft({ validateStep2: true });
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
        step: targetStep,
        slabCount: persistedSlabCountRef.current,
      });
    } else {
      updateStep(targetStep);
    }
    setConfigurationFieldErrors({});
    setCommercialFieldErrors({});
  }, [restoreFromPersisted, sourceAgreement, updateStep]);

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
      await persistDraft({ validateStep2: true });
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
    const fieldErrors = await collectCommercialStructureStepErrorsAsync(
      effectiveState,
      [],
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
      await persistDraft({ validateCommercialStructure: true, stateOverride: effectiveState });
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
        sourceExpiryDate: sourceAgreement?.expiryDate,
      };
      const stepErrors = collectFoundationalStepErrors(state, renewOptions);
      setFoundationalFieldErrors(stepErrors);
      if (!validateStep1Fields(state, enqueueSnackbar, renewOptions)) return;
      maybeSanitizeClassificationChange();
      setBaselineIncomeTypeId(state.agreement?.details?.incomeTypeId);
      setBaselineAgreementTypeId(state.agreement?.details?.agreementTypeId);
      setFoundationalFieldErrors({});
      syncStepToUrl(1);
      return;
    }
    if (state.step === 1) {
      if (!validateAgreementDetailsStep(state, enqueueSnackbar, [], sourceAgreement)) return;
      syncStepToUrl(2);
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
      syncStepToUrl(3);
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
    if (isRenewMode && !validateRenewDates(state, enqueueSnackbar, sourceAgreement?.expiryDate)) {
      return;
    }
    setSubmitting(true);
    try {
      if (isRevisionWizard) {
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
      await axiosInstance.put(ENDPOINTS.AGREEMENT_VERSION_SUBMIT(targetId), {
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
    navigate(
      parentAgreementId || sourceAgreement?.agreementId
        ? buildAgreementDetailPath(parentAgreementId || sourceAgreement.agreementId)
        : ROUTES.AGREEMENTS,
    );
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
      minStartDate={isRenewMode && sourceAgreement?.expiryDate
        ? dayjs(sourceAgreement.expiryDate).add(1, 'day').format('YYYY-MM-DD')
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
    />,
    <CommercialStructureStep
      agreement={state.agreement}
      onUpdateCommercials={updateAgreementCommercials}
      onUpdateAsset={updateAgreementAsset}
      serverAgreementId={isRevisionWizard ? versionSourceId : draftAgreementId}
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
      serverAgreementId={isRevisionWizard ? versionSourceId : draftAgreementId}
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
