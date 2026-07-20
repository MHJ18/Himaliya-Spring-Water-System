import React from 'react';
import PropTypes from 'prop-types';
import { withRouter } from 'react-router-dom';
import { Box, InputBase, Paper, Typography } from '@mui/material';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import { searchRoutes } from '../Sidebar/SidebarSearch';
import s from './Header.module.scss';

function HeaderSearch({ history }) {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [focused, setFocused] = React.useState(false);
  const query = searchQuery.trim().toLowerCase();
  const results = query
    ? searchRoutes
      .filter((item) => `${item.label} ${item.keywords}`.toLowerCase().includes(query))
      .slice(0, 5)
    : [];

  const goToSearchResult = (path) => {
    setSearchQuery('');
    setFocused(false);
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
    <Box component="form" className={s.searchForm} onSubmit={handleSubmit} role="search">
      <SearchRoundedIcon className={s.searchIcon} aria-hidden="true" />
      <InputBase
        value={searchQuery}
        onChange={(event) => setSearchQuery(event.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => window.setTimeout(() => setFocused(false), 120)}
        placeholder="Search customers, sales, pages"
        inputProps={{ 'aria-label': 'Search dashboard' }}
        className={s.searchInput}
      />
      {focused && query && (
        <Paper className={s.searchResults} elevation={12}>
          {results.map((item) => (
            <button key={item.path} type="button" onMouseDown={() => goToSearchResult(item.path)}>
              <span>
                <Typography component="span" variant="body2">{item.label}</Typography>
                <small>{item.keywords.split(' ').slice(0, 3).join(' ')}</small>
              </span>
              <ArrowForwardRoundedIcon fontSize="small" />
            </button>
          ))}
          {!results.length && (
            <button type="submit">
              <span>
                <Typography component="span" variant="body2">Search customer records</Typography>
                <small>{searchQuery.trim()}</small>
              </span>
              <ArrowForwardRoundedIcon fontSize="small" />
            </button>
          )}
        </Paper>
      )}
    </Box>
  );
}

HeaderSearch.propTypes = {
  history: PropTypes.shape({ push: PropTypes.func.isRequired }).isRequired,
};

export default withRouter(HeaderSearch);
