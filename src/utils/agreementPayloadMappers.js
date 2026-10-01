import { mapCommercialsFromApi } from './agreementWizardUtils';
import { mapDocumentsFromApi } from '../api/uploadApi';
import { GEOGRAPHY_MODE } from '../constants/geographyMode';
import { isDataFeeIncomeType } from './incomeTypeUtils';
import { normalizeExplicitScopeRules } from './productScopeUtils';

export function resolveGeographyModeFromAgreement(agreement) {
  if (agreement?.geographyMode) {
    return agreement.geographyMode;
  }
  if (isDataFeeIncomeType([], agreement?.incomeTypeId, agreement?.incomeTypeName)) {
    return GEOGRAPHY_MODE.ALL;
  }
  return GEOGRAPHY_MODE.MIXED;
}

export function mapAssetFromApi(agreement) {
  const assetCategory = agreement?.assetCategory;
  const assetType = agreement?.assetType;
  const commercialStructure = agreement?.commercialStructure;
  const commercialValue = agreement?.commercialValue;
  const apiPeriods = agreement?.assetPayoutPeriods ?? [];

  if (!assetCategory) {
    return {
      assetCategory: 'PHYSICAL_ASSET',
      assetType: '',
      storeCount: '',
      payoutMode: 'FLAT',
      flatPayout: '',
      payoutPerStore: '',
      assetPayoutPeriods: [],
      remarks: '',
    };
  }

  const mappedPeriods = apiPeriods.length > 0
    ? apiPeriods.map((period) => ({
      periodMonths: period.periodMonths ?? '',
      payoutPerStore: period.payoutPerStore ?? '',
    }))
    : [];

  const payoutMode = commercialStructure === 'PAYOUT_PER_STORE' ? 'PER_STORE' : 'FLAT';

  return {
    assetCategory: assetCategory,
    assetType: assetType ?? '',
    storeCount: agreement?.asset?.storeCount ?? '',
    payoutMode,
    flatPayout: payoutMode === 'FLAT' ? (commercialValue ?? '') : '',
    payoutPerStore: '',
    assetPayoutPeriods: payoutMode === 'PER_STORE' && mappedPeriods.length === 0
      ? [{ periodMonths: '', payoutPerStore: '' }]
      : mappedPeriods,
    remarks: agreement?.notes ?? '',
  };
}

export function mapProductRulesFromApi(agreement) {
  if (!agreement) {
    return {
      manufacturers: [],
      manufacturerOptions: [],
      combinations: [],
      divisionRules: [],
      productRules: [],
      computedProductPreview: [],
      productScopeComputeStatus: null,
    };
  }

  let rawMfrs = agreement.manufacturers;
  if (!Array.isArray(rawMfrs) || rawMfrs.length === 0) {
    rawMfrs = agreement.manufacturerIds ?? [];
  }
  if ((!Array.isArray(rawMfrs) || rawMfrs.length === 0) && Array.isArray(agreement.products)) {
    const derivedFromProducts = agreement.products
      .filter((p) => p && (p.manufacturerId || p.manufacturerName))
      .map((p) => ({
        id: p.manufacturerId || p.id,
        manufacturerName: p.manufacturerName || '',
      }));
    if (derivedFromProducts.length > 0) {
      const seen = new Set();
      rawMfrs = derivedFromProducts.filter((m) => {
        if (!m.id || seen.has(m.id)) return false;
        seen.add(m.id);
        return true;
      });
    }
  }
  if (!Array.isArray(rawMfrs)) {
    rawMfrs = [];
  }

  const manufacturers = rawMfrs
    .map((m) => (typeof m === 'object' && m !== null ? (m.id ?? m.manufacturerId) : m))
    .filter((id) => id != null);

  const manufacturerOptions = rawMfrs
    .map((m) => {
      if (typeof m === 'object' && m !== null) {
        return {
          id: m.id ?? m.manufacturerId,
          manufacturerName: m.manufacturerName || m.name || '',
        };
      }
      return {
        id: m,
        manufacturerName: '',
      };
    })
    .filter((m) => m.id != null);

  const flatDivisionRules = (agreement.divisionRules ?? []).map((r) => ({
    id: r.id ?? r.divisionId,
    ruleType: r.ruleType,
    name: r.name ?? r.divisionName ?? '',
    manufacturerId: r.manufacturerId ?? null,
  }));

  const flatProductRules = (agreement.productRules ?? []).map((r) => ({
    id: r.id ?? r.productId,
    ruleType: r.ruleType,
    name: r.name ?? r.productName ?? '',
    manufacturerId: r.manufacturerId ?? null,
  }));

  const combinationsByMfrId = new Map();
  manufacturers.forEach((mfrId) => {
    if (!combinationsByMfrId.has(mfrId)) {
      combinationsByMfrId.set(mfrId, { manufacturerId: mfrId, divisionRules: [], productRules: [] });
    }
  });
  flatDivisionRules.forEach((r) => {
    const key = r.manufacturerId ?? (manufacturers.length === 1 ? manufacturers[0] : null);
    if (key != null) {
      if (!combinationsByMfrId.has(key)) {
        combinationsByMfrId.set(key, { manufacturerId: key, divisionRules: [], productRules: [] });
      }
      combinationsByMfrId.get(key).divisionRules.push(r);
    }
  });
  flatProductRules.forEach((r) => {
    const key = r.manufacturerId ?? (manufacturers.length === 1 ? manufacturers[0] : null);
    if (key != null) {
      if (!combinationsByMfrId.has(key)) {
        combinationsByMfrId.set(key, { manufacturerId: key, divisionRules: [], productRules: [] });
      }
      combinationsByMfrId.get(key).productRules.push(r);
    }
  });
  const combinations = Array.from(combinationsByMfrId.values());

  return {
    manufacturers,
    manufacturerOptions,
    combinations,
    divisionRules: flatDivisionRules,
    productRules: flatProductRules,
    computedProductPreview: (agreement.products ?? []).map((product) => ({
      productId: product.productId ?? product.id,
      productName: product.productName,
      divisionName: product.divisionName,
    })),
    productScopeComputeStatus: agreement.productScopeComputeStatus ?? null,
  };
}

