import { useEffect, useMemo, useState } from 'react';
import {
  Box, Button, Dialog, DialogActions, DialogContent, DialogTitle,
  MenuItem, TextField, Typography, Paper, InputAdornment
} from '@mui/material';
import { BRAND } from '../../config/theme';
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
  }, [open, campaign]);


  if (!campaign || !form) return null;

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const derived = useMemo(() => {
    if (!form) return null;
    return calculateDerivedFields({
      discountType: form.discountType,
      discountTypeLabel: DISCOUNT_TYPE_OPTIONS.find(o => o.value === form.discountType)?.label,
      cp: form.cp,
      mrp: form.mrp,
      baseOffer: form.baseOffer,
      medplusContribution: form.medplusContribution,
      allocations: campaign.locationAllocations || {},
      startDate: form.startDate,
      endDate: form.endDate,
    });
  }, [form, campaign]);  const handleSubmit = (event) => {
    event.preventDefault();
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
      locationAllocations: campaign.locationAllocations || {},
      marginPercent: derived?.marginPercent,
      finalOffer: derived?.finalOffer,
      percentOff: derived?.percentOff,
      finalMarginPercent: derived?.finalMarginPercent,
      creditNote: derived?.creditNote,
      totalQty: derived?.totalQty,
    });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth slotProps={{ paper: { sx: { borderRadius: '16px' } } }}>
      <Box component="form" onSubmit={handleSubmit}>
        <DialogTitle>Edit Draft Campaign</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
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
          
          <Typography variant="subtitle2" sx={{ mt: 1, mb: 0.5 }}>Calculated Fields (Read Only)</Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
            <TextField 
              label="Margin %" 
              value={derived?.marginPercent ?? '—'} 
              slotProps={{ input: { readOnly: true }, htmlInput: { style: { backgroundColor: '#f5f5f5' } } }} 
              InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }}
              fullWidth 
            />
            <TextField 
              label="Final Offer" 
              value={derived?.finalOffer ?? '—'} 
              slotProps={{ input: { readOnly: true }, htmlInput: { style: { backgroundColor: '#f5f5f5' } } }} 
              InputProps={{ endAdornment: form.discountType === 'DISC_PERCENT' ? <InputAdornment position="end">%</InputAdornment> : null }}
              fullWidth 
            />
            <TextField 
              label="% Off" 
              value={derived?.percentOff ?? '—'} 
              slotProps={{ input: { readOnly: true }, htmlInput: { style: { backgroundColor: '#f5f5f5' } } }} 
              InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }}
              fullWidth 
            />
            <TextField 
              label="Final Margin %" 
              value={derived?.finalMarginPercent ?? '—'} 
              slotProps={{ input: { readOnly: true }, htmlInput: { style: { backgroundColor: '#f5f5f5' } } }} 
              InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }}
              fullWidth 
            />
            <TextField 
              label="Credit Note" 
              value={derived?.creditNote ?? '—'} 
              slotProps={{ input: { readOnly: true }, htmlInput: { style: { backgroundColor: '#f5f5f5' } } }} 
              fullWidth 
            />
            <TextField 
              label="Total Qty" 
              value={derived?.totalQty ?? '—'} 
              slotProps={{ input: { readOnly: true }, htmlInput: { style: { backgroundColor: '#f5f5f5' } } }} 
              fullWidth 
            />
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
