import React from 'react';
import cx from 'classnames';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { withRouter, Link } from 'react-router-dom';
import s from './Sidebar.module.scss';
import LinksGroup from './LinksGroup/LinksGroup';

import SidebarSearch from './SidebarSearch';
import { changeActiveSidebarItem, closeSidebar } from '../../actions/navigation';
import HomeIcon from '../Icons/SidebarIcons/HomeIcon';
import TypographyIcon from '../Icons/SidebarIcons/TypographyIcon';
import TablesIcon from '../Icons/SidebarIcons/TablesIcon';
import NotificationsIcon from '../Icons/SidebarIcons/NotificationsIcon';
import ComponentsIcon from '../Icons/SidebarIcons/ComponentsIcon';

class Sidebar extends React.Component {
  static propTypes = {
    sidebarOpened: PropTypes.bool,
    dispatch: PropTypes.func.isRequired,
    activeItem: PropTypes.string,
    location: PropTypes.shape({
      pathname: PropTypes.string,
    }).isRequired,
  };

  static defaultProps = {
    activeItem: '',
  };

  closeDrawer = () => {
    this.props.dispatch(closeSidebar());
  };

  handleNavClick = (activeItem) => {
    this.props.dispatch(changeActiveSidebarItem(activeItem));
    this.closeDrawer();
  };

  render() {
    const { sidebarOpened } = this.props;

    return (
      <nav
        className={cx(s.root, { [s.drawerOpen]: sidebarOpened })}
        aria-hidden={!sidebarOpened ? 'true' : undefined}
      >
        <div className={s.drawerHeader}>
          <Link to="/app/main/dashboard" className={s.drawerBrand} onClick={this.closeDrawer}>
            <span className={s.brandDrop} aria-hidden="true"><i className="fa fa-tint" /></span>
            Himaliya <span className="fw-bold">Spring</span>
          </Link>
          <button type="button" className={s.drawerClose} onClick={this.closeDrawer} aria-label="Close menu">
            &times;
          </button>
        </div>

        <header className={s.logo}>
          <Link to="/app/main/dashboard">
            <span className={s.brandDrop} aria-hidden="true"><i className="fa fa-tint" /></span>
            Himaliya <span className="fw-bold">Spring</span>
          </Link>
        </header>

        <div className={s.sidebarSearchMobile}>
          <SidebarSearch onNavigate={this.closeDrawer} />
        </div>

        <ul className={s.nav}>
          <LinksGroup
            onActiveSidebarItemChange={this.handleNavClick}
            activeItem={this.props.activeItem}
            header="Dashboard"
            isHeader
            iconName={<HomeIcon className={s.menuIcon} />}
            link="/app/main/dashboard"
            index="dashboard"
          />
          <h5 className={[s.navTitle, s.groupTitle].join(' ')}>CUSTOMERS</h5>
          <LinksGroup
            onActiveSidebarItemChange={this.handleNavClick}
            activeItem={this.props.activeItem}
            header="Add Customer"
            isHeader
            iconName={<TypographyIcon className={s.menuIcon} />}
            link="/app/add-customer"
            index="add-customer"
          />
          <LinksGroup
            onActiveSidebarItemChange={this.handleNavClick}
            activeItem={this.props.activeItem}
            header="Customer Records"
            isHeader
            iconName={<TablesIcon className={s.menuIcon} />}
            link="/app/customers"
            index="customers"
          />
          <LinksGroup
            onActiveSidebarItemChange={this.handleNavClick}
            activeItem={this.props.activeItem}
            header="Invoice Lookup"
            isHeader
            iconName={<ComponentsIcon className={s.menuIcon} />}
            link="/app/invoice"
            index="invoice"
          />
          <h5 className={[s.navTitle, s.groupTitle].join(' ')}>SALES</h5>
          <LinksGroup
            onActiveSidebarItemChange={this.handleNavClick}
            activeItem={this.props.activeItem}
            header="Daily Sales Entry"
            isHeader
            iconName={<NotificationsIcon className={s.menuIcon} />}
            link="/app/daily-sales"
            index="daily-sales"
          />
          <LinksGroup
            onActiveSidebarItemChange={this.handleNavClick}
            activeItem={this.props.activeItem}
            header="Monthly Analytics"
            isHeader
            iconName={<ComponentsIcon className={s.menuIcon} />}
            link="/app/analytics"
            index="analytics"
          />
          <LinksGroup
            onActiveSidebarItemChange={this.handleNavClick}
            activeItem={this.props.activeItem}
            header="Customer Orders"
            isHeader
            iconName={<NotificationsIcon className={s.menuIcon} />}
            link="/app/customer-orders"
            index="customer-orders"
          />
          <h5 className={[s.navTitle, s.groupTitle].join(' ')}>SYSTEM</h5>
          <LinksGroup
            onActiveSidebarItemChange={this.handleNavClick}
            activeItem={this.props.activeItem}
            header="All Users"
            isHeader
            iconName={<ComponentsIcon className={s.menuIcon} />}
            link="/app/users"
            index="users"
          />
          <LinksGroup
            onActiveSidebarItemChange={this.handleNavClick}
            activeItem={this.props.activeItem}
            header="Settings"
            isHeader
            iconName={<HomeIcon className={s.menuIcon} />}
            link="/app/settings"
            index="settings"
          />
        </ul>

        <h5 className={s.navTitle}>QUICK LINKS</h5>
        <ul className={s.sidebarLabels}>
          <li>
            <Link to="/app/daily-sales" onClick={this.closeDrawer}>
              <i className="fa fa-circle text-success mr-2" />
              <span className={s.labelName}>Today&apos;s Sales</span>
            </Link>
          </li>
          <li>
            <Link to="/app/customers" onClick={this.closeDrawer}>
              <i className="fa fa-circle text-primary mr-2" />
              <span className={s.labelName}>Customers</span>
            </Link>
          </li>
          <li>
            <Link to="/app/analytics" onClick={this.closeDrawer}>
              <i className="fa fa-circle text-info mr-2" />
              <span className={s.labelName}>Reports</span>
            </Link>
          </li>
        </ul>
      </nav>
    );
  }
}

function mapStateToProps(store) {
  return {
    sidebarOpened: store.navigation.sidebarOpened,
    activeItem: store.navigation.activeItem,
  };
}

export default withRouter(connect(mapStateToProps)(Sidebar));
