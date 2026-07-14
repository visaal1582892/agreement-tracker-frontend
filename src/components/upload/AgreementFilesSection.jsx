import { useCallback, useRef, useState } from 'react';
import {
  Alert, Box, Button, FormControl, MenuItem, Select, Typography, alpha,
} from '@mui/material';
import { UploadFile } from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import { BRAND } from '../../config/theme';
import WizardFieldAnchor from '../wizard/WizardFieldAnchor';
import UploadRow from './UploadRow';
import {
  isRejectedDocFile,
  mapUploadError,
  uploadAssetFiles,
  uploadFilesSequentially,
} from '../../api/uploadApi';

function createPendingDocument(file, documentType) {
  return {
    id: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
    file,
    fileName: file.name,
    originalFilename: file.name,
    documentType,
    uploadStatus: 'uploading',
    uploadError: null,
    fileUrl: null,
    thumbnailUrl: null,
  };
}

function applyUploadResult(document, result) {
  if (result.error) {
    return {
      ...document,
      uploadStatus: 'error',
      uploadError: result.error,
      fileUrl: null,
      thumbnailUrl: null,
    };
  }
  return {
    ...document,
    uploadStatus: 'done',
    uploadError: null,
    fileUrl: result.url,
    thumbnailUrl: result.thumbnailUrl,
    fileName: result.originalFilename || document.fileName,
    originalFilename: result.originalFilename || document.fileName,
    file: null,
  };
}

