import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Chip,
  IconButton,
  InputAdornment,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';

import {
  Clear,
  Search,
  SearchOff,
} from '@mui/icons-material';

import { DataGrid } from '@mui/x-data-grid';

import { useDebounce } from '../../hooks/useDebounce';
import { integrationApi } from '../../api/integrationApi';

/* -------------------------------------------------------------------------- */
/*                                   Columns                                  */
/* -------------------------------------------------------------------------- */

const BASE_COLUMNS = [
  {
    field: 'productId',
    headerName: 'Product Code',
    width: 110,
    maxWidth: 200,
    filterable: false,
    sortable: true
  },
  {
    field: 'productName',
    headerName: 'Product Name',
    flex: 1.5,
    minWidth: 130,
    maxWidth: 400,
    filterable: false,
    sortable: true
  },
  {
    field: 'divisionName',
    headerName: 'Division',
    flex: 1,
    minWidth: 90,
    maxWidth: 180,
    filterable: false,
    sortable: true
  },
  {
    field: 'manufacturerName',
    headerName: 'Manufacturer',
    flex: 1,
    minWidth: 100,
    maxWidth: 250,
    filterable: false,
    sortable: true
  },
];

/* -------------------------------------------------------------------------- */
/*                              Helper functions                              */
/* -------------------------------------------------------------------------- */

const EMPTY_FILTER_MODEL = {
  items: [],
};

const getFilters = (filterModel) => {
  const filters = {};

  filterModel?.items?.forEach((item) => {
    if (item.value?.trim()) {
      filters[item.field] = item.value.trim();
    }
  });

  return filters;
};

const getTotalElements = (data, contentLength) => {
  return (
    data?.page?.totalElements ??
    data?.totalElements ??
    data?.total ??
    contentLength
  );
};

/* -------------------------------------------------------------------------- */
/*                         Empty State Component                              */
/* -------------------------------------------------------------------------- */

function EmptyState({ hasFilters }) {
  return (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1,
        color: 'text.secondary',
        px: 2,
      }}
    >
      {hasFilters ? (
        <>
          <SearchOff sx={{ fontSize: 42, opacity: 0.45 }} />

          <Typography
            variant="body2"
            sx={{
              fontWeight: 600,
              color: 'text.primary',
            }}
          >
            No products found
          </Typography>

          <Typography
            variant="caption"
            sx={{
              textAlign: 'center',
              maxWidth: 320,
            }}
          >
            Try changing or clearing your search filters.
          </Typography>
        </>
      ) : (
        <>
          <Search
            sx={{
              fontSize: 42,
              opacity: 0.35,
            }}
          />

          <Typography
            variant="body2"
            sx={{
              fontWeight: 600,
              color: 'text.primary',
            }}
          >
            No computed products
          </Typography>

          <Typography
            variant="caption"
            sx={{
              textAlign: 'center',
              maxWidth: 320,
            }}
          >
            Products matching the configured rules will appear here.
          </Typography>
        </>
      )}
    </Box>
  );
}

/* -------------------------------------------------------------------------- */
/*                         ComputedProductsTable                              */
/* -------------------------------------------------------------------------- */

/**
 * ComputedProductsTable
 *
 * Modes:
 *
 * 1. Stored mode
 *    agreementVersionId
 *
 *    Fetches already-computed products from the backend.
 *
 * 2. Live mode
 *    productRules + version
 *
 *    Fetches products dynamically using integrationApi.searchProducts().
 */
