import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import {
  Box, Grid, Typography, Tooltip, IconButton
} from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import UnifiedSelect from '../../../components/forms/UnifiedSelect';

import WizardFieldAnchor from '../../../components/wizard/WizardFieldAnchor';
import { integrationApi } from '../../../api/integrationApi';
import { useDebounce } from '../../../hooks/useDebounce';
import { BRAND } from '../../../config/theme';
import { GEOGRAPHY_MODE } from '../../../constants/geographyMode';

/** Helper to extract fields regardless of camelCase or snake_case API responses */
const getField = (obj, camel, snake) => obj[camel] ?? obj[snake];

/** Convert a backend location row into the UI-friendly shape for a tier. */
function toCountryOption(item) {
  if (!item?.code || !item?.name) return null;
  const sub = item.countrySubName || item.subName;
  return {
    code: String(item.code),
    name: item.name,
    subName: sub || null,
    id: String(item.code),
    label: sub ? `${item.name} (${sub})` : `${item.name} (${item.code})`,
  };
}

function toStateOption(item, country) {
  if (!item?.code || !item?.name) return null;
  const sub = item.stateSubName || item.subName;
  return {
    code: String(item.code),
    name: item.name,
    subName: sub || null,
    countryCode: country?.code ? String(country.code) : (item.countryCode ? String(item.countryCode) : null),
    countryName: country?.name || item.countryName || null,
    countrySubName: country?.subName || item.countrySubName || null,
    id: String(item.code),
    label: sub ? `${item.name} (${sub})` : `${item.name} (${item.code})`,
  };
}

function toCityOption(item, state, country) {
  if (!item?.code || !item?.name) return null;
  const sub = item.citySubName || item.subName;
  const sCode = state?.code ? String(state.code) : (item.stateCode ? String(item.stateCode) : null);
  return {
    code: String(item.code),
    name: item.name,
    subName: sub || null,
    stateCode: sCode,
    stateName: state?.name || item.stateName || null,
    stateSubName: state?.subName || item.stateSubName || null,
    countryCode: country?.code ? String(country.code) : (item.countryCode ? String(item.countryCode) : null),
    countryName: country?.name || item.countryName || null,
    countrySubName: country?.subName || item.countrySubName || null,
    id: `${sCode || ''}:${item.code}`,
    label: sub ? `${item.name} (${sub})` : `${item.name} (${item.code})`,
  };
}

/** Location label extractor for SearchableSelect. */
function locationLabel(option) {
  if (!option) return '';
  if (option.label) return option.label;
  if (option.name && option.code) return `${option.name} (${option.code})`;
  return String(option.name || option.code || '');
}

/**
 * Derive the three selected tiers from normalized locations data.
 * locations: array of AgreementLocationDto-shaped objects from the backend.
 * Also considers legacy partnerStates/partnerCities for backward compat.
 */
