import axiosInstance from './axiosInstance';
import { ENDPOINTS } from '../config/endpoints';
import { downloadBlob } from './commercialApi';

export async function downloadPriceOffTemplate() {
  const response = await axiosInstance.get(ENDPOINTS.PRICE_OFFS_TEMPLATE, {
    responseType: 'blob',
  });
  return response.data;
}

export async function uploadPriceOffCampaigns(file) {
  const formData = new FormData();
  formData.append('file', file);
  const response = await axiosInstance.post(ENDPOINTS.PRICE_OFFS_UPLOAD, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
}

export async function fetchPriceOffFilterOptions() {
  const response = await axiosInstance.get(ENDPOINTS.PRICE_OFFS_FILTER_OPTIONS);
  return response.data;
}

export async function fetchPriceOffCampaigns({
  product,
  campaignId,
  location,
  channel,
  discountType,
  status,
  page = 0,
  size = 25,
  sortBy = 'updatedAt',
  sortDirection = 'DESC',
} = {}) {
  const response = await axiosInstance.get(ENDPOINTS.PRICE_OFFS, {
    params: {
      product: product || undefined,
      campaignId: campaignId || undefined,
      location: location || undefined,
      channel: channel || undefined,
      discountType: discountType || undefined,
      status: status || undefined,
      page,
      size,
      sortBy,
      sortDirection,
    },
  });
  return response.data;
}

export async function fetchPriceOffCampaign(id) {
  const response = await axiosInstance.get(ENDPOINTS.PRICE_OFF_BY_ID(id));
  return response.data;
}

export async function updatePriceOffCampaignId(id, campaignId) {
  const response = await axiosInstance.put(ENDPOINTS.PRICE_OFF_CAMPAIGN_ID(id), { campaignId });
  return response.data;
}

export async function bulkUpdatePriceOffCampaignId(ids, campaignId) {
  const response = await axiosInstance.put(ENDPOINTS.PRICE_OFFS_BULK_CAMPAIGN_ID, { ids, campaignId });
  return response.data;
}

export async function bulkSubmitPriceOffs(ids) {
  const response = await axiosInstance.put(ENDPOINTS.PRICE_OFFS_BULK_SUBMIT, { ids });
  return response.data;
}

export async function bulkDeletePriceOffs(ids) {
  await axiosInstance.delete(ENDPOINTS.PRICE_OFFS_BULK_DELETE, { data: { ids } });
}

export async function bulkApprovePriceOffs(ids) {
  const response = await axiosInstance.put(ENDPOINTS.PRICE_OFFS_BULK_APPROVE, { ids });
  return response.data;
}

export async function bulkRejectPriceOffs(ids, remarks) {
  const response = await axiosInstance.put(ENDPOINTS.PRICE_OFFS_BULK_REJECT, { ids, remarks });
  return response.data;
}

export async function approvePriceOff(id) {
  const response = await axiosInstance.put(ENDPOINTS.PRICE_OFF_APPROVE(id));
  return response.data;
}

export async function rejectPriceOff(id, remarks) {
  const response = await axiosInstance.put(ENDPOINTS.PRICE_OFF_REJECT(id), { remarks });
  return response.data;
}

export { downloadBlob };

export function formatPercent(value) {
  if (value == null || value === '') return '—';
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return '—';
  return `${(numeric * 100).toFixed(2)}%`;
}

export function formatMoney(value) {
  if (value == null || value === '') return '—';
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return '—';
  return numeric.toFixed(2);
}

export function formatRupee(value) {
  if (value == null || value === '') return '—';
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return '—';
  return `₹${numeric.toFixed(2)}`;
}

export function formatOfferValue(value, discountType) {
  if (value == null || value === '') return '—';
  return discountType === 'DISC_PERCENT' ? formatPercent(value) : formatRupee(value);
}

export function formatFinalOffer(value, discountType) {
  if (value == null || value === '') return '—';
  return discountType === 'DISC_PERCENT' ? formatPercent(value) : formatRupee(value);
}

export async function extractPriceOffError(err, fallback = 'Request failed') {
  const message = err?.response?.data?.message;
  if (message) return message;
  if (err?.response?.data instanceof Blob) {
    try {
      const text = await err.response.data.text();
      const parsed = JSON.parse(text);
      return parsed.message || fallback;
    } catch {
      return fallback;
    }
  }
  return fallback;
}
