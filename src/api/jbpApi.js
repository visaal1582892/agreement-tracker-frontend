import axiosInstance from './axiosInstance';
import { ENDPOINTS } from '../config/endpoints';

export function downloadBlob(blob, filename) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export async function extractApiErrorMessage(error, fallback = 'Request failed') {
  const data = error?.response?.data;
  if (typeof data === 'string') return data;
  if (data?.message) return data.message;
  return fallback;
}

export async function fetchJbpTimePeriods(agreementVersionId, frequency, financialYearStartMonth) {
  const params = { frequency };
  if (financialYearStartMonth != null) {
    params.financialYearStartMonth = financialYearStartMonth;
  }
  const { data } = await axiosInstance.get(ENDPOINTS.JBP_TIME_PERIODS(agreementVersionId), {
    params,
  });
  return data;
}

export async function fetchJbpStructure(agreementVersionId) {
  const { data } = await axiosInstance.get(ENDPOINTS.JBP_STRUCTURE(agreementVersionId));
  return data;
}

export async function downloadJbpTemplate(agreementVersionId, payload, startMonth) {
  const params = {};
  if (startMonth != null) {
    params.startMonth = startMonth;
  }
  const { data } = await axiosInstance.post(ENDPOINTS.JBP_TEMPLATE(agreementVersionId), payload, {
    params,
    responseType: 'blob',
  });
  return data;
}

export function isJbpValidationErrorBlob(error) {
  const blob = error?.response?.data;
  if (!(blob instanceof Blob)) {
    return false;
  }
  const type = blob.type || '';
  return type.includes('spreadsheetml')
    || type.includes('octet-stream')
    || error?.response?.status === 422;
}

export async function parseBlobJson(blob) {
  const text = await blob.text();
  return JSON.parse(text);
}

export async function uploadJbpWorkbook(agreementVersionId, file) {
  const formData = new FormData();
  formData.append('file', file);
  try {
    const { data, headers } = await axiosInstance.post(ENDPOINTS.JBP_UPLOAD(agreementVersionId), formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      responseType: 'blob',
    });
    const contentType = headers?.['content-type'] || data?.type || '';
    if (contentType.includes('spreadsheetml')) {
      downloadBlob(data, 'JBP_Upload_Errors.xlsx');
      const validationError = new Error('JBP workbook validation failed');
      validationError.isJbpValidationError = true;
      throw validationError;
    }
    return parseBlobJson(data);
  } catch (error) {
    if (isJbpValidationErrorBlob(error)) {
      downloadBlob(error.response.data, 'JBP_Upload_Errors.xlsx');
      const validationError = new Error('JBP workbook validation failed');
      validationError.isJbpValidationError = true;
      throw validationError;
    }
    throw error;
  }
}

export async function commitJbpStructure(agreementVersionId, stagedWorkbook) {
  await axiosInstance.put(ENDPOINTS.JBP_COMMIT(agreementVersionId), { stagedWorkbook });
}