function deriveSelections(details, allCountries, allStates) {
  const locs = details.locations || [];
  const legacyStates = details.partnerStates || [];
  const legacyCities = details.partnerCities || [];

  // Countries
  const countryCodes = new Set();
  for (const loc of locs) {
    const codeRaw = getField(loc, 'countryCode', 'country_code');
    if (codeRaw != null && codeRaw !== '' && /^\d+$/.test(String(codeRaw))) {
      countryCodes.add(String(codeRaw));
    }
  }
  const selectedCountries = [...countryCodes].map((code) => {
    const found = allCountries.find((c) => String(c.code) === code);
    if (found) return found;
    const loc = locs.find((l) => String(getField(l, 'countryCode', 'country_code')) === code);
    return toCountryOption({
      code,
      name: getField(loc, 'countryName', 'country_name') || code,
      countrySubName: getField(loc, 'countrySubName', 'country_sub_name')
    });
  }).filter(Boolean);

  // States
  const stateCodes = new Set();
  const stateMap = new Map();
  for (const loc of locs) {
    const sCodeRaw = getField(loc, 'stateCode', 'state_code');
    if (sCodeRaw != null && sCodeRaw !== '' && /^\d+$/.test(String(sCodeRaw))) {
      const sCode = String(sCodeRaw);
      stateCodes.add(sCode);
      if (!stateMap.has(sCode)) {
        const cCodeRaw = getField(loc, 'countryCode', 'country_code');
        stateMap.set(sCode, {
          code: sCode,
          name: getField(loc, 'stateName', 'state_name') || sCode,
          stateSubName: getField(loc, 'stateSubName', 'state_sub_name'),
          countryCode: (cCodeRaw != null && /^\d+$/.test(String(cCodeRaw))) ? String(cCodeRaw) : null,
          countryName: getField(loc, 'countryName', 'country_name'),
          countrySubName: getField(loc, 'countrySubName', 'country_sub_name'),
        });
      }
    }
  }
  // Merge legacy states
  for (const ls of legacyStates) {
    if (ls.code && /^\d+$/.test(String(ls.code)) && !stateMap.has(String(ls.code))) {
      stateMap.set(String(ls.code), {
        code: String(ls.code),
        name: ls.name,
        countryCode: null,
        countryName: null,
      });
    }
  }
  const selectedStates = [...stateMap.values()].map((s) => {
    const found = allStates.find((st) => String(st.code) === s.code);
    if (found) return found;
    return toStateOption(s, s.countryCode ? { code: s.countryCode, name: s.countryName, subName: s.countrySubName } : null);
  }).filter(Boolean);

  // Cities
  const cityKeySet = new Set();
  const cityMap = new Map();
  for (const loc of locs) {
    const cCodeRaw = getField(loc, 'cityCode', 'city_code');
    if (cCodeRaw != null && cCodeRaw !== '' && /^\d+$/.test(String(cCodeRaw))) {
      const cCode = String(cCodeRaw);
      const sCodeRaw = getField(loc, 'stateCode', 'state_code');
      const sCode = (sCodeRaw != null && /^\d+$/.test(String(sCodeRaw))) ? String(sCodeRaw) : '';
      const key = `${sCode}:${cCode}`;
      cityKeySet.add(key);
      if (!cityMap.has(key)) {
        const ctryCodeRaw = getField(loc, 'countryCode', 'country_code');
        cityMap.set(key, {
          code: cCode,
          name: getField(loc, 'cityName', 'city_name') || cCode,
          citySubName: getField(loc, 'citySubName', 'city_sub_name'),
          stateCode: sCode,
          stateName: getField(loc, 'stateName', 'state_name'),
          stateSubName: getField(loc, 'stateSubName', 'state_sub_name'),
          countryCode: (ctryCodeRaw != null && /^\d+$/.test(String(ctryCodeRaw))) ? String(ctryCodeRaw) : null,
          countryName: getField(loc, 'countryName', 'country_name'),
          countrySubName: getField(loc, 'countrySubName', 'country_sub_name'),
        });
      }
    }
  }
  // Merge legacy cities
  for (const lc of legacyCities) {
    if (lc.code && /^\d+$/.test(String(lc.code)) && lc.stateCode && /^\d+$/.test(String(lc.stateCode))) {
      const key = `${String(lc.stateCode)}:${String(lc.code)}`;
      if (!cityMap.has(key)) {
        cityMap.set(key, {
          code: String(lc.code),
          name: lc.name,
          stateCode: String(lc.stateCode),
          stateName: lc.stateName,
          countryCode: null,
          countryName: null,
        });
      }
    }
  }
  const selectedCities = [...cityMap.values()].map((c) => {
    const state = selectedStates.find((s) => s.code === c.stateCode) ||
      allStates.find((s) => String(s.code) === c.stateCode);
    const country = selectedCountries.find((co) => co.code === c.countryCode) ||
      allCountries.find((co) => String(co.code) === c.countryCode);
    return toCityOption(c, state, country);
  }).filter(Boolean);

  return { selectedCountries, selectedStates, selectedCities };
}

/**
 * Build the normalized locations array from the three selections.
 */
