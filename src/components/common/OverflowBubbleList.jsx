import { useState } from 'react';
import { Box, Chip, Popover, Typography } from '@mui/material';

/**
 * OverflowBubbleList - A reusable component to display a list of items as Chips.
 * Truncates items exceeding `maxVisible` and shows a clickable "+X more" chip.
 * 
 * @param {Array} items - The array of items to display.
 * @param {Number} maxVisible - How many chips to show before truncating (default: 3).
 * @param {Function} getLabel - Function to extract the string label from an item.
 * @param {Function} getKey - Function to extract a unique React key from an item.
 * @param {Object} chipProps - Extra props applied to the MUI Chips (e.g., color, size).
 * @param {String} popoverTitle - Title shown inside the popover.
 */
export default function OverflowBubbleList({
  items = [],
  maxVisible = 3,
  getLabel = (item) => item.label || item,
  getKey = (item, index) => item?.id || item?.code || index,
  chipProps = { size: 'small', variant: 'outlined' },
  popoverTitle = 'All Items'
}) {
  const [anchorEl, setAnchorEl] = useState(null);

  if (!items || items.length === 0) {
    return <Typography variant="body2" color="text.secondary">—</Typography>;
  }

  const visibleItems = items.slice(0, maxVisible);
  const hiddenCount = items.length - maxVisible;

  const handleClickMore = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const open = Boolean(anchorEl);

  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, alignItems: 'center' }}>
      {visibleItems.map((item, index) => (
        <Chip 
          key={getKey(item, index)} 
          label={getLabel(item)} 
          {...chipProps} 
          sx={{ ...chipProps?.sx, maxWidth: '280px' }} 
        />
      ))}
      
      {hiddenCount > 0 && (
        <>
          <Chip
            label={`+${hiddenCount} more`}
            size={chipProps.size || 'small'}
            variant="filled"
            onClick={handleClickMore}
            sx={{ 
              cursor: 'pointer', 
              fontWeight: 600, 
              bgcolor: 'action.selected',
              '&:hover': { bgcolor: 'action.focus' }
            }}
          />
          <Popover
            open={open}
            anchorEl={anchorEl}
            onClose={handleClose}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
            transformOrigin={{ vertical: 'top', horizontal: 'left' }}
            PaperProps={{
              sx: { mt: 0.5, borderRadius: 2, boxShadow: 4 }
            }}
          >
            <Box sx={{ p: 2 }}>
              {popoverTitle && (
                <Typography variant="caption" sx={{ display: 'block', mb: 1.5, pb: 0.5, fontWeight: 600, color: 'text.secondary', borderBottom: '1px solid', borderColor: 'divider' }}>
                  {popoverTitle} ({items.length})
                </Typography>
              )}
              <Box sx={{ display: 'flex', flexWrap: 'wrap', alignContent: 'flex-start', gap: 1, maxWidth: 350, maxHeight: 240, overflowY: 'auto', pr: 0.5, pb: 0.5 }}>
                {items.map((item, index) => (
                  <Chip 
                    key={`popover-${getKey(item, index)}`} 
                    label={getLabel(item)} 
                    {...chipProps} 
                    sx={{ ...chipProps?.sx, maxWidth: '100%' }}
                  />
                ))}
              </Box>
            </Box>
          </Popover>
        </>
      )}
    </Box>
  );
}
