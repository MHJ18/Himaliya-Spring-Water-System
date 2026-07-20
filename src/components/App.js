import React from 'react';
import { IconButton } from '@mui/material';
import { CloseRounded } from '@mui/icons-material';
import { connect } from 'react-redux';
import { BrowserRouter, Switch, Route, Redirect, withRouter } from 'react-router-dom';
import { Slide, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import '../styles/theme.scss';
import './NotificationToast/NotificationToast.css';
import AppProviders from '../context/AppProviders';
import { receiveLogout } from '../actions/user';
import {
  getSessionExpiredEventName,
  hasSessionExpiredNotice,
  hasStoredSessionType,
} from '../services/cloud/supabaseClient';
import LoadingState from './LoadingState/LoadingState';
import RouteBranding from './RouteBranding/RouteBranding';
import AppThemeProvider from '../theme/AppThemeProvider';

const LayoutComponent = React.lazy(() => import('./Layout/Layout'));
const Landing = React.lazy(() => import('../pages/landing/Landing'));
const FluidLab = React.lazy(() => import('../pages/fluid/FluidLab'));
const PublicInvoice = React.lazy(() => import('../pages/invoice/PublicInvoice'));
const CustomerPortal = React.lazy(() => import('../pages/customer/CustomerPortal'));
const WaterLogin = React.lazy(() => import('../pages/login/WaterLogin'));
const CustomerLogin = React.lazy(() => import('../pages/customer/CustomerLogin'));
const CustomerProfile = React.lazy(() => import('../pages/customer/CustomerProfile'));
const CustomerMessages = React.lazy(() => import('../pages/customer/CustomerMessages'));
const ForgotPassword = React.lazy(() => import('../pages/login/ForgotPassword'));
const ResetPassword = React.lazy(() => import('../pages/login/ResetPassword'));
const PublicRiderTracking = React.lazy(() => import('../pages/tracking/PublicRiderTracking'));
const ErrorPage = React.lazy(() => import('../pages/error/ErrorPage'));

const CloseButton = ({ closeToast, className }) => (
  <IconButton
    aria-label="Dismiss notification"
    className={className}
    size="small"
    onClick={closeToast}
    sx={{ color: 'inherit', mt: 0.25 }}
  >
    <CloseRounded fontSize="small" />
  </IconButton>
);

const RouteLoader = () => {
  const pathname = window.location.pathname;

  if (pathname === '/') return null;
  if (pathname === '/customer/login') {
    return <LoadingState label="Loading customer sign in..." variant="customer-auth" />;
  }
  if (pathname === '/login' || pathname === '/forgot-password' || pathname === '/reset-password') {
    return <LoadingState label="Loading administrator sign in..." variant="admin-auth" />;
  }
  if (pathname === '/customer/app') {
    return <LoadingState label="Loading your delivery portal..." variant="portal" />;
  }
  if (pathname === '/customer/profile') {
    return <LoadingState label="Loading your profile..." variant="customer-profile" />;
  }
  if (pathname === '/customer/messages') {
    return <LoadingState label="Opening your messages..." variant="portal" />;
  }
  if (
    pathname.indexOf('/app') === 0 ||
    ['/history', '/messages', '/notifications', '/profile'].includes(pathname)
  ) {
    return <LoadingState label="Loading administrator workspace..." variant="admin-shell" />;
  }
  return null;
};

const PrivateRoute = ({ dispatch, component, ...rest }) => {
  if (!hasStoredSessionType('admin')) {
    dispatch(receiveLogout());
    return (
      <Redirect
        to={{
          pathname: '/login',
          state: hasSessionExpiredNotice() ? { sessionExpired: true } : undefined,
        }}
      />
    );
  }
  return <Route {...rest} render={(props) => React.createElement(component, props)} />;
};

const CustomerPrivateRoute = ({ component, ...rest }) => {
  if (!hasStoredSessionType('customer')) {
    return (
      <Redirect
        to={{
          pathname: '/customer/login',
          state: hasSessionExpiredNotice() ? { sessionExpired: true } : undefined,
        }}
      />
    );
  }
  return <Route {...rest} render={(props) => React.createElement(component, props)} />;
};

class SessionExpiryHandler extends React.PureComponent {
  componentDidMount() {
    window.addEventListener(getSessionExpiredEventName(), this.handleExpiry);
  }

  componentWillUnmount() {
    window.removeEventListener(getSessionExpiredEventName(), this.handleExpiry);
  }

  handleExpiry = () => {
    this.props.dispatch(receiveLogout());
    const isCustomerArea = this.props.location.pathname.indexOf('/customer') === 0;
    this.props.history.replace(isCustomerArea ? '/customer/login' : '/login', { sessionExpired: true });
  };

  render() { return null; }
}

const RoutedSessionExpiryHandler = withRouter(SessionExpiryHandler);

class App extends React.PureComponent {
  render() {
    return (
      <AppProviders>
          <AppThemeProvider>
            <ToastContainer
              position="top-right"
              autoClose={3600}
              transition={Slide}
              newestOnTop
              pauseOnHover
              closeOnClick={false}
              draggablePercent={40}
              limit={4}
              closeButton={<CloseButton />}
            />
            <BrowserRouter basename={process.env.PUBLIC_URL}>
              <React.Fragment>
                <RoutedSessionExpiryHandler dispatch={this.props.dispatch} />
                <RouteBranding />
                <React.Suspense fallback={<RouteLoader />}>
                  <Switch>
                    <Route path="/" exact render={(props) => <Landing {...props} />} />
                    <Route path="/fluid-lab" exact component={FluidLab} />
                    <Route path="/login" exact component={WaterLogin} />
                    <Route path="/customer/login" exact component={CustomerLogin} />
                    <Route path="/forgot-password" exact component={ForgotPassword} />
                    <Route path="/reset-password" exact component={ResetPassword} />
                    <CustomerPrivateRoute path="/customer/app" exact component={CustomerPortal} />
                    <CustomerPrivateRoute path="/customer/profile" exact component={CustomerProfile} />
                    <CustomerPrivateRoute path="/customer/messages" exact component={CustomerMessages} />
                    <Route path="/invoice/:invoiceNumber" exact render={(props) => <PublicInvoice {...props} />} />
                    <Route path="/track/:trackingToken" exact component={PublicRiderTracking} />
                    <PrivateRoute path="/app" dispatch={this.props.dispatch} component={LayoutComponent} />
                    <PrivateRoute path="/history" exact dispatch={this.props.dispatch} component={LayoutComponent} />
                    <PrivateRoute path="/messages" exact dispatch={this.props.dispatch} component={LayoutComponent} />
                    <PrivateRoute path="/notifications" exact dispatch={this.props.dispatch} component={LayoutComponent} />
                    <PrivateRoute path="/profile" exact dispatch={this.props.dispatch} component={LayoutComponent} />
                    <Route path="/error" exact component={ErrorPage} />
                    <Redirect to="/" />
                  </Switch>
                </React.Suspense>
              </React.Fragment>
            </BrowserRouter>
          </AppThemeProvider>
      </AppProviders>
    );
  }
}

export default connect()(App);
