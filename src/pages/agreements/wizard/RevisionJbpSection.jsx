import { useRef, useState } from 'react';
import {
  Alert, Box, Button, CircularProgress, Typography,
} from '@mui/material';
import { Download, UploadFile } from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import { alpha } from '@mui/material/styles';
import { BRAND } from '../../../config/theme';
import {
  downloadBlob,
  exportJbpTemplateFromSource,
  extractApiErrorMessage,
  extractParseRowErrors,
  parseJbpWorkbook,
} from '../../../api/revisionCommercialApi';

/**
 * Edit/Renew JBP: export template from source + parse Excel → React state.
 */
export default function RevisionJbpSection({
  sourceVersionId,
  jbp,
  parseErrors = [],
  onParsed,
}) {
  const { enqueueSnackbar } = useSnackbar();
  const fileInputRef = useRef(null);
  const [downloading, setDownloading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const sheetCount = jbp?.sheets?.length ?? 0;
  const rowCount = (jbp?.sheets ?? []).reduce((sum, s) => sum + (s.rows?.length ?? 0), 0);

  const handleDownload = async () => {
    if (!sourceVersionId) {
      enqueueSnackbar('Source version required for JBP template', { variant: 'warning' });
      return;
    }
    setDownloading(true);
    try {
      const blob = await exportJbpTemplateFromSource(sourceVersionId);
      downloadBlob(blob, 'JBP_Template.xlsx');
    } catch (err) {
      enqueueSnackbar(await extractApiErrorMessage(err, 'Failed to export JBP template'), {
        variant: 'error',
      });
    } finally {
      setDownloading(false);
    }
  };

  const handleUpload = async (file) => {
    if (!file || !sourceVersionId) return;
    setUploading(true);
    try {
      const staged = await parseJbpWorkbook(sourceVersionId, file);
      onParsed?.({ jbp: staged, jbpParseErrors: [] });
      enqueueSnackbar('JBP workbook parsed into memory', { variant: 'success' });
    } catch (err) {
      const rowErrors = extractParseRowErrors(err);
      onParsed?.({ jbp: null, jbpParseErrors: rowErrors });
      enqueueSnackbar(await extractApiErrorMessage(err, 'JBP parse failed'), { variant: 'error' });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Typography variant="body2" color="text.secondary">
        Download template from the source version, fill targets, then upload. Parsed data stays in memory
        until Submit for Approval. Leave empty to keep source JBP on submit.
      </Typography>
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        <Button
          size="small"
          variant="outlined"
          startIcon={downloading ? <CircularProgress size={14} /> : <Download />}
          onClick={handleDownload}
          disabled={downloading || !sourceVersionId}
        >
          Export Source Template
        </Button>
        <Button
          size="small"
          variant="contained"
          startIcon={uploading ? <CircularProgress size={14} color="inherit" /> : <UploadFile />}
          onClick={() => fileInputRef.current?.click()}
          disabled={!sourceVersionId || uploading}
          sx={{ bgcolor: BRAND.red }}
        >
          Upload Completed Workbook
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

      {parseErrors.length > 0 && (
        <Alert severity="error">
          {parseErrors.slice(0, 12).map((msg) => (
            <Typography key={msg} variant="caption" display="block">{msg}</Typography>
          ))}
          {parseErrors.length > 12 && (
            <Typography variant="caption">…and {parseErrors.length - 12} more</Typography>
          )}
        </Alert>
      )}

      {sheetCount > 0 ? (
        <Alert severity="success" sx={{ bgcolor: alpha(BRAND.green, 0.08) }}>
          In memory: {sheetCount} sheet(s), {rowCount} row(s)
          {jbp?.selectedFrequencies?.length
            ? ` · frequencies: ${jbp.selectedFrequencies.join(', ')}`
            : ''}
        </Alert>
      ) : (
        <Typography variant="body2" color="text.secondary">
          No in-memory JBP override — source JBP will be deep-copied on submit.
        </Typography>
      )}
    </Box>
  );
}
