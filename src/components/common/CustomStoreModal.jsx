import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  Button,
  TextField,
  Grid,
  Box,
  Typography,
  IconButton,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import UnifiedSelect from '../forms/UnifiedSelect';
import { integrationApi } from '../../api/integrationApi';

const STORE_ID_REGEX = /^[A-Z0-9-]+$/;
const PIN_CODE_REGEX = /^\d+$/;

function toCountryOption(item) {
  if (!item) return null;
  const sub = item.countrySubName || item.subName;
  const name = item.name || item.countryName || '';
  const code = String(item.code || item.countryCode || '');
  return {
    code,
    name,
    subName: sub || null,
    id: code,
    label: sub ? `${name} (${sub})` : name,
  };
}

function toStateOption(item) {
  if (!item) return null;
  const sub = item.stateSubName || item.subName;
  const name = item.name || item.stateName || '';
  const code = String(item.code || item.stateCode || '');
  return {
    code,
    name,
    subName: sub || null,
    id: code,
    countryCode: String(item.countryCode || ''),
    label: sub ? `${name} (${sub})` : name,
  };
}

function toCityOption(item) {
  if (!item) return null;
  const sub = item.citySubName || item.subName;
  const name = item.name || item.cityName || '';
  const code = String(item.code || item.cityCode || '');
  return {
    code,
    name,
    subName: sub || null,
    id: `${item.stateCode || ''}:${code}`,
    stateCode: String(item.stateCode || ''),
    label: sub ? `${name} (${sub})` : name,
  };
}

function FieldLabel({ label, required = false, optional = false }) {
  return (
    <Typography
      variant="body2"
      sx={{
        display: 'block',
        mb: 0.6,
        fontWeight: 600,
        fontSize: '0.825rem',
        color: '#0F172A',
      }}
    >
      {label}
      {required && (
        <Box component="span" sx={{ color: '#E11D48', ml: 0.35, fontWeight: 700 }}>
          *
        </Box>
      )}
      {optional && (
        <Box component="span" sx={{ color: '#64748B', fontWeight: 400, ml: 0.5 }}>
          (optional)
        </Box>
      )}
    </Typography>
  );
}

const inputSx = {
  '& .MuiOutlinedInput-root': {
    borderRadius: '8px',
    backgroundColor: '#FFFFFF',
    minHeight: 40,
    '& fieldset': {
      borderColor: '#E2E8F0',
    },
    '&:hover fieldset': {
      borderColor: '#94A3B8',
    },
    '&.Mui-focused fieldset': {
      borderColor: '#DC2626',
      borderWidth: 1.5,
    },
  },
  '& .MuiInputBase-input': {
    fontSize: '0.875rem',
    color: '#0F172A',
    py: 1,
    '&::placeholder': {
      color: '#94A3B8',
      opacity: 1,
    },
  },
};

const multilineInputSx = {
  '& .MuiOutlinedInput-root': {
    borderRadius: '8px',
    backgroundColor: '#FFFFFF',
    minHeight: '66px',
    alignItems: 'flex-start',
    py: 0.75,
    '& fieldset': {
      borderColor: '#E2E8F0',
    },
    '&:hover fieldset': {
      borderColor: '#94A3B8',
    },
    '&.Mui-focused fieldset': {
      borderColor: '#DC2626',
      borderWidth: 1.5,
    },
  },
  '& .MuiInputBase-input': {
    fontSize: '0.875rem',
    color: '#0F172A',
    '&::placeholder': {
      color: '#94A3B8',
      opacity: 1,
    },
  },
};

