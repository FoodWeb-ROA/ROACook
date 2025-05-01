import { all, fork } from 'redux-saga/effects';
import authSaga from './auth';
import kitchensSaga from './kitchens';
// Removed realtime saga imports
// import { dishesRealtimeSaga } from './dishes/dishesRealtimeSaga';
// import { ingredientsRealtimeSaga } from './ingredients/ingredientsRealtimeSaga';
// import { preparationsRealtimeSaga } from './preparations/preparationsRealtimeSaga';

export default function* rootSaga() {
	yield all([
		fork(authSaga),
		fork(kitchensSaga), // Keep non-realtime kitchen sagas
		// Removed realtime saga forks
		// fork(dishesRealtimeSaga),
		// fork(ingredientsRealtimeSaga),
		// fork(preparationsRealtimeSaga),
	]);
}
