import { all, fork } from 'redux-saga/effects';
import authSaga from './auth';
import kitchensSaga from './kitchens';
import { appLogger } from '../services/AppLogService';

export default function* rootSaga() {
	yield all([
		fork(authSaga),
		fork(kitchensSaga),
	]);
}
