import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TextField,
  InputAdornment,
  Chip,
  Typography,
  Tooltip
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { fetchStoreMappings } from '../../../api/storeMappingApi';

export default function PaginatedStoreMappingTable({ stores, versionId, maxHeight = 360 }) {
  const [data, setData] = useState([]);
  const [totalElements, setTotalElements] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!versionId) {
      if (Array.isArray(stores)) {
        let filtered = stores;
        if (search && search.trim()) {
          const q = search.trim().toLowerCase();
          filtered = stores.filter(s => {
            const id = (s.storeId || s.storeCode || s.code || '').toLowerCase();
            const name = (s.storeName || s.name || '').toLowerCase();
            return id.includes(q) || name.includes(q);
          });
        }
        setTotalElements(filtered.length);
        const start = page * rowsPerPage;
        setData(filtered.slice(start, start + rowsPerPage));
      } else {
        setData([]);
        setTotalElements(0);
      }
      return;
    }

    const fetchMappings = async () => {
      setLoading(true);
      try {
        const response = await fetchStoreMappings(versionId, {
          page: page,
          size: rowsPerPage,
          search: search || undefined
        });
        const list = Array.isArray(response?.content) ? response.content : (Array.isArray(response) ? response : []);
        const total = response?.totalElements ?? (Array.isArray(response) ? response.length : list.length);
        setData(list);
        setTotalElements(total);
      } catch (error) {
        console.error('Failed to fetch store mappings', error);
      } finally {
        setLoading(false);
      }
    };

    const timeoutId = setTimeout(fetchMappings, 300); // Debounce search
    return () => clearTimeout(timeoutId);
  }, [versionId, stores, page, rowsPerPage, search]);

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  return (
    <Paper variant="outlined" sx={{ mt: 2, borderRadius: '12px', overflow: 'hidden', borderColor: 'divider' }}>
      <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'grey.50' }}>
        <TextField
          size="small"
          placeholder="Search by Store ID or Name..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
          sx={{ width: 300 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
        />
      </Box>
      <TableContainer sx={{ maxHeight }}>
        <Table stickyHeader size="small" sx={{ '& .MuiTableCell-root': { py: 1.25, px: 2 } }}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ bgcolor: 'grey.100', fontWeight: 700, fontSize: '0.75rem', color: 'text.secondary', textTransform: 'uppercase', width: '15%' }}>Store ID</TableCell>
              <TableCell sx={{ bgcolor: 'grey.100', fontWeight: 700, fontSize: '0.75rem', color: 'text.secondary', textTransform: 'uppercase', width: '25%' }}>Name</TableCell>
              <TableCell sx={{ bgcolor: 'grey.100', fontWeight: 700, fontSize: '0.75rem', color: 'text.secondary', textTransform: 'uppercase', width: '15%' }}>State</TableCell>
              <TableCell sx={{ bgcolor: 'grey.100', fontWeight: 700, fontSize: '0.75rem', color: 'text.secondary', textTransform: 'uppercase', width: '15%' }}>City</TableCell>
              <TableCell sx={{ bgcolor: 'grey.100', fontWeight: 700, fontSize: '0.75rem', color: 'text.secondary', textTransform: 'uppercase', width: '30%' }}>Address</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 3 }}>
                  <Typography variant="body2" color="text.secondary">Loading...</Typography>
                </TableCell>
              </TableRow>
            ) : data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 3 }}>
                  <Typography variant="body2" color="text.secondary">No stores found</Typography>
                </TableCell>
              </TableRow>
            ) : (
              data.map((store, index) => {
                const displayStoreId = store.storeId || store.storeCode || store.code;
                const displayName = store.storeName || store.name || 'N/A';
                const displayState = store.state || 'N/A';
                const displayCity = store.city || 'N/A';
                const displayAddress = store.address || 'N/A';

                return (
                  <TableRow key={displayStoreId || index} hover>
                    <TableCell>
                      <Chip
                        label={displayStoreId}
                        size="small"
                        sx={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.75rem', bgcolor: 'grey.100', borderRadius: '6px' }}
                      />
                    </TableCell>
                    <TableCell sx={{ maxWidth: 150 }}>
                      <Tooltip title={displayName} placement="top-start">
                        <Typography variant="body2" sx={{ fontWeight: 500, fontSize: '0.8125rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {displayName}
                        </Typography>
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      <Chip label={displayState} size="small" color="primary" variant="outlined" sx={{ fontWeight: 600, fontSize: '0.725rem', height: 22 }} />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontSize: '0.8125rem' }}>{displayCity}</Typography>
                    </TableCell>
                    <TableCell sx={{ maxWidth: 200 }}>
                      <Tooltip title={displayAddress} placement="top-start">
                        <Typography variant="body2" sx={{ fontSize: '0.8125rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
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
      {totalElements > 0 && (
        <TablePagination
          component="div"
          count={totalElements}
          page={page}
          onPageChange={handleChangePage}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          rowsPerPageOptions={[10, 20, 50]}
        />
      )}
    </Paper>
  );
}
