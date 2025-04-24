import { all, fork } from 'redux-saga/effects';
import authSaga from './auth';
import kitchensSaga from './kitchens';

export default function* rootSaga() {
	yield all([
		fork(authSaga),
		fork(kitchensSaga)
	]);
}
