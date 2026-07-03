import { Box, Typography } from '@mui/material';
import WizardReviewContent from './WizardReviewContent';

export default function Step5Review({ state, serverAgreementId, sourceAgreement }) {
  if (!state?.agreement) {
    return null;
  }

  return (
    <Box>
      <Typography variant="h6" fontWeight={600} mb={0.5}>Review & Submit</Typography>
      <Typography variant="body2" color="text.secondary" mb={3}>
        Review grouped configuration before submitting for approval.
      </Typography>

      <WizardReviewContent
        wizardState={state}
        version={sourceAgreement}
        serverAgreementId={serverAgreementId}
      />
    </Box>
  );
}
