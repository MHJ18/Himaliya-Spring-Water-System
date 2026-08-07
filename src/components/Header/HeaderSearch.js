import React from 'react';
import PropTypes from 'prop-types';
import { withRouter } from 'react-router-dom';
import { Box, InputBase, Paper, Typography } from '@mui/material';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import { searchRoutes } from '../Sidebar/SidebarSearch';
import { useCustomers } from '../../context/CustomerContext';
import s from './Header.module.scss';
import { useSettings } from '../../context/SettingsContext';

function normalize(value) {
  return String(value || '').trim().toLowerCase();
}

function HeaderSearch({ history }) {
  const { customers } = useCustomers();
  const { settings } = useSettings();
  const urdu = settings.language === 'ur';
  const [searchQuery, setSearchQuery] = React.useState('');
  const [focused, setFocused] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState(0);
  const query = normalize(searchQuery);

  const results = React.useMemo(() => {
    if (!query) {
      return searchRoutes
        .filter((item) => item.featured)
        .slice(0, 5)
        .map((item) => ({ ...item, type: 'page' }));
    }

    const pageResults = searchRoutes
      .filter((item) => normalize(`${item.label} ${item.keywords} ${item.description}`).includes(query))
      .slice(0, 4)
      .map((item) => ({ ...item, type: 'page' }));
    const digits = query.replace(/\D/g, '');
    const customerResults = customers
      .filter((customer) => (
        normalize(customer.name).includes(query)
        || normalize(customer.email).includes(query)
        || normalize(customer.address).includes(query)
        || (digits && String(customer.phone || '').replace(/\D/g, '').includes(digits))
      ))
      .slice(0, 3)
      .map((customer) => ({
        type: 'customer',
        label: customer.name,
        description: customer.phone || customer.email || customer.address || 'Customer record',
        category: 'Customer',
        path: `/app/customers?search=${encodeURIComponent(customer.name)}&customer=${encodeURIComponent(customer.id)}`,
      }));
    const invoiceResult = /^(hsw[-\s]?)?[a-z0-9-]{5,}$/i.test(searchQuery.trim())
      ? [{
        type: 'invoice',
        label: `Find invoice ${searchQuery.trim().toUpperCase()}`,
        description: 'Open Invoice Center with this number ready',
        category: 'Invoice',
        path: `/app/invoice?invoice=${encodeURIComponent(searchQuery.trim().toUpperCase())}`,
      }]
      : [];

    return [...customerResults, ...invoiceResult, ...pageResults].slice(0, 7);
  }, [customers, query, searchQuery]);

  React.useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  const goToSearchResult = (path) => {
    setSearchQuery('');
    setFocused(false);
    history.push(path);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!query) return;
    const target = results[activeIndex] || results[0];
    goToSearchResult(target
      ? target.path
      : `/app/customers?search=${encodeURIComponent(searchQuery.trim())}`);
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Escape') {
      setSearchQuery('');
      setFocused(false);
      return;
    }
    if (!results.length) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % results.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((current) => (current - 1 + results.length) % results.length);
    }
  };

  return (
    <Box component="form" className={s.searchForm} onSubmit={handleSubmit} role="search">
      <SearchRoundedIcon className={s.searchIcon} aria-hidden="true" />
      <InputBase
        value={searchQuery}
        onChange={(event) => {
          setSearchQuery(event.target.value);
          setFocused(true);
        }}
        onFocus={() => setFocused(true)}
        onClick={() => setFocused(true)}
        onBlur={() => window.setTimeout(() => setFocused(false), 120)}
        onKeyDown={handleKeyDown}
        placeholder={urdu ? 'صارف، انوائس یا صفحہ تلاش کریں' : 'Search customers, invoices, pages'}
        inputProps={{
          'aria-label': urdu ? 'ڈیش بورڈ تلاش کریں' : 'Search dashboard',
          'aria-autocomplete': 'list',
          'aria-controls': focused ? 'header-search-results' : undefined,
          'aria-activedescendant': focused && results.length ? `header-search-result-${activeIndex}` : undefined,
        }}
        className={s.searchInput}
      />
      {focused && (query || results.length > 0) && (
        <Paper
          id="header-search-results"
          className={s.searchResults}
          elevation={12}
          role="listbox"
          aria-label={query ? (urdu ? 'تلاش کے نتائج' : 'Search results') : (urdu ? 'فوری لنکس' : 'Quick links')}
        >
          <div className={s.searchResultsLabel}>
            {query ? (urdu ? 'بہترین نتائج' : 'Best matches') : (urdu ? 'فوری لنکس' : 'Quick links')}
          </div>
          {results.map((item, index) => (
            <button
              id={`header-search-result-${index}`}
              key={`${item.type}-${item.path}`}
              type="button"
              role="option"
              aria-selected={index === activeIndex}
              className={index === activeIndex ? s.searchResultActive : ''}
              onMouseDown={(event) => {
                event.preventDefault();
                goToSearchResult(item.path);
              }}
              onMouseEnter={() => setActiveIndex(index)}
            >
              <span>
                <Typography component="span" variant="body2">{item.label}</Typography>
                <small>{item.description || item.keywords}</small>
              </span>
              <span className={s.searchResultMeta}>
                <em>{item.category || 'Page'}</em>
                <ArrowForwardRoundedIcon fontSize="small" />
              </span>
            </button>
          ))}
          {query && !results.length && (
            <button type="submit">
              <span>
                <Typography component="span" variant="body2">Search customer records</Typography>
                <small>{searchQuery.trim()}</small>
              </span>
              <ArrowForwardRoundedIcon fontSize="small" />
            </button>
          )}
          <div className={s.searchHint}>↑↓ navigate · Enter open · Esc close</div>
        </Paper>
      )}
    </Box>
  );
}

HeaderSearch.propTypes = {
  history: PropTypes.shape({ push: PropTypes.func.isRequired }).isRequired,
};

export default withRouter(HeaderSearch);
