import React from 'react';
import { Box } from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import { formatAssetMoney } from '../../../utils/numberFormatting';

const assetPayoutColumns = [
  { field: 'periodMonths', headerName: 'Period (Months)', width: 150 },
  { field: 'payoutPerStore', headerName: 'Payout per Store', width: 180, renderCell: (params) => formatAssetMoney(params.row.payoutPerStore) },
];

export default function AssetPayoutPeriodsTable({ periods = [] }) {
  const shouldHideFooter = periods.length <= 10;

  return (
    <Box
      sx={{
        width: '100%',
        mt: 1,
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider',
        overflow: 'hidden',
        boxShadow: '0px 1px 3px rgba(0, 0, 0, 0.05)',
      }}
    >
      <DataGrid
        rows={periods}
        columns={assetPayoutColumns}
        getRowId={(row, index) => row.id || (row.periodMonths ? `${row.periodMonths}-${index}` : index)}
        autoHeight={true}
        hideFooter={shouldHideFooter}
        hideFooterPagination={shouldHideFooter}
        initialState={{
          pagination: { paginationModel: { pageSize: 10, page: 0 } },
        }}
        pageSizeOptions={[10, 25]}
        disableColumnMenu
        disableRowSelectionOnClick
        disableColumnFilter
        disableColumnSelector
        density="compact"
        sx={{
          border: 'none',
          '& .MuiDataGrid-iconButtonContainer': {
            transform: 'scale(0.8)',
          },
          '& .MuiDataGrid-columnHeaders': {
            backgroundColor: (theme) => theme.palette.mode === 'dark' ? '#172033' : '#f8fafc',
            borderBottom: '1px solid',
            borderColor: 'divider',
          },
          '& .MuiDataGrid-columnHeader': {
            px: 1.25,
            '&:focus, &:focus-within': {
              outline: 'none',
            },
          },
          '& .MuiDataGrid-columnHeaderTitleContainer': {
            width: '100%',
            height: '100%',
            padding: 0,
            overflow: 'visible',
          },
          '& .MuiDataGrid-columnHeaderTitle': {
            fontWeight: 700,
          },
          '& .MuiDataGrid-cell': {
            px: 1.5,
            fontSize: '0.8rem',
            borderBottom: 'none',
            '&:focus, &:focus-within': {
              outline: 'none',
            },
          },
          '& .MuiDataGrid-row': {
            borderBottom: 'none',
            transition: 'background-color 0.12s ease',
            '&:hover': {
              backgroundColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.025)',
            },
          },
          '& .MuiDataGrid-footerContainer': {
            minHeight: 46,
            borderTop: '1px solid',
            borderColor: 'divider',
          },
          '& .MuiTablePagination-root': {
            fontSize: '0.75rem',
          },
        }}
      />
    </Box>
  );
}
