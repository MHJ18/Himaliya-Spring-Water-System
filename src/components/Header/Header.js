import React from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { withRouter, Link } from 'react-router-dom';
import {
  Avatar,
  Box,
  Divider,
  IconButton,
  ListItemIcon,
  Menu,
  MenuItem,
  Paper,
  Tooltip,
  Typography,
} from '@mui/material';
import MenuRoundedIcon from '@mui/icons-material/MenuRounded';
import ForumOutlinedIcon from '@mui/icons-material/ForumOutlined';
import NotificationsNoneRoundedIcon from '@mui/icons-material/NotificationsNoneRounded';
import PeopleAltOutlinedIcon from '@mui/icons-material/PeopleAltOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import PaletteOutlinedIcon from '@mui/icons-material/PaletteOutlined';
import TranslateRoundedIcon from '@mui/icons-material/TranslateRounded';
import PersonOutlineRoundedIcon from '@mui/icons-material/PersonOutlineRounded';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import KeyboardArrowDownRoundedIcon from '@mui/icons-material/KeyboardArrowDownRounded';
import HeaderSearch from './HeaderSearch';
import DarkModeToggle from './DarkModeToggle';
import { openSidebar, closeSidebar } from '../../actions/navigation';
import { logoutUser } from '../../actions/user';
import { getCurrentAdmin, getCurrentAdminProfile } from '../../utils/adminAuth';
import { getCustomerAvatar } from '../../utils/customerPhotos';
import {
  ADMIN_NOTIFICATION_STATE_EVENT,
  getAdminNotifications,
} from '../../services/api/customerPortalApi';
import { getAdminUnreadMessageCount } from '../../services/api/messagingApi';
import { raiseAdminAlerts } from '../../services/notifications/adminAlerts';
import s from './Header.module.scss';
import { useSettings } from '../../context/SettingsContext';

