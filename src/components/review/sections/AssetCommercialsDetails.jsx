import React from 'react';
import { Box, Typography, Grid } from '@mui/material';
import { formatAssetMoney } from '../../../utils/numberFormatting';
import AssetPayoutPeriodsTable from './AssetPayoutPeriodsTable';

export default function AssetCommercialsDetails({
  agreement,
  assetStoreMappings = [],
  versionId = null,
}) {
  const assetCategory = agreement?.assetCategory;
  const assetCategoryLabel = assetCategory === 'ACTIVITY' ? 'Activity / Promotion'
    : assetCategory === 'PHYSICAL_ASSET' ? 'Physical Asset'
      : '—';

  const commercialStructure = agreement?.commercialStructure;
  const isPayoutPerStore = commercialStructure === 'PAYOUT_PER_STORE';

  const payoutModeLabel = isPayoutPerStore ? 'Payout per Store'
    : commercialStructure === 'FLAT' ? 'Flat Payout'
      : '—';

  return (
    <Box>
      <Grid container spacing={3}>
        <Grid item xs={6} sm={3}>
          <Typography variant="caption" color="text.secondary">Asset Category</Typography>
          <Typography variant="body2">{assetCategoryLabel}</Typography>
        </Grid>
        {assetCategory !== 'ACTIVITY' && (
          <Grid item xs={6} sm={3}>
            <Typography variant="caption" color="text.secondary">Asset Type</Typography>
            <Typography variant="body2">{agreement?.assetType || '—'}</Typography>
          </Grid>
        )}
        <Grid item xs={6} sm={3}>
          <Typography variant="caption" color="text.secondary">Payout Mode</Typography>
          <Typography variant="body2">{payoutModeLabel}</Typography>
        </Grid>
        {!isPayoutPerStore && (
          <Grid item xs={6} sm={3}>
            <Typography variant="caption" color="text.secondary">Flat Payout Amount</Typography>
            <Typography variant="body2">{formatAssetMoney(agreement?.commercialValue)}</Typography>
          </Grid>
        )}
      </Grid>

      {isPayoutPerStore && (
        <Box sx={{ mt: 3, maxWidth: { xs: '100%', sm: 350 } }}>
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.5 }}>
            Payout Schedule
          </Typography>
          {(!agreement?.assetPayoutPeriods || agreement.assetPayoutPeriods.length === 0) ? (
            <Typography variant="body2">—</Typography>
          ) : (
            <AssetPayoutPeriodsTable periods={agreement.assetPayoutPeriods} />
          )}
        </Box>
      )}

      {agreement?.notes && (
        <Box sx={{ mt: 2.5 }}>
          <Typography variant="caption" color="text.secondary">Remarks</Typography>
          <Typography variant="body2">{agreement.notes}</Typography>
        </Box>
      )}
    </Box>
  );
}