function buildLocations(selectedCountries, selectedStates, selectedCities) {
  const locations = [];
  const stateCodesByCountry = new Map();
  const cityKeysByState = new Map();

  // Index states by country
  for (const st of selectedStates) {
    if (st.countryCode) {
      if (!stateCodesByCountry.has(st.countryCode)) stateCodesByCountry.set(st.countryCode, new Set());
      stateCodesByCountry.get(st.countryCode).add(st.code);
    }
  }

  // Index cities by state
  for (const city of selectedCities) {
    if (city.stateCode) {
      if (!cityKeysByState.has(city.stateCode)) cityKeysByState.set(city.stateCode, new Set());
      cityKeysByState.get(city.stateCode).add(city.code);
    }
  }

  // Countries: only persist if none of their states are selected
  const countriesWithStates = new Set(stateCodesByCountry.keys());
  for (const country of selectedCountries) {
    if (!countriesWithStates.has(country.code)) {
      locations.push({
        locationType: 'COUNTRY',
        countryCode: country.code,
        countryName: country.name,
        countrySubName: country.subName || null,
        stateCode: null,
        stateName: null,
        stateSubName: null,
        cityCode: null,
        cityName: null,
        citySubName: null,
      });
    }
  }

  // States: only persist if none of their cities are selected
  const statesWithCities = new Set(cityKeysByState.keys());
  for (const st of selectedStates) {
    if (!statesWithCities.has(st.code)) {
      locations.push({
        locationType: 'STATE',
        countryCode: st.countryCode || null,
        countryName: st.countryName || null,
        countrySubName: st.countrySubName || null,
        stateCode: st.code,
        stateName: st.name,
        stateSubName: st.subName || null,
        cityCode: null,
        cityName: null,
        citySubName: null,
      });
    }
  }

  // Cities: always persist as-is (most granular)
  for (const city of selectedCities) {
    locations.push({
      locationType: 'CITY',
      countryCode: city.countryCode || null,
      countryName: city.countryName || null,
      countrySubName: city.countrySubName || null,
      stateCode: city.stateCode,
      stateName: city.stateName,
      stateSubName: city.stateSubName || null,
      cityCode: city.code,
      cityName: city.name,
      citySubName: city.subName || null,
    });
  }

  return locations;
}

