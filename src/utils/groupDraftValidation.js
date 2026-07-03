import axiosInstance from '../api/axiosInstance';
import { ENDPOINTS } from '../config/endpoints';
import { fetchSlabs } from '../api/commercialApi';
import { INCOME_TYPE_NAMES } from '../constants/incomeTypeNames';
import { resolveStructureType } from '../constants/commercialStructure';

function getAssetRentalPayoutGaps(asset, assetPayoutPeriods = []) {
  const gaps = [];
  if (!asset?.assetCategory) gaps.push('Asset Category');
  if (asset?.assetCategory !== 'ACTIVITY' && !asset?.assetType) gaps.push('Asset Type');
  const parsedStoreCount = Number(asset?.storeCount);
  if (!Number.isInteger(parsedStoreCount) || parsedStoreCount <= 0) gaps.push('Store Count');
  const hasFlatPayout = asset?.flatPayout != null && Number(asset.flatPayout) > 0;
  const hasSchedule = (assetPayoutPeriods ?? []).length > 0;
  if (!hasFlatPayout && !hasSchedule) {
    gaps.push('Asset Payout');
  }
  return gaps;
}

export function getDraftDetailsGaps(version, { slabCount = 0, targetCount = 0 } = {}) {
  const gaps = [];
  if (!version?.incomeTypeId) gaps.push('Income Type');
  if (!version?.agreementTypeId) gaps.push('Agreement Type');
  if (!version?.startDate) gaps.push('Start Date');
  if (!version?.expiryDate) gaps.push('Expiry Date');

  if (version?.incomeTypeName === INCOME_TYPE_NAMES.ASSET_RENTALS) {
    gaps.push(...getAssetRentalPayoutGaps(version.asset, version.assetPayoutPeriods));
    if (!version?.invoiceVendorId) gaps.push('Invoice Vendor');
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

    const gaps = getDraftDetailsGaps(version, {
      slabCount: slabs.length,
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
    .map((item) => item.version.agreementName || item.row.agreementName || `Draft #${item.row.id}`);
}
