import { useCallback, useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box, Grid, Paper, Typography, Divider, List, ListItemButton, ListItemText,
  TextField, InputAdornment, TablePagination, CircularProgress, alpha, Tabs, Tab,
  Button, Alert, Chip, Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import { Search, TaskAlt, InboxOutlined, SwapHoriz, PowerSettingsNew, DeleteOutlined } from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import {
  fetchPendingApprovals,
  fetchPendingActionRequests,
  resolveActionRequest,
} from '../../store/slices/agreementSlice';
import PageHeader from '../../components/ui/PageHeader';
import StatusBadge from '../../components/ui/StatusBadge';
import AgreementDetailPage from '../agreements/AgreementDetailPage';
import { BRAND } from '../../config/theme';
import dayjs from 'dayjs';

const PAGE_SIZE_OPTIONS = [5, 10, 20, 50];

function PendingEmptyState({ hasSearch, variant = 'approvals' }) {
  const isOperational = variant === 'operational';
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        px: 3,
        py: 6,
        minHeight: 280,
      }}
    >
      <Box
        sx={{
          width: 72,
          height: 72,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: alpha(BRAND.green, 0.1),
          mb: 2,
        }}
      >
        {hasSearch ? (
          <InboxOutlined sx={{ fontSize: 36, color: BRAND.textSecondary }} />
        ) : (
          <TaskAlt sx={{ fontSize: 36, color: BRAND.green }} />
        )}
      </Box>
      <Typography variant="subtitle1" fontWeight={700} gutterBottom>
        {hasSearch
          ? (isOperational ? 'No matching requests' : 'No matching approvals')
          : 'All caught up!'}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 260, lineHeight: 1.6 }}>
        {hasSearch
          ? 'Try a different agreement number or company name.'
          : (isOperational
            ? 'No transfer or termination requests are waiting for your review.'
            : 'No agreements are waiting for your review right now.')}
      </Typography>
    </Box>
  );
}

function DetailEmptyState({ variant = 'approvals' }) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        minHeight: 360,
        textAlign: 'center',
        px: 4,
      }}
    >
      <Box
        sx={{
          width: 64,
          height: 64,
          borderRadius: '50%',
          bgcolor: alpha(BRAND.red, 0.08),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          mb: 2,
        }}
      >
        <Search sx={{ fontSize: 30, color: BRAND.red }} />
      </Box>
      <Typography variant="subtitle1" fontWeight={600} gutterBottom>
        {variant === 'operational' ? 'Select a request to review' : 'Select an agreement to review'}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 320 }}>
        {variant === 'operational'
          ? 'Choose a pending transfer or termination request to view details and approve or reject.'
          : 'Choose a pending agreement from the list to view details, version history, and approval actions.'}
      </Typography>
    </Box>
  );
}

