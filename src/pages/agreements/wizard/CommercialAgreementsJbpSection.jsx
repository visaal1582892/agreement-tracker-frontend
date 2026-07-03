import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControl,
  FormControlLabel,
  FormLabel,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Radio,
  RadioGroup,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import { Add, Delete, Download, UploadFile } from '@mui/icons-material';
import { alpha } from '@mui/material/styles';
import { useSnackbar } from 'notistack';
import { BRAND } from '../../../config/theme';
import WizardSectionTitle from '../../../components/wizard/WizardSectionTitle';
import CommercialValueInput from '../../../components/forms/CommercialValueInput';
import {
  PAYOUT_FREQUENCY,
  STRUCTURE_TYPE,
  resolveStructureType,
  structureTypeToRadioValue,
  resolveFlatBaselineFrequency,
} from '../../../constants/commercialStructure';
import { purgeAllCommercialStructureData } from '../../../api/commercialApi';
import {
  commitJbpStructure,
  downloadBlob,
  downloadJbpTemplate,
  extractApiErrorMessage,
  fetchJbpStructure,
  fetchJbpTimePeriods,
  isJbpValidationErrorBlob,
  uploadJbpWorkbook,
} from '../../../api/jbpApi';
import {
  FINANCIAL_YEAR_START_MONTH_OPTIONS,
  JBP_FREQUENCY_OPTIONS,
  createJbpConfig,
  mapConfigurationsFromApi,
  resolveFinancialYearStartMonth,
  resolveMasterFrequency,
} from '../../../utils/jbpMatrixUtils';
import JbpMatrixReviewTable from './JbpMatrixReviewTable';

