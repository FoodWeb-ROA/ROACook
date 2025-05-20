import { call, put, takeLatest } from 'redux-saga/effects';
import { supabase } from '../../data/supabaseClient';
import { Linking } from 'react-native';
import { oauthWatch, oauthFailure } from '../../slices/authSlice';
import { AuthError, OAuthResponse } from './types';
import { appLogger } from '../../services/AppLogService';

export function* handleOAuthUrl(
	action: ReturnType<typeof oauthWatch>
): Generator<any, void, OAuthResponse> {
	appLogger.log(`* handleOAuthUrl/action:`, action);

	try {
		const response: OAuthResponse = yield call(() =>
			supabase.auth.signInWithOAuth({
				provider: action.payload.provider,
				options: {
					redirectTo: 'recipemanagementapp://auth/callback?'
				}
			})
		);

		appLogger.log(`* handleOAuthUrl/response:`, response);

		const authUrl = response.data.url;

		if (authUrl) {
			appLogger.log(`* handleOAuthUrl: Opening URL: ${authUrl}`);

			yield call(() => Linking.openURL(authUrl));
		} else {
			appLogger.error('* handleOAuthUrl: No Url In Sign In With OAuth response');

			yield put(oauthFailure('No Url In Sign In With OAuth response'));
		}
	} catch (error: any) {
		appLogger.error(`* handleOAuthUrl/catch error:`, error);

		if (error instanceof AuthError) {
			yield put(oauthFailure(error.message));
		} else {
			yield put(oauthFailure('OAuth Error Occurred.'));
		}
	}
}

export function* watchOAuthUrl(): Generator {
	yield takeLatest(oauthWatch.type, handleOAuthUrl);

	appLogger.log('* watchOAuthUrl: watching', oauthWatch.type);
}
