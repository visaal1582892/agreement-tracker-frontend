import {
  Box, Typography, Grid, TextField, RadioGroup, FormControlLabel, Radio, Divider,
  FormControl, InputLabel, Select, MenuItem,
} from '@mui/material';
import WizardFieldAnchor from '../../../components/wizard/WizardFieldAnchor';
import { isAssetRentalIncomeType } from '../../../utils/incomeTypeUtils';
import {
  CALCULATION_BASIS,
  CALCULATION_BASIS_LABELS,
} from '../../../constants/calculationBasis';
import {
  PAYMENT_REALIZATION_OPTIONS,
  PAYMENT_REALIZATION_TYPE,
} from '../../../constants/commercialStructure';
import { LEAD_TIME_BASIS, LEAD_TIME_BASIS_OPTIONS } from '../../../constants/leadTimeBasis';

function buildPaymentRealizationChangeUpdates(nextType) {
  const updates = { paymentRealizationType: nextType };

  if (nextType !== PAYMENT_REALIZATION_TYPE.DIRECT_PAYMENT_INVOICE) {
    updates.leadTimeBasis = null;
    updates.invoiceGenerationLeadTime = null;
    updates.invoiceVendorId = null;
  }

  if (nextType === PAYMENT_REALIZATION_TYPE.INVOICE_DISCOUNT) {
    updates.payoutBufferDays = null;
  }

  return updates;
}

