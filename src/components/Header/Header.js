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
import PersonOutlineRoundedIcon from '@mui/icons-material/PersonOutlineRounded';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import KeyboardArrowDownRoundedIcon from '@mui/icons-material/KeyboardArrowDownRounded';
import HeaderSearch from './HeaderSearch';
import DarkModeToggle from './DarkModeToggle';
import { openSidebar, closeSidebar } from '../../actions/navigation';
import { logoutUser } from '../../actions/user';
import { getCurrentAdmin, getCurrentAdminProfile } from '../../utils/adminAuth';
import { getCustomerAvatar } from '../../utils/customerPhotos';
import { getAdminNotifications } from '../../services/api/customerPortalApi';
import { getAdminUnreadMessageCount } from '../../services/api/messagingApi';
import s from './Header.module.scss';

function Header({
  dispatch, history, location, isSidebarOpened,
}) {
  const [accountAnchor, setAccountAnchor] = React.useState(null);
  const [admin, setAdmin] = React.useState(getCurrentAdmin());
  const [unreadNotifications, setUnreadNotifications] = React.useState(0);
  const [unreadMessages, setUnreadMessages] = React.useState(0);
  const notificationRequestRunning = React.useRef(false);

  const loadUnreadNotifications = React.useCallback(() => {
    if (document.hidden || notificationRequestRunning.current) return Promise.resolve();
    notificationRequestRunning.current = true;
    return Promise.all([
      getAdminNotifications().then((items) => setUnreadNotifications(items.filter((item) => !item.read).length)),
      getAdminUnreadMessageCount().then(setUnreadMessages).catch(() => setUnreadMessages(0)),
    ])
      .catch(() => {})
      .finally(() => { notificationRequestRunning.current = false; });
  }, []);

  React.useEffect(() => {
    getCurrentAdminProfile().then(setAdmin).catch(() => {});
    loadUnreadNotifications();
    const refreshWhenVisible = () => {
      if (!document.hidden) loadUnreadNotifications();
    };
    const timer = window.setInterval(refreshWhenVisible, 20000);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    window.addEventListener('online', refreshWhenVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
      window.removeEventListener('online', refreshWhenVisible);
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
        <IconButton color="inherit" onClick={toggleSidebar} aria-label="Open navigation menu">
          <MenuRoundedIcon />
        </IconButton>
        <Typography component="span" className={s.mobileBrand}>Himaliya Spring</Typography>
      </Box>

      <Paper className={s.toolbar} elevation={0}>
        <HeaderSearch />
        <Divider orientation="vertical" flexItem className={s.searchDivider} />

        <Tooltip title="Messages">
          <IconButton
            component={Link}
            to="/messages"
            color="inherit"
            aria-label={unreadMessages ? `${unreadMessages} unread messages` : 'Open messages'}
            className={s.notificationButton}
          >
            <ForumOutlinedIcon fontSize="small" />
            {unreadMessages > 0 && (
              <span className={s.notificationBadge} aria-hidden="true">
                {unreadMessages > 9 ? '9+' : unreadMessages}
              </span>
            )}
          </IconButton>
        </Tooltip>

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
            All users
          </MenuItem>
          <MenuItem onClick={() => navigateTo('/app/settings')}>
            <ListItemIcon><SettingsOutlinedIcon fontSize="small" /></ListItemIcon>
            Settings
          </MenuItem>
          <MenuItem onClick={() => navigateTo('/profile')}>
            <ListItemIcon><PersonOutlineRoundedIcon fontSize="small" /></ListItemIcon>
            My profile
          </MenuItem>
          <Divider />
          <MenuItem onClick={doLogout} className={s.logoutItem}>
            <ListItemIcon><LogoutRoundedIcon fontSize="small" color="error" /></ListItemIcon>
            Sign out
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
