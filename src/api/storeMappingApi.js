import axiosInstance from './axiosInstance';
import { ENDPOINTS } from '../config/endpoints';
import { downloadBlob, extractApiErrorMessage } from './commercialApi';

export { downloadBlob, extractApiErrorMessage };

export async function fetchStoreMappings(agreementVersionId) {
  const { data } = await axiosInstance.get(ENDPOINTS.STORE_MAPPINGS(agreementVersionId));
  return data;
}

export async function downloadStoreMappingTemplate(agreementVersionId) {
  const { data } = await axiosInstance.get(
    ENDPOINTS.STORE_MAPPING_TEMPLATE(agreementVersionId),
    { responseType: 'blob' },
  );
  return data;
}

export async function uploadStoreMappings(agreementVersionId, file) {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await axiosInstance.post(
    ENDPOINTS.STORE_MAPPING_UPLOAD(agreementVersionId),
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
  return data;
}

export async function deleteStoreMappings(agreementVersionId, mappingIds) {
  await axiosInstance.delete(ENDPOINTS.STORE_MAPPINGS(agreementVersionId), {
    data: { mappingIds },
  });
}
