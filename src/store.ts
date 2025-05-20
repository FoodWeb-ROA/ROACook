// import { combineReducers, compose, configureStore, Reducer, AnyAction } from '@reduxjs/toolkit';
// import createSagaMiddleware from 'redux-saga';
// import rootSaga from './sagas/rootSaga';
// import { authReducer, AuthState } from './slices/authSlice';
// import { kitchensReducer, KitchensState } from './slices/kitchensSlice';
// import devToolsEnhancer from "redux-devtools-expo-dev-plugin";
// import { persistStore, persistReducer, Persistor } from 'redux-persist';
// import AsyncStorage from '@react-native-async-storage/async-storage';
// import {
// 	FLUSH,
// 	REHYDRATE,
// 	PAUSE,
// 	PERSIST,
// 	PURGE,
// 	REGISTER,
// } from 'redux-persist';

// // export type RootState = {
// //   auth: AuthState;
// //   kitchens: KitchensState;
// // };

// // Specific persist config for auth slice
// const authPersistConfig = {
// 	key: 'auth',
// 	storage: AsyncStorage,
// 	blacklist: ['loading', 'error'] // Only blacklist loading and error states
// };

// const rootReducer = combineReducers({
// 	auth: persistReducer(authPersistConfig, authReducer), // Apply nested persist config
// 	kitchens: kitchensReducer, // kitchens can be persisted directly if needed, or use its own config
// });

// // Root persist config - might not need whitelist if handling slices individually
// const rootPersistConfig = {
// 	key: 'root',
// 	storage: AsyncStorage,
// 	// Whitelist only slices that *don't* have their own nested config, if any.
// 	// Or, if all slices handle their own persistence like 'auth' now does,
// 	// you might remove the root whitelist or adjust accordingly.
// 	// For now, let's assume 'kitchens' should still be persisted directly under root.
// 	whitelist: ['kitchens'], 
// };

// const basePersistedReducer = persistReducer(rootPersistConfig, rootReducer);

// const PURGE_ACTION_TYPE = 'persist/PURGE_REQUESTED'; // Match action type from saga

// // Higher-order reducer to handle purging
// const createPurgeableReducer = (reducer: Reducer, persistor: Persistor): Reducer => {
//   return (state: any, action: AnyAction) => {
//     if (action.type === PURGE_ACTION_TYPE) {
//       appLogger.log('--- [Store] Purge action received, calling persistor.purge()');
//       persistor.purge(); 
//       // We might want to return the initial state after purge
//       // Or let the underlying reducer handle its state reset logic (e.g., based on logoutSuccess)
//       // For now, just purge and let the reducer run.
//     }
//     return reducer(state, action);
//   };
// };

// const sagaMiddleware = createSagaMiddleware();

// // Create the store *before* creating the persistor that depends on it
// const store = configureStore({
// 	// Note: We will wrap the reducer later, once persistor is created
// 	reducer: basePersistedReducer, // Use the base persisted reducer for initial config
// 	middleware: getDefaultMiddleware =>
// 		getDefaultMiddleware({
// 			thunk: false,
// 			serializableCheck: {
// 				ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
// 			},
// 		}).concat(sagaMiddleware),
//     devTools: true,
// 	enhancers: (getDefaultEnhancers) =>
// 		getDefaultEnhancers().concat(devToolsEnhancer()),
// });

// // Create the persistor instance *after* the store exists
// const persistor = persistStore(store);

// // Now, create the final reducer that includes the purge logic
// const finalReducer = createPurgeableReducer(basePersistedReducer, persistor);

// // Replace the store's reducer with the enhanced one
// // NOTE: This replaceReducer step might be tricky or unnecessary depending on toolkit version.
// // Let's try configuring it directly first.

// // --- REVISED configureStore --- 
// const storeRevised = configureStore({
// 	reducer: createPurgeableReducer(basePersistedReducer, persistor), // Use wrapped reducer directly
// 	middleware: getDefaultMiddleware =>
// 		getDefaultMiddleware({
// 			thunk: false,
// 			serializableCheck: {
// 				ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
// 			},
// 		}).concat(sagaMiddleware),
//     devTools: true,
// 	enhancers: (getDefaultEnhancers) =>
// 		getDefaultEnhancers().concat(devToolsEnhancer()),
// });


