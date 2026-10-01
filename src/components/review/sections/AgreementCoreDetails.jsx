import React from 'react';
import { Box, Typography } from '@mui/material';
import dayjs from 'dayjs';

import { formatCommercialValue } from '../../../utils/numberFormatting';
import { formatTenureFromDates } from '../../forms/DateRangeFields';
import GeographyLimitsDetails from './GeographyLimitsDetails';

function DetailItem({ label, value, highlight = false }) {
  return (
    <Box
      sx={{
        minWidth: 0,
        px: 1.5,
        py: 1.25,
        borderRadius: 1.5,
        backgroundColor: highlight
          ? 'rgba(25, 118, 210, 0.04)'
          : 'transparent',
        border: '1px solid',
        borderColor: highlight
          ? 'rgba(25, 118, 210, 0.14)'
          : 'transparent',
        transition: 'background-color 0.2s ease',

        '&:hover': {
          backgroundColor: highlight
            ? 'rgba(25, 118, 210, 0.06)'
            : 'action.hover',
        },
      }}
    >
      <Typography
        variant="caption"
        sx={{
          display: 'block',
          mb: 0.5,
          fontSize: '0.68rem',
          fontWeight: 700,
          letterSpacing: 0.65,
          textTransform: 'uppercase',
          color: 'text.secondary',
          lineHeight: 1.2,
        }}
      >
        {label}
      </Typography>

      <Typography
        variant="body2"
        sx={{
          fontWeight: highlight ? 700 : 600,
          color: highlight ? 'primary.main' : 'text.primary',
          lineHeight: 1.5,
          wordBreak: 'break-word',
        }}
      >
        {value || '—'}
      </Typography>
    </Box>
  );
}

function HeaderDetail({ label, value }) {
  if (!value) return null;

  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography
        variant="caption"
        sx={{
          display: 'block',
          mb: 0.4,
          fontSize: '0.68rem',
          fontWeight: 700,
          letterSpacing: 0.7,
          textTransform: 'uppercase',
          color: 'text.secondary',
        }}
      >
        {label}
      </Typography>

      <Typography
        variant="body2"
        sx={{
          fontWeight: 600,
          color: 'text.primary',
          lineHeight: 1.5,
          wordBreak: 'break-word',
        }}
      >
        {value}
      </Typography>
    </Box>
  );
}

