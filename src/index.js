import React from 'react';
import { createRoot } from 'react-dom/client';
import { createStore, applyMiddleware } from 'redux';
import { Provider } from 'react-redux'
import ReduxThunk from 'redux-thunk'
import * as serviceWorker from './serviceWorker';
import {
  ensureBackgroundPushSubscribed,
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
// Devices that granted permission before a VAPID key existed have no push
// subscription yet; register one now so background delivery reaches them too.
// No-ops without a key or without prior permission, so it never prompts.
ensureBackgroundPushSubscribed();
