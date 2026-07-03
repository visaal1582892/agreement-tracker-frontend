import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box, Typography, Paper, Chip, Breadcrumbs, Link as MuiLink, CircularProgress, Alert,
  Button, Stack, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Divider,
} from '@mui/material';
import { NavigateNext, DeleteOutlined, EditOutlined } from '@mui/icons-material';
import axiosInstance from '../../api/axiosInstance';
import { ENDPOINTS } from '../../config/endpoints';
import { ROUTES } from '../../config/routes';
import { fetchAgreements } from '../../store/slices/agreementSlice';
import AgreementsTable from '../../components/agreements/AgreementsTable';
import { useDataTable } from '../../hooks/useDataTable';
import { useDebounce } from '../../hooks/useDebounce';
import { useSnackbar } from 'notistack';
import { navigateToAgreement } from '../../utils/agreementNavigation';
import { useAuth } from '../../hooks/useAuth';
import { RIGHTS } from '../../config/rights';
import { BRAND } from '../../config/theme';
import {
  GroupDeleteDialogs,
  useGroupDeletion,
} from '../../hooks/useGroupDeletion';

export default function GroupDetailsPage() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { enqueueSnackbar } = useSnackbar();
  const { hasRight } = useAuth();
  const agreementScope = hasRight(RIGHTS.AGREEMENT_VIEW_ALL) ? 'ALL' : 'MY';

  const [group, setGroup] = useState(null);
  const [groupLoading, setGroupLoading] = useState(true);
  const [filters, setFilters] = useState({ companyAgreementGroupId: Number(groupId) });
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [renaming, setRenaming] = useState(false);

  const { agreements, totalElements, loading } = useSelector((s) => s.agreements);
  const {
    page, rowsPerPage, sortBy, sortDir,
    handlePageChange, handleRowsPerPageChange, handleSort,
  } = useDataTable();

  const debouncedFilters = useDebounce(filters, 600);
  const filterKey = useMemo(() => JSON.stringify(debouncedFilters), [debouncedFilters]);

  const loadGroup = useCallback(async () => {
    setGroupLoading(true);
    try {
      const { data } = await axiosInstance.get(ENDPOINTS.COMPANY_AGREEMENT_GROUP_BY_ID(groupId));
      setGroup(data);
    } catch (err) {
      enqueueSnackbar(err.response?.data?.message || 'Failed to load group', { variant: 'error' });
    } finally {
      setGroupLoading(false);
    }
  }, [groupId, enqueueSnackbar]);

  const groupDeletion = useGroupDeletion({
    onSuccess: (message) => {
      enqueueSnackbar(message, { variant: 'success' });
      navigate(ROUTES.AGREEMENTS_GROUPS);
    },
  });

  const refreshAgreements = useCallback(() => {
    const parsed = JSON.parse(filterKey);
    dispatch(fetchAgreements({
      page,
      size: rowsPerPage,
      scope: agreementScope,
      sortBy,
      sortDir,
      companyAgreementGroupId: Number(groupId),
      ...(parsed.agreementName && { agreementName: parsed.agreementName }),
      ...(parsed.agreementGroupName && { agreementGroupName: parsed.agreementGroupName }),
      ...(parsed.companyId && { companyId: parsed.companyId }),
      ...(parsed.status && { status: parsed.status }),
      ...(parsed.ownerName && { ownerName: parsed.ownerName }),
      ...(parsed.vendorId && { vendorId: parsed.vendorId }),
      ...(parsed.incomeTypeId && { incomeTypeId: parsed.incomeTypeId }),
      ...(parsed.startDateFrom && { startDateFrom: parsed.startDateFrom }),
      ...(parsed.startDateTo && { startDateTo: parsed.startDateTo }),
      ...(parsed.endDateFrom && { endDateFrom: parsed.endDateFrom }),
      ...(parsed.endDateTo && { endDateTo: parsed.endDateTo }),
    }));
  }, [dispatch, page, rowsPerPage, sortBy, sortDir, groupId, filterKey, agreementScope]);

  useEffect(() => {
    loadGroup();
  }, [loadGroup]);

  useEffect(() => {
    if (!groupId) return;
    refreshAgreements();
  }, [groupId, refreshAgreements]);

  const handleFilterChange = useCallback((key, value) => {
    setFilters((prev) => {
      const next = { ...prev, companyAgreementGroupId: Number(groupId) };
      if (value) next[key] = value;
      else delete next[key];
      return next;
    });
    handlePageChange(null, 0);
  }, [groupId, handlePageChange]);

  const showDelete = group?.canDelete === true;
  const showEdit = hasRight(RIGHTS.ADMIN_USERS);

  const handleDelete = async () => {
    if (!group) return;
    const result = await groupDeletion.startDelete(group);
    if (result?.error) {
      enqueueSnackbar(result.error, { variant: 'error' });
    }
  };

  const openRename = () => {
    setRenameValue(group?.name || '');
    setRenameOpen(true);
  };

  const submitRename = async () => {
    if (!renameValue.trim()) return;
    setRenaming(true);
    try {
      const { data } = await axiosInstance.put(
        ENDPOINTS.COMPANY_AGREEMENT_GROUP_BY_ID(groupId),
        { name: renameValue.trim() },
      );
      setGroup(data);
      setRenameOpen(false);
      enqueueSnackbar('Group renamed', { variant: 'success' });
    } catch (err) {
      enqueueSnackbar(err.response?.data?.message || 'Failed to rename group', { variant: 'error' });
    } finally {
      setRenaming(false);
    }
  };

  const parsedGroupId = Number(groupId);
  const invalidGroupId = !groupId || Number.isNaN(parsedGroupId);

  if (invalidGroupId) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        Invalid group link. Return to Agreements and try again.
      </Alert>
    );
  }

  if (groupLoading && !group) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Breadcrumbs separator={<NavigateNext fontSize="small" />} sx={{ mb: 1.5 }}>
        <MuiLink
          component="button"
          underline="hover"
          color="inherit"
          onClick={() => navigate(ROUTES.AGREEMENTS_GROUPS)}
          sx={{ fontSize: '0.875rem' }}
        >
          Agreements
        </MuiLink>
        <Typography color="text.primary" sx={{ fontSize: '0.875rem' }}>
          {group?.name || 'Group'}
        </Typography>
      </Breadcrumbs>

      <Paper
        elevation={0}
        variant="outlined"
        sx={{ p: 3, mb: 3, borderRadius: 2 }}
      >
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            mb: 3,
            position: "relative",
          }}
        >
          <Typography variant="h4" fontWeight="bold">
            {group?.name || '—'}
          </Typography>

          {(showDelete || showEdit) && (
            <Stack
              direction="row"
              spacing={1}
              sx={{
                position: "absolute",
                top: 0,
                right: 0,
              }}
            >
              {showEdit && (
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<EditOutlined />}
                  onClick={openRename}
                >
                  Edit
                </Button>
              )}

              {showDelete && (
                <Button
                  variant="outlined"
                  color="error"
                  size="small"
                  startIcon={<DeleteOutlined />}
                  onClick={handleDelete}
                >
                  Delete
                </Button>
              )}
            </Stack>
          )}
        </Box>

        <Stack
          direction="row"
          spacing={6}
          divider={<Divider orientation="vertical" flexItem />}
        >
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase' }}>
              Company
            </Typography>
            <Typography variant="body1" fontWeight="medium">
              {group?.companyName || '—'}
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase' }}>
              Created By
            </Typography>
            <Typography variant="body1" fontWeight="medium">
              {group?.createdByName || '—'}
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase' }}>
              Status
            </Typography>
            <Box sx={{ mt: 0.5 }}>
              <Chip
                size="small"
                label={group?.isActive ? 'Active' : 'Inactive'}
                color={group?.isActive ? 'success' : 'default'}
                variant="outlined"
              />
            </Box>
          </Box>
        </Stack>
      </Paper>

      <Typography variant="h6" fontWeight={700} sx={{ mb: 1.5 }}>
        Agreements in this Group
      </Typography>

      <AgreementsTable
        rows={agreements}
        loading={loading}
        totalCount={totalElements}
        page={page}
        rowsPerPage={rowsPerPage}
        onPageChange={handlePageChange}
        onRowsPerPageChange={handleRowsPerPageChange}
        sortBy={sortBy}
        sortDir={sortDir}
        onSort={handleSort}
        filters={filters}
        onFilterChange={handleFilterChange}
        onRefresh={refreshAgreements}
        lockedGroupId={Number(groupId)}
        onRowClick={(row) => navigateToAgreement(row, navigate, { mode: 'group' })}
        draftEditMode="group"
        emptyMessage="No agreements in this group."
      />

      <GroupDeleteDialogs
        modal={groupDeletion.modal}
        group={groupDeletion.group}
        reason={groupDeletion.reason}
        onReasonChange={groupDeletion.setReason}
        onClose={groupDeletion.closeModal}
        onConfirm={groupDeletion.confirmDelete}
        submitting={groupDeletion.submitting}
      />

      <Dialog open={renameOpen} onClose={() => setRenameOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle fontWeight={700}>Rename Group</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="Group Name"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setRenameOpen(false)} variant="outlined">Cancel</Button>
          <Button
            onClick={submitRename}
            variant="contained"
            disabled={renaming || !renameValue.trim()}
            sx={{ bgcolor: BRAND.red, '&:hover': { bgcolor: BRAND.redDark } }}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
