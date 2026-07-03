import { useEffect } from 'react';
import { Grid, FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import CommercialValueInput from '../../../components/forms/CommercialValueInput';
import { PAYOUT_FREQUENCY, PAYOUT_FREQUENCY_OPTIONS, resolveFlatBaselineFrequency } from '../../../constants/commercialStructure';

export default function DataFeeCommercialFields({ commercials, onUpdate }) {
  useEffect(() => {
    if (commercials.flatBaselineFrequency) return;
    onUpdate({
      commercialStructure: 'FLAT',
      enableFlatBaseline: true,
      enableSlabIncentives: false,
      flatBaselineFrequency: PAYOUT_FREQUENCY.MONTHLY,
    });
  }, [commercials.flatBaselineFrequency, onUpdate]);

  const flatBaselineFrequency = resolveFlatBaselineFrequency(commercials);

  return (
    <Grid container spacing={2}>
      <Grid size={{ xs: 12, sm: 6 }}>
        <CommercialValueInput
          label="Flat Payout"
          required
          value={commercials.commercialValue}
          onChangeValue={(value) => onUpdate({ commercialValue: value })}
          type={commercials.valueType || commercials.flatValueType || 'FIXED'}
          onChangeType={(type) => onUpdate({
            valueType: type,
            flatValueType: type,
            enableFlatBaseline: true,
            enableSlabIncentives: false,
            commercialStructure: 'FLAT',
          })}
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6 }}>
        <FormControl fullWidth size="small" required>
          <InputLabel>Payout Frequency</InputLabel>
          <Select
            value={flatBaselineFrequency}
            label="Payout Frequency *"
            onChange={(e) => onUpdate({ flatBaselineFrequency: e.target.value })}
          >
            {PAYOUT_FREQUENCY_OPTIONS.map((option) => (
              <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Grid>
    </Grid>
  );
}
