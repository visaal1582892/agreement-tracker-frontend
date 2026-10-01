import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  Paper,
  Typography,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import axiosInstance from '../../api/axiosInstance';
import { ENDPOINTS } from '../../config/endpoints';
import { normalizePageResponse } from '../../utils/pageResponse';
import PageHeader from '../../components/ui/PageHeader';
import UnifiedSelect from '../../components/forms/UnifiedSelect';
import CommercialPayoutReview from './wizard/CommercialPayoutReview';
import { extractApiErrorMessage } from '../../api/commercialApi';

const MAX_RESULTS = 30;

function toOption(agreement) {
  const versionId = agreement.latestVersionId ?? agreement.currentVersionId ?? agreement.id;
  const name = agreement.agreementName || `Agreement ${agreement.id}`;
  const group = agreement.agreementGroupName;
  return {
    id: agreement.id,
    versionId,
    agreementName: name,
    agreementGroupName: group,
    versionNumber: agreement.currentVersionNumber,
    label: group ? `${name} · ${group}` : name,
  };
}

export default function CommercialPayoutsPage() {
  const { enqueueSnackbar } = useSnackbar();
  const [options, setOptions] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedAgreement, setSelectedAgreement] = useState(null);
  const [loadingVersion, setLoadingVersion] = useState(false);
  const [loadedVersionId, setLoadedVersionId] = useState(null);
  const [loadedVersion, setLoadedVersion] = useState(null);
  const lastQueryRef = useRef('');

  const handleSearch = async (query) => {
    const q = (query ?? '').trim();
    lastQueryRef.current = q;

    setSearching(true);
    try {
      const [byName, byGroup] = await Promise.all([
        axiosInstance.get(ENDPOINTS.AGREEMENTS, {
          params: { scope: 'ALL', size: MAX_RESULTS, page: 0, ...(q ? { agreementName: q } : {}) },
        }),
        axiosInstance.get(ENDPOINTS.AGREEMENTS, {
          params: { scope: 'ALL', size: MAX_RESULTS, page: 0, ...(q ? { agreementGroupName: q } : {}) },
        }),
      ]);

      if (lastQueryRef.current !== q) return;

      const merged = new Map();
      [...normalizePageResponse(byName.data).content, ...normalizePageResponse(byGroup.data).content]
        .forEach((agreement) => {
          if (!merged.has(agreement.id)) {
            merged.set(agreement.id, toOption(agreement));
          }
        });
      setOptions([...merged.values()].slice(0, MAX_RESULTS));
    } catch (err) {
      if (lastQueryRef.current === q) {
        setOptions([]);
        enqueueSnackbar(await extractApiErrorMessage(err, 'Failed to search agreements'), { variant: 'error' });
      }
    } finally {
      if (lastQueryRef.current === q) setSearching(false);
    }
  };

  // Load 30 most-recent agreements on mount so the dropdown has options immediately
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { handleSearch(''); }, []);

  const handleSelect = async (option) => {
    setSelectedAgreement(option);
    if (!option) {
      setLoadedVersion(null);
      setLoadedVersionId(null);
      return;
    }
    if (!option.versionId) {
      enqueueSnackbar('Selected agreement has no version to calculate.', { variant: 'warning' });
      return;
    }

    setLoadingVersion(true);
    try {
      const { data } = await axiosInstance.get(ENDPOINTS.AGREEMENT_VERSION_BY_ID(option.versionId));
      setLoadedVersion(data);
      setLoadedVersionId(option.versionId);
    } catch (err) {
      setLoadedVersion(null);
      setLoadedVersionId(null);
      enqueueSnackbar(
        await extractApiErrorMessage(err, `Failed to load agreement version ${option.versionId}`),
        { variant: 'error' },
      );
    } finally {
      setLoadingVersion(false);
    }
  };

  return (
    <Box>
      <PageHeader
        title="Commercial Payout Calculator"
        subtitle="Calculation only — determines the amount payable from purchase data and agreement terms. It does not record or track actual payments."
      />

      <Paper elevation={0} sx={{ p: 2, borderRadius: 2, border: '1px solid', borderColor: 'divider', mb: 2 }}>
        <Typography fontWeight={600} sx={{ mb: 1.5 }}>Select Agreement</Typography>
        <Box sx={{ maxWidth: 520 }}>
          <UnifiedSelect
            label="Search agreement or group name"
            placeholder="Type an agreement name or group name…"
            showOptionsOnEmpty
            options={options}
            value={selectedAgreement}
            onChange={handleSelect}
            onSearch={handleSearch}
            loading={searching}
            getOptionLabel={(option) => option?.label ?? ''}
            isOptionEqualToValue={(option, current) => option?.id === current?.id}
            renderOption={(option) => (
              <Box>
                <Typography variant="body2" fontWeight={600}>{option.agreementName}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {[option.agreementGroupName, option.versionNumber != null ? `V${option.versionNumber}` : null]
                    .filter(Boolean)
                    .join(' · ')}
                </Typography>
              </Box>
            )}
            noOptionsText="No matching agreements"
            emptyQueryText="Loading agreements…"
          />
        </Box>

        {loadingVersion && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 1.5 }}>
            <CircularProgress size={18} />
            <Typography variant="body2" color="text.secondary">Loading agreement…</Typography>
          </Box>
        )}

        {loadedVersion && !loadingVersion && (
          <Box sx={{ display: 'flex', gap: 1, mt: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
            <Typography variant="body2" fontWeight={600}>
              {loadedVersion.agreementName || `Version ${loadedVersion.id}`}
            </Typography>
            {loadedVersion.versionNumber != null && (
              <Chip label={`V${loadedVersion.versionNumber}`} size="small" variant="outlined" />
            )}
            {loadedVersion.incomeTypeName && (
              <Chip label={`Income: ${loadedVersion.incomeTypeName}`} size="small" />
            )}
          </Box>
        )}
      </Paper>

      {loadedVersion && !loadingVersion ? (
        <CommercialPayoutReview
          key={loadedVersionId}
          agreementVersionId={loadedVersionId}
          version={loadedVersion}
        />
      ) : (
        <Alert severity="info">
          Search and select an agreement above to run the payout calculator.
        </Alert>
      )}
    </Box>
  );
}
