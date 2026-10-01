import { useEffect, useCallback, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box, Tab, Tabs, Typography, ToggleButton, ToggleButtonGroup, Button,
} from '@mui/material';
import { fetchAgreements } from '../../store/slices/agreementSlice';
import { ROUTES } from '../../config/routes';
import { BRAND } from '../../config/theme';
import PageHeader from '../../components/ui/PageHeader';
import AgreementsTable from '../../components/agreements/AgreementsTable';
import GroupsTable from '../../components/agreements/GroupsTable';
import { useDataTable } from '../../hooks/useDataTable';
import { useDebounce } from '../../hooks/useDebounce';
import { useAuth } from '../../hooks/useAuth';
import { RIGHTS } from '../../config/rights';
import axiosInstance from '../../api/axiosInstance';
import { ENDPOINTS } from '../../config/endpoints';
import { useSnackbar } from 'notistack';
import { normalizePageResponse } from '../../utils/pageResponse';
import { GroupDeleteDialogs, useGroupDeletion } from '../../hooks/useGroupDeletion';

const PAGE_TAB = { GROUPS: 'GROUPS', AGREEMENTS: 'AGREEMENTS', DRAFTS: 'DRAFTS' };
const FETCH_MODE = { MY: 'MY', ALL: 'ALL' };

function buildAgreementQueryParams({ page, rowsPerPage, sortBy, sortDir, scope, filters }) {
  const params = { page, size: rowsPerPage, scope };
  if (sortBy) params.sort = `${sortBy},${sortDir || 'asc'}`;
  if (filters.agreementName) params.agreementName = filters.agreementName;
  if (filters.agreementGroupId) params.agreementGroupId = filters.agreementGroupId;
  if (filters.agreementGroupName) params.agreementGroupName = filters.agreementGroupName;
  if (filters.status) params.status = filters.status;
  if (filters.ownerName) params.ownerName = filters.ownerName;
  if (filters.vendorId) params.vendorId = filters.vendorId;
  if (filters.incomeTypeId) params.incomeTypeId = filters.incomeTypeId;
  if (filters.startDateFrom) params.startDateFrom = filters.startDateFrom;
  if (filters.startDateTo) params.startDateTo = filters.startDateTo;
  if (filters.endDateFrom) params.endDateFrom = filters.endDateFrom;
  if (filters.endDateTo) params.endDateTo = filters.endDateTo;
  return params;
}

function buildGroupQueryParams({ page, rowsPerPage, sortBy, sortDir, filters }) {
  const params = { page, size: rowsPerPage };
  if (sortBy) params.sort = `${sortBy},${sortDir || 'desc'}`;
  if (filters.groupName) params.groupName = filters.groupName;
  if (filters.lastModifiedBy) params.lastModifiedBy = filters.lastModifiedBy;
  if (filters.createdBy) params.createdBy = filters.createdBy;
  if (filters.isActive !== undefined && filters.isActive !== '') {
    params.isActive = filters.isActive === 'true';
  }
  return params;
}

