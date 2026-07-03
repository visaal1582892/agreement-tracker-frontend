import { Chip } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { BRAND } from '../../config/theme';
import { isRecordActive } from '../../utils/masterUtils';

export const MASTER_STATUS_FILTER_OPTIONS = [
  { value: 'true', label: 'Active' },
  { value: 'false', label: 'Inactive' },
];

export const MASTER_ACTIONS_WIDTH = 96;
export const MASTER_STATUS_WIDTH = 120;

export function formatMasterUpdatedAt(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

export function MasterStatusChip({ active }) {
  return (
    <Chip
      label={active ? 'Active' : 'Inactive'}
      size="small"
      sx={{
        bgcolor: active ? alpha(BRAND.green, 0.12) : alpha('#EF4444', 0.10),
        color: active ? BRAND.greenDark : '#DC2626',
        fontWeight: 600,
        fontSize: '0.72rem',
      }}
    />
  );
}

export function masterIdColumn(overrides = {}) {
  return {
    field: 'id',
    header: '#',
    minWidth: 60,
    sortable: true,
    filterType: null,
    ...overrides,
  };
}

function masterUpdatedAtColumn() {
  return {
    field: 'updatedAt',
    header: 'Last Updated',
    minWidth: 120,
    sortable: true,
    filterType: null,
    render: (value) => formatMasterUpdatedAt(value),
  };
}

function masterStatusColumn() {
  return {
    field: 'isActive',
    header: 'Status',
    width: MASTER_STATUS_WIDTH,
    minWidth: MASTER_STATUS_WIDTH,
    sortable: true,
    truncate: false,
    stickyRight: true,
    filterType: 'select',
    filterOptions: MASTER_STATUS_FILTER_OPTIONS,
    render: (_, row) => <MasterStatusChip active={isRecordActive(row)} />,
  };
}

function masterActionsColumn() {
  return {
    field: '_actions',
    header: 'Actions',
    width: MASTER_ACTIONS_WIDTH,
    minWidth: MASTER_ACTIONS_WIDTH,
    sortable: false,
    truncate: false,
    stickyRight: true,
    filterType: null,
  };
}

/** Append Last Updated + sticky Status + sticky Actions to master data columns. */
export function buildMasterColumns(dataColumns = []) {
  return [
    ...dataColumns,
    masterUpdatedAtColumn(),
    masterStatusColumn(),
    masterActionsColumn(),
  ];
}
