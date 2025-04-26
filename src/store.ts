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

const rootReducer = combineReducers({
	auth: authReducer,
	kitchens: kitchensReducer,
});

const persistConfig = {
	key: 'root',
	storage: AsyncStorage,
	whitelist: ['auth', 'kitchens'],
};

const persistedReducer = persistReducer(persistConfig, rootReducer);

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
