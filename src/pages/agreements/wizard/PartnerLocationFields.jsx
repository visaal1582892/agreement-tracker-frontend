import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box, Chip, Grid, Stack, Typography, alpha, Alert,
  FormControl, FormLabel, RadioGroup, FormControlLabel, Radio,
  Tooltip, IconButton
} from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import SearchableSelect from '../../../components/forms/SearchableSelect';
import WizardFieldAnchor from '../../../components/wizard/WizardFieldAnchor';
import { integrationApi } from '../../../api/integrationApi';
import { BRAND } from '../../../config/theme';
import { GEOGRAPHY_MODE } from '../../../constants/geographyMode';

const SEARCH_MIN_CHARS = 2;

function toOption(item) {
  if (!item?.code || !item?.name) return null;
  return {
    code: item.code,
    name: item.name,
    stateCode: item.stateCode ?? null,
    stateName: item.stateName ?? null,
    id: item.stateCode ? `${item.stateCode}:${item.code}` : item.code,
    label: item.stateCode
      ? `${item.name} (${item.code}) · ${item.stateName || item.stateCode}`
      : `${item.name} (${item.code})`,
  };
}

function toOptions(items) {
  return (items ?? []).map(toOption).filter(Boolean);
}

function locationLabel(option) {
  if (!option) return '';
  if (option.label) return option.label;
  if (option.name && option.code) return `${option.name} (${option.code})`;
  return option.name || option.code || '';
}

function toStatePayload(options) {
  return (options ?? [])
    .filter((item) => item?.code && item?.name)
    .map((item) => ({ code: item.code, name: item.name }));
}

function toCityPayload(options) {
  return (options ?? [])
    .filter((item) => item?.code && item?.name && item?.stateCode)
    .map((item) => ({
      code: item.code,
      name: item.name,
      stateCode: item.stateCode,
      stateName: item.stateName || null,
    }));
}

