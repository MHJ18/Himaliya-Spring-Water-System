import React from 'react';
import PropTypes from 'prop-types';
import { withRouter } from 'react-router-dom';
import { InputGroup, InputGroupAddon, InputGroupText, Input, Form } from 'reactstrap';
import SearchIcon from '../Icons/HeaderIcons/SearchIcon';
import s from './Sidebar.module.scss';

export const searchRoutes = [
  { label: 'Dashboard', keywords: 'overview home metrics', path: '/app/main/dashboard' },
  { label: 'Customer Records', keywords: 'customer records phone address balance', path: '/app/customers' },
  { label: 'Invoice Lookup', keywords: 'invoice bill number verify', path: '/app/invoice' },
  { label: 'Add Customer', keywords: 'new customer create', path: '/app/add-customer' },
  { label: 'Daily Sales', keywords: 'sale order entry bottle gallon', path: '/app/daily-sales' },
  { label: 'Customer Orders', keywords: 'history deliveries orders portal app customer order requests accept delivery', path: '/app/customer-orders' },
  { label: 'Analytics', keywords: 'monthly report revenue', path: '/app/analytics' },
  { label: 'All Users', keywords: 'admins customers signed up users delete access', path: '/app/users' },
  { label: 'Settings', keywords: 'business theme appearance', path: '/app/settings' },
];

class SidebarSearch extends React.Component {
  static propTypes = {
    history: PropTypes.shape({ push: PropTypes.func.isRequired }).isRequired,
    onNavigate: PropTypes.func,
  };

  static defaultProps = {
    onNavigate: () => {},
  };

  constructor(props) {
    super(props);
    this.state = { searchQuery: '', focused: false };
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
    this.props.onNavigate();
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
    const { searchQuery, focused } = this.state;
    const results = this.getSearchResults();

    return (
      <Form className={s.sidebarSearch} onSubmit={this.handleSubmit}>
        <InputGroup className={`${s.sidebarSearchGroup} ${focused ? s.sidebarSearchGroupFocused : ''}`}>
          <InputGroupAddon addonType="prepend">
            <InputGroupText className={s.sidebarSearchIcon}>
              <SearchIcon className={s.sidebarSearchGlyph} />
            </InputGroupText>
          </InputGroupAddon>
          <Input
            value={searchQuery}
            onChange={(event) => this.setState({ searchQuery: event.target.value })}
            onFocus={() => this.setState({ focused: true })}
            onBlur={() => this.setState({ focused: false })}
            className={`input-transparent ${s.sidebarSearchInput}`}
            placeholder="Search pages, customers..."
            aria-label="Search dashboard"
          />
        </InputGroup>
        {searchQuery && (
          <div className={s.sidebarSearchResults}>
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

export default withRouter(SidebarSearch);
