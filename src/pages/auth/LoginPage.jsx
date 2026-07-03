import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useForm } from 'react-hook-form';
import {
  Box, TextField, Button, Typography,
  Alert, CircularProgress, InputAdornment, IconButton, alpha, Paper, Divider,
} from '@mui/material';
import {
  Visibility, VisibilityOff, LockOutlined, PersonOutlined,
  CheckCircleOutlined, VerifiedUserOutlined,
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import { login, clearError, selectAuthLoading, selectAuthError, selectIsAuthenticated, selectUserRights } from '../../store/slices/authSlice';
import { SESSION_TIMEOUT_FLAG } from '../../api/axiosInstance';
import { defaultRouteForRights } from '../../config/rights';
import { BRAND } from '../../config/theme';

const FEATURES = [
  'End-to-end agreement lifecycle',
  'Multi-level approval workflow',
  'Expiry alerts & reminders',
];

const fieldSx = {
  '& .MuiOutlinedInput-root': {
    bgcolor: '#FAFBFC',
    transition: 'background-color 0.2s ease, box-shadow 0.2s ease',
    '&:hover': { bgcolor: '#fff' },
    '&.Mui-focused': {
      bgcolor: '#fff',
      boxShadow: `0 0 0 3px ${alpha(BRAND.red, 0.1)}`,
    },
  },
  '& .MuiInputLabel-root': { fontWeight: 500 },
};

export default function LoginPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const loading = useSelector(selectAuthLoading);
  const error = useSelector(selectAuthError);
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const rights = useSelector(selectUserRights);
  const { enqueueSnackbar } = useSnackbar();
  const [showPassword, setShowPassword] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm();

  useEffect(() => {
    if (sessionStorage.getItem(SESSION_TIMEOUT_FLAG)) {
      sessionStorage.removeItem(SESSION_TIMEOUT_FLAG);
      enqueueSnackbar('Your session has timed out. Please log in again.', { variant: 'warning' });
    }
  }, [enqueueSnackbar]);

  useEffect(() => {
    if (isAuthenticated) navigate(defaultRouteForRights(rights));
  }, [isAuthenticated, rights, navigate]);

  useEffect(() => {
    return () => { dispatch(clearError()); };
  }, [dispatch]);

  const onSubmit = (data) => { dispatch(login(data)); };

  return (
    <Box sx={{
      minHeight: '100%',
      height: '100%',
      display: 'flex',
      bgcolor: '#F8FAFC',
    }}>
      {/* Brand panel */}
      <Box sx={{
        display: { xs: 'none', lg: 'flex' },
        flex: '0 0 48%',
        background: `linear-gradient(160deg, ${BRAND.redDark} 0%, ${BRAND.red} 55%, #A31515 100%)`,
        flexDirection: 'column',
        justifyContent: 'space-between',
        p: { lg: 6, xl: 8 },
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Decorative layers */}
        <Box sx={{
          position: 'absolute', inset: 0, opacity: 0.35,
          backgroundImage: `
            radial-gradient(circle at 20% 80%, ${alpha('#fff', 0.12)} 0%, transparent 50%),
            radial-gradient(circle at 80% 20%, ${alpha('#fff', 0.08)} 0%, transparent 40%)
          `,
        }} />
        <Box sx={{
          position: 'absolute', inset: 0, opacity: 0.04,
          backgroundImage: `linear-gradient(${alpha('#fff', 0.5)} 1px, transparent 1px),
            linear-gradient(90deg, ${alpha('#fff', 0.5)} 1px, transparent 1px)`,
          backgroundSize: '48px 48px',
        }} />
        <Box sx={{
          position: 'absolute', top: -120, right: -80,
          width: 400, height: 400, borderRadius: '50%',
          background: alpha('#fff', 0.04),
        }} />
        <Box sx={{
          position: 'absolute', bottom: -60, left: -40,
          width: 280, height: 280, borderRadius: '50%',
          background: alpha('#fff', 0.03),
        }} />

        {/* Logo */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, position: 'relative', zIndex: 1 }}>
          <Box sx={{
            width: 48, height: 48, borderRadius: 2.5,
            bgcolor: '#fff', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 4px 20px ${alpha('#000', 0.2)}`,
            overflow: 'hidden',
          }}>
            <Box component="img" src="/images/medplus_logo.png" alt="MedPlus" sx={{ width: 36, height: 36, objectFit: 'contain' }} />
          </Box>
          <Box>
            <Typography sx={{ color: '#fff', fontWeight: 800, fontSize: 20, letterSpacing: '-0.3px', lineHeight: 1.2 }}>
              MedPlus
            </Typography>
            <Typography sx={{ color: alpha('#fff', 0.65), fontSize: '0.72rem', fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Healthcare
            </Typography>
          </Box>
        </Box>

        {/* Hero content */}
        <Box sx={{ position: 'relative', zIndex: 1, maxWidth: 440 }}>
          <Typography sx={{
            color: alpha('#fff', 0.7), fontSize: '0.8rem', fontWeight: 600,
            letterSpacing: '0.12em', textTransform: 'uppercase', mb: 2,
          }}>
            Enterprise Portal
          </Typography>
          <Typography variant="h3" sx={{
            color: '#fff', fontWeight: 800, lineHeight: 1.2,
            mb: 2.5, letterSpacing: '-0.8px', fontSize: { lg: '2.25rem', xl: '2.5rem' },
          }}>
            Commercial Agreement Tracker
          </Typography>
          <Typography sx={{ color: alpha('#fff', 0.78), fontSize: '1rem', lineHeight: 1.75, mb: 5 }}>
            Manage vendor agreements, approvals, and commercial structures — all in one secure platform.
          </Typography>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.25 }}>
            {FEATURES.map((f) => (
              <Box key={f} sx={{ display: 'flex', alignItems: 'center', gap: 1.75 }}>
                <CheckCircleOutlined sx={{ color: BRAND.greenLight, fontSize: 20, flexShrink: 0 }} />
                <Typography sx={{ color: alpha('#fff', 0.9), fontSize: '0.925rem', fontWeight: 500 }}>{f}</Typography>
              </Box>
            ))}
          </Box>
        </Box>

        <Typography sx={{ color: alpha('#fff', 0.45), fontSize: '0.78rem', position: 'relative', zIndex: 1 }}>
          Secure access for authorized MedPlus personnel only
        </Typography>
      </Box>

      {/* Form panel */}
      <Box sx={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        p: { xs: 3, sm: 4, md: 6 },
        position: 'relative',
        background: `linear-gradient(180deg, #F8FAFC 0%, #EEF2F6 100%)`,
      }}>
        {/* Mobile logo */}
        <Box sx={{
          display: { xs: 'flex', lg: 'none' },
          alignItems: 'center', gap: 1.5, mb: 4, alignSelf: 'flex-start',
        }}>
          <Box sx={{
            width: 40, height: 40, borderRadius: 2, bgcolor: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: BRAND.shadow, overflow: 'hidden',
          }}>
            <Box component="img" src="/images/medplus_logo.png" alt="MedPlus" sx={{ width: 32, height: 32, objectFit: 'contain' }} />
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 800, fontSize: 16, color: BRAND.textPrimary, lineHeight: 1.2 }}>
              MedPlus
            </Typography>
            <Typography sx={{ fontSize: '0.7rem', color: BRAND.textSecondary, fontWeight: 500 }}>
              Agreement Tracker
            </Typography>
          </Box>
        </Box>

        <Paper
          elevation={0}
          sx={{
            width: '100%',
            maxWidth: 440,
            p: { xs: 3.5, sm: 5 },
            borderRadius: 3,
            border: `1px solid ${BRAND.borderLight}`,
            boxShadow: '0 8px 32px rgba(15, 23, 42, 0.08), 0 2px 8px rgba(15, 23, 42, 0.04)',
            bgcolor: '#fff',
          }}
        >
          <Box sx={{
            width: 52, height: 52, borderRadius: 2.5,
            bgcolor: alpha(BRAND.red, 0.08),
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            mb: 3,
          }}>
            <VerifiedUserOutlined sx={{ color: BRAND.red, fontSize: 26 }} />
          </Box>

          <Typography variant="h5" sx={{ mb: 0.75, color: BRAND.textPrimary, fontWeight: 700 }}>
            Welcome back
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3.5, lineHeight: 1.6 }}>
            Sign in with your credentials to access the agreement management portal.
          </Typography>

          {error && (
            <Alert
              severity="error"
              variant="outlined"
              sx={{ mb: 3, borderRadius: 2, '& .MuiAlert-message': { fontSize: '0.875rem' } }}
              onClose={() => dispatch(clearError())}
            >
              {error}
            </Alert>
          )}

          <Box
            component="form"
            onSubmit={handleSubmit(onSubmit)}
            noValidate
            sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}
          >
            <TextField
              label="Username"
              fullWidth
              size="medium"
              autoFocus
              autoComplete="username"
              {...register('username', { required: 'Username is required' })}
              error={!!errors.username}
              helperText={errors.username?.message}
              sx={fieldSx}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <PersonOutlined sx={{ color: BRAND.textSecondary, fontSize: 20 }} />
                    </InputAdornment>
                  ),
                },
              }}
            />
            <TextField
              label="Password"
              type={showPassword ? 'text' : 'password'}
              fullWidth
              size="medium"
              autoComplete="current-password"
              {...register('password', { required: 'Password is required' })}
              error={!!errors.password}
              helperText={errors.password?.message}
              sx={fieldSx}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <LockOutlined sx={{ color: BRAND.textSecondary, fontSize: 20 }} />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowPassword((v) => !v)}
                        edge="end"
                        size="small"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
            />

            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              disabled={loading}
              sx={{
                mt: 0.5,
                py: 1.6,
                fontSize: '0.95rem',
                fontWeight: 700,
                borderRadius: 2,
                letterSpacing: '0.01em',
              }}
            >
              {loading ? <CircularProgress size={22} color="inherit" /> : 'Sign In'}
            </Button>
          </Box>

          <Divider sx={{ my: 3.5 }} />

          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', lineHeight: 1.5 }}>
            © {new Date().getFullYear()} MedPlus Healthcare. All rights reserved.
          </Typography>
        </Paper>
      </Box>
    </Box>
  );
}