export default function AgreementListPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const { enqueueSnackbar } = useSnackbar();
  const { hasRight } = useAuth();

  const canViewMy = hasRight(RIGHTS.AGREEMENT_VIEW_MY) || hasRight(RIGHTS.DRAFT_VIEW_MY);
  const canViewAll = hasRight(RIGHTS.AGREEMENT_VIEW_ALL) || hasRight(RIGHTS.DRAFT_VIEW_ALL);
  const canViewAllDrafts = hasRight(RIGHTS.DRAFT_VIEW_ALL);
  const showScopeToggle = canViewMy && canViewAll;
  const defaultScope = canViewMy ? FETCH_MODE.MY : FETCH_MODE.ALL;

  const pageTab = location.pathname.endsWith('/list')
    ? PAGE_TAB.AGREEMENTS
    : location.pathname.endsWith('/drafts')
      ? PAGE_TAB.DRAFTS
      : PAGE_TAB.GROUPS;
  const [fetchMode, setFetchMode] = useState(defaultScope);
  const [agreementFilters, setAgreementFilters] = useState({});
  const [groupFilters, setGroupFilters] = useState({ isActive: 'true' });

  const [groups, setGroups] = useState([]);
  const [groupsTotal, setGroupsTotal] = useState(0);
  const [groupsLoading, setGroupsLoading] = useState(false);

  const [drafts, setDrafts] = useState([]);
  const [draftsTotal, setDraftsTotal] = useState(0);
  const [draftsLoading, setDraftsLoading] = useState(false);
  const [draftFilters, setDraftFilters] = useState({});
  const draftTable = useDataTable();
  const debouncedDraftFilters = useDebounce(draftFilters, 600);
  const draftFilterKey = useMemo(
    () => JSON.stringify(debouncedDraftFilters),
    [debouncedDraftFilters],
  );

  const { agreements, totalElements, loading } = useSelector((s) => s.agreements);
  const agreementTable = useDataTable();
  const groupTable = useDataTable();

  const debouncedAgreementFilters = useDebounce(agreementFilters, 600);
  const debouncedGroupFilters = useDebounce(groupFilters, 600);

  const agreementFilterKey = useMemo(
    () => JSON.stringify(debouncedAgreementFilters),
    [debouncedAgreementFilters],
  );
  const groupFilterKey = useMemo(
    () => JSON.stringify(debouncedGroupFilters),
    [debouncedGroupFilters],
  );

  const activeScope = showScopeToggle ? fetchMode : defaultScope;

  const refreshAgreements = useCallback(() => {
    const filters = JSON.parse(agreementFilterKey);
    dispatch(fetchAgreements(buildAgreementQueryParams({
      page: agreementTable.page,
      rowsPerPage: agreementTable.rowsPerPage,
      sortBy: agreementTable.sortBy,
      sortDir: agreementTable.sortDir,
      scope: activeScope,
      filters,
    })));
  }, [
    dispatch,
    agreementTable.page,
    agreementTable.rowsPerPage,
    agreementTable.sortBy,
    agreementTable.sortDir,
    activeScope,
    agreementFilterKey,
  ]);

  const loadGroups = useCallback(async () => {
    setGroupsLoading(true);
    try {
      const filters = JSON.parse(groupFilterKey);
      const { data } = await axiosInstance.get(ENDPOINTS.AGREEMENT_GROUPS, {
        params: buildGroupQueryParams({
          page: groupTable.page,
          rowsPerPage: groupTable.rowsPerPage,
          sortBy: groupTable.sortBy || 'updatedAt',
          sortDir: groupTable.sortDir || 'desc',
          filters,
        }),
      });
      const normalized = normalizePageResponse(data);
      setGroups(normalized.content);
      setGroupsTotal(normalized.totalElements);
    } catch (err) {
      enqueueSnackbar(err.response?.data?.message || 'Failed to load groups', { variant: 'error' });
    } finally {
      setGroupsLoading(false);
    }
  }, [
    groupFilterKey,
    groupTable.page,
    groupTable.rowsPerPage,
    groupTable.sortBy,
    groupTable.sortDir,
    enqueueSnackbar,
  ]);

  const loadDrafts = useCallback(async () => {
    setDraftsLoading(true);
    try {
      const filters = JSON.parse(draftFilterKey);
      const { data } = await axiosInstance.get(ENDPOINTS.AGREEMENTS, {
        params: buildAgreementQueryParams({
          page: draftTable.page,
          rowsPerPage: draftTable.rowsPerPage,
          sortBy: draftTable.sortBy,
          sortDir: draftTable.sortDir,
          scope: canViewAllDrafts ? 'ALL' : 'MY',
          filters: { ...filters, status: 'DRAFT' },
        }),
      });
      const normalized = normalizePageResponse(data);
      setDrafts(normalized.content);
      setDraftsTotal(normalized.totalElements);
    } catch (err) {
      enqueueSnackbar(err.response?.data?.message || 'Failed to load drafts', { variant: 'error' });
    } finally {
      setDraftsLoading(false);
    }
  }, [
    draftFilterKey,
    draftTable.page,
    draftTable.rowsPerPage,
    draftTable.sortBy,
    draftTable.sortDir,
    enqueueSnackbar,
  ]);

  const groupDeletion = useGroupDeletion({
    onSuccess: (message) => {
      enqueueSnackbar(message, { variant: 'success' });
      loadGroups();
    },
  });

  const handleDeleteGroup = async (group) => {
    const result = await groupDeletion.startDelete(group);
    if (result?.error) {
      enqueueSnackbar(result.error, { variant: 'error' });
    }
  };

  useEffect(() => {
    if (pageTab !== PAGE_TAB.AGREEMENTS) return;
    refreshAgreements();
  }, [pageTab, refreshAgreements]);

  useEffect(() => {
    if (pageTab !== PAGE_TAB.GROUPS) return;
    loadGroups();
  }, [pageTab, loadGroups]);

  useEffect(() => {
    if (pageTab !== PAGE_TAB.DRAFTS) return;
    loadDrafts();
  }, [pageTab, loadDrafts]);

  const handlePageTabChange = (_, value) => {
    if (value === PAGE_TAB.GROUPS) navigate(ROUTES.AGREEMENTS_GROUPS);
    else if (value === PAGE_TAB.DRAFTS) navigate(ROUTES.AGREEMENTS_DRAFTS);
    else navigate(ROUTES.AGREEMENTS_LIST);
  };

  const handleScopeChange = (_, value) => {
    if (!value) return;
    setFetchMode(value);
    agreementTable.handlePageChange(null, 0);
  };

  const handleAgreementFilterChange = useCallback((key, value) => {
    setAgreementFilters((prev) => {
      const next = { ...prev };
      if (value) next[key] = value;
      else delete next[key];
      return next;
    });
    agreementTable.handlePageChange(null, 0);
  }, [agreementTable]);

  const handleGroupFilterChange = useCallback((key, value) => {
    setGroupFilters((prev) => {
      const next = { ...prev };
      if (value !== undefined && value !== null && value !== '') next[key] = value;
      else delete next[key];
      return next;
    });
    groupTable.handlePageChange(null, 0);
  }, [groupTable]);

  const handleDraftFilterChange = useCallback((key, value) => {
    // Don't allow changing status filter on drafts page - it's always DRAFT
    if (key === 'status') return;
    setDraftFilters((prev) => {
      const next = { ...prev };
      if (value) next[key] = value;
      else delete next[key];
      return next;
    });
    draftTable.handlePageChange(null, 0);
  }, [draftTable]);

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h5" fontWeight={700}>Agreements</Typography>
        {hasRight(RIGHTS.AGREEMENT_CREATE) && (
          <Button
            variant="contained"
            onClick={() => navigate(ROUTES.AGREEMENT_CREATE)}
            sx={{ bgcolor: BRAND.red, '&:hover': { bgcolor: BRAND.redDark } }}
          >
            New Agreement
          </Button>
        )}
      </Box>

      <Tabs
        value={pageTab}
        onChange={handlePageTabChange}
        sx={{
          mb: 2,
          minHeight: 40,
          '& .MuiTab-root': { minHeight: 40, textTransform: 'none', fontWeight: 600, fontSize: '0.875rem' },
          '& .Mui-selected': { color: BRAND.red },
          '& .MuiTabs-indicator': { bgcolor: BRAND.red },
        }}
      >
        <Tab label="All Agreements" value={PAGE_TAB.AGREEMENTS} />
        {(canViewMy || canViewAllDrafts) && <Tab label="Drafts" value={PAGE_TAB.DRAFTS} />}
        <Tab label="Agreement Groups" value={PAGE_TAB.GROUPS} />
      </Tabs>

      {pageTab === PAGE_TAB.GROUPS ? (
        <>
          <PageHeader
            title="Agreement Groups"
            subtitle="Manage agreement groups"
          />
          <GroupsTable
            rows={groups}
            loading={groupsLoading}
            totalCount={groupsTotal}
            page={groupTable.page}
            rowsPerPage={groupTable.rowsPerPage}
            onPageChange={groupTable.handlePageChange}
            onRowsPerPageChange={groupTable.handleRowsPerPageChange}
            sortBy={groupTable.sortBy}
            sortDir={groupTable.sortDir}
            onSort={groupTable.handleSort}
            filters={groupFilters}
            onFilterChange={handleGroupFilterChange}
            onDelete={handleDeleteGroup}
          />
        </>
      ) : (pageTab === PAGE_TAB.DRAFTS && (canViewMy || canViewAllDrafts)) ? (
        <>
          <PageHeader
            title="Drafts"
            subtitle={canViewAllDrafts ? "All unsubmitted agreements" : "Draft agreements you own"}
          />
          <AgreementsTable
            rows={drafts}
            loading={draftsLoading}
            totalCount={draftsTotal}
            page={draftTable.page}
            rowsPerPage={draftTable.rowsPerPage}
            onPageChange={draftTable.handlePageChange}
            onRowsPerPageChange={draftTable.handleRowsPerPageChange}
            sortBy={draftTable.sortBy}
            sortDir={draftTable.sortDir}
            onSort={draftTable.handleSort}
            filters={draftFilters}
            onFilterChange={handleDraftFilterChange}
            onRefresh={loadDrafts}
            emptyMessage="No drafts found."
          />
          {!draftsLoading && drafts.length > 0 && (
            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
              <Typography variant="caption" color="text.secondary">
                Showing {drafts.length} of {draftsTotal} drafts
              </Typography>
            </Box>
          )}
        </>
      ) : (
        <>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, mb: 2 }}>
            <PageHeader
              title="All Agreements"
              subtitle={activeScope === FETCH_MODE.MY ? 'Agreements you own' : 'All agreements in the system'}
            />
            {showScopeToggle && (
              <ToggleButtonGroup
                size="small"
                exclusive
                value={activeScope}
                onChange={handleScopeChange}
                sx={{ mt: 1 }}
              >
                <ToggleButton value={FETCH_MODE.MY}>My Agreements</ToggleButton>
                <ToggleButton value={FETCH_MODE.ALL}>All Agreements</ToggleButton>
              </ToggleButtonGroup>
            )}
          </Box>

          <AgreementsTable
            rows={agreements}
            loading={loading}
            totalCount={totalElements}
            page={agreementTable.page}
            rowsPerPage={agreementTable.rowsPerPage}
            onPageChange={agreementTable.handlePageChange}
            onRowsPerPageChange={agreementTable.handleRowsPerPageChange}
            sortBy={agreementTable.sortBy}
            sortDir={agreementTable.sortDir}
            onSort={agreementTable.handleSort}
            filters={agreementFilters}
            onFilterChange={handleAgreementFilterChange}
            onRefresh={refreshAgreements}
            emptyMessage="No agreements found."
          />

          {!loading && agreements.length > 0 && (
            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
              <Typography variant="caption" color="text.secondary">
                Showing {agreements.length} of {totalElements} agreements
              </Typography>
            </Box>
          )}
        </>
      )}

      <GroupDeleteDialogs
        modal={groupDeletion.modal}
        group={groupDeletion.group}
        reason={groupDeletion.reason}
        onReasonChange={groupDeletion.setReason}
        onClose={groupDeletion.closeModal}
        onConfirm={groupDeletion.confirmDelete}
        submitting={groupDeletion.submitting}
      />
    </Box>
  );
}