function OperationalRequestDetail({ request, onResolved }) {
  const dispatch = useDispatch();
  const { enqueueSnackbar } = useSnackbar();
  const [approverComments, setApproverComments] = useState('');
  const [rejectOpen, setRejectOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setApproverComments('');
    setRejectOpen(false);
  }, [request?.id]);

  if (!request) return null;

  const actionLabel = request.actionType === 'TRANSFER'
    ? 'Transfer'
    : request.actionType === 'DELETE_GROUP'
      ? 'Delete Group'
      : 'Terminate';
  const ActionIcon = request.actionType === 'TRANSFER'
    ? SwapHoriz
    : request.actionType === 'DELETE_GROUP'
      ? DeleteOutlined
      : PowerSettingsNew;

  const handleResolve = async (approved) => {
    setSubmitting(true);
    try {
      await dispatch(resolveActionRequest({
        requestId: request.id,
        approved,
        approverComments: approverComments.trim(),
      })).unwrap();
      enqueueSnackbar(
        approved ? `${actionLabel} request approved` : `${actionLabel} request rejected`,
        { variant: 'success' },
      );
      setRejectOpen(false);
      setApproverComments('');
      onResolved?.();
    } catch (err) {
      enqueueSnackbar(typeof err === 'string' ? err : 'Resolution failed', { variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box>
      <Paper
        elevation={0}
        sx={{
          p: 2,
          mb: 2,
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: alpha(BRAND.red, 0.03),
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
          <ActionIcon color="primary" />
          <Typography variant="subtitle1" fontWeight={700}>
            {actionLabel} Request
          </Typography>
          <Chip label="Pending" size="small" color="warning" />
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          Requested by <strong>{request.requestedByName}</strong>
        </Typography>
        {request.targetUserName && request.actionType === 'TRANSFER' && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            New owner: <strong>{request.targetUserName}</strong>
          </Typography>
        )}
        {request.actionType === 'DELETE_GROUP' && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Group: <strong>{request.agreementName}</strong>
            {request.companyName ? ` · ${request.companyName}` : ''}
          </Typography>
        )}
        {request.requestedTerminationDate && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Requested termination date:{' '}
            <strong>{dayjs(request.requestedTerminationDate).format('DD MMM YYYY')}</strong>
          </Typography>
        )}
        <Alert severity="info" sx={{ mb: 2 }}>
          {request.reasonComments}
        </Alert>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button
            variant="contained"
            sx={{ bgcolor: BRAND.green }}
            disabled={submitting}
            onClick={() => handleResolve(true)}
          >
            Approve {actionLabel}
          </Button>
          <Button
            variant="outlined"
            color="error"
            disabled={submitting}
            onClick={() => setRejectOpen(true)}
          >
            Reject
          </Button>
        </Box>
      </Paper>

      {request.actionType !== 'DELETE_GROUP' && request.agreementId && (
        <AgreementDetailPage
          key={request.agreementId}
          embeddedAgreementId={request.agreementId}
          embeddedContext="operational-review"
        />
      )}

      <Dialog open={rejectOpen} onClose={() => setRejectOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle fontWeight={700}>Reject {actionLabel} Request</DialogTitle>
        <DialogContent>
          <TextField
            label="Approver Comments *"
            multiline
            rows={3}
            fullWidth
            sx={{ mt: 1 }}
            value={approverComments}
            onChange={(e) => setApproverComments(e.target.value)}
            placeholder="Explain why this request is being rejected…"
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setRejectOpen(false)} variant="outlined">Cancel</Button>
          <Button
            onClick={() => handleResolve(false)}
            variant="contained"
            color="error"
            disabled={submitting || !approverComments.trim()}
          >
            Confirm Reject
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function PendingListPanel({
  title,
  totalCount,
  searchInput,
  onSearchChange,
  loading,
  items,
  emptyVariant,
  hasSearch,
  selectedKey,
  onSelect,
  renderItem,
  page,
  rowsPerPage,
  onPageChange,
  onRowsPerPageChange,
}) {
  return (
    <Paper
      elevation={0}
      sx={{
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <Box
        sx={{
          px: 2,
          py: 1.5,
          bgcolor: BRAND.bgGray,
          borderBottom: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1.5,
          flexWrap: 'wrap',
        }}
      >
        <Typography variant="subtitle2" fontWeight={600} sx={{ whiteSpace: 'nowrap' }}>
          {title} ({totalCount})
        </Typography>
        <TextField
          size="small"
          placeholder="Search…"
          value={searchInput}
          onChange={(e) => onSearchChange(e.target.value)}
          sx={{ minWidth: 140, flex: 1, maxWidth: 200 }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <Search fontSize="small" />
                </InputAdornment>
              ),
            },
          }}
        />
      </Box>

      <Box sx={{ flex: 1, overflowY: 'auto' }}>
        {loading ? (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 6 }}>
            <CircularProgress size={28} />
          </Box>
        ) : items.length === 0 ? (
          <PendingEmptyState hasSearch={hasSearch} variant={emptyVariant} />
        ) : (
          <List disablePadding>
            {items.map((item) => (
              <Box key={renderItem.key(item)}>
                <ListItemButton
                  selected={selectedKey === renderItem.key(item)}
                  onClick={() => onSelect(item)}
                  sx={{ '&.Mui-selected': { bgcolor: '#FFF0F0', borderLeft: `3px solid ${BRAND.red}` } }}
                >
                  {renderItem.content(item)}
                </ListItemButton>
                <Divider />
              </Box>
            ))}
          </List>
        )}
      </Box>

      <TablePagination
        component="div"
        count={totalCount}
        page={page}
        onPageChange={onPageChange}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={onRowsPerPageChange}
        rowsPerPageOptions={PAGE_SIZE_OPTIONS}
        labelRowsPerPage="Rows:"
        sx={{
          borderTop: '1px solid',
          borderColor: 'divider',
          '.MuiTablePagination-toolbar': { minHeight: 48, px: 1 },
          '.MuiTablePagination-selectLabel, .MuiTablePagination-displayedRows': {
            fontSize: '0.8rem',
          },
        }}
      />
    </Paper>
  );
}

