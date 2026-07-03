import { useEffect, useRef, useState } from 'react';
import { useSnackbar } from 'notistack';
import { useForm, Controller } from 'react-hook-form';
import {
  Box, Button, TextField, Stack, Typography, FormControlLabel, Switch,
  MenuItem, Select, FormControl, InputLabel, FormHelperText,
} from '@mui/material';
import SlidePanel from '../../components/ui/SlidePanel';
import MasterDataTable from '../../components/master/MasterDataTable';
import { MasterAddButton, MasterRowActions } from '../../components/master/MasterCrudActions';
import { buildMasterColumns, masterIdColumn } from '../../components/master/masterTableColumns';
import { productApi, manufacturerApi, divisionApi } from '../../api/masterApi';
import { useMasterPage } from '../../hooks/useMasterPage';
import { BRAND } from '../../config/theme';
import { isRecordActive } from '../../utils/masterUtils';

const COLUMNS = buildMasterColumns([
  masterIdColumn(),
  { field: 'productCode', header: 'Code', minWidth: 120, sortable: true, filterType: 'text' },
  { field: 'productName', header: 'Product Name', minWidth: 160, sortable: true, filterType: 'text' },
  { field: 'manufacturerName', header: 'Manufacturer', minWidth: 160, sortable: true, filterType: 'text', filterKey: 'manufacturerName' },
  { field: 'divisionName', header: 'Division', minWidth: 140, sortable: true, filterType: 'text', filterKey: 'divisionName' },
]);

export default function ProductMasterPage() {
  const page = useMasterPage({ api: productApi, entityLabel: 'Product' });
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
          <Typography variant="h6" sx={{ fontWeight: 700 }}>Products</Typography>
          <Typography variant="body2" color="text.secondary">{page.totalCount} record{page.totalCount !== 1 ? 's' : ''}</Typography>
        </Box>
        <MasterAddButton label="Add Product" onClick={page.openCreate} />
      </Stack>
      <MasterDataTable columns={COLUMNS} rows={enrichedRows} loading={page.loading} totalCount={page.totalCount}
        page={page.page} rowsPerPage={page.rowsPerPage} onPageChange={page.handlePageChange}
        onRowsPerPageChange={page.handleRowsPerPageChange} sortBy={page.sortBy} sortDir={page.sortDir}
        onSort={page.handleSort} filters={page.filters} onFilterChange={page.handleFilterChange} />
      <ProductFormPanel open={page.panelOpen} onClose={page.closePanel} editingRow={page.editingRow}
        saving={page.saving} onSave={page.handleSave} manufacturers={manufacturers} />
    </Box>
  );
}

function ProductFormPanel({ open, onClose, editingRow, saving, onSave, manufacturers }) {
  const { enqueueSnackbar } = useSnackbar();
  const isEdit = Boolean(editingRow);
  const { register, handleSubmit, reset, control, watch, setValue, formState: { errors } } = useForm();
  const selectedMfrId = watch('manufacturerId');
  const [divisions, setDivisions] = useState([]);
  const [loadingDivisions, setLoadingDivisions] = useState(false);
  const prevMfrIdRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    reset(isEdit
      ? {
          productCode: editingRow.productCode,
          productName: editingRow.productName,
          manufacturerId: editingRow.manufacturerId,
          divisionId: editingRow.divisionId,
          isActive: isRecordActive(editingRow),
        }
      : { productCode: '', productName: '', manufacturerId: '', divisionId: '', isActive: true });
    prevMfrIdRef.current = null;
  }, [open, editingRow, isEdit, reset]);

  useEffect(() => {
    if (!open || !selectedMfrId) {
      setDivisions([]);
      return;
    }
    let cancelled = false;
    setLoadingDivisions(true);
    divisionApi.listByManufacturer(selectedMfrId)
      .then((data) => {
        if (!cancelled) setDivisions(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        if (!cancelled) {
          setDivisions([]);
          enqueueSnackbar(err?.response?.data?.message || 'Failed to load divisions', { variant: 'error' });
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingDivisions(false);
      });
    return () => { cancelled = true; };
  }, [open, selectedMfrId, enqueueSnackbar]);

  useEffect(() => {
    if (!open || !selectedMfrId) return;
    if (prevMfrIdRef.current != null && prevMfrIdRef.current !== selectedMfrId) {
      setValue('divisionId', '');
    }
    prevMfrIdRef.current = selectedMfrId;
  }, [open, selectedMfrId, setValue]);

  return (
    <SlidePanel open={open} onClose={onClose} title={isEdit ? 'Edit Product' : 'Add Product'} loading={saving}>
      <Box component="form" onSubmit={handleSubmit(onSave)} noValidate
        sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
        <TextField label="Product Code" {...register('productCode')} fullWidth />
        <TextField label="Product Name" required error={!!errors.productName}
          helperText={errors.productName?.message}
          {...register('productName', { required: 'Product name is required' })} fullWidth />
        <FormControl fullWidth required error={!!errors.manufacturerId}>
          <InputLabel>Manufacturer</InputLabel>
          <Controller name="manufacturerId" control={control} rules={{ required: 'Manufacturer is required' }}
            render={({ field }) => (
              <Select {...field} label="Manufacturer">
                {manufacturers.map((m) => <MenuItem key={m.id} value={m.id}>{m.manufacturerName}</MenuItem>)}
              </Select>
            )} />
          {errors.manufacturerId && <FormHelperText>{errors.manufacturerId.message}</FormHelperText>}
        </FormControl>
        <FormControl fullWidth required error={!!errors.divisionId} disabled={!selectedMfrId || loadingDivisions}>
          <InputLabel>Division</InputLabel>
          <Controller name="divisionId" control={control} rules={{ required: 'Division is required' }}
            render={({ field }) => (
              <Select {...field} label="Division">
                {divisions.map((d) => <MenuItem key={d.id} value={d.id}>{d.divisionName}</MenuItem>)}
              </Select>
            )} />
          {errors.divisionId && <FormHelperText>{errors.divisionId.message}</FormHelperText>}
          {selectedMfrId && !loadingDivisions && divisions.length === 0 && (
            <FormHelperText>No divisions for this manufacturer — add one in Divisions master</FormHelperText>
          )}
        </FormControl>
        {isEdit && (
          <FormControlLabel control={<Switch {...register('isActive')} defaultChecked={isRecordActive(editingRow)} color="success" />} label="Active" />
        )}
        <Stack direction="row" spacing={1.5} sx={{ justifyContent: 'flex-end', mt: 1 }}>
          <Button variant="outlined" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={saving} sx={{ background: BRAND.redGradient }}>
            {isEdit ? 'Save Changes' : 'Create Product'}
          </Button>
        </Stack>
      </Box>
    </SlidePanel>
  );
}
