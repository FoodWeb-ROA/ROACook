import { all, fork, takeLatest } from 'redux-saga/effects';
import { watchLogin } from './loginSaga';
import { watchRegister } from './registerSaga';
import { watchLogout } from './logoutSaga';
import { watchOAuthUrl } from './oauthSaga';
import { watchAuthCallback } from './authCallbackSaga';
import { handleAuthStateChange } from './authStateChangeSaga';
import { authStateChanged } from '../../slices/authSlice';
import { watchAuthChannel } from './authChannelSaga';
import { appLogger } from '../../services/AppLogService';

export default function* authSaga(): Generator {
	appLogger.log('* authSaga: starting...');

	yield all([
		fork(watchAuthChannel),
		fork(watchLogin),
		fork(watchLogout),
		fork(watchRegister),
		fork(watchOAuthUrl),
		fork(watchAuthCallback),
		takeLatest(authStateChanged.type, handleAuthStateChange)
	]);

	appLogger.log('* authSaga: all watchers forked.');
}
