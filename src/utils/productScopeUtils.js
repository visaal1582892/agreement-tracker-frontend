/** Client-side mirror of backend AgreementProductScopeComputeService.applyProductRules */
export function applyProductRules(products = [], rules = []) {
  if (!rules.length) return products;
  const ruleType = rules[0].ruleType;
  const productIds = new Set(rules.map((rule) => rule.id));
  if (ruleType === 'INCLUDE') {
    return products.filter((product) => productIds.has(product.id));
  }
  return products.filter((product) => !productIds.has(product.id));
}

export function normalizeExplicitScopeRules(rules = [], defaultRuleType = 'INCLUDE') {
  if (!Array.isArray(rules) || rules.length === 0) {
    return { ruleType: defaultRuleType, rules: [] };
  }

  const firstRuleType = rules.find((r) => typeof r === 'object' && r?.ruleType)?.ruleType || defaultRuleType;

  const normalizedRules = rules
    .map((rule) => {
      if (typeof rule === 'object' && rule !== null) {
        const id = rule.id ?? rule.divisionId ?? rule.productId;
        const ruleType = rule.ruleType || firstRuleType;
        const name = rule.name ?? rule.divisionName ?? rule.productName ?? '';
        return id != null ? { id, ruleType, name } : null;
      }
      if (rule != null) {
        return { id: rule, ruleType: defaultRuleType, name: '' };
      }
      return null;
    })
    .filter((rule) => rule !== null && (rule.ruleType === firstRuleType || !rule.ruleType));

  return { ruleType: firstRuleType, rules: normalizedRules };
}

export function buildExplicitScopeRules(selectedIds, ruleType, metaById, getLabel) {
  if (!selectedIds.length) return [];
  return selectedIds.map((id) => ({
    id,
    ruleType,
    name: getLabel(metaById.get(id), id),
  }));
}

export function buildApiProductRulesPayload(productRules = {}) {
  const divisions = normalizeExplicitScopeRules(productRules.divisionRules ?? [], 'INCLUDE');
  const products = normalizeExplicitScopeRules(productRules.productRules ?? [], 'EXCLUDE');

  return {
    manufacturers: productRules.manufacturers ?? [],
    divisionRules: divisions.rules.map(({ id, ruleType }) => ({ id, ruleType })),
    productRules: products.rules.map(({ id, ruleType }) => ({ id, ruleType })),
  };
}

export const READ_ONLY_PRODUCT_COLUMNS = [
  { field: 'productId', headerName: 'Product Code', width: 150 },
  { field: 'productName', headerName: 'Product Name', flex: 1, minWidth: 200 },
  { field: 'divisionName', headerName: 'Division', width: 140 },
];
