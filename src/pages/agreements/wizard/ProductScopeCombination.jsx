import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Button,
  Checkbox,
  CircularProgress,
  FormControl,
  FormControlLabel,
  FormLabel,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Paper,
  Radio,
  RadioGroup,
  TablePagination,
  TextField,
  Typography,
  Alert,
} from '@mui/material';
import { ExpandMore, ExpandLess, DeleteOutlineOutlined, SearchOff } from '@mui/icons-material';
import { DataGrid } from '@mui/x-data-grid';
import { integrationApi, unwrapPaginatedResponse } from '../../../api/integrationApi';
import { useDebounce } from '../../../hooks/useDebounce';
import { BRAND } from '../../../config/theme';
import UnifiedSelect from '../../../components/forms/UnifiedSelect';
import { READ_ONLY_PRODUCT_COLUMNS } from '../../../utils/productScopeUtils';

const PRODUCT_PAGE_SIZE_OPTIONS = [10, 25, 50];
const DIVISION_PAGE_SIZE_OPTIONS = [10, 25, 50];
const MANUFACTURER_DROPDOWN_LIMIT = 30;

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

function toNumericId(id) {
  if (id === null || id === undefined || id === '') return id;
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
    id: toNumericId(item.id || item.divisionId || item.manufacturerDivisionId),
    divisionId: toNumericId(item.divisionId || item.manufacturerDivisionId || item.id),
    divisionName: item.divisionName || item.manufactureDivisionName || item.name,
    manufacturerId: toNumericId(item.manufacturerId),
  };
}

function normalizeProduct(item) {
  return {
    id: item.id || item.productId || item.code,
    productId: item.productId,
    code: item.code,
    productCode: item.productCode || item.code,
    productName: item.productName || item.name,
    divisionId: item.divisionId,
    divisionName: item.divisionName,
    manufacturerId: item.manufacturerId,
    manufacturerName: item.manufacturerName,
  };
}

function formatDivisionLabel(division) {
  return `${division.divisionName} (ID: ${division.id})`;
}

function formatProductLabel(product) {
  return `${product.productName || product.name || ''} (ID: ${product.productId || product.id || product.code})`;
}

