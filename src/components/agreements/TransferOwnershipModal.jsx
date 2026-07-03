import { useCallback, useEffect, useState } from 'react';
import {
  Alert, Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, TextField,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import axiosInstance from '../../api/axiosInstance';
import { ENDPOINTS } from '../../config/endpoints';
import { RIGHTS } from '../../config/rights';
import { useAuth } from '../../hooks/useAuth';
import SearchableSelect from '../forms/SearchableSelect';

export default function TransferOwnershipModal({
  open,
  onClose,
  agreementId,
  agreementLabel,
  onSuccess,
}) {
  const { enqueueSnackbar } = useSnackbar();
  const { hasRight } = useAuth();
  const isAdmin = hasRight(RIGHTS.ADMIN_USERS);
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [comments, setComments] = useState('');
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const searchUsers = useCallback(async (query) => {
    setSearching(true);
    try {
      const { data } = await axiosInstance.get(ENDPOINTS.USER_LOOKUP, {
        params: { q: query?.trim() || '' },
      });
      setUsers(Array.isArray(data) ? data : []);
    } catch {
      setUsers([]);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      setSelectedUser(null);
      setComments('');
      searchUsers('');
    }
  }, [open, searchUsers]);

  const handleSubmit = async () => {
    if (!agreementId || !selectedUser?.id || !comments.trim()) return;
    setSubmitting(true);
    try {
      await axiosInstance.post(ENDPOINTS.AGREEMENT_VERSION_REQUEST_TRANSFER(agreementId), {
        newOwnerId: selectedUser.id,
        comments: comments.trim(),
      });
      onSuccess?.({ immediate: isAdmin });
      onClose();
    } catch (err) {
      enqueueSnackbar(
        err.response?.data?.message || (isAdmin ? 'Transfer failed' : 'Transfer request failed'),
        { variant: 'error' },
      );
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = Boolean(selectedUser?.id && comments.trim());

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle fontWeight={700}>Transfer Ownership</DialogTitle>
      <DialogContent>
        <Alert severity="warning" sx={{ mb: 2 }}>
          {isAdmin
            ? 'Admin override — ownership will transfer immediately without approval.'
            : 'Request will be sent to an Approver. Agreement ownership will not change until approved.'}
        </Alert>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Reassign {agreementLabel || 'this agreement'} to a new Account Manager.
        </Typography>
        <SearchableSelect
          label="New Owner"
          placeholder="Search users…"
          options={users}
          value={selectedUser}
          onChange={setSelectedUser}
          onSearch={searchUsers}
          loading={searching}
          getOptionLabel={(u) => u?.fullName || u?.username || ''}
          isOptionEqualToValue={(a, b) => a?.id === b?.id}
          required
          sx={{ mb: 2 }}
        />
        <TextField
          label="Reason / Comments *"
          multiline
          rows={4}
          fullWidth
          value={comments}
          onChange={(e) => setComments(e.target.value)}
          placeholder="Explain why ownership should be transferred…"
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} variant="outlined">Cancel</Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={!canSubmit || submitting}
        >
          {submitting
            ? (isAdmin ? 'Transferring…' : 'Submitting…')
            : (isAdmin ? 'Transfer Now' : 'Submit Transfer Request')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
