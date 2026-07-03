import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box, CircularProgress, Alert, Dialog, DialogTitle, DialogContent,
  DialogContentText, DialogActions, Button,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import axiosInstance from '../../api/axiosInstance';
import { ENDPOINTS } from '../../config/endpoints';
import { ROUTES } from '../../config/routes';
import { fetchGroupDraftAgreements, submitAgreementGroupForApproval } from '../../api/agreementGroupApi';
import WizardLayout from '../../layouts/WizardLayout';
import { useAgreementWizard } from '../../hooks/useAgreementWizard';
import { useAuth } from '../../hooks/useAuth';
import { resolveAgreementListScope } from '../../utils/authUtils';
import {
  buildGroupDetailPath,
  buildGroupWizardPath,
} from '../../utils/agreementNavigation';
import {
  buildSanitizedStep1UpdatePayload,
  fetchSlabCountForVersion,
  resolveHighestAccessibleStep,
  internalStepFromUrl,
  urlStepFromInternal,
  validateStep1Fields,
  validateAgreementDetailsStep,
  validateCommercialStructureStep,
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
import Step1Setup from './wizard/Step1Setup';
import ConfigurationStep from './wizard/ConfigurationStep';
import CommercialStructureStep from './wizard/CommercialStructureStep';
import Step5GroupReview from './wizard/Step5GroupReview';
import WizardErrorBoundary from '../../components/wizard/WizardErrorBoundary';
import { resolveStructureType, STRUCTURE_TYPE } from '../../constants/commercialStructure';
import { incomeTypeChangedFromBaseline } from '../../utils/wizardStateUtils';
import {
  incompleteDraftLabels,
  loadGroupDraftReviewData,
} from '../../utils/groupDraftValidation';

function draftTabLabel(row) {
  return row.agreementName
    || row.incomeTypeName
    || `Draft #${row.id}`;
}

function sortDraftsByCreatedAt(rows) {
  return [...rows].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
}

export default function AgreementGroupWizardPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const { hasRight } = useAuth();
  const agreementScope = resolveAgreementListScope(hasRight);

  const groupId = searchParams.get('groupId');
  const activeAgreementId = searchParams.get('activeAgreementId');
  const parsedGroupId = Number(groupId);
  const parsedActiveAgreementId = Number(activeAgreementId);

  const {
    state,
    updateFields,
    updateProductRules,
    updateAgreementDetails,
    updateAgreementAsset,
    updateAgreementCommercials,
    reset,
    hydrateFromEdit,
    resetVariableFieldsForAnother,
    resetAfterIncomeTypeChange,
    resetForCreateAnother,
    updateStep,
  } = useAgreementWizard();

  const [maxReachableStep, setMaxReachableStep] = useState(0);

  const [groupDrafts, setGroupDrafts] = useState([]);
  const [sourceAgreement, setSourceAgreement] = useState(null);
  const [draftAgreementId, setDraftAgreementId] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [loadingGroup, setLoadingGroup] = useState(true);
  const [loadingDraft, setLoadingDraft] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [savingLoop, setSavingLoop] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [configurationFieldErrors, setConfigurationFieldErrors] = useState({});
  const [commercialFieldErrors, setCommercialFieldErrors] = useState({});
  const [agreementSteps, setAgreementSteps] = useState({});
  const [deleteTargetId, setDeleteTargetId] = useState(null);
  const [deletingDraft, setDeletingDraft] = useState(false);
  const [baselineIncomeTypeId, setBaselineIncomeTypeId] = useState(null);
  const [baselineAgreementTypeId, setBaselineAgreementTypeId] = useState(null);

  const loadedVersionRef = useRef(null);
  const agreementStepsRef = useRef(agreementSteps);
  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    agreementStepsRef.current = agreementSteps;
  }, [agreementSteps]);

  useEffect(() => {
    setMaxReachableStep((prev) => Math.max(prev, state.step));
  }, [state.step]);

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
    const agreementTypeChanged = baselineAgreementTypeId != null
      && String(baselineAgreementTypeId) !== String(currentAgreementType);
    if (!incomeChanged && !agreementTypeChanged) return false;
    resetAfterIncomeTypeChange();
    const message = incomeChanged && agreementTypeChanged
      ? 'Income Type and Agreement Type changed. Downstream configurations have been reset.'
      : incomeChanged
        ? 'Income Type changed. Downstream configurations have been reset.'
        : 'Agreement Type changed. Downstream configurations have been reset.';
    enqueueSnackbar(message, { variant: 'warning' });
    if (incomeChanged) setBaselineIncomeTypeId(currentIncome);
    if (agreementTypeChanged) setBaselineAgreementTypeId(currentAgreementType);
    return true;
  }, [
    baselineAgreementTypeId,
    baselineIncomeTypeId,
    state.agreement?.details?.agreementTypeId,
    state.agreement?.details?.incomeTypeId,
    resetAfterIncomeTypeChange,
    enqueueSnackbar,
  ]);

  const refreshGroupDrafts = useCallback(async () => {
    if (!parsedGroupId || Number.isNaN(parsedGroupId)) return [];
    const rows = await fetchGroupDraftAgreements(parsedGroupId, agreementScope);
    setGroupDrafts(rows);
    return rows;
  }, [parsedGroupId, agreementScope]);

  const draftTabs = useMemo(
    () => sortDraftsByCreatedAt(groupDrafts).map((row) => ({
      agreementId: row.id,
      latestVersionId: row.latestVersionId,
      label: draftTabLabel(row),
    })),
    [groupDrafts],
  );

  const rememberAgreementStep = useCallback((agreementId, internalStep) => {
    if (!agreementId || internalStep == null) return;
    setAgreementSteps((prev) => ({ ...prev, [agreementId]: internalStep }));
  }, []);

  const loadActiveDraft = useCallback(async (agreementId, drafts) => {
    const rows = drafts ?? groupDrafts;
    const row = rows.find((d) => d.id === agreementId);
    if (!row?.latestVersionId) {
      throw new Error('Draft agreement version not found');
    }
    setLoadingDraft(true);
    try {
      const { data: loaded } = await axiosInstance.get(
        ENDPOINTS.AGREEMENT_VERSION_BY_ID(row.latestVersionId),
      );
      if (loaded.approvalStatus !== 'DRAFT') {
        throw new Error('Only draft agreements can be edited in the group wizard');
      }
      const structure = loaded.commercialStructure;
      const slabCount = resolveStructureType(structure) === 'SLABS'
        ? await fetchSlabCountForVersion(loaded.id)
        : null;
      setSourceAgreement(loaded);
      setDraftAgreementId(loaded.id);
      hydrateFromEdit(loaded, { slabCount });
      const rawStep = searchParams.get('step');
      const rememberedStep = agreementStepsRef.current[agreementId];
      const internalStep = rawStep != null && rawStep !== ''
        ? internalStepFromUrl(rawStep)
        : rememberedStep;
      if (internalStep != null) {
        updateStep(internalStep);
        rememberAgreementStep(agreementId, internalStep);
      }
      loadedVersionRef.current = loaded.id;
    } finally {
      setLoadingDraft(false);
    }
  }, [groupDrafts, hydrateFromEdit, searchParams, updateStep, rememberAgreementStep]);

  useEffect(() => {
    if (!parsedGroupId || Number.isNaN(parsedGroupId)) {
      setLoadError('Invalid group wizard link');
      setLoadingGroup(false);
      return;
    }

    const initGroup = async () => {
      setLoadingGroup(true);
      setLoadError(null);
      try {
        const rows = await refreshGroupDrafts();
        if (rows.length === 0) {
          setLoadError('No draft agreements found in this group');
          return;
        }

        const hasValidActive = !Number.isNaN(parsedActiveAgreementId)
          && rows.some((r) => r.id === parsedActiveAgreementId);
        if (!hasValidActive) {
          setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            next.set('activeAgreementId', String(rows[0].id));
            return next;
          }, { replace: true });
        }
      } catch (err) {
        const msg = err.response?.data?.message || err.message || 'Failed to load group drafts';
        setLoadError(msg);
        enqueueSnackbar(msg, { variant: 'error' });
      } finally {
        setLoadingGroup(false);
      }
    };

    initGroup();
  }, [parsedGroupId, parsedActiveAgreementId, refreshGroupDrafts, setSearchParams, enqueueSnackbar]);

  useEffect(() => {
    if (!parsedGroupId || Number.isNaN(parsedGroupId) || loadingGroup) return;
    if (!activeAgreementId || Number.isNaN(parsedActiveAgreementId)) return;
    if (groupDrafts.length === 0) return;

    const row = groupDrafts.find((d) => d.id === parsedActiveAgreementId);
    if (!row) return;
    if (loadedVersionRef.current === row.latestVersionId) return;

    const load = async () => {
      try {
        await loadActiveDraft(parsedActiveAgreementId, groupDrafts);
      } catch (err) {
        const msg = err.response?.data?.message || err.message || 'Failed to load draft';
        setLoadError(msg);
        enqueueSnackbar(msg, { variant: 'error' });
      }
    };
    load();
  }, [
    parsedGroupId,
    parsedActiveAgreementId,
    activeAgreementId,
    groupDrafts,
    loadingGroup,
    loadActiveDraft,
    enqueueSnackbar,
  ]);

  const syncStepToUrl = useCallback((internalStep) => {
    rememberAgreementStep(parsedActiveAgreementId, internalStep);
    const params = new URLSearchParams(searchParams);
    params.set('step', String(urlStepFromInternal(internalStep)));
    setSearchParams(params, { replace: true });
    updateStep(internalStep);
  }, [searchParams, setSearchParams, updateStep, parsedActiveAgreementId, rememberAgreementStep]);

  const urlStepParam = searchParams.get('step');

  useEffect(() => {
    if (!sourceAgreement) return;
    const requested = urlStepParam != null && urlStepParam !== ''
      ? internalStepFromUrl(urlStepParam)
      : null;
    if (requested == null) return;

    const currentState = stateRef.current;
    const maxAccessible = resolveHighestAccessibleStep(currentState, sourceAgreement);
    const clamped = Math.min(requested, maxAccessible);

    if (clamped !== requested) {
      rememberAgreementStep(parsedActiveAgreementId, clamped);
      const params = new URLSearchParams(searchParams);
      params.set('step', String(urlStepFromInternal(clamped)));
      setSearchParams(params, { replace: true });
      updateStep(clamped);
      return;
    }
    if (currentState.step !== clamped) {
      updateStep(clamped);
      rememberAgreementStep(parsedActiveAgreementId, clamped);
    }
  }, [
    urlStepParam,
    sourceAgreement?.id,
    searchParams,
    setSearchParams,
    updateStep,
    parsedActiveAgreementId,
    rememberAgreementStep,
  ]);

  const handleDraftTabChange = useCallback((agreementId) => {
    if (agreementId === parsedActiveAgreementId) return;

    setAgreementSteps((prev) => ({
      ...prev,
      [parsedActiveAgreementId]: state.step,
    }));

    const targetInternalStep = agreementStepsRef.current[agreementId] ?? 0;
    loadedVersionRef.current = null;
    const path = buildGroupWizardPath(parsedGroupId, agreementId, {
      step: urlStepFromInternal(targetInternalStep),
    });
    if (path) navigate(path);
  }, [parsedActiveAgreementId, parsedGroupId, state.step, navigate]);

  const handleDraftTabDelete = useCallback((agreementId) => {
    setDeleteTargetId(agreementId);
  }, []);

  const handleConfirmDeleteDraft = async () => {
    if (!deleteTargetId) return;
    setDeletingDraft(true);
    try {
      await axiosInstance.delete(ENDPOINTS.AGREEMENT_DELETE(deleteTargetId));
      const wasActive = deleteTargetId === parsedActiveAgreementId;
      const previousSorted = sortDraftsByCreatedAt(groupDrafts);
      const deletedIndex = previousSorted.findIndex((row) => row.id === deleteTargetId);

      setAgreementSteps((prev) => {
        const next = { ...prev };
        delete next[deleteTargetId];
        return next;
      });

      const rows = await refreshGroupDrafts();
      enqueueSnackbar('Draft deleted', { variant: 'success' });
      setDeleteTargetId(null);

      if (!wasActive) return;

      if (rows.length === 0) {
        navigate(buildGroupDetailPath(parsedGroupId) || ROUTES.AGREEMENTS);
        return;
      }

      const sorted = sortDraftsByCreatedAt(rows);
      const neighborIndex = Math.min(
        Math.max(deletedIndex, 0),
        sorted.length - 1,
      );
      const target = sorted[neighborIndex];
      const targetStep = agreementStepsRef.current[target.id] ?? 0;
      loadedVersionRef.current = null;
      const path = buildGroupWizardPath(parsedGroupId, target.id, {
        step: urlStepFromInternal(targetStep),
      });
      if (path) navigate(path, { replace: true });
    } catch (err) {
      enqueueSnackbar(err.response?.data?.message || 'Failed to delete draft', { variant: 'error' });
    } finally {
      setDeletingDraft(false);
    }
  };

  useEffect(() => {
    if (state.step !== 1) setConfigurationFieldErrors({});
  }, [state.step]);

  useEffect(() => {
    if (state.step !== 2) setCommercialFieldErrors({});
  }, [state.step]);

  const clearConfigurationFieldError = useCallback((field) => {
    setConfigurationFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  const buildUpdatePayload = useCallback(
    () => buildSanitizedStep1UpdatePayload(state, { sourceAgreement }),
    [state, sourceAgreement],
  );

  const persistDraft = async ({
    validateStep1 = false,
    validateStep2 = false,
    validateCommercialStructure = false,
    stateOverride = null,
  } = {}) => {
    if (!draftAgreementId) {
      throw new Error('No draft version loaded');
    }
    const effectiveState = stateOverride ?? state;
    const { data } = await axiosInstance.put(
      ENDPOINTS.AGREEMENT_VERSION_UPDATE(draftAgreementId),
      buildSanitizedStep1UpdatePayload(effectiveState, { sourceAgreement }),
      { params: { validateStep1, validateStep2, validateCommercialStructure } },
    );
    setSourceAgreement(data);
    if (data.agreementName) {
      updateFields({ agreementName: data.agreementName });
    }
    await refreshGroupDrafts();
    return data;
  };

  const handleSetupNext = async () => {
    if (!validateStep1Fields(state, enqueueSnackbar)) return;
    maybeSanitizeClassificationChange();
    setSavingDraft(true);
    try {
      await persistDraft({ validateStep1: true });
      enqueueSnackbar('Foundational setup saved', { variant: 'success' });
      setBaselineIncomeTypeId(state.agreement?.details?.incomeTypeId);
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
      navigate(buildGroupDetailPath(parsedGroupId) || ROUTES.AGREEMENTS);
    } catch (err) {
      enqueueSnackbar(err.response?.data?.message || 'Failed to save agreement', { variant: 'error' });
    } finally {
      setSavingDraft(false);
    }
  };

  const handleSaveAndCreateAnother = async () => {
    if (!validateAgreementDetailsStep(state, enqueueSnackbar, [], sourceAgreement)) return;
    setSavingLoop(true);
    try {
      await persistDraft({ validateStep2: true });
      const { data } = await axiosInstance.post(ENDPOINTS.AGREEMENTS, {
        companyId: state.companyId,
        companyAgreementGroupId: state.companyAgreementGroupId,
        vendorIds: [],
        productRules: { manufacturers: [], divisionRules: [], productRules: [] },
        agreements: [],
      });
      const newDraft = data.agreements?.[0];
      if (!newDraft) {
        throw new Error('No draft agreement returned from server');
      }
      resetForCreateAnother();
      setBaselineIncomeTypeId(null);
      setMaxReachableStep(0);
      await refreshGroupDrafts();
      setDraftAgreementId(newDraft.id);
      setSourceAgreement(newDraft);
      loadedVersionRef.current = null;
      rememberAgreementStep(parsedActiveAgreementId, 0);
      setAgreementSteps((prev) => ({
        ...prev,
        [newDraft.agreementId]: 0,
      }));
      const path = buildGroupWizardPath(parsedGroupId, newDraft.agreementId, {
        step: urlStepFromInternal(0),
      });
      if (path) {
        navigate(path, { replace: true });
      }
      enqueueSnackbar('Agreement saved — configure another', { variant: 'success' });
    } catch (err) {
      enqueueSnackbar(err.response?.data?.message || 'Failed to save and create another', { variant: 'error' });
    } finally {
      setSavingLoop(false);
    }
  };

  const handleStepClick = (stepIndex) => {
    if (stepIndex < state.step) {
      if (stepIndex <= maxReachableStep) {
        syncStepToUrl(stepIndex);
      }
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
        const selectedStateIds = state.agreement?.details?.stateIds ?? sourceAgreement?.stateIds ?? [];
        const softWarning = await getAssetRentalUnmappedStatesWarning(
          draftAgreementId,
          selectedStateIds,
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

  const handleSubmitForApproval = async () => {
    setSubmitting(true);
    try {
      const rows = await refreshGroupDrafts();
      const reviewData = await loadGroupDraftReviewData(rows);
      const incomplete = reviewData.filter((item) => !item.isComplete);
      if (incomplete.length > 0) {
        enqueueSnackbar(
          `Cannot submit — incomplete: ${incompleteDraftLabels(reviewData).join(', ')}`,
          { variant: 'warning' },
        );
        setSubmitting(false);
        return;
      }

      const result = await submitAgreementGroupForApproval(parsedGroupId);
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
  };

  const handleBack = () => {
    if (state.step === 0) return;
    syncStepToUrl(state.step - 1);
  };

  const footerMode = (() => {
    if (state.step === 0) return 'setup';
    if (state.step === 1) return 'details';
    if (state.step === 2) return 'commercials';
    return 'review';
  })();

  const STEP_COMPONENTS = [
    <Step1Setup
      key={`step1-${draftAgreementId}`}
      state={state}
      updateFields={updateFields}
      updateAgreementDetails={updateAgreementDetails}
      groupFieldsLocked
    />,
    <ConfigurationStep
      key={`step2-${draftAgreementId}`}
      state={state}
      agreement={state.agreement}
      onUpdateDetails={updateAgreementDetails}
      onUpdateAsset={updateAgreementAsset}
      onUpdateCommercials={updateAgreementCommercials}
      updateProductRules={updateProductRules}
      updateFields={updateFields}
      fieldErrors={configurationFieldErrors}
      onClearFieldError={clearConfigurationFieldError}
    />,
    <CommercialStructureStep
      key={`step3-${draftAgreementId}`}
      agreement={state.agreement}
      onUpdateCommercials={updateAgreementCommercials}
      onUpdateAsset={updateAgreementAsset}
      serverAgreementId={draftAgreementId}
      sourceAgreement={sourceAgreement}
      onCommercialsAdvance={handleCommercialsNext}
      fieldErrors={commercialFieldErrors}
    />,
    <Step5GroupReview
      key={`step5-group-${parsedActiveAgreementId}`}
      sharedState={state}
      groupDrafts={groupDrafts}
      activeAgreementId={parsedActiveAgreementId}
    />,
  ];

  if (loadError) {
    return <Alert severity="error" sx={{ m: 3 }}>{loadError}</Alert>;
  }

  if (loadingGroup || !sourceAgreement) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <WizardErrorBoundary>
    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
      {loadingDraft && (
        <Box sx={{ position: 'fixed', inset: 0, bgcolor: 'rgba(255,255,255,0.45)', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CircularProgress />
        </Box>
      )}
      <WizardLayout
        activeStep={state.step}
        maxReachableStep={maxReachableStep}
        onStepClick={handleStepClick}
        draftTabs={draftTabs}
        activeDraftId={parsedActiveAgreementId}
        onDraftTabChange={handleDraftTabChange}
        onDraftTabDelete={handleDraftTabDelete}
        showDraftTabs
        submitButtonLabel="Submit for Approval"
        footerMode={footerMode}
        onNext={handleSetupNext}
        onBack={handleBack}
        onCancel={() => navigate(buildGroupDetailPath(parsedGroupId) || ROUTES.AGREEMENTS)}
        onSaveAndCreateAnother={state.step === 3 ? handleSaveAndCreateAnother : undefined}
        onDetailsNext={handleDetailsNext}
        onCommercialsNext={handleCommercialsNext}
        onSubmitForApproval={handleSubmitForApproval}
        isSavingDraft={savingDraft}
        isSavingLoop={savingLoop}
        isSubmitting={submitting}
      >
        {STEP_COMPONENTS[state.step]}
      </WizardLayout>

      <Dialog
        open={deleteTargetId != null}
        onClose={() => !deletingDraft && setDeleteTargetId(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle fontWeight={700}>Delete draft?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete this draft? This cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => setDeleteTargetId(null)}
            disabled={deletingDraft}
            variant="outlined"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirmDeleteDraft}
            disabled={deletingDraft}
            variant="contained"
            color="error"
          >
            {deletingDraft ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
    </WizardErrorBoundary>
  );
}
