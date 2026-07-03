import { useCallback, useEffect, useState } from 'react';
import {
  Box, Button, Checkbox, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, IconButton, Paper, Table, TableBody, TableCell, TableHead,
  TablePagination, TableRow, TextField, Tooltip, Typography,
} from '@mui/material';
import { CheckCircle, Cancel } from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import PageHeader from '../../components/ui/PageHeader';
import PriceOffDetailDrawer from './PriceOffDetailDrawer';
import {
  HeaderFilterStack,
  HeaderLabel,
  HeaderMasterFilter,
  HeaderTextFilter,
  PriceOffTableShell,
  StickyCheckboxCell,
  TABLE_PAGINATION_SX,
  TABLE_SX,
  dataCellSx,
  filterHeaderCellSx,
  filterHeaderFlexCellSx,
  headerCellSx,
} from './PriceOffTableFilters';
import {
  PRICE_OFF_COLUMN_WIDTHS,
  PriceOffProductCell,
  PriceOffTextCell,
} from './priceOffTableLayout';
import {
  approvePriceOff,
  bulkApprovePriceOffs,
  bulkRejectPriceOffs,
  extractPriceOffError,
  fetchPriceOffCampaign,
  fetchPriceOffCampaigns,
  fetchPriceOffFilterOptions,
  formatMoney,
  formatOfferValue,
  formatPercent,
  rejectPriceOff,
} from '../../api/priceOffsApi';

const EMPTY_FILTERS = { product: '', location: '', channel: '', discountType: '' };

