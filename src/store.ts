import { combineReducers, compose, configureStore } from '@reduxjs/toolkit';
import createSagaMiddleware from 'redux-saga';
import rootSaga from './sagas/rootSaga';
import { authReducer } from './slices/authSlice';
import { kitchensReducer } from './slices/kitchensSlice';
import devToolsEnhancer from "redux-devtools-expo-dev-plugin";
import { persistStore, persistReducer } from 'redux-persist';
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
	blacklist: ['loading', 'error', 'session'] // Blacklist loading, error, and session states
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

const persistedReducer = persistReducer(rootPersistConfig, rootReducer);

const sagaMiddleware = createSagaMiddleware();

const store = configureStore({
	reducer: persistedReducer,
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

export const persistor = persistStore(store);

export default store;

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
