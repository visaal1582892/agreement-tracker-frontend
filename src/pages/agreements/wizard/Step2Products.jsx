import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Box, Typography, Paper, FormControl, Select, MenuItem, TextField,
  Checkbox, Button, Alert, CircularProgress, List, ListItem, ListItemButton,
  ListItemIcon, ListItemText, TablePagination,
} from '@mui/material';
import { AccountTreeOutlined } from '@mui/icons-material';
import { integrationApi, unwrapPaginatedResponse } from '../../../api/integrationApi';
import {
  buildApiProductRulesPayload,
  buildExplicitScopeRules,
  normalizeExplicitScopeRules,
} from '../../../utils/productScopeUtils';
import { useDebounce } from '../../../hooks/useDebounce';
import { BRAND } from '../../../config/theme';
import SearchableSelect from '../../../components/forms/SearchableSelect';
import WizardSectionTitle from '../../../components/wizard/WizardSectionTitle';
import WizardFieldAnchor from '../../../components/wizard/WizardFieldAnchor';

const MANUFACTURER_DROPDOWN_LIMIT = 50;
const EMPTY_RULES = { manufacturers: [], divisionRules: [], productRules: [] };

function serializeProductRulesPatch(patch) {
  return JSON.stringify({
    manufacturers: patch.manufacturers ?? [],
    manufacturerOptions: (patch.manufacturerOptions ?? []).map((manufacturer) => ({
      id: manufacturer.id,
      manufacturerName: manufacturer.manufacturerName ?? '',
    })),
    divisionRules: (patch.divisionRules ?? []).map((rule) => ({
      id: rule.id,
      ruleType: rule.ruleType,
      name: rule.name ?? '',
    })),
    productRules: (patch.productRules ?? []).map((rule) => ({
      id: rule.id,
      ruleType: rule.ruleType,
      name: rule.name ?? '',
    })),
  });
}

const columnPaperSx = {
  flex: 1,
  minWidth: 0,
  p: 1.5,
  display: 'flex',
  flexDirection: 'column',
  border: `1px solid ${BRAND.borderLight}`,
  borderRadius: '10px',
};

const scrollableListBoxSx = {
  maxHeight: 300,
  overflowY: 'auto',
  border: `1px solid ${BRAND.borderLight}`,
  borderRadius: 1,
  flex: 1,
};

const ruleSelectSx = {
  minWidth: 0,
  width: '100%',
  flexShrink: 0,
};

const headerActionButtonSx = {
  minWidth: 0,
  px: 0.5,
  fontSize: '0.72rem',
};

