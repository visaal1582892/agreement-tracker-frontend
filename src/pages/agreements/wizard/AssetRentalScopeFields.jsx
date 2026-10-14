import { useEffect, useMemo } from 'react';
import {
  Box, Grid, FormControl, InputLabel, Select, MenuItem,
} from '@mui/material';
import WizardFieldAnchor from '../../../components/wizard/WizardFieldAnchor';
import { useAssetTypes } from '../../../hooks/useAssetTypes';

const ASSET_CATEGORY_OPTIONS = [
  { value: 'PHYSICAL_ASSET', label: 'Physical Asset' },
  { value: 'ACTIVITY', label: 'Activity' },
];

export default function AssetRentalScopeFields({ asset, onUpdateAsset, fieldErrors = {} }) {
  const isActivityCategory = asset?.assetCategory === 'ACTIVITY';
  const { assetTypes } = useAssetTypes();

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

  const assetTypeOptions = useMemo(() => {
    const baseList = (assetTypes && assetTypes.length > 0)
      ? assetTypes.map((t) => (typeof t === 'string' ? t.trim() : (t?.name || '').trim()))
      : [];

    const uniqueMap = new Map();
    baseList.forEach((name) => {
      const trimmed = (name || '').trim();
      if (trimmed && !uniqueMap.has(trimmed.toLowerCase())) {
        uniqueMap.set(trimmed.toLowerCase(), trimmed);
      }
    });

    const existing = (asset?.assetType || '').trim();
    if (existing) {
      const existingLower = existing.toLowerCase();
      if (!uniqueMap.has(existingLower)) {
        uniqueMap.set(existingLower, existing);
      }
    }

    return Array.from(uniqueMap.values());
  }, [assetTypes, asset?.assetType]);

  const selectedAssetType = useMemo(() => {
    const current = (asset?.assetType || '').trim();
    if (!current) return '';
    const match = assetTypeOptions.find((opt) => opt.toLowerCase() === current.toLowerCase());
    return match || current;
  }, [assetTypeOptions, asset?.assetType]);

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
                  value={selectedAssetType}
                  label="Asset Type *"
                  onChange={(e) => onUpdateAsset({ assetType: e.target.value })}
                >
                  {assetTypeOptions.map((type) => (
                    <MenuItem key={type} value={type}>{type}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </WizardFieldAnchor>
          </Grid>
        )}

      </Grid>
    </Box>
  );
}
