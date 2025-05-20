import { call, put, takeLatest, select } from 'redux-saga/effects';
import { fetchKitchensWatch, fetchKitchensSuccess, fetchKitchensFailure } from '../../slices/kitchensSlice';
import { supabase } from '../../data/supabaseClient';
import { Kitchen } from '../../types';
import { appLogger } from '../../services/AppLogService';

// Type definition for Supabase responses
type KitchensResponse = {
  data: any[] | null;
  error: any;
};

type SessionResponse = {
  data: {
    session: any;
  };
  error: any;
};

function* handleFetchKitchens(): Generator<any, void, any> {
  try {
    // Get current authenticated user
    const sessionResult: SessionResponse = yield call(() => supabase.auth.getSession());

    if (!sessionResult.data.session || !sessionResult.data.session.user) {
      yield put(fetchKitchensFailure('User not authenticated'));
      return;
    }

    const userId = sessionResult.data.session.user.id;

    // Fetch kitchens the user is a member of
    const response: KitchensResponse = yield call(() =>
      supabase
        .from('kitchen_users')
        .select(`
          kitchen:kitchen_id (
            kitchen_id,
            name
          )
        `)
        .eq('user_id', userId)
    );

    if (response.error) {
      appLogger.error('Error fetching kitchens:', response.error);
      yield put(fetchKitchensFailure(response.error.message || 'Failed to fetch kitchens'));
      return;
    }

    // Transform data to Kitchen[] format
    const kitchens: Kitchen[] = (response.data || []).map((item) => ({
      kitchen_id: item.kitchen.kitchen_id,
      name: item.kitchen.name,
    }));

    appLogger.log('Kitchens fetched:', kitchens);
    yield put(fetchKitchensSuccess(kitchens));
  } catch (error: any) {
    appLogger.error('Unexpected error in fetchKitchensSaga:', error);
    yield put(fetchKitchensFailure(error.message || 'An unexpected error occurred'));
  }
}

export function* watchFetchKitchens(): Generator {
  yield takeLatest(fetchKitchensWatch.type, handleFetchKitchens);
  appLogger.log('* watchFetchKitchens: watching', fetchKitchensWatch.type);
} 