import { useMemo } from 'react';
import { Box, Typography } from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import TruncatedInlineList from './TruncatedInlineList';
import { READ_ONLY_PRODUCT_COLUMNS } from '../../utils/productScopeUtils';

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
  const stateCode = vendor.state || '';
  const prefix = stateCode ? `${stateCode}-` : '';
  if (vendor.vendorId != null) {
    return `${prefix}${vendor.vendorName} (ID: ${vendor.vendorId})`;
  }
  return `${prefix}${vendor.vendorName || ''}`;
}

function formatDivisionRuleLabel(divisionName, ruleType, divisionId) {
  const mode = ruleType === 'EXCLUDE' ? 'Excluded' : 'Included';
  const idSuffix = divisionId != null ? ` · ID: ${divisionId}` : '';
  return `${divisionName} (${mode})${idSuffix}`;
}

function formatProductRuleLabel(productName, ruleType, productId) {
  const mode = ruleType === 'EXCLUDE' ? 'Excluded' : 'Included';
  const idSuffix = productId != null ? ` · ID: ${productId}` : '';
  return `${productName} (${mode})${idSuffix}`;
}

function formatManufacturerLabel(manufacturer) {
  const name = manufacturer.manufacturerName || manufacturer.name || `Manufacturer #${manufacturer.id}`;
  return manufacturer.id != null ? `${name} (ID: ${manufacturer.id})` : name;
}

export default function ScopeOperationsReview({
  vendorIds = [],
  vendors = [],
  productRules = {},
  version = null,
  adhocSubType = null,
}) {
  const manufacturers = useMemo(() => {
    if (productRules.manufacturerOptions?.length) {
      return productRules.manufacturerOptions.map((manufacturer) => ({
        id: manufacturer.id,
        manufacturerName: manufacturer.manufacturerName || manufacturer.name,
      }));
    }
    if (version?.manufacturers?.length) {
      return version.manufacturers.map((manufacturer) => ({
        id: manufacturer.id,
        manufacturerName: manufacturer.name,
      }));
    }
    return [];
  }, [productRules.manufacturerOptions, version?.manufacturers]);

  const divisionRules = productRules.divisionRules?.length
    ? productRules.divisionRules
    : version?.divisionRules ?? [];

  // Ensure live rules from Step 2 override any static initial edit snapshot
  const activeProductRules = productRules.productRules?.length
    ? productRules.productRules
    : (version?.productRules || []);

  const computedProductRows = useMemo(() => {
    let baseProducts = [];
    if (version?.products?.length) {
      baseProducts = version.products.map((product) => ({
        productId: product.productId,
        productName: product.productName,
        divisionName: product.divisionName || '—',
      }));
    } else if (productRules.computedProductPreview?.length) {
      baseProducts = productRules.computedProductPreview.map((product) => ({
        productId: product.productId,
        productName: product.productName,
        divisionName: product.divisionName || '—',
      }));
    }

    if (activeProductRules && activeProductRules.length > 0) {
      // 1. Remove explicitly excluded products
      const excludedIds = new Set(
        activeProductRules.filter((r) => r.ruleType === 'EXCLUDE').map((r) => r.id)
      );
      if (excludedIds.size > 0) {
        baseProducts = baseProducts.filter((p) => !excludedIds.has(p.productId));
      }

      // 2. Add explicitly included products that are missing
      const existingIds = new Set(baseProducts.map((p) => p.productId));
      const missingIncludes = activeProductRules.filter(
        (r) => r.ruleType === 'INCLUDE' && !existingIds.has(r.id)
      );

      if (missingIncludes.length > 0) {
        const extraProducts = missingIncludes.map((r) => ({
          productId: r.id,
          productName: r.name || r.productName || `Product #${r.id}`,
          divisionName: r.divisionName || '—',
        }));
        baseProducts = [...extraProducts, ...baseProducts];
      }
    }

    return baseProducts;
  }, [version?.products, productRules.computedProductPreview, activeProductRules]);

  const vendorLabels = useMemo(() => {
    const combined = [...(vendors || []), ...(version?.vendors || [])];
    const unique = [];
    const seen = new Set();
    for (const v of combined) {
      if (!seen.has(v.vendorId)) {
        seen.add(v.vendorId);
        unique.push(v);
      }
    }
    return unique
      .filter((vendor) => vendorIds.includes(vendor.vendorId))
      .map(formatVendorLabel);
  }, [vendors, version?.vendors, vendorIds]);

  const manufacturerLabels = manufacturers.map(formatManufacturerLabel).filter(Boolean);
  const divisionLabels = divisionRules.map((rule) =>
    formatDivisionRuleLabel(rule.name || `Division #${rule.id}`, rule.ruleType, rule.id),
  );
  const productRuleLabels = activeProductRules.map((rule) =>
    formatProductRuleLabel(rule.name || rule.productName || `Product #${rule.id}`, rule.ruleType, rule.id),
  );

  return (
    <Box>
      <ScopeReviewField label="Vendors">
        <TruncatedInlineList items={vendorLabels} emptyLabel="No vendors selected" />
      </ScopeReviewField>
      <ScopeReviewField label="Manufacturers">
        <TruncatedInlineList items={manufacturerLabels} emptyLabel="No manufacturers selected" />
      </ScopeReviewField>
      <ScopeReviewField label="Division Rules">
        <TruncatedInlineList items={divisionLabels} emptyLabel="No division rules" />
      </ScopeReviewField>
      <ScopeReviewField label="Product Exceptions">
        <TruncatedInlineList items={productRuleLabels} emptyLabel="No product exceptions" />
      </ScopeReviewField>
      <ScopeReviewField label="Computed Products">
        {computedProductRows.length === 0 ? (
          <Typography variant="body2" fontWeight={500}>No computed products yet</Typography>
        ) : (
          <Box sx={{ height: 360, width: '100%', mt: 0.5 }}>
            <DataGrid
              rows={computedProductRows}
              columns={READ_ONLY_PRODUCT_COLUMNS}
              getRowId={(row) => row.productId}
              pageSizeOptions={[10, 25, 50]}
              initialState={{
                pagination: { paginationModel: { pageSize: 10 } },
              }}
              disableRowSelectionOnClick
              density="compact"
            />
          </Box>
        )}
      </ScopeReviewField>
    </Box>
  );
}
