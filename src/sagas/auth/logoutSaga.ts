import { call, put, takeEvery } from 'redux-saga/effects';
import { supabase } from '../../data/supabaseClient';
import {
	logoutWatch,
	logoutSuccess,
	logoutFailure
} from '../../slices/authSlice';
import { AuthError } from './types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { purgeAllOfflineRecipes } from '../../persistence/offlineRecipes';
import { queryClient } from '../../data/queryClient';

const PURGE_ACTION_TYPE = 'persist/PURGE_REQUESTED';

function* handleLogout(): Generator<any, void, any> {
	console.log(`* handleLogout`);
    
	try {
		const { error } = yield call(() => supabase.auth.signOut());

		if (error) {
			console.error(`* handleLogout/error:`, error.message);

			yield put(logoutFailure(error.message));
		} else {
			console.log(
				`* handleLogout: Sign-out successful. Clearing caches...`
			);

			yield put({ type: PURGE_ACTION_TYPE });

			// Clear React Query cache using imported client and call effect
			if (queryClient) {
				console.log('* handleLogout: Clearing memory RQ cache...');
				yield call([queryClient, queryClient.clear]);
				console.log('[Logout Saga] React Query cache cleared.');
			} else {
				console.warn('[Logout Saga] QueryClient not available to clear cache.');
			}

			// Remove persisted React Query cache from AsyncStorage
			console.log('* handleLogout: Clearing persisted RQ cache...');
			yield call([AsyncStorage, 'removeItem'], 'rq-cache');

			// Clear the individual offline recipe cache
			console.log('* handleLogout: Clearing offline recipe cache...');
			yield call(purgeAllOfflineRecipes);

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
