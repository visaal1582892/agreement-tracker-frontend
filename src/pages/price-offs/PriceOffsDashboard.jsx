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
import PriceOffEditDialog from './PriceOffEditDialog';
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
  isPriceOffValidationErrorBlob,
  fetchPriceOffCampaign,
  fetchPriceOffCampaigns,
  fetchPriceOffFilterOptions,
  fetchPriceOffLocations,
  formatFinalOffer,
  formatMoney,
  formatOfferValue,
  formatPercent,
  formatPercentOff,
  updatePriceOffCampaignId,
  updatePriceOffCampaign,
  previewPriceOffCampaigns,
  commitPriceOffCampaigns,
} from '../../api/priceOffsApi';
import PriceOffUploadPreviewDialog from './PriceOffUploadPreviewDialog';

const STATUS_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'PENDING_APPROVAL', label: 'Pending Approval' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'PENDING_ACTIVATION', label: 'Pending Campaign ID' },
  { value: 'LIVE', label: 'Live' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'EXPIRED', label: 'Expired' },
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
  const [allLocations, setAllLocations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [uploadErrors, setUploadErrors] = useState([]);
  const [uploadSummary, setUploadSummary] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [committing, setCommitting] = useState(false);
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
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

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

  useEffect(() => {
    fetchPriceOffLocations()
      .then((locations) => {
        setAllLocations(locations ?? []);
      })
      .catch(() => enqueueSnackbar('Failed to load price off location columns', { variant: 'error' }));
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

  const selectedDraftRows = useMemo(
    () => selectedRows.filter((row) => row.approvalStatus === 'DRAFT'),
    [selectedRows],
  );

  const selectedCampaignIdRows = useMemo(
    () => selectedRows.filter((row) => ['APPROVED', 'PENDING_ACTIVATION'].includes(row.displayStatus)),
    [selectedRows],
  );

  const allDraftSelected = selectedDraftRows.length > 0
    && selectedDraftRows.length === selectedRows.length
    && selectedDraftRows.every((row) => row.approvalStatus === 'DRAFT');
  const allCampaignIdEligible = selectedCampaignIdRows.length > 0
    && selectedCampaignIdRows.length === selectedRows.length;

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

  // Drop stale IDs (e.g. deleted rows) once all campaigns fit on current page
  useEffect(() => {
    if (totalElements > pageSize) return;
    setSelected((prev) => {
      if (prev.size === 0) return prev;
      const validIds = new Set(campaigns.map((row) => row.id));
      const next = new Set([...prev].filter((id) => validIds.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [campaigns, totalElements, pageSize]);

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
      if (allVisibleSelected) {
        const next = new Set(prev);
        visibleIds.forEach((id) => next.delete(id));
        return next;
      }
      const next = new Set(prev);
      visibleIds.forEach((id) => next.add(id));
      return next;
    });
  };

  const removeFromSelection = useCallback((ids) => {
    setSelected((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      return next.size === prev.size ? prev : next;
    });
  }, []);

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
    setUploadSummary(null);
    setPreviewData(null);
    try {
      const preview = await previewPriceOffCampaigns(file);
      setPreviewData(preview);
      setPreviewOpen(true);
      if (!preview.canCommit) {
        setUploadErrors(['The uploaded file has structural errors.']);
      }
    } catch (err) {
      if (isPriceOffValidationErrorBlob(err)) {
        enqueueSnackbar('Validation errors found in the file. Downloading error file...', { variant: 'error' });
        downloadBlob(err?.response?.data, 'price-offs-validation-errors.xlsx');
      } else {
        enqueueSnackbar(await extractPriceOffError(err, 'Preview failed'), { variant: 'error' });
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleCommitPreview = async () => {
    if (!previewData?.canCommit) return;
    setCommitting(true);
    try {
      const summary = await commitPriceOffCampaigns(previewData.rows);
      setUploadSummary(summary);
      setPreviewOpen(false);
      setPreviewData(null);
      setUploadErrors([]);
      enqueueSnackbar(`Saved ${summary.successfullyParsedRows} draft campaign(s)`, { variant: 'success' });
      setSelected(new Set());
      await loadCampaigns();
    } catch (err) {
      enqueueSnackbar(await extractPriceOffError(err, 'Commit failed'), { variant: 'error' });
    } finally {
      setCommitting(false);
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

  const handleOpenEdit = () => {
    if (activeCampaign?.approvalStatus !== 'DRAFT') return;
    setEditDialogOpen(true);
  };

  const handleSaveEdit = async (payload) => {
    if (!activeCampaign) return;
    setSavingEdit(true);
    try {
      await updatePriceOffCampaign(activeCampaign.id, payload);
      const fresh = await fetchPriceOffCampaign(activeCampaign.id);
      setActiveCampaign(fresh);
      setEditDialogOpen(false);
      enqueueSnackbar('Draft campaign updated', { variant: 'success' });
      await loadCampaigns();
    } catch (err) {
      enqueueSnackbar(await extractPriceOffError(err, 'Failed to update campaign'), { variant: 'error' });
    } finally {
      setSavingEdit(false);
    }
  };

  const handleBulkCampaignIdSave = async () => {
    const ids = selectedCampaignIdRows.map((row) => row.id);
    if (!ids.length) return;
    try {
      await bulkUpdatePriceOffCampaignId(ids, bulkCampaignId);
      enqueueSnackbar(`Campaign ID updated for ${ids.length} record(s)`, { variant: 'success' });
      setBulkDialogOpen(false);
      setBulkCampaignId('');
      removeFromSelection(ids);
      await loadCampaigns();
    } catch (err) {
      enqueueSnackbar(await extractPriceOffError(err, 'Bulk campaign ID update failed'), { variant: 'error' });
    }
  };

  const handleBulkSubmit = async () => {
    const ids = selectedDraftRows.map((row) => row.id);
    if (!ids.length) return;
    setSubmitting(true);
    try {
      await bulkSubmitPriceOffs(ids);
      enqueueSnackbar(`${ids.length} campaign(s) submitted for approval`, { variant: 'success' });
      removeFromSelection(ids);
      await loadCampaigns();
    } catch (err) {
      enqueueSnackbar(await extractPriceOffError(err, 'Submit failed'), { variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleBulkDelete = async () => {
    const ids = selectedDraftRows.map((row) => row.id);
    if (!ids.length) return;
    setDeleting(true);
    try {
      await bulkDeletePriceOffs(ids);
      enqueueSnackbar(`${ids.length} draft campaign(s) deleted`, { variant: 'success' });
      removeFromSelection(ids);
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
        subtitle="Preview Excel uploads, fix errors, then commit all-or-nothing as DRAFT."
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
          Submit for Approval ({selectedDraftRows.length})
        </Button>
        <Button
          variant="outlined"
          color="error"
          startIcon={<Delete />}
          disabled={!allDraftSelected || deleting}
          onClick={handleBulkDelete}
        >
          Delete ({selectedDraftRows.length})
        </Button>
        <Button
          variant="outlined"
          disabled={!allCampaignIdEligible}
          onClick={() => setBulkDialogOpen(true)}
        >
          Update Campaign ID ({selectedCampaignIdRows.length})
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
            <Typography variant="body2" fontWeight={600}>Upload Excel — preview & validate before save</Typography>
          </>
        )}
      </Box>

      {uploadSummary && (
        <Alert
          severity={uploadSummary.errorRows > 0 ? 'warning' : 'success'}
          sx={{ mb: 3, borderRadius: '8px' }}
          onClose={() => setUploadSummary(null)}
        >
          <Typography variant="subtitle1" fontWeight="bold">
            Commit Successful: {uploadSummary.successfullyParsedRows} Drafts Created
          </Typography>
        </Alert>
      )}

      {uploadErrors.length > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {uploadErrors.map((error, index) => (
            <Typography key={`upload-error-${index}`} variant="caption" display="block">
              {error}
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
                    aria-label="Select all campaigns on this page"
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
              <TableCell sx={headerCellSx(PRICE_OFF_COLUMN_WIDTHS.manufacturer || 140)}>
                <HeaderLabel>Manufacturer</HeaderLabel>
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
              <TableRow
                key={row.id}
                hover
                sx={{
                  cursor: 'pointer',
                  bgcolor: row.isNegativeMargin ? 'error.light' : undefined,
                }}
                onClick={() => openDetail(row)}
              >
                <StickyCheckboxCell onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    size="small"
                    checked={selected.has(row.id)}
                    onChange={() => toggleSelect(row.id)}
                    sx={{ p: 0.5 }}
                    aria-label={`Select campaign ${row.id}`}
                  />
                </StickyCheckboxCell>
                <TableCell sx={dataCellSx(PRICE_OFF_COLUMN_WIDTHS.product.minWidth, { flex: true })}>
                  <PriceOffProductCell
                    name={row.productName}
                    code={row.productCode}
                    negativeMargin={row.isNegativeMargin}
                  />
                </TableCell>
                <TableCell sx={dataCellSx(PRICE_OFF_COLUMN_WIDTHS.manufacturer || 140)}>
                  <PriceOffTextCell value={row.manufacturerName} />
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
                <TableCell sx={dataCellSx(PRICE_OFF_COLUMN_WIDTHS.percentOff)}>{formatPercentOff(row.percentOff)}</TableCell>
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
        allowCampaignEdit={activeCampaign?.approvalStatus === 'DRAFT'}
        onEditCampaign={handleOpenEdit}
      />

      <PriceOffEditDialog
        open={editDialogOpen}
        campaign={activeCampaign}
        locations={allLocations}
        channelOptions={channelOptions}
        saving={savingEdit}
        onClose={() => setEditDialogOpen(false)}
        onSave={handleSaveEdit}
      />

      <PriceOffUploadPreviewDialog
        open={previewOpen}
        preview={previewData}
        committing={committing}
        onClose={() => {
          if (!committing) {
            setPreviewOpen(false);
            setPreviewData(null);
          }
        }}
        onCommit={handleCommitPreview}
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