export default function ApprovalsPage() {
  const dispatch = useDispatch();
  const {
    pendingApprovals,
    pendingTotal,
    pendingActionRequests,
    pendingActionRequestsTotal,
    loading,
  } = useSelector((s) => s.agreements);

  const [activeTab, setActiveTab] = useState('approvals');
  const [selectedAgreementId, setSelectedAgreementId] = useState(null);
  const [selectedRequestId, setSelectedRequestId] = useState(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const prevSearchRef = useRef('');

  const totalCount = activeTab === 'approvals'
    ? (pendingTotal ?? 0)
    : (pendingActionRequestsTotal ?? 0);

  const loadPending = useCallback(() => {
    if (activeTab === 'approvals') {
      dispatch(fetchPendingApprovals({ page, size: rowsPerPage, search: searchQuery }));
    } else {
      dispatch(fetchPendingActionRequests({ page, size: rowsPerPage, search: searchQuery }));
    }
  }, [dispatch, page, rowsPerPage, searchQuery, activeTab]);

  useEffect(() => {
    loadPending();
  }, [loadPending]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const next = searchInput.trim();
      if (next !== prevSearchRef.current) {
        prevSearchRef.current = next;
        setPage(0);
      }
      setSearchQuery(next);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setPage(0);
    setSearchInput('');
    setSearchQuery('');
    prevSearchRef.current = '';
    setSelectedAgreementId(null);
    setSelectedRequestId(null);
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== 'approvals') return;
    if (pendingApprovals.length === 0) {
      setSelectedAgreementId(null);
      return;
    }
    const stillVisible = pendingApprovals.some((a) => a.agreementId === selectedAgreementId);
    if (!selectedAgreementId || !stillVisible) {
      setSelectedAgreementId(pendingApprovals[0].agreementId ?? null);
    }
  }, [pendingApprovals, selectedAgreementId, activeTab]);

  useEffect(() => {
    if (activeTab !== 'operational') return;
    if (pendingActionRequests.length === 0) {
      setSelectedRequestId(null);
      return;
    }
    const stillVisible = pendingActionRequests.some((r) => r.id === selectedRequestId);
    if (!selectedRequestId || !stillVisible) {
      setSelectedRequestId(pendingActionRequests[0]?.id ?? null);
    }
  }, [pendingActionRequests, selectedRequestId, activeTab]);

  const selectedRequest = pendingActionRequests.find((r) => r.id === selectedRequestId) ?? null;
  const hasSearch = Boolean(searchQuery);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      <PageHeader
        title="Approvals Workspace"
        subtitle={`${totalCount} item${totalCount === 1 ? '' : 's'} pending your review`}
      />

      <Tabs
        value={activeTab}
        onChange={(_, v) => setActiveTab(v)}
        sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}
      >
        <Tab label={`Agreement Approvals (${pendingTotal ?? 0})`} value="approvals" />
        <Tab label={`Operational Requests (${pendingActionRequestsTotal ?? 0})`} value="operational" />
      </Tabs>

      <Grid container spacing={2} sx={{ flex: 1, minHeight: 480 }}>
        <Grid size={{ xs: 12, md: 4 }}>
          {activeTab === 'approvals' ? (
            <PendingListPanel
              title="Pending Approvals"
              totalCount={pendingTotal ?? 0}
              searchInput={searchInput}
              onSearchChange={setSearchInput}
              loading={loading}
              items={pendingApprovals}
              emptyVariant="approvals"
              hasSearch={hasSearch}
              selectedKey={selectedAgreementId}
              onSelect={(a) => setSelectedAgreementId(a.agreementId)}
              page={page}
              rowsPerPage={rowsPerPage}
              onPageChange={(_, newPage) => setPage(newPage)}
              onRowsPerPageChange={(e) => {
                setRowsPerPage(parseInt(e.target.value, 10));
                setPage(0);
              }}
              renderItem={{
                key: (a) => a.agreementId,
                content: (a) => (
                  <ListItemText
                    primary={(
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2" fontWeight={600} noWrap>{a.agreementName || 'Agreement'}</Typography>
                        <StatusBadge status="PENDING_APPROVAL" />
                      </Box>
                    )}
                    secondary={a.companyName}
                  />
                ),
              }}
            />
          ) : (
            <PendingListPanel
              title="Operational Requests"
              totalCount={pendingActionRequestsTotal ?? 0}
              searchInput={searchInput}
              onSearchChange={setSearchInput}
              loading={loading}
              items={pendingActionRequests}
              emptyVariant="operational"
              hasSearch={hasSearch}
              selectedKey={selectedRequestId}
              onSelect={(r) => setSelectedRequestId(r.id)}
              page={page}
              rowsPerPage={rowsPerPage}
              onPageChange={(_, newPage) => setPage(newPage)}
              onRowsPerPageChange={(e) => {
                setRowsPerPage(parseInt(e.target.value, 10));
                setPage(0);
              }}
              renderItem={{
                key: (r) => r.id,
                content: (r) => (
                  <ListItemText
                    primary={(
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2" fontWeight={600} noWrap>
                          {r.actionType === 'DELETE_GROUP'
                            ? (r.agreementName || 'Group deletion')
                            : (r.agreementName || 'Agreement')}
                        </Typography>
                        <Chip
                          label={
                            r.actionType === 'TRANSFER'
                              ? 'Transfer'
                              : r.actionType === 'DELETE_GROUP'
                                ? 'Delete Group'
                                : 'Terminate'
                          }
                          size="small"
                          color={
                            r.actionType === 'TRANSFER'
                              ? 'primary'
                              : r.actionType === 'DELETE_GROUP'
                                ? 'warning'
                                : 'error'
                          }
                          variant="outlined"
                        />
                      </Box>
                    )}
                    secondary={`${r.companyName || '—'} · ${r.requestedByName}`}
                  />
                ),
              }}
            />
          )}
        </Grid>

        <Grid size={{ xs: 12, md: 8 }}>
          <Paper
            elevation={0}
            sx={{
              borderRadius: 2,
              border: '1px solid',
              borderColor: 'divider',
              height: '100%',
              overflowY: 'auto',
              p: (activeTab === 'approvals' ? selectedAgreementId : selectedRequestId) ? 3 : 0,
            }}
          >
            {activeTab === 'approvals' ? (
              selectedAgreementId ? (
                <AgreementDetailPage
                  key={selectedAgreementId}
                  embeddedAgreementId={selectedAgreementId}
                  onActionComplete={loadPending}
                />
              ) : (
                <DetailEmptyState variant="approvals" />
              )
            ) : (
              selectedRequest ? (
                <OperationalRequestDetail
                  key={selectedRequest.id}
                  request={selectedRequest}
                  onResolved={loadPending}
                />
              ) : (
                <DetailEmptyState variant="operational" />
              )
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
