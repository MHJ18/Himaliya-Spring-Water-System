import React from 'react';
import { connect } from 'react-redux';
import { MotionConfig } from 'framer-motion';
import { BrowserRouter, Switch, Route, Redirect, withRouter } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import ErrorPage from '../pages/error/ErrorPage';
import '../styles/theme.scss';
import AppProviders from '../context/AppProviders';
import { receiveLogout } from '../actions/user';
import {
  getSessionExpiredEventName,
  hasSessionExpiredNotice,
  hasStoredSessionType,
} from '../services/cloud/supabaseClient';
import WaterLogin from '../pages/login/WaterLogin';
import CustomerLogin from '../pages/customer/CustomerLogin';
import CustomerProfile from '../pages/customer/CustomerProfile';
import ForgotPassword from '../pages/login/ForgotPassword';
import ResetPassword from '../pages/login/ResetPassword';
import LoadingState from './LoadingState/LoadingState';
import RouteBranding from './RouteBranding/RouteBranding';

const LayoutComponent = React.lazy(() => import('./Layout/Layout'));
const Landing = React.lazy(() => import('../pages/landing/Landing'));
const PublicInvoice = React.lazy(() => import('../pages/invoice/PublicInvoice'));
const CustomerPortal = React.lazy(() => import('../pages/customer/CustomerPortal'));

const CloseButton = ({ closeToast }) => (
  <i onClick={closeToast} className="la la-close notifications-close" role="presentation" />
);

const RouteLoader = () => (
  <main className="customer-portal-page">
    <LoadingState label="Loading Himaliya Spring..." />
  </main>
);

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
      <MotionConfig reducedMotion="user">
        <AppProviders>
          <ToastContainer autoClose={3000} hideProgressBar closeButton={<CloseButton />} />
          <BrowserRouter>
            <React.Fragment>
              <RoutedSessionExpiryHandler dispatch={this.props.dispatch} />
              <RouteBranding />
              <React.Suspense fallback={<RouteLoader />}>
                <Switch>
                  <Route path="/" exact component={Landing} />
                  <Route path="/login" exact component={WaterLogin} />
                  <Route path="/customer/login" exact component={CustomerLogin} />
                  <Route path="/forgot-password" exact component={ForgotPassword} />
                  <Route path="/reset-password" exact component={ResetPassword} />
                  <CustomerPrivateRoute path="/customer/app" exact component={CustomerPortal} />
                  <CustomerPrivateRoute path="/customer/profile" exact component={CustomerProfile} />
                  <Route path="/invoice/:invoiceNumber" exact component={PublicInvoice} />
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
        </AppProviders>
      </MotionConfig>
    );
  }
}

export default connect()(App);
