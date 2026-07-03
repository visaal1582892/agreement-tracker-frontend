import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Badge, Box, CircularProgress, Divider, IconButton, Menu, MenuItem, Typography,
} from '@mui/material';
import { NotificationsNone } from '@mui/icons-material';
import axiosInstance from '../../api/axiosInstance';
import { ENDPOINTS } from '../../config/endpoints';
import { buildAgreementDetailPath } from '../../utils/agreementNavigation';
import dayjs from 'dayjs';

function formatReminderLabel(reminderType) {
  if (reminderType === 'EXPIRED_DAILY') return 'Agreement expired';
  if (reminderType?.startsWith('D_')) {
    const days = reminderType.replace('D_', '');
    return `Expires in ${days} day${days === '1' ? '' : 's'}`;
  }
  return reminderType?.replace(/_/g, ' ') || 'Reminder';
}

export default function NotificationBell() {
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [reminders, setReminders] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchUnread = useCallback(async () => {
    try {
      const { data } = await axiosInstance.get(ENDPOINTS.REMINDERS_UNREAD);
      setReminders(data.reminders ?? []);
      setUnreadCount(data.count ?? 0);
    } catch {
      setReminders([]);
      setUnreadCount(0);
    }
  }, []);

  useEffect(() => {
    fetchUnread();
  }, [fetchUnread]);

  const handleOpen = async (event) => {
    setAnchorEl(event.currentTarget);
    setLoading(true);
    await fetchUnread();
    setLoading(false);
  };

  const handleClose = () => setAnchorEl(null);

  const handleReminderClick = async (reminder) => {
    handleClose();
    try {
      await axiosInstance.patch(ENDPOINTS.REMINDER_MARK_READ(reminder.id));
    } catch {
      // still navigate on read failure
    }
    setUnreadCount((c) => Math.max(0, c - 1));
    setReminders((prev) => prev.filter((r) => r.id !== reminder.id));
    const path = buildAgreementDetailPath(reminder.agreementId);
    if (path) navigate(path);
  };

  return (
    <>
      <IconButton sx={{ color: '#64748B' }} onClick={handleOpen}>
        <Badge
          badgeContent={unreadCount}
          color="error"
          sx={{ '& .MuiBadge-badge': { fontSize: '0.62rem', fontWeight: 700, minWidth: 17, height: 17 } }}
        >
          <NotificationsNone sx={{ fontSize: 22 }} />
        </Badge>
      </IconButton>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleClose}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        PaperProps={{
          sx: { mt: 1, minWidth: 320, maxWidth: 380, borderRadius: 2 },
        }}
      >
        <Box sx={{ px: 2, py: 1.5 }}>
          <Typography variant="subtitle2" fontWeight={700}>Notifications</Typography>
          <Typography variant="caption" color="text.secondary">
            {unreadCount} unread
          </Typography>
        </Box>
        <Divider />
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
            <CircularProgress size={22} />
          </Box>
        ) : reminders.length === 0 ? (
          <Box sx={{ px: 2, py: 2.5 }}>
            <Typography variant="body2" color="text.secondary">No unread reminders</Typography>
          </Box>
        ) : (
          reminders.map((reminder) => (
            <MenuItem
              key={reminder.id}
              onClick={() => handleReminderClick(reminder)}
              sx={{ alignItems: 'flex-start', py: 1.25, whiteSpace: 'normal' }}
            >
              <Box>
                <Typography variant="body2" fontWeight={600}>
                  {reminder.agreementName || 'Agreement'}
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block">
                  {formatReminderLabel(reminder.reminderType)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {reminder.sentAt ? dayjs(reminder.sentAt).format('DD MMM YYYY, hh:mm A') : ''}
                </Typography>
              </Box>
            </MenuItem>
          ))
        )}
      </Menu>
    </>
  );
}