export default function PartnerLocationFields({
  details = {},
  onUpdateDetails,
  fieldErrors = {},
  onClearFieldError,
  isDataFee = false,
}) {
  const [countries, setCountries] = useState([]);
  const [states, setStates] = useState([]);
  const [cityOptions, setCityOptions] = useState([]);
  const [countryLoading, setCountryLoading] = useState(false);
  const [stateLoading, setStateLoading] = useState(false);
  const [cityLoading, setCityLoading] = useState(false);
  const [countrySearchError, setCountrySearchError] = useState('');
  const [stateSearchError, setStateSearchError] = useState('');
  const [citySearchError, setCitySearchError] = useState('');

  const [countrySearchText, setCountrySearchText] = useState('');
  const [stateSearchText, setStateSearchText] = useState('');
  const [citySearchText, setCitySearchText] = useState('');

  const debouncedCountrySearch = useDebounce(countrySearchText, 300);
  const debouncedStateSearch = useDebounce(stateSearchText, 300);
  const debouncedCitySearch = useDebounce(citySearchText, 300);

  // Derived selections from locations data
  const { selectedCountries, selectedStates, selectedCities } = useMemo(
    () => deriveSelections(details, countries, states),
    [details, countries, states]
  );

  // Default to India if pristine on initial mount
  const hasInitializedDefault = useRef(false);

  useEffect(() => {
    if (hasInitializedDefault.current) return;

    const isPristine = !details.locations?.length && !details.partnerStates?.length && !details.partnerCities?.length;
    
    // Only apply defaults when there are no selections initially
    if (isPristine) {
      if (isDataFee) {
        hasInitializedDefault.current = true;
        const india = { code: "1", name: "India" };
        const locations = buildLocations([india], [], []);
        onUpdateDetails({
          geographyMode: GEOGRAPHY_MODE.MIXED,
          locations,
        });
      }
      // If not Data Fee, we do nothing and leave it empty as requested.
      // We also don't mark as initialized yet just in case it's a momentary empty state,
      // but actually details is fully formed on mount. To prevent infinite loops we can mark it.
      hasInitializedDefault.current = true;
    } else {
      // If it already has data, we mark as initialized so we don't ever overwrite it.
      hasInitializedDefault.current = true;
    }
  }, [details.locations?.length, details.partnerStates?.length, details.partnerCities?.length, isDataFee, onUpdateDetails]);

  // Load countries
  useEffect(() => {
    let mounted = true;
    setCountryLoading(true);
    integrationApi.searchCountries(debouncedCountrySearch)
      .then(({ data }) => {
        if (!mounted) return;
        const options = Array.isArray(data) ? data.map(toCountryOption).filter(Boolean) : [];
        setCountries(options);
      })
      .catch((err) => {
        if (!mounted) return;
        setCountrySearchError(err.response?.data?.message || 'Failed to load countries');
      })
      .finally(() => {
        if (!mounted) return;
        setCountryLoading(false);
      });
    return () => { mounted = false; };
  }, [debouncedCountrySearch]);

  // Load states
  useEffect(() => {
    if (selectedCountries.length === 0) {
      setStates([]);
      return;
    }
    let mounted = true;
    setStateLoading(true);
    const countryCodes = selectedCountries.map((c) => String(c.code));
    integrationApi.searchStates(debouncedStateSearch, countryCodes)
      .then(({ data }) => {
        if (!mounted) return;
        const options = Array.isArray(data)
          ? data.map((item) => {
            const country = selectedCountries.find((c) => String(c.code) === String(item.countryCode));
            return toStateOption(item, country);
          }).filter(Boolean)
          : [];
        setStates(options);
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
  }, [selectedCountries.map((c) => String(c.code)).sort().join(','), debouncedStateSearch]);

  // Filter states for the current selected countries context
  const availableStates = useMemo(() => {
    if (selectedCountries.length === 0) return [];
    const countryCodes = new Set(selectedCountries.map((c) => String(c.code)));
    return states.filter((s) => !s.countryCode || countryCodes.has(String(s.countryCode)));
  }, [states, selectedCountries]);

  // Load cities
  useEffect(() => {
    if (selectedStates.length === 0) {
      setCityOptions([]);
      return;
    }
    let mounted = true;
    setCityLoading(true);
    const stateCodes = selectedStates.map((s) => s.code);
    integrationApi.searchCities(debouncedCitySearch, stateCodes)
      .then(({ data }) => {
        if (!mounted) return;
        const options = Array.isArray(data)
          ? data.map((item) => {
            const state = selectedStates.find((s) => s.code === String(item.stateCode));
            const country = selectedCountries.find((c) => c.code === String(item.countryCode));
            return toCityOption(item, state, country);
          }).filter(Boolean)
          : [];
        setCityOptions(options);
      })
      .catch((err) => {
        if (!mounted) return;
        setCitySearchError(err.response?.data?.message || 'Failed to load cities');
      })
      .finally(() => {
        if (!mounted) return;
        setCityLoading(false);
      });
    return () => { mounted = false; };
  }, [selectedStates.map((s) => s.code).sort().join(','), debouncedCitySearch]);

  // Persist helper — updates location data
  const persist = useCallback((nextCountries, nextStates, nextCities) => {
    const locations = buildLocations(nextCountries, nextStates, nextCities);
    onUpdateDetails({
      geographyMode: GEOGRAPHY_MODE.MIXED,
      partnerStates: nextStates.map((s) => ({ code: s.code, name: s.name })),
      partnerCities: nextCities.map((c) => ({
        code: c.code,
        name: c.name,
        stateCode: c.stateCode,
        stateName: c.stateName,
      })),
      locations,
    });
  }, [onUpdateDetails]);

  const handleCountriesChange = useCallback((options) => {
    const nextCountries = Array.isArray(options) ? options : [];
    // Clear states and cities that don't belong to the newly selected countries
    const countryCodes = new Set(nextCountries.map((c) => String(c.code)));
    const nextStates = selectedStates.filter((s) => countryCodes.has(String(s.countryCode)));
    const nextCities = selectedCities.filter((c) => countryCodes.has(String(c.countryCode)));
    persist(nextCountries, nextStates, nextCities);
    onClearFieldError?.('countries');
    onClearFieldError?.('partnerState');
    onClearFieldError?.('partnerCity');
  }, [selectedStates, selectedCities, persist, onClearFieldError]);

  const handleStatesChange = useCallback((options) => {
    const nextStates = Array.isArray(options) ? options : [];
    // Clear cities for states that are no longer selected
    const stateCodes = new Set(nextStates.map((s) => String(s.code)));
    const nextCities = selectedCities.filter((c) => stateCodes.has(String(c.stateCode)));
    persist(selectedCountries, nextStates, nextCities);
    onClearFieldError?.('partnerState');
    onClearFieldError?.('partnerCity');
  }, [selectedCountries, selectedCities, persist, onClearFieldError]);

  const handleCitiesChange = useCallback((options) => {
    const nextCities = Array.isArray(options) ? options : [];
    persist(selectedCountries, selectedStates, nextCities);
    onClearFieldError?.('partnerCity');
  }, [selectedCountries, selectedStates, persist, onClearFieldError]);

  return (
    <Box>
      <>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5 }}>
          <Typography variant="subtitle2" fontWeight={600} color={BRAND.textPrimary}>
            Location Selection
          </Typography>
          <Tooltip title="Select countries, then states within those countries, then cities within selected states. Only selected states are saved if country is selected, and only selected cities are saved if state is selected." arrow placement="right">
            <IconButton size="small" sx={{ ml: 0.5, color: BRAND.textSecondary }}>
              <InfoOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>

        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 4 }}>
            <WizardFieldAnchor field="countries" error={fieldErrors.countries}>
              <UnifiedSelect
                multiple
                label="Countries"
                placeholder="Search and select countries"
                showOptionsOnEmpty
                options={countries}
                value={selectedCountries}
                onChange={handleCountriesChange}
                onSearch={(q) => setCountrySearchText(q ?? '')}
                getOptionLabel={locationLabel}
                isOptionEqualToValue={(a, b) => String(a?.code) === String(b?.code)}
                loading={countryLoading}
                maxVisibleChips={1}
                error={fieldErrors.countries || countrySearchError}
                noOptionsText={countryLoading ? 'Loading countries…' : 'No countries found'}
              />
            </WizardFieldAnchor>
          </Grid>

          <Grid size={{ xs: 12, md: 4 }}>
            <WizardFieldAnchor field="partnerState" error={fieldErrors.partnerState}>
              <UnifiedSelect
                multiple
                label="States"
                placeholder={selectedCountries.length ? 'Search and select states' : 'Select countries first'}
                showOptionsOnEmpty
                options={availableStates}
                value={selectedStates}
                onChange={handleStatesChange}
                onSearch={(q) => setStateSearchText(q ?? '')}
                getOptionLabel={locationLabel}
                isOptionEqualToValue={(a, b) => String(a?.code) === String(b?.code)}
                loading={stateLoading}
                maxVisibleChips={1}
                disabled={selectedCountries.length === 0}
                error={fieldErrors.partnerState || stateSearchError}
                noOptionsText={stateLoading ? 'Loading states…' : 'No states found'}
              />
            </WizardFieldAnchor>
          </Grid>

          <Grid size={{ xs: 12, md: 4 }}>
            <WizardFieldAnchor field="partnerCity" error={fieldErrors.partnerCity}>
              <UnifiedSelect
                multiple
                label="Cities"
                placeholder={selectedStates.length ? 'Search and select cities' : 'Select states first'}
                showOptionsOnEmpty
                options={cityOptions}
                value={selectedCities}
                onChange={handleCitiesChange}
                onSearch={(q) => setCitySearchText(q ?? '')}
                getOptionLabel={locationLabel}
                isOptionEqualToValue={(a, b) => String(a?.code) === String(b?.code) && String(a?.stateCode) === String(b?.stateCode)}
                loading={cityLoading}
                maxVisibleChips={1}
                disabled={selectedStates.length === 0}
                error={fieldErrors.partnerCity || citySearchError}
                noOptionsText={cityLoading ? 'Loading cities…' : 'No cities found'}
              />
            </WizardFieldAnchor>
          </Grid>
        </Grid>
      </>
    </Box>
  );
}