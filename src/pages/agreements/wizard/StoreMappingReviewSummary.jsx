import { useMemo, useState } from 'react';
import {
  Box, Button, Dialog, DialogContent, DialogTitle, Typography,
} from '@mui/material';
import StoreMappingTable from './StoreMappingTable';
import PaginatedStoreMappingTable from './PaginatedStoreMappingTable';
import { blurActiveElement } from '../../../utils/muiDomCompat';

function groupStoresByState(stores = []) {
  const groups = new Map();
  stores.forEach((store) => {
    const key = store.stateName || store.state || 'Unknown';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(store);
  });
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
}

export default function StoreMappingReviewSummary({ stores = [], versionId }) {
  const [open, setOpen] = useState(false);
  const grouped = useMemo(() => groupStoresByState(stores), [stores]);
  
  const hasStates = stores.some((s) => s.stateName || s.state);
  const stateCount = hasStates ? new Set(stores.map((store) => store.stateName || store.state).filter(Boolean)).size : null;

  if (!stores.length) {
    return <Typography variant="body2" color="text.secondary">No stores mapped</Typography>;
  }

  return (
    <>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <Box
          component="span"
          sx={{
            px: 1.5,
            py: 0.5,
            borderRadius: '999px',
            bgcolor: 'grey.100',
            fontSize: '0.875rem',
            fontWeight: 600,
          }}
        >
          Participating Stores: {stores.length} Store{stores.length === 1 ? '' : 's'}
          {stateCount ? ` across ${stateCount} State${stateCount === 1 ? '' : 's'}` : ''}
        </Box>
        <Button
          variant="text"
          size="small"
          onClick={() => {
            blurActiveElement();
            setOpen(true);
          }}
          sx={{ minWidth: 0, p: 0 }}
        >
          View Store List
        </Button>
      </Box>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Mapped Outlets</DialogTitle>
        <DialogContent dividers sx={{ p: 2 }}>
          <PaginatedStoreMappingTable versionId={versionId} stores={stores} />
        </DialogContent>
      </Dialog>
    </>
  );
}

export function StoreMappingReadOnlyTable({ stores = [], selectable = false, selectedIds, onToggle, onToggleAll }) {
  if (!stores.length) return null;
  return (
    <>
      <StoreMappingTable
        stores={stores}
        selectable={selectable}
        selectedIds={selectedIds}
        onToggle={onToggle}
      />
      {selectable && (
        <Box sx={{ p: 1 }}>
          <Button size="small" onClick={onToggleAll}>
            {selectedIds?.size === stores.length ? 'Clear All' : 'Select All'}
          </Button>
        </Box>
      )}
    </>
  );
}