export default function AgreementFilesSection({
  documents = [],
  onDocumentsChange,
  documentTypes = ['AGREEMENT', 'SUPPORTING_DOC', 'EMAIL', 'OTHER'],
  defaultDocumentType = 'SUPPORTING_DOC',
  fieldError = null,
  onClearFieldError,
  anchorField = 'documents',
  description = 'Upload contract and supporting files. At least one document is required.',
}) {
  const { enqueueSnackbar } = useSnackbar();
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);
  const documentsRef = useRef(documents);

  documentsRef.current = documents;

  const setDocuments = useCallback((updater) => {
    const current = documentsRef.current;
    const next = typeof updater === 'function' ? updater(current) : updater;
    documentsRef.current = next;
    onDocumentsChange?.(next);
  }, [onDocumentsChange]);

  const uploadPendingDocuments = useCallback(async (pendingDocs) => {
    const files = pendingDocs.map((doc) => doc.file).filter(Boolean);
    if (!files.length) return;

    setDocuments((current) => current.map((doc) => (
      pendingDocs.some((pending) => pending.id === doc.id)
        ? { ...doc, uploadStatus: 'uploading', uploadError: null }
        : doc
    )));

    await uploadFilesSequentially(files, {
      onFileComplete: (fileIndex, file, result) => {
        const pendingDoc = pendingDocs[fileIndex];
        setDocuments((current) => current.map((doc) => (
          doc.id === pendingDoc.id
            ? applyUploadResult({ ...doc, file }, result)
            : doc
        )));
      },
    });
  }, [setDocuments]);

  const handleRejectedDoc = useCallback((fileName) => {
    enqueueSnackbar(
      `${fileName}: Word documents are not supported. Please convert to PDF before uploading.`,
      { variant: 'warning' },
    );
  }, [enqueueSnackbar]);

  const queueFiles = useCallback(async (fileList) => {
    const incoming = Array.from(fileList || []).filter(Boolean);
    if (!incoming.length) return;

    const accepted = [];
    incoming.forEach((file) => {
      if (isRejectedDocFile(file)) {
        handleRejectedDoc(file.name);
        return;
      }
      accepted.push(createPendingDocument(file, defaultDocumentType));
    });

    if (!accepted.length) return;

    onClearFieldError?.();
    setDocuments((current) => [...current, ...accepted]);
    await uploadPendingDocuments(accepted);
  }, [
    defaultDocumentType,
    handleRejectedDoc,
    onClearFieldError,
    setDocuments,
    uploadPendingDocuments,
  ]);

  const retryDocument = useCallback(async (docId) => {
    const target = documentsRef.current.find((doc) => doc.id === docId);
    if (!target?.file) {
      enqueueSnackbar('Original file is no longer available. Please re-select the file.', { variant: 'warning' });
      return;
    }

    setDocuments((current) => current.map((doc) => (
      doc.id === docId
        ? { ...doc, uploadStatus: 'uploading', uploadError: null }
        : doc
    )));

    try {
      const response = await uploadAssetFiles([target.file]);
      const result = {
        url: response.urls?.[0] ?? null,
        thumbnailUrl: response.thumbnailUrls?.[0] ?? null,
        originalFilename: response.originalFilenames?.[0] ?? target.fileName,
        error: response.errors?.[0] ?? null,
      };
      setDocuments((current) => current.map((doc) => (
        doc.id === docId ? applyUploadResult({ ...doc, file: target.file }, result) : doc
      )));
    } catch (error) {
      setDocuments((current) => current.map((doc) => (
        doc.id === docId
          ? {
            ...doc,
            uploadStatus: 'error',
            uploadError: mapUploadError(error),
          }
          : doc
      )));
    }
  }, [enqueueSnackbar, setDocuments]);

  const removeDocument = useCallback((docId) => {
    setDocuments((current) => current.filter((doc) => doc.id !== docId));
  }, [setDocuments]);

  const changeDocumentType = useCallback((docId, documentType) => {
    setDocuments((current) => current.map((doc) => (
      doc.id === docId ? { ...doc, documentType } : doc
    )));
  }, [setDocuments]);

  return (
    <WizardFieldAnchor field={anchorField} error={fieldError}>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        {description}
      </Typography>

      <Box
        onDragOver={(event) => {
          event.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragOver(false);
          queueFiles(event.dataTransfer.files);
        }}
        onClick={() => fileInputRef.current?.click()}
        sx={{
          border: `2px dashed ${fieldError ? BRAND.red : BRAND.borderLight}`,
          borderRadius: '10px',
          bgcolor: dragOver ? alpha(BRAND.red, 0.04) : BRAND.bgGray,
          p: 2.5,
          textAlign: 'center',
          mb: 1.5,
          cursor: 'pointer',
          transition: 'background-color 0.15s ease, border-color 0.15s ease',
          '&:hover': { bgcolor: alpha(BRAND.red, 0.03), borderColor: '#94A3B8' },
        }}
      >
        <UploadFile sx={{ fontSize: 36, color: BRAND.textSecondary, mb: 0.5 }} />
        <Typography variant="body2" color="text.secondary" mb={1}>
          Drag & drop or click to upload
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block" mb={1}>
          Any file type. Word files (.doc/.docx) must be converted to PDF.
        </Typography>
        <Button
          variant="outlined"
          size="small"
          onClick={(event) => {
            event.stopPropagation();
            fileInputRef.current?.click();
          }}
        >
          Browse Files
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          hidden
          multiple
          onChange={(event) => {
            queueFiles(event.target.files);
            event.target.value = '';
          }}
        />
      </Box>

      {fieldError && (
        <Alert severity="error" sx={{ mb: 1.5 }}>
          {fieldError}
        </Alert>
      )}

      {documents.length > 0 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {documents.map((doc) => (
            <Box key={doc.id} sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <UploadRow
                fileName={doc.fileName}
                fileUrl={doc.fileUrl}
                status={doc.uploadStatus || (doc.fileUrl ? 'done' : 'uploading')}
                error={doc.uploadError}
                onRetry={() => retryDocument(doc.id)}
                onRemove={() => removeDocument(doc.id)}
                showRetry={Boolean(doc.file)}
              />
              {doc.uploadStatus === 'done' && (
                <FormControl size="small" sx={{ minWidth: 180, alignSelf: 'flex-start', ml: 4.5 }}>
                  <Select
                    value={doc.documentType || defaultDocumentType}
                    onChange={(event) => changeDocumentType(doc.id, event.target.value)}
                  >
                    {documentTypes.map((type) => (
                      <MenuItem key={type} value={type}>{type.replace('_', ' ')}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
            </Box>
          ))}
        </Box>
      )}
    </WizardFieldAnchor>
  );
}
