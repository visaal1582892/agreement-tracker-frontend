import { formatLocalDateString } from './dateUtils';

function sortedIds(ids = []) {
  return [...ids].map(String).sort();
}

function normalizeRules(rules = []) {
  return [...rules]
    .map((rule) => ({ id: rule.id, ruleType: rule.ruleType }))
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));
}

export function buildReapprovalBaseline(sourceAgreement, vendorIds, productRules) {
  if (!sourceAgreement || sourceAgreement.approvalStatus !== 'APPROVED') {
    return null;
  }

  return {
    approvalStatus: sourceAgreement.approvalStatus,
    vendorIds: sortedIds(vendorIds ?? sourceAgreement.vendors?.map((vendor) => vendor.vendorId)),
    startDate: formatLocalDateString(sourceAgreement.startDate) ?? null,
    expiryDate: formatLocalDateString(sourceAgreement.expiryDate) ?? null,
    commercialStructure: sourceAgreement.commercialStructure ?? null,
    commercialValue: sourceAgreement.commercialValue ?? null,
    calculationFormula: sourceAgreement.calculationFormula ?? '',
    manufacturers: sortedIds(productRules?.manufacturers ?? sourceAgreement.manufacturerIds),
    divisionRules: normalizeRules(productRules?.divisionRules ?? sourceAgreement.divisionRules),
    productRules: normalizeRules(productRules?.productRules ?? sourceAgreement.productRules),
  };
}

function rulesEqual(left = [], right = []) {
  const normalizedLeft = normalizeRules(left);
  const normalizedRight = normalizeRules(right);
  if (normalizedLeft.length !== normalizedRight.length) return false;
  return normalizedLeft.every((rule, index) => (
    String(rule.id) === String(normalizedRight[index].id)
    && rule.ruleType === normalizedRight[index].ruleType
  ));
}

export function detectRequiresReapproval(baseline, state) {
  if (!baseline || baseline.approvalStatus !== 'APPROVED') {
    return false;
  }

  const { agreement, vendorIds, productRules } = state;
  const details = agreement?.details ?? {};
  const commercials = agreement?.commercials ?? {};

  if (!sortedIds(vendorIds).every((id, index) => id === sortedIds(baseline.vendorIds)[index])
    || sortedIds(vendorIds).length !== baseline.vendorIds.length) {
    return true;
  }

  const startDate = formatLocalDateString(details.startDate);
  const expiryDate = formatLocalDateString(details.expiryDate);
  if (startDate !== baseline.startDate || expiryDate !== baseline.expiryDate) {
    return true;
  }

  if ((commercials.commercialStructure ?? null) !== baseline.commercialStructure) return true;
  if (String(commercials.commercialValue ?? '') !== String(baseline.commercialValue ?? '')) return true;
  if ((commercials.calculationFormula ?? '') !== (baseline.calculationFormula ?? '')) return true;

  if (!sortedIds(productRules?.manufacturers).every((id, index) => id === baseline.manufacturers[index])
    || sortedIds(productRules?.manufacturers).length !== baseline.manufacturers.length) {
    return true;
  }
  if (!rulesEqual(productRules?.divisionRules, baseline.divisionRules)) return true;
  if (!rulesEqual(productRules?.productRules, baseline.productRules)) return true;

  return false;
}
