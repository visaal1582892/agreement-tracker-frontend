import React from 'react';
import {
  Box, Checkbox, Chip, Paper, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Tooltip, Typography, Button, CircularProgress
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';

export default function StoreMappingTable({
  stores = [],
  selectable = false,
  selectedIds,
  onToggle,
  onSelectAllToggle,
  isAllSelected = false,
  onBulkDelete,
  deleting = false,
  maxHeight = 360,
}) {
  if (!stores || stores.length === 0) return null;

  // Defensive helper to handle both Set and Array prop types safely
  const isRowSelected = (id) => {
    if (!id) return false;
    if (selectedIds instanceof Set) return selectedIds.has(id);
    if (Array.isArray(selectedIds)) return selectedIds.includes(id);
    return false;
  };

  // Calculate selected count for the delete button label
  const getSelectedCount = () => {
    if (selectedIds instanceof Set) return selectedIds.size;
    if (Array.isArray(selectedIds)) return selectedIds.length;
    return 0;
  };

  const selectedCount = getSelectedCount();

  return (
    <Paper variant="outlined" sx={{ mt: 2, borderRadius: '12px', overflow: 'hidden', borderColor: 'divider' }}>
      
      {/* Table Header Toolbar containing Select All & Delete Selected controls */}
      {selectable && (
        <Box sx={{
          px: 2.5, py: 1.5, bgcolor: 'grey.50', borderBottom: '1px solid', borderColor: 'divider',
          display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 1.5
        }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', fontSize: '0.75rem' }}>
            Mapped Outlets ({stores.length})
          </Typography>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Button
              size="small"
              onClick={onSelectAllToggle}
              sx={{ textTransform: 'none', fontWeight: 600, fontSize: '0.75rem' }}
            >
              {isAllSelected ? 'Clear All' : 'Select All'}
            </Button>

            <Button
              variant="contained"
              color="error"
              size="small"
              startIcon={deleting ? <CircularProgress size={14} color="inherit" /> : <DeleteIcon sx={{ fontSize: 16 }} />}
              disabled={selectedCount === 0 || deleting}
              onClick={onBulkDelete}
              sx={{
                textTransform: 'none', fontWeight: 600, fontSize: '0.75rem', px: 2, py: 0.5,
                borderRadius: '6px', boxShadow: 'none', '&:hover': { boxShadow: 'none' }
              }}
            >
              {deleting ? 'Deleting...' : `Delete Selected (${selectedCount})`}
            </Button>
          </Box>
        </Box>
      )}

      {/* Main Table Grid */}
      <TableContainer sx={{ maxHeight }}>
        <Table stickyHeader size="small" sx={{ '& .MuiTableCell-root': { py: 1.25, px: 2 } }}>
          <TableHead>
            <TableRow>
              {selectable && (
                <TableCell padding="checkbox" sx={{ bgcolor: 'grey.100', width: 48 }}>
                  <Checkbox
                    size="small"
                    checked={stores.length > 0 && selectedCount === stores.length}
                    indeterminate={selectedCount > 0 && selectedCount < stores.length}
                    onChange={onSelectAllToggle}
                    inputProps={{ 'aria-label': 'Select all outlets' }}
                  />
                </TableCell>
              )}
              <TableCell sx={{ bgcolor: 'grey.100', fontWeight: 700, fontSize: '0.75rem', color: 'text.secondary', textTransform: 'uppercase', width: '22%' }}>
                Store Code
              </TableCell>
              <TableCell sx={{ bgcolor: 'grey.100', fontWeight: 700, fontSize: '0.75rem', color: 'text.secondary', textTransform: 'uppercase', width: '50%' }}>
                Store Name
              </TableCell>
              <TableCell sx={{ bgcolor: 'grey.100', fontWeight: 700, fontSize: '0.75rem', color: 'text.secondary', textTransform: 'uppercase', width: '28%' }}>
                State Scope
              </TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {stores.map((store, index) => {
              const rowId = store.mappingId || store.id;
              const isSelected = isRowSelected(rowId);

              return (
                <TableRow
                  key={rowId || index}
                  hover
                  selected={isSelected}
                  sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
                >
                  {selectable && (
                    <TableCell padding="checkbox">
                      <Checkbox
                        size="small"
                        checked={isSelected}
                        onChange={() => onToggle?.(rowId)}
                        inputProps={{ 'aria-label': `Select ${store.storeCode}` }}
                      />
                    </TableCell>
                  )}

                  {/* Monospace Store Code Pill */}
                  <TableCell>
                    <Chip
                      label={store.storeCode}
                      size="small"
                      sx={{
                        fontFamily: 'monospace', fontWeight: 700, fontSize: '0.75rem',
                        bgcolor: 'grey.100', color: 'text.primary', borderRadius: '6px', px: 0.5
                      }}
                    />
                  </TableCell>

                  {/* Store Name with Overflow Truncation & Hover Tooltip */}
                  <TableCell sx={{ maxWidth: 220 }}>
                    <Tooltip title={store.storeName} placement="top-start">
                      <Typography variant="body2" sx={{
                        fontWeight: 500, fontSize: '0.8125rem', color: 'text.primary',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                      }}>
                        {store.storeName}
                      </Typography>
                    </Tooltip>
                  </TableCell>

                  {/* State Pill Badge */}
                  <TableCell>
                    <Chip
                      label={store.stateName}
                      size="small"
                      color="primary"
                      variant="outlined"
                      sx={{ fontWeight: 600, fontSize: '0.725rem', height: 22 }}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}