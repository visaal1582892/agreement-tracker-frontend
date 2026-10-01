/** Client-side mirror of backend AgreementProductScopeComputeService.applyProductRules */
export function applyProductRules(products = [], rules = []) {
  if (!rules.length) return products;
  const includeIds = new Set(
    rules.filter((rule) => rule.ruleType === 'INCLUDE').map((rule) => rule.id)
  );
  const excludeIds = new Set(
    rules.filter((rule) => rule.ruleType === 'EXCLUDE').map((rule) => rule.id)
  );
  return products.filter((product) => {
    if (includeIds.size > 0 && !includeIds.has(product.id)) return false;
    if (excludeIds.has(product.id)) return false;
    return true;
  });
}

export function normalizeExplicitScopeRules(rules = [], _defaultRuleType = 'INCLUDE') {
  if (!Array.isArray(rules) || rules.length === 0) {
    return { ruleType: 'INCLUDE', rules: [] };
  }

  // Keep all rules regardless of ruleType — mixed INCLUDE/EXCLUDE is now supported
  const normalizedRules = rules
    .map((rule) => {
      if (typeof rule === 'object' && rule !== null) {
        const id = rule.id ?? rule.divisionId ?? rule.productId;
        const ruleType = rule.ruleType || _defaultRuleType;
        const name = rule.name ?? rule.divisionName ?? rule.productName ?? '';
        return id != null ? { id, ruleType, name } : null;
      }
      if (rule != null) {
        return { id: rule, ruleType: _defaultRuleType, name: '' };
      }
      return null;
    })
    .filter((rule) => rule !== null);

  // Return the dominant ruleType for backward compatibility with the UI dropdown,
  // but all rules (both INCLUDE and EXCLUDE) are preserved in the `rules` array.
  const includeCount = normalizedRules.filter((r) => r.ruleType === 'INCLUDE').length;
  const excludeCount = normalizedRules.filter((r) => r.ruleType === 'EXCLUDE').length;
  const ruleType = includeCount >= excludeCount ? 'INCLUDE' : 'EXCLUDE';

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

/** Build mixed-rules scope rules from separate include/exclude ID lists. */
export function buildMixedScopeRules(
  includeIds,
  excludeIds,
  includeMeta,
  excludeMeta,
  getLabel,
) {
  const rules = [];
  if (includeIds?.length) {
    rules.push(...includeIds.map((id) => ({
      id,
      ruleType: 'INCLUDE',
      name: getLabel(includeMeta?.get(id), id),
    })));
  }
  if (excludeIds?.length) {
    rules.push(...excludeIds.map((id) => ({
      id,
      ruleType: 'EXCLUDE',
      name: getLabel(excludeMeta?.get(id), id),
    })));
  }
  return rules;
}

export function buildApiProductRulesPayload(productRules = {}) {
  if (productRules.combinations && productRules.combinations.length > 0) {
    return {
      combinations: productRules.combinations.map((combo) => ({
        manufacturerId: combo.manufacturerId,
        divisionRules: (combo.divisionRules || []).map(({ id, ruleType }) => ({ id, ruleType })),
        productRules: (combo.productRules || []).map(({ id, ruleType }) => ({ id, ruleType })),
      })),
    };
  }

  const divisions = normalizeExplicitScopeRules(productRules.divisionRules ?? [], 'INCLUDE');
  const products = normalizeExplicitScopeRules(productRules.productRules ?? [], 'EXCLUDE');

  return {
    combinations: (productRules.manufacturers || []).map((mfrId) => ({
      manufacturerId: mfrId,
      divisionRules: divisions.rules.map(({ id, ruleType }) => ({ id, ruleType })),
      productRules: products.rules.map(({ id, ruleType }) => ({ id, ruleType })),
    })),
  };
}

export const READ_ONLY_PRODUCT_COLUMNS = [
  { field: 'productId', headerName: 'Product Code', width: 150 },
  { field: 'productName', headerName: 'Product Name', flex: 1, minWidth: 200 },
  { field: 'divisionName', headerName: 'Division', width: 140 },
];
