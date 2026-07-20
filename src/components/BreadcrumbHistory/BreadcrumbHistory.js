import React from 'react';
import PropTypes from 'prop-types';
import { Box, Breadcrumbs, Typography } from '@mui/material';
import NavigateNextRoundedIcon from '@mui/icons-material/NavigateNextRounded';

const friendlyNames = {
  app: 'Admin',
  main: 'Workspace',
  dashboard: 'Dashboard',
  customers: 'Customers',
  invoice: 'Invoice center',
  'daily-sales': 'Daily sales',
  analytics: 'Analytics',
  'customer-orders': 'Customer orders',
  'rider-tracking': 'Delivery tracker',
  history: 'Entry history',
  users: 'All users',
  settings: 'Settings',
  messages: 'Messages',
  notifications: 'Notifications',
  profile: 'Profile',
};

export default function BreadcrumbHistory({ url }) {
  const route = url
    .split('/')
    .filter(Boolean)
    .filter((part) => part !== 'app' && part !== 'main')
    .map((part) => friendlyNames[part] || part
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' '));

  if (!route.length) return null;

  return (
    <Box
      component="nav"
      aria-label="Breadcrumb"
      sx={{ display: { xs: 'none', md: 'block' }, mb: 1.5 }}
    >
      <Breadcrumbs separator={<NavigateNextRoundedIcon sx={{ fontSize: 14 }} />} aria-label="Page location">
        <Typography variant="caption" color="text.secondary">Workspace</Typography>
        {route.map((item, index) => (
          <Typography
            key={`${item}-${index}`}
            variant="caption"
            color={index === route.length - 1 ? 'text.primary' : 'text.secondary'}
            fontWeight={index === route.length - 1 ? 700 : 500}
          >
            {item}
          </Typography>
        ))}
      </Breadcrumbs>
    </Box>
  );
}

BreadcrumbHistory.propTypes = {
  url: PropTypes.string.isRequired,
};
