import { call, put, takeLatest } from 'redux-saga/effects';
import { supabase } from '../../data/supabaseClient';
import {
	oauthCallback,
	oauthFailure,
	registerFailure
} from '../../slices/authSlice';
import { SetSessionResponse } from './types';
import { parseUrlFragment } from './utils';
import { appLogger } from '../../services/AppLogService';

export function* handleAuthCallback(
	action: ReturnType<typeof oauthCallback>
): Generator<any, void, SetSessionResponse> {
	appLogger.log('* handleAuthCallback/action:', action);

	const { url } = action.payload;

	const fragmentParams = parseUrlFragment(url);

	appLogger.log(
		'* handleAuthCallback/fragmentParams:',
		JSON.stringify(fragmentParams, null, 2)
	);

	if (fragmentParams.access_token && fragmentParams.refresh_token) {
		try {
			const {
				data: { session, user },
				error
			}: SetSessionResponse = yield call(() =>
				supabase.auth.setSession({
					access_token: fragmentParams.access_token,
					refresh_token: fragmentParams.refresh_token
				})
			);

			if (error) {
				appLogger.error('* handleAuthCallback/error setSession:', error);

				if (fragmentParams.type === 'signup') {
					yield put(
						registerFailure(error.message || 'setSession callback error after signup')
					);
				} else {
					yield put(
						oauthFailure(error.message || 'setSession callback error after oauth')
					);
				}
			} else if (session === null || user === null) {
				appLogger.error(
					'* handleAuthCallback: setSession resulted in null session/user'
				);

				if (fragmentParams.type === 'signup') {
					yield put(
						registerFailure('setSession callback error: session or user is missing')
					);
				} else {
					yield put(
						oauthFailure('setSession callback error: session or user is missing')
					);
				}
			} else {
				appLogger.log(
					'* handleAuthCallback: setSession successful. Waiting for onAuthStateChange...'
				);
			}
		} catch (error: any) {
			appLogger.error('* handleAuthCallback/catch error setSession:', error);

			if (fragmentParams.type === 'signup') {
				yield put(
					registerFailure(
						error.message || 'setSession callback unexpected error after signup'
					)
				);
			} else {
				yield put(
					oauthFailure(
						error.message || 'setSession callback unexpected error after oauth'
					)
				);
			}
		}
	} else {
		appLogger.error('* handleAuthCallback: No tokens found in URL fragment');

		if (fragmentParams.type === 'signup') {
			yield put(registerFailure('Auth callback failed: no tokens in the url'));
		} else {
			yield put(oauthFailure('Auth callback failed: no tokens in the url'));
		}
	}
}

export function* watchAuthCallback(): Generator {
	yield takeLatest(oauthCallback.type, handleAuthCallback);

	appLogger.log('* watchAuthCallback: watching', oauthCallback.type);
}