/** Single-checkbox list — rule type (INCLUDE/EXCLUDE) is controlled by the parent radio. */
function CheckboxList({ items, getItemId, getItemLabel, selectedIds, onToggle }) {
  return (
    <Box sx={scrollableListBoxSx}>
      <List dense>
        {items.map((item) => {
          const id = getItemId(item);
          const labelId = `checkbox-label-${id}`;
          const isChecked = selectedIds.some((sId) => toNumericId(sId) === toNumericId(id));
          return (
            <ListItem key={id} disablePadding dense>
              <ListItemButton role={undefined} dense onClick={() => onToggle(item)}>
                <Checkbox
                  edge="start"
                  checked={isChecked}
                  tabIndex={-1}
                  disableRipple
                  size="small"
                  slotProps={{ input: { 'aria-labelledby': labelId } }}
                />
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

function pinSelected(allItems, selectedIds, getItemId) {
  if (!selectedIds.length) return allItems;
  const selectedSet = new Set(selectedIds.map(toNumericId));
  const pinned = [];
  const rest = [];
  allItems.forEach((item) => {
    if (selectedSet.has(toNumericId(getItemId(item)))) pinned.push(item);
    else rest.push(item);
  });
  return [...pinned, ...rest];
}

/**
 * ProductScopeCombination — collapsible combination card:
 * Collapsed: compact summary header with manufacturer name + counts
 * Expanded: full three-column row [Manufacturer] | [Divisions] | [Products]
 *
 * Props:
 *   - expanded: current expanded state
 *   - onToggleExpanded: callback when user clicks to expand/collapse
 *   - combination, onChange, onRemove, canRemove
 */
export default function ProductScopeCombination({ combination, onChange, onRemove, canRemove, expanded, onToggleExpanded, selectedManufacturerIds = [] }) {
  const {
    id,
    manufacturerId,
    manufacturerName,
    divisionOp,
    selectedDivisionIds,
    productOp,
    selectedProductIds,
  } = combination;

  // --- Manufacturer state ---
  const [manufSearchText, setManufSearchText] = useState('');
  const [manufacturerOptions, setManufacturerOptions] = useState([]);
  const [manufacturerSearchLoading, setManufacturerSearchLoading] = useState(false);
  const [selectedManufacturer, setSelectedManufacturer] = useState(
    manufacturerId ? { id: manufacturerId, manufacturerName } : null
  );

  // --- Division state ---
  const [divisionSearchText, setDivisionSearchText] = useState('');
  const [divisionLoading, setDivisionLoading] = useState(false);
  const [allDivisions, setAllDivisions] = useState([]);
  const [divisionPage, setDivisionPage] = useState(0);
  const [divisionRowsPerPage, setDivisionRowsPerPage] = useState(10);

  // --- Product state ---
  const [productSearchText, setProductSearchText] = useState('');
  const [productListItems, setProductListItems] = useState([]);
  const [productTotalCount, setProductTotalCount] = useState(0);
  const [productPage, setProductPage] = useState(0);
  const [productRowsPerPage, setProductRowsPerPage] = useState(10);
  const [productLoading, setProductLoading] = useState(false);
  const [fetchError, setFetchError] = useState(null);

  // --- Debounced search values ---
  const debouncedManufSearch = useDebounce(manufSearchText, 500);
  const debouncedDivisionSearch = useDebounce(divisionSearchText, 400);
  const debouncedProductSearch = useDebounce(productSearchText, 400);

  // --- Sync selectedManufacturer with props on edit/hydration ---
  useEffect(() => {
    if (manufacturerId) {
      setSelectedManufacturer((prev) => {
        if (prev && toNumericId(prev.id) === toNumericId(manufacturerId) && prev.manufacturerName === manufacturerName) {
          return prev;
        }
        return { id: manufacturerId, manufacturerName: manufacturerName || prev?.manufacturerName || '' };
      });
    } else {
      setSelectedManufacturer(null);
    }
  }, [manufacturerId, manufacturerName]);

  // --- Derived gate values ---
  const hasManufacturer = !!selectedManufacturer;
  const selectedDivisionIdList = useMemo(
    () => (hasManufacturer ? selectedDivisionIds : []),
    [hasManufacturer, selectedDivisionIds]
  );
  const selectedProductIdList = useMemo(
    () => (hasManufacturer ? selectedProductIds : []),
    [hasManufacturer, selectedProductIds]
  );

  // === Filtered + paginated divisions (client-side) ===
  const filteredDivisions = useMemo(() => {
    const trimmed = debouncedDivisionSearch.trim().toLowerCase();
    if (!trimmed) return allDivisions;
    return allDivisions.filter((d) => {
      const name = (d.divisionName || '').toLowerCase();
      return name.includes(trimmed) || String(d.id).includes(trimmed);
    });
  }, [allDivisions, debouncedDivisionSearch]);

  const divisionListItems = useMemo(() => {
    const pinned = pinSelected(filteredDivisions, selectedDivisionIdList, (d) => d.id);
    const start = divisionPage * divisionRowsPerPage;
    return pinned.slice(start, start + divisionRowsPerPage);
  }, [filteredDivisions, divisionPage, divisionRowsPerPage, selectedDivisionIdList]);

  const divisionTotalCount = filteredDivisions.length;

  // === Product filter: respect division INCLUDE/EXCLUDE ===
  const productFilterDivisionIds = useMemo(() => {
    if (!selectedDivisionIdList.length) return [];
    if (divisionOp === 'INCLUDE') return selectedDivisionIdList;
    // EXCLUDE: compute complement
    const allDivisionIds = allDivisions.map((d) => toNumericId(d.id));
    return allDivisionIds.filter(
      (dId) => !selectedDivisionIdList.some((sId) => toNumericId(sId) === toNumericId(dId))
    );
  }, [allDivisions, selectedDivisionIdList, divisionOp]);

  // Stable key for product filter divisions (used in effect deps)
  const productFilterDivisionKey = productFilterDivisionIds.map(toNumericId).join(',');

  // === Manufacturer search ===
  useEffect(() => {
    const trimmed = debouncedManufSearch.trim();

    // Clear results whenever the query is blank or too short — prevents stale results
    if (!trimmed || trimmed.length < 3) {
      setManufacturerOptions([]);
      return undefined;
    }

    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setManufacturerSearchLoading(true);
    integrationApi.searchManufacturers(trimmed)
      .then((response) => {
        if (cancelled) return;
        const items = Array.isArray(response.data) ? response.data : [];
        setManufacturerOptions(items.map(normalizeManufacturer));
      })
      .catch(() => {
        if (!cancelled) setManufacturerOptions([]);
      })
      .finally(() => {
        if (!cancelled) setManufacturerSearchLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedManufSearch]);

  // === Handle manufacturer selection ===
  const handleManufacturerSelect = useCallback(
    (selected) => {
      const mfr = selected || null;
      setSelectedManufacturer(mfr);
      setManufSearchText(mfr ? '' : manufSearchText);

      onChange({
        ...combination,
        manufacturerId: mfr?.id || null,
        manufacturerName: mfr?.manufacturerName || '',
        selectedDivisionIds: [],
        selectedDivisionMeta: new Map(),
        selectedProductIds: [],
        selectedProductMeta: new Map(),
      });
      setAllDivisions([]);
      setProductListItems([]);
      setProductTotalCount(0);
      setFetchError(null);
    },
    [combination, manufSearchText, onChange]
  );

  // === Fetch divisions when manufacturer changes ===
  useEffect(() => {
    if (!selectedManufacturer?.id) {
      setAllDivisions([]);
      setDivisionLoading(false);
      return undefined;
    }

    const mfrId = toNumericId(selectedManufacturer.id);
    let cancelled = false;
    setDivisionLoading(true);
    integrationApi.getDivisions({ manufacturerIds: [mfrId] })
      .then((response) => {
        if (cancelled) return;
        const { content } = unwrapPaginatedResponse(response.data);
        setAllDivisions(content.map(normalizeDivision));
      })
      .catch((err) => {
        if (!cancelled) setFetchError(err.response?.data?.message || 'Failed to load divisions.');
      })
      .finally(() => {
        setDivisionLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedManufacturer?.id]);

  // === Reset division page on search ===
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDivisionPage(0);
  }, [debouncedDivisionSearch]);

  // === Fetch products ===
  useEffect(() => {
    if (!selectedManufacturer?.id) {
      setProductListItems([]);
      setProductTotalCount(0);
      setProductLoading(false);
      return undefined;
    }

    const mfrId = toNumericId(selectedManufacturer.id);
    let cancelled = false;
    setProductLoading(true);
    setFetchError(null);

    integrationApi.searchProducts({
      searchKey: debouncedProductSearch,
      manufacturerIds: [mfrId],
      divisionIds: productFilterDivisionIds.map(toNumericId),
      page: productPage,
      size: productRowsPerPage,
      pinnedProductIds: selectedProductIdList.map(String),
    })
      .then((response) => {
        if (cancelled) return;
        const { content, totalElements } = unwrapPaginatedResponse(response.data);
        setProductListItems(content.map(normalizeProduct));
        setProductTotalCount(totalElements);
      })
      .catch((err) => {
        if (!cancelled) {
          setFetchError(err.response?.data?.message || 'Failed to load products.');
          setProductListItems([]);
          setProductTotalCount(0);
        }
      })
      .finally(() => {
        setProductLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedManufacturer?.id, productFilterDivisionKey, debouncedProductSearch, productPage, productRowsPerPage, selectedProductIdList]);

  // === Reset product page on filter change ===
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setProductPage(0);
  }, [debouncedProductSearch, productFilterDivisionKey]);

  // === Toggle division ===
  const toggleDivision = useCallback(
    (division) => {
      const divId = toNumericId(division.id);
      const isCurrentlySelected = selectedDivisionIdList.some((sId) => toNumericId(sId) === divId);
      const newIds = isCurrentlySelected
        ? selectedDivisionIdList.filter((sId) => toNumericId(sId) !== divId)
        : [...selectedDivisionIdList, divId];

      const newMeta = new Map(combination.selectedDivisionMeta || new Map());
      if (isCurrentlySelected) newMeta.delete(divId);
      else
        newMeta.set(divId, {
          id: divId,
          divisionName: division.divisionName,
          manufacturerId: division.manufacturerId,
        });

      onChange({
        ...combination,
        selectedDivisionIds: newIds,
        selectedDivisionMeta: newMeta,
        selectedProductIds: [],
        selectedProductMeta: new Map(),
      });
      setProductPage(0);
    },
    [combination, selectedDivisionIdList, onChange]
  );

  // === Toggle product ===
  const toggleProduct = useCallback(
    (product) => {
      const prodId = product.productId || product.id || product.code;
      const numericProdId = toNumericId(prodId);
      const isCurrentlySelected = selectedProductIdList.some(id => toNumericId(id) === numericProdId);
      const newIds = isCurrentlySelected
        ? selectedProductIdList.filter((pId) => toNumericId(pId) !== numericProdId)
        : [...selectedProductIdList, prodId];

      const newMeta = new Map(combination.selectedProductMeta || new Map());
      const prodNormId = product.id;
      if (isCurrentlySelected) newMeta.delete(prodNormId);
      else
        newMeta.set(prodNormId, {
          id: prodNormId,
          productName: product.productName || product.name || '',
          divisionId: toNumericId(product.divisionId),
          manufacturerId: toNumericId(product.manufacturerId),
        });

      onChange({
        ...combination,
        selectedProductIds: newIds,
        selectedProductMeta: newMeta,
      });
    },
    [combination, selectedProductIdList, onChange]
  );

  // === Change division/product rule type ===
  const handleDivisionOpChange = useCallback(
    (event) => {
      onChange({ ...combination, divisionOp: event.target.value });
    },
    [combination, onChange]
  );

  const handleProductOpChange = useCallback(
    (event) => {
      onChange({ ...combination, productOp: event.target.value });
    },
    [combination, onChange]
  );

  // === Clear handlers ===
  const clearDivisions = useCallback(() => {
    onChange({
      ...combination,
      selectedDivisionIds: [],
      selectedDivisionMeta: new Map(),
      selectedProductIds: [],
      selectedProductMeta: new Map(),
    });
    setProductPage(0);
  }, [combination, onChange]);

  const clearProducts = useCallback(() => {
    onChange({
      ...combination,
      selectedProductIds: [],
      selectedProductMeta: new Map(),
    });
  }, [combination, onChange]);

  // === Pin selected items to top ===
  const combinedProductItems = useMemo(() => {
    return pinSelected(productListItems, selectedProductIdList, (p) => p.productId || p.id || p.code);
  }, [productListItems, selectedProductIdList]);

  // === Manufacturer dropdown helpers ===
  const availableManufacturers = useMemo(() => {
    return manufacturerOptions.filter(m =>
      !selectedManufacturerIds.includes(toNumericId(m.id)) ||
      toNumericId(m.id) === toNumericId(manufacturerId)
    );
  }, [manufacturerOptions, selectedManufacturerIds, manufacturerId]);

  const limitedManufacturerOptions = useMemo(
    () => availableManufacturers.slice(0, MANUFACTURER_DROPDOWN_LIMIT),
    [availableManufacturers]
  );
  const hasMoreManufacturerOptions = availableManufacturers.length > MANUFACTURER_DROPDOWN_LIMIT;

  const renderManufacturerOption = useCallback(
    (option) => (
      <Box sx={{ display: 'flex', flexDirection: 'column' }}>
        <Typography variant="body1" fontWeight={500}>
          {option.manufacturerName}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          ID: {option.id}
        </Typography>
      </Box>
    ),
    []
  );

  // ================================================================
  // RENDER: collapsible card with accordion-style header
  // ================================================================
  return (
    <Paper
      elevation={0}
      sx={{
        mb: 1.5,
        border: `1px solid ${BRAND.borderLight}`,
        borderRadius: '10px',
        transition: 'box-shadow 0.2s',
        ...(expanded
          ? { boxShadow: `0 2px 8px ${BRAND.borderLight}` }
          : {}),
      }}
    >
      {/* === ACCORDION HEADER (always visible) === */}
      <Box
        onClick={onToggleExpanded}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          p: 1.5,
          cursor: 'pointer',
          bgcolor: expanded ? 'action.hover' : 'transparent',
          transition: 'background-color 0.2s',
          '&:hover': { bgcolor: 'action.hover' },
        }}
      >
        {/* Expand/collapse icon */}
        <Box sx={{ color: 'text.secondary', flexShrink: 0 }}>
          {expanded ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
        </Box>

        {/* Summary info */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body2" fontWeight={600} noWrap>
            {hasManufacturer
              ? selectedManufacturer.manufacturerName || `Manufacturer ${selectedManufacturer.id}`
              : 'Empty — select a manufacturer'}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap>
            {selectedDivisionIdList.length > 0
              ? `${selectedDivisionIdList.length} division${selectedDivisionIdList.length === 1 ? '' : 's'} (${divisionOp.toLowerCase()}) · `
              : ''}
            {selectedProductIdList.length > 0
              ? `${selectedProductIdList.length} product${selectedProductIdList.length === 1 ? '' : 's'} (${productOp.toLowerCase()})`
              : 'No products selected'}
          </Typography>
        </Box>

        {/* Loading indicators */}
        {divisionLoading && <CircularProgress size={14} />}

        {/* Remove button (does not toggle expand) */}
        {canRemove && (
          <Button
            size="small"
            color="error"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            startIcon={<DeleteOutlineOutlined fontSize="small" />}
            sx={{ fontSize: '0.72rem', px: 1, flexShrink: 0 }}
          >
            Remove
          </Button>
        )}
      </Box>

      {/* === EXPANDED BODY (three columns) === */}
      {expanded && (
        <Box sx={{ p: 1.5, pt: 0 }}>
          {/* Error banner */}
          {fetchError && (
            <Typography variant="body2" color="error" sx={{ mb: 1.5 }}>
              {fetchError}
            </Typography>
          )}

          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', md: 'row' },
              gap: 2,
              width: '100%',
              alignItems: 'stretch',
            }}
          >
            {/* COLUMN 1 — MANUFACTURER */}
            <Box sx={columnPaperSx}>
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
                1. Manufacturer
              </Typography>
              <UnifiedSelect
                placeholder="Search manufacturer..."
                options={limitedManufacturerOptions}
                value={selectedManufacturer}
                onChange={handleManufacturerSelect}
                onSearch={(q) => setManufSearchText(q ?? '')}
                loading={manufacturerSearchLoading}
                getOptionLabel={(option) => `${option.manufacturerName || ''} (ID: ${option.id})`}
                renderOption={renderManufacturerOption}
                isOptionEqualToValue={(option, value) =>
                  toNumericId(option.id) === toNumericId(value?.id)
                }
                clearOnSelect={false}
                disabled={false}
              />
              {hasMoreManufacturerOptions && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                  Showing first {MANUFACTURER_DROPDOWN_LIMIT} of {manufacturerOptions.length} matches
                </Typography>
              )}
            </Box>

            {/* COLUMN 2 — DIVISIONS */}
            <Box sx={columnPaperSx}>
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
                2. Divisions ({selectedDivisionIdList.length})
              </Typography>

              <FormControl component="fieldset" sx={{ ...ruleSelectSx, mb: 1 }} disabled={!hasManufacturer}>
                <FormLabel component="legend" sx={{ fontSize: '0.75rem', mb: 0.5 }}>
                  Rule
                </FormLabel>
                <RadioGroup row name={`division-op-${id}`} value={divisionOp} onChange={handleDivisionOpChange}>
                  <FormControlLabel value="INCLUDE" control={<Radio size="small" />} label="Include" />
                  <FormControlLabel value="EXCLUDE" control={<Radio size="small" />} label="Exclude" sx={{ ml: 2 }} />
                </RadioGroup>
              </FormControl>

              <TextField
                size="small"
                variant="outlined"
                placeholder="Search divisions by name or ID..."
                value={divisionSearchText}
                onChange={(event) => setDivisionSearchText(event.target.value)}
                fullWidth
                disabled={!hasManufacturer}
                sx={{ mb: 1 }}
              />

              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}>
                <Button
                  size="small"
                  variant="text"
                  sx={headerActionButtonSx}
                  onClick={clearDivisions}
                  disabled={!selectedDivisionIdList.length}
                >
                  Clear All
                </Button>
              </Box>

              {divisionLoading ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 2 }}>
                  <CircularProgress size={16} />
                  <Typography variant="body2" color="text.secondary">Loading divisions...</Typography>
                </Box>
              ) : !hasManufacturer ? (
                <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                  Select a manufacturer first
                </Typography>
              ) : divisionListItems.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                  {selectedDivisionIdList.length ? 'No divisions match search' : 'No divisions available'}
                </Typography>
              ) : (
                <CheckboxList
                  items={divisionListItems}
                  getItemId={(d) => d.id}
                  getItemLabel={formatDivisionLabel}
                  selectedIds={selectedDivisionIdList}
                  onToggle={toggleDivision}
                />
              )}

              {divisionTotalCount > 0 && !divisionLoading && hasManufacturer && (
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
                  rowsPerPageOptions={DIVISION_PAGE_SIZE_OPTIONS}
                  labelDisplayedRows={({ from, to, count }) => `${from}–${to} of ${count}`}
                  labelRowsPerPage=""
                  sx={{ borderTop: `1px solid ${BRAND.borderLight}`, mt: 'auto' }}
                />
              )}
            </Box>

            {/* COLUMN 3 — PRODUCTS */}
            <Box sx={columnPaperSx}>
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
                3. Products ({selectedProductIdList.length})
              </Typography>

              <FormControl component="fieldset" sx={{ ...ruleSelectSx, mb: 1 }} disabled={!hasManufacturer}>
                <FormLabel component="legend" sx={{ fontSize: '0.75rem', mb: 0.5 }}>
                  Rule
                </FormLabel>
                <RadioGroup row name={`product-op-${id}`} value={productOp} onChange={handleProductOpChange}>
                  <FormControlLabel value="INCLUDE" control={<Radio size="small" />} label="Include" />
                  <FormControlLabel value="EXCLUDE" control={<Radio size="small" />} label="Exclude" sx={{ ml: 2 }} />
                </RadioGroup>
              </FormControl>

              <TextField
                size="small"
                variant="outlined"
                placeholder="Search products by name or ID..."
                value={productSearchText}
                onChange={(event) => setProductSearchText(event.target.value)}
                fullWidth
                disabled={!hasManufacturer}
                sx={{ mb: 1 }}
              />

              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}>
                <Button
                  size="small"
                  variant="text"
                  sx={headerActionButtonSx}
                  onClick={clearProducts}
                  disabled={!selectedProductIdList.length}
                >
                  Clear All
                </Button>
              </Box>

              {productLoading ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 2 }}>
                  <CircularProgress size={16} />
                  <Typography variant="body2" color="text.secondary">Loading products...</Typography>
                </Box>
              ) : !hasManufacturer ? (
                <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                  Select a manufacturer first
                </Typography>
              ) : combinedProductItems.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                  No products match search
                </Typography>
              ) : (
                <CheckboxList
                  items={combinedProductItems}
                  getItemId={(p) => p.productId || p.id || p.code}
                  getItemLabel={formatProductLabel}
                  selectedIds={selectedProductIdList}
                  onToggle={toggleProduct}
                />
              )}

              {productLoading || (hasManufacturer && (productTotalCount > 0 || productListItems.length > 0)) ? (
                <TablePagination
                  component="div"
                  count={
                    productTotalCount < 0 ? (productPage + 2) * productRowsPerPage : productTotalCount
                  }
                  page={productPage}
                  onPageChange={(_, newPage) => setProductPage(newPage)}
                  rowsPerPage={productRowsPerPage}
                  onRowsPerPageChange={(event) => {
                    setProductRowsPerPage(parseInt(event.target.value, 10));
                    setProductPage(0);
                  }}
                  rowsPerPageOptions={PRODUCT_PAGE_SIZE_OPTIONS}
                  labelDisplayedRows={({ from, to, count }) => {
                    if (productTotalCount < 0) {
                      const known = productPage * productRowsPerPage + combinedProductItems.length;
                      return `${from}–${to} of more than ${known}`;
                    }
                    return `${from}–${to} of ${count}`;
                  }}
                  labelRowsPerPage=""
                  sx={{ borderTop: `1px solid ${BRAND.borderLight}`, mt: 'auto' }}
                />
              ) : null}
            </Box>
          </Box>
        </Box>
      )}
    </Paper>
  );
}
