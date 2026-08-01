import { NavLink, Outlet, useLocation, Navigate } from 'react-router-dom';
import {
  Box, Typography, Tabs, Tab, Paper, alpha,
} from '@mui/material';
import {
  GroupWork, AttachMoney, Description, ManageAccounts, Security, PinDrop, People, Tv,
} from '@mui/icons-material';
import { BRAND } from '../../config/theme';
import { ROUTES } from '../../config/routes';
import { RIGHTS } from '../../config/rights';
import { useAuth } from '../../hooks/useAuth';

const MASTER_TABS = [
  { label: 'Agreement Groups', icon: <GroupWork />,     path: ROUTES.MASTER_AGREEMENT_GROUPS,    rights: [RIGHTS.MASTER_VIEW, RIGHTS.MASTER_MANAGE] },
  { label: 'Income Types',     icon: <AttachMoney />,   path: ROUTES.MASTER_INCOME_TYPES,        rights: [RIGHTS.MASTER_VIEW, RIGHTS.MASTER_MANAGE] },
  { label: 'Channels',         icon: <Tv />,            path: ROUTES.MASTER_CHANNELS,            rights: [RIGHTS.MASTER_VIEW, RIGHTS.MASTER_MANAGE] },
  { label: 'Agreement Types',  icon: <Description />,   path: ROUTES.MASTER_AGREEMENT_TYPES,     rights: [RIGHTS.MASTER_VIEW, RIGHTS.MASTER_MANAGE] },
  { label: 'Price Off Locations', icon: <PinDrop />,    path: ROUTES.MASTER_PRICE_OFF_LOCATIONS, rights: [RIGHTS.MASTER_VIEW, RIGHTS.MASTER_MANAGE] },
  { label: 'Users',            icon: <People />,        path: ROUTES.MASTER_USERS,               rights: [RIGHTS.MASTER_VIEW, RIGHTS.MASTER_MANAGE] },
  { label: 'Role & Rights',    icon: <Security />,      path: ROUTES.MASTER_ROLE_RIGHTS,         rights: [RIGHTS.MASTER_VIEW, RIGHTS.MASTER_MANAGE] },
  { label: 'Roles',            icon: <ManageAccounts />, path: ROUTES.MASTER_ROLES,              rights: [RIGHTS.MASTER_VIEW, RIGHTS.MASTER_MANAGE] },
  { label: 'Rights',           icon: <Security />,      path: ROUTES.MASTER_RIGHTS,              rights: [RIGHTS.MASTER_VIEW, RIGHTS.MASTER_MANAGE] },
];

export default function MasterDataLayout() {
  const location = useLocation();
  const { hasAnyRight } = useAuth();

  const visibleTabs = MASTER_TABS.filter((tab) => hasAnyRight(tab.rights));

  const activeIndex = visibleTabs.findIndex((t) =>
    location.pathname === t.path || location.pathname.startsWith(t.path + '/'),
  );

  if (visibleTabs.length === 0) {
    return <Navigate to={ROUTES.DASHBOARD} replace />;
  }

  if (location.pathname === ROUTES.MASTER || activeIndex === -1) {
    return <Navigate to={visibleTabs[0].path} replace />;
  }

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 800 }} color="text.primary">
          Master Data Configuration
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Manage lookup tables, reference data, and system configuration
        </Typography>
      </Box>

      <Paper
        elevation={0}
        sx={{
          mb: 3,
          borderRadius: 2,
          border: `1px solid ${BRAND.borderLight}`,
          overflow: 'hidden',
        }}
      >
        <Tabs
          value={activeIndex}
          variant="scrollable"
          scrollButtons="auto"
          slotProps={{
            indicator: {
              style: { backgroundColor: BRAND.red, height: 3 },
            },
          }}
          sx={{
            px: 1,
            '& .MuiTab-root': {
              minHeight: 56,
              fontSize: '0.82rem',
              fontWeight: 600,
              textTransform: 'none',
              color: BRAND.textSecondary,
              gap: 0.75,
              '&.Mui-selected': { color: BRAND.red },
              '&:hover': { bgcolor: alpha(BRAND.red, 0.04) },
            },
          }}
        >
          {visibleTabs.map((tab) => (
            <Tab
              key={tab.path}
              label={tab.label}
              icon={tab.icon}
              iconPosition="start"
              component={NavLink}
              to={tab.path}
            />
          ))}
        </Tabs>
      </Paper>

      <Outlet />
    </Box>
  );
}
