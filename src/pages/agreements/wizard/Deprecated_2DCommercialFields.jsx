import { useCallback, useEffect, useState } from 'react';
import {
  Box, Typography, Grid, RadioGroup, FormControlLabel, Radio,
  TextField, Button,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, IconButton, Alert, CircularProgress,
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions,
} from '@mui/material';
import { Add, Delete, Edit, TableChart } from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import { useModal } from '../../../hooks/useModal';
import {
  createSlab,
  deleteSlab,
  fetchCommercialTargetsPreview,
  fetchSlabs,
  formatSlabLabel,
  switchCommercialType,
  toSlabPayload,
  updateSlab,
  validateSlabAgainstExisting,
} from '../../../api/commercialApi';
import { ensureDraftVersionForCommercial } from '../../../utils/commercialDraftOrchestration';
import CommercialValueInput from '../../../components/forms/CommercialValueInput';
import CommercialsUploadModal from './CommercialsUploadModal';

const EMPTY_DRAFT = {
  fromValue: '',
  toValue: '',
  valueType: 'PERCENTAGE',
  commercialValue: '',
};

const SLAB_TYPE_OPTIONS = [
  { value: 'PURCHASE', label: 'Purchase Slab' },
  { value: 'SALE', label: 'Sale Slab' },
];

