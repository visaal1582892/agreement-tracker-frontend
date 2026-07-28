import { useEffect, useState } from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import { useSnackbar } from 'notistack';
import { extractApiErrorMessage, fetchJbpStructure } from '../../../api/jbpApi';
import JbpMatrixReviewTable from './JbpMatrixReviewTable';

export default function JbpReviewShowcase({
  agreementVersionId,
  financialYearStartMonth = 4,
  /** Edit/Renew: prefer in-memory staged workbook over source version fetch. */
  memoryStagedWorkbook = null,
  /** When true and no memory workbook, show deep-copy message instead of fetching source. */
  preferMemoryOverFetch = false,
}) {
  const { enqueueSnackbar } = useSnackbar();
  const [loading, setLoading] = useState(false);
  const [stagedWorkbook, setStagedWorkbook] = useState(null);
  const [configurations, setConfigurations] = useState(null);

  const hasMemory = Boolean(memoryStagedWorkbook?.sheets?.length);

  useEffect(() => {
    if (hasMemory) {
      setStagedWorkbook(memoryStagedWorkbook);
      return undefined;
    }
    if (preferMemoryOverFetch) {
      setStagedWorkbook(null);
      return undefined;
    }
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
          // Backend returns stagedWorkbooks as a Map<String, JbpStagedWorkbookDto>.
          // Merge all per-config workbooks into a single stagedWorkbook state object.
            setConfigurations(data?.configurations ?? null);
            if (data?.stagedWorkbooks && Object.keys(data.stagedWorkbooks).length > 0) {
              const allSheets = Object.values(data.stagedWorkbooks)
                .flatMap((wb) => wb?.sheets ?? [])
                .filter(Boolean);
              setStagedWorkbook(allSheets.length > 0 ? { sheets: allSheets } : null);
            } else {
              setStagedWorkbook(data?.stagedWorkbook ?? null);
            }
        }
      } catch (err) {
        if (!cancelled) {
          setStagedWorkbook(null);
          setConfigurations(null);
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
  }, [
    agreementVersionId,
    enqueueSnackbar,
    hasMemory,
    memoryStagedWorkbook,
    preferMemoryOverFetch,
  ]);

  if (hasMemory) {
    return (
      <Box>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
          In-memory JBP upload (replaces source on Submit for Approval).
        </Typography>
        <JbpMatrixReviewTable
          stagedWorkbook={memoryStagedWorkbook}
          title={null}
          financialYearStartMonth={financialYearStartMonth}
        />
      </Box>
    );
  }

  if (preferMemoryOverFetch) {
    return (
      <Typography variant="body2" color="text.secondary">
        No new JBP upload in this revision. Source matrix will be deep-copied on submit.
      </Typography>
    );
  }

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
      configurations={configurations}
      title={null}
      financialYearStartMonth={financialYearStartMonth}
    />
  );
}
