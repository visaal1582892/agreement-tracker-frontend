import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box, Typography, Grid, FormControl, Select, MenuItem, TextField,
  FormGroup, FormControlLabel, Checkbox, Chip, Button, Alert, CircularProgress,
} from '@mui/material';
import { AccountTreeOutlined } from '@mui/icons-material';
import axiosInstance from '../../../api/axiosInstance';
import { ENDPOINTS } from '../../../config/endpoints';
import { BRAND } from '../../../config/theme';
import SearchableSelect from '../../../components/forms/SearchableSelect';
import WizardSectionTitle from '../../../components/wizard/WizardSectionTitle';
import WizardFieldAnchor from '../../../components/wizard/WizardFieldAnchor';

const panelSx = {
  border: `1px solid ${BRAND.borderLight}`,
  borderRadius: '10px',
  bgcolor: BRAND.white,
  p: 2,
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
};

const listSx = {
  flex: 1,
  mt: 1,
  overflowY: 'auto',
  maxHeight: 320,
};

const panelHeaderSx = {
  display: 'flex',
  flexDirection: 'column',
  gap: 1,
  mb: 1,
  minHeight: 88,
};

const panelHeaderTitleRowSx = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 1,
};

const panelHeaderActionsRowSx = {
  display: 'flex',
  gap: 1.5,
  alignItems: 'center',
};

const ruleSelectSx = {
  minWidth: 200,
  flexShrink: 0,
};

const headerActionButtonSx = {
  minWidth: 0,
  px: 0.5,
  fontSize: '0.72rem',
};

const EMPTY_RULES = { manufacturers: [], divisionRules: [], productRules: [] };

function divisionsFromPool(products) {
  const map = new Map();
  products.forEach((p) => {
    if (p.divisionId && !map.has(p.divisionId)) {
      map.set(p.divisionId, { id: p.divisionId, divisionName: p.divisionName });
    }
  });
  return Array.from(map.values());
}

function manufacturerPool(products, selectedManufacturers) {
  if (!selectedManufacturers.length) return products;
  const mfrIds = new Set(selectedManufacturers.map((m) => m.id));
  return products.filter((p) => mfrIds.has(p.manufacturerId));
}

/** Live intersection: catalog → optional mfr → optional divisions. */
export function computeVisibleProducts(
  productCatalog,
  selectedManufacturers,
  selectedDivisionIds,
  divisionOp,
) {
  if (!productCatalog.length) return [];

  const hasMfr = selectedManufacturers.length > 0;
  let pool = productCatalog;

  if (hasMfr) {
    pool = manufacturerPool(productCatalog, selectedManufacturers);
    if (!selectedDivisionIds.length) return [];
    if (divisionOp === 'INCLUDE') {
      return pool.filter((p) => selectedDivisionIds.includes(p.divisionId));
    }
    return pool.filter((p) => !selectedDivisionIds.includes(p.divisionId));
  }

  return pool;
}

export function hasSavedProductRules(rules = {}) {
  return Boolean(
    rules.manufacturers?.length ||
    rules.divisionRules?.length ||
    rules.productRules?.length,
  );
}

/** Map backend/wizard rule arrays into Step2Products local state shape. */
export function mapSharedRulesToLocalState(rules, productCatalog, manufacturerOptions) {
  const seedMfrs = manufacturerOptions.filter((m) =>
    (rules.manufacturers || []).includes(m.id),
  );
  const mfrPool = seedMfrs.length
    ? manufacturerPool(productCatalog, seedMfrs)
    : productCatalog;

  const next = {
    selectedManufacturers: seedMfrs,
    selectedDivisionIds: [],
    checkedProductIds: [],
    divisionOp: 'INCLUDE',
    productOp: 'INCLUDE',
    prevAvailableDivisionIds: [],
    prevVisibleProductIds: [],
  };

  if (rules.divisionRules?.length) {
    next.divisionOp = rules.divisionRules[0].ruleType || 'INCLUDE';
    next.selectedDivisionIds = rules.divisionRules.map((r) => r.id);
    next.prevAvailableDivisionIds = divisionsFromPool(mfrPool).map((d) => d.id);
  }

  if (rules.productRules?.length) {
    next.productOp = rules.productRules[0].ruleType || 'INCLUDE';
    next.checkedProductIds = rules.productRules.map((r) => r.id);
    next.prevVisibleProductIds = next.checkedProductIds;
  }

  return next;
}

