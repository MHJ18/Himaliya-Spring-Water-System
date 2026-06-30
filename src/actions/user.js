import { clearCurrentAdmin, findAdminByCredentials } from '../utils/adminAuth';
import { signOut } from '../services/cloud/supabaseClient';
import { mapLoginError } from '../utils/authErrors';

export const LOGIN_SUCCESS = 'LOGIN_SUCCESS';
export const LOGIN_FAILURE = 'LOGIN_FAILURE';
export const LOGIN_REQUEST = 'LOGIN_REQUEST';
export const LOGOUT_REQUEST = 'LOGOUT_REQUEST';
export const LOGOUT_SUCCESS = 'LOGOUT_SUCCESS';

export function receiveLogin() {
    return {
        type: LOGIN_SUCCESS
    };
}

function loginError(payload) {
    return {
        type: LOGIN_FAILURE,
        payload,
    };
}

function requestLogout() {
    return {
        type: LOGOUT_REQUEST,
    };
}

export function receiveLogout() {
    return {
        type: LOGOUT_SUCCESS,
    };
}

// Logs the user out
export function logoutUser() {
    return async (dispatch) => {
        dispatch(requestLogout());
        await signOut();
        clearCurrentAdmin();
        dispatch(receiveLogout());
    };
}

function requestLogin() {
    return { type: LOGIN_REQUEST };
}

export function loginUser(creds) {
    return async (dispatch) => {
        dispatch(requestLogin());
        try {
            await findAdminByCredentials(creds.email, creds.password);
            dispatch(receiveLogin());
        } catch (error) {
            dispatch(loginError(mapLoginError(error)));
        }
    }
}