function Header({
  dispatch, history, location, isSidebarOpened,
}) {
  const [accountAnchor, setAccountAnchor] = React.useState(null);
  const [languageAnchor, setLanguageAnchor] = React.useState(null);
  const [admin, setAdmin] = React.useState(getCurrentAdmin());
  const [unreadNotifications, setUnreadNotifications] = React.useState(0);
  const [unreadMessages, setUnreadMessages] = React.useState(0);
  const notificationRequestRunning = React.useRef(false);
  const { settings, updateSettings } = useSettings();
  const urdu = settings.language === 'ur';

  // settingsRef keeps the poller reading current preferences without making
  // loadUnreadNotifications depend on settings, which would tear down and
  // rebuild the 20s interval on every unrelated settings change.
  const settingsRef = React.useRef(settings);
  settingsRef.current = settings;

  const loadUnreadNotifications = React.useCallback((forceRefresh = false) => {
    if (document.hidden || notificationRequestRunning.current) return Promise.resolve();
    notificationRequestRunning.current = true;
    return Promise.all([
      getAdminNotifications({ forceRefresh }).then((items) => {
        setUnreadNotifications(items.filter((item) => !item.read).length);
        // This poll is the only place the admin app learns about new activity,
        // so it is also where a device notification has to be raised.
        raiseAdminAlerts(items, settingsRef.current);
      }),
      getAdminUnreadMessageCount().then(setUnreadMessages).catch(() => setUnreadMessages(0)),
    ])
      .catch(() => {})
      .finally(() => { notificationRequestRunning.current = false; });
  }, []);

  React.useEffect(() => {
    getCurrentAdminProfile().then(setAdmin).catch(() => {});
    loadUnreadNotifications();
    const refreshWhenVisible = () => {
      if (!document.hidden) loadUnreadNotifications(true);
    };
    const timer = window.setInterval(refreshWhenVisible, 20000);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    window.addEventListener('online', refreshWhenVisible);
    window.addEventListener(ADMIN_NOTIFICATION_STATE_EVENT, refreshWhenVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
      window.removeEventListener('online', refreshWhenVisible);
      window.removeEventListener(ADMIN_NOTIFICATION_STATE_EVENT, refreshWhenVisible);
    };
  }, [loadUnreadNotifications]);

  React.useEffect(() => {
    loadUnreadNotifications();
  }, [location.pathname, loadUnreadNotifications]);

  const toggleSidebar = () => {
    dispatch(isSidebarOpened ? closeSidebar() : openSidebar());
  };

  const navigateTo = (path) => {
    setAccountAnchor(null);
    history.push(path);
  };

  const doLogout = () => {
    setAccountAnchor(null);
    history.replace('/');
    dispatch(logoutUser()).catch(() => {});
  };

  const currentAdmin = admin || {
    name: 'Himaliya Admin',
    role: 'Admin',
    email: 'admin@himaliya.com',
  };

  return (
    <Box component="header" className={s.header}>
      <Box className={s.mobileIdentity}>
        <IconButton
          color="inherit"
          onClick={toggleSidebar}
          aria-label={isSidebarOpened ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={isSidebarOpened}
          aria-controls="admin-primary-navigation"
        >
          <MenuRoundedIcon />
        </IconButton>
        <Typography component="span" className={s.mobileBrand}>
          {settings.sidebarBrandTitle || 'Himaliya Spring'}
        </Typography>
      </Box>

      <Paper className={s.toolbar} elevation={0}>
        <HeaderSearch />
        <Divider orientation="vertical" flexItem className={s.searchDivider} />

        {settings.featureMessaging !== false && (
          <Tooltip title={urdu ? 'پیغامات' : 'Messages'}>
            <IconButton
              component={Link}
              to="/messages"
              color="inherit"
              aria-label={unreadMessages ? `${unreadMessages} unread messages` : 'Open messages'}
              className={`${s.notificationButton} ${s.mobileOptionalAction}`}
            >
              <ForumOutlinedIcon fontSize="small" />
              {unreadMessages > 0 && (
                <span className={s.notificationBadge} aria-hidden="true">
                  {unreadMessages > 9 ? '9+' : unreadMessages}
                </span>
              )}
            </IconButton>
          </Tooltip>
        )}

        <Tooltip title="Notifications">
          <IconButton
            component={Link}
            to="/notifications"
            color="inherit"
            aria-label={`${unreadNotifications} unread notifications`}
            className={[s.notificationButton, unreadNotifications ? s.notificationActive : ''].filter(Boolean).join(' ')}
          >
            <NotificationsNoneRoundedIcon fontSize="small" />
            {unreadNotifications > 0 && (
              <span className={s.notificationBadge} aria-hidden="true">
                {unreadNotifications > 9 ? '9+' : unreadNotifications}
              </span>
            )}
          </IconButton>
        </Tooltip>

        <DarkModeToggle />
        <button
          type="button"
          className={s.languageButton}
          onClick={(event) => setLanguageAnchor(event.currentTarget)}
          aria-label={urdu ? 'زبان تبدیل کریں' : 'Change language'}
          aria-haspopup="menu"
          aria-expanded={Boolean(languageAnchor)}
        >
          <TranslateRoundedIcon fontSize="small" />
          <span>{urdu ? 'اردو' : 'EN'}</span>
          <KeyboardArrowDownRoundedIcon fontSize="small" />
        </button>
        <Menu
          anchorEl={languageAnchor}
          open={Boolean(languageAnchor)}
          onClose={() => setLanguageAnchor(null)}
          transformOrigin={{ horizontal: 'right', vertical: 'top' }}
          anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
          PaperProps={{ className: s.languageMenu }}
        >
          <MenuItem
            selected={!urdu}
            onClick={() => {
              updateSettings({ language: 'en', sidebarPosition: 'left' });
              setLanguageAnchor(null);
            }}
          >
            English
          </MenuItem>
          <MenuItem
            selected={urdu}
            onClick={() => {
              updateSettings({ language: 'ur', sidebarPosition: 'right' });
              setLanguageAnchor(null);
            }}
          >
            اردو
          </MenuItem>
        </Menu>
        <Divider orientation="vertical" flexItem className={s.accountDivider} />

        <button
          type="button"
          className={s.accountButton}
          onClick={(event) => setAccountAnchor(event.currentTarget)}
          aria-haspopup="menu"
          aria-expanded={Boolean(accountAnchor)}
        >
          <Avatar src={getCustomerAvatar(5)} alt="" className={s.avatar} />
          <span className={s.accountCopy}>
            <strong>{currentAdmin.name}</strong>
            <small>{currentAdmin.role || 'Admin'}</small>
          </span>
          <KeyboardArrowDownRoundedIcon fontSize="small" />
        </button>

        <Menu
          anchorEl={accountAnchor}
          open={Boolean(accountAnchor)}
          onClose={() => setAccountAnchor(null)}
          transformOrigin={{ horizontal: 'right', vertical: 'top' }}
          anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
          PaperProps={{ className: s.accountMenu }}
        >
          <Box className={s.accountSummary}>
            <Typography variant="subtitle2">{currentAdmin.name}</Typography>
            <Typography variant="caption" color="text.secondary">{currentAdmin.email}</Typography>
          </Box>
          <Divider />
          <MenuItem onClick={() => navigateTo('/app/users')}>
            <ListItemIcon><PeopleAltOutlinedIcon fontSize="small" /></ListItemIcon>
            {urdu ? 'تمام صارفین' : 'All users'}
          </MenuItem>
          <MenuItem onClick={() => navigateTo('/app/settings')}>
            <ListItemIcon><SettingsOutlinedIcon fontSize="small" /></ListItemIcon>
            {urdu ? 'ایپ سیٹنگز' : 'App settings'}
          </MenuItem>
          <MenuItem onClick={() => navigateTo('/app/ui-settings')}>
            <ListItemIcon><PaletteOutlinedIcon fontSize="small" /></ListItemIcon>
            {urdu ? 'یو آئی سیٹنگز' : 'UI settings'}
          </MenuItem>
          <MenuItem onClick={() => navigateTo('/profile')}>
            <ListItemIcon><PersonOutlineRoundedIcon fontSize="small" /></ListItemIcon>
            {urdu ? 'میری پروفائل' : 'My profile'}
          </MenuItem>
          <Divider />
          <MenuItem onClick={doLogout} className={s.logoutItem}>
            <ListItemIcon><LogoutRoundedIcon fontSize="small" color="error" /></ListItemIcon>
            {urdu ? 'سائن آؤٹ' : 'Sign out'}
          </MenuItem>
        </Menu>
      </Paper>
    </Box>
  );
}

Header.propTypes = {
  dispatch: PropTypes.func.isRequired,
  history: PropTypes.shape({
    push: PropTypes.func.isRequired,
    replace: PropTypes.func.isRequired,
  }).isRequired,
  location: PropTypes.shape({ pathname: PropTypes.string.isRequired }).isRequired,
  isSidebarOpened: PropTypes.bool,
};

Header.defaultProps = {
  isSidebarOpened: false,
};

function mapStateToProps(store) {
  return { isSidebarOpened: store.navigation.sidebarOpened };
}

export default withRouter(connect(mapStateToProps)(Header));
