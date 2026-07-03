import { useMemo, useState } from 'react';
import {
  Box, Button, Dialog, DialogContent, DialogTitle, Typography,
} from '@mui/material';
import StoreMappingTable from './StoreMappingTable';

function groupStoresByState(stores = []) {
  const groups = new Map();
  stores.forEach((store) => {
    const key = store.stateName || 'Unknown';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(store);
  });
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
}

export default function StoreMappingReviewSummary({ stores = [] }) {
  const [open, setOpen] = useState(false);
  const grouped = useMemo(() => groupStoresByState(stores), [stores]);
  const stateCount = new Set(stores.map((store) => store.stateId)).size;

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
          Participating Stores: {stores.length} Store{stores.length === 1 ? '' : 's'} across {stateCount} State{stateCount === 1 ? '' : 's'}
        </Box>
        <Button variant="text" size="small" onClick={() => setOpen(true)} sx={{ minWidth: 0, p: 0 }}>
          View Store List
        </Button>
      </Box>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Mapped Stores</DialogTitle>
        <DialogContent dividers>
          <div className="max-h-96 overflow-y-auto">
            {grouped.map(([stateName, stateStores]) => (
              <Box key={stateName} sx={{ mb: 2 }}>
                <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
                  {stateName} ({stateStores.length})
                </Typography>
                <table className="mb-2 w-full min-w-[420px] table-fixed border-separate border-spacing-0 text-sm">
                  <colgroup>
                    <col className="w-[32%]" />
                    <col className="w-[68%]" />
                  </colgroup>
                  <thead>
                    <tr className="border-b-2 border-slate-200 bg-slate-100 text-left">
                      <th className="border-r border-slate-300 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Store Code
                      </th>
                      <th className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Store Name
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {stateStores.map((store, index) => (
                      <tr
                        key={store.mappingId}
                        className={`border-b border-slate-200 last:border-b-0 ${
                          index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
                        }`}
                      >
                        <td className="border-r border-slate-200 px-4 py-2 align-middle">
                          <span className="inline-flex rounded-md border border-slate-200 bg-white px-2 py-0.5 font-mono text-xs font-semibold text-slate-800">
                            {store.storeCode}
                          </span>
                        </td>
                        <td className="px-4 py-2 align-middle">
                          <span className="block truncate font-medium text-slate-800" title={store.storeName}>
                            {store.storeName}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Box>
            ))}
          </div>
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
