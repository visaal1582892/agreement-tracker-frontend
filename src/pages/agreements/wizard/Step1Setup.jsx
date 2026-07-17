import { Box, Typography } from '@mui/material';
import Step1GroupSetup from './Step1GroupSetup';
import Step1FoundationalFields from './Step1FoundationalFields';

export default function Step1Setup({
  state,
  updateFields,
  updateAgreementDetails,
  groupFieldsLocked = false,
  identityLocked = false,
  minStartDate = null,
  fieldErrors = {},
  onClearFieldError,
}) {
  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <Typography variant="h6" fontWeight={600} mb={0.5}>
        Foundational Setup
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
        Agreement group, classification, and contract duration for this agreement.
      </Typography>

      <Step1GroupSetup
        state={state}
        updateFields={updateFields}
        groupFieldsLocked={groupFieldsLocked || identityLocked}
      />
      <Step1FoundationalFields
        agreement={state.agreement}
        onUpdateDetails={updateAgreementDetails}
        identityLocked={identityLocked}
        minStartDate={minStartDate}
        fieldErrors={fieldErrors}
        onClearFieldError={onClearFieldError}
      />
    </Box>
  );
}
