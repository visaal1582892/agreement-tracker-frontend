import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Box, Typography, Button, Dialog, DialogTitle, DialogContent, DialogActions,
  FormControl, InputLabel, Select, MenuItem, Checkbox, ListItemText, OutlinedInput,
  Chip, CircularProgress, Alert,
} from '@mui/material';
import { Download, Upload } from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import {
  downloadBlob,
  extractApiErrorMessage,
  fetchCommercialTargetsPreview,
  formatSlabLabel,
  generateCommercialTemplate,
  upsertTarget,
  uploadCommercialTargets,
} from '../../../api/commercialApi';

const FREQUENCY_OPTIONS = [
  { value: 'ONE_TIME', label: 'One Time' },
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'QUARTERLY', label: 'Quarterly' },
  { value: 'HALF_YEARLY', label: 'Half-Yearly' },
  { value: 'YEARLY', label: 'Yearly' },
];

const stickyHeaderSx = {
  position: 'sticky',
  top: 0,
  zIndex: 3,
  bgcolor: '#F8FAFC',
  fontWeight: 700,
  borderBottom: '2px solid #E2E8F0',
  whiteSpace: 'nowrap',
};

const stickyPeriodSx = {
  position: 'sticky',
  left: 0,
  zIndex: 2,
  bgcolor: '#fff',
  fontWeight: 600,
  borderRight: '2px solid #E2E8F0',
  whiteSpace: 'nowrap',
};

const stickyCornerSx = {
  ...stickyHeaderSx,
  left: 0,
  zIndex: 4,
};

function formatTargetValue(value) {
  if (value == null || value === '') return '—';
  return Number(value).toLocaleString('en-IN');
}

