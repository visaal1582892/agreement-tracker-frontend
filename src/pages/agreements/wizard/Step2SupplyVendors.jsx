import { useCallback, useEffect, useState } from 'react';
import { Box, Grid } from '@mui/material';
import axiosInstance from '../../../api/axiosInstance';
import { ENDPOINTS } from '../../../config/endpoints';
import SearchableSelect from '../../../components/forms/SearchableSelect';
import BulkVendorInput from '../../../components/forms/BulkVendorInput';
import WizardFieldAnchor from '../../../components/wizard/WizardFieldAnchor';

export default function Step2SupplyVendors({ vendorIds = [], onVendorChange, error }) {
  const [vendorOptions, setVendorOptions] = useState([]);
  const [selectedVendors, setSelectedVendors] = useState([]);
  const [loadingVendors, setLoadingVendors] = useState(false);

  const searchVendors = useCallback(async (query) => {
    setLoadingVendors(true);
    try {
      const { data } = await axiosInstance.get(ENDPOINTS.VENDORS, {
        params: query?.trim() ? { search: query.trim() } : {},
      });
      setVendorOptions(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to search vendors:', err);
      setVendorOptions([]);
    } finally {
      setLoadingVendors(false);
    }
  }, []);

  useEffect(() => {
    if (!vendorIds?.length) {
      setSelectedVendors([]);
      return;
    }
    axiosInstance
      .get(ENDPOINTS.VENDORS, { params: { ids: vendorIds.join(',') } })
      .then(({ data }) => {
        const resolved = (Array.isArray(data) ? data : []).filter((vendor) => vendorIds.includes(vendor.id));
        setSelectedVendors(resolved);
      })
      .catch((err) => console.error('Failed to hydrate vendors:', err));
  }, [vendorIds]);

  const handleVendorChange = (selected) => {
    setSelectedVendors(selected);
    onVendorChange(selected.map((vendor) => vendor.id));
  };

  return (
    <Box sx={{ mb: 0 }}>
      <Grid container spacing={3}>
        <Grid size={12}>
          <WizardFieldAnchor field="supplyVendors" error={error}>
            <SearchableSelect
              label="Supply Vendors *"
              placeholder="Search vendors by name or code…"
              isMulti
              options={vendorOptions}
              value={selectedVendors}
              onChange={handleVendorChange}
              onSearch={searchVendors}
              getOptionLabel={(vendor) => `${vendor.vendorCode} — ${vendor.vendorName}`}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              loading={loadingVendors}
              maxVisibleChips={2}
              required
            />
            <BulkVendorInput selectedVendors={selectedVendors} onChange={handleVendorChange} />
          </WizardFieldAnchor>
        </Grid>
      </Grid>
    </Box>
  );
}