export default function CommercialAgreementsJbpSection({
  agreementVersionId,
  commercials = {},
  onUpdateCommercials,
  fieldError = null,
  fieldErrors = {},
  onJbpCommitted,
  onCommercialsAdvance,
  initialJbpCommitted = false,
}) {
  const { enqueueSnackbar } = useSnackbar();
  const fileInputRef = useRef(null);
  const hydratedRef = useRef(false);
  const structureType = resolveStructureType(commercials.commercialStructure);
  const isFlat = structureType === STRUCTURE_TYPE.FLAT;
  const isSlabs = structureType === STRUCTURE_TYPE.SLABS;
  const financialYearStartMonth = resolveFinancialYearStartMonth(commercials);
  const [selectedFrequencies, setSelectedFrequencies] = useState([]);
  const [configurations, setConfigurations] = useState(() => [createJbpConfig(1)]);
  const [parentPeriodOptions, setParentPeriodOptions] = useState([]);
  const [loadingPeriods, setLoadingPeriods] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [stagedWorkbook, setStagedWorkbook] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [hydratingStructure, setHydratingStructure] = useState(false);
  const [purgingStructure, setPurgingStructure] = useState(false);
  const [pendingFinancialYearStartMonth, setPendingFinancialYearStartMonth] = useState(null);
  const hydrationAttemptedRef = useRef(false);

  const masterFrequency = useMemo(
    () => resolveMasterFrequency(selectedFrequencies),
    [selectedFrequencies],
  );

  const hasJbpMatrixState = useMemo(() => (
    Boolean(stagedWorkbook?.sheets?.length)
    || initialJbpCommitted
    || commercials.jbpCommitted
    || configurations.some((config) => config.parentPeriodIds.length > 0)
  ), [stagedWorkbook, initialJbpCommitted, commercials.jbpCommitted, configurations]);

  const isParentPeriodClaimedElsewhere = useCallback((configId, periodId) => (
    configurations.some(
      (other) => other.id !== configId && other.parentPeriodIds.includes(periodId),
    )
  ), [configurations]);

  const clearJbpConfigurationState = useCallback(() => {
    setSelectedFrequencies([]);
    setConfigurations([createJbpConfig(1)]);
    setStagedWorkbook(null);
    setParentPeriodOptions([]);
  }, []);

  const resetJbpLocalState = useCallback(() => {
    clearJbpConfigurationState();
    onJbpCommitted?.(false);
    onUpdateCommercials?.({ jbpCommitted: false });
  }, [clearJbpConfigurationState, onJbpCommitted, onUpdateCommercials]);

  const purgeJbpStructure = useCallback(async () => {
    if (!agreementVersionId) return;
    setPurgingStructure(true);
    try {
      await purgeAllCommercialStructureData(agreementVersionId);
      resetJbpLocalState();
      enqueueSnackbar('JBP structure reset for new financial year baseline', { variant: 'info' });
    } catch (err) {
      enqueueSnackbar(await extractApiErrorMessage(err, 'Failed to reset JBP structure'), { variant: 'error' });
      throw err;
    } finally {
      setPurgingStructure(false);
    }
  }, [agreementVersionId, enqueueSnackbar, resetJbpLocalState]);

  useEffect(() => {
    if (!isFlat || commercials.flatBaselineFrequency) return;
    onUpdateCommercials?.({ flatBaselineFrequency: PAYOUT_FREQUENCY.MONTHLY });
  }, [isFlat, commercials.flatBaselineFrequency, onUpdateCommercials]);

  const loadParentPeriods = useCallback(async () => {
    if (!agreementVersionId || !masterFrequency) {
      setParentPeriodOptions([]);
      return;
    }
    setLoadingPeriods(true);
    try {
      const data = await fetchJbpTimePeriods(
        agreementVersionId,
        masterFrequency,
        financialYearStartMonth,
      );
      setParentPeriodOptions(Array.isArray(data) ? data : []);
    } catch (err) {
      enqueueSnackbar(await extractApiErrorMessage(err, 'Failed to load time periods'), { variant: 'error' });
      setParentPeriodOptions([]);
    } finally {
      setLoadingPeriods(false);
    }
  }, [agreementVersionId, masterFrequency, financialYearStartMonth, enqueueSnackbar]);

  useEffect(() => {
    loadParentPeriods();
  }, [loadParentPeriods, financialYearStartMonth]);

  useEffect(() => {
    if (!isSlabs || !agreementVersionId) return undefined;
    hydrationAttemptedRef.current = false;
  }, [agreementVersionId, isSlabs]);

  useEffect(() => {
    if (!isSlabs || !agreementVersionId || hydrationAttemptedRef.current) return undefined;

    let cancelled = false;
    const hydrate = async () => {
      hydrationAttemptedRef.current = true;
      setHydratingStructure(true);
      try {
        const data = await fetchJbpStructure(agreementVersionId);
        if (cancelled || !data) return;

        if (data.frequencies?.length) {
          setSelectedFrequencies(data.frequencies);
        }
        const mappedConfigs = mapConfigurationsFromApi(data.configurations);
        if (mappedConfigs?.length) {
          setConfigurations(mappedConfigs);
        }
        if (data.stagedWorkbook?.sheets?.length) {
          setStagedWorkbook(data.stagedWorkbook);
          onJbpCommitted?.(true);
        }
      } catch (err) {
        if (!cancelled && err?.response?.status !== 404) {
          enqueueSnackbar(
            await extractApiErrorMessage(err, 'Failed to load saved JBP structure'),
            { variant: 'error' },
          );
        }
      } finally {
        if (!cancelled) setHydratingStructure(false);
      }
    };

    hydrate();
    return () => { cancelled = true; };
  }, [agreementVersionId, isSlabs, enqueueSnackbar, onJbpCommitted]);

  useEffect(() => {
    if (hydratedRef.current || !initialJbpCommitted) return;
    onJbpCommitted?.(true);
    hydratedRef.current = true;
  }, [initialJbpCommitted, onJbpCommitted]);

  const handleConfigChange = (configId, patch) => {
    setConfigurations((prev) => prev.map((config) => (
      config.id === configId ? { ...config, ...patch } : config
    )));
    setStagedWorkbook(null);
  };

  const handleAddConfiguration = () => {
    setConfigurations((prev) => [...prev, createJbpConfig(prev.length + 1)]);
    setStagedWorkbook(null);
  };

  const handleRemoveConfiguration = (configId) => {
    setConfigurations((prev) => (prev.length === 1 ? prev : prev.filter((config) => config.id !== configId)));
    setStagedWorkbook(null);
  };

  const applyFinancialYearStartMonth = async (nextMonth) => {
    onUpdateCommercials?.({ financialYearStartMonth: nextMonth });
    if (hasJbpMatrixState) {
      await purgeJbpStructure();
      return;
    }
    clearJbpConfigurationState();
  };

  const handleFinancialYearStartMonthChange = (event) => {
    const nextMonth = Number(event.target.value);
    if (nextMonth === financialYearStartMonth) return;

    if (hasJbpMatrixState) {
      setPendingFinancialYearStartMonth(nextMonth);
      return;
    }

    onUpdateCommercials?.({ financialYearStartMonth: nextMonth });
    clearJbpConfigurationState();
  };

  const handleConfirmFinancialYearChange = async () => {
    if (pendingFinancialYearStartMonth == null) return;
    try {
      await applyFinancialYearStartMonth(pendingFinancialYearStartMonth);
    } finally {
      setPendingFinancialYearStartMonth(null);
    }
  };

  const buildTemplatePayload = () => ({
    selectedFrequencies,
    financialYearStartMonth,
    configurations: configurations.map((config) => ({
      configId: config.id,
      parentPeriodIds: config.parentPeriodIds,
      slabCount: Number(config.slabCount),
    })),
  });

  const handleDownloadTemplate = async () => {
    if (!agreementVersionId) {
      enqueueSnackbar('Save contract details before downloading template', { variant: 'warning' });
      return;
    }
    if (!selectedFrequencies.length) {
      enqueueSnackbar('Select at least one target interval', { variant: 'warning' });
      return;
    }
    if (configurations.some((config) => !config.parentPeriodIds.length || !config.slabCount)) {
      enqueueSnackbar('Complete all configuration blocks before downloading', { variant: 'warning' });
      return;
    }
    setDownloading(true);
    try {
      const blob = await downloadJbpTemplate(
        agreementVersionId,
        buildTemplatePayload(),
        financialYearStartMonth,
      );
      downloadBlob(blob, `jbp-workbook-${agreementVersionId}.xlsx`);
    } catch (err) {
      enqueueSnackbar(await extractApiErrorMessage(err, 'Failed to download JBP workbook'), { variant: 'error' });
    } finally {
      setDownloading(false);
    }
  };

  const handleUpload = async (file) => {
    if (!file || !agreementVersionId) return;
    setUploading(true);
    try {
      const data = await uploadJbpWorkbook(agreementVersionId, file);
      setStagedWorkbook(data);
      enqueueSnackbar('Workbook parsed successfully', { variant: 'success' });
    } catch (err) {
      if (err?.isJbpValidationError || isJbpValidationErrorBlob(err)) {
        enqueueSnackbar(
          'Validation failed. An Excel file with your exact errors has been downloaded.',
          { variant: 'error' },
        );
      } else {
        enqueueSnackbar(await extractApiErrorMessage(err, 'JBP upload failed'), { variant: 'error' });
      }
    } finally {
      setUploading(false);
    }
  };

  const handleStructureTypeChange = (event) => {
    const nextType = event.target.value === 'SLABS' ? STRUCTURE_TYPE.SLABS : STRUCTURE_TYPE.FLAT;
    if (nextType === STRUCTURE_TYPE.FLAT) {
      onUpdateCommercials?.({
        commercialStructure: 'FLAT',
        enableFlatBaseline: true,
        enableSlabIncentives: false,
        flatBaselineFrequency: PAYOUT_FREQUENCY.MONTHLY,
        jbpCommitted: false,
      });
      return;
    }
    onUpdateCommercials?.({
      commercialStructure: 'SLAB',
      enableFlatBaseline: false,
      enableSlabIncentives: true,
      commercialValue: '',
      flatBaselineFrequency: null,
      jbpCommitted: false,
    });
    setStagedWorkbook(null);
  };

  const handleConfirmAndAdvance = async () => {
    if (!stagedWorkbook || !agreementVersionId) return;
    setCommitting(true);
    try {
      await commitJbpStructure(agreementVersionId, stagedWorkbook);
      onJbpCommitted?.(true);
      enqueueSnackbar('JBP structure committed', { variant: 'success' });
      if (onCommercialsAdvance) {
        await onCommercialsAdvance({
          commercialsOverride: {
            commercialStructure: 'SLAB',
            enableFlatBaseline: false,
            enableSlabIncentives: true,
            commercialValue: null,
            flatBaselineFrequency: null,
            flatValueType: null,
            jbpCommitted: true,
            financialYearStartMonth,
          },
        });
      }
    } catch (err) {
      enqueueSnackbar(await extractApiErrorMessage(err, 'Failed to commit JBP structure'), { variant: 'error' });
    } finally {
      setCommitting(false);
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      <WizardSectionTitle
        title="Commercial Agreements"
        info="Choose flat baseline payout or slab-based JBP matrix incentives."
        mb={0}
      />

      <FormControl component="fieldset" sx={{ mb: 1 }}>
        <FormLabel component="legend" sx={{ fontSize: 13, fontWeight: 700 }}>
          Commercial Structure Type
        </FormLabel>
        <RadioGroup
          row
          value={structureTypeToRadioValue(structureType)}
          onChange={handleStructureTypeChange}
        >
          <FormControlLabel
            value="FLAT"
            control={<Radio size="small" />}
            label="Flat Baseline Payout"
          />
          <FormControlLabel
            value="SLABS"
            control={<Radio size="small" />}
            label="Slab-Based Complex Incentive (JBP)"
          />
        </RadioGroup>
      </FormControl>

      {fieldError && (
        <Alert severity="error">{fieldError}</Alert>
      )}

      {isFlat && (
        <Paper variant="outlined" sx={{ p: 3 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2 }}>
            Flat Baseline Payout
          </Typography>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <CommercialValueInput
                label="Flat Payout"
                required
                value={commercials.commercialValue}
                onChangeValue={(value) => onUpdateCommercials?.({ commercialValue: value })}
                type={commercials.valueType || commercials.flatValueType || 'FIXED'}
                onChangeType={(type) => onUpdateCommercials?.({
                  valueType: type,
                  flatValueType: type,
                })}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth size="small" required error={Boolean(fieldErrors.flatBaselineFrequency)}>
                <InputLabel>Payout Frequency</InputLabel>
                <Select
                  value={resolveFlatBaselineFrequency(commercials)}
                  label="Payout Frequency"
                  onChange={(e) => onUpdateCommercials?.({ flatBaselineFrequency: e.target.value })}
                >
                  {JBP_FREQUENCY_OPTIONS.map((option) => (
                    <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </Paper>
      )}

      {isSlabs && hydratingStructure && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1 }}>
          <CircularProgress size={18} />
          <Typography variant="body2" color="text.secondary">Loading saved JBP structure…</Typography>
        </Box>
      )}

      {isSlabs && (
        <>
      <WizardSectionTitle
        title="Joint Business Plan (JBP)"
        info="Build independent configuration groups, download the custom workbook, upload completed targets, review, then commit."
        mb={0}
      />

      <Paper variant="outlined" sx={{ p: 3 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2 }}>
          Stage 1 — Configuration Groups
        </Typography>

        <FormControl fullWidth size="small" sx={{ mb: 2, maxWidth: 360 }}>
          <InputLabel>Financial Year Start Month</InputLabel>
          <Select
            value={financialYearStartMonth}
            label="Financial Year Start Month"
            disabled={purgingStructure}
            onChange={handleFinancialYearStartMonthChange}
          >
            {FINANCIAL_YEAR_START_MONTH_OPTIONS.map((option) => (
              <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
            ))}
          </Select>
        </FormControl>

        <Autocomplete
          multiple
          options={JBP_FREQUENCY_OPTIONS}
          getOptionLabel={(option) => option.label}
          value={JBP_FREQUENCY_OPTIONS.filter((option) => selectedFrequencies.includes(option.value))}
          onChange={(_, value) => {
            setSelectedFrequencies(value.map((item) => item.value));
            setStagedWorkbook(null);
          }}
          renderInput={(params) => (
            <TextField {...params} label="Target Intervals" size="small" placeholder="Select intervals" />
          )}
          sx={{ mb: 2 }}
        />

        {configurations.map((config, index) => (
          <Paper key={config.id} variant="outlined" sx={{ p: 2, mb: 2, bgcolor: alpha(BRAND.bgGray, 0.35) }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                Configuration {index + 1}
              </Typography>
              {configurations.length > 1 && (
                <IconButton size="small" color="error" onClick={() => handleRemoveConfiguration(config.id)}>
                  <Delete fontSize="small" />
                </IconButton>
              )}
            </Box>

            <Autocomplete
              multiple
              options={parentPeriodOptions}
              getOptionLabel={(option) => option.name}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              getOptionDisabled={(option) => isParentPeriodClaimedElsewhere(config.id, option.id)}
              loading={loadingPeriods}
              disabled={!masterFrequency}
              value={parentPeriodOptions.filter((option) => config.parentPeriodIds.includes(option.id))}
              onChange={(_, value) => handleConfigChange(config.id, { parentPeriodIds: value.map((item) => item.id) })}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label={masterFrequency ? `Parent Periods (${masterFrequency.replace('_', ' ')})` : 'Parent Periods'}
                  size="small"
                  placeholder="Select parent periods"
                />
              )}
              sx={{ mb: 2 }}
            />

            <TextField
              label="Number of Slabs"
              type="number"
              size="small"
              value={config.slabCount}
              onChange={(e) => handleConfigChange(config.id, { slabCount: e.target.value })}
              slotProps={{ htmlInput: { min: 1 } }}
              sx={{ maxWidth: 220 }}
            />
          </Paper>
        ))}

        <Button startIcon={<Add />} variant="outlined" onClick={handleAddConfiguration}>
          Add Custom Configuration
        </Button>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2, bgcolor: alpha(BRAND.bgGray, 0.5) }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
          Stage 2 — Workbook Bridge
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center' }}>
          <Button
            variant="contained"
            startIcon={downloading ? <CircularProgress size={16} color="inherit" /> : <Download />}
            onClick={handleDownloadTemplate}
            disabled={downloading || purgingStructure}
          >
            Download JBP Vector Template (.xlsx)
          </Button>

          {!stagedWorkbook && (
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
                flex: 1,
                minWidth: 280,
                border: `2px dashed ${dragOver ? BRAND.red : BRAND.borderLight}`,
                borderRadius: '10px',
                bgcolor: dragOver ? alpha(BRAND.red, 0.04) : BRAND.white,
                p: 2,
                textAlign: 'center',
                cursor: 'pointer',
              }}
            >
              <UploadFile sx={{ color: BRAND.textSecondary, mb: 0.5 }} />
              <Typography variant="body2" color="text.secondary">
                {uploading ? 'Uploading workbook…' : 'Drop completed workbook here or click to upload'}
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
        </Box>
      </Paper>

      {stagedWorkbook && (
        <Paper variant="outlined" sx={{ p: 2 }}>
          <JbpMatrixReviewTable
            stagedWorkbook={stagedWorkbook}
            title="Stage 3 — Unpivoted Review Grid"
          />

          <Box sx={{ display: 'flex', gap: 1.5, mt: 2, flexWrap: 'wrap' }}>
            <Button variant="outlined" onClick={() => setStagedWorkbook(null)}>
              Discard & Re-upload Sheet
            </Button>
            <Button
              variant="contained"
              onClick={handleConfirmAndAdvance}
              disabled={committing}
              startIcon={committing ? <CircularProgress size={16} color="inherit" /> : null}
            >
              Confirm JBP Relational Matrix & Advance
            </Button>
          </Box>
        </Paper>
      )}

      <Dialog open={pendingFinancialYearStartMonth != null} onClose={() => setPendingFinancialYearStartMonth(null)}>
        <DialogTitle>Reset JBP Matrix?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Changing the financial year start month invalidates the current JBP configuration and matrix.
            Existing JBP data will be purged and you must download a fresh template.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPendingFinancialYearStartMonth(null)}>Cancel</Button>
          <Button
            color="warning"
            variant="contained"
            onClick={handleConfirmFinancialYearChange}
            disabled={purgingStructure}
          >
            Reset & Apply
          </Button>
        </DialogActions>
      </Dialog>
        </>
      )}
    </Box>
  );
}