export default function PartnerLocationFields({
  details = {},
  onUpdateDetails,
  fieldErrors = {},
  onClearFieldError,
  allowAllLocations = false,
}) {
  const [allStates, setAllStates] = useState([]);
  const [cityOptions, setCityOptions] = useState([]);
  const [stateLoading, setStateLoading] = useState(false);
  const [cityLoading, setCityLoading] = useState(false);
  const [stateSearchError, setStateSearchError] = useState('');
  const [citySearchError, setCitySearchError] = useState('');
  const [cityBrowseState, setCityBrowseState] = useState(null);

  useEffect(() => {
    let mounted = true;
    setStateLoading(true);
    integrationApi.searchStates('')
      .then(({ data }) => {
        if (!mounted) return;
        const options = Array.isArray(data) ? data.map((item) => ({
          ...item,
          id: item.code,
          label: `${item.name} (${item.code})`,
        })) : [];
        setAllStates(options);
      })
      .catch((err) => {
        if (!mounted) return;
        setStateSearchError(err.response?.data?.message || 'Failed to load states');
      })
      .finally(() => {
        if (!mounted) return;
        setStateLoading(false);
      });
    return () => { mounted = false; };
  }, []);

  const isAllLocations = details.geographyMode === GEOGRAPHY_MODE.ALL;
  const selectionMode = isAllLocations ? GEOGRAPHY_MODE.ALL : 'CUSTOM';

  const selectedStates = useMemo(() => toOptions(details.partnerStates), [details.partnerStates]);
  const selectedCities = useMemo(() => toOptions(details.partnerCities), [details.partnerCities]);

  const citiesForBrowseState = useMemo(
    () => selectedCities.filter((city) => city.stateCode === cityBrowseState?.code),
    [selectedCities, cityBrowseState?.code],
  );

  const persist = useCallback((states, cities) => {
    onUpdateDetails({
      geographyMode: GEOGRAPHY_MODE.MIXED,
      partnerStates: toStatePayload(states),
      partnerCities: toCityPayload(cities),
    });
  }, [onUpdateDetails]);

  const handleSelectionModeChange = useCallback((event) => {
    const nextMode = event.target.value;
    if (nextMode === GEOGRAPHY_MODE.ALL) {
      onUpdateDetails({
        geographyMode: GEOGRAPHY_MODE.ALL,
        partnerStates: [],
        partnerCities: [],
      });
      onClearFieldError?.('partnerState');
      onClearFieldError?.('partnerCity');
      return;
    }
    onUpdateDetails({
      geographyMode: GEOGRAPHY_MODE.MIXED,
      partnerStates: [],
      partnerCities: [],
    });
  }, [onUpdateDetails, onClearFieldError]);

  const handleStatesChange = useCallback((options) => {
    const nextStates = Array.isArray(options) ? options : [];
    const nextStateCodes = new Set(nextStates.map((s) => s.code));
    const nextCities = selectedCities.filter((city) => !nextStateCodes.has(city.stateCode));
    persist(nextStates, nextCities);
    onClearFieldError?.('partnerState');
    onClearFieldError?.('partnerCity');
  }, [selectedCities, persist, onClearFieldError]);

  const handleCityBrowseStateChange = useCallback((option) => {
    setCityBrowseState(option || null);
    setCityOptions([]);
    setCitySearchError('');
    if (option) {
      setCityLoading(true);
      integrationApi.searchCities(option.code, '')
        .then(({ data }) => {
          const options = Array.isArray(data) ? data.map((item) => ({
            ...item,
            stateCode: option.code,
            stateName: option.name,
            id: `${option.code}:${item.code}`,
            label: `${item.name} (${item.code})`,
          })) : [];
          setCityOptions(options);
        })
        .catch((err) => {
          setCitySearchError(err.response?.data?.message || 'Failed to load cities');
        })
        .finally(() => {
          setCityLoading(false);
        });
    }
  }, []);

  const handleCitiesChange = useCallback((options) => {
    if (!cityBrowseState?.code) return;
    const nextForState = (Array.isArray(options) ? options : []).map((city) => ({
      ...city,
      stateCode: cityBrowseState.code,
      stateName: cityBrowseState.name,
      id: `${cityBrowseState.code}:${city.code}`,
      label: `${city.name} (${city.code}) · ${cityBrowseState.name}`,
    }));
    const nextStates = selectedStates.filter((state) => state.code !== cityBrowseState.code);
    const otherCities = selectedCities.filter((city) => city.stateCode !== cityBrowseState.code);
    persist(nextStates, [...otherCities, ...nextForState]);
    onClearFieldError?.('partnerState');
    onClearFieldError?.('partnerCity');
  }, [cityBrowseState, selectedStates, selectedCities, persist, onClearFieldError]);

  const removeStateChip = useCallback((code) => {
    persist(
      selectedStates.filter((state) => state.code !== code),
      selectedCities,
    );
  }, [selectedStates, selectedCities, persist]);

  const removeCityChip = useCallback((city) => {
    persist(
      selectedStates,
      selectedCities.filter((item) => !(item.code === city.code && item.stateCode === city.stateCode)),
    );
  }, [selectedStates, selectedCities, persist]);

  const hasSelection = selectedStates.length > 0 || selectedCities.length > 0;

  return (
    <Box>
      {allowAllLocations && (
        <WizardFieldAnchor field="geographyMode" error={fieldErrors.geographyMode}>
          <FormControl component="fieldset" sx={{ mb: 2 }}>
            <FormLabel component="legend" sx={{ mb: 1, color: BRAND.textSecondary, fontSize: '0.875rem' }}>
              Location coverage
            </FormLabel>
            <RadioGroup row value={selectionMode} onChange={handleSelectionModeChange}>
              <FormControlLabel
                value={GEOGRAPHY_MODE.ALL}
                control={<Radio size="small" />}
                label="All locations"
              />
              <FormControlLabel
                value="CUSTOM"
                control={<Radio size="small" />}
                label="Custom selection"
              />
            </RadioGroup>
          </FormControl>
        </WizardFieldAnchor>
      )}

      {allowAllLocations && isAllLocations ? (
        <Alert severity="info" sx={{ mb: 2 }}>
          All locations are selected for this Data Fee agreement. Switch to custom selection to limit geography.
        </Alert>
      ) : (
        <>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5 }}>
            <Typography variant="subtitle2" fontWeight={600} color={BRAND.textPrimary}>
              Location Selection
            </Typography>
            <Tooltip title="Select whole states, or pick a state to browse and select specific cities. Selecting specific cities will clear that whole-state selection." arrow placement="right">
              <IconButton size="small" sx={{ ml: 0.5, color: BRAND.textSecondary }}>
                <InfoOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>

          {hasSelection && (
            <Box
              sx={{
                mb: 2,
                p: 1.5,
                borderRadius: '8px',
                border: `1px solid ${BRAND.borderLight}`,
                bgcolor: alpha(BRAND.bgGray, 0.5),
              }}
            >
              <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                Selected locations
              </Typography>
              <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap' }}>
                {selectedStates.map((state) => (
                  <Chip
                    key={`state-${state.code}`}
                    size="small"
                    label={`State: ${state.name} (${state.code})`}
                    onDelete={() => removeStateChip(state.code)}
                    sx={{ bgcolor: alpha(BRAND.red, 0.08) }}
                  />
                ))}
                {selectedCities.map((city) => (
                  <Chip
                    key={`city-${city.stateCode}-${city.code}`}
                    size="small"
                    label={`City: ${city.name} (${city.code}) · ${city.stateName || city.stateCode}`}
                    onDelete={() => removeCityChip(city)}
                    sx={{ bgcolor: alpha('#0F766E', 0.1) }}
                  />
                ))}
              </Stack>
            </Box>
          )}

          <Grid container spacing={2}>
            <Grid size={12}>
              <WizardFieldAnchor field="partnerState" error={fieldErrors.partnerState}>
                <SearchableSelect
                  isMulti
                  label="Whole States"
                  placeholder="Search and select states"
                  options={allStates}
                  value={selectedStates}
                  onChange={handleStatesChange}
                  getOptionLabel={locationLabel}
                  isOptionEqualToValue={(a, b) => a?.code === b?.code}
                  loading={stateLoading}
                  error={fieldErrors.partnerState || stateSearchError}
                  noOptionsText={stateLoading ? 'Loading states…' : 'No states found'}
                />
              </WizardFieldAnchor>
            </Grid>

            <Grid size={{ xs: 12, md: 5 }}>
              <SearchableSelect
                label="State for Cities"
                placeholder="Pick a state"
                options={allStates}
                value={cityBrowseState}
                onChange={handleCityBrowseStateChange}
                getOptionLabel={locationLabel}
                isOptionEqualToValue={(a, b) => a?.code === b?.code}
                loading={stateLoading}
                noOptionsText={stateLoading ? 'Loading states…' : 'No states found'}
              />
            </Grid>

            <Grid size={{ xs: 12, md: 7 }}>
              <WizardFieldAnchor field="partnerCity" error={fieldErrors.partnerCity}>
                <SearchableSelect
                  isMulti
                  label="Cities"
                  placeholder={cityBrowseState ? 'Search and select cities' : 'Pick a state first'}
                  options={cityOptions}
                  value={citiesForBrowseState}
                  onChange={handleCitiesChange}
                  getOptionLabel={locationLabel}
                  isOptionEqualToValue={(a, b) => a?.code === b?.code && a?.stateCode === b?.stateCode}
                  loading={cityLoading}
                  disabled={!cityBrowseState}
                  error={fieldErrors.partnerCity || citySearchError}
                  noOptionsText={cityLoading ? 'Loading cities…' : 'No cities found'}
                />
              </WizardFieldAnchor>
            </Grid>
          </Grid>
        </>
      )}
    </Box>
  );
}
