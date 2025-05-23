import { all, fork } from 'redux-saga/effects';
import { watchFetchKitchens } from './fetchKitchensSaga';
import { watchLeaveKitchen } from './leaveKitchenSaga';
import { watchRefreshKitchens } from './refreshKitchensSaga';
import { appLogger } from '../../services/AppLogService';

export default function* kitchensSaga(): Generator {
  appLogger.log('* kitchensSaga: starting...');

  yield all([
    fork(watchFetchKitchens),
    fork(watchLeaveKitchen),
    fork(watchRefreshKitchens),
  ]);

  appLogger.log('* kitchensSaga: all watchers forked.');
}