export function mapPersistedAgreementFields(agreement, slabCount = null) {
  const commercials = mapCommercialsFromApi(agreement, slabCount);
  return {
    revisionType: agreement.revisionType || 'EDIT',
    agreementName: agreement.agreementName ?? '',
    agreementGroupId: agreement.agreementGroupId ?? null,
    agreementGroupName: agreement.agreementGroupName ?? '',
    vendorIds: agreement.vendors?.map((v) => v.vendorId) ?? [],
    vendors: agreement.vendors?.map((v) => ({
      vendorId: v.vendorId,
      vendorName: v.vendorName,
      company: v.company,
      state: v.state,
    })) ?? [],
    productRules: mapProductRulesFromApi(agreement),
    agreement: {
      id: `agr-edit-${agreement.id}`,
      details: {
        incomeTypeId: agreement.incomeTypeId ?? null,
        incomeTypeName: agreement.incomeTypeName ?? null,
        agreementTypeId: agreement.agreementTypeId ?? null,
        startDate: agreement.startDate ?? null,
        expiryDate: agreement.expiryDate ?? null,
        notes: agreement.notes ?? '',
        geographyMode: resolveGeographyModeFromAgreement(agreement),
        partnerStates: Array.isArray(agreement.partnerStates) ? agreement.partnerStates : [],
        partnerCities: Array.isArray(agreement.partnerCities) ? agreement.partnerCities : [],
        locations: Array.isArray(agreement.locations) ? agreement.locations : [],
        documents: mapDocumentsFromApi(agreement.documents),
        adhocSubType: agreement.adhocSubType === 'CONSUMER_PRICE_OFF' || !agreement.adhocSubType
          ? 'QPS'
          : agreement.adhocSubType,
        quantityCap: agreement.quantityCap ?? '',
        invoiceVendorId: agreement.invoiceVendorId ?? null,
        payoutBufferDays: agreement.payoutBufferDays ?? '',
        leadTimeBasis: agreement.leadTimeBasis ?? null,
        invoiceGenerationLeadTime: agreement.invoiceGenerationLeadTime ?? '',
        calculationBasis: agreement.calculationBasis ?? 'VENDOR_INVOICE',
        paymentRealizationType: agreement.paymentRealizationType ?? 'DIRECT_PAYMENT_INVOICE',
      },
      asset: mapAssetFromApi(agreement),
      commercials,
    },
  };
}

export function toNumericId(id) {
  if (id === null || id === undefined || id === '') return id;
  const parsed = Number(id);
  return Number.isNaN(parsed) ? id : parsed;
}

export function normalizeManufacturer(item) {
  return {
    id: toNumericId(item.id),
    manufacturerName: item.manufacturerName || item.name || '',
  };
}

