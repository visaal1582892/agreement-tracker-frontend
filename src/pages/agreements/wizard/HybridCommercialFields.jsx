import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import { Add, Delete as DeleteIcon, Edit as EditIcon } from '@mui/icons-material';
import { alpha } from '@mui/material/styles';
import { useSnackbar } from 'notistack';
import {
  createSlab,
  deleteSlab,
  detectSlabTierGaps,
  fetchSlabs,
  toCcSlabPayload,
  toSlabPayload,
  updateSlab,
  validateCcTierAgainstExisting,
  validateSlabAgainstExisting,
  validateSlabCapRange,
} from '../../../api/commercialApi';
import { ensureDraftVersionForCommercial } from '../../../utils/commercialDraftOrchestration';
import { isCommercialContractsIncomeType } from '../../../utils/incomeTypeUtils';
import CollapsibleSection from '../../../components/wizard/CollapsibleSection';
import CommercialContactsCutoffSection from './CommercialContactsCutoffSection';
import WizardFieldAnchor from '../../../components/wizard/WizardFieldAnchor';
import CommercialValueInput from '../../../components/forms/CommercialValueInput';
import { CAP_UNIT, CAP_UNIT_OPTIONS } from '../../../constants/capUnit';
import {
  PAYOUT_FREQUENCY,
  PAYOUT_FREQUENCY_OPTIONS,
  STRUCTURE_TYPE,
  resolveStructureType,
  structureTypeToRadioValue,
  resolveFlatBaselineFrequency,
} from '../../../constants/commercialStructure';

const EMPTY_SLAB_DRAFT = {
  minCap: '',
  maxCap: '',
  valueType: 'PERCENTAGE',
  commercialValue: '',
  payoutFrequency: PAYOUT_FREQUENCY.MONTHLY,
};

