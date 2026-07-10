import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Grid, Box, Typography, Paper, List, ListItemButton,
  Divider, Button, alpha, Skeleton,
} from '@mui/material';
import {
  Description, Warning, HourglassEmpty, Cancel, EditNote,
  ArrowForward, EventNote, Bolt, Add, LocalOfferOutlined,
  ManageAccountsOutlined, PeopleOutlined,
} from '@mui/icons-material';
import axiosInstance from '../../api/axiosInstance';
import { ENDPOINTS } from '../../config/endpoints';
import { ROUTES } from '../../config/routes';
import { RIGHTS } from '../../config/rights';
import { BRAND } from '../../config/theme';
import KpiCard from '../../components/ui/KpiCard';
import StatusBadge from '../../components/ui/StatusBadge';
import { useAuth } from '../../hooks/useAuth';

const EXPIRY_BANDS = [
  { label: 'Expiring in 30 days', key: 'expiringIn30Days', color: '#DC2626', bg: 'linear-gradient(90deg, #FEF2F2 0%, #FFF5F5 100%)' },
  { label: 'Expiring 31–60 days', key: 'expiringIn60Days', color: '#D97706', bg: 'linear-gradient(90deg, #FFFBEB 0%, #FFF7ED 100%)' },
  { label: 'Expiring 61–90 days', key: 'expiringIn90Days', color: '#2563EB', bg: 'linear-gradient(90deg, #EFF6FF 0%, #F0F7FF 100%)' },
  { label: 'In Progress', key: 'inProgress', color: '#7C3AED', bg: 'linear-gradient(90deg, #F5F3FF 0%, #FAF5FF 100%)' },
];

const cardSx = {
  borderRadius: 3.5,
  border: '1px solid rgba(226, 232, 240, 0.8)',
  boxShadow: '0 4px 24px rgba(15, 23, 42, 0.05)',
  overflow: 'hidden',
  bgcolor: '#fff',
};

const cardHeaderSx = {
  px: 3,
  py: 2.25,
  background: 'linear-gradient(180deg, #FAFBFC 0%, #fff 100%)',
  borderBottom: '1px solid #F1F5F9',
};

function SunriseDecoration() {
  return (
    <Box sx={{
      position: 'absolute', right: 0, top: 0, bottom: 0,
      width: { sm: 240, md: 300 },
      pointerEvents: 'none',
    }}>
      <svg
        viewBox="0 0 300 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        width="100%"
        height="100%"
        preserveAspectRatio="xMaxYMax slice"
      >
        <defs>
          <radialGradient id="sunGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FDBA74" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#FED7AA" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect x="0" y="95" width="300" height="25" fill="#FCE7F3" opacity="0.5" />
        <path d="M0 105 Q80 82 160 92 T300 88 L300 120 L0 120 Z" fill="#FCE7F3" opacity="0.45" />
        <path d="M40 100 Q120 78 200 88 T300 84 L300 120 L40 120 Z" fill="#FBCFE8" opacity="0.4" />
        <path d="M100 98 Q170 72 230 82 T300 78 L300 120 L100 120 Z" fill="#FECDD3" opacity="0.55" />
        <circle cx="230" cy="42" r="30" fill="url(#sunGlow)" />
        <circle cx="230" cy="44" r="19" fill="#FB923C" opacity="0.55" />
      </svg>
    </Box>
  );
}

