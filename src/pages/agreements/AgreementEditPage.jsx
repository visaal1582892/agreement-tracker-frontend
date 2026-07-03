import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Box, CircularProgress, Alert, Dialog,
  DialogTitle, DialogContent, DialogActions, Button, TextField,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import axiosInstance from '../../api/axiosInstance';
import { ENDPOINTS } from '../../config/endpoints';
import { ROUTES } from '../../config/routes';
import { BRAND } from '../../config/theme';
import { submitAgreementGroupForApproval } from '../../api/agreementGroupApi';
import WizardLayout from '../../layouts/WizardLayout';
import { useAgreementWizard } from '../../hooks/useAgreementWizard';
import { validateAgreementForSubmit } from '../../utils/agreementSubmitValidation';
import {
  buildReapprovalBaseline,
  detectRequiresReapproval,
} from '../../utils/agreementReapprovalUtils';
import {
  buildSanitizedStep1UpdatePayload,
  fetchSlabCountForVersion,
  resolveHighestAccessibleStep,
  internalStepFromUrl,
  urlStepFromInternal,
  validateStep1Fields,
  validateStep2LoopFields,
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
import {
  buildAgreementEditPath,
  buildAgreementDetailPath,
} from '../../utils/agreementNavigation';
import Step1Setup from './wizard/Step1Setup';
import ConfigurationStep from './wizard/ConfigurationStep';
import CommercialStructureStep from './wizard/CommercialStructureStep';
import Step5Review from './wizard/Step5Review';
import WizardErrorBoundary from '../../components/wizard/WizardErrorBoundary';
import { resolveStructureType, STRUCTURE_TYPE } from '../../constants/commercialStructure';
import { incomeTypeChangedFromBaseline } from '../../utils/wizardStateUtils';

export default function AgreementEditPage() {
  const { agreementVersionId: agreementId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const hydratedRef = useRef(false);

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

  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const [maxReachableStep, setMaxReachableStep] = useState(0);

  const [sourceAgreement, setSourceAgreement] = useState(null);
  const [draftAgreementId, setDraftAgreementId] = useState(null);
  const [versionSourceId, setVersionSourceId] = useState(null);
  const [reapprovalBaseline, setReapprovalBaseline] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [savingDraft, setSavingDraft] = useState(false);
  const [savingLoop, setSavingLoop] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitModalOpen, setSubmitModalOpen] = useState(false);
  const [revisionComments, setRevisionComments] = useState('');
  const [configurationFieldErrors, setConfigurationFieldErrors] = useState({});
  const [commercialFieldErrors, setCommercialFieldErrors] = useState({});
  const [baselineIncomeTypeId, setBaselineIncomeTypeId] = useState(null);
  const [baselineAgreementTypeId, setBaselineAgreementTypeId] = useState(null);

  const isFreshDraftWizard = sourceAgreement?.approvalStatus === 'DRAFT' && !versionSourceId;

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

  useEffect(() => {
    setMaxReachableStep((prev) => Math.max(prev, state.step));
  }, [state.step]);

  useEffect(() => {
    if (!agreementId || hydratedRef.current) return;
    const load = async () => {
      try {
        const { data: loaded } = await axiosInstance.get(ENDPOINTS.AGREEMENT_VERSION_BY_ID(agreementId));

        if (loaded.approvalStatus === 'DRAFT') {
          const structure = loaded.commercialStructure;
          const slabCount = resolveStructureType(structure) === 'SLABS'
            ? await fetchSlabCountForVersion(loaded.id)
            : null;
          setSourceAgreement(loaded);
          setDraftAgreementId(loaded.id);
          hydrateFromEdit(loaded, { slabCount });
          hydratedRef.current = true;
          return;
        }

        setSourceAgreement(loaded);
        setVersionSourceId(loaded.id);
        setReapprovalBaseline(buildReapprovalBaseline(
          loaded,
          loaded.vendors?.map((vendor) => vendor.vendorId),
          {
            manufacturers: loaded.manufacturerIds ?? [],
            divisionRules: loaded.divisionRules ?? [],
            productRules: loaded.productRules ?? [],
          },
        ));

        const { data: versions } = await axiosInstance.get(
          ENDPOINTS.AGREEMENT_VERSIONS(loaded.agreementId),
        );
        const existingDraft = [...versions].reverse().find((v) => v.approvalStatus === 'DRAFT');

        if (existingDraft) {
          const structure = existingDraft.commercialStructure;
          const slabCount = resolveStructureType(structure) === 'SLABS'
            ? await fetchSlabCountForVersion(existingDraft.id)
            : null;
          setDraftAgreementId(existingDraft.id);
          setSourceAgreement(existingDraft);
          hydrateFromEdit(existingDraft, { slabCount });
        } else {
          hydrateFromEdit(loaded);
        }
        hydratedRef.current = true;
      } catch (err) {
        const msg = err.response?.data?.message || 'Failed to load agreement for editing';
        setLoadError(msg);
        enqueueSnackbar(msg, { variant: 'error' });
      }
    };
    load();
  }, [agreementId, hydrateFromEdit, enqueueSnackbar]);

  const syncStepToUrl = useCallback((internalStep, id = draftAgreementId) => {
    if (!id) return;
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('step', String(urlStepFromInternal(internalStep)));
    setSearchParams(nextParams, { replace: true });
    updateStep(internalStep);
  }, [draftAgreementId, searchParams, setSearchParams, updateStep]);

  const urlStepParam = searchParams.get('step');

  useEffect(() => {
    if (!sourceAgreement) return;
    const requested = urlStepParam != null && urlStepParam !== ''
      ? internalStepFromUrl(urlStepParam)
      : null;
    if (requested == null) return;

    if (!isFreshDraftWizard) {
      updateStep(requested);
      return;
    }

    const currentState = stateRef.current;
    const maxAccessible = resolveHighestAccessibleStep(currentState, sourceAgreement);
    const clamped = Math.min(requested, maxAccessible);

    if (clamped !== requested) {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.set('step', String(urlStepFromInternal(clamped)));
      setSearchParams(nextParams, { replace: true });
      updateStep(clamped);
      return;
    }
    if (currentState.step !== clamped) {
      updateStep(clamped);
    }
  }, [
    urlStepParam,
    sourceAgreement?.id,
    isFreshDraftWizard,
    searchParams,
    setSearchParams,
    updateStep,
  ]);

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

  const buildUpdatePayload = useCallback(({ requiresReapproval: forceReapproval } = {}) => {
    const requiresReapproval = forceReapproval ?? (
      !draftAgreementId && (versionSourceId != null || detectRequiresReapproval(reapprovalBaseline, state))
    );
    return buildSanitizedStep1UpdatePayload(state, { requiresReapproval, sourceAgreement });
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
    const payload = stateOverride
      ? buildSanitizedStep1UpdatePayload(effectiveState, {
        requiresReapproval: !draftAgreementId && (versionSourceId != null || detectRequiresReapproval(reapprovalBaseline, effectiveState)),
        sourceAgreement,
      })
      : buildUpdatePayload();
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
      setDraftAgreementId(newDraft.id);
      setSourceAgreement(newDraft);
      setVersionSourceId(null);
      setReapprovalBaseline(null);
      hydratedRef.current = true;
      navigate(buildAgreementEditPath(newDraft.id, { step: urlStepFromInternal(0) }), { replace: true });
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
      if (!validateStep1Fields(state, enqueueSnackbar)) return;
      setSavingDraft(true);
      try {
        await persistDraft({ validateStep1: true });
        syncStepToUrl(1);
      } catch (err) {
        enqueueSnackbar(err.response?.data?.message || 'Complete required step 1 fields', { variant: 'error' });
      } finally {
        setSavingDraft(false);
      }
      return;
    }
    if (state.step === 1) {
      if (!validateAgreementDetailsStep(state, enqueueSnackbar, [], sourceAgreement)) return;
      setSavingDraft(true);
      try {
        await persistDraft({ validateStep2: true });
        syncStepToUrl(2);
      } catch (err) {
        enqueueSnackbar(err.response?.data?.message || 'Complete required contract details', { variant: 'error' });
      } finally {
        setSavingDraft(false);
      }
      return;
    }
    if (state.step === 2) {
      if (!await validateCommercialStructureStep(
        state,
        enqueueSnackbar,
        [],
        sourceAgreement,
        draftAgreementId,
      )) return;
      setSavingDraft(true);
      try {
        await persistDraft({ validateCommercialStructure: true });
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
    syncStepToUrl(state.step - 1);
  };

  const handleSubmitForApproval = async () => {
    if (versionSourceId) {
      if (!validateAgreementForSubmit(state, enqueueSnackbar)) return;
      setSubmitModalOpen(true);
      return;
    }

    if (isFreshDraftWizard) {
      const groupId = state.companyAgreementGroupId;
      if (!groupId) {
        enqueueSnackbar('Company agreement group is required for bulk submit', { variant: 'warning' });
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
    if (!revisionComments.trim()) return;
    setSubmitModalOpen(false);
    setSubmitting(true);
    try {
      const data = await persistDraft();
      const targetId = data.id ?? draftAgreementId;
      await axiosInstance.put(ENDPOINTS.AGREEMENT_VERSION_SUBMIT(targetId), {
        comments: revisionComments.trim(),
      });
      enqueueSnackbar(`Version V${data.versionNumber} submitted for approval`, { variant: 'success' });
      setRevisionComments('');
      reset();
      navigate(buildAgreementDetailPath(data.agreementId));
    } catch (err) {
      enqueueSnackbar(err.response?.data?.message || 'Failed to submit edited version', { variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const footerMode = (() => {
    if (!isFreshDraftWizard) {
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

  const STEP_COMPONENTS = [
    <Step1Setup
      state={state}
      updateFields={updateFields}
      updateAgreementDetails={updateAgreementDetails}
      groupFieldsLocked={Boolean(draftAgreementId)}
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
    />,
    <CommercialStructureStep
      agreement={state.agreement}
      onUpdateCommercials={updateAgreementCommercials}
      onUpdateAsset={updateAgreementAsset}
      serverAgreementId={draftAgreementId}
      sourceAgreement={sourceAgreement}
      onCommercialsAdvance={isFreshDraftWizard ? handleCommercialsNext : handleRevisionNext}
      fieldErrors={commercialFieldErrors}
    />,
    <Step5Review state={state} serverAgreementId={draftAgreementId} sourceAgreement={sourceAgreement} />,
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

  return (
    <WizardErrorBoundary>
      <Box sx={{ display: 'flex', flexDirection: 'column' }}>
      <WizardLayout
        activeStep={state.step}
        maxReachableStep={maxReachableStep}
        onStepClick={isFreshDraftWizard ? handleStepClick : undefined}
        agreementTabLabel={agreementTabLabel}
        submitButtonLabel={submitButtonLabel}
        footerMode={footerMode}
        onNext={isFreshDraftWizard ? handleSetupNext : handleRevisionNext}
        onBack={handleBack}
        onCancel={() => navigate(
          sourceAgreement.agreementId
            ? buildAgreementDetailPath(sourceAgreement.agreementId)
            : ROUTES.AGREEMENTS,
        )}
        onSaveAndCreateAnother={isFreshDraftWizard && state.step === 3 ? handleSaveAndCreateAnother : undefined}
        onDetailsNext={isFreshDraftWizard ? handleDetailsNext : undefined}
        onCommercialsNext={isFreshDraftWizard ? handleCommercialsNext : undefined}
        onFinishAndExit={handleFinishAndExit}
        onSubmitForApproval={handleSubmitForApproval}
        isSavingDraft={savingDraft}
        isSavingLoop={savingLoop}
        isSubmitting={submitting}
      >
        {STEP_COMPONENTS[state.step]}
      </WizardLayout>

      <Dialog
        open={submitModalOpen}
        onClose={() => {
          setSubmitModalOpen(false);
          setRevisionComments('');
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle fontWeight={700}>Submit for Approval</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2, mt: 1 }}>
            Explain why this edit or revision is being submitted. Approvers will see your reason in the timeline.
          </Alert>
          <TextField
            label="Reason for Edit / Revision *"
            multiline
            rows={4}
            fullWidth
            value={revisionComments}
            onChange={(e) => setRevisionComments(e.target.value)}
            placeholder="Describe what changed and why…"
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => {
              setSubmitModalOpen(false);
              setRevisionComments('');
            }}
            variant="outlined"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmitConfirm}
            variant="contained"
            sx={{ bgcolor: BRAND.red }}
            disabled={!revisionComments.trim() || submitting}
          >
            {submitting ? 'Submitting…' : 'Confirm Submit'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
    </WizardErrorBoundary>
  );
}
