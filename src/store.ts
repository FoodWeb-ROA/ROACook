import { combineReducers, compose, configureStore, Reducer, AnyAction } from '@reduxjs/toolkit';
import createSagaMiddleware from 'redux-saga';
import rootSaga from './sagas/rootSaga';
import { authReducer } from './slices/authSlice';
import { kitchensReducer } from './slices/kitchensSlice';
import devToolsEnhancer from "redux-devtools-expo-dev-plugin";
import { persistStore, persistReducer, Persistor } from 'redux-persist';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
	FLUSH,
	REHYDRATE,
	PAUSE,
	PERSIST,
	PURGE,
	REGISTER,
} from 'redux-persist';

// Specific persist config for auth slice
const authPersistConfig = {
	key: 'auth',
	storage: AsyncStorage,
	blacklist: ['loading', 'error'] // Only blacklist loading and error states
};

const rootReducer = combineReducers({
	auth: persistReducer(authPersistConfig, authReducer), // Apply nested persist config
	kitchens: kitchensReducer, // kitchens can be persisted directly if needed, or use its own config
});

// Root persist config - might not need whitelist if handling slices individually
const rootPersistConfig = {
	key: 'root',
	storage: AsyncStorage,
	// Whitelist only slices that *don't* have their own nested config, if any.
	// Or, if all slices handle their own persistence like 'auth' now does,
	// you might remove the root whitelist or adjust accordingly.
	// For now, let's assume 'kitchens' should still be persisted directly under root.
	whitelist: ['kitchens'], 
};

const basePersistedReducer = persistReducer(rootPersistConfig, rootReducer);

const PURGE_ACTION_TYPE = 'persist/PURGE_REQUESTED'; // Match action type from saga

// Higher-order reducer to handle purging
const createPurgeableReducer = (reducer: Reducer, persistor: Persistor): Reducer => {
  return (state: any, action: AnyAction) => {
    if (action.type === PURGE_ACTION_TYPE) {
      console.log('--- [Store] Purge action received, calling persistor.purge()');
      persistor.purge(); 
      // We might want to return the initial state after purge
      // Or let the underlying reducer handle its state reset logic (e.g., based on logoutSuccess)
      // For now, just purge and let the reducer run.
    }
    return reducer(state, action);
  };
};

const sagaMiddleware = createSagaMiddleware();

// Create the store *before* creating the persistor that depends on it
const store = configureStore({
	// Note: We will wrap the reducer later, once persistor is created
	reducer: basePersistedReducer, // Use the base persisted reducer for initial config
	middleware: getDefaultMiddleware =>
		getDefaultMiddleware({
			thunk: false,
			serializableCheck: {
				ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
			},
		}).concat(sagaMiddleware),
    devTools: true,
	enhancers: (getDefaultEnhancers) =>
		getDefaultEnhancers().concat(devToolsEnhancer()),
});

// Create the persistor instance *after* the store exists
const persistor = persistStore(store);

// Now, create the final reducer that includes the purge logic
const finalReducer = createPurgeableReducer(basePersistedReducer, persistor);

// Replace the store's reducer with the enhanced one
// NOTE: This replaceReducer step might be tricky or unnecessary depending on toolkit version.
// Let's try configuring it directly first.

// --- REVISED configureStore --- 
const storeRevised = configureStore({
	reducer: createPurgeableReducer(basePersistedReducer, persistor), // Use wrapped reducer directly
	middleware: getDefaultMiddleware =>
		getDefaultMiddleware({
			thunk: false,
			serializableCheck: {
				ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
			},
		}).concat(sagaMiddleware),
    devTools: true,
	enhancers: (getDefaultEnhancers) =>
		getDefaultEnhancers().concat(devToolsEnhancer()),
});


sagaMiddleware.run(rootSaga);

// Do NOT export persistor from here
export default storeRevised; // Export the revised store

export type RootState = ReturnType<typeof storeRevised.getState>;
export type AppDispatch = typeof storeRevised.dispatch;
