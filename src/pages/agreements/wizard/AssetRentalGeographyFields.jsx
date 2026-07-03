import { Autocomplete, Box, Grid, TextField } from '@mui/material';
import WizardFieldAnchor from '../../../components/wizard/WizardFieldAnchor';

export default function AssetRentalGeographyFields({
  asset,
  stateOptions,
  selectedStateIds,
  onUpdateAsset,
  onUpdateDetails,
  fieldErrors = {},
}) {
  const selectedStates = stateOptions.filter((state) => selectedStateIds.includes(state.id));

  return (
    <Box>
      <Grid container spacing={3}>
        <Grid size={12}>
          <WizardFieldAnchor field="states" error={fieldErrors.states}>
            <Autocomplete
              multiple
              options={stateOptions}
              value={selectedStates}
              getOptionLabel={(option) => option.stateName}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              onChange={(_, newValue) => onUpdateDetails({ stateIds: newValue.map((state) => state.id) })}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Region / States *"
                  size="small"
                  placeholder="Select states"
                  error={Boolean(fieldErrors.states)}
                />
              )}
            />
          </WizardFieldAnchor>
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
