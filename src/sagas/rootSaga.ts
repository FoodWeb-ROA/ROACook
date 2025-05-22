import { all, fork, take } from 'redux-saga/effects';
import { REHYDRATE } from 'redux-persist/lib/constants'; 
import authSaga from './auth';
import kitchensSaga from './kitchens';
import { appLogger } from '../services/AppLogService';

export default function* rootSaga() {
	// Fork sagas that don't depend on rehydrated state immediately
	yield all([
		fork(authSaga), // Assuming authSaga might be needed for login flow before full rehydration of other states
	]);

	// Wait for rehydration to complete
	appLogger.log('[rootSaga] Waiting for REHYDRATE completion...');
	yield take(REHYDRATE);
	appLogger.log('[rootSaga] REHYDRATE completed.');

	// Fork sagas that depend on rehydrated state
	yield all([
		fork(kitchensSaga),
	]);

	appLogger.log('[rootSaga] All sagas forked.');
}
