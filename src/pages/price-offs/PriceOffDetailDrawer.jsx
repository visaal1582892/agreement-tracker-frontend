import {
  Box, Drawer, Divider, Typography, TextField, IconButton, Button,
} from '@mui/material';
import { Close, Edit, Save } from '@mui/icons-material';
import StatusBadge from '../../components/ui/StatusBadge';
import { formatPercent } from '../../api/priceOffsApi';

function DetailRow({ label, value }) {
  return (
    <Box sx={{ display: 'flex', gap: 2, py: 0.75 }}>
      <Typography variant="body2" color="text.secondary" sx={{ width: 180, flexShrink: 0 }}>
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 500 }}>{value ?? '—'}</Typography>
    </Box>
  );
}

export default function PriceOffDetailDrawer({
  open,
  campaign,
  onClose,
  editingCampaignId,
  draftCampaignId,
  onStartEditCampaignId,
  onDraftCampaignIdChange,
  onSaveCampaignId,
  savingCampaignId,
  allowCampaignIdEdit = true,
}) {
  if (!campaign) return null;

  return (
    <Drawer anchor="right" open={open} onClose={onClose} PaperProps={{ sx: { width: { xs: '100%', sm: 520 } } }}>
      <Box sx={{ p: 2.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h6">Campaign Detail</Typography>
        <IconButton onClick={onClose} size="small"><Close /></IconButton>
      </Box>
      <Divider />
      <Box sx={{ p: 2.5 }}>
        <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
          <StatusBadge status={campaign.displayStatus || campaign.approvalStatus} />
        </Box>

        <DetailRow label="Product ID" value={campaign.productCode} />
        <DetailRow label="Product Name" value={campaign.productName} />
        <DetailRow label="L3 Category" value={campaign.l3Category} />
        <DetailRow label="Discount Type" value={campaign.discountTypeLabel || campaign.discountType} />
        <DetailRow label="CP" value={campaign.cp} />
        <DetailRow label="MRP" value={campaign.mrp} />
        <DetailRow label="Base Offer" value={
          campaign.discountType === 'DISC_PERCENT'
            ? formatPercent(campaign.baseOffer)
            : campaign.baseOffer
        } />
        <DetailRow label="Medplus Contribution" value={
          campaign.discountType === 'DISC_PERCENT'
            ? formatPercent(campaign.medplusContribution)
            : campaign.medplusContribution
        } />
        <DetailRow label="Margin %" value={formatPercent(campaign.marginPercent)} />
        <DetailRow label="Final Offer" value={formatPercent(campaign.finalOffer)} />
        <DetailRow label="% Off" value={formatPercent(campaign.percentOff)} />
        <DetailRow label="Final Margin %" value={formatPercent(campaign.finalMarginPercent)} />
        <DetailRow label="From Qty" value={campaign.fromQty} />
        <DetailRow label="Start Date" value={campaign.startDate} />
        <DetailRow label="End Date" value={campaign.endDate} />
        <DetailRow label="Duration (Months)" value={campaign.durationMonths} />
        <DetailRow label="Max Unit Cap" value={campaign.maxUnitCap ?? 'No cap'} />
        <DetailRow label="Units Consumed" value={campaign.unitsConsumed} />
        <DetailRow label="Location" value={campaign.locationLabel} />
        <DetailRow label="States Mapped" value={campaign.stateNames?.join(', ') || '—'} />
        <DetailRow label="Channel" value={campaign.channelLabel} />
        <DetailRow label="Channels Mapped" value={campaign.channelNames?.join(', ') || '—'} />
        <DetailRow label="Remarks" value={campaign.remarks} />

        {allowCampaignIdEdit && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Campaign ID</Typography>
            {editingCampaignId ? (
              <Box sx={{ display: 'flex', gap: 1 }}>
                <TextField
                  size="small"
                  fullWidth
                  value={draftCampaignId}
                  onChange={(e) => onDraftCampaignIdChange(e.target.value)}
                  placeholder="Enter campaign ID"
                />
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<Save />}
                  onClick={onSaveCampaignId}
                  disabled={savingCampaignId}
                >
                  Save
                </Button>
              </Box>
            ) : (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {campaign.campaignId || 'Not assigned'}
                </Typography>
                <IconButton size="small" onClick={onStartEditCampaignId}><Edit fontSize="small" /></IconButton>
              </Box>
            )}
            {campaign.campaignIdUpdatedAt && (
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                Updated {new Date(campaign.campaignIdUpdatedAt).toLocaleString()}
              </Typography>
            )}
          </Box>
        )}

        {campaign.rejectionRemarks && (
          <Box sx={{ mt: 2, p: 1.5, bgcolor: '#FEF2F2', borderRadius: 1 }}>
            <Typography variant="caption" color="error" fontWeight={600}>Rejection Remarks</Typography>
            <Typography variant="body2">{campaign.rejectionRemarks}</Typography>
          </Box>
        )}
      </Box>
    </Drawer>
  );
}
