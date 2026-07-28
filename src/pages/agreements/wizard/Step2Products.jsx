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

export function mapSharedRulesToLocalState(rules) {
  const seedMfrs = (
    rules.manufacturerOptions?.length
      ? rules.manufacturerOptions
      : (rules.manufacturers || rules.manufacturerIds || []).map((id) =>
          typeof id === 'object' ? id : { id, manufacturerName: '' }
        )
  ).map(normalizeManufacturer);
  const rawDivisions = rules.divisionRules || rules.divisionIds || rules.divisions || [];
  const rawProducts = rules.productRules || rules.productIds || rules.products || [];
  const normalizedDivisions = normalizeExplicitScopeRules(rawDivisions, 'INCLUDE');
  const normalizedProducts = normalizeExplicitScopeRules(rawProducts, 'EXCLUDE');

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
  // Guards the emitting effect from wiping parent state during mount/hydration
  const userInteractedRef = useRef(false);
  const emitReadyRef = useRef(false);
  const lastEmittedProductRulesRef = useRef(null);
  const suppressScopeResetRef = useRef(false);
  const pendingDivisionIdsRef = useRef(null);
  const pendingProductRuleIdsRef = useRef(null);
  const prevScopedDivisionKeyRef = useRef('');
  const selectedProductMetaRef = useRef(selectedProductMeta);
  // Prevents the "search empty → clear manufacturerOptions" effect from running right
  // after hydration seeds the options (search box is empty but we want to keep the chips).
  const skipManufacturerOptionsResetRef = useRef(false);
  // Holds the manufacturer IDs seeded at hydration time so division/product loads fire
  // immediately without waiting for the 800 ms selectedManufacturerIds debounce.
  const [hydratedManufacturerIds, setHydratedManufacturerIds] = useState([]);
  const hydratedManufacturerIdsRef = useRef([]);

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

  const hasManufacturerFilter = selectedManufacturers.length > 0;
  const hasProductScope = hasManufacturerFilter;
  const sectionInfo = info ?? 'Search manufacturers to load products. Optionally narrow by divisions or explicit product rules.';

  useEffect(() => {
    const trimmedSearch = debouncedManufSearch.trim();
    if (!trimmedSearch) {
      if (skipManufacturerOptionsResetRef.current) {
        skipManufacturerOptionsResetRef.current = false;
        return undefined;
      }
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
    // Use hydrated IDs immediately (bypassing the 800 ms debounce) on initial mount.
    const effectiveManufs = hydratedManufacturerIdsRef.current.length
      ? hydratedManufacturerIdsRef.current
      : (hydratedManufacturerIds.length ? hydratedManufacturerIds : debouncedSelectedManufs);
    if (!effectiveManufs.length) {
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
    integrationApi.getDivisions({ manufacturerIds: effectiveManufs.map(toNumericId) })
      .then((response) => {
        if (cancelled) return;
        const { content } = unwrapPaginatedResponse(response.data);
        const ids = content.map((division) => toNumericId(division.id));
        setAllScopeDivisionIds(ids);

        if (pendingDivisionIdsRef.current) {
          const { ids: pendingIds, meta } = pendingDivisionIdsRef.current;
          pendingDivisionIdsRef.current = null;
          const validIds = pendingIds.map((id) => toNumericId(id));
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
  }, [debouncedSelectedManufs, hydratedManufacturerIds]);

  // Once the debounce settles with real values, let it take over from the hydrated snapshot.
  useEffect(() => {
    if (debouncedSelectedManufs.length && hydratedManufacturerIds.length) {
      setHydratedManufacturerIds([]);
      hydratedManufacturerIdsRef.current = [];
    }
  }, [debouncedSelectedManufs, hydratedManufacturerIds]);

  useEffect(() => {
    const effectiveManufs = hydratedManufacturerIdsRef.current.length
      ? hydratedManufacturerIdsRef.current
      : (hydratedManufacturerIds.length ? hydratedManufacturerIds : debouncedSelectedManufs);
    if (!effectiveManufs.length) {
      setDivisionListItems([]);
      setDivisionTotalCount(0);
      return undefined;
    }

    let cancelled = false;
    setDivisionLoading(true);
    setFetchError(null);

    integrationApi.getDivisions({
      manufacturerIds: effectiveManufs.map(toNumericId),
      searchKey: debouncedDivisionSearch,
      page: divisionPage,
      size: divisionRowsPerPage,
      pinnedDivisionIds: selectedDivisionIds,
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
    hydratedManufacturerIds,
    debouncedDivisionSearch,
    divisionPage,
    divisionRowsPerPage,
  ]);

  useEffect(() => {
    setDivisionPage(0);
  }, [debouncedDivisionSearch, debouncedSelectedManufs]);



  useEffect(() => {
    if (!hasProductScope) {
      setProductListItems([]);
      setProductTotalCount(0);
      return undefined;
    }

    let cancelled = false;
    setProductLoading(true);
    setFetchError(null);

    const effectiveManufs = hydratedManufacturerIdsRef.current.length
      ? hydratedManufacturerIdsRef.current
      : (hydratedManufacturerIds.length ? hydratedManufacturerIds : debouncedSelectedManufs);
    integrationApi.searchProducts({
      searchKey: debouncedProductRuleSearch,
      manufacturerIds: effectiveManufs.map(toNumericId),
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
    hydratedManufacturerIds,
    productFilterDivisionKey,
    debouncedProductRuleSearch,
    productPage,
    productRowsPerPage,
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
    const rules = state.productRules || EMPTY_RULES;
    const hasRulesToHydrate = hasSavedProductRules(rules);

    // If we already hydrated populated data, DO NOT re-run.
    if (hasInitialized.current && selectedManufacturers.length > 0) return;
    // If we initialized empty and the incoming rules are STILL empty, DO NOT re-run.
    if (hasInitialized.current && !hasRulesToHydrate) return;

    if (hasRulesToHydrate) {
      const mapped = mapSharedRulesToLocalState(rules);
      setSelectedManufacturers(mapped.selectedManufacturers);
      setSelectedDivisionIds(mapped.selectedDivisionIds);
      setSelectedDivisionMeta(mapped.selectedDivisionMeta || new Map());
      setSelectedProductRuleIds(mapped.selectedProductRuleIds);
      setSelectedProductMeta(mapped.selectedProductMeta || new Map());
      setDivisionOp(mapped.divisionOp);
      setProductOp(mapped.productOp);

      // Fetch any missing manufacturer names from backend if hydrated with empty names
      const missingNameIds = mapped.selectedManufacturers
        .filter((m) => !m.manufacturerName || !m.manufacturerName.trim())
        .map((m) => toNumericId(m.id));
      if (missingNameIds.length > 0) {
        integrationApi.getManufacturersByIds(missingNameIds)
          .then((res) => {
            const list = Array.isArray(res.data) ? res.data : (res.data?.content || []);
            if (!list.length) return;
            const nameMap = new Map(list.map((m) => [toNumericId(m.id), m.manufacturerName || m.name || '']));
            setSelectedManufacturers((prev) => prev.map((m) => {
              const name = nameMap.get(toNumericId(m.id));
              return name ? { ...m, manufacturerName: name } : m;
            }));
            setManufacturerOptions((prev) => prev.map((m) => {
              const name = nameMap.get(toNumericId(m.id));
              return name ? { ...m, manufacturerName: name } : m;
            }));
          })
          .catch(() => {});
      }

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
        // Immediately provide manufacturer IDs to division/product effects so they
        // don't have to wait for the 800 ms selectedManufacturerIds debounce.
        const mfIds = mapped.selectedManufacturers.map((m) => toNumericId(m.id));
        hydratedManufacturerIdsRef.current = mfIds;
        setHydratedManufacturerIds(mfIds);
        // Prevent the "search box empty" effect from wiping these options on first render.
        skipManufacturerOptionsResetRef.current = true;
      }
      setManufacturerOptions(mapped.selectedManufacturers);

      hasInitialized.current = true;
      lastEmittedProductRulesRef.current = serializeProductRulesPatch({
        manufacturers: mapped.selectedManufacturers.map((m) => toNumericId(m.id)),
        manufacturerOptions: mapped.selectedManufacturers,
        divisionRules: rules.divisionRules ?? [],
        productRules: rules.productRules ?? [],
      });
    } else {
      hasInitialized.current = true;
    }
  }, [state.productRules]);

  useEffect(() => {
    // STRICT GUARD: Never emit to parent during initial mount or hydration!
    if (!userInteractedRef.current) return;

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
    userInteractedRef.current = true;
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
    setManufSearchText(query ?? '');
  }, []);


  const toggleDivision = useCallback((division) => {
    userInteractedRef.current = true;
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

    setSelectedProductRuleIds([]);
    setSelectedProductMeta(new Map());
    setProductPage(0);
  }, []);

  const toggleProductRule = useCallback((product) => {
    userInteractedRef.current = true;
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

  const combinedProductItems = useMemo(() => {
    const optionMap = new Map();
    (productListItems || []).forEach(p => optionMap.set(p.productId || p.id, p));
    (selectedProductRuleIds || []).forEach(id => {
      if (!optionMap.has(id)) {
        const meta = selectedProductMeta.get(id);
        if (meta) {
          optionMap.set(id, {
            id: meta.id,
            productId: meta.id,
            productName: meta.productName,
            divisionId: meta.divisionId,
            manufacturerId: meta.manufacturerId,
          });
        }
      }
    });
    return Array.from(optionMap.values());
  }, [productListItems, selectedProductRuleIds, selectedProductMeta]);

  const combinedDivisionItems = useMemo(() => {
    const optionMap = new Map();
    (divisionListItems || []).forEach((d) => optionMap.set(toNumericId(d.id), d));
    (selectedDivisionIds || []).forEach((id) => {
      const numericId = toNumericId(id);
      if (!optionMap.has(numericId)) {
        const meta = selectedDivisionMeta.get(numericId);
        if (meta) {
          optionMap.set(numericId, {
            id: meta.id,
            divisionName: meta.divisionName || `Division ${meta.id}`,
            manufacturerId: meta.manufacturerId,
          });
        }
      }
    });
    return Array.from(optionMap.values());
  }, [divisionListItems, selectedDivisionIds, selectedDivisionMeta]);

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
              isOptionEqualToValue={(option, value) => toNumericId(option.id) === toNumericId(value.id)}
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
              <Select value={divisionOp} onChange={(event) => {
                userInteractedRef.current = true;
                setDivisionOp(event.target.value);
                setSelectedProductRuleIds([]);
                setSelectedProductMeta(new Map());
                setProductPage(0);
              }}>
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
                  userInteractedRef.current = true;
                  setSelectedDivisionIds([]);
                  setSelectedDivisionMeta(new Map());
                  setSelectedProductRuleIds([]);
                  setSelectedProductMeta(new Map());
                  setProductPage(0);
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
                items={combinedDivisionItems}
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
                onChange={(event) => {
                  userInteractedRef.current = true;
                  setProductOp(event.target.value);
                }}
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
                  userInteractedRef.current = true;
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
            ) : combinedProductItems.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                No products match search
              </Typography>
            ) : (
              <ScrollableCheckboxList
                items={combinedProductItems}
                getItemId={(product) => product.productId || product.id || product.code}
                getItemLabel={(product) => product.productName || product.name || product.label || String(product.productId || product.id || product.code)}
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
