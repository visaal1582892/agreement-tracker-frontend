import {
  Box, Typography, Grid, TextField, RadioGroup, FormControlLabel, Radio, InputAdornment,
} from '@mui/material';
import WizardFieldAnchor from '../../../components/wizard/WizardFieldAnchor';
import AssetPayoutScheduleFields from './AssetPayoutScheduleFields';

const DEFAULT_PERIOD = { periodMonths: '', payoutPerStore: '' };

export default function AssetPayoutFields({
  asset,
  onUpdateAsset,
  hideSectionTitle = false,
  fieldErrors = {},
}) {
  const payoutMode = asset?.payoutMode || 'FLAT';
  const periods = asset?.assetPayoutPeriods ?? [];

  const handlePayoutModeChange = (nextMode) => {
    if (nextMode === 'FLAT') {
      onUpdateAsset({ payoutMode: nextMode, flatPayout: asset?.flatPayout ?? '', assetPayoutPeriods: [] });
      return;
    }
    onUpdateAsset({
      payoutMode: nextMode,
      flatPayout: '',
      assetPayoutPeriods: periods.length > 0 ? periods : [{ ...DEFAULT_PERIOD }],
    });
  };

  return (
    <Box>
      {!hideSectionTitle && (
        <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
          Asset Payout Structure *
        </Typography>
      )}
      <RadioGroup
        row
        value={payoutMode}
        onChange={(e) => handlePayoutModeChange(e.target.value)}
        sx={{ mb: 2 }}
      >
        <FormControlLabel value="FLAT" control={<Radio size="small" />} label="Flat Payout" />
        <FormControlLabel value="PER_STORE" control={<Radio size="small" />} label="Payout per Store" />
      </RadioGroup>

      {payoutMode === 'FLAT' ? (
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <WizardFieldAnchor field="flatPayout" error={fieldErrors.flatPayout}>
              <TextField
                label="Flat Payout *"
                type="number"
                fullWidth
                size="small"
                value={asset?.flatPayout ?? ''}
                onChange={(e) => onUpdateAsset({ flatPayout: e.target.value })}
                error={Boolean(fieldErrors.flatPayout)}
                slotProps={{
                  input: {
                    startAdornment: <InputAdornment position="start">₹</InputAdornment>,
                  },
                  htmlInput: { min: 0, step: '0.01' },
                }}
              />
            </WizardFieldAnchor>
          </Grid>
        </Grid>
      ) : (
        <AssetPayoutScheduleFields
          periods={periods}
          onChange={(nextPeriods) => onUpdateAsset({ assetPayoutPeriods: nextPeriods })}
          fieldError={fieldErrors.assetPayoutPeriods}
        />
      )}
    </Box>
  );
}
