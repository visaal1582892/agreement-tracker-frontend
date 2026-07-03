import {
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TablePagination, TableSortLabel, Paper, Box, Typography,
  CircularProgress, TextField, InputAdornment, MenuItem, Select,
  FormControl,
} from '@mui/material';
import { Search } from '@mui/icons-material';
import { BRAND } from '../../config/theme';
import SearchableSelect from '../forms/SearchableSelect';
import DateRangeFilter from '../forms/DateRangeFilter';
import TruncatedText from './TruncatedText';

/**
 * Reusable DataTable with:
 *  - Server-side pagination  (page / rowsPerPage / totalCount / onPageChange)
 *  - Server-side sorting     (sortBy / sortDir / onSort)
 *  - Column-level filter row (column.filterType: 'text' | 'select' | 'searchable-select' | none)
 *  - Top global search       (optional)
 *
 * Column definition shape:
 *   {
 *     field: string,           // data key
 *     header: string,          // display label
 *     width?: string | number,
 *     sortable?: boolean,       // default true
 *     filterType?: 'text' | 'select' | 'searchable-select' | 'date-range-picker' | null,
 *     filterKeyFrom?: string,
 *     filterKeyTo?: string,
 *     filterOptions?: [{ value, label } | object],  // for 'select' / 'searchable-select'
 *     onFilterSearch?: (query: string) => void,
 *     filterLoading?: boolean,
 *     getOptionLabel?: (option) => string,
 *     filterKey?: string,       // override filter key (default = field)
 *     render?: (value, row) => ReactNode,
 *     truncate?: boolean,        // default true — single line + ellipsis + tooltip
 *     getTooltip?: (value, row) => string,
 *     stickyRight?: boolean,     // pin column on right during horizontal scroll
 *   }
 *
 * horizontalScroll — table grows to fit content; container scrolls left/right
 */

function buildStickyRightOffsets(columns) {
  const offsets = {};
  let right = 0;
  for (let i = columns.length - 1; i >= 0; i -= 1) {
    const col = columns[i];
    if (!col.stickyRight) continue;
    offsets[col.field] = right;
    right += stickyColumnWidth(col);
  }
  return offsets;
}

function stickyColumnWidth(col) {
  return col.width ?? col.minWidth ?? 0;
}

/** Opaque hover — theme row hover uses alpha() which bleeds scroll content through sticky cells */
const STICKY_BODY_BG = '#ffffff';
const STICKY_BODY_HOVER_BG = '#fff8f8';
const STICKY_FILTER_BG = '#ffffff';

function stickyCellSx(col, stickyOffsets, { isHeader = false, isFilter = false, stickyHeader = false } = {}) {
  const right = stickyOffsets[col.field];
  if (right == null) return {};

  const isLeftEdge = right > 0;
  let zIndex = 10;
  if (isFilter) zIndex = 11;
  if (isHeader) zIndex = stickyHeader ? 13 : 12;

  const bg = isHeader ? BRAND.bgGray : (isFilter ? STICKY_FILTER_BG : STICKY_BODY_BG);

  return {
    position: 'sticky',
    right,
    zIndex,
    bgcolor: bg,
    backgroundImage: 'none',
    ...(isLeftEdge ? { borderLeft: `1px solid ${BRAND.borderLight}` } : {}),
    ...(!isHeader && !isFilter ? {
      '.MuiTableRow-hover:hover &': {
        bgcolor: STICKY_BODY_HOVER_BG,
        backgroundImage: 'none',
      },
    } : {}),
  };
}

function renderCellContent(col, row, horizontalScroll) {
  const value = row[col.field];

  if (col.render) {
    return col.render(value, row);
  }

  if (col.truncate === false || horizontalScroll) {
    return value ?? '—';
  }

  const display = value ?? '—';
  const tooltip = col.getTooltip?.(value, row) ?? (display != null ? String(display) : '');

  return (
    <TruncatedText title={tooltip}>
      {display}
    </TruncatedText>
  );
}

const columnSizeSx = (col, horizontalScroll) => {
  if (col.stickyRight) {
    const w = stickyColumnWidth(col);
    return {
      whiteSpace: 'nowrap',
      width: w,
      minWidth: w,
      maxWidth: w,
      boxSizing: 'border-box',
    };
  }

  if (horizontalScroll) {
    const min = col.minWidth ?? col.width;
    return {
      whiteSpace: 'nowrap',
      ...(min != null ? { minWidth: min } : {}),
    };
  }

  return {
    ...(col.width != null ? { width: col.width, maxWidth: col.width } : {}),
    ...(col.minWidth != null ? { minWidth: col.minWidth } : {}),
  };
};

const cellSx = (col, horizontalScroll, stickyOffsets, stickyHeader) => ({
  py: 1.2,
  ...columnSizeSx(col, horizontalScroll),
  ...(!horizontalScroll ? { overflow: 'hidden' } : {}),
  ...stickyCellSx(col, stickyOffsets, { stickyHeader }),
});

