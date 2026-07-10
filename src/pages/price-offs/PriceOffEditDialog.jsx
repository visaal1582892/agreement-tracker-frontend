import { useEffect, useMemo, useState } from 'react';
import {
  Box, Button, Dialog, DialogActions, DialogContent, DialogTitle,
  MenuItem, TextField, Typography, Paper,
} from '@mui/material';
import { BRAND } from '../../config/theme';
import {
  formatCreditNote,
  formatFinalOffer,
  formatPercent,
  resolveLocationAllocation,
} from '../../api/priceOffsApi';
import { calculateDerivedFields } from '../../utils/priceOffCalculations';

const DISCOUNT_TYPE_OPTIONS = [
  { value: 'DISC_PERCENT', label: 'Disc %' },
  { value: 'DISC_VAL', label: 'Disc Val' },
];

function toDateInput(value) {
  if (!value) return '';
  return String(value).slice(0, 10);
}

export default function PriceOffEditDialog({
  open,
  campaign,
  locations = [],
  channelOptions = [],
  saving = false,
  onClose,
  onSave,
}) {
  const [form, setForm] = useState(null);
  const [allocations, setAllocations] = useState({});

  const editableLocationCodes = useMemo(() => {
    if (!campaign) return [];
    const activeCodes = locations.filter((loc) => loc.isActive).map((loc) => loc.code);
    const existingCodes = Object.entries(campaign.locationAllocations ?? {})
      .filter(([, qty]) => Number(qty) > 0)
      .map(([code]) => code);
    return [...new Set([...activeCodes, ...existingCodes])].sort();
  }, [campaign, locations]);

  useEffect(() => {
    if (!open || !campaign) return;
    setForm({
      startDate: toDateInput(campaign.startDate),
      endDate: toDateInput(campaign.endDate),
      cp: campaign.cp ?? '',
      mrp: campaign.mrp ?? '',
      baseOffer: campaign.baseOffer ?? '',
      medplusContribution: campaign.medplusContribution ?? '',
      discountType: campaign.discountType ?? 'DISC_PERCENT',
      locationLabel: campaign.locationLabel ?? '',
      channelLabel: campaign.channelLabel ?? '',
      fromQty: campaign.fromQty ?? '',
      maxUnitCap: campaign.maxUnitCap ?? '',
      remarks: campaign.remarks ?? '',
    });
    const initialAllocations = {};
    editableLocationCodes.forEach((code) => {
      const qty = resolveLocationAllocation(campaign, code);
      initialAllocations[code] = qty > 0 ? String(qty) : '';
    });
    setAllocations(initialAllocations);
  }, [open, campaign, editableLocationCodes]);

  const derived = useMemo(() => {
    if (!form) {
      return {
        totalQty: 0,
        creditNote: 0,
        durationMonths: 1,
        marginPercent: null,
        finalOffer: null,
        percentOff: null,
        finalMarginPercent: null,
      };
    }
    return calculateDerivedFields({
      discountType: form.discountType,
      discountTypeLabel: DISCOUNT_TYPE_OPTIONS.find((option) => option.value === form.discountType)?.label,
      cp: form.cp,
      mrp: form.mrp,
      baseOffer: form.baseOffer,
      medplusContribution: form.medplusContribution,
      allocations,
      startDate: form.startDate,
      endDate: form.endDate,
    });
  }, [form, allocations]);

  if (!campaign || !form) return null;

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const updateAllocation = (code, value) => {
    setAllocations((prev) => ({ ...prev, [code]: value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const locationAllocations = {};
    Object.entries(allocations).forEach(([code, value]) => {
      const qty = Number(value);
      if (!Number.isNaN(qty) && qty > 0) {
        locationAllocations[code] = qty;
      }
    });
    onSave({
      startDate: form.startDate,
      endDate: form.endDate,
      cp: Number(form.cp),
      mrp: Number(form.mrp),
      baseOffer: form.baseOffer === '' || form.baseOffer == null ? 0 : Number(form.baseOffer),
      medplusContribution: form.medplusContribution === '' || form.medplusContribution == null
        ? 0
        : Number(form.medplusContribution),
      discountType: form.discountType,
      locationLabel: form.locationLabel.trim(),
      channelLabel: form.channelLabel.trim(),
      fromQty: form.fromQty === '' ? null : Number(form.fromQty),
      maxUnitCap: form.maxUnitCap === '' ? null : Number(form.maxUnitCap),
      remarks: form.remarks?.trim() || null,
      locationAllocations,
    });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth slotProps={{ paper: { sx: { borderRadius: '16px' } } }}>
      <Box component="form" onSubmit={handleSubmit}>
        <DialogTitle>Edit Draft Campaign</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, bgcolor: 'grey.50' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
              Auto-calculated Preview
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(3, 1fr)' }, gap: 1.5 }}>
              <Box>
                <Typography variant="caption" color="text.secondary">Total Qty</Typography>
                <Typography variant="body1" sx={{ fontWeight: 600 }}>{derived.totalQty || '—'}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Credit Note</Typography>
                <Typography variant="body1" sx={{ fontWeight: 600 }}>{formatCreditNote(derived.creditNote)}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Duration (Months)</Typography>
                <Typography variant="body1" sx={{ fontWeight: 600 }}>{derived.durationMonths ?? '—'}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Margin %</Typography>
                <Typography variant="body1" sx={{ fontWeight: 600 }}>{formatPercent(derived.marginPercent)}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Final Offer</Typography>
                <Typography variant="body1" sx={{ fontWeight: 600 }}>
                  {formatFinalOffer(derived.finalOffer, form.discountType)}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">% Off</Typography>
                <Typography variant="body1" sx={{ fontWeight: 600 }}>{formatPercent(derived.percentOff)}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Final Margin %</Typography>
                <Typography variant="body1" sx={{ fontWeight: 600 }}>{formatPercent(derived.finalMarginPercent)}</Typography>
              </Box>
            </Box>
          </Paper>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
            <TextField
              label="Start Date"
              type="date"
              required
              value={form.startDate}
              onChange={(e) => updateField('startDate', e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
              fullWidth
            />
            <TextField
              label="End Date"
              type="date"
              required
              value={form.endDate}
              onChange={(e) => updateField('endDate', e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
              fullWidth
            />
            <TextField
              label="Discount Type"
              select
              required
              value={form.discountType}
              onChange={(e) => updateField('discountType', e.target.value)}
              fullWidth
            >
              {DISCOUNT_TYPE_OPTIONS.map((option) => (
                <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
              ))}
            </TextField>
            <TextField
              label="Channel"
              select
              required
              value={form.channelLabel}
              onChange={(e) => updateField('channelLabel', e.target.value)}
              fullWidth
            >
              {channelOptions.map((option) => (
                <MenuItem key={option.value || option.label} value={option.label}>{option.label}</MenuItem>
              ))}
            </TextField>
            <TextField label="CP" required type="number" value={form.cp} onChange={(e) => updateField('cp', e.target.value)} fullWidth />
            <TextField label="MRP" required type="number" value={form.mrp} onChange={(e) => updateField('mrp', e.target.value)} fullWidth />
            <TextField
              label="Base Offer"
              type="number"
              value={form.baseOffer}
              onChange={(e) => updateField('baseOffer', e.target.value)}
              helperText="Optional — leave blank or 0 if no vendor offer"
              slotProps={{ htmlInput: { min: 0, step: 'any' } }}
              fullWidth
            />
            <TextField
              label="Medplus Contribution"
              type="number"
              value={form.medplusContribution}
              onChange={(e) => updateField('medplusContribution', e.target.value)}
              helperText="Optional — leave blank or 0 if MedPlus contributes nothing"
              slotProps={{ htmlInput: { min: 0, step: 'any' } }}
              fullWidth
            />
            <TextField label="From Qty" type="number" value={form.fromQty} onChange={(e) => updateField('fromQty', e.target.value)} fullWidth />
            <TextField label="Max Unit Cap" type="number" value={form.maxUnitCap} onChange={(e) => updateField('maxUnitCap', e.target.value)} fullWidth />
          </Box>
          <TextField
            label="Location"
            required
            value={form.locationLabel}
            onChange={(e) => updateField('locationLabel', e.target.value)}
            fullWidth
          />
          <TextField
            label="Remarks"
            value={form.remarks}
            onChange={(e) => updateField('remarks', e.target.value)}
            fullWidth
            multiline
            minRows={2}
          />
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>Zone Allocations</Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(4, 1fr)' }, gap: 1.5 }}>
              {editableLocationCodes.map((code) => (
                <TextField
                  key={code}
                  label={code}
                  type="number"
                  size="small"
                  value={allocations[code] ?? ''}
                  onChange={(e) => updateAllocation(code, e.target.value)}
                />
              ))}
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={saving} sx={{ background: BRAND.redGradient }}>
            Save Changes
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
