import { useEffect } from 'react';
import {
  Autocomplete, Box, Typography, Grid, FormControl, InputLabel, Select, MenuItem,
  TextField,
} from '@mui/material';

import { ASSET_TYPE_OPTIONS } from '../../../constants/assetTypes';
import WizardFieldAnchor from '../../../components/wizard/WizardFieldAnchor';

const ASSET_CATEGORY_OPTIONS = [
  { value: 'PHYSICAL_ASSET', label: 'Physical Asset' },
  { value: 'ACTIVITY', label: 'Activity' },
];

export default function AssetRentalFields({
  asset,
  stateOptions,
  selectedStateIds,
  onUpdateAsset,
  onUpdateDetails,
  fieldErrors = {},
}) {
  const selectedStates = stateOptions.filter((state) => selectedStateIds.includes(state.id));
  const isActivityCategory = asset?.assetCategory === 'ACTIVITY';

  useEffect(() => {
    if (isActivityCategory && asset?.assetType) {
      onUpdateAsset({ assetType: null });
    }
  }, [isActivityCategory, asset?.assetType, onUpdateAsset]);

  const handleCategoryChange = (nextCategory) => {
    if (nextCategory === 'ACTIVITY') {
      onUpdateAsset({ assetCategory: nextCategory, assetType: null });
      return;
    }
    onUpdateAsset({ assetCategory: nextCategory });
  };

  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 2 }}>
        Asset Rental Details
      </Typography>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, sm: 6 }}>
          <FormControl fullWidth size="small" required>
            <InputLabel>Asset Category</InputLabel>
            <Select
              value={asset?.assetCategory || 'PHYSICAL_ASSET'}
              label="Asset Category *"
              onChange={(e) => handleCategoryChange(e.target.value)}
            >
              {ASSET_CATEGORY_OPTIONS.map((option) => (
                <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        {!isActivityCategory && (
          <Grid size={{ xs: 12, sm: 6 }}>
            <FormControl fullWidth size="small" required>
              <InputLabel>Asset Type</InputLabel>
              <Select
                value={asset?.assetType || ''}
                label="Asset Type *"
                onChange={(e) => onUpdateAsset({ assetType: e.target.value })}
              >
                {ASSET_TYPE_OPTIONS.map((type) => (
                  <MenuItem key={type} value={type}>{type}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
        )}

        <Grid size={12}>
          <Autocomplete
            multiple
            options={stateOptions}
            value={selectedStates}
            getOptionLabel={(option) => option.stateName}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            onChange={(_, newValue) => onUpdateDetails({ stateIds: newValue.map((state) => state.id) })}
            renderInput={(params) => (
              <TextField {...params} label="Location (States) *" size="small" placeholder="Select states" />
            )}
          />
        </Grid>

        <Grid size={{ xs: 12, sm: 6 }}>
          <WizardFieldAnchor field="storeCount" error={fieldErrors.storeCount}>
            <TextField
              label="Number of Participating Stores *"
              type="number"
              fullWidth
              size="small"
              value={asset?.storeCount ?? ''}
              onChange={(e) => {
                const { value } = e.target;
                if (value === '') {
                  onUpdateAsset({ storeCount: '' });
                  return;
                }
                const parsed = Number(value);
                if (!Number.isFinite(parsed)) return;
                onUpdateAsset({ storeCount: String(Math.trunc(parsed)) });
              }}
              error={Boolean(fieldErrors.storeCount)}
              helperText={fieldErrors.storeCount || 'Must be a whole number greater than 0'}
              slotProps={{ htmlInput: { min: 1, step: 1 } }}
            />
          </WizardFieldAnchor>
        </Grid>
      </Grid>
    </Box>
  );
}
