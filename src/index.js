import React from 'react';
import { createRoot } from 'react-dom/client';
import { createStore, applyMiddleware } from 'redux';
import { Provider } from 'react-redux'
import ReduxThunk from 'redux-thunk'
import * as serviceWorker from './serviceWorker';

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

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: http://bit.ly/CRA-PWA
serviceWorker.unregister();
