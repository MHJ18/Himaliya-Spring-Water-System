import React from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { withRouter, Link } from 'react-router-dom';
import {
  Box,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  ListSubheader,
  Tooltip,
  Typography,
} from '@mui/material';
import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded';
import PersonAddAlt1RoundedIcon from '@mui/icons-material/PersonAddAlt1Rounded';
import Groups2RoundedIcon from '@mui/icons-material/Groups2Rounded';
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded';
import PointOfSaleRoundedIcon from '@mui/icons-material/PointOfSaleRounded';
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded';
import LocalShippingRoundedIcon from '@mui/icons-material/LocalShippingRounded';
import ManageAccountsRoundedIcon from '@mui/icons-material/ManageAccountsRounded';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';
import WaterDropRoundedIcon from '@mui/icons-material/WaterDropRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import TodayRoundedIcon from '@mui/icons-material/TodayRounded';
import AssessmentOutlinedIcon from '@mui/icons-material/AssessmentOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
import MyLocationRoundedIcon from '@mui/icons-material/MyLocationRounded';
import SidebarSearch from './SidebarSearch';
import { changeActiveSidebarItem, closeSidebar } from '../../actions/navigation';
import s from './Sidebar.module.scss';

const sections = [
  {
    title: 'Workspace',
    items: [
      { label: 'Dashboard', path: '/app/main/dashboard', key: 'dashboard', icon: DashboardRoundedIcon },
    ],
  },
  {
    title: 'Customers',
    items: [
      { label: 'Add customer', path: '/app/add-customer', key: 'add-customer', icon: PersonAddAlt1RoundedIcon },
      { label: 'Customer records', path: '/app/customers', key: 'customers', icon: Groups2RoundedIcon },
      { label: 'Invoice center', path: '/app/invoice', key: 'invoice', icon: ReceiptLongRoundedIcon },
    ],
  },
  {
    title: 'Operations',
    items: [
      { label: 'Daily sales', path: '/app/daily-sales', key: 'daily-sales', icon: PointOfSaleRoundedIcon },
      { label: 'Analytics', path: '/app/analytics', key: 'analytics', icon: InsightsRoundedIcon },
      { label: 'Customer orders', path: '/app/customer-orders', key: 'customer-orders', icon: LocalShippingRoundedIcon },
      { label: 'Delivery tracker', path: '/app/rider-tracking', key: 'rider-tracking', icon: MyLocationRoundedIcon },
      { label: 'Entry history', path: '/app/history', key: 'history', icon: HistoryRoundedIcon },
    ],
  },
  {
    title: 'Administration',
    items: [
      { label: 'All users', path: '/app/users', key: 'users', icon: ManageAccountsRoundedIcon },
      { label: 'Settings', path: '/app/settings', key: 'settings', icon: TuneRoundedIcon },
    ],
  },
];

const quickLinks = [
  { label: "Today's sales", path: '/app/daily-sales', icon: TodayRoundedIcon },
  { label: 'Delivery queue', path: '/app/customer-orders', icon: LocalShippingRoundedIcon },
  { label: 'Delivery tracker', path: '/app/rider-tracking', icon: MyLocationRoundedIcon },
  { label: 'Reports', path: '/app/analytics', icon: AssessmentOutlinedIcon },
];

function Sidebar({
  sidebarOpened, dispatch, location, sidebarPosition, sidebarVisibility,
}) {
  const closeDrawer = () => dispatch(closeSidebar());
  const hidden = sidebarVisibility === 'hide';
  const isActive = (item) => {
    if (item.path === '/app/main/dashboard') return location.pathname === item.path;
    return location.pathname.indexOf(item.path) === 0;
  };

  const handleNavigate = (key) => {
    dispatch(changeActiveSidebarItem(key));
    closeDrawer();
  };

  return (
    <Box
      component="aside"
      className={[
        s.root,
        sidebarOpened ? s.drawerOpen : '',
        sidebarPosition === 'right' ? s.rootRight : '',
        hidden ? s.hidden : '',
      ].join(' ')}
      aria-label="Primary navigation"
    >
      <Box className={s.brandRow}>
        <Link to="/app/main/dashboard" className={s.brand} onClick={closeDrawer}>
          <span className={s.brandMark} aria-hidden="true"><WaterDropRoundedIcon /></span>
          <span>Himaliya <strong>Spring</strong></span>
        </Link>
        <IconButton className={s.closeButton} onClick={closeDrawer} aria-label="Close navigation menu">
          <CloseRoundedIcon />
        </IconButton>
      </Box>

      <Box className={s.mobileSearch}>
        <SidebarSearch onNavigate={closeDrawer} />
      </Box>

      <Box className={s.navigation}>
        {sections.map((section) => (
          <List
            key={section.title}
            dense
            disablePadding
            subheader={(
              <ListSubheader component="div" disableSticky className={s.sectionTitle}>
                {section.title}
              </ListSubheader>
            )}
          >
            {section.items.map((item) => {
              const Icon = item.icon;
              const active = isActive(item);
              return (
                <Tooltip key={item.key} title={item.label} placement="right" disableHoverListener>
                  <ListItemButton
                    component={Link}
                    to={item.path}
                    selected={active}
                    onClick={() => handleNavigate(item.key)}
                    className={s.navItem}
                    aria-current={active ? 'page' : undefined}
                  >
                    <ListItemIcon className={s.navIcon}><Icon fontSize="small" /></ListItemIcon>
                    <ListItemText
                      primary={item.label}
                      primaryTypographyProps={{ variant: 'body2', fontWeight: active ? 750 : 560 }}
                    />
                  </ListItemButton>
                </Tooltip>
              );
            })}
          </List>
        ))}
      </Box>

      <Box className={s.quickLinks}>
        <Typography component="h2" variant="overline">Quick access</Typography>
        {quickLinks.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.path} to={item.path} onClick={closeDrawer}>
              <Icon fontSize="small" />
              <span>{item.label}</span>
            </Link>
          );
        })}
        <div className={s.cloudStatus}>
          <Inventory2OutlinedIcon fontSize="small" />
          <span><strong>Cloud workspace</strong><small>Supabase connected</small></span>
          <i aria-label="Online" />
        </div>
      </Box>
    </Box>
  );
}

Sidebar.propTypes = {
  sidebarOpened: PropTypes.bool,
  dispatch: PropTypes.func.isRequired,
  location: PropTypes.shape({ pathname: PropTypes.string.isRequired }).isRequired,
  sidebarPosition: PropTypes.string,
  sidebarVisibility: PropTypes.string,
};

Sidebar.defaultProps = {
  sidebarOpened: false,
  sidebarPosition: 'left',
  sidebarVisibility: 'show',
};

function mapStateToProps(store) {
  return {
    sidebarOpened: store.navigation.sidebarOpened,
    sidebarPosition: store.navigation.sidebarPosition,
    sidebarVisibility: store.navigation.sidebarVisibility,
  };
}

export default withRouter(connect(mapStateToProps)(Sidebar));
