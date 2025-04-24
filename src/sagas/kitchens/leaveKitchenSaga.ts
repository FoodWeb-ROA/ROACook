import { call, put, takeLatest, select } from 'redux-saga/effects';
import { leaveKitchenWatch, leaveKitchenFailure, fetchKitchensWatch } from '../../slices/kitchensSlice';
import { supabase } from '../../data/supabaseClient';

type SessionResponse = {
  data: {
    session: any;
  };
  error: any;
};

function* handleLeaveKitchen(action: ReturnType<typeof leaveKitchenWatch>): Generator<any, void, any> {
  try {
    const kitchenId = action.payload;
    
    // Get current authenticated user
    const sessionResult: SessionResponse = yield call(() => supabase.auth.getSession());

    if (!sessionResult.data.session || !sessionResult.data.session.user) {
      yield put(leaveKitchenFailure('User not authenticated'));
      return;
    }

    const userId = sessionResult.data.session.user.id;

    // Delete the kitchen_users record
    const { error } = yield call(() =>
      supabase
        .from('kitchen_users')
        .delete()
        .match({ 
          user_id: userId,
          kitchen_id: kitchenId 
        })
    );

    if (error) {
      console.error('Error leaving kitchen:', error);
      yield put(leaveKitchenFailure(error.message || 'Failed to leave kitchen'));
      return;
    }

    console.log('Successfully left kitchen:', kitchenId);
    
    // Refresh the kitchens list
    yield put(fetchKitchensWatch());
  } catch (error: any) {
    console.error('Unexpected error in leaveKitchenSaga:', error);
    yield put(leaveKitchenFailure(error.message || 'An unexpected error occurred'));
  }
}

export function* watchLeaveKitchen(): Generator {
  yield takeLatest(leaveKitchenWatch.type, handleLeaveKitchen);
  console.log('* watchLeaveKitchen: watching', leaveKitchenWatch.type);
} 