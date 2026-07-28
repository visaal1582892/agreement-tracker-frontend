import { useEffect, useRef, useState, useMemo } from 'react';
import {
  Alert, Box, Button, CircularProgress, Typography,
} from '@mui/material';
import { Download, UploadFile } from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import { alpha } from '@mui/material/styles';
import { BRAND } from '../../../config/theme';
import {
  downloadBlob,
  downloadStatelessStoreTemplate,
  extractApiErrorMessage,
  extractParseRowErrors,
  parseStoreMappings,
} from '../../../api/revisionCommercialApi';
import { fetchStoreMappings } from '../../../api/storeMappingApi';
import StoreMappingTable from './StoreMappingTable';

function normalizeStoreRow(store) {
  return {
    id: store.storeId || store.mappingId || store.id,
    storeId: store.storeId,
    storeName: store.storeName,
    state: store.state,
    city: store.city,
    address: store.address,
  };
}

/**
 * Edit/Renew store mapping: parse Excel → React state (no DB write).
 * Shows source version stores as preview when no in-memory override.
 */
export default function RevisionStoreMappingSection({
  sourceVersionId,
  storeMappings,
  parseErrors = [],
  onParsed,
}) {
  const { enqueueSnackbar } = useSnackbar();
  const fileInputRef = useRef(null);
  const [downloading, setDownloading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [sourceStores, setSourceStores] = useState([]);
  const [sourceLoading, setSourceLoading] = useState(false);
  const [sourceLoadError, setSourceLoadError] = useState(null);

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [search, setSearch] = useState('');
  const [sourceTotalElements, setSourceTotalElements] = useState(0);
  
  const [selectedIds, setSelectedIds] = useState(new Set());

  const overrideStores = Array.isArray(storeMappings) ? storeMappings : null;
  const showingSourcePreview = overrideStores == null;

  // Reset page/search/selection when toggle preview mode
  useEffect(() => {
    setPage(0);
    setSearch('');
    setSelectedIds(new Set());
  }, [showingSourcePreview]);

  useEffect(() => {
    if (!sourceVersionId || !showingSourcePreview) {
      setSourceStores([]);
      setSourceTotalElements(0);
      setSourceLoadError(null);
      return undefined;
    }

    let cancelled = false;
    setSourceLoading(true);
    setSourceLoadError(null);

    const loadData = async () => {
      try {
        const response = await fetchStoreMappings(sourceVersionId, {
          page: page,
          size: rowsPerPage,
          search: search || undefined
        });
        if (cancelled) return;
        let list = [];
        let total = 0;
        if (Array.isArray(response)) {
          list = response;
          total = response.length;
        } else if (response && Array.isArray(response.content)) {
          list = response.content;
          total = response.totalElements ?? response.content.length;
        } else if (response && Array.isArray(response.data)) {
          list = response.data;
          total = response.totalElements ?? response.data.length;
        }
        
        list = list.map(normalizeStoreRow);
        setSourceStores(list);
        setSourceTotalElements(total);
      } catch (err) {
        console.error('Failed to load source store mappings', err);
        if (!cancelled) {
          setSourceStores([]);
          setSourceTotalElements(0);
          setSourceLoadError(
            err.response?.data?.message || 'Unable to load previous store mappings',
          );
        }
      } finally {
        if (!cancelled) setSourceLoading(false);
      }
    };

    const timer = setTimeout(loadData, search ? 300 : 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [sourceVersionId, showingSourcePreview, page, rowsPerPage, search]);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const blob = await downloadStatelessStoreTemplate();
      downloadBlob(blob, 'store-mapping-template.xlsx');
    } catch (err) {
      enqueueSnackbar(await extractApiErrorMessage(err, 'Failed to download template'), { variant: 'error' });
    } finally {
      setDownloading(false);
    }
  };

  const handleUpload = async (file) => {
    if (!file || !sourceVersionId) return;
    setUploading(true);
    try {
      const result = await parseStoreMappings(sourceVersionId, file);
      const mapped = (result?.successfullyMapped ?? []).map(normalizeStoreRow);
      const softErrors = (result?.errors ?? []).map(
        (e) => `R${e.row ?? '?'}: ${e.storeCode ?? ''} — ${e.message}`,
      );
      onParsed?.({ storeMappings: mapped, storeParseErrors: softErrors });
      if (softErrors.length > 0) {
        enqueueSnackbar(
          `${mapped.length} store(s) parsed, ${softErrors.length} skipped`,
          { variant: 'warning' },
        );
      } else {
        enqueueSnackbar(`${mapped.length} store(s) parsed into memory`, { variant: 'success' });
      }
    } catch (err) {
      const rowErrors = extractParseRowErrors(err);
      onParsed?.({ storeMappings: null, storeParseErrors: rowErrors });
      enqueueSnackbar(
        await extractApiErrorMessage(err, 'Store parse failed'),
        { variant: 'error' },
      );
    } finally {
      setUploading(false);
    }
  };

  const handleClearOverride = () => {
    onParsed?.({ storeMappings: null, storeParseErrors: [] });
  };

  const handleToggle = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAllToggle = () => {
    const currentIds = storesToDisplay.map((s) => s.id);
    const allSelected = currentIds.every((id) => selectedIds.has(id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        currentIds.forEach((id) => next.delete(id));
      } else {
        currentIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    
    if (showingSourcePreview) {
      setSourceLoading(true);
      try {
        const response = await fetchStoreMappings(sourceVersionId, { size: 10000 });
        let list = [];
        if (Array.isArray(response)) list = response;
        else if (response && Array.isArray(response.content)) list = response.content;
        else if (response && Array.isArray(response.data)) list = response.data;

        const allSourceStores = list.map(normalizeStoreRow);
        const nextStores = allSourceStores.filter(s => !selectedIds.has(s.id));
        onParsed?.({ storeMappings: nextStores, storeParseErrors: [] });
        setSelectedIds(new Set());
        setPage(0);
        enqueueSnackbar('Converted to in-memory override and deleted selected stores.', { variant: 'info' });
      } catch (err) {
        enqueueSnackbar('Failed to fetch full source list for deletion.', { variant: 'error' });
      } finally {
        setSourceLoading(false);
      }
    } else {
      const nextStores = overrideStores.filter(s => !selectedIds.has(s.id));
      onParsed?.({ storeMappings: nextStores, storeParseErrors: parseErrors });
      setSelectedIds(new Set());
      setPage(0);
    }
  };

  const handleDeleteAll = () => {
    onParsed?.({ storeMappings: [], storeParseErrors: [] });
    setSelectedIds(new Set());
    setPage(0);
  };

  // Client-side filtering and slicing for in-memory override stores
  const filteredOverride = (overrideStores || []).filter(s =>
    !search ||
    s.storeId?.toLowerCase().includes(search.toLowerCase()) ||
    s.storeName?.toLowerCase().includes(search.toLowerCase())
  );
  const displayedOverride = filteredOverride.slice(page * rowsPerPage, (page + 1) * rowsPerPage);

  const totalElements = showingSourcePreview ? sourceTotalElements : filteredOverride.length;
  const storesToDisplay = showingSourcePreview ? sourceStores : displayedOverride;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Typography variant="body2" color="text.secondary">
        Upload replaces store mappings for this Edit/Renew. Leave empty to keep source stores on submit.
      </Typography>
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        <Button
          size="small"
          variant="outlined"
          startIcon={downloading ? <CircularProgress size={14} /> : <Download />}
          onClick={handleDownload}
          disabled={downloading}
        >
          Download Template
        </Button>
        <Button
          size="small"
          variant="contained"
          startIcon={uploading ? <CircularProgress size={14} color="inherit" /> : <UploadFile />}
          onClick={() => fileInputRef.current?.click()}
          disabled={!sourceVersionId || uploading}
          sx={{ bgcolor: BRAND.red }}
        >
          Upload Excel
        </Button>
        {overrideStores != null && (
          <Button size="small" variant="text" onClick={handleClearOverride}>
            Keep source stores
          </Button>
        )}
        <Button
          size="small"
          variant="text"
          color="error"
          onClick={handleDeleteAll}
          disabled={totalElements === 0}
        >
          Delete All Stores
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            handleUpload(file);
          }}
        />
      </Box>

      <Box
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleUpload(e.dataTransfer.files?.[0]);
        }}
        sx={{
          border: '1px dashed',
          borderColor: dragOver ? BRAND.red : 'divider',
          bgcolor: dragOver ? alpha(BRAND.red, 0.04) : 'transparent',
          borderRadius: 1,
          p: 2,
          textAlign: 'center',
        }}
      >
        <Typography variant="body2" color="text.secondary">
          Drop store-code workbook here
        </Typography>
      </Box>

      {parseErrors.length > 0 && (
        <Alert severity="warning">
          {parseErrors.slice(0, 8).map((msg) => (
            <Typography key={msg} variant="caption" display="block">{msg}</Typography>
          ))}
          {parseErrors.length > 8 && (
            <Typography variant="caption">…and {parseErrors.length - 8} more</Typography>
          )}
        </Alert>
      )}

      {sourceLoadError && showingSourcePreview && (
        <Alert severity="warning">{sourceLoadError}</Alert>
      )}

      {sourceLoading && showingSourcePreview ? (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CircularProgress size={16} />
          <Typography variant="body2" color="text.secondary">Loading previous stores…</Typography>
        </Box>
      ) : (totalElements > 0 || search) ? (
        <>
          <Typography variant="subtitle2" fontWeight={700}>
            {showingSourcePreview
              ? `Previous stores (${totalElements}) — kept on submit unless you upload a replacement`
              : `Replacement stores (${totalElements}) — will replace source on submit`}
          </Typography>
          
          <StoreMappingTable
            stores={storesToDisplay}
            selectable={true}
            selectedIds={selectedIds}
            onToggle={handleToggle}
            onSelectAllToggle={handleSelectAllToggle}
            onBulkDelete={handleBulkDelete}
            isAllSelected={storesToDisplay.length > 0 && storesToDisplay.every(s => selectedIds.has(s.id))}
            deleting={sourceLoading}
            page={page}
            rowsPerPage={rowsPerPage}
            totalElements={totalElements}
            onPageChange={(e, newPage) => setPage(newPage)}
            onRowsPerPageChange={(e) => {
              setRowsPerPage(parseInt(e.target.value, 10));
              setPage(0);
            }}
            search={search}
            onSearchChange={(val) => {
              setSearch(val);
              setPage(0);
            }}
          />
        </>
      ) : (
        <Typography variant="body2" color="text.secondary">
          {showingSourcePreview
            ? 'No source stores found on this version.'
            : 'No in-memory store override — source stores will be deep-copied on submit.'}
        </Typography>
      )}
    </Box>
  );
}
