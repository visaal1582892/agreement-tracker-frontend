import axiosInstance from './axiosInstance';
import { ENDPOINTS } from '../config/endpoints';
import { downloadBlob, extractApiErrorMessage } from './commercialApi';

export { downloadBlob, extractApiErrorMessage };

export async function fetchStoreMappings(agreementVersionId, params) {
  const defaultParams = { page: 0, size: 500 };
  const useRawPage = !!params;
  const { data } = await axiosInstance.get(
    ENDPOINTS.STORE_MAPPINGS(agreementVersionId),
    { params: params || defaultParams }
  );
  return useRawPage ? data : (data.content || []);
}

export async function downloadStoreMappingTemplate(agreementVersionId) {
  const { data } = await axiosInstance.get(
    ENDPOINTS.STORE_MAPPING_TEMPLATE(agreementVersionId),
    { responseType: 'blob' },
  );
  return data;
}

export async function parseStoreMappingsStateless(agreementVersionId, file) {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await axiosInstance.post(
    ENDPOINTS.STORE_MAPPING_PARSE_STATELESS(agreementVersionId),
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
  return data;
}