export default function Deprecated_2DCommercialFields({
  commercials,
  onUpdate,
  serverAgreementId,
  sourceAgreement,
  versionSourceId,
  buildVersionedEditPayload,
  onDraftVersionCreated,
  startDate,
  expiryDate,
  lockOneTimeFrequency = false,
}) {
  const { enqueueSnackbar } = useSnackbar();
  const uploadModal = useModal();
  const typeSwitchModal = useModal();
  const [draftSlab, setDraftSlab] = useState(EMPTY_DRAFT);
  const [editingSlabId, setEditingSlabId] = useState(null);
  const [slabs, setSlabs] = useState([]);
  const [targetCount, setTargetCount] = useState(0);
  const [loadingSlabs, setLoadingSlabs] = useState(false);
  const [savingSlab, setSavingSlab] = useState(false);
  const [switchingType, setSwitchingType] = useState(false);
  const [pendingSlabType, setPendingSlabType] = useState(null);
  const [commercialRefreshKey, setCommercialRefreshKey] = useState(0);
  const [commercialVersionId, setCommercialVersionId] = useState(serverAgreementId);

  const selectedFrequencies = commercials.selectedFrequencies || [];
  const slabType = commercials.slabType || 'PURCHASE';

  useEffect(() => {
    setCommercialVersionId(serverAgreementId);
  }, [serverAgreementId]);

  const resolveMutationVersionId = useCallback(async () => {
    if (!buildVersionedEditPayload || !sourceAgreement) {
      return serverAgreementId ?? commercialVersionId;
    }
    const { versionId, draftCreated, draftResponse } = await ensureDraftVersionForCommercial({
      serverAgreementId: serverAgreementId ?? commercialVersionId,
      sourceAgreement,
      versionSourceId,
      buildVersionedEditPayload,
    });
    if (draftCreated && draftResponse) {
      onDraftVersionCreated?.(draftResponse);
    }
    if (versionId) {
      setCommercialVersionId(versionId);
    }
    return versionId ?? serverAgreementId ?? commercialVersionId;
  }, [
    buildVersionedEditPayload,
    commercialVersionId,
    onDraftVersionCreated,
    serverAgreementId,
    sourceAgreement,
    versionSourceId,
  ]);

  const loadSlabs = useCallback(async () => {
    if (!serverAgreementId || commercials.commercialStructure !== 'SLAB') {
      setSlabs([]);
      return;
    }
    setLoadingSlabs(true);
    try {
      const data = await fetchSlabs(serverAgreementId, slabType);
      setSlabs(data);
    } catch (err) {
      enqueueSnackbar(err.response?.data?.message || 'Failed to load slabs', { variant: 'error' });
    } finally {
      setLoadingSlabs(false);
    }
  }, [serverAgreementId, commercials.commercialStructure, slabType, enqueueSnackbar]);

  const loadTargetCount = useCallback(async () => {
    if (!serverAgreementId || commercials.commercialStructure !== 'SLAB') {
      setTargetCount(0);
      return;
    }
    try {
      const data = await fetchCommercialTargetsPreview(serverAgreementId);
      setTargetCount(Array.isArray(data) ? data.length : 0);
    } catch {
      setTargetCount(0);
    }
  }, [serverAgreementId, commercials.commercialStructure]);

  const refreshCommercialData = useCallback(async () => {
    await Promise.all([loadSlabs(), loadTargetCount()]);
    setCommercialRefreshKey((key) => key + 1);
  }, [loadSlabs, loadTargetCount]);

  useEffect(() => {
    loadSlabs();
    loadTargetCount();
  }, [loadSlabs, loadTargetCount]);

  useEffect(() => {
    if (lockOneTimeFrequency && commercials.selectedFrequencies?.[0] !== 'ONE_TIME') {
      onUpdate({ selectedFrequencies: ['ONE_TIME'] });
    }
  }, [lockOneTimeFrequency, commercials.selectedFrequencies, onUpdate]);

  useEffect(() => {
    setEditingSlabId(null);
    setDraftSlab(EMPTY_DRAFT);
  }, [slabType]);

  const updateDraft = (field, value) => {
    setDraftSlab((prev) => ({ ...prev, [field]: value }));
  };

  const resetDraft = () => {
    setDraftSlab(EMPTY_DRAFT);
    setEditingSlabId(null);
  };

  const handleSlabTypeChange = (event) => {
    const newType = event.target.value;
    if (newType === slabType) return;

    if (slabs.length === 0 && targetCount === 0) {
      onUpdate({ slabType: newType });
      return;
    }

    setPendingSlabType(newType);
    typeSwitchModal.open();
  };

  const handleTypeSwitchCancel = () => {
    setPendingSlabType(null);
    typeSwitchModal.close();
  };

  const handleTypeSwitch = async (action) => {
    if (!pendingSlabType) return;

    setSwitchingType(true);
    try {
      const versionId = await resolveMutationVersionId();
      if (!versionId) {
        enqueueSnackbar('Save the agreement draft first before switching slab type', { variant: 'warning' });
        return;
      }
      await switchCommercialType(versionId, {
        action,
        newSlabType: pendingSlabType,
      });
      onUpdate({ slabType: pendingSlabType });
      resetDraft();
      await refreshCommercialData();
      enqueueSnackbar(
        action === 'CONVERT' ? 'Slabs and targets converted' : 'Commercial data cleared',
        { variant: 'success' },
      );
      setPendingSlabType(null);
      typeSwitchModal.close();
    } catch (err) {
      enqueueSnackbar(err.response?.data?.message || 'Failed to switch slab type', { variant: 'error' });
    } finally {
      setSwitchingType(false);
    }
  };

  const validateDraftSlab = () => {
    if (draftSlab.fromValue === '' || draftSlab.toValue === '' || draftSlab.commercialValue === '') {
      enqueueSnackbar('Complete all slab fields before saving', { variant: 'warning' });
      return false;
    }
    if (Number(draftSlab.fromValue) < 0) {
      enqueueSnackbar('From value must be greater than or equal to 0', { variant: 'warning' });
      return false;
    }
    if (Number(draftSlab.toValue) <= Number(draftSlab.fromValue)) {
      enqueueSnackbar('To value must be greater than from value', { variant: 'warning' });
      return false;
    }
    const payload = toSlabPayload(draftSlab, slabType);
    const conflict = validateSlabAgainstExisting(slabs, payload, editingSlabId);
    if (conflict) {
      enqueueSnackbar(conflict, { variant: 'warning' });
      return false;
    }
    return true;
  };

  const handleSaveSlab = async () => {
    if (!validateDraftSlab()) return;

    setSavingSlab(true);
    try {
      const versionId = await resolveMutationVersionId();
      if (!versionId) {
        enqueueSnackbar('Save the agreement draft first before adding slabs', { variant: 'warning' });
        return;
      }
      const payload = toSlabPayload(draftSlab, slabType);
      if (editingSlabId) {
        await updateSlab(versionId, editingSlabId, payload);
        enqueueSnackbar('Slab updated', { variant: 'success' });
      } else {
        await createSlab(versionId, payload);
        enqueueSnackbar('Slab added', { variant: 'success' });
      }
      resetDraft();
      await refreshCommercialData();
    } catch (err) {
      enqueueSnackbar(err.response?.data?.message || 'Failed to save slab', { variant: 'error' });
    } finally {
      setSavingSlab(false);
    }
  };

  const handleEditSlab = (slab) => {
    setEditingSlabId(slab.id);
    setDraftSlab({
      fromValue: String(slab.fromValue),
      toValue: String(slab.toValue),
      valueType: slab.valueType,
      commercialValue: String(slab.commercialValue),
    });
  };

  const handleDeleteSlab = async (slabId) => {
    try {
      const versionId = await resolveMutationVersionId();
      if (!versionId) return;
      await deleteSlab(versionId, slabId);
      if (editingSlabId === slabId) {
        resetDraft();
      }
      enqueueSnackbar('Slab deleted', { variant: 'success' });
      await refreshCommercialData();
    } catch (err) {
      enqueueSnackbar(err.response?.data?.message || 'Failed to delete slab', { variant: 'error' });
    }
  };

  const openUploadModal = async () => {
    if (!slabs.length) {
      enqueueSnackbar('Add at least one slab first', { variant: 'warning' });
      return;
    }
    try {
      const versionId = await resolveMutationVersionId();
      if (!versionId) {
        enqueueSnackbar('Save the agreement draft first', { variant: 'warning' });
        return;
      }
      if (versionId !== serverAgreementId) {
        await refreshCommercialData();
      }
      uploadModal.open();
    } catch (err) {
      enqueueSnackbar(err.response?.data?.message || 'Failed to prepare commercial upload', { variant: 'error' });
    }
  };

  return (
    <Box>
      <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>
        Commercial Structure *
      </Typography>

      <Box sx={{ mb: 2 }}>
        <RadioGroup
          row
          value={commercials.commercialStructure}
          onChange={(e) => onUpdate({ commercialStructure: e.target.value })}
        >
          <FormControlLabel value="FLAT" control={<Radio size="small" />} label="Flat" />
          <FormControlLabel value="SLAB" control={<Radio size="small" />} label="Slab-based" />
        </RadioGroup>
      </Box>

      {commercials.commercialStructure === 'FLAT' && (
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <CommercialValueInput
              label="Commercial Value"
              required
              value={commercials.commercialValue}
              onChangeValue={(v) => onUpdate({ commercialValue: v })}
              type={commercials.valueType || 'FIXED'}
              onChangeType={(t) => onUpdate({ valueType: t })}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label="Calculation Formula (optional)"
              fullWidth
              size="small"
              value={commercials.calculationFormula || ''}
              onChange={(e) => onUpdate({ calculationFormula: e.target.value })}
              placeholder="e.g. (Sales × 2%)"
            />
          </Grid>
        </Grid>
      )}

      {commercials.commercialStructure === 'SLAB' && (
        <Box>
          <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
            Slab Type *
          </Typography>
          <Box sx={{ mb: 2 }}>
            <RadioGroup
              row
              value={slabType}
              onChange={handleSlabTypeChange}
            >
              {SLAB_TYPE_OPTIONS.map((opt) => (
                <FormControlLabel
                  key={opt.value}
                  value={opt.value}
                  control={<Radio size="small" />}
                  label={opt.label}
                />
              ))}
            </RadioGroup>
          </Box>

          <Typography variant="subtitle2" gutterBottom>Saved Slabs</Typography>
          {loadingSlabs ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
              <CircularProgress size={24} />
            </Box>
          ) : slabs.length > 0 ? (
            <TableContainer component={Paper} elevation={0} sx={{ mb: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>Slab Rule</TableCell>
                    <TableCell width={100} />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {slabs.map((slab) => (
                    <TableRow key={slab.id} selected={editingSlabId === slab.id}>
                      <TableCell>{formatSlabLabel(slab)}</TableCell>
                      <TableCell>
                        <IconButton size="small" onClick={() => handleEditSlab(slab)} aria-label="Edit slab">
                          <Edit fontSize="small" />
                        </IconButton>
                        <IconButton size="small" color="error" onClick={() => handleDeleteSlab(slab.id)} aria-label="Delete slab">
                          <Delete fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Alert severity="info" sx={{ mb: 2 }}>Add and save at least one slab rule.</Alert>
          )}

          <Typography variant="subtitle2" gutterBottom>
            {editingSlabId ? 'Edit Slab' : 'Add Slab'}
          </Typography>
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                label="From Value"
                type="number"
                fullWidth
                size="small"
                value={draftSlab.fromValue}
                onChange={(e) => updateDraft('fromValue', e.target.value)}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                label="To Value"
                type="number"
                fullWidth
                size="small"
                value={draftSlab.toValue}
                onChange={(e) => updateDraft('toValue', e.target.value)}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <CommercialValueInput
                label="Commercial Value"
                value={draftSlab.commercialValue}
                onChangeValue={(v) => updateDraft('commercialValue', v)}
                type={draftSlab.valueType}
                onChangeType={(t) => updateDraft('valueType', t)}
              />
            </Grid>
          </Grid>

          <Box sx={{ display: 'flex', gap: 1, mb: 3 }}>
            <Button
              size="small"
              startIcon={savingSlab ? <CircularProgress size={16} /> : <Add />}
              onClick={handleSaveSlab}
              disabled={savingSlab}
            >
              {editingSlabId ? 'Update Slab' : 'Add Slab'}
            </Button>
            {editingSlabId && (
              <Button size="small" variant="outlined" onClick={resetDraft} disabled={savingSlab}>
                Cancel Edit
              </Button>
            )}
          </Box>

          <Button
            variant="contained"
            startIcon={<TableChart />}
            onClick={openUploadModal}
            disabled={!slabs.length}
          >
            Upload / View Commercials
          </Button>

          {!serverAgreementId && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              Save the agreement draft before adding slabs or uploading commercial targets.
            </Alert>
          )}

          <CommercialsUploadModal
            key={commercialRefreshKey}
            open={uploadModal.isOpen}
            onClose={uploadModal.close}
            agreementId={commercialVersionId ?? serverAgreementId}
            slabs={slabs}
            slabType={slabType}
            startDate={startDate}
            expiryDate={expiryDate}
            selectedFrequencies={selectedFrequencies}
            onFrequenciesChange={(value) => onUpdate({ selectedFrequencies: value })}
            onTargetsChanged={loadTargetCount}
            lockOneTimeFrequency={lockOneTimeFrequency}
          />

          <Dialog
            open={typeSwitchModal.isOpen}
            onClose={switchingType ? undefined : handleTypeSwitchCancel}
            maxWidth="sm"
            fullWidth
          >
            <DialogTitle fontWeight={700}>Switch Slab Type?</DialogTitle>
            <DialogContent>
              <DialogContentText>
                You already have slabs added under the current type. Do you want to convert the
                existing slabs to the new type, or clear all existing data and switch?
              </DialogContentText>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2, flexWrap: 'wrap', gap: 1 }}>
              <Button onClick={handleTypeSwitchCancel} disabled={switchingType}>
                Cancel
              </Button>
              <Button
                variant="outlined"
                color="error"
                onClick={() => handleTypeSwitch('CLEAR')}
                disabled={switchingType}
              >
                {switchingType ? <CircularProgress size={18} /> : 'Clear All Data'}
              </Button>
              <Button
                variant="contained"
                onClick={() => handleTypeSwitch('CONVERT')}
                disabled={switchingType}
              >
                {switchingType ? <CircularProgress size={18} color="inherit" /> : 'Convert Existing'}
              </Button>
            </DialogActions>
          </Dialog>
        </Box>
      )}
    </Box>
  );
}
