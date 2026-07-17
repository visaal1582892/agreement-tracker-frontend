import { useEffect, useState } from 'react';
import { Box, Grid, Typography } from '@mui/material';
import { integrationApi } from '../../../api/integrationApi';
import { useDebounce } from '../../../hooks/useDebounce';
import SearchableSelect from '../../../components/forms/SearchableSelect';
import BulkVendorInput from '../../../components/forms/BulkVendorInput';
import WizardFieldAnchor from '../../../components/wizard/WizardFieldAnchor';

const VENDOR_DROPDOWN_LIMIT = 50;
const VENDOR_SEARCH_DEBOUNCE_MS = 500;

function toNumericId(id) {
  const parsed = Number(id);
  return Number.isNaN(parsed) ? id : parsed;
}

function normalizeVendor(item) {
  return {
    id: toNumericId(item.vendorId ?? item.id),
    vendorName: item.vendorName || '',
  };
}

function formatVendorLabel(vendor) {
  if (!vendor) return '';
  return `${vendor.vendorName} (ID: ${vendor.id})`;
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

  const debouncedVendorSearch = useDebounce(vendorSearchText, VENDOR_SEARCH_DEBOUNCE_MS);

  useEffect(() => {
    const trimmedSearch = debouncedVendorSearch.trim();
    if (!trimmedSearch) {
      setFetchedVendors([]);
      return undefined;
    }

    const isNumeric = /^\d+$/.test(trimmedSearch);
    if (!isNumeric && trimmedSearch.length < 3) {
      return undefined;
    }

    let cancelled = false;
    setIsVendorLoading(true);

    integrationApi.searchVendors(trimmedSearch)
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

    return () => { cancelled = true; };
  }, [debouncedVendorSearch]);

  useEffect(() => {
    if (!vendorIds?.length) {
      setResolvedVendors([]);
      return undefined;
    }

    if (selectedVendors.length > 0) {
      const hydrated = selectedVendors
        .map(normalizeVendor)
        .filter((vendor) => vendorIds.some((id) => toNumericId(id) === vendor.id));
      setResolvedVendors(hydrated);
      return undefined;
    }

    let cancelled = false;
    integrationApi.getVendorsByIds(vendorIds)
      .then((response) => {
        if (cancelled) return;
        const items = Array.isArray(response.data) ? response.data : [];
        setResolvedVendors(items.map(normalizeVendor));
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
        <Grid size={12}>
          <WizardFieldAnchor field="supplyVendors" error={error}>
            <SearchableSelect
              label="Supply Vendors *"
              placeholder="Search vendors by name or ID…"
              isMulti
              options={fetchedVendors}
              value={resolvedVendors}
              onChange={handleVendorChange}
              onSearch={handleSearchInput}
              getOptionLabel={formatVendorLabel}
              renderOption={(vendor) => (
                <Box sx={{ display: 'flex', flexDirection: 'column', py: 0.25 }}>
                  <Typography variant="body2">{vendor.vendorName}</Typography>
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
            {!disabled && (
              <BulkVendorInput
                selectedVendors={resolvedVendors}
                onChange={handleVendorChange}
              />
            )}
          </WizardFieldAnchor>
        </Grid>
      </Grid>
    </Box>
  );
}
