import { Box, FormHelperText } from '@mui/material';
import { BRAND } from '../../config/theme';

export default function WizardFieldAnchor({
  field,
  error,
  children,
  sx,
}) {
  const hasError = Boolean(error);

  return (
    <Box
      data-wizard-field={field}
      className={hasError ? 'has-error' : undefined}
      sx={{
        ...sx,
        ...(hasError && {
          '& .MuiOutlinedInput-root:not(.Mui-disabled) fieldset': {
            borderColor: BRAND.red,
          },
          '& .MuiOutlinedInput-root.Mui-focused fieldset': {
            borderColor: BRAND.red,
          },
        }),
      }}
    >
      {children}
      {hasError && (
        <FormHelperText error sx={{ mx: 0, mt: 0.5 }}>
          {error}
        </FormHelperText>
      )}
    </Box>
  );
}
