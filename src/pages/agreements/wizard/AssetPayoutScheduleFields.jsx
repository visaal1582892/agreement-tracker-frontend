import {
  Alert, Box, Button, Grid, IconButton, InputAdornment, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import { Add, Delete } from '@mui/icons-material';
import WizardFieldAnchor from '../../../components/wizard/WizardFieldAnchor';
import { evaluateAssetPayoutDuration } from '../../../utils/assetPayoutDurationUtils';

const EMPTY_PERIOD = { periodMonths: '', payoutPerStore: '' };

export default function AssetPayoutScheduleFields({
  periods = [],
  onChange,
  fieldError,
  startDate = null,
  expiryDate = null,
}) {
  const rows = periods.length > 0 ? periods : [EMPTY_PERIOD];
  const durationEval = evaluateAssetPayoutDuration({
    payoutMode: 'PER_STORE',
    periods: rows,
    startDate,
    expiryDate,
  });

  const updateRow = (index, patch) => {
    const next = rows.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row));
    onChange(next);
  };

  const addRow = () => {
    onChange([...rows, { ...EMPTY_PERIOD }]);
  };

  const deleteRow = (index) => {
    const next = rows.filter((_, rowIndex) => rowIndex !== index);
    onChange(next.length > 0 ? next : [{ ...EMPTY_PERIOD }]);
  };

  return (
    <WizardFieldAnchor field="assetPayoutPeriods" error={fieldError}>
      <Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          Define payout per store by time period (months).
          {durationEval.maxAllowedMonths != null && (
            <> Inclusive agreement duration allows up to {durationEval.maxAllowedMonths} month(s).</>
          )}
        </Typography>

        {durationEval.status === 'error' && (
          <Alert severity="error" sx={{ mb: 1.5 }}>{durationEval.message}</Alert>
        )}
        {durationEval.status === 'warn' && (
          <Alert severity="warning" sx={{ mb: 1.5 }}>{durationEval.message}</Alert>
        )}

        <TableContainer sx={{
          border: '1px solid',
          borderColor: durationEval.status === 'error' ? 'error.main' : 'grey.200',
          borderRadius: 1,
          mb: 2,
        }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: 'grey.50' }}>
                <TableCell sx={{ fontWeight: 600 }}>Time Period (Months)</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Payout per Store (₹)</TableCell>
                <TableCell width={56} />
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row, index) => (
                <TableRow key={`period-${index}`}>
                  <TableCell>
                    <TextField
                      type="number"
                      size="small"
                      fullWidth
                      value={row.periodMonths ?? ''}
                      onChange={(e) => updateRow(index, { periodMonths: e.target.value })}
                      slotProps={{ htmlInput: { min: 1 } }}
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      type="number"
                      size="small"
                      fullWidth
                      value={row.payoutPerStore ?? ''}
                      onChange={(e) => updateRow(index, { payoutPerStore: e.target.value })}
                      onInput={(e) => { e.target.value = e.target.value.slice(0, 13); }}
                      slotProps={{
                        input: {
                          startAdornment: <InputAdornment position="start">₹</InputAdornment>,
                        },
                        htmlInput: { min: 0, step: '0.01' },
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => deleteRow(index)}
                      aria-label="Delete period"
                      disabled={rows.length === 1}
                    >
                      <Delete fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        <Grid container>
          <Grid size={12}>
            <Button size="small" startIcon={<Add />} onClick={addRow}>
              Add Period
            </Button>
          </Grid>
        </Grid>
      </Box>
    </WizardFieldAnchor>
  );
}