export default function DataTable({
  columns,
  rows,
  loading,
  totalCount,
  page,
  rowsPerPage,
  onPageChange,
  onRowsPerPageChange,
  onRowClick,
  sortBy,
  sortDir,
  onSort,
  filters = {},
  onFilterChange,
  searchValue,
  onSearch,
  rowsPerPageOptions = [10, 20, 50],
  emptyMessage = 'No records found',
  stickyHeader = true,
  horizontalScroll = false,
  hidePagination = false,
}) {
  const hasFilters = columns.some((c) => c.filterType);
  const stickyOffsets = buildStickyRightOffsets(columns);

  const resolveSearchableValue = (col, key) => {
    const raw = filters[key];
    if (!raw) return null;
    const options = col.filterOptions || [];
    return options.find((o) => String(o.id) === String(raw)) ?? { id: raw };
  };

  return (
    <Box>
      {onSearch !== undefined && (
        <Box sx={{ mb: 2 }}>
          <TextField
            size="small"
            placeholder="Search…"
            value={searchValue}
            onChange={(e) => onSearch(e.target.value)}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <Search fontSize="small" />
                  </InputAdornment>
                ),
              },
            }}
            sx={{ width: 280 }}
          />
        </Box>
      )}

      <TableContainer
        component={Paper}
        elevation={0}
        sx={{
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'divider',
          overflowX: 'auto',
          overflowY: 'auto',
        }}
      >
        <Table
          size="small"
          stickyHeader={stickyHeader}
          sx={
            horizontalScroll
              ? { tableLayout: 'auto', width: 'max-content', minWidth: '100%' }
              : { tableLayout: 'fixed', width: '100%' }
          }
        >
          <colgroup>
            {columns.map((col) => (
              <col
                key={col.field}
                style={col.stickyRight ? { width: stickyColumnWidth(col) } : undefined}
              />
            ))}
          </colgroup>
          <TableHead>
            {/* ── Column Headers ── */}
            <TableRow>
              {columns.map((col) => (
                <TableCell
                  key={col.field}
                  width={col.stickyRight ? stickyColumnWidth(col) : (horizontalScroll ? undefined : col.width)}
                  sx={{
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                    bgcolor: BRAND.bgGray,
                    ...columnSizeSx(col, horizontalScroll),
                    ...stickyCellSx(col, stickyOffsets, { isHeader: true, stickyHeader }),
                  }}
                >
                  {col.sortable !== false && onSort ? (
                    <TableSortLabel
                      active={sortBy === col.field}
                      direction={sortBy === col.field ? sortDir : 'asc'}
                      onClick={() => onSort(col.field)}
                    >
                      {col.header}
                    </TableSortLabel>
                  ) : (
                    col.header
                  )}
                </TableCell>
              ))}
            </TableRow>

            {/* ── Filter Row ── */}
            {hasFilters && onFilterChange && (
              <TableRow>
                {columns.map((col) => {
                  const key = col.filterKey || col.field;
                  return (
                    <TableCell
                      key={col.field}
                      sx={{
                        py: 0.5,
                        px: 1,
                        bgcolor: '#fff',
                        borderBottom: `1px solid ${BRAND.borderLight}`,
                        ...columnSizeSx(col, horizontalScroll),
                        ...stickyCellSx(col, stickyOffsets, { isFilter: true, stickyHeader }),
                      }}
                    >
                      {col.filterType === 'text' && (
                        <TextField
                          size="small"
                          variant="outlined"
                          placeholder={`Filter ${col.header}`}
                          value={filters[key] ?? ''}
                          onChange={(e) => onFilterChange(key, e.target.value)}
                          sx={{
                            '& .MuiOutlinedInput-root': { fontSize: '0.78rem', borderRadius: 1.5 },
                            width: '100%',
                            minWidth: 80,
                          }}
                        />
                      )}
                      {col.filterType === 'select' && (
                        <FormControl size="small" fullWidth>
                          <Select
                            value={filters[key] ?? ''}
                            onChange={(e) => onFilterChange(key, e.target.value)}
                            displayEmpty
                            sx={{ fontSize: '0.78rem', borderRadius: 1.5 }}
                          >
                            <MenuItem value="">
                              <em>All</em>
                            </MenuItem>
                            {(col.filterOptions || []).map((opt) => (
                              <MenuItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      )}
                      {col.filterType === 'searchable-select' && (
                        <SearchableSelect
                          value={resolveSearchableValue(col, key)}
                          onChange={(opt) => onFilterChange(key, opt?.id ?? '')}
                          options={col.filterOptions || []}
                          onSearch={col.onFilterSearch}
                          loading={col.filterLoading}
                          getOptionLabel={col.getOptionLabel}
                          placeholder={`Filter ${col.header}`}
                          disabled={false}
                        />
                      )}
                      {col.filterType === 'date-range-picker' && (
                        <DateRangeFilter
                          fromKey={col.filterKeyFrom}
                          toKey={col.filterKeyTo}
                          filters={filters}
                          onFilterChange={onFilterChange}
                          label={`${col.header} range`}
                        />
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            )}
          </TableHead>

          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={columns.length} align="center" sx={{ py: 6 }}>
                  <CircularProgress size={28} color="primary" />
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} align="center" sx={{ py: 6 }}>
                  <Typography variant="body2" color="text.secondary">
                    {emptyMessage}
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row, idx) => (
                <TableRow
                  key={row.id ?? idx}
                  hover={!!onRowClick}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  sx={{ cursor: onRowClick ? 'pointer' : 'default' }}
                >
                  {columns.map((col) => (
                    <TableCell key={col.field} sx={cellSx(col, horizontalScroll, stickyOffsets, stickyHeader)}>
                      {renderCellContent(col, row, horizontalScroll)}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {!hidePagination && totalCount !== undefined && (
        <TablePagination
          component="div"
          count={totalCount}
          page={page}
          rowsPerPage={rowsPerPage}
          onPageChange={onPageChange}
          onRowsPerPageChange={onRowsPerPageChange}
          rowsPerPageOptions={rowsPerPageOptions}
          sx={{ borderTop: `1px solid ${BRAND.borderLight}` }}
        />
      )}
    </Box>
  );
}
