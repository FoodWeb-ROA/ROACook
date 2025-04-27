import { all, fork } from 'redux-saga/effects';
import authSaga from './auth';
import kitchensSaga from './kitchens';
import { dishesRealtimeSaga } from './dishes/dishesRealtimeSaga';
import { ingredientsRealtimeSaga } from './ingredients/ingredientsRealtimeSaga';
import { preparationsRealtimeSaga } from './preparations/preparationsRealtimeSaga';

export default function* rootSaga() {
	yield all([
		fork(authSaga),
		fork(kitchensSaga),
		fork(dishesRealtimeSaga),
		fork(ingredientsRealtimeSaga),
		fork(preparationsRealtimeSaga),
	]);
}