// sagaMiddleware.run(rootSaga);

// // Do NOT export persistor from here
// export default storeRevised; // Export the revised store

// export type RootState = ReturnType<typeof storeRevised.getState>;
// export type AppDispatch = typeof storeRevised.dispatch;

import { combineReducers, configureStore, Reducer, AnyAction } from '@reduxjs/toolkit';
import createSagaMiddleware from 'redux-saga';
import rootSaga from './sagas/rootSaga';
import { authReducer } from './slices/authSlice';
import { kitchensReducer } from './slices/kitchensSlice';
import devToolsEnhancer from "redux-devtools-expo-dev-plugin";
import {
    persistStore,
    persistReducer,
    Persistor,
    PersistState
} from 'redux-persist';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    FLUSH,
    REHYDRATE,
    PAUSE,
    PERSIST,
    PURGE as REDUX_PERSIST_PURGE,
    REGISTER,
} from 'redux-persist';
import { appLogger } from './services/AppLogService';

const authPersistConfig = {
    key: 'auth',
    storage: AsyncStorage,
    blacklist: ['loading', 'error']
};

const persistedAuthReducer = persistReducer(authPersistConfig, authReducer);

const baseRootReducer = combineReducers({
    auth: persistedAuthReducer,
    kitchens: kitchensReducer,
});

type BaseRootReducerState = ReturnType<typeof baseRootReducer>;

const initialRootState: BaseRootReducerState = baseRootReducer(undefined, { type: '@@INIT_FOR_PURGE' as any });

const rootPersistConfig = {
    key: 'root',
    storage: AsyncStorage,
    whitelist: ['kitchens']
};

const persistedRootReducer = persistReducer(rootPersistConfig, baseRootReducer);

const PURGE_ACTION_TYPE = 'persist/PURGE_REQUESTED';

let persistorInstance: Persistor | null = null;

const createPurgeableReducer = <
    S extends BaseRootReducerState,
    A extends AnyAction
>(
    reducerToWrap: Reducer<S & { _persist: PersistState }, A>,
    getPersistor: () => Persistor,
    initialStateForReset: S
): Reducer<S & { _persist?: PersistState }, A> => {
  return (state: (S & { _persist?: PersistState }) | undefined, action: A): S & { _persist?: PersistState } => {
    if (action.type === PURGE_ACTION_TYPE) {
      const persistor = getPersistor();
      if (persistor) {
        appLogger.log('--- [Store] Purge action received, calling persistor.purge()');
        persistor.purge().then(() => {
            appLogger.log('--- [Store] Persistor purge completed.');
        }).catch((err) => {
            appLogger.error('--- [Store] Persistor purge failed:', err);
        });
      }

      return initialStateForReset;
    }

    return reducerToWrap(state as (S & { _persist: PersistState }) | undefined, action);
  };
};

const sagaMiddleware = createSagaMiddleware();

const finalReducer = createPurgeableReducer<BaseRootReducerState, AnyAction>(
    persistedRootReducer,
    () => {
        if (!persistorInstance) {
            throw new Error("Persistor has not been initialized yet.");
        }
        return persistorInstance;
    },
    initialRootState
);

const store = configureStore({
    reducer: finalReducer,
    middleware: getDefaultMiddleware =>
        getDefaultMiddleware({
            thunk: false,
            serializableCheck: {
                ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, REDUX_PERSIST_PURGE, REGISTER, PURGE_ACTION_TYPE],
            },
        }).concat(sagaMiddleware),
    devTools: process.env.NODE_ENV !== 'production',
    enhancers: (getDefaultEnhancers) => {
        const enhancers = getDefaultEnhancers();
        if (process.env.NODE_ENV !== 'production' && devToolsEnhancer) {
            return enhancers.concat(devToolsEnhancer());
        }
        return enhancers;
    },
});

persistorInstance = persistStore(store);

sagaMiddleware.run(rootSaga);

export default store;

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export const getPersistor = (): Persistor => {
    if (!persistorInstance) {
        throw new Error("Persistor has not been initialized yet. Ensure you call this after store setup.");
    }
    return persistorInstance;
};

