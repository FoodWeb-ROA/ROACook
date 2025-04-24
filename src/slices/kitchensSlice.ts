import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Kitchen } from '../types';

interface KitchensState {
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
    fetchKitchensWatch(state) {
      state.loading = true;
      state.error = null;
    },
    fetchKitchensSuccess(state, action: PayloadAction<Kitchen[]>) {
      state.kitchens = action.payload;
      state.loading = false;
      state.error = null;
      // Ensure activeKitchenId is valid
      if (!state.activeKitchenId && action.payload.length > 0) {
        state.activeKitchenId = action.payload[0].kitchen_id;
      } else if (
        state.activeKitchenId &&
        !action.payload.some(k => k.kitchen_id === state.activeKitchenId)
      ) {
        state.activeKitchenId = action.payload[0]?.kitchen_id || null;
      }
    },
    fetchKitchensFailure(state, action: PayloadAction<string>) {
      state.loading = false;
      state.error = action.payload;
    },
    setActiveKitchen(state, action: PayloadAction<string>) {
      state.activeKitchenId = action.payload;
    },
    leaveKitchenWatch(state, action: PayloadAction<string>) {
      state.loading = true;
    },
    leaveKitchenFailure(state, action: PayloadAction<string>) {
      state.loading = false;
      state.error = action.payload;
    },
  },
});

export const {
  fetchKitchensWatch,
  fetchKitchensSuccess,
  fetchKitchensFailure,
  setActiveKitchen,
  leaveKitchenWatch,
  leaveKitchenFailure,
} = kitchensSlice.actions;

export const kitchensReducer = kitchensSlice.reducer; 