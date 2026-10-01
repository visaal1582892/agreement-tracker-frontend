import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Chip, IconButton, Tooltip } from '@mui/material';
import { DeleteOutlined } from '@mui/icons-material';
import DataTable from '../ui/DataTable';
import { navigateToGroup } from '../../utils/agreementNavigation';

const STATUS_OPTIONS = [
  { value: 'true', label: 'Active' },
  { value: 'false', label: 'Inactive' },
];

const formatDateTime = (d) =>
  d ? new Intl.DateTimeFormat('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date(d)) : '—';

function RowActionsMenu({ row, canDelete, onDelete }) {
  if (!canDelete) return null;

  return (
    <Tooltip title="Delete Group">
      <IconButton
        size="small"
        color="error"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onDelete(row);
        }}
      >
        <DeleteOutlined fontSize="small" />
      </IconButton>
    </Tooltip>
  );
}

export default function GroupsTable({
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
  emptyMessage = 'No agreement groups found.',
}) {
  const navigate = useNavigate();

  const columns = useMemo(() => [
    {
      field: 'name',
      header: 'Group Name',
      minWidth: 180,
      maxWidth: 250,
      sortable: false,
      filterType: 'text',
      filterKey: 'groupName',
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
      maxWidth: 180,
      sortable: false,
      filterType: 'text',
      filterKey: 'lastModifiedBy',
    },
    {
      field: 'createdByName',
      header: 'Created By',
      minWidth: 150,
      maxWidth: 180,
      sortable: false,
      filterType: 'text',
      filterKey: 'createdBy',
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
  ], [onDelete, navigate]);

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
