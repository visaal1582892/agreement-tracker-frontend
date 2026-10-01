import React from 'react';
import {
  Box, Checkbox, Chip, Paper, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Tooltip, Typography, Button, CircularProgress,
  TablePagination, TextField, InputAdornment, LinearProgress
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import SearchIcon from '@mui/icons-material/Search';

export default function StoreMappingTable({
  stores = [],
  selectable = false,
  selectedIds,
  onToggle,
  onSelectAllToggle,
  isAllSelected = false,
  onBulkDelete,
  deleting = false,
  loading = false,
  maxHeight = 320,
  // Pagination & Search props
  page,
  rowsPerPage,
  totalElements,
  onPageChange,
  onRowsPerPageChange,
  search,
  onSearchChange,
  readOnly = false,
  title = '',
}) {
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

  const hasPagination = page !== undefined && rowsPerPage !== undefined && Boolean(totalElements) && totalElements > 0;
  const hasSearch = onSearchChange !== undefined;

  return (
    <Paper variant="outlined" sx={{ mt: 2, borderRadius: '12px', overflow: 'hidden', borderColor: 'divider' }}>
      
      {/* Top Toolbar containing Search input on Left & Action buttons on Right */}
      <Box sx={{
        px: 2.5, py: 1.5, bgcolor: 'grey.50', borderBottom: '1px solid', borderColor: 'divider',
        display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 1.5
      }}>
        {title && (
          <Typography variant="subtitle1" sx={{ fontWeight: 600, color: 'text.primary', flexGrow: 1 }}>
            {title}
          </Typography>
        )}
        {hasSearch && !readOnly ? (
          <TextField
            size="small"
            placeholder="Search by Store ID or Name..."
            value={search || ''}
            onChange={(e) => onSearchChange(e.target.value)}
            sx={{ width: 300, bgcolor: 'white' }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
          />
        ) : (
          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', fontSize: '0.75rem' }}>
            Mapped Outlets ({hasPagination ? totalElements : stores.length})
          </Typography>
        )}

        {selectable && !readOnly && (
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
        )}
      </Box>

      {loading && <LinearProgress sx={{ height: 2 }} />}

      {/* Main Table Grid */}
      <TableContainer sx={{ maxHeight }}>
        <Table stickyHeader size="small" sx={{ '& .MuiTableCell-root': { py: 0.5, px: 1.5, fontSize: '0.8125rem' } }}>
          <TableHead>
            <TableRow>
              {selectable && !readOnly && (
                <TableCell padding="checkbox" sx={{ bgcolor: 'grey.100', width: 48 }}>
                  <Checkbox
                    size="small"
                    checked={stores.length > 0 && selectedCount === stores.length}
                    indeterminate={selectedCount > 0 && selectedCount < stores.length}
                    onChange={onSelectAllToggle}
                    slotProps={{ input: { 'aria-label': 'Select all outlets' } }}
                  />
                </TableCell>
              )}
              <TableCell sx={{ bgcolor: 'grey.100', fontWeight: 700, fontSize: '0.75rem', color: 'text.secondary', textTransform: 'uppercase', width: '15%' }}>
                Store ID
              </TableCell>
              <TableCell sx={{ bgcolor: 'grey.100', fontWeight: 700, fontSize: '0.75rem', color: 'text.secondary', textTransform: 'uppercase', width: '25%' }}>
                Name
              </TableCell>
              <TableCell sx={{ bgcolor: 'grey.100', fontWeight: 700, fontSize: '0.75rem', color: 'text.secondary', textTransform: 'uppercase', width: '15%' }}>
                Country
              </TableCell>
              <TableCell sx={{ bgcolor: 'grey.100', fontWeight: 700, fontSize: '0.75rem', color: 'text.secondary', textTransform: 'uppercase', width: '15%' }}>
                State
              </TableCell>
              <TableCell sx={{ bgcolor: 'grey.100', fontWeight: 700, fontSize: '0.75rem', color: 'text.secondary', textTransform: 'uppercase', width: '15%' }}>
                City
              </TableCell>
              <TableCell sx={{ bgcolor: 'grey.100', fontWeight: 700, fontSize: '0.75rem', color: 'text.secondary', textTransform: 'uppercase', width: '10%' }}>
                Pin Code
              </TableCell>
              <TableCell sx={{ bgcolor: 'grey.100', fontWeight: 700, fontSize: '0.75rem', color: 'text.secondary', textTransform: 'uppercase', width: '20%' }}>
                Address
              </TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {stores.length === 0 ? (
              <TableRow>
                <TableCell colSpan={selectable && !readOnly ? 6 : 5} align="center" sx={{ py: 3 }}>
                  <Typography variant="body2" color="text.secondary">
                    {loading ? 'Loading mapped outlets...' : 'No outlets mapped'}
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              stores.map((store, index) => {
                const rowId = store.mappingId || store.id || store.storeId || index;
                const isSelected = isRowSelected(rowId);
                const displayStoreId = store.storeId || store.storeCode || store.code;
                const displayName = store.storeName || store.name || 'N/A';
                const displayCountry = store.region1 || store.country || 'N/A';
                const displayState = store.region2 || store.state || 'N/A';
                const displayCity = store.region3 || store.city || 'N/A';
                const displayPinCode = store.pinCode || 'N/A';
                const displayAddress = store.address || 'N/A';

                return (
                  <TableRow
                    key={rowId || index}
                    hover
                    selected={isSelected}
                    sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
                  >
                    {selectable && !readOnly && (
                      <TableCell padding="checkbox">
                        <Checkbox
                          size="small"
                          checked={isSelected}
                          onChange={() => onToggle?.(rowId)}
                          slotProps={{ input: { 'aria-label': `Select ${displayStoreId}` } }}
                        />
                      </TableCell>
                    )}

                    {/* Store ID Chip */}
                    <TableCell>
                      <Chip
                        label={displayStoreId}
                        size="small"
                        sx={{
                          fontFamily: 'monospace', fontWeight: 700, fontSize: '0.75rem',
                          bgcolor: 'grey.100', color: 'text.primary', borderRadius: '6px', px: 0.5
                        }}
                      />
                    </TableCell>

                    {/* Store Name */}
                    <TableCell sx={{ maxWidth: 150 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Tooltip title={displayName} placement="top-start">
                          <Typography variant="body2" sx={{
                            fontWeight: 500, fontSize: '0.8125rem', color: 'text.primary',
                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                          }}>
                            {displayName}
                          </Typography>
                        </Tooltip>
                        {store.isCustom && (
                          <Chip
                            label="Custom"
                            size="small"
                            sx={{
                              height: 18,
                              fontSize: '0.625rem',
                              fontWeight: 700,
                              bgcolor: 'primary.50',
                              color: 'primary.main',
                              border: '1px solid',
                              borderColor: 'primary.200'
                            }}
                          />
                        )}
                      </Box>
                    </TableCell>

                    {/* Country */}
                    <TableCell>
                      <Typography variant="body2" sx={{ fontSize: '0.8125rem' }}>
                        {displayCountry}
                      </Typography>
                    </TableCell>

                    {/* State */}
                    <TableCell>
                      <Chip
                        label={displayState}
                        size="small"
                        color="primary"
                        variant="outlined"
                        sx={{ fontWeight: 600, fontSize: '0.725rem', height: 22 }}
                      />
                    </TableCell>

                    {/* City */}
                    <TableCell>
                      <Typography variant="body2" sx={{ fontSize: '0.8125rem' }}>
                        {displayCity}
                      </Typography>
                    </TableCell>

                    {/* Pin Code */}
                    <TableCell>
                      <Typography variant="body2" sx={{ fontSize: '0.8125rem', fontFamily: 'monospace' }}>
                        {displayPinCode}
                      </Typography>
                    </TableCell>

                    {/* Address */}
                    <TableCell sx={{ maxWidth: 200 }}>
                      <Tooltip title={displayAddress} placement="top-start">
                        <Typography variant="body2" sx={{
                          fontSize: '0.8125rem', color: 'text.secondary',
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                        }}>
                          {displayAddress}
                        </Typography>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {hasPagination && (
        <TablePagination
          component="div"
          count={totalElements}
          page={page}
          onPageChange={onPageChange}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={onRowsPerPageChange}
          rowsPerPageOptions={[10, 20, 50]}
        />
      )}
    </Paper>
  );
}