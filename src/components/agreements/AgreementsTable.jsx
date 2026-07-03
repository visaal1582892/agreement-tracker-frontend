import { useNavigate } from 'react-router-dom';
import { Box, Chip, IconButton, Menu, MenuItem, Tooltip } from '@mui/material';
import { MoreVert } from '@mui/icons-material';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useSnackbar } from 'notistack';
import DataTable from '../ui/DataTable';
import StatusBadge from '../ui/StatusBadge';
import axiosInstance from '../../api/axiosInstance';
import { ENDPOINTS } from '../../config/endpoints';
import { submitAgreementForApproval } from '../../store/slices/agreementSlice';
import { useAgreementPermissions } from '../../hooks/useAgreementPermissions';
import { cloneAgreementOnServer } from '../../utils/agreementClone';
import {
  buildAgreementDetailPath,
  buildAgreementEditPath,
  buildDraftEditPath,
  isIncompleteDraft,
  navigateToAgreement,
} from '../../utils/agreementNavigation';
import TransferOwnershipModal from './TransferOwnershipModal';
import ConfirmDialog from '../ui/ConfirmDialog';
import { useModal } from '../../hooks/useModal';

const STATUS_FILTER_OPTIONS = [
  { value: 'DRAFT', label: 'Draft' },
  { value: 'PENDING_APPROVAL', label: 'Pending' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
];

const formatDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) : '—';

const formatUpdatedAt = (d) =>
  d ? new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(d)) : '—';

function rowToAgreement(row) {
  return {
    ownerId: row.ownerUserId,
    ownerUserId: row.ownerUserId,
    approvalStatus: row.approvalStatus,
    computedStatus: row.computedStatus,
    id: row.latestVersionId,
    latestVersionId: row.latestVersionId,
  };
}

function RowActionsMenu({
  row, navigate, onSubmit, onClone, onTransfer, onDelete, draftEditMode = 'group',
}) {
  const [anchor, setAnchor] = useState(null);
  const submitModal = useModal();
  const cloneModal = useModal();
  const deleteModal = useModal();
  const { getListRowActions } = useAgreementPermissions();
  const actions = getListRowActions(rowToAgreement(row));

  if (!Object.values(actions).some(Boolean)) return null;

  const incomplete = isIncompleteDraft(row);

  const handleClose = (e) => {
    e?.stopPropagation?.();
    setAnchor(null);
  };

  const withStopPropagation = (fn) => (e) => {
    e.stopPropagation();
    handleClose();
    fn();
  };

  const goToDetail = () => {
    if (row.approvalStatus === 'DRAFT') {
      const path = buildDraftEditPath(row, { mode: draftEditMode });
      if (path) navigate(path);
      return;
    }
    const path = buildAgreementDetailPath(row.id);
    if (path) navigate(path);
  };

  const goToEdit = () => {
    if (row.approvalStatus === 'DRAFT') {
      const path = buildDraftEditPath(row, {
        mode: draftEditMode,
        step: incomplete ? 2 : undefined,
      });
      if (path) navigate(path);
      return;
    }
    const path = buildAgreementEditPath(row.latestVersionId, incomplete ? { step: 2 } : {});
    if (path) navigate(path);
  };

  const handleSubmitClick = () => {
    submitModal.open();
  };

  const handleSubmitConfirm = async () => {
    submitModal.close();
    await onSubmit(row.latestVersionId);
  };

  const handleCloneClick = () => {
    cloneModal.open();
  };

  const handleCloneConfirm = () => {
    cloneModal.close();
    onClone(row.latestVersionId);
  };

  const handleDeleteConfirm = () => {
    deleteModal.close();
    window.setTimeout(() => onDelete(row), 0);
  };

  const handleTransferClick = () => {
    onTransfer(row);
  };

  return (
    <>
      <IconButton
        size="small"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          setAnchor(e.currentTarget);
        }}
      >
        <MoreVert fontSize="small" />
      </IconButton>
      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={handleClose}
        onClick={(e) => e.stopPropagation()}
        slotProps={{
          backdrop: {
            onMouseDown: (e) => e.stopPropagation(),
            onClick: (e) => e.stopPropagation(),
          },
        }}
      >
        {actions.view && row.approvalStatus !== 'DRAFT' && (
          <MenuItem dense onClick={withStopPropagation(goToDetail)}>View</MenuItem>
        )}
        {row.approvalStatus === 'DRAFT' && (actions.editDraft || actions.view) && (
          <MenuItem dense onClick={withStopPropagation(goToEdit)}>Edit Draft</MenuItem>
        )}
        {actions.editApproved && row.computedStatus !== 'TERMINATED' && (
          <MenuItem dense onClick={withStopPropagation(goToEdit)}>Edit</MenuItem>
        )}
        {actions.revise && <MenuItem dense onClick={withStopPropagation(goToEdit)}>Revise & Resubmit</MenuItem>}
        {actions.submit && <MenuItem dense onClick={withStopPropagation(handleSubmitClick)}>Submit for Approval</MenuItem>}
        {actions.clone && <MenuItem dense onClick={withStopPropagation(handleCloneClick)}>Clone (Copy Products)</MenuItem>}
        {actions.transfer && <MenuItem dense onClick={withStopPropagation(handleTransferClick)}>Transfer Ownership</MenuItem>}
        {row.approvalStatus === 'DRAFT' && (
          <MenuItem dense onClick={withStopPropagation(() => deleteModal.open())}>Delete</MenuItem>
        )}
        {actions.approveReject && <MenuItem dense onClick={withStopPropagation(goToDetail)}>Approve / Reject</MenuItem>}
      </Menu>
      <ConfirmDialog
        open={submitModal.isOpen}
        onClose={submitModal.close}
        onConfirm={handleSubmitConfirm}
        title="Submit for Approval"
        message="Are you sure you want to submit this agreement for approval? You will no longer be able to edit the details until it is reviewed."
        confirmLabel="Confirm"
      />
      <ConfirmDialog
        open={cloneModal.isOpen}
        onClose={cloneModal.close}
        onConfirm={handleCloneConfirm}
        title="Clone Agreement"
        message="This will copy the product scope into a new draft. Proceed?"
        confirmLabel="Proceed"
      />
      <ConfirmDialog
        open={deleteModal.isOpen}
        onClose={deleteModal.close}
        onConfirm={handleDeleteConfirm}
        title="Delete Draft Agreement"
        message="This will permanently delete this draft and all associated data. This action cannot be undone."
        confirmLabel="Delete"
        danger
      />
    </>
  );
}

