import { useEffect } from 'react';
import {
  Autocomplete, Box, Typography, Grid, FormControl, InputLabel, Select, MenuItem,
  TextField,
} from '@mui/material';

import { ASSET_TYPE_OPTIONS } from '../../../constants/assetTypes';
import WizardFieldAnchor from '../../../components/wizard/WizardFieldAnchor';
import { toMuiTextFieldSlotProps } from '../../../utils/muiDomCompat';

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
              <TextField
                {...toMuiTextFieldSlotProps(params)}
                label="Location (States) *"
                size="small"
                placeholder="Select states"
              />
            )}
          />
        </Grid>
      </Grid>
    </Box>
  );
}
