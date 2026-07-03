import { useState } from 'react';
import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import {
  AppBar, Box, List, ListItem,
  ListItemButton, Toolbar, Typography,
  Avatar, Menu, MenuItem, Divider, InputBase,
  Tooltip,
} from '@mui/material';
import {
  SpaceDashboardOutlined, DescriptionOutlined,   CheckCircleOutlined, Search,
  Logout, Person, ExpandMore, StorageOutlined, ManageAccountsOutlined,
  LocalOfferOutlined,
} from '@mui/icons-material';
import NotificationBell from '../components/layout/NotificationBell';
import { alpha } from '@mui/material/styles';
import { useDispatch } from 'react-redux';
import { BRAND } from '../config/theme';
import { ROUTES } from '../config/routes';
import { RIGHTS } from '../config/rights';
import { logout } from '../store/slices/authSlice';
import { useAuth } from '../hooks/useAuth';

const DRAWER_WIDTH = 240;
const DRAWER_COLLAPSED = 72;

const NAV_ITEMS = [
  { label: 'Dashboard', icon: SpaceDashboardOutlined, path: ROUTES.DASHBOARD, rights: [RIGHTS.DASHBOARD_VIEW] },
  { label: 'Agreements', icon: DescriptionOutlined, path: ROUTES.AGREEMENTS_GROUPS, rights: [RIGHTS.AGREEMENT_VIEW, RIGHTS.AGREEMENT_VIEW_ALL] },
  { label: 'Approvals', icon: CheckCircleOutlined, path: ROUTES.APPROVALS, rights: [RIGHTS.AGREEMENT_APPROVE] },
  { label: 'Price Offs', icon: LocalOfferOutlined, path: ROUTES.PRICE_OFFS, rights: [RIGHTS.PRICE_OFF_MANAGE] },
  { label: 'Price Off Approvals', icon: LocalOfferOutlined, path: ROUTES.PRICE_OFFS_APPROVALS, rights: [RIGHTS.PRICE_OFF_APPROVE] },
  { label: 'Users', icon: ManageAccountsOutlined, path: ROUTES.ADMIN_USERS, rights: [RIGHTS.ADMIN_USERS] },
  { label: 'Master Data', icon: StorageOutlined, path: ROUTES.MASTER, rights: [RIGHTS.MASTER_VIEW, RIGHTS.MASTER_MANAGE] },
];