const buildColumns = ({
  vendorOptions,
  incomeTypeOptions,
  companyOptions,
  onVendorSearch,
  onIncomeTypeSearch,
  onCompanySearch,
  loadingVendors,
  loadingIncomeTypes,
  loadingCompanies,
  hideGroupColumn,
  hideCompanyFilter,
}) => [
  {
    field: 'agreementName',
    header: 'Agreement Name',
    minWidth: 180,
    sortable: true,
    filterType: 'text',
    filterKey: 'agreementName',
    render: (v) => v || '—',
  },
  {
    field: 'companyAgreementGroupName',
    header: 'Agreement Group',
    minWidth: 180,
    sortable: false,
    ...(hideGroupColumn ? { filterType: null } : {
      filterType: 'text',
      filterKey: 'agreementGroupName',
    }),
    render: (v) => v || '—',
  },
  {
    field: 'companyName',
    header: 'Company',
    minWidth: 160,
    sortable: false,
    ...(hideCompanyFilter ? {} : {
      filterType: 'searchable-select',
      filterKey: 'companyId',
      filterOptions: companyOptions,
      onFilterSearch: onCompanySearch,
      filterLoading: loadingCompanies,
      getOptionLabel: (o) => o?.companyName || '',
    }),
    render: (v) => v || '—',
  },
  {
    field: 'vendors',
    header: 'Vendors',
    minWidth: 220,
    sortable: false,
    filterType: 'searchable-select',
    filterKey: 'vendorId',
    filterOptions: vendorOptions,
    onFilterSearch: onVendorSearch,
    filterLoading: loadingVendors,
    getOptionLabel: (o) => o?.vendorName || '',
    render: (vendors) => {
      if (!vendors?.length) return '—';
      const [first, ...rest] = vendors;
      const allNames = vendors.map((v) => v.vendorName).join(', ');

      const content = (
        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, whiteSpace: 'nowrap' }}>
          <span>{first.vendorName}</span>
          {rest.length > 0 && (
            <Chip
              label={`+${rest.length}`}
              size="small"
              sx={{ fontSize: '0.7rem', height: 18, flexShrink: 0 }}
            />
          )}
        </Box>
      );

      if (rest.length === 0) return content;

      return (
        <Tooltip title={allNames} arrow placement="top">
          <Box component="span" sx={{ display: 'inline-flex' }}>
            {content}
          </Box>
        </Tooltip>
      );
    },
  },
  {
    field: 'incomeTypeName',
    header: 'Income Type',
    minWidth: 120,
    sortable: false,
    filterType: 'searchable-select',
    filterKey: 'incomeTypeId',
    filterOptions: incomeTypeOptions,
    onFilterSearch: onIncomeTypeSearch,
    filterLoading: loadingIncomeTypes,
    getOptionLabel: (o) => o?.name || '',
    render: (v) => v || '—',
  },
  {
    field: 'startDate',
    header: 'Start Date',
    minWidth: 130,
    sortable: false,
    filterType: 'date-range-picker',
    filterKeyFrom: 'startDateFrom',
    filterKeyTo: 'startDateTo',
    render: (v) => formatDate(v),
  },
  {
    field: 'expiryDate',
    header: 'End Date',
    minWidth: 130,
    sortable: false,
    filterType: 'date-range-picker',
    filterKeyFrom: 'endDateFrom',
    filterKeyTo: 'endDateTo',
    render: (v) => formatDate(v),
  },
  {
    field: 'currentVersionNumber',
    header: 'Version',
    minWidth: 72,
    sortable: false,
    truncate: false,
    render: (v) => `V${v || 1}`,
  },
  {
    field: 'ownerName',
    header: 'Owner',
    minWidth: 130,
    sortable: false,
    filterType: 'text',
    filterKey: 'ownerName',
    render: (v) => v || '—',
  },
  {
    field: 'updatedAt',
    header: 'Last Updated',
    minWidth: 120,
    sortable: false,
    render: (v) => formatUpdatedAt(v),
  },
  {
    field: 'computedStatus',
    header: 'Status',
    width: 140,
    minWidth: 140,
    sortable: false,
    truncate: false,
    stickyRight: true,
    filterType: 'select',
    filterKey: 'status',
    filterOptions: STATUS_FILTER_OPTIONS,
    render: (v) => <StatusBadge status={v || 'DRAFT'} />,
  },
];

