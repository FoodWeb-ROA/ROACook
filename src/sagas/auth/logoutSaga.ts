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
import { stopDishRealtime } from '../dishes/dishesRealtimeSaga';
import { stopIngredientRealtime } from '../ingredients/ingredientsRealtimeSaga';
import { stopPreparationRealtime } from '../preparations/preparationsRealtimeSaga';
import { purgeAllOfflineRecipes } from '../../persistence/offlineRecipes';

function* handleLogout(): Generator<any, void, any> {
	console.log(`* handleLogout`);
    
	try {
		console.log('* handleLogout: Dispatching stop realtime actions...');
		yield put(stopDishRealtime());
		yield put(stopIngredientRealtime());
		yield put(stopPreparationRealtime());

		const { error } = yield call(() => supabase.auth.signOut());

		if (error) {
			console.error(`* handleLogout/error:`, error.message);

			yield put(logoutFailure(error.message));
		} else {
			console.log(
				`* handleLogout: Sign-out successful. Clearing caches...`
			);

			// Purge persisted Redux state
			yield call([persistor, persistor.purge]);

			// Clear React Query cache (memory)
			if (typeof window !== 'undefined' && window.queryClient) {
				console.log('* handleLogout: Clearing memory RQ cache...');
				window.queryClient.clear();
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