function NavIcon({ Icon, active, badge, collapsed }) {
  const size = collapsed ? 40 : 38;

  return (
    <Box sx={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
      <Box sx={{
        width: size,
        height: size,
        borderRadius: collapsed ? '50%' : 2.5,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: active ? BRAND.red : '#fff',
        color: active ? '#fff' : '#64748B',
        border: active ? 'none' : `1px solid ${alpha('#64748B', 0.12)}`,
        boxShadow: active
          ? `0 4px 12px ${alpha(BRAND.red, 0.28)}`
          : '0 1px 2px rgba(15, 23, 42, 0.04)',
        transition: 'all 0.2s ease',
      }}>
        <Icon sx={{ fontSize: collapsed ? 20 : 19 }} />
      </Box>
      {badge > 0 && (
        <Box sx={{
          position: 'absolute',
          top: collapsed ? -2 : 0,
          right: collapsed ? -2 : 0,
          minWidth: 16,
          height: 16,
          borderRadius: '50%',
          bgcolor: '#DC2626',
          color: '#fff',
          fontSize: '0.58rem',
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '2px solid #FAFBFC',
          lineHeight: 1,
        }}>
          {badge}
        </Box>
      )}
    </Box>
  );
}

export default function DashboardLayout() {
  const [hovered, setHovered] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const { user, hasAnyRight } = useAuth();

  const sidebarWidth = hovered ? DRAWER_WIDTH : DRAWER_COLLAPSED;

  const handleLogout = () => {
    dispatch(logout());
    navigate(ROUTES.LOGIN);
  };

  const filteredNav = NAV_ITEMS.filter((item) => hasAnyRight(item.rights));

  const isActive = (path, placeholder) => {
    if (placeholder) return false;
    return location.pathname === path
      || (path !== '/' && location.pathname.startsWith(`${path}/`))
      || (path === ROUTES.AGREEMENTS_GROUPS && location.pathname.startsWith('/agreements'));
  };

  const userInitial = user?.fullName?.[0]?.toUpperCase() || 'U';
  const userRole = user?.roles?.[0]?.toUpperCase() || 'ADMIN';

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', bgcolor: '#F5F7FA' }}>

      {/* Full-width header */}
      <AppBar
        position="static"
        elevation={0}
        sx={{
          flexShrink: 0,
          width: '100%',
          bgcolor: '#fff',
          color: BRAND.textPrimary,
          borderRadius: 0,
          border: 'none',
          borderBottom: '1px solid #E8ECF0',
          boxShadow: 'none',
        }}
      >
        <Toolbar sx={{ gap: 2, minHeight: '68px !important', justifyContent: 'space-between', px: { xs: 2, md: 3 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexShrink: 0 }}>
            <Box sx={{
              width: 38, height: 38, borderRadius: 2,
              bgcolor: BRAND.red, display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              overflow: 'hidden',
            }}>
              <Box
                component="img"
                src="/images/medplus_logo.png"
                alt="MedPlus"
                sx={{ width: 28, height: 28, objectFit: 'contain' }}
              />
            </Box>
            <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
              <Typography sx={{ fontSize: 15, fontWeight: 800, color: BRAND.textPrimary, lineHeight: 1.15 }}>
                MedPlus
              </Typography>
              <Typography sx={{
                fontSize: 9.5, fontWeight: 700, color: '#94A3B8',
                letterSpacing: '0.08em', textTransform: 'uppercase', lineHeight: 1.3,
              }}>
                Agreement Tracker
              </Typography>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexShrink: 0 }}>
            <NotificationBell />
            <Divider orientation="vertical" flexItem sx={{ height: 32, alignSelf: 'center', borderColor: '#E2E8F0' }} />

            <Box
              onClick={(e) => setAnchorEl(e.currentTarget)}
              sx={{
                display: 'flex', alignItems: 'center', gap: 1.25,
                cursor: 'pointer', borderRadius: 2, px: 1, py: 0.5,
                '&:hover': { bgcolor: '#F8FAFC' },
              }}
            >
              <Avatar sx={{ width: 36, height: 36, bgcolor: BRAND.red, fontSize: 15, fontWeight: 700 }}>
                {userInitial}
              </Avatar>
              <Box sx={{ display: { xs: 'none', lg: 'block' } }}>
                <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, lineHeight: 1.2 }}>
                  {user?.fullName || 'User'}
                </Typography>
                <Typography sx={{ fontSize: '0.68rem', fontWeight: 600, color: '#94A3B8', letterSpacing: '0.04em' }}>
                  {userRole}
                </Typography>
              </Box>
              <ExpandMore sx={{ fontSize: 18, color: '#94A3B8', display: { xs: 'none', lg: 'block' } }} />
            </Box>
          </Box>

        </Toolbar>
      </AppBar>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        PaperProps={{
          sx: { mt: 1, minWidth: 210, borderRadius: 2, border: `1px solid ${BRAND.borderLight}`, boxShadow: BRAND.shadowMd },
        }}
      >
        <Box sx={{ px: 2, py: 1.5 }}>
          <Typography variant="subtitle2">{user?.fullName}</Typography>
          <Typography variant="caption" color="text.secondary">{user?.email}</Typography>
        </Box>
        <Divider />
        <MenuItem onClick={() => { setAnchorEl(null); navigate('/profile'); }} sx={{ gap: 1.5, py: 1.2 }}>
          <Person fontSize="small" sx={{ color: 'text.secondary' }} />
          <Typography variant="body2">Profile</Typography>
        </MenuItem>
        <MenuItem onClick={handleLogout} sx={{ gap: 1.5, py: 1.2, color: 'error.main' }}>
          <Logout fontSize="small" />
          <Typography variant="body2">Sign out</Typography>
        </MenuItem>
      </Menu>

      {/* Body: sidebar + main */}
      <Box sx={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {/* Hover-expand sidebar */}
        <Box
          component="aside"
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          sx={{
            width: sidebarWidth,
            flexShrink: 0,
            height: '100%',
            bgcolor: '#FAFBFC',
            borderRight: '1px solid #E8ECF0',
            display: 'flex',
            flexDirection: 'column',
            overflowX: 'hidden',
            overflowY: 'hidden',
            transition: 'width 0.22s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.22s ease',
            boxShadow: hovered ? '4px 0 24px rgba(0,0,0,0.06)' : 'none',
            zIndex: 10,
          }}
        >
          <List sx={{ px: hovered ? 1.25 : 0.75, py: 2, flex: 1 }}>
            {filteredNav.map((item) => {
              const active = isActive(item.path, item.placeholder);
              const Icon = item.icon;
              return (
                <ListItem key={item.label} disablePadding sx={{ mb: 0.75 }}>
                  <Tooltip title={!hovered ? item.label : ''} placement="right" arrow>
                    <ListItemButton
                      component={Link}
                      to={item.path}
                      sx={{
                        borderRadius: hovered ? 3 : '50%',
                        py: hovered ? 0.85 : 0.5,
                        px: hovered ? 1.25 : 0,
                        minHeight: hovered ? 48 : 52,
                        width: hovered ? '100%' : 52,
                        mx: hovered ? 0 : 'auto',
                        justifyContent: hovered ? 'flex-start' : 'center',
                        gap: 1.5,
                        bgcolor: hovered && active ? alpha(BRAND.red, 0.06) : 'transparent',
                        color: active ? BRAND.red : '#64748B',
                        '&:hover': {
                          bgcolor: hovered
                            ? (active ? alpha(BRAND.red, 0.09) : alpha('#64748B', 0.06))
                            : 'transparent',
                        },
                      }}
                    >
                      <NavIcon
                        Icon={Icon}
                        active={active}
                        badge={item.badge}
                        collapsed={!hovered}
                      />
                      <Box sx={{
                        overflow: 'hidden',
                        opacity: hovered ? 1 : 0,
                        maxWidth: hovered ? 160 : 0,
                        transition: 'opacity 0.15s ease, max-width 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
                        display: 'flex',
                        alignItems: 'center',
                      }}>
                        <Typography sx={{
                          fontSize: '0.875rem',
                          fontWeight: active ? 600 : 500,
                          color: 'inherit',
                          whiteSpace: 'nowrap',
                        }}>
                          {item.label}
                        </Typography>
                      </Box>
                    </ListItemButton>
                  </Tooltip>
                </ListItem>
              );
            })}
          </List>
        </Box>

        <Box
          component="main"
          sx={{
            flex: 1,
            minHeight: 0,
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            position: 'relative',
            background: `
              radial-gradient(ellipse 80% 50% at 100% 0%, rgba(194,24,29,0.04) 0%, transparent 60%),
              radial-gradient(ellipse 60% 40% at 0% 100%, rgba(50,169,76,0.03) 0%, transparent 50%),
              #F3F6F9
            `,
          }}
        >
          <Box
            sx={{
              flex: 1,
              minHeight: 0,
              overflow: 'auto',
              overflowX: 'hidden',
              p: { xs: 2, md: 3 },
            }}
          >
            <Outlet />
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
