import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import {
  Box, Grid, Typography, Paper, Divider, Chip, Button, Select, MenuItem,
  FormControl, Stepper, Step, StepLabel, StepContent, TextField,
  Dialog, DialogTitle, DialogContent, DialogActions, Alert, Tabs, Tab,
  List, ListItemButton, ListItemText, Accordion, AccordionSummary, AccordionDetails,
  Breadcrumbs, Link as MuiLink, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
} from '@mui/material';
import { ArrowBack, Edit, ExpandMore, PowerSettingsNew, SwapHoriz, History, NavigateNext } from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import axiosInstance from '../../api/axiosInstance';
import { ENDPOINTS } from '../../config/endpoints';
import { BRAND } from '../../config/theme';
import StatusBadge from '../../components/ui/StatusBadge';
import LoadingOverlay from '../../components/ui/LoadingOverlay';
import { useModal } from '../../hooks/useModal';
import { useAgreementPermissions } from '../../hooks/useAgreementPermissions';
import { isHistoricalAgreement, isReadOnlyAgreement } from '../../utils/authUtils';
import { ROUTES } from '../../config/routes';
import { buildAgreementEditPath } from '../../utils/agreementNavigation';
import { approveAgreement, rejectAgreement, submitAgreementForApproval } from '../../store/slices/agreementSlice';
import TransferOwnershipModal from '../../components/agreements/TransferOwnershipModal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import CommercialsUploadModal from './wizard/CommercialsUploadModal';
import JbpReviewShowcase from './wizard/JbpReviewShowcase';
import { resolveAgreementFinancialYearStartMonth } from '../../utils/jbpMatrixUtils';
import { isAssetRentalIncomeType, isCommercialContractsIncomeType, isAdHocIncomeType } from '../../utils/incomeTypeUtils';
import { CAP_UNIT } from '../../constants/capUnit';
import { PAYOUT_FREQUENCY_OPTIONS } from '../../constants/commercialStructure';
import StoreMappingReviewSummary from './wizard/StoreMappingReviewSummary';
import dayjs from 'dayjs';

const currencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
});

function formatAssetMoney(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? currencyFormatter.format(numeric) : '—';
}

function formatAssetPayoutPeriods(periods = []) {
  if (!periods.length) return '—';
  return periods
    .map((period) => `${period.periodMonths} mo @ ${formatAssetMoney(period.payoutPerStore)}`)
    .join('; ');
}

function formatCommercialValue(value, valueType) {
  if (value === null || value === undefined || value === '') return '—';
  if (valueType === 'PERCENTAGE') return `${value}%`;
  return `₹${Number(value).toLocaleString('en-IN')}`;
}

function formatCapValue(value, capUnit) {
  if (value === null || value === undefined || value === '') return '—';
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return String(value);
  if (capUnit === CAP_UNIT.QUANTITY) {
    return numeric.toLocaleString('en-IN');
  }
  return `₹${numeric.toLocaleString('en-IN')}`;
}

function payoutFrequencyLabel(value) {
  return PAYOUT_FREQUENCY_OPTIONS.find((option) => option.value === value)?.label || value || '—';
}

function resolveAssetPayoutMode(agreement) {
  const periods = agreement?.assetPayoutPeriods ?? [];
  if (periods.length > 0) return 'PER_STORE';
  if (agreement?.asset?.flatPayout != null && Number(agreement.asset.flatPayout) > 0) return 'FLAT';
  return null;
}

/** MUI StepIcon — strip internal props so they never hit the DOM. */
function TimelineStepIcon({
  active,
  completed,
  error,
  icon,
  StepIconComponent,
  ownerState,
  color = '#999',
  className,
}) {
  return (
    <Box
      className={className}
      sx={{
        width: 12,
        height: 12,
        borderRadius: '50%',
        bgcolor: color,
        mt: 0.5,
      }}
    />
  );
}

