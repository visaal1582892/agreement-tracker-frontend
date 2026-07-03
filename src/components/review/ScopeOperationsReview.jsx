import { useEffect, useMemo, useState } from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import axiosInstance from '../../api/axiosInstance';
import { ENDPOINTS } from '../../config/endpoints';
import TruncatedInlineList from './TruncatedInlineList';

function ScopeReviewField({ label, children }) {
  return (
    <Box sx={{ py: 1 }}>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 0.75, fontWeight: 600 }}>
        {label}
      </Typography>
      {children}
    </Box>
  );
}

function formatVendorLabel(vendor) {
  if (!vendor) return '';
  return vendor.vendorCode
    ? `${vendor.vendorCode} — ${vendor.vendorName}`
    : vendor.vendorName;
}

function formatDivisionRuleLabel(divisionName, ruleType) {
  const mode = ruleType === 'EXCLUDE' ? 'Excluded' : 'Included';
  return `${divisionName} (${mode})`;
}

export default function ScopeOperationsReview({
  vendorIds = [],
  productRules = {},
  version = null,
  adhocSubType = null,
}) {
  const [loading, setLoading] = useState(false);
  const [vendors, setVendors] = useState([]);
  const [manufacturers, setManufacturers] = useState([]);
  const [divisionNameById, setDivisionNameById] = useState({});

  const manufacturerIds = productRules.manufacturers ?? version?.manufacturerIds ?? [];
  const divisionRules = productRules.divisionRules?.length
    ? productRules.divisionRules
    : version?.divisionRules ?? [];
  const manufacturerIdsKey = manufacturerIds.join(',');
  const divisionRulesKey = divisionRules.map((rule) => `${rule.id}:${rule.ruleType}`).join(',');
  const vendorIdsKey = vendorIds.join(',');

  const computedProducts = useMemo(() => {
    if (version?.products?.length) {
      return version.products.map((product) => {
        const parts = [product.productName];
        if (product.manufacturerName) parts.push(product.manufacturerName);
        if (product.divisionName) parts.push(product.divisionName);
        return parts.filter(Boolean).join(' · ');
      });
    }
    return [];
  }, [version?.products]);

  useEffect(() => {
    let cancelled = false;

    const loadScopeDetails = async () => {
      setLoading(true);
      try {
        const requests = [];

        if (vendorIds.length) {
          requests.push(
            axiosInstance.get(ENDPOINTS.VENDORS, { params: { ids: vendorIds.join(',') } }),
          );
        } else {
          requests.push(Promise.resolve({ data: [] }));
        }

        requests.push(axiosInstance.get(ENDPOINTS.MANUFACTURERS));

        const [vendorResponse, manufacturerResponse] = await Promise.all(requests);
        if (cancelled) return;

        const vendorList = (Array.isArray(vendorResponse.data) ? vendorResponse.data : [])
          .filter((vendor) => vendorIds.includes(vendor.id));
        setVendors(vendorList);

        const manufacturerCatalog = Array.isArray(manufacturerResponse.data)
          ? manufacturerResponse.data
          : [];
        const selectedManufacturers = manufacturerCatalog.filter((manufacturer) =>
          manufacturerIds.includes(manufacturer.id),
        );
        setManufacturers(selectedManufacturers);

        const divisionIds = divisionRules.map((rule) => rule.id);
        if (!divisionIds.length || !selectedManufacturers.length) {
          setDivisionNameById({});
          return;
        }

        const divisionResponses = await Promise.all(
          selectedManufacturers.map((manufacturer) =>
            axiosInstance.get(ENDPOINTS.DIVISIONS(manufacturer.id)),
          ),
        );
        if (cancelled) return;

        const nextDivisionMap = {};
        divisionResponses.forEach((response) => {
          (Array.isArray(response.data) ? response.data : []).forEach((division) => {
            nextDivisionMap[division.id] = division.divisionName;
          });
        });
        setDivisionNameById(nextDivisionMap);
      } catch (err) {
        console.error('Failed to load scope review details:', err);
        if (!cancelled) {
          setVendors([]);
          setManufacturers([]);
          setDivisionNameById({});
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadScopeDetails();
    return () => { cancelled = true; };
  }, [vendorIdsKey, manufacturerIdsKey, divisionRulesKey]);

  const vendorLabels = vendors.map(formatVendorLabel).filter(Boolean);
  const manufacturerLabels = manufacturers.map((manufacturer) => manufacturer.manufacturerName).filter(Boolean);
  const divisionLabels = divisionRules.map((rule) => {
    const divisionName = divisionNameById[rule.id] || `Division #${rule.id}`;
    return formatDivisionRuleLabel(divisionName, rule.ruleType);
  });

  if (loading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1 }}>
        <CircularProgress size={16} />
        <Typography variant="body2" color="text.secondary">Loading scope details…</Typography>
      </Box>
    );
  }

  return (
    <Box>
      <ScopeReviewField label="Supply Vendors">
        <TruncatedInlineList items={vendorLabels} maxVisible={3} emptyLabel="No supply vendors selected" />
      </ScopeReviewField>

      <ScopeReviewField label="Manufacturers">
        <TruncatedInlineList
          items={manufacturerLabels}
          maxVisible={4}
          emptyLabel="All manufacturers in scope"
        />
      </ScopeReviewField>

      <ScopeReviewField label="Divisions">
        <TruncatedInlineList
          items={divisionLabels}
          maxVisible={4}
          emptyLabel="No division rules configured"
        />
      </ScopeReviewField>

      <ScopeReviewField label="Computed Products">
        <TruncatedInlineList
          items={computedProducts}
          maxVisible={6}
          emptyLabel="No computed products yet — save agreement to refresh"
        />
      </ScopeReviewField>

      {adhocSubType && (
        <ScopeReviewField label="Activity Type">
          <Typography variant="body2" fontWeight={500}>{adhocSubType.replace('_', ' ')}</Typography>
        </ScopeReviewField>
      )}
    </Box>
  );
}
