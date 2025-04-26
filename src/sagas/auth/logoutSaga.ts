import { call, put, takeEvery } from 'redux-saga/effects';
import { supabase } from '../../data/supabaseClient';
import {
	logoutWatch,
	logoutSuccess,
	logoutFailure
} from '../../slices/authSlice';
import { AuthError } from './types';
import { persistor } from '../../store';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

			// Purge persisted Redux state
			yield call([persistor, persistor.purge]);

			// Clear React Query cache (memory)
			if (typeof window !== 'undefined' && window.queryClient) {
				window.queryClient.clear();
			}

			// Remove persisted React Query cache from AsyncStorage
			yield call([AsyncStorage, 'removeItem'], 'rq-cache');

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
