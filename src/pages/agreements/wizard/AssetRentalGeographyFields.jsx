import { Box, Grid } from '@mui/material';
import PartnerLocationFields from './PartnerLocationFields';

/** @deprecated Asset Rentals no longer use partner geography; kept for any residual imports. */
export default function AssetRentalGeographyFields({
  details = {},
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
      </Grid>
    </Box>
  );
}
