import React from 'react';
import PropTypes from 'prop-types';
import { withRouter } from 'react-router-dom';
import { InputBase, Paper } from '@mui/material';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import s from './Sidebar.module.scss';

export const searchRoutes = [
  { label: 'Dashboard', keywords: 'overview home metrics', path: '/app/main/dashboard' },
  { label: 'Customer Records', keywords: 'customer records phone address balance', path: '/app/customers' },
  { label: 'Invoice Center', keywords: 'invoice bill number verify paid unpaid', path: '/app/invoice' },
  { label: 'Add Customer', keywords: 'new customer create', path: '/app/add-customer' },
  { label: 'Daily Sales', keywords: 'sale order entry bottle gallon', path: '/app/daily-sales' },
  { label: 'Customer Orders', keywords: 'history deliveries orders requests accept delivery', path: '/app/customer-orders' },
  { label: 'Delivery Tracker', keywords: 'rider driver dispatch gps live map delivery route ready picked up', path: '/app/rider-tracking' },
  { label: 'Entry History', keywords: 'all entries ledger sales transactions archive history', path: '/app/history' },
  { label: 'Analytics', keywords: 'monthly report revenue', path: '/app/analytics' },
  { label: 'All Users', keywords: 'admins customers signed up users access', path: '/app/users' },
  { label: 'Settings', keywords: 'business theme appearance workflow', path: '/app/settings' },
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
