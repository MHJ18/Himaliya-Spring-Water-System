import React from 'react';
import { createRoot } from 'react-dom/client';
import { createStore, applyMiddleware } from 'redux';
import { Provider } from 'react-redux'
import ReduxThunk from 'redux-thunk'
import * as serviceWorker from './serviceWorker';
import {
  listenForSubscriptionChanges,
  registerNotificationWorker,
} from './services/notifications/pushNotifications';

import App from './components/App';
import ErrorBoundary from './components/ErrorBoundary/ErrorBoundary';
import reducers from './reducers';

const store = createStore(
  reducers,
  applyMiddleware(ReduxThunk)
);

const root = createRoot(document.getElementById('root'));

root.render(
    <Provider store={store}>
        <ErrorBoundary>
            <App />
        </ErrorBoundary>
    </Provider>
);

// Remove any legacy offline/precache worker, which used to serve phones stale
// HTML. This intentionally leaves the notification worker registered.
serviceWorker.unregister();

// Android Chrome cannot show a notification from the page - only a service
// worker can - so the worker is registered up front rather than at the moment
// permission is granted. Registration failure is handled inside and never
// blocks the app from starting.
registerNotificationWorker();
listenForSubscriptionChanges();
