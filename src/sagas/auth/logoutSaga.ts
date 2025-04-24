import { call, put, takeEvery } from 'redux-saga/effects';
import { supabase } from '../../data/supabaseClient';
import {
	logoutWatch,
	logoutSuccess,
	logoutFailure
} from '../../slices/authSlice';
import { AuthError } from './types';

function* handleLogout(): Generator<any, void, any> {
	console.log(`* handleLogout`);
    
	try {
		const { error } = yield call(() => supabase.auth.signOut());

		if (error) {
			console.error(`* handleLogout/error:`, error.message);

			yield put(logoutFailure(error.message));
		} else {
			console.log(
				`* handleLogout: Sign-out successful. Waiting for onAuthStateChange...`
			);

			yield put(logoutSuccess());
		}
	} catch (error: any) {
		console.error(`* handleLogout/catch error:`, error);

		if (error instanceof AuthError) {
			yield put(logoutFailure(error.message));
		} else {
			yield put(logoutFailure('Unexpected error occurred during sign out.'));
		}
	}
}

export function* watchLogout(): Generator {
	yield takeEvery(logoutWatch.type, handleLogout);

	console.log('* watchLogout: watching', logoutWatch.type);
}
