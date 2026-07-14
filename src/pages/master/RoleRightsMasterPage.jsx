import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSnackbar } from 'notistack';
import {
  Box, Button, Chip, CircularProgress, Divider, FormControlLabel, FormGroup,
  Grid, Paper, Stack, Typography, Checkbox, Alert,
} from '@mui/material';
import { roleRightApi, rightApi } from '../../api/masterApi';
import { BRAND } from '../../config/theme';

export default function RoleRightsMasterPage() {
  const { enqueueSnackbar } = useSnackbar();
  const [matrix, setMatrix] = useState([]);
  const [allRights, setAllRights] = useState([]);
  const [selectedRoleId, setSelectedRoleId] = useState(null);
  const [selectedRightCodes, setSelectedRightCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [matrixData, rightsData] = await Promise.all([
        roleRightApi.getMatrix(),
        rightApi.list(),
      ]);
      setMatrix(Array.isArray(matrixData) ? matrixData : []);
      setAllRights(Array.isArray(rightsData) ? rightsData : []);
    } catch (err) {
      enqueueSnackbar(err.response?.data?.message || 'Failed to load role-right mappings', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [enqueueSnackbar]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const selectedRole = useMemo(
    () => matrix.find((row) => row.roleId === selectedRoleId) ?? null,
    [matrix, selectedRoleId],
  );

  const selectRole = (roleId) => {
    setSelectedRoleId(roleId);
    const row = matrix.find((item) => item.roleId === roleId);
    setSelectedRightCodes(row?.rightCodes ?? []);
  };

  const toggleRight = (code) => {
    setSelectedRightCodes((prev) =>
      (prev.includes(code) ? prev.filter((item) => item !== code) : [...prev, code]));
  };

  const handleSave = async () => {
    if (!selectedRoleId) return;
    setSaving(true);
    try {
      const updatedCodes = await roleRightApi.updateForRole(selectedRoleId, selectedRightCodes);
      setSelectedRightCodes(updatedCodes);
      setMatrix((prev) => prev.map((row) =>
        (row.roleId === selectedRoleId ? { ...row, rightCodes: updatedCodes } : row)));
      enqueueSnackbar('Role rights updated', { variant: 'success' });
    } catch (err) {
      enqueueSnackbar(err.response?.data?.message || 'Failed to update role rights', { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>
        Role &amp; Rights
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Map application rights to each role. Changes apply on next login for affected users.
      </Typography>

      <Alert severity="info" sx={{ mb: 3 }}>
        Select a role, toggle rights, then save. Use the Roles and Rights tabs to create or edit role/right definitions.
      </Alert>

      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, md: 4 }}>
          <Paper elevation={0} sx={{ borderRadius: 2, border: `1px solid ${BRAND.borderLight}`, overflow: 'hidden' }}>
            <Box sx={{ px: 2, py: 1.5, borderBottom: `1px solid ${BRAND.borderLight}`, bgcolor: '#FAFBFC' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Roles</Typography>
            </Box>
            <Stack spacing={0}>
              {matrix.map((row) => {
                const active = row.roleId === selectedRoleId;
                return (
                  <Box
                    key={row.roleId}
                    onClick={() => selectRole(row.roleId)}
                    sx={{
                      px: 2,
                      py: 1.5,
                      cursor: 'pointer',
                      borderBottom: `1px solid ${BRAND.borderLight}`,
                      bgcolor: active ? 'rgba(194, 24, 29, 0.06)' : 'transparent',
                      '&:hover': { bgcolor: active ? 'rgba(194, 24, 29, 0.08)' : '#F8FAFC' },
                    }}
                  >
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>{row.roleName}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {row.rightCodes?.length ?? 0} right{(row.rightCodes?.length ?? 0) !== 1 ? 's' : ''}
                    </Typography>
                  </Box>
                );
              })}
            </Stack>
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, md: 8 }}>
          <Paper elevation={0} sx={{ borderRadius: 2, border: `1px solid ${BRAND.borderLight}`, p: 2.5, minHeight: 360 }}>
            {!selectedRole ? (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300, color: 'text.secondary' }}>
                <Typography variant="body2">Select a role to manage its rights</Typography>
              </Box>
            ) : (
              <>
                <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Box>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{selectedRole.roleName}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {selectedRightCodes.length} of {allRights.length} rights selected
                    </Typography>
                  </Box>
                  <Button
                    variant="contained"
                    onClick={handleSave}
                    disabled={saving}
                    sx={{ bgcolor: BRAND.red }}
                  >
                    {saving ? 'Saving…' : 'Save Rights'}
                  </Button>
                </Stack>
                <Divider sx={{ mb: 2 }} />
                <FormGroup>
                  {allRights.map((right) => (
                    <FormControlLabel
                      key={right.id}
                      control={(
                        <Checkbox
                          checked={selectedRightCodes.includes(right.code)}
                          onChange={() => toggleRight(right.code)}
                        />
                      )}
                      label={(
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>{right.name}</Typography>
                          <Stack direction="row" spacing={1} sx={{ mt: 0.25 }}>
                            <Chip label={right.code} size="small" variant="outlined" />
                            {right.module && <Chip label={right.module} size="small" />}
                          </Stack>
                        </Box>
                      )}
                      sx={{ alignItems: 'flex-start', mb: 1.5 }}
                    />
                  ))}
                </FormGroup>
              </>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