export default function AgreementsTable({
  rows,
  loading,
  totalCount,
  page,
  rowsPerPage,
  onPageChange,
  onRowsPerPageChange,
  onRowClick: onRowClickProp,
  sortBy,
  sortDir,
  onSort,
  filters = {},
  onFilterChange,
  emptyMessage = 'No agreements found.',
  onRefresh,
  hidePagination = false,
  lockedGroupId = null,
  draftEditMode = lockedGroupId ? 'group' : 'single',
}) {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { enqueueSnackbar } = useSnackbar();

  const [vendorOptions, setVendorOptions] = useState([]);
  const [incomeTypeOptions, setIncomeTypeOptions] = useState([]);
  const [companyOptions, setCompanyOptions] = useState([]);
  const [loadingVendors, setLoadingVendors] = useState(false);
  const [loadingIncomeTypes, setLoadingIncomeTypes] = useState(false);
  const [loadingCompanies, setLoadingCompanies] = useState(false);
  const [transferRow, setTransferRow] = useState(null);

  const searchVendors = useCallback(async (query) => {
    setLoadingVendors(true);
    try {
      const { data } = await axiosInstance.get(ENDPOINTS.VENDORS, {
        params: query?.trim() ? { search: query.trim() } : {},
      });
      setVendorOptions(Array.isArray(data) ? data : []);
    } catch {
      setVendorOptions([]);
    } finally {
      setLoadingVendors(false);
    }
  }, []);

  const searchIncomeTypes = useCallback(async (query) => {
    setLoadingIncomeTypes(true);
    try {
      const { data } = await axiosInstance.get(ENDPOINTS.INCOME_TYPES);
      const all = Array.isArray(data) ? data : [];
      const q = query?.trim().toLowerCase();
      setIncomeTypeOptions(q ? all.filter((t) => t.name?.toLowerCase().includes(q)) : all);
    } catch {
      setIncomeTypeOptions([]);
    } finally {
      setLoadingIncomeTypes(false);
    }
  }, []);

  const searchCompanies = useCallback(async (query) => {
    setLoadingCompanies(true);
    try {
      const { data } = await axiosInstance.get(ENDPOINTS.COMPANIES, {
        params: query?.trim() ? { search: query.trim() } : {},
      });
      setCompanyOptions(Array.isArray(data) ? data : []);
    } catch {
      setCompanyOptions([]);
    } finally {
      setLoadingCompanies(false);
    }
  }, []);

  useEffect(() => {
    searchVendors('');
    searchIncomeTypes('');
    searchCompanies('');
  }, [searchVendors, searchIncomeTypes, searchCompanies]);

  const handleSubmit = useCallback(async (agreementId, comments) => {
    try {
      await dispatch(submitAgreementForApproval({ agreementId, comments })).unwrap();
      enqueueSnackbar('Submitted for approval', { variant: 'success' });
      onRefresh?.();
    } catch (err) {
      enqueueSnackbar(typeof err === 'string' ? err : 'Submit failed', { variant: 'error' });
    }
  }, [dispatch, enqueueSnackbar, onRefresh]);

  const handleClone = useCallback(async (agreementId) => {
    try {
      const cloned = await cloneAgreementOnServer(axiosInstance, ENDPOINTS, agreementId);
      enqueueSnackbar('Product scope copied — complete remaining details', { variant: 'info' });
      navigate(buildAgreementEditPath(cloned.id, { step: 2 }));
    } catch {
      enqueueSnackbar('Failed to clone agreement', { variant: 'error' });
    }
  }, [navigate, enqueueSnackbar]);

  const handleDelete = useCallback(async (row) => {
    try {
      await axiosInstance.delete(ENDPOINTS.AGREEMENT_DELETE(row.id));
      enqueueSnackbar('Draft agreement deleted', { variant: 'success' });
      onRefresh?.();
    } catch (err) {
      enqueueSnackbar(err.response?.data?.message || 'Failed to delete draft', { variant: 'error' });
    }
  }, [enqueueSnackbar, onRefresh]);

  const columns = useMemo(
    () => buildColumns({
      vendorOptions,
      incomeTypeOptions,
      companyOptions,
      onVendorSearch: searchVendors,
      onIncomeTypeSearch: searchIncomeTypes,
      onCompanySearch: searchCompanies,
      loadingVendors,
      loadingIncomeTypes,
      loadingCompanies,
      hideGroupColumn: Boolean(lockedGroupId),
      hideCompanyFilter: false,
    }),
    [
      vendorOptions,
      incomeTypeOptions,
      companyOptions,
      searchVendors,
      searchIncomeTypes,
      searchCompanies,
      loadingVendors,
      loadingIncomeTypes,
      loadingCompanies,
      lockedGroupId,
    ],
  );

  const columnsWithActions = useMemo(() => [
    ...columns,
    {
      field: 'actions',
      header: '',
      width: 48,
      minWidth: 48,
      sortable: false,
      truncate: false,
      stickyRight: true,
      render: (_, row) => (
        <Box onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
          <RowActionsMenu
            row={row}
            navigate={navigate}
            onSubmit={handleSubmit}
            onClone={handleClone}
            onTransfer={setTransferRow}
            onDelete={handleDelete}
            draftEditMode={draftEditMode}
          />
        </Box>
      ),
    },
  ], [columns, navigate, handleSubmit, handleClone, handleDelete, draftEditMode]);

  const handleRowClick = onRowClickProp
    ?? ((row) => navigateToAgreement(row, navigate, { mode: draftEditMode }));

  return (
    <>
      <DataTable
        columns={columnsWithActions}
        rows={rows}
        loading={loading}
        totalCount={hidePagination ? rows.length : totalCount}
        page={page}
        rowsPerPage={hidePagination ? Math.max(rows.length, 1) : rowsPerPage}
        onPageChange={hidePagination ? undefined : onPageChange}
        onRowsPerPageChange={hidePagination ? undefined : onRowsPerPageChange}
        onRowClick={handleRowClick}
        sortBy={sortBy}
        sortDir={sortDir}
        onSort={onSort}
        filters={filters}
        onFilterChange={onFilterChange}
        emptyMessage={emptyMessage}
        horizontalScroll
        hidePagination={hidePagination}
      />
      <TransferOwnershipModal
        open={Boolean(transferRow)}
        onClose={() => setTransferRow(null)}
        agreementId={transferRow?.latestVersionId}
        agreementLabel={transferRow?.agreementName || 'Agreement'}
        onSuccess={({ immediate } = {}) => {
          enqueueSnackbar(
            immediate ? 'Ownership transferred' : 'Transfer request submitted to Approver.',
            { variant: 'success' },
          );
          setTransferRow(null);
          if (immediate) {
            onRefresh?.();
          }
        }}
      />
    </>
  );
}
