import { all, fork } from 'redux-saga/effects';
import { watchFetchKitchens } from './fetchKitchensSaga';
import { watchLeaveKitchen } from './leaveKitchenSaga';
import { watchKitchensRealtime } from './kitchensRealtimeSaga';

export default function* kitchensSaga(): Generator {
  console.log('* kitchensSaga: starting...');

  yield all([
    fork(watchFetchKitchens),
    fork(watchLeaveKitchen),
    fork(watchKitchensRealtime),
  ]);

  console.log('* kitchensSaga: all watchers forked.');
}