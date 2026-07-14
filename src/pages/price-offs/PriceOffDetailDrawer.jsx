import {
  Box, Drawer, Divider, Typography, TextField, IconButton, Button,
  Grid, Card, CardContent, Chip, Stack, Table, TableBody, TableCell, TableHead, TableRow,
} from '@mui/material';
import { Close, Edit, Save } from '@mui/icons-material';
import { alpha } from '@mui/material/styles';
import StatusBadge from '../../components/ui/StatusBadge';
import { BRAND } from '../../config/theme';
import {
  formatCreditNote,
  formatFinalOffer,
  formatMoney,
  formatPercent,
  resolveLocationAllocation,
} from '../../api/priceOffsApi';

function SectionCard({ title, children }) {
  return (
    <Card variant="outlined" sx={{ borderRadius: 2, borderColor: BRAND.borderLight }}>
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5, color: BRAND.textPrimary }}>
          {title}
        </Typography>
        {children}
      </CardContent>
    </Card>
  );
}

function KvRow({ label, value }) {
  return (
    <Box sx={{ mb: 1.25 }}>
      <Typography variant="subtitle2" color="text.secondary">{label}</Typography>
      <Typography variant="body1" sx={{ fontWeight: 500, mt: 0.25 }}>{value ?? '—'}</Typography>
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
  allowCampaignEdit = false,
  onEditCampaign,
}) {
  if (!campaign) return null;

  const allocationEntries = Object.entries(campaign.locationAllocations ?? {})
    .filter(([, qty]) => Number(qty) > 0)
    .sort(([left], [right]) => left.localeCompare(right));

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      slotProps={{ paper: { sx: { width: { xs: '100%', sm: 600 } } } }}
    >
      <Box sx={{ p: 2.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="h6">Campaign Preview</Typography>
          <Typography variant="body2" color="text.secondary">#{campaign.id}</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {allowCampaignEdit && (
            <Button size="small" variant="outlined" startIcon={<Edit />} onClick={onEditCampaign}>
              Edit
            </Button>
          )}
          <IconButton onClick={onClose} size="small"><Close /></IconButton>
        </Box>
      </Box>
      <Divider />
      <Box sx={{ p: 2.5 }}>
        <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap' }}>
          <StatusBadge status={campaign.displayStatus || campaign.approvalStatus} />
        </Stack>

        <Grid container spacing={3}>
          <Grid size={{ xs: 12 }}>
            <SectionCard title="Product Details">
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <KvRow label="Product Name" value={campaign.productName} />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <KvRow label="Product ID" value={campaign.productCode} />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <KvRow label="Manufacturer" value={campaign.manufacturerName} />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <KvRow label="L3 Category" value={campaign.l3Category} />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <KvRow label="MRP" value={formatMoney(campaign.mrp)} />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <KvRow label="CP" value={formatMoney(campaign.cp)} />
                </Grid>
              </Grid>
            </SectionCard>
          </Grid>

          <Grid size={{ xs: 12 }}>
            <SectionCard title="Campaign Details">
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <KvRow label="Start Date" value={campaign.startDate} />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <KvRow label="End Date" value={campaign.endDate} />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <KvRow label="Discount Type" value={campaign.discountTypeLabel || campaign.discountType} />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <KvRow label="Channel" value={campaign.channelLabel} />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <KvRow label="Location Label" value={campaign.locationLabel} />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <KvRow label="From Qty" value={campaign.fromQty} />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <KvRow label="Max Unit Cap" value={campaign.maxUnitCap ?? 'No cap'} />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <KvRow label="Units Consumed" value={campaign.unitsConsumed} />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <KvRow label="Base Offer" value={formatFinalOffer(campaign.baseOffer, campaign.discountType)} />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <KvRow label="Medplus Contribution" value={formatFinalOffer(campaign.medplusContribution, campaign.discountType)} />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <KvRow label="Final Offer" value={formatFinalOffer(campaign.finalOffer, campaign.discountType)} />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <KvRow label="Margin %" value={formatPercent(campaign.marginPercent)} />
                </Grid>
                {campaign.remarks && (
                  <Grid size={{ xs: 12 }}>
                    <KvRow label="Remarks" value={campaign.remarks} />
                  </Grid>
                )}
              </Grid>
            </SectionCard>
          </Grid>

          <Grid size={{ xs: 12 }}>
            <SectionCard title="Location Allocations">
              <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <KvRow label="Total Qty" value={campaign.totalQty ?? '—'} />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <KvRow label="Credit Note" value={formatCreditNote(campaign.creditNote)} />
                </Grid>
              </Grid>

              {allocationEntries.length > 0 ? (
                <>
                  <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap', gap: 0.75, mb: 2 }}>
                    {allocationEntries.map(([code, qty]) => (
                      <Chip
                        key={code}
                        label={`${code}: ${qty}`}
                        size="small"
                        sx={{
                          bgcolor: alpha(BRAND.red, 0.08),
                          color: BRAND.redDark,
                          fontWeight: 600,
                        }}
                      />
                    ))}
                  </Stack>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 700 }}>Zone</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>Qty</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {allocationEntries.map(([code, qty]) => (
                        <TableRow key={code}>
                          <TableCell>{code}</TableCell>
                          <TableCell align="right">{resolveLocationAllocation(campaign, code) || qty}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </>
              ) : (
                <Typography variant="body2" color="text.secondary">No zone allocations recorded.</Typography>
              )}
            </SectionCard>
          </Grid>
        </Grid>

        {allowCampaignIdEdit && (
          <Box sx={{ mt: 3 }}>
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>Campaign ID</Typography>
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
                <Typography variant="body1" sx={{ fontWeight: 600 }}>
                  {campaign.campaignId || 'Not assigned'}
                </Typography>
                <IconButton size="small" onClick={onStartEditCampaignId} aria-label="Edit campaign ID">
                  <Edit fontSize="small" />
                </IconButton>
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
          <Box sx={{ mt: 2, p: 1.5, bgcolor: '#FEF2F2', borderRadius: 2 }}>
            <Typography variant="caption" color="error" fontWeight={600}>Rejection Remarks</Typography>
            <Typography variant="body2">{campaign.rejectionRemarks}</Typography>
          </Box>
        )}
      </Box>
    </Drawer>
  );
}
