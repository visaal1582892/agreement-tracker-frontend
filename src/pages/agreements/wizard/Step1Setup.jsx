import { Box, Typography } from '@mui/material';
import Step1CompanyVendors from './Step1CompanyVendors';
import Step1FoundationalFields from './Step1FoundationalFields';

export default function Step1Setup({
  state,
  updateFields,
  updateAgreementDetails,
  groupFieldsLocked = false,
}) {
  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <Typography variant="h6" fontWeight={600} mb={0.5}>
        Foundational Setup
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
        Partner, classification, and contract duration for this agreement.
      </Typography>

      <Step1CompanyVendors
        state={state}
        updateFields={updateFields}
        groupFieldsLocked={groupFieldsLocked}
      />
      <Step1FoundationalFields
        agreement={state.agreement}
        onUpdateDetails={updateAgreementDetails}
      />
    </Box>
  );
}
