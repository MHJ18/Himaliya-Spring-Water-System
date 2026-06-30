import React from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { Switch, Route, withRouter, Redirect } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Hammer from 'rc-hammerjs';

import Dashboard from '../../pages/himalaya/Dashboard';
import AddCustomer from '../../pages/himalaya/AddCustomer';
import CustomerRecords from '../../pages/himalaya/CustomerRecords';
import EditCustomer from '../../pages/himalaya/EditCustomer';
import DailySales from '../../pages/himalaya/DailySales';
import Analytics from '../../pages/himalaya/Analytics';
import Settings from '../../pages/himalaya/Settings';
import AdminUsers from '../../pages/himalaya/AdminUsers';
import Messages from '../../pages/himalaya/Messages';
import NotificationsCenter from '../../pages/himalaya/NotificationsCenter';
import InvoiceLookup from '../../pages/himalaya/InvoiceLookup';
import Profile from '../../pages/himalaya/Profile';
import CustomerOrders from '../../pages/himalaya/CustomerOrders';

import Header from '../Header/Header';
import Sidebar from '../Sidebar/Sidebar';
import BreadcrumbHistory from '../BreadcrumbHistory/BreadcrumbHistory';
import { openSidebar, closeSidebar, changeActiveSidebarItem } from '../../actions/navigation';
import { pageTransition } from '../../utils/motion';
import s from './Layout.module.scss';

class Layout extends React.Component {
  static propTypes = {
    sidebarOpened: PropTypes.bool,
    dispatch: PropTypes.func.isRequired,
  };

  constructor(props) {
    super(props);
    this.handleSwipe = this.handleSwipe.bind(this);
    this.state = { chatOpen: false };
  }

  componentDidMount() {
    this.syncSidebarActive(this.props.location.pathname);
  }

  componentDidUpdate(prevProps) {
    if (prevProps.location.pathname !== this.props.location.pathname) {
      this.syncSidebarActive(this.props.location.pathname);
      if (this.props.sidebarOpened) {
        this.props.dispatch(closeSidebar());
      }
    }

    if (prevProps.sidebarOpened !== this.props.sidebarOpened) {
      document.body.style.overflow = this.props.sidebarOpened ? 'hidden' : '';
    }
  }

  componentWillUnmount() {
    document.body.style.overflow = '';
  }

  syncSidebarActive(pathname) {
    let active = 'dashboard';
    if (pathname.includes('add-customer')) active = 'add-customer';
    else if (pathname.includes('invoice')) active = 'invoice';
    else if (pathname.includes('customers')) active = 'customers';
    else if (pathname.includes('daily-sales')) active = 'daily-sales';
    else if (pathname.includes('analytics')) active = 'analytics';
    else if (pathname.includes('customer-orders')) active = 'customer-orders';
    else if (pathname.includes('admins') || pathname.includes('users')) active = 'users';
    else if (pathname.includes('settings')) active = 'settings';
    else if (pathname.includes('history')) active = 'history';
    else if (pathname.includes('messages')) active = 'messages';
    else if (pathname.includes('notifications')) active = 'notifications';
    else if (pathname.includes('profile')) active = 'profile';
    this.props.dispatch(changeActiveSidebarItem(active));
  }

  handleSwipe(e) {
    if ('ontouchstart' in window) {
      if (e.direction === 4) this.props.dispatch(openSidebar());
      if (e.direction === 2 && this.props.sidebarOpened) this.props.dispatch(closeSidebar());
    }
  }

  render() {
    const { sidebarOpened } = this.props;

    return (
      <div className={[s.root, 'sidebar-' + this.props.sidebarPosition, 'sidebar-' + this.props.sidebarVisibility].join(' ')}>
        <button
          type="button"
          className={[s.sidebarBackdrop, sidebarOpened ? s.sidebarBackdropVisible : ''].join(' ')}
          aria-label="Close navigation menu"
          onClick={() => this.props.dispatch(closeSidebar())}
        />
        <Sidebar />
        <div className={s.wrap}>
          <Header />
          <Hammer onSwipe={this.handleSwipe}>
            <main className={s.content}>
              <BreadcrumbHistory url={this.props.location.pathname} />
              <AnimatePresence mode="wait">
                <motion.div
                  key={this.props.location.pathname}
                  className={s.routeMotion}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  variants={pageTransition}
                >
                  <Switch>
                    <Route path="/app" exact render={() => <Redirect to="/app/main/dashboard" />} />
                    <Route path="/app/main" exact render={() => <Redirect to="/app/main/dashboard" />} />
                    <Route path="/app/main/dashboard" exact component={Dashboard} />
                    <Route path="/app/add-customer" exact component={AddCustomer} />
                    <Route path="/app/customers" exact component={CustomerRecords} />
                    <Route path="/app/customers/:customerId/edit" exact component={EditCustomer} />
                    <Route path="/app/invoice" exact component={InvoiceLookup} />
                    <Route path="/app/daily-sales" exact component={DailySales} />
                    <Route path="/app/analytics" exact component={Analytics} />
                    <Route path="/app/customer-orders" exact component={CustomerOrders} />
                    <Route path="/app/users" exact component={AdminUsers} />
                    <Route path="/app/admins" exact component={AdminUsers} />
                    <Route path="/app/settings" exact component={Settings} />
                    <Route path="/history" exact render={() => <Redirect to="/app/customer-orders" />} />
                    <Route path="/messages" exact component={Messages} />
                    <Route path="/notifications" exact component={NotificationsCenter} />
                    <Route path="/profile" exact component={Profile} />
                    <Redirect to="/app/main/dashboard" />
                  </Switch>
                </motion.div>
              </AnimatePresence>
              <footer className={s.contentFooter}>
                Himaliya Spring Water &mdash; Admin Dashboard
              </footer>
            </main>
          </Hammer>
        </div>
      </div>
    );
  }
}

function mapStateToProps(store) {
  return {
    sidebarOpened: store.navigation.sidebarOpened,
    sidebarPosition: store.navigation.sidebarPosition,
    sidebarVisibility: store.navigation.sidebarVisibility,
  };
}

export default withRouter(connect(mapStateToProps)(Layout));
