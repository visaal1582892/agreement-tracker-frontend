import {
  Box, Chip, CircularProgress, IconButton, Typography,
} from '@mui/material';
import { CheckCircle, ErrorOutlined, Refresh, Delete, OpenInNew } from '@mui/icons-material';
import { openDocumentPreview } from '../../api/uploadApi';
import { BRAND } from '../../config/theme';
import DocumentFileLink from './DocumentFileLink';

const STATUS_LABELS = {
  uploading: 'Uploading...',
  done: 'Done',
  error: 'Error',
};

export default function UploadRow({
  fileName,
  fileUrl = null,
  status = 'uploading',
  error = null,
  onRetry,
  onRemove,
  showRetry = true,
}) {
  const isUploading = status === 'uploading';
  const isDone = status === 'done';
  const isError = status === 'error';

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        border: `1px solid ${isError ? BRAND.red : BRAND.borderLight}`,
        borderRadius: '8px',
        px: 1.5,
        py: 1,
        bgcolor: BRAND.white,
      }}
    >
      {isUploading && <CircularProgress size={18} />}
      {isDone && <CheckCircle sx={{ fontSize: 20, color: BRAND.green }} />}
      {isError && <ErrorOutlined sx={{ fontSize: 20, color: BRAND.red }} />}

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <DocumentFileLink
          fileUrl={isDone ? fileUrl : null}
          fileName={fileName}
          variant="body2"
          noWrap
        />
        <Typography
          variant="caption"
          color={isError ? 'error' : 'text.secondary'}
          sx={{ display: 'block' }}
        >
          {isError ? error : STATUS_LABELS[status]}
        </Typography>
      </Box>

      {isError && showRetry && (
        <IconButton size="small" onClick={onRetry} aria-label="Retry upload">
          <Refresh fontSize="small" />
        </IconButton>
      )}

      {!isUploading && onRemove && (
        <IconButton size="small" color="error" onClick={onRemove} aria-label="Remove file">
          <Delete fontSize="small" />
        </IconButton>
      )}

      {isDone && fileUrl && (
        <IconButton
          size="small"
          onClick={() => openDocumentPreview(fileUrl)}
          aria-label={`Open ${fileName} in new tab`}
        >
          <OpenInNew fontSize="small" />
        </IconButton>
      )}

      {isDone && (
        <Chip label="Uploaded" size="small" color="success" variant="outlined" />
      )}
    </Box>
  );
}
