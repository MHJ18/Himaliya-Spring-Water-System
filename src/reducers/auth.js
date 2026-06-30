import {
     LOGIN_REQUEST, LOGIN_SUCCESS, LOGIN_FAILURE, LOGOUT_SUCCESS,
} from '../actions/user';
import { hasStoredSession } from '../services/cloud/supabaseClient';

export default function auth(state = {
    isFetching: false,
    isAuthenticated: hasStoredSession(),
}, action) {
    switch (action.type) {
        case LOGIN_REQUEST:
            return Object.assign({}, state, {
                isFetching: true,
                errorMessage: '',
            });
        case LOGIN_SUCCESS:
            return Object.assign({}, state, {
                isFetching: false,
                isAuthenticated: true,
                errorMessage: '',
            });
        case LOGIN_FAILURE:
            return Object.assign({}, state, {
                isFetching: false,
                isAuthenticated: false,
                errorMessage: action.payload,
            });
        case LOGOUT_SUCCESS:
            return Object.assign({}, state, {
                isAuthenticated: false,
            });
        default:
            return state;
    }
}
