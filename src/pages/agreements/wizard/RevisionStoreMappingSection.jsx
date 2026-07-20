import { useEffect, useRef, useState } from 'react';
import {
  Alert, Box, Button, CircularProgress, Table, TableBody, TableCell,
  TableHead, TableRow, Typography,
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

function normalizeStoreRow(store) {
  return {
    storeId: store.storeId,
    storeCode: store.storeCode,
    storeName: store.storeName,
    stateId: store.stateId,
    stateName: store.stateName,
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

  const overrideStores = Array.isArray(storeMappings) ? storeMappings : null;
  const displayStores = overrideStores ?? sourceStores;
  const showingSourcePreview = overrideStores == null;

  useEffect(() => {
    if (!sourceVersionId) {
      setSourceStores([]);
      setSourceLoadError(null);
      return undefined;
    }

    let cancelled = false;
    setSourceLoading(true);
    setSourceLoadError(null);

    fetchStoreMappings(sourceVersionId)
      .then((data) => {
        if (cancelled) return;
        const list = Array.isArray(data) ? data.map(normalizeStoreRow) : [];
        setSourceStores(list);
      })
      .catch((err) => {
        console.error('Failed to load source store mappings', err);
        if (!cancelled) {
          setSourceStores([]);
          setSourceLoadError(
            err.response?.data?.message || 'Unable to load previous store mappings',
          );
        }
      })
      .finally(() => {
        if (!cancelled) setSourceLoading(false);
      });

    return () => { cancelled = true; };
  }, [sourceVersionId]);

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
      ) : displayStores.length > 0 ? (
        <>
          <Typography variant="subtitle2" fontWeight={700}>
            {showingSourcePreview
              ? `Previous stores (${displayStores.length}) — kept on submit unless you upload a replacement`
              : `Replacement stores (${displayStores.length}) — will replace source on submit`}
          </Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Store Code</TableCell>
                <TableCell>Name</TableCell>
                <TableCell>State</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {displayStores.slice(0, 50).map((s) => (
                <TableRow key={s.storeId || s.storeCode}>
                  <TableCell>{s.storeCode}</TableCell>
                  <TableCell>{s.storeName}</TableCell>
                  <TableCell>{s.stateName}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {displayStores.length > 50 && (
            <Typography variant="caption" color="text.secondary">
              Showing 50 of {displayStores.length} stores
            </Typography>
          )}
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