export default function PriceOffsApprovalHub() {
  const { enqueueSnackbar } = useSnackbar();
  const [campaigns, setCampaigns] = useState([]);
  const [totalElements, setTotalElements] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [detailOpen, setDetailOpen] = useState(false);
  const [activeCampaign, setActiveCampaign] = useState(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectRemarks, setRejectRemarks] = useState('');
  const [rejectTargetIds, setRejectTargetIds] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [columnFilters, setColumnFilters] = useState(EMPTY_FILTERS);
  const [debouncedFilters, setDebouncedFilters] = useState(EMPTY_FILTERS);
  const [channelOptions, setChannelOptions] = useState([]);
  const [discountTypeOptions, setDiscountTypeOptions] = useState([]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedFilters(columnFilters), 400);
    return () => clearTimeout(timer);
  }, [columnFilters]);

  useEffect(() => {
    fetchPriceOffFilterOptions()
      .then((data) => {
        setChannelOptions(data.channels ?? []);
        setDiscountTypeOptions(data.discountTypes ?? []);
      })
      .catch(() => enqueueSnackbar('Failed to load filter options', { variant: 'error' }));
  }, [enqueueSnackbar]);

  const updateFilter = (key, value) => {
    setColumnFilters((prev) => ({ ...prev, [key]: value }));
    setPage(0);
  };

  const loadPending = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchPriceOffCampaigns({
        status: 'PENDING_APPROVAL',
        ...debouncedFilters,
        discountType: debouncedFilters.discountType || undefined,
        page,
        size: rowsPerPage,
        sortBy: 'updatedAt',
        sortDirection: 'DESC',
      });
      setCampaigns(data.content ?? []);
      setTotalElements(data.totalElements ?? 0);
      setSelected(new Set());
    } catch (err) {
      enqueueSnackbar(await extractPriceOffError(err, 'Failed to load pending campaigns'), { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [debouncedFilters, enqueueSnackbar, page, rowsPerPage]);

  useEffect(() => {
    loadPending();
  }, [loadPending]);

  const allSelected = campaigns.length > 0 && selected.size === campaigns.length;

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(campaigns.map((row) => row.id)));
    }
  };

  const toggleSelect = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openDetail = async (row) => {
    try {
      const detail = await fetchPriceOffCampaign(row.id);
      setActiveCampaign(detail);
      setDetailOpen(true);
    } catch (err) {
      enqueueSnackbar(await extractPriceOffError(err, 'Failed to load campaign detail'), { variant: 'error' });
    }
  };

  const handleApprove = async (ids) => {
    if (!ids.length) return;
    setProcessing(true);
    try {
      if (ids.length === 1) {
        await approvePriceOff(ids[0]);
      } else {
        await bulkApprovePriceOffs(ids);
      }
      enqueueSnackbar(`${ids.length} campaign(s) approved`, { variant: 'success' });
      await loadPending();
      if (detailOpen) setDetailOpen(false);
    } catch (err) {
      enqueueSnackbar(await extractPriceOffError(err, 'Approve failed'), { variant: 'error' });
    } finally {
      setProcessing(false);
    }
  };

  const openRejectDialog = (ids) => {
    setRejectTargetIds(ids);
    setRejectRemarks('');
    setRejectDialogOpen(true);
  };

  const handleRejectConfirm = async () => {
    if (!rejectRemarks.trim()) {
      enqueueSnackbar('Rejection remarks are required', { variant: 'warning' });
      return;
    }
    setProcessing(true);
    try {
      if (rejectTargetIds.length === 1) {
        await rejectPriceOff(rejectTargetIds[0], rejectRemarks.trim());
      } else {
        await bulkRejectPriceOffs(rejectTargetIds, rejectRemarks.trim());
      }
      enqueueSnackbar(`${rejectTargetIds.length} campaign(s) rejected`, { variant: 'success' });
      setRejectDialogOpen(false);
      await loadPending();
      if (detailOpen) setDetailOpen(false);
    } catch (err) {
      enqueueSnackbar(await extractPriceOffError(err, 'Reject failed'), { variant: 'error' });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <PageHeader
        title="Price Off Approvals"
        subtitle="Review pending consumer price off campaigns."
      />

      <Box sx={{ display: 'flex', gap: 1.5, mb: 2 }}>
        <Button
          variant="contained"
          color="success"
          disabled={!selected.size || processing}
          onClick={() => handleApprove([...selected])}
        >
          Bulk Approve ({selected.size})
        </Button>
        <Button
          variant="outlined"
          color="error"
          disabled={!selected.size || processing}
          onClick={() => openRejectDialog([...selected])}
        >
          Bulk Reject ({selected.size})
        </Button>
        <Button variant="text" onClick={toggleAll} disabled={!campaigns.length}>
          {allSelected ? 'Clear All' : 'Select All'}
        </Button>
      </Box>

      <Paper variant="outlined" sx={{ width: '100%' }}>
        <PriceOffTableShell
          loading={loading}
          empty={!loading && campaigns.length === 0}
          emptyMessage="No pending price off campaigns."
          pagination={(
            <TablePagination
              component="div"
              count={totalElements}
              page={page}
              onPageChange={(_, next) => setPage(next)}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={(e) => {
                setRowsPerPage(parseInt(e.target.value, 10));
                setPage(0);
              }}
              sx={TABLE_PAGINATION_SX}
            />
          )}
        >
          <Table size="small" stickyHeader sx={TABLE_SX}>
            <TableHead>
              <TableRow>
                <StickyCheckboxCell header>
                  <Checkbox
                    size="small"
                    checked={allSelected}
                    indeterminate={selected.size > 0 && !allSelected}
                    onChange={toggleAll}
                    sx={{ p: 0.5 }}
                    inputProps={{ 'aria-label': 'Select all pending campaigns' }}
                  />
                </StickyCheckboxCell>
              <TableCell sx={filterHeaderFlexCellSx(PRICE_OFF_COLUMN_WIDTHS.product.minWidth)}>
                <HeaderFilterStack label="Product">
                  <HeaderTextFilter
                    placeholder="Name / ID"
                    value={columnFilters.product}
                    onChange={(v) => updateFilter('product', v)}
                  />
                </HeaderFilterStack>
              </TableCell>
              <TableCell sx={headerCellSx(PRICE_OFF_COLUMN_WIDTHS.l3Category)}>
                <HeaderLabel>L3 Category</HeaderLabel>
              </TableCell>
              <TableCell sx={filterHeaderCellSx(PRICE_OFF_COLUMN_WIDTHS.location)}>
                <HeaderFilterStack label="Location">
                  <HeaderTextFilter
                    placeholder="Filter"
                    value={columnFilters.location}
                    onChange={(v) => updateFilter('location', v)}
                  />
                </HeaderFilterStack>
              </TableCell>
              <TableCell sx={filterHeaderCellSx(PRICE_OFF_COLUMN_WIDTHS.channel)}>
                <HeaderFilterStack label="Channel">
                  <HeaderMasterFilter
                    options={channelOptions}
                    value={columnFilters.channel}
                    onChange={(v) => updateFilter('channel', v)}
                    placeholder="Search channel"
                  />
                </HeaderFilterStack>
              </TableCell>
              <TableCell sx={filterHeaderCellSx(PRICE_OFF_COLUMN_WIDTHS.discountType)}>
                <HeaderFilterStack label="Discount Type">
                  <HeaderMasterFilter
                    options={discountTypeOptions}
                    value={columnFilters.discountType}
                    onChange={(v) => updateFilter('discountType', v)}
                    placeholder="Search type"
                  />
                </HeaderFilterStack>
              </TableCell>
              <TableCell sx={headerCellSx(PRICE_OFF_COLUMN_WIDTHS.startDate)}>
                <HeaderLabel>Start</HeaderLabel>
              </TableCell>
              <TableCell sx={headerCellSx(PRICE_OFF_COLUMN_WIDTHS.endDate)}>
                <HeaderLabel>End</HeaderLabel>
              </TableCell>
              <TableCell sx={headerCellSx(PRICE_OFF_COLUMN_WIDTHS.cp)}>
                <HeaderLabel>CP</HeaderLabel>
              </TableCell>
              <TableCell sx={headerCellSx(PRICE_OFF_COLUMN_WIDTHS.mrp)}>
                <HeaderLabel>MRP</HeaderLabel>
              </TableCell>
              <TableCell sx={headerCellSx(PRICE_OFF_COLUMN_WIDTHS.baseOffer)}>
                <HeaderLabel>Base Offer</HeaderLabel>
              </TableCell>
              <TableCell sx={headerCellSx(PRICE_OFF_COLUMN_WIDTHS.medplusContribution)}>
                <HeaderLabel>Medplus Contrib.</HeaderLabel>
              </TableCell>
              <TableCell sx={headerCellSx(PRICE_OFF_COLUMN_WIDTHS.marginPercent)}>
                <HeaderLabel>Margin %</HeaderLabel>
              </TableCell>
              <TableCell sx={headerCellSx(PRICE_OFF_COLUMN_WIDTHS.finalOffer)}>
                <HeaderLabel>Final Offer</HeaderLabel>
              </TableCell>
              <TableCell sx={headerCellSx(PRICE_OFF_COLUMN_WIDTHS.percentOff)}>
                <HeaderLabel>% Off</HeaderLabel>
              </TableCell>
              <TableCell sx={headerCellSx(PRICE_OFF_COLUMN_WIDTHS.finalMarginPercent)}>
                <HeaderLabel>Final Margin %</HeaderLabel>
              </TableCell>
              <TableCell align="right" sx={headerCellSx(PRICE_OFF_COLUMN_WIDTHS.actions)}>
                <HeaderLabel>Actions</HeaderLabel>
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {!loading && campaigns.map((row) => (
              <TableRow key={row.id} hover sx={{ cursor: 'pointer' }} onClick={() => openDetail(row)}>
                <StickyCheckboxCell onClick={(e) => e.stopPropagation()}>
                  <Checkbox size="small" checked={selected.has(row.id)} onChange={() => toggleSelect(row.id)} sx={{ p: 0.5 }} />
                </StickyCheckboxCell>
                <TableCell sx={dataCellSx(PRICE_OFF_COLUMN_WIDTHS.product.minWidth, { flex: true })}>
                  <PriceOffProductCell name={row.productName} code={row.productCode} />
                </TableCell>
                <TableCell sx={dataCellSx(PRICE_OFF_COLUMN_WIDTHS.l3Category)}>
                  <PriceOffTextCell value={row.l3Category} />
                </TableCell>
                <TableCell sx={dataCellSx(PRICE_OFF_COLUMN_WIDTHS.location)}>
                  <PriceOffTextCell value={row.locationLabel} />
                </TableCell>
                <TableCell sx={dataCellSx(PRICE_OFF_COLUMN_WIDTHS.channel)}>
                  <PriceOffTextCell value={row.channelLabel} />
                </TableCell>
                <TableCell sx={dataCellSx(PRICE_OFF_COLUMN_WIDTHS.discountType)}>
                  <PriceOffTextCell value={row.discountTypeLabel || row.discountType} />
                </TableCell>
                <TableCell sx={dataCellSx(PRICE_OFF_COLUMN_WIDTHS.startDate)}>{row.startDate || '—'}</TableCell>
                <TableCell sx={dataCellSx(PRICE_OFF_COLUMN_WIDTHS.endDate)}>{row.endDate || '—'}</TableCell>
                <TableCell sx={dataCellSx(PRICE_OFF_COLUMN_WIDTHS.cp)}>{formatMoney(row.cp)}</TableCell>
                <TableCell sx={dataCellSx(PRICE_OFF_COLUMN_WIDTHS.mrp)}>{formatMoney(row.mrp)}</TableCell>
                <TableCell sx={dataCellSx(PRICE_OFF_COLUMN_WIDTHS.baseOffer)}>{formatOfferValue(row.baseOffer, row.discountType)}</TableCell>
                <TableCell sx={dataCellSx(PRICE_OFF_COLUMN_WIDTHS.medplusContribution)}>{formatOfferValue(row.medplusContribution, row.discountType)}</TableCell>
                <TableCell sx={dataCellSx(PRICE_OFF_COLUMN_WIDTHS.marginPercent)}>{formatPercent(row.marginPercent)}</TableCell>
                <TableCell sx={dataCellSx(PRICE_OFF_COLUMN_WIDTHS.finalOffer)}>{formatOfferValue(row.finalOffer, row.discountType)}</TableCell>
                <TableCell sx={dataCellSx(PRICE_OFF_COLUMN_WIDTHS.percentOff)}>{formatPercent(row.percentOff)}</TableCell>
                <TableCell sx={dataCellSx(PRICE_OFF_COLUMN_WIDTHS.finalMarginPercent)}>{formatPercent(row.finalMarginPercent)}</TableCell>
                <TableCell align="right" sx={dataCellSx(PRICE_OFF_COLUMN_WIDTHS.actions)} onClick={(e) => e.stopPropagation()}>
                  <Tooltip title="Approve">
                    <IconButton size="small" color="success" onClick={() => handleApprove([row.id])}>
                      <CheckCircle fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Reject">
                    <IconButton size="small" color="error" onClick={() => openRejectDialog([row.id])}>
                      <Cancel fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          </Table>
        </PriceOffTableShell>
      </Paper>

      <PriceOffDetailDrawer
        open={detailOpen}
        campaign={activeCampaign}
        onClose={() => setDetailOpen(false)}
        editingCampaignId={false}
        draftCampaignId=""
        onStartEditCampaignId={() => {}}
        onDraftCampaignIdChange={() => {}}
        onSaveCampaignId={() => {}}
        savingCampaignId={false}
      />

      <Dialog open={rejectDialogOpen} onClose={() => setRejectDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Reject Campaign{rejectTargetIds.length > 1 ? 's' : ''}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            multiline
            minRows={3}
            label="Rejection remarks *"
            value={rejectRemarks}
            onChange={(e) => setRejectRemarks(e.target.value)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejectDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleRejectConfirm} disabled={processing}>
            Reject
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