export default function CommercialsUploadModal({
  open = true,
  onClose,
  agreementId,
  slabs,
  slabType = 'PURCHASE',
  startDate,
  expiryDate,
  selectedFrequencies,
  onFrequenciesChange,
  onTargetsChanged,
  readOnly = false,
  embedded = false,
  lockOneTimeFrequency = false,
}) {
  const { enqueueSnackbar } = useSnackbar();
  const [previewRows, setPreviewRows] = useState([]);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editingCell, setEditingCell] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [savedFlash, setSavedFlash] = useState(null);
  const inputRef = useRef(null);

  const isActive = embedded || open;

  const loadPreview = useCallback(async () => {
    if (!agreementId || !isActive) return;
    setLoadingPreview(true);
    try {
      const data = await fetchCommercialTargetsPreview(agreementId);
      setPreviewRows(data);
      onTargetsChanged?.();
    } catch (err) {
      enqueueSnackbar(err.response?.data?.message || 'Failed to load commercial targets', { variant: 'error' });
    } finally {
      setLoadingPreview(false);
    }
  }, [agreementId, isActive, enqueueSnackbar, onTargetsChanged]);

  useEffect(() => {
    if (isActive) {
      loadPreview();
    } else {
      setEditingCell(null);
      setEditValue('');
      setSavedFlash(null);
    }
  }, [isActive, loadPreview]);

  useEffect(() => {
    if (editingCell && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingCell]);

  const ensureReadyForDownload = () => {
    if (!agreementId) return false;
    if (!startDate || !expiryDate) {
      enqueueSnackbar('Agreement start and expiry dates are required', { variant: 'warning' });
      return false;
    }
    if (!slabs?.length) {
      enqueueSnackbar('Add at least one slab first', { variant: 'warning' });
      return false;
    }
    if (!selectedFrequencies?.length) {
      enqueueSnackbar('Select at least one target frequency', { variant: 'warning' });
      return false;
    }
    return true;
  };

  const handleDownloadTemplate = async () => {
    if (!ensureReadyForDownload()) return;
    setDownloading(true);
    try {
      const blob = await generateCommercialTemplate(agreementId, { selectedFrequencies, slabType });
      downloadBlob(blob, `commercial-template-${agreementId}.xlsx`);
      enqueueSnackbar('Commercial template downloaded', { variant: 'success' });
    } catch (err) {
      enqueueSnackbar(
        await extractApiErrorMessage(err, 'Failed to generate commercial template'),
        { variant: 'error' },
      );
    } finally {
      setDownloading(false);
    }
  };

  const handleUpload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !agreementId) return;

    setUploading(true);
    try {
      const result = await uploadCommercialTargets(agreementId, file, slabType);
      enqueueSnackbar(`Uploaded ${result.savedCount} target value(s)`, { variant: 'success' });
      await loadPreview();
    } catch (err) {
      enqueueSnackbar(
        await extractApiErrorMessage(err, 'Failed to upload commercial matrix'),
        { variant: 'error' },
      );
    } finally {
      setUploading(false);
    }
  };

  const startEdit = (timePeriodId, slabId, currentValue) => {
    if (readOnly) return;
    setEditingCell({ timePeriodId, slabId });
    setEditValue(currentValue != null ? String(currentValue) : '');
  };

  const flashCell = (timePeriodId, slabId) => {
    setSavedFlash({ timePeriodId, slabId });
    window.setTimeout(() => setSavedFlash(null), 900);
  };

  const commitEdit = async () => {
    if (!editingCell || !agreementId) return;

    const { timePeriodId, slabId } = editingCell;
    const trimmed = editValue.trim();
    const payload = {
      timePeriodId,
      slabId,
      targetValue: trimmed === '' ? null : Number(trimmed),
    };

    if (payload.targetValue != null && Number.isNaN(payload.targetValue)) {
      enqueueSnackbar('Enter a valid number', { variant: 'warning' });
      return;
    }

    try {
      await upsertTarget(agreementId, payload);
      flashCell(timePeriodId, slabId);
      setEditingCell(null);
      setEditValue('');
      await loadPreview();
    } catch (err) {
      enqueueSnackbar(err.response?.data?.message || 'Failed to save target', { variant: 'error' });
    }
  };

  const handleEditKeyDown = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      commitEdit();
    } else if (event.key === 'Escape') {
      setEditingCell(null);
      setEditValue('');
    }
  };

  const getCellValue = (row, slabId) => row.targets?.[slabId] ?? row.targets?.[String(slabId)];

  const body = (
    <>
        {!readOnly && (
        <Box sx={{ p: 2.5, borderBottom: '1px solid #E2E8F0', bgcolor: '#FAFBFC' }}>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
            {lockOneTimeFrequency ? (
              <Alert severity="info" sx={{ flex: 1 }}>
                Payout frequency locked to <strong>One Time</strong> for QPS target incentives.
              </Alert>
            ) : (
            <FormControl size="small" sx={{ minWidth: 260 }}>
              <InputLabel>Target Frequency</InputLabel>
              <Select
                multiple
                value={selectedFrequencies || []}
                onChange={(e) => onFrequenciesChange?.(e.target.value)}
                input={<OutlinedInput label="Target Frequency" />}
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {selected.map((value) => (
                      <Chip
                        key={value}
                        size="small"
                        label={FREQUENCY_OPTIONS.find((opt) => opt.value === value)?.label || value}
                      />
                    ))}
                  </Box>
                )}
              >
                {FREQUENCY_OPTIONS.filter((option) => option.value !== 'ONE_TIME').map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    <Checkbox checked={(selectedFrequencies || []).includes(option.value)} />
                    <ListItemText primary={option.label} />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            )}

            <Button
              variant="contained"
              startIcon={downloading ? <CircularProgress size={16} color="inherit" /> : <Download />}
              onClick={handleDownloadTemplate}
              disabled={downloading || !slabs?.length}
            >
              Download Template
            </Button>

            <Button
              variant="outlined"
              startIcon={uploading ? <CircularProgress size={16} /> : <Upload />}
              component="label"
              disabled={uploading || !slabs?.length}
            >
              Upload Excel
              <input type="file" hidden accept=".xlsx,.xls" onChange={handleUpload} />
            </Button>
          </Box>
        </Box>
        )}

        <Box sx={{ p: embedded ? 0 : 2.5, minHeight: embedded ? 200 : 320, maxHeight: embedded ? 'none' : '60vh', overflow: 'auto' }}>
          {loadingPreview ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
              <CircularProgress />
            </Box>
          ) : previewRows.length === 0 ? (
            <Box sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 260,
              border: '2px dashed #CBD5E1',
              borderRadius: 2,
              bgcolor: '#F8FAFC',
              px: 3,
            }}>
              <Typography color="text.secondary" textAlign="center">
                No targets uploaded yet. Select your frequencies and download the template to begin.
              </Typography>
            </Box>
          ) : (
            <Box sx={{ overflow: 'auto', border: '1px solid #E2E8F0', borderRadius: 2 }}>
              <Box component="table" sx={{ borderCollapse: 'separate', borderSpacing: 0, minWidth: '100%' }}>
                <Box component="thead">
                  <Box component="tr">
                    <Box component="th" sx={{ ...stickyCornerSx, px: 2, py: 1.5, textAlign: 'left' }}>
                      Time Period
                    </Box>
                    {slabs.map((slab) => (
                      <Box
                        component="th"
                        key={slab.id}
                        sx={{ ...stickyHeaderSx, px: 2, py: 1.5, textAlign: 'right', minWidth: 140 }}
                      >
                        {formatSlabLabel(slab)}
                      </Box>
                    ))}
                  </Box>
                </Box>
                <Box component="tbody">
                  {previewRows.map((row) => (
                    <Box component="tr" key={row.timePeriodId}>
                      <Box component="td" sx={{ ...stickyPeriodSx, px: 2, py: 1.25 }}>
                        {row.name}
                      </Box>
                      {slabs.map((slab) => {
                        const isEditing = editingCell?.timePeriodId === row.timePeriodId
                          && editingCell?.slabId === slab.id;
                        const isFlashing = savedFlash?.timePeriodId === row.timePeriodId
                          && savedFlash?.slabId === slab.id;
                        const value = getCellValue(row, slab.id);

                        return (
                          <Box
                            component="td"
                            key={slab.id}
                            onDoubleClick={() => startEdit(row.timePeriodId, slab.id, value)}
                            sx={{
                              px: 1.5,
                              py: 0.75,
                              textAlign: 'right',
                              borderBottom: '1px solid #F1F5F9',
                              cursor: readOnly ? 'default' : 'cell',
                              transition: 'box-shadow 0.25s ease',
                              boxShadow: isFlashing ? 'inset 0 0 0 2px #22C55E' : 'none',
                              bgcolor: isFlashing ? 'rgba(34, 197, 94, 0.08)' : 'transparent',
                            }}
                          >
                            {isEditing ? (
                              <input
                                ref={inputRef}
                                type="number"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onBlur={commitEdit}
                                onKeyDown={handleEditKeyDown}
                                style={{
                                  width: '100%',
                                  padding: '6px 8px',
                                  border: '1px solid #94A3B8',
                                  borderRadius: 6,
                                  fontSize: '0.875rem',
                                  textAlign: 'right',
                                }}
                              />
                            ) : (
                              <Typography variant="body2" component="span">
                                {formatTargetValue(value)}
                              </Typography>
                            )}
                          </Box>
                        );
                      })}
                    </Box>
                  ))}
                </Box>
              </Box>
            </Box>
          )}

          {previewRows.length > 0 && !readOnly && (
            <Alert severity="info" sx={{ mt: 2 }}>
              Double-click any cell to edit. Changes save automatically on Enter or when you click away.
            </Alert>
          )}
        </Box>
    </>
  );

  if (embedded) {
    return body;
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xl" fullWidth>
      <DialogTitle fontWeight={700}>Upload / View Commercials</DialogTitle>
      <DialogContent dividers sx={{ p: 0 }}>
        {body}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} variant="outlined">Close</Button>
      </DialogActions>
    </Dialog>
  );
}
