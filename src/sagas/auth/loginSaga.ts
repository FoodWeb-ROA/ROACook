import { call, put, takeEvery } from 'redux-saga/effects';
import { supabase } from '../../data/supabaseClient';
import { loginWatch, loginFailure } from '../../slices/authSlice';
import { SignInResponse, AuthError } from './types';
import { appLogger } from '../../services/AppLogService';

function* handleLogin(
	action: ReturnType<typeof loginWatch>
): Generator<any, void, SignInResponse> {
	appLogger.log(`* handleLogin/action:`, action);

	try {
		const { email, password } = action.payload;

		const { data, error }: SignInResponse = yield call(() =>
			supabase.auth.signInWithPassword({ email, password })
		);

		appLogger.log(`* handleLogin/response:`, JSON.stringify(data, null, 2));

		if (error || !data.session) {
			appLogger.error(
				`* handleLogin/error:`,
				error?.message || 'Sign In Error Occurred'
			);

			yield put(loginFailure(error?.message || 'Sign In Error Occurred'));

			return;
		}

		appLogger.log(
			`* handleLogin: Sign-in successful, waiting for onAuthStateChange...`
		);
        
	} catch (error: any) {
		appLogger.error(`* handleLogin/catch error:`, error);

		if (error instanceof AuthError) {
			yield put(loginFailure(error.message));
		} else {
			yield put(loginFailure('Sign In Error'));
		}
	}
}

export function* watchLogin(): Generator {
	yield takeEvery(loginWatch.type, handleLogin);

	appLogger.log('* watchLogin: watching', loginWatch.type);
}
