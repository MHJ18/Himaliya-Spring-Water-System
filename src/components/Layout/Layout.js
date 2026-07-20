import React from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { Switch, Route, withRouter, Redirect } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';

import Header from '../Header/Header';
import Sidebar from '../Sidebar/Sidebar';
import BreadcrumbHistory from '../BreadcrumbHistory/BreadcrumbHistory';
import LoadingState from '../LoadingState/LoadingState';
import { closeSidebar, changeActiveSidebarItem } from '../../actions/navigation';
import { pageTransition } from '../../utils/motion';
import s from './Layout.module.scss';

const Dashboard = React.lazy(() => import('../../pages/himalaya/Dashboard'));
const AddCustomer = React.lazy(() => import('../../pages/himalaya/AddCustomer'));
const CustomerRecords = React.lazy(() => import('../../pages/himalaya/CustomerRecords'));
const EditCustomer = React.lazy(() => import('../../pages/himalaya/EditCustomer'));
const DailySales = React.lazy(() => import('../../pages/himalaya/DailySales'));
const Analytics = React.lazy(() => import('../../pages/himalaya/Analytics'));
const Settings = React.lazy(() => import('../../pages/himalaya/Settings'));
const AdminUsers = React.lazy(() => import('../../pages/himalaya/AdminUsers'));
const Messages = React.lazy(() => import('../../pages/himalaya/Messages'));
const NotificationsCenter = React.lazy(() => import('../../pages/himalaya/NotificationsCenter'));
const InvoiceLookup = React.lazy(() => import('../../pages/himalaya/InvoiceLookup'));
const Profile = React.lazy(() => import('../../pages/himalaya/Profile'));
const CustomerOrders = React.lazy(() => import('../../pages/himalaya/CustomerOrders'));
const EntryHistory = React.lazy(() => import('../../pages/himalaya/EntryHistory'));
const RiderTracking = React.lazy(() => import('../../pages/himalaya/RiderTracking'));

function getAdminLoadingVariant(pathname) {
  if (pathname.includes('analytics')) return 'analytics';
  if (pathname.includes('dashboard')) return 'dashboard';
  if (
    pathname.includes('customers') ||
    pathname.includes('customer-orders') ||
    pathname.includes('history') ||
    pathname.includes('users') ||
    pathname.includes('admins') ||
    pathname.includes('messages') ||
    pathname.includes('notifications')
  ) return 'table';
  return 'form';
}

function AnimatedRoutes({ pathname, children }) {
  const reduceMotion = useReducedMotion();
  const variants = reduceMotion
    ? {
      initial: { opacity: 1 },
      animate: { opacity: 1 },
      exit: { opacity: 1 },
    }
    : pageTransition;

  return (
    <AnimatePresence initial={false}>
      <motion.div
        key={pathname}
        className={s.routeMotion}
        initial="initial"
        animate="animate"
        exit="exit"
        variants={variants}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

AnimatedRoutes.propTypes = {
  pathname: PropTypes.string.isRequired,
  children: PropTypes.node.isRequired,
};

class Layout extends React.Component {
  static propTypes = {
    sidebarOpened: PropTypes.bool,
    dispatch: PropTypes.func.isRequired,
  };

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
    else if (pathname.includes('rider-tracking')) active = 'rider-tracking';
    else if (pathname.includes('history')) active = 'history';
    else if (pathname.includes('admins') || pathname.includes('users')) active = 'users';
    else if (pathname.includes('settings')) active = 'settings';
    else if (pathname.includes('messages')) active = 'messages';
    else if (pathname.includes('notifications')) active = 'notifications';
    else if (pathname.includes('profile')) active = 'profile';
    this.props.dispatch(changeActiveSidebarItem(active));
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
          <main className={s.content}>
            <BreadcrumbHistory url={this.props.location.pathname} />
            <AnimatedRoutes pathname={this.props.location.pathname}>
              <React.Suspense
                fallback={(
                  <LoadingState
                    compact
                    variant={getAdminLoadingVariant(this.props.location.pathname)}
                    label="Loading workspace..."
                  />
                )}
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
                  <Route path="/app/rider-tracking" exact component={RiderTracking} />
                  <Route path="/app/history" exact component={EntryHistory} />
                  <Route path="/app/users" exact component={AdminUsers} />
                  <Route path="/app/admins" exact component={AdminUsers} />
                  <Route path="/app/settings" exact component={Settings} />
                  <Route path="/history" exact render={() => <Redirect to="/app/history" />} />
                  <Route path="/messages" exact component={Messages} />
                  <Route path="/notifications" exact component={NotificationsCenter} />
                  <Route path="/profile" exact component={Profile} />
                  <Redirect to="/app/main/dashboard" />
                </Switch>
              </React.Suspense>
            </AnimatedRoutes>
            <footer className={s.contentFooter}>
              Himaliya Spring Water &mdash; Admin workspace
            </footer>
          </main>
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
