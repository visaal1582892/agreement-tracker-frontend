import { useEffect } from 'react';
import {
  Box, Grid, FormControl, InputLabel, Select, MenuItem, TextField,
} from '@mui/material';
import WizardFieldAnchor from '../../../components/wizard/WizardFieldAnchor';
import { ASSET_TYPE_OPTIONS } from '../../../constants/assetTypes';

const ASSET_CATEGORY_OPTIONS = [
  { value: 'PHYSICAL_ASSET', label: 'Physical Asset' },
  { value: 'ACTIVITY', label: 'Activity' },
];

export default function AssetRentalScopeFields({ asset, onUpdateAsset, fieldErrors = {} }) {
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
    <Box>
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, sm: 6 }}>
          <WizardFieldAnchor field="assetCategory" error={fieldErrors.assetCategory}>
            <FormControl fullWidth size="small" required error={Boolean(fieldErrors.assetCategory)}>
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
          </WizardFieldAnchor>
        </Grid>

        {!isActivityCategory && (
          <Grid size={{ xs: 12, sm: 6 }}>
            <WizardFieldAnchor field="assetType" error={fieldErrors.assetType}>
              <FormControl fullWidth size="small" required error={Boolean(fieldErrors.assetType)}>
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
            </WizardFieldAnchor>
          </Grid>
        )}

        <Grid size={12}>
          <TextField
            label="Description / Remarks"
            multiline
            rows={2}
            fullWidth
            size="small"
            value={asset?.remarks ?? ''}
            onChange={(e) => onUpdateAsset({ remarks: e.target.value })}
            slotProps={{ htmlInput: { maxLength: 500 } }}
          />
        </Grid>
      </Grid>
    </Box>
  );
}