function SectionHeader({ icon, title }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
      <Box sx={{
        width: 34, height: 34, borderRadius: 2.5,
        background: `linear-gradient(135deg, ${alpha(BRAND.red, 0.12)} 0%, ${alpha(BRAND.red, 0.05)} 100%)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: BRAND.red,
        border: `1px solid ${alpha(BRAND.red, 0.1)}`,
      }}>
        {icon}
      </Box>
      <Typography sx={{ fontSize: '0.95rem', fontWeight: 700, color: BRAND.textPrimary, letterSpacing: '-0.2px' }}>
        {title}
      </Typography>
    </Box>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user, hasRight, hasAnyRight } = useAuth();
  const [stats, setStats] = useState(null);
  const [recentGroups, setRecentGroups] = useState([]);
  const [expiring, setExpiring] = useState([]);
  const [loading, setLoading] = useState(true);

  const canViewAgreements = hasAnyRight([RIGHTS.AGREEMENT_VIEW, RIGHTS.AGREEMENT_VIEW_ALL]);
  const canViewGlobalAgreements = hasRight(RIGHTS.AGREEMENT_VIEW_ALL);
  const canCreateAgreement = hasRight(RIGHTS.AGREEMENT_CREATE);
  const canEditAgreement = hasRight(RIGHTS.AGREEMENT_EDIT);
  const canApproveAgreement = hasRight(RIGHTS.AGREEMENT_APPROVE);
  const canViewPriceOffs = hasRight(RIGHTS.PRICE_OFF_VIEW);
  const canManagePriceOffs = hasRight(RIGHTS.PRICE_OFF_MANAGE);
  const canApprovePriceOffs = hasRight(RIGHTS.PRICE_OFF_APPROVE);
  const canManageUsers = hasRight(RIGHTS.ADMIN_USERS);
  const canViewMasterData = hasAnyRight([RIGHTS.MASTER_VIEW, RIGHTS.MASTER_MANAGE]);
  const canManageMasterData = hasRight(RIGHTS.MASTER_MANAGE);
  const showSystemOverview = canManageUsers || canViewMasterData;

  const shouldFetchStats = hasAnyRight([
    RIGHTS.AGREEMENT_CREATE,
    RIGHTS.AGREEMENT_EDIT,
    RIGHTS.AGREEMENT_APPROVE,
    RIGHTS.AGREEMENT_VIEW,
    RIGHTS.AGREEMENT_VIEW_ALL,
    RIGHTS.PRICE_OFF_VIEW,
    RIGHTS.PRICE_OFF_APPROVE,
    RIGHTS.ADMIN_USERS,
    RIGHTS.MASTER_VIEW,
    RIGHTS.MASTER_MANAGE,
  ]);

  const kpiWidgets = useMemo(() => {
    const widgets = [];

    if (hasAnyRight([RIGHTS.AGREEMENT_CREATE, RIGHTS.AGREEMENT_EDIT])) {
      widgets.push({
        key: 'drafts',
        title: 'My Drafts',
        value: stats?.draftsCount ?? 0,
        icon: <EditNote />,
        color: '#6366F1',
        subtitle: 'Unsubmitted agreements',
      });
    }

    if (canEditAgreement) {
      widgets.push({
        key: 'action-required',
        title: 'Action Required',
        value: stats?.requiresMyActionCount ?? 0,
        icon: <Warning />,
        color: '#DC2626',
        subtitle: 'Rejected — needs fixes',
      });
    }

    if (canApproveAgreement) {
      widgets.push({
        key: 'pending-approval',
        title: 'Pending My Approval',
        value: stats?.pendingApprovalsCount ?? 0,
        icon: <HourglassEmpty />,
        color: BRAND.red,
        subtitle: 'Global approval queue',
      });
    }

    if (canViewAgreements) {
      widgets.push(
        {
          key: 'active',
          title: 'Active Agreements',
          value: stats?.totalActive ?? 0,
          icon: <Description />,
          color: '#16A34A',
          subtitle: canViewGlobalAgreements ? 'Org-wide live' : 'Your live agreements',
        },
        {
          key: 'expiring',
          title: 'Expiring Soon',
          value: stats?.expiringIn30Days ?? 0,
          icon: <Warning />,
          color: '#EA580C',
          subtitle: 'Within 30 days',
        },
        {
          key: 'expired',
          title: 'Expired',
          value: stats?.expired ?? 0,
          icon: <Cancel />,
          color: '#1E40AF',
          subtitle: 'Need renewal',
        },
      );
    }

    if (canViewPriceOffs) {
      widgets.push({
        key: 'live-campaigns',
        title: 'Live Campaigns',
        value: stats?.liveCampaignsCount ?? 0,
        icon: <LocalOfferOutlined />,
        color: '#16A34A',
        subtitle: 'Active price-offs',
      });
    }

    if (canApprovePriceOffs) {
      widgets.push({
        key: 'price-off-approvals',
        title: 'Price-Off Approvals',
        value: stats?.pendingPriceOffApprovalsCount ?? 0,
        icon: <LocalOfferOutlined />,
        color: '#D97706',
        subtitle: 'Awaiting your review',
      });
    }

    return widgets;
  }, [
    stats,
    canViewAgreements,
    canViewGlobalAgreements,
    canEditAgreement,
    canApproveAgreement,
    canViewPriceOffs,
    canApprovePriceOffs,
    hasAnyRight,
  ]);

  const adminWidgets = useMemo(() => {
    const widgets = [];

    if (canManageUsers) {
      widgets.push({
        key: 'active-users',
        title: 'Active Users',
        value: stats?.totalUsersCount ?? 0,
        icon: <PeopleOutlined />,
        color: '#0284C7',
        subtitle: 'System accounts',
      });
    }

    return widgets;
  }, [stats, canManageUsers]);

  const hasQuickActions = canApproveAgreement || canCreateAgreement || canManagePriceOffs
    || canApprovePriceOffs || canManageUsers || canManageMasterData;
  const hasDashboardContent = kpiWidgets.length > 0 || adminWidgets.length > 0
    || canViewAgreements || hasQuickActions;

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!shouldFetchStats && !canViewAgreements) {
        if (!cancelled) setLoading(false);
        return;
      }

      try {
        const requests = [];

        if (shouldFetchStats) {
          requests.push(
            axiosInstance.get(ENDPOINTS.DASHBOARD_STATS).then((res) => {
              if (!cancelled) setStats(res.data);
            }),
          );
        }

        if (canViewAgreements) {
          const scope = canViewGlobalAgreements ? 'ALL' : 'MY';
          requests.push(
            axiosInstance.get(ENDPOINTS.AGREEMENTS, { params: { page: 0, size: 6, scope } }).then((res) => {
              if (!cancelled) setRecentGroups(res.data.content || []);
            }),
            axiosInstance.get(ENDPOINTS.DASHBOARD_EXPIRING).then((res) => {
              if (!cancelled) setExpiring(res.data || []);
            }),
          );
        }

        await Promise.all(requests);
      } catch (err) {
        console.error(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [shouldFetchStats, canViewAgreements, canViewGlobalAgreements]);

  const urgencyStyle = (urgency) => {
    if (urgency === 'RED') return { color: '#DC2626', bg: '#FEF2F2', label: '< 30 days' };
    if (urgency === 'YELLOW') return { color: '#D97706', bg: '#FFFBEB', label: '< 60 days' };
    return { color: '#2563EB', bg: '#EFF6FF', label: '61–90 days' };
  };

  const firstName = user?.fullName?.split(' ')[0] || 'System';
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <Box>
      <Paper
        elevation={0}
        sx={{
          ...cardSx,
          mb: 3.5,
          p: { xs: 2.5, md: 3 },
          background: `linear-gradient(120deg, #fff 40%, ${alpha(BRAND.red, 0.03)} 100%)`,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
          <SunriseDecoration />
        </Box>
        <Box sx={{ position: 'relative', zIndex: 1, pr: { sm: 28, md: 34 } }}>
          <Typography sx={{
            fontSize: '0.72rem', fontWeight: 600, color: BRAND.red,
            textTransform: 'uppercase', letterSpacing: '0.1em', mb: 0.75,
          }}>
            {today}
          </Typography>
          <Typography sx={{
            fontSize: { xs: '1.4rem', md: '1.75rem' }, fontWeight: 800,
            color: BRAND.textPrimary, letterSpacing: '-0.6px', lineHeight: 1.2,
          }}>
            Good morning,{' '}
            <Box component="span" sx={{ color: BRAND.red }}>{firstName}</Box>
          </Typography>
          <Typography sx={{ mt: 0.75, fontSize: '0.9rem', color: '#64748B', maxWidth: 420 }}>
            {hasDashboardContent
              ? "Here's what's happening with your agreements today."
              : 'Your dashboard is ready — widgets appear based on your assigned rights.'}
          </Typography>
        </Box>
      </Paper>

      {kpiWidgets.length > 0 && (
        <Grid container spacing={2.5} sx={{ mb: 3 }}>
          {kpiWidgets.map((widget) => (
            <Grid key={widget.key} size={{ xs: 12, sm: 6, lg: 3 }}>
              {loading ? (
                <Skeleton variant="rounded" height={140} sx={{ borderRadius: 3.5 }} />
              ) : (
                <KpiCard
                  title={widget.title}
                  value={widget.value}
                  icon={widget.icon}
                  color={widget.color}
                  subtitle={widget.subtitle}
                />
              )}
            </Grid>
          ))}
        </Grid>
      )}

      {showSystemOverview && (
        <Box sx={{ mb: 3 }}>
          <Typography sx={{ fontSize: '1.1rem', fontWeight: 700, color: BRAND.textPrimary, mb: 2 }}>
            System Overview
          </Typography>
          <Grid container spacing={2.5}>
            {adminWidgets.map((widget) => (
              <Grid key={widget.key} size={{ xs: 12, sm: 6, lg: 3 }}>
                {loading ? (
                  <Skeleton variant="rounded" height={140} sx={{ borderRadius: 3.5 }} />
                ) : (
                  <KpiCard
                    title={widget.title}
                    value={widget.value}
                    icon={widget.icon}
                    color={widget.color}
                    subtitle={widget.subtitle}
                  />
                )}
              </Grid>
            ))}
          </Grid>
        </Box>
      )}

      {canViewAgreements && (
        <Paper elevation={0} sx={{ ...cardSx, mb: 3, p: 3 }}>
          <SectionHeader icon={<Warning sx={{ fontSize: 18 }} />} title="Renewal Watch — Expiring in 90 Days" />
          {loading ? (
            <Skeleton variant="rounded" height={120} sx={{ borderRadius: 2 }} />
          ) : expiring.length === 0 ? (
            <Typography variant="body2" color="text.secondary">No approved agreements expiring within 90 days.</Typography>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {expiring.map((item) => {
                const u = urgencyStyle(item.urgency);
                return (
                  <Box
                    key={item.agreementId}
                    onClick={() => navigate(`/agreements/${item.agreementId}`)}
                    sx={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      px: 2, py: 1.5, borderRadius: 2, cursor: 'pointer',
                      bgcolor: u.bg, border: `1px solid ${alpha(u.color, 0.15)}`,
                      '&:hover': { transform: 'translateX(4px)' }, transition: 'transform 0.15s',
                    }}
                  >
                    <Box>
                      <Typography variant="body2" fontWeight={700}>{item.agreementName || 'Agreement'}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {item.ownerName}
                      </Typography>
                    </Box>
                    <Box sx={{ textAlign: 'right' }}>
                      <Typography variant="body2" fontWeight={700} sx={{ color: u.color }}>
                        {item.daysUntilExpiry} days left
                      </Typography>
                      <Typography variant="caption" sx={{ color: u.color }}>
                        Expires {new Date(item.expiryDate).toLocaleDateString('en-IN')} · {u.label}
                      </Typography>
                    </Box>
                  </Box>
                );
              })}
            </Box>
          )}
        </Paper>
      )}

      {(canViewAgreements || hasQuickActions) && (
        <Grid container spacing={2.5} sx={{ alignItems: 'stretch' }}>
          {canViewAgreements && (
            <Grid size={{ xs: 12, lg: hasQuickActions ? 8 : 12 }} sx={{ display: 'flex' }}>
              <Paper elevation={0} sx={{ ...cardSx, width: '100%', display: 'flex', flexDirection: 'column' }}>
                <Box sx={{ ...cardHeaderSx, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography sx={{ fontSize: '0.95rem', fontWeight: 700, color: BRAND.textPrimary }}>
                      Recent Agreements
                    </Typography>
                    <Typography sx={{ fontSize: '0.8rem', color: '#94A3B8', mt: 0.25 }}>
                      {canViewGlobalAgreements ? 'Latest activity across all agreements' : 'Your latest agreements'}
                    </Typography>
                  </Box>
                  <Button
                    size="small"
                    onClick={() => navigate(ROUTES.AGREEMENTS)}
                    sx={{
                      color: BRAND.red, fontWeight: 600, fontSize: '0.8rem',
                      textTransform: 'none', borderRadius: 2,
                      bgcolor: alpha(BRAND.red, 0.06),
                      px: 1.5, py: 0.5,
                      '&:hover': { bgcolor: alpha(BRAND.red, 0.1) },
                    }}
                    endIcon={<ArrowForward sx={{ fontSize: '14px !important' }} />}
                  >
                    View all
                  </Button>
                </Box>

                {loading ? (
                  <Box sx={{ flex: 1, p: 2.5 }}>
                    {[...Array(5)].map((_, i) => (
                      <Skeleton key={i} variant="rounded" height={56} sx={{ mb: 1, borderRadius: 2 }} />
                    ))}
                  </Box>
                ) : recentGroups.length === 0 ? (
                  <Box sx={{
                    flex: 1,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    mx: 3, mb: 3, mt: 1, py: 6, px: 3, textAlign: 'center',
                    borderRadius: 3,
                    border: `2px dashed ${alpha(BRAND.red, 0.15)}`,
                    bgcolor: alpha(BRAND.red, 0.02),
                  }}>
                    <Box sx={{
                      width: 80, height: 80, borderRadius: '50%',
                      background: `linear-gradient(135deg, ${alpha(BRAND.red, 0.08)} 0%, ${alpha(BRAND.red, 0.03)} 100%)`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      mx: 'auto', mb: 2,
                      border: `1px solid ${alpha(BRAND.red, 0.1)}`,
                    }}>
                      <Description sx={{ fontSize: 38, color: alpha(BRAND.red, 0.35) }} />
                    </Box>
                    <Typography sx={{ fontSize: '1.05rem', fontWeight: 700, color: BRAND.textPrimary, mb: 0.75 }}>
                      No agreements yet!
                    </Typography>
                    <Typography sx={{ fontSize: '0.875rem', color: '#64748B', mb: 3, maxWidth: 280, mx: 'auto' }}>
                      {canCreateAgreement
                        ? 'Get started by creating your first commercial agreement.'
                        : 'No agreements match your current view scope.'}
                    </Typography>
                    {canCreateAgreement && (
                      <Button
                        variant="contained"
                        startIcon={<Add />}
                        onClick={() => navigate(ROUTES.AGREEMENT_CREATE)}
                        sx={{
                          px: 3.5, py: 1.35, borderRadius: 3,
                          fontWeight: 700, fontSize: '0.875rem',
                          background: BRAND.redGradient,
                          boxShadow: `0 6px 20px ${alpha(BRAND.red, 0.35)}`,
                        }}
                      >
                        Create Agreement
                      </Button>
                    )}
                  </Box>
                ) : (
                  <List disablePadding sx={{ flex: 1 }}>
                    {recentGroups.map((g, i) => (
                      <Box key={g.id}>
                        <ListItemButton
                          onClick={() => navigate(`/agreements/${g.id}`)}
                          sx={{ px: 3, py: 1.8, '&:hover': { bgcolor: alpha(BRAND.red, 0.03) } }}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1, minWidth: 0 }}>
                            <Box sx={{
                              width: 40, height: 40, borderRadius: 2.5, flexShrink: 0,
                              background: `linear-gradient(135deg, ${alpha(BRAND.red, 0.1)} 0%, ${alpha(BRAND.red, 0.05)} 100%)`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              border: `1px solid ${alpha(BRAND.red, 0.08)}`,
                            }}>
                              <Description sx={{ fontSize: 18, color: BRAND.red }} />
                            </Box>
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Typography variant="body2" fontWeight={600} noWrap>{g.agreementName || 'Agreement'}</Typography>
                              <Typography variant="caption" color="text.secondary" noWrap>{g.agreementGroupName || g.ownerName}</Typography>
                            </Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexShrink: 0 }}>
                              <StatusBadge status={g.computedStatus || 'DRAFT'} />
                              <Typography variant="caption" color="text.secondary" sx={{ minWidth: 24 }}>
                                V{g.currentVersionNumber || 1}
                              </Typography>
                            </Box>
                          </Box>
                        </ListItemButton>
                        {i < recentGroups.length - 1 && <Divider sx={{ ml: 3, borderColor: '#F1F5F9' }} />}
                      </Box>
                    ))}
                  </List>
                )}
              </Paper>
            </Grid>
          )}

          <Grid size={{ xs: 12, lg: canViewAgreements ? 4 : 12 }} sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            {canViewAgreements && (
              <Paper elevation={0} sx={{ ...cardSx, p: 3 }}>
                <SectionHeader icon={<EventNote sx={{ fontSize: 18 }} />} title="Expiry Summary" />
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
                  {EXPIRY_BANDS.map(({ label, key, color, bg }) => (
                    <Box key={key} sx={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      px: 2, py: 1.35, borderRadius: 2.5,
                      background: bg,
                      border: `1px solid ${alpha(color, 0.1)}`,
                      transition: 'transform 0.15s ease',
                      '&:hover': { transform: 'translateX(3px)' },
                    }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: color, flexShrink: 0 }} />
                        <Typography sx={{ fontSize: '0.8rem', fontWeight: 500, color: '#334155' }}>
                          {label}
                        </Typography>
                      </Box>
                      <Box sx={{
                        minWidth: 28, height: 28, borderRadius: 2,
                        bgcolor: alpha(color, 0.12),
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Typography sx={{ fontSize: '0.85rem', color, fontWeight: 800 }}>
                          {loading ? '…' : (stats?.[key] ?? 0)}
                        </Typography>
                      </Box>
                    </Box>
                  ))}
                </Box>
              </Paper>
            )}

            {hasQuickActions && (
              <Paper elevation={0} sx={{ ...cardSx, p: 3, flex: 1, display: 'flex', flexDirection: 'column' }}>
                <SectionHeader icon={<Bolt sx={{ fontSize: 18 }} />} title="Quick Actions" />
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  {canApproveAgreement && (
                    <Button
                      fullWidth
                      variant="contained"
                      onClick={() => navigate(ROUTES.APPROVALS)}
                      endIcon={<ArrowForward sx={{ fontSize: '16px !important' }} />}
                      sx={{
                        justifyContent: 'space-between',
                        py: 1.5, px: 2.5, borderRadius: 3,
                        fontWeight: 700, fontSize: '0.875rem',
                        background: BRAND.redGradient,
                        boxShadow: `0 6px 20px ${alpha(BRAND.red, 0.3)}`,
                      }}
                    >
                      Approval Queue
                    </Button>
                  )}
                  {canCreateAgreement && (
                    <Button
                      fullWidth
                      variant="outlined"
                      startIcon={<Add sx={{ fontSize: '18px !important' }} />}
                      onClick={() => navigate(ROUTES.AGREEMENT_CREATE)}
                      sx={{
                        py: 1.5, borderRadius: 3,
                        fontWeight: 600, fontSize: '0.875rem',
                        borderColor: alpha(BRAND.red, 0.35),
                        borderWidth: 1.5,
                        color: BRAND.red,
                        '&:hover': { borderWidth: 1.5, borderColor: BRAND.red, bgcolor: alpha(BRAND.red, 0.04) },
                      }}
                    >
                      New Agreement
                    </Button>
                  )}
                  {canManagePriceOffs && (
                    <Button
                      fullWidth
                      variant="outlined"
                      startIcon={<LocalOfferOutlined sx={{ fontSize: '18px !important' }} />}
                      onClick={() => navigate(ROUTES.PRICE_OFFS)}
                      sx={{
                        py: 1.5, borderRadius: 3,
                        fontWeight: 600, fontSize: '0.875rem',
                        borderColor: alpha(BRAND.red, 0.35),
                        borderWidth: 1.5,
                        color: BRAND.red,
                        '&:hover': { borderWidth: 1.5, borderColor: BRAND.red, bgcolor: alpha(BRAND.red, 0.04) },
                      }}
                    >
                      Price Offs
                    </Button>
                  )}
                  {canApprovePriceOffs && (
                    <Button
                      fullWidth
                      variant="outlined"
                      onClick={() => navigate(ROUTES.PRICE_OFFS_APPROVALS)}
                      endIcon={<ArrowForward sx={{ fontSize: '16px !important' }} />}
                      sx={{
                        justifyContent: 'space-between',
                        py: 1.5, px: 2.5, borderRadius: 3,
                        fontWeight: 600, fontSize: '0.875rem',
                        borderColor: alpha(BRAND.red, 0.35),
                        borderWidth: 1.5,
                        color: BRAND.red,
                        '&:hover': { borderWidth: 1.5, borderColor: BRAND.red, bgcolor: alpha(BRAND.red, 0.04) },
                      }}
                    >
                      Price-Off Approvals
                    </Button>
                  )}
                  {canManageUsers && (
                    <Button
                      fullWidth
                      variant="outlined"
                      startIcon={<ManageAccountsOutlined sx={{ fontSize: '18px !important' }} />}
                      onClick={() => navigate(ROUTES.ADMIN_USERS)}
                      sx={{
                        py: 1.5, borderRadius: 3,
                        fontWeight: 600, fontSize: '0.875rem',
                        borderColor: alpha(BRAND.red, 0.35),
                        borderWidth: 1.5,
                        color: BRAND.red,
                        '&:hover': { borderWidth: 1.5, borderColor: BRAND.red, bgcolor: alpha(BRAND.red, 0.04) },
                      }}
                    >
                      Manage Users
                    </Button>
                  )}
                  {canManageMasterData && (
                    <Button
                      fullWidth
                      variant="outlined"
                      startIcon={<StorageOutlined sx={{ fontSize: '18px !important' }} />}
                      onClick={() => navigate(ROUTES.MASTER)}
                      sx={{
                        py: 1.5, borderRadius: 3,
                        fontWeight: 600, fontSize: '0.875rem',
                        borderColor: alpha(BRAND.red, 0.35),
                        borderWidth: 1.5,
                        color: BRAND.red,
                        '&:hover': { borderWidth: 1.5, borderColor: BRAND.red, bgcolor: alpha(BRAND.red, 0.04) },
                      }}
                    >
                      Sync Master Data
                    </Button>
                  )}
                </Box>
              </Paper>
            )}
          </Grid>
        </Grid>
      )}
    </Box>
  );
}
