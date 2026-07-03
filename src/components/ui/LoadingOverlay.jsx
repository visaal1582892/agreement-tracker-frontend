import { Backdrop, CircularProgress } from '@mui/material';
import { BRAND } from '../../config/theme';

export default function LoadingOverlay({ open }) {
  return (
    <Backdrop open={open} sx={{ color: BRAND.red, zIndex: (t) => t.zIndex.drawer + 1 }}>
      <CircularProgress color="inherit" />
    </Backdrop>
  );
}
