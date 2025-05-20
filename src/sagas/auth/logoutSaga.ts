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
import { appLogger } from '../../services/AppLogService';

const PURGE_ACTION_TYPE = 'persist/PURGE_REQUESTED';

function* handleLogout(): Generator<any, void, any> {
	appLogger.log(`* handleLogout`);
    
	try {
		const { error } = yield call(() => supabase.auth.signOut());

		if (error) {
			appLogger.error(`* handleLogout/error:`, error.message);

			yield put(logoutFailure(error.message));
		} else {
			appLogger.log(
				`* handleLogout: Sign-out successful. Clearing caches...`
			);

			yield put({ type: PURGE_ACTION_TYPE });

			// Clear React Query cache using imported client and call effect
			if (queryClient) {
				appLogger.log('* handleLogout: Clearing memory RQ cache...');
				yield call([queryClient, queryClient.clear]);
				appLogger.log('[Logout Saga] React Query cache cleared.');
			} else {
				appLogger.warn('[Logout Saga] QueryClient not available to clear cache.');
			}

			// Remove persisted React Query cache from AsyncStorage
			appLogger.log('* handleLogout: Clearing persisted RQ cache...');
			yield call([AsyncStorage, 'removeItem'], 'rq-cache');

			// Clear the individual offline recipe cache
			appLogger.log('* handleLogout: Clearing offline recipe cache...');
			yield call(purgeAllOfflineRecipes);

			yield put(logoutSuccess());
		}
	} catch (error: any) {
		appLogger.error(`* handleLogout/catch error:`, error);

		if (error instanceof AuthError) {
			yield put(logoutFailure(error.message));
		} else {
			yield put(logoutFailure('Unexpected error occurred during sign out.'));
		}
	}
}

export function* watchLogout(): Generator {
	yield takeEvery(logoutWatch.type, handleLogout);

	appLogger.log('* watchLogout: watching', logoutWatch.type);
}
