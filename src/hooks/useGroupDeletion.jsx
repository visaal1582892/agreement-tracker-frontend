import { useCallback, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Typography, Alert,
} from '@mui/material';
import axiosInstance from '../api/axiosInstance';
import { ENDPOINTS } from '../config/endpoints';
import { BRAND } from '../config/theme';

export function GroupDeleteDialogs({
  modal,
  group,
  reason,
  onReasonChange,
  onClose,
  onConfirm,
  submitting,
}) {
  if (!modal || !group) return null;

  const isDrafts = modal === 'drafts';
  const isApproval = modal === 'approval';

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle fontWeight={700}>
        {isApproval ? 'Submit Group Deletion for Approval' : 'Delete Group'}
      </DialogTitle>
      <DialogContent>
        {isDrafts && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            This group contains drafts. Deleting this group will permanently delete all associated
            drafts. This action cannot be undone.
          </Alert>
        )}
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Group: <strong>{group.name}</strong>
        </Typography>
        <TextField
          label="Reason for Deletion"
          required
          multiline
          rows={3}
          fullWidth
          value={reason}
          onChange={(e) => onReasonChange(e.target.value)}
          placeholder="Explain why this group should be deleted…"
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} variant="outlined" disabled={submitting}>Cancel</Button>
        <Button
          onClick={onConfirm}
          variant="contained"
          color="error"
          disabled={submitting || !reason.trim()}
          sx={!isApproval ? { bgcolor: BRAND.red, '&:hover': { bgcolor: BRAND.redDark } } : undefined}
        >
          {isApproval ? 'Submit for Approval' : 'Delete Group'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export function useGroupDeletion({ onSuccess }) {
  const [deleteFlow, setDeleteFlow] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmError, setConfirmError] = useState(null);

  const closeModal = useCallback(() => {
    setDeleteFlow(null);
    setConfirmError(null);
  }, []);

  const setReason = useCallback((reason) => {
    setDeleteFlow((prev) => (prev ? { ...prev, reason } : null));
  }, []);

  const startDelete = useCallback(async (targetGroup) => {
    try {
      const { data } = await axiosInstance.get(
        ENDPOINTS.COMPANY_AGREEMENT_GROUP_DELETION_STATUS(targetGroup.id),
      );
      const status = data.status;

      switch (status) {
        case 'HAS_ACTIVE':
          return {
            blocked: true,
            error: 'Cannot delete group: Active agreements exist.',
          };
        case 'REQUIRES_APPROVAL':
          setDeleteFlow({ group: targetGroup, modal: 'approval', reason: '' });
          return { blocked: false };
        case 'READY':
          setDeleteFlow({ group: targetGroup, modal: 'ready', reason: '' });
          return { blocked: false };
        default:
          return {
            blocked: true,
            error: 'Unable to determine deletion status for this group.',
          };
      }
    } catch (err) {
      return {
        blocked: true,
        error: err.response?.data?.message || 'Failed to check deletion status',
      };
    }
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!deleteFlow?.group?.id || !deleteFlow.reason.trim()) return;
    setSubmitting(true);
    setConfirmError(null);
    try {
      if (deleteFlow.modal === 'approval') {
        await axiosInstance.post(
          ENDPOINTS.COMPANY_AGREEMENT_GROUP_DELETION_REQUEST(deleteFlow.group.id),
          { reason: deleteFlow.reason.trim() },
        );
      } else {
        await axiosInstance.delete(ENDPOINTS.COMPANY_AGREEMENT_GROUP_BY_ID(deleteFlow.group.id), {
          params: { reason: deleteFlow.reason.trim() },
        });
      }
      closeModal();
      onSuccess?.(deleteFlow.modal === 'approval'
        ? 'Group deletion submitted for approval'
        : 'Group deleted successfully');
    } catch (err) {
      setConfirmError(err.response?.data?.message || 'Deletion failed');
    } finally {
      setSubmitting(false);
    }
  }, [deleteFlow, closeModal, onSuccess]);

  return {
    modal: deleteFlow?.modal ?? null,
    group: deleteFlow?.group ?? null,
    reason: deleteFlow?.reason ?? '',
    setReason,
    submitting,
    confirmError,
    startDelete,
    closeModal,
    confirmDelete,
  };
}