export default function SettlementRoutingFields({
  payoutBufferDays,
  leadTimeBasis,
  invoiceGenerationLeadTime,
  calculationBasis,
  paymentRealizationType,
  incomeTypeId,
  incomeTypeName,
  onUpdateDetails,
  hideSectionTitle = false,
  fieldErrors = {},
}) {
  const isAssetRental = isAssetRentalIncomeType([], incomeTypeId, incomeTypeName);
  const activePaymentRealization = paymentRealizationType || PAYMENT_REALIZATION_TYPE.DIRECT_PAYMENT_INVOICE;
  const activeBasis = calculationBasis || CALCULATION_BASIS.VENDOR_INVOICE;

  const isCreditNote = activePaymentRealization === PAYMENT_REALIZATION_TYPE.CREDIT_NOTE;
  const isInvoice = activePaymentRealization === PAYMENT_REALIZATION_TYPE.DIRECT_PAYMENT_INVOICE;
  const isActivityCompletionBasis = leadTimeBasis === LEAD_TIME_BASIS.ACTIVITY_COMPLETION_DATE;
  const isInvoiceDateBasis = leadTimeBasis === LEAD_TIME_BASIS.INVOICE_DATE;

  const handleLeadTimeBasisChange = (nextBasis) => {
    const updates = { leadTimeBasis: nextBasis };
    if (nextBasis === LEAD_TIME_BASIS.ACTIVITY_COMPLETION_DATE) {
      updates.invoiceGenerationLeadTime = null;
    }
    onUpdateDetails(updates);
  };

  return (
    <Box>
      {!hideSectionTitle && (
        <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 2 }}>
          Settlement & Payment Routing
        </Typography>
      )}

      <Grid container spacing={3}>
        <Grid size={12}>
          <WizardFieldAnchor field="paymentRealization" error={fieldErrors.paymentRealization}>
            <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>
              Payment Realization Type *
            </Typography>
            <RadioGroup
              row
              value={activePaymentRealization}
              onChange={(e) => onUpdateDetails(buildPaymentRealizationChangeUpdates(e.target.value))}
            >
              {PAYMENT_REALIZATION_OPTIONS.map((option) => (
                <FormControlLabel
                  key={option.value}
                  value={option.value}
                  control={<Radio size="small" />}
                  label={option.label}
                />
              ))}
            </RadioGroup>
          </WizardFieldAnchor>
        </Grid>

        {!isAssetRental && (
          <Grid size={12}>
            <WizardFieldAnchor field="calculationBasis" error={fieldErrors.calculationBasis}>
              <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>
                Calculation Basis *
              </Typography>
              <RadioGroup
                row
                value={activeBasis}
                onChange={(e) => onUpdateDetails({ calculationBasis: e.target.value })}
              >
                <FormControlLabel
                  value={CALCULATION_BASIS.VENDOR_INVOICE}
                  control={<Radio size="small" />}
                  label={CALCULATION_BASIS_LABELS.VENDOR_INVOICE}
                />
                <FormControlLabel
                  value={CALCULATION_BASIS.VENDOR_INWARD}
                  control={<Radio size="small" />}
                  label={CALCULATION_BASIS_LABELS.VENDOR_INWARD}
                />
              </RadioGroup>
            </WizardFieldAnchor>
          </Grid>
        )}

        <Grid size={12}>
          <Divider sx={{ my: 0.5 }} />
        </Grid>

        {/*
        Invoice Vendor Routing hidden for now — restore when routing UI is re-enabled.
        {showInvoiceVendor && (
          <Grid size={12}>
            ...
          </Grid>
        )}
        */}

        {isInvoice && (
          <Grid size={{ xs: 12, md: 6 }}>
            <WizardFieldAnchor field="leadTimeBasis" error={fieldErrors.leadTimeBasis}>
              <FormControl fullWidth size="small" required error={Boolean(fieldErrors.leadTimeBasis)}>
                <InputLabel>Lead Time Basis</InputLabel>
                <Select
                  value={leadTimeBasis || ''}
                  label="Lead Time Basis *"
                  onChange={(e) => handleLeadTimeBasisChange(e.target.value)}
                >
                  {LEAD_TIME_BASIS_OPTIONS.map((option) => (
                    <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </WizardFieldAnchor>
          </Grid>
        )}

        {isCreditNote && (
          <Grid size={{ xs: 12, md: 6 }}>
            <WizardFieldAnchor field="payoutBufferDays" error={fieldErrors.payoutBufferDays}>
              <TextField
                label="Payout Lead Time (days)"
                type="number"
                fullWidth
                size="small"
                required
                error={Boolean(fieldErrors.payoutBufferDays)}
                helperText={fieldErrors.payoutBufferDays}
                value={payoutBufferDays ?? ''}
                onChange={(e) => onUpdateDetails({ payoutBufferDays: e.target.value })}
                slotProps={{ htmlInput: { min: 0 } }}
              />
            </WizardFieldAnchor>
          </Grid>
        )}

        {isInvoice && isActivityCompletionBasis && (
          <Grid size={{ xs: 12, md: 6 }}>
            <WizardFieldAnchor field="payoutBufferDays" error={fieldErrors.payoutBufferDays}>
              <TextField
                label="Payout Lead Time (days)"
                type="number"
                fullWidth
                size="small"
                required
                error={Boolean(fieldErrors.payoutBufferDays)}
                helperText={fieldErrors.payoutBufferDays}
                value={payoutBufferDays ?? ''}
                onChange={(e) => onUpdateDetails({ payoutBufferDays: e.target.value })}
                slotProps={{ htmlInput: { min: 0 } }}
              />
            </WizardFieldAnchor>
          </Grid>
        )}

        {isInvoice && isInvoiceDateBasis && (
          <>
            <Grid size={{ xs: 12, md: 6 }}>
              <WizardFieldAnchor field="invoiceGenerationLeadTime" error={fieldErrors.invoiceGenerationLeadTime}>
                <TextField
                  label="Lead time for invoice generation (in days)"
                  type="number"
                  fullWidth
                  size="small"
                  required
                  error={Boolean(fieldErrors.invoiceGenerationLeadTime)}
                  helperText={fieldErrors.invoiceGenerationLeadTime}
                  value={invoiceGenerationLeadTime ?? ''}
                  onChange={(e) => onUpdateDetails({ invoiceGenerationLeadTime: e.target.value })}
                  slotProps={{ htmlInput: { min: 0 } }}
                />
              </WizardFieldAnchor>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <WizardFieldAnchor field="payoutBufferDays" error={fieldErrors.payoutBufferDays}>
                <TextField
                  label="Payout Lead Time (days)"
                  type="number"
                  fullWidth
                  size="small"
                  required
                  error={Boolean(fieldErrors.payoutBufferDays)}
                  helperText={fieldErrors.payoutBufferDays}
                  value={payoutBufferDays ?? ''}
                  onChange={(e) => onUpdateDetails({ payoutBufferDays: e.target.value })}
                  slotProps={{ htmlInput: { min: 0 } }}
                />
              </WizardFieldAnchor>
            </Grid>
          </>
        )}
      </Grid>
    </Box>
  );
}
