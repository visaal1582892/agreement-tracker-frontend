import { useEffect, useState } from 'react';
import {
  Grid, FormControl, InputLabel, Select, MenuItem, TextField,
} from '@mui/material';
import axiosInstance from '../../../api/axiosInstance';
import { ENDPOINTS } from '../../../config/endpoints';
import { BRAND } from '../../../config/theme';
import DateRangeFields from '../../../components/forms/DateRangeFields';
import WizardSectionCard from '../../../components/wizard/WizardSectionCard';
import { getIncomeTypeDisplayName } from '../../../constants/incomeTypeNames';

const notesFieldSx = {
  '& .MuiOutlinedInput-root': {
    '& fieldset': { borderColor: BRAND.borderLight },
    '&:hover fieldset': { borderColor: '#94A3B8' },
    '&.Mui-focused fieldset': { borderColor: BRAND.red, borderWidth: 2 },
  },
};

export default function Step1FoundationalFields({
  agreement,
  onUpdateDetails,
}) {
  const [incomeTypes, setIncomeTypes] = useState([]);
  const [agreementTypes, setAgreementTypes] = useState([]);
  const details = agreement.details;

  useEffect(() => {
    axiosInstance.get(ENDPOINTS.INCOME_TYPES).then(({ data }) => setIncomeTypes(data));
    axiosInstance.get(ENDPOINTS.AGREEMENT_TYPES).then(({ data }) => setAgreementTypes(data));
  }, []);

  const handleIncomeTypeChange = (selectedId) => {
    const selected = incomeTypes.find((type) => String(type.id) === String(selectedId));
    onUpdateDetails({
      incomeTypeId: selectedId,
      incomeTypeName: selected?.name ?? null,
    });
  };

  return (
    <>
      <WizardSectionCard
        title="Agreement Classification"
        description="Income type drives which fields appear in later steps."
      >
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <FormControl fullWidth size="small">
              <InputLabel required>Income Type</InputLabel>
              <Select
                value={details.incomeTypeId || ''}
                label="Income Type *"
                onChange={(e) => handleIncomeTypeChange(e.target.value)}
              >
                {incomeTypes.map((type) => (
                  <MenuItem key={type.id} value={type.id}>{getIncomeTypeDisplayName(type.name)}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <FormControl fullWidth size="small">
              <InputLabel required>Agreement Type</InputLabel>
              <Select
                value={details.agreementTypeId || ''}
                label="Agreement Type *"
                onChange={(e) => onUpdateDetails({ agreementTypeId: e.target.value })}
              >
                {agreementTypes.map((type) => (
                  <MenuItem key={type.id} value={type.id}>{type.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </WizardSectionCard>

      <WizardSectionCard
        title="Duration & Notes"
        description="Contract dates and tenure drive commercial frequency options in Step 3."
      >
        <Grid container spacing={3}>
          <Grid size={12}>
            <DateRangeFields
              startDate={details.startDate}
              expiryDate={details.expiryDate}
              onChange={(fields) => onUpdateDetails(fields)}
            />
          </Grid>
          <Grid size={12}>
            <TextField
              label="Notes (optional)"
              multiline
              rows={2}
              fullWidth
              size="small"
              value={details.notes || ''}
              onChange={(e) => onUpdateDetails({ notes: e.target.value })}
              slotProps={{ htmlInput: { maxLength: 1000 } }}
              sx={notesFieldSx}
            />
          </Grid>
        </Grid>
      </WizardSectionCard>
    </>
  );
}
