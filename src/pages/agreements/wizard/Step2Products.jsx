import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Box, Typography, Alert, Button,
} from '@mui/material';
import { AddOutlined } from '@mui/icons-material';
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

  const hasInitialized = useRef(false);
  const userInteractedRef = useRef(false);
  const lastEmittedRef = useRef(null);

  const sectionInfo = info ?? 'Add combinations to define product scope. Each combination = 1 manufacturer + division rule + product rule.';

  // Compute scope count from all combinations
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
      .catch(() => {});

    return undefined;
  }, [combinations]);

  // Emit to parent whenever combinations change (after user interaction)
  useEffect(() => {
    if (!userInteractedRef.current) return;

    const patch = mapCombinationsToRules(combinations);
    const serialized = serializeProductRulesPatch(patch);
    if (lastEmittedRef.current === serialized) return;
    lastEmittedRef.current = serialized;
    updateProductRules(patch);
  }, [combinations, updateProductRules]);

  const addCombination = useCallback(() => {
    userInteractedRef.current = true;
    setCombinations((prev) => {
      const newCombo = createEmptyCombination();
      const updated = [...prev, newCombo];
      // Collapse all existing, expand only the new one
      setExpandedStates((prevExpanded) => {
        const collapsed = { ...prevExpanded };
        // Collapse all existing
        Object.keys(collapsed).forEach((key) => { collapsed[key] = false; });
        // Expand new one
        collapsed[newCombo.id] = true;
        return collapsed;
      });
      return updated;
    });
  }, []);

  const updateCombination = useCallback((index, updated) => {
    userInteractedRef.current = true;
    setCombinations((prev) =>
      prev.map((c, i) => (i === index ? updated : c)),
    );
  }, []);

  const removeCombination = useCallback((index) => {
    userInteractedRef.current = true;
    setCombinations((prev) => {
      if (prev.length <= 1) return prev;
      const filtered = prev.filter((_, i) => i !== index);
      // Clean up expanded state for removed combination
      const removedCombo = prev[index];
      setExpandedStates((prevExpanded) => {
        const updated = { ...prevExpanded };
        delete updated[removedCombo.id];
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
      </Typography>

      {fetchError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setFetchError(null)}>{fetchError}</Alert>
      )}

      <WizardFieldAnchor field="products" error={error}>
        <Box sx={{ mb: 2 }}>
          <Button
            variant="outlined"
            startIcon={<AddOutlined />}
            onClick={addCombination}
            sx={{
              borderRadius: '8px',
              borderColor: BRAND.primaryMain,
              color: BRAND.primaryMain,
              fontWeight: 600,
              '&:hover': { borderColor: BRAND.primaryDark, backgroundColor: BRAND.primaryLight },
            }}
          >
            Add Combination
          </Button>
        </Box>

        {combinations.map((combo, index) => {
          const selectedManufacturerIds = combinations.map(c => toNumericId(c.manufacturerId)).filter(Boolean);
          return (
            <ProductScopeCombination
              key={combo.id}
              combination={combo}
              onChange={(updated) => updateCombination(index, updated)}
              onRemove={() => removeCombination(index)}
              canRemove={combinations.length > 1}
              expanded={!!expandedStates[combo.id]}
              onToggleExpanded={() => toggleExpanded(combo.id)}
              selectedManufacturerIds={selectedManufacturerIds}
            />
          );
        })}
      </WizardFieldAnchor>
    </Box>
  );
}
