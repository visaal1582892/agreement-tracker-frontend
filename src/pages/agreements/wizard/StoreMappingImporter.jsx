import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert, Box, Button, CircularProgress, Typography,
} from '@mui/material';
import { Download, UploadFile } from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import { alpha } from '@mui/material/styles';
import { BRAND } from '../../../config/theme';
import WizardSectionTitle from '../../../components/wizard/WizardSectionTitle';
import WizardFieldAnchor from '../../../components/wizard/WizardFieldAnchor';
import {
  deleteStoreMappings,
  downloadBlob,
  downloadStoreMappingTemplate,
  extractApiErrorMessage,
  fetchStoreMappings,
  uploadStoreMappings,
} from '../../../api/storeMappingApi';
import StoreMappingTable from './StoreMappingTable';

export default function StoreMappingImporter({
  agreementVersionId,
  fieldError,
  onMappingsChange,
}) {
  const { enqueueSnackbar } = useSnackbar();
  const fileInputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [stores, setStores] = useState([]);
  const [skippedReport, setSkippedReport] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadStores = useCallback(async () => {
    if (!agreementVersionId) {
      setStores([]);
      onMappingsChange?.([]);
      return;
    }
    setLoading(true);
    try {
      const data = await fetchStoreMappings(agreementVersionId);
      const list = Array.isArray(data) ? data : [];
      setStores(list);
      setSelectedIds(new Set());
      onMappingsChange?.(list);
    } catch {
      enqueueSnackbar('Unable to load mapped stores', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [agreementVersionId, enqueueSnackbar, onMappingsChange]);

  useEffect(() => {
    loadStores();
  }, [loadStores]);

  const handleDownloadTemplate = async () => {
    if (!agreementVersionId) {
      enqueueSnackbar('Save contract details before downloading template', { variant: 'warning' });
      return;
    }
    setDownloading(true);
    try {
      const blob = await downloadStoreMappingTemplate(agreementVersionId);
      downloadBlob(blob, 'store-mapping-template.xlsx');
    } catch {
      enqueueSnackbar('Failed to download store template', { variant: 'error' });
    } finally {
      setDownloading(false);
    }
  };

  const handleUpload = async (file) => {
    if (!file || !agreementVersionId) return;
    setUploading(true);
    try {
      const result = await uploadStoreMappings(agreementVersionId, file);
      const mappedCount = result?.successfullyMapped?.length ?? 0;
      const skippedCount = result?.skippedStores?.length ?? 0;

      setSkippedReport(skippedCount > 0 ? result : null);
      await loadStores();

      if (skippedCount > 0) {
        enqueueSnackbar(
          `${mappedCount} store(s) mapped, ${skippedCount} skipped`,
          { variant: 'warning' },
        );
      } else {
        enqueueSnackbar(`${mappedCount} store(s) mapped`, { variant: 'success' });
      }
    } catch (err) {
      const message = await extractApiErrorMessage(err, 'Store upload failed');
      enqueueSnackbar(message, { variant: 'error' });
    } finally {
      setUploading(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === stores.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(stores.map((store) => store.mappingId || store.id)));
    }
  };

  const toggleRow = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDeleteSelected = async () => {
    if (!selectedIds.size || !agreementVersionId) return;
    setDeleting(true);
    try {
      await deleteStoreMappings(agreementVersionId, [...selectedIds]);
      await loadStores();
      enqueueSnackbar('Selected stores removed', { variant: 'success' });
    } catch (err) {
      enqueueSnackbar(err.response?.data?.message || 'Failed to delete stores', { variant: 'error' });
    } finally {
      setDeleting(false);
    }
  };

  const skippedStores = skippedReport?.skippedStores ?? [];
  const mappedSuccessCount = skippedReport?.successfullyMapped?.length ?? 0;

  return (
    <Box sx={{ mt: 2 }}>
      
      {/* Top Header Bar: Flex aligned Title on Left, Download Pill on Right */}
      <Box sx={{ 
        display: 'flex', 
        flexDirection: { xs: 'column', sm: 'row' }, 
        justifyContent: 'space-between', 
        alignItems: { xs: 'flex-start', sm: 'center' }, 
        gap: 1.5, 
        mb: 2 
      }}>
        <WizardSectionTitle
          title="Store Mapping"
          info="Download template, upload store codes, then review mapped stores."
          variant="subtitle2"
          fontWeight={700}
          mb={0}
        />
        <Button
          variant="outlined"
          size="small"
          startIcon={downloading ? <CircularProgress size={16} color="inherit" /> : <Download />}
          onClick={handleDownloadTemplate}
          disabled={!agreementVersionId || downloading}
          sx={{ borderRadius: 2, textTransform: 'none' }}
        >
          Download Store ID Template
        </Button>
      </Box>

      {/* The Excel Dropzone */}
      <WizardFieldAnchor field="storeMappings" error={fieldError}>
        <Box
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            handleUpload(e.dataTransfer.files[0]);
          }}
          onClick={() => fileInputRef.current?.click()}
          sx={{
            border: `2px dashed ${fieldError ? BRAND.red : BRAND.borderLight}`,
            borderRadius: '10px',
            bgcolor: dragOver ? alpha(BRAND.red, 0.04) : BRAND.bgGray,
            p: 2.5,
            textAlign: 'center',
            cursor: agreementVersionId ? 'pointer' : 'not-allowed',
            opacity: agreementVersionId ? 1 : 0.6,
            transition: 'background-color 0.15s ease, border-color 0.15s ease',
            '&:hover': agreementVersionId ? { bgcolor: alpha(BRAND.red, 0.03), borderColor: '#94A3B8' } : {},
          }}
        >
          {uploading ? (
            <CircularProgress size={28} sx={{ mb: 1 }} />
          ) : (
            <UploadFile sx={{ fontSize: 36, color: BRAND.textSecondary, mb: 0.5 }} />
          )}
          <Typography variant="body2" color="text.secondary">
            Upload Mapped Stores (.xlsx)
          </Typography>
          <input
            ref={fileInputRef}
            type="file"
            hidden
            accept=".xlsx,.xls"
            onChange={(e) => {
              handleUpload(e.target.files[0]);
              e.target.value = '';
            }}
          />
        </Box>
      </WizardFieldAnchor>

      {/* Material-UI Native Skipped Stores Warning Box */}
      {skippedStores.length > 0 && (
        <Alert 
          severity="warning" 
          onClose={() => setSkippedReport(null)}
          sx={{ mt: 2.5, borderRadius: 2, '& .MuiAlert-message': { width: '100%' } }}
        >
          <Typography variant="body2" fontWeight={600} color="warning.dark">
            Uploaded with warnings: {mappedSuccessCount} stores mapped successfully, {skippedStores.length} stores skipped.
          </Typography>
          <Box sx={{ mt: 1, maxHeight: 130, overflowY: 'auto', pr: 1 }}>
            <ul style={{ margin: 0, paddingLeft: 16, fontSize: '0.75rem', color: 'inherit' }}>
              {skippedStores.map((err) => (
                <li key={`${err.storeCode}-${err.reason}`} style={{ marginBottom: 4 }}>
                  <strong>{err.storeCode}</strong>: {err.reason}
                </li>
              ))}
            </ul>
          </Box>
        </Alert>
      )}

      {/* Main Data Table Area */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress size={28} />
        </Box>
      ) : stores.length > 0 ? (
        <Box sx={{ mt: 1 }}>
          <StoreMappingTable
            stores={stores}
            // Defensive Prop-Bridging for both new MUI Table spec & old legacy table spec:
            selected={Array.from(selectedIds)}
            selectedIds={selectedIds}
            onSelectRow={toggleRow}
            onToggle={toggleRow}
            onSelectAllToggle={toggleSelectAll}
            isAllSelected={stores.length > 0 && selectedIds.size === stores.length}
            onBulkDelete={handleDeleteSelected}
            deleting={deleting}
            selectable={true}
          />
        </Box>
      ) : null}

    </Box>
  );
}