import { useEffect, useState } from 'react';
import { Box, Grid, Typography } from '@mui/material';
import { integrationApi } from '../../../api/integrationApi';
import { useDebounce } from '../../../hooks/useDebounce';
import SearchableSelect from '../../../components/forms/SearchableSelect';
import WizardFieldAnchor from '../../../components/wizard/WizardFieldAnchor';

const VENDOR_DROPDOWN_LIMIT = 50;
const VENDOR_SEARCH_DEBOUNCE_MS = 500;

function toNumericId(id) {
  const parsed = Number(id);
  return Number.isNaN(parsed) ? id : parsed;
}

function normalizeVendor(item) {
  return {
    id: toNumericId(item.vendorId ?? item.id ?? item.accountId),
    vendorName: item.vendorName || item.name || '',
    company: item.company,
    state: item.state || item.company?.state || '',
  };
}

function formatVendorLabel(vendor) {
  if (!vendor) return '';
  const stateCode = vendor.state || vendor.company?.state || '';
  return `${stateCode}${stateCode != '' ? '-' : ''}${vendor.vendorName} (ID: ${vendor.id})`;
}

export default function Step2SupplyVendors({
  vendorIds = [],
  selectedVendors = [],
  onVendorChange,
  error,
  disabled = false,
}) {
  const [vendorSearchText, setVendorSearchText] = useState('');
  const [fetchedVendors, setFetchedVendors] = useState([]);
  const [resolvedVendors, setResolvedVendors] = useState([]);
  const [isVendorLoading, setIsVendorLoading] = useState(false);
  const [allStates, setAllStates] = useState([]);
  const [selectedStates, setSelectedStates] = useState([]);

  const debouncedVendorSearch = useDebounce(vendorSearchText, VENDOR_SEARCH_DEBOUNCE_MS);

  useEffect(() => {
    let mounted = true;
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
        console.error('Failed to load states', err);
      });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    const trimmedSearch = debouncedVendorSearch.trim();
    if (!trimmedSearch) {
      setFetchedVendors([]);
      return undefined;
    }

    const tokens = trimmedSearch.split(/[\s,]+/).filter(Boolean);
    const allNumeric = tokens.length > 0 && tokens.every(t => /^\d+$/.test(t));

    if (!allNumeric && trimmedSearch.length < 3) {
      return undefined;
    }

    let cancelled = false;
    setIsVendorLoading(true);

    if (allNumeric && tokens.length > 1) {
      const ids = tokens.map(Number);
      integrationApi.getVendorsByIds(ids)
        .then((response) => {
          if (cancelled) return;
          const items = Array.isArray(response.data) ? response.data : [];
          setFetchedVendors(items.map(normalizeVendor).slice(0, VENDOR_DROPDOWN_LIMIT));
        })
        .catch((err) => {
          if (!cancelled) {
            console.error('Failed to fetch pasted vendor IDs', err);
            setFetchedVendors([]);
          }
        })
        .finally(() => {
          if (!cancelled) setIsVendorLoading(false);
        });
    } else {
      const stateCodes = selectedStates.map(s => s.code);
      integrationApi.searchVendors(trimmedSearch, stateCodes)
        .then((response) => {
          if (cancelled) return;
          const items = Array.isArray(response.data) ? response.data : [];
          setFetchedVendors(items.map(normalizeVendor).slice(0, VENDOR_DROPDOWN_LIMIT));
        })
        .catch((err) => {
          if (!cancelled) {
            console.error('Failed to fetch vendors', err);
            setFetchedVendors([]);
          }
        })
        .finally(() => {
          if (!cancelled) setIsVendorLoading(false);
        });
    }

    return () => { cancelled = true; };
  }, [debouncedVendorSearch, selectedStates]);

  useEffect(() => {
    if (!vendorIds?.length) {
      setResolvedVendors([]);
      return undefined;
    }

    let hasMissingState = false;
    if (selectedVendors.length > 0) {
      const hydrated = selectedVendors
        .map(normalizeVendor)
        .filter((vendor) => vendorIds.some((id) => toNumericId(id) === vendor.id));
        
      hasMissingState = hydrated.some((v) => !v.state);
      
      if (!hasMissingState && hydrated.length === vendorIds.length) {
        setResolvedVendors(hydrated);
        return undefined;
      } else {
        // Show what we have while loading the full details
        setResolvedVendors(hydrated);
      }
    }

    let cancelled = false;
    integrationApi.getVendorsByIds(vendorIds)
      .then((response) => {
        if (cancelled) return;
        const items = Array.isArray(response.data) ? response.data : [];
        const normalized = items.map(normalizeVendor);
        setResolvedVendors(normalized);
        if (hasMissingState || selectedVendors.length !== vendorIds.length) {
          onVendorChange(normalized);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error('Failed to hydrate vendors:', err);
          setResolvedVendors(vendorIds.map((id) => ({ id, vendorName: `Vendor ${id}` })));
        }
      });

    return () => { cancelled = true; };
  }, [vendorIds, selectedVendors]);

  const handleVendorChange = (selected) => {
    const normalized = (Array.isArray(selected) ? selected : []).map(normalizeVendor);
    setResolvedVendors(normalized);
    onVendorChange(normalized);
  };

  const handleSearchInput = (query) => {
    setVendorSearchText(query ?? '');
  };



  return (
    <Box sx={{ mb: 0 }}>
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 5 }}>
          <SearchableSelect
            isMulti
            label="State Filter"
            placeholder="All States"
            options={allStates}
            value={selectedStates}
            onChange={(val) => setSelectedStates(val || [])}
            isOptionEqualToValue={(a, b) => a?.code === b?.code}
            disabled={disabled}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 7 }}>
          <WizardFieldAnchor field="supplyVendors" error={error}>
            <SearchableSelect
              label="Supply Vendors"
              placeholder="Search vendors by name or ID…"
              isMulti
              options={fetchedVendors}
              value={resolvedVendors}
              onChange={handleVendorChange}
              onSearch={handleSearchInput}
              getOptionLabel={formatVendorLabel}
              renderOption={(vendor) => (
                <Box sx={{ display: 'flex', flexDirection: 'column', py: 0.25 }}>
                  <Typography variant="body2">{vendor.state || vendor.company?.state || 'NA'}-{vendor.vendorName}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    ID: {vendor.id}
                  </Typography>
                </Box>
              )}
              isOptionEqualToValue={(option, value) => toNumericId(option.id) === toNumericId(value.id)}
              loading={isVendorLoading}
              maxVisibleChips={2}
              required
              disabled={disabled}
            />
          </WizardFieldAnchor>
        </Grid>
      </Grid>
    </Box>
  );
}
