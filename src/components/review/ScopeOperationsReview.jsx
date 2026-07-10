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
  if (vendor.vendorId != null) {
    return `${vendor.vendorName} (ID: ${vendor.vendorId})`;
  }
  return vendor.vendorName || '';
}

function formatDivisionRuleLabel(divisionName, ruleType, divisionId) {
  const mode = ruleType === 'EXCLUDE' ? 'Excluded' : 'Included';
  const idSuffix = divisionId != null ? ` · ID: ${divisionId}` : '';
  return `${divisionName} (${mode})${idSuffix}`;
}

function formatManufacturerLabel(manufacturer) {
  const name = manufacturer.manufacturerName || manufacturer.name || `Manufacturer #${manufacturer.id}`;
  return manufacturer.id != null ? `${name} (ID: ${manufacturer.id})` : name;
}

export default function ScopeOperationsReview({
  vendorIds = [],
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

  const computedProductRows = useMemo(() => {
    if (version?.products?.length) {
      return version.products.map((product) => ({
        productId: product.productId,
        productName: product.productName,
        divisionName: product.divisionName || '—',
      }));
    }
    if (productRules.computedProductPreview?.length) {
      return productRules.computedProductPreview.map((product) => ({
        productId: product.productId,
        productName: product.productName,
        divisionName: product.divisionName || '—',
      }));
    }
    return [];
  }, [version?.products, productRules.computedProductPreview]);

  const vendorLabels = (version?.vendors || [])
    .filter((vendor) => vendorIds.includes(vendor.vendorId))
    .map(formatVendorLabel);

  const manufacturerLabels = manufacturers.map(formatManufacturerLabel).filter(Boolean);
  const divisionLabels = divisionRules.map((rule) =>
    formatDivisionRuleLabel(rule.name || `Division #${rule.id}`, rule.ruleType, rule.id),
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
