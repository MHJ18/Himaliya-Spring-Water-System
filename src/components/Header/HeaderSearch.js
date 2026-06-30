import React from 'react';
import PropTypes from 'prop-types';
import { withRouter } from 'react-router-dom';
import { InputGroup, InputGroupAddon, InputGroupText, Input, Form, FormGroup } from 'reactstrap';
import SearchIcon from '../Icons/HeaderIcons/SearchIcon';
import { searchRoutes } from '../Sidebar/SidebarSearch';
import s from './Header.module.scss';

class HeaderSearch extends React.Component {
  static propTypes = {
    history: PropTypes.shape({ push: PropTypes.func.isRequired }).isRequired,
  };

  constructor(props) {
    super(props);
    this.state = { searchQuery: '' };
  }

  getSearchResults = () => {
    const query = this.state.searchQuery.trim().toLowerCase();
    if (!query) return [];
    return searchRoutes
      .filter((item) => `${item.label} ${item.keywords}`.toLowerCase().includes(query))
      .slice(0, 5);
  };

  goToSearchResult = (path) => {
    this.setState({ searchQuery: '' });
    this.props.history.push(path);
  };

  handleSubmit = (event) => {
    event.preventDefault();
    const query = this.state.searchQuery.trim();
    if (!query) return;
    const result = this.getSearchResults()[0];
    this.goToSearchResult(result ? result.path : `/app/customers?search=${encodeURIComponent(query)}`);
  };

  render() {
    const { searchQuery } = this.state;
    const results = this.getSearchResults();

    return (
      <Form className={`${s.searchForm} ${s.desktopOnly}`} inline onSubmit={this.handleSubmit}>
        <FormGroup>
          <InputGroup className={`input-group-no-border ${s.searchInputGroup}`}>
            <InputGroupAddon addonType="prepend">
              <InputGroupText className={s.inputGroupText} tag="span">
                <SearchIcon className={s.headerIcon} aria-hidden="true" />
              </InputGroupText>
            </InputGroupAddon>
            <Input
              value={searchQuery}
              onChange={(event) => this.setState({ searchQuery: event.target.value })}
              className={`input-transparent ${s.searchInput}`}
              placeholder="Search customers, sales, pages"
              aria-label="Search dashboard"
            />
          </InputGroup>
        </FormGroup>
        {searchQuery && (
          <div className={s.searchResults}>
            {results.map((item) => (
              <button key={item.path} type="button" onMouseDown={() => this.goToSearchResult(item.path)}>
                {item.label}
                <span>&rarr;</span>
              </button>
            ))}
            {!results.length && (
              <button type="submit">
                Search customers for &ldquo;{searchQuery}&rdquo;
                <span>&rarr;</span>
              </button>
            )}
          </div>
        )}
      </Form>
    );
  }
}

export default withRouter(HeaderSearch);
