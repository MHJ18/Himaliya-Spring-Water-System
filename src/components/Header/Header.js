import { connect } from 'react-redux';
import React from 'react';
import PropTypes from 'prop-types';
import { withRouter, Link } from 'react-router-dom';
import {
  Navbar, Nav, NavItem, NavLink, Dropdown, DropdownToggle, DropdownMenu, DropdownItem,
} from 'reactstrap';
import HeaderSearch from './HeaderSearch';
import DarkModeToggle from './DarkModeToggle';
import BellIcon from '../Icons/HeaderIcons/BellIcon';
import MessageIcon from '../Icons/HeaderIcons/MessageIcon';
import BurgerIcon from '../Icons/HeaderIcons/BurgerIcon';
import {
  openSidebar, closeSidebar,
} from '../../actions/navigation';
import { logoutUser } from '../../actions/user';
import { getCurrentAdmin, getCurrentAdminProfile } from '../../utils/adminAuth';
import { getCustomerAvatar } from '../../utils/customerPhotos';
import { getAdminNotifications } from '../../services/api/customerPortalApi';
import s from './Header.module.scss';
import 'animate.css';

class Header extends React.Component {
  static propTypes = { dispatch: PropTypes.func.isRequired };

  constructor(props) {
    super(props);
    this.state = {
      accountOpen: false,
      admin: getCurrentAdmin(),
      unreadNotifications: 0,
    };
  }

  componentDidMount() {
    getCurrentAdminProfile().then((admin) => this.setState({ admin })).catch(() => {});
    this.loadUnreadNotifications();
    this.notificationTimer = window.setInterval(this.loadUnreadNotifications, 20000);
  }

  componentDidUpdate(prevProps) {
    if (prevProps.location.pathname !== this.props.location.pathname) {
      this.loadUnreadNotifications();
    }
  }

  componentWillUnmount() {
    if (this.notificationTimer) window.clearInterval(this.notificationTimer);
  }

  loadUnreadNotifications = () => {
    getAdminNotifications()
      .then((items) => this.setState({ unreadNotifications: items.filter((item) => !item.read).length }))
      .catch(() => {});
  };

  toggleSidebar = () => {
    this.props.isSidebarOpened
      ? this.props.dispatch(closeSidebar())
      : this.props.dispatch(openSidebar());
  };

  doLogout = () => {
    const logout = this.props.dispatch(logoutUser());
    this.props.history.replace('/');
    return logout;
  };

  render() {
    const admin = this.state.admin || { name: 'Himaliya Admin', role: 'Admin', email: 'admin@himaliya.com' };
    return (
      <Navbar className="d-print-none">
        <div className={s.burger}>
          <NavLink onClick={this.toggleSidebar} className={`${s.burgerButton} ${s.navItem} text-white`} href="#" aria-label="Open menu">
            <BurgerIcon className={s.headerIcon} />
          </NavLink>
        </div>
        <span className={s.mobileBrand}>Himaliya Spring</span>
        <div className={`d-print-none ${s.root}`}>
          <Nav className={`ml-md-0 ${s.headerNav}`}>
            <NavItem className={s.desktopSearch}>
              <HeaderSearch />
            </NavItem>
            <NavItem>
              <Link to="/messages" className={`${s.navItem} ${s.iconLink} nav-link text-white`} aria-label="Messages">
                <MessageIcon className={s.headerIcon} />
              </Link>
            </NavItem>
            <NavItem>
              <Link
                to="/notifications"
                className={`${s.navItem} ${s.iconLink} ${this.state.unreadNotifications ? s.notificationActive : ''} nav-link text-white`}
                aria-label={`${this.state.unreadNotifications} unread notifications`}
              >
                <BellIcon className={s.headerIcon} />
                {this.state.unreadNotifications > 0 && <div className={s.count}>{this.state.unreadNotifications > 9 ? '9+' : this.state.unreadNotifications}</div>}
              </Link>
            </NavItem>
            <DarkModeToggle />
            <NavItem className={`${s.divider} ${s.desktopOnly}`} />
            <Dropdown nav isOpen={this.state.accountOpen} toggle={() => this.setState({ accountOpen: !this.state.accountOpen })} className={s.accountDropdown}>
              <DropdownToggle nav caret className={s.accountToggle}>
                <span className={`${s.avatar} rounded-circle thumb-sm float-left`}>
                  <img src={getCustomerAvatar(5)} alt="Admin" />
                </span>
                <span className={`small ${s.accountCheck}`}>{admin.name}</span>
              </DropdownToggle>
              <DropdownMenu right className={`${s.dropdownMenu} ${s.account}`}>
                <section>
                  <strong>{admin.name}</strong>
                  <br />
                  <small className="text-muted">{admin.role} access</small>
                </section>
                <DropdownItem><Link to="/app/users"><i className="fa fa-users" />All Users</Link></DropdownItem>
                <DropdownItem><Link to="/app/settings"><i className="fa fa-cog" />Settings</Link></DropdownItem>
                <DropdownItem><Link to="/profile"><i className="fa fa-user" />Profile</Link></DropdownItem>
                <DropdownItem onClick={this.doLogout}><i className="fa fa-sign-out" />Logout</DropdownItem>
              </DropdownMenu>
            </Dropdown>
          </Nav>
        </div>
      </Navbar>
    );
  }
}

function mapStateToProps(store) {
  return {
    isSidebarOpened: store.navigation.sidebarOpened,
  };
}

export default withRouter(connect(mapStateToProps)(Header));
