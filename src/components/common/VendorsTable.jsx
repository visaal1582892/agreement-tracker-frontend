import React, { useMemo, useState, useCallback } from 'react';
import { Box, Typography, TextField } from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';

export default function VendorsTable({ vendors = [], vendorDetailsMap = {} }) {
  // Augment vendors with state from map if missing
  const rows = useMemo(() => {
    return vendors.map((v) => ({
      ...v,
      // Default to the explicitly provided state, fallback to the fetched details map
      state: v.state || vendorDetailsMap[v.vendorId] || '—',
    }));
  }, [vendors, vendorDetailsMap]);

  // Client-side filtering state
  const [filterModel, setFilterModel] = useState({ items: [] });

  const handleColumnSearch = useCallback((field, value) => {
    setFilterModel((prev) => {
      const existingFilter = prev.items.find((item) => item.field === field);
      const isNumberField = field === 'vendorId';

      if (value === '') {
        // Remove filter if empty
        return {
          ...prev,
          items: prev.items.filter((item) => item.field !== field),
        };
      }

      if (existingFilter) {
        // Update existing filter
        return {
          ...prev,
          items: prev.items.map((item) =>
            item.field === field ? { ...item, value } : item
          ),
        };
      }

      // Add new filter with explicit operator for MUI DataGrid client-side filtering
      return {
        ...prev,
        items: [
          ...prev.items,
          {
            id: field,
            field,
            operator: isNumberField ? 'equals' : 'contains',
            value,
          },
        ],
      };
    });
  }, []);

  const getFilterValue = useCallback(
    (field) => {
      const filter = filterModel.items.find((item) => item.field === field);
      return filter ? filter.value : '';
    },
    [filterModel]
  );

  const columns = useMemo(() => {
    const baseColumns = [
      { field: 'vendorId', headerName: 'Vendor ID', width: 120, filterable: false },
      { field: 'vendorName', headerName: 'Vendor Name', flex: 1, minWidth: 200, filterable: false, maxWidth: 300 },
      { field: 'state', headerName: 'State', maxWidth: 150, filterable: false },
    ];

    return baseColumns.map((column) => ({
      ...column,
      renderHeader: () => {
        const value = getFilterValue(column.field);

        return (
          <Box
            sx={{
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              px: 0.75,
              py: 0,
              gap: 0,
              boxSizing: 'border-box',
            }}
          >
            <Typography
              variant="subtitle2"
              component="div"
              sx={{
                width: '100%',
                fontSize: '0.78rem',
                lineHeight: 1.2,
                fontWeight: 700,
                color: 'text.primary',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                px: 0.25,
                mb: 1,
              }}
            >
              {column.headerName}
            </Typography>

            <TextField
              variant="outlined"
              size="small"
              placeholder="Search..."
              value={value}
              onChange={(event) => handleColumnSearch(column.field, event.target.value)}
              onClick={(event) => event.stopPropagation()}
              onMouseDown={(event) => event.stopPropagation()}
              onKeyDown={(event) => event.stopPropagation()}
              sx={{
                bgcolor: 'background.paper',
                '& .MuiInputBase-root': { borderRadius: 1 },
                '& .MuiInputBase-input': { p: '6px 8px', fontSize: '0.75rem' },
              }}
              fullWidth
            />
          </Box>
        );
      },
    }));
  }, [getFilterValue, handleColumnSearch]);

  return (
    <Box
      sx={{
        width: '100%',
        height: 320,
        minWidth: 0,
        '& .MuiDataGrid-root': {
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 1.5,
          backgroundColor: 'background.paper',
          overflow: 'hidden',
          fontSize: '0.8125rem',
        },
      }}
    >
      <DataGrid
        density="compact"
        rows={rows}
        columns={columns}
        getRowId={(row) => row.vendorId ?? row.id}
        initialState={{
          pagination: { paginationModel: { pageSize: 10, page: 0 } },
        }}
        pageSizeOptions={[5, 10, 25, 50]}
        disableColumnMenu
        filterMode="client"
        filterModel={filterModel}
        onFilterModelChange={(newModel) => setFilterModel(newModel)}
        hideFooterSelectedRowCount
        columnHeaderHeight={85}
        disableRowSelectionOnClick
        sx={{
          border: 'none',

          '& .MuiDataGrid-columnHeaders': {
            backgroundColor: (theme) =>
              theme.palette.mode === 'dark'
                ? '#172033'
                : '#f8fafc',

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
            transition:
              'background-color 0.12s ease',

            '&:hover': {
              backgroundColor: (theme) =>
                theme.palette.mode === 'dark'
                  ? 'rgba(255,255,255,0.035)'
                  : 'rgba(0,0,0,0.025)',
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

          '& .MuiDataGrid-overlay': {
            backgroundColor: 'background.paper',
          },

          '& .MuiCircularProgress-root': {
            color: 'primary.main',
          },
        }}
      />
    </Box>
  );
}
