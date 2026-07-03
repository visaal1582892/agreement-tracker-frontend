import { useEffect, useState } from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import { useSnackbar } from 'notistack';
import { extractApiErrorMessage, fetchJbpStructure } from '../../../api/jbpApi';
import JbpMatrixReviewTable from './JbpMatrixReviewTable';

export default function JbpReviewShowcase({ agreementVersionId }) {
  const { enqueueSnackbar } = useSnackbar();
  const [loading, setLoading] = useState(false);
  const [stagedWorkbook, setStagedWorkbook] = useState(null);

  useEffect(() => {
    if (!agreementVersionId) {
      setStagedWorkbook(null);
      return undefined;
    }

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const data = await fetchJbpStructure(agreementVersionId);
        if (!cancelled) {
          setStagedWorkbook(data?.stagedWorkbook ?? null);
        }
      } catch (err) {
        if (!cancelled) {
          setStagedWorkbook(null);
          if (err?.response?.status !== 404) {
            enqueueSnackbar(
              await extractApiErrorMessage(err, 'Failed to load JBP structure'),
              { variant: 'error' },
            );
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [agreementVersionId, enqueueSnackbar]);

  if (!agreementVersionId) {
    return null;
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 2 }}>
        <CircularProgress size={18} />
        <Typography variant="body2" color="text.secondary">Loading JBP matrix…</Typography>
      </Box>
    );
  }

  if (!stagedWorkbook?.sheets?.length) {
    return (
      <Typography variant="body2" color="text.secondary">
        No committed JBP matrix found.
      </Typography>
    );
  }

  return (
    <JbpMatrixReviewTable
      stagedWorkbook={stagedWorkbook}
      title={null}
    />
  );
}
