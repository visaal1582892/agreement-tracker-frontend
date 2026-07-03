import axiosInstance from './axiosInstance';
import { ENDPOINTS } from '../config/endpoints';

export async function fetchSlabs(agreementVersionId, slabType) {
  const params = slabType ? { slabType } : {};
  const { data } = await axiosInstance.get(ENDPOINTS.AGREEMENT_VERSION_SLABS(agreementVersionId), { params });
  return data;
}

export async function createSlab(agreementVersionId, payload) {
  const { data } = await axiosInstance.post(ENDPOINTS.AGREEMENT_VERSION_SLABS(agreementVersionId), payload);
  return data;
}

export async function updateSlab(agreementVersionId, slabId, payload) {
  const { data } = await axiosInstance.put(
    ENDPOINTS.AGREEMENT_VERSION_SLAB(agreementVersionId, slabId),
    payload,
  );
  return data;
}

export async function deleteSlab(agreementVersionId, slabId) {
  await axiosInstance.delete(ENDPOINTS.AGREEMENT_VERSION_SLAB(agreementVersionId, slabId));
}

export async function deleteAllSlabs(agreementVersionId, slabs = []) {
  await Promise.all((slabs ?? []).map((slab) => deleteSlab(agreementVersionId, slab.id)));
}

export async function purgeAllCommercialStructureData(agreementVersionId) {
  await axiosInstance.delete(ENDPOINTS.COMMERCIAL_STRUCTURE_PURGE(agreementVersionId));
}

export async function downloadContactsCutoffTemplate(agreementVersionId) {
  const { data } = await axiosInstance.get(ENDPOINTS.CONTACTS_CUTOFF_TEMPLATE(agreementVersionId), {
    responseType: 'blob',
  });
  return data;
}

