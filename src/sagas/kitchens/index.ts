import { all, fork } from 'redux-saga/effects';
import { watchFetchKitchens } from './fetchKitchensSaga';
import { watchLeaveKitchen } from './leaveKitchenSaga';

export default function* kitchensSaga(): Generator {
  console.log('* kitchensSaga: starting...');

  yield all([
    fork(watchFetchKitchens),
    fork(watchLeaveKitchen),
  ]);

  console.log('* kitchensSaga: all watchers forked.');
}