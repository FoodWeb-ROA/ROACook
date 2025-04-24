import { call, take, put } from 'redux-saga/effects';
import { EventChannel } from 'redux-saga';
import { createAuthChannel } from './utils';
import { authStateChanged } from '../../slices/authSlice';
import { AuthEventPayload, Session } from './types';

export function* watchAuthChannel(): Generator {
    console.log('* watchAuthChannel: starting...');

    const authChannel: EventChannel<AuthEventPayload> = yield call(createAuthChannel);

    try {
        while (true) {
            const { session }: { session: Session | null } = yield take(authChannel);

            console.log(`* watchAuthChannel: event received, session:`, session ? 'exists' : 'null');

            yield put(authStateChanged({ session }));
        }
    } catch (error) {
         console.error('* watchAuthChannel: channel error', error);
    } finally {
        console.log('* watchAuthChannel: channel terminated');
        
        authChannel.close();
    }
}