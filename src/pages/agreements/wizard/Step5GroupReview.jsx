import { useEffect, useState } from 'react';
import {
  Box, Typography, CircularProgress, Alert,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import { loadGroupDraftReviewData } from '../../../utils/groupDraftValidation';
import WizardReviewContent from './WizardReviewContent';

export default function Step5GroupReview({ sharedState, groupDrafts, activeAgreementId }) {
  const { enqueueSnackbar } = useSnackbar();
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const data = await loadGroupDraftReviewData(groupDrafts);
        if (!cancelled) setReviews(data);
      } catch (err) {
        if (!cancelled) {
          enqueueSnackbar(err.response?.data?.message || 'Failed to load review data', { variant: 'error' });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    if (groupDrafts?.length) load();
    return () => { cancelled = true; };
  }, [groupDrafts, enqueueSnackbar]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  const activeReview = reviews.find(
    (item) => item.row.id === activeAgreementId || item.version.agreementId === activeAgreementId,
  );

  return (
    <Box>
      <Typography variant="h6" fontWeight={600} mb={0.5}>Review & Submit</Typography>
      <Typography variant="body2" color="text.secondary" mb={3}>
        Review each draft agreement using the tabs above before submitting for approval.
      </Typography>

      {!activeReview && (
        <Alert severity="warning">Select a draft agreement tab to review.</Alert>
      )}

      {activeReview && (
        <>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>
            {activeReview.version.agreementName || activeReview.row.agreementName || 'Agreement'}
          </Typography>
          <WizardReviewContent
            wizardState={sharedState}
            version={activeReview.version}
            serverAgreementId={activeReview.version.id}
            slabs={activeReview.slabs}
          />
        </>
      )}

      {reviews.length === 0 && (
        <Alert severity="warning">No draft agreements to review.</Alert>
      )}
    </Box>
  );
}
