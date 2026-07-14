import { useCallback, useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { useSnackbar } from 'notistack';
import {
  Box, Button, Chip, FormControl, FormControlLabel, FormHelperText,
  IconButton, InputLabel, MenuItem, Paper, Select, Stack, Switch,
  Table, TableBody, TableCell, TableContainer, TableHead, TablePagination,
  TableRow, TextField, Tooltip, Typography, Skeleton, Alert,
} from '@mui/material';
import { Edit, LockReset, PersonOff } from '@mui/icons-material';
import SlidePanel from '../../components/ui/SlidePanel';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { userAdminApi } from '../../api/userApi';
import { BRAND } from '../../config/theme';

const ROLE_OPTIONS = ['ADMIN', 'ACCOUNT_MANAGER', 'APPROVER'];

const emptyForm = {
  username: '',
  fullName: '',
  email: '',
  employeeId: '',
  roles: [],
  isActive: true,
};

export default function UsersMasterPage() {
  const { enqueueSnackbar } = useSnackbar();
  const [users, setUsers] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [loading, setLoading] = useState(true);
  const [panelOpen, setPanelOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [saving, setSaving] = useState(false);
  const [resetTarget, setResetTarget] = useState(null);
  const [resetting, setResetting] = useState(false);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await userAdminApi.list(page, rowsPerPage);
      setUsers(data.content || []);
      setTotalCount(data.totalElements || 0);
    } catch (err) {
      enqueueSnackbar(err.response?.data?.message || 'Failed to load users', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [enqueueSnackbar, page, rowsPerPage]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const openCreate = () => {
    setEditingUser(null);
    setPanelOpen(true);
  };

  const openEdit = (user) => {
    setEditingUser(user);
    setPanelOpen(true);
  };

  const closePanel = () => {
    setPanelOpen(false);
    setEditingUser(null);
  };

  const handleDeactivate = async (user) => {
    try {
      await userAdminApi.deactivate(user.id);
      enqueueSnackbar(`${user.fullName} deactivated`, { variant: 'success' });
      loadUsers();
    } catch (err) {
      enqueueSnackbar(err.response?.data?.message || 'Failed to deactivate user', { variant: 'error' });
    }
  };

  const handleResetPassword = async () => {
    if (!resetTarget) return;
    setResetting(true);
    try {
      await userAdminApi.resetPassword(resetTarget.id);
      enqueueSnackbar(`Password reset for ${resetTarget.fullName}`, { variant: 'success' });
      setResetTarget(null);
    } catch (err) {
      enqueueSnackbar(err.response?.data?.message || 'Failed to reset password', { variant: 'error' });
    } finally {
      setResetting(false);
    }
  };

  return (
    <Box>
      <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>Users</Typography>
          <Typography variant="body2" color="text.secondary">
            {totalCount} user{totalCount !== 1 ? 's' : ''} — assign multiple roles per user
          </Typography>
        </Box>
        <Button variant="contained" onClick={openCreate} sx={{ bgcolor: BRAND.red }}>
          Add User
        </Button>
      </Stack>

      <Alert severity="info" sx={{ mb: 2 }}>
        Passwords are encrypted and never displayed. New users receive the system default password.
        Use Reset Password to restore the default for any user.
      </Alert>

      <Paper elevation={0} sx={{ borderRadius: 2, border: `1px solid ${BRAND.borderLight}` }}>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>Name</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Username</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Email</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Employee ID</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Roles</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={7}><Skeleton height={36} /></TableCell>
                  </TableRow>
                ))
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                    No users found
                  </TableCell>
                </TableRow>
              ) : users.map((user) => (
                <TableRow key={user.id} hover>
                  <TableCell>{user.fullName}</TableCell>
                  <TableCell>{user.username}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{user.employeeId || '—'}</TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: 'wrap' }}>
                      {(user.roles || []).map((role) => (
                        <Chip key={role} label={role} size="small" variant="outlined" />
                      ))}
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={user.isActive ? 'Active' : 'Inactive'}
                      size="small"
                      color={user.isActive ? 'success' : 'default'}
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Edit user">
                      <IconButton size="small" onClick={() => openEdit(user)}>
                        <Edit fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Reset to default password">
                      <IconButton size="small" onClick={() => setResetTarget(user)}>
                        <LockReset fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    {user.isActive && (
                      <Tooltip title="Deactivate user">
                        <IconButton size="small" color="error" onClick={() => handleDeactivate(user)}>
                          <PersonOff fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={totalCount}
          page={page}
          onPageChange={(_, nextPage) => setPage(nextPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
          rowsPerPageOptions={[10, 20, 50]}
        />
      </Paper>

      <UserFormPanel
        open={panelOpen}
        onClose={closePanel}
        editingUser={editingUser}
        saving={saving}
        onSave={async (formData) => {
          setSaving(true);
          try {
            if (editingUser) {
              await userAdminApi.update(editingUser.id, {
                fullName: formData.fullName,
                email: formData.email,
                employeeId: formData.employeeId || null,
                isActive: formData.isActive,
                roles: formData.roles,
              });
              enqueueSnackbar('User updated', { variant: 'success' });
            } else {
              await userAdminApi.create({
                username: formData.username,
                fullName: formData.fullName,
                email: formData.email,
                employeeId: formData.employeeId || null,
                roles: formData.roles,
              });
              enqueueSnackbar('User created with system default password', { variant: 'success' });
            }
            closePanel();
            loadUsers();
          } catch (err) {
            enqueueSnackbar(err.response?.data?.message || 'Failed to save user', { variant: 'error' });
          } finally {
            setSaving(false);
          }
        }}
      />

      <ConfirmDialog
        open={Boolean(resetTarget)}
        onClose={() => setResetTarget(null)}
        onConfirm={handleResetPassword}
        title="Reset Password"
        message={`Reset password for ${resetTarget?.fullName}? They will need to sign in with the system default password.`}
        confirmLabel={resetting ? 'Resetting…' : 'Reset Password'}
        danger
      />
    </Box>
  );
}

function UserFormPanel({ open, onClose, editingUser, saving, onSave }) {
  const isEdit = Boolean(editingUser);
  const { register, handleSubmit, reset, control, formState: { errors } } = useForm();

  useEffect(() => {
    if (!open) return;
    reset(isEdit
      ? {
          username: editingUser.username,
          fullName: editingUser.fullName,
          email: editingUser.email,
          employeeId: editingUser.employeeId || '',
          roles: editingUser.roles || [],
          isActive: editingUser.isActive,
        }
      : emptyForm);
  }, [open, editingUser, isEdit, reset]);

  return (
    <SlidePanel
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit User' : 'Add User'}
      loading={saving}
    >
      <Box component="form" onSubmit={handleSubmit(onSave)} noValidate sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
        <TextField
          label="Username"
          fullWidth
          required
          disabled={isEdit}
          {...register('username', { required: 'Username is required', minLength: { value: 3, message: 'Min 3 characters' } })}
          error={!!errors.username}
          helperText={errors.username?.message}
        />
        <TextField
          label="Full Name"
          fullWidth
          required
          {...register('fullName', { required: 'Full name is required' })}
          error={!!errors.fullName}
          helperText={errors.fullName?.message}
        />
        <TextField
          label="Email"
          type="email"
          fullWidth
          required
          {...register('email', { required: 'Email is required' })}
          error={!!errors.email}
          helperText={errors.email?.message}
        />
        <TextField
          label="Employee ID"
          fullWidth
          {...register('employeeId')}
        />

        <FormControl fullWidth required error={!!errors.roles}>
          <InputLabel>Roles</InputLabel>
          <Controller
            name="roles"
            control={control}
            rules={{ validate: (value) => (value?.length > 0 ? true : 'Select at least one role') }}
            render={({ field }) => (
              <Select
                {...field}
                multiple
                label="Roles"
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {selected.map((role) => (
                      <Chip key={role} label={role} size="small" />
                    ))}
                  </Box>
                )}
              >
                {ROLE_OPTIONS.map((role) => (
                  <MenuItem key={role} value={role}>{role}</MenuItem>
                ))}
              </Select>
            )}
          />
          {errors.roles && <FormHelperText>{errors.roles.message}</FormHelperText>}
        </FormControl>

        {isEdit && (
          <Controller
            name="isActive"
            control={control}
            render={({ field }) => (
              <FormControlLabel
                control={<Switch checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />}
                label="Active"
              />
            )}
          />
        )}

        {!isEdit && (
          <Alert severity="info" variant="outlined">
            A system default password will be assigned automatically. It is stored encrypted and is not shown here.
          </Alert>
        )}

        <Stack direction="row" spacing={1.5} justifyContent="flex-end" sx={{ pt: 1 }}>
          <Button variant="outlined" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained" sx={{ bgcolor: BRAND.red }}>
            {isEdit ? 'Save Changes' : 'Create User'}
          </Button>
        </Stack>
      </Box>
    </SlidePanel>
  );
}
