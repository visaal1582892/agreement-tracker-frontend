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
  downloadBlob,
  downloadStoreMappingTemplate,
  extractApiErrorMessage,
  fetchStoreMappings,
  parseStoreMappingsStateless,
} from '../../../api/storeMappingApi';
import StoreMappingTable from './StoreMappingTable';
import CustomStoreModal from '../../../components/common/CustomStoreModal';

export default function StoreMappingImporter({
  agreementVersionId,
  fieldError,
  storeMappings,
  onMappingsChange,
}) {
  const { enqueueSnackbar } = useSnackbar();
  const fileInputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [skippedReport, setSkippedReport] = useState(null);
  const [uploadFeedback, setUploadFeedback] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [savedPage, setSavedPage] = useState(0);
  const [savedRowsPerPage, setSavedRowsPerPage] = useState(20);
  const [newPage, setNewPage] = useState(0);
  const [newRowsPerPage, setNewRowsPerPage] = useState(20);
  const [search, setSearch] = useState('');

  // Initial load
  useEffect(() => {
    let active = true;
    const fetchInitial = async () => {
      if (!agreementVersionId || storeMappings != null) return;
      setLoading(true);
      try {
        const response = await fetchStoreMappings(agreementVersionId, { page: 0, size: 100000 });
        let list = [];
        if (Array.isArray(response)) list = response;
        else if (response && Array.isArray(response.content)) list = response.content;
        
        if (active) {
          onMappingsChange?.(list);
        }
      } catch {
        if (active) enqueueSnackbar('Unable to load mapped stores', { variant: 'error' });
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchInitial();
    return () => { active = false; };
  }, [agreementVersionId, storeMappings, onMappingsChange, enqueueSnackbar]);

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
    setUploadFeedback(null);
    try {
      const result = await parseStoreMappingsStateless(agreementVersionId, file);
      const successfullyMapped = result?.successfullyMapped || [];
      const skippedCount = result?.errors?.length ?? 0;

      setSkippedReport(skippedCount > 0 ? { skippedStores: result.errors, successfullyMapped } : null);
      
      const current = storeMappings || [];
      const newMappings = [...current];
      // Robust string coercion for deduplication
      const existingIds = new Set(newMappings.map(s => String(s.storeId)));
      
      let added = 0;
      let duplicates = 0;
      for (const m of successfullyMapped) {
        if (!existingIds.has(String(m.storeId))) {
          newMappings.push({ ...m, isCustom: false });
          existingIds.add(String(m.storeId));
          added++;
        } else {
          duplicates++;
        }
      }
      
      onMappingsChange?.(newMappings);
      setUploadFeedback({ added, duplicates, skippedCount });
    } catch (err) {
      const message = await extractApiErrorMessage(err, 'Store parse failed');
      enqueueSnackbar(message, { variant: 'error' });
    } finally {
      setUploading(false);
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

  const toggleSelectAll = (displayedStores) => {
    const displayedIds = displayedStores.map((s) => s.mappingId || s.id || s.storeId);
    const allSelected = displayedIds.every(id => selectedIds.has(id));
    
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (allSelected) {
        displayedIds.forEach(id => next.delete(id));
      } else {
        displayedIds.forEach(id => next.add(id));
      }
      return next;
    });
  };

  const handleDeleteSelected = () => {
    if (!selectedIds.size) return;
    setDeleting(true);
    setTimeout(() => {
      const current = storeMappings || [];
      const newMappings = current.filter(s => {
        const id = s.mappingId || s.id || s.storeId;
        return !selectedIds.has(id);
      });
      onMappingsChange?.(newMappings);
      setSelectedIds(new Set());
      setDeleting(false);
      enqueueSnackbar('Selected stores removed', { variant: 'success' });
    }, 100);
  };

  const handleAddCustomStore = (storeData) => {
    const current = storeMappings || [];
    if (current.some(s => String(s.storeId) === String(storeData.storeId))) {
      enqueueSnackbar('Store ID is already mapped', { variant: 'warning' });
      return;
    }
    const newMappings = [...current, { ...storeData, isCustom: true, id: `custom-${Date.now()}` }];
    onMappingsChange?.(newMappings);
    enqueueSnackbar('Custom store added to memory', { variant: 'success' });
    setIsModalOpen(false);
  };

  const currentStores = storeMappings || [];
  
  const filteredStores = currentStores.filter((s) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return s.storeId?.toLowerCase().includes(q) || s.name?.toLowerCase().includes(q) || s.storeName?.toLowerCase().includes(q);
  });
  
  const savedStores = filteredStores.filter(s => s.mappingId);
  const newStores = filteredStores.filter(s => !s.mappingId);

  const displayedSavedStores = savedStores.slice(savedPage * savedRowsPerPage, (savedPage + 1) * savedRowsPerPage);
  const displayedNewStores = newStores.slice(newPage * newRowsPerPage, (newPage + 1) * newRowsPerPage);

  const skippedStores = skippedReport?.skippedStores ?? [];

  return (
    <Box sx={{ mt: 2 }}>
      
      {/* Top Header Bar */}
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
        <Box sx={{ display: 'flex', gap: 1 }}>
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
          <Button
            variant="contained"
            size="small"
            onClick={() => setIsModalOpen(true)}
            disabled={!agreementVersionId}
            sx={{ borderRadius: 2, textTransform: 'none' }}
          >
            Add Custom Store
          </Button>
        </Box>
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

      {uploadFeedback && (
        <Alert severity="success" sx={{ mt: 2, mb: 2 }}>
          Successfully staged {uploadFeedback.added} new stores.
          {uploadFeedback.duplicates > 0 && ` ${uploadFeedback.duplicates} duplicates were ignored because they are already present.`}
        </Alert>
      )}

      {skippedStores.length > 0 && (
        <Alert 
          severity="warning" 
          onClose={() => setSkippedReport(null)}
          sx={{ mt: 2.5, borderRadius: 2, '& .MuiAlert-message': { width: '100%' } }}
        >
          <Typography variant="body2" fontWeight={600} color="warning.dark">
            Uploaded with warnings: {uploadFeedback?.added || 0} stores mapped successfully, {skippedStores.length} stores skipped.
          </Typography>
          <Box sx={{ mt: 1, maxHeight: 130, overflowY: 'auto', pr: 1 }}>
            <ul style={{ margin: 0, paddingLeft: 16, fontSize: '0.75rem', color: 'inherit' }}>
              {skippedStores.map((err) => (
                <li key={`${err.storeCode}-${err.message || err.reason}`} style={{ marginBottom: 4 }}>
                  <strong>{err.storeCode}</strong>: {err.message || err.reason}
                </li>
              ))}
            </ul>
          </Box>
        </Alert>
      )}

      {/* Main Data Table Area */}
      {Boolean(agreementVersionId) && (
        <Box sx={{ mt: 1 }}>
          {savedStores.length > 0 && (
            <StoreMappingTable
              title="Saved Stores (Active)"
              stores={displayedSavedStores}
              loading={loading}
              selectedIds={selectedIds}
              onToggle={toggleRow}
              onSelectAllToggle={() => toggleSelectAll(displayedSavedStores)}
              isAllSelected={displayedSavedStores.length > 0 && displayedSavedStores.every(s => selectedIds.has(s.mappingId || s.id || s.storeId))}
              onBulkDelete={handleDeleteSelected}
              deleting={deleting}
              selectable={true}
              page={savedPage}
              rowsPerPage={savedRowsPerPage}
              totalElements={savedStores.length}
              onPageChange={(e, newPage) => setSavedPage(newPage)}
              onRowsPerPageChange={(e) => {
                setSavedRowsPerPage(parseInt(e.target.value, 10));
                setSavedPage(0);
              }}
              search={search}
              onSearchChange={(val) => {
                setSearch(val);
                setSavedPage(0);
                setNewPage(0);
              }}
              maxHeight={400}
            />
          )}

          {newStores.length > 0 && (
            <StoreMappingTable
              title="Newly Added Stores (Draft)"
              stores={displayedNewStores}
              loading={loading}
              selectedIds={selectedIds}
              onToggle={toggleRow}
              onSelectAllToggle={() => toggleSelectAll(displayedNewStores)}
              isAllSelected={displayedNewStores.length > 0 && displayedNewStores.every(s => selectedIds.has(s.mappingId || s.id || s.storeId))}
              onBulkDelete={handleDeleteSelected}
              deleting={deleting}
              selectable={true}
              page={newPage}
              rowsPerPage={newRowsPerPage}
              totalElements={newStores.length}
              onPageChange={(e, newPage) => setNewPage(newPage)}
              onRowsPerPageChange={(e) => {
                setNewRowsPerPage(parseInt(e.target.value, 10));
                setNewPage(0);
              }}
              search={search}
              onSearchChange={(val) => {
                setSearch(val);
                setSavedPage(0);
                setNewPage(0);
              }}
              maxHeight={400}
            />
          )}
          
          {savedStores.length === 0 && newStores.length === 0 && search && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 3, textAlign: 'center' }}>
              No stores found matching your search.
            </Typography>
          )}
        </Box>
      )}

      <CustomStoreModal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleAddCustomStore}
      />
    </Box>
  );
}