export default function AgreementCoreDetails({
  agreementName,
  groupName,
  ownerName,
  incomeTypeName,
  agreementTypeName,
  startDate,
  expiryDate,
  commercialStructure,
  commercialValue,
  flatValueType,
  isAssetRental,
  notes,
  locations,
  legacyStates,
  legacyCities,
  geographyMode,
}) {
  const tenure =
    startDate && expiryDate
      ? formatTenureFromDates(startDate, expiryDate)
      : null;

  const formattedStartDate = startDate
    ? dayjs(startDate).format('DD MMM YYYY')
    : null;

  const formattedExpiryDate = expiryDate
    ? dayjs(expiryDate).format('DD MMM YYYY')
    : null;

  const formattedCommercialValue =
    !isAssetRental && commercialStructure === 'FLAT'
      ? formatCommercialValue(commercialValue, flatValueType)
      : null;

  /*
   * Geography should only be rendered when:
   * 1. The agreement is NOT an asset rental
   * 2. There is actually some geography data
   */
  const hasGeography =
    !isAssetRental &&
    (
      (Array.isArray(locations) && locations.length > 0) ||
      (Array.isArray(legacyStates) && legacyStates.length > 0) ||
      (Array.isArray(legacyCities) && legacyCities.length > 0)
    );

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 3,
      }}
    >
      {/* =====================================================
          MAIN CONTENT
      ===================================================== */}
      <Box
        sx={{
          display: 'grid',

          /*
           * Two columns only when geography exists.
           * Otherwise Core Details gets the full width.
           */
          gridTemplateColumns: hasGeography
            ? {
              xs: '1fr',
              lg: 'minmax(0, 1.65fr) minmax(280px, 1fr)',
            }
            : '1fr',

          gap: {
            xs: 2,
            lg: 3,
          },

          alignItems: 'start',
        }}
      >
        {/* =================================================
            CORE DETAILS
        ================================================= */}
        <Box
          sx={{
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 2,
            overflow: 'hidden',
            backgroundColor: 'background.paper',
          }}
        >
          {/* Header */}
          <Box
            sx={{
              px: 2,
              py: 1.5,
              backgroundColor: 'action.hover',
              borderBottom: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Typography
              variant="subtitle2"
              sx={{
                fontWeight: 700,
                color: 'text.primary',
              }}
            >
              Core Details
            </Typography>
          </Box>

          {/* Owner + Agreement Name */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                sm: 'minmax(150px, 0.65fr) minmax(0, 2fr)',
              },
              gap: {
                xs: 1.5,
                sm: 3,
              },
              px: 1.5,
              py: 1.5,
              borderBottom: '1px solid',
              borderColor: 'divider',
            }}
          >
            <HeaderDetail
              label="Owner"
              value={ownerName}
            />

            <HeaderDetail
              label="Agreement Name"
              value={agreementName}
            />
          </Box>

          {/* Details Grid */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                sm: 'repeat(2, minmax(0, 1fr))',
                md: 'repeat(3, minmax(0, 1fr))',
              },
              gap: 0.75,
              p: 1,
            }}
          >
            <DetailItem
              label="Agreement Group"
              value={groupName}
            />

            <DetailItem
              label="Income Type"
              value={incomeTypeName}
            />

            <DetailItem
              label="Agreement Type"
              value={agreementTypeName}
            />

            <DetailItem
              label="Start Date"
              value={formattedStartDate}
            />

            <DetailItem
              label="Expiry Date"
              value={formattedExpiryDate}
            />

            {tenure && (
              <DetailItem
                label="Tenure"
                value={tenure}
              />
            )}

            {!isAssetRental && commercialStructure && (
              <DetailItem
                label="Structure"
                value={commercialStructure}
              />
            )}

            {!isAssetRental &&
              commercialStructure === 'FLAT' && (
                <DetailItem
                  label="Commercial Value"
                  value={formattedCommercialValue}
                  highlight
                />
              )}
          </Box>
        </Box>

        {/* =================================================
            GEOGRAPHICAL SCOPE
        ================================================= */}
        {hasGeography && (
          <Box
            sx={{
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 2,
              overflow: 'hidden',
              backgroundColor: 'background.paper',
            }}
          >
            {/* Geography Header */}
            <Box
              sx={{
                px: 2,
                py: 1.5,
                backgroundColor: 'action.hover',
                borderBottom: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Typography
                variant="subtitle2"
                sx={{
                  fontWeight: 700,
                  color: 'text.primary',
                }}
              >
                Geographical Scope
              </Typography>
            </Box>

            {/* Geography Content */}
            <Box
              sx={{
                px: 2,
                py: 2,
              }}
            >
              <GeographyLimitsDetails
                locations={locations}
                legacyStates={legacyStates}
                legacyCities={legacyCities}
                geographyMode={geographyMode}
              />
            </Box>
          </Box>
        )}
      </Box>

      {/* =====================================================
          NOTES
      ===================================================== */}
      {notes && (
        <Box
          sx={{
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 2,
            overflow: 'hidden',
            backgroundColor: 'background.paper',
          }}
        >
          <Box
            sx={{
              px: 2,
              py: 1.25,
              backgroundColor: 'action.hover',
              borderBottom: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Typography
              variant="caption"
              sx={{
                fontSize: '0.7rem',
                fontWeight: 700,
                letterSpacing: 0.7,
                textTransform: 'uppercase',
              }}
            >
              Notes
            </Typography>
          </Box>

          <Typography
            variant="body2"
            sx={{
              px: 2,
              py: 1.75,
              color: 'text.primary',
              lineHeight: 1.6,
              whiteSpace: 'pre-wrap',
            }}
          >
            {notes}
          </Typography>
        </Box>
      )}
    </Box>
  );
}