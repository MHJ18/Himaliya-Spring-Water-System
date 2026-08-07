import React from 'react';
import PropTypes from 'prop-types';
import { withRouter } from 'react-router-dom';
import { InputBase, Paper } from '@mui/material';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import s from './Sidebar.module.scss';

export const searchRoutes = [
  { label: 'Dashboard', description: 'Sales and operations overview', category: 'Page', keywords: 'overview home metrics performance', path: '/app/main/dashboard', featured: true },
  { label: 'Customer Records', description: 'Profiles, balances, history, and invoices', category: 'Page', keywords: 'customer records phone address balance', path: '/app/customers', featured: true },
  { label: 'Invoice Center', description: 'Find, validate, and update invoices', category: 'Page', keywords: 'invoice bill number verify paid unpaid', path: '/app/invoice' },
  { label: 'Add Customer', description: 'Create a new customer record', category: 'Action', keywords: 'new customer create register', path: '/app/add-customer', featured: true },
  { label: 'Record Daily Sale', description: 'Add a bottle delivery and payment', category: 'Action', keywords: 'sale order entry bottle gallon payment', path: '/app/daily-sales', featured: true },
  { label: 'Customer Orders', description: 'Accept and manage portal orders', category: 'Page', keywords: 'history deliveries orders requests accept delivery', path: '/app/customer-orders' },
  { label: 'Delivery Tracker', description: 'Live riders, routes, and dispatch', category: 'Page', keywords: 'rider driver dispatch gps live map delivery route ready picked up', path: '/app/rider-tracking' },
  { label: 'Entry History', description: 'Browse the complete sales ledger', category: 'Page', keywords: 'all entries ledger sales transactions archive history', path: '/app/history' },
  { label: 'Analytics', description: 'Revenue and customer reporting', category: 'Page', keywords: 'monthly report revenue chart trends', path: '/app/analytics' },
  { label: 'Messages', description: 'Customer support conversations', category: 'Page', keywords: 'chat inbox support customer messages', path: '/messages', featured: true },
  { label: 'Notifications', description: 'Orders, payments, stock, and alerts', category: 'Page', keywords: 'alerts updates unread order notification', path: '/notifications' },
  { label: 'All Users', description: 'Admins, riders, and customer access', category: 'Page', keywords: 'admins customers signed up users access rider', path: '/app/users' },
  { label: 'App Settings', description: 'Company features, workflow, catalog, and data', category: 'Page', keywords: 'business company workflow features prices inventory settings', path: '/app/settings' },
  { label: 'UI Settings', description: 'Dashboard, theme, palette, language, and navigation', category: 'Page', keywords: 'theme palette appearance interface dashboard language sidebar accessibility', path: '/app/ui-settings' },
  { label: 'Bottle Designer', description: 'Edit 19L and 1.5L labels with a live preview', category: 'Tool', keywords: 'bottle label print branding 19l 1.5l color size', path: '/app/bottle-designer' },
  { label: 'My Profile', description: 'Admin account details', category: 'Page', keywords: 'account admin profile personal', path: '/profile' },
];

function SidebarSearch({ history, onNavigate }) {
  const [searchQuery, setSearchQuery] = React.useState('');
  const query = searchQuery.trim().toLowerCase();
  const results = query
    ? searchRoutes
      .filter((item) => `${item.label} ${item.keywords}`.toLowerCase().includes(query))
      .slice(0, 5)
    : [];

  const goToSearchResult = (path) => {
    setSearchQuery('');
    onNavigate();
    history.push(path);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!query) return;
    goToSearchResult(results.length
      ? results[0].path
      : `/app/customers?search=${encodeURIComponent(searchQuery.trim())}`);
  };

  return (
    <form className={s.sidebarSearch} onSubmit={handleSubmit}>
      <SearchRoundedIcon fontSize="small" aria-hidden="true" />
      <InputBase
        value={searchQuery}
        onChange={(event) => setSearchQuery(event.target.value)}
        placeholder="Search workspace"
        inputProps={{ 'aria-label': 'Search workspace' }}
      />
      {query && (
        <Paper className={s.sidebarSearchResults} elevation={10}>
          {results.map((item) => (
            <button key={item.path} type="button" onMouseDown={() => goToSearchResult(item.path)}>
              {item.label}
              <ArrowForwardRoundedIcon fontSize="small" />
            </button>
          ))}
          {!results.length && (
            <button type="submit">
              Search customers
              <ArrowForwardRoundedIcon fontSize="small" />
            </button>
          )}
        </Paper>
      )}
    </form>
  );
}

SidebarSearch.propTypes = {
  history: PropTypes.shape({ push: PropTypes.func.isRequired }).isRequired,
  onNavigate: PropTypes.func,
};

SidebarSearch.defaultProps = {
  onNavigate: () => {},
};

export default withRouter(SidebarSearch);
