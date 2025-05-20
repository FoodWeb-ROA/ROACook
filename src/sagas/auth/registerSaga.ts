import { call, put, takeEvery } from 'redux-saga/effects';
import { supabase } from '../../data/supabaseClient';
import { registerWatch, registerFailure } from '../../slices/authSlice';
import { SignUpResponse, AuthError } from './types';
import { appLogger } from '../../services/AppLogService';

function* handleRegister(
	action: ReturnType<typeof registerWatch>
): Generator<any, void, SignUpResponse> {
	appLogger.log(`* handleRegister/action:`, action);
	try {
		const { email, password, fullname, language } = action.payload;

		const signUpResponse: SignUpResponse = yield call(() =>
			supabase.auth.signUp({
				email,
				password,
				options: {
					data: {
						full_name: fullname,
						language: language
					},
					emailRedirectTo: 'recipemanagementapp://auth/callback'
				}
			})
		);

		appLogger.log(
			`* handleRegister/response:`,
			JSON.stringify(signUpResponse, null, 2)
		);

		const { user, session } = signUpResponse.data;

		if (signUpResponse.error) {
			appLogger.error(`* handleRegister/error:`, signUpResponse.error.message);

			yield put(registerFailure(signUpResponse.error.message));

			return;
		}

		if (!session && user && !user.confirmed_at) {
			appLogger.log(`* handleRegister: Confirmation Email Sent to ${email}`);

			yield put(
				registerFailure('Confirmation Email Sent. Please check your inbox.')
			);

			return;
		}

		if (session && user) {
			appLogger.log(
				`* handleRegister: Sign-up successful, session active. Waiting for onAuthStateChange...`
			);
		} else {
			appLogger.warn(
				`* handleRegister: Unexpected signUp response state`,
				JSON.stringify(signUpResponse, null, 2)
			);

			yield put(
				registerFailure(
					'* handleRegister: Sign Up process completed, but state is unclear. Check email or try logging in.'
				)
			);
		}
	} catch (error) {
		appLogger.error(`* handleRegister/catch error:`, error);

		if (error instanceof AuthError) {
			yield put(registerFailure(error.message));
		} else {
			yield put(registerFailure('Sign Up Error'));
		}
	}
}

export function* watchRegister(): Generator {
	yield takeEvery(registerWatch.type, handleRegister);

	appLogger.log('* watchRegister: watching', registerWatch.type);
}