export default function AgreementDetailPage({
  embeddedAgreementId,
  onActionComplete,
  embeddedContext,
} = {}) {
  const { agreementId: routeAgreementId } = useParams();
  const agreementId = embeddedAgreementId ?? routeAgreementId;
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { enqueueSnackbar } = useSnackbar();
  const { getDetailPageActions } = useAgreementPermissions();

  const [group, setGroup] = useState(null);
  const [versions, setVersions] = useState([]);
  const [selectedVersionId, setSelectedVersionId] = useState(null);
  const [agreement, setAgreement] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rejectRemarks, setRejectRemarks] = useState('');
  const [activeTab, setActiveTab] = useState('details');
  const [submitRevisionComments, setSubmitRevisionComments] = useState('');
  const rejectModal = useModal();
  const terminateModal = useModal();
  const transferModal = useModal();
  const submitModal = useModal();
  const [terminateData, setTerminateData] = useState({ comments: '', requestedTerminationDate: '' });
  const [slabs, setSlabs] = useState([]);

  const loadVersionDetail = useCallback(async (versionId) => {
    if (!versionId) return null;
    try {
      const [agrRes, tlRes] = await Promise.all([
        axiosInstance.get(ENDPOINTS.AGREEMENT_VERSION_BY_ID(versionId)),
        axiosInstance.get(ENDPOINTS.AGREEMENT_VERSION_TIMELINE(versionId)),
      ]);
      setAgreement(agrRes.data);
      setTimeline(tlRes.data);
      return agrRes.data;
    } catch {
      enqueueSnackbar('Failed to load version details', { variant: 'error' });
      return null;
    }
  }, [enqueueSnackbar]);

  const applyVersionPatch = useCallback((updated) => {
    if (!updated) return;
    setAgreement(updated);
    setVersions((prev) => prev.map((v) => (
      v.id === updated.id
        ? {
          ...v,
          approvalStatus: updated.approvalStatus,
          computedStatus: updated.computedStatus,
        }
        : v
    )));
    if (updated.approvalStatus === 'APPROVED') {
      setGroup((prev) => (prev ? { ...prev, currentVersionId: updated.id } : prev));
    }
  }, []);

  const load = async (preferredVersionId, { silent = false } = {}) => {
    if (!agreementId || agreementId === 'undefined') return;
    if (!silent) setLoading(true);
    try {
      const [groupRes, versionsRes] = await Promise.all([
        axiosInstance.get(ENDPOINTS.AGREEMENT_BY_ID(agreementId)),
        axiosInstance.get(ENDPOINTS.AGREEMENT_VERSIONS(agreementId)),
      ]);
      setGroup(groupRes.data);
      setVersions(versionsRes.data);

      const pendingVersion = versionsRes.data.find((v) => v.approvalStatus === 'PENDING_APPROVAL');
      const nextVersionId = preferredVersionId
        || pendingVersion?.id
        || groupRes.data.currentVersionId
        || versionsRes.data[versionsRes.data.length - 1]?.id;

      setSelectedVersionId(nextVersionId);
      if (nextVersionId) {
        await loadVersionDetail(nextVersionId);
      } else {
        setAgreement(null);
        setTimeline([]);
      }
    } catch {
      enqueueSnackbar('Failed to load agreement', { variant: 'error' });
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    if (!agreementId || agreementId === 'undefined') return;
    setGroup(null);
    setVersions([]);
    setAgreement(null);
    setTimeline([]);
    setSelectedVersionId(null);
    load();
  }, [agreementId]);

  useEffect(() => {
    if (!selectedVersionId) return;
    loadVersionDetail(selectedVersionId);
  }, [selectedVersionId, loadVersionDetail]);

  useEffect(() => {
    if (!selectedVersionId || !agreement) {
      setSlabs([]);
      return;
    }
    const isCommercialContracts = isCommercialContractsIncomeType(
      [],
      agreement.incomeTypeId,
      agreement.incomeTypeName,
    );
    if (isCommercialContracts || agreement.commercialStructure !== 'SLAB') {
      setSlabs([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { data } = await axiosInstance.get(ENDPOINTS.AGREEMENT_VERSION_SLABS(selectedVersionId));
        if (!cancelled) setSlabs(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setSlabs([]);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedVersionId, agreement?.commercialStructure, agreement?.incomeTypeId, agreement?.incomeTypeName]);

  const refreshAfterMutation = async (updated, versionId = selectedVersionId) => {
    applyVersionPatch(updated);
    await load(versionId ?? updated?.id, { silent: true });
  };

  const handleApprove = async () => {
    const versionId = selectedVersionId;
    try {
      const updated = await dispatch(approveAgreement({ agreementId: versionId })).unwrap();
      enqueueSnackbar('Agreement approved', { variant: 'success' });
      await refreshAfterMutation(updated, versionId);
      onActionComplete?.();
    } catch (err) {
      enqueueSnackbar(typeof err === 'string' ? err : 'Approval failed', { variant: 'error' });
    }
  };

  const handleReject = async () => {
    const versionId = selectedVersionId;
    try {
      const updated = await dispatch(rejectAgreement({ agreementId: versionId, remarks: rejectRemarks })).unwrap();
      enqueueSnackbar('Agreement rejected', { variant: 'success' });
      rejectModal.close();
      setRejectRemarks('');
      await refreshAfterMutation(updated, versionId);
      onActionComplete?.();
    } catch (err) {
      enqueueSnackbar(typeof err === 'string' ? err : 'Rejection failed', { variant: 'error' });
    }
  };

  const handleNewVersion = async () => {
    try {
      const { data } = await axiosInstance.post(ENDPOINTS.AGREEMENT_NEW_VERSION(agreementId));
      await axiosInstance.put(ENDPOINTS.AGREEMENT_VERSION_SUBMIT(data.id));
      const msg = agreement?.approvalStatus === 'REJECTED'
        ? `Revision V${data.versionNumber} submitted for approval`
        : `New version V${data.versionNumber} submitted for approval`;
      enqueueSnackbar(msg, { variant: 'success' });
      await load();
      setSelectedVersionId(data.id);
      onActionComplete?.();
    } catch (err) {
      enqueueSnackbar(err.response?.data?.message || 'Failed', { variant: 'error' });
    }
  };

  const handleTerminate = async () => {
    try {
      const payload = { comments: terminateData.comments.trim() };
      if (terminateData.requestedTerminationDate) {
        payload.requestedTerminationDate = terminateData.requestedTerminationDate;
      }
      await axiosInstance.post(ENDPOINTS.AGREEMENT_VERSION_REQUEST_TERMINATE(selectedVersionId), payload);
      enqueueSnackbar('Termination request submitted to Approver.', { variant: 'success' });
      terminateModal.close();
      setTerminateData({ comments: '', requestedTerminationDate: '' });
      load();
    } catch (err) {
      enqueueSnackbar(err.response?.data?.message || 'Termination request failed', { variant: 'error' });
    }
  };

  const today = dayjs().format('YYYY-MM-DD');
  const terminateDateInvalid = terminateData.requestedTerminationDate
    && terminateData.requestedTerminationDate > today;

  const handleSubmitConfirm = async () => {
    const requiresRevisionReason = (agreement?.versionNumber ?? 1) > 1;
    if (requiresRevisionReason && !submitRevisionComments.trim()) return;

    submitModal.close();
    try {
      const updated = await dispatch(submitAgreementForApproval({
        agreementId: selectedVersionId,
        comments: submitRevisionComments.trim() || undefined,
      })).unwrap();
      enqueueSnackbar('Submitted for approval', { variant: 'success' });
      setSubmitRevisionComments('');
      await refreshAfterMutation(updated, selectedVersionId);
    } catch (err) {
      enqueueSnackbar(typeof err === 'string' ? err : 'Submit failed', { variant: 'error' });
    }
  };

  const latestDraftVersion = versions
    .filter((v) => v.approvalStatus === 'DRAFT')
    .reduce((max, v) => (!max || v.versionNumber > max.versionNumber ? v : max), null);

  const activeVersionId = group?.currentVersionId ?? latestDraftVersion?.id ?? null;
  const isReadOnlyView = Boolean(agreement && isReadOnlyAgreement(agreement));
  const isHistorical = Boolean(agreement && isHistoricalAgreement(agreement));
  const isPendingRevision = agreement?.approvalStatus === 'PENDING_APPROVAL';
  const isDraftRevision = agreement?.approvalStatus === 'DRAFT'
    && Boolean(activeVersionId && selectedVersionId !== activeVersionId);
  const requiresSubmitRevisionReason = (agreement?.versionNumber ?? 1) > 1;

  const actions = agreement
    ? getDetailPageActions(
      { ...agreement, id: selectedVersionId },
      { isReadOnlyView },
    )
    : null;

  const isCommercialContracts = isCommercialContractsIncomeType(
    [],
    agreement?.incomeTypeId,
    agreement?.incomeTypeName,
  );
  const isAssetRental = isAssetRentalIncomeType(
    [],
    agreement?.incomeTypeId,
    agreement?.incomeTypeName,
  );
  const isSlabStructure = agreement?.commercialStructure === 'SLAB';
  const showJbpMatrix = Boolean(
    agreement && isCommercialContracts && (isSlabStructure || agreement.jbpCommitted),
  );
  const isAdHoc = isAdHocIncomeType([], agreement?.incomeTypeId, agreement?.incomeTypeName);
  const showLegacyTargetsMatrix = Boolean(
    agreement && !isCommercialContracts && !isAssetRental && !isAdHoc && isSlabStructure,
  );
  const assetPayoutMode = isAssetRental ? resolveAssetPayoutMode(agreement) : null;
  const assetCategory = agreement?.asset?.assetCategory;
  const assetCategoryLabel = assetCategory === 'PHYSICAL_ASSET'
    ? 'Physical Asset'
    : assetCategory === 'ACTIVITY'
      ? 'Activity'
      : (assetCategory || '—');
  const assetStoreMappings = Array.isArray(agreement?.storeMappings) ? agreement.storeMappings : [];

  const daysToExpiry = agreement?.expiryDate
    ? dayjs(agreement.expiryDate).startOf('day').diff(dayjs().startOf('day'), 'day')
    : null;
  const isCurrentVersion = Boolean(group?.currentVersionId && selectedVersionId === group.currentVersionId);
  // In-progress toggle: active/near-expiry approved current version (not read-only superseded/terminated).
  const showLifecycleActions = isCurrentVersion
    && agreement?.approvalStatus === 'APPROVED'
    && agreement?.computedStatus !== 'TERMINATED'
    && agreement?.computedStatus !== 'SUPERSEDED'
    && (actions?.editApproved || actions?.terminate || actions?.renew)
    && (agreement?.computedStatus === 'EXPIRED'
      || (daysToExpiry != null && daysToExpiry <= 90)
      || Boolean(agreement?.inProgressFlag));
  // Renew: rights (actions.renew) + current APPROVED + window (EXPIRED or ≤90 days).
  const showRenewButton = isCurrentVersion && actions?.renew;

  const handleToggleInProgress = async () => {
    try {
      const { data } = await axiosInstance.patch(ENDPOINTS.AGREEMENT_IN_PROGRESS(agreementId));
      enqueueSnackbar(
        data.inProgressFlag ? 'Marked discussions in progress' : 'In progress status cleared',
        { variant: 'success' },
      );
      await refreshAfterMutation(data, data.id);
    } catch (err) {
      enqueueSnackbar(err.response?.data?.message || 'Failed to update in-progress status', { variant: 'error' });
    }
  };

  const handleRenew = () => {
    const versionId = group?.currentVersionId || selectedVersionId;
    const path = buildAgreementEditPath(versionId, { step: 1, mode: 'renew' });
    if (path) navigate(path);
  };

  const handleSelectVersion = (versionId) => {
    setSelectedVersionId(versionId);
    setActiveTab('details');
  };

  const ACTION_COLOR = {
    SUBMITTED: '#2196F3',
    APPROVED: BRAND.green,
    REJECTED: BRAND.red,
    TRANSFER_REQUESTED: '#2196F3',
    TRANSFER_APPROVED: BRAND.green,
    TRANSFER_REJECTED: BRAND.red,
    TERMINATE_REQUESTED: '#FF9800',
    TERMINATE_APPROVED: BRAND.green,
    TERMINATE_REJECTED: BRAND.red,
  };

  const formatTimelineAction = (entry) => {
    if (entry.operationalEvent) {
      return entry.operationalEvent.replace(/_/g, ' ');
    }
    return entry.action;
  };

  const displayName = agreement?.agreementName || group?.agreementName || 'Agreement';

  const pendingRequest = agreement?.pendingActionRequest;
  const pendingActionLabel = pendingRequest?.actionType === 'TRANSFER' ? 'Transfer' : 'Terminate';

  const isOperationalReview = embeddedContext === 'operational-review';

  const invalidAgreementId = !agreementId
    || agreementId === 'undefined'
    || agreementId === 'new'
    || agreementId === 'groups'
    || Number.isNaN(Number(agreementId));

  if (invalidAgreementId) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        Invalid agreement link. Return to Agreements and try again.
      </Alert>
    );
  }

  if (loading) return <LoadingOverlay open />;

  return (
    <Box>
      {!embeddedAgreementId && (
        <Breadcrumbs separator={<NavigateNext fontSize="small" />} sx={{ mb: 1 }}>
          <MuiLink
            component="button"
            variant="body2"
            underline="hover"
            color="inherit"
            onClick={() => navigate(ROUTES.AGREEMENTS)}
            sx={{ border: 'none', background: 'none', cursor: 'pointer', p: 0 }}
          >
            Agreements
          </MuiLink>
          <Typography variant="body2" color="text.primary">{displayName}</Typography>
        </Breadcrumbs>
      )}

      {!embeddedAgreementId && (
        <Button
          variant="text"
          color="inherit"
          startIcon={<ArrowBack />}
          onClick={() => navigate(ROUTES.AGREEMENTS)}
          sx={{ mb: 1, ml: -1, color: 'text.secondary', '&:hover': { bgcolor: 'action.hover' } }}
        >
          Back to Agreements
        </Button>
      )}

      {/* Header */}
      {!isOperationalReview && (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>{displayName}</Typography>
          <Typography variant="body2" color="text.secondary">
            {group?.agreementGroupName || group?.name}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          {/* Version Switcher */}
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <Select value={selectedVersionId || ''} onChange={(e) => setSelectedVersionId(e.target.value)}>
              {versions.map((v) => (
                <MenuItem key={v.id} value={v.id}>
                  V{v.versionNumber}
                  {group?.currentVersionId === v.id ? ' (Current)' : ''}
                  {v.approvalStatus === 'PENDING_APPROVAL' ? ' (Pending Review)' : ''}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {agreement && <StatusBadge status={agreement.computedStatus} />}
        </Box>
      </Box>
      )}

      {!isOperationalReview && (
      <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Tab label="Details" value="details" />
        <Tab label="Version History" value="history" icon={<History sx={{ fontSize: 18 }} />} iconPosition="start" />
      </Tabs>
      )}

      {isHistorical && (
        <Alert severity="info" sx={{ mb: 2 }}>
          {agreement?.computedStatus === 'REJECTED'
            ? 'Viewing rejected version — read-only. Owner may revise and resubmit.'
            : 'Viewing historical version — read-only.'}
        </Alert>
      )}

      {isPendingRevision && !isOperationalReview && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Pending revision — awaiting approver review.
        </Alert>
      )}

      {isDraftRevision && !isOperationalReview && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Draft revision — not yet submitted for approval.
        </Alert>
      )}

      {pendingRequest && !isOperationalReview && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          A request to {pendingActionLabel} this agreement is currently pending approval.
          {pendingRequest.targetUserName && pendingRequest.actionType === 'TRANSFER' && (
            <> New owner: <strong>{pendingRequest.targetUserName}</strong>.</>
          )}
          {pendingRequest.requestedTerminationDate && pendingRequest.actionType === 'TERMINATE' && (
            <> Requested termination date: <strong>{dayjs(pendingRequest.requestedTerminationDate).format('DD MMM YYYY')}</strong>.</>
          )}
        </Alert>
      )}

      {activeTab === 'history' && !isOperationalReview ? (
        <Paper elevation={0} sx={{ p: 2, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
          <List disablePadding>
            {versions.map((v) => (
              <Box key={v.id}>
                <ListItemButton
                  selected={selectedVersionId === v.id}
                  onClick={() => handleSelectVersion(v.id)}
                  sx={{ borderRadius: 1 }}
                >
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                        <Typography fontWeight={600}>
                          {v.agreementName || group?.agreementName || `V${v.versionNumber}`}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">V{v.versionNumber}</Typography>
                        <StatusBadge
                          status={v.computedStatus}
                          terminalStatus={v.computedStatus === 'SUPERSEDED' ? v.terminalStatus : null}
                        />
                        {group?.currentVersionId === v.id && (
                          <Chip label="Current" size="small" color="success" variant="outlined" />
                        )}
                        {v.approvalStatus === 'PENDING_APPROVAL' && (
                          <Chip label="Pending Review" size="small" color="warning" variant="outlined" />
                        )}
                      </Box>
                    }
                    secondary={`${v.startDate ? dayjs(v.startDate).format('DD MMM YYYY') : '—'} – ${v.expiryDate ? dayjs(v.expiryDate).format('DD MMM YYYY') : '—'} · ${v.ownerName || '—'}`}
                  />
                </ListItemButton>
                <Divider />
              </Box>
            ))}
          </List>
        </Paper>
      ) : (
      <Grid container spacing={3}>
        {/* Left: Data */}
        <Grid size={{ xs: 12, md: 8 }}>
          {agreement ? (
            <>
              <Accordion defaultExpanded elevation={0} sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', mb: 2 }}>
                <AccordionSummary expandIcon={<ExpandMore />}>
                  <Typography fontWeight={600}>{isAssetRental ? 'Ownership' : 'Vendors'}</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Grid container spacing={1}>
                    <Grid size={4}>
                      <Typography variant="caption" color="text.secondary">Owner</Typography>
                      <Typography variant="body2">{agreement.ownerName}</Typography>
                    </Grid>
                    {!isAssetRental && (
                      <Grid size={12}>
                        <Divider sx={{ my: 1 }} />
                        {agreement.vendors?.map((v) => (
                          <Chip key={v.vendorId} label={v.vendorName} size="small" sx={{ mr: 0.5, mb: 0.5 }} />
                        ))}
                      </Grid>
                    )}
                  </Grid>
                </AccordionDetails>
              </Accordion>

              <Paper elevation={0} sx={{ p: 2, borderRadius: 2, border: '1px solid', borderColor: 'divider', mb: 2 }}>
                <Typography fontWeight={600} sx={{ mb: 1.5 }}>Agreement Details</Typography>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Typography variant="caption" color="text.secondary">Agreement Name</Typography>
                    <Typography variant="body2" fontWeight={600}>{agreement.agreementName || '—'}</Typography>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Typography variant="caption" color="text.secondary">Agreement Group</Typography>
                    <Typography variant="body2">{agreement.agreementGroupName || group?.agreementGroupName || group?.name || '—'}</Typography>
                  </Grid>
                  <Grid size={{ xs: 6, sm: 3 }}>
                    <Typography variant="caption" color="text.secondary">Income Type</Typography>
                    <Typography variant="body2">{agreement.incomeTypeName || '—'}</Typography>
                  </Grid>
                  <Grid size={{ xs: 6, sm: 3 }}>
                    <Typography variant="caption" color="text.secondary">Agreement Type</Typography>
                    <Typography variant="body2">{agreement.agreementTypeName || group?.agreementTypeName || '—'}</Typography>
                  </Grid>
                  <Grid size={{ xs: 6, sm: 3 }}>
                    <Typography variant="caption" color="text.secondary">Start Date</Typography>
                    <Typography variant="body2">{agreement.startDate ? dayjs(agreement.startDate).format('DD MMM YYYY') : '—'}</Typography>
                  </Grid>
                  <Grid size={{ xs: 6, sm: 3 }}>
                    <Typography variant="caption" color="text.secondary">Expiry Date</Typography>
                    <Typography variant="body2">{agreement.expiryDate ? dayjs(agreement.expiryDate).format('DD MMM YYYY') : '—'}</Typography>
                  </Grid>
                  {!isAssetRental && (
                    <Grid size={{ xs: 6, sm: 3 }}>
                      <Typography variant="caption" color="text.secondary">Commercial Structure</Typography>
                      <Typography variant="body2">{agreement.commercialStructure || '—'}</Typography>
                    </Grid>
                  )}
                  {!isAssetRental && agreement.commercialStructure === 'FLAT' && (
                    <Grid size={{ xs: 6, sm: 3 }}>
                      <Typography variant="caption" color="text.secondary">Commercial Value</Typography>
                      <Typography variant="body2">₹{Number(agreement.commercialValue || 0).toLocaleString('en-IN')}</Typography>
                    </Grid>
                  )}
                </Grid>
              </Paper>

              {isAssetRental && (
                <Paper elevation={0} sx={{ p: 2, borderRadius: 2, border: '1px solid', borderColor: 'divider', mb: 2 }}>
                  <Typography fontWeight={600} sx={{ mb: 1.5 }}>Asset Commercials</Typography>
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 6, sm: 3 }}>
                      <Typography variant="caption" color="text.secondary">Asset Category</Typography>
                      <Typography variant="body2">{assetCategoryLabel}</Typography>
                    </Grid>
                    {assetCategory !== 'ACTIVITY' && (
                      <Grid size={{ xs: 6, sm: 3 }}>
                        <Typography variant="caption" color="text.secondary">Asset Type</Typography>
                        <Typography variant="body2">{agreement.asset?.assetType || '—'}</Typography>
                      </Grid>
                    )}
                    <Grid size={{ xs: 6, sm: 3 }}>
                      <Typography variant="caption" color="text.secondary">Payout Mode</Typography>
                      <Typography variant="body2">
                        {assetPayoutMode === 'PER_STORE'
                          ? 'Payout per Store'
                          : assetPayoutMode === 'FLAT'
                            ? 'Flat Payout'
                            : '—'}
                      </Typography>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 12, md: 6 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                        {assetPayoutMode === 'PER_STORE' ? 'Payout Schedule' : 'Flat Payout Amount'}
                      </Typography>
                      {assetPayoutMode === 'PER_STORE' ? (
                        (!agreement.assetPayoutPeriods || agreement.assetPayoutPeriods.length === 0) ? (
                          <Typography variant="body2">—</Typography>
                        ) : (
                          <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 1, overflow: 'hidden' }}>
                            <Table size="small">
                              <TableHead>
                                <TableRow>
                                  <TableCell sx={{ fontWeight: 600 }}>Period</TableCell>
                                  <TableCell sx={{ fontWeight: 600 }}>Payout (per store)</TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {agreement.assetPayoutPeriods.map((period, idx) => (
                                  <TableRow key={idx}>
                                    <TableCell>{period.periodMonths} Months</TableCell>
                                    <TableCell>{formatAssetMoney(period.payoutPerStore)}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </TableContainer>
                        )
                      ) : (
                        <Typography variant="body2">{formatAssetMoney(agreement.asset?.flatPayout)}</Typography>
                      )}
                    </Grid>
                    {agreement.asset?.remarks && (
                      <Grid size={12}>
                        <Typography variant="caption" color="text.secondary">Remarks</Typography>
                        <Typography variant="body2">{agreement.asset.remarks}</Typography>
                      </Grid>
                    )}
                    <Grid size={12}>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                        Participating Stores
                      </Typography>
                      <StoreMappingReviewSummary stores={assetStoreMappings} />
                    </Grid>
                  </Grid>
                </Paper>
              )}

              {showJbpMatrix && (
                <Paper elevation={0} sx={{ p: 2, borderRadius: 2, border: '1px solid', borderColor: 'divider', mb: 2 }}>
                  <Typography fontWeight={600} sx={{ mb: 1.5 }}>JBP Relational Matrix</Typography>
                  <JbpReviewShowcase
                    agreementVersionId={selectedVersionId}
                    financialYearStartMonth={resolveAgreementFinancialYearStartMonth({ version: agreement })}
                  />
                </Paper>
              )}

              {showLegacyTargetsMatrix && (
                <Paper elevation={0} sx={{ p: 2, borderRadius: 2, border: '1px solid', borderColor: 'divider', mb: 2 }}>
                  <Typography fontWeight={600} sx={{ mb: 1.5 }}>Commercial Targets Matrix</Typography>
                  <CommercialsUploadModal
                    embedded
                    readOnly
                    agreementId={selectedVersionId}
                    slabs={slabs}
                    startDate={agreement.startDate}
                    expiryDate={agreement.expiryDate}
                    financialYearStartMonth={resolveAgreementFinancialYearStartMonth({ version: agreement })}
                  />
                </Paper>
              )}

              {isAdHoc && isSlabStructure && (
                <Paper elevation={0} sx={{ p: 2, borderRadius: 2, border: '1px solid', borderColor: 'divider', mb: 2 }}>
                  <Typography fontWeight={600} sx={{ mb: 1.5 }}>Commercial Details Structure</Typography>
                  <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden', mt: 1 }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 600 }}>Min Cap</TableCell>
                          <TableCell sx={{ fontWeight: 600 }}>Max Cap</TableCell>
                          <TableCell sx={{ fontWeight: 600 }}>Payout</TableCell>
                          <TableCell sx={{ fontWeight: 600 }}>Frequency</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {slabs.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={4}>
                              <Typography variant="body2" color="text.secondary">
                                No commercial tiers added.
                              </Typography>
                            </TableCell>
                          </TableRow>
                        ) : (
                          slabs.map((slab) => {
                            const capUnit = slab.capUnit || agreement?.commercials?.slabCapUnit || CAP_UNIT.RUPEES;
                            return (
                              <TableRow key={slab.id}>
                                <TableCell>{formatCapValue(slab.minCap, capUnit)}</TableCell>
                                <TableCell>{formatCapValue(slab.maxCap, capUnit)}</TableCell>
                                <TableCell>
                                  {formatCommercialValue(slab.commercialValue, slab.valueType)}
                                </TableCell>
                                <TableCell>
                                  {payoutFrequencyLabel(slab.payoutFrequency)}
                                </TableCell>
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Paper>
              )}

              {!isAssetRental && (
                <Accordion elevation={0} sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                  <AccordionSummary expandIcon={<ExpandMore />}>
                    <Typography fontWeight={600}>Products ({agreement.products?.length || 0})</Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    {agreement.products?.map((p) => (
                      <Chip key={p.productId} label={`${p.productName} (${p.divisionName || ''})`} size="small" sx={{ mr: 0.5, mb: 0.5 }} />
                    ))}
                  </AccordionDetails>
                </Accordion>
              )}
            </>
          ) : (
            <Typography color="text.secondary">Select a version to view details.</Typography>
          )}
        </Grid>

        {/* Right: Timeline + Actions */}
        <Grid size={{ xs: 12, md: 4 }}>
          {/* Actions */}
          {agreement && !isOperationalReview && (
            <Paper elevation={0} sx={{ p: 2, borderRadius: 2, border: '1px solid', borderColor: 'divider', mb: 2 }}>
              <Typography variant="subtitle2" fontWeight={600} mb={1.5}>Actions</Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {actions?.submit && (
                  <Button variant="contained" fullWidth onClick={submitModal.open} sx={{ bgcolor: BRAND.red }}>
                    Submit for Approval
                  </Button>
                )}
                {actions?.editDraft && (
                  <Button
                    variant="contained"
                    fullWidth
                    startIcon={<Edit />}
                    onClick={() => navigate(`/agreements/${selectedVersionId}/edit`)}
                    sx={{ bgcolor: BRAND.red }}
                  >
                    Edit Draft
                  </Button>
                )}
                {actions?.approve && (
                  <>
                    <Button variant="contained" fullWidth onClick={handleApprove} sx={{ bgcolor: BRAND.green }}>
                      ✓ Approve
                    </Button>
                    <Button variant="outlined" color="error" fullWidth onClick={rejectModal.open}>
                      ✗ Reject
                    </Button>
                  </>
                )}
                {actions?.editApproved && (
                  <Button variant="outlined" fullWidth startIcon={<Edit />}
                    onClick={() => navigate(buildAgreementEditPath(
                      group?.currentVersionId || selectedVersionId,
                    ))}>
                    Edit (New Version)
                  </Button>
                )}
                {actions?.revise && (
                  <Button variant="contained" fullWidth startIcon={<Edit />}
                    onClick={() => navigate(buildAgreementEditPath(selectedVersionId))}
                    sx={{ bgcolor: BRAND.red }}>
                    Revise & Resubmit
                  </Button>
                )}
                {showLifecycleActions && (agreement?.computedStatus === 'EXPIRED'
                  || (daysToExpiry != null && daysToExpiry <= 90)
                  || Boolean(agreement?.inProgressFlag)) && (
                  <Button
                    variant="outlined"
                    color="warning"
                    fullWidth
                    onClick={handleToggleInProgress}
                  >
                    {agreement?.inProgressFlag ? 'Clear Discussions In Progress' : 'Mark Discussions in Progress'}
                  </Button>
                )}
                {showRenewButton && (
                  <Button
                    variant="contained"
                    fullWidth
                    onClick={handleRenew}
                    sx={{ bgcolor: BRAND.red }}
                  >
                    Renew Agreement
                  </Button>
                )}
                {actions?.terminate && (
                  <Button variant="outlined" color="error" fullWidth startIcon={<PowerSettingsNew />} onClick={terminateModal.open}>
                    Terminate
                  </Button>
                )}
                {actions?.transfer && (
                  <Button variant="outlined" fullWidth startIcon={<SwapHoriz />} onClick={transferModal.open}>
                    Transfer Ownership
                  </Button>
                )}
                {!actions?.submit
                  && !actions?.editDraft
                  && !actions?.approve
                  && !actions?.editApproved
                  && !actions?.revise
                  && !showRenewButton
                  && !actions?.terminate
                  && !actions?.transfer
                  && !(showLifecycleActions && (
                    agreement?.computedStatus === 'EXPIRED'
                    || (daysToExpiry != null && daysToExpiry <= 90)
                    || Boolean(agreement?.inProgressFlag)
                  )) && (
                  <Typography variant="body2" color="text.secondary">
                    No actions available for your role on this version.
                    Edit / Renew / Terminate require ownership + edit rights on the current approved version.
                  </Typography>
                )}
              </Box>
            </Paper>
          )}

          {/* Approval Timeline */}
          <Paper elevation={0} sx={{ p: 2, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
            <Typography variant="subtitle2" fontWeight={600} mb={1.5}>Approval Timeline</Typography>
            {timeline.length === 0 ? (
              <Typography variant="body2" color="text.secondary">No activity yet</Typography>
            ) : (
              <Stepper orientation="vertical" nonLinear>
                {timeline.map((t, i) => (
                  <Step key={t.id} active completed>
                    <StepLabel
                      slots={{ stepIcon: TimelineStepIcon }}
                      slotProps={{
                        stepIcon: {
                          color: ACTION_COLOR[t.operationalEvent || t.action] || '#999',
                        },
                      }}
                    >
                      <Typography variant="body2" fontWeight={600}>
                        {formatTimelineAction(t)} — {t.actorName || `User ${t.actorUserId}`}
                      </Typography>
                    </StepLabel>
                    <StepContent>
                      {t.remarks && <Typography variant="caption" color="text.secondary">"{t.remarks}"</Typography>}
                      <Typography variant="caption" display="block" color="text.secondary">
                        {t.timestamp ? dayjs(t.timestamp).format('DD MMM YYYY, hh:mm A') : ''}
                      </Typography>
                    </StepContent>
                  </Step>
                ))}
              </Stepper>
            )}
          </Paper>
        </Grid>
      </Grid>
      )}

      <Dialog
        open={submitModal.isOpen}
        onClose={() => {
          submitModal.close();
          setSubmitRevisionComments('');
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle fontWeight={700}>Submit for Approval</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            You will no longer be able to edit the details until this version is reviewed.
          </Alert>
          {requiresSubmitRevisionReason && (
            <TextField
              label="Reason for Edit / Revision *"
              multiline
              rows={4}
              fullWidth
              value={submitRevisionComments}
              onChange={(e) => setSubmitRevisionComments(e.target.value)}
              placeholder="Explain what changed and why this revision is needed…"
            />
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => {
              submitModal.close();
              setSubmitRevisionComments('');
            }}
            variant="outlined"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmitConfirm}
            variant="contained"
            sx={{ bgcolor: BRAND.red }}
            disabled={requiresSubmitRevisionReason && !submitRevisionComments.trim()}
          >
            Confirm Submit
          </Button>
        </DialogActions>
      </Dialog>

      <TransferOwnershipModal
        open={transferModal.isOpen}
        onClose={transferModal.close}
        agreementId={selectedVersionId}
        agreementLabel={displayName}
        onSuccess={({ immediate } = {}) => {
          transferModal.close();
          enqueueSnackbar(
            immediate ? 'Ownership transferred' : 'Transfer request submitted to Approver.',
            { variant: 'success' },
          );
          load();
          onActionComplete?.();
        }}
      />

      {/* Reject Modal */}
      <Dialog open={rejectModal.isOpen} onClose={rejectModal.close} maxWidth="sm" fullWidth>
        <DialogTitle fontWeight={700}>Reject Agreement</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>Once rejected, this version cannot be edited. Owner must create a new version.</Alert>
          <TextField
            label="Rejection Remarks *"
            multiline rows={4}
            fullWidth
            value={rejectRemarks}
            onChange={(e) => setRejectRemarks(e.target.value)}
            placeholder="Clearly state the reason for rejection…"
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={rejectModal.close} variant="outlined">Cancel</Button>
          <Button onClick={handleReject} variant="contained" color="error" disabled={!rejectRemarks.trim()}>
            Reject Agreement
          </Button>
        </DialogActions>
      </Dialog>

      {/* Terminate Modal */}
      <Dialog
        open={terminateModal.isOpen}
        onClose={() => {
          terminateModal.close();
          setTerminateData({ comments: '', requestedTerminationDate: '' });
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle fontWeight={700} color="error">Terminate Agreement</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2, mt: 1 }}>
            Request will be sent to an Approver. Agreement will not be terminated until approved.
          </Alert>
          <TextField
            label="Termination Date (optional)"
            type="date"
            fullWidth
            sx={{ mb: 2 }}
            slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: today } }}
            value={terminateData.requestedTerminationDate}
            onChange={(e) => setTerminateData((prev) => ({
              ...prev,
              requestedTerminationDate: e.target.value,
            }))}
            error={terminateDateInvalid}
            helperText={terminateDateInvalid ? 'Termination date cannot be in the future' : 'Leave blank to use approval date'}
          />
          <TextField
            label="Reason / Comments *"
            multiline
            rows={4}
            fullWidth
            value={terminateData.comments}
            onChange={(e) => setTerminateData({ comments: e.target.value })}
            placeholder="Explain why this agreement should be terminated…"
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => {
              terminateModal.close();
              setTerminateData({ comments: '', requestedTerminationDate: '' });
            }}
            variant="outlined"
          >
            Cancel
          </Button>
          <Button
            onClick={handleTerminate}
            variant="contained"
            color="error"
            disabled={!terminateData.comments.trim() || terminateDateInvalid}
          >
            Submit Termination Request
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
