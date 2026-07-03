import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, Box, Button, Checkbox, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, Paper, Table, TableBody, TableCell, TableHead,
  TablePagination, TableRow, TableSortLabel, TextField, Typography,
} from '@mui/material';
import { Delete, Download, Send, UploadFile } from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import { alpha } from '@mui/material/styles';
import PageHeader from '../../components/ui/PageHeader';
import StatusBadge from '../../components/ui/StatusBadge';
import { BRAND } from '../../config/theme';
import PriceOffDetailDrawer from './PriceOffDetailDrawer';
import {
  HeaderFilterStack,
  HeaderLabel,
  HeaderMasterFilter,
  HeaderSelectFilter,
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
  bulkDeletePriceOffs,
  bulkSubmitPriceOffs,
  bulkUpdatePriceOffCampaignId,
  downloadBlob,
  downloadPriceOffTemplate,
  extractPriceOffError,
  fetchPriceOffCampaign,
  fetchPriceOffCampaigns,
  fetchPriceOffFilterOptions,
  formatFinalOffer,
  formatMoney,
  formatOfferValue,
  formatPercent,
  updatePriceOffCampaignId,
  uploadPriceOffCampaigns,
} from '../../api/priceOffsApi';

const STATUS_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'PENDING_APPROVAL', label: 'Pending Approval' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'PENDING_ACTIVATION', label: 'Pending Campaign ID' },
  { value: 'LIVE', label: 'Live' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'REJECTED', label: 'Rejected' },
];

const DEFAULT_SORT = { field: 'updatedAt', sort: 'desc' };

const EMPTY_FILTERS = {
  product: '',
  campaignId: '',
  location: '',
  channel: '',
  discountType: '',
  status: '',
};

