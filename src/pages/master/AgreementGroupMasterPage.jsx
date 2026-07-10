import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import {
  Box, Button, TextField, Stack, Typography, FormControlLabel, Switch,
} from '@mui/material';
import SlidePanel from '../../components/ui/SlidePanel';
import MasterDataTable from '../../components/master/MasterDataTable';
import { MasterAddButton, MasterRowActions } from '../../components/master/MasterCrudActions';
import { buildMasterColumns, masterIdColumn } from '../../components/master/masterTableColumns';
import { agreementGroupApi } from '../../api/masterApi';
import { useMasterPage } from '../../hooks/useMasterPage';
import { BRAND } from '../../config/theme';
import { isRecordActive } from '../../utils/masterUtils';

const COLUMNS = buildMasterColumns([
  masterIdColumn(),
  { field: 'name', header: 'Group Name', minWidth: 220, sortable: true, filterType: 'text' },
]);

export default function AgreementGroupMasterPage() {
  const page = useMasterPage({ api: agreementGroupApi, entityLabel: 'Agreement Group' });

  const enrichedRows = page.rows.map((row) => ({
    ...row,
    _actions: (
      <MasterRowActions
        row={row}
        onEdit={page.openEdit}
        onToggleStatus={page.handleToggleStatus}
      />
    ),
  }));

  return (
    <Box>
      <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>Agreement Groups</Typography>
          <Typography variant="body2" color="text.secondary">
            {page.totalCount} record{page.totalCount !== 1 ? 's' : ''}
          </Typography>
        </Box>
        <MasterAddButton label="Add Agreement Group" onClick={page.openCreate} />
      </Stack>
      <MasterDataTable
        columns={COLUMNS}
        rows={enrichedRows}
        loading={page.loading}
        totalCount={page.totalCount}
        page={page.page}
        rowsPerPage={page.rowsPerPage}
        onPageChange={page.handlePageChange}
        onRowsPerPageChange={page.handleRowsPerPageChange}
        sortBy={page.sortBy}
        sortDir={page.sortDir}
        onSort={page.handleSort}
        filters={page.filters}
        onFilterChange={page.handleFilterChange}
      />
      <AgreementGroupFormPanel
        open={page.panelOpen}
        onClose={page.closePanel}
        editingRow={page.editingRow}
        saving={page.saving}
        onSave={page.handleSave}
      />
    </Box>
  );
}

function AgreementGroupFormPanel({ open, onClose, editingRow, saving, onSave }) {
  const isEdit = Boolean(editingRow);
  const { register, handleSubmit, reset, formState: { errors } } = useForm();

  useEffect(() => {
    if (!open) return;
    reset(isEdit ? editingRow : { name: '', isActive: true });
  }, [open, editingRow, isEdit, reset]);

  return (
    <SlidePanel open={open} onClose={onClose} title={isEdit ? 'Edit Agreement Group' : 'Add Agreement Group'} loading={saving}>
      <Box
        component="form"
        onSubmit={handleSubmit(onSave)}
        noValidate
        sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}
      >
        <TextField
          label="Group Name"
          required
          error={!!errors.name}
          helperText={errors.name?.message}
          slotProps={{ htmlInput: { maxLength: 255 } }}
          {...register('name', { required: 'Group name is required' })}
          fullWidth
        />
        {isEdit && (
          <FormControlLabel
            control={(
              <Switch
                {...register('isActive')}
                defaultChecked={isRecordActive(editingRow)}
                color="success"
              />
            )}
            label="Active"
          />
        )}
        <Stack direction="row" spacing={1.5} sx={{ justifyContent: 'flex-end', mt: 1 }}>
          <Button variant="outlined" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={saving} sx={{ background: BRAND.redGradient }}>
            {isEdit ? 'Save Changes' : 'Create Group'}
          </Button>
        </Stack>
      </Box>
    </SlidePanel>
  );
}
