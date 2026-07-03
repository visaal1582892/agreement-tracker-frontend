import { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import {
  Box, Button, TextField, Stack, Typography, FormControlLabel, Switch,
  MenuItem, Select, FormControl, InputLabel, FormHelperText,
} from '@mui/material';
import SlidePanel from '../../components/ui/SlidePanel';
import MasterDataTable from '../../components/master/MasterDataTable';
import { MasterAddButton, MasterRowActions } from '../../components/master/MasterCrudActions';
import { buildMasterColumns, masterIdColumn } from '../../components/master/masterTableColumns';
import { divisionApi, manufacturerApi } from '../../api/masterApi';
import { useMasterPage } from '../../hooks/useMasterPage';
import { BRAND } from '../../config/theme';
import { isRecordActive } from '../../utils/masterUtils';

const COLUMNS = buildMasterColumns([
  masterIdColumn(),
  { field: 'divisionCode', header: 'Code', minWidth: 120, sortable: true, filterType: 'text' },
  { field: 'divisionName', header: 'Division Name', minWidth: 160, sortable: true, filterType: 'text' },
  { field: 'manufacturerName', header: 'Manufacturer', minWidth: 160, sortable: true, filterType: 'text', filterKey: 'manufacturerName' },
]);

export default function DivisionMasterPage() {
  const page = useMasterPage({ api: divisionApi, entityLabel: 'Division' });
  const [manufacturers, setManufacturers] = useState([]);

  useEffect(() => {
    manufacturerApi.list().then(setManufacturers).catch(() => {});
  }, []);

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
          <Typography variant="h6" sx={{ fontWeight: 700 }}>Divisions</Typography>
          <Typography variant="body2" color="text.secondary">{page.totalCount} record{page.totalCount !== 1 ? 's' : ''}</Typography>
        </Box>
        <MasterAddButton label="Add Division" onClick={page.openCreate} />
      </Stack>
      <MasterDataTable columns={COLUMNS} rows={enrichedRows} loading={page.loading} totalCount={page.totalCount}
        page={page.page} rowsPerPage={page.rowsPerPage} onPageChange={page.handlePageChange}
        onRowsPerPageChange={page.handleRowsPerPageChange} sortBy={page.sortBy} sortDir={page.sortDir}
        onSort={page.handleSort} filters={page.filters} onFilterChange={page.handleFilterChange} />
      <DivisionFormPanel open={page.panelOpen} onClose={page.closePanel} editingRow={page.editingRow}
        saving={page.saving} onSave={page.handleSave} manufacturers={manufacturers} />
    </Box>
  );
}

function DivisionFormPanel({ open, onClose, editingRow, saving, onSave, manufacturers }) {
  const isEdit = Boolean(editingRow);
  const { register, handleSubmit, reset, control, formState: { errors } } = useForm();

  useEffect(() => {
    if (!open) return;
    reset(isEdit
      ? {
          divisionCode: editingRow.divisionCode,
          divisionName: editingRow.divisionName,
          manufacturerId: editingRow.manufacturerId,
          isActive: isRecordActive(editingRow),
        }
      : { divisionCode: '', divisionName: '', manufacturerId: '', isActive: true });
  }, [open, editingRow, isEdit, reset]);

  return (
    <SlidePanel open={open} onClose={onClose} title={isEdit ? 'Edit Division' : 'Add Division'} loading={saving}>
      <Box component="form" onSubmit={handleSubmit(onSave)} noValidate
        sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
        <TextField label="Division Code" {...register('divisionCode')} fullWidth />
        <TextField label="Division Name" required error={!!errors.divisionName}
          helperText={errors.divisionName?.message}
          {...register('divisionName', { required: 'Division name is required' })} fullWidth />
        <FormControl fullWidth required error={!!errors.manufacturerId}>
          <InputLabel>Manufacturer</InputLabel>
          <Controller name="manufacturerId" control={control}
            rules={{ required: 'Manufacturer is required' }}
            render={({ field }) => (
              <Select {...field} label="Manufacturer">
                {manufacturers.map((m) => (
                  <MenuItem key={m.id} value={m.id}>{m.manufacturerName}</MenuItem>
                ))}
              </Select>
            )} />
          {errors.manufacturerId && <FormHelperText>{errors.manufacturerId.message}</FormHelperText>}
        </FormControl>
        {isEdit && (
          <FormControlLabel control={<Switch {...register('isActive')} defaultChecked={isRecordActive(editingRow)} color="success" />} label="Active" />
        )}
        <Stack direction="row" spacing={1.5} sx={{ justifyContent: 'flex-end', mt: 1 }}>
          <Button variant="outlined" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={saving} sx={{ background: BRAND.redGradient }}>
            {isEdit ? 'Save Changes' : 'Create Division'}
          </Button>
        </Stack>
      </Box>
    </SlidePanel>
  );
}
