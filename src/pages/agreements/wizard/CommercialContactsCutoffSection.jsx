import { useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  FormControl,
  InputBase,
  InputLabel,
  MenuItem,
  OutlinedInput,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import { Download, UploadFile } from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import { alpha } from '@mui/material/styles';
import CollapsibleSection from '../../../components/wizard/CollapsibleSection';
import WizardFieldAnchor from '../../../components/wizard/WizardFieldAnchor';
import { BRAND } from '../../../config/theme';
import {
  commitContactsCutoffs,
  downloadBlob,
  downloadContactsCutoffTemplate,
  extractApiErrorMessage,
  uploadContactsCutoffs,
} from '../../../api/commercialApi';
import { PAYOUT_FREQUENCY_OPTIONS } from '../../../constants/commercialStructure';

function updateStagedCutoff(stagedMatrix, rowIndex, slabId, field, rawValue) {
  const nextRows = stagedMatrix.matrixRows.map((row, index) => {
    if (index !== rowIndex) return row;
    const slabKey = String(slabId);
    const existing = row.tierCutoffs?.[slabKey] ?? { slabId, lowerCutoff: null, upperCutoff: null };
    const parsed = rawValue === '' ? null : Number(rawValue);
    return {
      ...row,
      tierCutoffs: {
        ...row.tierCutoffs,
        [slabKey]: {
          ...existing,
          slabId,
          [field]: Number.isFinite(parsed) ? parsed : null,
        },
      },
    };
  });
  return { ...stagedMatrix, matrixRows: nextRows };
}

export default function CommercialContactsCutoffSection({
  agreementVersionId,
  slabs = [],
  selectedFrequencies = [],
  onFrequenciesChange,
  tierBuilder = null,
  fieldError = null,
}) {
  const { enqueueSnackbar } = useSnackbar();
  const fileInputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [stagedMatrix, setStagedMatrix] = useState(null);

  const canDownloadTemplate = selectedFrequencies.length > 0 && slabs.length > 0;

  const downloadTooltip = useMemo(() => {
    if (slabs.length === 0) return 'Add at least one target tier in Stage 1 first';
    if (selectedFrequencies.length === 0) return 'Select temporal payout frequencies first';
    return '';
  }, [slabs.length, selectedFrequencies.length]);

  const handleDownloadTemplate = async () => {
    if (!agreementVersionId) return;
    setDownloading(true);
    try {
      const blob = await downloadContactsCutoffTemplate(agreementVersionId);
      downloadBlob(blob, 'commercial-contacts-cutoff-template.xlsx');
    } catch (err) {
      enqueueSnackbar(await extractApiErrorMessage(err, 'Failed to download cutoff template'), { variant: 'error' });
    } finally {
      setDownloading(false);
    }
  };

  const handleUpload = async (file) => {
    if (!file || !agreementVersionId) return;
    setUploading(true);
    try {
      const data = await uploadContactsCutoffs(agreementVersionId, file);
      setStagedMatrix(data);
      enqueueSnackbar('Cutoff matrix staged for review', { variant: 'success' });
    } catch (err) {
      enqueueSnackbar(await extractApiErrorMessage(err, 'Cutoff upload failed'), { variant: 'error' });
    } finally {
      setUploading(false);
    }
  };

  const handleCommit = async () => {
    if (!agreementVersionId || !stagedMatrix) return;
    setCommitting(true);
    try {
      await commitContactsCutoffs(agreementVersionId, stagedMatrix);
      enqueueSnackbar('Temporal relaxations saved', { variant: 'success' });
    } catch (err) {
      enqueueSnackbar(await extractApiErrorMessage(err, 'Failed to save relaxations'), { variant: 'error' });
    } finally {
      setCommitting(false);
    }
  };

  const handleCutoffChange = (rowIndex, slabId, field, value) => {
    setStagedMatrix((prev) => updateStagedCutoff(prev, rowIndex, slabId, field, value));
  };

  const slabHeaders = stagedMatrix?.slabHeaders ?? [];

  return (
    <Box>
      <CollapsibleSection
        title="1. Define Target Tiers"
        description="Define tiers by target value, payout, frequency, and unit."
        forceExpand={Boolean(fieldError)}
        hasError={Boolean(fieldError)}
      >
        <WizardFieldAnchor field="slabs" error={fieldError}>
          {tierBuilder}
        </WizardFieldAnchor>
      </CollapsibleSection>

      <CollapsibleSection
        title="2. Temporal Relaxations (Excel Entry)"
        description="Download pivoted cutoff matrix, upload configured values, review, then commit."
        defaultExpanded
      >
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'flex-start', mb: 2 }}>
          <FormControl size="small" sx={{ minWidth: 280 }}>
            <InputLabel>Temporal Frequencies</InputLabel>
            <Select
              multiple
              value={selectedFrequencies}
              onChange={(e) => onFrequenciesChange?.(e.target.value)}
              input={<OutlinedInput label="Temporal Frequencies" />}
              renderValue={(selected) => selected.map(
                (value) => PAYOUT_FREQUENCY_OPTIONS.find((option) => option.value === value)?.label || value,
              ).join(', ')}
            >
              {PAYOUT_FREQUENCY_OPTIONS.map((option) => (
                <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <Tooltip title={downloadTooltip}>
            <span>
              <Button
                variant="outlined"
                size="small"
                startIcon={downloading ? <CircularProgress size={16} /> : <Download />}
                disabled={!canDownloadTemplate || downloading || !agreementVersionId}
                onClick={handleDownloadTemplate}
              >
                Download Cutoff Template (.xlsx)
              </Button>
            </span>
          </Tooltip>
        </Box>

        {!stagedMatrix && (
          <Box
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              handleUpload(e.dataTransfer.files[0]);
            }}
            onClick={() => fileInputRef.current?.click()}
            sx={{
              border: `2px dashed ${BRAND.borderLight}`,
              borderRadius: '10px',
              bgcolor: dragOver ? alpha(BRAND.red, 0.04) : BRAND.bgGray,
              p: 2.5,
              textAlign: 'center',
              cursor: agreementVersionId ? 'pointer' : 'not-allowed',
              opacity: agreementVersionId ? 1 : 0.6,
              mb: 2,
            }}
          >
            {uploading ? (
              <CircularProgress size={28} sx={{ mb: 1 }} />
            ) : (
              <UploadFile sx={{ fontSize: 36, color: BRAND.textSecondary, mb: 0.5 }} />
            )}
            <Typography variant="body2" color="text.secondary">
              Upload Configured Cutoffs (.xlsx)
            </Typography>
            <input
              ref={fileInputRef}
              type="file"
              hidden
              accept=".xlsx,.xls"
              onChange={(e) => {
                handleUpload(e.target.files[0]);
                e.target.value = '';
              }}
            />
          </Box>
        )}

        {stagedMatrix && (
          <>
            <TableContainer
              component={Paper}
              variant="outlined"
              sx={{ borderRadius: 2, overflow: 'auto', maxHeight: 420, mb: 2 }}
            >
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell
                      rowSpan={2}
                      sx={{ fontWeight: 700, bgcolor: 'background.paper', verticalAlign: 'bottom' }}
                    >
                      Time Period
                    </TableCell>
                    {slabHeaders.map((header) => (
                      <TableCell
                        key={header.slabId}
                        align="center"
                        colSpan={2}
                        sx={{ fontWeight: 700, bgcolor: 'background.paper', whiteSpace: 'nowrap' }}
                      >
                        {header.displayTitle}
                      </TableCell>
                    ))}
                  </TableRow>
                  <TableRow>
                    {slabHeaders.flatMap((header) => ([
                      <TableCell
                        key={`${header.slabId}-lower-head`}
                        align="center"
                        sx={{ fontWeight: 600, bgcolor: 'background.paper', fontSize: 12 }}
                      >
                        Lower Cutoff %
                      </TableCell>,
                      <TableCell
                        key={`${header.slabId}-upper-head`}
                        align="center"
                        sx={{ fontWeight: 600, bgcolor: 'background.paper', fontSize: 12 }}
                      >
                        Upper Cutoff %
                      </TableCell>,
                    ]))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(stagedMatrix.matrixRows ?? []).map((row, rowIndex) => (
                    <TableRow key={`${row.timePeriodId ?? row.timePeriodName}-${rowIndex}`}>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.timePeriodName}</TableCell>
                      {slabHeaders.flatMap((header) => {
                        const tier = row.tierCutoffs?.[String(header.slabId)] ?? {};
                        return [
                          <TableCell key={`${rowIndex}-${header.slabId}-lower`} sx={{ p: 0.5 }}>
                            <InputBase
                              type="number"
                              value={tier.lowerCutoff ?? ''}
                              onChange={(e) => handleCutoffChange(
                                rowIndex,
                                header.slabId,
                                'lowerCutoff',
                                e.target.value,
                              )}
                              inputProps={{ min: 0, max: 100, step: 0.01 }}
                              sx={{ fontSize: '0.875rem', px: 1, width: '100%' }}
                            />
                          </TableCell>,
                          <TableCell key={`${rowIndex}-${header.slabId}-upper`} sx={{ p: 0.5 }}>
                            <InputBase
                              type="number"
                              value={tier.upperCutoff ?? ''}
                              onChange={(e) => handleCutoffChange(
                                rowIndex,
                                header.slabId,
                                'upperCutoff',
                                e.target.value,
                              )}
                              inputProps={{ min: 100, step: 0.01 }}
                              sx={{ fontSize: '0.875rem', px: 1, width: '100%' }}
                            />
                          </TableCell>,
                        ];
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            <Paper
              variant="outlined"
              sx={{
                p: 2,
                bgcolor: 'grey.50',
                borderRadius: 2,
                display: 'flex',
                flexWrap: 'wrap',
                gap: 1.5,
              }}
            >
              <Button
                variant="outlined"
                size="small"
                onClick={() => setStagedMatrix(null)}
              >
                Re-upload Excel
              </Button>
              <Button
                variant="contained"
                size="small"
                disabled={committing || !agreementVersionId}
                startIcon={committing ? <CircularProgress size={16} color="inherit" /> : null}
                onClick={handleCommit}
              >
                Commit &amp; Save Relaxations
              </Button>
            </Paper>
          </>
        )}
      </CollapsibleSection>
    </Box>
  );
}