export default function CustomStoreModal({ open, onClose, onSubmit }) {
  const [storeId, setStoreId] = useState('');
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [pinCode, setPinCode] = useState('');

  const [selectedCountry, setSelectedCountry] = useState(null);
  const [selectedState, setSelectedState] = useState(null);
  const [selectedCity, setSelectedCity] = useState(null);

  const [countries, setCountries] = useState([]);
  const [states, setStates] = useState([]);
  const [cities, setCities] = useState([]);

  const [countryLoading, setCountryLoading] = useState(false);
  const [stateLoading, setStateLoading] = useState(false);
  const [cityLoading, setCityLoading] = useState(false);

  const [touched, setTouched] = useState({
    storeId: false,
    name: false,
    country: false,
    state: false,
    city: false,
    pinCode: false,
  });

  const resetForm = useCallback(() => {
    setStoreId('');
    setName('');
    setAddress('');
    setPinCode('');
    setSelectedCountry(null);
    setSelectedState(null);
    setSelectedCity(null);
    setStates([]);
    setCities([]);
    setTouched({
      storeId: false,
      name: false,
      country: false,
      state: false,
      city: false,
      pinCode: false,
    });
  }, []);

  // Fetch countries when modal opens
  useEffect(() => {
    if (!open) {
      resetForm();
      return;
    }

    let active = true;
    setCountryLoading(true);
    integrationApi
      .searchCountries('')
      .then(({ data }) => {
        if (!active) return;
        const mapped = Array.isArray(data)
          ? data.map(toCountryOption).filter(Boolean)
          : [];
        setCountries(mapped);
      })
      .catch(() => {
        if (active) setCountries([]);
      })
      .finally(() => {
        if (active) setCountryLoading(false);
      });

    return () => {
      active = false;
    };
  }, [open, resetForm]);

  // Handle Country selection / clearance
  const handleCountryChange = (nextCountry) => {
    setSelectedCountry(nextCountry);
    setTouched((prev) => ({ ...prev, country: true }));

    // Explicitly reset child selections and options
    setSelectedState(null);
    setSelectedCity(null);
    setStates([]);
    setCities([]);

    if (!nextCountry?.code) {
      return;
    }

    setStateLoading(true);
    integrationApi
      .searchStates('', [nextCountry.code])
      .then(({ data }) => {
        const mapped = Array.isArray(data)
          ? data.map(toStateOption).filter(Boolean)
          : [];
        setStates(mapped);
      })
      .catch(() => {
        setStates([]);
      })
      .finally(() => {
        setStateLoading(false);
      });
  };

  // Handle State selection / clearance
  const handleStateChange = (nextState) => {
    setSelectedState(nextState);
    setTouched((prev) => ({ ...prev, state: true }));

    // Explicitly reset city selection and options
    setSelectedCity(null);
    setCities([]);

    if (!nextState?.code) {
      return;
    }

    setCityLoading(true);
    integrationApi
      .searchCities('', [nextState.code])
      .then(({ data }) => {
        const mapped = Array.isArray(data)
          ? data.map(toCityOption).filter(Boolean)
          : [];
        setCities(mapped);
      })
      .catch(() => {
        setCities([]);
      })
      .finally(() => {
        setCityLoading(false);
      });
  };

  // Handle City selection / clearance
  const handleCityChange = (nextCity) => {
    setSelectedCity(nextCity);
    setTouched((prev) => ({ ...prev, city: true }));
  };

  // Store ID input handler: auto-uppercase and strip leading/trailing whitespace
  const handleStoreIdChange = (e) => {
    const raw = e.target.value;
    const uppercased = raw.toUpperCase().replace(/\s+/g, '');
    setStoreId(uppercased);
  };

  // Pin Code input handler: digits only
  const handlePinCodeChange = (e) => {
    const val = e.target.value;
    if (val === '' || PIN_CODE_REGEX.test(val)) {
      setPinCode(val);
    }
  };

  const handleBlur = (field) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  // Validation rules
  const trimmedStoreId = storeId.trim();
  const trimmedName = name.trim();
  const trimmedPinCode = pinCode.trim();

  const isStoreIdValid = Boolean(trimmedStoreId && STORE_ID_REGEX.test(trimmedStoreId));
  const isNameValid = Boolean(trimmedName);
  const isCountryValid = Boolean(selectedCountry);
  const isStateValid = Boolean(selectedState);
  const isCityValid = Boolean(selectedCity);
  const isPinCodeValid = !trimmedPinCode || (PIN_CODE_REGEX.test(trimmedPinCode) && trimmedPinCode.length <= 10);

  const isFormValid =
    isStoreIdValid &&
    isNameValid &&
    isCountryValid &&
    isStateValid &&
    isCityValid &&
    isPinCodeValid;

  // Error messages
  const storeIdError =
    touched.storeId && !trimmedStoreId
      ? 'Store ID is required'
      : touched.storeId && !STORE_ID_REGEX.test(trimmedStoreId)
      ? 'Only uppercase alphanumeric characters and hyphens allowed'
      : '';

  const nameError = touched.name && !trimmedName ? 'Store Name is required' : '';
  const countryError = touched.country && !selectedCountry ? 'Country is required' : '';
  const stateError = touched.state && !selectedState ? 'State is required' : '';
  const cityError = touched.city && !selectedCity ? 'City is required' : '';
  const pinCodeError =
    touched.pinCode && trimmedPinCode && !PIN_CODE_REGEX.test(trimmedPinCode)
      ? 'Pin code must be numeric only'
      : touched.pinCode && trimmedPinCode && trimmedPinCode.length > 10
      ? 'Pin code cannot exceed 10 digits'
      : '';

  const handleSubmit = () => {
    if (!isFormValid) return;

    // Map subName with fallback to name
    const region1 = selectedCountry.subName || selectedCountry.name;
    const region2 = selectedState.subName || selectedState.name;
    const region3 = selectedCity.subName || selectedCity.name;

    const parsedPinCode = trimmedPinCode ? parseInt(trimmedPinCode, 10) : null;

    onSubmit({
      storeId: trimmedStoreId,
      name: trimmedName,
      address: address.trim() || null,
      pinCode: parsedPinCode,
      region1,
      region2,
      region3,
      country: region1,
      state: region2,
      city: region3,
      countryCode: selectedCountry.code,
      countryName: selectedCountry.name,
      countrySubName: selectedCountry.subName,
      stateCode: selectedState.code,
      stateName: selectedState.name,
      stateSubName: selectedState.subName,
      cityCode: selectedCity.code,
      cityName: selectedCity.name,
      citySubName: selectedCity.subName,
      isCustom: true,
    });

    resetForm();
  };

  const handleClose = () => {
    resetForm();
    onClose?.();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            maxWidth: '680px',
            width: '100%',
            borderRadius: '16px',
            p: 3.5,
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.04)',
            overflow: 'visible',
          },
        },
      }}
    >
      {/* Header with Title, Subtitle, and Close Button */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1.25rem', color: '#0F172A', lineHeight: 1.2 }}>
            Add Custom Store
          </Typography>
          <Typography variant="body2" sx={{ color: '#64748B', fontSize: '0.875rem', mt: 0.5 }}>
            Add a store manually to include it in the agreement.
          </Typography>
        </Box>
        <IconButton
          size="small"
          onClick={handleClose}
          aria-label="close"
          sx={{ color: '#64748B', p: 0.5, '&:hover': { bgcolor: '#F1F5F9', color: '#0F172A' } }}
        >
          <CloseIcon sx={{ fontSize: 20 }} />
        </IconButton>
      </Box>

      {/* Form Fields Grid */}
      <Box component="form" autoComplete="off" onSubmit={(e) => e.preventDefault()}>
        <Grid container spacing={2.5}>
          {/* Row 1: Store ID & Store Name (2 columns) */}
          <Grid size={{ xs: 12, sm: 6 }}>
            <Box>
              <FieldLabel label="Store ID" required />
              <TextField
                placeholder="Store ID"
                value={storeId}
                onChange={handleStoreIdChange}
                onBlur={() => handleBlur('storeId')}
                fullWidth
                size="small"
                autoComplete="off"
                error={Boolean(storeIdError)}
                sx={inputSx}
                inputProps={{ maxLength: 50, autoComplete: 'off', 'data-lpignore': 'true', 'data-form-type': 'other' }}
              />
              <Typography
                variant="caption"
                sx={{
                  color: storeIdError ? '#DC2626' : '#64748B',
                  display: 'block',
                  mt: 0.5,
                  fontSize: '0.75rem',
                }}
              >
                {storeIdError || 'Uppercase alphanumeric & hyphen'}
              </Typography>
            </Box>
          </Grid>

          <Grid size={{ xs: 12, sm: 6 }}>
            <Box>
              <FieldLabel label="Store Name" required />
              <TextField
                placeholder="Store Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => handleBlur('name')}
                fullWidth
                size="small"
                autoComplete="off"
                error={Boolean(nameError)}
                sx={inputSx}
                inputProps={{ maxLength: 100, autoComplete: 'off', 'data-lpignore': 'true', 'data-form-type': 'other' }}
              />
              {nameError && (
                <Typography variant="caption" sx={{ color: '#DC2626', display: 'block', mt: 0.5, fontSize: '0.75rem' }}>
                  {nameError}
                </Typography>
              )}
            </Box>
          </Grid>

        {/* Row 2: Country, State, City (3 columns, fixed width on single line) */}
        <Grid size={{ xs: 4, sm: 4 }}>
          <Box sx={{ width: '100%' }}>
            <FieldLabel label="Country" required />
            <UnifiedSelect
              multiple={false}
              showOptionsOnEmpty
              options={countries}
              value={selectedCountry}
              onChange={handleCountryChange}
              placeholder="Select Country"
              loading={countryLoading}
              error={countryError}
              getOptionLabel={(opt) => (opt ? opt.label || opt.name : '')}
              isOptionEqualToValue={(a, b) => String(a?.code) === String(b?.code)}
              noOptionsText={countryLoading ? 'Loading countries…' : 'No countries found'}
            />
          </Box>
        </Grid>

        <Grid size={{ xs: 4, sm: 4 }}>
          <Box sx={{ width: '100%' }}>
            <FieldLabel label="State" required />
            <UnifiedSelect
              multiple={false}
              showOptionsOnEmpty
              options={states}
              value={selectedState}
              onChange={handleStateChange}
              disabled={!selectedCountry}
              placeholder="Select State"
              loading={stateLoading}
              error={stateError}
              getOptionLabel={(opt) => (opt ? opt.label || opt.name : '')}
              isOptionEqualToValue={(a, b) => String(a?.code) === String(b?.code)}
              noOptionsText={
                !selectedCountry
                  ? 'Select country first'
                  : stateLoading
                  ? 'Loading states…'
                  : 'No states found'
              }
            />
          </Box>
        </Grid>

        <Grid size={{ xs: 4, sm: 4 }}>
          <Box sx={{ width: '100%' }}>
            <FieldLabel label="City" required />
            <UnifiedSelect
              multiple={false}
              showOptionsOnEmpty
              options={cities}
              value={selectedCity}
              onChange={handleCityChange}
              disabled={!selectedState}
              placeholder="Select City"
              loading={cityLoading}
              error={cityError}
              getOptionLabel={(opt) => (opt ? opt.label || opt.name : '')}
              isOptionEqualToValue={(a, b) => String(a?.code) === String(b?.code)}
              noOptionsText={
                !selectedState
                  ? 'Select state first'
                  : cityLoading
                  ? 'Loading cities…'
                  : 'No cities found'
              }
            />
          </Box>
        </Grid>

        {/* Row 3: Pin Code & Address (2 columns) */}
        <Grid size={{ xs: 12, sm: 6 }}>
          <Box>
            <FieldLabel label="Pin Code" optional />
            <TextField
              placeholder="Pin Code"
              value={pinCode}
              onChange={handlePinCodeChange}
              onBlur={() => handleBlur('pinCode')}
              fullWidth
              size="small"
              autoComplete="off"
              error={Boolean(pinCodeError)}
              sx={inputSx}
              inputProps={{ maxLength: 10, inputMode: 'numeric', autoComplete: 'off', 'data-lpignore': 'true', 'data-form-type': 'other' }}
            />
            <Typography
              variant="caption"
              sx={{
                color: pinCodeError ? '#DC2626' : '#64748B',
                display: 'block',
                mt: 0.5,
                fontSize: '0.75rem',
              }}
            >
              {pinCodeError || 'Integer digits only'}
            </Typography>
          </Box>
        </Grid>

        <Grid size={{ xs: 12, sm: 6 }}>
          <Box>
            <FieldLabel label="Address" optional />
            <TextField
              placeholder="Address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              fullWidth
              multiline
              rows={2}
              size="small"
              autoComplete="off"
              sx={multilineInputSx}
              inputProps={{ maxLength: 500, autoComplete: 'off', 'data-lpignore': 'true', 'data-form-type': 'other' }}
            />
          </Box>
        </Grid>
      </Grid>
    </Box>

      {/* Footer Actions */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 1.5, mt: 4 }}>
        <Button
          onClick={handleClose}
          variant="outlined"
          sx={{
            borderRadius: '8px',
            textTransform: 'none',
            px: 2.75,
            py: 0.75,
            borderColor: '#E2E8F0',
            color: '#334155',
            fontWeight: 600,
            fontSize: '0.875rem',
            bgcolor: '#FFFFFF',
            boxShadow: 'none',
            '&:hover': {
              bgcolor: '#F8FAFC',
              borderColor: '#CBD5E1',
              boxShadow: 'none',
            },
          }}
        >
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={!isFormValid}
          sx={{
            borderRadius: '8px',
            textTransform: 'none',
            px: 2.75,
            py: 0.75,
            fontWeight: 600,
            fontSize: '0.875rem',
            bgcolor: '#DC2626',
            color: '#FFFFFF',
            boxShadow: 'none',
            '&:hover': {
              bgcolor: '#B91C1C',
              boxShadow: 'none',
            },
            '&.Mui-disabled': {
              bgcolor: '#E2E8F0',
              color: '#94A3B8',
            },
          }}
        >
          Add Store
        </Button>
      </Box>
    </Dialog>
  );
}