export default function ComputedProductsTable({
  agreementVersionId,
  productRules,
  version,

  productNameKey = 'productName',
  divisionNameKey = 'divisionName',
  manufacturerNameKey = 'manufacturerName',

  sx,

  minHeight = 300,
  maxHeight = 600,
}) {
  /* ------------------------------------------------------------------------ */
  /*                                  State                                   */
  /* ------------------------------------------------------------------------ */

  const [rows, setRows] = useState([]);
  const [totalElements, setTotalElements] = useState(0);

  const [loading, setLoading] = useState(false);

  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  const [filterModel, setFilterModel] = useState(
    EMPTY_FILTER_MODEL
  );

  const [sortModel, setSortModel] = useState([]);

  const debouncedFilterModel = useDebounce(filterModel, 400);

  const useStoredMode = Boolean(agreementVersionId);

  /* ------------------------------------------------------------------------ */
  /*                              Filter helpers                              */
  /* ------------------------------------------------------------------------ */

  const activeFilters = useMemo(
    () => getFilters(debouncedFilterModel),
    [debouncedFilterModel]
  );

  const hasFilters = Object.keys(activeFilters).length > 0;

  /* ------------------------------------------------------------------------ */
  /*                            Parse product rules                            */
  /* ------------------------------------------------------------------------ */

  const parsedRules = useMemo(() => {
    let manufacturers =
      productRules?.manufacturers?.length
        ? productRules.manufacturers
        : version?.manufacturers || [];

    let divisionRules =
      productRules?.divisionRules?.length
        ? productRules.divisionRules
        : version?.divisionRules || [];

    let productRulesList =
      productRules?.productRules?.length
        ? productRules.productRules
        : version?.productRules || [];

    if (Array.isArray(productRules?.combinations) && productRules.combinations.length > 0) {
      manufacturers = productRules.combinations.map((c) => c.manufacturerId).filter(Boolean);
      divisionRules = productRules.combinations.flatMap((c) => c.divisionRules || []);
      productRulesList = productRules.combinations.flatMap((c) => c.productRules || []);
    }

    const manufacturerIds = manufacturers
      .map((manufacturer) =>
        typeof manufacturer === 'object' && manufacturer !== null
          ? manufacturer.id ?? manufacturer.manufacturerId
          : manufacturer
      )
      .filter(Boolean);

    const divisionIds = divisionRules
      .filter((rule) => rule.ruleType === 'INCLUDE')
      .map((rule) => rule.id)
      .filter(Boolean);

    const excludeDivisionIds = divisionRules
      .filter((rule) => rule.ruleType === 'EXCLUDE')
      .map((rule) => rule.id)
      .filter(Boolean);

    const excludeProductIds = productRulesList
      .filter((rule) => rule.ruleType === 'EXCLUDE')
      .map((rule) => rule.id)
      .filter(Boolean);

    return {
      manufacturerIds,
      divisionIds,
      excludeDivisionIds,
      excludeProductIds,
    };
  }, [productRules, version]);

  /* ------------------------------------------------------------------------ */
  /*                         Clear all filters                                */
  /* ------------------------------------------------------------------------ */

  const clearFilters = useCallback(() => {
    setFilterModel(EMPTY_FILTER_MODEL);
    setPage(0);
  }, []);

  /* ------------------------------------------------------------------------ */
  /*                         Column search handler                            */
  /* ------------------------------------------------------------------------ */

  const handleColumnSearch = useCallback((field, value) => {
    const trimmedValue = value.trimStart();

    setFilterModel((previous) => {
      const existingItems = previous.items.filter(
        (item) => item.field !== field
      );

      if (!trimmedValue) {
        return {
          ...previous,
          items: existingItems,
        };
      }

      return {
        ...previous,
        items: [
          ...existingItems,
          {
            id: field,
            field,
            operator: 'contains',
            value: trimmedValue,
          },
        ],
      };
    });

    // Reset pagination immediately.
    // This prevents fetching page N with a newly-entered filter.
    setPage(0);
  }, []);

  /* ------------------------------------------------------------------------ */
  /*                        Get current filter value                          */
  /* ------------------------------------------------------------------------ */

  const getFilterValue = useCallback(
    (field) => {
      const item = filterModel.items.find(
        (filter) => filter.field === field
      );

      return item?.value ?? '';
    },
    [filterModel]
  );

  /* ------------------------------------------------------------------------ */
  /*                          Fetch stored products                           */
  /* ------------------------------------------------------------------------ */

  const fetchStoredProducts = useCallback(async () => {
    if (!agreementVersionId) {
      setRows([]);
      setTotalElements(0);
      return;
    }

    setLoading(true);

    try {
      const filters = getFilters(debouncedFilterModel);

      const currentSort = sortModel?.[0];

      const response =
        await integrationApi.getComputedProducts(
          agreementVersionId,
          {
            page,
            size: pageSize,

            sort: currentSort?.field || '',
            direction: currentSort?.sort || '',

            ...filters,
          }
        );

      const data = response?.data ?? {};

      const content = Array.isArray(data.content)
        ? data.content
        : [];

      const mappedRows = content.map((item, index) => ({
        id: item.productId ?? `product-${index}`,

        productId: item.productId,

        productName:
          item.productNameSnapshot ??
          item.productName ??
          '',

        divisionName:
          item.divisionNameSnapshot ??
          item.divisionName ??
          '—',

        manufacturerName:
          item.manufacturerNameSnapshot ??
          item.manufacturerName ??
          '—',
      }));

      setRows(mappedRows);

      setTotalElements(
        getTotalElements(data, mappedRows.length)
      );
    } catch (error) {
      console.error(
        'Failed to fetch computed products:',
        error
      );

      setRows([]);
      setTotalElements(0);
    } finally {
      setLoading(false);
    }
  }, [
    agreementVersionId,
    debouncedFilterModel,
    page,
    pageSize,
    sortModel,
  ]);

  /* ------------------------------------------------------------------------ */
  /*                           Fetch live products                            */
  /* ------------------------------------------------------------------------ */

  const fetchLiveProducts = useCallback(async () => {
    if (!parsedRules.manufacturerIds.length) {
      setRows([]);
      setTotalElements(0);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const filters = getFilters(debouncedFilterModel);

      /*
       * IMPORTANT:
       *
       * searchProducts currently accepts a single searchKey.
       *
       * Therefore productId and productName cannot truly be
       * independent server-side filters unless the backend API
       * is changed to accept separate parameters.
       *
       * We use productName first and productId as fallback.
       */
      const searchKey =
        filters.productName ||
        filters.productId ||
        '';

      const response =
        await integrationApi.searchProducts({
          searchKey,

          manufacturerIds:
            parsedRules.manufacturerIds,

          divisionIds:
            parsedRules.divisionIds,

          excludeDivisionIds:
            parsedRules.excludeDivisionIds,

          excludeProductIds:
            parsedRules.excludeProductIds,

          page,
          size: pageSize,
        });

      const data = response?.data ?? {};

      const content = Array.isArray(data.content)
        ? data.content
        : Array.isArray(data)
          ? data
          : [];

      const mappedRows = content.map((item, index) => ({
        id:
          item.id ??
          item.productId ??
          `product-${index}`,

        productId:
          item.id ??
          item.productId,

        productName:
          item[productNameKey] ??
          item.productName ??
          item.name ??
          '',

        divisionName:
          item[divisionNameKey] ??
          item.divisionName ??
          '—',

        manufacturerName:
          item[manufacturerNameKey] ??
          item.manufacturerName ??
          '—',
      }));

      setRows(mappedRows);

      setTotalElements(
        getTotalElements(data, mappedRows.length)
      );
    } catch (error) {
      console.error(
        'Failed to fetch live computed products:',
        error
      );

      setRows([]);
      setTotalElements(0);
    } finally {
      setLoading(false);
    }
  }, [
    parsedRules,
    debouncedFilterModel,
    page,
    pageSize,
    productNameKey,
    divisionNameKey,
    manufacturerNameKey,
  ]);

  /* ------------------------------------------------------------------------ */
  /*                                Fetch data                                */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    if (useStoredMode) {
      fetchStoredProducts();
    } else {
      fetchLiveProducts();
    }
  }, [
    useStoredMode,
    fetchStoredProducts,
    fetchLiveProducts,
  ]);

  /* ------------------------------------------------------------------------ */
  /*                               DataGrid columns                           */
  /* ------------------------------------------------------------------------ */

  const columns = useMemo(() => {
    return BASE_COLUMNS.map((column) => ({
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

              // Space around the complete header
              px: 0.75,
              py: 0,

              // Space between label and search
              gap: 0,

              boxSizing: 'border-box',
            }}
          >
            {/* Column title */}
            <Typography
              variant="subtitle2"
              component="div"
              onClick={(e) => e.stopPropagation()}
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
                cursor: 'default',
              }}
            >
              {column.headerName}
            </Typography>

            {/* Column search */}
            <TextField
              variant="outlined"
              size="small"
              placeholder="Search..."
              value={value}
              onChange={(event) =>
                handleColumnSearch(
                  column.field,
                  event.target.value
                )
              }
              onClick={(event) => event.stopPropagation()}
              onMouseDown={(event) => event.stopPropagation()} // <-- CRITICAL FIX
              onKeyDown={(event) => event.stopPropagation()}
              sx={{
                bgcolor: 'background.paper',
                '& .MuiInputBase-root': { borderRadius: 1 },
                '& .MuiInputBase-input': { p: '6px 8px', fontSize: '0.75rem' }
              }}
              fullWidth
            />
          </Box>
        );
      },
    }));
  }, [
    getFilterValue,
    handleColumnSearch,
  ]);

  /* ------------------------------------------------------------------------ */
  /*                                  UI                                      */
  /* ------------------------------------------------------------------------ */

  return (
    <Box
      sx={{
        width: '100%',
        maxWidth: '100%',
        minWidth: 0,
        ...sx,
      }}
    >
      <Box
        sx={{
          width: '100%',

          /*
           * Use min/max constraints instead of a fixed height.
           */
          minHeight,
          height: 320,
          maxHeight,

          '& .MuiDataGrid-root': {
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 1.5,

            backgroundColor:
              'background.paper',

            overflow: 'hidden',
            fontSize: '0.8125rem',
          },
        }}
      >
        <DataGrid
          density="compact"
          rows={rows}
          columns={columns}

          getRowId={(row) => row.id}

          loading={loading}

          /* Server-side behavior */
          paginationMode="server"
          sortingMode="server"
          filterMode="server"

          rowCount={totalElements}

          /* Pagination */
          paginationModel={{
            page,
            pageSize,
          }}

          onPaginationModelChange={(model) => {
            setPage(model.page);
            setPageSize(model.pageSize);
          }}

          pageSizeOptions={[
            10,
            25,
            50,
          ]}

          /* Sorting */
          sortModel={sortModel}

          onSortModelChange={(model) => {
            setSortModel(model);

            // Sorting should start from first page.
            setPage(0);
          }}

          /*
           * We use our own search inputs in the
           * column headers.
           */
          filterModel={filterModel}

          onFilterModelChange={(model) => {
            setFilterModel(model);
            setPage(0);
          }}

          /* Header */
          columnHeaderHeight={85}

          /* General UX */
          disableRowSelectionOnClick
          disableColumnMenu
          disableColumnFilter
          disableColumnSelector

          checkboxSelection={false}

          density="compact"

          /* Empty state */
          slots={{
            noRowsOverlay: () => (
              <EmptyState
                hasFilters={hasFilters}
              />
            ),
          }}

          /* Styling */
          sx={{
            border: 'none',

            '& .MuiDataGrid-iconButtonContainer': {
              transform: 'scale(0.8)',
            },

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
    </Box>
  );
}
