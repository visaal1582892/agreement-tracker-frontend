import { columnCellSx } from '../../components/ui/tableStandards';
import TruncatedText from '../../components/ui/TruncatedText';
import { Box } from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

export const PRICE_OFF_COLUMN_WIDTHS = {
  product: { minWidth: 200, flex: true },
  manufacturer: 160,
  l3Category: 120,
  location: 110,
  channel: 130,
  discountType: 130,
  startDate: 100,
  endDate: 100,
  cp: 80,
  mrp: 80,
  baseOffer: 100,
  medplusContribution: 160,
  locationZone: 72,
  totalQty: 100,
  creditNote: 130,
  fromQty: 80,
  marginPercent: 95,
  finalOffer: 100,
  percentOff: 80,
  finalMarginPercent: 120,
  maxUnitCap: 90,
  campaignId: 150,
  status: 158,
  updatedAt: 180,
  actions: 100,
};

export function priceOffColumnSx(key) {
  const config = PRICE_OFF_COLUMN_WIDTHS[key];
  if (!config) return {};
  if (typeof config === 'number') {
    return columnCellSx(config);
  }
  return columnCellSx(config.minWidth, { flex: config.flex });
}

export function priceOffFilterColumnSx(key) {
  const config = PRICE_OFF_COLUMN_WIDTHS[key];
  const width = typeof config === 'number' ? config : config.minWidth;
  return columnCellSx(width);
}

export function PriceOffProductCell({ name, code, negativeMargin = false }) {
  const displayName = name || '—';
  const displayCode = code || '';
  const tooltip = [displayName, displayCode].filter((v) => v && v !== '—').join(' · ');
  return (
    <Box sx={{ minWidth: 0, display: 'flex', alignItems: 'flex-start', gap: 0.75 }}>
      {negativeMargin && (
        <WarningAmberIcon
          fontSize="small"
          color="error"
          sx={{ mt: 0.15, flexShrink: 0 }}
          titleAccess="Negative margin — adjust MedPlus contribution before approval"
        />
      )}
      <Box sx={{ minWidth: 0 }}>
      <TruncatedText title={tooltip}>
        <Box component="span" sx={{ fontWeight: 600, fontSize: '0.8rem' }}>
          {displayName}
        </Box>
      </TruncatedText>
      {displayCode ? (
        <TruncatedText title={tooltip}>
          <Box component="span" sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
            {displayCode}
          </Box>
        </TruncatedText>
      ) : null}
      </Box>
    </Box>
  );
}

export function PriceOffTextCell({ value }) {
  const display = value || '—';
  return (
    <TruncatedText title={display === '—' ? '' : String(display)}>
      {display}
    </TruncatedText>
  );
}