function countedLabel(base, count) {
  return `${base} (${count})`;
}

export default function Step2Products({ state, updateProductRules, info, error }) {
  const [productCatalog, setProductCatalog] = useState([]);
  const [manufacturerOptions, setManufacturerOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [selectedManufacturers, setSelectedManufacturers] = useState([]);
  const [selectedDivisionIds, setSelectedDivisionIds] = useState([]);
  const [checkedProductIds, setCheckedProductIds] = useState([]);
  const [divisionOp, setDivisionOp] = useState('INCLUDE');
  const [productOp, setProductOp] = useState('INCLUDE');
  const [productSearchTerm, setProductSearchTerm] = useState('');

  const hasInitialized = useRef(false);
  const emitReadyRef = useRef(false);
  const skipDivisionAutoSelectRef = useRef(false);
  const skipProductAutoSelectRef = useRef(false);
  const prevAvailableDivisionIdsRef = useRef([]);
  const prevVisibleProductIdsRef = useRef([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFetchError(null);

    Promise.all([
      axiosInstance.get(ENDPOINTS.PRODUCTS),
      axiosInstance.get(ENDPOINTS.MANUFACTURERS),
    ])
      .then(([productsResponse, manufacturersResponse]) => {
        if (cancelled) return;
        setProductCatalog(Array.isArray(productsResponse.data) ? productsResponse.data : []);
        setManufacturerOptions(Array.isArray(manufacturersResponse.data) ? manufacturersResponse.data : []);
      })
      .catch((err) => {
        console.error('Failed to load product catalog:', err);
        if (!cancelled) {
          setFetchError(err.response?.data?.message || 'Failed to load product catalog.');
          setProductCatalog([]);
          setManufacturerOptions([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, []);

  const hasManufacturerFilter = selectedManufacturers.length > 0;

  const availableDivisions = useMemo(() => {
    if (!hasManufacturerFilter || !productCatalog.length) return [];
    return divisionsFromPool(manufacturerPool(productCatalog, selectedManufacturers));
  }, [productCatalog, selectedManufacturers, hasManufacturerFilter]);

  const visibleProducts = useMemo(
    () => computeVisibleProducts(
      productCatalog,
      selectedManufacturers,
      selectedDivisionIds,
      divisionOp,
    ),
    [productCatalog, selectedManufacturers, selectedDivisionIds, divisionOp],
  );

  // Rehydrate from saved rules once catalog is ready.
  useEffect(() => {
    if (!productCatalog.length || !manufacturerOptions.length || hasInitialized.current) return;

    hasInitialized.current = true;
    const rules = state.productRules || EMPTY_RULES;

    if (hasSavedProductRules(rules)) {
      const mapped = mapSharedRulesToLocalState(rules, productCatalog, manufacturerOptions);
      skipDivisionAutoSelectRef.current = Boolean(rules.divisionRules?.length);
      skipProductAutoSelectRef.current = Boolean(rules.productRules?.length);
      setSelectedManufacturers(mapped.selectedManufacturers);
      setSelectedDivisionIds(mapped.selectedDivisionIds);
      setCheckedProductIds(mapped.checkedProductIds);
      setDivisionOp(mapped.divisionOp);
      setProductOp(mapped.productOp);
      prevAvailableDivisionIdsRef.current = mapped.prevAvailableDivisionIds;
      prevVisibleProductIdsRef.current = mapped.prevVisibleProductIds;
    } else {
      const allProductIds = productCatalog.map((p) => p.id);
      setCheckedProductIds(allProductIds);
      prevVisibleProductIdsRef.current = allProductIds;
    }

    emitReadyRef.current = true;
  }, [productCatalog, manufacturerOptions, state.productRules]);

  // When vendor catalog expands, auto-select new divisions + products for active manufacturers.
  useEffect(() => {
    if (!hasInitialized.current || skipDivisionAutoSelectRef.current || !hasManufacturerFilter) {
      return;
    }

    const availableIds = availableDivisions.map((d) => d.id);
    const prevAvailable = prevAvailableDivisionIdsRef.current;
    const catalogExpanded = availableIds.some((id) => !prevAvailable.includes(id));

    if (!catalogExpanded || !availableIds.length) return;

    setSelectedDivisionIds(availableIds);
    prevAvailableDivisionIdsRef.current = availableIds;

    const allProductIds = computeVisibleProducts(
      productCatalog,
      selectedManufacturers,
      availableIds,
      divisionOp,
    ).map((p) => p.id);
    setCheckedProductIds(allProductIds);
    prevVisibleProductIdsRef.current = allProductIds;
  }, [availableDivisions, hasManufacturerFilter, productCatalog, selectedManufacturers, divisionOp]);

  // Auto-select / prune products to match live visible intersection.
  useEffect(() => {
    if (!hasInitialized.current) return;

    if (skipProductAutoSelectRef.current) {
      const visibleIds = visibleProducts.map((p) => p.id);
      setCheckedProductIds((prev) => prev.filter((id) => visibleIds.includes(id)));
      prevVisibleProductIdsRef.current = visibleIds;
      skipProductAutoSelectRef.current = false;
      return;
    }

    const visibleIds = visibleProducts.map((p) => p.id);
    if (!visibleIds.length) {
      setCheckedProductIds([]);
      prevVisibleProductIdsRef.current = [];
      return;
    }

    setCheckedProductIds(visibleIds);
    prevVisibleProductIdsRef.current = visibleIds;
  }, [visibleProducts]);

  // Sync selections to wizard payload — prune orphans on every emit.
  useEffect(() => {
    if (!emitReadyRef.current) return;

    const visibleIdSet = new Set(visibleProducts.map((p) => p.id));
    const prunedProductIds = checkedProductIds.filter((id) => visibleIdSet.has(id));
    const availableDivisionIdSet = new Set(availableDivisions.map((d) => d.id));
    const prunedDivisionIds = selectedDivisionIds.filter((id) => availableDivisionIdSet.has(id));

    updateProductRules({
      manufacturers: selectedManufacturers.map((m) => m.id),
      divisionRules: prunedDivisionIds.map((id) => ({ id, ruleType: divisionOp })),
      productRules: prunedProductIds.map((id) => ({ id, ruleType: productOp })),
    });
  }, [
    selectedManufacturers,
    selectedDivisionIds,
    divisionOp,
    checkedProductIds,
    productOp,
    visibleProducts,
    availableDivisions,
    updateProductRules,
  ]);

  const handleManufacturersChange = useCallback((selected) => {
    const next = Array.isArray(selected) ? selected : [];
    setSelectedManufacturers(next);

    if (!next.length) {
      const allProductIds = productCatalog.map((p) => p.id);
      setSelectedDivisionIds([]);
      setCheckedProductIds(allProductIds);
      prevAvailableDivisionIdsRef.current = [];
      prevVisibleProductIdsRef.current = allProductIds;
      return;
    }

    const mfrPool = manufacturerPool(productCatalog, next);
    const allDivisionIds = divisionsFromPool(mfrPool).map((d) => d.id);
    const allProductIds = computeVisibleProducts(
      productCatalog,
      next,
      allDivisionIds,
      divisionOp,
    ).map((p) => p.id);

    setSelectedDivisionIds(allDivisionIds);
    setCheckedProductIds(allProductIds);
    prevAvailableDivisionIdsRef.current = allDivisionIds;
    prevVisibleProductIdsRef.current = allProductIds;
  }, [productCatalog, divisionOp]);

  const toggleDivision = (id) => {
    setSelectedDivisionIds((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id],
    );
  };

  const toggleProduct = (id) => {
    setCheckedProductIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );
  };

  const selectAllDivisions = () => setSelectedDivisionIds(availableDivisions.map((d) => d.id));
  const deselectAllDivisions = () => setSelectedDivisionIds([]);

  const filteredProducts = useMemo(() => {
    const term = productSearchTerm.toLowerCase();
    if (!term) return visibleProducts;
    return visibleProducts.filter((p) =>
      (p.productName || '').toLowerCase().includes(term),
    );
  }, [visibleProducts, productSearchTerm]);

  const selectAllProducts = () => {
    const filteredIds = filteredProducts.map((p) => p.id);
    setCheckedProductIds((prev) => [...new Set([...prev, ...filteredIds])]);
  };
  const deselectAllProducts = () => setCheckedProductIds([]);

  const productsByDivision = filteredProducts.reduce((acc, p) => {
    const key = p.divisionName || 'Other';
    if (!acc[key]) acc[key] = [];
    acc[key].push(p);
    return acc;
  }, {});

  const resolvedProductIds = productOp === 'INCLUDE'
    ? checkedProductIds.filter((id) => visibleProducts.some((p) => p.id === id))
    : visibleProducts.filter((p) => !checkedProductIds.includes(p.id)).map((p) => p.id);

  const selectedProductChips = visibleProducts.filter((p) => resolvedProductIds.includes(p.id));

  const sectionInfo = info ?? 'Add manufacturers to narrow divisions and products. Without manufacturers, all active products are in scope.';

  return (
    <Box>
      <WizardSectionTitle
        title="Applicable Products"
        info={sectionInfo}
        mb={2}
      />

      {fetchError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setFetchError(null)}>{fetchError}</Alert>
      )}
      {loading && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <CircularProgress size={18} />
          <Typography variant="body2" color="text.secondary">Loading product catalog…</Typography>
        </Box>
      )}

      <WizardFieldAnchor field="products" error={error}>
      <Grid container spacing={2.5} sx={{ alignItems: 'flex-start' }}>
        <Grid size={{ xs: 12, md: 4 }}>
          <Box sx={panelSx}>
            <Box sx={panelHeaderSx}>
              <Box sx={panelHeaderTitleRowSx}>
                <Typography variant="h6" fontWeight={700}>
                  {countedLabel('Manufacturers', selectedManufacturers.length)}
                </Typography>
              </Box>
              <SearchableSelect
                placeholder="Filter by manufacturer…"
                isMulti
                options={manufacturerOptions}
                value={selectedManufacturers}
                onChange={handleManufacturersChange}
                getOptionLabel={(o) => o.manufacturerName || ''}
                isOptionEqualToValue={(o, v) => o.id === v.id}
                disabled={!productCatalog.length || loading}
                maxVisibleChips={2}
              />
              <Typography variant="caption" color="text.secondary">
                {selectedManufacturers.length
                  ? `${selectedManufacturers.length} manufacturer(s) active`
                  : `All ${productCatalog.length} active product(s) in scope`}
              </Typography>
            </Box>
          </Box>
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <Box sx={panelSx}>
            <Box sx={panelHeaderSx}>
              <Box sx={panelHeaderTitleRowSx}>
                <Typography variant="h6" fontWeight={700}>
                  {countedLabel('Divisions', selectedDivisionIds.length)}
                </Typography>
                <FormControl size="small" sx={ruleSelectSx} disabled={!hasManufacturerFilter}>
                  <Select value={divisionOp} onChange={(e) => setDivisionOp(e.target.value)}>
                    <MenuItem value="INCLUDE">Rule: Include Selected</MenuItem>
                    <MenuItem value="EXCLUDE">Rule: Exclude Selected</MenuItem>
                  </Select>
                </FormControl>
              </Box>
              <Box sx={{ flex: 1, minHeight: 40 }} />
              <Box sx={panelHeaderActionsRowSx}>
                <Button
                  size="small"
                  variant="text"
                  sx={headerActionButtonSx}
                  onClick={selectAllDivisions}
                  disabled={!hasManufacturerFilter || !availableDivisions.length}
                >
                  Select All
                </Button>
                <Button
                  size="small"
                  variant="text"
                  sx={headerActionButtonSx}
                  onClick={deselectAllDivisions}
                  disabled={!hasManufacturerFilter || !availableDivisions.length}
                >
                  Clear All
                </Button>
              </Box>
            </Box>
            <Box sx={listSx}>
              {!hasManufacturerFilter ? (
                <Box
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    py: 4,
                    flex: 1,
                  }}
                >
                  <AccountTreeOutlined sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
                  <Typography variant="body2" color="text.secondary" align="center">
                    Select manufacturer(s) to view divisions
                  </Typography>
                </Box>
              ) : availableDivisions.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
                  No divisions for selected manufacturers
                </Typography>
              ) : (
                <FormGroup>
                  {availableDivisions.map((d) => (
                    <FormControlLabel
                      key={d.id}
                      control={
                        <Checkbox
                          checked={selectedDivisionIds.includes(d.id)}
                          onChange={() => toggleDivision(d.id)}
                          size="small"
                        />
                      }
                      label={<Typography variant="body2">{d.divisionName}</Typography>}
                    />
                  ))}
                </FormGroup>
              )}
            </Box>
          </Box>
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <Box sx={panelSx}>
            <Box sx={panelHeaderSx}>
              <Box sx={panelHeaderTitleRowSx}>
                <Typography variant="h6" fontWeight={700}>
                  {countedLabel('Products', resolvedProductIds.length)}
                </Typography>
                <FormControl size="small" sx={ruleSelectSx}>
                  <Select value={productOp} onChange={(e) => setProductOp(e.target.value)}>
                    <MenuItem value="INCLUDE">Rule: Include Selected</MenuItem>
                    <MenuItem value="EXCLUDE">Rule: Exclude Selected</MenuItem>
                  </Select>
                </FormControl>
              </Box>
              <TextField
                size="small"
                variant="outlined"
                placeholder="Search products..."
                value={productSearchTerm}
                onChange={(e) => setProductSearchTerm(e.target.value)}
                fullWidth
                sx={{ mb: 0.5 }}
              />
              <Box sx={panelHeaderActionsRowSx}>
                <Button
                  size="small"
                  variant="text"
                  sx={headerActionButtonSx}
                  onClick={selectAllProducts}
                  disabled={!filteredProducts.length}
                >
                  Select All
                </Button>
                <Button
                  size="small"
                  variant="text"
                  sx={headerActionButtonSx}
                  onClick={deselectAllProducts}
                  disabled={!visibleProducts.length}
                >
                  Clear All
                </Button>
              </Box>
            </Box>
            <Box sx={listSx}>
              {visibleProducts.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
                  {!productCatalog.length
                    ? 'No products loaded'
                    : hasManufacturerFilter && !selectedDivisionIds.length
                      ? 'Select manufacturer(s) — divisions will auto-select'
                      : 'No products match current filters'}
                </Typography>
              ) : filteredProducts.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
                  No products match your search
                </Typography>
              ) : (
                Object.entries(productsByDivision).map(([divName, prods]) => (
                  <Box key={divName} mb={1.5}>
                    <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ display: 'block', mb: 0.5 }}>
                      {divName}
                    </Typography>
                    <FormGroup>
                      {prods.map((p) => (
                        <FormControlLabel
                          key={p.id}
                          control={
                            <Checkbox
                              checked={checkedProductIds.includes(p.id)}
                              onChange={() => toggleProduct(p.id)}
                              size="small"
                            />
                          }
                          label={<Typography variant="body2">{p.productName}</Typography>}
                        />
                      ))}
                    </FormGroup>
                  </Box>
                ))
              )}
            </Box>
          </Box>
        </Grid>
      </Grid>
      </WizardFieldAnchor>

      <Box sx={{ mt: 2.5, p: 2, borderRadius: '10px', border: `1px solid ${BRAND.borderLight}`, bgcolor: BRAND.bgGray }}>
        <Typography variant="caption" color="text.secondary" fontWeight={600}>
          {resolvedProductIds.length} product(s) selected
          {productOp === 'EXCLUDE' ? ' (exclude mode — unchecked items kept)' : ''}
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 1 }}>
          {selectedProductChips.map((p) => (
            <Chip
              key={p.id}
              label={p.productName}
              size="small"
              onDelete={() => {
                if (productOp === 'INCLUDE') {
                  toggleProduct(p.id);
                } else {
                  setCheckedProductIds((prev) => [...prev, p.id]);
                }
              }}
            />
          ))}
        </Box>
      </Box>
    </Box>
  );
}
