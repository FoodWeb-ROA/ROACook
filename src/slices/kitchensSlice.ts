import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Kitchen } from '../types';
import { appLogger } from '../services/AppLogService';

export interface KitchensState {
  kitchens: Kitchen[];
  activeKitchenId: string | null;
  loading: boolean;
  error: string | null;
}

const initialState: KitchensState = {
  kitchens: [],
  activeKitchenId: null,
  loading: false,
  error: null,
};

export const kitchensSlice = createSlice({
  name: 'kitchens',
  initialState,
  reducers: {
    refreshKitchensWatch(state) {
      appLogger.log('[kitchensSlice] refreshKitchensWatch - refreshing kitchens');
      // No need to set loading state as this is a background refresh
    },
    fetchKitchensWatch(state) {
      appLogger.log('[kitchensSlice] fetchKitchensWatch - loading: true');
      state.loading = true;
      state.error = null;
    },
    fetchKitchensSuccess(state, action: PayloadAction<Kitchen[]>) {
      appLogger.log(`[kitchensSlice] fetchKitchensSuccess - Incoming kitchens: ${action.payload.length}, Current activeKitchenId (before logic): ${state.activeKitchenId}`);
      state.kitchens = action.payload;
      state.loading = false;
      state.error = null;

      // Only set activeKitchenId if it's not already set
      if (!state.activeKitchenId && action.payload.length > 0) {
        state.activeKitchenId = action.payload[0].kitchen_id;
        appLogger.log(`[kitchensSlice] fetchKitchensSuccess - Set activeKitchenId (no prior activeId): ${state.activeKitchenId}`);
      } else if (state.activeKitchenId) {
        // Check if the activeKitchenId is still valid
        const isActiveKitchenValid = action.payload.some(
          k => k.kitchen_id === state.activeKitchenId
        );
        if (!isActiveKitchenValid && action.payload.length > 0) {
          // If the activeKitchenId is no longer valid, set it to the first kitchen
          const previousActiveId = state.activeKitchenId;
          state.activeKitchenId = action.payload[0].kitchen_id;
          appLogger.log(`[kitchensSlice] fetchKitchensSuccess - Previous activeKitchenId '${previousActiveId}' is no longer valid. Set to: ${state.activeKitchenId}`);
        } else {
          appLogger.log(`[kitchensSlice] fetchKitchensSuccess - Kept existing activeKitchenId: ${state.activeKitchenId}`);
        }
      } else {
        appLogger.log('[kitchensSlice] fetchKitchensSuccess - No activeKitchenId to set (no kitchens or no persisted activeId).');
      }
      appLogger.log(`[kitchensSlice] fetchKitchensSuccess - Final activeKitchenId: ${state.activeKitchenId}`);
    },
    fetchKitchensFailure(state, action: PayloadAction<string>) {
      appLogger.error(`[kitchensSlice] fetchKitchensFailure - Error: ${action.payload}`);
      state.loading = false;
      state.error = action.payload;
    },
    setActiveKitchen(state, action: PayloadAction<string>) {
      appLogger.log(`[kitchensSlice] setActiveKitchen - New activeKitchenId: ${action.payload}, Previous: ${state.activeKitchenId}`);
      state.activeKitchenId = action.payload;
    },
    leaveKitchenWatch(state, action: PayloadAction<string>) {
      appLogger.log(`[kitchensSlice] leaveKitchenWatch - KitchenId: ${action.payload}`);
      state.loading = true;
    },
    leaveKitchenFailure(state, action: PayloadAction<string>) {
      appLogger.error(`[kitchensSlice] leaveKitchenFailure - Error: ${action.payload}`);
      state.loading = false;
      state.error = action.payload;
    },
  },
});

export const {
  refreshKitchensWatch,
  fetchKitchensWatch,
  fetchKitchensSuccess,
  fetchKitchensFailure,
  setActiveKitchen,
  leaveKitchenWatch,
  leaveKitchenFailure,
} = kitchensSlice.actions;

export const kitchensReducer = kitchensSlice.reducer; 