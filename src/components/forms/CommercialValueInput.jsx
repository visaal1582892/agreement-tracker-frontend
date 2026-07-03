import {
  FormControl, FormHelperText, InputAdornment, MenuItem, Select, TextField,
} from '@mui/material';

const TYPE_OPTIONS = [
  { value: 'PERCENTAGE', label: 'Percentage %'  },
  { value: 'FIXED', label: 'Fixed ₹' },
];

export default function CommercialValueInput({
  label = 'Commercial Value',
  value,
  onChangeValue,
  type = 'FIXED',
  onChangeType,
  error = false,
  helperText,
  disabled = false,
  required = false,
  fullWidth = true,
  size = 'small',
  ...textFieldProps
}) {
  return (
    <FormControl fullWidth={fullWidth} error={error} disabled={disabled}>
      <TextField
        label={label}
        type="number"
        fullWidth={fullWidth}
        size={size}
        required={required}
        value={value ?? ''}
        onChange={(e) => onChangeValue?.(e.target.value)}
        error={error}
        disabled={disabled}
        slotProps={{
          input: {
            endAdornment: (
              <InputAdornment position="end" sx={{ ml: 0 }}>
                <Select
                  value={type}
                  onChange={(e) => onChangeType?.(e.target.value)}
                  variant="standard"
                  disableUnderline
                  disabled={disabled}
                  sx={{
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    minWidth: 44,
                    '& .MuiSelect-select': {
                      py: 0.25,
                      pr: '24px !important',
                      pl: 0.5,
                    },
                  }}
                  MenuProps={{ disableScrollLock: true }}
                >
                  {TYPE_OPTIONS.map((opt) => (
                    <MenuItem key={opt.value} value={opt.value} dense>
                      {opt.label}
                    </MenuItem>
                  ))}
                </Select>
              </InputAdornment>
            ),
          },
        }}
        {...textFieldProps}
      />
      {helperText ? <FormHelperText>{helperText}</FormHelperText> : null}
    </FormControl>
  );
}
