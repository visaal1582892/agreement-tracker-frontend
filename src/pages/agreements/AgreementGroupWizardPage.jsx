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
import {
  getRememberedWizardStep,
  rememberWizardStep,
  clearRememberedWizardStep,
  resolveWizardStepForAgreement,
} from '../../utils/wizardStepPersistence';

function draftTabLabel(row) {
  return row.agreementName
    || row.incomeTypeName
    || `Draft #${row.id}`;
}

function sortDraftsByCreatedAt(rows) {
  return [...rows].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
}

function sameAgreementId(left, right) {
  if (left == null || right == null || left === '' || right === '') return false;
  return Number(left) === Number(right);
}

function lookupAgreementStep(map, agreementId) {
  if (!map || agreementId == null || agreementId === '') return null;
  const direct = map[agreementId] ?? map[String(agreementId)];
  if (typeof direct === 'number' && !Number.isNaN(direct)) return direct;
  const key = Object.keys(map).find((k) => sameAgreementId(k, agreementId));
  if (key == null) return null;
  const value = map[key];
  return typeof value === 'number' && !Number.isNaN(value) ? value : null;
}

function resolveTargetDraftStep(agreementId, stepsMap) {
  return getRememberedWizardStep(agreementId)
    ?? lookupAgreementStep(stepsMap, agreementId);
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
    restoreFromPersisted,
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
  const persistedSlabCountRef = useRef(null);
  const agreementStepsRef = useRef(agreementSteps);
  const stateRef = useRef(state);
  const switchingDraftRef = useRef(false);
  /** Blocks old-draft reloads until URL matches target after create-another / tab switch. */
  const pendingSwitchRef = useRef(null);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    agreementStepsRef.current = agreementSteps;
  }, [agreementSteps]);

  useEffect(() => {
    if (!groupDrafts.length) return;
    setAgreementSteps((prev) => {
      const next = { ...prev };
      groupDrafts.forEach((row) => {
        const remembered = getRememberedWizardStep(row.id);
        if (remembered != null) {
          next[row.id] = remembered;
        }
      });
      return next;
    });
  }, [groupDrafts]);

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

  const refreshGroupDrafts = useCallback(async () => {
    if (!parsedGroupId || Number.isNaN(parsedGroupId)) return [];
    const rows = await fetchGroupDraftAgreements(parsedGroupId, agreementScope);
    setGroupDrafts(rows);
    return rows;
  }, [parsedGroupId, agreementScope]);

  const draftTabs = useMemo(
    () => sortDraftsByCreatedAt(groupDrafts).map((row) => ({
      agreementId: Number(row.id),
      latestVersionId: row.latestVersionId,
      label: draftTabLabel(row),
    })),
    [groupDrafts],
  );

  const resolvedActiveDraftId = useMemo(() => {
    if (!draftTabs.length) return false;
    const match = draftTabs.find((tab) => sameAgreementId(tab.agreementId, parsedActiveAgreementId));
    return match ? match.agreementId : draftTabs[0].agreementId;
  }, [draftTabs, parsedActiveAgreementId]);

  const rememberAgreementStep = useCallback((agreementId, internalStep) => {
    if (!agreementId || internalStep == null) return;
    setAgreementSteps((prev) => ({ ...prev, [agreementId]: internalStep }));
    rememberWizardStep(agreementId, internalStep);
  }, []);

  const applyWizardStep = useCallback((agreementId, internalStep, { updateUrl = true } = {}) => {
    if (!agreementId || internalStep == null) return;
    updateStep(internalStep);
    rememberAgreementStep(agreementId, internalStep);
    setMaxReachableStep((prev) => Math.max(prev, internalStep));
    if (updateUrl) {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('activeAgreementId', String(agreementId));
        next.set('step', String(urlStepFromInternal(internalStep)));
        return next;
      }, { replace: true });
    }
  }, [rememberAgreementStep, setSearchParams, updateStep]);

  const loadActiveDraft = useCallback(async (agreementId, drafts, options = {}) => {
    const { forcedInternalStep = null } = options;
    const rows = drafts ?? groupDrafts;
    let row = rows.find((d) => sameAgreementId(d.id, agreementId));
    if (!row?.latestVersionId && options.fallbackVersionId) {
      row = { id: agreementId, latestVersionId: options.fallbackVersionId };
    }
    if (!row?.latestVersionId) {
      throw new Error('Draft agreement version not found');
    }
    switchingDraftRef.current = true;
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
      persistedSlabCountRef.current = slabCount;
      setSourceAgreement(loaded);
      setDraftAgreementId(loaded.id);
      const resolvedStep = resolveWizardStepForAgreement(agreementId, {
        forcedInternalStep,
        urlStepParam: forcedInternalStep != null ? urlStepFromInternal(forcedInternalStep) : searchParams.get('step'),
        isActiveAgreement: sameAgreementId(agreementId, parsedActiveAgreementId),
      });
      restoreFromPersisted(loaded, { slabCount, step: resolvedStep });
      applyWizardStep(agreementId, resolvedStep);
      loadedVersionRef.current = loaded.id;
      setBaselineIncomeTypeId(loaded.incomeTypeId ?? null);
      setBaselineAgreementTypeId(loaded.agreementTypeId ?? null);
      setMaxReachableStep(resolvedStep);
    } finally {
      setLoadingDraft(false);
      switchingDraftRef.current = false;
    }
  }, [groupDrafts, restoreFromPersisted, searchParams, applyWizardStep, parsedActiveAgreementId]);

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

        if (!activeAgreementId) {
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
  }, [parsedGroupId, refreshGroupDrafts, setSearchParams, enqueueSnackbar, activeAgreementId]);

  useEffect(() => {
    if (!parsedGroupId || Number.isNaN(parsedGroupId) || loadingGroup) return;
    if (!activeAgreementId || Number.isNaN(parsedActiveAgreementId)) return;
    if (groupDrafts.length === 0) return;

    const pending = pendingSwitchRef.current;
    if (pending && !sameAgreementId(parsedActiveAgreementId, pending.targetAgreementId)) {
      return;
    }

    const row = groupDrafts.find((d) => sameAgreementId(d.id, parsedActiveAgreementId));
    if (!row) return;
    if (loadedVersionRef.current === row.latestVersionId) {
      if (pending && sameAgreementId(pending.targetAgreementId, parsedActiveAgreementId)) {
        pendingSwitchRef.current = null;
        switchingDraftRef.current = false;
      }
      return;
    }

    const load = async () => {
      try {
        await loadActiveDraft(parsedActiveAgreementId, groupDrafts, {
          forcedInternalStep: pending?.internalStep ?? null,
        });
        if (
          pendingSwitchRef.current
          && sameAgreementId(pendingSwitchRef.current.targetAgreementId, parsedActiveAgreementId)
        ) {
          pendingSwitchRef.current = null;
        }
      } catch (err) {
        pendingSwitchRef.current = null;
        switchingDraftRef.current = false;
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

  useEffect(() => {
    if (pendingSwitchRef.current) return;
    if (loadingGroup || groupDrafts.length === 0) return;
    if (Number.isNaN(parsedActiveAgreementId)) return;
    const hasValidActive = groupDrafts.some((row) => sameAgreementId(row.id, parsedActiveAgreementId));
    if (!hasValidActive) {
      const fallbackId = groupDrafts[0].id;
      const rememberedStep = resolveTargetDraftStep(fallbackId, agreementStepsRef.current);
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('activeAgreementId', String(fallbackId));
        if (rememberedStep != null) {
          next.set('step', String(urlStepFromInternal(rememberedStep)));
        }
        return next;
      }, { replace: true });
    }
  }, [groupDrafts, parsedActiveAgreementId, loadingGroup, setSearchParams]);

  const syncStepToUrl = useCallback((internalStep) => {
    applyWizardStep(parsedActiveAgreementId, internalStep);
  }, [applyWizardStep, parsedActiveAgreementId]);

  const urlStepParam = searchParams.get('step');

  useEffect(() => {
    if (!sourceAgreement) return;
    if (pendingSwitchRef.current || switchingDraftRef.current || loadingDraft) return;
    if (sourceAgreement.agreementId != null
      && activeAgreementId
      && !sameAgreementId(sourceAgreement.agreementId, parsedActiveAgreementId)) {
      return;
    }
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
    loadingDraft,
    activeAgreementId,
  ]);

  const handleDraftTabChange = useCallback((agreementId) => {
    if (sameAgreementId(agreementId, parsedActiveAgreementId)) return;

    rememberAgreementStep(parsedActiveAgreementId, state.step);

    const targetInternalStep = resolveTargetDraftStep(agreementId, agreementStepsRef.current) ?? 0;
    pendingSwitchRef.current = {
      targetAgreementId: agreementId,
      internalStep: targetInternalStep,
    };
    switchingDraftRef.current = true;
    loadedVersionRef.current = null;
    const path = buildGroupWizardPath(parsedGroupId, agreementId, {
      step: urlStepFromInternal(targetInternalStep),
    });
    if (path) navigate(path);
  }, [parsedActiveAgreementId, parsedGroupId, state.step, navigate, rememberAgreementStep]);

  const handleDraftTabDelete = useCallback((agreementId) => {
    setDeleteTargetId(agreementId);
  }, []);

  const handleConfirmDeleteDraft = async () => {
    if (!deleteTargetId) return;
    setDeletingDraft(true);
    try {
      await axiosInstance.delete(ENDPOINTS.AGREEMENT_DELETE(deleteTargetId));
      const wasActive = sameAgreementId(deleteTargetId, parsedActiveAgreementId);
      const previousSorted = sortDraftsByCreatedAt(groupDrafts);
      const deletedIndex = previousSorted.findIndex((row) => sameAgreementId(row.id, deleteTargetId));

      setAgreementSteps((prev) => {
        const next = { ...prev };
        Object.keys(next).forEach((key) => {
          if (sameAgreementId(key, deleteTargetId)) {
            delete next[key];
          }
        });
        agreementStepsRef.current = next;
        return next;
      });
      clearRememberedWizardStep(deleteTargetId);

      const rows = await refreshGroupDrafts();
      setDeleteTargetId(null);

      if (!wasActive) {
        enqueueSnackbar('Draft deleted', { variant: 'success' });
        return;
      }

      if (rows.length === 0) {
        enqueueSnackbar('Draft deleted', { variant: 'success' });
        navigate(buildGroupDetailPath(parsedGroupId) || ROUTES.AGREEMENTS);
        return;
      }

      const sorted = sortDraftsByCreatedAt(rows);
      const neighborIndex = Math.min(
        Math.max(deletedIndex, 0),
        sorted.length - 1,
      );
      const target = sorted[neighborIndex];
      // Prefer sessionStorage / in-memory step — never force 0 over a remembered step.
      const rememberedTargetStep = resolveTargetDraftStep(target.id, agreementStepsRef.current);
      const targetStep = rememberedTargetStep ?? 0;
      pendingSwitchRef.current = {
        targetAgreementId: target.id,
        internalStep: targetStep,
      };
      loadedVersionRef.current = null;
      switchingDraftRef.current = true;

      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('activeAgreementId', String(target.id));
        next.set('step', String(urlStepFromInternal(targetStep)));
        return next;
      }, { replace: true });

      await loadActiveDraft(target.id, rows, {
        forcedInternalStep: targetStep,
      });
      if (
        pendingSwitchRef.current
        && sameAgreementId(pendingSwitchRef.current.targetAgreementId, target.id)
      ) {
        pendingSwitchRef.current = null;
      }
      enqueueSnackbar('Draft deleted', { variant: 'success' });
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
    const includeDocuments = validateStep2 || validateCommercialStructure;
    const { data } = await axiosInstance.put(
      ENDPOINTS.AGREEMENT_VERSION_UPDATE(draftAgreementId),
      buildSanitizedStep1UpdatePayload(effectiveState, { sourceAgreement, includeDocuments }),
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
      navigate(buildGroupDetailPath(parsedGroupId) || ROUTES.AGREEMENTS);
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

      const previousAgreementId = parsedActiveAgreementId;
      rememberAgreementStep(previousAgreementId, state.step);

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

      // Lock before draft-list state updates so effects cannot reload the previous draft.
      pendingSwitchRef.current = {
        targetAgreementId: newAgreementId,
        internalStep: 0,
      };
      rememberAgreementStep(newAgreementId, 0);
      loadedVersionRef.current = null;
      switchingDraftRef.current = true;
      setConfigurationFieldErrors({});
      setCommercialFieldErrors({});
      setMaxReachableStep(0);

      const rows = await refreshGroupDrafts();
      const hasCreatedRow = rows.some((row) => sameAgreementId(row.id, newAgreementId));
      if (!hasCreatedRow) {
        setGroupDrafts([
          ...rows,
          {
            id: newAgreementId,
            latestVersionId: newDraft.id,
            agreementName: newDraft.agreementName,
            createdAt: new Date().toISOString(),
          },
        ]);
      }

      const path = buildGroupWizardPath(parsedGroupId, newAgreementId, {
        step: urlStepFromInternal(0),
      });
      if (path) {
        navigate(path, { replace: true });
      }
      enqueueSnackbar('Agreement saved — configure another', { variant: 'success' });
    } catch (err) {
      pendingSwitchRef.current = null;
      switchingDraftRef.current = false;
      enqueueSnackbar(err.response?.data?.message || err.message || 'Failed to save and create another', { variant: 'error' });
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
      if (stepIndex <= maxReachableStep) {
        discardUnsavedWizardStep(stepIndex);
        rememberAgreementStep(parsedActiveAgreementId, stepIndex);
        const params = new URLSearchParams(searchParams);
        params.set('step', String(urlStepFromInternal(stepIndex)));
        setSearchParams(params, { replace: true });
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
    const previousStep = state.step - 1;
    discardUnsavedWizardStep(previousStep);
    rememberAgreementStep(parsedActiveAgreementId, previousStep);
    const params = new URLSearchParams(searchParams);
    params.set('step', String(urlStepFromInternal(previousStep)));
    setSearchParams(params, { replace: true });
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

  const canSaveAndCreateAnother = resolveHighestAccessibleStep(state, sourceAgreement) === 3;

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
        activeDraftId={resolvedActiveDraftId}
        onDraftTabChange={handleDraftTabChange}
        onDraftTabDelete={handleDraftTabDelete}
        showDraftTabs
        submitButtonLabel="Submit for Approval"
        footerMode={footerMode}
        onNext={handleSetupNext}
        onBack={handleBack}
        onCancel={() => navigate(buildGroupDetailPath(parsedGroupId) || ROUTES.AGREEMENTS)}
        onSaveAndCreateAnother={state.step === 3 ? handleSaveAndCreateAnother : undefined}
        saveAndCreateAnotherDisabled={!canSaveAndCreateAnother}
        saveAndCreateAnotherDisabledReason="Complete steps 1–3 (foundational data) before creating another agreement."
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
