import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  Box,
  Chip,
  CircularProgress,
  FormHelperText,
  InputBase,
  Paper,
  Popover,
  Popper,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { KeyboardArrowDown, Close } from '@mui/icons-material';
import { BRAND } from '../../config/theme';
import { useDebounce } from '../../hooks/useDebounce';

const SEARCH_DEBOUNCE_MS = 500;
const DEFAULT_MAX_VISIBLE_CHIPS = 2;

export default function SearchableSelect({
  isMulti = false,
  multiple, // backward compat alias for isMulti
  options = [],
  value,
  onChange,
  onSearch,
  getOptionLabel = (o) => o?.label || o?.name || o?.companyName || o?.vendorName || String(o ?? ''),
  isOptionEqualToValue = (o, v) => o?.id === v?.id,
  label,
  placeholder = 'Search…',
  loading = false,
  disabled = false,
  required = false,
  error,
  helperText,
  maxVisibleChips = DEFAULT_MAX_VISIBLE_CHIPS,
  noOptionsText = 'No results found',
}) {
  const multi = multiple ?? isMulti;
  const listboxId = useId();
  const containerRef = useRef(null);
  const anchorRef = useRef(null);
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);

  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [moreAnchor, setMoreAnchor] = useState(null);
  const [anchorWidth, setAnchorWidth] = useState(0);

  const debouncedQuery = useDebounce(searchQuery, SEARCH_DEBOUNCE_MS);

  const selectedItems = useMemo(() => {
    if (!multi) return value ? [value] : [];
    return Array.isArray(value) ? value : [];
  }, [multi, value]);

  useEffect(() => {
    if (onSearch) onSearch(debouncedQuery);
  }, [debouncedQuery, onSearch]);

  const displayedOptions = useMemo(() => {
    let opts = options;
    if (multi) {
      opts = opts.filter((o) => !selectedItems.some((s) => isOptionEqualToValue(o, s)));
    }
    if (!onSearch && searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      opts = opts.filter((o) => getOptionLabel(o).toLowerCase().includes(q));
    }
    return opts;
  }, [options, multi, selectedItems, isOptionEqualToValue, getOptionLabel, onSearch, searchQuery]);

  const visibleChips = selectedItems.slice(0, maxVisibleChips);
  const hiddenCount = Math.max(0, selectedItems.length - maxVisibleChips);

  const closeDropdown = useCallback(() => {
    setIsOpen(false);
    setHighlightedIndex(-1);
  }, []);

  const openDropdown = useCallback(() => {
    if (disabled) return;
    setIsOpen(true);
  }, [disabled]);

  useEffect(() => {
    if (!isOpen || !anchorRef.current) return undefined;

    const updateWidth = () => {
      if (anchorRef.current) setAnchorWidth(anchorRef.current.offsetWidth);
    };
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      const inField = containerRef.current?.contains(e.target);
      const inDropdown = dropdownRef.current?.contains(e.target);
      if (!inField && !inDropdown) {
        closeDropdown();
        if (!multi && value) setSearchQuery('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [closeDropdown, multi, value]);

  const selectOption = useCallback(
    (option) => {
      if (multi) {
        onChange([...selectedItems, option]);
        setSearchQuery('');
        setHighlightedIndex(-1);
        inputRef.current?.focus();
      } else {
        onChange(option);
        setSearchQuery('');
        closeDropdown();
      }
    },
    [multi, onChange, selectedItems, closeDropdown],
  );

  const removeItem = useCallback(
    (item) => {
      if (!multi) {
        onChange(null);
        return;
      }
      onChange(selectedItems.filter((s) => !isOptionEqualToValue(s, item)));
    },
    [multi, onChange, selectedItems, isOptionEqualToValue],
  );

  const handleInputChange = (e) => {
    setSearchQuery(e.target.value);
    setHighlightedIndex(-1);
    openDropdown();
  };

  const handleInputFocus = () => {
    openDropdown();
    if (!multi && value) setSearchQuery(getOptionLabel(value));
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      closeDropdown();
      if (!multi && value) setSearchQuery('');
      return;
    }
    if (!isOpen && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      openDropdown();
      return;
    }
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

  const inputDisplayValue = useMemo(() => {
    if (multi) return searchQuery;
    if (isOpen) return searchQuery;
    if (value) return getOptionLabel(value);
    return searchQuery;
  }, [multi, isOpen, value, searchQuery, getOptionLabel]);

  const borderColor = error ? BRAND.red : isOpen ? BRAND.red : BRAND.borderLight;

  return (
    <Box ref={containerRef} sx={{ position: 'relative', width: '100%' }}>
      {label && (
        <Typography
          component="label"
          variant="caption"
          sx={{
            display: 'block',
            mb: 0.5,
            fontWeight: 600,
            color: error ? BRAND.red : BRAND.textSecondary,
          }}
        >
          {label}
          {required && (
            <Box component="span" sx={{ color: BRAND.red, ml: 0.25 }}>
              *
            </Box>
          )}
        </Typography>
      )}

      <Box
        ref={anchorRef}
        onClick={() => inputRef.current?.focus()}
        sx={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: multi ? 'wrap' : 'nowrap',
          gap: 0.5,
          minHeight: 40,
          px: 1,
          py: 0.5,
          borderRadius: '8px',
          border: `1px solid ${borderColor}`,
          borderWidth: isOpen ? 2 : 1,
          bgcolor: disabled ? alpha(BRAND.bgGray, 0.6) : BRAND.white,
          cursor: disabled ? 'not-allowed' : 'text',
          transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
          boxShadow: isOpen ? `0 0 0 3px ${alpha(BRAND.red, 0.12)}` : 'none',
          '&:hover': disabled ? {} : { borderColor: isOpen ? BRAND.red : '#94A3B8' },
        }}
      >
        {multi &&
          visibleChips.map((item) => (
            <Chip
              key={item.id ?? getOptionLabel(item)}
              label={getOptionLabel(item)}
              size="small"
              onDelete={disabled ? undefined : () => removeItem(item)}
              sx={{
                height: 24,
                bgcolor: alpha(BRAND.red, 0.08),
                color: BRAND.textPrimary,
                '& .MuiChip-deleteIcon': { color: BRAND.textSecondary, fontSize: 16 },
              }}
            />
          ))}

        {multi && hiddenCount > 0 && (
          <Chip
            label={`+${hiddenCount} more`}
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              setMoreAnchor(e.currentTarget);
            }}
            sx={{
              height: 24,
              cursor: 'pointer',
              bgcolor: alpha(BRAND.red, 0.14),
              color: BRAND.red,
              fontWeight: 700,
              '&:hover': { bgcolor: alpha(BRAND.red, 0.22) },
            }}
          />
        )}

        <InputBase
          inputRef={inputRef}
          value={inputDisplayValue}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onKeyDown={handleKeyDown}
          placeholder={selectedItems.length && multi ? '' : placeholder}
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

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, pl: 0.5 }}>
          {loading && <CircularProgress size={16} sx={{ color: BRAND.red }} />}
          {!multi && value && !disabled && (
            <Close
              sx={{ fontSize: 18, color: BRAND.textSecondary, cursor: 'pointer' }}
              onClick={(e) => {
                e.stopPropagation();
                onChange(null);
                setSearchQuery('');
              }}
            />
          )}
          <KeyboardArrowDown
            sx={{
              fontSize: 20,
              color: BRAND.textSecondary,
              transform: isOpen ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.15s ease',
            }}
          />
        </Box>
      </Box>

      {(error || helperText) && (
        <FormHelperText error={!!error} sx={{ mx: 0, mt: 0.5 }}>
          {error || helperText}
        </FormHelperText>
      )}

      <Popper
        open={isOpen}
        anchorEl={anchorRef.current}
        placement="bottom-start"
        modifiers={[
          { name: 'offset', options: { offset: [0, 4] } },
          { name: 'flip', enabled: true },
          { name: 'preventOverflow', options: { padding: 8 } },
        ]}
        sx={{ zIndex: (theme) => theme.zIndex.modal + 1 }}
      >
        <Box ref={dropdownRef}>
          <Paper
          id={listboxId}
          role="listbox"
          elevation={3}
          sx={{
            width: anchorWidth || anchorRef.current?.offsetWidth || 'auto',
            maxHeight: 240,
            overflowY: 'auto',
            borderRadius: '8px',
            border: `1px solid ${BRAND.borderLight}`,
            boxShadow: BRAND.shadowMd,
          }}
        >
          {displayedOptions.length === 0 && !loading ? (
            <Typography variant="body2" sx={{ px: 2, py: 1.5, color: BRAND.textSecondary }}>
              {noOptionsText}
            </Typography>
          ) : (
            displayedOptions.map((option, index) => {
              const isHighlighted = index === highlightedIndex;
              return (
                <Box
                  key={option.id ?? getOptionLabel(option)}
                  role="option"
                  aria-selected={isHighlighted}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => selectOption(option)}
                  sx={{
                    px: 2,
                    py: 1.25,
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    color: BRAND.textPrimary,
                    bgcolor: isHighlighted ? alpha(BRAND.red, 0.08) : 'transparent',
                    '&:hover': { bgcolor: alpha(BRAND.red, 0.06) },
                  }}
                >
                  {getOptionLabel(option)}
                </Box>
              );
            })
          )}
          </Paper>
        </Box>
      </Popper>

      <Popover
        open={Boolean(moreAnchor)}
        anchorEl={moreAnchor}
        onClose={() => setMoreAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        slotProps={{
          paper: {
            sx: {
              p: 1.5,
              mt: 0.5,
              borderRadius: '8px',
              border: `1px solid ${BRAND.borderLight}`,
              boxShadow: BRAND.shadowMd,
              maxWidth: 360,
            },
          },
        }}
      >
        <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ mb: 1, display: 'block' }}>
          Selected ({selectedItems.length})
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
          {selectedItems.map((item) => (
            <Chip
              key={item.id ?? getOptionLabel(item)}
              label={getOptionLabel(item)}
              size="small"
              onDelete={disabled ? undefined : () => removeItem(item)}
              sx={{
                bgcolor: alpha(BRAND.red, 0.08),
                '& .MuiChip-deleteIcon': { fontSize: 16 },
              }}
            />
          ))}
        </Box>
      </Popover>
    </Box>
  );
}
