import axiosInstance from '../api/axiosInstance';
import { ENDPOINTS } from '../config/endpoints';
import { fetchSlabs } from '../api/commercialApi';
import { INCOME_TYPE_NAMES } from '../constants/incomeTypeNames';
import { resolveStructureType } from '../constants/commercialStructure';
import { evaluateAssetPayoutDuration } from './assetPayoutDurationUtils';

function getAssetRentalPayoutGaps(asset, assetPayoutPeriods = [], version = null) {
  const gaps = [];
  if (!asset?.assetCategory) gaps.push('Asset Category');
  if (asset?.assetCategory !== 'ACTIVITY' && !asset?.assetType) gaps.push('Asset Type');
  const hasFlatPayout = asset?.flatPayout != null && Number(asset.flatPayout) > 0;
  const hasSchedule = (assetPayoutPeriods ?? []).length > 0;
  if (!hasFlatPayout && !hasSchedule) {
    gaps.push('Asset Payout');
  }
  if (hasSchedule && !hasFlatPayout) {
    const durationEval = evaluateAssetPayoutDuration({
      payoutMode: 'PER_STORE',
      periods: assetPayoutPeriods,
      startDate: version?.startDate,
      expiryDate: version?.expiryDate,
    });
    if (durationEval.status === 'error') {
      gaps.push('Asset Payout Schedule Duration');
    }
  }
  return gaps;
}

function resolveStoreMappingCount(version, storeMappingCount) {
  if (Number.isFinite(storeMappingCount) && storeMappingCount > 0) {
    return storeMappingCount;
  }
  if (Array.isArray(version?.storeMappings)) {
    return version.storeMappings.length;
  }
  return Number.isFinite(storeMappingCount) ? storeMappingCount : 0;
}

export function getDraftDetailsGaps(version, { slabCount = 0, storeMappingCount = 0 } = {}) {
  const gaps = [];
  if (!version?.incomeTypeId) gaps.push('Income Type');
  if (!version?.agreementTypeId) gaps.push('Agreement Type');
  if (!version?.startDate) gaps.push('Start Date');
  if (!version?.expiryDate) gaps.push('Expiry Date');

  if (version?.incomeTypeName === INCOME_TYPE_NAMES.ASSET_RENTALS) {
    gaps.push(...getAssetRentalPayoutGaps(version.asset, version.assetPayoutPeriods, version));
    // Invoice Vendor UI is currently hidden — do not block completeness on it.
    if (resolveStoreMappingCount(version, storeMappingCount) <= 0) {
      gaps.push('Participating Stores');
    }
    return gaps;
  }

  if (version?.incomeTypeName === INCOME_TYPE_NAMES.COMMERCIAL_CONTRACTS) {
    const structureType = resolveStructureType(version.commercialStructure);
    if (structureType === 'FLAT') {
      if (version.commercialValue == null) gaps.push('Flat Baseline Value');
      if (!version.flatBaselineFrequency) gaps.push('Flat Baseline Frequency');
    } else if (!version?.jbpCommitted) {
      gaps.push('JBP Structure');
    }
    if (!version?.paymentRealizationType) gaps.push('Payment Realization Type');
    return gaps;
  }

  const structure = version?.commercialStructure;
  const structureType = resolveStructureType(structure);
  if (!structure) gaps.push('Commercial Structure');
  if (structureType === 'LEGACY_HYBRID') gaps.push('Commercial Structure Selection');
  if (structureType === 'FLAT' && version.commercialValue == null) gaps.push('Flat Baseline Value');
  if (structureType === 'FLAT' && !version.flatBaselineFrequency) gaps.push('Flat Baseline Frequency');
  if (structureType === 'SLABS' && slabCount === 0) gaps.push('Slabs');
  if (!version?.paymentRealizationType) gaps.push('Payment Realization Type');
  return gaps;
}

export async function loadGroupDraftReviewData(drafts) {
  return Promise.all((drafts ?? []).map(async (row) => {
    const { data: version } = await axiosInstance.get(
      ENDPOINTS.AGREEMENT_VERSION_BY_ID(row.latestVersionId),
    );

    let slabs = [];

    if (
      version.incomeTypeName !== INCOME_TYPE_NAMES.COMMERCIAL_CONTRACTS
      && resolveStructureType(version.commercialStructure) === 'SLABS'
    ) {
      slabs = await fetchSlabs(row.latestVersionId);
    }

    // Prefer storeMappings already embedded on the version payload (avoids a second call
    // that can fail ownership/auth and falsely mark Asset drafts incomplete).
    const storeMappingCount = Array.isArray(version.storeMappings)
      ? version.storeMappings.length
      : 0;

    const gaps = getDraftDetailsGaps(version, {
      slabCount: slabs.length,
      storeMappingCount,
    });

    return {
      row,
      version,
      slabs,
      gaps,
      isComplete: gaps.length === 0,
    };
  }));
}

export function incompleteDraftLabels(reviewData) {
  return reviewData
    .filter((item) => !item.isComplete)
    .map((item) => {
      const name = item.version.agreementName || item.row.agreementName || `Draft #${item.row.id}`;
      const gapText = (item.gaps ?? []).length ? ` (${item.gaps.join(', ')})` : '';
      return `${name}${gapText}`;
    });
}
