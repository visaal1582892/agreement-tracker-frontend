import React from 'react';
import { Box, Typography, Chip } from '@mui/material';
import PublicIcon from '@mui/icons-material/Public';
import MapIcon from '@mui/icons-material/Map';
import LocationCityIcon from '@mui/icons-material/LocationCity';
import OverflowBubbleList from '../../common/OverflowBubbleList';

function LocationGroup({ title, icon: Icon, items, maxVisible = 5, chipProps = { size: 'small', variant: 'outlined' } }) {
  if (!items || items.length === 0) return null;

  return (
    <Box sx={{ mb: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, ml: 0.5 }}>
        <Icon sx={{ fontSize: 16, color: 'primary.main' }} />
        <Typography variant="overline" sx={{ fontWeight: 700, color: 'text.secondary', lineHeight: 1 }}>
          {title} ({items.length})
        </Typography>
      </Box>
      <OverflowBubbleList
        items={items}
        maxVisible={maxVisible}
        chipProps={{
          icon: <Icon sx={{ fontSize: 14 }} />,
          ...chipProps
        }}
        popoverTitle={title}
      />
    </Box>
  );
}

export default function GeographyLimitsDetails({
  locations = [],
  legacyStates = [],
  legacyCities = [],
  geographyMode,
}) {
  const hasLocations = locations.length > 0 || legacyStates.length > 0 || legacyCities.length > 0;

  if (geographyMode === 'ALL' && !hasLocations) {
    return <Typography variant="body2" fontWeight={500}>All locations</Typography>;
  }

  if (!hasLocations) {
    return <Typography variant="body2" fontWeight={500}>—</Typography>;
  }

  if (!locations.length) {
    return (
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        {legacyStates.map((s, i) => <Chip key={`s-${i}`} label={s.name} size="small" variant="outlined" />)}
        {legacyCities.map((c, i) => <Chip key={`c-${i}`} label={c.name} size="small" variant="outlined" />)}
      </Box>
    );
  }

  const countryLocs = locations.filter(l => l.locationType === 'COUNTRY');
  const stateLocs = locations.filter(l => l.locationType === 'STATE');
  const cityLocs = locations.filter(l => l.locationType === 'CITY');

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <LocationGroup
        title="Countries"
        icon={PublicIcon}
        items={countryLocs.map(loc => ({
          label: loc.countryName || loc.countrySubName || loc.countryCode
        }))}
        maxVisible={3}
      />
      <LocationGroup
        title="States"
        icon={MapIcon}
        items={stateLocs.map(loc => ({
          label: (
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
              <Box>{loc.stateName || loc.stateSubName}</Box>
              {(loc.countrySubName || loc.countryName) && (
                <Box component="span" sx={{ fontSize: '0.65rem', opacity: 0.8 }}>
                  ({loc.countrySubName || loc.countryName})
                </Box>
              )}
            </Box>
          )
        }))}
        maxVisible={4}
        chipProps={{ color: 'primary', size: 'small', variant: 'outlined' }}
      />
      <LocationGroup
        title="Cities"
        icon={LocationCityIcon}
        items={cityLocs.map(loc => ({
          label: (
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
              <Box>{loc.cityName}</Box>
              {(loc.stateSubName || loc.stateName) && (
                <Box component="span" sx={{ fontSize: '0.65rem', opacity: 0.8 }}>
                  ({loc.stateSubName || loc.stateName})
                </Box>
              )}
            </Box>
          )
        }))}
        maxVisible={5}
        chipProps={{ color: 'secondary', size: 'small', variant: 'outlined' }}
      />
    </Box>
  );
}