export default function PriceOffsDashboard() {
  const { enqueueSnackbar } = useSnackbar();
  const fileInputRef = useRef(null);
  const [campaigns, setCampaigns] = useState([]);
  const [totalElements, setTotalElements] = useState(0);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [sortModel, setSortModel] = useState([DEFAULT_SORT]);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [debouncedFilters, setDebouncedFilters] = useState(EMPTY_FILTERS);
  const [channelOptions, setChannelOptions] = useState([]);
  const [discountTypeOptions, setDiscountTypeOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [uploadErrors, setUploadErrors] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [detailOpen, setDetailOpen] = useState(false);
  const [activeCampaign, setActiveCampaign] = useState(null);
  const [editingCampaignId, setEditingCampaignId] = useState(false);
  const [draftCampaignId, setDraftCampaignId] = useState('');
  const [savingCampaignId, setSavingCampaignId] = useState(false);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkCampaignId, setBulkCampaignId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedFilters(filters), 400);
    return () => clearTimeout(timer);
  }, [filters]);

  useEffect(() => {
    setSelected(new Set());
    setPage(0);
  }, [debouncedFilters]);

  useEffect(() => {
    fetchPriceOffFilterOptions()
      .then((data) => {
        setChannelOptions(data.channels ?? []);
        setDiscountTypeOptions(data.discountTypes ?? []);
      })
      .catch(() => enqueueSnackbar('Failed to load filter options', { variant: 'error' }));
  }, [enqueueSnackbar]);

  const updateFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const activeSort = sortModel[0] ?? DEFAULT_SORT;

  const visibleIds = useMemo(() => campaigns.map((row) => row.id), [campaigns]);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));
  const someVisibleSelected = visibleIds.some((id) => selected.has(id));

  const selectedRows = useMemo(
    () => campaigns.filter((row) => selected.has(row.id)),
    [campaigns, selected],
  );

  const allDraftSelected = selectedRows.length > 0
    && selectedRows.every((row) => row.approvalStatus === 'DRAFT');
  const allCampaignIdEligible = selectedRows.length > 0
    && selectedRows.every((row) => ['APPROVED', 'PENDING_ACTIVATION'].includes(row.displayStatus));

  const loadCampaigns = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchPriceOffCampaigns({
        ...debouncedFilters,
        status: debouncedFilters.status || undefined,
        discountType: debouncedFilters.discountType || undefined,
        page,
        size: pageSize,
        sortBy: activeSort.field,
        sortDirection: activeSort.sort.toUpperCase(),
      });
      setCampaigns(data.content ?? []);
      setTotalElements(data.totalElements ?? 0);
    } catch (err) {
      enqueueSnackbar(await extractPriceOffError(err, 'Failed to load price off campaigns'), { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [activeSort.field, activeSort.sort, debouncedFilters, enqueueSnackbar, page, pageSize]);

  useEffect(() => {
    loadCampaigns();
  }, [loadCampaigns]);

  const handleSort = (field) => {
    setSortModel((prev) => {
      const current = prev[0];
      if (current?.field === field) {
        return [{ field, sort: current.sort === 'desc' ? 'asc' : 'desc' }];
      }
      return [{ field, sort: 'desc' }];
    });
    setPage(0);
  };

  const toggleSelectAllVisible = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        visibleIds.forEach((id) => next.delete(id));
      } else {
        visibleIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const handleDownloadTemplate = async () => {
    setDownloading(true);
    try {
      const blob = await downloadPriceOffTemplate();
      downloadBlob(blob, 'price-off-campaigns-template.xlsx');
    } catch {
      enqueueSnackbar('Failed to download template', { variant: 'error' });
    } finally {
      setDownloading(false);
    }
  };

  const handleUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    setUploadErrors([]);
    try {
      const result = await uploadPriceOffCampaigns(file);
      setUploadErrors(result.errors ?? []);
      enqueueSnackbar(
        `${result.createdCount} campaign(s) uploaded${result.skippedCount ? `, ${result.skippedCount} row(s) skipped` : ''}`,
        { variant: result.skippedCount ? 'warning' : 'success' },
      );
      await loadCampaigns();
    } catch (err) {
      enqueueSnackbar(await extractPriceOffError(err, 'Upload failed'), { variant: 'error' });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const openDetail = async (row) => {
    try {
      const detail = await fetchPriceOffCampaign(row.id);
      setActiveCampaign(detail);
      setDraftCampaignId(detail.campaignId ?? '');
      setEditingCampaignId(false);
      setDetailOpen(true);
    } catch (err) {
      enqueueSnackbar(await extractPriceOffError(err, 'Failed to load campaign detail'), { variant: 'error' });
    }
  };

  const handleSaveCampaignId = async () => {
    if (!activeCampaign) return;
    setSavingCampaignId(true);
    try {
      const updated = await updatePriceOffCampaignId(activeCampaign.id, draftCampaignId);
      setActiveCampaign(updated);
      setEditingCampaignId(false);
      enqueueSnackbar('Campaign ID saved', { variant: 'success' });
      await loadCampaigns();
    } catch (err) {
      enqueueSnackbar(await extractPriceOffError(err, 'Failed to save campaign ID'), { variant: 'error' });
    } finally {
      setSavingCampaignId(false);
    }
  };

  const handleBulkCampaignIdSave = async () => {
    if (!selected.size) return;
    try {
      await bulkUpdatePriceOffCampaignId([...selected], bulkCampaignId);
      enqueueSnackbar(`Campaign ID updated for ${selected.size} record(s)`, { variant: 'success' });
      setBulkDialogOpen(false);
      setBulkCampaignId('');
      await loadCampaigns();
    } catch (err) {
      enqueueSnackbar(await extractPriceOffError(err, 'Bulk campaign ID update failed'), { variant: 'error' });
    }
  };

  const handleBulkSubmit = async () => {
    if (!selected.size) return;
    setSubmitting(true);
    try {
      await bulkSubmitPriceOffs([...selected]);
      enqueueSnackbar(`${selected.size} campaign(s) submitted for approval`, { variant: 'success' });
      await loadCampaigns();
    } catch (err) {
      enqueueSnackbar(await extractPriceOffError(err, 'Submit failed'), { variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleBulkDelete = async () => {
    if (!selected.size) return;
    setDeleting(true);
    try {
      await bulkDeletePriceOffs([...selected]);
      enqueueSnackbar(`${selected.size} draft campaign(s) deleted`, { variant: 'success' });
      await loadCampaigns();
    } catch (err) {
      enqueueSnackbar(await extractPriceOffError(err, 'Delete failed'), { variant: 'error' });
    } finally {
      setDeleting(false);
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

  return (
    <Box sx={{ p: 3 }}>
      <PageHeader
        title="Consumer Price Offs"
        subtitle="Upload campaigns as DRAFT, submit for approval, then assign campaign IDs to go live."
      />

      <Box sx={{ display: 'flex', gap: 1.5, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <Button
          variant="outlined"
          startIcon={downloading ? <CircularProgress size={16} /> : <Download />}
          onClick={handleDownloadTemplate}
          disabled={downloading}
        >
          Download Template
        </Button>
        <Button
          variant="contained"
          startIcon={<Send />}
          disabled={!allDraftSelected || submitting}
          onClick={handleBulkSubmit}
        >
          Submit for Approval ({selected.size})
        </Button>
        <Button
          variant="outlined"
          color="error"
          startIcon={<Delete />}
          disabled={!allDraftSelected || deleting}
          onClick={handleBulkDelete}
        >
          Delete ({selected.size})
        </Button>
        <Button
          variant="outlined"
          disabled={!allCampaignIdEligible}
          onClick={() => setBulkDialogOpen(true)}
        >
          Update Campaign ID ({selected.size})
        </Button>
      </Box>

      <Box
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleUpload(e.dataTransfer.files?.[0]);
        }}
        onClick={() => fileInputRef.current?.click()}
        sx={{
          border: `2px dashed ${dragOver ? BRAND.red : alpha('#64748B', 0.35)}`,
          borderRadius: 2,
          p: 2.5,
          mb: 2,
          textAlign: 'center',
          cursor: 'pointer',
          bgcolor: dragOver ? alpha(BRAND.red, 0.04) : '#FAFBFC',
        }}
      >
        <input ref={fileInputRef} type="file" accept=".xlsx,.xls" hidden onChange={(e) => handleUpload(e.target.files?.[0])} />
        {uploading ? (
          <CircularProgress size={24} />
        ) : (
          <>
            <UploadFile sx={{ fontSize: 28, color: 'text.secondary', mb: 0.5 }} />
            <Typography variant="body2" fontWeight={600}>Upload Excel — rows save as DRAFT</Typography>
          </>
        )}
      </Box>

      {uploadErrors.length > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {uploadErrors.map((error) => (
            <Typography key={`${error.rowNumber}-${error.message}`} variant="caption" display="block">
              Row {error.rowNumber}: {error.message}
            </Typography>
          ))}
        </Alert>
      )}

      <Paper variant="outlined" sx={{ width: '100%' }}>
        <PriceOffTableShell
          loading={loading}
          empty={!loading && campaigns.length === 0}
          emptyMessage="No campaigns match the current filters."
          pagination={(
            <TablePagination
              component="div"
              count={totalElements}
              page={page}
              onPageChange={(_, next) => setPage(next)}
              rowsPerPage={pageSize}
              onRowsPerPageChange={(e) => {
                setPageSize(parseInt(e.target.value, 10));
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
                    checked={allVisibleSelected}
                    indeterminate={someVisibleSelected && !allVisibleSelected}
                    onChange={toggleSelectAllVisible}
                    disabled={visibleIds.length === 0}
                    sx={{ p: 0.5 }}
                    inputProps={{ 'aria-label': 'Select all campaigns on this page' }}
                  />
                </StickyCheckboxCell>
              <TableCell sx={filterHeaderFlexCellSx(PRICE_OFF_COLUMN_WIDTHS.product.minWidth)}>
                <HeaderFilterStack
                  sortLabel={(
                    <TableSortLabel
                      active={activeSort.field === 'productName'}
                      direction={activeSort.field === 'productName' ? activeSort.sort : 'asc'}
                      onClick={() => handleSort('productName')}
                    >
                      Product
                    </TableSortLabel>
                  )}
                >
                  <HeaderTextFilter
                    placeholder="Name / ID"
                    value={filters.product}
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
                    value={filters.location}
                    onChange={(v) => updateFilter('location', v)}
                  />
                </HeaderFilterStack>
              </TableCell>
              <TableCell sx={filterHeaderCellSx(PRICE_OFF_COLUMN_WIDTHS.channel)}>
                <HeaderFilterStack label="Channel">
                  <HeaderMasterFilter
                    options={channelOptions}
                    value={filters.channel}
                    onChange={(v) => updateFilter('channel', v)}
                    placeholder="Search channel"
                  />
                </HeaderFilterStack>
              </TableCell>
              <TableCell sx={filterHeaderCellSx(PRICE_OFF_COLUMN_WIDTHS.discountType)}>
                <HeaderFilterStack label="Discount Type">
                  <HeaderMasterFilter
                    options={discountTypeOptions}
                    value={filters.discountType}
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
              <TableCell sx={headerCellSx(PRICE_OFF_COLUMN_WIDTHS.fromQty)}>
                <HeaderLabel>From Qty</HeaderLabel>
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
              <TableCell sx={headerCellSx(PRICE_OFF_COLUMN_WIDTHS.maxUnitCap)}>
                <HeaderLabel>Max Cap</HeaderLabel>
              </TableCell>
              <TableCell sx={filterHeaderCellSx(PRICE_OFF_COLUMN_WIDTHS.campaignId)}>
                <HeaderFilterStack label="Campaign ID">
                  <HeaderTextFilter
                    placeholder="Filter"
                    value={filters.campaignId}
                    onChange={(v) => updateFilter('campaignId', v)}
                  />
                </HeaderFilterStack>
              </TableCell>
              <TableCell sx={filterHeaderCellSx(PRICE_OFF_COLUMN_WIDTHS.status)}>
                <HeaderFilterStack label="Status">
                  <HeaderSelectFilter
                    value={filters.status}
                    onChange={(v) => updateFilter('status', v)}
                    options={STATUS_OPTIONS}
                  />
                </HeaderFilterStack>
              </TableCell>
              <TableCell sx={headerCellSx(PRICE_OFF_COLUMN_WIDTHS.updatedAt)}>
                <TableSortLabel
                  active={activeSort.field === 'updatedAt'}
                  direction={activeSort.field === 'updatedAt' ? activeSort.sort : 'asc'}
                  onClick={() => handleSort('updatedAt')}
                >
                  Updated
                </TableSortLabel>
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {!loading && campaigns.map((row) => (
              <TableRow key={row.id} hover sx={{ cursor: 'pointer' }} onClick={() => openDetail(row)}>
                <StickyCheckboxCell onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    size="small"
                    checked={selected.has(row.id)}
                    onChange={() => toggleSelect(row.id)}
                    sx={{ p: 0.5 }}
                    inputProps={{ 'aria-label': `Select campaign ${row.id}` }}
                  />
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
                <TableCell sx={dataCellSx(PRICE_OFF_COLUMN_WIDTHS.fromQty)}>{row.fromQty ?? '—'}</TableCell>
                <TableCell sx={dataCellSx(PRICE_OFF_COLUMN_WIDTHS.marginPercent)}>{formatPercent(row.marginPercent)}</TableCell>
                <TableCell sx={dataCellSx(PRICE_OFF_COLUMN_WIDTHS.finalOffer)}>{formatFinalOffer(row.finalOffer, row.discountType)}</TableCell>
                <TableCell sx={dataCellSx(PRICE_OFF_COLUMN_WIDTHS.percentOff)}>{formatPercent(row.percentOff)}</TableCell>
                <TableCell sx={dataCellSx(PRICE_OFF_COLUMN_WIDTHS.finalMarginPercent)}>{formatPercent(row.finalMarginPercent)}</TableCell>
                <TableCell sx={dataCellSx(PRICE_OFF_COLUMN_WIDTHS.maxUnitCap)}>{row.maxUnitCap ?? '—'}</TableCell>
                <TableCell sx={dataCellSx(PRICE_OFF_COLUMN_WIDTHS.campaignId)}>
                  <PriceOffTextCell value={row.campaignId} />
                </TableCell>
                <TableCell sx={dataCellSx(PRICE_OFF_COLUMN_WIDTHS.status)}><StatusBadge status={row.displayStatus || row.approvalStatus} /></TableCell>
                <TableCell sx={dataCellSx(PRICE_OFF_COLUMN_WIDTHS.updatedAt)}>{row.updatedAt ? new Date(row.updatedAt).toLocaleString() : '—'}</TableCell>
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
        editingCampaignId={editingCampaignId}
        draftCampaignId={draftCampaignId}
        onStartEditCampaignId={() => setEditingCampaignId(true)}
        onDraftCampaignIdChange={setDraftCampaignId}
        onSaveCampaignId={handleSaveCampaignId}
        savingCampaignId={savingCampaignId}
        allowCampaignIdEdit={['APPROVED', 'PENDING_ACTIVATION'].includes(activeCampaign?.displayStatus)}
      />

      <Dialog open={bulkDialogOpen} onClose={() => setBulkDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Bulk Update Campaign ID</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            size="small"
            label="Campaign ID"
            value={bulkCampaignId}
            onChange={(e) => setBulkCampaignId(e.target.value)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBulkDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleBulkCampaignIdSave}>Save</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
