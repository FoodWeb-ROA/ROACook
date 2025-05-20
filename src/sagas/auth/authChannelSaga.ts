import { call, take, put } from 'redux-saga/effects';
import { EventChannel } from 'redux-saga';
import { createAuthChannel } from './utils';
import { authStateChanged } from '../../slices/authSlice';
import { AuthEventPayload, Session } from './types';
import { appLogger } from '../../services/AppLogService';

export function* watchAuthChannel(): Generator {
    appLogger.log('* watchAuthChannel: starting...');

    const authChannel: EventChannel<AuthEventPayload> = yield call(createAuthChannel);

    try {
        while (true) {
            const { session }: { session: Session | null } = yield take(authChannel);

            appLogger.log(`* watchAuthChannel: event received, session:`, session ? 'exists' : 'null');

            yield put(authStateChanged({ session }));
        }
    } catch (error) {
         appLogger.error('* watchAuthChannel: channel error', error);
    } finally {
        appLogger.log('* watchAuthChannel: channel terminated');
        
        authChannel.close();
    }
}