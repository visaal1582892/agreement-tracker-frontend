import axiosInstance from './axiosInstance';
import { ENDPOINTS } from '../config/endpoints';

const UPLOAD_BATCH_SIZE = 2;

export const REJECTED_DOC_EXTENSIONS = ['.doc', '.docx'];

const SAFE_UPLOAD_FALLBACK = 'Upload failed. Please try again or use a different file.';
const UPLOAD_UNAVAILABLE = 'Upload service is temporarily unavailable. Please try again later.';

const INTERNAL_MESSAGE_PATTERN = /oauth|bearer|token|transit|ssl|certificate|parse|exception|stacktrace|jdbc|sql|nullpointer|classnotfound|marigold\.medplus|image server|internal server/i;

export function sanitizeUploadError(message) {
  if (!message || typeof message !== 'string') {
    return SAFE_UPLOAD_FALLBACK;
  }
  const trimmed = message.trim();
  if (!trimmed || trimmed.length > 200 || trimmed.includes('\n') || trimmed.includes('\r')) {
    return SAFE_UPLOAD_FALLBACK;
  }
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return SAFE_UPLOAD_FALLBACK;
  }
  if (INTERNAL_MESSAGE_PATTERN.test(trimmed)) {
    return SAFE_UPLOAD_FALLBACK;
  }
  if (trimmed.toLowerCase().includes('format') || trimmed === 'Format not supported') {
    return 'Format not supported';
  }
  return trimmed;
}

export function isRejectedDocFile(file) {
  if (!file?.name) return false;
  const lower = file.name.toLowerCase();
  return REJECTED_DOC_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export function mapUploadError(error, fallback = SAFE_UPLOAD_FALLBACK) {
  const status = error?.response?.status;
  const rawMessage = error?.response?.data?.message || error?.response?.data?.errors?.find(Boolean);

  if (error?.code === 'ECONNABORTED') {
    return 'Upload timed out — file may not be supported';
  }
  if (rawMessage) {
    return sanitizeUploadError(rawMessage);
  }
  if (status === 400 || status === 415) {
    return 'Format not supported';
  }
  if (status === 502 || status === 503 || status === 504) {
    return UPLOAD_UNAVAILABLE;
  }
  return fallback;
}

export async function uploadAssetFiles(files) {
  const formData = new FormData();
  files.forEach((file) => formData.append('files', file));

  const { data } = await axiosInstance.post(ENDPOINTS.UPLOAD_ASSET, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120_000,
  });

  return data;
}

export async function uploadFilesSequentially(files, { onFileStart, onFileComplete } = {}) {
  const results = [];

  for (let index = 0; index < files.length; index += UPLOAD_BATCH_SIZE) {
    const batch = files.slice(index, index + UPLOAD_BATCH_SIZE);
    batch.forEach((file, batchIndex) => onFileStart?.(index + batchIndex, file));

    try {
      const response = await uploadAssetFiles(batch);
      batch.forEach((file, batchIndex) => {
        const absoluteIndex = index + batchIndex;
        const result = {
          url: response.urls?.[batchIndex] ?? null,
          thumbnailUrl: response.thumbnailUrls?.[batchIndex] ?? null,
          originalFilename: response.originalFilenames?.[batchIndex] ?? file.name,
          error: response.errors?.[batchIndex]
            ? sanitizeUploadError(response.errors[batchIndex])
            : null,
        };
        results[absoluteIndex] = result;
        onFileComplete?.(absoluteIndex, file, result);
      });
    } catch (error) {
      batch.forEach((file, batchIndex) => {
        const absoluteIndex = index + batchIndex;
        const result = {
          url: null,
          thumbnailUrl: null,
          originalFilename: file.name,
          error: mapUploadError(error),
        };
        results[absoluteIndex] = result;
        onFileComplete?.(absoluteIndex, file, result);
      });
    }
  }

  return results;
}

export async function proxyDownloadAsset(url, filename) {
  const { data } = await axiosInstance.get(ENDPOINTS.UPLOAD_PROXY_DOWNLOAD, {
    params: { url, filename },
    responseType: 'blob',
    timeout: 120_000,
  });
  return data;
}

export function openDocumentPreview(fileUrl) {
  if (!fileUrl || typeof fileUrl !== 'string') {
    return;
  }
  const trimmedUrl = fileUrl.trim();
  if (!trimmedUrl) {
    return;
  }
  window.open(trimmedUrl, '_blank', 'noopener,noreferrer');
}

export function getUploadedDocuments(documents = []) {
  return documents.filter((doc) => doc.fileUrl && doc.uploadStatus !== 'error');
}

export function hasUploadsInProgress(documents = []) {
  return documents.some((doc) => doc.uploadStatus === 'uploading');
}

export function mapDocumentsToApiPayload(documents = []) {
  return documents
    .filter((doc) => doc.uploadStatus === 'done' && doc.fileUrl)
    .map((doc) => ({
      fileUrl: doc.fileUrl,
      originalFileName: doc.originalFilename || doc.fileName,
      thumbnailUrl: doc.thumbnailUrl || null,
      documentType: doc.documentType || 'SUPPORTING_DOC',
    }));
}

export function mapDocumentsFromApi(documents = []) {
  return documents.map((doc) => ({
    id: `persisted-${doc.id}`,
    fileName: doc.originalFileName,
    originalFilename: doc.originalFileName,
    fileUrl: doc.fileUrl,
    thumbnailUrl: doc.thumbnailUrl,
    documentType: doc.documentType || 'SUPPORTING_DOC',
    uploadStatus: 'done',
    uploadError: null,
  }));
}