export async function uploadContactsCutoffs(agreementVersionId, file) {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await axiosInstance.post(ENDPOINTS.CONTACTS_CUTOFF_UPLOAD(agreementVersionId), formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function commitContactsCutoffs(agreementVersionId, payload) {
  await axiosInstance.put(ENDPOINTS.CONTACTS_CUTOFF_COMMIT(agreementVersionId), payload);
}

export async function fetchContactsCutoffs(agreementVersionId) {
  const { data } = await axiosInstance.get(ENDPOINTS.CONTACTS_CUTOFFS(agreementVersionId));
  return data;
}

export async function generateCommercialTemplate(agreementVersionId, payload) {
  const { data } = await axiosInstance.post(
    ENDPOINTS.COMMERCIAL_TEMPLATE(agreementVersionId),
    payload,
    { responseType: 'blob' },
  );
  return data;
}

export async function uploadCommercialTargets(agreementVersionId, file, slabType) {
  const formData = new FormData();
  formData.append('file', file);
  const params = slabType ? { slabType } : {};
  const { data } = await axiosInstance.post(
    ENDPOINTS.COMMERCIAL_UPLOAD(agreementVersionId),
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' }, params },
  );
  return data;
}

export async function fetchCommercialTargetsPreview(agreementVersionId) {
  const { data } = await axiosInstance.get(ENDPOINTS.COMMERCIAL_TARGETS_PREVIEW(agreementVersionId));
  return data;
}

export async function upsertTarget(agreementVersionId, payload) {
  await axiosInstance.put(ENDPOINTS.COMMERCIAL_TARGETS(agreementVersionId), payload);
}

export async function switchCommercialType(agreementVersionId, payload) {
  await axiosInstance.put(ENDPOINTS.COMMERCIAL_TYPE_SWITCH(agreementVersionId), payload);
}

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

export async function extractApiErrorMessage(err, fallback) {
  const data = err.response?.data;
  if (data instanceof Blob) {
    try {
      const json = JSON.parse(await data.text());
      return json.message || fallback;
    } catch {
      return fallback;
    }
  }
  return data?.message || fallback;
}

export function toSlabPayload(slab, capUnit, slabType) {
  return {
    minCap: Number(slab.minCap),
    maxCap: Number(slab.maxCap),
    capUnit: capUnit || slab.capUnit || 'RUPEES',
    valueType: slab.valueType,
    commercialValue: Number(slab.commercialValue),
    payoutFrequency: slab.payoutFrequency || null,
    slabType: slabType || slab.slabType || 'PURCHASE',
  };
}

export function formatSlabLabel(slab) {
  const unit = slab.capUnit === 'QUANTITY' ? 'Qty' : '₹';
  const range = `${slab.minCap} - ${slab.maxCap} ${unit}`;
  if (slab.valueType === 'PERCENTAGE') {
    return `${range} (${slab.commercialValue}%)`;
  }
  return `${range} (Fixed: ${slab.commercialValue})`;
}

function slabRangesOverlap(minA, maxA, minB, maxB) {
  return minA < maxB && minB < maxA;
}

function isExactSlabMatch(a, b) {
  return Number(a.minCap) === Number(b.minCap)
    && Number(a.maxCap) === Number(b.maxCap)
    && a.capUnit === b.capUnit
    && a.valueType === b.valueType
    && Number(a.commercialValue) === Number(b.commercialValue);
}

export function validateSlabCapRange(minCap, maxCap) {
  const min = Number(minCap);
  const max = Number(maxCap);
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return 'Min Cap and Max Cap are required';
  }
  if (max <= min) {
    return 'Max Cap must be strictly greater than Min Cap';
  }
  return null;
}

export function detectSlabTierGaps(slabs = []) {
  const sorted = [...slabs].sort((a, b) => Number(a.minCap) - Number(b.minCap));
  const warnings = [];
  for (let index = 1; index < sorted.length; index += 1) {
    const previousMax = Number(sorted[index - 1].maxCap);
    const currentMin = Number(sorted[index].minCap);
    if (currentMin > previousMax) {
      warnings.push(
        `Gap between tier ${index} max (${previousMax}) and tier ${index + 1} min (${currentMin})`,
      );
    }
  }
  return warnings;
}

/** CC single-target tier conflict check (no max-cap range). */
export function validateCcTierAgainstExisting(slabs, payload, excludeSlabId = null) {
  const peers = (slabs ?? []).filter((slab) => slab.id !== excludeSlabId);
  const duplicate = peers.find((slab) => Number(slab.minCap) === Number(payload.minCap)
    && slab.payoutFrequency === payload.payoutFrequency
    && slab.capUnit === payload.capUnit
    && slab.valueType === payload.valueType
    && Number(slab.commercialValue) === Number(payload.commercialValue));
  if (duplicate) {
    return `This tier already exists: ${formatSlabLabel({ ...duplicate, maxCap: duplicate.minCap })}`;
  }
  return null;
}

export function toCcSlabPayload(tier, capUnit) {
  const targetValue = Number(tier.targetValue ?? tier.minCap);
  return {
    minCap: targetValue,
    maxCap: targetValue + 1,
    capUnit: capUnit || tier.payoutUnit || 'RUPEES',
    valueType: tier.valueType || 'PERCENTAGE',
    commercialValue: Number(tier.payoutValue ?? tier.commercialValue),
    payoutFrequency: tier.frequency ?? tier.payoutFrequency,
    slabType: 'PURCHASE',
  };
}

/** Returns error message if payload conflicts with existing slabs, else null. */
export function validateSlabAgainstExisting(slabs, payload, excludeSlabId = null) {
  const peers = (slabs ?? []).filter((s) => s.id !== excludeSlabId);
  const capError = validateSlabCapRange(payload.minCap, payload.maxCap);
  if (capError) return capError;

  const duplicate = peers.find((s) => isExactSlabMatch(s, payload));
  if (duplicate) {
    return `This slab rule already exists: ${formatSlabLabel(duplicate)}`;
  }

  const overlap = peers.find((s) => slabRangesOverlap(
    Number(payload.minCap),
    Number(payload.maxCap),
    Number(s.minCap),
    Number(s.maxCap),
  ));
  if (overlap) {
    return `Slab range overlaps with existing rule: ${formatSlabLabel(overlap)}`;
  }

  return null;
}
