import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Box, Typography, Alert, Button, TextField, InputAdornment, IconButton, TablePagination,
} from '@mui/material';
import { AddOutlined, Search, Clear } from '@mui/icons-material';
import { integrationApi } from '../../../api/integrationApi';
import {
  normalizeExplicitScopeRules,
} from '../../../utils/productScopeUtils';
import {
  toNumericId,
  normalizeManufacturer,
  createEmptyCombination,
  serializeProductRulesPatch,
  mapRulesToCombinations,
  mapCombinationsToRules,
  hasSavedProductRules,
} from '../../../utils/agreementPayloadMappers';
import { BRAND } from '../../../config/theme';
import WizardSectionTitle from '../../../components/wizard/WizardSectionTitle';
import WizardFieldAnchor from '../../../components/wizard/WizardFieldAnchor';
import ProductScopeCombination from './ProductScopeCombination';

const EMPTY_RULES = { manufacturers: [], divisionRules: [], productRules: [] };

export default function Step2Products({ state, updateProductRules, info, error }) {
  const [combinations, setCombinations] = useState([createEmptyCombination()]);
  const [expandedStates, setExpandedStates] = useState(() => ({ [Date.now()]: true }));
  const [fetchError, setFetchError] = useState(null);

  // Search & Pagination state
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const hasInitialized = useRef(false);
  const userInteractedRef = useRef(false);
  const lastEmittedRef = useRef(null);

  const sectionInfo = info ?? 'Add combinations to define product scope. Each combination = 1 manufacturer + division rule + product rule.';

  // Compute scope count from all combinations (Single Source of Truth)
  const scopeSummary = useMemo(() => {
    const totalIncludedProducts = combinations.reduce((sum, c) => {
      if (c.productOp === 'INCLUDE') return sum + c.selectedProductIds.length;
      return sum;
    }, 0);
    const totalExcludedProducts = combinations.reduce((sum, c) => {
      if (c.productOp === 'EXCLUDE') return sum + c.selectedProductIds.length;
      return sum;
    }, 0);
    const totalManufacturers = new Set(combinations.map((c) => c.manufacturerId).filter(Boolean)).size;
    const activeCombos = combinations.filter((c) => c.manufacturerId).length;

    return { totalIncludedProducts, totalExcludedProducts, totalManufacturers, activeCombos };
  }, [combinations]);

  // Hydrate from saved rules
  useLayoutEffect(() => {
    const rules = state.productRules || EMPTY_RULES;
    const hasRules = hasSavedProductRules(rules);

    if (hasInitialized.current) return;

    if (hasRules) {
      const combos = mapRulesToCombinations(rules);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCombinations(combos);
      const patch = mapCombinationsToRules(combos);
      updateProductRules(patch);
      // Expand first combination by default
      const initialExpanded = {};
      if (combos.length > 0) {
        initialExpanded[combos[0].id] = true;
      }
      setExpandedStates(initialExpanded);
      hasInitialized.current = true;
      lastEmittedRef.current = serializeProductRulesPatch(patch);
    } else {
      hasInitialized.current = true;
    }
  }, [state.productRules]);

  // Fetch missing manufacturer names
  useEffect(() => {
    const missingIds = combinations
      .filter((c) => c.manufacturerId && (!c.manufacturerName || !c.manufacturerName.trim()))
      .map((c) => toNumericId(c.manufacturerId));
    if (!missingIds.length) return undefined;

    integrationApi.getManufacturersByIds(missingIds)
      .then((res) => {
        const list = Array.isArray(res.data) ? res.data : (res.data?.content || []);
        if (!list.length) return;
        const nameMap = new Map(list.map((m) => [toNumericId(m.id), m.manufacturerName || m.name || '']));
        setCombinations((prev) => prev.map((c) => {
          if (!c.manufacturerId) return c;
          const name = nameMap.get(toNumericId(c.manufacturerId));
          return name ? { ...c, manufacturerName: name } : c;
        }));
      })
      .catch(() => { });

    return undefined;
  }, [combinations]);

  // Emit to parent whenever combinations change (after user interaction)
  // CRITICAL GUARDRAIL 1: Master combinations array is ALWAYS used for saving and emitting
  useEffect(() => {
    if (!userInteractedRef.current) return;

    const patch = mapCombinationsToRules(combinations);
    const serialized = serializeProductRulesPatch(patch);
    if (lastEmittedRef.current === serialized) return;
    lastEmittedRef.current = serialized;
    updateProductRules(patch);
  }, [combinations, updateProductRules]);

  // Guardrail 2: Client-Side Search Logic (safe check for manufacturerId & manufacturerName)
  const filteredCombinations = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return combinations;

    return combinations.filter((combo) => {
      const mfrIdStr = combo.manufacturerId != null ? String(combo.manufacturerId).toLowerCase() : '';
      const mfrName = combo.manufacturerName?.toLowerCase() || '';

      return mfrIdStr.includes(query) || mfrName.includes(query);
    });
  }, [combinations, searchQuery]);

  // Guardrail 4: Reset page when filtered count shrinks below current page boundary
  useEffect(() => {
    if (page > 0 && page * rowsPerPage >= filteredCombinations.length) {
      setPage(0);
    }
  }, [filteredCombinations.length, page, rowsPerPage]);

  // Guardrail 1: Paginated view derived from filteredCombinations
  const paginatedCombinations = useMemo(() => {
    const start = page * rowsPerPage;
    return filteredCombinations.slice(start, start + rowsPerPage);
  }, [filteredCombinations, page, rowsPerPage]);

  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
    setPage(0); // Guardrail 4: Reset page on search change
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setPage(0); // Guardrail 4: Reset page on search clear
  };

  const handlePageChange = (_event, newPage) => {
    setPage(newPage);
  };

  const handleRowsPerPageChange = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const addCombination = useCallback(() => {
    userInteractedRef.current = true;
    const newCombo = createEmptyCombination();
    setCombinations((prev) => {
      const updated = [...prev, newCombo];
      // Collapse all existing, expand only the new one
      setExpandedStates((prevExpanded) => {
        const collapsed = { ...prevExpanded };
        Object.keys(collapsed).forEach((key) => { collapsed[key] = false; });
        collapsed[newCombo.id] = true;
        return collapsed;
      });
      return updated;
    });

    // Clear search if active so new combination is immediately visible
    if (searchQuery.trim()) {
      setSearchQuery('');
    }
    // Navigate to the page containing the new combination
    setPage(Math.floor(combinations.length / rowsPerPage));
  }, [combinations.length, rowsPerPage, searchQuery]);

  const updateCombinationById = useCallback((id, updated) => {
    userInteractedRef.current = true;
    setCombinations((prev) =>
      prev.map((c) => (c.id === id ? updated : c)),
    );
  }, []);

  const removeCombinationById = useCallback((id) => {
    userInteractedRef.current = true;
    setCombinations((prev) => {
      if (prev.length <= 1) return prev;
      const filtered = prev.filter((c) => c.id !== id);
      setExpandedStates((prevExpanded) => {
        const updated = { ...prevExpanded };
        delete updated[id];
        return updated;
      });
      return filtered;
    });
  }, []);

  const toggleExpanded = useCallback((comboId) => {
    setExpandedStates((prev) => ({
      ...prev,
      [comboId]: !prev[comboId],
    }));
  }, []);

  return (
    <Box>
      <WizardSectionTitle title="Applicable Products" info={sectionInfo} mb={1} />
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {scopeSummary.activeCombos > 0
          ? `${scopeSummary.activeCombos} combination${scopeSummary.activeCombos === 1 ? '' : 's'} across ${scopeSummary.totalManufacturers} manufacturer${scopeSummary.totalManufacturers === 1 ? '' : 's'}`
          : 'No combinations added yet'}
        {scopeSummary.totalIncludedProducts > 0
          ? ` · ${scopeSummary.totalIncludedProducts} included product${scopeSummary.totalIncludedProducts === 1 ? '' : 's'}`
          : ''}
        {scopeSummary.totalExcludedProducts > 0
          ? ` · ${scopeSummary.totalExcludedProducts} excluded product${scopeSummary.totalExcludedProducts === 1 ? '' : 's'}`
          : ''}
        {searchQuery.trim() ? ` · Filtered: ${filteredCombinations.length} of ${combinations.length} shown` : ''}
      </Typography>

      {fetchError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setFetchError(null)}>{fetchError}</Alert>
      )}

      <WizardFieldAnchor field="products" error={error}>
        {/* Dynamic height capped at maxHeight */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            maxHeight: '700px',
            border: `1px solid ${BRAND.borderLight}`,
            borderRadius: '12px',
            bgcolor: 'background.paper',
            p: 2,
            boxSizing: 'border-box',
          }}
        >
          {/* Search Bar & Add Button: Standard block on the same line (Add on left, Search on rightmost) */}
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 2,
              mb: 2,
              flexShrink: 0,
            }}
          >
            <Button
              variant="outlined"
              startIcon={<AddOutlined />}
              onClick={addCombination}
              sx={{
                borderRadius: '8px',
                borderColor: BRAND.primaryMain,
                color: BRAND.primaryMain,
                fontWeight: 600,
                textTransform: 'none',
                whiteSpace: 'nowrap',
                '&:hover': { borderColor: BRAND.primaryDark, backgroundColor: BRAND.primaryLight },
              }}
            >
              Add Combination
            </Button>

            <TextField
              size="small"
              placeholder="Search by Manufacturer ID or Name..."
              value={searchQuery}
              onChange={handleSearchChange}
              sx={{
                width: { xs: 240, sm: 320, md: 360 },
                bgcolor: 'white',
                '& .MuiOutlinedInput-root': {
                  borderRadius: '8px',
                },
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search fontSize="small" sx={{ color: 'text.secondary' }} />
                  </InputAdornment>
                ),
                endAdornment: searchQuery ? (
                  <InputAdornment position="end">
                    <IconButton
                      size="small"
                      onClick={handleClearSearch}
                      edge="end"
                      aria-label="clear search"
                    >
                      <Clear fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ) : null,
              }}
            />
          </Box>

          {/* Combinations List (The Cards): flexGrow 1, minHeight 0, overflowY auto */}
          <Box
            sx={{
              flexGrow: 1,
              minHeight: 0,
              overflowY: 'auto',
              pr: 1,
              display: 'flex',
              flexDirection: 'column',
              gap: 1.5,
            }}
          >
            {paginatedCombinations.length > 0 ? (
              paginatedCombinations.map((combo) => {
                const selectedManufacturerIds = combinations
                  .map((c) => toNumericId(c.manufacturerId))
                  .filter(Boolean);
                return (
                  <ProductScopeCombination
                    key={combo.id}
                    combination={combo}
                    onChange={(updated) => updateCombinationById(combo.id, updated)}
                    onRemove={() => removeCombinationById(combo.id)}
                    canRemove={combinations.length > 1}
                    expanded={!!expandedStates[combo.id]}
                    onToggleExpanded={() => toggleExpanded(combo.id)}
                    selectedManufacturerIds={selectedManufacturerIds}
                  />
                );
              })
            ) : (
              <Box
                sx={{
                  p: 4,
                  textAlign: 'center',
                  bgcolor: 'grey.50',
                  borderRadius: '10px',
                  border: '1px dashed',
                  borderColor: 'divider',
                  my: 'auto',
                }}
              >
                <Typography variant="body2" color="text.secondary">
                  {searchQuery.trim()
                    ? `No combinations found matching "${searchQuery.trim()}".`
                    : 'No combinations added yet.'}
                </Typography>
                {searchQuery.trim() && (
                  <Button
                    size="small"
                    onClick={handleClearSearch}
                    sx={{ mt: 1, textTransform: 'none', fontWeight: 600 }}
                  >
                    Clear Search
                  </Button>
                )}
              </Box>
            )}
          </Box>

          {/* Pagination Component: Standard block pinned at bottom */}
          <Box
            sx={{
              flexShrink: 0,
              borderTop: '1px solid',
              borderColor: 'divider',
              mt: 1,
              pt: 0.5,
            }}
          >
            <TablePagination
              component="div"
              count={filteredCombinations.length}
              page={page}
              onPageChange={handlePageChange}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={handleRowsPerPageChange}
              rowsPerPageOptions={[5, 10, 25, 50]}
              labelRowsPerPage="Combinations per page:"
              sx={{
                '.MuiTablePagination-toolbar': { minHeight: 44, px: 1 },
                '.MuiTablePagination-selectLabel, .MuiTablePagination-displayedRows': {
                  fontSize: '0.8125rem',
                  color: 'text.secondary',
                },
              }}
            />
          </Box>
        </Box>
      </WizardFieldAnchor>
    </Box>
  );
}
