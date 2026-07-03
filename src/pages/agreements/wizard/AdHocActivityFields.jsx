import { useEffect } from 'react';
import { Box, Typography } from '@mui/material';
import Step2Products from './Step2Products';
import { ADHOC_SUB_TYPES, ADHOC_SUB_TYPE_LABELS } from '../../../constants/adhocSubTypes';

export default function AdHocActivityFields({
  state,
  details,
  updateProductRules,
  onUpdateDetails,
  section = 'scope',
  fieldErrors = {},
}) {
  useEffect(() => {
    if (details.adhocSubType !== ADHOC_SUB_TYPES.QPS) {
      onUpdateDetails({ adhocSubType: ADHOC_SUB_TYPES.QPS, quantityCap: '' });
    }
  }, [details.adhocSubType, onUpdateDetails]);

  if (section === 'geography') {
    return null;
  }

  return (
    <Box>
      <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>
        Ad-Hoc Activity Type
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {ADHOC_SUB_TYPE_LABELS.QPS}
      </Typography>

      <Step2Products
        state={state}
        updateProductRules={updateProductRules}
        error={fieldErrors.products}
        info="Select vendors to load products. Add manufacturers to reveal divisions and narrow the product list. Configure flat baseline and slab incentives in Step 3 — QPS locks payout frequency to One-Time."
      />
    </Box>
  );
}
