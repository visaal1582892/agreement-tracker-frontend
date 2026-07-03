import { useCallback, useEffect, useState } from 'react';
import {
  Box, Paper, Typography, Button, Dialog, DialogTitle, DialogContent, DialogActions,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Skeleton,
} from '@mui/material';
import { SwapHoriz } from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import axiosInstance from '../../api/axiosInstance';
import { ENDPOINTS } from '../../config/endpoints';
import { BRAND } from '../../config/theme';
import PageHeader from '../../components/ui/PageHeader';
import SearchableSelect from '../../components/forms/SearchableSelect';

export default function UserManagementPage() {
  const { enqueueSnackbar } = useSnackbar();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [fromUser, setFromUser] = useState(null);
  const [toUser, setToUser] = useState(null);
  const [lookupOptions, setLookupOptions] = useState([]);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await axiosInstance.get(ENDPOINTS.USERS, { params: { page: 0, size: 100 } });
      setUsers(data.content || []);
    } catch {
      enqueueSnackbar('Failed to load users', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [enqueueSnackbar]);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const searchUsers = useCallback(async (query) => {
    setLookupLoading(true);
    try {
      const { data } = await axiosInstance.get(ENDPOINTS.USER_LOOKUP, {
        params: { q: query?.trim() || '' },
      });
      setLookupOptions(Array.isArray(data) ? data : []);
    } catch {
      setLookupOptions([]);
    } finally {
      setLookupLoading(false);
    }
  }, []);

  useEffect(() => {
    if (bulkOpen) searchUsers('');
  }, [bulkOpen, searchUsers]);

  const handleBulkTransfer = async () => {
    if (!fromUser?.id || !toUser?.id) return;
    setSubmitting(true);
    try {
      await axiosInstance.put(ENDPOINTS.AGREEMENT_BULK_TRANSFER, {
        fromUserId: fromUser.id,
        toUserId: toUser.id,
      });
      enqueueSnackbar('Portfolio reassigned successfully', { variant: 'success' });
      setBulkOpen(false);
      setFromUser(null);
      setToUser(null);
    } catch (err) {
      enqueueSnackbar(err.response?.data?.message || 'Bulk transfer failed', { variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box>
      <PageHeader
        title="User Management"
        subtitle="Admin tools for user offboarding and portfolio reassignment"
        actionLabel="Bulk Reassign"
        onAction={() => setBulkOpen(true)}
      />

      <Paper elevation={0} sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>Name</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Username</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Email</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Roles</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={5}><Skeleton height={32} /></TableCell>
                  </TableRow>
                ))
              ) : users.map((u) => (
                <TableRow key={u.id} hover>
                  <TableCell>{u.fullName}</TableCell>
                  <TableCell>{u.username}</TableCell>
                  <TableCell>{u.email}</TableCell>
                  <TableCell>{u.roles?.join(', ') || '—'}</TableCell>
                  <TableCell>{u.isActive ? 'Active' : 'Inactive'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Dialog open={bulkOpen} onClose={() => setBulkOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle fontWeight={700}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <SwapHoriz color="primary" />
            Bulk Reassign Portfolio
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Move all active agreements from one Account Manager to another.
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <SearchableSelect
              label="From (Current Owner)"
              placeholder="Search departing user…"
              options={lookupOptions}
              value={fromUser}
              onChange={setFromUser}
              onSearch={searchUsers}
              loading={lookupLoading}
              getOptionLabel={(u) => u?.fullName || ''}
              isOptionEqualToValue={(a, b) => a?.id === b?.id}
              required
            />
            <SearchableSelect
              label="To (New Owner)"
              placeholder="Search new owner…"
              options={lookupOptions.filter((u) => u.id !== fromUser?.id)}
              value={toUser}
              onChange={setToUser}
              onSearch={searchUsers}
              loading={lookupLoading}
              getOptionLabel={(u) => u?.fullName || ''}
              isOptionEqualToValue={(a, b) => a?.id === b?.id}
              required
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setBulkOpen(false)} variant="outlined">Cancel</Button>
          <Button
            variant="contained"
            onClick={handleBulkTransfer}
            disabled={!fromUser?.id || !toUser?.id || submitting}
            sx={{ bgcolor: BRAND.red }}
          >
            {submitting ? 'Reassigning…' : 'Reassign All'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
