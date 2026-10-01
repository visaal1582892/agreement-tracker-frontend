import { useMemo } from 'react';
import { Box, Typography, Chip, Grid } from '@mui/material';
import { Storefront, Factory, Category } from '@mui/icons-material';
import ComputedProductsTable from './ComputedProductsTable';
import OverflowBubbleList from '../common/OverflowBubbleList';
import VendorsTable from '../common/VendorsTable';

export default function ScopeOperationsReview({
  productRules = {},
  version = null,
  vendors = [],
  vendorDetailsMap = {},
  vendorIds = [],
  adhocSubType = null,
  agreementVersionId = null,
}) {
  const manufacturerList = useMemo(() => {
    const manufacturers = productRules.manufacturerOptions || version?.manufacturers || [];
    if (!manufacturers.length) return [];
    return manufacturers
      .map(m => (typeof m === 'object' && m !== null ? m.manufacturerName || m.name : null))
      .filter(Boolean);
  }, [productRules, version]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%', pt: 1 }}>
      {/* Summary Cards */}
      {(manufacturerList.length > 0 || adhocSubType) && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>

          {/* Manufacturers Card */}
          {manufacturerList.length > 0 && (
            <Box sx={{ flex: '1 1 300px', p: 2, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                <Factory fontSize="small" color="primary" />
                <Typography variant="subtitle2" fontWeight={600} color="text.secondary">
                  Manufacturers
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                <OverflowBubbleList
                  items={manufacturerList}
                  maxVisible={3}
                  chipProps={{ size: 'small', variant: 'outlined', sx: { borderRadius: 1.5 } }}
                  popoverTitle="Manufacturers"
                />
              </Box>
            </Box>
          )}

          {/* Ad-hoc Sub-Type Card */}
          {adhocSubType && (
            <Box sx={{ flex: '1 1 300px', p: 2, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                <Category fontSize="small" color="primary" />
                <Typography variant="subtitle2" fontWeight={600} color="text.secondary">
                  Ad-hoc Sub-type
                </Typography>
              </Box>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {adhocSubType}
              </Typography>
            </Box>
          )}
        </Box>
      )}

      <Grid container spacing={3} sx={{ width: '100%', alignItems: 'flex-start' }}>
        {/* Vendors Table */}
        <Grid item xs={12} sx={{ flexBasis: { md: '35%' }, maxWidth: { md: '35%' }, width: { md: '35%' }, flexGrow: 0 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0, width: '100%' }}>
            <Typography variant="subtitle1" color="text.primary" sx={{ fontWeight: 700, mb: 0.5 }}>
              Selected Vendors
            </Typography>
            <VendorsTable vendors={vendors} vendorDetailsMap={vendorDetailsMap} />
          </Box>
        </Grid>

        {/* Products Table */}
        <Grid item xs={12} sx={{ flexBasis: { md: '65%' }, maxWidth: { md: '60%' }, width: { md: '65%' }, flexGrow: 0 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0, width: '100%' }}>
            <Typography variant="subtitle1" color="text.primary" sx={{ fontWeight: 700, mb: 0.5 }}>
              Computed Products Scope
            </Typography>
            <ComputedProductsTable
              agreementVersionId={agreementVersionId}
              productRules={productRules}
              version={version}
            />
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
}
