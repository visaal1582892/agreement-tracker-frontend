import { Box, Typography, alpha } from '@mui/material';
import { BRAND } from '../../config/theme';

export default function KpiCard({ title, value, icon, color = BRAND.red, subtitle }) {
  return (
    <Box sx={{
      borderRadius: 3.5,
      p: 2.75,
      height: '100%',
      position: 'relative',
      overflow: 'hidden',
      border: `1px solid ${alpha(color, 0.12)}`,
      background: `linear-gradient(145deg, #fff 55%, ${alpha(color, 0.07)} 100%)`,
      boxShadow: `0 4px 20px ${alpha(color, 0.08)}, 0 1px 3px rgba(15,23,42,0.04)`,
      transition: 'transform 0.2s ease, box-shadow 0.2s ease',
      '&:hover': {
        transform: 'translateY(-3px)',
        boxShadow: `0 12px 28px ${alpha(color, 0.14)}, 0 2px 6px rgba(15,23,42,0.06)`,
      },
    }}>
      {/* watermark icon */}
      <Box sx={{
        position: 'absolute', right: -8, bottom: -12,
        opacity: 0.07, color, fontSize: 88, lineHeight: 1,
        pointerEvents: 'none',
      }}>
        {icon}
      </Box>

      <Box sx={{ pl: 1.5, position: 'relative', zIndex: 1 }}>
        <Typography sx={{
          color, fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: '0.07em', fontSize: '0.65rem',
          mb: 1.75,
        }}>
          {title}
        </Typography>

        <Typography sx={{
          fontSize: '2.5rem', fontWeight: 800, color: BRAND.textPrimary,
          lineHeight: 1, letterSpacing: '-2px', mb: 0.75,
        }}>
          {value ?? '—'}
        </Typography>

        {subtitle && (
          <Typography sx={{ fontSize: '0.78rem', color: '#64748B', fontWeight: 500 }}>
            {subtitle}
          </Typography>
        )}
      </Box>

      <Box sx={{
        position: 'absolute', top: 20, right: 20,
        width: 42, height: 42, borderRadius: 2.5,
        bgcolor: alpha(color, 0.12),
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color, zIndex: 1,
      }}>
        <Box sx={{ fontSize: 20, display: 'flex' }}>{icon}</Box>
      </Box>
    </Box>
  );
}
