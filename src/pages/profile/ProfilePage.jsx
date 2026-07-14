import { useState } from 'react';
import {
  Box, Paper, Typography, TextField, Button, Stack, Divider, Alert,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import { useAuth } from '../../hooks/useAuth';
import { userAdminApi } from '../../api/userApi';
import { BRAND } from '../../config/theme';

export default function ProfilePage() {
  const { user } = useAuth();
  const { enqueueSnackbar } = useSnackbar();
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      enqueueSnackbar('New password must be at least 8 characters', { variant: 'warning' });
      return;
    }
    if (newPassword !== confirmPassword) {
      enqueueSnackbar('New passwords do not match', { variant: 'warning' });
      return;
    }

    setSubmitting(true);
    try {
      await userAdminApi.changePassword({ oldPassword, newPassword });
      enqueueSnackbar('Password changed successfully', { variant: 'success' });
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      enqueueSnackbar(err.response?.data?.message || 'Failed to change password', { variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 560 }}>
      <Typography variant="h5" sx={{ fontWeight: 800, mb: 0.5 }}>Profile</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Manage your account settings
      </Typography>

      <Paper elevation={0} sx={{ p: 3, borderRadius: 2, border: `1px solid ${BRAND.borderLight}`, mb: 3 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>Account Details</Typography>
        <Stack spacing={1.5}>
          <Box>
            <Typography variant="caption" color="text.secondary">Full Name</Typography>
            <Typography variant="body1">{user?.fullName || '—'}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">Username</Typography>
            <Typography variant="body1">{user?.username || '—'}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">Email</Typography>
            <Typography variant="body1">{user?.email || '—'}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">Roles</Typography>
            <Typography variant="body1">{user?.roles?.join(', ') || '—'}</Typography>
          </Box>
        </Stack>
      </Paper>

      <Paper elevation={0} sx={{ p: 3, borderRadius: 2, border: `1px solid ${BRAND.borderLight}` }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>Change Password</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Enter your current password and choose a new one.
        </Typography>
        <Divider sx={{ mb: 2 }} />
        <Box component="form" onSubmit={handleChangePassword}>
          <Stack spacing={2}>
            <TextField
              label="Current Password"
              type="password"
              fullWidth
              required
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              autoComplete="current-password"
            />
            <TextField
              label="New Password"
              type="password"
              fullWidth
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              helperText="Minimum 8 characters"
            />
            <TextField
              label="Confirm New Password"
              type="password"
              fullWidth
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
            />
            <Alert severity="info" variant="outlined">
              If an admin reset your password, use the system default password as your current password once, then change it here.
            </Alert>
            <Box>
              <Button
                type="submit"
                variant="contained"
                disabled={submitting}
                sx={{ bgcolor: BRAND.red }}
              >
                {submitting ? 'Updating…' : 'Update Password'}
              </Button>
            </Box>
          </Stack>
        </Box>
      </Paper>
    </Box>
  );
}