function ScrollableCheckboxList({
  items,
  getItemId,
  getItemLabel,
  selectedIds,
  onToggle,
}) {
  return (
    <Box sx={scrollableListBoxSx}>
      <List dense>
        {items.map((item) => {
          const id = getItemId(item);
          const labelId = `checkbox-list-label-${id}`;
          return (
            <ListItem key={id} disablePadding>
              <ListItemButton role={undefined} onClick={() => onToggle(item)} dense>
                <ListItemIcon sx={{ minWidth: 36 }}>
                  <Checkbox
                    edge="start"
                    checked={selectedIds.some((selectedId) => toNumericId(selectedId) === toNumericId(id))}
                    tabIndex={-1}
                    disableRipple
                    slotProps={{ input: { 'aria-labelledby': labelId } }}
                    size="small"
                  />
                </ListItemIcon>
                <ListItemText
                  id={labelId}
                  primary={getItemLabel(item)}
                  slotProps={{ primary: { variant: 'body2' } }}
                />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>
    </Box>
  );
}

function toNumericId(id) {
  const parsed = Number(id);
  return Number.isNaN(parsed) ? id : parsed;
}

function normalizeManufacturer(item) {
  return {
    id: toNumericId(item.id),
    manufacturerName: item.manufacturerName || item.name || '',
  };
}

function normalizeDivision(item) {
  return {
    id: toNumericId(item.id),
    divisionName: item.divisionName,
    manufacturerId: toNumericId(item.manufacturerId),
  };
}

function normalizeProduct(item) {
  return {
    id: item.id,
    productName: item.productName,
    divisionId: item.divisionId,
    divisionName: item.divisionName,
    manufacturerId: item.manufacturerId,
    manufacturerName: item.manufacturerName,
  };
}

export function hasSavedProductRules(rules = {}) {
  return Boolean(
    rules.manufacturers?.length ||
    rules.divisionRules?.length ||
    rules.productRules?.length,
  );
}

export function mapSharedRulesToLocalState(rules) {
  const seedMfrs = (
    rules.manufacturerOptions?.length
      ? rules.manufacturerOptions
      : (rules.manufacturers || []).map((id) => ({ id, manufacturerName: '' }))
  ).map(normalizeManufacturer);
  const normalizedDivisions = normalizeExplicitScopeRules(rules.divisionRules || [], 'INCLUDE');
  const normalizedProducts = normalizeExplicitScopeRules(rules.productRules || [], 'EXCLUDE');

  return {
    selectedManufacturers: seedMfrs,
    selectedDivisionIds: normalizedDivisions.rules.map((rule) => toNumericId(rule.id)),
    selectedDivisionMeta: normalizedDivisions.rules.reduce((map, rule) => {
      const id = toNumericId(rule.id);
      map.set(id, { id, divisionName: rule.name || '' });
      return map;
    }, new Map()),
    selectedProductRuleIds: normalizedProducts.rules.map((rule) => rule.id),
    selectedProductMeta: normalizedProducts.rules.reduce((map, rule) => {
      map.set(rule.id, { id: rule.id, productName: rule.name || rule.id });
      return map;
    }, new Map()),
    productOp: normalizedProducts.ruleType,
    divisionOp: normalizedDivisions.ruleType,
  };
}

function formatDivisionLabel(division) {
  return `${division.divisionName} (ID: ${division.id})`;
}

function formatProductLabel(product) {
  return `${product.productName} (ID: ${product.id})`;
}

function isDivisionInProductScope(divisionId, {
  productFilterDivisionIds,
  selectedDivisionIds,
  divisionOp,
}) {
  const normalizedDivisionId = toNumericId(divisionId);
  if (!productFilterDivisionIds.length) {
    return true;
  }
  if (divisionOp === 'INCLUDE') {
    return selectedDivisionIds.some((id) => toNumericId(id) === normalizedDivisionId);
  }
  return productFilterDivisionIds.some((id) => toNumericId(id) === normalizedDivisionId);
}

function pruneProductSelections(
  selectedIds,
  selectedMeta,
  scope,
) {
  const prunedIds = selectedIds.filter((id) => {
    const meta = selectedMeta.get(id);
    if (!meta?.divisionId) return true;
    return isDivisionInProductScope(meta.divisionId, scope);
  });
  const nextMeta = new Map();
  prunedIds.forEach((id) => {
    const meta = selectedMeta.get(id);
    if (meta) nextMeta.set(id, meta);
  });
  return { prunedIds, nextMeta };
}

export default function Step2Products({ state, updateProductRules, info, error }) {
  const [manufSearchText, setManufSearchText] = useState('');
  const [manufacturerOptions, setManufacturerOptions] = useState([]);
  const [manufacturerSearchLoading, setManufacturerSearchLoading] = useState(false);
  const [manufacturerSearchError, setManufacturerSearchError] = useState(null);
  const [selectedManufacturers, setSelectedManufacturers] = useState([]);

  const [divisionSearchText, setDivisionSearchText] = useState('');
  const [divisionListItems, setDivisionListItems] = useState([]);
  const [divisionTotalCount, setDivisionTotalCount] = useState(0);
  const [divisionPage, setDivisionPage] = useState(0);
  const [divisionRowsPerPage, setDivisionRowsPerPage] = useState(10);
  const [divisionLoading, setDivisionLoading] = useState(false);
  const [allScopeDivisionIds, setAllScopeDivisionIds] = useState([]);
  const [selectedDivisionIds, setSelectedDivisionIds] = useState([]);
  const [selectedDivisionMeta, setSelectedDivisionMeta] = useState(() => new Map());
  const [divisionOp, setDivisionOp] = useState('INCLUDE');

  const [productRuleSearchText, setProductRuleSearchText] = useState('');
  const [productListItems, setProductListItems] = useState([]);
  const [productTotalCount, setProductTotalCount] = useState(0);
  const [productPage, setProductPage] = useState(0);
  const [productRowsPerPage, setProductRowsPerPage] = useState(10);
  const [productLoading, setProductLoading] = useState(false);
  const [selectedProductRuleIds, setSelectedProductRuleIds] = useState([]);
  const [selectedProductMeta, setSelectedProductMeta] = useState(() => new Map());
  const [productOp, setProductOp] = useState('EXCLUDE');

  const [finalScopeCount, setFinalScopeCount] = useState(0);
  const [finalScopeCountLoading, setFinalScopeCountLoading] = useState(false);
  const [finalScopeCountError, setFinalScopeCountError] = useState(null);

  const [fetchError, setFetchError] = useState(null);

  const hasInitialized = useRef(false);
  const emitReadyRef = useRef(false);
  const lastEmittedProductRulesRef = useRef(null);
  const suppressScopeResetRef = useRef(false);
  const pendingDivisionIdsRef = useRef(null);
  const pendingProductRuleIdsRef = useRef(null);
  const prevScopedDivisionKeyRef = useRef('');
  const selectedProductMetaRef = useRef(selectedProductMeta);

  const selectedProductRuleIdsRef = useRef(selectedProductRuleIds);

  useEffect(() => {
    selectedProductMetaRef.current = selectedProductMeta;
  }, [selectedProductMeta]);

  useEffect(() => {
    selectedProductRuleIdsRef.current = selectedProductRuleIds;
  }, [selectedProductRuleIds]);

  const debouncedManufSearch = useDebounce(manufSearchText, 500);
  const debouncedDivisionSearch = useDebounce(divisionSearchText, 400);
  const debouncedProductRuleSearch = useDebounce(productRuleSearchText, 400);

  const selectedManufacturerIds = useMemo(
    () => selectedManufacturers.map((m) => m.id),
    [selectedManufacturers],
  );
  const debouncedSelectedManufs = useDebounce(selectedManufacturerIds, 800);

  const productFilterDivisionIds = useMemo(() => {
    if (!selectedDivisionIds.length) {
      return [];
    }
    if (divisionOp === 'INCLUDE') {
      return selectedDivisionIds;
    }
    if (!allScopeDivisionIds.length) {
      return [];
    }
    return allScopeDivisionIds.filter(
      (id) => !selectedDivisionIds.some((selectedId) => toNumericId(selectedId) === toNumericId(id)),
    );
  }, [allScopeDivisionIds, selectedDivisionIds, divisionOp]);

  const productFilterDivisionKey = useMemo(
    () => `${productFilterDivisionIds.join(',')}|${divisionOp}`,
    [productFilterDivisionIds, divisionOp],
  );

  const limitedManufacturerOptions = useMemo(
    () => manufacturerOptions.slice(0, MANUFACTURER_DROPDOWN_LIMIT),
    [manufacturerOptions],
  );
  const hasMoreManufacturerOptions = manufacturerOptions.length > MANUFACTURER_DROPDOWN_LIMIT;

  const explicitDivisionRules = useMemo(
    () => buildExplicitScopeRules(
      selectedDivisionIds,
      divisionOp,
      selectedDivisionMeta,
      (meta) => meta?.divisionName || '',
    ),
    [selectedDivisionIds, divisionOp, selectedDivisionMeta],
  );

  const explicitProductRules = useMemo(
    () => buildExplicitScopeRules(
      selectedProductRuleIds,
      productOp,
      selectedProductMeta,
      (meta, id) => meta?.productName || String(id),
    ),
    [selectedProductRuleIds, selectedProductMeta, productOp],
  );

  const scopeCountPayload = useMemo(
    () => buildApiProductRulesPayload({
      manufacturers: selectedManufacturerIds,
      divisionRules: explicitDivisionRules,
      productRules: explicitProductRules,
    }),
    [selectedManufacturerIds, explicitDivisionRules, explicitProductRules],
  );

  const scopeCountPayloadKey = useMemo(
    () => JSON.stringify(scopeCountPayload),
    [scopeCountPayload],
  );
  const debouncedScopeCountPayloadKey = useDebounce(scopeCountPayloadKey, 500);

  const pinnedProductIdsKey = useMemo(
    () => selectedProductRuleIds.join(','),
    [selectedProductRuleIds],
  );

  const displayDivisionItems = useMemo(() => {
    const pageIds = new Set(divisionListItems.map((division) => toNumericId(division.id)));
    const selectedSet = new Set(selectedDivisionIds.map((id) => toNumericId(id)));

    const offPageSelected = selectedDivisionIds
      .map((id) => toNumericId(id))
      .filter((id) => !pageIds.has(id))
      .map((id) => {
        const meta = selectedDivisionMeta.get(id);
        return {
          id,
          divisionName: meta?.divisionName || `Division ID: ${id}`,
          manufacturerId: meta?.manufacturerId,
        };
      });

    const onPageSelected = divisionListItems.filter((division) =>
      selectedSet.has(toNumericId(division.id)));
    const onPageRest = divisionListItems.filter((division) =>
      !selectedSet.has(toNumericId(division.id)));

    return [...offPageSelected, ...onPageSelected, ...onPageRest];
  }, [divisionListItems, selectedDivisionIds, selectedDivisionMeta]);

  const hasManufacturerFilter = selectedManufacturers.length > 0;
  const hasProductScope = hasManufacturerFilter;
  const sectionInfo = info ?? 'Search manufacturers to load products. Optionally narrow by divisions or explicit product rules.';

  useEffect(() => {
    const trimmedSearch = debouncedManufSearch.trim();
    if (!trimmedSearch) {
      setManufacturerOptions([]);
      return undefined;
    }

    const isNumeric = /^\d+$/.test(trimmedSearch);
    if (!isNumeric && trimmedSearch.length < 3) {
      return undefined;
    }

    let cancelled = false;
    setManufacturerSearchLoading(true);
    setManufacturerSearchError(null);

    integrationApi.searchManufacturers(trimmedSearch)
      .then((response) => {
        if (cancelled) return;
        const items = Array.isArray(response.data) ? response.data : [];
        setManufacturerOptions(items.map(normalizeManufacturer));
      })
      .catch((err) => {
        if (!cancelled) {
          setManufacturerSearchError(err.response?.data?.message || 'Manufacturer search failed.');
          setManufacturerOptions([]);
        }
      })
      .finally(() => {
        if (!cancelled) setManufacturerSearchLoading(false);
      });

    return () => { cancelled = true; };
  }, [debouncedManufSearch]);

  useEffect(() => {
    if (!debouncedSelectedManufs.length) {
      if (suppressScopeResetRef.current) {
        return undefined;
      }
      setAllScopeDivisionIds([]);
      setDivisionListItems([]);
      setDivisionTotalCount(0);
      setSelectedDivisionIds([]);
      setSelectedDivisionMeta(new Map());
      setSelectedProductRuleIds([]);
      setSelectedProductMeta(new Map());
      return undefined;
    }

    suppressScopeResetRef.current = false;

    let cancelled = false;
    integrationApi.getDivisions({ manufacturerIds: debouncedSelectedManufs.map(toNumericId) })
      .then((response) => {
        if (cancelled) return;
        const { content } = unwrapPaginatedResponse(response.data);
        const ids = content.map((division) => toNumericId(division.id));
        setAllScopeDivisionIds(ids);

        if (pendingDivisionIdsRef.current) {
          const { ids: pendingIds, meta } = pendingDivisionIdsRef.current;
          pendingDivisionIdsRef.current = null;
          const validIds = pendingIds
            .map((id) => toNumericId(id))
            .filter((id) => ids.some((scopeId) => toNumericId(scopeId) === id));
          setSelectedDivisionIds(validIds);
          if (meta) setSelectedDivisionMeta(meta);
          return;
        }

        setSelectedDivisionIds((prev) => prev
          .map((id) => toNumericId(id))
          .filter((id) => ids.some((scopeId) => toNumericId(scopeId) === id)));
      })
      .catch((err) => {
        if (!cancelled) {
          setFetchError(err.response?.data?.message || 'Failed to load division scope.');
          setAllScopeDivisionIds([]);
        }
      });

    return () => { cancelled = true; };
  }, [debouncedSelectedManufs]);

  useEffect(() => {
    if (!debouncedSelectedManufs.length) {
      setDivisionListItems([]);
      setDivisionTotalCount(0);
      return undefined;
    }

    let cancelled = false;
    setDivisionLoading(true);
    setFetchError(null);

    integrationApi.getDivisions({
      manufacturerIds: debouncedSelectedManufs.map(toNumericId),
      searchKey: debouncedDivisionSearch,
      page: divisionPage,
      size: divisionRowsPerPage,
    })
      .then((response) => {
        if (cancelled) return;
        const { content, totalElements } = unwrapPaginatedResponse(response.data);
        const normalized = content.map(normalizeDivision);
        setDivisionListItems(normalized);
        setDivisionTotalCount(totalElements);
        setSelectedDivisionMeta((prev) => {
          let changed = false;
          const next = new Map(prev);
          normalized.forEach((division) => {
            const id = toNumericId(division.id);
            if (!next.has(id)) return;
            const existing = next.get(id);
            if (
              existing.divisionName === division.divisionName
              && toNumericId(existing.manufacturerId) === toNumericId(division.manufacturerId)
            ) {
              return;
            }
            next.set(id, {
              ...existing,
              divisionName: division.divisionName,
              manufacturerId: division.manufacturerId,
            });
            changed = true;
          });
          return changed ? next : prev;
        });
      })
      .catch((err) => {
        if (!cancelled) {
          setFetchError(err.response?.data?.message || 'Failed to load divisions.');
          setDivisionListItems([]);
          setDivisionTotalCount(0);
        }
      })
      .finally(() => {
        if (!cancelled) setDivisionLoading(false);
      });

    return () => { cancelled = true; };
  }, [
    debouncedSelectedManufs,
    debouncedDivisionSearch,
    divisionPage,
    divisionRowsPerPage,
  ]);

  useEffect(() => {
    setDivisionPage(0);
  }, [debouncedDivisionSearch, debouncedSelectedManufs]);

  useEffect(() => {
    if (!hasProductScope) {
      prevScopedDivisionKeyRef.current = '';
      return undefined;
    }

    const scopeKey = productFilterDivisionKey;
    if (
      prevScopedDivisionKeyRef.current
      && prevScopedDivisionKeyRef.current !== scopeKey
      && !pendingProductRuleIdsRef.current
    ) {
      const scope = {
        productFilterDivisionIds,
        selectedDivisionIds,
        divisionOp,
      };
      const { prunedIds, nextMeta } = pruneProductSelections(
        selectedProductRuleIdsRef.current,
        selectedProductMetaRef.current,
        scope,
      );
      setSelectedProductRuleIds(prunedIds);
      setSelectedProductMeta(nextMeta);
      setProductPage(0);
    }
    prevScopedDivisionKeyRef.current = scopeKey;
    return undefined;
  }, [hasProductScope, productFilterDivisionKey, productFilterDivisionIds, selectedDivisionIds, divisionOp]);

  useEffect(() => {
    if (!hasProductScope) {
      setProductListItems([]);
      setProductTotalCount(0);
      return undefined;
    }

    let cancelled = false;
    setProductLoading(true);
    setFetchError(null);

    integrationApi.searchProducts({
      searchKey: debouncedProductRuleSearch,
      manufacturerIds: debouncedSelectedManufs.map(toNumericId),
      divisionIds: productFilterDivisionIds.map(toNumericId),
      page: productPage,
      size: productRowsPerPage,
      pinnedProductIds: selectedProductRuleIds,
    })
      .then((response) => {
        if (cancelled) return;
        const { content, totalElements } = unwrapPaginatedResponse(response.data);
        const normalized = content.map(normalizeProduct);
        setProductListItems(normalized);
        setProductTotalCount(totalElements);

        if (pendingProductRuleIdsRef.current) {
          const { ids, op, meta } = pendingProductRuleIdsRef.current;
          pendingProductRuleIdsRef.current = null;
          setProductOp(op);
          const enrichedMeta = new Map(meta);
          normalized.forEach((product) => {
            if (enrichedMeta.has(product.id)) {
              enrichedMeta.set(product.id, {
                ...enrichedMeta.get(product.id),
                divisionId: toNumericId(product.divisionId),
                manufacturerId: toNumericId(product.manufacturerId),
              });
            }
          });
          setSelectedProductRuleIds(ids);
          setSelectedProductMeta(enrichedMeta);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setFetchError(err.response?.data?.message || 'Failed to load products.');
          setProductListItems([]);
          setProductTotalCount(0);
        }
      })
      .finally(() => {
        if (!cancelled) setProductLoading(false);
      });

    return () => { cancelled = true; };
  }, [
    hasProductScope,
    debouncedSelectedManufs,
    productFilterDivisionKey,
    debouncedProductRuleSearch,
    productPage,
    productRowsPerPage,
    pinnedProductIdsKey,
  ]);

  useEffect(() => {
    setProductPage(0);
  }, [debouncedProductRuleSearch, productFilterDivisionKey]);

  useEffect(() => {
    let payload;
    try {
      payload = JSON.parse(debouncedScopeCountPayloadKey);
    } catch {
      setFinalScopeCount(0);
      setFinalScopeCountLoading(false);
      setFinalScopeCountError(null);
      return undefined;
    }

    if (!payload.manufacturers?.length) {
      setFinalScopeCount(0);
      setFinalScopeCountLoading(false);
      setFinalScopeCountError(null);
      return undefined;
    }

    let cancelled = false;
    setFinalScopeCountLoading(true);
    setFinalScopeCountError(null);

    integrationApi.countProductScope(payload)
      .then((response) => {
        if (cancelled) return;
        const count = Number(response.data?.count);
        setFinalScopeCount(Number.isFinite(count) ? count : 0);
      })
      .catch((err) => {
        console.error('Product scope count failed', err);
        if (!cancelled) {
          setFinalScopeCountError(
            err.response?.data?.message || 'Failed to calculate applicable product count.',
          );
          setFinalScopeCount(0);
        }
      })
      .finally(() => {
        if (!cancelled) setFinalScopeCountLoading(false);
      });

    return () => { cancelled = true; };
  }, [debouncedScopeCountPayloadKey]);

  useLayoutEffect(() => {
    if (hasInitialized.current) return;

    const rules = state.productRules || EMPTY_RULES;
    if (hasSavedProductRules(rules)) {
      const mapped = mapSharedRulesToLocalState(rules);
      setSelectedManufacturers(mapped.selectedManufacturers);
      setSelectedDivisionIds(mapped.selectedDivisionIds);
      setSelectedDivisionMeta(mapped.selectedDivisionMeta || new Map());
      setDivisionOp(mapped.divisionOp);
      setProductOp(mapped.productOp);
      if (mapped.selectedDivisionIds.length) {
        pendingDivisionIdsRef.current = {
          ids: mapped.selectedDivisionIds,
          meta: mapped.selectedDivisionMeta,
        };
        suppressScopeResetRef.current = true;
      }
      if (mapped.selectedProductRuleIds.length) {
        pendingProductRuleIdsRef.current = {
          ids: mapped.selectedProductRuleIds,
          op: mapped.productOp,
          meta: mapped.selectedProductMeta,
        };
      }
      if (mapped.selectedManufacturers.length) {
        suppressScopeResetRef.current = true;
      }
      setManufacturerOptions(mapped.selectedManufacturers);
    }

    hasInitialized.current = true;
    emitReadyRef.current = true;
    lastEmittedProductRulesRef.current = serializeProductRulesPatch({
      manufacturers: state.productRules?.manufacturers ?? [],
      manufacturerOptions: state.productRules?.manufacturerOptions ?? [],
      divisionRules: state.productRules?.divisionRules ?? [],
      productRules: state.productRules?.productRules ?? [],
    });
  }, [state.productRules]);

  useEffect(() => {
    if (!emitReadyRef.current) return;
    if (
      suppressScopeResetRef.current
      && !explicitDivisionRules.length
      && (state.productRules?.divisionRules?.length ?? 0) > 0
    ) {
      return;
    }

    const patch = {
      manufacturers: selectedManufacturerIds,
      manufacturerOptions: selectedManufacturers.map((manufacturer) => ({
        id: manufacturer.id,
        manufacturerName: manufacturer.manufacturerName,
      })),
      divisionRules: explicitDivisionRules,
      productRules: explicitProductRules,
    };
    const serialized = serializeProductRulesPatch(patch);
    if (lastEmittedProductRulesRef.current === serialized) {
      return;
    }
    lastEmittedProductRulesRef.current = serialized;
    updateProductRules(patch);
  }, [
    selectedManufacturerIds,
    selectedManufacturers,
    selectedDivisionIds,
    divisionOp,
    selectedDivisionMeta,
    explicitDivisionRules,
    explicitProductRules,
    updateProductRules,
  ]);

  const renderManufacturerOption = useCallback((option) => (
    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
      <Typography variant="body1" fontWeight={500}>
        {option.manufacturerName}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        ID: {option.id}
      </Typography>
    </Box>
  ), []);

  const handleManufacturersChange = useCallback((selected) => {
    const nextManufacturers = Array.isArray(selected) ? selected.map(normalizeManufacturer) : [];
    const nextManufacturerIdSet = new Set(
      nextManufacturers.map((manufacturer) => toNumericId(manufacturer.id)),
    );
    const removedManufacturerIdSet = new Set(
      selectedManufacturers
        .map((manufacturer) => toNumericId(manufacturer.id))
        .filter((id) => !nextManufacturerIdSet.has(id)),
    );

    suppressScopeResetRef.current = false;
    pendingDivisionIdsRef.current = null;
    setSelectedManufacturers(nextManufacturers);
    setDivisionPage(0);
    setProductPage(0);

    if (!nextManufacturers.length) {
      setSelectedDivisionIds([]);
      setSelectedDivisionMeta(new Map());
      setSelectedProductRuleIds([]);
      setSelectedProductMeta(new Map());
      return;
    }

    if (!removedManufacturerIdSet.size) {
      return;
    }

    const belongsToRemovedManufacturer = (meta) =>
      meta != null && removedManufacturerIdSet.has(toNumericId(meta.manufacturerId));

    setSelectedDivisionIds((prev) =>
      prev.filter((id) => !belongsToRemovedManufacturer(selectedDivisionMeta.get(toNumericId(id)))));
    setSelectedDivisionMeta((prev) => {
      const next = new Map();
      prev.forEach((meta, id) => {
        if (!belongsToRemovedManufacturer(meta)) next.set(id, meta);
      });
      return next;
    });
    setSelectedProductRuleIds((prev) =>
      prev.filter((id) => !belongsToRemovedManufacturer(selectedProductMeta.get(id))));
    setSelectedProductMeta((prev) => {
      const next = new Map();
      prev.forEach((meta, id) => {
        if (!belongsToRemovedManufacturer(meta)) next.set(id, meta);
      });
      return next;
    });
  }, [selectedManufacturers, selectedDivisionMeta, selectedProductMeta]);

  const handleManufacturerSearch = useCallback((query) => {
    setManufSearchText(query);
  }, []);

  const toggleDivision = useCallback((division) => {
    const id = toNumericId(division.id);
    setSelectedDivisionIds((prev) =>
      prev.includes(id) ? prev.filter((divisionId) => divisionId !== id) : [...prev, id],
    );
    setSelectedDivisionMeta((prev) => {
      const next = new Map(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.set(id, {
          id,
          divisionName: division.divisionName,
          manufacturerId: division.manufacturerId,
        });
      }
      return next;
    });
  }, []);

  const toggleProductRule = useCallback((product) => {
    const id = product.id;
    setSelectedProductRuleIds((prev) =>
      prev.includes(id) ? prev.filter((productId) => productId !== id) : [...prev, id],
    );
    setSelectedProductMeta((prev) => {
      const next = new Map(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.set(id, {
          id,
          productName: product.productName,
          divisionId: toNumericId(product.divisionId),
          manufacturerId: toNumericId(product.manufacturerId),
        });
      }
      return next;
    });
  }, []);

  return (
    <Box>
      <WizardSectionTitle title="Applicable Products" info={sectionInfo} mb={1} />
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {finalScopeCountLoading
          ? 'Calculating final scope…'
          : `Final scope: ${finalScopeCount} applicable product${finalScopeCount === 1 ? '' : 's'}`}
      </Typography>
      {finalScopeCountError && (
        <Alert severity="warning" sx={{ mb: 2 }} onClose={() => setFinalScopeCountError(null)}>
          {finalScopeCountError}
        </Alert>
      )}

      {fetchError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setFetchError(null)}>{fetchError}</Alert>
      )}
      {manufacturerSearchError && (
        <Alert severity="warning" sx={{ mb: 2 }} onClose={() => setManufacturerSearchError(null)}>
          {manufacturerSearchError}
        </Alert>
      )}

      <WizardFieldAnchor field="products" error={error}>
        <Box sx={{
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          gap: 2,
          width: '100%',
          alignItems: 'stretch',
        }}
        >
          <Paper elevation={0} sx={columnPaperSx}>
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
              1. Select Manufacturers
            </Typography>
            <SearchableSelect
              placeholder="Search manufacturers…"
              isMulti
              options={limitedManufacturerOptions}
              value={selectedManufacturers}
              onChange={handleManufacturersChange}
              onSearch={handleManufacturerSearch}
              loading={manufacturerSearchLoading}
              getOptionLabel={(option) => `${option.manufacturerName || ''} (ID: ${option.id})`}
              renderOption={renderManufacturerOption}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              maxVisibleChips={2}
            />
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
              {hasMoreManufacturerOptions
                ? `Showing first ${MANUFACTURER_DROPDOWN_LIMIT} of ${manufacturerOptions.length} matches`
                : selectedManufacturers.length
                  ? `${selectedManufacturers.length} selected`
                  : 'Type to search manufacturers'}
            </Typography>
          </Paper>

          <Paper elevation={0} sx={columnPaperSx}>
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
              2. Select Divisions ({selectedDivisionIds.length})
            </Typography>
            <FormControl size="small" sx={{ ...ruleSelectSx, mb: 1 }} disabled={!hasManufacturerFilter}>
              <Select value={divisionOp} onChange={(event) => setDivisionOp(event.target.value)}>
                <MenuItem value="INCLUDE">Rule: Include Selected</MenuItem>
                <MenuItem value="EXCLUDE">Rule: Exclude Selected</MenuItem>
              </Select>
            </FormControl>
            <TextField
              size="small"
              variant="outlined"
              placeholder="Search divisions by name or ID…"
              value={divisionSearchText}
              onChange={(event) => setDivisionSearchText(event.target.value)}
              fullWidth
              disabled={!hasManufacturerFilter}
              sx={{ mb: 1 }}
            />
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}>
              <Button
                size="small"
                variant="text"
                sx={headerActionButtonSx}
                onClick={() => {
                  setSelectedDivisionIds([]);
                  setSelectedDivisionMeta(new Map());
                }}
                disabled={!selectedDivisionIds.length}
              >
                Clear All
              </Button>
            </Box>
            {divisionLoading ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 2 }}>
                <CircularProgress size={16} />
                <Typography variant="body2" color="text.secondary">Loading divisions…</Typography>
              </Box>
            ) : !hasManufacturerFilter ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 4 }}>
                <AccountTreeOutlined sx={{ fontSize: 36, color: 'text.disabled', mb: 1 }} />
                <Typography variant="body2" color="text.secondary" align="center">
                  Select manufacturer(s) first
                </Typography>
              </Box>
            ) : divisionListItems.length === 0 && selectedDivisionIds.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                No divisions match search
              </Typography>
            ) : (
              <ScrollableCheckboxList
                items={displayDivisionItems}
                getItemId={(division) => division.id}
                getItemLabel={formatDivisionLabel}
                selectedIds={selectedDivisionIds}
                onToggle={toggleDivision}
              />
            )}
            <TablePagination
              component="div"
              count={divisionTotalCount}
              page={divisionPage}
              onPageChange={(_, newPage) => setDivisionPage(newPage)}
              rowsPerPage={divisionRowsPerPage}
              onRowsPerPageChange={(event) => {
                setDivisionRowsPerPage(parseInt(event.target.value, 10));
                setDivisionPage(0);
              }}
              rowsPerPageOptions={[10, 25, 50]}
              sx={{ borderTop: `1px solid ${BRAND.borderLight}`, mt: 'auto' }}
            />
          </Paper>

          <Paper elevation={0} sx={columnPaperSx}>
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
              3. Product Exceptions ({selectedProductRuleIds.length})
            </Typography>
            <FormControl size="small" sx={{ ...ruleSelectSx, mb: 1 }} disabled={!hasProductScope}>
              <Select
                value={productOp}
                onChange={(event) => setProductOp(event.target.value)}
              >
                <MenuItem value="INCLUDE">Rule: Include Selected</MenuItem>
                <MenuItem value="EXCLUDE">Rule: Exclude Selected</MenuItem>
              </Select>
            </FormControl>
            <TextField
              size="small"
              variant="outlined"
              placeholder="Search products by name or ID…"
              value={productRuleSearchText}
              onChange={(event) => setProductRuleSearchText(event.target.value)}
              fullWidth
              disabled={!hasProductScope}
              sx={{ mb: 1 }}
            />
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}>
              <Button
                size="small"
                variant="text"
                sx={headerActionButtonSx}
                onClick={() => {
                  setSelectedProductRuleIds([]);
                  setSelectedProductMeta(new Map());
                }}
                disabled={!selectedProductRuleIds.length}
              >
                Clear All
              </Button>
            </Box>
            {productLoading ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 2 }}>
                <CircularProgress size={16} />
                <Typography variant="body2" color="text.secondary">Loading products…</Typography>
              </Box>
            ) : !hasProductScope ? (
              <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                Select manufacturer(s) to load products
              </Typography>
            ) : productListItems.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                No products match search
              </Typography>
            ) : (
              <ScrollableCheckboxList
                items={productListItems}
                getItemId={(product) => product.id}
                getItemLabel={formatProductLabel}
                selectedIds={selectedProductRuleIds}
                onToggle={toggleProductRule}
              />
            )}
            <TablePagination
              component="div"
              count={productTotalCount}
              page={productPage}
              onPageChange={(_, newPage) => setProductPage(newPage)}
              rowsPerPage={productRowsPerPage}
              onRowsPerPageChange={(event) => {
                setProductRowsPerPage(parseInt(event.target.value, 10));
                setProductPage(0);
              }}
              rowsPerPageOptions={[10, 25, 50]}
              sx={{ borderTop: `1px solid ${BRAND.borderLight}`, mt: 'auto' }}
            />
          </Paper>
        </Box>
      </WizardFieldAnchor>
    </Box>
  );
}
