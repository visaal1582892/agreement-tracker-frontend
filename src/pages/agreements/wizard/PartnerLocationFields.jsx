import { useCallback, useMemo, useState } from 'react';
import { Box, Chip, Grid, Stack, Typography, alpha } from '@mui/material';
import SearchableSelect from '../../../components/forms/SearchableSelect';
import WizardFieldAnchor from '../../../components/wizard/WizardFieldAnchor';
import { integrationApi } from '../../../api/integrationApi';
import { BRAND } from '../../../config/theme';

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
}) {
  const [stateOptions, setStateOptions] = useState([]);
  const [cityParentOptions, setCityParentOptions] = useState([]);
  const [cityOptions, setCityOptions] = useState([]);
  const [stateLoading, setStateLoading] = useState(false);
  const [cityParentLoading, setCityParentLoading] = useState(false);
  const [cityLoading, setCityLoading] = useState(false);
  const [stateSearchError, setStateSearchError] = useState('');
  const [cityParentSearchError, setCityParentSearchError] = useState('');
  const [citySearchError, setCitySearchError] = useState('');
  const [cityBrowseState, setCityBrowseState] = useState(null);

  const selectedStates = useMemo(() => toOptions(details.partnerStates), [details.partnerStates]);
  const selectedCities = useMemo(() => toOptions(details.partnerCities), [details.partnerCities]);

  const citiesForBrowseState = useMemo(
    () => selectedCities.filter((city) => city.stateCode === cityBrowseState?.code),
    [selectedCities, cityBrowseState?.code],
  );

  const persist = useCallback((states, cities) => {
    onUpdateDetails({
      geographyMode: 'MIXED',
      partnerStates: toStatePayload(states),
      partnerCities: toCityPayload(cities),
    });
  }, [onUpdateDetails]);

  const handleStatesChange = useCallback((options) => {
    const nextStates = Array.isArray(options) ? options : [];
    const nextStateCodes = new Set(nextStates.map((s) => s.code));
    // Selecting whole state removes that state's cities
    const nextCities = selectedCities.filter((city) => !nextStateCodes.has(city.stateCode));
    persist(nextStates, nextCities);
    onClearFieldError?.('partnerState');
    onClearFieldError?.('partnerCity');
  }, [selectedCities, persist, onClearFieldError]);

  const handleCityBrowseStateChange = useCallback((option) => {
    setCityBrowseState(option || null);
    setCityOptions([]);
    setCitySearchError('');
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
    // Selecting cities of a state removes that whole-state selection
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

  const handleStateSearch = useCallback(async (query) => {
    const q = (query ?? '').trim();
    if (q.length < SEARCH_MIN_CHARS) {
      setStateOptions([]);
      setStateSearchError('');
      setStateLoading(false);
      return;
    }
    setStateLoading(true);
    setStateSearchError('');
    try {
      const { data } = await integrationApi.searchStates(q);
      setStateOptions(Array.isArray(data) ? data.map((item) => ({
        ...item,
        id: item.code,
        label: `${item.name} (${item.code})`,
      })) : []);
    } catch (err) {
      setStateOptions([]);
      setStateSearchError(err.response?.data?.message || 'Failed to load states');
    } finally {
      setStateLoading(false);
    }
  }, []);

  const handleCityParentSearch = useCallback(async (query) => {
    const q = (query ?? '').trim();
    if (q.length < SEARCH_MIN_CHARS) {
      setCityParentOptions([]);
      setCityParentSearchError('');
      setCityParentLoading(false);
      return;
    }
    setCityParentLoading(true);
    setCityParentSearchError('');
    try {
      const { data } = await integrationApi.searchStates(q);
      setCityParentOptions(Array.isArray(data) ? data.map((item) => ({
        ...item,
        id: item.code,
        label: `${item.name} (${item.code})`,
      })) : []);
    } catch (err) {
      setCityParentOptions([]);
      setCityParentSearchError(err.response?.data?.message || 'Failed to load states');
    } finally {
      setCityParentLoading(false);
    }
  }, []);

  const handleCitySearch = useCallback(async (query) => {
    if (!cityBrowseState?.code) {
      setCityOptions([]);
      return;
    }
    const q = (query ?? '').trim();
    if (q.length < SEARCH_MIN_CHARS) {
      setCityOptions([]);
      setCitySearchError('');
      setCityLoading(false);
      return;
    }
    setCityLoading(true);
    setCitySearchError('');
    try {
      const { data } = await integrationApi.searchCities(cityBrowseState.code, q);
      setCityOptions(Array.isArray(data) ? data.map((item) => ({
        ...item,
        stateCode: cityBrowseState.code,
        stateName: cityBrowseState.name,
        id: `${cityBrowseState.code}:${item.code}`,
        label: `${item.name} (${item.code})`,
      })) : []);
    } catch (err) {
      setCityOptions([]);
      setCitySearchError(err.response?.data?.message || 'Failed to load cities');
    } finally {
      setCityLoading(false);
    }
  }, [cityBrowseState]);

  const hasSelection = selectedStates.length > 0 || selectedCities.length > 0;

  return (
    <Box>
      <Typography variant="body2" sx={{ mb: 1.5, color: BRAND.textSecondary }}>
        Select whole states and/or cities from other states. Selecting cities for a state removes that whole-state selection.
      </Typography>

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
          <Stack direction="row" flexWrap="wrap" gap={0.75}>
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
              placeholder="Search states to select entirely (min 2 chars)"
              options={stateOptions}
              value={selectedStates}
              onChange={handleStatesChange}
              onSearch={handleStateSearch}
              getOptionLabel={locationLabel}
              isOptionEqualToValue={(a, b) => a?.code === b?.code}
              loading={stateLoading}
              error={fieldErrors.partnerState || stateSearchError}
              helperText={stateSearchError || 'Selecting a state clears any cities already chosen for that state'}
              noOptionsText={stateLoading ? 'Searching…' : 'No states found'}
            />
          </WizardFieldAnchor>
        </Grid>

        <Grid size={{ xs: 12, md: 5 }}>
          <SearchableSelect
            label="City search — State"
            placeholder="Pick state to browse cities"
            options={cityParentOptions}
            value={cityBrowseState}
            onChange={handleCityBrowseStateChange}
            onSearch={handleCityParentSearch}
            getOptionLabel={locationLabel}
            isOptionEqualToValue={(a, b) => a?.code === b?.code}
            loading={cityParentLoading}
            error={cityParentSearchError}
            helperText={cityParentSearchError || 'Temporary browse context — not a whole-state selection'}
            noOptionsText={cityParentLoading ? 'Searching…' : 'No states found'}
          />
        </Grid>

        <Grid size={{ xs: 12, md: 7 }}>
          <WizardFieldAnchor field="partnerCity" error={fieldErrors.partnerCity}>
            <SearchableSelect
              isMulti
              label="Cities"
              placeholder={cityBrowseState ? 'Search cities (min 2 chars)' : 'Pick a state first'}
              options={cityOptions}
              value={citiesForBrowseState}
              onChange={handleCitiesChange}
              onSearch={handleCitySearch}
              getOptionLabel={locationLabel}
              isOptionEqualToValue={(a, b) => a?.code === b?.code && a?.stateCode === b?.stateCode}
              loading={cityLoading}
              disabled={!cityBrowseState}
              error={fieldErrors.partnerCity || citySearchError}
              helperText={
                !cityBrowseState
                  ? 'Select a state above to search its cities'
                  : (citySearchError || 'Selecting cities removes that state from Whole States')
              }
              noOptionsText={cityLoading ? 'Searching…' : 'No cities found'}
            />
          </WizardFieldAnchor>
        </Grid>
      </Grid>
    </Box>
  );
}
