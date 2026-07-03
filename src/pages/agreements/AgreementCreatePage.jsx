import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box } from '@mui/material';
import { useSnackbar } from 'notistack';
import axiosInstance from '../../api/axiosInstance';
import { ENDPOINTS } from '../../config/endpoints';
import { ROUTES } from '../../config/routes';
import WizardLayout from '../../layouts/WizardLayout';
import { useAgreementWizard } from '../../hooks/useAgreementWizard';
import { buildGroupWizardPath } from '../../utils/agreementNavigation';
import {
  buildStep1CreatePayload,
  buildSanitizedStep1UpdatePayload,
  urlStepFromInternal,
  validateStep1Fields,
} from '../../utils/agreementWizardUtils';
import Step1Setup from './wizard/Step1Setup';

export default function AgreementCreatePage() {
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const {
    state,
    updateFields,
    updateAgreementDetails,
    updateAgreementAsset,
    updateAgreementCommercials,
    updateProductRules,
  } = useAgreementWizard();
  const [savingDraft, setSavingDraft] = useState(false);

  const createDraft = useCallback(async () => {
    const { data } = await axiosInstance.post(ENDPOINTS.AGREEMENTS, buildStep1CreatePayload(state));
    const created = data.agreements?.[0];
    if (!created?.id) {
      throw new Error('Draft created but no agreement id returned');
    }
    return created;
  }, [state]);

  const handleNext = async () => {
    if (!validateStep1Fields(state, enqueueSnackbar)) return;
    setSavingDraft(true);
    try {
      const created = await createDraft();
      await axiosInstance.put(
        ENDPOINTS.AGREEMENT_VERSION_UPDATE(created.id),
        buildSanitizedStep1UpdatePayload(state),
        { params: { validateStep1: true } },
      );
      enqueueSnackbar('Foundational setup saved', { variant: 'success' });
      navigate(
        buildGroupWizardPath(created.companyAgreementGroupId, created.agreementId, {
          step: urlStepFromInternal(1),
        }),
        { replace: true },
      );
    } catch (err) {
      enqueueSnackbar(err.response?.data?.message || err.message || 'Failed to save draft', { variant: 'error' });
    } finally {
      setSavingDraft(false);
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
      <WizardLayout
        activeStep={0}
        agreementTabLabel="New Agreement"
        footerMode="setup"
        onNext={handleNext}
        onBack={() => {}}
        onCancel={() => navigate(ROUTES.AGREEMENTS)}
        isSavingDraft={savingDraft}
      >
        <Step1Setup
          state={state}
          updateFields={updateFields}
          updateAgreementDetails={updateAgreementDetails}
          updateAgreementAsset={updateAgreementAsset}
          updateAgreementCommercials={updateAgreementCommercials}
          updateProductRules={updateProductRules}
        />
      </WizardLayout>
    </Box>
  );
}
