import { Box, Grid, TextField } from '@mui/material';
import WizardFieldAnchor from '../../../components/wizard/WizardFieldAnchor';
import PartnerLocationFields from './PartnerLocationFields';

export default function AssetRentalGeographyFields({
  asset,
  details = {},
  onUpdateAsset,
  onUpdateDetails,
  fieldErrors = {},
  onClearFieldError,
}) {
  return (
    <Box>
      <Grid container spacing={3}>
        <Grid size={12}>
          <PartnerLocationFields
            details={details}
            onUpdateDetails={onUpdateDetails}
            fieldErrors={fieldErrors}
            onClearFieldError={onClearFieldError}
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