export function createEmptyCombination() {
  return {
    id: `combo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    manufacturerId: null,
    manufacturerName: '',
    divisionOp: 'INCLUDE',
    selectedDivisionIds: [],
    selectedDivisionMeta: new Map(),
    productOp: 'EXCLUDE',
    selectedProductIds: [],
    selectedProductMeta: new Map(),
  };
}

export function serializeProductRulesPatch(patch) {
  return JSON.stringify({
    combinations: (patch.combinations || []).map((combo) => ({
      manufacturerId: combo.manufacturerId,
      divisionRules: (combo.divisionRules || []).map((r) => ({
        id: r.id,
        ruleType: r.ruleType,
        name: r.name ?? '',
        manufacturerId: combo.manufacturerId,
      })),
      productRules: (combo.productRules || []).map((r) => ({
        id: r.id,
        ruleType: r.ruleType,
        name: r.name ?? '',
        manufacturerId: combo.manufacturerId,
      })),
    })),
  });
}

export function mapRulesToCombinations(rules) {
  if (!rules) return [createEmptyCombination()];

  if (rules.combinations && rules.combinations.length > 0) {
    return rules.combinations.map((c) => {
      const normDivisions = normalizeExplicitScopeRules(c.divisionRules || [], 'INCLUDE');
      const normProducts = normalizeExplicitScopeRules(c.productRules || [], 'EXCLUDE');

      const divIds = normDivisions.rules.map((r) => toNumericId(r.id));
      const divMeta = new Map(
        normDivisions.rules.map((r) => [toNumericId(r.id), { id: toNumericId(r.id), divisionName: r.name || '' }])
      );
      const prodIds = normProducts.rules.map((r) => r.id);
      const prodMeta = new Map(
        normProducts.rules.map((r) => [r.id, { id: r.id, productName: r.name || r.id }])
      );

      const allDivRuleTypes = normDivisions.rules.map((r) => r.ruleType);
      const allProdRuleTypes = normProducts.rules.map((r) => r.ruleType);

      return {
        ...createEmptyCombination(),
        manufacturerId: c.manufacturerId,
        manufacturerName: '',
        divisionOp: allDivRuleTypes.includes('EXCLUDE') ? 'EXCLUDE' : 'INCLUDE',
        selectedDivisionIds: divIds,
        selectedDivisionMeta: divMeta,
        productOp: allProdRuleTypes.includes('INCLUDE') ? 'INCLUDE' : 'EXCLUDE',
        selectedProductIds: prodIds,
        selectedProductMeta: prodMeta,
      };
    });
  }

  const seedMfrs = (
    rules.manufacturerOptions?.length
      ? rules.manufacturerOptions
      : (rules.manufacturers || rules.manufacturerIds || []).map((id) =>
          typeof id === 'object' ? id : { id, manufacturerName: '' }
        )
  ).map(normalizeManufacturer);

  if (seedMfrs.length === 0) return [createEmptyCombination()];

  const rawDivisions = rules.divisionRules || rules.divisionIds || rules.divisions || [];
  const rawProducts = rules.productRules || rules.productIds || rules.products || [];

  return seedMfrs.map((mfr) => {
    const mfrIdNum = toNumericId(mfr.id);
    
    const mfrDivisions = rawDivisions.filter(r => r.manufacturerId == null || toNumericId(r.manufacturerId) === mfrIdNum);
    const mfrProducts = rawProducts.filter(r => r.manufacturerId == null || toNumericId(r.manufacturerId) === mfrIdNum);

    const normDivisions = normalizeExplicitScopeRules(mfrDivisions, 'INCLUDE');
    const normProducts = normalizeExplicitScopeRules(mfrProducts, 'EXCLUDE');

    const divIds = normDivisions.rules.map((r) => toNumericId(r.id));
    const divMeta = new Map(
      normDivisions.rules.map((r) => [toNumericId(r.id), { id: toNumericId(r.id), divisionName: r.name || '' }])
    );
    const prodIds = normProducts.rules.map((r) => r.id);
    const prodMeta = new Map(
      normProducts.rules.map((r) => [r.id, { id: r.id, productName: r.name || r.id }])
    );

    const allDivRuleTypes = normDivisions.rules.map((r) => r.ruleType);
    const allProdRuleTypes = normProducts.rules.map((r) => r.ruleType);

    return {
      ...createEmptyCombination(),
      manufacturerId: mfr.id,
      manufacturerName: mfr.manufacturerName,
      divisionOp: allDivRuleTypes.includes('EXCLUDE') ? 'EXCLUDE' : 'INCLUDE',
      selectedDivisionIds: divIds,
      selectedDivisionMeta: divMeta,
      productOp: allProdRuleTypes.includes('INCLUDE') ? 'INCLUDE' : 'EXCLUDE',
      selectedProductIds: prodIds,
      selectedProductMeta: prodMeta,
    };
  });
}

export function mapCombinationsToRules(combinationsState) {
  const combinations = [];

  combinationsState.forEach((combo) => {
    if (!combo.manufacturerId) return;

    const divisionRules = [];
    const productRules = [];

    const divMeta = combo.selectedDivisionMeta || new Map();
    combo.selectedDivisionIds.forEach((id) => {
      const meta = divMeta.get(toNumericId(id));
      divisionRules.push({
        id,
        ruleType: combo.divisionOp,
        name: meta?.divisionName || '',
        manufacturerId: combo.manufacturerId,
      });
    });

    const prodMeta = combo.selectedProductMeta || new Map();
    combo.selectedProductIds.forEach((id) => {
      const meta = prodMeta.get(id);
      productRules.push({
        id,
        ruleType: combo.productOp,
        name: meta?.productName || String(id),
        manufacturerId: combo.manufacturerId,
      });
    });

    combinations.push({
      manufacturerId: combo.manufacturerId,
      divisionRules,
      productRules,
    });
  });

  return { combinations };
}

export function hasSavedProductRules(rules = {}) {
  return Boolean(
    rules.combinations?.length ||
    rules.manufacturers?.length ||
    rules.manufacturerIds?.length ||
    rules.manufacturerOptions?.length ||
    rules.divisionRules?.length ||
    rules.divisionIds?.length ||
    rules.divisions?.length ||
    rules.productRules?.length ||
    rules.productIds?.length ||
    rules.products?.length
  );
}
