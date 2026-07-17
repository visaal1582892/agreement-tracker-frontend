import axiosInstance from './axiosInstance';
import { ENDPOINTS } from '../config/endpoints';
import { downloadBlob, extractApiErrorMessage } from './commercialApi';
import { isJbpValidationErrorBlob, parseBlobJson } from './jbpApi';

export { downloadBlob, extractApiErrorMessage };

/** Read-only JBP template from source version (Edit/Renew). */
export async function exportJbpTemplateFromSource(sourceVersionId) {
  const { data } = await axiosInstance.get(ENDPOINTS.AGREEMENT_JBP_TEMPLATE_EXPORT, {
    params: { sourceVersionId },
    responseType: 'blob',
  });
  return data;
}

/** Edit/Renew: periods for proposed contract dates (no DRAFT). */
export async function fetchJbpPreviewTimePeriods(
  sourceVersionId,
  frequency,
  { startDate, expiryDate, financialYearStartMonth } = {},
) {
  const params = { sourceVersionId, frequency };
  if (financialYearStartMonth != null) {
    params.financialYearStartMonth = financialYearStartMonth;
  }
  const { data } = await axiosInstance.post(
    ENDPOINTS.AGREEMENT_JBP_PREVIEW_PERIODS,
    { startDate, expiryDate },
    { params },
  );
  return data;
}

/** Edit/Renew: generate template from slots/config blueprint + proposed dates. */
export async function generateJbpPreviewTemplate(sourceVersionId, previewRequest) {
  const { data } = await axiosInstance.post(
    ENDPOINTS.AGREEMENT_JBP_PREVIEW_TEMPLATE,
    previewRequest,
    {
      params: { sourceVersionId },
      responseType: 'blob',
    },
  );
  return data;
}

/**
 * Stateless JBP parse — returns staged workbook JSON.
 * On row validation failure, downloads annotated `JBP_Upload_Errors.xlsx` (same as create upload).
 */
export async function parseJbpWorkbook(sourceVersionId, file, blueprint = null) {
  const formData = new FormData();
  formData.append('file', file);
  if (blueprint) {
    formData.append(
      'blueprint',
      new Blob([JSON.stringify(blueprint)], { type: 'application/json' }),
    );
  }
  try {
    const { data, headers } = await axiosInstance.post(ENDPOINTS.AGREEMENT_PARSE_JBP, formData, {
      params: { sourceVersionId },
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
    if (error?.isJbpValidationError) {
      throw error;
    }
    if (isJbpValidationErrorBlob(error)) {
      downloadBlob(error.response.data, 'JBP_Upload_Errors.xlsx');
      const validationError = new Error('JBP workbook validation failed');
      validationError.isJbpValidationError = true;
      throw validationError;
    }
    throw error;
  }
}

export async function downloadStatelessStoreTemplate() {
  const { data } = await axiosInstance.get(ENDPOINTS.AGREEMENT_PARSE_STORES_TEMPLATE, {
    responseType: 'blob',
  });
  return data;
}

/** Stateless store parse — returns mapped stores JSON (no DB write). */
export async function parseStoreMappings(sourceVersionId, file) {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await axiosInstance.post(ENDPOINTS.AGREEMENT_PARSE_STORES, formData, {
    params: { sourceVersionId },
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export function extractParseRowErrors(error) {
  const fieldErrors = error?.response?.data?.fieldErrors;
  if (!fieldErrors || typeof fieldErrors !== 'object') {
    return [];
  }
  return Object.values(fieldErrors);
}
