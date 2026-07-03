import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Chip, IconButton, Menu, MenuItem } from '@mui/material';
import { MoreVert } from '@mui/icons-material';
import DataTable from '../ui/DataTable';
import axiosInstance from '../../api/axiosInstance';
import { ENDPOINTS } from '../../config/endpoints';
import { navigateToGroup } from '../../utils/agreementNavigation';

const STATUS_OPTIONS = [
  { value: 'true', label: 'Active' },
  { value: 'false', label: 'Inactive' },
];

const formatDateTime = (d) =>
  d ? new Intl.DateTimeFormat('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date(d)) : '—';

function RowActionsMenu({ row, canDelete, onDelete, navigate }) {
  const [anchor, setAnchor] = useState(null);

  const handleClose = (e) => {
    e?.stopPropagation?.();
    setAnchor(null);
  };

  const goToDetail = (e) => {
    e.stopPropagation();
    handleClose();
    navigateToGroup(row, navigate);
  };

  const handleDelete = (e) => {
    e.stopPropagation();
    handleClose();
    onDelete(row);
  };

  return (
    <>
      <IconButton
        size="small"
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
        <MenuItem dense onClick={goToDetail}>View</MenuItem>
        {canDelete && (
          <MenuItem dense onClick={handleDelete}>Delete</MenuItem>
        )}
      </Menu>
    </>
  );
}

export default function CompanyGroupsTable({
  rows,
  loading,
  totalCount,
  page,
  rowsPerPage,
  onPageChange,
  onRowsPerPageChange,
  sortBy,
  sortDir,
  onSort,
  filters,
  onFilterChange,
  onDelete,
  emptyMessage = 'No company agreement groups found.',
}) {
  const navigate = useNavigate();
  const [companyOptions, setCompanyOptions] = useState([]);
  const [loadingCompanies, setLoadingCompanies] = useState(false);

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
    searchCompanies('');
  }, [searchCompanies]);

  const columns = useMemo(() => [
    {
      field: 'companyName',
      header: 'Company Name',
      minWidth: 180,
      sortable: false,
      filterType: 'searchable-select',
      filterKey: 'companyId',
      filterOptions: companyOptions,
      onFilterSearch: searchCompanies,
      filterLoading: loadingCompanies,
      getOptionLabel: (o) => o?.companyName || '',
      render: (v) => v || '—',
    },
    {
      field: 'name',
      header: 'Group Name',
      minWidth: 180,
      sortable: false,
      filterType: 'text',
      filterKey: 'groupName',
      render: (v) => v || '—',
    },
    {
      field: 'lastModifiedAt',
      header: 'Last Modified At',
      minWidth: 160,
      sortable: false,
      render: (v) => formatDateTime(v),
    },
    {
      field: 'lastModifiedByName',
      header: 'Last Modified By',
      minWidth: 150,
      sortable: false,
      filterType: 'text',
      filterKey: 'lastModifiedBy',
      render: (v) => v || '—',
    },
    {
      field: 'createdByName',
      header: 'Created By',
      minWidth: 150,
      sortable: false,
      filterType: 'text',
      filterKey: 'createdBy',
      render: (v) => v || '—',
    },
    {
      field: 'isActive',
      header: 'Status',
      minWidth: 110,
      sortable: false,
      filterType: 'select',
      filterKey: 'isActive',
      filterOptions: STATUS_OPTIONS,
      render: (v) => (
        <Chip
          label={v ? 'Active' : 'Inactive'}
          size="small"
          color={v ? 'success' : 'default'}
          variant="outlined"
        />
      ),
    },
    {
      field: 'actions',
      header: '',
      width: 48,
      minWidth: 48,
      sortable: false,
      stickyRight: true,
      render: (_, row) => (
        <RowActionsMenu
          row={row}
          canDelete={row.canDelete === true}
          onDelete={onDelete}
          navigate={navigate}
        />
      ),
    },
  ], [companyOptions, searchCompanies, loadingCompanies, onDelete, navigate]);

  return (
    <DataTable
      columns={columns}
      rows={rows}
      loading={loading}
      totalCount={totalCount}
      page={page}
      rowsPerPage={rowsPerPage}
      onPageChange={onPageChange}
      onRowsPerPageChange={onRowsPerPageChange}
      onRowClick={(row) => navigateToGroup(row, navigate)}
      sortBy={sortBy}
      sortDir={sortDir}
      onSort={onSort}
      filters={filters}
      onFilterChange={onFilterChange}
      emptyMessage={emptyMessage}
      horizontalScroll
    />
  );
}
