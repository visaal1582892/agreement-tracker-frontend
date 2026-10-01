import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  FormHelperText,
  IconButton,
  InputBase,
  Paper,
  Popover,
  Portal,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { KeyboardArrowDown, Close, DeleteSweep } from '@mui/icons-material';
import { BRAND } from '../../config/theme';
import { useDebounce } from '../../hooks/useDebounce';

const SEARCH_DEBOUNCE_MS = 300;
const DEFAULT_MAX_VISIBLE_CHIPS = 1;

/**
 * UnifiedSelect — a single component for all select-field use cases:
 *
 *  multiple=false  searchable=true   → Single search-select
 *  multiple=false  searchable=false  → Single static dropdown
 *  multiple=true   searchable=true   → Multi search-select
 *  multiple=true   searchable=false  → Multi static dropdown
 *
 * showOptionsOnEmpty:
 *  false (default) → show emptyQueryText hint until user types
 *  true            → show options immediately on open
 */
export default function UnifiedSelect({
  multiple = false,
  searchable = true,
  showOptionsOnEmpty = false,
  options = [],
  value,
  onChange,
  onSearch,
  getOptionLabel = (o) => o?.label || o?.name || String(o ?? ''),
  renderOption,
  isOptionEqualToValue = (o, v) =>
    o?.code && v?.code ? o.code === v.code : o?.id === v?.id,
  label,
  placeholder,
  loading = false,
  disabled = false,
  required = false,
  error,
  helperText,
  maxVisibleChips = DEFAULT_MAX_VISIBLE_CHIPS,
  noOptionsText = 'No results found',
  emptyQueryText = 'Type to search…',
  onPaste,
  clearOnSelect = true,
}) {
  const resolvedPlaceholder = placeholder ?? (searchable ? 'Search & select…' : 'Select…');

  const listboxId = useId();
  const containerRef = useRef(null);
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);

  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [moreAnchor, setMoreAnchor] = useState(null);
  const [popoverSearch, setPopoverSearch] = useState('');
  const [dropdownPosition, setDropdownPosition] = useState(null);

  const debouncedQuery = useDebounce(searchQuery, SEARCH_DEBOUNCE_MS);

  const selectedItems = useMemo(() => {
    if (multiple) return Array.isArray(value) ? value : [];
    return value ? [value] : [];
  }, [multiple, value]);

  const visibleChips = multiple ? selectedItems.slice(0, maxVisibleChips) : [];
  const hiddenCount = multiple ? Math.max(0, selectedItems.length - maxVisibleChips) : 0;

  const onSearchRef = useRef(onSearch);
  useEffect(() => { onSearchRef.current = onSearch; }, [onSearch]);

  const lastNotifiedQueryRef = useRef(null);
  useEffect(() => {
    if (!onSearchRef.current) return;
    if (lastNotifiedQueryRef.current === debouncedQuery) return;
    lastNotifiedQueryRef.current = debouncedQuery;
    onSearchRef.current(debouncedQuery);
  }, [debouncedQuery]);

  const displayedOptions = useMemo(() => {
    let opts = options;
    if (multiple) {
      opts = opts.filter((o) => !selectedItems.some((s) => isOptionEqualToValue(o, s)));
    }
    if (!onSearch && searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      opts = opts.filter((o) => getOptionLabel(o).toLowerCase().includes(q));
    }
    return opts;
  }, [options, multiple, selectedItems, isOptionEqualToValue, getOptionLabel, onSearch, searchQuery]);

  const shouldShowOptions = useMemo(
    () => !searchable || showOptionsOnEmpty || Boolean(searchQuery.trim()),
    [searchable, showOptionsOnEmpty, searchQuery],
  );

  const closeDropdown = useCallback(() => {
    setIsOpen(false);
    setHighlightedIndex(-1);
  }, []);

  const openDropdown = useCallback(() => {
    if (disabled) return;
    setIsOpen(true);
  }, [disabled]);

  useLayoutEffect(() => {
    if (!isOpen || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setDropdownPosition({ top: rect.bottom + 4, left: rect.left, width: rect.width });
  }, [isOpen, selectedItems]);

  useEffect(() => {
    if (moreAnchor && (hiddenCount === 0 || !moreAnchor.isConnected)) {
      setMoreAnchor(null);
      setPopoverSearch('');
    }
  }, [hiddenCount, moreAnchor]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const handle = (e) => {
      if (e?.type === 'scroll' && dropdownRef.current?.contains(e.target)) return;
      closeDropdown();
    };
    window.addEventListener('resize', handle);
    window.addEventListener('scroll', handle, true);
    return () => {
      window.removeEventListener('resize', handle);
      window.removeEventListener('scroll', handle, true);
    };
  }, [isOpen, closeDropdown]);

  useEffect(() => {
    const handle = (e) => {
      const inField = containerRef.current?.contains(e.target);
      const inDropdown = dropdownRef.current?.contains(e.target);
      const inPopover = moreAnchor?.contains(e.target);
      if (!inField && !inDropdown && !inPopover) {
        closeDropdown();
        if (!multiple && value) setSearchQuery('');
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [closeDropdown, moreAnchor, multiple, value]);

  const selectOption = useCallback(
    (option) => {
      if (!option) return;
      if (multiple) {
        onChange?.([...selectedItems, option]);
        if (clearOnSelect) setSearchQuery('');
        setHighlightedIndex(-1);
        inputRef.current?.focus();
      } else {
        onChange?.(option);
        if (clearOnSelect) setSearchQuery('');
        closeDropdown();
      }
    },
    [multiple, onChange, selectedItems, closeDropdown, clearOnSelect],
  );

  const removeItem = useCallback(
    (item) => {
      if (!multiple) { onChange?.(null); return; }
      const nextItems = selectedItems.filter((s) => !isOptionEqualToValue(s, item));
      if (nextItems.length <= maxVisibleChips) { setMoreAnchor(null); setPopoverSearch(''); }
      onChange?.(nextItems);
    },
    [multiple, onChange, selectedItems, isOptionEqualToValue, maxVisibleChips],
  );

  const clearAll = useCallback(() => {
    onChange?.(multiple ? [] : null);
    setMoreAnchor(null);
    setPopoverSearch('');
    setSearchQuery('');
    setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
  }, [multiple, onChange]);

  const handleInputChange = (e) => {
    setSearchQuery(e.target.value);
    setHighlightedIndex(-1);
    openDropdown();
  };

  const handleInputFocus = () => {
    openDropdown();
    // Chip shows the selected value; don't pre-fill the search input
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') { closeDropdown(); if (!multiple && value) setSearchQuery(''); return; }
    if (!isOpen && (e.key === 'ArrowDown' || e.key === 'Enter')) { openDropdown(); return; }
    if (!isOpen) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((i) => Math.min(i + 1, displayedOptions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && highlightedIndex >= 0) {
      e.preventDefault();
      selectOption(displayedOptions[highlightedIndex]);
    }
  };

  // For single-select the input always shows the raw search query (selected value is shown as a chip).
  const inputDisplayValue = searchQuery;

  const popoverFilteredItems = useMemo(() => {
    if (!popoverSearch.trim()) return selectedItems;
    const q = popoverSearch.toLowerCase();
    return selectedItems.filter((item) => getOptionLabel(item).toLowerCase().includes(q));
  }, [selectedItems, popoverSearch, getOptionLabel]);

  const chipColor = BRAND.red;
  const borderColor = error ? BRAND.red : isOpen ? BRAND.red : BRAND.borderLight;

  const hasSingleValue = !multiple && Boolean(value) && (!Array.isArray(value) || value.length > 0);
  const singleValueObj = hasSingleValue ? (Array.isArray(value) ? value[0] : value) : null;
  const singleValueLabel = singleValueObj ? getOptionLabel(singleValueObj) : '';

  return (
    <Box
      ref={containerRef}
      sx={{ position: 'relative', width: '100%', overflow: 'visible', zIndex: isOpen ? 25 : 'auto' }}
    >
      {label && (
        <Typography
          component="label"
          variant="caption"
          sx={{ display: 'block', mb: 0.5, fontWeight: 600, color: error ? BRAND.red : BRAND.textSecondary }}
        >
          {label}
          {required && <Box component="span" sx={{ color: BRAND.red, ml: 0.25 }}>*</Box>}
        </Typography>
      )}

      <Box
        onClick={() => {
          if (disabled) return;
          if (hasSingleValue) return;
          if (searchable) inputRef.current?.focus();
          else openDropdown();
        }}
        sx={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'nowrap',
          gap: 0.75,
          minHeight: 40,
          px: 1.25,
          py: 0.5,
          borderRadius: '8px',
          border: `1px solid ${borderColor}`,
          borderWidth: isOpen ? 2 : 1,
          bgcolor: disabled ? alpha(BRAND.bgGray, 0.6) : BRAND.white,
          cursor: disabled ? 'not-allowed' : (hasSingleValue ? 'default' : (searchable ? 'text' : 'pointer')),
          transition: 'all 0.15s ease-in-out',
          boxShadow: isOpen ? `0 0 0 3px ${alpha(chipColor, 0.15)}` : 'none',
          '&:hover': disabled ? {} : { borderColor: isOpen ? chipColor : '#94A3B8' },
        }}
      >
        {/* Multi: overflow-hidden chips + always-visible +N badge */}
        {multiple && selectedItems.length > 0 && (
          <>
            <Box
              sx={{
                display: 'flex', alignItems: 'center', gap: 0.5,
                overflow: 'hidden', flex: '0 1 auto', minWidth: 0,
              }}
            >
              {visibleChips.map((item) => {
                const lbl = getOptionLabel(item);
                return (
                  <Tooltip key={item.code || item.id || lbl} title={lbl} arrow placement="top">
                    <Chip
                      label={lbl}
                      size="small"
                      onDelete={disabled ? undefined : () => removeItem(item)}
                      sx={{
                        height: 26, maxWidth: 200, fontSize: '0.78rem', fontWeight: 600, flexShrink: 0,
                        bgcolor: alpha(chipColor, 0.1), color: chipColor,
                        border: `1px solid ${alpha(chipColor, 0.2)}`,
                        '& .MuiChip-label': { px: 1, textOverflow: 'ellipsis', overflow: 'hidden' },
                        '& .MuiChip-deleteIcon': { color: alpha(chipColor, 0.7), fontSize: 15, '&:hover': { color: chipColor } },
                      }}
                    />
                  </Tooltip>
                );
              })}
            </Box>

            {hiddenCount > 0 && (
              <Tooltip title="Click to view all selected items" arrow placement="top">
                <Chip
                  label={`+${hiddenCount} more`}
                  size="small"
                  onClick={(e) => { e.stopPropagation(); setMoreAnchor(e.currentTarget); }}
                  sx={{
                    height: 26, flexShrink: 0, cursor: 'pointer',
                    fontSize: '0.75rem', fontWeight: 700,
                    bgcolor: alpha(chipColor, 0.18), color: chipColor,
                    border: `1px solid ${alpha(chipColor, 0.35)}`,
                    transition: 'all 0.15s ease',
                    '&:hover': { bgcolor: chipColor, color: '#fff', transform: 'scale(1.04)' },
                  }}
                />
              </Tooltip>
            )}
          </>
        )}

        {/* Single-select chip — shown whenever a value is selected (searchable or not) */}
        {hasSingleValue && (
          <Tooltip title={singleValueLabel} arrow placement="top">
            <Chip
              label={singleValueLabel}
              size="small"
              onDelete={disabled ? undefined : clearAll}
              sx={{
                height: 26,
                maxWidth: 'calc(100% - 24px)',
                fontSize: '0.78rem',
                fontWeight: 600,
                flexShrink: 1,
                bgcolor: alpha(chipColor, 0.1),
                color: chipColor,
                border: `1px solid ${alpha(chipColor, 0.25)}`,
                '& .MuiChip-label': { px: 1, textOverflow: 'ellipsis', overflow: 'hidden' },
                '& .MuiChip-deleteIcon': { color: alpha(chipColor, 0.7), fontSize: 15, '&:hover': { color: chipColor } },
              }}
            />
          </Tooltip>
        )}

        {/* Searchable input — disabled/hidden when a single-select item is selected */}
        {searchable && !hasSingleValue && (
          <InputBase
            inputRef={inputRef}
            value={inputDisplayValue}
            onChange={handleInputChange}
            onFocus={handleInputFocus}
            onKeyDown={handleKeyDown}
            onPaste={onPaste}
            placeholder={
              (multiple && selectedItems.length > 0)
                ? ''
                : resolvedPlaceholder
            }
            disabled={disabled}
            role="combobox"
            aria-expanded={isOpen}
            aria-controls={listboxId}
            aria-autocomplete="list"
            sx={{
              flex: 1,
              minWidth: 80,
              fontSize: '0.875rem',
              color: BRAND.textPrimary,
              '& input::placeholder': { color: BRAND.textSecondary, opacity: 1 },
            }}
          />
        )}

        {/* Non-searchable: placeholder or value already shown as chip above */}
        {!searchable && !hasSingleValue && (
          <Typography sx={{ flex: 1, fontSize: '0.875rem', color: BRAND.textSecondary, userSelect: 'none' }}>
            {resolvedPlaceholder}
          </Typography>
        )}

        {/* Right controls */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, pl: 0.25, flexShrink: 0 }}>
          {loading && <CircularProgress size={16} sx={{ color: chipColor }} />}

          {!disabled && multiple && selectedItems.length > 0 && (
            <Tooltip title="Clear all" arrow>
              <IconButton
                size="small"
                onClick={(e) => { e.stopPropagation(); clearAll(); }}
                sx={{ p: 0.25, color: BRAND.textSecondary, '&:hover': { color: BRAND.red } }}
              >
                <Close sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
          )}

          <KeyboardArrowDown
            sx={{
              fontSize: 20, color: BRAND.textSecondary,
              transform: isOpen ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.15s ease',
            }}
          />
        </Box>
      </Box>

      {(error || helperText) && (
        <FormHelperText error={!!error} sx={{ mx: 0, mt: 0.5 }}>{error || helperText}</FormHelperText>
      )}

      {/* Options Dropdown */}
      {isOpen && dropdownPosition && (
        <Portal>
          <Box
            ref={dropdownRef}
            sx={{ position: 'fixed', top: dropdownPosition.top, left: dropdownPosition.left, width: dropdownPosition.width, zIndex: 1300 }}
          >
            <Paper
              id={listboxId}
              role="listbox"
              elevation={4}
              sx={{
                width: '100%', maxHeight: 250, overflowY: 'auto',
                borderRadius: '8px', border: `1px solid ${BRAND.borderLight}`,
                boxShadow: BRAND.shadowMd, bgcolor: BRAND.white,
              }}
            >
              {!shouldShowOptions ? (
                <Typography variant="body2" sx={{ px: 2, py: 1.5, color: BRAND.textSecondary, textAlign: 'center' }}>
                  {emptyQueryText}
                </Typography>
              ) : displayedOptions.length === 0 && !loading ? (
                <Typography variant="body2" sx={{ px: 2, py: 1.5, color: BRAND.textSecondary, textAlign: 'center' }}>
                  {noOptionsText}
                </Typography>
              ) : (
                displayedOptions.map((option, index) => {
                  const isHighlighted = index === highlightedIndex;
                  const lbl = getOptionLabel(option);
                  return (
                    <Box
                      key={option.code || option.id || lbl || index}
                      role="option"
                      aria-selected={isHighlighted}
                      onMouseEnter={() => setHighlightedIndex(index)}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => selectOption(option)}
                      sx={{
                        px: 1.75, py: 1, cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500,
                        color: BRAND.textPrimary, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        bgcolor: isHighlighted ? alpha(chipColor, 0.08) : 'transparent',
                        transition: 'background-color 0.1s ease',
                        '&:hover': { bgcolor: alpha(chipColor, 0.06) },
                      }}
                    >
                      <Box sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {renderOption ? renderOption(option) : lbl}
                      </Box>
                    </Box>
                  );
                })
              )}
            </Paper>
          </Box>
        </Portal>
      )}

      {/* Selected Items Detail Popover (multi) */}
      {multiple && (
        <Popover
          open={Boolean(moreAnchor) && hiddenCount > 0}
          anchorEl={moreAnchor}
          onClose={() => { setMoreAnchor(null); setPopoverSearch(''); }}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
          transformOrigin={{ vertical: 'top', horizontal: 'left' }}
          slotProps={{
            paper: {
              sx: {
                p: 2, mt: 0.5, borderRadius: '12px',
                border: `1px solid ${BRAND.borderLight}`,
                boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.05)',
                maxWidth: 420, minWidth: 280,
              },
            },
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.25 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="subtitle2" fontWeight={700} color={BRAND.textPrimary}>
                Selected Items ({selectedItems.length})
              </Typography>
            </Stack>
            <Button
              size="small" color="error"
              startIcon={<DeleteSweep fontSize="small" />}
              onClick={clearAll}
              sx={{ fontSize: '0.75rem', py: 0.25, px: 0.75, textTransform: 'none' }}
            >
              Clear all
            </Button>
          </Box>

          {selectedItems.length > 6 && (
            <InputBase
              value={popoverSearch}
              onChange={(e) => setPopoverSearch(e.target.value)}
              placeholder="Filter selected..."
              sx={{
                width: '100%', mb: 1.5, px: 1, py: 0.4, fontSize: '0.8rem',
                borderRadius: '6px', border: `1px solid ${BRAND.borderLight}`,
                bgcolor: alpha(BRAND.bgGray, 0.5),
              }}
            />
          )}

          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, maxHeight: 220, overflowY: 'auto', pr: 0.5 }}>
            {popoverFilteredItems.map((item) => {
              const lbl = getOptionLabel(item);
              return (
                <Chip
                  key={item.code || item.id || lbl}
                  label={lbl}
                  size="small"
                  onDelete={disabled ? undefined : () => removeItem(item)}
                  sx={{
                    bgcolor: alpha(chipColor, 0.1), color: chipColor,
                    fontWeight: 600, fontSize: '0.78rem',
                    border: `1px solid ${alpha(chipColor, 0.2)}`,
                    '& .MuiChip-deleteIcon': { color: alpha(chipColor, 0.7), fontSize: 16, '&:hover': { color: chipColor } },
                  }}
                />
              );
            })}
          </Box>
        </Popover>
      )}
    </Box>
  );
}