export default function HybridCommercialFields({
  commercials,
  onUpdate,
  serverAgreementId,
  sourceAgreement,
  versionSourceId,
  buildVersionedEditPayload,
  onDraftVersionCreated,
  incomeTypeId,
  incomeTypeName,
  lockOneTimeFrequency = false,
  fieldErrors = {},
}) {
  const { enqueueSnackbar } = useSnackbar();
  const structureType = resolveStructureType(commercials.commercialStructure);
  const isLegacyHybrid = structureType === STRUCTURE_TYPE.LEGACY_HYBRID;
  const isFlat = structureType === STRUCTURE_TYPE.FLAT;
  const isSlabs = structureType === STRUCTURE_TYPE.SLABS;
  const isCommercialContracts = isCommercialContractsIncomeType([], incomeTypeId, incomeTypeName);
  const selectedFrequencies = commercials.selectedFrequencies || [];

  const [slabs, setSlabs] = useState([]);
  const [loadingSlabs, setLoadingSlabs] = useState(false);
  const [savingSlab, setSavingSlab] = useState(false);
  const [draftSlab, setDraftSlab] = useState(EMPTY_SLAB_DRAFT);
  const [editingSlabId, setEditingSlabId] = useState(null);
  const [commercialVersionId, setCommercialVersionId] = useState(serverAgreementId);
  const [capUnit, setCapUnit] = useState(commercials.slabCapUnit || CAP_UNIT.RUPEES);
  const [draftCapError, setDraftCapError] = useState(null);

  const frequencyOptions = useMemo(
    () => (lockOneTimeFrequency
      ? PAYOUT_FREQUENCY_OPTIONS.filter((option) => option.value === PAYOUT_FREQUENCY.ONE_TIME)
      : PAYOUT_FREQUENCY_OPTIONS),
    [lockOneTimeFrequency],
  );

  const tierGapWarnings = useMemo(() => detectSlabTierGaps(slabs), [slabs]);

  useEffect(() => {
    setCommercialVersionId(serverAgreementId);
  }, [serverAgreementId]);

  useEffect(() => {
    if (lockOneTimeFrequency && commercials.flatBaselineFrequency !== PAYOUT_FREQUENCY.ONE_TIME) {
      onUpdate({ flatBaselineFrequency: PAYOUT_FREQUENCY.ONE_TIME });
    }
  }, [lockOneTimeFrequency, commercials.flatBaselineFrequency, onUpdate]);

  useEffect(() => {
    if (lockOneTimeFrequency && commercials.selectedFrequencies?.[0] !== PAYOUT_FREQUENCY.ONE_TIME) {
      onUpdate({ selectedFrequencies: [PAYOUT_FREQUENCY.ONE_TIME] });
    }
  }, [lockOneTimeFrequency, commercials.selectedFrequencies, onUpdate]);

  useEffect(() => {
    if (!isFlat || commercials.flatBaselineFrequency) return;
    onUpdate({
      flatBaselineFrequency: resolveFlatBaselineFrequency(commercials, { lockOneTimeFrequency }),
    });
  }, [isFlat, commercials.flatBaselineFrequency, lockOneTimeFrequency, onUpdate]);

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
    if (!serverAgreementId) {
      return;
    }
    setLoadingSlabs(true);
    try {
      const data = await fetchSlabs(serverAgreementId);
      const list = Array.isArray(data) ? data : [];
      setSlabs(list);
      if (list[0]?.capUnit) {
        setCapUnit(list[0].capUnit);
        onUpdate({ slabCapUnit: list[0].capUnit });
      }
    } catch (err) {
      enqueueSnackbar(err.response?.data?.message || 'Failed to load slabs', { variant: 'error' });
    } finally {
      setLoadingSlabs(false);
    }
  }, [serverAgreementId, enqueueSnackbar, onUpdate]);

  useEffect(() => {
    if (serverAgreementId && isSlabs) {
      loadSlabs();
    }
  }, [serverAgreementId, isSlabs, loadSlabs]);

  const applyStructureSelection = async (nextStructureType) => {
    if (nextStructureType === STRUCTURE_TYPE.FLAT) {
      onUpdate({
        commercialStructure: 'FLAT',
        enableFlatBaseline: true,
        enableSlabIncentives: false,
        commercialValue: commercials.commercialValue ?? '',
        flatBaselineFrequency: resolveFlatBaselineFrequency(commercials, { lockOneTimeFrequency }),
      });
      resetDraft();
      return;
    }

    onUpdate({
      commercialStructure: 'SLAB',
      enableFlatBaseline: false,
      enableSlabIncentives: true,
      commercialValue: '',
    });
    resetDraft();
  };

  const handleStructureChange = async (event) => {
    const nextType = event.target.value === 'SLABS' ? STRUCTURE_TYPE.SLABS : STRUCTURE_TYPE.FLAT;
    await applyStructureSelection(nextType);
  };

  const updateDraft = (field, value) => {
    setDraftSlab((prev) => {
      const next = { ...prev, [field]: value };
      if (field === 'minCap' || field === 'maxCap') {
        setDraftCapError(validateSlabCapRange(next.minCap, next.maxCap));
      }
      return next;
    });
  };

  const resetDraft = () => {
    setDraftSlab({
      ...EMPTY_SLAB_DRAFT,
      payoutFrequency: lockOneTimeFrequency ? PAYOUT_FREQUENCY.ONE_TIME : PAYOUT_FREQUENCY.MONTHLY,
    });
    setEditingSlabId(null);
    setDraftCapError(null);
  };

  const handleCapUnitChange = async (_, nextUnit) => {
    if (!nextUnit || nextUnit === capUnit) return;
    setCapUnit(nextUnit);
    onUpdate({ slabCapUnit: nextUnit });
    if (!slabs.length) return;

    const versionId = await resolveMutationVersionId();
    if (!versionId) return;

    try {
      await Promise.all(slabs.map((slab) => updateSlab(
        versionId,
        slab.id,
        toSlabPayload({ ...slab, capUnit: nextUnit }, nextUnit),
      )));
      await loadSlabs();
      enqueueSnackbar('Cap unit updated for all slab rows', { variant: 'success' });
    } catch (err) {
      enqueueSnackbar(err.response?.data?.message || 'Failed to update cap unit', { variant: 'error' });
      setCapUnit(slabs[0]?.capUnit || CAP_UNIT.RUPEES);
    }
  };

  const validateDraftSlab = (ccTierMode = false) => {
    if (ccTierMode) {
      if (draftSlab.minCap === '' || draftSlab.commercialValue === '') {
        enqueueSnackbar('Complete Target Value and Payout Value before saving', { variant: 'warning' });
        return false;
      }
      if (!draftSlab.payoutFrequency) {
        enqueueSnackbar('Payout frequency is required for each tier', { variant: 'warning' });
        return false;
      }
      const payload = toCcSlabPayload(draftSlab, capUnit);
      const conflict = validateCcTierAgainstExisting(slabs, payload, editingSlabId);
      if (conflict) {
        enqueueSnackbar(conflict, { variant: 'warning' });
        return false;
      }
      return true;
    }

    if (draftSlab.minCap === '' || draftSlab.maxCap === '' || draftSlab.commercialValue === '') {
      enqueueSnackbar('Complete Min Cap, Max Cap, and payout value before saving', { variant: 'warning' });
      return false;
    }
    if (!draftSlab.payoutFrequency) {
      enqueueSnackbar('Payout frequency is required for each slab row', { variant: 'warning' });
      return false;
    }

    const capError = validateSlabCapRange(draftSlab.minCap, draftSlab.maxCap);
    if (capError) {
      setDraftCapError(capError);
      enqueueSnackbar(capError, { variant: 'warning' });
      return false;
    }

    const payload = toSlabPayload({ ...draftSlab, capUnit }, capUnit);
    const conflict = validateSlabAgainstExisting(slabs, payload, editingSlabId);
    if (conflict) {
      enqueueSnackbar(conflict, { variant: 'warning' });
      return false;
    }
    return true;
  };

  const handleSaveSlab = async (ccTierMode = false) => {
    if (!validateDraftSlab(ccTierMode)) return;
    setSavingSlab(true);
    try {
      const versionId = await resolveMutationVersionId();
      if (!versionId) {
        enqueueSnackbar('Save the agreement draft first before adding slabs', { variant: 'warning' });
        return;
      }
      const payload = ccTierMode
        ? toCcSlabPayload(draftSlab, capUnit)
        : toSlabPayload({ ...draftSlab, capUnit }, capUnit);
      if (editingSlabId) {
        await updateSlab(versionId, editingSlabId, payload);
        enqueueSnackbar('Slab updated', { variant: 'success' });
      } else {
        await createSlab(versionId, payload);
        enqueueSnackbar('Slab added', { variant: 'success' });
      }
      resetDraft();
      await loadSlabs();
      if (!ccTierMode) {
        const gaps = detectSlabTierGaps([
          ...slabs.filter((slab) => slab.id !== editingSlabId),
          { ...draftSlab, id: editingSlabId ?? 'draft' },
        ]);
        if (gaps.length) {
          enqueueSnackbar(gaps[0], { variant: 'info' });
        }
      }
    } catch (err) {
      enqueueSnackbar(err.response?.data?.message || 'Failed to save slab', { variant: 'error' });
    } finally {
      setSavingSlab(false);
    }
  };

  const handleEditSlab = (slab) => {
    setEditingSlabId(slab.id);
    setDraftSlab({
      minCap: String(slab.minCap),
      maxCap: String(slab.maxCap),
      valueType: slab.valueType,
      commercialValue: String(slab.commercialValue),
      payoutFrequency: lockOneTimeFrequency
        ? PAYOUT_FREQUENCY.ONE_TIME
        : (slab.payoutFrequency || PAYOUT_FREQUENCY.MONTHLY),
    });
    setDraftCapError(null);
  };

  const handleDeleteSlab = async (slabId) => {
    try {
      const versionId = await resolveMutationVersionId();
      if (!versionId) return;
      await deleteSlab(versionId, slabId);
      if (editingSlabId === slabId) resetDraft();
      enqueueSnackbar('Slab deleted', { variant: 'success' });
      await loadSlabs();
    } catch (err) {
      enqueueSnackbar(err.response?.data?.message || 'Failed to delete slab', { variant: 'error' });
    }
  };

  const sectionHasError = Boolean(
    fieldErrors.commercialComponent
    || fieldErrors.commercialValue
    || fieldErrors.flatBaselineFrequency
    || fieldErrors.slabs,
  );

  const cutoffVersionId = commercialVersionId ?? serverAgreementId;

  const renderSlabBuilder = ({
    minCapLabel = 'Min Cap *',
    maxCapLabel = 'Max Cap *',
    tableTitle = 'Slab Table',
    ccSingleTargetMode = false,
  } = {}) => (
    <>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5, gap: 2, flexWrap: 'wrap' }}>
        <Typography variant="subtitle2" fontWeight={700}>
          {tableTitle}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Cap Unit
          </Typography>
          <ToggleButtonGroup
            exclusive
            size="small"
            value={capUnit}
            onChange={handleCapUnitChange}
            sx={{
              height: 32,
              '& .MuiToggleButton-root': {
                width: 56,
                fontSize: '0.75rem',
                fontWeight: 600,
                textTransform: 'none',
              },
            }}
          >
            {CAP_UNIT_OPTIONS.map((option) => (
              <ToggleButton key={option.value} value={option.value}>
                {option.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Box>
      </Box>

      {!ccSingleTargetMode && tierGapWarnings.length > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {tierGapWarnings.join(' · ')}
        </Alert>
      )}

      {loadingSlabs ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
          <CircularProgress size={24} />
        </Box>
      ) : (
        <TableContainer
          component={Paper}
          variant="outlined"
          sx={{ borderRadius: 2, overflow: 'hidden', mb: 3 }}
        >
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>
                  {ccSingleTargetMode ? 'Target Value' : minCapLabel.replace(' *', '')}
                </TableCell>
                {!ccSingleTargetMode && (
                  <TableCell sx={{ fontWeight: 600 }}>{maxCapLabel.replace(' *', '')}</TableCell>
                )}
                <TableCell sx={{ fontWeight: 600 }}>Payout</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Frequency</TableCell>
                <TableCell align="center" sx={{ width: 96, fontWeight: 700, fontSize: 12 }}>
                  Actions
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {slabs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={ccSingleTargetMode ? 4 : 5}>
                    <Typography variant="body2" color="text.secondary">No tiers added yet.</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                slabs.map((slab) => (
                  <TableRow key={slab.id} selected={editingSlabId === slab.id}>
                    <TableCell>{slab.minCap}</TableCell>
                    {!ccSingleTargetMode && <TableCell>{slab.maxCap}</TableCell>}
                    <TableCell>
                      {slab.valueType === 'PERCENTAGE'
                        ? `${slab.commercialValue}%`
                        : `₹${slab.commercialValue}`}
                    </TableCell>
                    <TableCell>
                      {PAYOUT_FREQUENCY_OPTIONS.find((option) => option.value === slab.payoutFrequency)?.label
                        || slab.payoutFrequency
                        || '—'}
                    </TableCell>
                    <TableCell align="center" sx={{ width: 96, py: 1 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 0.5 }}>
                        <Tooltip title="Edit tier">
                          <IconButton
                            size="small"
                            onClick={() => handleEditSlab(slab)}
                            aria-label="Edit tier"
                            sx={{
                              color: 'text.secondary',
                              '&:hover': {
                                color: 'primary.main',
                                bgcolor: (theme) => alpha(theme.palette.primary.main, 0.08),
                              },
                            }}
                          >
                            <EditIcon sx={{ fontSize: 17 }} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete tier">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleDeleteSlab(slab.id)}
                            aria-label="Delete tier"
                          >
                            <DeleteIcon sx={{ fontSize: 17 }} />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 12, sm: ccSingleTargetMode ? 3 : 2 }}>
          <TextField
            label={ccSingleTargetMode ? 'Target Value *' : minCapLabel}
            type="number"
            fullWidth
            size="small"
            value={draftSlab.minCap}
            onChange={(e) => updateDraft('minCap', e.target.value)}
            error={Boolean(draftCapError)}
          />
        </Grid>
        {!ccSingleTargetMode && (
          <Grid size={{ xs: 12, sm: 2 }}>
            <TextField
              label={maxCapLabel}
              type="number"
              fullWidth
              size="small"
              value={draftSlab.maxCap}
              onChange={(e) => updateDraft('maxCap', e.target.value)}
              error={Boolean(draftCapError)}
              helperText={draftCapError || ''}
            />
          </Grid>
        )}
        <Grid size={{ xs: 12, sm: 3 }}>
          <CommercialValueInput
            label="Payout Value *"
            value={draftSlab.commercialValue}
            onChangeValue={(value) => updateDraft('commercialValue', value)}
            type={draftSlab.valueType}
            onChangeType={(type) => updateDraft('valueType', type)}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 3 }}>
          <FormControl fullWidth size="small" required>
            <InputLabel>Payout Frequency</InputLabel>
            <Select
              value={draftSlab.payoutFrequency}
              label="Payout Frequency *"
              onChange={(e) => updateDraft('payoutFrequency', e.target.value)}
              disabled={lockOneTimeFrequency}
            >
              {frequencyOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
      </Grid>

      <Box sx={{ display: 'flex', gap: 1 }}>
        <Button
          size="small"
          startIcon={savingSlab ? <CircularProgress size={16} /> : <Add />}
          onClick={() => handleSaveSlab(ccSingleTargetMode)}
          disabled={savingSlab || isLegacyHybrid}
        >
          {editingSlabId ? 'Update Tier' : 'Add Tier'}
        </Button>
        {editingSlabId && (
          <Button size="small" variant="outlined" onClick={resetDraft} disabled={savingSlab}>
            Cancel Edit
          </Button>
        )}
      </Box>

      {!serverAgreementId && (
        <Alert severity="warning" sx={{ mt: 2 }}>
          Save the agreement draft before adding tier rows.
        </Alert>
      )}
    </>
  );

  return (
    <CollapsibleSection
      title="Commercial Terms & Incentive Structure"
      description={
        lockOneTimeFrequency
          ? 'Choose flat payout or slab-based incentive. QPS agreements lock payout frequency to One-Time.'
          : 'Choose flat payout or slab-based incentive.'
      }
      forceExpand={sectionHasError}
      hasError={sectionHasError}
    >
      {isLegacyHybrid && (
        <Alert severity="warning" sx={{ mb: 2 }} data-wizard-field="commercialComponent" className="has-error">
          Legacy hybrid structure detected. Select Flat Baseline Payout or Slab-Based Incentive to continue.
        </Alert>
      )}

      {fieldErrors.commercialComponent && !isLegacyHybrid && (
        <Alert severity="error" sx={{ mb: 2 }} data-wizard-field="commercialComponent" className="has-error">
          {fieldErrors.commercialComponent}
        </Alert>
      )}

      <FormControl component="fieldset" sx={{ mb: 2.5 }}>
        <FormLabel component="legend" sx={{ fontWeight: 600, mb: 1 }}>
          Commercial Structure
        </FormLabel>
        <RadioGroup
          row
          value={structureTypeToRadioValue(structureType)}
          onChange={handleStructureChange}
        >
          <FormControlLabel
            value="FLAT"
            control={<Radio size="small" />}
            label="Flat Baseline Payout"
          />
          <FormControlLabel
            value="SLABS"
            control={<Radio size="small" />}
            label="Slab-Based Incentive"
          />
        </RadioGroup>
      </FormControl>

      {isFlat && (
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <WizardFieldAnchor field="commercialValue" error={fieldErrors.commercialValue}>
              <CommercialValueInput
                label="Flat Payout"
                required
                value={commercials.commercialValue}
                onChangeValue={(value) => onUpdate({ commercialValue: value })}
                type={commercials.flatValueType || commercials.valueType || 'FIXED'}
                onChangeType={(type) => onUpdate({ flatValueType: type, valueType: type })}
                error={Boolean(fieldErrors.commercialValue)}
              />
            </WizardFieldAnchor>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <WizardFieldAnchor field="flatBaselineFrequency" error={fieldErrors.flatBaselineFrequency}>
              <FormControl fullWidth size="small" required error={Boolean(fieldErrors.flatBaselineFrequency)}>
                <InputLabel>Payout Frequency</InputLabel>
                <Select
                  value={resolveFlatBaselineFrequency(commercials, { lockOneTimeFrequency })}
                  label="Payout Frequency *"
                  onChange={(e) => onUpdate({ flatBaselineFrequency: e.target.value })}
                  disabled={lockOneTimeFrequency}
                >
                  {frequencyOptions.map((option) => (
                    <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </WizardFieldAnchor>
          </Grid>
        </Grid>
      )}

      <Box sx={{ display: isFlat ? 'none' : 'block' }}>
        {isCommercialContracts && isSlabs ? (
          <CommercialContactsCutoffSection
            agreementVersionId={cutoffVersionId}
            slabs={slabs}
            selectedFrequencies={selectedFrequencies}
            onFrequenciesChange={(value) => onUpdate({ selectedFrequencies: value })}
            tierBuilder={renderSlabBuilder({
              ccSingleTargetMode: true,
              tableTitle: 'Target Tiers',
            })}
            fieldError={fieldErrors.slabs}
          />
        ) : (
          <WizardFieldAnchor field="slabs" error={fieldErrors.slabs}>
            {renderSlabBuilder()}
          </WizardFieldAnchor>
        )}
      </Box>
    </CollapsibleSection>
  );
}
