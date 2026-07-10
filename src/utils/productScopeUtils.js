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

  const ruleType = rules[0]?.ruleType || defaultRuleType;
  const normalizedRules = rules
    .filter((rule) => rule?.id != null && rule.ruleType === ruleType)
    .map((rule) => ({
      id: rule.id,
      ruleType,
      name: rule.name || '',
    }));

  return { ruleType, rules: normalizedRules };
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
