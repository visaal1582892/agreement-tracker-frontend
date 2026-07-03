import { Button, IconButton, Stack, Tooltip } from '@mui/material';
import { Add, Edit, PowerSettingsNew } from '@mui/icons-material';
import { BRAND } from '../../config/theme';
import { isRecordActive } from '../../utils/masterUtils';
import { useAuth } from '../../hooks/useAuth';
import { RIGHTS } from '../../config/rights';

export function MasterAddButton({ label, onClick }) {
  const { hasRight } = useAuth();
  if (!hasRight(RIGHTS.MASTER_MANAGE)) return null;

  return (
    <Button
      variant="contained"
      startIcon={<Add />}
      onClick={onClick}
      sx={{ background: BRAND.redGradient }}
    >
      {label}
    </Button>
  );
}

export function MasterRowActions({ row, onEdit, onToggleStatus }) {
  const { hasRight } = useAuth();
  if (!hasRight(RIGHTS.MASTER_MANAGE)) return null;

  const active = isRecordActive(row);

  return (
    <Stack direction="row" spacing={0.25} sx={{ flexWrap: 'nowrap', alignItems: 'center' }}>
      <Tooltip title="Edit" arrow>
        <IconButton
          size="small"
          onClick={(e) => { e.stopPropagation(); onEdit(row); }}
          sx={{ color: 'text.secondary' }}
        >
          <Edit sx={{ fontSize: 18 }} />
        </IconButton>
      </Tooltip>
      <Tooltip title={active ? 'Deactivate' : 'Activate'} arrow>
        <IconButton
          size="small"
          color={active ? 'error' : 'success'}
          onClick={(e) => { e.stopPropagation(); onToggleStatus(row); }}
        >
          <PowerSettingsNew sx={{ fontSize: 18 }} />
        </IconButton>
      </Tooltip>
    </Stack>
  );
}
